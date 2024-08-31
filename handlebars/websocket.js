const WebSocket = require('ws');

// Create a separate WebSocket instance for each component
const invoiceComponentWs = new WebSocket.Server({ port: 4300 });
const certificateComponentWs = new WebSocket.Server({ port: 4301 });
const samplingCertificateComponentWs = new WebSocket.Server({ port: 4302 });

// Create arrays to store the clients for each component
let invoiceComponentClients = [];
let certificateComponentClients = [];

// Handle connections Invoices
invoiceComponentWs.on('connection', (ws, req) => {
    console.log('File Invoice client connected');
    
    const params = new URLSearchParams(req.url.split('?')[1]);
    const clientId = params.get('clientId');
    
    invoiceComponentClients.push({clientId: clientId, ws});

    ws.on('close', () => {
        console.log('File Invoice client disconnected');
        invoiceComponentClients = invoiceComponentClients.filter(client => client !== ws);
    });
});

// A function to send messages for invoices
const sendMessageForInvoiceComponent = (message, clientId) => {
    // invoiceComponentClients.forEach(client => {
    //     if (client.readyState === WebSocket.OPEN) {
    //         client.send(message, { binary: true }, (err) => {
    //             if (err) console.error('Error sending message:', err);
    //         });
    //     }
    // });

    const client = invoiceComponentClients.find(client => client.clientId === clientId)
    if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message, { binary: true }, (err) => {
            if (err) console.error('Error sending message:', err);
        });
    } else {
        console.log(`Client with ID ${clientId} not found or connection is closed for Invoice ws.`)
    }
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
samplingCertificateComponentWs.on('connection', (ws, req) => {
    console.log('File Sampling Certificate client connected');

    const params = new URLSearchParams(req.url.split('?')[1]);
    const clientId = params.get('clientId');

    certificateComponentClients.push({clientId: clientId, ws});

    ws.on('close', () => {
        console.log('File Sampling Certificate client disconnected');
        certificateComponentClients = certificateComponentClients.filter(client => client !== ws);
    });
});

// A function to send messages for certificates
const sendMessageForSamplingCertificateComponent = async (message, clientId) => {
    // certificateComponentClients.forEach(client => {
    //     if (client.readyState === WebSocket.OPEN) {
    //         client.send(message, { binary: true }, (err) => {
    //             if (err) console.error('Error sending message:', err);
    //         });
    //     }
    // });
    const client = certificateComponentClients.find(client => client.clientId === clientId)
    if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message, { binary: true }, (err) => {
            if (err) console.error('Error sending message:', err);
        });
    } else {
        console.log(`Client with ID ${clientId} not found or connection is closed for Certificate ws.`)
    }
};



module.exports = { sendMessageForInvoiceComponent, sendMessageForCertificateComponent, sendMessageForSamplingCertificateComponent };

// const WebSocket = require('ws');
// const fs = require('fs');
// const path = require('path');

// // Create a separate WebSocket instance for each component
// const invoiceComponentWs = new WebSocket.Server({ port: 4300 });
// const certificateComponentWs = new WebSocket.Server({ port: 4301 });
// const samplingCertificateComponentWs = new WebSocket.Server({ port: 4302 });

// // Create arrays to store the clients for each component
// let invoiceComponentClients = [];
// let certificateComponentClients = [];
// let samplingCertificateComponentClients = [];

// // Handle connections Invoices
// invoiceComponentWs.on('connection', (ws, req) => {
//     console.log('File Invoice client connected');
    
//     const params = new URLSearchParams(req.url.split('?')[1]);
//     const clientId = params.get('clientId');

//     invoiceComponentClients.push({clientId: clientId, ws});

//     // // Simulate file transfer
//     // const filePath = path.join(__dirname, 'gsa-invoices', 'GSA-Invoice-W-2024-00360_v9.pdf'); // Path to your file
//     // const fileSize = fs.statSync(filePath).size; // Total file size in bytes
//     // const chunkSize = 1024 * 64; // 64 KB chunk size
//     // let bytesSent = 0;

