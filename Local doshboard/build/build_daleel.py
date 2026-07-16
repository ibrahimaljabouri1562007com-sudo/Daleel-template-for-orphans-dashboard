# -*- coding: utf-8 -*-
"""
Build the مركز الدليل (Al-Daleel Center) BRANDED single-file dashboard.

Same engine/functionality/statistics as the abstracted build — only the theme
and branding differ. Reads the source in ../base version/, embeds the real
Daleel brand from ../base version/daleel-assets/ (palette from Daleel's site,
logo.png, Alexandria/Tajawal fonts), re-themes the design tokens to deep-green
+ gold, fixes the page-1 name+logo (non-editable), and writes ../dashboard-daleel.html.

Run:  python build/build_daleel.py
"""
import json, random, datetime, sys, os, base64
sys.stdout.reconfigure(encoding='utf-8')
random.seed(21)
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, '..', 'base version')
DAL  = os.path.join(BASE, 'daleel-assets')            # logo.png + fonts/*.woff2
OUT  = os.path.join(HERE, '..', 'dashboard-daleel.html')
APPJS_TAG = '<script src="app.js?v=22"></script>'

# ── synthetic demo data (identical generator to the abstracted build) ─────────
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

def rd(p,enc='utf-8'):
    with open(p,encoding=enc) as fh: return fh.read()
def b64(p):
    with open(p,'rb') as fh: return base64.b64encode(fh.read()).decode()

html=rd(os.path.join(BASE,'index.html')); appjs=rd(os.path.join(BASE,'app.js'))
xlsx=rd(os.path.join(BASE,'vendor','xlsx.full.min.js')); exceljs=rd(os.path.join(BASE,'vendor','exceljs.min.js'))

# ── brand assets → data URIs (logo + Alexandria/Tajawal fonts) ────────────────
LOGO="data:image/png;base64,"+b64(os.path.join(DAL,'logo.png'))
fonts=rd(os.path.join(DAL,'fonts','fonts.css'),'utf-8-sig')
for fn in sorted(os.listdir(os.path.join(DAL,'fonts'))):
    if fn.endswith('.woff2'):
        fonts=fonts.replace('url(./%s)'%fn, 'url(data:font/woff2;base64,%s)'%b64(os.path.join(DAL,'fonts',fn)))

