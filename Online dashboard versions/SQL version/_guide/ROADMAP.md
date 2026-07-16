# ROADMAP — SQL version (Supabase)

The **SQL/Supabase** online edition. Same source-of-truth concept as its sibling
`../Google_sheet_dashboard/`, different backend. Follows the shared 4-step plan (see
`../README.md`): **SEPARATE (1) + BUILD (4) shared; ANCHOR (2) + CONNECT (3) unique to Supabase.**

**Legend:** `🟢 in catalog` · `— project-only`. Anchors = file/**function**, not line numbers.

## The borders
- Backend = **Supabase** (managed Postgres + auto REST API + auth + row-level security).
- Reuse the **Daleel dashboard UI/engine** (the "re-point onto a live backend" move) — swap only
  the data layer + auth from the sheet version.
- Never ship real data publicly; the seed loads the foundation's records into *their* Supabase only.

## The steps

### Step 1 — SEPARATE ✅ (shared)
Data already lives as plain records (`data/cases.json` + `data/visits.json`) — the shared fuel.
- source: `data/*.json`.

### Step 2 — ANCHOR ✅ (Supabase = Postgres)  — built + verified
Turn the JSON into a real SQL database: 3 tables (`orphans` 48 cols, `visits`, `users`) with the
dashboard's own keys as (quoted) column names, loaded from the JSON.
- source: `build_sql.py` (migration) → `schema.sql` (tables) + `seed.sql` (data).
- verified: loaded into a real relational DB; SQL counts match the audit exactly (169 sponsored,
  205 families, 5 critical); Arabic intact.
- user action: run `schema.sql` + `seed.sql` in Supabase (see `SETUP.md`).

### Step 3 — CONNECT ✅ (Supabase REST API, soft-gate)  — built + verified live
The dashboard's data layer now talks to Supabase over the **REST API** (clean `fetch`, no JSONP).
Soft email gate (option a): the email is looked up in the `users` table for its role; viewer =
read-only + masked, editor/admin = write. RLS policies opened read (all 3 tables) + write (orphans).
- source: `dashboard.js` → `sbGet`/`sbSend` (REST), `signIn` (users lookup + load),
  `apiUpsert` (POST upsert `resolution=merge-duplicates`), `apiDelete` (DELETE), `refreshFromDb`,
  `pickCols` (strip derived `name`) · `SUPA_URL`/`SUPA_KEY` inline · offline fallback `data/*.json`.
- project (Supabase, Frankfurt): URL `owkjpndzwwgrbkfeonzk.supabase.co`; RLS policies in the DB
  (`read_*`, `insert/update/delete_orphans`, all `using(true)` — **test-level**).
- verified live: admin sign-in → 300 cases + 544 visits from Postgres, 5 KPIs, 10 charts,
  coverage 56% (matches audit); write path insert→update→delete round-trip OK (self-cleaned);
  0 console errors.
- catalog 🟢 (harvested): **Re-point a dashboard onto a live backend** · **JSON → SQL migration** ·
  **Supabase REST data layer** · **Stand up a Supabase backend** · **Interchangeable-backend architecture**.
- gotchas: manual role cells can carry a trailing newline (`admin\n`) → `normRole` trims/lowercases;
  `dashboard.js` is served → version it `?v=N` (bump on edit, now v=2); role read at sign-in + on ⟳ refresh.

### Step 3b — HARDEN ✅ (Auth + RLS, real security)  — built + verified live
Real **Supabase Auth** (email + password, in-page — no redirect) + **RLS keyed on the logged-in
identity + `users` table**, so the **database** enforces access (not the client).
- source: `dashboard.js` (supabase-js: `sb.auth.signInWithPassword`, `sb.from(...).select/upsert/delete`,
  `loadAfterAuth`, session auto-resume via `getSession`) · `index.html` (password field, `vendor/supabase.js`, `?v=3`).
- DB: `public.my_role()` (SECURITY DEFINER, reads MY role by `auth.jwt()->>'email'`); policies
  `to authenticated` — read if `my_role() is not null`, write if `in ('admin','editor')`; `users`
  read-own-row; **auto-sync trigger** on `auth.users` insert → default `viewer` row.
- Supabase config: Email provider **on**, **Confirm email OFF**, **Allow new signups OFF** (else anyone
  could self-register + read). Add a user = create the login (Auth→Users) → trigger makes a viewer row → promote in `users`.
- verified live: no-login request → read `[]` + write `401 "violates row-level security policy"`;
  logged-in admin → 300 cases/544 visits + write round-trip OK; valid session token; 0 console errors.
- catalog 🟢 (harvested): **Supabase data layer + Auth + RLS (real security)** — folds the Auth login,
  the RLS role gate, and the auto-sync trigger into one liftable unit.

### Step 4 — BUILD ✅ (shared)
The dashboard UI/engine (KPIs, charts, editing, roles) is reused from the Daleel local dashboard
— same as the sheet version. Only ANCHOR + CONNECT differ.

### Step 5 — Docs & packaging ✅
- `README.md` (product/deploy) · `CLAUDE.md` (rules/gotchas) · `.claude/skills/orphans-dashboard-sql`
  · this `_guide/ROADMAP.md` + `ABOUT.md`.
- **Standalone:** `build_sql_standalone.py` inlines index.html + dashboard.js + vendor (supabase-js,
  ExcelJS) + logo/fonts → **`dashboard-sql.html`** (one file, ~2.1 MB; *online by design* — connects
  to the live Supabase backend at runtime). Rebuild on any source edit; don't hand-edit it.
  Verified: standalone login → 300 cases live from Supabase, admin, 0 console errors.
- code tidy: `dashboard.js` header rewritten for this edition; inherited Excel-onboarding functions
  flagged as unused dead code (kept for engine parity, safe).

### Step 6 — BULK IMPORT (Excel → DB) ✅  — the third input door
The local edition's **mould + gatekeeper**, revived and re-pointed at the database: a dedicated
button beside «إضافة حالة» opens a modal with **two actions** — download the **FULL mould** (all
packages, no picker) / **connect a filled Excel** — the gatekeeper validates, then the valid rows
are **uploaded to Postgres in chunks**.
- rule (user-chosen, option a): **UPSERT by «رقم اليتيم»** — existing id = update, new id = add;
  in-file duplicate ids collapse to the last occurrence (one upsert can't hit a row twice).
  Visits = **insert-only**, deduped against the DB (exact-row match). Idempotent → a failed run
  is safely retried with the same file.
- one-way import: the Excel file is a **vehicle**, the DB stays the source of truth — no file
  link/sync-back (that's the local edition's job), so a plain `<input type=file>` works everywhere.
- chunking (`CHUNK=400`) = delivery safety (payload size / statement timeout / progress bar) —
  NOT cost (Supabase pricing is size-based, not per-request).
- source: `index.html` (`#t-import` button, `#ximp` modal, `vendor/xlsx.full.min.js`, `?v=5`) ·
  `dashboard.js` → **downloadTemplate** (full mould), **connectExcel**/`#x-file`, **importBuffer**
  → **validate** → **showReport** (now renders in `#x-report`, proceed = «رفع إلى قاعدة البيانات»),
  **uploadImport** (chunked upsert/insert + progress), **openImport/closeImport** wiring.
