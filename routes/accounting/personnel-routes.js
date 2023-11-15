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

router.post('/addPersonnel', async (req, res) => {
    try {
        const data = req.body;

        const personnel = {
            name: data.name,
            position: data.position,
            phone: data.phone
        }

        const query = `INSERT INTO personnel_data SET ?`;

        pool.query(query, personnel, (err, personnel) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ personnel: personnel });
        })
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;