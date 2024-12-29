const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const fs = require('fs-extra');
const path = require('path');

router.get('/downloadInstructions', async (req, res) => {
    try {
        let pdfFile = path.join(__dirname, '..', 'instructions', 'instructions.pdf');
        res.download(pdfFile);
    } catch (error) {
        console.error(error);
    }
})

module.exports = router;