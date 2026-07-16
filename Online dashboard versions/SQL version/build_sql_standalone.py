# -*- coding: utf-8 -*-
"""WRAP the SQL / Supabase edition into ONE standalone HTML file.

Inlines the LOCAL deps — supabase-js + ExcelJS (vendor), the engine (dashboard.js),
the Daleel logo + fonts (as data URIs) — into a single `dashboard-sql.html`.

NOTE: this file is single-file but **online by design** — it connects to the live
Supabase (Postgres) backend at runtime (real login + RLS). That HTTPS call is the
intended dependency, not something to inline. Host the one file on any static host.

Base files (index.html, dashboard.js, vendor/, assets/) are preserved untouched.
Run:  python build_sql_standalone.py
"""
import os, base64, json, sys
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))

def rd(p, enc='utf-8'):
    with open(p, encoding=enc) as f: return f.read()
def b64(p):
    with open(p, 'rb') as f: return base64.b64encode(f.read()).decode()

html    = rd(os.path.join(HERE, 'index.html'))
supajs  = rd(os.path.join(HERE, 'vendor', 'supabase.js'))
exceljs = rd(os.path.join(HERE, 'vendor', 'exceljs.min.js'))
dashjs  = rd(os.path.join(HERE, 'dashboard.js'))

# ── brand assets → data URIs (logo + Alexandria/Tajawal fonts) ──────────────
LOGO  = 'data:image/png;base64,' + b64(os.path.join(HERE, 'assets', 'logo.png'))
fonts = rd(os.path.join(HERE, 'assets', 'fonts', 'fonts.css'), 'utf-8-sig')
for fn in sorted(os.listdir(os.path.join(HERE, 'assets', 'fonts'))):
    if fn.endswith('.woff2'):
        fonts = fonts.replace('url(./%s)' % fn,
                              'url(data:font/woff2;base64,%s)' % b64(os.path.join(HERE, 'assets', 'fonts', fn)))

esc = lambda js: js.replace('</script>', '<\\/script>')     # so inlined JS can't close the tag
dashjs = dashjs.replace("'assets/logo.png'", 'window.__DL_LOGO')   # logo path → the inlined data URI

BANNER = ("<!--\n"
 "  ==========================================================================\n"
 "  لوحة تحليل حالات الأيتام — SQL / Supabase edition  ·  STANDALONE (single file)\n"
 "  Inlines supabase-js + ExcelJS + engine + Daleel logo/fonts into one .html.\n"
 "  ONLINE by design: connects to the live Supabase (Postgres) backend at runtime,\n"
 "  with real login (email+password) + RLS. Deploy the one file to any static host.\n"
 "  --------------------------------------------------------------------------\n"
 "  GENERATED — do NOT hand-edit. Change index.html / dashboard.js and rebuild via\n"
 "  build_sql_standalone.py. See README.md / CLAUDE.md.\n"
 "  ==========================================================================\n-->\n")

html = html.replace('<head>', '<head>\n' + BANNER)
html = html.replace('<link rel="stylesheet" href="assets/fonts/fonts.css">',
    '<!-- ===== FONTS · Alexandria / Tajawal (embedded) ===== -->\n<style id="dl-fonts">' + fonts + '</style>')
html = html.replace('<script src="vendor/exceljs.min.js"></script>',
    '<!-- ===== VENDOR · ExcelJS (formatted report export) ===== -->\n<script>' + esc(exceljs) + '</script>')
html = html.replace('<script src="vendor/supabase.js"></script>',
    '<!-- ===== VENDOR · supabase-js (Auth + queries) ===== -->\n<script>' + esc(supajs) + '</script>')
html = html.replace('<script src="dashboard.js?v=4"></script>',
    '<!-- ===== BRAND asset (inlined) ===== -->\n<script>window.__DL_LOGO=' + json.dumps(LOGO) + ';</script>\n'
    '<!-- ===== ENGINE · dashboard.js (Supabase Auth + RLS data layer) ===== -->\n<script>' + esc(dashjs) + '</script>')

OUT = os.path.join(HERE, 'dashboard-sql.html')
with open(OUT, 'w', encoding='utf-8') as f: f.write(html)
print('WROTE', OUT, round(os.path.getsize(OUT) / 1024), 'KB')
for bad in ['src="vendor', 'src="dashboard.js', 'href="assets/fonts']:
    assert bad not in html, 'leftover LOCAL external ref: ' + bad
print('  no local external references ✓  (the Supabase HTTPS call is the intended runtime dependency)')
