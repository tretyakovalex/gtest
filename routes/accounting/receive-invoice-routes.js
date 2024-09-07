const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// // Configure multer to save the uploaded file
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         let pdf_path = path.join(__dirname, '..', '..', 'handlebars', 'gsa-invoices')
//         cb(null, pdf_path); // Save files to the 'uploads' directory
//     },
//     filename: function (req, file, cb) {
//         cb(null, file.originalname); // Save the file with its original name
//     }
// });

// const upload = multer({ storage: storage });

// // Endpoint to receive the PDF file
// router.post('/upload-invoice-pdf', upload.single('pdf'), (req, res) => {
//     console.log('Received file:', req.file);

//     // Optionally, you can move or process the file here
//     res.json({ message: 'PDF received successfully' });
// });

// Helper function to get the current timestamp
function getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
}

// Function to check if a PDF exists and rename it with a timestamp
async function checkAndRenamePDF(pdf_path, file_name) {
    const pdfFilePath = path.join(pdf_path, file_name);

    try {
        const files = await fs.promises.readdir(pdf_path);
        const matchingFiles = files.filter(file => file === file_name);

        // If the file exists, rename it with a timestamp
        if (matchingFiles.length > 0) {
            const timestamp = getTimestamp();
            const existingFilePath = path.join(pdf_path, matchingFiles[0]);
            const renamedFileName = `${file_name.replace('.pdf', '')}_${timestamp}.pdf`;
            const renamedFilePath = path.join(pdf_path, renamedFileName);

            // Rename the old file
            await fs.promises.rename(existingFilePath, renamedFilePath);
            console.log(`Renamed old PDF file to: ${renamedFileName}`);
        }

        // Return the file path where the new PDF will be saved
        return pdfFilePath;
    } catch (error) {
        console.error('Error handling PDF rename:', error);
        throw error;
    }
}

// Endpoint to receive the PDF file without multer
router.post('/upload-invoice-pdf', async (req, res) => {
    const pdf_path = path.join(__dirname, '..', '..', 'handlebars', 'gsa-invoices');
    const file_name = req.headers['x-filename']; // Get the file name from headers (you can set this on the client)

    try {
        // Check and rename the file if necessary
        const pdfFilePath = await checkAndRenamePDF(pdf_path, file_name);

        // Create a write stream to save the new PDF file
        const writeStream = fs.createWriteStream(pdfFilePath);

        // Use the pipeline to stream the request data into the write stream
        await pipelineAsync(req, writeStream);

        console.log(`Saved new PDF file as: ${file_name}`);
        res.json({ message: 'PDF uploaded and processed successfully' });
    } catch (error) {
        console.error('Error handling PDF upload:', error);
        res.status(500).json({ message: 'Error processing the PDF upload' });
    }
});


module.exports = router;
