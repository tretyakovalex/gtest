const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

const moment = require('moment');

const { pool } = require('../../configs/mysql');
// const { getFileCreatedDate } = require('../testHandlebars.js');
const { sendMessageForInvoiceComponent } = require('../../handlebars/websocket');


router.get('/getGsaInvoices', async (req, res) => {
    try {
        let files = fs.readdirSync(path.join(__dirname, '..', '..', 'handlebars', 'gsa-invoices'));
        const file_path = files.filter(file => file.endsWith('.pdf'));
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
        const file_path = files.filter(file => file.endsWith('.pdf'));
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

async function getFileCreatedDate(file_path){
    let pdf_files = await Promise.all(file_path.map(async (file) => {
        const file_path = path.join(__dirname, '..', '..', 'handlebars', 'gsa-invoices', file);
        const stat = await fs.stat(file_path);
        if (stat) {
            return { file_name: file, created: stat.birthtime };
        }
    }));

    return pdf_files;
}

module.exports = router;