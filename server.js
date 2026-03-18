const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { networkInterfaces } = require('os');

// ── HTTP server ───────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

  // Blokuj wyjście poza katalog projektu
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end(); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }

    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    // Range requests dla wideo
    if (req.headers.range && mime.startsWith('video/')) {
      const { size } = stat;
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

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));

  // Przekaż komendę od pilota do wszystkich klientów (player)
  ws.on('message', msg => {
    for (const c of clients) {
      if (c !== ws && c.readyState === 1) c.send(msg.toString());
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  // Znajdź lokalne IP (WiFi / BT PAN)
  const nets = networkInterfaces();
  const ips  = [];
  for (const ifaces of Object.values(nets)) {
    for (const i of ifaces) {
      if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
    }
  }

  console.log('\n══════════════════════════════════════════');
  console.log('  OKIŁ VHS Player — serwer lokalny');
  console.log('══════════════════════════════════════════');
  console.log(`  Odtwarzacz:  http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(`  Pilot (tel): http://${ip}:${PORT}/remote.html`);
  });
  console.log('══════════════════════════════════════════\n');
});
