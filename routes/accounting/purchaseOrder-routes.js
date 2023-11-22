const express = require('express');
const router = express.Router();

const { pool } = require('../../configs/mysql');

router.get('/getLastPurchaseOrder', async (req, res) => {
    try {
        const query = `SELECT * FROM purchase_order_form ORDER BY id DESC LIMIT 1;`
        pool.query(query, (err, lastPurchaseOrderForm) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ lastPurchaseOrderForm: lastPurchaseOrderForm });
        })
    } catch (error) {
        console.error(error);
    }
});

router.post('/createPurchaseOrderDocNum', async (req, res) => {
    try {
        const data = req.body;

        const purchaseOrderForm = {
            document_number: data.document_number,
            created_at: data.created_at
        }

        const query = `INSERT INTO purchase_order_form SET ?`;

        pool.query(query, purchaseOrderForm, (err, PurchaseOrderForm) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ PurchaseOrderForm: PurchaseOrderForm });
        })
    } catch (error) {
        console.error(error);
    }
});

router.post('/createPurchaseOrderTable', async (req, res) => {
    try {
        const data = req.body;

        console.log(data);

        const insertQuery = `INSERT INTO purchase_order_items (personnel_id, purchase_order_form_id, number, items, quantity, unit_price, total_price, total_price_vat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = data.tableData.map((tableDataRow) => [
            data.personnel_id,
            data.purchase_order_form_id,
            tableDataRow.number,
            tableDataRow.items,
            tableDataRow.quantity,
            tableDataRow.unit_price,
            tableDataRow.total_price,
            tableDataRow.total_price_vat
        ]);

        // Use Promise.all to wait for all insertions to complete
        Promise.all(
            values.map((rowValues) => {
                return new Promise((resolve, reject) => {
                    pool.query(insertQuery, rowValues, (insertErr) => {
                        if (insertErr) {
                            console.error('Error inserting data:', insertErr);
                            reject(insertErr);
                        } else {
                            resolve();
                        }
                    });
                });
            })
        )
        .then(() => {
            res.status(200).json({ message: 'Data saved successfully' });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;

