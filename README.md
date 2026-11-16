# 📓 Logbook

**A self-hosted, single-user second brain** — saved links, notes, Notion-style task databases, a Google-Calendar-style calendar, a daily journal, and a GitHub-style heatmap of the days you showed up.

Built with Next.js 15, React 19, Tailwind CSS 4, Drizzle ORM and Postgres (embedded PGlite locally, Supabase in production). Everything sits behind one password; nothing is public and search engines are told not to index it.

## Features

| Section | What it does |
|---|---|
| **Dashboard** | Mark today present, contribution heatmap (attendance / tasks / combined), today's tasks & habits, deadlines, recent saves, today's schedule |
| **Calendar** | Google-Calendar-style Day / Week / Month / 4-day / Schedule views, mini month, per-calendar toggles, overlapping-event layout, live "now" line, event popovers, Google's keyboard shortcuts (`T`, `J`/`K`, `D` `W` `M` `X` `A`). Shows your Google calendars (read-only iCal) **and** Logbook's own task due dates, deadlines and Time Table blocks |
| **Tasks** | Two Notion-style databases — **Daily Tasks** and **Overall To-Do** — with table or checklist layouts, inline Status / Due date / Priority / Effort editing, "past due" flags and search; plus recurring habits with streaks and a **Roadmap** board with sub-tasks |
| **Time Table** | Weekly time blocks by area; copy last week; mark blocks done |
| **Library** | Nested folders, link cards with previews, X/Twitter + YouTube embeds, tags, read status, stars. **Ctrl/⌘ K** anywhere to search or paste a link |
| **Notes** | Rich-text editor (headings, lists, checklists, links, code) with autosave |
| **Journal** | One page per day + mood |
| **Opportunities** | Pipeline board (inbox → result) with deadlines and countdowns |
| **Paths** | Long-term goals with notes and their own tasks |
| **Lists** | Watchlist, people to follow, anything else |
| **Insights** | Weekly charts, mood trend, where your hours go, and an interactive knowledge graph |

Also: light & dark themes, Apple-style emoji on every platform, a one-time **Notion importer**, Chrome-bookmarks import, a **Chrome extension**, a bookmarklet, and an installable **PWA** with share-to-save on Android.

## Run it locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then fill in APP_PASSWORD and SESSION_SECRET
npm run dev                  # http://localhost:3000
```

No database setup is needed locally: without `DATABASE_URL` the app uses an embedded Postgres (PGlite) stored in `.data/` (git-ignored).

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit + integration tests (Vitest, in-memory Postgres) |
| `npm run typecheck` / `npm run lint` | Type check / lint |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to the database in `DATABASE_URL` |

## Configuration

All configuration is through environment variables — see [`.env.example`](.env.example). **Never commit `.env.local`**; it is git-ignored.

| Variable | Required | Purpose |
|---|---|---|
| `APP_PASSWORD` | yes | The one password that unlocks the app (12+ chars) |
| `SESSION_SECRET` | yes | Signs the login cookie — `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `APP_TIMEZONE` | no | IANA timezone that decides when "today" rolls over |
| `OWNER_NAME` | no | First name for the dashboard greeting |
| `DATABASE_URL` | prod | Postgres connection string (e.g. Supabase transaction pooler) |
| `GOOGLE_CALENDAR_ICS_URLS` | no | Secret iCal address(es) of your Google calendars, comma-separated |
| `NOTION_TOKEN`, `NOTION_ROOT_PAGE` | no | Only while running the one-time Notion import |

## Deploy (Vercel + Supabase, free tiers)

1. **Supabase** → New project → *Project Settings → Database → Connection string → Transaction pooler* (port 6543).
2. Create the tables once: `DATABASE_URL="postgresql://…:6543/postgres" npm run db:migrate`
3. Import the repo in **Vercel** and add the environment variables above.
4. In Vercel → Settings → **Deployment Protection**, turn it on for Preview deployments.

Lost a device? Sidebar → **Sign out everywhere** invalidates every existing login at once.

## Google Calendar

1. calendar.google.com → ⚙ Settings → your calendar → **Integrate calendar** → copy **Secret address in iCal format**.
2. Put it in `GOOGLE_CALENDAR_ICS_URLS` (comma-separate several calendars) and restart.
3. Treat it like a password. If it leaks, click **Reset** next to it in Google and update the variable.

Events are cached for an hour; the **Refresh** button fetches immediately.

## Bringing your data in

### Notion (one time)
1. **notion.so/profile/integrations** → *New integration* → Internal, **Read content** only → copy the secret.
2. In Notion open your top page → **⋯ → Connections** → add the integration (everything inside it is shared too).
3. Set `NOTION_TOKEN` and `NOTION_ROOT_PAGE` (the page's link), restart.
4. Library → **Import** → **Scan my Notion**, check what each database/page becomes, then **Import everything**.

| In Notion | Becomes |
|---|---|
| Daily Tasks / Overall Tasks | Tasks → Daily Tasks / Overall To-Do (status, priority, effort, due date) |
| Time table database | Time Table blocks |
| Opportunities | Opportunities pipeline |
| Daily log / journal | Journal pages + attendance |
| Link / resource databases | Library folders (select options become tags) |
| Goal / research pages | Paths |
| "Movies", "people to follow" pages | Lists |
| Any other page | A Note |

Re-running is safe — anything already imported is skipped. Remove the two variables afterwards.

### Chrome bookmarks
Library → **Import** → upload the file from Chrome's *Bookmarks Manager → ⋮ → Export bookmarks*.

## Save from anywhere

- **Ctrl/⌘ K** in the app → paste a link, search everything, add a task or start a note.
- **Bookmarklet** — Library → Import → drag *Save to Logbook* to your bookmarks bar.
- **Chrome extension** (`extension/`): `chrome://extensions` → Developer mode → **Load unpacked** → pick the folder, then enter your Logbook address. Right-click → **Save … to Logbook**, or **Alt+Shift+S**.
- **Android** — install the PWA, then *Share → Logbook* from any app.
- **iPhone** — Add to Home Screen, plus a Shortcut that opens `https://<your-app>/capture?url=[Shortcut Input]`.

Every capture path only pre-fills a form — nothing is saved until you press **Save**.

## Project layout

```
src/
  app/(app)/        signed-in pages (dashboard, calendar, tasks, timetable, library, notes,
                    journal, lists, opportunities, paths, insights)
  app/capture/      the save form used by the bookmarklet, extension and share sheet
  app/login/        password screen
  components/       sidebar, command palette, calendar views, task tables, editor, charts, …
  db/               Drizzle schema + client (PGlite locally, Postgres in prod)
  lib/              dates, auth, queries, calendar layout, link previews (SSRF-safe), importers
  middleware.ts     locks every route behind the session cookie
drizzle/            SQL migrations
extension/          Chrome extension (Manifest V3)
public/sw.js        minimal service worker (installable app; never caches your data)
```

## Security

- Single password, rate-limited login, signed session cookies, "sign out everywhere".
- Every route is gated by middleware; secrets only ever live in environment variables.
- Link previews are fetched through an SSRF-safe client (private and loopback addresses are refused).
- Calendar feed URLs and the Notion token are never sent to the browser.
