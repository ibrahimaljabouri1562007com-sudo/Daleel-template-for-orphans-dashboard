# -*- coding: utf-8 -*-
"""
Build the ABSTRACTED (white-label) single-file dashboard.

Reads the source in ../base version/ (index.html + app.js + vendor/*.min.js),
inlines everything + a SYNTHETIC demo dataset (never real records) into one
self-contained HTML, and writes ../dashboard-standalone.html.

Run:  python build/build_standalone.py
"""
import json, random, datetime, sys, os
sys.stdout.reconfigure(encoding='utf-8')
random.seed(21)                                   # deterministic demo data
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, '..', 'base version')   # source
OUT  = os.path.join(HERE, '..', 'dashboard-standalone.html')
APPJS_TAG = '<script src="app.js?v=22"></script>' # the tag in index.html we replace with the inlined engine

# ── synthetic demo data (safe to distribute — no real people) ─────────────────
NAT_CITIES={'عراقية':['بغداد','البصرة','نينوى','النجف','كربلاء','بابل','ديالى','الأنبار'],
 'سورية':['دمشق','حلب','حمص','اللاذقية','درعا'],'مصرية':['القاهرة','الجيزة','الإسكندرية','أسيوط'],'أردنية':['عمّان','الزرقاء','إربد']}
males=['علي','حسن','حسين','محمد','يوسف','عمر','كرار','مصطفى','زيد','عبد الله']
females=['سارة','مريم','فاطمة','زينب','رقية','نور','آية','هدى','دعاء','بتول']
fathers=['أحمد','جاسم','كاظم','عباس','صادق','رعد','حيدر','سعد','ماجد']; grands=['صالح','خليل','مهدي','ناصر','جبار','حمزة','طالب']
families=['العبيدي','الجبوري','الزيدي','الموسوي','التميمي','الدليمي','الخفاجي','الساعدي','الربيعي']
incomes=[('لا يوجد دخل ثابت',0),('أقل من 250,000',150000),('250,000-500,000',350000),('أكثر من 500,000',650000)]
housings=['إيجار','ملك','منزل شعبي','مشاركة سكن','مخيم/سكن مؤقت']; sptypes=['سلة غذائية','ملابس','تعليم','صحة','كفالة نقدية']
edu=['حكومي','أهلي','غير منتظم']; ds=['مكتملة','تحتاج تحديث','ناقصة']; today=datetime.date(2026,7,13)
d2s=lambda d:f"{d.year:04d}-{d.month:02d}-{d.day:02d}"; prio=lambda v:'حرجة' if v>=75 else 'عالية' if v>=50 else 'متوسطة' if v>=25 else 'منخفضة'
cases=[]; visits=[]
for i in range(28):
    fem=random.random()<0.5; nat=random.choice(list(NAT_CITIES)); city=random.choice(NAT_CITIES[nat])
    age=random.randint(4,18); dob=datetime.date(today.year-age,random.randint(1,12),random.randint(1,28))
    inc,amt=random.choice(incomes); m=random.randint(0,4); f=random.randint(0,4)
    if m+f==0:m=1
    vuln=random.randint(8,92); spon=random.random()<0.55; oid=f"O{i+1:04d}"
    rec={'id':oid,'famId':f"F{random.randint(1,40):04d}",'first':random.choice(females if fem else males),'father':random.choice(fathers),
        'grand':random.choice(grands),'family':random.choice(families),'dob':d2s(dob),'nat':nat,'gender':'أنثى' if fem else 'ذكر',
        'motherName':random.choice(females)+' '+random.choice(families),'motherAlive':random.choice(['نعم','لا']),
        'guardian':random.choice(females)+' '+random.choice(families),'relation':random.choice(['الأم','الجد','الجدة','العم','الخال']),
        'income':inc,'incomeAmt':amt,'housing':random.choice(housings),'famSize':m+f+1,'males':m,'females':f,
        'sonsWork':random.choice(['نعم','لا']),'sonsStudy':random.choice(['نعم','لا']),'sick':random.choice(['نعم','لا']),
        'eduState':random.choice(edu),'treatment':random.choice(edu),'city':city,'hood':'حي '+random.choice(['الزهور','السلام','النور','الرسالة']),
        'grade':random.choice(['الأول','الثالث','السادس','الأول متوسط']),'vuln':vuln,'priority':prio(vuln),
        'dataStatus':random.choice(ds),'famDataStatus':random.choice(ds)}
    if spon:
        st=datetime.date(random.randint(2022,2025),random.randint(1,12),random.randint(1,28))
        rec.update({'spStatus':'مكفول','spType':random.choice(sptypes),'spAmount':random.choice([50000,75000,100000,125000]),
                    'sponsor':f"SP-{random.randint(1,200):03d}",'spStart':d2s(st),'spEnd':d2s(datetime.date(st.year+random.randint(1,2),st.month,min(st.day,28)))})
    else: rec['spStatus']=random.choice(['غير مكفول','قيد الدراسة','منتهية'])
    cases.append(rec)
    for _ in range(random.randint(0,3)):
        vd=today-datetime.timedelta(days=random.randint(10,360))
        visits.append({'oid':oid,'date':d2s(vd),'result':random.choice(['مستقرة','تحتاج متابعة','طارئة','بيانات غير مكتملة']),
                       'next':d2s(vd+datetime.timedelta(days=random.randint(30,120))),'worker':random.choice(fathers)+' '+random.choice(families)})

