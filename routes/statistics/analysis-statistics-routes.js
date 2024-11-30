const express = require('express');
const router = express.Router();

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


module.exports = router;