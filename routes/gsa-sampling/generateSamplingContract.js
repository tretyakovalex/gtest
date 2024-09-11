const express = require('express');
const router = express.Router();

const fs = require('fs-extra');
const path = require('path');

const moment = require('moment');

const axios = require('axios');
require('dotenv').config();

const https = require('https');

// Load the certificates from files
const serverCert = fs.readFileSync(path.join(__dirname, '..', '..', 'cert', 'cert.pem'));
const intermediateCert = fs.readFileSync(path.join(__dirname, '..', '..', 'cert', 'chain.pem'));

// Create the CA bundle array
const MY_CA_BUNDLE = [serverCert, intermediateCert];

const httpsAgent = new https.Agent({
    ca: MY_CA_BUNDLE
});    

const { pool } = require('../../configs/mysql');

async function generateSamplingContract(data){
    try {
        console.log("Printing data: ", data);

        let paddedSampleNumber = await paddedNumber(data.Sample_No);
        let documentNumber = `GSA-FR-CFRM-${paddedSampleNumber}`;
        // Getting customer info
        let customer = await getCustomerData(data.Sample_No);
        console.log(customer);

        let measurementServices = await getMeasurementServices(data.Sample_No);
        console.log(measurementServices);

        let measurementServicesString = measurementServices.join(", ");

        let method_types = await getMethodData(measurementServices);
        console.log("Printing getMethods: ", method_types);

        let registration = await getRegistrationData(data.Sample_No);
        console.log(registration);

        let currency = await getCurrency(data.country_of_origin);

        let contractData = {
            "documentNumber": documentNumber,
            "date": registration[0].Date,
            "customer": customer,
            "measurementService": measurementServicesString,
            "selectedMethodTypes": method_types,
            "registration": registration[0],
            "currency": currency
        };

        console.log("Printing certificateData: ", contractData);

        console.log("About to send data to generate contract in external api");

        // Define the folder where you want to save the PDF
        const saveFolder = path.join(__dirname, '..', '..', 'handlebars', 'gsa-sampling-contracts');
        
        // Ensure the folder exists
        if (!fs.existsSync(saveFolder)) {
            fs.mkdirSync(saveFolder);
        }

        return await axios.post(`${process.env.PDF_GENERATOR_URL}/generateSamplingContractPdf`, contractData, {
            httpsAgent: new https.Agent({ ca: MY_CA_BUNDLE }), // Use your custom CA if needed
            responseType: 'stream' // Important: Treat the response as a stream
        })
        .then(async response => {
            console.log('Data sent successfully, downloading and saving PDF...');

            let file_name = response.data.rawHeaders[5].match(/filename="(.+\.pdf)"/)[1];
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
        });

    } catch (error) {
        console.error(error);
    }
}

async function paddedNumber(Sample_No){
    return new Promise((resolve, reject) => {
        try {
            if(Sample_No === null){
                reject;
            }

            let str = String(Sample_No);
            while (str.length < 5) {
                str = '0' + str;
            }

            resolve(str);
        } catch (error) {
            console.error(error);
        }
    });
}

async function getCurrency(country_of_origin){
    return new Promise((resolve, reject) => {
        if(country_of_origin === null){
            reject;
        }
        currency = "";

        switch (country_of_origin) {
            case "Rwanda":
                currency = "RWF";
                break;
        
            case "DRC":
                currency = "USD";
                break;

            default:
                currency = "USD";
                break;
        }
        resolve(currency);
    });
}

// Helper function to format the current date and time for renaming files
function getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
}

async function checkAndRenamePDF(file_name) {
    const saveFolder = path.join(__dirname, "..", "..", "handlebars", "gsa-sampling-contracts");
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
        const query = `SELECT cust.company, cust.name, cust.tin, cust.address, cust.phone, cust.country, reg.Sample_No FROM customers cust INNER JOIN registration reg ON reg.customer_id=cust.customer_id WHERE Sample_No=?;`
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
        const query = `SELECT reg.Date, reg.Sample_weight, reg.Customer_sample_name, reg.gsa_sample_id, reg.Approved_Quotation_Value, reg.Approx_days FROM registration reg WHERE Sample_No=?;`
        pool.query(query, [Sample_No], async (err, registration) => {
            if(err){
                console.error(err);
                reject(err);
                return;
            }

            registration[0].Date = await formatDate(registration[0].Date);

            resolve(registration);
        })
    });
}

async function formatDate(mysqlDate) {
    const date = new Date(mysqlDate);

    const day = String(date.getUTCDate()).padStart(2, '0'); // Get day and pad with leading zero if needed
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-based, so we add 1
    const year = date.getUTCFullYear(); // Get the full year

    return `${day}.${month}.${year}`;
}

