const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { networkInterfaces } = require('os');
const crypto = require('crypto');

const SCHEDULE_FILE = path.join(__dirname, 'schedule.json');
const VIDEO_DIR     = path.join(__dirname, 'video');

// ── Default schedule ──────────────────────────────────────────────────────────
const DEFAULT_SCHEDULE = {
  channels: [
    { id: 1, name: 'TVP 1',    color: '#e63030' },
    { id: 2, name: 'TVP 2',    color: '#2060e8' },
    { id: 3, name: 'Polsat',   color: '#e8a020' },
    { id: 4, name: 'TVN',      color: '#e83060' },
    { id: 5, name: 'TV Puls',  color: '#22aa44' },
    { id: 6, name: 'TVP Info', color: '#8822cc' },
  ],
  entries: [],
};

function loadSchedule() {
  try { return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8')); }
  catch { return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE)); }
}

function saveSchedule(data) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function uid() { return crypto.randomBytes(6).toString('hex'); }

function sendJSON(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ── API handler ───────────────────────────────────────────────────────────────
function handleAPI(req, res) {
  const url      = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  const method   = req.method;

  // GET /api/schedule
  if (method === 'GET' && pathname === '/api/schedule') {
    return sendJSON(res, loadSchedule());
  }

  // GET /api/videos
  if (method === 'GET' && pathname === '/api/videos') {
    const exts = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi']);
    const files = fs.readdirSync(VIDEO_DIR).filter(f => exts.has(path.extname(f).toLowerCase()));
    return sendJSON(res, files);
  }

  // POST /api/upload  (raw binary, X-Filename header)
  if (method === 'POST' && pathname === '/api/upload') {
    let filename = '';
    try { filename = decodeURIComponent(req.headers['x-filename'] || 'video.mp4'); } catch { filename = 'video.mp4'; }
    filename = path.basename(filename).replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ._\- ]/g, '_');
    const dest = path.join(VIDEO_DIR, filename);
    const ws2  = fs.createWriteStream(dest);
    req.pipe(ws2);
    ws2.on('finish', () => sendJSON(res, { ok: true, file: filename }));
    ws2.on('error',  err => sendJSON(res, { error: err.message }, 500));
    return;
  }

  // POST /api/channels
  if (method === 'POST' && pathname === '/api/channels') {
    readBody(req).then(buf => {
      const data  = JSON.parse(buf.toString());
      const sched = loadSchedule();
      const maxId = sched.channels.reduce((m, c) => Math.max(m, c.id), 0);
      const ch    = { id: maxId + 1, name: data.name || 'Nowy kanał', color: data.color || '#888888' };
      sched.channels.push(ch);
      saveSchedule(sched);
      broadcast({ type: 'schedule', data: sched });
      sendJSON(res, ch, 201);
    });
    return;
  }

  // PUT /api/channels/:id
  if (method === 'PUT' && pathname.startsWith('/api/channels/')) {
    const id = parseInt(pathname.split('/').pop());
    readBody(req).then(buf => {
      const data  = JSON.parse(buf.toString());
      const sched = loadSchedule();
      const ch    = sched.channels.find(c => c.id === id);
      if (!ch) return sendJSON(res, { error: 'Not found' }, 404);
      if (data.name  !== undefined) ch.name  = data.name;
      if (data.color !== undefined) ch.color = data.color;
      saveSchedule(sched);
      broadcast({ type: 'schedule', data: sched });
      sendJSON(res, ch);
    });
    return;
  }

  // DELETE /api/channels/:id
  if (method === 'DELETE' && pathname.startsWith('/api/channels/')) {
    const id    = parseInt(pathname.split('/').pop());
    const sched = loadSchedule();
    sched.channels = sched.channels.filter(c => c.id !== id);
    sched.entries  = sched.entries.filter(e => e.channelId !== id);
    saveSchedule(sched);
    broadcast({ type: 'schedule', data: sched });
    return sendJSON(res, { ok: true });
  }

  // POST /api/entries
  if (method === 'POST' && pathname === '/api/entries') {
    readBody(req).then(buf => {
      const data  = JSON.parse(buf.toString());
      const sched = loadSchedule();
      const entry = {
        id:        uid(),
        channelId: data.channelId,
        days:      data.days || [0,1,2,3,4,5,6],
        startTime: data.startTime,
        endTime:   data.endTime,
        title:     data.title     || '',
        videoFile: data.videoFile || '',
      };
      sched.entries.push(entry);
      saveSchedule(sched);
      broadcast({ type: 'schedule', data: sched });
      sendJSON(res, entry, 201);
    });
    return;
  }

  // PUT /api/entries/:id
  if (method === 'PUT' && pathname.startsWith('/api/entries/')) {
    const id = pathname.split('/').pop();
    readBody(req).then(buf => {
      const data  = JSON.parse(buf.toString());
      const sched = loadSchedule();
      const entry = sched.entries.find(e => e.id === id);
      if (!entry) return sendJSON(res, { error: 'Not found' }, 404);
      Object.assign(entry, data);
      entry.id = id;
      saveSchedule(sched);
      broadcast({ type: 'schedule', data: sched });
      sendJSON(res, entry);
    });
    return;
  }

  // DELETE /api/entries/:id
  if (method === 'DELETE' && pathname.startsWith('/api/entries/')) {
    const id    = pathname.split('/').pop();
    const sched = loadSchedule();
    sched.entries = sched.entries.filter(e => e.id !== id);
    saveSchedule(sched);
    broadcast({ type: 'schedule', data: sched });
    return sendJSON(res, { ok: true });
  }

  sendJSON(res, { error: 'Not found' }, 404);
}

// ── MIME ──────────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
  '.ico':  'image/x-icon',
};

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url.startsWith('/api/')) return handleAPI(req, res);

  const reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let filePath = path.join(__dirname, reqPath === '/' ? 'index.html' : reqPath);
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }

    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    if (req.headers.range && mime.startsWith('video/')) {
      const { size }          = stat;
      const [startStr, endStr] = req.headers.range.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : size - 1;
      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${size}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': end - start + 1,
        'Content-Type':   mime,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
const wss     = new WebSocketServer({ server });
const clients = new Set();

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const c of clients) if (c.readyState === 1) c.send(msg);
}

wss.on('connection', ws => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'schedule', data: loadSchedule() }));
  ws.on('close', () => clients.delete(ws));
  ws.on('message', msg => {
    for (const c of clients) if (c !== ws && c.readyState === 1) c.send(msg.toString());
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  const nets = networkInterfaces();
  const ips  = [];
  for (const ifaces of Object.values(nets))
    for (const i of ifaces)
      if (i.family === 'IPv4' && !i.internal) ips.push(i.address);

  console.log('\n══════════════════════════════════════════');
  console.log('  OKIŁ VHS Player — serwer lokalny');
  console.log('══════════════════════════════════════════');
  console.log(`  Odtwarzacz:  http://localhost:${PORT}`);
  console.log(`  Ramówka:     http://localhost:${PORT}/admin.html`);
  ips.forEach(ip => {
    console.log(`  Pilot (tel): http://${ip}:${PORT}/remote.html`);
  });
  console.log('══════════════════════════════════════════\n');
});
