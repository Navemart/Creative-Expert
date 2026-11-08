import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const db = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

// POST /api/skills/upload — העלאת קובץ ל-Supabase Storage
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ חסר' });
  const ext = req.file.originalname.split('.').pop();
  const path = `skills/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await db.storage
    .from('skill-files')
    .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (error) return res.status(500).json({ error: error.message });
  const { data } = db.storage.from('skill-files').getPublicUrl(path);
  res.json({ url: data.publicUrl });
});

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

// GET /api/skills/:id/download — proxy שמכריח הורדה
router.get('/:id/download', async (req, res) => {
  const { data: skill, error } = await db
    .from('agent_skills')
    .select('file_url, title')
    .eq('id', req.params.id)
    .single();
  if (error || !skill?.file_url) return res.status(404).json({ error: 'קובץ לא נמצא' });

  try {
    const response = await fetch(skill.file_url);
    if (!response.ok) return res.status(502).json({ error: 'שגיאה בהורדת הקובץ' });
    const ext = skill.file_url.split('.').pop().split('?')[0] || 'bin';
    const filename = `${skill.title.replace(/[^a-z0-9א-ת]/gi, '_')}.${ext}`;
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    response.body.pipe(res);
  } catch {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
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
