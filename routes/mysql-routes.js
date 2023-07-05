const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const express = require('express');
const router = express.Router();

const { pool } = require('../configs/mysql');

router.get('/getCustomers', async (req, res) => {
    try {
        pool.query('SELECT * FROM customers', (err, result) => {
            res.json({customers: result});
        })
    } catch (error) {
        console.error(error);
    }
});

router.post('/editCustomer', async (req, res) => {
    const customer = req.body;
    console.log(customer);
    try {
        pool.query('UPDATE customers SET ? WHERE customer_id = ?', [customer, customer.customer_id], async (err, results) => {
            if (err) {
                console.log(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json('Successfully updated customer!');
        });
    } catch (error) {
        console.error(error);
    }
})

router.get('/getResults', async (req, res) => {
    try {
        const result = req.body;
        
        pool.query('SELECT * FROM results', (err, result) => {
            res.json({results: result});
        })
    } catch (error) {
        console.error(error);
    }
});

router.post('/addRegistration', async (req, res) => {
    try {   
        const data = req.body;

        console.log("Printing data:");
        console.log(data);

        // Extract the column names and values from the data object
        const columns = Object.keys(data);
        const values = Object.values(data);

        console.log("Printing columns:");
        console.log(columns);

        console.log("Printing values:");
        console.log(values);

        // Prepare the INSERT query dynamically based on available data
        const insertQuery = `
        INSERT INTO registration2
        (${columns.map(column => column === 'Lead' ? '`Lead`' : column).join(', ')})
        VALUES
        (${Array(columns.length).fill('?').join(', ')})
        `;

        pool.query(insertQuery, values, (error, results) => {
            if (error) {
                console.log(error);
                return res.status(500).send('Internal Server Error');
            }

            res.status(200).json('successfully added result to DB');
        })
    } catch (error) {
        console.error(error);
    }
})

router.get('/getRegistrations', async (req, res) => {
    try {
        pool.query('SELECT * FROM registration2', (err, registration) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            res.json({registrations: registration});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/getLastRegistration', async (req, res) => {
    try {
        pool.query('SELECT * FROM registration2 ORDER BY `Registration_id` DESC LIMIT 1', (err, registration) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            res.json({ registrations: registration });
        })
    } catch (err) {
        console.error(err)
    }
});

router.post('/searchRegistration', async (req, res) => {
    try {
        const registration = req.body;
        console.log(registration.Sample_No);
        pool.query('SELECT * FROM registration2 WHERE Sample_No = ? AND Sample_No NOT IN (SELECT Sample_No FROM results)', [registration.Sample_No], async (err, result) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            
            res.status(200).json({ registrations: result });
        })
    } catch (err) {
        console.error(err)
    }
});

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
})

router.get('/getMethods', async (req, res) => {
    try {
        pool.query('SELECT * FROM methods', (err, method) => {
            if(err){
                console.error(error);
                return res.status(500).send('Internal Server Error');
            }
            res.json({methods: method});
        })
    } catch (error) {
        console.error(error);
    }
})

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
})


router.post('/addResult', async (req, res) => {
    try {
        const data = req.body;

        console.log("Printing data:");
        console.log(data);

        // Extract the column names and values from the data object
        const columns = Object.keys(data);
        const values = Object.values(data);

        console.log("Printing columns:");
        console.log(columns);

        console.log("Printing values:");
        console.log(values);

        // Prepare the INSERT query dynamically based on available data
        const insertQuery = `
        INSERT INTO results
        (${columns.map(column => column === 'Lead' ? '`Lead`' : column).join(', ')})
        VALUES
        (${Array(columns.length).fill('?').join(', ')})
        `;
        

        pool.query(insertQuery, values, (error, results) => {
            if (error) {
                console.log(error);
                return res.status(500).send('Internal Server Error');
            }

            res.status(200).json('successfully added data into table results');
        })
    } catch (error) {
        console.error(error);
    }
})

module.exports = router;