/**
 * Transcriptions API
 *  - YouTube  → free, via youtube-transcript (captions scrape)
 *  - Instagram → OpenAI Whisper ($0.006/min), audio via yt-dlp
 *
 * Supabase table (run once):
 * ─────────────────────────────────────────────────────────────
 *  create table transcriptions (
 *    id         uuid primary key default gen_random_uuid(),
 *    user_id    text not null,
 *    platform   text not null default 'youtube',
 *    source_url text not null,
 *    transcript text,
 *    status     text not null default 'complete',
 *    created_at timestamptz default now()
 *  );
 *  alter table transcriptions enable row level security;
 *  create policy "open" on transcriptions
 *    for all using (true) with check (true);
 * ─────────────────────────────────────────────────────────────
 */

import { Router }       from 'express';
import { exec }         from 'child_process';
import { promisify }    from 'util';
import { createReadStream } from 'fs';
import { unlink, access } from 'fs/promises';
import os               from 'os';
import path             from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI           from 'openai';

const router    = Router();
const execAsync = promisify(exec);

// ── Clients ───────────────────────────────────────────────────
const supabase = process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const YT_DLP = process.env.YT_DLP_PATH || 'yt-dlp';

// ── Platform detection ────────────────────────────────────────
function detectPlatform(url) {
  if (/instagram\.com/.test(url))        return 'instagram';
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  return null;
}

