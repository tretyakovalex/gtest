const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const hbs = require('handlebars');
const path = require('path');
// const WebSocket = require('ws');

const express = require('express');
const app = express();

var helpers = require('handlebars-helpers')(['math', 'number', 'string', 'comparison']);

// const data = require('./samplingCertificateData.json');

hbs.registerPartial('./public/views/samplingCertificateTemplate/title_partial', '{{prefix}}');
hbs.registerPartial('./public/views/samplingCertificateTemplate/footer_partial', '{{prefix}}');

hbs.registerHelper('eq', function(a, b, options) {
    if (a === b) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
});

hbs.registerHelper('gteAndlte', function(a, b, c, options) {
    if (a >= b && a <= c) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
});

// Set up static file serving for images
app.use(express.static(path.join(__dirname, 'public')));
console.log(path.join(__dirname, 'public'));

// Set cache directory for Puppeteer
process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache', 'puppeteer');
console.log(path.join(__dirname, '.cache', 'puppeteer'));

const compilePartial = async function(templateName, data) {
    const filePath = path.join(__dirname, 'public', 'views', 'samplingCertificateTemplate', 'partials', `${templateName}.handlebars`);
    const html = await fs.readFile(filePath, 'utf-8');
    return hbs.compile(html)(data);
};

// Compile Handlebars template
const compile = async function(templateName, data) {
    const filePath = path.join(__dirname, 'public', 'views', 'samplingCertificateTemplate', `${templateName}.handlebars`);
    const html = await fs.readFile(filePath, 'utf-8');
    return hbs.compile(html)(data);
};

// Function to retrieve purchase information and generate the PDF
async function generateSamplingCertificatePdf(data) {
    try {

        // let pdf_directory = path.join(__dirname, 'gsa-sampling-certificates');
        // const file_name = await getFilePath(pdf_directory, data.certificate_file_name);
        // const file_name = await getFilePath(pdf_directory, 'gsa-sampling-certificate');

        // console.log("Priting pdf file name: ", file_name);

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // const partialContent = hbs.compile(await fs.readFile(__dirname, 'public', 'views', 'samplingCertificateTemplate', 'partials', 'scale_and_bags_pages.handlebars').toString('utf-8'))(data);
        const scalePartialContent = await compilePartial('scale_and_bags_pages', data);
        hbs.registerPartial('scale_and_bags_pages', scalePartialContent);

        const packingPartialContent = await compilePartial('packing_and_weighing', data);
        hbs.registerPartial('packing_and_weighing', packingPartialContent);

        const content = await compile('gsaSamplingCertificateTemplate', data);  // Pass the transformed purchase data
        
        // Compile to HTML file
        const htmlFilePath = path.join(__dirname, 'compiled-gsaSamplingCertificateTemplate.html');
        await fs.writeFile(htmlFilePath, content);

        await page.goto(`file:${htmlFilePath}`, { waitUntil: 'networkidle0' });

        // let formattedDate = await getCurrentFormattedDate();

        const pdfPath = path.join(__dirname, 'gsa-sampling-certificates', 'gsaSamplingCertificateTemplate.pdf');
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
        console.log(generateSamplingCertificatePdf());
    } catch (error) {
        console.error('Error: ', error);
    }
})

module.exports.generateSamplingCertificatePdf = generateSamplingCertificatePdf;