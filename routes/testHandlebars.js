const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

const { generatePdf } = require('../handlebars/compiledHandlebars');
// const { sendMessageToClients } = require('../handlebars/websocket');

const { pool } = require('../configs/mysql');

const axios = require('axios');
require('dotenv').config();

async function generateInvoice(Sample_No, date){
    try {
        const data = {Sample_No: Sample_No, date, date}; 
        
        pool.query(`SELECT * FROM results WHERE Sample_No=?`, [data.Sample_No], async (err, result) => {
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

            
            let registration = await retrieveNonElementFromRegistration(data.Sample_No);
            let filteredRegistration = "";

            // console.log("registration: ", registration[0]);

            for (const [key, value] of Object.entries(registration[0])) {
                // Was initially this: value.equals(new Buffer([0x01])))) before depreciation. Now its: value.equals(new Buffer.from([0x01]))))
                if ((key === 'Sum_rare_earth_elements' || key === 'Full_scan' || key === 'Semi_quantitative') && (value !== null && Buffer.isBuffer(value) && value.equals(new Buffer.from([0x01])))) {
                    console.log(key);
                    filteredRegistration = key;
                }
            }

            console.log("Printing filteredRegistraton: ", filteredRegistration);

            for (const [key, value] of Object.entries(result[0])) {
                if (value !== null && key !== 'Sample_No' && key !== 'date_of_lab') {
                    newObj[`res.${key}`] = value;
                    resultsArray.push({name: key, value: value});      
                }
            }

            // === Sorting array in DESC order but only if they are elements (ex. Not 'RA', or 'Moisture', ...) ===
            let tempResultsArray = [];
            let tempResultsArray2 = [];

            console.log("Printing results array (62): ", resultsArray);
            

            if(filteredRegistration){ 
                if(filteredRegistration === "Sum_rare_earth_elements"){
                    resultsArray.forEach(item => {
                        if(!reo_elements.includes(item.name) && (item.name !== "Moisture" && item.name !== "RA" && item.name !== "REO")){
                            console.log("Printing elements excluded from REO: ", {name: item.name, value: item.value});
                            tempResultsArray2.push({name: item.name, value: item.value});
                        } else {
                            if (item.name === "Moisture" || item.name === "RA"){
                                tempResultsArray.push({name: item.name, value: item.value});
                            } else if (item.name === "REO"){
                                tempResultsArray.push({name: "Sum_rare_earth_elements", value: item.value});
                            } else {
                                console.log("Printing elements from REO: ", {name: item.name, value: item.value});
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
                    console.log("maxItem: ", maxItem);
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
                    }
                    tempResultsArray2.push(result);
                });
            }
            
            
            tempResultsArray2.sort((a, b) => b.value - a.value);
            // tempResultsArray2.push(...tempResultsArray);

            console.log("tempResultsArray:", tempResultsArray);
            console.log("tempResultsArray2:", tempResultsArray2);
            
            resultsArray = tempResultsArray2;
            // ====================================================================================================
            

            // getting the key values of newObj
            const columns = Object.keys(newObj);

            // creating select query with added element values that contain results using columns.join(', ')
            const selectQuery = `
                SELECT cust.customer_id, cust.company, cust.country, cust.address, cust.email, cust.phone, reg.Sample_No, reg.gsa_sample_id,
                ${columns.join(', ')}
                FROM customers AS cust 
                INNER JOIN registration reg on reg.customer_id=cust.customer_id 
                INNER JOIN results res on reg.Sample_No=res.Sample_No
                WHERE res.Sample_No=?;
            `;

            pool.query(selectQuery, [data.Sample_No], async (err, customerData) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Internal Server Error');
                }
                
                // const tempElements = resultsArray;
                const tempElements = tempResultsArray2;
                const tempNonElements = tempResultsArray;

                console.log("printing temp non elements: ", tempNonElements);
                
                let elementsAndPrices = await getElementSymbolAndPrices(tempElements, tempNonElements, customerData[0].country);

                // console.log("Printing elements and their prices (59): ", elementsAndPrices);

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
                console.log("Printing non elements (128): ", nonElements);


                let elementSymbols = "";
                console.log(elementsAndPrices);

                elementsAndPrices.slice(1).forEach((item) => {
                    if(elementsAndPrices.length === 1 && item.element_symbol !== undefined){
                    elementSymbols = item.element_symbol
                    } else if (elementsAndPrices.length > 1 && item.element_symbol !== undefined) {
                        elementSymbols += `${item.element_symbol}, `
                    }
                });
                console.log("Printing element symbols: ", elementSymbols);
                elementSymbols = elementSymbols.replace(/, $/, '');

                
                let unit_price = "";
                elementsAndPrices.slice(1).forEach((item) => {
                    if(elementsAndPrices.length === 1 && item.element_symbol !== undefined){
                        unit_price = item.price
                    } else if (elementsAndPrices.length > 1 && item.element_symbol !== undefined) {
                        unit_price += `${item.price}, `
                    }
                });
                unit_price = unit_price.toString().replace(/, $/, '');

                // console.log("Printing unit price: ", unit_price);


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
                    "invoice_file_name":`${customerData[0].gsa_sample_id.slice(0, 3) + "-Invoice" + customerData[0].gsa_sample_id.slice(3)}`,
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
                        "unit_price": await formatNumber(elementsAndPrices[0].price),
                        "quantity": "1",
                        "total_price": await formatNumber(elementsAndPrices[0].price)
                    });
                }

                if(elementsAndPrices.length === 1){
                    clientInvoiceData.sampled_request.push({
                        "date": data.date,
                        "item":"1",
                        "certificate_number": customerData[0].gsa_sample_id,
                        "service_description": `${elementsAndPrices[0].element_name} Analysis (${elementsAndPrices[0].element_symbol})`,
                        "unit_price": await formatNumber(elementsAndPrices[0].price),
                        "quantity": "1",
                        "total_price": await formatNumber(elementsAndPrices[0].price)
                    });
                }

                if(elementsAndPrices.length > 1){  
                    if(elementSymbols){
                        clientInvoiceData.sampled_request.push({
                            "date": data.date,
                            "item":"2",
                            "service_description": `(${elementSymbols})`,
                            // "unit_price": unit_price,
                            "unit_price": "",
                            "quantity": (elementSymbols.split(",").length),
                            // "total_price": 20 * elementsAndPrices.slice(1).length
                            // "total_price": await formatNumber(elementsAndPrices.slice(1).reduce((acc, item) => acc + item.price, 0)),
                            "total_price": await formatNumber(unit_price)
                        }); 
                        item_num_for_nonElements = 3;
                    }  

                    nonElements.forEach(item => {
                        clientInvoiceData.sampled_request.push({
                            "date": data.date,
                            "item": item_num_for_nonElements,
                            "service_description": item.non_element_name,
                            "unit_price": item.price,
                            "quantity": 1,
                            "total_price": item.price
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
                        "unit_price": sampleManagementFee,
                        "quantity": "1",
                        "total_price": sampleManagementFee
                    });
                    clientInvoiceData.grand_total = total_price + sampleManagementFee;
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

                // axios.post('http://localhost:4400/generateInvoicePdf', clientInvoiceData)
                axios.post(`${process.env.PDF_GENERATOR_URL}/generateInvoicePdf`, clientInvoiceData)
                    .then(response => {
                        console.log('Data sent successfully:', response.data);
                    })
                    .catch(error => {
                        console.error('Error sending data:', error);
                    });
            });
            
        })
    } catch (error) {
        console.error('Error: ', error);
    }
}