# ── Daleel theme: override the design tokens + brand chrome (theme only) ───────
DALEEL_CSS = fonts + """
/* ===== مركز الدليل — brand theme (deep green + gold) ===== */
:root{
  --plane:#f4f6f1; --surface:#ffffff; --card:#ffffff;
  --ink:#213430; --ink2:#46573A; --muted:#7c857a;
  --grid:#e4e7df; --axis:#cdd2c6; --border:rgba(33,52,48,.13); --border2:rgba(33,52,48,.06);
  --s1:#46573A; --s2:#8a7d3f; --s3:#BE913B; --s4:#6f8262; --s5:#3a4d5a; --s6:#a75b3b;
  --b100:#e7ece3; --b200:#c9d5c1; --b300:#a3b599; --b400:#7d9070; --b500:#5c6f4c; --b600:#46573A; --b700:#2b3a2e;
  --good:#3f8f4f; --warning:#c99a3a; --serious:#c47a4e; --critical:#b23b3b; --good-ink:#2c6b3a;
  --accent:#46573A; --gold:#BE913B;
  --shadow:0 12px 30px rgba(33,52,48,.10),0 5px 16px rgba(33,52,48,.06);
}
:root[data-theme="dark"]{
  --surface:#18201c; --plane:#0e130f; --card:#1e2721; --ink:#f2f4ef; --ink2:#c9d2c2; --muted:#8b968a;
  --grid:#2a332b; --axis:#3a463b; --border:rgba(255,255,255,.11); --border2:rgba(255,255,255,.06);
  --b100:#2b3a2e; --b200:#37493a; --b300:#46573A; --b400:#5c6f4c; --b500:#7d9070; --b600:#a3b599; --b700:#cbd6c4;
  --accent:#a7ba9b; --gold:#d4b46a; --good-ink:#5fbf6f;
}
body{font-family:'Alexandria','Tajawal',system-ui,"Segoe UI",Tahoma,sans-serif}
#gate{background:radial-gradient(1200px 620px at 82% -12%,#e9efe1,transparent 60%),var(--plane)}
:root[data-theme="dark"] #gate{background:radial-gradient(1200px 620px at 82% -12%,#16241a,transparent 60%),var(--plane)}
.sect-lab .n{background:var(--gold)}
.topbar{border-bottom:2px solid var(--gold);min-height:64px}
#t-home{border-color:var(--accent);color:var(--accent)} #t-home:hover{background:var(--accent);color:#fff}
#g-back{background:var(--accent);border-color:var(--accent);color:#fff}
/* topbar brand = compass icon (cropped from the lockup) + wordmark + gold tagline */
.topbar .brand{align-items:center;gap:11px}
.topbar .brand .logo{position:relative;width:43px;height:44px;overflow:hidden;background:none;border:none;box-shadow:none;padding:0;flex:none}
.topbar .brand .logo img{position:absolute;height:61.6px;width:auto;max-width:none;left:-9.4px;top:-8.7px;display:block}
.topbar .brand>div{display:flex;flex-direction:column;justify-content:center;gap:3px}
.topbar .brand .name{display:block;font-size:17px;font-weight:800;color:var(--ink);letter-spacing:-.2px;line-height:1}
.topbar .brand .role{display:block;font-size:10.5px;font-weight:600;color:var(--gold);line-height:1;opacity:.95}
.daleel-hero{text-align:center;margin:4px 0 18px}
.daleel-hero img{max-width:360px;width:84%;height:auto;display:block;margin:0 auto;filter:drop-shadow(0 6px 18px rgba(33,52,48,.10))}
/* gentle brand date, centred in the topbar */
.topbar .spacer{display:flex;align-items:center;justify-content:center;padding:0 12px}
.dl-date{color:var(--gold);font-size:12.5px;font-weight:700;letter-spacing:.2px;white-space:nowrap;display:inline-flex;align-items:center;gap:7px}
.dl-date::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--gold);opacity:.7}
/* branded footer + faint compass watermark */
#app{position:relative;z-index:1}
.dl-footer{margin-top:22px;border-top:2px solid var(--gold);background:linear-gradient(180deg,#f7f9f3,var(--card));border-radius:14px;padding:18px 22px 14px;box-shadow:var(--shadow)}
.dl-foot-in{display:flex;align-items:center;gap:14px}
.dl-foot-in img{height:42px;width:auto}
.dl-foot-txt{display:flex;flex-direction:column;gap:2px}
.dl-foot-txt b{color:var(--ink);font-size:13.5px;font-weight:700}
.dl-foot-txt span{color:var(--muted);font-size:11.5px;line-height:1.6}
.dl-foot-copy{color:var(--muted);font-size:11px;border-top:1px dashed var(--border);padding-top:11px;margin-top:12px;text-align:center;letter-spacing:.2px}
:root[data-theme="dark"] .dl-footer{background:linear-gradient(180deg,#1a231c,var(--card))}
.dl-watermark{position:fixed;bottom:-26px;inset-inline-start:-24px;width:231px;height:236px;overflow:hidden;opacity:.05;pointer-events:none;z-index:0}
.dl-watermark img{position:absolute;height:330px;width:auto;max-width:none;left:-50px;top:-47px}
"""

# ── HTML transforms (theme + fixed page-1 branding) ───────────────────────────
html=html.replace('<title>لوحة تحليل حالات الأيتام</title>','<title>مركز الدليل — لوحة تحليل حالات الأيتام</title>')
html=html.replace('</head>','<style id="daleel-theme">'+DALEEL_CSS+'</style>\n</head>')
# logo hero above the gate title
html=html.replace('<h1>لوحة تحليل حالات الأيتام</h1>',
    '<div class="daleel-hero"><img id="dl-hero-img" alt="مركز الدليل للتدريب والاستشارات الإنسانية"></div>\n    <h1>لوحة تحليل حالات الأيتام</h1>')
# replace the editable "identity" section with fixed hidden stubs (name locked to مركز الدليل)
identity='''    <div class="sect-lab"><span class="n">1</span> هوية المؤسسة</div>
    <div class="field"><label>اسم المؤسسة</label><input type="text" id="g-name" placeholder="مثال: مؤسسة الرعاية الإنسانية" autocomplete="off"></div>
    <div class="field"><label>الشعار (اختياري)</label>
      <div class="logo-row"><div class="logo-prev" id="g-logo-prev">شعار</div>
        <button class="btn sm" onclick="document.getElementById('g-logo').click()">اختيار صورة</button>
        <input type="file" id="g-logo" accept="image/*" hidden></div>
    </div>'''
