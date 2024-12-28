const express = require('express');
const router = express.Router();

const path = require('path');
const ExcelJS = require('exceljs');

const { pool } = require('../../configs/mysql');

router.get('/getAllCompaniesSampleStatistics', async (req, res) => {
    try {
        const query = `SELECT company_name, compound, quotation_value, currency FROM wsp_contract WHERE YEAR(future_sampling_date) = 2024;`;

        pool.query(query, async (err, data) => {
            if(err){
                console.error(err);
                res.json({error: err});
            }

            console.log("Printing raw data: ", data);

            let sampleStatistics = [];

            // Helper function to find the company object in the result array
            const findCompanyObject = (companyName) => {
                return sampleStatistics.find(obj => obj.company === companyName);
            };

            data.forEach(item => {

                const materialType = item.compound.replace(/\s+/g, '_'); //replacing spaces with underscores

                // Try to find the existing object for the company
                let companyObj = findCompanyObject(item.company_name);

                // If no object exists, create a new one
                if (!companyObj) {
                    companyObj = { company: item.company_name, total_amount_rwf: 0, total_amount_usd: 0 };
                    sampleStatistics.push(companyObj);
                }

                // Initialize the material type count if it doesn't exist
                if (!companyObj[materialType]) {
                    companyObj[materialType] = 0;
                }

                // Increment the material count
                companyObj[materialType]++;

                const quotationValue = Number(item.quotation_value); // Ensure it's a number
                if (item.currency === "USD") {
                    companyObj.total_amount_usd += quotationValue;
                } else if (item.currency === "RWF") {
                    companyObj.total_amount_rwf += quotationValue;
                }
            });

            console.log("sampleStatistics: ", sampleStatistics);

            const propertyMapping = {
                Tantalum: 'Tantalum',
                Tungsten: 'Tungsten',
                Cassiterite: 'Tin',
                Scheelite: 'Tungsten',
                Monazite: 'Monazite',
                'Lithium_Concentrate': 'Lithium',
                Beryllium: 'Beryllium',
                'Niobium_Concentrate': 'Niobium',
                Unidentified: 'Unidentified',
                "Tantalite_Concentrate": 'Tantalum',
                "Wolframite_Concentrate": 'Tungsten',
                "Cassiterite_Concentrate": 'Tin'
            };

            let new_samplingStatistics = renameAndCombineProperties(sampleStatistics, propertyMapping);

            res.json({sampleStatistics: new_samplingStatistics});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/getAllCompaniesSampleStatisticsByMonth', async (req, res) => {
    try {
        const month = req.query.month;
        const year = req.query.year;

        let query = ``;
        console.log("year: ", year);
        console.log("month: ", month);
        if(month){
            query = `SELECT company_name, compound, quotation_value, currency FROM wsp_contract where YEAR(future_sampling_date) = ${year} AND MONTH(future_sampling_date) = ${month};`;
        } else if (!month){
            query = `SELECT company_name, compound, quotation_value, currency FROM wsp_contract where YEAR(future_sampling_date) = ${year};`;
        }


        pool.query(query, async (err, data) => {
            if(err){
                console.error(err);
                res.json({error: err});
            }

            console.log("Printing raw data: ", data);

            let sampleStatistics = [];

            // Helper function to find the company object in the result array
            const findCompanyObject = (companyName) => {
                return sampleStatistics.find(obj => obj.company === companyName);
            };

            data.forEach(item => {

                const materialType = item.compound.replace(/\s+/g, '_'); //replacing spaces with underscores

                // Try to find the existing object for the company
                let companyObj = findCompanyObject(item.company_name);

                // If no object exists, create a new one
                if (!companyObj) {
                    companyObj = { company: item.company_name, total_amount_rwf: 0, total_amount_usd: 0 };
                    sampleStatistics.push(companyObj);
                }

                // Initialize the material type count if it doesn't exist
                if (!companyObj[materialType]) {
                    companyObj[materialType] = 0;
                }

                // Increment the material count
                companyObj[materialType]++;

                const quotationValue = Number(item.quotation_value); // Ensure it's a number
                if (item.currency === "USD") {
                    companyObj.total_amount_usd += quotationValue;
                } else if (item.currency === "RWF") {
                    companyObj.total_amount_rwf += quotationValue;
                }
            });

            console.log("sampleStatistics: ", sampleStatistics);

            const propertyMapping = {
                Tantalum: 'Tantalum',
                Tungsten: 'Tungsten',
                Cassiterite: 'Tin',
                Scheelite: 'Tungsten',
                Monazite: 'Monazite',
                'Lithium_Concentrate': 'Lithium',
                Beryllium: 'Beryllium',
                'Niobium_Concentrate': 'Niobium',
                Unidentified: 'Unidentified',
                "Tantalite_Concentrate": 'Tantalum',
                "Wolframite_Concentrate": 'Tungsten',
                "Cassiterite_Concentrate": 'Tin'
            };

            let new_samplingStatistics = renameAndCombineProperties(sampleStatistics, propertyMapping);

            res.json({sampleStatistics: new_samplingStatistics});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/exportWSPContractData', async (req, res) => {
    pool.query('select * from wsp_contract', async (err, data) => {
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
});

// Function to rename properties in an samplingStatistics
function renameAndCombineProperties(input, mapping) {
    return input.map(statistics => {
      const updatedStatistics = {};
  
      Object.entries(statistics).forEach(([key, value]) => {
        // Skip the 'company' property to avoid adding 0 to the company's value
        if (key === 'company') {
            updatedStatistics[key] = value;
            return;
        }

        // If the key is not usd or rwf total then rename the properties and carry the counters
        if (key !== 'total_amount_usd' || key !== 'total_amount_rwf'){
            // Find the new key based on the mapping
            const newKey = mapping[key] || key;
            
            // Add the value to the new key, combining if it already exists
            updatedStatistics[newKey] = (updatedStatistics[newKey] || 0) + value;
        }
        
      });
  
      return updatedStatistics;
    });
}

router.get('/getMinAndMaxYearFromWSPContract', async (req, res) => {
    try {
        pool.query('SELECT MIN(YEAR(future_sampling_date)) AS min_year, MAX(YEAR(future_sampling_date)) AS max_year FROM wsp_contract;', (err, data) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({minMaxYears: data});
        })
    } catch (error) {
        console.error(error);
    }
})

async function createExcelFile(result) {
    // Create a new workbook and add a worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Exported Prices');

    // Add columns to the worksheet
    worksheet.columns = [
        { header: 'id', key: 'id', width: 10 },
        { header: 'sample_no', key: 'sample_no', width: 10 },
        { header: 'company_name', key: 'company_name', width: 30 },
        { header: 'future_sampling_time', key: 'future_sampling_time', width: 15 },
        { header: 'future_sampling_date', key: 'future_sampling_date', width: 15 },
        { header: 'compound', key: 'compound', width: 15 },
        { header: 'service', key: 'service', width: 30 },
        { header: 'surveyor', key: 'surveyor', width: 15 },
        { header: 'quotation_value', key: 'quotation_value', width: 20 },
        { header: 'location_service', key: 'location_service', width: 30 },
        { header: 'release_date', key: 'release_date', width: 15 },
        { header: 'currency', key: 'currency', width: 10 },
    ];

    result.forEach(item => {
        worksheet.addRow({ 
            id: item.id,
            sample_no: item.sample_no,
            company_name: item.company_name,
            future_sampling_time: item.future_sampling_time,
            future_sampling_date: item.future_sampling_date,
            compound: item.compound,
            service: item.service,
            surveyor: item.surveyor,
            quotation_value: item.quotation_value,
            location_service: item.location_service,
            release_date: item.release_date,
            currency: item.currency
        })
    });

    // Save the workbook to a file
    const filePath = path.join(__dirname, '..', '..', 'files', 'exportedSamplingStatistics.xlsx');
    await workbook.xlsx.writeFile(filePath);
    console.log(`Excel file created at ${filePath}`);

    return filePath;
}


module.exports = router;