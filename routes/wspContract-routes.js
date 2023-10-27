const express = require('express');
const router = express.Router();

const { pool } = require('../configs/mysql');

router.get('/getLastWSPContract', async (req, res) => {
    try {
        const query = `SELECT sample_no from wsp_contract ORDER BY id DESC LIMIT 1;`;

        pool.query(query, (err, wspLastContract) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ wspLastContract: wspLastContract });
        });
    } catch (error) {
        console.error(error);
    }
})

router.post('/addWSPContract', async (req, res) => {
    try {
        const data = req.body;

        const WSPContract = {
            sample_no: data.sample_no,
            company_name: data.company,
            time: data.time,
            date: data.date, 
            compound: data.compound,
            service: data.service,
            surveyor: data.surveyor,
            quotation_value: data.quotation_value,
            location_service: data.location_service
        }
        
        const query = `INSERT INTO wsp_contract SET ?`;

        pool.query(query, WSPContract, (err, wspContract) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ wspContract: wspContract })
        });
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;