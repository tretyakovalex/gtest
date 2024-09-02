const express = require('express');
const router = express.Router();

const fs = require('fs-extra');
const path = require('path');

const moment = require('moment');

const axios = require('axios');
require('dotenv').config();


// const { generateCertificatePdf } = require('../handlebars/compileCertificateTemplate.js');
// const { sendMessageForCertificateComponent } = require('../handlebars/websocket');

const { pool } = require('../configs/mysql');
// const { compileFunction } = require('vm');

async function generateCertificate(data){
    try {
        console.log("Printing data: ", data);

        // Getting customer info
        let customer = await getCustomerData(data.Sample_No);
        // console.log(customer);

        // Getting registration info
        let registration = await getRegistrationData(data.Sample_No);
        // console.log(registration);


        // === Getting method info ===
        
        // --- Getting Full Scan value and adding to combinedRemoveList if true ---
        console.log("Printing value of registration[0].Full_scan: ", Buffer.isBuffer(registration[0].Full_scan));
        
        let combinedRemoveList = [];
        if(Buffer.isBuffer(registration[0].Full_scan) === true){
            combinedRemoveList = [registration[0].Type];
            data.selectedElements.push({name: 'Full_scan'});
        } else {
            combinedRemoveList = [registration[0].Type];
        }
        // ------------------------------------------------------------------------
        
        console.log("Printing combinedRemoveList: ", combinedRemoveList);
        // Remove matching elements
        let filteredArray = data.selectedElements.filter(item => !combinedRemoveList.includes(item.name)).map(item => item.name);
        console.log("Printing filteredArray: ", filteredArray);
        let method = await getMethodData(registration[0].Type, filteredArray);
        console.log(method);
        
        // ===========================

        // Getting method info
        let result = await getResultsBySampleNo(data.Sample_No, data.selectedElements, data.RA_present, data.RA_In_Kg);
        // console.log("Printing result: ", result);

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

        let certificateData = {
            "certType": data.certType,
            "paddedNum": paddedNum,
            "certNumVersion": data.certNumVersion,
            "customer": customer,
            "registration": registration,
            "method": method,
            "releaseDate": moment(data.releaseDate).format('DD.MM.YYYY'),
            "date": moment(registration[0].date).format('DD.MM.YYYY'),
            "date_of_lab": moment(result[0].date_of_lab).format('DD.MM.YYYY'),
            "Sampling_date": moment(registration[0].Sampling_date).format('DD.MM.YYYY'),
            "results": result,
            "sampledGSA": data.sampledGSA,
            "addSignatures": data.addSignatures,
            "certificate_file_name":`${registration[0].gsa_sample_id}`,
            "RA_present": RA_present,
            "RA_In_Kg": data.RA_In_Kg
        };

        console.log("Printing certificateData: ", certificateData);

        // let pdfPath = await generateCertificatePdf(certificateData);

        // axios.post('http://localhost:4400/generateAssayCertificatePdf', certificateData)
        axios.post(`${process.env.PDF_GENERATOR_URL}/generateAssayCertificatePdf`, certificateData)
            .then(response => {
                console.log('Data sent successfully:', response.data);
            })
            .catch(error => {
                console.error('Error sending data:', error);
            });


        // return pdfPath;
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

async function getCustomerData(Sample_No){
    return new Promise((resolve, reject) => {
        const query = `SELECT cust.company, cust.name, cust.email, cust.address, reg.Sample_No FROM customers cust INNER JOIN registration reg ON reg.customer_id=cust.customer_id WHERE Sample_No=?;`
        pool.query(query, [Sample_No], (err, customer) => {
            if(err){
                console.error(err);
                reject(err);
                return;
            }

            let filteredCustomer = {};
            if (customer && customer.length > 0) {
                if (customer[0].company) {
                    const { name, ...rest } = customer[0];
                    filteredCustomer = rest;
                } else {
                    filteredCustomer = { company: customer[0].company };
                }
            }

            resolve(filteredCustomer);
        })
    });
}

async function getRegistrationData(Sample_No){
    return new Promise((resolve, reject) => {
        const query = `SELECT gsa_sample_id, Customer_sample_name, itsci_number, Type, Lot_weight, date, Sampling_date, Sample_No, Full_scan FROM registration WHERE Sample_No=?;`
        pool.query(query, [Sample_No], (err, registration) => {
            if(err){
                console.error(err);
                reject(err);
            }

            resolve(registration);
        })
    });
}

async function getMethodData(Type, filteredArray){
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM methods;`
        pool.query(query, async (err, methods) => {
            if(err){
                console.error(err);
                reject(err);
            }

            let compound = await getCompoundByCompoundName(Type);
            console.log("Printing compound: ", compound);

            let element_name = compound[0].element_name;

            let filteredMethods = [];
            let method_data = {};
            let methods_sample_preparations = '';
            let methods_string = '';

            const excludedMethod = "GSA-TTR-SOP-001";

            // Sets to track unique values
            const uniqueMethods = new Set();
            const uniqueSamplePreparations = new Set();

            methods.filter((method) => {
                for (const [key, value] of Object.entries(method)) {
                    if (value !== null && Buffer.isBuffer(value) && value.equals(Buffer.from([0x01]))) {
                        if (key === element_name) {
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
                                        filteredResults.push({name: element_info[0].element_symbol, value: value.toFixed(2)});
                                    } else {
                                        if(element_info[0].oxides !== undefined){
                                            // Find element by name and obtain Element in Oxide form
                                            let oxide_value = value * element_info[0].Factor;
                                            // if(oxide_value < 0.01){
                                            //     filteredResults.push({name: element_info[0].oxides, value: "< 0.01"});
                                            // } else if (oxide_value >= 0.01){
                                            // }
                                            filteredResults.push({name: element_info[0].oxides, value: oxide_value.toFixed(2)});
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
                    result.value = `${result.value} %`;
                }
            });

            resolve(combinedResults);
        })
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