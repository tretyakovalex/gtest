const express = require('express');
const router = express.Router();

const { pool } = require('../configs/mysql');


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


module.exports = router;