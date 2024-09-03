const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer to save the uploaded file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let pdf_path = path.join(__dirname, '..', '..', 'handlebars', 'gsa-sampling-certificates')
        cb(null, pdf_path); // Save files to the 'uploads' directory
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Save the file with its original name
    }
});

const upload = multer({ storage: storage });

// Endpoint to receive the PDF file
router.post('/upload-gsa-sampling-certificate-pdf', upload.single('pdf'), (req, res) => {
    console.log('Received file:', req.file);

    // Optionally, you can move or process the file here
    res.json({ message: 'GSA Sampling Certificate PDF received successfully' });
});

module.exports = router;
