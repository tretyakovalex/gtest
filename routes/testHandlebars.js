const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

const fetch = require('node-fetch');

const { generatePdf } = require('../handlebars/compiledHandlebars');

const { pool } = require('../configs/mysql');

const axios = require('axios');
require('dotenv').config();

const https = require('https');

// Load the certificates from files
const serverCert = fs.readFileSync(path.join(__dirname, '..', 'cert', 'cert.pem'));
const intermediateCert = fs.readFileSync(path.join(__dirname, '..', 'cert', 'chain.pem'));

// Create the CA bundle array
const MY_CA_BUNDLE = [serverCert, intermediateCert];

const httpsAgent = new https.Agent({
    ca: MY_CA_BUNDLE
});    

async function generateInvoice(Sample_No, date, certNumVersion, year){
    try {
        const data = {Sample_No, date, year}; 
        
        pool.query(`SELECT * FROM results WHERE Sample_No=? AND year=?`, [data.Sample_No, data.year], async (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            // extracting key values pairs whos values are not null and keys that are not Sample_No or data_of_lab
            const newObj = {};
            let resultsArray = [];

            
            // === Getting list of all elements and reo elements ===
            let elements = (await getElements()).map(item => item.element_name);
            let reo_values = [57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 89, 91, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103]
            let reo_elements = (await getElements()).filter((val) => reo_values.includes(val.element_id)).map(item => item.element_name);
            // console.log("Printing all elements: ", await getElements());
            // console.log("Printing all elements: ", elements);
            // console.log("Printing reo elements: ", reo_elements);
            // =====================================================

            
            let registration = await retrieveNonElementFromRegistration(data.Sample_No, data.year);
            let filteredRegistration = "";

            // console.log("registration: ", registration[0]);

            for (const [key, value] of Object.entries(registration[0])) {
                // Was initially this: value.equals(new Buffer([0x01])))) before depreciation. Now its: value.equals(new Buffer.from([0x01]))))
                if ((key === 'Sum_rare_earth_elements' || key === 'Full_scan' || key === 'Semi_quantitative') && (value !== null && Buffer.isBuffer(value) && value.equals(new Buffer.from([0x01])))) {
                    console.log(key);
                    filteredRegistration = key;
                }
            }

            // console.log("Printing result[0] (66): ", result[0]);

            for (const [key, value] of Object.entries(result[0])) {
                if (value !== null && key !== 'Sample_No' && key !== 'date_of_lab' && key !== 'year' && key !== 'result_id' && key !== 'amount_of_material_remaining') {
                    newObj[`res.${key}`] = value;
                    resultsArray.push({name: key, value: value});      
                }
            }

            // === Sorting array in DESC order but only if they are elements (ex. Not 'RA', or 'Moisture', ...) ===
            let tempResultsArray = [];
            let tempResultsArray2 = [];

            // console.log("Printing results array (79): ", resultsArray);
            resultsArray.dele
            
            // console.log("Printing filteredRegistration (81): ", filteredRegistration);

            if(filteredRegistration){ 
                if(filteredRegistration === "Sum_rare_earth_elements"){
                    resultsArray.forEach(item => {
                        if(!reo_elements.includes(item.name) && (item.name !== "Moisture" && item.name !== "RA" && item.name !== "REO" && item.name !== "year" && item.year !== "result_id")){
                            // console.log("Printing elements excluded from REO: ", {name: item.name, value: item.value});
                            tempResultsArray2.push({name: item.name, value: item.value});
                        } else {
                            if (item.name === "Moisture" || item.name === "RA"){
                                tempResultsArray.push({name: item.name, value: item.value});
                            } else if (item.name === "REO"){
                                tempResultsArray.push({name: "Sum_rare_earth_elements", value: item.value});
                            } else {
                                // console.log("Printing elements from REO: ", {name: item.name, value: item.value});
                            }
                        }
                    })
                } else {
                    
                    // const maxItem = resultsArray.reduce((acc, current) => (current.value > acc.value) ? current : acc);
                    const maxItem = resultsArray.reduce((acc, current) => {
                        if (["RA", "Moisture"].includes(current.name)) {
                            return acc;
                        }
                        return (current.value > acc.value) ? current : acc;
                    }, resultsArray[0]);
                    // console.log("maxItem: ", maxItem);
                    tempResultsArray2.push(maxItem);

                    tempResultsArray.push({name: filteredRegistration, value: 0});

                    resultsArray.forEach(result => {
                        if (!elements.includes(result.name)) {
                            tempResultsArray.push(result);
                        }   
                    });
                }
            } else if (!filteredRegistration){
                resultsArray.forEach(result => {
                    if (!elements.includes(result.name)) {
                        tempResultsArray.push(result);
                    } else if(result.name !== "Moisture"){
                        // console.log("Printing result !filteredRegistration before adding to tempResultsArray2: ", result);
                        tempResultsArray2.push(result);
                    }
                });
            }
            
            
            tempResultsArray2.sort((a, b) => b.value - a.value);
            // tempResultsArray2.push(...tempResultsArray);

            // console.log("tempResultsArray:", tempResultsArray);
            // console.log("tempResultsArray2:", tempResultsArray2);
            
            resultsArray = tempResultsArray2;
            // ====================================================================================================
            

            // getting the key values of newObj
            const columns = Object.keys(newObj);

            // creating select query with added element values that contain results using columns.join(', ')
            const selectQuery = `
                SELECT cust.customer_id, cust.company, cust.country, cust.address, cust.email, cust.phone, reg.Sample_No, reg.gsa_sample_id, reg.internal_calibration,
                ${columns.join(', ')}
                FROM customers AS cust 
                INNER JOIN registration reg on reg.customer_id=cust.customer_id 
                INNER JOIN results res on reg.Sample_No=res.Sample_No AND reg.year = res.year
                WHERE res.Sample_No=? AND res.year=?;
            `;

            pool.query(selectQuery, [data.Sample_No, data.year], async (err, customerData) => {
                if (err) {
                    console.error(err);
                    // return res.status(500).send('Internal Server Error');
                }
                
                // const tempElements = resultsArray;
                const tempElements = tempResultsArray2;
                const tempNonElements = tempResultsArray;

                // console.log("Printing tempResultsArray2 (163): ", tempResultsArray2);
                // console.log("Printing tempResultsArray (164): ", tempResultsArray);

                // console.log("printing temp non elements: ", tempNonElements);

                // console.log("Printing customerData:", customerData[0]);
                
                let elementsAndPrices = await getElementSymbolAndPrices(tempElements, tempNonElements, customerData[0].country, registration[0].Type, registration[0].remove_main_element_price_and_analysis);

                let internal_calibration = false;
                if(customerData[0].internal_calibration !== null && Buffer.isBuffer(customerData[0].internal_calibration) && customerData[0].internal_calibration.equals(new Buffer.from([0x01]))){
                    internal_calibration = true;
                }

                // Setting all prices to 0 if internal calibration is selected
                // elementsAndPrices.forEach(item => {
                //     if(customerData[0].internal_calibration !== null && Buffer.isBuffer(customerData[0].internal_calibration) && customerData[0].internal_calibration.equals(new Buffer.from([0x01]))){
                //         item.price = 0
                //     }
                // })

                // console.log("Printing elements and their prices (167): ", elementsAndPrices);

                let total_price = 0;
                elementsAndPrices.forEach(element => {
                    total_price += element.price;
                });

                let nonElements = [];
                elementsAndPrices.slice(1).forEach((item) => {
                    if(item.non_element_name){
                        nonElements.push(item);
                    }
                });
                // nonElements = nonElements.replace(/, $/, '');
                // console.log("Printing non elements (128): ", nonElements);


                let elementSymbols = "";
                // console.log(elementsAndPrices);

                elementsAndPrices.slice(1).forEach((item) => {
                    if(elementsAndPrices.length === 1 && item.element_symbol !== undefined && item.element_symbol !== null){
                    elementSymbols = item.element_symbol
                    } else if (elementsAndPrices.length > 1 && item.element_symbol !== undefined && item.element_symbol !== null) {
                        elementSymbols += `${item.element_symbol}, `
                    }
                });
                // console.log("Printing element symbols: ", elementSymbols);
                elementSymbols = elementSymbols.replace(/, $/, '');

                
                // let unit_price = "";
                let unit_price = 0;
                elementsAndPrices.slice(1).forEach((item) => {
                    if(elementsAndPrices.length === 1 && item.element_symbol !== undefined){
                        unit_price = item.price
                    } else if (elementsAndPrices.length > 1 && item.element_symbol !== undefined) {
                        // unit_price += `${item.price}, `
                        unit_price += item.price
                    }
                });
                unit_price = unit_price.toString().replace(/, $/, '');

                console.log("Printing unit price (227): ", unit_price);


                // let sub_total = await calcSubTotal(total_price);

                // console.log("printing total price: ", total_price);

                let currency = "";
                if(customerData[0].country === "Rwanda"){
                    currency = "RWF";
                } else if (customerData[0].country !== "Rwanda"){
                    currency = "USD";
                }

                let sampleManagementFee = 0;
                if(customerData[0].country !== "Rwanda" && customerData[0].country !== "DRC"){
                    sampleManagementFee = await selectSampleManagementFee(total_price);
                }

                // console.log("printing env fee: ", sampleManagementFee);
                
                
                // console.log("printing gsa_sample_id: ", customerData[0].gsa_sample_id);

                let clientInvoiceData = {
                    "customer_details": {
                        "company_name": customerData[0].company,
                        "company_address": customerData[0].address,
                        "company_phone": customerData[0].phone,
                        "company_email": customerData[0].email
                    },
                    "invoice_file_name":`${customerData[0].gsa_sample_id.slice(0, 3) + "-Invoice" + customerData[0].gsa_sample_id.slice(3) + certNumVersion}`,
                    "currency": currency,
                    "sampled_request": []
                };

                let item_num_for_nonElements = 2;

                if(elementsAndPrices.length > 1){
                    clientInvoiceData.sampled_request.push({
                        "date": data.date,
                        "item":"1",
                        "certificate_number": customerData[0].gsa_sample_id,
                        "service_description": `${elementsAndPrices[0].element_name} Analysis (${elementsAndPrices[0].element_symbol})`,
                        "unit_price": internal_calibration ? 0 : await formatNumber(elementsAndPrices[0].price),
                        "quantity": "1",
                        "total_price": internal_calibration ? 0 : await formatNumber(elementsAndPrices[0].price)
                    });
                }

                if(elementsAndPrices.length === 1){
                    clientInvoiceData.sampled_request.push({
                        "date": data.date,
                        "item":"1",
                        "certificate_number": customerData[0].gsa_sample_id,
                        "service_description": `${elementsAndPrices[0].element_name} Analysis (${elementsAndPrices[0].element_symbol})`,
                        "unit_price": internal_calibration ? 0 : await formatNumber(elementsAndPrices[0].price),
                        "quantity": "1",
                        "total_price": internal_calibration ? 0 : await formatNumber(elementsAndPrices[0].price)
                    });
                }

                if(elementsAndPrices.length > 1){  
                    if(elementSymbols !== ""){
                        clientInvoiceData.sampled_request.push({
                            "date": data.date,
                            "item":"2",
                            "service_description": `(${elementSymbols})`,
                            // "unit_price": unit_price,
                            "unit_price": "",
                            "quantity": (elementSymbols.split(",").length),
                            // "total_price": 20 * elementsAndPrices.slice(1).length
                            // "total_price": await formatNumber(elementsAndPrices.slice(1).reduce((acc, item) => acc + item.price, 0)),
                            "total_price": internal_calibration ? 0 : await formatNumber(unit_price)
                        }); 
                        item_num_for_nonElements = 3;

                    } else if (elementSymbols === ""){
                        item_num_for_nonElements = 2;
                    }

                    nonElements.forEach(item => {
                        clientInvoiceData.sampled_request.push({
                            "date": data.date,
                            "item": item_num_for_nonElements,
                            "service_description": item.non_element_name,
                            "unit_price": internal_calibration ? 0 : item.price,
                            "quantity": 1,
                            "total_price": internal_calibration ? 0 : item.price
                        });
                        item_num_for_nonElements += 1;
                    })
                }

                // === Printing Sub total, vat, and grand total ===
                if(customerData[0].country !== "Rwanda" && customerData[0].country !== "DRC"){
                    clientInvoiceData.sampled_request.push({
                        "date": data.date,
                        "item": clientInvoiceData.sampled_request.length + 1,
                        "service_description": "Sample management",
                        "unit_price": internal_calibration ? 0 : sampleManagementFee,
                        "quantity": "1",
                        "total_price": internal_calibration ? 0 : sampleManagementFee
                    });
                    clientInvoiceData.grand_total = internal_calibration ? 0 : (total_price + sampleManagementFee);
                }

                if(customerData[0].country === "Rwanda"){
                    clientInvoiceData.sub_total = await formatNumber(total_price);
                    clientInvoiceData.vat = await formatNumber(total_price / 100 * 18);
                    clientInvoiceData.grand_total = await formatNumber(total_price + (total_price / 100 * 18));
                }

                if(customerData[0].country === "DRC"){
                    clientInvoiceData.grand_total = await formatNumber(total_price);
                }
                // ================================================

                // console.log("printing client invoice data: ", clientInvoiceData);

                // generatePdf(clientInvoiceData);

                // axios.post(`${process.env.PDF_GENERATOR_URL}/generateInvoicePdf`, clientInvoiceData, { httpsAgent })
                //     .then(response => {
                //         console.log('Data sent successfully:', response.data);
                //     })
                //     .catch(error => {
                //         console.error('Error sending data:', error);
                //     });

                // console.log("Printing final invoice date: ", clientInvoiceData);


                let grandTotal = 0;
                if(currency === "RWF"){
                    grandTotal = undoNumberFormatting(clientInvoiceData.grand_total);
                } else if (currency === "USD"){
                    grandTotal = clientInvoiceData.grand_total;
                }

                // Sending data to be added to invoice-data table
                const filteredDataForInvoiceTable = {
                    sample_no: Sample_No,
                    customer_id: customerData[0].customer_id,
                    currency: currency,
                    main_element: elementsAndPrices[0].element_name,
                    other_elements: elementSymbols,
                    other_services: nonElements.map(item => item.non_element_name).join(', '),
                    sample_management_fee: internal_calibration ? 0 : sampleManagementFee,
                    grand_total: internal_calibration ? 0 : grandTotal,
                    Date: data.date,
                    year: data.year
                }
                // console.log("Printing filteredDataForInvoiceTable: ", filteredDataForInvoiceTable);

                const AddToInvoiceData = await fetch(`http://localhost:4000/add-invoice-data`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(filteredDataForInvoiceTable) // Convert the data to JSON
                  });
                // console.log(JSON.parse(AddToInvoiceData));
                // ===============================================

                return await axios.post(`${process.env.PDF_GENERATOR_URL}/generateInvoicePdf`, clientInvoiceData, {
                    httpsAgent: new https.Agent({ ca: MY_CA_BUNDLE }), // Use your custom CA if needed
                    responseType: 'stream' // Important: Treat the response as a stream
                })
                .then(async response => {
                    // console.log('Data sent successfully, downloading and saving PDF...');
        
                    let file_name = response.data.rawHeaders[13].match(/filename="(.+\.pdf)"/)[1];
                    // console.log("Printing received file_name: ", file_name);
        
                    // === function that will rename old pdf by adding a timestamp at the end ===
                    let pdfFilePath = await checkAndRenamePDF(file_name);
        
                    const writer = fs.createWriteStream(pdfFilePath);
            
                    // Pipe the response stream to the file
                    response.data.pipe(writer);
                    // ==========================================================================
        
                    // const pdfFilePath = path.join(saveFolder, file_name);
                    // console.log("Printing pdfFilePath: ", pdfFilePath);
            
                    // Create a Promise to handle the file writing
                    return new Promise((resolve, reject) => {
                        // const writer = fs.createWriteStream(pdfFilePath);
            
                        // // Pipe the response stream to the file
                        // response.data.pipe(writer);
            
                        // Handle the 'finish' event to know when the file is written
                        writer.on('finish', () => {
                            // console.log('PDF saved successfully to', pdfFilePath);
                            resolve(pdfFilePath); // Resolve with the PDF file path
                        });
            
                        // Handle errors during the file write process
                        writer.on('error', (error) => {
                            console.error('Error saving PDF:', error);
                            reject(error); // Reject the promise if there's an error
                        });
                    });
                })  
            });
            
        })
    } catch (error) {
        console.error('Error: ', error);
    }
}

