const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const fs = require('fs-extra');
const path = require('path');

const { pool } = require('../configs/mysql');

const { generateSamplingContract } = require('./gsa-sampling/generateSamplingContract.js');

router.get('/fetchServiceContactDataFromRegistration', async (req, res) => {
    try {
        const sample_no = req.query.sample_no;
        const query = `SELECT customer_id, Date, Sample_No, Sampling_date, Sample_weight, Customer_sample_name, gsa_sample_id, Approved_Quotation_Value, Approx_days, country_of_origin FROM registration where Sample_No=${sample_no}`;
        pool.query(query, async (err, registration) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            // console.log("registration: ", registration);
            res.json(registration[0]);
        })
    } catch (error) {
        console.error(error);
    }
})


router.post('/regenerateSamplingContractBySampleNo', async (req, res) => {
    try {
        const sample_no = req.body.sample_no;
        const user = req.body.user;
        const dateAndTime = req.body.dateAndTime;
        // console.log('req body sample_no: ', req.body);
        // console.log('sample_no: ', sample_no);
        let unparsedData = await fetch(`http://localhost:4000/fetchServiceContactDataFromRegistration?sample_no=${sample_no}`);
        const registration = await unparsedData.json();

        // console.log(registration);

        // === Writing data to log file ===
        let reasonObject = {
            registration: registration,
            user: user,
            date: dateAndTime
        };

        // console.log("Printing reasonObject: ", reasonObject);
        
        writeReasonToLogFile(reasonObject, "service-contract-regeneration-logs");
        // ================================

        let samplingContract = await generateSamplingContract(registration);
        // console.log("Printing file name for samplingContract: ", samplingContract);
        res.download(samplingContract);
    } catch (error) {
        console.error(error);
    }
});

router.get('/renameServiceContractsToIncludeYear', async (req, res) => {
    let directory = path.join(__dirname, "..", "handlebars", "gsa-sampling-contracts");
    let year = 2024;

    const files = fs.readdirSync(directory); // Read all files in the directory
    
    console.log("Printing files: ", files);

    files.forEach((file) => {
        const match = file.match(/^GSA-FR-CFRM-(\d{5})(?:_(\d{8}_\d{6}))?.pdf$/); // Match files with the pattern `GSA-FR-CFRM-*.pdf`
        console.log(match);
        if (match) {
            const baseName = match[1]; // Extract the 5-digit code
            const timeStamp = match[2] ? `_${match[2]}` : ''; // Extract timestamp if present
            console.log("timestamp: ", match[2]);
            const newFileName = `GSA-FR-CFRM-${year}-${baseName}${timeStamp}.pdf`;

            const oldPath = path.join(directory, file);
            const newPath = path.join(directory, newFileName);

            // Rename the file
            fs.renameSync(oldPath, newPath);

            // Remove the old file (optional, as renaming replaces the old one)
            console.log(`Renamed: ${file} -> ${newFileName}`);
        } else {
            console.log(`Skipped: ${file} (does not match pattern)`);
        }
    });

})

async function writeReasonToLogFile(reasonObject, file_name){
    let logFileLocation = path.join(__dirname, "..", "logs", "service-contract-logs", file_name);
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

module.exports = router;