const puppeteer = require('puppeteer');
const fs = require('fs-extra');

const express = require('express');
const router = express.Router();

// Define the endpoint
router.get('/generate-pdf', async (req, res) => {
  try {
    const url = 'http://localhost:4200/certificate'; // Update with your Angular component's URL
    const pdfPath = './pdfs/certificate.pdf'; // Specify the path where the PDF will be saved

    // Launch Puppeteer
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Wait for a specific element to be available
    await page.waitForSelector('div.quantity');

    // Navigate to the URL and wait for the content to load
    await page.goto(url, { waitUntil: 'networkidle0' });


    // Generate the PDF
    await page.pdf({ path: pdfPath, format: 'A4' });

    // Close the browser
    await browser.close();

    // Respond with success
    res.status(200).json({ message: 'PDF generated successfully!' });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

module.exports = router;
