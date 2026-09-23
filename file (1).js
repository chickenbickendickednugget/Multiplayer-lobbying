const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '8kb' }));

const rooms = new Map();          // room -> array of messages
const MAX_PER_ROOM = 50;
const TTL_MS = 5 * 60 * 1000;

const lastSend = new Map();       // ip -> timestamp
function rateLimited(ip) {
  const now = Date.now();
  if (now - (lastSend.get(ip) || 0) < 300) return true;
  lastSend.set(ip, now);
  return false;
}

app.post('/send', (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'slow down' });

  const room = String(req.body.room || '').slice(0, 32);
  const sender = String(req.body.sender || 'anon').slice(0, 24);
  const text = String(req.body.text || '').slice(0, 200);
  if (!room || !text) return res.status(400).json({ error: 'bad request' });

  const list = rooms.get(room) || [];
  list.push({ sender, text, at: Date.now() });
  rooms.set(room, list.slice(-MAX_PER_ROOM));
  res.json({ ok: true });
});

app.get('/messages', (req, res) => {
  const room = String(req.query.room || '').slice(0, 32);
  const cutoff = Date.now() - TTL_MS;
  const list = (rooms.get(room) || []).filter(m => m.at > cutoff);
  rooms.set(room, list);
  res.json({ messages: list.map(({ sender, text }) => ({ sender, text })) });
});

app.listen(process.env.PORT || 3000);
