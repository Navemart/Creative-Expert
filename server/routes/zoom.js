import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const router  = express.Router();
const __dir   = dirname(fileURLToPath(import.meta.url));
const META_FILE = join(__dir, '..', 'data', 'zoom-meta.json');

// ── Metadata helpers (custom titles + playbook URLs) ──────────
function readMeta() {
  if (!existsSync(META_FILE)) return {};
  try { return JSON.parse(readFileSync(META_FILE, 'utf8')); }
  catch { return {}; }
}

function writeMeta(data) {
  const dir = join(__dir, '..', 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(META_FILE, JSON.stringify(data, null, 2));
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

    const meta   = readMeta();
    const seen   = new Set();
    const unique = filtered.filter(m => {
      if (seen.has(m.uuid)) return false;
      seen.add(m.uuid);
      if (meta[m.uuid]?.hidden) return false;   // admin-deleted recordings
      return true;
    });

    unique.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    // Annotate each meeting with whether a Notion summary is available in cache
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
// Returns custom titles and playbook URLs keyed by meeting uuid
router.get('/meta', (req, res) => {
  res.json(readMeta());
});

// ── PUT /api/zoom/meta ───────────────────────────────────────
// Body: { uuid, custom_title?, playbook_url? }
// Requires x-admin-id header matching VITE_ADMIN_USER_ID env var.
router.put('/meta', (req, res) => {
  const adminId = process.env.VITE_ADMIN_USER_ID;
  if (!adminId || req.headers['x-admin-id'] !== adminId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { uuid, custom_title, playbook_url, attachments } = req.body;
  if (!uuid) return res.status(400).json({ error: 'uuid required' });

  const meta = readMeta();
  meta[uuid] = { ...(meta[uuid] || {}) };

  if (custom_title !== undefined) {
    if (custom_title) meta[uuid].custom_title = custom_title;
    else delete meta[uuid].custom_title;
  }
  if (playbook_url !== undefined) {
    if (playbook_url) meta[uuid].playbook_url = playbook_url;
    else delete meta[uuid].playbook_url;
  }
  if (attachments !== undefined) {
    if (Array.isArray(attachments) && attachments.length > 0) {
      meta[uuid].attachments = attachments;
      delete meta[uuid].playbook_url; // migrate to new format
    } else {
      delete meta[uuid].attachments;
    }
  }

  // Remove empty entry
  if (Object.keys(meta[uuid]).length === 0) delete meta[uuid];

  writeMeta(meta);
  res.json({ ok: true, data: meta[uuid] || {} });
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
  const meta = readMeta();
  if (meta[uuid]?.summary_he) {
    return res.json({ summary: meta[uuid].summary_he, cached: true });
  }

  try {
    // Fetch from Notion by date + topic
    const summary = await findNotionSummaryForRecording(start_time || '', topic || '');

    if (summary) {
      meta[uuid] = { ...(meta[uuid] || {}), summary_he: summary };
      writeMeta(meta);
      return res.json({ summary });
    }

    return res.json({ summary: null });
  } catch (err) {
    console.error('[zoom/ai-summary]', err.message);
    res.status(500).json({ error: err.message });
  }
});

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
    const meta      = readMeta();

    // Collect all recent recordings (last 3 months)
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
      if (meta[m.uuid]?.summary_he) continue;   // already cached

      const summary = await findNotionSummaryForRecording(m.start_time, m.topic);
      if (summary) {
        meta[m.uuid] = { ...(meta[m.uuid] || {}), summary_he: summary };
        count++;
      }
    }

    if (count > 0) writeMeta(meta);
  } catch (e) {
    console.error('[syncAllNotionSummaries]', e.message);
  }
  return count;
}

// ── DELETE /api/zoom/recordings/:uuid ───────────────────────
// Admin-only: hides a recording from the list (sets hidden: true in meta).
// Does NOT delete from Zoom — can be restored by removing the flag manually.
router.delete('/recordings/:uuid', (req, res) => {
  const adminId = process.env.VITE_ADMIN_USER_ID;
  if (!adminId || req.headers['x-admin-id'] !== adminId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { uuid } = req.params;
  if (!uuid) return res.status(400).json({ error: 'uuid required' });

  const meta = readMeta();
  meta[uuid] = { ...(meta[uuid] || {}), hidden: true };
  writeMeta(meta);
  res.json({ ok: true });
});

// ── POST /api/zoom/summary ───────────────────────────────────
// Generates (and caches) a Hebrew summary for a recording.
// Priority: 1) Zoom AI Summary file  2) VTT transcript → GPT
router.post('/summary', async (req, res) => {
  const { uuid, recording_files } = req.body;
  if (!uuid) return res.status(400).json({ error: 'uuid required' });

  // Return cached summary if exists
  const meta = readMeta();
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
          meta[uuid] = { ...(meta[uuid] || {}), summary: text };
          writeMeta(meta);
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

    meta[uuid] = { ...(meta[uuid] || {}), summary };
    writeMeta(meta);
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
    const from = new Date(now); from.setDate(from.getDate() - 21); // look back 3 weeks
    const recordings = await fetchMonthRecordings(
      token, userId,
      from.toISOString().slice(0, 10),
      now.toISOString().slice(0, 10)
    );
    // Find recordings for this specific meeting ID (sorted newest first)
    const mine = recordings
      .filter(r => String(r.id) === String(meetingId) && r.start_time)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    if (!mine.length) return null;

    const lastStart = new Date(mine[0].start_time);
    // Add 7 days (weekly recurrence) and keep the same time
    const next = new Date(lastStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    // Only return if next is in the future
    return next > now ? next.toISOString() : null;
  } catch {
    return null;
  }
}

// ── GET /api/zoom/upcoming — meetings this week ──────────────
router.get('/upcoming', async (req, res) => {
  try {
    const token  = await getZoomToken();
    const userId = getZoomUser();

    const now = new Date();
    // Look 2 weeks ahead (wider window so we always show next meeting)
    const lookAhead = new Date(now);
    lookAhead.setDate(now.getDate() + 14);

    const apiRes = await fetch(
      `https://api.zoom.us/v2/users/${userId}/meetings?type=upcoming&page_size=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await apiRes.json();

    const RELEVANT_TOPICS = ['פגישה שבועית', 'מעבדת היכולות'];

    const rawMeetings = (data.meetings || []).filter(m => {
      const topicMatch = RELEVANT_TOPICS.some(t => m.topic?.includes(t));
      if (!topicMatch) return false;
      if (m.type === 3) return true; // recurring/no fixed time — handle separately
      if (!m.start_time) return false;
      const start = new Date(m.start_time);
      return start >= now && start <= lookAhead;
    });

    // Enrich recurring meetings with estimated next occurrence from recordings
    const meetings = await Promise.all(rawMeetings.map(async m => {
      let start_time = m.start_time || null;
      if (!start_time && m.type === 3) {
        start_time = await estimateNextOccurrence(token, userId, m.id);
      }
      return {
        id:         m.id,
        topic:      m.topic,
        start_time,
        duration:   m.duration,
        join_url:   m.join_url,
        recurring:  m.type === 3,
      };
    }));

    meetings.sort((a, b) => {
      if (a.start_time && b.start_time) return new Date(a.start_time) - new Date(b.start_time);
      if (a.start_time) return -1;
      if (b.start_time) return 1;
      return 0;
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

export default router;
