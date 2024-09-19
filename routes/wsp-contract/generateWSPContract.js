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

async function generateWSPContract(data){
    try {
        console.log("Printing data: ", data);

        let paddedSampleNumber = await paddedNumber(data.sample_no);
        let documentNumber = `GSA${paddedSampleNumber}`;
        // Getting customer info
        
        let client = await getCustomerData(data.company);

        let wspContractData = {
            "release_date": data.release_date,
            "client": client,
            "materialType": data.compound,
            "sample_no": paddedSampleNumber,
            "service": data.service,
            "surveyor": data.surveyor,
            "quotation_value": data.quotation_value,
            "future_sampling_date": data.future_sampling_date,
            "future_sampling_time": data.future_sampling_time,
            "location_service": data.location_service,
            "documentNumber": documentNumber
        }

        console.log("Printing certificateData: ", wspContractData);

        console.log("About to send data to generate contract in external api");

        // Define the folder where you want to save the PDF
        const saveFolder = path.join(__dirname, '..', '..', 'handlebars', 'wsp-contracts');
        
        // Ensure the folder exists
        if (!fs.existsSync(saveFolder)) {
            fs.mkdirSync(saveFolder);
        }

        return await axios.post(`${process.env.PDF_GENERATOR_URL}/generateWSPContractPdf`, wspContractData, {
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
        });

    } catch (error) {
        console.error(error);
    }
}

async function getCustomerData(company){
    return new Promise((resolve, reject) => {
        const query = `SELECT cust.company, cust.name, cust.tin, cust.address, cust.phone FROM customers cust WHERE cust.company=?;`
        pool.query(query, [company], (err, customer) => {
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

// Helper function to format the current date and time for renaming files
function getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
}

async function checkAndRenamePDF(file_name) {
    const saveFolder = path.join(__dirname, "..", "..", "handlebars", "wsp-contracts");
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

module.exports = { generateWSPContract };