const nodemailer = require('nodemailer');

require('dotenv').config();

const user = process.env.NODEMAIL_USER;
const pass = process.env.NODEMAIL_PASS
const transporter = nodemailer.createTransport({
    host: "mail.tawotin.com",
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    tls : { rejectUnauthorized: false },
    auth: {
      user: user,
      pass: pass,
    }
  });


module.exports = transporter;