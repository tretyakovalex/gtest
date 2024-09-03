const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const { generateSamplingCertificate } = require('../generateSamplingCertificate.js');
const { sendMessageForSamplingCertificateComponent } = require('../../handlebars/websocket.js');

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

// === TESTING GSA SAMPLING CERTIFICATE ===
// router.get('/generateSamplingCertficate', async (req, res) => {
//     try {
//         generateSamplingCertificate();
//     } catch (error) {
//         console.error(error);
//     }
// })
// ========================================

router.get('/getGeneratedSamplingCertificate', async (req, res) => {
    try {
        const file_name = "gsaSamplingCertificateTemplate.pdf"
        let file_location = path.join(__dirname, '..', '..', 'handlebars', 'gsa-sampling-certificates', file_name);
        console.log("printing file location: ", file_location);
        
        res.download(file_location);
    } catch (error) {
        console.error("Error: ", error);
    }
})

// === TESTING GSA SAMPLING CERTIFICATE with Data ===
router.post('/generateSamplingCertficate', async (req, res) => {
    try {
        const data = req.body;

        console.log(data);

        // generateSamplingCertificate(data);

        // let pdfPath = await generateSamplingCertificatePdf(data);

        file_name = '';

        axios.post(`${process.env.PDF_GENERATOR_URL}/generateSamplingCertficate`, clientInvoiceData, { httpsAgent })
            .then(response => {
                console.log('Data sent successfully:', response.data);
                file_name = response.file_name;
            })
            .catch(error => {
                console.error('Error sending data:', error);
            });

        
        const file_name = file_name.match(/[^\/]+$/)[0];
        let file_location = path.join(__dirname, '..', '..', 'handlebars', 'gsa-sampling-certificates', file_name);
        console.log("printing file location: ", file_location);
        
        res.download(file_location);
        
    } catch (error) {
        console.error(error);
    }
})
// ========================================

router.get('/download-sampling-certificate', (req, res) => {
    try {
        let file_location = path.join(__dirname, '..', '..', 'handlebars', 'gsa-sampling-certificates', 'gsaSamplingCertificateTemplate.pdf');
        console.log("printing file location: ", file_location);
        res.download(file_location);
    } catch (error) {
        console.error(error);
    }
})

let currentProgressClients = {}; // To store SSE clients by clientId

// SSE endpoint for progress updates
router.get('/sampling-certificate-progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial progress
    res.write(`data: ${JSON.stringify({ progress: 0 })}\n\n`);

    const filePath = path.join(__dirname, '..', '..', 'handlebars', 'gsa-sampling-certificates', 'gsaSamplingCertificateTemplate.pdf');
    const fileSize = fs.statSync(filePath).size;
    const chunkSize = 1024 * 64;
    let bytesSent = 0;

    const readStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });

    readStream.on('data', (chunk) => {
        bytesSent += chunk.length;
        const progress = Math.min(100, (bytesSent / fileSize) * 100);

        // Send progress update
        res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    });

    readStream.on('end', () => {
        // Send final progress and close the SSE connection
        res.write(`data: ${JSON.stringify({ progress: 100 })}\n\n`);
        res.end();
    });

    readStream.on('error', (err) => {
        console.error('Error reading file:', err);
        res.end();
    });

    req.on('close', () => {
        console.log('SSE connection closed');
        readStream.destroy();
    });
});

module.exports = router;

// const events = require('../../handlebars/events.js'); // Custom event emitter

// // SSE endpoint for progress updates
// router.get('/sampling-certificate-progress', (req, res) => {
//     res.setHeader('Content-Type', 'text/event-stream');
//     res.setHeader('Cache-Control', 'no-cache');
//     res.setHeader('Connection', 'keep-alive');

//     // Store the SSE client connection for later use
//     currentProgressClients[clientId] = res;

//     req.on('close', () => {
//         console.log(`SSE client disconnected: ${clientId}`);
//         delete currentProgressClients[clientId];
//     });
// });

// // Listen for progress updates from the WebSocket module
// events.on('progress', ({ clientId, progress }) => {
//     if (currentProgressClients[clientId]) {
//         currentProgressClients[clientId].write(`data: ${JSON.stringify({ progress })}\n\n`);
//     }
// });

// // Listen for completion events
// events.on('complete', ({ clientId }) => {
//     if (currentProgressClients[clientId]) {
//         currentProgressClients[clientId].write(`data: ${JSON.stringify({ progress: 100, message: 'Complete' })}\n\n`);
//         currentProgressClients[clientId].end();
//         delete currentProgressClients[clientId];
//     }
// });


