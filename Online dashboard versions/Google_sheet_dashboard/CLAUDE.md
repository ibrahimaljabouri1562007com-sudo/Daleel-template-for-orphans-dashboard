# Project conventions — Orphans Dashboard (Google-Sheet / online edition)

The judgment layer: **how** to work here so a change stays clean. Pair it with the
`_guide/` docs — `ROADMAP.md` (the steps, with source anchors) and `BUILD-PLAN.md` (the
narrative plan). The human how-to lives in `sheets-dashboard-guidebook/`.

## What this is
A **served, multi-user** dashboard (Chrome/Edge, opened as a static page — not an offline
single file). It reads/writes the **central Google Sheet** through the Apps Script Web App.
The visible dashboard is the **مركز الدليل (Daleel) edition** of the local orphans dashboard,
re-pointed at the live Sheet.

- `index.html` — Daleel-themed shell + **email sign-in gate** + the data model + inline theme.
- `dashboard.js` — the **engine** (rendering / charts / editing) with the **data layer wired
  to the API** (`ingest` ← `apiCall`; write-through `apiUpsert`/`apiDelete`; `refreshFromSheet`).
- `apps-script/Code.gs` — the **API contract** (the "road/brain"): `doGet`/`doPost`, `whoami`,
  `upsertCase`/`deleteCase`, `getRole_`. Deployed as one `/exec` URL = `API_URL` in `dashboard.js`.
- `assets/` (Daleel logo + fonts, external) · `vendor/exceljs.min.js` (report export) ·
  `data/*.json` (offline/dev fallback) · `dashboard-old.html` (the previous dashboard).

## The rules that govern everything
1. **`dashboard.js` is a FORK of the local engine** (`…/Local doshboard/base version/app.js`).
   The renderers/editing are shared *in spirit*, **not auto-synced**. If you improve the shared
   engine logic, port the change deliberately and re-verify here — and vice-versa.
2. **The data layer is the API, never local Excel.** Don't re-add a file/import path. All data
   in = `apiCall` READ; all data out = `apiUpsert`/`apiDelete`. `Code.gs` is the contract; if
   you change a field, change it on **both** sides (the schema matches **by column name**).
3. **The theme is inline in `index.html`** (served edition — there is **no build file** here,
   unlike the local single-file builds). Assets are external in `assets/`. Keep the Daleel
   palette; read `--accent` at runtime, don't hardcode hexes.
4. **Never ship or seed real data.** The Sheet holds **real** orphan records — do not write test
   rows to it during verification. Use the `data/*.json` fallback (offline mode) to exercise the
   UI. The demo path is read-only by design.

## Auth model
Identity is a **soft email gate**: `signIn` → `whoami` → role from the المستخدمون tab
(`getRole_`). Client gating (`applyRoleUI`): **viewer** = read-only + masked names; **editor/
admin** = edit. This is UX, not security — **the backend re-checks every write** (`getRole_`
must return editor/admin or the write is refused).

## Data freshness (two-way)
- **Writes push automatically** (dashboard → Sheet), immediately on save/delete.
- **Reads don't auto-pull.** The client loads once and caches; use the **"⟳ تحديث"** button
  (`refreshFromSheet`) to pull other editors' changes — no reload, keeps filters. (True for any
  read-once client, not just this one.)

## Gotchas
- **JSONP** everywhere — Apps Script can't send CORS headers, so reads *and* writes ride a
  `<script>` callback (`apiCall`). Don't switch to `fetch()`.
- **Multi-account quirk:** a browser signed into several Google accounts can redirect
  `script.google.com` to `/u/N/` and error; anon/single-account/incognito work.
- **Re-deploying** the Apps Script (Manage deployments → new version) **keeps the same `/exec`**
  URL — no need to change `API_URL`.

## ASVL (verify before reporting)
Serve it, sign in (admin email), confirm data loads from the Sheet (`DATA_SRC==='sheet'`),
drive the affected flow, check the console. If the live API isn't reachable, the `data/*.json`
fallback still exercises the UI. **Don't** verify by writing real rows to the Sheet.