// Helper function to format the current date and time for renaming files
function getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
}

async function checkAndRenamePDF(file_name) {
    const saveFolder = path.join(__dirname, "..", "handlebars", "gsa-invoices");
    const pdfFilePath = path.join(saveFolder, file_name);

    try {
        const files = await fs.readdir(saveFolder);
        const matchingFiles = files.filter(file => file === file_name);

        // If the file exists, rename it with a timestamp
        if (matchingFiles.length > 0) {
            const timestamp = getTimestamp();
            const existingFilePath = path.join(saveFolder, matchingFiles[0]);
            const renamedFileName = `${file_name.replace('.pdf', '')}_${timestamp}.pdf`;
            const renamedFilePath = path.join(saveFolder, renamedFileName);

            // Rename the old file
            await fs.rename(existingFilePath, renamedFilePath);
            // console.log(`Renamed old PDF file to: ${renamedFileName}`);
        }

        // Return the path where the new PDF will be saved
        return pdfFilePath;
    } catch (error) {
        console.error('Error handling PDF save:', error);
        throw error;
    }
}

async function retrieveNonElementFromRegistration(sample_no, year){
    return new Promise((resolve, reject) => {
        pool.query(`SELECT * FROM registration WHERE Sample_No=? AND year=?`, [sample_no, year], (err, registration) => {
            resolve(registration);
        })
    })
}

