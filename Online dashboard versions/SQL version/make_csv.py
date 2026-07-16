# -*- coding: utf-8 -*-
"""Emit CSVs for Supabase's Table Editor import (bulk load, no paste-size limit).
Headers = the exact column names, so Supabase auto-maps them. UTF-8, proper quoting
for values containing commas (e.g. income brackets). visit_id is auto (bigserial) → omitted."""
import json, os, csv, sys
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))

CASE_KEYS = ['id','famId','first','father','grand','family','dob','age','nat','gender','fatherFull','fatherDeath',
 'deathCause','motherName','motherAlive','motherStatus','motherWorks','motherJob','guardian','relation','guardianEdu',
 'income','incomeAmt','housing','famSize','males','females','sonsWork','sonsStudy','sick','furniture','appliances',
 'bedding','eduState','treatment','city','hood','grade','vuln','priority','dataStatus','famDataStatus','spStatus',
 'spType','spAmount','sponsor','spStart','spEnd']
VISIT_KEYS = ['oid','date','result','next','worker']

cases  = json.load(open(os.path.join(HERE,'data','cases.json'),  encoding='utf-8'))
visits = json.load(open(os.path.join(HERE,'data','visits.json'), encoding='utf-8'))
USERS  = [['hamzeaaljabouri@gmail.com','حمزة الجبوري','admin'],
          ['sergeysurovikin.corsac@gmail.com','Admin','admin']]

def cell(v):
    return '' if v is None else v

def write(name, keys, rows):
    with open(os.path.join(HERE,name),'w',encoding='utf-8',newline='') as fh:
        w = csv.writer(fh)
        w.writerow(keys)
        for r in rows:
            w.writerow([cell(r.get(k)) for k in keys])

write('orphans.csv', CASE_KEYS, cases)
write('visits.csv',  VISIT_KEYS, visits)
with open(os.path.join(HERE,'users.csv'),'w',encoding='utf-8',newline='') as fh:
    w = csv.writer(fh); w.writerow(['email','name','role']); [w.writerow(u) for u in USERS]

for f in ['orphans.csv','visits.csv','users.csv']:
    p = os.path.join(HERE,f); n = sum(1 for _ in open(p,encoding='utf-8'))-1
    print(f'WROTE {f:<14} {n} rows   {round(os.path.getsize(p)/1024,1)} KB')
