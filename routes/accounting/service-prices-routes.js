const express = require('express');
const router = express.Router();

const path = require('path');
const ExcelJS = require('exceljs');

const { pool } = require('../../configs/mysql');

router.get('/getExportPrices', async (req, res) => {
    try {
        pool.query('SELECT * FROM service_prices', async (err, result) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            let excelPath = await createExcelFile(result);

            console.log("Printing excelPath: ", excelPath);
            // res.download(excelPath);
            res.download(excelPath, 'exportedPrices.xlsx', (err) => {
                if (err) {
                    console.error('Error downloading the file:', err);
                    res.status(500).send('Failed to download file.');
                }
            });
        
    
            // res.json({service_prices: result});
        })
    } catch (error) {
        console.error(error);
    }
});

async function createExcelFile(result) {
    // Create a new workbook and add a worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Exported Prices');

    // Add columns to the worksheet
    worksheet.columns = [
        { header: 'id', key: 'id', width: 30 },
        { header: 'element', key: 'element', width: 10 },
        { header: 'main_price_rwf', key: 'main_price_rwf', width: 30 },
        { header: 'secondary_price_rwf', key: 'secondary_price_rwf', width: 30 },
        { header: 'main_price_usd', key: 'main_price_usd', width: 30 },
        { header: 'secondary_price_usd', key: 'secondary_price_usd', width: 30 },
        { header: 'main_price_usd_drc', key: 'main_price_usd_drc', width: 30 },
        { header: 'secondary_price_usd_drc', key: 'secondary_price_usd_drc', width: 30 },
    ];

    result.forEach(item => {
        worksheet.addRow({ 
            id: item.id,
            element: item.element,
            main_price_rwf: item.main_price_rwf,
            secondary_price_rwf: item.secondary_price_rwf,
            main_price_usd: item.main_price_usd, 
            secondary_price_usd: item.secondary_price_usd,
            main_price_usd_drc: item.main_price_usd_drc,
            secondary_price_usd_drc: item.secondary_price_usd_drc
        })
    });

    // Save the workbook to a file
    const filePath = path.join(__dirname, '..', '..', 'files', 'exportedPrices.xlsx');
    await workbook.xlsx.writeFile(filePath);
    console.log(`Excel file created at ${filePath}`);

    return filePath;
}

router.get('/getAllServicePrices', async (req, res) => {
    try {
        pool.query('SELECT * FROM service_prices', (err, result) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
    
            res.json({service_prices: result});
        })
    } catch (error) {
        console.error(error);
    }
});

router.put('/updateServicePrice', async (req, res) => {
    try {
        const data = req.body;
        const query = `UPDATE service_prices SET ? WHERE id=?`;

        pool.query(query, [data, data.id], (err, result) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
    
            res.json({message: `Successfully updated service price for ${data.element}`});
        })
    } catch (error) {
        console.error(error);
    }
})


module.exports = router;