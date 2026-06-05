/**
 * /api/auth/supabase-token
 *
 * Exchange a Clerk session token for a Supabase-compatible JWT.
 * This lets us bypass the need for a Clerk "supabase" JWT template —
 * our own server creates the JWT signed with SUPABASE_JWT_SECRET.
 *
 * The generated JWT has the same claims Supabase RLS expects:
 *   auth.jwt()->>'sub'  ←→  the Clerk user ID
 *   role = 'authenticated'
 */

import express from 'express';
import { createHmac } from 'node:crypto';

const router = express.Router();

// ── helpers ────────────────────────────────────────────────────

/** URL-safe base64 encode */
function b64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** Decode JWT payload without verifying signature */
function decodePayload(token) {
  try {
    const part = token.split('.')[1];
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/** Create a Supabase-compatible HS256 JWT */
function createSupabaseJwt(userId) {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set in .env');

  const now     = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    sub:  userId,
    role: 'authenticated',
    aud:  'authenticated',
    iat:  now,
    exp:  now + 3600,        // valid 1 hour
  }));

  const sig = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${header}.${payload}.${sig}`;
}

// ── route ─────────────────────────────────────────────────────

/**
 * POST /api/auth/supabase-token
 * Headers: Authorization: Bearer <clerk-session-token>
 * Returns: { token: <supabase-jwt> }
 */
router.post('/supabase-token', (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? '';
    const clerkToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!clerkToken) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    // Decode Clerk JWT to extract sub (Clerk user ID)
    const decoded = decodePayload(clerkToken);
    const userId  = decoded?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Could not extract user ID from token' });
    }

    const supabaseToken = createSupabaseJwt(userId);
    console.log('[auth/supabase-token] ✅ token created for user:', userId);
    res.json({ token: supabaseToken });

  } catch (err) {
    console.error('[auth/supabase-token]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
