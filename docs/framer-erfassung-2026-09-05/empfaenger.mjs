import http from 'node:http';
import fs from 'node:fs';
const dir = new URL('./dumps/', import.meta.url).pathname;
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const u = new URL(req.url, 'http://x');
  const name = (u.searchParams.get('name') || 'dump').replace(/[^a-zA-Z0-9_-]/g, '_');
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => { fs.writeFileSync(dir + name + '.txt', body); res.end('ok ' + body.length); });
}).listen(8899, '127.0.0.1');
