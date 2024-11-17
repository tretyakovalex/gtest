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

// const { sendMessageForCertificateComponent } = require('../handlebars/websocket');

require('dotenv').config();

// Function to check if the filename contains a timestamp
function isFileWithoutTimestamp(fileName) {
    // Regex pattern to match filenames with a timestamp like _YYYYMMDD_HHMMSS.pdf
    const timestampPattern = /_\d{8}_\d{6}\.pdf$/;
    return !timestampPattern.test(fileName);
}

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
        const rawData = req.body;

        console.log("Printing rawData: ", rawData);

        const { reasonObject, ...unfilteredData } = rawData;

        console.log("Printing unfilteredData: ", unfilteredData);
        let data = unfilteredData.reqObject;
        
        console.log("Printing data: ", data);
        
        if (rawData.reasonObject){

            // const unparsedOriginalFile = await fetch(`http://localhost:4000/getAssayCertificateBySampleNo?sample_no=${data.sample_no}`);
            // console.log("Printing reasonObject: ", reasonObject);
            // const originalFile = await unparsedOriginalFile.json();
            // console.log("Priting originalFile: ", originalFile);

            // reasonObject.editedFile = data;
    
            await writeReasonToLogFile(reasonObject, "assay-certificate-edits-logs");
        } else if(!rawData.reasonObject && unfilteredData){
            await writeReasonToLogFile(unfilteredData, "initial-assay-certificate");
        }

        const certificate = {
            sample_no: data.Sample_No,
            release_date: data.release_date
        }

        const pdfPath = await generateCertificate(data);

        if(pdfPath){
            console.log("Printing pdfPath: ", pdfPath);
        }

        await generateInvoice(data.Sample_No, data.release_date, data.certNumVersion);

        // Query to insert or update if sample_no already exists
        const query = `
            INSERT INTO gsa_certificate (sample_no, release_date) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE release_date = VALUES(release_date)`;

        // Insert into DB or update if exists
        pool.query(query, [certificate.sample_no, certificate.release_date], async (err, result) => {
            if(err){
                console.error(err);
                res.json({error: err});
            } 

            if (pdfPath) {
                console.log("Generated pdfPath before sending to client: ", pdfPath);
                return res.download(pdfPath);
            } else {
                return res.status(500).json({ message: 'Failed to generate PDF.' });
            }
        })

        

        // const query = `INSERT INTO gsa_certificate SET ?`;
        

        // ===== Will be used in future to send emails:  ======
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
        // ====================================================

        
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
        res.status(500).send('Internal Server Error');
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

// router.get('/getAssayCertificateBySampleNo', async (req, res) => {
//     try {
//         const sample_no = req.query.sample_no;
//         console.log(sample_no);
//         const query = 'SELECT * FROM wsp_contract WHERE sample_no=?';
//         pool.query(query, [sample_no], (err, result) => {
//             if(err){
//                 console.error(err);
//                 res.status(500).send("Internal Server Error");
//             }

//             res.json({wsp_contract_info: result});
//         })
//     } catch (error) {
//         console.error(error);
//     }
// })

// === Getting Generated Certificates ===
router.get('/getAllCertificates', async (req, res) => {
    try {
        let files = fs.readdirSync(path.join(__dirname, '..', 'handlebars', 'gsa-certificates'));

        // const file_path = files.filter(file => file.endsWith('.pdf'));
        
        // Filter to select only PDF files without a timestamp
        const file_path = files.filter(file => 
            file.endsWith('.pdf') && isFileWithoutTimestamp(file)
        );

        // Sort based on the numeric part like "000384" in "2024-000384" and handle optional capital letter
        file_path.sort((a, b) => {
            // Extract the part after the third hyphen (e.g., "000384F" from "XXX-XX-2024-000384F")
            let aPart = a.split('-').slice(3).join('-').replace('.pdf', '');
            let bPart = b.split('-').slice(3).join('-').replace('.pdf', '');

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

router.get('/getCertificateByDate', async (req, res) => {
    try {
        const date = req.query.date;
        
        let files = fs.readdirSync(path.join(__dirname, '..', 'handlebars', 'gsa-certificates'));

        // const file_path = files.filter(file => file.endsWith('.pdf'));

        // Filter to select only PDF files without a timestamp
        const file_path = files.filter(file => 
            file.endsWith('.pdf') && isFileWithoutTimestamp(file)
        );

        // Sort based on the numeric part like "000384" in "2024-000384" and handle optional capital letter
        file_path.sort((a, b) => {
            // Extract the part after the third hyphen (e.g., "000384F" from "XXX-XX-2024-000384F")
            let aPart = a.split('-').slice(3).join('-').replace('.pdf', '');
            let bPart = b.split('-').slice(3).join('-').replace('.pdf', '');

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
            return { file_name: file, created: stat.mtime };
        }
    }));

    return pdf_files;
}


async function writeReasonToLogFile(reasonObject, file_name){
    let logFileLocation = path.join(__dirname, "..", "logs", "assay-certificate-logs", file_name);
    const jsonString = JSON.stringify(reasonObject, null, 2);

    fs.appendFile(logFileLocation, jsonString + '\n', (err) => {
        if (err) {
          console.error('Error appending to file', err);
        } else {
          console.log('Successfully appended to file');
        }
    });
    // fs.writeFileSync(logFileLocation, jsonString);
}
// ========================

module.exports = router;