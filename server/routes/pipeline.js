import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

function db() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
}

// GET /api/pipeline
router.get('/', async (req, res) => {
  const { data, error } = await db().from('pipeline_leads').select('*').order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/pipeline
router.post('/', async (req, res) => {
  const body = { ...req.body, updated_at: new Date().toISOString() };
  // coerce empty strings to null for numeric columns
  if (body.followers_count === '' || body.followers_count === undefined) body.followers_count = null;
  if (body.posts_count     === '' || body.posts_count     === undefined) body.posts_count     = null;
  if (body.deal_value      === '' || body.deal_value      === undefined) body.deal_value      = null;
  delete body.id; // never insert with a client-supplied id
  const { data, error } = await db().from('pipeline_leads').insert(body).select().single();
  if (error) { console.error('[pipeline POST]', error); return res.status(500).json({ error: error.message }); }
  res.json(data);
});

// PUT /api/pipeline/:id
router.put('/:id', async (req, res) => {
  const { data, error } = await db().from('pipeline_leads').update({ ...req.body, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/pipeline/:id
router.delete('/:id', async (req, res) => {
  const { error } = await db().from('pipeline_leads').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