async function getElements(){
    return new Promise((resolve, reject) => {
        pool.query(`select * from elements;`, (err, elements) => {
            resolve(elements);
        })
    })
}

async function formatNumber(num){
    return new Promise((resolve, reject) => {
        let formatted_number = Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        resolve(formatted_number);
    })
}

function undoNumberFormatting(formattedNumber) {
    // Remove spaces and parse the number back to an integer
    return parseInt(formattedNumber.replace(/\s+/g, ''), 10);
}

async function selectSampleManagementFee(total_price) {
    try {
      feeRanges = ['Environmental_fee_(0-249)', 'Environmental_fee_(250-499)', 'Environmental_fee_(500-999)', 'Environmental_fee_(1000-1999)', 'Environmental_fee_(2000)'];
  
      let query = '';
      
      if(total_price > 0 && total_price <= 249){
        query = `SELECT * FROM service_prices WHERE element='Environmental_fee_(0-249)'`;
      } else if(total_price >= 250 && total_price <= 499){
        query = `SELECT * FROM service_prices WHERE element='Environmental_fee_(250-499)'`;
      } else if(total_price >= 500 && total_price <= 999){
        query = `SELECT * FROM service_prices WHERE element='Environmental_fee_(500-999)'`;
      } else if(total_price >= 1000 && total_price <= 1999){
        query = `SELECT * FROM service_prices WHERE element='Environmental_fee_(1000-1999)'`;
      } else if (total_price >= 2000) {
        query = `SELECT * FROM service_prices WHERE element='Environmental_fee_(2000)'`;
      }
  
      return new Promise((resolve, reject) => {
        pool.query(query, (err, result) => {
          if(err){
            console.error(err);
            reject(err);
          } else {
            resolve(result[0].main_price_usd);
          }
        });
      });
    } catch (error) {
      console.error(error);
    }
}


