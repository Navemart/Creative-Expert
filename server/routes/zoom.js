import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const router  = express.Router();
const __dir   = dirname(fileURLToPath(import.meta.url));
const META_FILE = join(__dir, '..', 'data', 'zoom-meta.json');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

// ── Metadata helpers — Supabase (with file fallback for seeding) ──
async function readMeta() {
  const { data, error } = await supabase.from('zoom_meta').select('*');
  if (error || !data) {
    // fallback: read from file (for seeding / local dev without Supabase)
    if (!existsSync(META_FILE)) return {};
    try { return JSON.parse(readFileSync(META_FILE, 'utf8')); }
    catch { return {}; }
  }
  // Convert rows array → { uuid: { custom_title, attachments, ... } }
  const map = {};
  for (const row of data) {
    const { uuid, ...rest } = row;
    map[uuid] = rest;
  }
  return map;
}

async function upsertMeta(uuid, updates) {
  const { error } = await supabase.from('zoom_meta').upsert(
    { uuid, ...updates, updated_at: new Date().toISOString() },
    { onConflict: 'uuid' }
  );
  return !error;
}

// ── Zoom Server-to-Server OAuth token ────────────────────────
async function getZoomToken() {
  const accountId    = process.env.ZOOM_ACCOUNT_ID;
  const clientId     = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Zoom credentials not configured');
  }

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const data = await res.json();
  if (!data.access_token) throw new Error(data.reason || 'Failed to get Zoom token');
  return data.access_token;
}

// ── Phonetic name matching ────────────────────────────────────
const HEBREW_LATIN = {
  'א':'', 'ב':'b', 'ג':'g', 'ד':'d', 'ה':'h', 'ו':'o',
  'ז':'z', 'ח':'h', 'ט':'t', 'י':'i', 'כ':'k', 'ך':'k',
  'ל':'l', 'מ':'m', 'ם':'m', 'נ':'n', 'ן':'n', 'ס':'s',
  'ע':'', 'פ':'p', 'ף':'f', 'צ':'ts','ץ':'ts','ק':'k',
  'ר':'r', 'ש':'sh','ת':'t',
};
function translitHebrew(w) {
  return w.split('').map(c => HEBREW_LATIN[c] !== undefined ? HEBREW_LATIN[c] : c).join('').toLowerCase();
}
function soundex(w) {
  const CODES = { b:1,f:1,p:1,v:1, c:2,g:2,j:2,k:2,q:2,s:2,x:2,z:2, d:3,t:3, l:4, m:5,n:5, r:6 };
  const s = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return '';
  let code = s[0].toUpperCase(), prev = CODES[s[0]] || 0;
  for (let i = 1; i < s.length && code.length < 4; i++) {
    const c = CODES[s[i]];
    if (c && c !== prev) code += c;
    prev = c || 0;
  }
  return code.padEnd(4, '0');
}
// Returns a match function for a student given their name and email
function buildParticipantMatcher(name, email) {
  const emailLow   = (email || '').toLowerCase();
  const nameParts  = (name || '').toLowerCase().split(/\s+/).filter(w => w.length > 1);
  // Soundex codes: try original word + transliterated (for Hebrew→English)
  const studentSx  = [...new Set(nameParts.flatMap(p => [soundex(p), soundex(translitHebrew(p))]).filter(Boolean))];

  return function match(p) {
    const pEmail = (p.user_email || '').toLowerCase();
    const pName  = (p.name || '').toLowerCase();

    if (emailLow && pEmail === emailLow) return true;
    for (const part of nameParts) if (pName.includes(part)) return true;

    // Phonetic: compare Soundex of each participant word against student codes
    const pWords = pName.split(/\s+/).filter(w => w.length > 1);
    for (const pw of pWords) {
      if (studentSx.includes(soundex(pw))) return true;
    }
    return false;
  };
}

// ── Resolve which user to query ───────────────────────────────
function getZoomUser() {
  return process.env.ZOOM_USER_EMAIL || 'me';
}