// ── YouTube: extract video ID ─────────────────────────────────
function extractYoutubeId(url) {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

// ── YouTube: transcribe via Apify pintostudio/youtube-transcript-scraper ──
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_BASE  = 'https://api.apify.com/v2';
const YT_ACTOR_ID = 'pintostudio/youtube-transcript-scraper';

async function transcribeYoutube(url) {
  if (!extractYoutubeId(url)) throw new Error('קישור YouTube לא תקין');
  if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN חסר ב-.env');

  const res = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(YT_ACTOR_ID)}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: url }),
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Apify שגיאה ${res.status}: ${txt.slice(0, 200)}`);
  }

  const items = await res.json();

  if (!Array.isArray(items) || items.length === 0)
    throw new Error('לא נמצאו כתוביות לסרטון הזה — ייתכן שהן מושבתות');

  const first = items[0];

  // { transcript: "full text" }
  if (typeof first?.transcript === 'string' && first.transcript.trim())
    return first.transcript.trim();

  // { transcript: [{text, start, dur}, ...] }
  if (Array.isArray(first?.transcript))
    return first.transcript.map(s => s.text ?? '').filter(Boolean).join(' ');

  // flat array [{text?, start, dur}, ...] — pintostudio format
  if (Array.isArray(items) && items.some(i => i.text))
    return items.map(i => i.text ?? '').filter(Boolean).join(' ');

  // string array
  if (typeof first === 'string')
    return items.join(' ');

  throw new Error(`פורמט לא צפוי מ-Apify: ${JSON.stringify(first).slice(0, 200)}`);
}

// ── Instagram: download audio + Whisper ──────────────────────
// No ffmpeg needed — download native format (m4a/webm), Whisper accepts both
const AUDIO_EXTS = ['m4a', 'webm', 'mp4', 'opus', 'ogg', 'mp3'];

async function transcribeInstagram(url) {
  if (!openai) throw new Error('OPENAI_API_KEY חסר ב-.env');

  const tmpBase = path.join(os.tmpdir(), `reel-${Date.now()}`);

  try {
    // 1. Download best audio in native format (no --audio-format = no ffmpeg needed)
    await execAsync(
      `"${YT_DLP}" -x -o "${tmpBase}.%(ext)s" "${url}"`,
      { timeout: 90_000 }
    );

    // 2. Find whichever file was created
    let audioPath = null;
    for (const ext of AUDIO_EXTS) {
      try { await access(`${tmpBase}.${ext}`); audioPath = `${tmpBase}.${ext}`; break; }
      catch {}
    }
    if (!audioPath) throw new Error('הקובץ לא הורד — ודא שהפרופיל פומבי ונסה שוב');

    // 3. Transcribe with Whisper
    const response = await openai.audio.transcriptions.create({
      file:  createReadStream(audioPath),
      model: 'whisper-1',
    });

    return response.text;
  } finally {
    // 4. Clean up all possible temp files
    AUDIO_EXTS.forEach(ext => unlink(`${tmpBase}.${ext}`).catch(() => {}));
  }
}

// ── Save to Supabase ──────────────────────────────────────────
async function saveRow(payload) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('transcriptions')
    .insert(payload)
    .select()
    .single();
  return data;
}

// ── POST /api/transcriptions ──────────────────────────────────
router.post('/', async (req, res) => {
  const { url = '', userId } = req.body;
  if (!url.trim() || !userId)
    return res.status(400).json({ error: 'נדרש url ו-userId' });

  const platform = detectPlatform(url.trim());
  if (!platform)
    return res.status(400).json({ error: 'קישור לא מזוהה — תומך ב-YouTube ואינסטגרם' });

  try {
    const transcript = platform === 'instagram'
      ? await transcribeInstagram(url.trim())
      : await transcribeYoutube(url.trim());

    const payload = { user_id: userId, platform, source_url: url.trim(), status: 'complete', transcript };
    const saved   = await saveRow(payload);

    return res.json({
      data: saved ?? { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload },
    });
  } catch (err) {
    const errMsg  = err.message || 'שגיאה בתמלול';
    const payload = { user_id: userId, platform: platform ?? 'unknown', source_url: url.trim(), status: 'error', transcript: errMsg };
    const saved   = await saveRow(payload);

    return res.json({
      data:  saved ?? { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload },
      error: errMsg,
    });
  }
});

// ── GET /api/transcriptions?userId=... ───────────────────────
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId)   return res.status(400).json({ error: 'חסר userId' });
  if (!supabase) return res.json({ data: [] });

  const { data, error } = await supabase
    .from('transcriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
});

// ── POST /api/transcriptions/:id/analyze ─────────────────────
// Requires `analysis text` column in the transcriptions table:
//   ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS analysis text;
router.post('/:id/analyze', async (req, res) => {
  if (!openai)   return res.status(400).json({ error: 'OPENAI_API_KEY חסר ב-.env' });
  if (!supabase) return res.status(400).json({ error: 'Supabase לא מוגדר' });

  // Fetch transcript (+ cached analysis if exists)
  const { data: row, error: fetchErr } = await supabase
    .from('transcriptions')
    .select('transcript, analysis')
    .eq('id', req.params.id)
    .single();

  if (fetchErr || !row)  return res.status(404).json({ error: 'תמלול לא נמצא' });
  if (!row.transcript)   return res.status(400).json({ error: 'אין תמלול לניתוח' });

  // Return cached analysis (free, instant)
  if (row.analysis) return res.json({ analysis: row.analysis });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: `אתה מומחה אסטרטגיית תוכן ליוצרים עצמאיים.
נתח את תמלול הסרטון וספק תשובה מסודרת עם שלושה חלקים בדיוק:

## סיכום
2-3 משפטים תמציתיים על הנושא המרכזי של הסרטון.

## הוקים ומסרים מרכזיים
- רשום 3-5 נקודות מפתח שהדובר הדגיש

## רעיונות לתוכן בהשראת הסרטון
- רשום 4-5 רעיונות קונקרטיים לפוסטים / רילס / סרטונים

ענה בעברית. היה תמציתי, מעשי וישיר.`,
        },
        {
          role: 'user',
          content: row.transcript.slice(0, 8000),
        },
      ],
    });

    const analysis = completion.choices[0].message.content;

    // Cache in Supabase
    await supabase
      .from('transcriptions')
      .update({ analysis })
      .eq('id', req.params.id);

    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/transcriptions/:id ───────────────────────────
router.delete('/:id', async (req, res) => {
  if (!supabase) return res.json({ success: true });
  const { error } = await supabase.from('transcriptions').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
