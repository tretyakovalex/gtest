const express = require('express');
const router = express.Router();

const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');

const { pool } = require('../configs/mysql');

const { generateInvoice } = require('./testHandlebars');
const transporter = require('../utils/email-transponder');

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

        const certificate = {
            sample_no: data.sample_no,
            release_date: data.release_date
        }

        const query = `INSERT INTO gsa_certificate SET ?`;

        await generateInvoice(data.sample_no, data.release_date);


        let file_name = ""

        // pool.query('select gsa_sample_id from registration where Sample_No=?', [data.sample_no], async (err, result) => {
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

        pool.query(query, certificate, async (err, gsaCertificate) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ message: 'Duplicate entry: a certificate with this sample number already exists.' });
                }
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            
            
            res.json({ gsaCertificates: gsaCertificate })
        });
        
    } catch (error) {
        console.error(error);
    }
})

module.exports = router;