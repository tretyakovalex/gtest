const express = require('express');
const router = express.Router();

const path = require('path');
const ExcelJS = require('exceljs');

const { pool } = require('../../configs/mysql');

router.get('/getAllCompaniesAnalysisStatistics', async (req, res) => {
    try {
        // const query = `SELECT reg.Date, cust.customer_id, cust.company, cust.name, cust.surname, reg.Sample_No, reg.Type
        //             FROM customers cust 
        //             INNER JOIN registration reg on cust.customer_id=reg.customer_id 
        //             WHERE YEAR(Date) = 2024;`;
        const query = `SELECT reg.Date, cust.customer_id, cust.company, cust.name, cust.surname, reg.Sample_No, reg.Type, inv_data.grand_total
                    FROM customers cust 
                    INNER JOIN registration reg on cust.customer_id=reg.customer_id 
                    JOIN invoice_data inv_data on reg.Sample_No=inv_data.sample_no
                    WHERE YEAR(inv_data.Date) = 2024`;
        // const query = `SELECT reg.Date, cust.customer_id, cust.company, cust.name, cust.surname, reg.Sample_No, reg.Type
        //             FROM customers cust 
        //             INNER JOIN registration reg on cust.customer_id=reg.customer_id 
        //             WHERE YEAR(Date) = 2024 AND cust.customer_id=3;`;

        pool.query(query, async (err, data) => {
            if(err){
                console.error(err);
                res.json({error: err});
            }

            let analysisStatistics = [];

            // Helper function to find the company object in the result array
            const findCompanyObject = (companyName) => {
                return analysisStatistics.find(obj => obj.company === companyName);
            };

            data.forEach(item => {

                const companyName = item.company ? item.company : `${item.name} ${item.surname}`;
                const materialType = item.Type.replace(/\s+/g, '_'); //replacing spaces with underscores

                // Try to find the existing object for the company
                let companyObj = findCompanyObject(companyName);

                // If no object exists, create a new one
                if (!companyObj) {
                    companyObj = { customer_id: item.customer_id, company: companyName, total_amount_rwf: 0, total_amount_usd: 0 };
                    analysisStatistics.push(companyObj);
                }

                // Initialize the material type count if it doesn't exist
                if (!companyObj[materialType]) {
                    companyObj[materialType] = 0;
                }

                // Increment the material count
                companyObj[materialType]++;
            });

            // const query = new URLSearchParams({
            //     month: month
            // }).toString();

            const unparsedCompanyTotals = await fetch(`http://localhost:4000/getAllCompanyTotalsByMainElement`);
            const companyTotals = await unparsedCompanyTotals.json();

            console.log("Printing company totals: ", companyTotals);
            console.log("Printing analysisStatistics: ", analysisStatistics);

            analysisStatistics.forEach((item) => {
                
                // let matchingCompanyTotals = companyTotals.filter(total => total.company === item.company);
                let matchingCompanyTotals = companyTotals.filter(total => total.customer_id === item.customer_id);

                console.log("Printing matchingCompanyTotal: ", matchingCompanyTotals);
                
                matchingCompanyTotals.forEach(matchingTotal => {
                    if(matchingTotal.currency === "USD"){
                        item.total_amount_usd += matchingTotal.grand_total;
                    } else if (matchingTotal.currency === "RWF"){
                        item.total_amount_rwf += matchingTotal.grand_total;
                    }
                });

            });

            console.log("Printing combined analysisStatistics: ", analysisStatistics);

            // Define a mapping of properties to rename
            const propertyMapping = {
                Tantalum: 'Tantalum',
                Tungsten: 'Tungsten',
                Cassiterite: 'Tin',
                Shielitte: 'Tungsten',
                Monozite: 'Monozite',
                Spodumene: 'Lithium',
                Beryl: 'Beryllium',
                Columbite: 'Niobium',
                Unidentified: 'Unidentified',
                "Tantalite_Concentrate": 'Tantalum',
                "Wolframite_Concentrate": 'Tungsten',
                "Cassiterite_Concentrate": 'Tin'
            };

            let new_analysisStatistics = renameAndCombineProperties(analysisStatistics, propertyMapping);

            console.log("Printing new formatted analysisStatistics: ", new_analysisStatistics);

            res.json({analysisStatistics: new_analysisStatistics});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/getAllCompaniesAnalysisStatisticsByMonth', async (req, res) => {
    try {
        const month = req.query.month;
        // const query = `SELECT reg.Date, cust.customer_id, cust.company, cust.name, cust.surname, reg.Sample_No, reg.Type
        //             FROM customers cust 
        //             INNER JOIN registration reg on cust.customer_id=reg.customer_id 
        //             WHERE YEAR(Date) = 2024
        //             AND MONTH(Date) = ${month};`;
        const query = `SELECT reg.Date, cust.customer_id, cust.company, cust.name, cust.surname, reg.Sample_No, reg.Type, inv_data.grand_total
                    FROM customers cust 
                    INNER JOIN registration reg on cust.customer_id=reg.customer_id 
                    JOIN invoice_data inv_data on reg.Sample_No=inv_data.sample_no
                    WHERE YEAR(inv_data.Date) = 2024
                    AND MONTH(inv_data.Date) = ${month};`;
        
        pool.query(query, async (err, data) => {
            if(err){
                console.error(err);
                res.json({error: err});
            }

            let analysisStatistics = [];

            // Helper function to find the company object in the result array
            const findCompanyObject = (companyName) => {
                return analysisStatistics.find(obj => obj.company === companyName);
            };

            data.forEach(item => {

                const companyName = item.company ? item.company : `${item.name} ${item.surname}`;
                const materialType = item.Type.replace(/\s+/g, '_'); //replacing spaces with underscores

                // Try to find the existing object for the company
                let companyObj = findCompanyObject(companyName);

                // If no object exists, create a new one
                if (!companyObj) {
                    companyObj = { customer_id: item.customer_id, company: companyName, total_amount_rwf: 0, total_amount_usd: 0 };
                    analysisStatistics.push(companyObj);
                }

                // Initialize the material type count if it doesn't exist
                if (!companyObj[materialType]) {
                    companyObj[materialType] = 0;
                }

                // Increment the material count
                companyObj[materialType]++;
            });

            const query = new URLSearchParams({
                month: month
            }).toString();

            const unparsedCompanyTotals = await fetch(`http://localhost:4000/getAllCompanyTotalsByMainElement?${query}`);
            const companyTotals = await unparsedCompanyTotals.json();

            console.log("Printing company totals: ", companyTotals);
            console.log("Printing analysisStatistics: ", analysisStatistics);

            analysisStatistics.forEach((item) => {
                
                // let matchingCompanyTotals = companyTotals.filter(total => total.company === item.company);
                let matchingCompanyTotals = companyTotals.filter(total => total.customer_id === item.customer_id);

                console.log("Printing matchingCompanyTotal: ", matchingCompanyTotals);
                
                matchingCompanyTotals.forEach(matchingTotal => {
                    if(matchingTotal.currency === "USD"){
                        item.total_amount_usd += matchingTotal.grand_total;
                    } else if (matchingTotal.currency === "RWF"){
                        item.total_amount_rwf += matchingTotal.grand_total;
                    }
                });

            });

            console.log("Printing combined analysisStatistics: ", analysisStatistics);

            // Define a mapping of properties to rename
            const propertyMapping = {
                Tantalum: 'Tantalum',
                Tungsten: 'Tungsten',
                Cassiterite: 'Tin',
                Shielitte: 'Tungsten',
                Monozite: 'Monozite',
                Spodumene: 'Lithium',
                Beryl: 'Beryllium',
                Columbite: 'Niobium',
                Unidentified: 'Unidentified',
                "Tantalite_Concentrate": 'Tantalum',
                "Wolframite_Concentrate": 'Tungsten',
                "Cassiterite_Concentrate": 'Tin'
            };
            
            let new_analysisStatistics = renameAndCombineProperties(analysisStatistics, propertyMapping);
            
            console.log("Printing new formatted analysisStatistics: ", new_analysisStatistics);

            // sumAllAnalysis(new_analysisStatistics);
            
            // Send the combined result
            res.json({analysisStatistics: new_analysisStatistics});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/getAllCompanyTotalsByMainElement', async (req, res) => {
    try {
        const month = req.query.month;
        let query = "";

        console.log("Printing month: ", month);

        if(month){
            query = `SELECT inv_data.sample_no, cust.customer_id, cust.company, cust.name, cust.surname, inv_data.main_element, inv_data.grand_total, inv_data.currency, inv_data.Date
                FROM customers cust 
                INNER JOIN invoice_data inv_data on cust.customer_id=inv_data.customer_id 
                WHERE YEAR(Date) = 2024
                AND MONTH(Date) = ${month};`
        } else if (!month){
            query = `SELECT inv_data.sample_no, cust.customer_id, cust.company, cust.name, cust.surname, inv_data.main_element, inv_data.grand_total, inv_data.currency, inv_data.Date
                FROM customers cust 
                INNER JOIN invoice_data inv_data on cust.customer_id=inv_data.customer_id 
                WHERE YEAR(Date) = 2024;`
        }

        pool.query(query, (err, companyTotals) => {
            if(err){
                console.error(err);
            }

            res.json(companyTotals);
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/exportInvoiceData', async (req, res) => {
    pool.query('select * from invoice_data', async (err, data) => {
        if(err){
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        let excelPath = await createExcelFile(data);

        console.log("Printing excelPath: ", excelPath);
        // res.download(excelPath);
        res.download(excelPath, 'exportedInvoiceData.xlsx', (err) => {
            if (err) {
                console.error('Error downloading the file:', err);
                res.status(500).send('Failed to download file.');
            }
        });
    })
})

// Function to rename properties in an analysisStatistics
function renameAndCombineProperties(input, mapping) {
    return input.map(statistics => {
      const updatedStatistics = {};
  
      Object.entries(statistics).forEach(([key, value]) => {
        // Skip the 'company' property to avoid adding 0 to the company's value
        if (key === 'company') {
            updatedStatistics[key] = value;
            return;
        }

        // Find the new key based on the mapping
        const newKey = mapping[key] || key;
  
        // Add the value to the new key, combining if it already exists
        updatedStatistics[newKey] = (updatedStatistics[newKey] || 0) + value;
      });
  
      return updatedStatistics;
    });
}

// function sumAllAnalysis(new_analysisStatistics){
//     new_analysisStatistics.forEach(statistic => {
//         console.log("Printing statistic: ", statistic);
//         console.log(statistic.Tantalum);
//         console.log("Printing Tantalum: ", statistic.Tantalum);
//         statistic.total_analysis = statistic.Tantalum + statistic.Tungsten + statistic.Tin + statistic.Niobium + statistic.Monozite + statistic.Lithium + statistic.Beryllium + statistic.Unidentified;
//         console.log(statistic.total_analysis);
//     })

//     return new_analysisStatistics;
// }

async function createExcelFile(result) {
    // Create a new workbook and add a worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Exported Prices');

    // Add columns to the worksheet
    worksheet.columns = [
        { header: 'id', key: 'id', width: 10 },
        { header: 'sample_no', key: 'sample_no', width: 10 },
        { header: 'customer_id', key: 'customer_id', width: 10 },
        { header: 'currency', key: 'currency', width: 10 },
        { header: 'main_element', key: 'main_element', width: 15 },
        { header: 'other_elements', key: 'other_elements', width: 50 },
        { header: 'other_services', key: 'other_services', width: 30 },
        { header: 'sample_management_fee', key: 'sample_management_fee', width: 10 },
        { header: 'grand_total', key: 'grand_total', width: 10 },
        { header: 'Date', key: 'Date', width: 10 },
    ];

    result.forEach(item => {
        worksheet.addRow({ 
            id: item.id,
            sample_no: item.sample_no,
            customer_id: item.customer_id,
            currency: item.currency,
            main_element: item.main_element,
            other_elements: item.other_elements,
            other_services: item.other_services,
            sample_management_fee: item.sample_management_fee,
            grand_total: item.grand_total,
            Date: item.Date
        })
    });

    // Save the workbook to a file
    const filePath = path.join(__dirname, '..', '..', 'files', 'exportedAnalysisStatistics.xlsx');
    await workbook.xlsx.writeFile(filePath);
    console.log(`Excel file created at ${filePath}`);

    return filePath;
}


module.exports = router;