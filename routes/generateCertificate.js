const express = require('express');
const router = express.Router();

const fs = require('fs-extra');
const path = require('path');

const moment = require('moment');

const axios = require('axios');
require('dotenv').config();

const https = require('https');

// Load the certificates from files
const serverCert = fs.readFileSync(path.join(__dirname, '..', 'cert', 'cert.pem'));
const intermediateCert = fs.readFileSync(path.join(__dirname, '..', 'cert', 'chain.pem'));

// Create the CA bundle array
const MY_CA_BUNDLE = [serverCert, intermediateCert];

const httpsAgent = new https.Agent({
    ca: MY_CA_BUNDLE
});    
// const { generateCertificatePdf } = require('../handlebars/compileCertificateTemplate.js');
// const { sendMessageForCertificateComponent } = require('../handlebars/websocket');

const { pool } = require('../configs/mysql');
// const { compileFunction } = require('vm');

async function generateCertificate(data){
    try {
        console.log("Printing data: ", data);

        console.log("PRINTING date_of_lab: ", data.date_of_lab);

        // Getting customer info
        let customer = await getCustomerData(data.Sample_No);
        // console.log(customer);

        // Getting registration info
        let registration = await getRegistrationData(data.Sample_No);
        console.log("Printing registration: ", registration);


        // === Getting method info ===
        
        // --- Getting Full Scan value and adding to combinedRemoveList if true ---
        console.log("Printing value of registration[0].Full_scan: ", registration[0].Full_scan);
        
        let combinedRemoveList = [];
        if(registration[0].Full_scan === true){
            combinedRemoveList = [registration[0].Type];
            data.selectedElements.push({name: 'Full_scan'});
        } else {
            combinedRemoveList = [registration[0].Type];
        }
        // ------------------------------------------------------------------------

        // --- Getting Full Scan value and adding to combinedRemoveList if true ---
        console.log("Printing value of registration[0].Semi_quantitative: ", registration[0].Semi_quantitative);
        
        if(registration[0].Semi_quantitative === true){
            combinedRemoveList = [registration[0].Type];
            data.selectedElements.push({name: 'Semi_quantitive'});
        } else {
            combinedRemoveList = [registration[0].Type];
        }
        // ------------------------------------------------------------------------
        
        console.log("Printing combinedRemoveList: ", combinedRemoveList);
        // Remove matching elements
        let filteredArray = data.selectedElements.filter(item => !combinedRemoveList.includes(item.name)).map(item => item.name);
        console.log("Printing filteredArray: ", filteredArray);

        // manually selected method(s) overwrite:
        let method;
        if(data.selectedMethods){
            console.log("Printing manually selected methods: ", data.selectedMethods);
            method = await getMethodData(registration[0].Type, filteredArray, data.selectedMethods);
        } else if(!data.selectedMethods){
            method = await getMethodData(registration[0].Type, filteredArray);
        }
        console.log("Method :) ", method);
        
        // ===========================


        let result = await getResultsBySampleNo(data.Sample_No, data.selectedElements, data.RA_present, data.RA_In_Kg);
        console.log("Printing result: ", result);

        let RA_present;
        for (let res of result) {
            // console.log("Priting res of result: ", res);
            for (let [key, value] of Object.entries(res)) {
                // console.log("Printing key of res: ", value);
                if(value === "RA"){
                    data.RA_present = true;
                    RA_present = true;
                    // console.log("Printing data.RA_Present: ", RA_present);
                }
            }
        }

        let paddedNum = await numberPadding(data.Sample_No);

        let disclaimer = await addDisclaimer(data.certNumVersion);

        let Sampling_date = moment(registration[0].Sampling_date);

        let date_of_lab = await getDateOfLabFromResults(data.Sample_No);
        console.log("Printing date_of_lab from getDateOfLabFromResults():", date_of_lab);

        let certificateData = {
            "certType": data.certType,
            "paddedNum": paddedNum,
            "certNumVersion": data.certNumVersion,
            "customer": customer,
            "registration": registration,
            "method": method,
            "releaseDate": moment(data.releaseDate).format('DD.MM.YYYY'),
            "date": moment(registration[0].date).format('DD.MM.YYYY'),
            // "date_of_lab": moment(result[0].date_of_lab).format('DD.MM.YYYY'),
            "date_of_lab": moment(date_of_lab).format('DD.MM.YYYY'),
            "Sampling_date": Sampling_date.isValid() ? moment(registration[0].Sampling_date).format('DD.MM.YYYY') : undefined,
            "results": result,
            "sampledGSA": data.sampledGSA,
            "addSignatures": data.addSignatures,
            "addDisclaimer": data.addDisclaimer,
            "certificate_file_name":`${registration[0].gsa_sample_id}${data.certNumVersion}`,
            "RA_present": RA_present,
            "RA_In_Kg": data.RA_In_Kg,
            "disclaimer": disclaimer
        };

        console.log("Printing certificateData: ", certificateData);

        // let pdfPath = await generateCertificatePdf(certificateData);

        console.log("About to send data to generate certificate in external api");

        // Define the folder where you want to save the PDF
        const saveFolder = path.join(__dirname, '..', 'handlebars', 'gsa-certificates');
        
        // Ensure the folder exists
        if (!fs.existsSync(saveFolder)) {
            fs.mkdirSync(saveFolder);
        }

        return await axios.post(`${process.env.PDF_GENERATOR_URL}/generateAssayCertificatePdf`, certificateData, {
            httpsAgent: new https.Agent({ ca: MY_CA_BUNDLE }), // Use your custom CA if needed
            responseType: 'stream' // Important: Treat the response as a stream
        })
        .then(async response => {
            console.log('Data sent successfully, downloading and saving PDF...');

            let file_name = response.data.rawHeaders[13].match(/filename="(.+\.pdf)"/)[1];
            console.log("Printing received file_name: ", file_name);

            // === function that will rename old pdf by adding a timestamp at the end ===
            let pdfFilePath = await checkAndRenamePDF(file_name);

            const writer = fs.createWriteStream(pdfFilePath);
    
            // Pipe the response stream to the file
            response.data.pipe(writer);
            // ==========================================================================

            // const pdfFilePath = path.join(saveFolder, file_name);
            // console.log("Printing pdfFilePath: ", pdfFilePath);
    
            // Create a Promise to handle the file writing
            return new Promise((resolve, reject) => {
                // const writer = fs.createWriteStream(pdfFilePath);
    
                // // Pipe the response stream to the file
                // response.data.pipe(writer);
    
                // Handle the 'finish' event to know when the file is written
                writer.on('finish', () => {
                    console.log('PDF saved successfully to', pdfFilePath);
                    resolve(pdfFilePath); // Resolve with the PDF file path
                });
    
                // Handle errors during the file write process
                writer.on('error', (error) => {
                    console.error('Error saving PDF:', error);
                    reject(error); // Reject the promise if there's an error
                });
            });
        })  

        

        // let file_name = '';


        // const response = await axios.post(`${process.env.PDF_GENERATOR_URL}/generateAssayCertificatePdf`, certificateData, {
        //     httpsAgent: new https.Agent({ ca: MY_CA_BUNDLE }), // Use your custom CA if needed
        //     responseType: 'stream' // Important: Treat the response as a stream
        // });

        // let file_name = response.data.rawHeaders[5].match(/filename="(.+\.pdf)"/)[1];
        // console.log("Printing received file_name: ", file_name);
        // const pdfFilePath = path.join(saveFolder, file_name);
        // console.log("Printing pdfFilePath: ", pdfFilePath);
        // // Create a write stream to save the PDF
        // // const writer = fs.createWriteStream(pdfFilePath);

        // // Create a Promise to handle the file writing
        // return new Promise((resolve, reject) => {
        //     const writer = fs.createWriteStream(pdfFilePath);

        //     // Pipe the response stream to the file
        //     response.data.pipe(writer);

        //     // Handle the 'finish' event to know when the file is written
        //     writer.on('finish', () => {
        //         console.log('PDF saved successfully to', pdfFilePath);
        //         resolve(pdfFilePath); // Resolve with the PDF file path
        //     });

        //     // Handle errors during the file write process
        //     writer.on('error', (error) => {
        //         console.error('Error saving PDF:', error);
        //         reject(error); // Reject the promise if there's an error
        //     });
        // });

        // axios.post('http://localhost:4400/generateAssayCertificatePdf', certificateData)
        // axios.post(`${process.env.PDF_GENERATOR_URL}/generateAssayCertificatePdf`, certificateData, { httpsAgent })
        //     .then(response => {
        //         console.log('Data sent successfully:', response.data);
        //         // file_name = response.data.match(/[^\/]+$/)[0];
        //         // let file_location = path.join(__dirname, '..', '..', 'handlebars', 'gsa-sampling-certificates', file_name);
        //         // console.log("printing file location: ", file_location);


        //     })
        //     .catch(error => {
        //         console.error('Error sending data:', error);
        //     });


        
        // console.log("Printing pdf path: ", pdfPath);

        // const file_name = pdfPath.match(/[^\/]+$/)[0];

        // console.log("Printing file_name: ", file_name);

        // const pdfData = await fs.promises.readFile(path.join(__dirname, "..", "handlebars", "gsa-certificates", file_name));

        // console.log("Printing pdfData: ", pdfData);

        // sendMessageForCertificateComponent(pdfData);

    } catch (error) {
        console.error(error);
    }
}

