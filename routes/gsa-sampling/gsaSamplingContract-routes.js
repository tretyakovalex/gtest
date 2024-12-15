const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const router = express.Router();

const fetch = require('node-fetch');

const moment = require('moment');

const { generateSamplingCertificate } = require('../generateSamplingCertificate.js');
// const { sendMessageForSamplingCertificateComponent } = require('../../handlebars/websocket.js');

const { generateSamplingCertificatePdf } = require('../../handlebars/compileSamplingCertificateTemplate.js');

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

const { generateSamplingContract } = require('./generateSamplingContract.js');

router.post('/generateSamplingContract', async (req, res) => {
    try {
        const data = req.body;

        console.log("Sending data to generate PDF:", data);

        let samplingContract = await generateSamplingContract(data);
        console.log("Printing file name for samplingContract: ", samplingContract);

        res.download(samplingContract);
        
    } catch (error) {
        console.error(error);
    }
})

router.get('/getAllSamplingContracts', async (req, res) => {
    try {
        let files = fs.readdirSync(path.join(__dirname, '..', '..', 'handlebars', 'gsa-sampling-contracts'));
        
        // Filter to select only PDF files without a timestamp
        const file_path = files.filter(file => 
            file.endsWith('.pdf') && isFileWithoutTimestamp(file)
        );
        console.log("file paths: ", file_path)

        let pdf_files = await getFileCreatedDate(file_path);
        console.log(pdf_files);

        res.json(pdf_files);
    } catch (error) {
        console.error(error);
    }
});

router.get('/getSamplingContractByName', async (req, res) => {
    try {
        const file_name = req.query.file_name;
        
        // const pdfData = await fs.promises.readFile(path.join(__dirname, "..", "..", "handlebars", 'gsa-invoices', file_name));
        // sendMessageForInvoiceComponent(pdfData, clientId);

        let file_location = path.join(__dirname, '..', '..', 'handlebars', 'gsa-sampling-contracts', file_name);
        console.log("printing file location: ", file_location);
        
        res.download(file_location);
        
    } catch (error) {
        console.error(error);
    }
});

router.get('/getSamplingContractByDate', async (req, res) => {
    try {
        const date = req.query.date;
        
        let files = fs.readdirSync(path.join(__dirname, '..', '..', 'handlebars', 'gsa-sampling-contracts'));
        
        // const file_path = files.filter(file => file.endsWith('.pdf'));

        const file_path = files.filter(file => 
            file.endsWith('.pdf') && isFileWithoutTimestamp(file)
        );
        console.log("file paths: ", file_path);

        let pdf_files = await getFileCreatedDate(file_path);

        // console.log(pdf_files);
        // console.log(date);

        let filtered_pdfs = [];
        pdf_files.forEach((item) => {
            if(moment(item.created).format('YYYY-MM-DD') === date){
                filtered_pdfs.push({file_name: item.file_name, created: item.created});
            }
        });

        // console.log("filtered pdf files: ", filtered_pdfs);

        res.json(filtered_pdfs);
    } catch (error) {
        console.error(error);
    }
});

async function getFileCreatedDate(file_path){
    let pdf_files = await Promise.all(file_path.map(async (file) => {
        const file_path = path.join(__dirname, '..', '..', 'handlebars', 'gsa-sampling-contracts', file);
        const stat = await fs.stat(file_path);

        let file_year = file.match(/^(?:[^-]*-){3}(\d{4})/); // Getting year from file_name
        if (stat) {
            return { file_name: file, created: stat.mtime, year: file_year[1] };
        }
    }));

    return pdf_files;
}

// Function to check if the filename contains a timestamp
function isFileWithoutTimestamp(fileName) {
    // Regex pattern to match filenames with a timestamp like _YYYYMMDD_HHMMSS.pdf
    const timestampPattern = /_\d{8}_\d{6}\.pdf$/;
    return !timestampPattern.test(fileName);
}

module.exports = router;