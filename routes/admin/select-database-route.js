const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const { pool, setDatabaseName } = require('../../configs/mysql');

const databaseConfigPath = path.join(__dirname, '../../configs/databaseConfig.json')

router.post('/api/select-database', async (req, res) => {
    const newDatabaseName = req.body.databaseName;

    if (newDatabaseName) {
        console.log(newDatabaseName);
        // setDatabaseName(newDatabaseName);
        fs.writeFileSync(databaseConfigPath, JSON.stringify({ 'selectedDatabase': newDatabaseName }));
        res.json({ success: true, message: 'Database selected successfully' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid database name' });
    }
});

router.get('/api/selected-database', async (req, res) => {
    try {
        pool.query('SELECT DATABASE()', (err, results) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            // The result will contain the name of the currently selected database
            const currentDatabase = results[0]['DATABASE()'];
            console.log(currentDatabase);

            res.json({ currentDatabase: currentDatabase });
        })
    } catch (error) {
        console.error(error);
    }
})

module.exports = router;