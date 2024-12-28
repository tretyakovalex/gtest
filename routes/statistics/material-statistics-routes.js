const express = require('express');
const router = express.Router();

const path = require('path');
const ExcelJS = require('exceljs');

const { pool } = require('../../configs/mysql');

router.get('/getAllMaterialStatistics', async (req, res) => {
    try {
        const query = `SELECT Type, SUM(Sample_weight) AS total_sample_weight, SUM(amount_of_material_remaining) AS total_material_remaining FROM registration GROUP BY Type`;

        pool.query(query, async (err, data) => {
            if(err){
                console.error(err);
                res.json({error: err});
            }

            // Define the property mapping
            // const propertyMapping = {
            //     'Tantalum_Concentrate (Ta2O5)': 'Tantalum',
            //     'Tantalum_Concentrate (Ta2O5 + Nb2O5)': 'Tantalum',
            //     Tungsten_Concentrate: 'Tungsten',
            //     Tin_Concentrate: 'Tin',
            //     Lithium_Concentrate: 'Lithium',
            //     Beryllium_Concentrate: 'Beryllium',
            //     'Niobium_Concentrate (Nb2O5)': 'Niobium',
            //     'Niobium_Concentrate (Nb2O5 + Ta2O5)': 'Niobium',
            //     Unidentified: 'Unidentified',
            // };

            const propertyMapping = {
                'Tantalum_Concentrate (Ta2O5)': 'Tantalum_Concentrate (Ta2O5)',
                'Tantalum_Concentrate (Ta2O5 + Nb2O5)': 'Tantalum_Concentrate (Ta2O5 + Nb2O5)',
                Tungsten_Concentrate: 'Tungsten_Concentrate',
                Tin_Concentrate: 'Tin_Concentrate',
                Lithium_Concentrate: 'Lithium_Concentrate',
                Beryllium_Concentrate: 'Beryllium_Concentrate',
                'Niobium_Concentrate (Nb2O5)': 'Niobium_Concentrate (Nb2O5)',
                'Niobium_Concentrate (Nb2O5 + Ta2O5)': 'Niobium_Concentrate (Nb2O5 + Ta2O5)',
                Unidentified: 'Unidentified',
            };

            // Process results: normalize, map, and aggregate duplicates
            const materialStatistics = data
                .map(row => {
                    // Normalize and map Type
                    // const normalizedType = row.Type.replace(/\s+/g, '_');
                    const normalizedType = row.Type;
                    const mappedType = propertyMapping[normalizedType] || normalizedType;

                    return {
                        Type: mappedType,
                        total_sample_weight: parseFloat(row.total_sample_weight) || 0, // Explicitly convert to a number
                        total_material_remaining: parseFloat(row.total_material_remaining) || 0 // Explicitly convert to a number
                    };
                })
                .reduce((acc, row) => {
                    // Check if the Type already exists in the accumulator
                    const existingEntry = acc.find(entry => entry.Type === row.Type);
                    if (existingEntry) {
                        // Combine the weights if the type already exists
                        existingEntry.total_sample_weight += row.total_sample_weight;
                        existingEntry.total_material_remaining += row.total_material_remaining;
                    } else {
                        // Add the new entry
                        acc.push(row);
                    }
                    return acc;
                }, []);


            console.log("Printing combined analysisStatistics: ", materialStatistics);


            res.json({materialStatistics: materialStatistics});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/getAllMaterialStatisticsByMonth', async (req, res) => {
    try {
        const month = req.query.month;
        const year = req.query.year;
        
        let query = ``;
        console.log("year: ", year);
        console.log("month: ", month);
        if(month){
            query = `SELECT Type, SUM(Sample_weight) AS total_sample_weight, SUM(amount_of_material_remaining) AS total_material_remaining FROM registration WHERE YEAR(Date) = ${year} AND MONTH(Date) = ${month} GROUP BY Type`;
        } else if (!month || month === undefined){
            query = `SELECT Type, SUM(Sample_weight) AS total_sample_weight, SUM(amount_of_material_remaining) AS total_material_remaining FROM registration WHERE YEAR(Date) = ${year} GROUP BY Type;`;
        }
        
        pool.query(query, async (err, data) => {
            if(err){
                console.error(err);
                res.json({error: err});
            }

            // Define the property mapping
            // const propertyMapping = {
            //     'Tantalum_Concentrate (Ta2O5)': 'Tantalum',
            //     'Tantalum_Concentrate (Ta2O5 + Nb2O5)': 'Tantalum',
            //     Tungsten_Concentrate: 'Tungsten',
            //     Tin_Concentrate: 'Tin',
            //     Lithium_Concentrate: 'Lithium',
            //     Beryllium_Concentrate: 'Beryllium',
            //     'Niobium_Concentrate (Nb2O5)': 'Niobium',
            //     'Niobium_Concentrate (Nb2O5 + Ta2O5)': 'Niobium',
            //     Unidentified: 'Unidentified',
            // };

            const propertyMapping = {
                'Tantalum_Concentrate (Ta2O5)': 'Tantalum_Concentrate (Ta2O5)',
                'Tantalum_Concentrate (Ta2O5 + Nb2O5)': 'Tantalum_Concentrate (Ta2O5 + Nb2O5)',
                Tungsten_Concentrate: 'Tungsten_Concentrate',
                Tin_Concentrate: 'Tin_Concentrate',
                Lithium_Concentrate: 'Lithium_Concentrate',
                Beryllium_Concentrate: 'Beryllium_Concentrate',
                'Niobium_Concentrate (Nb2O5)': 'Niobium_Concentrate (Nb2O5)',
                'Niobium_Concentrate (Nb2O5 + Ta2O5)': 'Niobium_Concentrate (Nb2O5 + Ta2O5)',
                Unidentified: 'Unidentified',
            };
            // Process results: normalize, map, and aggregate duplicates
            const materialStatistics = data
                .map(row => {
                    // Normalize and map Type
                    // const normalizedType = row.Type.replace(/\s+/g, '_');
                    const normalizedType = row.Type;
                    const mappedType = propertyMapping[normalizedType] || normalizedType;

                    return {
                        Type: mappedType,
                        total_sample_weight: parseFloat(row.total_sample_weight) || 0, // Explicitly convert to a number
                        total_material_remaining: parseFloat(row.total_material_remaining) || 0 // Explicitly convert to a number
                    };
                })
                .reduce((acc, row) => {
                    // Check if the Type already exists in the accumulator
                    const existingEntry = acc.find(entry => entry.Type === row.Type);
                    if (existingEntry) {
                        // Combine the weights if the type already exists
                        existingEntry.total_sample_weight += row.total_sample_weight;
                        existingEntry.total_material_remaining += row.total_material_remaining;
                    } else {
                        // Add the new entry
                        acc.push(row);
                    }
                    return acc;
                }, []);


            console.log("Printing combined analysisStatistics: ", materialStatistics);


            res.json({materialStatistics: materialStatistics});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/exportMaterialStatisticsData', async (req, res) => {
    let query = `SELECT 
            CASE 
                WHEN cust.company IS NOT NULL AND cust.company != '' THEN cust.company 
                ELSE CONCAT(cust.name, ' ', cust.surname) 
            END AS customer_name,
            reg.Date, 
            reg.Type, 
            reg.Sample_weight, 
            reg.amount_of_material_remaining, 
            reg.Sample_No,
            year 
        FROM registration reg 
        INNER JOIN customers cust ON cust.customer_id = reg.customer_id;`

    pool.query(query, async (err, data) => {
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

async function createExcelFile(result) {
    // Create a new workbook and add a worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Exported Material');

    // Add columns to the worksheet
    worksheet.columns = [
        { header: 'Customer Name', key: 'customer_name', width: 40 },
        { header: 'Date', key: 'Date', width: 10 },
        { header: 'Type', key: 'Type', width: 15 },
        { header: 'Sample_weight', key: 'Sample_weight', width: 12 },
        { header: 'Amount of Material Remaining', key: 'amount_of_material_remaining', width: 25 },
        { header: 'Sample Number', key: 'sample_no', width: 14 },
        { header: 'Year', key: 'year', width: 7 },
    ];

    result.forEach(item => {
        worksheet.addRow({ 
            customer_name: item.customer_name,
            Date: item.Date,
            Type: item.Type,
            Sample_weight: item.Sample_weight,
            amount_of_material_remaining: item.amount_of_material_remaining,
            sample_no: item.Sample_No,
            year: item.year,
        })
    });

    // Save the workbook to a file
    const filePath = path.join(__dirname, '..', '..', 'files', 'exportedMaterialStatistics.xlsx');
    await workbook.xlsx.writeFile(filePath);
    console.log(`Excel file created at ${filePath}`);

    return filePath;
}


module.exports = router;