// ── Fetch one month of recordings ────────────────────────────
async function fetchMonthRecordings(token, userId, from, to) {
  const res = await fetch(
    `https://api.zoom.us/v2/users/${userId}/recordings?from=${from}&to=${to}&page_size=300`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.meetings || [];
}

// ── GET /api/zoom/recordings ─────────────────────────────────
router.get('/recordings', async (req, res) => {
  try {
    const token  = await getZoomToken();
    const userId = getZoomUser();
    const allMeetings = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const toDate   = new Date(now);
      toDate.setMonth(toDate.getMonth() - i);
      const fromDate = new Date(toDate);
      fromDate.setMonth(fromDate.getMonth() - 1);
      const from = fromDate.toISOString().slice(0, 10);
      const to   = toDate.toISOString().slice(0, 10);
      const meetings = await fetchMonthRecordings(token, userId, from, to);
      allMeetings.push(...meetings);
    }

    // Filter: topic must contain "פגישה שבועית" (exact 2-word phrase) OR "מעבדת היכולות"
    //         AND date is 2026+ or December 2025
    const RELEVANT_TOPICS = ['פגישה שבועית', 'מעבדת היכולות'];
    const filtered = allMeetings.filter(m => {
      if (!m.topic) return false;
      if (!RELEVANT_TOPICS.some(t => m.topic.includes(t))) return false;
      const d     = new Date(m.start_time);
      const year  = d.getFullYear();
      const month = d.getMonth(); // 0-indexed (11 = December)
      return year >= 2026 || (year === 2025 && month === 11);
    });

    const meta   = await readMeta();
    const seen   = new Set();
    const unique = filtered.filter(m => {
      if (seen.has(m.uuid)) return false;
      seen.add(m.uuid);
      if (meta[m.uuid]?.hidden) return false;
      return true;
    });

    unique.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    const annotated = unique.map(m => ({
      ...m,
      has_notion_summary: !!(meta[m.uuid]?.summary_he),
    }));

    res.json({ meetings: annotated });
  } catch (err) {
    console.error('Zoom recordings error:', err.message);
    res.status(500).json({ error: err.message || 'שגיאה בטעינת הקלטות' });
  }
});

// ── GET /api/zoom/meta ───────────────────────────────────────
router.get('/meta', async (req, res) => {
  res.json(await readMeta());
});

// ── PUT /api/zoom/meta ───────────────────────────────────────
router.put('/meta', async (req, res) => {
  const adminId = process.env.VITE_ADMIN_USER_ID;
  if (!adminId || req.headers['x-admin-id'] !== adminId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { uuid, custom_title, playbook_url, attachments } = req.body;
  if (!uuid) return res.status(400).json({ error: 'uuid required' });

  const updates = {};
  if (custom_title  !== undefined) updates.custom_title  = custom_title  || null;
  if (playbook_url  !== undefined) updates.playbook_url  = playbook_url  || null;
  if (attachments   !== undefined) updates.attachments   = Array.isArray(attachments) && attachments.length ? attachments : [];

  const ok = await upsertMeta(uuid, updates);
  res.json({ ok, data: updates });
});

// ── Notion helpers ────────────────────────────────────────────
// Parent page that contains all meeting notes ("סיכום שיחות")
const NOTION_MEETINGS_PARENT = '1f5fcb47a44180c4b96ed587cff31ebc';

/** Extract plain text from a Notion rich_text array */
function richTextToPlain(richText = []) {
  return richText.map(rt => rt.plain_text || '').join('');
}

/** Recursively fetch all text from a Notion page's blocks */
async function fetchNotionPageText(pageId, token, depth = 0) {
  if (depth > 3) return '';                          // cap recursion
  const res  = await fetch(
    `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
    { headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' } }
  );
  if (!res.ok) return '';
  const data    = await res.json();
  const lines   = [];

  for (const block of data.results || []) {
    const type = block.type;
    const bt   = block[type] || {};

    // headings
    if (type.startsWith('heading_')) {
      const txt = richTextToPlain(bt.rich_text);
      if (txt) lines.push(`\n### ${txt}`);
    }
    // text / list items
    else if (['paragraph', 'bulleted_list_item', 'numbered_list_item', 'quote', 'callout'].includes(type)) {
      const txt = richTextToPlain(bt.rich_text);
      if (txt) lines.push(type === 'paragraph' ? txt : `• ${txt}`);
    }
    // to-do
    else if (type === 'to_do') {
      const txt = richTextToPlain(bt.rich_text);
      if (txt) lines.push(`- [ ] ${txt}`);
    }

    // recurse into children (e.g. nested bullets, ai_block content)
    if (block.has_children) {
      const child = await fetchNotionPageText(block.id, token, depth + 1);
      if (child) lines.push(child);
    }
  }
  return lines.join('\n').trim();
}

