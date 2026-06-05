# Dashboard Starter Kit

A clean, production-ready dashboard starter built with **React + Vite**, **Express**, **Tailwind CSS**, and **React Router**. Designed to be customized with [Claude Code](https://claude.com/claude-code).

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template (fill in keys later as you add integrations)
cp .env.example .env

# 3. Run the frontend and API together
npm run dev
```

Open **http://localhost:5173** for the dashboard. The API runs on **http://localhost:3001** — Vite proxies `/api/*` through automatically.

## What's included

- ✅ Collapsible sidebar + responsive mobile drawer
- ✅ Seven example pages: Dashboard, Members, Pipeline, Content, Analytics, Agents, Settings
- ✅ Express API with `/health` and placeholder routes for `/api/members`, `/api/content`, `/api/analytics`
- ✅ Tailwind set up with a single swappable `--accent` brand token
- ✅ Integration seams (marked `TODO`) for Clerk auth and Supabase — nothing installed, just ready to wire up

## What's next

Open this project in Claude Code and say "help me get started" — it'll walk you through:

1. 🎨 **Branding** the dashboard (colors, fonts, logo)
2. 🔐 **Connecting Clerk** for user auth
3. 🗄️ **Connecting Supabase** for your database
4. 🛠️ **Building your first feature**

See [CLAUDE.md](CLAUDE.md) for the full guide.

## Scripts

| Command         | Purpose                                    |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Run frontend (Vite) + API (Express)        |
| `npm run build` | Build the frontend to `dist/`              |
| `npm start`     | Serve the built frontend from Express      |

## Tech

React 18 · Vite 5 · React Router 6 · Tailwind 3 · Express 4 · Lucide icons
