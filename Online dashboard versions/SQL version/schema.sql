-- ============================================================================
-- ANCHOR (step 2) — orphans dashboard SQL schema (Postgres / Supabase)
-- Column names = the dashboard's own keys (quoted), so the REST API returns
-- objects the engine already understands. Run this in Supabase → SQL Editor.
-- ⚠ SECURITY: this creates OPEN tables so the seed can load. Row-Level Security
--   (who can read/write) is added in STEP 3 (CONNECT) — do NOT expose the API
--   publicly until RLS is enabled. See SETUP.md.
-- ============================================================================

create table if not exists orphans (
  "id" text primary key,
  "famId" text,
  "first" text,
  "father" text,
  "grand" text,
  "family" text,
  "dob" text,
  "age" integer,
  "nat" text,
  "gender" text,
  "fatherFull" text,
  "fatherDeath" text,
  "deathCause" text,
  "motherName" text,
  "motherAlive" text,
  "motherStatus" text,
  "motherWorks" text,
  "motherJob" text,
  "guardian" text,
  "relation" text,
  "guardianEdu" text,
  "income" text,
  "incomeAmt" numeric,
  "housing" text,
  "famSize" integer,
  "males" integer,
  "females" integer,
  "sonsWork" text,
  "sonsStudy" text,
  "sick" text,
  "furniture" text,
  "appliances" text,
  "bedding" text,
  "eduState" text,
  "treatment" text,
  "city" text,
  "hood" text,
  "grade" text,
  "vuln" integer,
  "priority" text,
  "dataStatus" text,
  "famDataStatus" text,
  "spStatus" text,
  "spType" text,
  "spAmount" numeric,
  "sponsor" text,
  "spStart" text,
  "spEnd" text
);
create index if not exists orphans_city_idx     on orphans ("city");
create index if not exists orphans_priority_idx on orphans ("priority");
create index if not exists orphans_sp_idx       on orphans ("spStatus");

create table if not exists visits (
  "visit_id" bigserial primary key,
  "oid" text,
  "date" text,
  "result" text,
  "next" text,
  "worker" text
);
create index if not exists visits_oid_idx on visits ("oid");

create table if not exists users (
  "email" text primary key,
  "name"  text,
  "role"  text
);
