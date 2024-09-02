const express = require('express');
const router = express.Router();

const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');

const { pool } = require('../configs/mysql');

const { generateInvoice } = require('./testHandlebars');
const { generateCertificate } = require('./generateCertificate.js');
const { generateSamplingCertificatePdf } = require('../handlebars/compileSamplingCertificateTemplate.js');
// const transporter = require('../utils/email-transponder');

const { sendMessageForCertificateComponent } = require('../handlebars/websocket');

require('dotenv').config();

router.get('/getGSACertificate', async (req, res) => {
    try {
        const query = `SELECT * FROM gsa_certificate`;
        pool.query(query, (err, gsaCertificate) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ gsaCertificates: gsaCertificate });
        });
    } catch (error) {
        console.error(error);
    }
});

router.post('/addGSACertificate', async (req, res) => {
    try {
        const data = req.body;

        console.log(data);

        const certificate = {
            sample_no: data.Sample_No,
            release_date: data.release_date
        }

        const query = `INSERT INTO gsa_certificate SET ?`;

        const pdfPath = await generateCertificate(data);

        await generateInvoice(data.Sample_No, data.release_date);

        // let file_name = pdfPath.replace("/Users/karlembeast/builds/projects/gsa-web/backend/handlebars/gsa-certificates/", "");
        // console.log("printing file name: ", file_name);

        // const downloadUrl = `http://localhost/download?file=${encodeURIComponent(file_location)}`;
        
        // res.download(file_location);


        // let file_name = ""

        // pool.query('select gsa_sample_id from registration where Sample_No=?', [data.Sample_No], async (err, result) => {
        //     if(err){
        //         console.error(err);
        //     }

        //     console.log(result[0].gsa_sample_id);
        //     file_name = result[0].gsa_sample_id.slice(0, 3) + "-Invoice" + result[0].gsa_sample_id.slice(3);
        //     console.log(file_name);

        //     const mailOptions = {
        //         from: 'gsa-system@tawotin.com',
        //         to: 'karlembeast@gmail.com',
        //         subject: `${file_name}`,
        //         text: `Attached to this email is a GSA Invoice file.`,
        //         attachments: [
        //             {
        //                 filename: `${file_name}.pdf`, // Name of the attachment
        //                 path: path.join(__dirname, `../handlebars/gsa-invoices/${file_name}.pdf`) // Path to the PDF file
        //             }
        //         ]
        //     };

        //     transporter.sendMail(mailOptions, function(error, info){
        //         if (error) {
        //             console.log(error);
        //         } else {
        //             console.log('Email sent: ' + info.response);
        //         }
        //     });  

        //     console.log("Printing mailOptions: ", mailOptions)
        // });

        // pool.query(query, certificate, async (err, gsaCertificate) => {
        //     if (err) {
        //         if (err.code === 'ER_DUP_ENTRY') {
        //             return res.status(409).json({ message: 'Duplicate entry: a certificate with this sample number already exists.', file_name: file_name});
        //         }
        //         console.error(err);
        //         return res.status(500).send('Internal Server Error');
        //     }
            
            
        //     res.json({ gsaCertificates: gsaCertificate, file_name: file_name});
        // });

        
        
    } catch (error) {
        console.error(error);
    }
});

router.get('/generateCertificate', async (req, res) => {
    try {
        const data = req.body;
        // console.log("Printing data: ", data);

        generateCertificate(data);
    } catch (error) {
        console.error(error);
    }
})

// === Getting Generated Certificates ===
router.get('/getAllCertificates', async (req, res) => {
    try {
        let files = fs.readdirSync(path.join(__dirname, '..', 'handlebars', 'gsa-certificates'));
        const file_path = files.filter(file => file.endsWith('.pdf'));
        console.log("file paths: ", file_path)

        let pdf_files = await getFileCreatedDate(file_path);
        console.log(pdf_files);

        res.json(pdf_files);
    } catch (error) {
        console.error(error);
    }
});

router.get('/getCertificateByDate', async (req, res) => {
    try {
        const date = req.query.date;
        
        let files = fs.readdirSync(path.join(__dirname, '..', 'handlebars', 'gsa-certificates'));
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

router.get('/getCertificateByFileName', async (req, res) => {
    try {
        const file_name = req.query.file_name;
        
        // const pdfData = await fs.promises.readFile(path.join(__dirname, "..", "handlebars", 'gsa-certificates', file_name));
        
        let file_location = path.join(__dirname, '..', 'handlebars', 'gsa-certificates', file_name);
        console.log("printing file location: ", file_location);

        res.download(file_location);

        // sendMessageForCertificateComponent(pdfData);

        // res.status(200).json({ message: 'PDF generated and sent to clients', pdfData: buffer.toString('base64') });

    } catch (error) {
        console.error(error);
    }
});
// ======================================

// === Helper functions ===
async function getFileCreatedDate(file_path){
    let pdf_files = await Promise.all(file_path.map(async (file) => {
        const file_path = path.join(__dirname, '..', 'handlebars', 'gsa-certificates', file);
        const stat = await fs.stat(file_path);
        if (stat) {
            return { file_name: file, created: stat.birthtime };
        }
    }));

    return pdf_files;
}
// ========================

module.exports = router;