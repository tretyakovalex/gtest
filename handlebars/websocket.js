const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 4300 });
let clients = [];

wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.push(ws);

    ws.on('close', () => {
        console.log('Client disconnected');
        clients = clients.filter(client => client !== ws);
    });
});

const sendMessageToClients = (message) => {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message, { binary: true }, (err) => {
                if (err) console.error('Error sending message:', err);
            });
        }
    });
};

module.exports = { sendMessageToClients };