// --- Removing sort for each country if statement because tempElements sorted before getElementSymbolAndPrices() is called ---
// async function getElementSymbolAndPrices(tempElements, tempNonElements, country, Type) {
//     return new Promise((resolve, reject) => {
//         let query = "";
//         if(country === "Rwanda"){
//             query = `SELECT prices.element, elem.element_name, prices.main_price_rwf, prices.secondary_price_rwf, elem.element_symbol FROM service_prices prices LEFT JOIN elements elem ON prices.element=elem.element_name;`
//             let combintationCompounds = ["", ""];
//             pool.query(query, (err, result) => {
//                 if (err) {
//                 reject(err);
//                 } else {
//                     const tempElementSymbols = [];

//                     // Add the main element
//                     let tempObj = result.filter(element => tempElements[0].name.includes(element.element))
//                     .map((element) => ({
//                         "element_name": element.element,
//                         "element_symbol": element.element_symbol, 
//                         "price": element.main_price_rwf, 
//                         "element_value": tempElements[0].value
//                     }));
//                     tempElementSymbols.push(tempObj);

//                     console.log("printing tempElementSymbols(1): ", tempElementSymbols);

//                     tempElements.slice(1).forEach(item => {
//                         let tempObj = result.filter(element => item.name.includes(element.element))
//                         .map((element) => ({
//                             "element_name": element.element,
//                             "element_symbol": element.element_symbol, 
//                             "price": element.secondary_price_rwf, 
//                             "element_value": item.value
//                         }));
//                         tempElementSymbols.push(tempObj);
//                     })