async function getMeasurementServices(Sample_No){
    return new Promise(async (resolve, reject) => {
        let elementsAndSymbols = await getElementSymbols();
        let compoundSymbols = await getMainElementSymbol();
        const query = `SELECT * FROM registration WHERE Sample_No=?;`
        pool.query(query, [Sample_No], (err, registration) => {
            if(err){
                console.error(err);
                reject(err);
                return;
            }

            // console.log("Printing registration: ", registration);

            let measurementServices = [];
            let selectedElements = [];
            let filteredMeasurementServices = [];

            for (const [key, value] of Object.entries(registration[0])) {
                if (Buffer.isBuffer(value) && value.equals((Buffer.from([1])))) {
                    selectedElements.push({key: key, value: value});
                }
            }

            // ===  Check if selectedElements contains "Semi_quantitative" or "Full_scan" or "Sample_preparation" or "Geological_sample" ===
            const hasSemiQuantitative = selectedElements.some(el => el.key === "Semi_quantitative");
            const hasFullScan = selectedElements.some(el => el.key === "Full_scan");
            const hasSamplePreparation = selectedElements.some(el => el.key === "Sample_preparation");
            const hasGeologicalSample = selectedElements.some(el => el.key === "Geological_sample");
            
            console.log("Printing selected items from registration: ", selectedElements);
            
            if (hasSemiQuantitative || hasFullScan || hasSamplePreparation || hasGeologicalSample) {
                // If any of these elements exist, remove all other elements and push the specific service
                selectedElements = [];  // Clear the selected elements
                
                if (hasSemiQuantitative) {
                    measurementServices.push("Semi_quantitative");
                    filteredMeasurementServices.push("Semi_quantitative");
                }
                if (hasFullScan) {
                    measurementServices.push("Full_scan");
                    filteredMeasurementServices.push("Full_scan");
                }
                if (hasSamplePreparation) {
                    measurementServices.push("Sample_preparation");
                    filteredMeasurementServices.push("Sample_preparation");
                }
                if (hasGeologicalSample) {
                    measurementServices.push("Geological_sample");
                    filteredMeasurementServices.push("Geological_sample");
                }
            }
            // =============================================================================================================================

            // === Check if selectedElements contains "REO" ===
            let REO_Elements = [57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 89, 91, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103];
            let hasREO = selectedElements.some(el => el.key === "Sum_rare_earth_elements");
            if(hasREO){
                measurementServices.push(!selectedElements.includes(REO_Elements));
            }
            // ================================================

            // === Add main element ===
            for(const item of compoundSymbols){
                if(registration[0].Type === item.compound_name){
                    console.log(item);
                    filteredMeasurementServices.push(item.compound_abbreviation);
                }
            }
            // ========================

            // === Adding non elements ===
            let hasRA = selectedElements.some(el => el.key === "RA");
            let hasMoisture = selectedElements.some(el => el.key === "Moisture");
            if(hasRA){
                filteredMeasurementServices.push("RA");
            }
            if(hasMoisture){
                filteredMeasurementServices.push("Moisture");
            }
            // ===========================

            console.log("Printing measurement services: ", measurementServices);

            
            for(const item of elementsAndSymbols){
                if(measurementServices.includes(item.element_name)){
                    filteredMeasurementServices.push(item.element_symbol);
                }
            }

            console.log("Printing filtered Measurement Services: ", filteredMeasurementServices);

            resolve(filteredMeasurementServices);
        })
    });
}

async function getElementSymbols(){
    return new Promise((resolve, reject) => {
        const query = `SELECT element_id, element_symbol, element_name FROM elements;`
        pool.query(query, (err, elements) => {
            if(err){
                console.error(err);
                reject(err);
                return;
            }

            resolve(elements);
        })
    });
}

async function getMainElementSymbol(){
    return new Promise((resolve, reject) => {
        const query = `SELECT comp.compound_name, comp.compound_abbreviation FROM compounds comp;`
        pool.query(query, (err, compounds) => {
            if(err){
                console.error(err);
                reject(err);
                return;
            }

            resolve(compounds);
        })
    });
}

async function getMethodData(data){
    return new Promise(async (resolve, reject) => {
        let elementsAndSymbols = await getElementSymbols();

        let filteredArray = [];
        let nonElements = ["Full_scan", "Semi_quantitative", "Sample_preparation", "Geological_sample", "RA", "Moisture"];

        for(const item of elementsAndSymbols){
            if(data.includes(item.element_symbol)){
                console.log(item);
                filteredArray.push(item.element_name);
            }
        }

        for(const item of data){
            if(nonElements.includes(item)){
                console.log(item);
                filteredArray.push(item);
            }
        }

        // console.log("Printing filteredArray: ", filteredArray);

        const query = `SELECT * FROM methods;`
        pool.query(query, (err, methods) => {
            if(err){
                console.error(err);
                reject(err);
            }

            let filteredMethods = [];
            let method_data = {};
            let methods_sample_preparations = '';
            let methods_string = '';

            // const excludedMethod = "GSA-TTR-SOP-001";

            // Sets to track unique values
            const uniqueMethods = new Set();
            const uniqueSamplePreparations = new Set();

            methods.filter((method) => {
                for (const [key, value] of Object.entries(method)) {
                    if (value !== null && Buffer.isBuffer(value) && value.equals(Buffer.from([0x01]))) {
                        // if (method.Methods !== excludedMethod){
                            // console.log("key: ", key, ", value: ", value);
                            if (filteredArray.includes(key)) {
                                let method_exists = false;
                                // console.log("key: ", key, ", value: ", value);

                                while (!method_exists) {
                                    if (!uniqueMethods.has(method.Methods) || !uniqueSamplePreparations.has(method.Sample_Preparation)) {
                                        methods_string += method.Methods + ' ';
    
                                        if (!uniqueSamplePreparations.has(method.Sample_Preparation)) {
                                            methods_sample_preparations += method.Type + ', ';
                                            uniqueSamplePreparations.add(method.Sample_Preparation);
                                        }
    
                                        uniqueMethods.add(method.Methods);
    
                                        method_data = methods_sample_preparations.trim()
    
                                        filteredMethods.push(method);
                                    }
                                    method_exists = true;
                                }
                            }
                        // }
                    }
                }
            });

            // Trimming last comma:
            if (method_data.endsWith(',')) {
                method_data = method_data.slice(0, -1); // Removes the last comma and space
            }
            // console.log("Method Data: ", method_data);

            resolve(method_data);
        })
    });
}

module.exports = { generateSamplingContract };