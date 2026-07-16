# Project conventions — Orphans Dashboard (SQL / Supabase edition)

The judgment layer: **how** to work here so a change stays clean and secure. Pair it with
`README.md` (the *what*) and `_guide/ROADMAP.md` (the *steps*, with source anchors).

## What this is
The **online, database-secured** edition — the Daleel orphans dashboard re-pointed at a real
**Supabase Postgres** backend, with **real Auth (email+password)** and **RLS** enforcing access
*inside the database*. It's a **fork** of the Google-Sheet edition's dashboard: same engine, but
the data + auth layer is Supabase, not Apps Script.

- `index.html` — the shell + Daleel theme + the **login gate** (email + password) + the
  **bulk-import modal** (`#ximp`, opened by `#t-import` beside «إضافة حالة»).
- `dashboard.js` — engine (rendering/charts/editing) + the **supabase-js data layer**
  (`sb.auth.signInWithPassword`, `sb.from(...).select/upsert/delete`, `loadAfterAuth`, session
  auto-resume) + the **Excel bulk import** (`downloadTemplate` full mould → `importBuffer` →
  `validate`/`showReport` gatekeeper → `uploadImport` chunked upsert). `SUPA_URL`/`SUPA_KEY`
  inline. Served → **versioned `?v=N`**.
- `vendor/supabase.js` (auth + queries) · `vendor/exceljs.min.js` (mould + report, WRITE) ·
  `vendor/xlsx.full.min.js` (SheetJS — import READ; ExcelJS's reader chokes on the mould's
  full-column validations, same lesson as the local edition).
- The database (in Supabase): tables `orphans`/`visits`/`users`, RLS policies, `my_role()`, the
  `on_auth_user_created` trigger. **Not in this repo** — it lives in the Supabase project.

## The rules that govern everything
1. **The real guard is RLS in the database — not the client.** The role UI (hide buttons, mask
   names) is *convenience*. Never rely on it for security; the enforcement is the RLS policies.
   Never re-introduce an open `using(true)` policy, and never add an offline/local fallback that
   serves real data without a login.
2. **Data layer = supabase-js (`sb.*`), authenticated.** Reads/writes go through the logged-in
   session token. Don't add a path that uses the publishable key alone for data (that's the anon
   role → RLS gives it nothing, by design).
3. **`dashboard.js` is served → bump `?v=N`** in `index.html` on every `dashboard.js` edit (browsers
   cache it — this bit us once), **and rebuild the standalone** (`python build_sql_standalone.py`).
   Currently `?v=6`. The standalone `dashboard-sql.html` is **generated** — never hand-edit it.
   It's a *served* app — **must be opened via a hosted URL, not `file://`** (mobile blocks
   localStorage/CORS on `file://` → silent login failure; `safeStorage` keeps init from *crashing*,
   but hosting is the real fix).
4. **Never write real test rows to the live DB to verify.** It holds real records. To test a write,
   add a clearly-marked row (`ZZ-TEST-…`) and delete it in the same check (self-clean).
5. **It's a fork of the sheet edition's engine** — shared *in spirit*, not auto-synced. Port shared
   improvements deliberately and re-verify.
6. **Generated artifacts follow the brand theme.** The mould and report headers read the page's
   tokens at runtime (`themeTok('--accent')` fill + `--gold` underline) — never hardcode a hex.
   Everything a branded project emits should look like the brand (user rule, 2026-07-16).
7. **Bulk import is ONE-WAY and rule-fixed.** The Excel file is a *vehicle* into the DB — never
   re-add a file link/sync-back (that's the local edition). The conflict rule is **upsert by
   `id`** (existing = update, new = add; visits = insert-only, deduped) — user-chosen; don't
   change it silently. In-file duplicate ids MUST be collapsed before upsert (Postgres rejects
   one upsert touching the same row twice). Keep the gatekeeper report + explicit «رفع» click —
   never auto-upload on file pick. Chunked (`CHUNK=400`) for payload/timeout safety, not cost.

## Auth + roles (the model)
- **Login** = Supabase Auth (email+password), in our own gate (`signInWithPassword`, no redirect).
- **Role** = the `users` table (email→role); `my_role()` reads it by `auth.jwt()->>'email'`.
- Policies: `to authenticated` — read if `my_role() is not null`, write if `in('admin','editor')`.
- **Adding a user = two email-linked places:** Auth→Users (login) + `users` table (role). The
  `on_auth_user_created` trigger auto-creates a `viewer` row; promote in the `users` table.
- `normRole()` trims/lowercases role values (a manual cell once carried a trailing `\n`).

## Supabase config that MUST hold
- Email provider **on**; **Confirm email OFF** (we send no emails → users can't self-confirm);
  **Allow new signups OFF** (else anyone self-registers and the trigger + read policy leak data).
- The **publishable key** is public by design — safe *because* RLS refuses it without a login.
- Real users need **6+ char** passwords (Supabase minimum).

## The data model / migration
Tables use the dashboard's **own keys as column names** (quoted, camelCase) so the API returns
engine-ready objects — no mapping. Changing a field ripples: edit `build_sql.py` (schema),
re-migrate, and change it on the app side too (matched **by name**).

## ASVL (verify before reporting)
Serve it, **log in** (a test admin), confirm data loads + a write round-trip works, and prove the
guard is real: a request **without a token** (raw `curl` with just the key) must be **refused**
(read `[]`, write `401 violates row-level security`). Check the console. Don't verify by writing
real rows.