//                     console.log("printing tempElementSymbols(2): ", tempElementSymbols);

//                     tempNonElements.forEach(item => {
//                         let tempObj = result.filter(element => item.name.includes(element.element))
//                         .map((element) => ({
//                             "non_element_name": element.element,
//                             "price": element.secondary_price_rwf, 
//                             "element_value": item.value
//                         }));
//                         tempElementSymbols.push(tempObj);
//                     })

//                     console.log("printing tempElementSymbols(3): ", tempElementSymbols);
    
//                     const elementSymbols = [].concat(...tempElementSymbols);
    
//                     // elementSymbols.sort((a, b) => b.element_value - a.element_value);

//                     console.log("printing elementSymbols: ", elementSymbols);
    
//                     resolve(elementSymbols);
//                 }
//             });
//         } else if (country !== "Rwanda" && country !== "DRC"){
//             query = `SELECT prices.element, prices.main_price_usd, prices.secondary_price_usd, elem.element_symbol FROM service_prices prices LEFT JOIN elements elem ON prices.element=elem.element_name;`
//             pool.query(query, (err, result) => {
//                 if (err) {
//                 reject(err);
//                 } else {
//                     const tempElementSymbols = [];
    
//                     let tempObj = result.filter(element => tempElements[0].name.includes(element.element))
//                         .map((element) => ({
//                             "element_name": element.element,
//                             "element_symbol": element.element_symbol, 
//                             "price": element.main_price_usd, 
//                             "element_value": tempElements[0].value
//                         }));
//                     tempElementSymbols.push(tempObj);