/** Search Notion for a meeting note matching a recording's date + topic keyword */
async function findNotionSummaryForRecording(recordingDate, topicKeyword) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return null;

  try {
    // 1. Get child pages of "סיכום שיחות"
    const res  = await fetch(
      `https://api.notion.com/v1/blocks/${NOTION_MEETINGS_PARENT}/children?page_size=100`,
      { headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' } }
    );
    if (!res.ok) return null;
    const data  = await res.json();

    const recDate = recordingDate.slice(0, 10); // "2026-05-25"

    // 2. Find page created on the same day + matching topic keyword
    const keyword = topicKeyword.includes('מעבדת') ? 'מעבדת' : 'פגישה שבועית';
    const matching = (data.results || []).find(block => {
      if (block.type !== 'child_page') return false;
      const title = block.child_page?.title || '';
      const createdDate = block.created_time?.slice(0, 10);
      return createdDate === recDate && title.includes(keyword);
    });

    if (!matching) return null;

    // 3. Fetch page content
    const text = await fetchNotionPageText(matching.id, token);
    return text || null;
  } catch (e) {
    console.error('[notion] findNotionSummary error:', e.message);
    return null;
  }
}

// ── POST /api/zoom/ai-summary ────────────────────────────────
// 1. Check cache (zoom-meta.json)
// 2. Try Notion — search for matching meeting note by date + topic
// 3. Cache and return
// Body: { uuid, start_time, topic }
router.post('/ai-summary', async (req, res) => {
  const { uuid, start_time, topic } = req.body;
  if (!uuid) return res.status(400).json({ error: 'uuid required' });

  // Return cached summary if exists
  const meta = await readMeta();
  if (meta[uuid]?.summary_he) {
    return res.json({ summary: meta[uuid].summary_he, cached: true });
  }

  try {
    const summary = await findNotionSummaryForRecording(start_time || '', topic || '');

    if (summary) {
      await upsertMeta(uuid, { summary_he: summary });
      return res.json({ summary });
    }

    return res.json({ summary: null });
  } catch (err) {
    console.error('[zoom/ai-summary]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── syncUpcomingMeetings (called by daily cron) ───────────────
// Fetches upcoming meetings from Zoom and caches them in Supabase.
export async function syncUpcomingMeetings() {
  try {
    const token  = await getZoomToken();
    const userId = getZoomUser();
    const now    = new Date();

    const apiRes = await fetch(
      `https://api.zoom.us/v2/users/${userId}/meetings?type=upcoming&page_size=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await apiRes.json();

    const RELEVANT_TOPICS = ['פגישה שבועית', 'מעבדת היכולות'];
    const rawMeetings = (data.meetings || []).filter(m =>
      RELEVANT_TOPICS.some(t => m.topic?.includes(t))
    );

    const meetings = await Promise.all(rawMeetings.map(async m => {
      let start_time = m.start_time || null;
      if (!start_time && m.type === 3) {
        start_time = await estimateNextOccurrence(token, userId, m.id);
      }
      return { id: String(m.id), topic: m.topic, start_time, duration: m.duration, join_url: m.join_url };
    }));

    const valid = meetings.filter(m => {
      if (!m.start_time) return false;
      const end = new Date(new Date(m.start_time).getTime() + (m.duration || 0) * 60000);
      return end >= now;
    });

    // Upsert into Supabase
    if (valid.length) {
      await supabase.from('zoom_upcoming_cache').delete().neq('id', '');
      await supabase.from('zoom_upcoming_cache').insert(
        valid.map(m => ({ ...m, updated_at: now.toISOString() }))
      );
    }

    console.log(`[zoom] Synced ${valid.length} upcoming meetings to cache`);
    return valid.length;
  } catch (e) {
    console.error('[zoom] syncUpcomingMeetings error:', e.message);
    return 0;
  }
}

// ── syncAllNotionSummaries (called by nightly cron) ──────────
// Loops over all recordings, finds ones without a cached summary,
// and fetches + caches them from Notion.
export async function syncAllNotionSummaries() {
  const token = process.env.NOTION_TOKEN;
  if (!token) return 0;

  let count = 0;
  try {
    const zoomToken = await getZoomToken();
    const userId    = getZoomUser();
    const now       = new Date();
    const meta      = await readMeta();

    const allMeetings = [];
    for (let i = 0; i < 3; i++) {
      const to   = new Date(now); to.setMonth(to.getMonth() - i);
      const from = new Date(to);  from.setMonth(from.getMonth() - 1);
      const meetings = await fetchMonthRecordings(
        zoomToken, userId,
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10)
      );
      allMeetings.push(...meetings);
    }

    const RELEVANT = ['פגישה שבועית', 'מעבדת היכולות'];

    for (const m of allMeetings) {
      if (!m.uuid || !m.topic) continue;
      if (!RELEVANT.some(t => m.topic.includes(t))) continue;
      if (meta[m.uuid]?.summary_he) continue;

      const summary = await findNotionSummaryForRecording(m.start_time, m.topic);
      if (summary) {
        await upsertMeta(m.uuid, { summary_he: summary });
        count++;
      }
    }
  } catch (e) {
    console.error('[syncAllNotionSummaries]', e.message);
  }
  return count;
}

// ── DELETE /api/zoom/recordings/:uuid ───────────────────────
// Admin-only: hides a recording from the list (sets hidden: true in meta).
// Does NOT delete from Zoom — can be restored by removing the flag manually.
router.delete('/recordings/:uuid', async (req, res) => {
  const adminId = process.env.VITE_ADMIN_USER_ID;
  if (!adminId || req.headers['x-admin-id'] !== adminId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { uuid } = req.params;
  if (!uuid) return res.status(400).json({ error: 'uuid required' });

  await upsertMeta(uuid, { hidden: true });
  res.json({ ok: true });
});

// ── POST /api/zoom/summary ───────────────────────────────────
// Generates (and caches) a Hebrew summary for a recording.
// Priority: 1) Zoom AI Summary file  2) VTT transcript → GPT
router.post('/summary', async (req, res) => {
  const { uuid, recording_files } = req.body;
  if (!uuid) return res.status(400).json({ error: 'uuid required' });

  // Return cached summary if exists
  const meta = await readMeta();
  if (meta[uuid]?.summary) {
    return res.json({ summary: meta[uuid].summary, cached: true });
  }

  try {
    const token = await getZoomToken();

    // ── 1. Try Zoom AI Summary ──────────────────────────────
    const summaryFile = (recording_files || []).find(f => f.file_type === 'SUMMARY');
    if (summaryFile?.download_url) {
      const r = await fetch(summaryFile.download_url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const text = (await r.text()).trim();
        if (text) {
          await upsertMeta(uuid, { summary: text });
          return res.json({ summary: text, source: 'zoom' });
        }
      }
    }

    // ── 2. VTT Transcript → GPT ─────────────────────────────
    const transcriptFile = (recording_files || []).find(
      f => f.file_type === 'TRANSCRIPT' || f.file_type === 'CC'
    );
    let plainText = '';

    if (transcriptFile?.download_url) {
      // ── VTT transcript path ───────────────────────────────
      const tr = await fetch(transcriptFile.download_url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (tr.ok) {
        const vtt = await tr.text();
        plainText = vtt
          .replace(/^WEBVTT.*$/m, '')
          .replace(/^\d{2}:\d{2}:\d{2}\.\d{3} --> .+$/gm, '')
          .replace(/^\d+$/gm, '')
          .split('\n').map(l => l.trim()).filter(Boolean).join(' ')
          .replace(/\s+/g, ' ').trim()
          .slice(0, 14000);
      }
    }

    if (!plainText) {
      // ── Whisper fallback: use M4A audio file ──────────────
      const audioFile = (recording_files || []).find(f => f.file_type === 'M4A');
      if (!audioFile?.download_url) {
        return res.status(404).json({ error: 'אין תמלול או קובץ שמע זמין להקלטה זו' });
      }

      const WHISPER_LIMIT = 24 * 1024 * 1024; // 24 MB

      // Use Range request to download only the first 24MB (covers ~30-60 min of audio)
      const audioRes = await fetch(audioFile.download_url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Range: `bytes=0-${WHISPER_LIMIT - 1}`,
        },
      });
      if (!audioRes.ok && audioRes.status !== 206) {
        return res.status(502).json({ error: 'שגיאה בהורדת הקובץ השמע' });
      }

      const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

      const form = new FormData();
      form.append('file',  new Blob([audioBuffer], { type: 'audio/m4a' }), 'audio.m4a');
      form.append('model', 'whisper-1');
      form.append('language', 'he');
      form.append('response_format', 'text');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method:  'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body:    form,
      });

      const whisperText = await whisperRes.text();
      if (!whisperText?.trim()) return res.status(502).json({ error: 'Whisper לא הצליח לתמלל' });

      plainText = whisperText.trim().slice(0, 14000);
    }

    if (!plainText) return res.status(404).json({ error: 'לא נמצא תוכן לסיכום' });

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'אתה עוזר שמסכם פגישות של תוכנית Creative Expert. כתוב סיכום קצר ותמציתי בעברית של 3-5 נקודות עיקריות. השתמש ב-bullet points עם •. התמקד בתובנות, החלטות ודברי פעולה. אם הטקסט נראה חלקי, ציין בסוף בשורה קטנה: "(סיכום מבוסס על תחילת הפגישה)".',
          },
          { role: 'user', content: `סכם את הפגישה:\n\n${plainText}` },
        ],
        max_tokens: 450,
        temperature: 0.3,
      }),
    });

    const openaiData = await openaiRes.json();
    const summary = openaiData.choices?.[0]?.message?.content?.trim();
    if (!summary) return res.status(502).json({ error: 'שגיאה ביצירת הסיכום' });

    await upsertMeta(uuid, { summary });
    res.json({ summary, source: 'openai' });

  } catch (err) {
    console.error('Summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Estimate next occurrence from recent recordings ──────────
// For recurring meetings with no start_time, find their last recording
// and add 7 days to estimate the next occurrence.
async function estimateNextOccurrence(token, userId, meetingId) {
  try {
    const now  = new Date();
    const from = new Date(now); from.setDate(from.getDate() - 42); // look back 6 weeks
    const recordings = await fetchMonthRecordings(
      token, userId,
      from.toISOString().slice(0, 10),
      now.toISOString().slice(0, 10)
    );
    const mine = recordings
      .filter(r => String(r.id) === String(meetingId) && r.start_time)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
      .slice(0, 5);

    if (!mine.length) return null;

    // Find dominant day-of-week from recent recordings
    const dayCounts = {};
    for (const r of mine) {
      const d = new Date(r.start_time).getUTCDay(); // 0=Sun … 6=Sat
      dayCounts[d] = (dayCounts[d] || 0) + 1;
    }
    const dominantDay = Number(Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0][0]);

    // Check for manual time override (env: ZOOM_TIME_OVERRIDES = {"meetingId":"HH:MM"} in UTC)
    let hours, minutes;
    try {
      const overrides = JSON.parse(process.env.ZOOM_TIME_OVERRIDES || '{}');
      const override  = overrides[String(meetingId)];
      if (override) {
        [hours, minutes] = override.split(':').map(Number);
      }
    } catch { /* ignore parse errors */ }

    if (hours === undefined) {
      const lastStart = new Date(mine[0].start_time);
      hours   = lastStart.getUTCHours();
      minutes = lastStart.getUTCMinutes();
    }

    // Find the next upcoming date that falls on dominantDay
    const next = new Date(now);
    next.setUTCHours(hours, minutes, 0, 0);
    const daysUntil = (dominantDay - now.getUTCDay() + 7) % 7 || 7;
    next.setUTCDate(next.getUTCDate() + daysUntil);

    return next > now ? next.toISOString() : null;
  } catch {
    return null;
  }
}

// ── GET /api/zoom/upcoming — reads from Supabase cache ───────
router.get('/upcoming', async (req, res) => {
  try {
    const now = new Date();

    // Try Supabase cache first
    const { data: cached, error } = await supabase
      .from('zoom_upcoming_cache')
      .select('*')
      .order('start_time', { ascending: true });

    if (!error && cached?.length) {
      // Filter out meetings that have already ended
      const valid = cached.filter(m => {
        if (!m.start_time) return false;
        const end = new Date(new Date(m.start_time).getTime() + (m.duration || 0) * 60000);
        return end >= now;
      });
      if (valid.length) return res.json({ meetings: valid, cached: true });
    }

    // Fallback: fetch live from Zoom (e.g. cache empty or first run)
    const token  = await getZoomToken();
    const userId = getZoomUser();
    const lookAhead = new Date(now); lookAhead.setDate(now.getDate() + 14);

    const apiRes = await fetch(
      `https://api.zoom.us/v2/users/${userId}/meetings?type=upcoming&page_size=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await apiRes.json();
    const RELEVANT_TOPICS = ['פגישה שבועית', 'מעבדת היכולות'];

    const rawMeetings = (data.meetings || []).filter(m => {
      if (!RELEVANT_TOPICS.some(t => m.topic?.includes(t))) return false;
      if (m.type === 3) return true;
      if (!m.start_time) return false;
      const end = new Date(new Date(m.start_time).getTime() + (m.duration || 0) * 60000);
      return end >= now && new Date(m.start_time) <= lookAhead;
    });

    const meetings = await Promise.all(rawMeetings.map(async m => {
      let start_time = m.start_time || null;
      if (!start_time && m.type === 3) {
        start_time = await estimateNextOccurrence(token, userId, m.id);
      }
      return { id: m.id, topic: m.topic, start_time, duration: m.duration, join_url: m.join_url };
    }));

    meetings.sort((a, b) => {
      if (a.start_time && b.start_time) return new Date(a.start_time) - new Date(b.start_time);
      return a.start_time ? -1 : 1;
    });

    res.json({ meetings });
  } catch (err) {
    console.error('Zoom upcoming error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zoom/upcoming-debug — raw Zoom meetings response ─
router.get('/upcoming-debug', async (req, res) => {
  try {
    const token  = await getZoomToken();
    const userId = getZoomUser();

    const apiRes = await fetch(
      `https://api.zoom.us/v2/users/${userId}/meetings?type=upcoming&page_size=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await apiRes.json();

    const now        = new Date();
    const endOfWeek  = new Date(now);
    endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    res.json({
      userId,
      now:       now.toISOString(),
      endOfWeek: endOfWeek.toISOString(),
      raw_count: (data.meetings || []).length,
      meetings:  (data.meetings || []).map(m => ({
        id:         m.id,
        topic:      m.topic,
        type:       m.type,
        status:     m.status,
        start_time: m.start_time,
        duration:   m.duration,
        join_url:   !!m.join_url,
        in_window:  m.start_time
          ? (new Date(m.start_time) >= now && new Date(m.start_time) <= endOfWeek)
          : null,
      })),
      error: data.code ? `${data.code}: ${data.message}` : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zoom/debug ──────────────────────────────────────
router.get('/debug', async (req, res) => {
  try {
    const token  = await getZoomToken();
    const userId = getZoomUser();
    const allMeetings = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const toDate = new Date(now);
      toDate.setMonth(toDate.getMonth() - i);
      const fromDate = new Date(toDate);
      fromDate.setMonth(fromDate.getMonth() - 1);
      const from = fromDate.toISOString().slice(0, 10);
      const to   = toDate.toISOString().slice(0, 10);

      const apiRes = await fetch(
        `https://api.zoom.us/v2/users/${userId}/recordings?from=${from}&to=${to}&page_size=300`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const raw = await apiRes.json();
      if (raw.meetings) allMeetings.push(...raw.meetings);
      if (raw.code) {
        return res.json({ userId, error_code: raw.code, error_message: raw.message, from, to });
      }
    }

    const topics = [...new Set(allMeetings.map(m => m.topic))].sort();

    // Show file types available per meeting
    const fileTypes = allMeetings.map(m => ({
      topic: m.topic,
      date:  m.start_time?.slice(0, 10),
      files: [...new Set((m.recording_files || []).map(f => f.file_type))],
    }));

    res.json({ userId, total: allMeetings.length, topics, fileTypes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zoom/attendance ─────────────────────────────────────
// Returns all meetings from Jan 2026 with whether a given student attended.
// Query params: email (primary match), name (fallback)
router.get('/attendance', async (req, res) => {
  const { email, name, enrolled_at } = req.query;
  if (!email && !name) return res.status(400).json({ error: 'email or name required' });
  const enrolledDate = enrolled_at ? new Date(enrolled_at) : new Date('2026-01-01');

  try {
    const token  = await getZoomToken();
    const userId = getZoomUser();

    // Fetch from enrolled_at (or Jan 2026 minimum) → today
    const now   = new Date();
    const start = enrolledDate > new Date(2026, 0, 1) ? enrolledDate : new Date(2026, 0, 1);
    const months = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= now) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }

    // Collect all meetings
    const allMeetings = [];
    for (const month of months) {
      const [y, m] = month.split('-').map(Number);
      const from   = `${month}-01`;
      const to     = `${month}-${new Date(y, m, 0).getDate()}`;
      const data   = await fetchMonthRecordings(token, userId, from, to);
      allMeetings.push(...(data || []));
    }

    // Filter to only relevant meeting types (same logic as Recordings page)
    function isRelevantMeeting(topic) {
      const t = (topic || '').toLowerCase();
      return t.includes('מעבדת') || t.includes('שבועי') || t.includes('masterclass') || t.includes('מאסטר');
    }

    // Sort newest first, deduplicate by uuid, keep only relevant meetings on/after enrolled_at
    const seen = new Set();
    const meetings = allMeetings
      .filter(m => isRelevantMeeting(m.topic))
      .filter(m => !m.start_time || new Date(m.start_time) >= enrolledDate)
      .filter(m => { if (seen.has(m.uuid)) return false; seen.add(m.uuid); return true; })
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    // Fetch participants in parallel (batches of 8 to avoid rate limiting)
    const isMatch = buildParticipantMatcher(name, email);

    async function fetchParticipants(meeting) {
      try {
        const uuid = meeting.uuid.includes('/') || meeting.uuid.includes('+')
          ? encodeURIComponent(encodeURIComponent(meeting.uuid))
          : encodeURIComponent(meeting.uuid);
        const partRes = await fetch(
          `https://api.zoom.us/v2/report/meetings/${uuid}/participants?page_size=300`,
          { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) }
        );
        if (!partRes.ok) return { ...meeting, attended: null, participant_count: null };
        const partData = await partRes.json();
        const participants = partData.participants || [];
        const attended = participants.some(isMatch);
        return { ...meeting, attended, participant_count: participants.length };
      } catch (_) {
        return { ...meeting, attended: null, participant_count: null };
      }
    }

    // Batch into groups of 8
    const result = [];
    for (let i = 0; i < meetings.length; i += 8) {
      const batch = meetings.slice(i, i + 8);
      const settled = await Promise.all(batch.map(fetchParticipants));
      result.push(...settled);
    }

    res.json({ meetings: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zoom/attendance-debug ──────────────────────────────
// Returns raw participant names/emails for the last N meetings (admin only).
router.get('/attendance-debug', async (req, res) => {
  const adminId = process.env.VITE_ADMIN_USER_ID;
  if (!adminId || req.headers['x-admin-id'] !== adminId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const token  = await getZoomToken();
    const userId = getZoomUser();
    const now    = new Date();
    const from   = new Date(now); from.setMonth(from.getMonth() - 2);
    const meetings = await fetchMonthRecordings(token, userId, from.toISOString().slice(0,10), now.toISOString().slice(0,10));

    function isRelevantMeeting(topic) {
      const t = (topic || '').toLowerCase();
      return t.includes('מעבדת') || t.includes('שבועי');
    }
    const seen = new Set();
    const relevant = meetings
      .filter(m => isRelevantMeeting(m.topic) && m.start_time && new Date(m.start_time) < now)
      .filter(m => { if (seen.has(m.uuid)) return false; seen.add(m.uuid); return true; })
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
      .slice(0, 3);

    const result = [];
    for (const meeting of relevant) {
      const uuid = meeting.uuid.includes('/') || meeting.uuid.includes('+')
        ? encodeURIComponent(encodeURIComponent(meeting.uuid))
        : encodeURIComponent(meeting.uuid);
      const r = await fetch(
        `https://api.zoom.us/v2/report/meetings/${uuid}/participants?page_size=300`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }
      );
      const d = await r.json();
      result.push({
        topic: meeting.topic,
        date: meeting.start_time?.slice(0,10),
        participants: (d.participants || []).map(p => ({ name: p.name, email: p.user_email })),
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── In-memory cache for attendance alerts (refreshed every hour) ──
let _alertsCache = null;
let _alertsCacheAt = 0;
const ALERTS_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── GET /api/zoom/attendance-alerts ─────────────────────────────
// Returns students who missed 3+ consecutive meetings (newest first).
// Uses a 1-hour in-memory cache to avoid hammering Zoom API.
router.get('/attendance-alerts', async (req, res) => {
  const adminId = process.env.VITE_ADMIN_USER_ID;
  if (!adminId || req.headers['x-admin-id'] !== adminId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Serve cache if fresh
  if (_alertsCache && Date.now() - _alertsCacheAt < ALERTS_TTL_MS) {
    return res.json({ alerts: _alertsCache, cached: true });
  }

  try {
    const token  = await getZoomToken();
    const userId = getZoomUser();
    const now    = new Date();

    // 1. Fetch last 3 months of recordings
    const allMeetings = [];
    for (let i = 0; i < 3; i++) {
      const to   = new Date(now); to.setMonth(to.getMonth() - i);
      const from = new Date(to);  from.setMonth(from.getMonth() - 1);
      const data = await fetchMonthRecordings(
        token, userId,
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10)
      );
      allMeetings.push(...(data || []));
    }

    function isRelevantMeeting(topic) {
      const t = (topic || '').toLowerCase();
      return t.includes('מעבדת') || t.includes('שבועי') || t.includes('masterclass') || t.includes('מאסטר');
    }

    // Deduplicate + filter + sort newest first + keep only past meetings
    const seen = new Set();
    const meetings = allMeetings
      .filter(m => isRelevantMeeting(m.topic) && m.start_time && new Date(m.start_time) < now)
      .filter(m => { if (seen.has(m.uuid)) return false; seen.add(m.uuid); return true; })
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
      .slice(0, 15); // last 15 meetings is enough

    // 2. Fetch participants for each meeting (batches of 8)
    async function getMeetingParticipants(meeting) {
      try {
        const uuid = meeting.uuid.includes('/') || meeting.uuid.includes('+')
          ? encodeURIComponent(encodeURIComponent(meeting.uuid))
          : encodeURIComponent(meeting.uuid);
        const r = await fetch(
          `https://api.zoom.us/v2/report/meetings/${uuid}/participants?page_size=300`,
          { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) }
        );
        if (!r.ok) return { uuid: meeting.uuid, start_time: meeting.start_time, topic: meeting.topic, participants: [] };
        const d = await r.json();
        return { uuid: meeting.uuid, start_time: meeting.start_time, topic: meeting.topic, participants: d.participants || [] };
      } catch {
        return { uuid: meeting.uuid, start_time: meeting.start_time, topic: meeting.topic, participants: [] };
      }
    }

    const meetingData = [];
    for (let i = 0; i < meetings.length; i += 8) {
      const batch = await Promise.all(meetings.slice(i, i + 8).map(getMeetingParticipants));
      meetingData.push(...batch);
    }

    // 3. Get all active students
    const { data: students } = await supabase
      .from('members')
      .select('id, first_name, email, enrolled_at, image_url')
      .eq('status', 'active');

    if (!students?.length) {
      _alertsCache = [];
      _alertsCacheAt = Date.now();
      return res.json({ alerts: [] });
    }

    // 4. For each student, find their last 3 relevant meetings and check attendance
    const alerts = [];
    for (const student of students) {
      const enrolledDate = student.enrolled_at ? new Date(student.enrolled_at) : new Date('2026-01-01');
      const isMatch = buildParticipantMatcher(student.first_name, student.email);

      // Only meetings on/after enrollment date
      const studentMeetings = meetingData.filter(m => new Date(m.start_time) >= enrolledDate);
      if (studentMeetings.length < 3) continue; // not enough data yet

      // Last 3 meetings
      const last3 = studentMeetings.slice(0, 3);
      const missedAll = last3.every(m => !m.participants.some(isMatch));

      if (missedAll) {
        alerts.push({
          id: student.id,
          name: student.first_name,
          email: student.email,
          image_url: student.image_url,
          missed_since: last3[last3.length - 1].start_time, // oldest of the 3
        });
      }
    }

    _alertsCache = alerts;
    _alertsCacheAt = Date.now();
    res.json({ alerts });
  } catch (err) {
    console.error('[attendance-alerts]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
