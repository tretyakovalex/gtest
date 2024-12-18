const express = require('express');
const router = express.Router();

const moment = require('moment-timezone');

const { pool } = require('../configs/mysql');

const fs = require('fs-extra');
const path = require('path');

const { generateSamplingContract } = require('./gsa-sampling/generateSamplingContract.js');

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
        INSERT INTO registration
        (${columns.map(column => column === 'Lead' ? '`Lead`' : column).join(', ')})
        VALUES
        (${Array(columns.length).fill('?').join(', ')})
        `;

        pool.query(insertQuery, values, async (error, results) => {
            if (error) {
                console.log(error);
                return res.status(500).send('Internal Server Error');
            }
            // res.status(200).json('successfully added result to DB');

            let samplingContract = await generateSamplingContract(data);
            console.log("Printing file name for samplingContract: ", samplingContract);
            res.download(samplingContract);

        })
    } catch (error) {
        console.error(error);
    }
});

router.get('/getSampleNoAndCustomerSampleName', async (req, res) => {
    const query = `SELECT Sample_No, Customer_sample_name, year FROM registration ORDER BY Sample_No DESC;`;

    pool.query(query, (err, registration) => {
        if(err){
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        res.json({registrationData: registration});
    })
})

// router.get('/getRegistrationsNotInResults', async (req, res) => {
    
//     const query = `SELECT r2.Sample_No FROM registration r2 LEFT JOIN results r ON r2.Sample_No = r.Sample_No WHERE r.Sample_No IS NULL`;

//     try {
//         pool.query(query, (err, sample_no) => {
//             if(err){
//                 console.error(err);
//                 return res.status(500).send('Internal Server Error');
//             }
        
//             res.json({ sample_nums: sample_no });
//         })
//     } catch (error) {
//         console.error(error);
//     }
// });
router.get('/getRegistrationsNotInResultsByYear', async (req, res) => {
    const year = req.query.year;
    // const query = `SELECT r2.Sample_No FROM registration r2 LEFT JOIN results r ON r2.Sample_No = r.Sample_No WHERE r.Sample_No IS NULL AND r2.year = ${year}`; // Old query without considering duplicate sample numbers but with different years
    const query = `SELECT reg.Sample_No FROM registration reg LEFT JOIN results res ON reg.Sample_No = res.Sample_No AND reg.year = res.year WHERE res.Sample_No IS NULL AND reg.year = ${year};`;

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

router.get('/getRegistrations', async (req, res) => {
    try {
        pool.query('SELECT * FROM registration', (err, registration) => {
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
        
        const query = `SELECT * FROM registration WHERE Sample_No = ?`;
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
        const year = req.query.year;
        let query = ``;
        if(year){
            query = `SELECT * FROM registration WHERE Sample_No = (SELECT MAX(Sample_No) FROM registration WHERE year = ${year}) AND year = ${year};`;
        } else if(!year){
            query = `SELECT * FROM registration WHERE Sample_No = (SELECT MAX(Sample_No) FROM registration);`;
        }
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

// Getting min max years:
router.get('/getMinMaxYearForRegistration', async (req, res) => {
    try {
        pool.query('SELECT MIN(YEAR(Date)) AS min_year, MAX(YEAR(Date)) AS max_year FROM registration;', (err, data) => {
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


router.post('/searchRegistration', async (req, res) => {
    try {
        const registration = req.body;
        console.log("registration sample_no: ", registration.Sample_No);
        console.log("registration year: ", registration.year);

        // Check if sample_no exists in ** registration ** table
        const checkRegistrationQuery = `SELECT sample_no FROM registration WHERE sample_no = ?`;
        pool.query(checkRegistrationQuery, [registration.Sample_No], (selectErrorRegistration2, selectResultsRegistration2) => {
            if (selectErrorRegistration2) {
                console.log(selectErrorRegistration2);
                return res.status(500).send('Internal Server Error');
            }

            if (selectResultsRegistration2.length === 0) {
                // If sample_no doesn't exist in registration table, return an error message
                return res.status(404).json('Sample number not Registered!');
            }

            // Check if sample_no exists in ** Results ** table
            const checkResultsQuery = `SELECT sample_no FROM results WHERE sample_no = ${registration.Sample_No} AND year = ${registration.year}`;
            pool.query(checkResultsQuery, (selectError, selectResults) => {
                if (selectError) {
                    console.log(selectError);
                    return res.status(500).send('Internal Server Error');
                }

                if (selectResults.length > 0) {
                    // If sample_no already exists, return an error message
                    return res.status(400).json('Data for this sample number already filled in');
                }

                let query = `SELECT * FROM registration WHERE Sample_No = ${registration.Sample_No} AND year = ${registration.year} AND Sample_No NOT IN (SELECT Sample_No FROM results where year = ${registration.year});`;
                // pool.query('SELECT * FROM registration WHERE Sample_No = ? AND Sample_No NOT IN (SELECT Sample_No FROM results)', [registration.Sample_No], async (err, result) => {
                pool.query(query, async (err, result) => {
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

router.get('/selectRegistrationBySampleNo', async (req, res) => {
    const sample_no = req.query.Sample_No;
    const year = req.query.year;

    let query = `SELECT * FROM registration WHERE Sample_No = ${sample_no} AND year = ${year}`
    try {
        pool.query(query, async (err, results) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            const processedResults = results.map(row => {
                for (let key in row) {
                  if (Buffer.isBuffer(row[key])) {
                    row[key] = row[key][0] === 1;
                  }
                }
                return row;
              });
        
            res.json({ registration: processedResults });
        })
    } catch (err) {
        console.error(err)
    }
});


router.get('/getRegistrationSampleNumbers', async (req, res) => {
    try {
        const year = req.query.year;
        const query = `SELECT Sample_No, year FROM registration WHERE year = ${year} ORDER BY Sample_No DESC;`;
        
        pool.query(query, async (err, results) => {
            if(err){
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }
        
            res.json({ Sample_No: results });
        })
    } catch (err) {
        console.error(err)
    }
});

router.put('/updateRegistration', async (req, res) => {
    try {
        const rawData = req.body;

        let data = rawData.reqObject;

        // Logging data and reason
        console.log("Printing rawData.reasonObject: ", rawData.reasonObject);
        writeReasonToLogFile(rawData.reasonObject);

        // const query = `UPDATE registration SET ? WHERE Sample_No=?`;
        const query = `UPDATE registration SET ? WHERE Sample_No = ${data.Sample_No} AND year = ${data.year}`;

        console.log(data);

        pool.query(query, [data, data.Sample_No], async (err, purchase) => {
            if (err) {
                console.error(err);
                return res.status(500).json({"error": "Internal Server Error"});
            }

            // res.json("Registration was successfully updated!");

            let samplingContract = await generateSamplingContract(data);
            console.log("Printing file name for samplingContract: ", samplingContract);
            res.download(samplingContract);
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({"error": "Internal Server Error"});
    }
});

// Saving updated results to log file
async function writeReasonToLogFile(reasonObject){
    let logFileLocation = path.join(__dirname, "..", "logs", "modified-registration-logs", "modified-registration-logs");
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