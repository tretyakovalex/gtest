const express = require('express');
const router = express.Router();

const fs = require('fs-extra');
const path = require('path');

const moment = require('moment');

const { generateSamplingCertificatePdf } = require('../handlebars/compileSamplingCertificateTemplate.js');
// const { sendMessageForSamplingCertificateComponent } = require('../handlebars/websocket');

async function generateSamplingCertificate(data){
    try {
        // console.log("Printing data: ", data);

        // Getting customer info
        // let customer = await getCustomerData(data.Sample_No);
        // console.log(customer);

        // let samplingCertificateData = {
        //     "jobReference": data.jobReference,
        //     "dateOfIssue": data.dateOfIssue,
        //     "samplingDate": data.samplingDate,
        //     "totalPageCount": data.totalPageCount,
        //     "summary": data.summary
        // };

        // console.log("Printing samplingCertificateData: ", samplingCertificateData);

        let pdfPath = await generateSamplingCertificatePdf(data);
        const file_name = pdfPath.match(/[^\/]+$/)[0];
        const pdfData = await fs.promises.readFile(path.join(__dirname, "..", "handlebars", "gsa-sampling-certificates", file_name));

        console.log("data.clientId: ", data.client_id);
        // sendMessageForSamplingCertificateComponent(pdfData, data.client_id);

    } catch (error) {
        console.error(error);
    }
}

// async function getCustomerData(Sample_No){
//     return new Promise((resolve, reject) => {
//         const query = `SELECT cust.company, cust.name, cust.email, cust.address, reg.Sample_No FROM customers cust INNER JOIN registration reg ON reg.customer_id=cust.customer_id WHERE Sample_No=?;`
//         pool.query(query, [Sample_No], (err, customer) => {
//             if(err){
//                 console.error(err);
//                 reject(err);
//                 return;
//             }

//             let filteredCustomer = {};
//             if (customer && customer.length > 0) {
//                 if (customer[0].company) {
//                     const { name, ...rest } = customer[0];
//                     filteredCustomer = rest;
//                 } else {
//                     filteredCustomer = { company: customer[0].company };
//                 }
//             }

//             resolve(filteredCustomer);
//         })
//     });
// }

module.exports = { generateSamplingCertificate };