assert identity in html, "identity block not found (index.html changed?)"
html=html.replace(identity,'    <input type="hidden" id="g-name" value="مركز الدليل">\n    <input type="file" id="g-logo" hidden><span id="g-logo-prev" style="display:none"></span>')
html=html.replace('<span class="n">2</span> حزم البيانات','<span class="n">1</span> حزم البيانات')
html=html.replace('<span class="n">3</span> القالب والبيانات','<span class="n">2</span> القالب والبيانات')
# brand footer (inside #app) + faint watermark (body level) + date holder (topbar centre)
footer='<footer class="dl-footer"><div class="dl-foot-in"><img id="dl-foot-logo" alt="مركز الدليل"><div class="dl-foot-txt"><b>مركز الدليل للتدريب والاستشارات الإنسانية</b><span>تمكين الأفراد والمنظمات الإنسانية من تحقيق الأثر والكفاءة في العمل الإنساني</span></div></div><div class="dl-foot-copy">© 2026 مركز الدليل — جميع الحقوق محفوظة · daleelconsult.org</div></footer>'
html=html.replace('<div class="gov" id="gov"></div>','<div class="gov" id="gov"></div>\n  '+footer)
html=html.replace('<div id="tip"></div><div id="toast"></div>','<div class="dl-watermark"><img id="dl-wm-logo" alt=""></div>\n<div id="tip"></div><div id="toast"></div>')
html=html.replace('<div class="spacer"></div>','<div class="spacer"><div class="dl-date" id="dl-date"></div></div>')

# ── inline libs + engine + sample + fixed-branding script ─────────────────────
old="const [c,v]=await Promise.all([fetch('sample/cases.json').then(r=>r.json()),fetch('sample/visits.json').then(r=>r.json())]);"
new="const c=(window.SAMPLE_CASES||[]).map(x=>({...x})), v=(window.SAMPLE_VISITS||[]).map(x=>({...x}));"
assert old in appjs; appjs=appjs.replace(old,new)
esc=lambda js: js.replace('</script>','<\\/script>')
sample_js="window.SAMPLE_CASES=%s;\nwindow.SAMPLE_VISITS=%s;"%(json.dumps(cases,ensure_ascii=False),json.dumps(visits,ensure_ascii=False))
brand_js=("window.DALEEL_LOGO=%s;\ntry{BRANDING.name='مركز الدليل';BRANDING.logo=DALEEL_LOGO;"
          "var _h=document.getElementById('dl-hero-img');if(_h)_h.src=DALEEL_LOGO;"
          "var _n=document.getElementById('g-name');if(_n)_n.value='مركز الدليل';"
          "var _r=document.querySelector('.topbar .brand .role');if(_r)_r.textContent='تحليل ودعم القرار';"
          "var _fl=document.getElementById('dl-foot-logo');if(_fl)_fl.src=DALEEL_LOGO;"
          "var _wm=document.getElementById('dl-wm-logo');if(_wm)_wm.src=DALEEL_LOGO;"
          "var _dt=document.getElementById('dl-date');if(_dt){try{_dt.textContent=new Date().toLocaleDateString('ar',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}catch(_e){}}}catch(e){}"%json.dumps(LOGO))

BANNER=("<!--\n"
 "  ==========================================================================\n"
 "  لوحة تحليل حالات الأيتام — مركز الدليل  ·  STANDALONE (Al-Daleel branded)\n"
 "  Same engine/stats as the white-label build; only the theme + fixed page-1\n"
 "  branding differ. Fully offline, single file. Open in Chrome / Edge.\n"
 "  --------------------------------------------------------------------------\n"
 "  GENERATED FILE — do NOT hand-edit. Change `base version/` (shared) or\n"
 "  `build/build_daleel.py` (theme/branding) and rebuild. See README/CLAUDE.\n"
 "  ==========================================================================\n-->\n")
html=html.replace('<head>', '<head>\n'+BANNER)
html=html.replace('<script src="vendor/xlsx.full.min.js"></script>','<!-- ===== VENDOR · SheetJS (read xlsx) — third-party, minified ===== -->\n<script>'+esc(xlsx)+'</script>')
html=html.replace('<script src="vendor/exceljs.min.js"></script>',  '<!-- ===== VENDOR · ExcelJS (write & format xlsx) — third-party, minified ===== -->\n<script>'+esc(exceljs)+'</script>')
html=html.replace(APPJS_TAG,
    '<!-- ===== DEMO DATA · synthetic sample (NOT real records) ===== -->\n<script>'+esc(sample_js)+'</script>\n'
    '<!-- ===== ENGINE · app.js (shared with the white-label build) ===== -->\n<script>'+esc(appjs)+'</script>\n'
    '<!-- ===== BRANDING · fixed مركز الدليل identity (logo, name, date) ===== -->\n<script>'+esc(brand_js)+'</script>')

with open(OUT,'w',encoding='utf-8') as fh: fh.write(html)
print('WROTE', OUT, round(os.path.getsize(OUT)/1024),'KB  ·  demo:',len(cases),'cases,',len(visits),'visits')
for bad in ['src="vendor','src="app.js',"fetch('sample"]:
    assert bad not in html, 'leftover external ref: '+bad
print('  no external references ✓')