async function retrieveNonElementFromRegistration(sample_no){
    return new Promise((resolve, reject) => {
        pool.query(`SELECT * FROM registration WHERE Sample_No=?`, [sample_no], (err, registration) => {
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
async function getElementSymbolAndPrices(tempElements, tempNonElements, country) {
    return new Promise((resolve, reject) => {
        let query = "";
        if(country === "Rwanda"){
            query = `SELECT prices.element, elem.element_name, prices.main_price_rwf, prices.secondary_price_rwf, elem.element_symbol FROM service_prices prices LEFT JOIN elements elem ON prices.element=elem.element_name;`
            pool.query(query, (err, result) => {
                if (err) {
                reject(err);
                } else {
                    const tempElementSymbols = [];

                    let tempObj = result.filter(element => tempElements[0].name.includes(element.element))
                    .map((element) => ({
                        "element_name": element.element,
                        "element_symbol": element.element_symbol, 
                        "price": element.main_price_rwf, 
                        "element_value": tempElements[0].value
                    }));
                    tempElementSymbols.push(tempObj);

                    tempElements.slice(1).forEach(item => {
                        let tempObj = result.filter(element => item.name.includes(element.element))
                        .map((element) => ({
                            "element_name": element.element,
                            "element_symbol": element.element_symbol, 
                            "price": element.secondary_price_rwf, 
                            "element_value": item.value
                        }));
                        tempElementSymbols.push(tempObj);
                    })

                    tempNonElements.forEach(item => {
                        let tempObj = result.filter(element => item.name.includes(element.element))
                        .map((element) => ({
                            "non_element_name": element.element,
                            "price": element.secondary_price_rwf, 
                            "element_value": item.value
                        }));
                        tempElementSymbols.push(tempObj);
                    })
    
                    const elementSymbols = [].concat(...tempElementSymbols);
    
                    // elementSymbols.sort((a, b) => b.element_value - a.element_value);

                    console.log("printing elementSymbols: ", elementSymbols);
    
                    resolve(elementSymbols);
                }
            });
        } else if (country !== "Rwanda" && country !== "DRC"){
            query = `SELECT prices.element, prices.main_price_usd, prices.secondary_price_usd, elem.element_symbol FROM service_prices prices LEFT JOIN elements elem ON prices.element=elem.element_name;`
            pool.query(query, (err, result) => {
                if (err) {
                reject(err);
                } else {
                    const tempElementSymbols = [];
    
                    let tempObj = result.filter(element => tempElements[0].name.includes(element.element))
                        .map((element) => ({
                            "element_name": element.element,
                            "element_symbol": element.element_symbol, 
                            "price": element.main_price_usd, 
                            "element_value": tempElements[0].value
                        }));
                    tempElementSymbols.push(tempObj);

                    tempElements.slice(1).forEach(item => {
                        let tempObj = result.filter(element => item.name.includes(element.element))
                            .map((element) => ({
                                "element_name": element.element,
                                "element_symbol": element.element_symbol, 
                                "price": element.secondary_price_usd, 
                                "element_value": item.value
                            }));
                        tempElementSymbols.push(tempObj);
                    })

                    tempNonElements.forEach(item => {
                        let tempObj = result.filter(element => item.name.includes(element.element))
                        .map((element) => ({
                            "non_element_name": element.element,
                            "price": element.secondary_price_usd, 
                            "element_value": item.value
                        }));
                        tempElementSymbols.push(tempObj);
                    })
    
                    const elementSymbols = [].concat(...tempElementSymbols);
    
                    // elementSymbols.sort((a, b) => b.element_value - a.element_value);
    
                    resolve(elementSymbols);
                }
            });
        } else if (country === "DRC"){
            query = `SELECT prices.element, prices.main_price_usd_drc, prices.secondary_price_usd_drc, elem.element_symbol FROM service_prices prices LEFT JOIN elements elem ON prices.element=elem.element_name;`
            pool.query(query, (err, result) => {
                if (err) {
                reject(err);
                } else {
                    const tempElementSymbols = [];

                    // console.log("printing result: ", result);
    
                    let tempObj = result.filter(element => tempElements[0].name.includes(element.element))
                        .map((element) => ({
                            "element_name": element.element,
                            "element_symbol": element.element_symbol, 
                            "price": element.main_price_usd_drc, 
                            "element_value": tempElements[0].value
                        }));
                    tempElementSymbols.push(tempObj);

                    tempElements.slice(1).forEach(item => {
                        let tempObj = result.filter(element => item.name.includes(element.element))
                            .map((element) => ({
                                "element_name": element.element,
                                "element_symbol": element.element_symbol, 
                                "price": element.secondary_price_usd_drc, 
                                "element_value": item.value
                            }));
                        tempElementSymbols.push(tempObj);
                    });

                    tempNonElements.forEach(item => {
                        let tempObj = result.filter(element => item.name.includes(element.element))
                        .map((element) => ({
                            "non_element_name": element.element,
                            "price": element.secondary_price_usd_drc, 
                            "element_value": item.value
                        }));
                        tempElementSymbols.push(tempObj);
                    })
    
                    const elementSymbols = [].concat(...tempElementSymbols);
    
                    // elementSymbols.sort((a, b) => b.element_value - a.element_value);
    
                    resolve(elementSymbols);
                }
            });
        }
    });
}

// async function getElementSymbolAndPrices(tempElements, country) {
//     return new Promise((resolve, reject) => {
//         let query = "";
//         if(country === "Rwanda"){
//             query = `SELECT prices.element, prices.main_price_rwf, prices.secondary_price_rwf, elem.element_symbol FROM service_prices prices INNER JOIN elements elem ON prices.element=elem.element_name;`
//             pool.query(query, (err, result) => {
//                 if (err) {
//                 reject(err);
//                 } else {
//                     const tempElementSymbols = [];
    
//                     tempElements.forEach(item => {
//                         let tempObj = result.filter(element => item.name.includes(element.element))
//                             .map((element) => ({
//                                 "element_name": element.element,
//                                 "element_symbol": element.element_symbol, 
//                                 "price": element.price_rwf, 
//                                 "element_value": item.value
//                             }));
//                         tempElementSymbols.push(tempObj);
//                     })
    
//                     const elementSymbols = [].concat(...tempElementSymbols);
    
//                     elementSymbols.sort((a, b) => b.element_value - a.element_value);
    
//                     resolve(elementSymbols);
//                 }
//             });
//         } else if (country !== "Rwanda" && country !== "DRC"){
//             query = `SELECT prices.element, prices.main_price_usd, prices.secondary_price_usd, elem.element_symbol FROM service_prices prices INNER JOIN elements elem ON prices.element=elem.element_name;`
//             pool.query(query, (err, result) => {
//                 if (err) {
//                 reject(err);
//                 } else {
//                     const tempElementSymbols = [];
    
//                     tempElements.forEach(item => {
//                         let tempObj = result.filter(element => item.name.includes(element.element))
//                             .map((element) => ({
//                                 "element_name": element.element,
//                                 "element_symbol": element.element_symbol, 
//                                 "price": element.main_price_usd, 
//                                 "element_value": item.value
//                             }));
//                         tempElementSymbols.push(tempObj);
//                     })
    
//                     const elementSymbols = [].concat(...tempElementSymbols);
    
//                     elementSymbols.sort((a, b) => b.element_value - a.element_value);
    
//                     resolve(elementSymbols);
//                 }
//             });
//         } else if (country === "DRC"){
//             query = `SELECT prices.element, prices.main_price_usd_drc, prices.secondary_price_usd_drc, elem.element_symbol FROM service_prices prices INNER JOIN elements elem ON prices.element=elem.element_name;`
//             pool.query(query, (err, result) => {
//                 if (err) {
//                 reject(err);
//                 } else {
//                     const tempElementSymbols = [];
    
//                     tempElements.forEach(item => {
//                         let tempObj = result.filter(element => item.name.includes(element.element))
//                             .map((element) => ({
//                                 "element_name": element.element,
//                                 "element_symbol": element.element_symbol, 
//                                 "price": element.main_price_usd_drc, 
//                                 "element_value": item.value
//                             }));
//                         tempElementSymbols.push(tempObj);
//                     })
    
//                     const elementSymbols = [].concat(...tempElementSymbols);
    
//                     elementSymbols.sort((a, b) => b.element_value - a.element_value);
    
//                     resolve(elementSymbols);
//                 }
//             });
//         }
//     });
// }

module.exports = { generateInvoice };