/**
 * Sheets‑Brain — a reusable Google Apps Script backend for a Google Sheet.
 * Turns any Sheet into a tiny multi‑user API (read + write + role permissions)
 * that a plain HTML dashboard can call from the browser — no server to run.
 *
 * ADAPT TO YOUR SHEET: edit ONLY the CONFIG block. Everything below it is generic.
 *
 * Deploy: Extensions → Apps Script → paste → Save →
 *   Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸ Access: Anyone ▸ Deploy.
 * Update after edits: Deploy ▸ Manage deployments ▸ ✎ ▸ New version ▸ Deploy (same URL).
 */

// =========================== CONFIG (edit this) ===========================
var CONFIG = {
  // One entry per data tab. key = logical API name; tab = exact tab title.
  // idCol = header of the unique-id column (null for append-only tabs).
  // cols  = [ [headerInSheet, keyInJSON, 'str'|'num'], ... ]  (list only what you need)
  sheets: {
    cases: {
      tab: 'الأيتام',
      idCol: 'رقم اليتيم',
      cols: [
        ['رقم اليتيم','id','str'],
        ['الاسم الأول','first','str'],
        ['العمر','age','num']
        // ...list every column you care about...
      ]
    },
    visits: {
      tab: 'الزيارات',
      idCol: null,
      cols: [
        ['رقم اليتيم','oid','str'],
        ['تاريخ الزيارة','date','str']
      ]
    }
  },

  // Permissions tab: one row per person (email + role).
  users: { tab: 'المستخدمون', emailCol: 'البريد الإلكتروني', roleCol: 'الدور' },

  // Which roles may VIEW (read) and which may EDIT (write).
  viewRoles: ['admin','editor','viewer'],
  editRoles: ['admin','editor']
};

// Optional: compute derived fields after reading a row. Return the row.
// Example (uncomment/adapt): build a full name from parts.
function deriveRow_(sheetName, row) {
  // if (sheetName === 'cases' && !row.name)
  //   row.name = [row.first, row.father, row.family].filter(Boolean).join(' ');
  return row;
}
// ========================= END CONFIG =========================

// ---------- entry points ----------
function doGet(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    if (p.action === 'whoami') return reply_(e, { ok:true, email:p.email, role:getRole_(p.email) });

    if (p.action) { // write actions — gated by editRoles
      if (CONFIG.editRoles.indexOf(getRole_(p.email)) < 0)
        return reply_(e, { ok:false, error:'not-allowed', role:getRole_(p.email) });
      if (p.action === 'upsert') return reply_(e, upsert_(p.sheet, JSON.parse(p.row)));
      if (p.action === 'remove') return reply_(e, remove_(p.sheet, p.id));
      return reply_(e, { ok:false, error:'unknown-action' });
    }

    // READ — gated by viewRoles
    var role = getRole_(p.email);
    if (CONFIG.viewRoles.indexOf(role) < 0)
      return reply_(e, { ok:false, error:'not-authorized', role:role });
    return reply_(e, { ok:true, role:role, data:readAll_() });
  } catch (err) {
    return reply_(e, { ok:false, error:String(err) });
  }
}

// Optional POST (body = text/plain JSON). Same write actions as GET.
function doPost(e) {
  try {
    var b = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (CONFIG.editRoles.indexOf(getRole_(b.email)) < 0) return json_({ ok:false, error:'not-allowed' });
    if (b.action === 'upsert') return json_(upsert_(b.sheet, b.row));
    if (b.action === 'remove') return json_(remove_(b.sheet, b.id));
    return json_({ ok:false, error:'unknown-action' });
  } catch (err) { return json_({ ok:false, error:String(err) }); }
}

// ---------- generic engine (do not edit) ----------
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function readAll_() {
  var out = {};
  Object.keys(CONFIG.sheets).forEach(function (name) { out[name] = readSheet_(name); });
  return out;
}

function readSheet_(name) {
  var cfg = CONFIG.sheets[name];
  var sh = ss_().getSheetByName(cfg.tab);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0].map(function (h) { return String(h).trim(); });
  var map = {}; cfg.cols.forEach(function (c) { map[c[0]] = { key:c[1], type:c[2] }; });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    if (values[r].every(function (c) { return c === '' || c === null; })) continue;
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      var m = map[header[c]]; if (!m) continue;
      var v = values[r][c];
      obj[m.key] = (v === '' || v === null) ? null : (m.type === 'num' ? Number(v) : String(v).trim());
    }
    rows.push(deriveRow_(name, obj));
  }
  return rows;
}

function upsert_(name, rec) {
  var cfg = CONFIG.sheets[name];
  if (!cfg) return { ok:false, error:'unknown-sheet' };
  var sh = ss_().getSheetByName(cfg.tab);
  var values = sh.getDataRange().getValues();
  var header = values[0].map(function (h) { return String(h).trim(); });
  var keyByHeader = {}; cfg.cols.forEach(function (c) { keyByHeader[c[0]] = c[1]; });
  var line = header.map(function (h) { var k = keyByHeader[h]; return (k && rec[k] != null) ? rec[k] : ''; });
  if (cfg.idCol) {
    var idIdx = header.indexOf(cfg.idCol), idKey = keyByHeader[cfg.idCol];
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][idIdx]).trim() === String(rec[idKey]).trim()) {
        sh.getRange(r + 1, 1, 1, line.length).setValues([line]);
        return { ok:true, mode:'updated', id:rec[idKey] };
      }
    }
  }
  sh.appendRow(line);
  return { ok:true, mode:'added' };
}

function remove_(name, id) {
  var cfg = CONFIG.sheets[name];
  if (!cfg || !cfg.idCol) return { ok:false, error:'no-id-column' };
  var sh = ss_().getSheetByName(cfg.tab);
  var values = sh.getDataRange().getValues();
  var idIdx = values[0].map(function (h) { return String(h).trim(); }).indexOf(cfg.idCol);
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idIdx]).trim() === String(id).trim()) {
      sh.deleteRow(r + 1);
      return { ok:true, mode:'removed', id:id };
    }
  }
  return { ok:false, error:'not-found', id:id };
}

function getRole_(email) {
  if (!email) return 'none';
  var sh = ss_().getSheetByName(CONFIG.users.tab);
  if (!sh) return 'none';
  var vals = sh.getDataRange().getValues();
  var header = vals[0].map(function (h) { return String(h).trim(); });
  var iE = header.indexOf(CONFIG.users.emailCol), iR = header.indexOf(CONFIG.users.roleCol);
  if (iE < 0 || iR < 0) return 'none';
  var t = String(email).trim().toLowerCase();
  for (var r = 1; r < vals.length; r++)
    if (String(vals[r][iE]).trim().toLowerCase() === t)
      return String(vals[r][iR]).trim().toLowerCase() || 'viewer';
  return 'none';
}

// JSONP‑aware reply: if ?callback=NAME is present, return NAME(json) as JavaScript
// (a browser <script> tag can read it — bypasses the missing CORS header).
function reply_(e, obj) {
  var payload = JSON.stringify(obj);
  var cb = e && e.parameter && e.parameter.callback;
  return cb
    ? ContentService.createTextOutput(cb + '(' + payload + ')').setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
