# لوحة تحليل حالات الأيتام — SQL edition (Supabase)

The **online, multi-user, database-secured** edition of the orphans dashboard (مركز الدليل
theme). Same UI and statistics as the other editions — but the source of truth is a real
**Supabase Postgres** database, with **real login (email + password)** and **access enforced
inside the database (Row-Level Security)**.

> Runs in the browser (served page). Users open it, **log in**, and see the dashboard.

---

## Why this edition
The Google-Sheet edition is great for a small team, but a spreadsheet-as-database is limited on
two fronts this edition fixes:
1. **Multi-user / scale** — a real database (Postgres) handles many concurrent users + fast queries.
2. **Real security** — **Supabase Auth** (a genuine login) + **RLS** (the database itself checks
   who you are and what you may do). A request with no valid login gets **nothing** — even if it
   skips the dashboard and hits the API directly.

## How access works
- **Login** — email + password, in this dashboard's own screen (no redirect). Auth verifies you
  and issues a session token used on every request.
- **Roles** — your `role` in the `users` table: `admin`/`editor` = full edit · `viewer` (or empty)
  = read-only + masked names · not listed / not logged in = no access.
- The client shows/hides tools for convenience, but the **database is the real guard** — it refuses
  unauthorized reads/writes regardless of the dashboard.

## Managing your team (no code, ever)
A user = **two things, matched by email:**
1. **Login** → Authentication → Users → *Add user* (email + password).
2. **Role** → the `users` table (`admin`/`editor`/`viewer`).

An **auto-sync trigger** makes step 2 automatic: a new login auto-gets a `viewer` row — you only
edit the `users` table to *promote* someone. Remove access = delete the login.

## Repository layout
```
SQL version/
├── index.html              ← the dashboard (Daleel theme + login gate)   [served]
├── dashboard.js            ← engine + Supabase-Auth data layer (versioned ?v=N)
├── vendor/                 ← supabase.js (auth+queries) · exceljs (report export)
├── assets/                 ← Daleel logo + fonts
├── data/                   ← cases.json / visits.json (the SEPARATE-step source, for migration)
├── build_sql.py · make_csv.py   ← JSON → schema.sql + seed.sql + CSVs (the migration)
├── schema.sql · seed.sql · *.csv
├── dashboard-sql.html      ← GENERATED standalone (one file: everything inlined) — deploy this
├── build_sql_standalone.py ← inlines index.html+dashboard.js+vendor+assets → dashboard-sql.html
├── SETUP.md                ← standing-up a Supabase project, step by step
├── CLAUDE.md               ← conventions for editing this edition
└── _guide/                 ← ROADMAP.md (build steps + anchors) · ABOUT.md
```

## Deploying it (the standalone)
`dashboard-sql.html` is the **single-file deploy artifact** — supabase-js, ExcelJS, the engine, the
logo and fonts are all inlined. Drop that one file on **any static host** (GitHub Pages, Netlify, a
folder) and it's the live, secured dashboard (it connects to Supabase at runtime — internet needed,
that's the point). Don't hand-edit it — change `index.html`/`dashboard.js` and re-run
`python build_sql_standalone.py`.

> ⚠ **Open it via a hosted URL, not as a local file** — especially on phones. Mobile browsers
> restrict `file://` (localStorage + CORS), which can make the login silently fail. It's a *served*
> app: host the one file (e.g. **Netlify Drop** — drag & drop for an instant URL, GitHub Pages,
> Cloudflare Pages) and open that URL.

## Standing it up on a fresh Supabase
See **SETUP.md** — in short: create the project → run `schema.sql` → import the CSVs → run the
Auth+RLS SQL (policies + `my_role()` + the trigger) → set Supabase config (Email on, **Confirm-email
OFF**, **Allow-signups OFF**) → create users → paste the project URL + publishable key into
`dashboard.js`.

Requires Python 3 (stdlib only) for the migration. Chrome/Edge to use it.
