const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const hbs = require('handlebars');
const path = require('path');
// const WebSocket = require('ws');

const express = require('express');
const app = express();

// hbs.registerHelper('and', function(a, b, options) {
//     if (a && b) {
//       return options.fn(this);
//     }
//     return '';
// });

// hbs.registerHelper('andNot', function(a, b, options) {
//     if (a && !b) {
//       return options.fn(this);
//     }
//     return '';
//   });

// hbs.registerHelper('modifyResults', function(array, RA_present, RA_In_Kg) {
//     var result = [];
//     array.forEach(function(item) {
//         if(RA_present === true){
//             if(RA_In_Kg === true){
//                 result.push({name: item.name, value: `${item.name} bq/kg`});
//             } else if (RA_In_Kg === false) {    
//                 result.push({name: item.name, value: `${item.name} bq/g`});
//             }
//         } else if (RA_present === false){
//             result.push({name: item.name, value: item.value});
//         }
//     });
//     return result;
// });

// const data = require('./certificateData.json');

// WebSocket server setup
// const wss = new WebSocket.Server({ port: 8080 });

// Set up static file serving for images
app.use(express.static(path.join(__dirname, 'public')));
console.log(path.join(__dirname, 'public'));

// Set cache directory for Puppeteer
process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache', 'puppeteer');
console.log(path.join(__dirname, '.cache', 'puppeteer'));

// Compile Handlebars template
const compile = async function(templateName, data) {
    const filePath = path.join(__dirname, 'public', 'views', `${templateName}.handlebars`);
    const html = await fs.readFile(filePath, 'utf-8');
    return hbs.compile(html)(data);
};

// function transformPurchaseData(purchase) {
//     const transformed = {
//         purchase_number: purchase.purchase_id,
//         // material_type: purchase.material,
//         material_type: "TA",
//         material_name: "material_name",
//         purchase_mass: purchase.mass,
//         company_name: purchase.company_name,
//         tin: purchase.tin,
//         price_usd_per_kg: purchase.price_per_kg,
//         total_amount_usd: purchase.total_amount,
//         date: new Date(purchase.purchase_date).toLocaleDateString('en-GB'),
//         exchange_rate_rwf_usd: purchase.exchange_rate_frw_to_usd,
//         rma_payment_rwf_per_kg: purchase.rma_fees_frw_per_kg,
//         rma_payment_total_rwf: purchase.rma_frw,
//         rma_payment_three_percent_usd: (purchase.total_amount * 0.03).toFixed(2),
//         rma_payment_three_percent_rwf: (purchase.rma_frw * 0.03).toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, " "),
//         client_net_payment: purchase.total_minus_rma_usd,
//         number_of_bags: purchase.number_of_bags
//     };

//     purchaseArray.push(transformed);
//     return transformed;
// }

// async function calcGrandTotal(clientInvoiceData){
//     let grandTotal = 0;
//     // clientInvoiceData.forEach((item) => {
//     //     console.log("priting item.sampled_request: ", item.sampled_request)
//         clientInvoiceData.sampled_request.forEach((request) => {
//             // console.log("priting request.total_price: ", request.total_price)
//             grandTotal += request.total_price;
//         })
//     // })
//     return grandTotal;
// }

// Function to retrieve purchase information and generate the PDF
// async function generatePdf(purchase) {
async function generateCertificatePdf(data) {
    try {
        
        // let grandTotal = await calcGrandTotal(clientInvoiceData);
        // // console.log("printing grand total: ", grandTotal);

        // let modifiedClientInvoiceData = clientInvoiceData;
        // modifiedClientInvoiceData.grandTotal = grandTotal;

        let pdf_directory = path.join(__dirname, 'gsa-certificates');
        const file_name = await getFilePath(pdf_directory, data.certificate_file_name);

        console.log("Priting pdf file name: ", file_name);

        // modifiedClientInvoiceData.file_name = file_name.replace('.pdf', '');

        // console.log("Printing modifiedClientInvoiceData: ", modifiedClientInvoiceData);

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        const content = await compile('gsaCertificateTemplate', data);  // Pass the transformed purchase data
        
        // Compile to HTML file
        const htmlFilePath = path.join(__dirname, 'compiled-gsaCertificateTemplate.html');
        await fs.writeFile(htmlFilePath, content);

        await page.goto(`file:${htmlFilePath}`, { waitUntil: 'networkidle0' });

        // let formattedDate = await getCurrentFormattedDate();

        const pdfPath = path.join(__dirname, 'gsa-certificates', file_name);
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true
        });

        console.log('PDF generated successfully.');
        await browser.close();

        return pdfPath;  // Return the path of the generated PDF
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}

async function getFilePath(basePath, file_name) {

    const files = await fs.readdir(basePath);
    const matchingFiles = files.filter(file => file.startsWith(file_name) && file.endsWith('.pdf'));

    if(matchingFiles.length === 0){
        return `${file_name}.pdf`;
    } else if (matchingFiles.length > 0){
        let latestVersion = 0;
        let latestFile = `${file_name}.pdf`;

        matchingFiles.forEach(file => {
            const versionMatch = file.match(/_v(\d+)\.pdf$/);
            if (versionMatch) {
                const version = parseInt(versionMatch[1], 10);
                latestVersion = version + 1;

                latestFile = `${file.replace(/_v\d+\.pdf$/, `_v${latestVersion}.pdf`)}`;
            } else if (!file.includes('_v') && latestVersion === 0) {
                // If there is no version and it's the first match
                latestFile = `${file_name}_v1.pdf`;
            }
        });

        return latestFile;
    }
}

// async function getCurrentFormattedDate(){
//     const date = new Date();

//     // Extract date components
//     const year = date.getFullYear();
//     const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so add 1
//     const day = String(date.getDate()).padStart(2, '0');
    
//     // Extract time components
//     const hours = String(date.getHours()).padStart(2, '0');
//     const minutes = String(date.getMinutes()).padStart(2, '0');

//     const formattedDate = `${year}${month}${day}_${hours}${minutes}`;
//     return formattedDate;
// }

(async () => {
    try {
        console.log(generateCertificatePdf());
    } catch (error) {
        console.error('Error: ', error);
    }
})

module.exports.generateCertificatePdf = generateCertificatePdf;