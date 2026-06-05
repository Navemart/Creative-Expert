import { Router } from 'express';

const router = Router();

// GET /api/content — list all content items.
router.get('/', (_req, res) => {
  // TODO: Replace placeholder response with a Supabase query (see CLAUDE.md).
  res.json({ data: [] });
});

// POST /api/content — create a content item.
router.post('/', (req, res) => {
  // TODO: Replace placeholder response with a Supabase insert.
  res.status(201).json({ data: { id: 'placeholder', ...req.body } });
});

export default router;
