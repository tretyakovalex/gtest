const express = require('express');
const router = express.Router();

const { pool } = require('../../configs/mysql');

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