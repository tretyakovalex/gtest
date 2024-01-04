const express = require('express');
const router = express.Router();

const { pool } = require('../../configs/mysql');

router.get('/api/get-databases', async (req, res) => {
    try {
        pool.query('SHOW DATABASES', (err, results) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            const excludedDatabases = ['information_schema', 'mysql', 'performance_schema', 'sn', 'ta', 'wo3'];

            const databases = results.map((result) => result.Database).filter((db) => !excludedDatabases.includes(db));

            res.json({ databases: databases });
        })
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;