# ── read source + inline ──────────────────────────────────────────────────────
def rd(p):
    with open(os.path.join(BASE,p),encoding='utf-8') as fh: return fh.read()
html=rd('index.html'); appjs=rd('app.js'); xlsx=rd(os.path.join('vendor','xlsx.full.min.js')); exceljs=rd(os.path.join('vendor','exceljs.min.js'))

# point loadSample() at the inlined sample instead of a fetch()
old="const [c,v]=await Promise.all([fetch('sample/cases.json').then(r=>r.json()),fetch('sample/visits.json').then(r=>r.json())]);"
new="const c=(window.SAMPLE_CASES||[]).map(x=>({...x})), v=(window.SAMPLE_VISITS||[]).map(x=>({...x}));"
assert old in appjs, "loadSample fetch line not found"
appjs=appjs.replace(old,new)
esc=lambda js: js.replace('</script>','<\\/script>')   # keep inlined JS from closing the <script> early
sample_js="window.SAMPLE_CASES=%s;\nwindow.SAMPLE_VISITS=%s;"%(json.dumps(cases,ensure_ascii=False),json.dumps(visits,ensure_ascii=False))

BANNER=("<!--\n"
 "  ==========================================================================\n"
 "  لوحة تحليل حالات الأيتام — Orphans Case Analytics  ·  STANDALONE (white-label)\n"
 "  Fully offline, single file. Open by double-click in Chrome or Edge.\n"
 "  --------------------------------------------------------------------------\n"
 "  GENERATED FILE — engine + Excel libraries + a SYNTHETIC demo dataset are\n"
 "  all inlined below. Do NOT hand-edit: change the source in `base version/`\n"
 "  (index.html + app.js) and rebuild with `build/build_standalone.py`.\n"
 "  See README.md and CLAUDE.md.\n"
 "  ==========================================================================\n-->\n")

html=html.replace('<head>', '<head>\n'+BANNER)
html=html.replace('<script src="vendor/xlsx.full.min.js"></script>',   '<!-- ===== VENDOR · SheetJS (read xlsx) — third-party, minified ===== -->\n<script>'+esc(xlsx)+'</script>')
html=html.replace('<script src="vendor/exceljs.min.js"></script>',     '<!-- ===== VENDOR · ExcelJS (write & format xlsx) — third-party, minified ===== -->\n<script>'+esc(exceljs)+'</script>')
html=html.replace(APPJS_TAG,
    '<!-- ===== DEMO DATA · synthetic sample (NOT real records) ===== -->\n<script>'+esc(sample_js)+'</script>\n'
    '<!-- ===== ENGINE · app.js (dashboard logic — the readable part) ===== -->\n<script>'+esc(appjs)+'</script>')

with open(OUT,'w',encoding='utf-8') as fh: fh.write(html)
print('WROTE', OUT, round(os.path.getsize(OUT)/1024),'KB  ·  demo:',len(cases),'cases,',len(visits),'visits')
for bad in ['src="vendor','src="app.js',"fetch('sample"]:
    assert bad not in html, 'leftover external ref: '+bad
print('  no external references ✓')
