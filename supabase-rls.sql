-- ═══════════════════════════════════════════════════════════════════════════
-- SUPABASE ROW LEVEL SECURITY  (RLS)
-- Run this entire file once in Supabase → SQL Editor → "New query"
--
-- BEFORE YOU RUN:
--   1. Replace 'YOUR_ADMIN_CLERK_USER_ID' (line ~20) with your real Clerk user ID.
--      Find it in: Clerk Dashboard → Users → click your name → copy "User ID"
--      It looks like: user_2abc123XYZ...
--
--   2. Make sure your .env has SUPABASE_JWT_SECRET set.
--      Get it from: Supabase → Project Settings → API → JWT Secret
--
-- HOW IT WORKS:
--   • Our Express server (/api/auth/supabase-token) creates a JWT signed with
--     SUPABASE_JWT_SECRET, with the user's Clerk ID in the 'sub' claim.
--   • Supabase verifies this JWT and makes the claims available via auth.jwt().
--   • RLS policies use auth.jwt()->>'sub' to identify the logged-in user.
--   • NOTE: We use auth.jwt()->>'sub' instead of auth.uid() because Clerk user
--     IDs are NOT UUIDs — they are strings like "user_2abc..."
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0. Admin helper ────────────────────────────────────────────────────────
-- Change 'YOUR_ADMIN_CLERK_USER_ID' to your Clerk user ID.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT auth.jwt()->>'sub' = 'user_3E7B1KvlqJykgxIdzMB6zL4oUUX'
$$;


-- ── 1. USER-SCOPED TABLES ──────────────────────────────────────────────────
-- Each student sees & edits ONLY their own rows.
-- The WITH CHECK clause prevents inserting/updating with someone else's user_id.

-- clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own clients" ON clients;
CREATE POLICY "own clients" ON clients
  USING  (user_id = auth.jwt()->>'sub')
  WITH CHECK (user_id = auth.jwt()->>'sub');

-- projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own projects" ON projects;
CREATE POLICY "own projects" ON projects
  USING  (user_id = auth.jwt()->>'sub')
  WITH CHECK (user_id = auth.jwt()->>'sub');

-- monthly_submissions
ALTER TABLE monthly_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own monthly_submissions" ON monthly_submissions;
CREATE POLICY "own monthly_submissions" ON monthly_submissions
  USING  (user_id = auth.jwt()->>'sub')
  WITH CHECK (user_id = auth.jwt()->>'sub');

-- deals
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own deals" ON deals;
CREATE POLICY "own deals" ON deals
  USING  (user_id = auth.jwt()->>'sub')
  WITH CHECK (user_id = auth.jwt()->>'sub');

-- sunday_wins
ALTER TABLE sunday_wins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own sunday_wins" ON sunday_wins;
CREATE POLICY "own sunday_wins" ON sunday_wins
  USING  (user_id = auth.jwt()->>'sub')
  WITH CHECK (user_id = auth.jwt()->>'sub');

-- leads (Pipeline page)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own leads" ON leads;
CREATE POLICY "own leads" ON leads
  USING  (user_id = auth.jwt()->>'sub')
  WITH CHECK (user_id = auth.jwt()->>'sub');

-- rank_upgrade_requests
ALTER TABLE rank_upgrade_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rank_upgrade_requests" ON rank_upgrade_requests;
CREATE POLICY "own rank_upgrade_requests" ON rank_upgrade_requests
  USING  (user_id = auth.jwt()->>'sub')
  WITH CHECK (user_id = auth.jwt()->>'sub');

-- roadmap_completions
ALTER TABLE roadmap_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own roadmap_completions" ON roadmap_completions;
CREATE POLICY "own roadmap_completions" ON roadmap_completions
  USING  (user_id = auth.jwt()->>'sub')
  WITH CHECK (user_id = auth.jwt()->>'sub');