async function addDisclaimer(certNumVersion){
    switch (certNumVersion) {
        case 'F':
            return "These results are indicative and should not be used for commercial purposes.";
        case 'Q':
            return "These results are indicative and should not be used for commercial purposes.";
        case 'R':
            return "The measurement is based on the intensity of radiation emitted by the analyzed material from the received sample.";
        case 'U':
            return "";
        case 'S':
            return "";
        default:
            return "";
    }
}

// Helper function to format the current date and time for renaming files
function getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
}

async function checkAndRenamePDF(file_name) {
    const saveFolder = path.join(__dirname, "..", "handlebars", "gsa-certificates");
    const pdfFilePath = path.join(saveFolder, file_name);

    try {
        const files = await fs.readdir(saveFolder);
        const matchingFiles = files.filter(file => file === file_name);

        // If the file exists, rename it with a timestamp
        if (matchingFiles.length > 0) {
            const timestamp = getTimestamp();
            const existingFilePath = path.join(saveFolder, matchingFiles[0]);
            const renamedFileName = `${file_name.replace('.pdf', '')}_${timestamp}.pdf`;
            const renamedFilePath = path.join(saveFolder, renamedFileName);

            // Rename the old file
            await fs.rename(existingFilePath, renamedFilePath);
            console.log(`Renamed old PDF file to: ${renamedFileName}`);
        }

        // Return the path where the new PDF will be saved
        return pdfFilePath;
    } catch (error) {
        console.error('Error handling PDF save:', error);
        throw error;
    }
}

