const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

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

module.exports = router;