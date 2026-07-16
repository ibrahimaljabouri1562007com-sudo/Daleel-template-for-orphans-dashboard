# ROADMAP — Orphans Dashboard (Google-Sheet / multi-user edition)

The **step inventory** with source anchors and catalog tags. The narrative plan (goal,
architecture, permissions) lives in `BUILD-PLAN.md`; this file is the reachability layer —
which step, where it lives, and whether it's isolated in the catalog.

**How to use:** if a step is ordered and it's not in the catalog, come here → open the
`source:` anchor. For the *why/plan*, read `BUILD-PLAN.md`.

**Legend:** `🟢 in catalog` · `— project-only`. Anchors = file/**function**, not line numbers.

---

## The borders (from BUILD-PLAN.md)
- Turn a static HTML dashboard (data frozen in the code) into a **multi-user** app (<10
  users) sharing **one source of truth**, all inside Google, no server to run.
- Three parts (see `Productivity/VOCABULARY.md` → **brain/road**): **Sheet** = truth ·
  **Apps Script web app** = the guarded road/brain · **dashboard** = the windows.
- Users never touch the Sheet — only the admin; everyone else goes through the guarded app.

---

## The steps — SEPARATE → ANCHOR → CONNECT → BUILD  🟢 in catalog (the whole method)

### Step 1 — SEPARATE ✅
Strip the frozen `DATA` / `VISITS` arrays out of the HTML; the dashboard fetches them before
render (JSON fallback in `data/`).
- source: `index.html` (fetch-before-render) · `data/cases.json`, `data/visits.json`.

### Step 2 — ANCHOR ✅
Move the data into one Google Sheet (tabs: الأيتام 300/48-col · الزيارات 544 · المستخدمون).
Excel verified 100% match. `source-of-truth.xlsx` is the local mirror.
- source: `source-of-truth.xlsx` · the Sheet (external).

### Step 3 — CONNECT ✅  🟢 in catalog
Apps Script web app = the API. **JSONP both ways** (Apps Script can't send CORS headers): the
dashboard loads `?callback=NAME&action=…` via a `<script>` tag; `reply_()` wraps output as
`NAME(json)`. Writes ride GET params. Permissions checked in `getRole_` against the
المستخدمون tab (admin/editor/viewer). A `cloudflare-worker.js` exists as an alternative
CORS-proxy path.
- source: `apps-script/Code.gs` → `doGet`, `doPost`, `reply_`, `readAll_`, `getRole_`,
  `upsertCase_`, `deleteCase_`, `deriveRow_` · `cloudflare-worker.js` · `index.html` (JSONP loader).
- catalog: **JSONP read/write bridge** (Reachable).

### Step 4 — BUILD ✅ dashboard replaced with the Daleel edition
The Step-4 dashboard was swapped for the **local Daleel dashboard's UI/engine**, re-wired to
the live Sheet. Same google-sheet functionality (sign-in, role-gated view/edit, live
read/write) with the richer Daleel analytics (KPIs, 10 charts, formatted report) + green/gold
theme. The local version was NOT touched — this is an adapted fork.
- **Data layer swapped**: the Daleel engine's Excel/File-System layer → the JSONP API
  (`ingest` ← `apiCall`, write-through via `apiUpsert`/`apiDelete`). Sign-in gate replaces the
  package-picker onboarding; old file-**sync/autosave/session removed**. Writes push
  automatically (dashboard→sheet); a lightweight **"⟳ تحديث"** button pulls the latest
  (sheet→dashboard, catching other editors' edits) via `refreshFromSheet` — no page reload,
  keeps filters/search/page. Offline/dev fallback to `data/*.json`.
- **Auth**: email sign-in → `whoami` role; viewer = read-only + masked names, editor/admin = edit.
- source: `index.html` (Daleel shell + sign-in gate, generated from the local base + theme) ·
  `dashboard.js` (engine fork: renderers/editing kept, data layer = API) · `assets/` + `vendor/exceljs`.
- verified live: signed in (admin) → **302 cases + 544 visits** from the Sheet, 5 KPIs, 10 charts,
  role masking, light/dark, editor modal (48 fields), 0 console errors. (Live writes not
  exercised — the Sheet holds real records; write path reuses the proven JSONP channel.)
- previous dashboard kept as `dashboard-old.html`.
- catalog 🟢: **Re-point a dashboard onto a live backend** · **JSONP sign-in + role-gated UI** ·
  **Write-through + on-demand refresh** (harvested into `Productivity/TRANSFER-CATALOG.md`).

---

## Open / next (Step-4 remaining)
- Multi-account quirk: a browser signed into multiple Google accounts redirects
  `script.google.com` to `/u/N/` and errors (anon/single/incognito work).
- Visit add/edit + delete button (brain has `deleteCase_`).
- Align view-masking role vs edit-permission role.
- A real login screen (identity is soft: localStorage email + prompt).
- Upgrade trigger (not now): >~20 users / heavy roles → Supabase or Flask (see
  `orphans-sql-approach-thread` memory).

> Full plan + permissions matrix: `BUILD-PLAN.md`. Continuity: `orphans-dashboard-build` memory.
