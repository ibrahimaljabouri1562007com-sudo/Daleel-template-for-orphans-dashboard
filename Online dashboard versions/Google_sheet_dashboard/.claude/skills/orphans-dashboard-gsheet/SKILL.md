---
name: orphans-dashboard-gsheet
description: >
  Work on the ONLINE / multi-user orphans dashboard — the served Daleel-themed dashboard that
  reads and writes the central Google Sheet via the Apps Script API (`index.html` + `dashboard.js`
  + `apps-script/Code.gs` in the Google_sheet_dashboard project). Use this whenever the user wants
  to change, fix, or extend the online/live/multi-user/google-sheet dashboard: its sign-in, roles,
  the API/data layer, the refresh, charts/stats, or the Apps Script "brain". Triggers: "the online
  dashboard", "the google sheet dashboard", "the multi-user/live dashboard", "the sign-in / roles",
  "the Apps Script / API", or edits to `Google_sheet_dashboard/index.html` / `dashboard.js` / `Code.gs`.
---

# Online (Google-Sheet) orphans dashboard

A **served, multi-user** dashboard (Chrome/Edge) that reads/writes the **central Google Sheet**
through the Apps Script Web App. The UI is the **مركز الدليل (Daleel) edition** of the local
orphans dashboard, re-pointed at the live Sheet. Read `CLAUDE.md` (root) first — it's the rules;
`_guide/ROADMAP.md` is the step map with source anchors.

## Where things live
- `index.html` — Daleel shell + **email sign-in gate** + data model + **inline theme** (no build file).
- `dashboard.js` — engine (renderers/charts/editing) + the **API data layer**:
  `signIn`/`ingest` (read), `apiUpsert`/`apiDelete` (write-through), `refreshFromSheet` (pull),
  `applyRoleUI`/`canEdit` (role gating), `apiCall` (JSONP), `API_URL`.
- `apps-script/Code.gs` — the API contract: `doGet`/`whoami`/`upsertCase`/`deleteCase`/`getRole_`.
- `assets/` (logo + fonts) · `vendor/exceljs.min.js` · `data/*.json` (offline fallback) ·
  `dashboard-old.html` (previous dashboard).

## How to make a change (ASVL)
1. **Behavior/stats/charts** → `dashboard.js`. Remember it's a **fork** of the local engine —
   not auto-synced; if the change belongs to the shared engine, port it deliberately + re-verify.
2. **Data / API** → the client side is `dashboard.js` (`apiCall` + the action helpers); the
   contract is `Code.gs`. Change a field on **both** sides (schema matches **by column name**).
   Keep **JSONP** (no `fetch()` — Apps Script has no CORS).
3. **Theme/branding** → inline in `index.html` (keep the Daleel palette; read `--accent`).
4. **Auth/roles** → `signIn`/`applyRoleUI` (client, UX only) + `getRole_` (server, the real check).
5. Rebuild: **none** — edit the files directly (served edition). Then verify.
6. **Verify**: serve, sign in with the admin email, confirm `DATA_SRC==='sheet'` + data loads,
   drive the flow, check the console. Live API down → the `data/*.json` fallback still tests the UI.

## Don't
- Don't write **real** test rows to the Sheet to verify — it holds real records (use the fallback).
- Don't re-add a local-Excel data path — data in/out is the API only.
- Don't switch JSONP to `fetch()`. Don't hardcode brand hexes. Don't hand-diverge the fork
  without noting it.

See `CLAUDE.md` for the full gotcha list (multi-account `/u/N` quirk, re-deploy keeps `/exec`,
write-push vs read-pull).
