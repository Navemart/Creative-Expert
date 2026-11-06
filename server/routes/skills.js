import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const db = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

// GET /api/skills — פורסמו בלבד
router.get('/', async (_req, res) => {
  const { data, error } = await db
    .from('agent_skills')
    .select('id, title, description, author, tags, file_url, featured, download_count, created_at')
    .eq('published', true)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/skills/all — לאדמין (כולל unpublished)
router.get('/all', async (_req, res) => {
  const { data, error } = await db
    .from('agent_skills')
    .select('*')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/skills/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await db
    .from('agent_skills')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

// POST /api/skills — יצירה
router.post('/', async (req, res) => {
  const { title, description, full_content, author, tags, file_url, featured, published } = req.body;
  if (!title) return res.status(400).json({ error: 'title חסר' });

  // אם featured=true — מורידים featured מכל השאר
  if (featured) {
    await db.from('agent_skills').update({ featured: false }).eq('featured', true);
  }

  const { data, error } = await db
    .from('agent_skills')
    .insert({
      title,
      description: description || null,
      full_content: full_content || null,
      author: author || 'Nave Martziano',
      tags: tags || [],
      file_url: file_url || null,
      featured: !!featured,
      published: published !== false,
    })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/skills/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const fields = {};
  ['title', 'description', 'full_content', 'author', 'tags', 'file_url', 'featured', 'published', 'download_count'].forEach(k => {
    if (req.body[k] !== undefined) fields[k] = req.body[k];
  });

  if (fields.featured === true) {
    await db.from('agent_skills').update({ featured: false }).eq('featured', true).neq('id', id);
  }

  fields.updated_at = new Date().toISOString();
  const { data, error } = await db
    .from('agent_skills')
    .update(fields)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/skills/:id
router.delete('/:id', async (req, res) => {
  const { error } = await db.from('agent_skills').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
