const express = require('express');
const router = express.Router();

const { pool } = require('../configs/mysql');

router.get('/getMethods', async (req, res) => {
    try {
        pool.query('SELECT * FROM methods', (err, method) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            res.json({methods: method});
        })
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;