//     // const readStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });

//     // readStream.on('data', (chunk) => {
//     //     if (ws.readyState === WebSocket.OPEN) {
//     //         bytesSent += chunk.length;
//     //         const progress = Math.min(100, (bytesSent / fileSize) * 100);
//     //         ws.send(JSON.stringify({ type: 'progress', value: progress }));

//     //         // Send chunk to client
//     //         ws.send(chunk, { binary: true }, (err) => {
//     //             if (err) console.error('Error sending chunk:', err);
//     //         });
//     //     }
//     // });

//     // readStream.on('end', () => {
//     //     if (ws.readyState === WebSocket.OPEN) {
//     //         ws.send(JSON.stringify({ type: 'complete', message: 'Processing complete!' }));
//     //         ws.close();
//     //     }
//     // });

//     ws.on('close', () => {
//         console.log('File Invoice client disconnected');
//         invoiceComponentClients = invoiceComponentClients.filter(client => client.clientId !== clientId);
//     });
// });

// // A function to send messages for invoices
// const sendMessageForInvoiceComponent = (message, clientId) => {

//     const client = invoiceComponentClients.find(client => client.clientId === clientId);
//     if (client && client.ws.readyState === WebSocket.OPEN) {
//         client.ws.send(message, { binary: true }, (err) => {
//             if (err) console.error('Error sending message:', err);
//         });
//     } else {
//         console.log(`Client with ID ${clientId} not found or connection is closed for Invoice ws.`);
//     }
// };

// // Handle connections Certificates
// certificateComponentWs.on('connection', (ws, req) => {
//     console.log('File Certificate client connected');

//     const params = new URLSearchParams(req.url.split('?')[1]);
//     const clientId = params.get('clientId');

//     certificateComponentClients.push({clientId: clientId, ws});

//     ws.on('close', () => {
//         console.log('File Certificate client disconnected');
//         certificateComponentClients = certificateComponentClients.filter(client => client.clientId !== clientId);
//     });
// });


// // A function to send messages for certificates
// const sendMessageForCertificateComponent = (message, clientId) => {
//     const client = certificateComponentClients.find(client => client.clientId === clientId)
//     if (client && client.ws.readyState === WebSocket.OPEN) {
//         client.ws.send(message, { binary: true }, (err) => {
//             if (err) console.error('Error sending message:', err);
//         });
//     } else {
//         console.log(`Client with ID ${clientId} not found or connection is closed for Certificate ws.`)
//     }
// };

// // Handle connections Sampling certificates
// samplingCertificateComponentWs.on('connection', (ws, req) => {
//     console.log('File Sampling Certificate client connected');

//     const params = new URLSearchParams(req.url.split('?')[1]);
//     const clientId = params.get('clientId');

//     console.log("Printing clientId inside samplingCertificateComponentWs.on(): ", clientId);

//     samplingCertificateComponentClients.push({clientId: clientId, ws});

//     ws.on('close', () => {
//         console.log('File Sampling Certificate client disconnected');
//         samplingCertificateComponentClients = samplingCertificateComponentClients.filter(client => client.clientId !== clientId);
//     });
// });

// // A function to send messages for certificates
// const sendMessageForSamplingCertificateComponent = async (message, clientId) => {
//     console.log("Printing clientId inside sendMessageForSamplingCertificateComponent: ", clientId);
//     const client = samplingCertificateComponentClients.find(client => client.clientId === clientId);
//     if (client && client.ws.readyState === WebSocket.OPEN) {
//         client.ws.send(message, { binary: true }, (err) => {
//             if (err) console.error('Error sending message:', err);
//         });
//     } else {
//         console.log(`Client with ID ${clientId} not found or connection is closed for Sampling Certificate ws.`);
//     }
// };


// module.exports = { sendMessageForInvoiceComponent, sendMessageForCertificateComponent, sendMessageForSamplingCertificateComponent };