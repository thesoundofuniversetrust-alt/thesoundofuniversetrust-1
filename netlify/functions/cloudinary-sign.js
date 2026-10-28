/* ==========================================================================
   Netlify Function: cloudinary-sign.js
   POST /api/cloudinary-sign  →  return a signed upload params object
   so the browser can upload directly to Cloudinary without exposing the secret.
   ========================================================================== */
const crypto = require('crypto');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
    body: JSON.stringify(body),
  };
}

function verifySession(event) {
  const auth   = (event.headers.authorization || '').replace('Bearer ', '');
  if (!auth) return false;
  const secret = process.env.SESSION_SECRET || 'tsu-session-secret-change-me';
  try {
    const [payloadB64, hmac] = auth.split('.');
    const payload    = Buffer.from(payloadB64, 'base64url').toString();
    const expected   = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return false;
    const { role, exp } = JSON.parse(payload);
    return role === 'owner' && Date.now() < exp;
  } catch { return false; }
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!verifySession(event)) return json(401, { error: 'Unauthorized' });

  const CLOUD_NAME   = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY      = process.env.CLOUDINARY_API_KEY;
  const API_SECRET   = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return json(500, { error: 'Cloudinary env vars not configured' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

  const folder    = body.folder || 'tsu-website';
  const timestamp = Math.floor(Date.now() / 1000);

  // Build the string-to-sign
  // Cloudinary signature: SHA1 of sorted key=value pairs + api_secret
  const paramsToSign = { folder, timestamp };
  const sortedStr = Object.keys(paramsToSign)
    .sort()
    .map(k => `${k}=${paramsToSign[k]}`)
    .join('&');

  const signature = crypto
    .createHash('sha1')
    .update(sortedStr + API_SECRET)
    .digest('hex');

  return json(200, {
    cloudName:  CLOUD_NAME,
    apiKey:     API_KEY,
    timestamp,
    folder,
    signature,
  });
};
