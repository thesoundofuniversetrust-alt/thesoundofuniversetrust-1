/* ==========================================================================
   Netlify Function: verify-otp.js
   POST /api/verify-otp  →  verify token + OTP, return a session JWT
   ========================================================================== */
const crypto = require('crypto');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

  const { token, otp } = body;
  if (!token || !otp) return json(400, { error: 'token and otp are required' });

  const secret = process.env.OTP_SECRET || 'tsu-otp-secret-change-me';

  /* -------- Decode and verify token -------- */
  let storedOtp, expires, hmac;
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const parts   = decoded.split('|');
    if (parts.length !== 3) throw new Error('bad format');
    [storedOtp, expires, hmac] = parts;
  } catch {
    return json(400, { error: 'Invalid token' });
  }

  // Verify HMAC
  const payload      = `${storedOtp}|${expires}`;
  const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const hmacValid    = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));

  if (!hmacValid) return json(401, { error: 'Invalid token' });
  if (Date.now() > Number(expires)) return json(401, { error: 'OTP has expired. Please request a new one.' });

  // Constant-time OTP compare (pad to same length to avoid timing leak)
  const submittedOtp = String(otp).replace(/\s/g, '').padStart(6, '0');
  const storedOtpPad = storedOtp.padStart(6, '0');
  if (submittedOtp.length !== 6 || storedOtpPad.length !== 6) {
    return json(401, { error: 'Invalid OTP' });
  }
  const otpValid = crypto.timingSafeEqual(Buffer.from(submittedOtp), Buffer.from(storedOtpPad));
  if (!otpValid) return json(401, { error: 'Incorrect OTP' });

  /* -------- Issue a session JWT (simple HS256-like token) -------- */
  const sessionSecret  = process.env.SESSION_SECRET || 'tsu-session-secret-change-me';
  const sessionPayload = JSON.stringify({ role: 'owner', iat: Date.now(), exp: Date.now() + 8 * 60 * 60 * 1000 }); // 8h
  const sessionHmac    = crypto.createHmac('sha256', sessionSecret).update(sessionPayload).digest('hex');
  const sessionToken   = Buffer.from(sessionPayload).toString('base64url') + '.' + sessionHmac;

  return json(200, { sessionToken });
};
