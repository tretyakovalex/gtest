const express = require('express');
const router = express.Router();

const { pool } = require('../configs/mysql');


// SELECT r.Sample_No FROM results r 
// LEFT JOIN gsa_certificate gc 
// ON r.Sample_No = gc.sample_no 
// WHERE gc.sample_no IS NULL;


router.get('/getResults', async (req, res) => {
    try {
        const result = req.body;
        
        pool.query('SELECT * FROM results', (err, result) => {
            res.json({results: result});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/getResultsNotInGsaCertificate', async (req, res) => {
    
    const query = `SELECT r.Sample_No FROM results r LEFT JOIN gsa_certificate gc ON r.Sample_No = gc.sample_no WHERE gc.sample_no IS NULL`;

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

router.get('/searchResults', async (req, res) => {
    try {
      const sampleNo = req.query.Sample_No;
      console.log(sampleNo);

      const resultsQuery = `SELECT * FROM results WHERE Sample_No = ?`;
      pool.query(resultsQuery, [sampleNo], async (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
          }

          if (result.length === 0) {
            return res.status(404).json('Sample number not found!');
          }
  
          res.status(200).json({ results: result });
        }
      );
    } catch (err) {
      console.error(err);
    }
});

router.post('/addResult', async (req, res) => {
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

        // Check if 'date_of_lab' is empty or not provided
        if (!data.hasOwnProperty('date_of_lab') || data.date_of_lab === '') {
            return res.status(400).send('Please enter the Date of Lab');
        }

        // Prepare the INSERT query dynamically based on available data
        const insertQuery = `
        INSERT INTO results
        (${columns.map(column => column === 'Lead' ? '`Lead`' : column).join(', ')})
        VALUES
        (${Array(columns.length).fill('?').join(', ')})
        `;

        // If sample_no doesn't exist, insert the data into results table
        pool.query(insertQuery, values, (error, results) => {
            if (error) {
                console.log(error);
                return res.status(500).send('Internal Server Error');
            }

            res.status(200).json('Successfully added data');
        })
        
    } catch (error) {
        console.error(error);
    }
});

router.put('/updateResult', async (req, res) => {
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

        const updateQuery = `
            UPDATE results
            SET ${columns.map(column => `${column === 'Lead' ? '`Lead`' : column} = ?`).join(', ')}
            WHERE Sample_No = ?
        `;

        pool.query(updateQuery, [...values, data.Sample_No], (error, results) => {
            if (error) {
                console.log(error);
                return res.status(500).send('Internal Server Error');
            }

            res.status(200).json('Successfully updated data');
        });
    } catch (error) {
        console.error(error);
    }
});

router.delete('/deleteResult/:Sample_No', async (req, res) => {
    try {
        const Sample_No = req.params.Sample_No;

        console.log(Sample_No);

        // Query to check if the sample number exists
        const checkQuery = `SELECT * FROM results WHERE Sample_No = ?`;

        // Execute the select query
        pool.query(checkQuery, [Sample_No], (error, results) => {
            if (error) {
                console.log(error);
                return res.status(500).send('Internal Server Error');
            }

            // Check if any rows were returned
            if (results.length === 0) {
                return res.status(404).send('No row found with the specified Sample_No');
            }

            // If the sample number exists, proceed with deletion
            // Query to delete the row with the specified Sample_No
            const deleteQuery = `DELETE FROM results WHERE Sample_No = ?`;

            // Execute the delete query
            pool.query(deleteQuery, [Sample_No], (error, results) => {
                if (error) {
                    console.log(error);
                    return res.status(500).send('Internal Server Error');
                }

                res.status(200).json(`Successfully deleted Result with Sample_No: ${Sample_No}`);
            });
        });

    } catch (error) {
        console.error(error);
    }
});


module.exports = router;