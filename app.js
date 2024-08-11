const express = require('express');
const app = express();
const cors = require('cors')
const path = require('path');
const bodyParser = require('body-parser');

const PORT = process.env.PORT || 4000;

app.use(express.json());

// Middleware setup
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// === Routes: ===
// ===============

app.use(require('./routes/gsa-sampling/gsaSamplingCertificate-routes.js'));

app.use(require('./routes/accounting/invoice-routes'));

app.use(require('./routes/registration-routes'));
app.use(require('./routes/result-routes'));
app.use(require('./routes/customer-routes'));
app.use(require('./routes/element-routes'));
app.use(require('./routes/gsaCertificate-routes'));
app.use(require('./routes/compound-routes'));
app.use(require('./routes/price-routes'));
app.use(require('./routes/method-routes'));
app.use(require('./routes/wspContract-routes'));

app.use(require('./routes/getCertificate-route'));
// app.use(require('./routes/mysql-routes'));
app.use(require('./routes/user-routes'));
app.use(require('./routes/uploadImages'));

// Accounting routes:
app.use(require('./routes/accounting/admin-export-routes'));
app.use(require('./routes/accounting/personnel-routes'));
app.use(require('./routes/accounting/requisition-routes'));
app.use(require('./routes/accounting/purchaseOrder-routes'));
app.use(require('./routes/accounting/service-prices-routes'));

// Admin routes:
app.use(require('./routes/admin/select-database-route'));
app.use(require('./routes/admin/get-databases-routes.js'));

// === Frontend: ===
// =================

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// === Server: ===
// ===============

app.listen(PORT, () => {
    console.log(`listening on port: ${PORT}`)
});
