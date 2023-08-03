const express = require('express');
const router = express.Router();

const { pool } = require('../configs/mysql');

router.post('/addCustomer', async (req, res) => {
    try {

        const data = req.body;

        console.log(data);

        const columns = Object.keys(data);
        const values = Object.values(data);

        console.log("Printing columns: ");
        console.log(columns);

        console.log("Printing values: ");
        console.log(values);

        const insertQuery = `
            INSERT INTO customers
            (${columns.join(', ')})
            VALUES
            (${Array(columns.length).fill('?').join(', ')})
            `;
        console.log(insertQuery);

        pool.query(insertQuery, values, (err, customer) => {
            if (err) {
                console.log(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ customers: customer });
        })
    } catch (error) {
        console.error(error);
    }
});

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
});


module.exports = router;