const express = require('express');
const { generatePdf } = require('../handlebars/compiledHandlebars');
const router = express.Router();

const { pool } = require('../configs/mysql');

router.get('/testHandlebars', async (req, res) => {
    try {
        const data = req.body; 
        
        pool.query(`SELECT * FROM results WHERE Sample_No=?`, [data.Sample_No], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            // selecting object from array of objects
            // console.log(result[0]);

            // extracting key values pairs whos values are not null and keys that are not Sample_No or data_of_lab
            const newObj = {};
            for (const [key, value] of Object.entries(result[0])) {
                if (value !== null && key !== 'Sample_No' && key !== 'date_of_lab') {
                  newObj[`res.${key}`] = value;
                }
            }
            // console.log(newObj);

            // getting the key values of newObj
            const columns = Object.keys(newObj);

            // creating select query with added element values that contain results using columns.join(', ')
            const selectQuery = `
                SELECT cust.customer_id, cust.company, cust.address, cust.email, cust.phone, reg.Sample_No, 
                ${columns.join(', ')}
                FROM customers AS cust 
                INNER JOIN registration reg on reg.customer_id=cust.customer_id 
                INNER JOIN results res on reg.Sample_No=res.Sample_No 
                WHERE res.Sample_No=?;
            `;

            // console.log("printing select query: ", selectQuery);
        
            // res.json({ result: result })

            // const query = `SELECT cust.customer_id, cust.company, cust.address, cust.email, cust.phone, reg.Sample_No, res.Tin FROM customers AS cust INNER JOIN registration reg on reg.customer_id=cust.customer_id INNER JOIN results res on reg.Sample_No=res.Sample_No WHERE res.Sample_No=?;`;

            pool.query(selectQuery, [data.Sample_No], async (err, customerData) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Internal Server Error');
                }

                // console.log(customerData);
                res.json({ customerData: customerData });
                
                const tempElements = columns.map(str => str.replace('res.', ''));
                console.log("Printing tempElements: ", tempElements);
                
                // let elementSymbols = await getElementSymbols(tempElements);
                // console.log("Printing elementSymbols (63): ", elementSymbols);
                
                let elementsAndPrices = await getElementSymbolAndPrices(tempElements);
                console.log("Printing elementSymbols (67): ", elementsAndPrices);

                let elementSymbols = "";
                elementsAndPrices.forEach((item) => {
                    if(elementsAndPrices.length === 1){
                        elementSymbols = item.element_symbol
                    } else if (elementsAndPrices.length > 1) {
                        elementSymbols += `${item.element_symbol}, `
                    }
                });
                elementSymbols = elementSymbols.endsWith(', ') ? elementSymbols.slice(0, -2) : elementSymbols;
                // elementsAndPrices.length === 1 ? elementsAndPrices[0].element_symbol : elementSymbols.element_symbol.join(', ');
                console.log("Printing joined elements: ", elementSymbols);
                
                let unit_price = "";
                elementsAndPrices.forEach((item) => {
                    if(elementsAndPrices.length === 1){
                        unit_price = item.price_usd
                    } else if (elementsAndPrices.length > 1) {
                        unit_price += `${item.price_usd}, `
                    }
                });
                unit_price = unit_price.endsWith(', ') ? unit_price.slice(0, -2) : unit_price;
                // elementsAndPrices.length === 1 ? elementsAndPrices[0].price_usd : elementsAndPrices.price_usd.join(', ');
                console.log("Printing joined unit prices: ", unit_price);


                let total_price = 0;
                elementsAndPrices.forEach(element => {
                    total_price += element.price_usd;
                });

                console.log("printing total price: ", total_price);

                let clientInvoiceData = {
                    "customer_details": {
                        "company_name": customerData[0].company,
                        "company_address": customerData[0].address,
                        "company_phone": customerData[0].phone,
                        "company_email": customerData[0].email
                    },
                    "sampled_request": []
                };

                // === Splitting all prices and rows into separate rows (1 price and 1 symbol per row) ===
                elementsAndPrices.forEach(item => {
                    clientInvoiceData.sampled_request.push({
                        "date": data.date,
                        "item":"1",
                        "certificate_number": data.certificate_number,
                        "service_description": item.element_symbol,
                        "unit_price": item.price_usd,
                        "quantity": "1",
                        "total_price": item.price_usd
                    });
                });

                clientInvoiceData.sampled_request.push({
                    "date": data.date,
                    "item":"1",
                    "certificate_number": `Sample Management fee ${data.certificate_number}`,
                    "service_description": "Sample management",
                    "unit_price": 50,
                    "quantity": "1",
                    "total_price": 50
                });

                // === Collecting all prices and elements into 1 row (N price(s) and N symbol(s) per row) ===
                // let clientInvoiceData = {
                //     "customer_details": {
                //         "company_name": customerData[0].company,
                //         "company_address": customerData[0].address,
                //         "company_phone": customerData[0].phone,
                //         "company_email": customerData[0].email
                //     },
                //     "sampled_request": [
                //         {
                //             "date": data.date,
                //             "item":"1",
                //             "certificate_number": data.certificate_number,
                //             "service_description": elementSymbols,
                //             "unit_price": unit_price,
                //             "quantity": "1",
                //             "total_price": total_price
                //         }
                //     ]
                // };


                // console.log("printing client invoice data: ", clientInvoiceData);

                generatePdf(clientInvoiceData);
            });

        })
        
        
    } catch (error) {
        console.error('Error: ', error);
    }
});

// async function getElementSymbols(tempElements){
//     // console.log("printing elements from getElementSymbols(): ", tempElements);
    
//     pool.query('SELECT element_name, element_symbol FROM elements', (err, result) => {
//         if(err){
//             console.error(err);
//         }
//         // console.log("printing result: ", result);
        
//         const elementSymbols = result.filter(element => tempElements.includes(element.element_name)).map(element => element.element_symbol);
//         // console.log("printing elementSymbols: ", elementSymbols);
        
//         return elementSymbols;
//     })
// }

// async function getElementSymbols(tempElements) {
//     return new Promise((resolve, reject) => {
//       pool.query('SELECT element_name, element_symbol FROM elements', (err, result) => {
//         if (err) {
//           reject(err);
//         } else {
//           const elementSymbols = result.filter(element => tempElements.includes(element.element_name)).map(element => element.element_symbol);
//           resolve(elementSymbols);
//         }
//       });
//     });
// }

async function getElementSymbolAndPrices(tempElements) {
    return new Promise((resolve, reject) => {
    //   pool.query('SELECT element, price_usd FROM gsa_certificate_invoice_element_prices;', (err, result) => {
      pool.query('SELECT prices.element, prices.price_usd, elem.element_symbol FROM gsa_certificate_invoice_element_prices prices INNER JOIN elements elem ON prices.element=elem.element_name;', (err, result) => {
        if (err) {
          reject(err);
        } else {
          const elementSymbols = result.filter(element => tempElements.includes(element.element)).map((element) => ({"element_name": element.element, "element_symbol": element.element_symbol, "price_usd": element.price_usd}));
          resolve(elementSymbols);
        }
      });
    });
}

module.exports = router;