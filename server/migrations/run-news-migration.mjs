import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

// בדיקה אם הטבלה כבר קיימת
const { data: existing } = await db.from('news_items').select('id').limit(1);
if (existing !== null) {
  console.log('✓ טבלת news_items כבר קיימת — אין צורך ב-migration');
  process.exit(0);
}

// הטבלה לא קיימת — צריך ליצור אותה דרך Supabase SQL Editor ידנית
console.log('');
console.log('❌ טבלת news_items לא קיימת.');
console.log('');
console.log('יש ליצור אותה ב-Supabase SQL Editor:');
console.log('  https://supabase.com/dashboard → SQL Editor');
console.log('');
console.log(`create table if not exists news_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  emoji       text default '📢',
  pinned      boolean default false,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table news_items enable row level security;

create policy "anyone_read" on news_items
  for select using (auth.role() = 'authenticated' and published = true);`);
console.log('');
