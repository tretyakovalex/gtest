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

const { pool } = require('../../configs/mysql');

// Load the certificates from files
const serverCert = fs.readFileSync(path.join(__dirname, '..', '..', 'cert', 'cert.pem'));
const intermediateCert = fs.readFileSync(path.join(__dirname, '..', '..', 'cert', 'chain.pem'));

// Create the CA bundle array
const MY_CA_BUNDLE = [serverCert, intermediateCert];

const httpsAgent = new https.Agent({
    ca: MY_CA_BUNDLE
});  

const { generateWSPContract } = require('./generateWSPContract.js');

router.post('/generateWSPContract', async (req, res) => {
    try {
        const data = req.body;

        console.log("Sending data to generate PDF:", data);

        let wspContract = await generateWSPContract(data);
        if(wspContract){
            console.log("Printing file name for wspContract: ", wspContract);
        }

        const WSPContract = {
            sample_no: data.sample_no,
            company_name: data.company,
            release_date: data.release_date,
            future_sampling_time: data.future_sampling_time,
            future_sampling_date: data.future_sampling_date, 
            compound: data.compound,
            service: data.service,
            surveyor: data.surveyor,
            quotation_value: data.quotation_value,
            location_service: data.location_service
        }
        
        const query = `INSERT INTO wsp_contract SET ?`;

        pool.query(query, WSPContract, (err, result) => {
            if(err){
                console.error(err);
                res.json({error: err});
            }

            if (wspContract) {
                console.log("Generated pdfPath before sending to client: ", wspContract);
                return res.download(wspContract);
            } else {
                return res.status(500).json({ message: 'Failed to generate PDF.' });
            }
        });
        
    } catch (error) {
        console.error(error);
    }
})

router.get('/getAllWSPContracts', async (req, res) => {
    try {
        let files = fs.readdirSync(path.join(__dirname, '..', '..', 'handlebars', 'wsp-contracts'));
        
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

router.get('/getWSPContractByName', async (req, res) => {
    try {
        const file_name = req.query.file_name;
        
        // const pdfData = await fs.promises.readFile(path.join(__dirname, "..", "..", "handlebars", 'gsa-invoices', file_name));
        // sendMessageForInvoiceComponent(pdfData, clientId);

        let file_location = path.join(__dirname, '..', '..', 'handlebars', 'wsp-contracts', file_name);
        console.log("printing file location: ", file_location);
        
        res.download(file_location);
        
    } catch (error) {
        console.error(error);
    }
});

router.get('/getWSPContractByDate', async (req, res) => {
    try {
        const date = req.query.date;
        
        let files = fs.readdirSync(path.join(__dirname, '..', '..', 'handlebars', 'wsp-contracts'));
        
        // const file_path = files.filter(file => file.endsWith('.pdf'));

        const file_path = files.filter(file => 
            file.endsWith('.pdf') && isFileWithoutTimestamp(file)
        );
        console.log("file paths: ", file_path);

        let pdf_files = await getFileCreatedDate(file_path);

        // console.log(pdf_files);
        console.log(date);

        let filtered_pdfs = [];
        pdf_files.forEach((item) => {
            if(moment(item.created).format('YYYY-MM-DD') === date){
                filtered_pdfs.push({file_name: item.file_name, created: item.created});
            }
        });

        console.log("filtered pdf files: ", filtered_pdfs);

        res.json(filtered_pdfs);
    } catch (error) {
        console.error(error);
    }
});

router.get('/getWSPContractInfoBySampleNo', async (req, res) => {
    try {
        const sample_no = req.query.sample_no;
        console.log(sample_no);
        const query = 'SELECT * FROM wsp_contract WHERE sample_no=?';
        pool.query(query, [sample_no], (err, result) => {
            if(err){
                console.error(err);
                res.status(500).send("Internal Server Error");
            }

            res.json({wsp_contract_info: result});
        })
    } catch (error) {
        console.error(error);
    }
})

router.put('/updateWSPContract', async (req, res) => {
    try {
        const data = req.body.reqObject;
        console.log("Printing req object: ", data);

        const reasonObject = req.body.reasonObject;
        console.log("Printing reason object: ", reasonObject);

        const unparsedOriginalFile = await fetch(`http://localhost:4000/getWSPContractInfoBySampleNo?sample_no=${data.sample_no}`);
        const originalFile = await unparsedOriginalFile.json();
        console.log("Priting originalFile: ", originalFile.wsp_contract_info[0]);

        // Object.assign(reasonObject, originalFile.wsp_contract_info[0]);
        reasonObject.originalFile = originalFile.wsp_contract_info[0];
        
        await writeReasonToLogFile(reasonObject);

        let wspContract = await generateWSPContract(data);
        if(wspContract){
            console.log("Printing file name for wspContract: ", wspContract);
        }

        const query = `UPDATE wsp_contract SET ? WHERE sample_no=?`;

        const WSPContract = {
            sample_no: data.sample_no,
            company_name: data.company,
            release_date: data.release_date,
            future_sampling_time: data.future_sampling_time,
            future_sampling_date: data.future_sampling_date, 
            compound: data.compound,
            service: data.service,
            surveyor: data.surveyor,
            quotation_value: data.quotation_value,
            location_service: data.location_service
        }

        pool.query(query, [WSPContract, WSPContract.sample_no], (err, result) => {
            if(err){
                console.error(err);
                res.json({error: err});
            }

            if (wspContract) {
                console.log("Generated pdfPath before sending to client: ", wspContract);
                return res.download(wspContract);
            } else {
                return res.status(500).json({ message: 'Failed to generate PDF.' });
            }
        })
    } catch (error) {
        console.error(error);
    }
});

async function writeReasonToLogFile(reasonObject){
    let logFileLocation = path.join(__dirname, "..", "..", "logs", "wsp-contract-logs", "wsp-contract-edits-logs");
    const jsonString = JSON.stringify(reasonObject, null, 2);

    fs.appendFile(logFileLocation, jsonString + '\n', (err) => {
        if (err) {
          console.error('Error appending to file', err);
        } else {
          console.log('Successfully appended to file');
        }
    });
    // fs.writeFileSync(logFileLocation, jsonString);
}

async function getFileCreatedDate(file_path){
    let pdf_files = await Promise.all(file_path.map(async (file) => {
        const file_path = path.join(__dirname, '..', '..', 'handlebars', 'wsp-contracts', file);
        console.log("Printing file path inside getFileCreatedDate: ", file_path);
        const stat = await fs.stat(file_path);
        if (stat) {
            return { file_name: file, created: stat.mtime };
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