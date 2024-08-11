const express = require('express');
const router = express.Router();

const { generateSamplingCertificate } = require('../generateSamplingCertificate.js');
const { sendMessageForSamplingCertificateComponent } = require('../../handlebars/websocket.js');


// === TESTING GSA SAMPLING CERTIFICATE ===
// router.get('/generateSamplingCertficate', async (req, res) => {
//     try {
//         generateSamplingCertificate();
//     } catch (error) {
//         console.error(error);
//     }
// })
// ========================================

// === TESTING GSA SAMPLING CERTIFICATE with Data ===
router.post('/generateSamplingCertficate', async (req, res) => {
    try {
        const data = req.body;

        console.log(data);
        generateSamplingCertificate(data);
    } catch (error) {
        console.error(error);
    }
})
// ========================================

module.exports = router;