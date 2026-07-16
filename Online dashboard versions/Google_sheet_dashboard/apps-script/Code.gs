/**
 * Orphans Dashboard — Apps Script (the "road" between the dashboard and the Sheet)
 * ------------------------------------------------------------------------------
 * This program lives INSIDE your Google Sheet. When deployed as a Web App it
 * gives ONE fixed link (the API). The dashboard calls that link to:
 *   - READ  all data          (GET)
 *   - WRITE add/edit/delete    (POST, allowed only for editor/admin)
 *
 * It reads three tabs: الأيتام (cases), الزيارات (visits), المستخدمون (users).
 * Headers are matched BY NAME (row 1), so column order can change safely.
 */

// ---- tab names (must match the Sheet exactly) ----
var SHEET_CASES  = 'الأيتام';
var SHEET_VISITS = 'الزيارات';
var SHEET_USERS  = 'المستخدمون';

// ---- header (Arabic)  ->  key (used by the dashboard)  +  type ----
var CASE_COLS = [
  ['رقم اليتيم','id','str'],['رقم الأسرة','famId','str'],['الاسم الأول','first','str'],
  ['اسم الأب','father','str'],['الجد','grand','str'],['العائلة','family','str'],
  ['تاريخ الميلاد','dob','str'],['العمر','age','num'],['الجنسية','nat','str'],
  ['الجنس','gender','str'],['اسم الأب الكامل','fatherFull','str'],['تاريخ وفاة الأب','fatherDeath','str'],
  ['سبب الوفاة','deathCause','str'],['اسم الأم','motherName','str'],['الأم على قيد الحياة','motherAlive','str'],
  ['الحالة الاجتماعية للأم','motherStatus','str'],['الأم تعمل','motherWorks','str'],['نوع عمل الأم','motherJob','str'],
  ['اسم المعيل','guardian','str'],['صلة المعيل','relation','str'],['تعليم المعيل','guardianEdu','str'],
  ['فئة الدخل','income','str'],['الدخل الشهري','incomeAmt','num'],['نوع السكن','housing','str'],
  ['عدد أفراد الأسرة','famSize','num'],['عدد الذكور','males','num'],['عدد الإناث','females','num'],
  ['أبناء يعملون','sonsWork','str'],['أبناء يدرسون','sonsStudy','str'],['يوجد مريض أو معاق','sick','str'],
  ['حالة الأثاث','furniture','str'],['الأجهزة الكهربائية','appliances','str'],['الفرش','bedding','str'],
  ['التعليم','eduState','str'],['العلاج','treatment','str'],['المدينة','city','str'],
  ['الحي','hood','str'],['الصف الدراسي','grade','str'],['مؤشر الهشاشة','vuln','num'],
  ['أولوية التدخل','priority','str'],['حالة بيانات اليتيم','dataStatus','str'],['حالة بيانات الأسرة','famDataStatus','str'],
  ['حالة الكفالة','spStatus','str'],['نوع الدعم','spType','str'],
  ['مبلغ الكفالة الشهري','spAmount','num'],['رمز الكافل','sponsor','str'],
  ['تاريخ بداية الكفالة','spStart','str'],['تاريخ نهاية الكفالة','spEnd','str']
];
var VISIT_COLS = [
  ['رقم اليتيم','oid','str'],['تاريخ الزيارة','date','str'],['نتيجة الزيارة','result','str'],
  ['تاريخ الزيارة القادمة','next','str'],['الباحث الاجتماعي','worker','str']
];

// =====================  READ  =====================
// Browsers can't read a normal fetch() from Apps Script (no CORS header allowed).
// So we support JSONP: if a ?callback=NAME is given, we return NAME(json) as
// JavaScript, which the dashboard loads via a <script> tag (bypasses CORS).
function doGet(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    // WRITE actions ride the same JSONP channel (so the browser can read the reply).
    if (p.action) {
      // whoami is open to everyone (a viewer needs to learn they're a viewer)
      if (p.action === 'whoami') return reply_(e, { ok: true, email: p.email, role: getRole_(p.email) });
      var role = getRole_(p.email);
      if (role !== 'editor' && role !== 'admin') {
        return reply_(e, { ok: false, error: 'not-allowed', role: role });
      }
      if (p.action === 'upsertCase') return reply_(e, upsertCase_(JSON.parse(p.row)));
      if (p.action === 'deleteCase') return reply_(e, deleteCase_(p.id));
      return reply_(e, { ok: false, error: 'unknown-action' });
    }
    // otherwise: READ — now gated. Only emails listed in المستخدمون may view.
    var vrole = getRole_(p.email);
    if (vrole === 'none') return reply_(e, { ok: false, error: 'not-authorized', role: 'none' });
    var out = readAll_();
    return reply_(e, { ok: true, role: vrole, cases: out.cases, visits: out.visits });
  } catch (err) {
    return reply_(e, { ok: false, error: String(err) });
  }
}