async function getCustomerData(Sample_No){
    return new Promise((resolve, reject) => {
        const query = `SELECT cust.company, cust.name, cust.surname, cust.email, cust.address, reg.Sample_No FROM customers cust INNER JOIN registration reg ON reg.customer_id=cust.customer_id WHERE Sample_No=?;`
        pool.query(query, [Sample_No], (err, customer) => {
            if(err){
                console.error(err);
                reject(err);
                return;
            }

            // let filteredCustomer = {};
            // if (customer && customer.length > 0) {
            //     if (customer[0].company) {
            //         const { name, ...rest } = customer[0];
            //         filteredCustomer = rest;
            //     } else {
            //         filteredCustomer = { company: customer[0].company };
            //     }
            // }

            let filteredCustomer = customer[0];

            resolve(filteredCustomer);
        })
    });
}

async function getRegistrationData(Sample_No){
    return new Promise((resolve, reject) => {
        const query = `SELECT gsa_sample_id, Customer_sample_name, itsci_number, Type, Lot_weight, date, Sampling_date, Sample_No, Full_scan, Semi_quantitative FROM registration WHERE Sample_No=?;`
        pool.query(query, [Sample_No], (err, registration) => {
            if(err){
                console.error(err);
                reject(err);
            }

            // Check if Full_scan is a buffer
            if (Buffer.isBuffer(registration[0].Full_scan)) {
                // Compare the Buffer content to determine true or false
                if (registration[0].Full_scan.equals(Buffer.from([0]))) {
                    registration[0].Full_scan = false;
                } else if (registration[0].Full_scan.equals(Buffer.from([1]))) {
                    registration[0].Full_scan = true;
                }
            }

            // Check if Semi_quantitative is a buffer
            if (Buffer.isBuffer(registration[0].Semi_quantitative)) {
                // Compare the Buffer content to determine true or false
                if (registration[0].Semi_quantitative.equals(Buffer.from([0]))) {
                    registration[0].Semi_quantitative = false;
                } else if (registration[0].Semi_quantitative.equals(Buffer.from([1]))) {
                    registration[0].Semi_quantitative = true;
                }
            }

            resolve(registration);
        })
    });
}

