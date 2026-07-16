---
name: orphans-dashboard-sql
description: >
  Work on the SQL / Supabase edition of the orphans dashboard — the online, multi-user,
  database-secured dashboard backed by Supabase (Postgres) with real email+password login
  and RLS-enforced access (`index.html` + `dashboard.js` + `vendor/supabase.js` in the
  SQL version project). Use this whenever the user wants to change, fix, or extend the
  Supabase/SQL dashboard: its login/Auth, roles/RLS, the supabase-js data layer, the
  migration (schema/seed/CSV), the standalone build, charts/stats, or Supabase config.
  Triggers: "the SQL dashboard", "the Supabase dashboard", "the Postgres version", "the
  login/RLS/auth", "the secured online dashboard", or edits to `SQL version/dashboard.js`
  / `index.html` / `schema.sql` / the RLS policies.
---

# SQL / Supabase orphans dashboard

The **online, database-secured** edition — the Daleel orphans dashboard re-pointed at a
real **Supabase Postgres** backend, with **real Auth (email+password)** and **RLS** enforcing
access *inside the database*. A **fork** of the Google-Sheet edition's engine (same rendering,
different data + auth layer). Read `CLAUDE.md` first (the rules); `_guide/ROADMAP.md` is the
step map with source anchors.

## Where things live
- `index.html` — shell + Daleel theme + **login gate** (email + password). Served → **`?v=N`**.
- `dashboard.js` — engine + **supabase-js data layer** (at the bottom): `sb.auth.signInWithPassword`,
  `sb.from(...).select/upsert/delete`, `loadAfterAuth`, `refreshFromDb`, session auto-resume,
  `normRole`, `pickCols`. `SUPA_URL`/`SUPA_KEY` inline. *(Excel-onboarding functions above are
  inherited-but-unused dead code — don't wire them.)*
- `vendor/supabase.js` (auth+queries) · `vendor/exceljs.min.js` (report export).
- The **database** (in Supabase, not this repo): tables `orphans`/`visits`/`users`, RLS policies,
  `my_role()`, the `on_auth_user_created` auto-sync trigger.
- `build_sql.py`/`make_csv.py` (migration) · `schema.sql`/`seed.sql`/CSVs · `SETUP.md`.
- `dashboard-sql.html` — the **generated standalone** (inlines everything; rebuild, don't hand-edit).

## How to make a change (ASVL)
1. **Behavior/stats/charts/editing** → `dashboard.js` (it's a fork — port shared fixes deliberately).
2. **Data / auth** → the supabase-js layer (client) + the **RLS SQL** (server). The real guard is RLS.
3. **Theme** → inline in `index.html` (keep the Daleel palette).
4. If you edited `dashboard.js`: **bump `?v=N`** in `index.html`, and **rebuild the standalone**
   (`python build_sql_standalone.py`).
5. **Verify**: serve, **log in** (test admin), data loads + a write round-trip works, and prove RLS
   is real — a no-token `curl` is refused (read `[]`, write `401`). Check the console.

## Don't
- Don't rely on the client role UI for security — **RLS is the guard.** Never re-open a
  `using(true)` policy or add a data-leaking offline fallback.
- Don't use the publishable key alone for data (anon role → RLS gives nothing, by design).
- Don't write **real** test rows to the live DB (add a `ZZ-TEST-…` row and delete it).
- Don't hand-edit `dashboard-sql.html` — rebuild it.

## Supabase config that must hold
Email provider **on** · **Confirm-email OFF** · **Allow new signups OFF**. Adding a user = create
the login (Auth→Users) → trigger makes a `viewer` row → promote in the `users` table. Real users
need 6+ char passwords.

See `CLAUDE.md` for the full gotcha list.
