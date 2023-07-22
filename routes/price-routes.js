const express = require('express');
const router = express.Router();

const { pool } = require('../configs/mysql');

router.get('/getPrices', async (req, res) => {
    try {
        pool.query('SELECT * FROM price', (err, price) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            res.json({prices: price});
        })
        // res.json({prices: prices});
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;