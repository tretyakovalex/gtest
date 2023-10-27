const express = require('express');
const router = express.Router();

const moment = require('moment-timezone');

const { pool } = require('../configs/mysql');

router.get('/getGSACertificate', async (req, res) => {
    try {
        const query = `SELECT * FROM gsa_certificate`;
        pool.query(query, (err, gsaCertificate) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ gsaCertificates: gsaCertificate });
        });
    } catch (error) {
        console.error(error);
    }
});

router.post('/addGSACertificate', async (req, res) => {
    try {
        const data = req.body;

        const certificate = {
            sample_no: data.sample_no,
            release_date: data.release_date
        }

        const query = `INSERT INTO gsa_certificate SET ?`;

        pool.query(query, certificate, (err, gsaCertificate) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ gsaCertificates: gsaCertificate })
        });
    } catch (error) {
        console.error(error);
    }
})

module.exports = router;