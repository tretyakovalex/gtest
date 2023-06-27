// const { PrismaClient } = require('@prisma/client');
// const prisma = new PrismaClient();

// const express = require('express');
// const router = express.Router();

// router.get('/getCustomers', async (req, res) => {
//     try {
//         let customers = await prisma.customers.findMany();
//         res.json({customers: customers});
//     } catch (error) {
//         console.error(error);
//     }
// });

// router.get('/getResults', async (req, res) => {
//     try {
        
//         let results = await prisma.results.findMany();
//         res.json({results: results});
//     } catch (error) {
//         console.error(error);
//     }
// });

// router.get('/getRegistrations', async (req, res) => {
//     try {
//         let registrations = await prisma.registrations.findMany();
//         res.json({registrations: registrations});
//     } catch (error) {
//         console.error(error);
//     }
// });

// router.get('/getPrices', async (req, res) => {
//     try {
//         let prices = await prisma.prices.findMany();
//         res.json({prices: prices});
//     } catch (error) {
//         console.error(error);
//     }
// });


// module.exports = router;