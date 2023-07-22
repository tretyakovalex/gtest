const express = require('express');
const router = express.Router();

const { pool } = require('../configs/mysql');

router.get('/getCompounds', async (req, res) => {
    try {
        pool.query('SELECT * FROM compounds', (err, compound) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            res.json({ compounds: compound });
        })
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;