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
});


module.exports = router;