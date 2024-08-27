// const WebSocket = require('ws');

// const wss = new WebSocket.Server({ port: 4300 });
// let clients = [];

// wss.on('connection', (ws) => {
//     console.log('Client connected');
//     clients.push(ws);

//     ws.on('close', () => {
//         console.log('Client disconnected');
//         clients = clients.filter(client => client !== ws);
//     });
// });

// const sendMessageForInvoiceComponent = (message) => {
//     clients.forEach(client => {
//         if (client.readyState === WebSocket.OPEN) {
//             client.send(message, { binary: true }, (err) => {
//                 if (err) console.error('Error sending message:', err);
//             });
//         }
//     });
// };

// module.exports = { sendMessageForInvoiceComponent };

// const WebSocket = require('ws');

// const wss = new WebSocket.Server({ port: 4300 });
// let clients = {};

// wss.on('connection', (ws) => {
//     console.log('Client connected');
//     const clientId = Math.random().toString(36).substr(2, 9);
//     clients[clientId] = ws;

//     ws.on('close', () => {
//         console.log('Client disconnected');
//         delete clients[clientId];
//     });
// });

// // Create a centralized message broadcasting function
// const broadcastMessage = (message, clientId) => {
//     console.log("printing client id from broadcaseMessage()");
//     if (clients[clientId]) {
//         console.log("Printing clients: ", clients[clientId]);
//         if (clients[clientId].readyState === WebSocket.OPEN) {
//             clients[clientId].send(message, { binary: true }, (err) => {
//                 if (err) console.error('Error sending message:', err);
//             });
//         }
//     }
// };

// module.exports = { broadcastMessage };

const WebSocket = require('ws');

// Create a separate WebSocket instance for each component
const invoiceComponentWs = new WebSocket.Server({ port: 4300 });
const certificateComponentWs = new WebSocket.Server({ port: 4301 });
const samplingCertificateComponentWs = new WebSocket.Server({ port: 4302 });

// Create arrays to store the clients for each component
let invoiceComponentClients = [];
let certificateComponentClients = [];

// Handle connections Invoices
invoiceComponentWs.on('connection', (ws) => {
    console.log('File Invoice client connected');
    invoiceComponentClients.push(ws);

    ws.on('close', () => {
        console.log('File Invoice client disconnected');
        invoiceComponentClients = invoiceComponentClients.filter(client => client !== ws);
    });
});

// A function to send messages for invoices
const sendMessageForInvoiceComponent = (message) => {
    invoiceComponentClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message, { binary: true }, (err) => {
                if (err) console.error('Error sending message:', err);
            });
        }
    });
};

// Handle connections Certificates
certificateComponentWs.on('connection', (ws) => {
    console.log('File Certificate client connected');
    certificateComponentClients.push(ws);

    ws.on('close', () => {
        console.log('File Certificate client disconnected');
        certificateComponentClients = certificateComponentClients.filter(client => client !== ws);
    });
});


// A function to send messages for certificates
const sendMessageForCertificateComponent = (message) => {
    certificateComponentClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message, { binary: true }, (err) => {
                if (err) console.error('Error sending message:', err);
            });
        }
    });
};

// Handle connections Sampling certificates
samplingCertificateComponentWs.on('connection', (ws) => {
    console.log('File Sampling Certificate client connected');
    certificateComponentClients.push(ws);

    ws.on('close', () => {
        console.log('File Sampling Certificate client disconnected');
        certificateComponentClients = certificateComponentClients.filter(client => client !== ws);
    });
});

 

// A function to send messages for certificates
const sendMessageForSamplingCertificateComponent = async (message) => {
    // let fileSize = await getFileSize();

    certificateComponentClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message, { binary: true }, (err) => {
                if (err) console.error('Error sending message:', err);
            });
        }
    });
};

module.exports = { sendMessageForInvoiceComponent, sendMessageForCertificateComponent, sendMessageForSamplingCertificateComponent };