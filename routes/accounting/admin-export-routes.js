const express = require('express');
const router = express.Router();

const { pool } = require('../../configs/mysql');


router.get('/getPurchaseOrderExport', async (req, res) => {
    try {
        const query = `SELECT poi.order_item_id, poi.personnel_id, poi.items, poi.quantity, poi.unit_price, poi.total_price, poi.total_price_vat, poi.purchase_order_form_id, pof.created_at FROM purchase_order_items AS poi INNER JOIN purchase_order_form AS pof ON poi.purchase_order_form_id = pof.id;`;

        pool.query(query, (err, exportPurchaseOrder) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ exportPurchaseOrders: exportPurchaseOrder });
        })
    } catch (error) {
        console.error(error);
    }
});


module.exports = router;