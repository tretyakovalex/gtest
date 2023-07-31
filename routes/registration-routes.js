const express = require('express');
const router = express.Router();

const moment = require('moment-timezone');

const { pool } = require('../configs/mysql');

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
});

router.get('/getRegistrationsNotInResults', async (req, res) => {
    
    const query = `SELECT r2.Sample_No FROM registration2 r2 LEFT JOIN results r ON r2.Sample_No = r.Sample_No WHERE r.Sample_No IS NULL`;

    try {
        pool.query(query, (err, sample_no) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
        
            res.json({ sample_nums: sample_no });
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

            const formattedResults = registration.map(row => {
                const dateWithoutTimezone = moment.utc(row.Date).format('YYYY-MM-DD');
                return { ...row, Date: dateWithoutTimezone };
            });
        
            res.json({ registrations: formattedResults });
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/getSampleNoRegistration', async (req, res) => {
    try {
        const sampleNo = req.query.Sample_No;
        console.log(sampleNo);
        
        const query = `SELECT * FROM registration2 WHERE Sample_No = ?`;
        pool.query(query, [sampleNo], async (err, registration) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
            const formattedResults = registration.map(row => {
                const dateWithoutTimezone = moment.utc(row.Date).format('YYYY-MM-DD');
                return { ...row, Date: dateWithoutTimezone };
            });
        
            res.json({ registrations: formattedResults });
        })
        
    } catch (error) {
        console.error(error);
    }
})

router.get('/getLastRegistration', async (req, res) => {
    try {
        const query = `SELECT * FROM registration2 WHERE Sample_No = (SELECT MAX(Sample_No) FROM registration2);`;
        pool.query(query, async (err, registration) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            if (registration.length === 0) {
                return res.status(404).json('Sample number not found!');
            }

            const formattedResults = registration.map(row => {
                const dateWithoutTimezone = moment.utc(row.Date).format('YYYY-MM-DD');
                return { ...row, Date: dateWithoutTimezone };
            });
        
            res.json({ registrations: formattedResults });
        })
    } catch (err) {
        console.error(err)
    }
});


router.post('/searchRegistration', async (req, res) => {
    try {
        const registration = req.body;
        console.log(registration.Sample_No);

        // Check if sample_no exists in ** registration2 ** table
        const checkRegistrationQuery = `SELECT sample_no FROM registration2 WHERE sample_no = ?`;
        pool.query(checkRegistrationQuery, [registration.Sample_No], (selectErrorRegistration2, selectResultsRegistration2) => {
            if (selectErrorRegistration2) {
                console.log(selectErrorRegistration2);
                return res.status(500).send('Internal Server Error');
            }

            if (selectResultsRegistration2.length === 0) {
                // If sample_no doesn't exist in registration2 table, return an error message
                return res.status(404).json('Sample number not Registered!');
            }

            // Check if sample_no exists in ** Results ** table
            const checkResultsQuery = `SELECT sample_no FROM results WHERE sample_no = ?`;
            pool.query(checkResultsQuery, [registration.Sample_No], (selectError, selectResults) => {
                if (selectError) {
                    console.log(selectError);
                    return res.status(500).send('Internal Server Error');
                }

                if (selectResults.length > 0) {
                    // If sample_no already exists, return an error message
                    return res.status(400).json('Data for this sample number already filled in');
                }

                pool.query('SELECT * FROM registration2 WHERE Sample_No = ? AND Sample_No NOT IN (SELECT Sample_No FROM results)', [registration.Sample_No], async (err, result) => {
                    if(err){
                        console.error(err);
                        return res.status(500).send('Internal Server Error');
                    }
                    
                    res.status(200).json({ registrations: result });
                })

            });
        });
        
    } catch (err) {
        console.error(err)
    }
});


module.exports = router;