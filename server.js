/**

* server.js
* Minimal 1-to-1 WebSocket relay chat server.
*
* * Accepts exactly two connected clients at a time.
* * Assigns each connected client a simple unique user ID.
* * Relays text messages between the two clients.
* * Detects stale/dead WebSocket connections.
*
* No database, no auth, no voice/video/WebRTC.
  */

const WebSocketServer = require('ws').WebSocketServer;

const PORT = process.env.PORT || 8080;
const MAX_CLIENTS = 2;

const clients = new Map();
let nextUserNumber = 1;

const wss = new WebSocketServer({ port: PORT });

console.log('Chat server listening on ws://localhost:' + PORT);

function generateUserId() {
const id = 'user-' + nextUserNumber;
nextUserNumber += 1;
return id;
}

function send(ws, payload) {
if (ws.readyState === ws.OPEN) {
ws.send(JSON.stringify(payload));
}
}

function getOtherClient(ws) {
for (const clientWs of clients.keys()) {
if (clientWs !== ws) {
return clientWs;
}
}

return null;
}

function broadcastStatus() {
const bothConnected = clients.size === MAX_CLIENTS;

for (const entry of clients) {
const clientWs = entry[0];
const info = entry[1];

```
send(clientWs, {
  type: 'status',
  connected: bothConnected,
  userId: info.id
});
```

}
}

wss.on('connection', function (ws) {
ws.isAlive = true;

ws.on('pong', function () {
ws.isAlive = true;
});

if (clients.size >= MAX_CLIENTS) {
send(ws, {
type: 'error',
message: 'Chat room is full (2 users max).'
});

```
ws.close(1008, 'Room full');

console.log('Rejected connection: room already has 2 users.');
return;
```

}

const userId = generateUserId();

clients.set(ws, {
id: userId
});

console.log(
'Client connected: ' +
userId +
' (' +
clients.size +
'/' +
MAX_CLIENTS +
')'
);

send(ws, {
type: 'welcome',
userId: userId
});

broadcastStatus();

ws.on('message', function (data) {
let text;

```
try {
  const parsed = JSON.parse(data.toString());

  if (typeof parsed.text === 'string') {
    text = parsed.text;
  } else {
    text = null;
  }
} catch (error) {
  text = data.toString();
}

if (!text || !text.trim()) {
  return;
}

const sender = clients.get(ws);

if (!sender) {
  return;
}

const other = getOtherClient(ws);

console.log(
  'Message from ' +
  sender.id +
  ': ' +
  text
);

if (other) {
  send(other, {
    type: 'message',
    from: sender.id,
    text: text,
    timestamp: Date.now()
  });
}
```

});

ws.on('close', function () {
const info = clients.get(ws);

```
clients.delete(ws);

console.log(
  'Client disconnected: ' +
  (info ? info.id : 'unknown') +
  ' (' +
  clients.size +
  '/' +
  MAX_CLIENTS +
  ')'
);

const remaining = Array.from(clients.keys())[0];

if (remaining) {
  send(remaining, {
    type: 'peer-disconnected'
  });
}

broadcastStatus();
```

});

ws.on('error', function (err) {
console.error(
'WebSocket error for ' +
userId +
': ' +
err.message
);
});
});

const heartbeatInterval = setInterval(function () {
for (const entry of clients) {
const ws = entry[0];
const info = entry[1];

```
if (ws.isAlive === false) {
  console.log(
    'Terminating stale connection: ' +
    info.id
  );

  ws.terminate();
  continue;
}

ws.isAlive = false;
ws.ping();
```

}
}, 30000);

wss.on('close', function () {
clearInterval(heartbeatInterval);
});
