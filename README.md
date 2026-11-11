# 📓 Logbook

A private second brain: saved links, notes, tasks, a daily journal, and a GitHub-style heatmap of the days you showed up.

**Status:** Phase 0 — foundation, private login, dashboard with daily attendance + heatmap.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

No database setup needed locally: without `DATABASE_URL` the app uses an embedded Postgres (PGlite) stored in `.data/`.
Your password and session secret live in `.env.local` (copy `.env.example` if it's missing).

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` / `npm run lint` | Type check / lint |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to the database in `DATABASE_URL` (Supabase) |

## Deploy (Vercel + Supabase, free tiers)

1. **Supabase** → New project. Then *Project Settings → Database → Connection string → Transaction pooler* (port 6543). Copy it.
2. Create the tables once from your machine:
   ```bash
   DATABASE_URL="postgresql://…:6543/postgres" npm run db:migrate
   ```
3. **GitHub** → push this repo (private).
4. **Vercel** → Import the repo → *Environment Variables*:
   - `APP_PASSWORD` — a long password only you know
   - `SESSION_SECRET` — `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
   - `APP_TIMEZONE` — `Asia/Kolkata`
   - `DATABASE_URL` — the Supabase string from step 1
   - `GOOGLE_CALENDAR_ICS_URLS` — optional, see below
5. In Vercel → Settings → **Deployment Protection**, turn it on for Preview deployments.
6. Deploy. Every page is behind the password; search engines are told not to index.

## Google Calendar

The dashboard shows today's events and `/calendar` shows the next 14 days. Data is fetched from Google at most once an hour (or immediately via **Refresh**).

1. calendar.google.com → ⚙ Settings → your calendar → **Integrate calendar** → copy **Secret address in iCal format**.
2. Set `GOOGLE_CALENDAR_ICS_URLS` in `.env.local` and in Vercel (comma-separate several calendars).
3. Treat it like a password. If it leaks, click **Reset** next to it in Google and update the env var.

If your college Google Workspace account hides the secret address, use a personal Gmail calendar, or ask for the OAuth version.

## How the heatmap works

| Mode | A square is green when… |
|---|---|
| **Attendance** (default) | you pressed *Mark today present* that day |
| **Tasks done** | you completed tasks — darker = more (arrives with the Tasks page) |
| **Combined** | attendance + tasks together |

"Today" rolls over at midnight in `APP_TIMEZONE`. A streak isn't broken until a whole day passes without activity.

## Project layout

```
src/
  app/(app)/        signed-in pages (dashboard, later: library, tasks, …)
  app/login/        password screen
  components/       sidebar, heatmap, check-in card
  db/               Drizzle schema + client (PGlite locally, Supabase in prod)
  lib/              dates, heatmap maths, auth (session, password, rate limit)
  middleware.ts     locks every route behind the session cookie
drizzle/            SQL migrations
```

## Roadmap

- [x] **Phase 0** — app shell, private login, daily attendance, heatmap, Google Calendar
- [ ] **Phase 1** — Library: folders, link cards with previews, tweet embeds, ⌘K capture, Chrome bookmarks import
- [ ] **Phase 2** — Tasks (Daily / Upcoming / Roadmap), Time Table, task-based heatmap
- [ ] **Phase 3** — Notes editor, Journal, Lists, Opportunities, Paths
- [ ] **Phase 4** — Insights charts + knowledge graph
- [ ] **Phase 5** — One-time Notion migration, Chrome extension, installable mobile app
