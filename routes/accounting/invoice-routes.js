const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

const moment = require('moment');

const { pool } = require('../../configs/mysql');
// const { getFileCreatedDate } = require('../testHandlebars.js');
// const { sendMessageForInvoiceComponent } = require('../../handlebars/websocket');

// Function to check if the filename contains a timestamp
function isFileWithoutTimestamp(fileName) {
    // Regex pattern to match filenames with a timestamp like _YYYYMMDD_HHMMSS.pdf
    const timestampPattern = /_\d{8}_\d{6}\.pdf$/;
    return !timestampPattern.test(fileName);
}

router.get('/getGsaInvoices', async (req, res) => {
    try {
        let files = fs.readdirSync(path.join(__dirname, '..', '..', 'handlebars', 'gsa-invoices'));
        
        // const file_path = files.filter(file => file.endsWith('.pdf'));
        
        // Filter to select only PDF files without a timestamp
        const file_path = files.filter(file => 
            file.endsWith('.pdf') && isFileWithoutTimestamp(file)
        );

        // Sort based on the numeric part like "000384" in "2024-000384" and handle optional capital letter
        file_path.sort((a, b) => {
            // Extract the part after the third hyphen (e.g., "000384F" from "XXX-XX-2024-000384F")
            let aPart = a.split('-').slice(4).join('-').replace('.pdf', '');
            let bPart = b.split('-').slice(4).join('-').replace('.pdf', '');

            // Extract the numeric part and the optional letter
            let aMatch = aPart.match(/^(\d+)([A-Z]?)$/);
            let bMatch = bPart.match(/^(\d+)([A-Z]?)$/);

            if (aMatch && bMatch) {
                // Compare the numeric parts first
                let aNum = parseInt(aMatch[1], 10); // Numeric part of "000384F"
                let bNum = parseInt(bMatch[1], 10); // Numeric part of "000386F"

                if (aNum !== bNum) {
                    return bNum - aNum; // Sort numerically in descending order
                }

                // If numeric parts are equal, compare the letter in ascending order
                return aMatch[2].localeCompare(bMatch[2]); // Sort letters alphabetically (ascending)
            }

            return 0;
        });

        console.log("file paths: ", file_path)

        let pdf_files = await getFileCreatedDate(file_path);
        console.log(pdf_files);

        res.json(pdf_files);
    } catch (error) {
        console.error(error);
    }
});

router.get('/getInvoiceByName', async (req, res) => {
    try {
        const file_name = req.query.file_name;
        const clientId = req.query.clientId;
        
        // const pdfData = await fs.promises.readFile(path.join(__dirname, "..", "..", "handlebars", 'gsa-invoices', file_name));
        // sendMessageForInvoiceComponent(pdfData, clientId);

        let file_location = path.join(__dirname, '..', '..', 'handlebars', 'gsa-invoices', file_name);
        console.log("printing file location: ", file_location);
        
        res.download(file_location);
        

        // res.status(200).json({ message: 'PDF generated and sent to clients', clientId: clientId });
    } catch (error) {
        console.error(error);
    }
});

router.get('/getInvoiceByDate', async (req, res) => {
    try {
        const date = req.query.date;
        
        let files = fs.readdirSync(path.join(__dirname, '..', '..', 'handlebars', 'gsa-invoices'));
        
        // const file_path = files.filter(file => file.endsWith('.pdf'));

        const file_path = files.filter(file => 
            file.endsWith('.pdf') && isFileWithoutTimestamp(file)
        );
        
        // Sort based on the numeric part like "000384" in "2024-000384" and handle optional capital letter
        file_path.sort((a, b) => {
            // Extract the part after the third hyphen (e.g., "000384F" from "XXX-XX-2024-000384F")
            let aPart = a.split('-').slice(4).join('-').replace('.pdf', '');
            let bPart = b.split('-').slice(4).join('-').replace('.pdf', '');

            // Extract the numeric part and the optional letter
            let aMatch = aPart.match(/^(\d+)([A-Z]?)$/);
            let bMatch = bPart.match(/^(\d+)([A-Z]?)$/);

            if (aMatch && bMatch) {
                // Compare the numeric parts first
                let aNum = parseInt(aMatch[1], 10); // Numeric part of "000384F"
                let bNum = parseInt(bMatch[1], 10); // Numeric part of "000386F"

                if (aNum !== bNum) {
                    return bNum - aNum; // Sort numerically in descending order
                }

                // If numeric parts are equal, compare the letter in ascending order
                return aMatch[2].localeCompare(bMatch[2]); // Sort letters alphabetically (ascending)
            }

            return 0;
        });

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


router.post("/add-invoice-data", async (req, res) => {
    const data = req.body;
    const query = `INSERT INTO invoice_data SET ?`;

    console.log("Printing data inside add-invoice-data route: ", data);
    console.log("Printing query: ", query);

    pool.query(query, data, (err, invoice) => {
        if(err){
            console.error(err);
        }

        res.json("Added data into invoice-data");
    })
})

async function getFileCreatedDate(file_path){
    let pdf_files = await Promise.all(file_path.map(async (file) => {
        const file_path = path.join(__dirname, '..', '..', 'handlebars', 'gsa-invoices', file);
        const stat = await fs.stat(file_path);
        if (stat) {
            return { file_name: file, created: stat.mtime };
        }
    }));

    return pdf_files;
}

module.exports = router;