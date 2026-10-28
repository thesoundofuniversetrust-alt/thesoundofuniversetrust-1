/* ==========================================================================
   Netlify Function: auth.js
   POST /api/auth  →  verify email+password, generate OTP, send via email
   ========================================================================== */
const crypto = require('crypto');

/* ---------- helpers ---------- */
function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function generateOtp() {
  // 6-digit cryptographically random OTP
  return String(crypto.randomInt(100000, 999999));
}

/* ---------- handler ---------- */
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

  const { email, password } = body;

  /* -------- Validate credentials -------- */
  const OWNER_EMAIL    = process.env.OWNER_EMAIL;
  const OWNER_PASSWORD = process.env.OWNER_PASSWORD;

  if (!OWNER_EMAIL || !OWNER_PASSWORD) {
    console.error('OWNER_EMAIL / OWNER_PASSWORD env vars not set');
    return json(500, { error: 'Server configuration error' });
  }

  if (!email || !password) return json(400, { error: 'Email and password are required' });

  // constant-time comparison to prevent timing attacks
  const emailMatch    = crypto.timingSafeEqual(Buffer.from(email.trim().toLowerCase()), Buffer.from(OWNER_EMAIL.trim().toLowerCase()));
  const passwordMatch = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(OWNER_PASSWORD));

  if (!emailMatch || !passwordMatch) {
    return json(401, { error: 'Invalid email or password' });
  }

  /* -------- Generate OTP and store in KV / env fallback -------- */
  const otp     = generateOtp();
  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Store OTP in a signed, time-limited token so we don't need a DB.
  // We'll embed  otp + expiry + HMAC into a base64 blob sent back to the
  // client as an opaque "session token" the verify function checks.
  const secret  = process.env.OTP_SECRET || 'tsu-otp-secret-change-me';
  const payload = `${otp}|${expires}`;
  const hmac    = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token   = Buffer.from(`${payload}|${hmac}`).toString('base64url');

  /* -------- Send OTP email via Resend (or log in dev) -------- */
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: [OWNER_EMAIL],
          subject: 'Your TSU Dashboard login code',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2 style="color:#212C5C">Your one-time login code</h2>
              <p style="font-size:16px;color:#4A5170">Use this code to sign in to the TSU Owner Dashboard. It expires in <strong>10 minutes</strong>.</p>
              <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#CE2A7A;text-align:center;padding:24px;background:#FBF8EE;border-radius:12px;margin:24px 0">
                ${otp}
              </div>
              <p style="font-size:13px;color:#888">If you did not request this, please ignore this email.</p>
            </div>`,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('Resend error:', err);
      }
    } catch (e) {
      console.error('Email send failed:', e);
      // Don't fail the request — OTP is still usable in dev/logs
    }
  } else {
    // Dev mode — log the OTP
    console.log(`[DEV] OTP for ${email}: ${otp}`);
  }

  return json(200, { token, maskedEmail: email.replace(/(.{2}).+(@.+)/, '$1***$2') });
};
