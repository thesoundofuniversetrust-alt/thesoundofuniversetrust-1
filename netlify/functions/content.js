/* ==========================================================================
   Netlify Function: content.js
   GET    /api/content?type=activities|services  → read content (public)
   POST   /api/content                           → upsert item  (auth required)
   DELETE /api/content?type=…&id=…              → delete item  (auth required)

   Storage: data/activities.json & data/services.json
   These files live in the repo and are read/written by this function.
   On Netlify the filesystem is read-only between deploys, so edits made
   via the admin persist for the lifetime of the function instance.
   For full persistence across deploys, the data files should be committed
   back to the repo (or use Netlify Blobs on a paid plan).
   ========================================================================== */
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

/* ---------- CORS / JSON helpers ---------- */
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(body) };
}

/* ---------- Session verification ---------- */
function verifySession(event) {
  const auth = (event.headers.authorization || '').replace('Bearer ', '');
  if (!auth) return false;
  const secret = process.env.SESSION_SECRET || 'local-dev-session-secret-32chars';
  try {
    const [payloadB64, hmac] = auth.split('.');
    const payload  = Buffer.from(payloadB64, 'base64url').toString();
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return false;
    const { role, exp } = JSON.parse(payload);
    return role === 'owner' && Date.now() < exp;
  } catch { return false; }
}

/* ---------- File paths ---------- */
// __dirname = netlify/functions/  →  go up two levels to repo root → data/
function dataFile(type) {
  return path.join(__dirname, '..', '..', 'data', type + '.json');
}

function readData(type) {
  try {
    const raw = fs.readFileSync(dataFile(type), 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeData(type, data) {
  try {
    fs.writeFileSync(dataFile(type), JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('writeData failed:', e.message);
    return false;
  }
}

/* ---------- handler ---------- */
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const params = event.queryStringParameters || {};
  const type   = params.type;

  /* ── GET (public) ── */
  if (event.httpMethod === 'GET') {
    if (!type || !['activities', 'services'].includes(type)) {
      return json(400, { error: 'type must be "activities" or "services"' });
    }
    return json(200, { data: readData(type) });
  }

  /* ── POST (upsert, auth required) ── */
  if (event.httpMethod === 'POST') {
    if (!verifySession(event)) return json(401, { error: 'Unauthorized' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

    const t    = body.type || type;
    const item = body.item;
    if (!t || !['activities', 'services'].includes(t)) return json(400, { error: 'Invalid type' });
    if (!item) return json(400, { error: 'item is required' });

    const data = readData(t);
    const idx  = data.findIndex(d => d.id === item.id);
    if (idx >= 0) {
      data[idx] = { ...data[idx], ...item };
    } else {
      if (!item.id) item.id = item.key || ('item-' + Date.now());
      data.push(item);
    }

    const saved = writeData(t, data);
    return json(200, { ok: true, saved, data });
  }

  /* ── DELETE (auth required) ── */
  if (event.httpMethod === 'DELETE') {
    if (!verifySession(event)) return json(401, { error: 'Unauthorized' });

    const t  = type;
    const id = params.id;
    if (!t || !id) return json(400, { error: 'type and id required' });

    const data    = readData(t);
    const updated = data.filter(d => d.id !== id);
    const saved   = writeData(t, updated);
    return json(200, { ok: true, saved, data: updated });
  }

  return json(405, { error: 'Method not allowed' });
};
