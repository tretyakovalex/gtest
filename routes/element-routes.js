const express = require('express');
const router = express.Router();

const { pool } = require('../configs/mysql');

router.get('/getElements', async (req, res) => {
    try {
        pool.query('SELECT * FROM elements', (err, element) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            res.json({elements: element});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/getAllElementAnalysis', async (req, res) => {
    try {
        pool.query('SELECT * from element_analysis', (err, elementAnalysis) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            res.json({ elementAnalysis: elementAnalysis });
        })
    } catch (error) {
        console.error(error);
    }    
})

module.exports = router;