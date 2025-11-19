// Minimal express backend for Observify (persistent JSON store)
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'events.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let store = { events: [] };
try { if (fs.existsSync(DATA_FILE)) store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e){ console.warn('load failed', e); }

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors({ origin: '*' }));
app.use(express.json({ limit:'1mb' }));

// backend/src/index.js (patch for /ingest)
app.post('/ingest', (req, res) => {
  const body = req.body;
  if (!body) return res.status(400).json({ error: 'no body' });

  // events could be in body.events (batch) or body itself (single)
  const evs = Array.isArray(body.events) ? body.events : (body.events ? body.events : [body]);

  const cleaned = evs.map((ev, idx) => {
    // if ev is null/undefined, replace with placeholder
    if (!ev || (typeof ev === 'object' && Object.keys(ev).length === 0)) {
      return { type: 'unknown', note: 'empty-event', originalIndex: idx, ts: Date.now() };
    }
    // if ev is not a POJO (e.g., an ErrorEvent), try to extract known fields
    if (ev instanceof Error) {
      return { type: 'error', message: ev.message || String(ev), stack: ev.stack || null, ts: Date.now() };
    }
    // otherwise keep as-is but ensure it has a ts
    return Object.assign({ ts: Date.now() }, ev);
  });

  for (const ev of cleaned) store.events.push(ev);

  // persist (best-effort)
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2)); } catch (e) { console.warn('Failed to persist events', e); }

  console.log(`Ingested ${cleaned.length} events (cleaned). Sample:`, cleaned.slice(-4));
  res.json({ ok: true, total: store.events.length });
});


app.get('/errors', (req, res) => {
  const errors = store.events.filter(e=> e.type === 'error' || e.type === 'rejection').slice(-200);
  res.json(errors.reverse());
});
app.get('/metrics', (req, res) => {
  const perf = store.events.filter(e=> ['performance','perf','network','network-error'].includes(e.type)).slice(-500);
  res.json(perf.reverse());
});
app.get('/', (req,res)=> res.send('Observify minimal backend'));

app.listen(PORT, ()=> console.log('Observify backend listening on http://localhost:'+PORT));
