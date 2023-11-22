const express = require('express');
const router = express.Router();

const { pool } = require('../../configs/mysql');

router.get('/getLastRequisition', async (req, res) => {
    try {
        const query = `SELECT * FROM requisition_form ORDER BY id DESC LIMIT 1;`
        pool.query(query, (err, lastRequisitionForm) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({ lastRequisitionForm: lastRequisitionForm });
        })
    } catch (error) {
        console.error(error);
    }
});

router.post('/createRequisitionDocNum', async (req, res) => {
    try {
        const data = req.body;

        const requisitionForm = {
            document_number: data.document_number,
            created_at: data.created_at
        }

        const query = `INSERT INTO requisition_form SET ?`;

        pool.query(query, requisitionForm, (err, lastRequisitionForm) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            
            res.json({ lastRequisitionForm: lastRequisitionForm });
        })
    } catch (error) {
        console.error(error);
    }
});

router.post('/createRequisitionTable', async (req, res) => {
    try {
        const data = req.body;

        console.log(data);

        const insertQuery = `INSERT INTO requisition_items (personnel_id, requisition_form_id, item, quantity, description, approx_cost) VALUES (?, ?, ?, ?, ?, ?)`;

        const values = data.tableData.map((tableDataRow) => [
            data.personnel_id,
            data.requisition_form_id,
            tableDataRow.item,
            tableDataRow.quantity,
            tableDataRow.description,
            tableDataRow.approx_cost,
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

