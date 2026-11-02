-- news_items: חדשות ועדכונים שמוצגים בדאשבורד התלמיד
create table if not exists news_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  emoji       text default '📢',
  pinned      boolean default false,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- RLS: כל משתמש מחובר קורא, רק שירות (service role) כותב
alter table news_items enable row level security;

create policy "anyone_read" on news_items
  for select using (auth.role() = 'authenticated' and published = true);
