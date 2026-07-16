# -*- coding: utf-8 -*-
"""ANCHOR (step 2) — turn the SEPARATE-step JSON into a real SQL database.

Reads data/cases.json + data/visits.json (the shared step-1 fuel) and the fixed
48-column categorization, then writes:
  - schema.sql : CREATE TABLE for orphans / visits / users (Postgres, Supabase-ready)
  - seed.sql   : INSERTs that load the data into those tables

Column names are kept in the dashboard's own keys (camelCase, quoted) so the Supabase
REST API returns objects the engine already understands — no mapping layer needed.
Run:  python build_sql.py
"""
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))

# fixed 48-col categorization → (key, postgres type). 'num' split into int vs numeric(money).
CASE_COLS = [
 ('id','text'),('famId','text'),('first','text'),('father','text'),('grand','text'),('family','text'),
 ('dob','text'),('age','integer'),('nat','text'),('gender','text'),('fatherFull','text'),('fatherDeath','text'),
 ('deathCause','text'),('motherName','text'),('motherAlive','text'),('motherStatus','text'),('motherWorks','text'),('motherJob','text'),
 ('guardian','text'),('relation','text'),('guardianEdu','text'),('income','text'),('incomeAmt','numeric'),('housing','text'),
 ('famSize','integer'),('males','integer'),('females','integer'),('sonsWork','text'),('sonsStudy','text'),('sick','text'),
 ('furniture','text'),('appliances','text'),('bedding','text'),('eduState','text'),('treatment','text'),('city','text'),
 ('hood','text'),('grade','text'),('vuln','integer'),('priority','text'),('dataStatus','text'),('famDataStatus','text'),
 ('spStatus','text'),('spType','text'),('spAmount','numeric'),('sponsor','text'),('spStart','text'),('spEnd','text'),
]
VISIT_COLS = [('oid','text'),('date','text'),('result','text'),('next','text'),('worker','text')]
NUMERIC = {k for k,t in CASE_COLS+VISIT_COLS if t in ('integer','numeric')}

cases  = json.load(open(os.path.join(HERE,'data','cases.json'),  encoding='utf-8'))
visits = json.load(open(os.path.join(HERE,'data','visits.json'), encoding='utf-8'))

# known admins (from the users tab / project history) — seed so someone can sign in as admin
USERS = [
 ('hamzeaaljabouri@gmail.com','حمزة الجبوري','admin'),
 ('sergeysurovikin.corsac@gmail.com','Admin','admin'),
]

def coldefs(cols, extra_pk=None):
    lines = []
    if extra_pk: lines.append(f'  "{extra_pk}" bigserial primary key,')
    for k,t in cols:
        pk = ' primary key' if (k=='id' and not extra_pk) else ''
        lines.append(f'  "{k}" {t}{pk},')
    lines[-1] = lines[-1].rstrip(',')
    return '\n'.join(lines)

schema = f"""-- ============================================================================
-- ANCHOR (step 2) — orphans dashboard SQL schema (Postgres / Supabase)
-- Column names = the dashboard's own keys (quoted), so the REST API returns
-- objects the engine already understands. Run this in Supabase → SQL Editor.
-- ⚠ SECURITY: this creates OPEN tables so the seed can load. Row-Level Security
--   (who can read/write) is added in STEP 3 (CONNECT) — do NOT expose the API
--   publicly until RLS is enabled. See SETUP.md.
-- ============================================================================

create table if not exists orphans (
{coldefs(CASE_COLS)}
);
create index if not exists orphans_city_idx     on orphans ("city");
create index if not exists orphans_priority_idx on orphans ("priority");
create index if not exists orphans_sp_idx       on orphans ("spStatus");

create table if not exists visits (
{coldefs(VISIT_COLS, extra_pk='visit_id')}
);
create index if not exists visits_oid_idx on visits ("oid");

create table if not exists users (
  "email" text primary key,
  "name"  text,
  "role"  text
);
"""

def sqlval(v, key):
    if v is None or v == '': return 'null'
    if key in NUMERIC:
        try: return str(float(v)) if '.' in str(v) else str(int(float(v)))
        except: return 'null'
    return "'" + str(v).replace("'", "''") + "'"

def insert(table, cols, rows):
    keys = [k for k,_ in cols]
    collist = ', '.join(f'"{k}"' for k in keys)
    tuples = []
    for r in rows:
        vals = ', '.join(sqlval(r.get(k), k) for k in keys)
        tuples.append(f'  ({vals})')
    return f'insert into {table} ({collist}) values\n' + ',\n'.join(tuples) + '\n;'

seed = "-- ANCHOR seed — loads the SEPARATE-step data. Run AFTER schema.sql.\n"
seed += "-- (Contains the foundation's real records; keep local / load into your own Supabase only.)\n\n"
seed += insert('orphans', CASE_COLS, cases) + '\n\n'
seed += insert('visits',  VISIT_COLS, visits) + '\n\n'
ulist = ',\n'.join(f"  ('{e}', '{n}', '{r}')" for e,n,r in USERS)
seed += 'insert into users ("email","name","role") values\n' + ulist + '\non conflict ("email") do update set "role"=excluded."role";\n'

open(os.path.join(HERE,'schema.sql'),'w',encoding='utf-8').write(schema)
open(os.path.join(HERE,'seed.sql'),  'w',encoding='utf-8').write(seed)
print('WROTE schema.sql (', len(CASE_COLS),'orphan cols + visits + users )')
print('WROTE seed.sql  (', len(cases),'orphans,', len(visits),'visits,', len(USERS),'users )')
print('  schema.sql:', round(os.path.getsize(os.path.join(HERE,'schema.sql'))/1024,1),'KB   seed.sql:', round(os.path.getsize(os.path.join(HERE,'seed.sql'))/1024,1),'KB')
