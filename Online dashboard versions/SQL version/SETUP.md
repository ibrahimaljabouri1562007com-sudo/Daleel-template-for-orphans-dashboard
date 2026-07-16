# Setup — SQL version (Supabase)

The build is split: **I prepared all the SQL + migration** (this folder); **you do the account
steps** (I can't create accounts or hold your credentials). Do these, then hand me the two
values at the bottom and I'll wire **CONNECT** (step 3).

## Step 2 — ANCHOR (put the data in Supabase) — *your part*

1. **Create the project.** Go to [supabase.com](https://supabase.com) → sign in → **New project**
   (free tier is fine). Pick a name + a database password (save it). Wait ~2 min for it to spin up.
2. **Create the tables.** Left sidebar → **SQL Editor** → **New query** → paste **all of
   `schema.sql`** → **Run**. (Creates `orphans`, `visits`, `users` + indexes.)
3. **Load the data.** New query → paste **all of `seed.sql`** → **Run**. (Loads 300 orphans,
   544 visits, 2 admin users.) *(If the editor balks at the size, use the CSV import instead —
   tell me and I'll emit CSVs.)*
4. **Quick check.** New query → `select count(*) from orphans;` → should say **300**.
5. **Grab the two credentials.** Left sidebar → **Project Settings** → **API**:
   - **Project URL** — looks like `https://xxxxxxxx.supabase.co`
   - **anon public** key — a long token under "Project API keys"

## ⚠ Security note (important)
`schema.sql` creates **open** tables so the seed can load. **Row-Level Security (who can
read/write) is added in step 3** — until then, treat the anon key as sensitive and **don't post
it publicly or commit it**. Sharing it with me here (a private chat) is fine.

## Hand me these two values → I do step 3 (CONNECT)
```
Project URL:  https://__________.supabase.co
anon key:     __________
```
Then I will: point the Daleel dashboard's data layer at that URL (clean `fetch`, no JSONP),
add the **RLS policies + auth** (viewer read-only, editor/admin write — enforced by the
database), and **verify it live** against your Supabase.

---
*Prepared here: `schema.sql` (tables), `seed.sql` (data), `build_sql.py` (the migration, re-runnable
if the data changes), `data/` (the SEPARATE-step source).*
