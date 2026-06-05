import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Token cache — exchanged once per hour via /api/auth/supabase-token.
 *
 * Flow:
 *  1. Get the Clerk session token (no JWT template required).
 *  2. POST it to our Express server.
 *  3. Server creates a Supabase-compatible HS256 JWT signed with
 *     SUPABASE_JWT_SECRET and returns it.
 *  4. We inject it as Authorization: Bearer on every Supabase request
 *     so that RLS policies can read auth.jwt()->>'sub'.
 *
 * Required env var: SUPABASE_JWT_SECRET  (Supabase → Project Settings → API → JWT Secret)
 */
let _cachedToken  = null;
let _tokenExpires = 0;          // epoch ms

async function getSupabaseToken() {
  // Return cached token if still fresh (refresh 5 min before expiry)
  if (_cachedToken && Date.now() < _tokenExpires - 300_000) {
    return _cachedToken;
  }

  // Step 1: get Clerk session token (default — no custom template needed)
  let clerkToken = null;
  try {
    clerkToken = await window.Clerk?.session?.getToken();
  } catch {
    return null;      // Clerk not ready yet → fall back to anon
  }
  if (!clerkToken) return null;

  // Step 2: exchange for a Supabase JWT via our own server
  try {
    const res = await fetch('/api/auth/supabase-token', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${clerkToken}` },
    });
    if (!res.ok) return null;

    const { token } = await res.json();
    if (token) {
      _cachedToken  = token;
      _tokenExpires = Date.now() + 3_600_000;   // 1 hour
      return token;
    }
  } catch {
    // server not reachable → anon fallback
  }
  return null;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (url, options = {}) => {
      const token   = await getSupabaseToken();
      const headers = new Headers(options?.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(url, { ...options, headers });
    },
  },
});
