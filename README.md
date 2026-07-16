# Daleel — Orphans Case-Analytics Dashboard (template · 3 editions)

A reusable dashboard for a charitable foundation's orphan-care data. **Three editions** share the
same UI and statistics but differ in *where the data lives*:

| Edition | Data source | Best for |
|---|---|---|
| **`Local doshboard/`** | your own local Excel (offline, File System Access API) | one machine, no internet |
| **`Online dashboard versions/Google_sheet_dashboard/`** | a Google Sheet via Apps Script | a small team, spreadsheet-friendly |
| **`Online dashboard versions/SQL version/`** | **Supabase (Postgres)** — real login + RLS | multi-user, secured, scalable |

Each folder has its own `README.md`, `CLAUDE.md`, and `_guide/ROADMAP.md`. The two online editions
follow the same shared plan (**SEPARATE → ANCHOR → CONNECT → BUILD**) — only the backend differs.

## ⚠ No real data in this repo — by design
Real orphan records (PII) are **git-ignored** (see `.gitignore`). The hosted editions read from
their **live backend** (Supabase / the Google Sheet) or your **local Excel**; the standalone `.html`
files ship with **synthetic** demo data. **Never commit real records.** The security lives in the
backend (Supabase Auth + RLS), *not* in hiding these files.

## Hosting (GitHub Pages)
The online editions are static files, so **GitHub Pages** serves them directly:
1. Settings → Pages → deploy from `main`.
2. Each file is then a URL, e.g. the SQL dashboard at
   `…github.io/<repo>/Online%20dashboard%20versions/SQL%20version/dashboard-sql.html`.

Opening that URL shows only a **login page** — the data stays in Supabase, released only after
login, per role. So a public URL exposes *no* data. (No Flask/Render server needed: Supabase is the
guarded backend.)

> Tip: folder names with spaces become `%20` in URLs. Rename to `sql`/`google-sheet`/`local` if you
> want cleaner links.
