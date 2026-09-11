const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_CLIENTS = 2;

const clients = new Map();
let nextUserNumber = 1;

const wss = new WebSocket.Server({
  port: PORT
});

console.log('Chat server listening on ws://localhost:' + PORT);

function generateUserId() {
  const id = 'user-' + nextUserNumber;
  nextUserNumber += 1;
  return id;
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function getOtherClient(ws) {
  for (const client of clients.keys()) {
    if (client !== ws) {
      return client;
    }
  }

  return null;
}

function broadcastStatus() {
  const connected = clients.size === MAX_CLIENTS;

  for (const entry of clients) {
    const ws = entry[0];
    const info = entry[1];

    send(ws, {
      type: 'status',
      connected: connected,
      userId: info.id
    });
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

    ws.close(1008, 'Room full');

    console.log('Rejected connection: room already has 2 users.');
    return;
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
    let text = '';

    try {
      const parsed = JSON.parse(data.toString());

      if (parsed && typeof parsed.text === 'string') {
        text = parsed.text;
      }
    } catch (error) {
      text = data.toString();
    }

    if (!text.trim()) {
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
  });

  ws.on('close', function () {
    const info = clients.get(ws);

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
  });

  ws.on('error', function (error) {
    console.error(
      'WebSocket error for ' +
      userId +
      ': ' +
      error.message
    );
  });
});

const heartbeatInterval = setInterval(function () {
  for (const entry of clients) {
    const ws = entry[0];
    const info = entry[1];

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
  }
}, 30000);

wss.on('close', function () {
  clearInterval(heartbeatInterval);
});
