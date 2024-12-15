const express = require('express');
const router = express.Router();

const { pool } = require('../configs/mysql');

const fs = require('fs-extra');
const path = require('path');

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

router.get('/getResultsByYear', async (req, res) => {
    try {
        const year = req.query.year;
        pool.query(`SELECT * FROM results where year = ${year}`, (err, result) => {
            res.json({results: result});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/getResultToEditByYear', async (req, res) => {
    try {
        const sample_no = req.query.sample_no;
        const year = req.query.year;

        pool.query(`SELECT * FROM results WHERE sample_no = ${sample_no} AND year = ${year}`, (err, result) => {
            res.json({results: result});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/getResultsNotInGsaCertificate', async (req, res) => {
    const year = req.query.year;
    let query = ``;
    if(year){
        query = `SELECT r.Sample_No FROM results r LEFT JOIN gsa_certificate gc ON r.Sample_No = gc.sample_no AND r.year = gc.year WHERE gc.sample_no IS NULL AND r.year=${year}`;
    } else if (!year){
        query = `SELECT r.Sample_No FROM results r LEFT JOIN gsa_certificate gc ON r.Sample_No = gc.sample_no WHERE gc.sample_no IS NULL`;
    }

    console.log("Printing query for getResultsNotInGsaCertificate: ", query);

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

router.get('/getSampleNumbersForResultsByYear', async (req, res) => {
    const year = req.query.year;    
    const query = `SELECT Sample_No from results where year = ${year}`;

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
});

// Getting min max years:
router.get('/getMinMaxYearForResults', async (req, res) => {
    try {
        pool.query('SELECT MIN(YEAR(date_of_lab)) AS min_year, MAX(YEAR(date_of_lab)) AS max_year FROM results;', (err, data) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            res.json({minMaxYears: data});
        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/searchResults', async (req, res) => {
    try {
      const sample_no = req.query.sample_no;
      const year = req.query.year;
      console.log(sample_no);
      console.log(year);

      const resultsQuery = `SELECT * FROM results WHERE Sample_No = ${sample_no} AND year = ${year}`;
      pool.query(resultsQuery, async (err, result) => {
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
        // const data = req.body;
        
        const rawData = req.body;
        // Splitting raw data to select reqObject, the other part of rawData is reasonObject
        // Save reasonObject to file to keep track of changes
        const data = rawData.reqObject;

        console.log("Printing data:");
        console.log(data);

        // Logging data and reason
        console.log("Printing rawData.reasonObject: ", rawData.reasonObject);
        writeReasonToLogFile(rawData.reasonObject);
        
        console.log("Printing rawData.reasonObject.elements: ", rawData.reasonObject.originalResult.elements);
        writeReasonToLogFile(rawData.reasonObject.originalResult.elements);

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
            WHERE Sample_No = ? AND year = ?
        `;

        pool.query(updateQuery, [...values, data.Sample_No, data.year], (error, results) => {
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


// Saving updated results to log file
async function writeReasonToLogFile(reasonObject){
    let logFileLocation = path.join(__dirname, "..", "logs", "modified-results-logs", "modified-result-logs");
    const jsonString = JSON.stringify(reasonObject, null, 2);

    fs.appendFile(logFileLocation, jsonString + '\n', (err) => {
        if (err) {
          console.error('Error appending to file', err);
        } else {
          console.log('Successfully appended to file');
        }
    });
    // fs.writeFileSync(logFileLocation, jsonString);
}


module.exports = router;