//                     tempElements.slice(1).forEach(item => {
//                         let tempObj = result.filter(element => item.name.includes(element.element))
//                             .map((element) => ({
//                                 "element_name": element.element,
//                                 "element_symbol": element.element_symbol, 
//                                 "price": element.secondary_price_usd, 
//                                 "element_value": item.value
//                             }));
//                         tempElementSymbols.push(tempObj);
//                     })

//                     tempNonElements.forEach(item => {
//                         let tempObj = result.filter(element => item.name.includes(element.element))
//                         .map((element) => ({
//                             "non_element_name": element.element,
//                             "price": element.secondary_price_usd, 
//                             "element_value": item.value
//                         }));
//                         tempElementSymbols.push(tempObj);
//                     })
    
//                     const elementSymbols = [].concat(...tempElementSymbols);
    
//                     // elementSymbols.sort((a, b) => b.element_value - a.element_value);
    
//                     resolve(elementSymbols);
//                 }
//             });
//         } else if (country === "DRC"){
//             query = `SELECT prices.element, prices.main_price_usd_drc, prices.secondary_price_usd_drc, elem.element_symbol FROM service_prices prices LEFT JOIN elements elem ON prices.element=elem.element_name;`
//             pool.query(query, (err, result) => {
//                 if (err) {
//                 reject(err);
//                 } else {
//                     const tempElementSymbols = [];

//                     // console.log("printing result: ", result);
    
//                     let tempObj = result.filter(element => tempElements[0].name.includes(element.element))
//                         .map((element) => ({
//                             "element_name": element.element,
//                             "element_symbol": element.element_symbol, 
//                             "price": element.main_price_usd_drc, 
//                             "element_value": tempElements[0].value
//                         }));
//                     tempElementSymbols.push(tempObj);

//                     tempElements.slice(1).forEach(item => {
//                         let tempObj = result.filter(element => item.name.includes(element.element))
//                             .map((element) => ({
//                                 "element_name": element.element,
//                                 "element_symbol": element.element_symbol, 
//                                 "price": element.secondary_price_usd_drc, 
//                                 "element_value": item.value
//                             }));
//                         tempElementSymbols.push(tempObj);
//                     });