async function getMethodData(Type, filteredArray, manualMethods){
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM methods;`
        pool.query(query, async (err, methods) => {
            if(err){
                console.error(err);
                reject(err);
            }


            let compound = await getCompoundByCompoundName(Type);
            console.log("Printing compound: ", compound);

            let element_name = "";
            if(Type !== 'Unidentified'){
                element_name = compound[0].element_name;
            }

            let filteredMethods = [];
            let method_data = {};
            let methods_sample_preparations = '';
            let methods_string = '';

            const excludedMethod = "GSA-TTR-SOP-001";

            // Sets to track unique values
            const uniqueMethods = new Set();
            const uniqueSamplePreparations = new Set();

            if(manualMethods.length !== 0){
            
                let filteredData = methods.filter(item => manualMethods.includes(item.Methods));
                console.log("filteredData inside manual Methods: ", filteredData);

                method_data = {
                    Sample_Preparation: Array.from(new Set(filteredData.map(item => item.Sample_Preparation))).join(', '),
                    Methods: filteredData.map(item => item.Methods).join(', ')
                };
                console.log("method data inside manual Methods: ", method_data);

            } else if(manualMethods.length === 0){

                methods.filter((method) => {
                    for (const [key, value] of Object.entries(method)) {
                        if (value !== null && Buffer.isBuffer(value) && value.equals(Buffer.from([0x01]))) {
                            if (key === element_name && Type !== 'Unidentified') {
                                if (!uniqueMethods.has(method.Methods) || !uniqueSamplePreparations.has(method.Sample_Preparation)) {
                                    filteredMethods.push(method);
    
                                    if (method.Sample_Preparation !== null && !uniqueSamplePreparations.has(method.Sample_Preparation)) {
                                        methods_sample_preparations += method.Sample_Preparation + ' ';
                                        uniqueSamplePreparations.add(method.Sample_Preparation); // Mark Sample_Preparation as seen
                                    }
    
                                    if (!uniqueMethods.has(method.Methods)) {
                                        methods_string += method.Methods + ' ';
                                        uniqueMethods.add(method.Methods); // Mark Methods as seen
                                    }
    
                                    method_data = {
                                        Sample_Preparation: methods_sample_preparations.trim(),
                                        Methods: methods_string.trim()  // Trimming any extra spaces
                                    };
                                }
                            } else if (method.Methods !== excludedMethod){
                                if (filteredArray.includes(key)) {
                                    let method_exists = false;
                                    while (!method_exists) {
                                        if (!uniqueMethods.has(method.Methods) || !uniqueSamplePreparations.has(method.Sample_Preparation)) {
                                            methods_string += method.Methods + ' ';
        
                                            if (method.Sample_Preparation !== null && !uniqueSamplePreparations.has(method.Sample_Preparation)) {
                                                methods_sample_preparations += method.Sample_Preparation + ' ';
                                                uniqueSamplePreparations.add(method.Sample_Preparation);
                                            }
        
                                            uniqueMethods.add(method.Methods);
        
                                            method_data = {
                                                Sample_Preparation: methods_sample_preparations.trim(),
                                                Methods: methods_string.trim()
                                            };
        
                                            filteredMethods.push(method);
                                        }
                                        method_exists = true;
                                    }
                                }
                            }
                        }
                    }
                });

            }

            console.log("Method Data: ", method_data);

            resolve(method_data);
        })
    });
}

async function getCompoundByCompoundName(compound_name){
    return new Promise((resolve, reject) => {
        const query = `SELECT comp.atomic_number, comp.compound_name, elem.element_name FROM compounds comp INNER JOIN elements elem ON elem.element_id=comp.atomic_number WHERE comp.compound_name=?;`
        pool.query(query, [compound_name], (err, compound) => {
            if(err){
                console.error(err);
                reject(err);
            }

            resolve(compound);
        })
    });
}

async function getResultsBySampleNo(Sample_No, selectedElements, RA_present, RA_In_Kg){
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM results where Sample_No=?;`
        pool.query(query, [Sample_No], async (err, result) => {
            if(err){
                console.error(err);
                reject(err);
            }

            let filteredResults = [];
            let raAndMoistureResults = [];
            for (let res of result) {
                for (let [key, value] of Object.entries(res)) {
                    if (value !== null && key !== 'Sample_No' && key !== 'date_of_lab') {
                        
                        for (let item of selectedElements) {
                            if (item.name === key && item.displayed === true) {
                                console.log({key: key, value: value});
                                if(key !== 'RA' && key !== 'Moisture'){
                                    let element_info = await getElement(key);

                                    if (item.asMetal === true) {
                                        // Find element by name and obtain Element symbol
                                        if(item.showAsPPM === true){
                                            // let convertedValue = (value / 100) * 10000; 
                                            let convertedValue = value * 10000; 
                                            filteredResults.push({name: element_info[0].element_symbol, value: convertedValue.toFixed(2), showAsPPM: true});
                                        } else if(item.showAsPPM === false){
                                            filteredResults.push({name: element_info[0].element_symbol, value: value.toFixed(2)});
                                        }
                                    } else {
                                        if(element_info[0].oxides !== undefined){
                                            // Find element by name and obtain Element in Oxide form
                                            let oxide_value = value * element_info[0].Factor;
                                            // if(oxide_value < 0.01){
                                            //     filteredResults.push({name: element_info[0].oxides, value: "< 0.01"});
                                            // } else if (oxide_value >= 0.01){
                                            // }
                                            if(item.showAsPPM === true){
                                                // let convertedValue = (oxide_value / 100) * 10000; 
                                                let convertedValue = oxide_value * 10000; 
                                                filteredResults.push({name: element_info[0].element_symbol, value: convertedValue.toFixed(2), showAsPPM: true});
                                            } else if(item.showAsPPM === false){
                                                filteredResults.push({name: element_info[0].oxides, value: oxide_value.toFixed(2)});
                                            }
                                        }
                                    }                                        
                                } else if (key === 'Moisture'){
                                    raAndMoistureResults.push({name: key, value: `${value.toFixed(2)} %`});
                                } else if (key === 'RA'){
                                    // Covert RA to bq/kg or bq/g
                                    if(RA_In_Kg === true){
                                        raAndMoistureResults.push({name: key, value: `${value.toFixed(2)} bq/kg`});
                                    } else {
                                        raAndMoistureResults.push({name: key, value: `${value.toFixed(2)} bq/g`});
                                    }
                                }
                            }
                        }
                    }
                }
            }

            filteredResults.sort((a, b) => b.value - a.value);
            
            filteredResults.forEach(result => {
                if (result.value < 0.01) {
                    result.value = "< 0.01";
                }
            });

            // raAndMoistureResults.sort((a, b) => b.name - a.name);
            raAndMoistureResults.sort((a, b) => {
                if (a.name === "Moisture") return -1; // Place "RA" first
                if (b.name === "Moisture") return 1;  // Place "RA" first
                return a.name.localeCompare(b.name); // Sort remaining items in ascending order
            });

            combinedResults = [...filteredResults, ...raAndMoistureResults];

            combinedResults.forEach((result) => {
                if(result.name !== "RA" && result.name !== "Moisture"){
                    if(result.showAsPPM === true){
                        result.value = `${result.value} ppm`;
                    } else {
                        result.value = `${result.value} %`;
                    }
                }
            });

            resolve(combinedResults);
        })
    });
}

