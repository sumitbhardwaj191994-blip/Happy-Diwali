'use strict';
/*
  Diya Wall server. No npm packages needed, just Node 18+.

    node server.js          -> http://localhost:3000

  Environment variables (all optional):
    PORT        port to listen on (hosts like Render set this for you)
    ADMIN_KEY   password for the moderation page /admin?key=...  (random if not set, printed at start)
    DATA_FILE   where wishes are saved (default ./wishes.json)
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(4).toString('hex');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'wishes.json');
const MAX_LEN = 100, MAX_NAME = 30, MAX_WISHES = 5000;
// Generous on purpose: a whole office shares one public IP, so this only stops scripts, not colleagues.
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT, 10) || 300, RATE_WINDOW_MS = 60 * 1000;

const zlib = require('zlib');
let INDEX = null, INDEX_GZ = null;
function loadIndex(){
  INDEX = fs.readFileSync(path.join(__dirname, 'index.html'));
  INDEX_GZ = zlib.gzipSync(INDEX, { level: 9 });
}
loadIndex();

const BLOCK = ['fuck','shit','bitch','bastard','asshole','cunt','slut','whore','chutiya','madarchod','behenchod','bhenchod','bsdk','gandu','harami','bhosdi','lawda','loda'];
function isClean(text){
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const squashed = words.join('');
  return !BLOCK.some(b => words.some(w => w === b || (b.length >= 4 && w.startsWith(b))) || (b.length >= 7 && squashed.includes(b)));
}

/* ---------- storage (memory + a JSON file so a restart doesn't lose wishes) ---------- */
let wishes = [];
let nextId = 1;
try {
  wishes = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  nextId = wishes.reduce((m, w) => Math.max(m, w.id), 0) + 1;
} catch (e) { /* first run */ }
let saveTimer;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.writeFile(DATA_FILE, JSON.stringify(wishes), () => {}), 500);
}

/* ---------- helpers ---------- */
const hits = new Map();
function limited(ip){
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  arr.push(now); hits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}
setInterval(() => { const now = Date.now(); for (const [ip, a] of hits) if (!a.some(t => now - t < RATE_WINDOW_MS)) hits.delete(ip); }, RATE_WINDOW_MS);

const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
function send(res, code, body, type){
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readJson(req){
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 4096) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function isAdmin(req, url){
  const given = String(req.headers['x-admin-key'] || url.searchParams.get('key') || '');
  const a = Buffer.from(given), b = Buffer.from(ADMIN_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const ADMIN_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diya Wall: moderation</title>
<style>
body{font-family:system-ui,Arial,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;background:#14081a;color:#fff4e0}
h1{font-size:22px} button{cursor:pointer;border-radius:8px;border:1px solid #f6b93b;background:transparent;color:#f6b93b;padding:6px 12px}
.row{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #3a2340}
.row small{color:#c9b2c6;display:block} .bar{display:flex;gap:12px;align-items:center;justify-content:space-between}
</style>
<h1>Diya Wall: moderation</h1>
<div class="bar"><span id="n">Loading…</span><button id="clear">Delete all wishes</button></div>
<div id="list"></div>
<script>
const key = new URLSearchParams(location.search).get('key') || '';
const H = { 'x-admin-key': key, 'Content-Type': 'application/json' };
async function load(){
  const r = await fetch('api/admin/list', { headers: H });
  if (!r.ok){ document.getElementById('n').textContent = 'Wrong or missing key.'; return; }
  const d = await r.json();
  document.getElementById('n').textContent = d.wishes.length + ' wishes';
  const list = document.getElementById('list'); list.textContent = '';
  d.wishes.slice().reverse().forEach(w => {
    const row = document.createElement('div'); row.className = 'row';
    const t = document.createElement('div'); t.textContent = w.text;
    const s = document.createElement('small'); s.textContent = (w.name || 'Anonymous') + ' · ' + new Date(w.ts).toLocaleTimeString(); t.appendChild(s);
    const b = document.createElement('button'); b.textContent = 'Delete';
    b.onclick = async () => { await fetch('api/admin/delete', { method:'POST', headers:H, body:JSON.stringify({ id:w.id }) }); load(); };
    row.append(t, b); list.appendChild(row);
  });
}
document.getElementById('clear').onclick = async () => {
  if (!confirm('Delete every wish? Use this to clear test wishes before the event.')) return;
  await fetch('api/admin/clear', { method:'POST', headers:H, body:'{}' }); load();
};
load(); setInterval(load, 5000);
</script>`;

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (req.method === 'GET' && (p === '/' || p === '/index.html')){
      if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')){
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
        return res.end(INDEX_GZ);
      }
      return send(res, 200, INDEX, 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && (p === '/api/health' || p === '/healthz')){
      return send(res, 200, { ok: true, wishes: wishes.length });
    }
    if (req.method === 'GET' && p === '/api/wishes'){
      const since = parseInt(url.searchParams.get('since'), 10) || 0;
      const out = wishes.filter(w => w.id > since).slice(0, 1000).map(w => ({ id: w.id, text: w.text, name: w.name }));
      return send(res, 200, { wishes: out, last: nextId - 1 });
    }
    if (req.method === 'POST' && p === '/api/wish'){
      if (limited(clientIp(req))) return send(res, 429, { error: 'Too many wishes just now. Please try again in a minute.' });
      let body; try { body = await readJson(req); } catch (e) { return send(res, 400, { error: 'Invalid request.' }); }
      const text = String(body.text || '').replace(/\s+/g, ' ').trim();
      const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
      if (!text) return send(res, 400, { error: 'Write a short wish first.' });
      if (text.length > MAX_LEN) return send(res, 400, { error: 'Please keep your wish under ' + MAX_LEN + ' characters.' });
      if (!isClean(text) || !isClean(name)) return send(res, 400, { error: 'Please keep your wish festive and friendly.' });
      const wish = { id: nextId++, text, name, ts: Date.now() };
      wishes.push(wish);
      if (wishes.length > MAX_WISHES) wishes.shift();
      save();
      return send(res, 200, { ok: true, id: wish.id });
    }
    if (req.method === 'GET' && p === '/admin') return send(res, 200, ADMIN_HTML, 'text/html; charset=utf-8');
    if (p.startsWith('/api/admin/')){
      if (!isAdmin(req, url)) return send(res, 401, { error: 'Unauthorized' });
      if (req.method === 'GET' && p === '/api/admin/list') return send(res, 200, { wishes });
      if (req.method === 'POST' && p === '/api/admin/delete'){
        const body = await readJson(req); wishes = wishes.filter(w => w.id !== body.id); save(); return send(res, 200, { ok: true });
      }
      if (req.method === 'POST' && p === '/api/admin/clear'){ wishes = []; save(); return send(res, 200, { ok: true }); }
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e); send(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log('\nDiya Wall is running');
  console.log('  Participants (QR)  : http://localhost:' + PORT + '/');
  console.log('  Main screen        : http://localhost:' + PORT + '/#screen');
  console.log('  Moderation         : http://localhost:' + PORT + '/admin?key=' + ADMIN_KEY + (process.env.ADMIN_KEY ? '' : '   (random key; set ADMIN_KEY to choose your own)') + '\n');
});
