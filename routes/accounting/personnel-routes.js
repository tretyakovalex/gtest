const express = require('express');
const router = express.Router();

const { pool } = require('../../configs/mysql');

router.get('/getPersonnels', async (req, res) => {
    try {
        pool.query('SELECT * FROM personnel_data', (err, personnel) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ personnels: personnel });
        })
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;