/**
 * server.js
 * Minimal 1-to-1 WebSocket relay chat server.
 *
 * - Accepts exactly two connected clients at a time.
 * - Assigns each connected client a simple unique user ID.
 * - Relays any text message received from one client to the other.
 * - Handles connect, disconnect, and message events.
 *
 * No database, no auth, no voice/video/WebRTC — plain text relay only.
 */

const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_CLIENTS = 2;

// clients: Map<WebSocket, { id: string }>
const clients = new Map();
let nextUserNumber = 1;

const wss = new WebSocketServer({ port: PORT });

console.log(`Chat server listening on ws://localhost:${PORT}`);

function generateUserId() {
  const id = `user-${nextUserNumber}`;
  nextUserNumber += 1;
  return id;
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function getOtherClient(ws) {
  for (const [clientWs] of clients) {
    if (clientWs !== ws) return clientWs;
  }
  return null;
}

function broadcastStatus() {
  const bothConnected = clients.size === MAX_CLIENTS;
  for (const [clientWs, info] of clients) {
    send(clientWs, {
      type: 'status',
      connected: bothConnected,
      userId: info.id
    });
  }
}

wss.on('connection', (ws) => {
  // Reject extra connections beyond the 2-user limit.
  if (clients.size >= MAX_CLIENTS) {
    send(ws, { type: 'error', message: 'Chat room is full (2 users max).' });
    ws.close(1008, 'Room full');
    console.log('Rejected connection: room already has 2 users.');
    return;
  }

  const userId = generateUserId();
  clients.set(ws, { id: userId });
  console.log(`Client connected: ${userId} (${clients.size}/${MAX_CLIENTS})`);

  // Tell this client its assigned ID.
  send(ws, { type: 'welcome', userId });

  // Update both clients on connection status (e.g. "waiting" vs "connected").
  broadcastStatus();

  ws.on('message', (data) => {
    let text;
    try {
      // Accept either raw text or a JSON envelope like { type: 'message', text: '...' }
      const parsed = JSON.parse(data.toString());
      text = typeof parsed.text === 'string' ? parsed.text : null;
    } catch {
      text = data.toString();
    }

    if (!text || !text.trim()) return;

    const sender = clients.get(ws);
    const other = getOtherClient(ws);

    console.log(`Message from ${sender.id}: ${text}`);

    if (other) {
      send(other, {
        type: 'message',
        from: sender.id,
        text,
        timestamp: Date.now()
      });
    }
    // If no other client is connected yet, the message is simply not relayed.
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    clients.delete(ws);
    console.log(`Client disconnected: ${info ? info.id : 'unknown'} (${clients.size}/${MAX_CLIENTS})`);

    // Let the remaining client know their peer left.
    const remaining = getOtherClient(ws) || [...clients.keys()][0];
    if (remaining) {
      send(remaining, { type: 'peer-disconnected' });
    }
    broadcastStatus();
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for ${userId}:`, err.message);
  });
});