async function getDateOfLabFromResults(Sample_No){
    return new Promise((resolve, reject) => {
        try {
            pool.query('SELECT date_of_lab FROM results where Sample_No=?', Sample_No, (err, result) => {
                if(err){
                    console.error(err);
                    reject;
                }

                resolve(result[0].date_of_lab);
            })
        } catch (error) {
            console.error(error);
        }
    });
}

async function filterResult(result, selectedElements){
    return new Promise((resolve, reject) => {

        let filteredResults = [];
        result.forEach((res) => {
            Object.entries(res).forEach(([key, value]) => {
              if (value !== null && key !== 'Sample_No' && key !== 'date_of_lab') {
                selectedElements.forEach(async (item) => {
                    if(item.name === key){
                        console.log("Printing asMetal: ", item.asMetal);
                        
                        if(item.asMetal === true){
                            let element_info = await getElement(key);
                            console.log("Printing element_info: ", element_info);
                            // Find element by name and obtain Element symbol
                            console.log({name: element_info[0].element_symbol, value: value});
                            filteredResults.push({name: element_info[0].element_symbol, value: value});
                        } else {
                            let element_info = await getElement(key);
                            console.log(element_info);
                            // Find element by name and obtain Element in Oxyde form
                            console.log({name: element_info[0].oxides, value: value});
                            filteredResults.push({name: element_info[0].oxides, value: value});
                        }
                    }
                })
              }
            });
        });

        resolve(filteredResults);
    });
}

async function getElement(element_name){
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM elements WHERE element_name=?;`
        pool.query(query, [element_name], (err, element) => {
            if(err){
                console.error(err);
                reject(err);
            }

            console.log("Printing element: ", element);

            resolve(element);
        })
    });
}

async function numberPadding(number){
    return new Promise((resolve, reject) => {
        let str = String(number);
        while (str.length < 5) {
            str = '0' + str;
        }
        resolve (str);
    });
}

module.exports = { generateCertificate };