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

module.exports = router;