-- diagnosis_results  (one row per student — saved business-stage diagnosis)
CREATE TABLE IF NOT EXISTS diagnosis_results (
  user_id        text PRIMARY KEY,
  offer_checks   jsonb,
  leads_checks   jsonb,
  delivery_check boolean DEFAULT false,
  offer_score    int,
  leads_score    int,
  status         text,
  focus_text     text,
  metric_text    text,
  recheck_date   date,
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE diagnosis_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own diagnosis_results" ON diagnosis_results;
CREATE POLICY "own diagnosis_results" ON diagnosis_results
  USING  (user_id = auth.jwt()->>'sub')
  WITH CHECK (user_id = auth.jwt()->>'sub');

-- diagnosis_content  (single row of editable page text/labels — admin writes, everyone reads)
CREATE TABLE IF NOT EXISTS diagnosis_content (
  id         text PRIMARY KEY DEFAULT 'default',
  data       jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE diagnosis_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read diagnosis_content"        ON diagnosis_content;
DROP POLICY IF EXISTS "admin write diagnosis_content" ON diagnosis_content;
CREATE POLICY "read diagnosis_content" ON diagnosis_content
  FOR SELECT
  USING (auth.jwt()->>'role' = 'authenticated');
CREATE POLICY "admin write diagnosis_content" ON diagnosis_content
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- student_profiles
--   • Admin can read ALL profiles (needed for the admin panel)
--   • Students can only read & write their own row
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own or admin student_profiles" ON student_profiles;
CREATE POLICY "own or admin student_profiles" ON student_profiles
  USING  (user_id = auth.jwt()->>'sub' OR is_admin())
  WITH CHECK (user_id = auth.jwt()->>'sub');


-- ── 2. SHARED READ / ADMIN-WRITE TABLES ───────────────────────────────────
-- All logged-in students can read.
-- Only the admin can insert / update / delete.

-- dashboard_labels
ALTER TABLE dashboard_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read dashboard_labels"        ON dashboard_labels;
DROP POLICY IF EXISTS "admin write dashboard_labels" ON dashboard_labels;
CREATE POLICY "read dashboard_labels" ON dashboard_labels
  FOR SELECT
  USING (auth.jwt()->>'role' = 'authenticated');
CREATE POLICY "admin write dashboard_labels" ON dashboard_labels
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- roadmap_phases
ALTER TABLE roadmap_phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read roadmap_phases"        ON roadmap_phases;
DROP POLICY IF EXISTS "admin write roadmap_phases" ON roadmap_phases;
CREATE POLICY "read roadmap_phases" ON roadmap_phases
  FOR SELECT
  USING (auth.jwt()->>'role' = 'authenticated');
CREATE POLICY "admin write roadmap_phases" ON roadmap_phases
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- roadmap_weeks
ALTER TABLE roadmap_weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read roadmap_weeks"        ON roadmap_weeks;
DROP POLICY IF EXISTS "admin write roadmap_weeks" ON roadmap_weeks;
CREATE POLICY "read roadmap_weeks" ON roadmap_weeks
  FOR SELECT
  USING (auth.jwt()->>'role' = 'authenticated');
CREATE POLICY "admin write roadmap_weeks" ON roadmap_weeks
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- roadmap_tasks
ALTER TABLE roadmap_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read roadmap_tasks"        ON roadmap_tasks;
DROP POLICY IF EXISTS "admin write roadmap_tasks" ON roadmap_tasks;
CREATE POLICY "read roadmap_tasks" ON roadmap_tasks
  FOR SELECT
  USING (auth.jwt()->>'role' = 'authenticated');
CREATE POLICY "admin write roadmap_tasks" ON roadmap_tasks
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- gpt_tools (Agents page)
ALTER TABLE gpt_tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read gpt_tools"        ON gpt_tools;
DROP POLICY IF EXISTS "admin write gpt_tools" ON gpt_tools;
CREATE POLICY "read gpt_tools" ON gpt_tools
  FOR SELECT
  USING (auth.jwt()->>'role' = 'authenticated');
CREATE POLICY "admin write gpt_tools" ON gpt_tools
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ── 3. ADMIN-ONLY TABLE ────────────────────────────────────────────────────

-- members (legacy internal table — admin only)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin only members" ON members;
CREATE POLICY "admin only members" ON members
  USING (is_admin())
  WITH CHECK (is_admin());


-- ── Done ───────────────────────────────────────────────────────────────────
-- After running this SQL, verify in Supabase:
--   Table Editor → any table → "RLS enabled" badge should appear.
--
-- To test: log in as a student and confirm they cannot see admin or other
--   students' data. Log in as admin and confirm full access.
