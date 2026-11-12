# 📓 Logbook

A private second brain: saved links, notes, tasks, a daily journal, and a GitHub-style heatmap of the days you showed up.

**Status:** all five phases built — Library, Tasks & Time Table, Notes / Journal / Lists / Opportunities / Paths, Insights + knowledge graph, Notion import, Chrome extension and an installable phone app.

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
| `npm test` | Unit + integration tests (Vitest, in-memory Postgres) |
| `npm run typecheck` / `npm run lint` | Type check / lint |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to the database in `DATABASE_URL` (Supabase) |

## What's inside

| Section | What it does |
|---|---|
| **Dashboard** | Mark today present, heatmap (attendance / tasks / combined), today's tasks & habits, deadlines, recent saves, calendar |
| **Library** | Folders (nested), link cards with previews, X/Twitter + YouTube embeds, tags, read status, stars. **Ctrl/⌘ K** anywhere to search or paste a link |
| **Tasks** | Daily (with recurring habits + streaks), Upcoming, Roadmap (with sub-tasks), linked to Paths |
| **Time Table** | Weekly time blocks by area; copy last week; mark blocks done |
| **Notes** | Rich-text editor (headings, lists, checklists, links, code) with autosave |
| **Journal** | One page per day + mood |
| **Opportunities** | Pipeline board (inbox → result) with deadlines and countdowns |
| **Paths** | Long-term goals (e.g. *VIT → US Masters*) with notes and their own tasks |
| **Lists** | Watchlist, people to follow, anything else |
| **Insights** | Weekly charts (tasks, attendance, links), mood trend, where your hours go, and a **knowledge graph** of how folders, links, notes, tags and paths connect |

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
   - `NOTION_TOKEN`, `NOTION_ROOT_PAGE` — only while you do the one-time Notion import
5. In Vercel → Settings → **Deployment Protection**, turn it on for Preview deployments.
6. Deploy. Every page is behind the password; search engines are told not to index.

Lost a device? Sidebar → **Sign out everywhere** invalidates every existing login at once.

## Google Calendar

The dashboard shows today's events and `/calendar` shows the next 14 days. Data is fetched from Google at most once an hour (or immediately via **Refresh**).

1. calendar.google.com → ⚙ Settings → your calendar → **Integrate calendar** → copy **Secret address in iCal format**.
2. Set `GOOGLE_CALENDAR_ICS_URLS` in `.env.local` and in Vercel (comma-separate several calendars).
3. Treat it like a password. If it leaks, click **Reset** next to it in Google and update the env var.

If your college Google Workspace account hides the secret address, use a personal Gmail calendar, or ask for the OAuth version.

## Bringing your data in

### Chrome bookmarks
Library → **Import** → upload the file from Chrome's *Bookmarks Manager → ⋮ → Export bookmarks*. Folders are kept; running it again skips links you already have. Then press **Fetch previews** to fill in cards.

### Notion (one time)
1. Go to **notion.so/profile/integrations** → *New integration* → Internal, **Read content** only → copy the secret.
2. In Notion, open your top page (e.g. *Second Brain*) → **⋯ → Connections** → add the integration. Everything inside it is shared too — share the *Daily Log* database separately if it lives somewhere else.
3. Put `NOTION_TOKEN=<secret>` and `NOTION_ROOT_PAGE=<the page's link>` in `.env.local` (or Vercel), restart.
4. Library → **Import** → **Scan my Notion**. Check what each database/page becomes, then **Import everything**.

| In Notion | Becomes |
|---|---|
| Daily Tasks / Overall Tasks | Tasks (Daily / Upcoming) — status, priority, effort, due date; finished ones fill the tasks heatmap |
| Daily Time Table | Time Table blocks (entries with a time range) |
| Opportunities | Opportunities pipeline with deadlines and next actions |
| Daily Log / Journal | Journal pages + attendance for each logged day |
| AI Tools, Web Dev, Knowledge Library, … | Library folders; select options become tags |
| Research pages (*VIT → US Masters*, *MBA Path*, …) | Paths (databases inside them become Library folders) |
| *movies to watch*, *people to follow* | Lists |
| Any other page | A Note in the *Notion pages* folder |

It's safe to run again — anything already imported is skipped. Images hosted inside Notion aren't copied (their links expire); external images and links are kept. Remove the two env vars afterwards.

## Save from anywhere

- **Ctrl/⌘ K** in the app → paste a link, or type to search everything / add a task / start a note.
- **Bookmarklet** — Library → Import → drag *Save to Logbook* to your bookmarks bar.
- **Chrome extension** (`extension/` folder):
  1. `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick the `extension` folder.
  2. Enter your Logbook address (e.g. `https://your-logbook.vercel.app`) on the settings page that opens.
  3. Right-click any page / link / selected text → **Save … to Logbook**, click the toolbar icon, or press **Alt+Shift+S**.
- **Phone (Android)** — open your Logbook in Chrome → ⋮ → **Install app** (or *Add to Home screen*). Now *Share → Logbook* from any app opens a pre-filled save form.
- **iPhone** — Safari → Share → **Add to Home Screen** for the app. iOS doesn't let web apps receive shares, so add a Shortcut: *Shortcuts → New → Receive URLs from Share Sheet → URL* `https://your-logbook.vercel.app/capture?url=[Shortcut Input]` *→ Open URLs*, and turn on **Show in Share Sheet**.

Every capture path only pre-fills a form — nothing is saved until you press **Save**.

## How the heatmap works

| Mode | A square is green when… |
|---|---|
| **Attendance** (default) | you pressed *Mark today present* that day |
| **Tasks done** | you completed tasks or habits — darker = more |
| **Combined** | attendance + tasks together |

"Today" rolls over at midnight in `APP_TIMEZONE`. A streak isn't broken until a whole day passes without activity.

## Project layout

```
src/
  app/(app)/        signed-in pages (dashboard, library, tasks, timetable, notes, journal,
                    opportunities, paths, lists, insights, calendar)
  app/capture/      the save form used by the bookmarklet, extension and phone share sheet
  app/login/        password screen
  components/       sidebar, command palette, editor, charts, knowledge graph, …
  db/               Drizzle schema + client (PGlite locally, Supabase in prod)
  lib/              dates, auth, queries, link previews (SSRF-safe), importers (Chrome, Notion)
  middleware.ts     locks every route behind the session cookie
drizzle/            SQL migrations
extension/          Chrome extension (Manifest V3)
public/sw.js        minimal service worker (installable app + offline page; never caches your data)
```

## Roadmap

- [x] **Phase 0** — app shell, private login, daily attendance, heatmap, Google Calendar
- [x] **Phase 1** — Library: folders, link cards with previews, tweet embeds, ⌘K capture, bookmarklet, Chrome bookmarks import
- [x] **Phase 2** — Tasks (Daily / Upcoming / Roadmap, recurring habits), Time Table, task-based heatmap
- [x] **Phase 3** — Notes editor, Journal, Lists, Opportunities, Paths
- [x] **Phase 4** — Insights charts + knowledge graph
- [x] **Phase 5** — One-time Notion migration, Chrome extension, installable mobile app with share-to-save
