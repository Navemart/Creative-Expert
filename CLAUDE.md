# Dashboard Starter Kit — Guide for Claude Code

Welcome! This project is a **starter dashboard**. It's intentionally minimal so the owner can customize it into their own product using Claude Code (you).

---

## 🧭 First-interaction behavior (important)

When a user first opens this project and asks anything open-ended like "hey", "what can you do?", "help me get started", or doesn't know where to begin — proactively offer them these four paths. Ask which one they'd like to start with.

```
Welcome to your new dashboard! I can help you with any of the following:

  🎨  1. Brand the dashboard    — colors, fonts, logo, site title
  🔐  2. Connect Clerk for auth — let users sign in
  🗄️  3. Connect Supabase       — plug in your database
  🛠️  4. Build your first feature — add a new page end-to-end

Which would you like to do first?
```

Whichever they pick, follow the corresponding playbook below. After finishing one, offer the next.

> If the user is already asking something specific, just help them directly — don't force the menu.

---

## 🎨 1. Brand the dashboard

**Files to touch:**
- [src/index.css](src/index.css) — change the `--accent` and `--accent-foreground` CSS variables (RGB triplets).
- [tailwind.config.js](tailwind.config.js) — swap the `fontFamily.sans` stack.
- [index.html](index.html) — update the `<title>` and favicon.
- [src/components/Sidebar.jsx](src/components/Sidebar.jsx) — replace the placeholder logo mark ("B") and the brand name.
- [src/components/Header.jsx](src/components/Header.jsx) — optional avatar / search tweaks.

**Typical workflow:**
1. Ask the user for: brand name, primary color (hex), and whether they have a logo file or URL.
2. Convert the hex to an `R G B` triplet (space-separated) and paste it into `--accent` in `src/index.css`.
3. Update the title, favicon, sidebar logo, and brand name.
4. If they want a Google Font, add the `<link>` to [index.html](index.html) and the family name to `tailwind.config.js`.

---

## 🔐 2. Connect Clerk for auth

**Install:**
```bash
npm install @clerk/clerk-react
```

**Env:** Add `VITE_CLERK_PUBLISHABLE_KEY` from the Clerk dashboard to `.env` (template in [.env.example](.env.example)).

**Files to touch (TODO markers already in place):**
- [src/main.jsx](src/main.jsx) — wrap `<App />` in `<ClerkProvider>`.
- [src/App.jsx](src/App.jsx) — wrap routes in `<SignedIn>` / `<SignedOut>` + `<RedirectToSignIn />`.
- [src/components/Header.jsx](src/components/Header.jsx) — replace the placeholder avatar with `<UserButton />`.

After wiring: restart dev server, sign in once to verify the flow.

---

## 🗄️ 3. Connect Supabase

**Install:**
```bash
npm install @supabase/supabase-js
```

**Env:** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`.

**Files to touch (TODO markers already in place):**
- [src/lib/supabase.js](src/lib/supabase.js) — initialize the client (the file has the exact snippet in a comment).
- [server/routes/members.js](server/routes/members.js), [server/routes/content.js](server/routes/content.js), [server/routes/analytics.js](server/routes/analytics.js) — swap the placeholder `res.json({ data: [] })` lines for real queries. (Use the service key on the server; never expose it to the frontend.)

**Workflow tip:** Help the user create the first table in Supabase (e.g., `members`), generate the SQL, then replace the GET handler in `server/routes/members.js` with a real query so the Members page lights up.

---

## 🛠️ 4. Build your first feature

A complete new page follows this pattern. Walk through it together.

1. **New page** → `src/pages/YourFeature.jsx` (copy [src/pages/Members.jsx](src/pages/Members.jsx) as a template).
2. **Nav entry** → add an item to `NAV_ITEMS` in [src/components/Sidebar.jsx](src/components/Sidebar.jsx). Pick an icon from [lucide.dev/icons](https://lucide.dev/icons).
3. **Route** → add a `<Route>` to [src/App.jsx](src/App.jsx).
4. **API** → create `server/routes/yourFeature.js` and mount it in [server/index.js](server/index.js) (`app.use('/api/your-feature', router)`).
5. **Data** → if using Supabase, add a table and wire up the GET/POST handlers.
6. **Done** → `npm run dev`, click your new nav item, confirm the page renders and `/api/your-feature` responds.

---

## 🗂️ Project structure

```
.
├── CLAUDE.md                # ← you are here
├── README.md                # Human quick-start
├── package.json             # One manifest runs both frontend + server
├── .env.example             # Copy to .env and fill in
├── vite.config.js           # Vite dev server; proxies /api → Express
├── tailwind.config.js       # Tailwind + `accent` color token
├── index.html               # HTML shell
├── src/                     # React frontend
│   ├── main.jsx             # React entry (Clerk goes here)
│   ├── App.jsx              # Routes (protected routes go here)
│   ├── index.css            # Tailwind directives + brand tokens
│   ├── lib/supabase.js      # Supabase client stub
│   ├── components/          # Layout, Sidebar, Header, reusable UI
│   └── pages/               # Dashboard, Members, Pipeline, Content, Analytics, Agents, Settings
└── server/                  # Express API
    ├── index.js             # App + middleware + route mounts
    └── routes/              # health, members, content, analytics
```

## ⚙️ Commands

| Command          | What it does                                                  |
| ---------------- | ------------------------------------------------------------- |
| `npm install`    | Install dependencies                                          |
| `npm run dev`    | Run Vite (frontend) and Express (API) together                |
| `npm run build`  | Build the frontend to `dist/`                                 |
| `npm start`      | Run the Express server in production (serves `dist/`)         |

Default ports: frontend **5173**, API **3001**. Change `PORT` in `.env` to move the API.

---

## ⚠️ Where NOT to delete

Search the codebase for `TODO:` — each marker is an intentional integration seam (Clerk, Supabase, branding). Don't strip them out until the corresponding feature is fully wired up; they're your roadmap.

---

## Working style

- Keep changes small and incremental — the user may not read diffs.
- After any meaningful change, suggest `npm run dev` and tell them exactly what to click or curl to verify.
- Explain new concepts plainly (the user may be non-technical).
