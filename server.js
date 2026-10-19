const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initial clean schema
const defaultDB = {
  eku_crops: [],
  eku_orders: [],
  eku_users: [],
  eku_notes: [],
  eku_log: [],
  eku_cfg: {
    farmerSite: true,
    consumerSite: true,
    deliverySite: true,
    listing: true,
    ordering: true,
    banner: ""
  },
  eku_agents: []
};

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2));
      return defaultDB;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return Object.assign({}, defaultDB, JSON.parse(raw || '{}'));
  } catch (e) {
    console.error("DB Load Error:", e);
    return defaultDB;
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("DB Save Error:", e);
  }
}

let db = loadDB();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // 1. Fetch entire database for real-time mobile sync
  if (pathname === '/api/data' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db));
    return;
  }

  // 2. Save/Update records
  if (pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { key, value } = JSON.parse(body);
        if (key && value !== undefined) {
          db[key] = value;
          saveDB(db);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }
      } catch (err) {
        console.error(err);
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid payload' }));
    });
    return;
  }

  // 3. Reset database (Admin only)
  if (pathname === '/api/reset' && req.method === 'POST') {
    db = JSON.parse(JSON.stringify(defaultDB));
    saveDB(db);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Static File Serving
  let relativePath = pathname === '/' ? 'index.html' : pathname;
  let filePath = path.join(PUBLIC_DIR, relativePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Page Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`====================================================`);
  console.log(`🌾 E-Krishi-Udyog Central Engine Live on Port: ${PORT}`);
  console.log(`📱 Direct Mobile Access URL: http://${ip}:${PORT}`);
  console.log(`====================================================`);
});