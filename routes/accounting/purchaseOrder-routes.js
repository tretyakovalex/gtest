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

module.exports = router;