function reply_(e, obj) {
  var payload = JSON.stringify(obj);
  var cb = e && e.parameter && e.parameter.callback;
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + payload + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================  WRITE  =====================
// The dashboard POSTs text/plain JSON like:
//   { action:'upsertCase', email:'x@y.com', row:{...case...} }
//   { action:'deleteCase', email:'x@y.com', id:'O0001' }
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var role = getRole_(body.email);
    if (role !== 'editor' && role !== 'admin') {
      return json_({ ok: false, error: 'not-allowed', role: role });
    }
    if (body.action === 'upsertCase') return json_(upsertCase_(body.row));
    if (body.action === 'deleteCase') return json_(deleteCase_(body.id));
    return json_({ ok: false, error: 'unknown-action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// =====================  helpers  =====================
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function readSheet_(name, cols) {
  var sh = ss_().getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0].map(function (h) { return String(h).trim(); });
  var map = {}; cols.forEach(function (c) { map[c[0]] = { key: c[1], type: c[2] }; });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      var m = map[header[c]]; if (!m) continue;
      var v = row[c];
      if (v === '' || v === null) { obj[m.key] = null; }
      else if (m.type === 'num') { obj[m.key] = Number(v); }
      else { obj[m.key] = String(v).trim(); }
    }
    rows.push(obj);
  }
  return rows;
}

function readAll_() {
  var cases = readSheet_(SHEET_CASES, CASE_COLS);
  // rebuild the derived full name (dashboard expects .name)
  cases.forEach(function (d) {
    if (!d.name) d.name = [d.first, d.father, d.family].filter(Boolean).join(' ');
  });
  var visits = readSheet_(SHEET_VISITS, VISIT_COLS);
  return { cases: cases, visits: visits };
}

// look up a role by email in the Users tab (soft gate for v1)
function getRole_(email) {
  if (!email) return 'none';
  var sh = ss_().getSheetByName(SHEET_USERS);
  if (!sh) return 'none';
  var vals = sh.getDataRange().getValues();
  var header = vals[0].map(function (h) { return String(h).trim(); });
  var iEmail = header.indexOf('البريد الإلكتروني');
  var iRole  = header.indexOf('الدور');
  if (iEmail < 0 || iRole < 0) return 'none';
  var target = String(email).trim().toLowerCase();
  for (var r = 1; r < vals.length; r++) {
    if (String(vals[r][iEmail]).trim().toLowerCase() === target) {
      return String(vals[r][iRole]).trim().toLowerCase() || 'viewer';
    }
  }
  return 'none';
}

// add or update a case row (matched by id)
function upsertCase_(rec) {
  var sh = ss_().getSheetByName(SHEET_CASES);
  var values = sh.getDataRange().getValues();
  var header = values[0].map(function (h) { return String(h).trim(); });
  var keyByHeader = {}; CASE_COLS.forEach(function (c) { keyByHeader[c[0]] = c[1]; });
  var idCol = header.indexOf('رقم اليتيم');
  // build the row array in the sheet's own column order
  var line = header.map(function (h) {
    var k = keyByHeader[h];
    var v = (k && rec[k] != null) ? rec[k] : '';
    return v;
  });
  // find existing row by id
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]).trim() === String(rec.id).trim()) {
      sh.getRange(r + 1, 1, 1, line.length).setValues([line]);
      return { ok: true, mode: 'updated', id: rec.id };
    }
  }
  sh.appendRow(line);
  return { ok: true, mode: 'added', id: rec.id };
}

function deleteCase_(id) {
  var sh = ss_().getSheetByName(SHEET_CASES);
  var values = sh.getDataRange().getValues();
  var idCol = values[0].map(function (h) { return String(h).trim(); }).indexOf('رقم اليتيم');
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]).trim() === String(id).trim()) {
      sh.deleteRow(r + 1);
      return { ok: true, mode: 'deleted', id: id };
    }
  }
  return { ok: false, error: 'not-found', id: id };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
