import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const db = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

// GET /api/news — כל הפריטים הפורסמו, מסודרים (pinned ראשון, אח"כ חדש לישן)
router.get('/', async (_req, res) => {
  const { data, error } = await db
    .from('news_items')
    .select('id, title, body, emoji, pinned, created_at')
    .eq('published', true)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/news/all — לאדמין: כולל unpublished
router.get('/all', async (_req, res) => {
  const { data, error } = await db
    .from('news_items')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/news — יצירה
router.post('/', async (req, res) => {
  const { title, body, emoji, pinned, published } = req.body;
  if (!title) return res.status(400).json({ error: 'title חסר' });
  const { data, error } = await db
    .from('news_items')
    .insert({ title, body: body || null, emoji: emoji || '📢', pinned: !!pinned, published: published !== false })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/news/:id — עדכון
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const fields = {};
  ['title', 'body', 'emoji', 'pinned', 'published'].forEach(k => {
    if (req.body[k] !== undefined) fields[k] = req.body[k];
  });
  fields.updated_at = new Date().toISOString();
  const { data, error } = await db
    .from('news_items')
    .update(fields)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/news/:id — מחיקה
router.delete('/:id', async (req, res) => {
  const { error } = await db.from('news_items').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