- reads with SheetJS (`xlsx.full.min.js`, copied from the local edition — ExcelJS's reader chokes
  on the mould's full-column validations); writes the mould with ExcelJS. Editor/admin only
  (button hidden for viewers; RLS enforces regardless).
- **brand-themed mould** (`?v=6`): the mould's header follows the page theme at runtime —
  `themeTok('--accent')` deep-green fill + `--gold` underline (user rule: everything a branded
  project emits follows the brand; no hardcoded hex).
- DB gap found + handled: `visits` had **no write policies** (step 3b covered `orphans` only) →
  importer degrades gracefully (cases land, visits reported); fix SQL = `SETUP.md` addendum.
- API semantics proven live via authenticated curl (self-cleaned `ZZ-TEST` rows): batch upsert 201,
  re-upsert updates (not duplicates), duplicate-id-in-one-request fails (21000 — why we collapse).
- catalog 🟢: **Excel mould + gatekeeper** (existing unit, now backend-fed) + new jot: chunked
  bulk upload to a DB API.

## Open / next
- Nothing pending — built, secured (Auth + RLS), documented, packaged, and bulk-import enabled.
- (Later, separate project) the OCR ingestion door: scan → OCR → confidence gate → this same
  mould/gatekeeper/chunked-upload pipeline.
- (Optional later) custom SMTP for password-reset emails · scheduled DB backups in Supabase.
