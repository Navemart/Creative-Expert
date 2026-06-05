import { Router } from 'express';

const router = Router();

// GET /api/members — list all members.
router.get('/', (_req, res) => {
  // TODO: Replace placeholder response with a Supabase query.
  // Example:
  //   import { createClient } from '@supabase/supabase-js';
  //   const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  //   const { data, error } = await supabase.from('members').select('*');
  //   if (error) return res.status(500).json({ error: error.message });
  //   res.json({ data });
  res.json({ data: [] });
});

// POST /api/members — create a member.
router.post('/', (req, res) => {
  // TODO: Replace placeholder response with a Supabase insert.
  //   const { data, error } = await supabase.from('members').insert(req.body).select().single();
  res.status(201).json({ data: { id: 'placeholder', ...req.body } });
});

export default router;