//                     tempNonElements.forEach(item => {
//                         let tempObj = result.filter(element => item.name.includes(element.element))
//                         .map((element) => ({
//                             "non_element_name": element.element,
//                             "price": element.secondary_price_usd_drc, 
//                             "element_value": item.value
//                         }));
//                         tempElementSymbols.push(tempObj);
//                     })
    
//                     const elementSymbols = [].concat(...tempElementSymbols);
    
//                     // elementSymbols.sort((a, b) => b.element_value - a.element_value);
    
//                     resolve(elementSymbols);
//                 }
//             });
//         }
//     });
// }

// Refactored function 25.12.24
async function getElementSymbolAndPrices(tempElements, tempNonElements, country, Type, remove_main_element_price_and_analysis) {
    return new Promise((resolve, reject) => {
        const queries = {
            "Rwanda": `SELECT prices.element, elem.element_name, prices.main_price_rwf, prices.secondary_price_rwf, elem.element_symbol 
                        FROM service_prices prices 
                        LEFT JOIN elements elem ON prices.element = elem.element_name;`,
            "DRC": `SELECT prices.element, prices.main_price_usd_drc, prices.secondary_price_usd_drc, elem.element_symbol 
                    FROM service_prices prices 
                    LEFT JOIN elements elem ON prices.element = elem.element_name;`,
            "default": `SELECT prices.element, prices.main_price_usd, prices.secondary_price_usd, elem.element_symbol 
                        FROM service_prices prices 
                        LEFT JOIN elements elem ON prices.element = elem.element_name;`
        };

        const query = queries[country] || queries["default"];
        const priceKeys = {
            "Rwanda": { main: "main_price_rwf", secondary: "secondary_price_rwf" },
            "DRC": { main: "main_price_usd_drc", secondary: "secondary_price_usd_drc" },
            "default": { main: "main_price_usd", secondary: "secondary_price_usd" }
        };
        const prices = priceKeys[country] || priceKeys["default"];

        const specialTypes = [
            {Type: 'Tantalum_Concentrate (Ta2O5)', formattedType: 'Tantalum Concentrate', Symbols: 'Ta', firstElement: 'Tantalum'},
            {Type: 'Tantalum_Concentrate (Ta2O5 + Nb2O5)', formattedType: 'Tantalum Concentrate', Symbols: 'Ta + Nb', firstElement: 'Tantalum', secondaryElement: 'Niobium'},
            {Type: 'Niobium_Concentrate (Nb2O5)', formattedType: 'Niobium Concentrate', Symbols: 'Nb', firstElement: 'Niobium'},
            {Type: 'Niobium_Concentrate (Nb2O5 + Ta2O5)', formattedType: 'Niobium Concentrate', Symbols: 'Nb + Ta', firstElement: 'Niobium', secondaryElement: 'Tantalum'},
            {Type: 'Tungsten_Concentrate', formattedType: 'Tungsten Concentrate', Symbols: 'W', firstElement: 'Tungsten'},
            {Type: 'Tin_Concentrate', formattedType: 'Tin Concentrate', Symbols: 'Sn', firstElement: 'Tin'},
            {Type: 'Beryllium_Concentrate', formattedType: 'Beryllium Concentrate', Symbols: 'Be', firstElement: 'Beryllium'},
            {Type: 'Lithium_Concentrate', formattedType: 'Lithium Concentrate', Symbols: 'Li', firstElement: 'Lithium'},
            {Type: 'Unidentified', formattedType: 'Unidentified', Symbols: 'Non', firstElement: ''}
        ];

        console.log("remove_main_element_price_and_analysis (728): ", remove_main_element_price_and_analysis);

        pool.query(query, (err, result) => {
            if (err) {
                return reject(err);
            }

            console.log("Printing temp elements (728): ", tempElements);


            const processItems = (items, isNonElement = false) => {
                return items.map((item, index) => {
                    console.log("Processing item: ", item); // Log each item being processed
                    
                    // console.table(result);
                    const matchingElements = result.filter(el => {
                        const specialType = specialTypes.find(special => special.Type === item.name);
                        // console.log("specialType: ", specialType);
            
                        if (specialType) {
                            
                            // Exclude firstElement and secondaryElement from matching
                            if(specialType.Type === "Tantalum_Concentrate (Ta2O5 + Nb2O5)" || specialType.Type === "Niobium_Concentrate (Nb2O5 + Ta2O5)"){
                                if (el.element !== specialType.firstElement && el.element !== specialType.secondaryElement) {
                                    return item.name.includes(el.element);
                                }
                                return false;
                            } else if (specialType.Type !== "Tantalum_Concentrate (Ta2O5 + Nb2O5)" || specialType.Type !== "Niobium_Concentrate (Nb2O5 + Ta2O5)") {
                                if (el.element === specialType.firstElement) {
                                    return item.name.includes(el.element);
                                }
                                return false;
                            }
                        }
            
                        // Fallback if specialType is undefined
                        // console.log(`Fallback matching element: ${el.element} with item: ${item.name}`);
                        return item.name.includes(el.element);
                    });
            
                    console.log("Matching elements for item: ", item.name, matchingElements);
            
                    // If no matching elements are found, still return the item
                    if (matchingElements.length === 0) {
                        console.log(`No matches found for ${item.name}, adding fallback.`);
                        return [
                            {
                                [isNonElement ? "non_element_name" : "element_name"]: item.name,
                                element_symbol: isNonElement ? undefined : 'Non',
                                price: 0,
                                element_value: item.value || 0,
                            },
                        ];
                    }
            
                    return matchingElements.map((el, elIndex) => {
                        let element_symbol = el.element_symbol;
                        const specialType = specialTypes.find(special => special.Type === Type);
            
                        if (specialType && el.element === specialType.Type) {
                            el.element = specialType.formattedType;
                            element_symbol = specialType.Symbols;
                        }

                        console.log("el.element === specialType?.Type (794): ", el.element, item.name === specialType?.Type);
                        const price = remove_main_element_price_and_analysis && (item.name === specialType?.Type)
                            ? 0 // (Skipped because `remove_main_element_price_and_analysis` is false)
                            : (item.name === specialType?.Type)
                                ? el[prices.main] // (Skipped because `el.element` is not in `specialTypes`)
                                : isNonElement
                                    ? el[prices.main] || 0 // (Skipped because `isNonElement` is false)
                                    : el[prices.secondary]; // Final fallback

                        return {
                            [isNonElement ? "non_element_name" : "element_name"]: el.element,
                            element_symbol: isNonElement ? undefined : element_symbol,
                            price,
                            element_value: item.value,
                        };
            
                        // return {
                        //     [isNonElement ? "non_element_name" : "element_name"]: el.element,
                        //     element_symbol: isNonElement ? undefined : element_symbol,
                        //     price: (specialTypes.includes(Type)) 
                        //         ? el[prices.main] 
                        //         : (isNonElement 
                        //             ? el[prices.main] || 0 // Ensure fallback for non_elements
                        //             : el[index === 0 ? prices.main : prices.secondary]),
                        //     element_value: item.value,
                        // };
                    });
                }).flat();
            };
            

            const filterSpecialTypeElements = () => {
                const specialType = specialTypes.find(special => special.Type === Type);

                if(specialType){
                    tempElements.unshift({ name: Type }); // Push Type to temp elements to first position
    
                    // Check if "Full_scan" is in tempNonElements.name
                    if (tempNonElements.some(nonElement => nonElement.name.includes("Full_scan") || nonElement.name.includes("Semi_quantitative"))) {
                        // If "Full_scan" exists, return only the Type element
                        return [{ name: Type }];
                    }

                    // Otherwise, return filtered tempElements excluding the first and secondary elements of the specialType
                    return tempElements.filter(el => {
                        return el.name !== specialType.firstElement && el.name !== specialType.secondaryElement;
                    });
                } else if (!specialType || specialType === undefined){
                    console.log("Printing tempElements (813): ", tempElements);
                    return tempElements;
                }

            };

            const filteredTempElements = filterSpecialTypeElements();
            console.log("Printing filteredTempElements (762): ", filteredTempElements);
            console.log("Printing filteredTempElements.slice(1) (763): ", filteredTempElements.slice(1));

            console.log("Printing tempNonElements (765): ", tempNonElements);

            const elementSymbols = [
                ...processItems([filteredTempElements[0]]),
                ...processItems(filteredTempElements.slice(1)),
                ...processItems(tempNonElements, true)
            ];

            console.log("Printing final elementSymbols: ", elementSymbols);

            resolve(elementSymbols);
        });
    });
}

module.exports = { generateInvoice };