# ROADMAP — Local Orphans Dashboard

The **complete step inventory** for this project, in build order — the plan, the borders we
set, and where each step lives in the code. This is the *full* record; the
`Productivity/TRANSFER-CATALOG.md` only holds the subset we isolated for reuse.

**How to use this file:** if a step is ordered ("reuse the X step from the local dashboard")
and it's *not* in the catalog — or the catalog entry is thin — come here for the step in its
plan context, then open the `source:` anchor for exact mechanics.

**Legend:** `🟢 in catalog` = also isolated in `TRANSFER-CATALOG.md` · `— project-only` = lives
only here (a candidate to harvest later). Source anchors are **function/file names**, not line
numbers (line numbers rot).

---

## The borders (the architecture we agreed on)

1. **Offline, single-file, no server/internet/Google.** Chrome/Edge only (File System Access
   API for two-way local Excel read/write).
2. **Bring-your-own-Excel.** Any foundation points it at THEIR file — same **fixed 48-column
   categorization** (`CASE_COLS` + `VISIT_COLS` in `index.html`), different data.
3. **Capability-driven.** The user picks field "packages"; the template, the gatekeeper, and
   the charts all key off what's present — no dead sections.
4. **Never ship real data.** The distributed file carries a *synthetic* demo.
5. **Two editions, one engine.** White-label (blue, editable identity) + Daleel (green+gold,
   fixed identity) — theme/branding overlay only, never a code fork.

---

## The steps (in build order)

### Phase 1 — Capability model + package-driven UI  🟢 in catalog
User picks data "packages" (bundles of fields); الهوية (id, name, famId) is the locked core.
Measures declare `need()` field-deps and render only if their fields are present+valid; a
12-col `grid-auto-flow:dense` reflows with no holes.
- source: `index.html` → `PACKAGES`, `FIELD_META` · `app.js` → `has()` chart gating.
- catalog: **Capability / package-driven UI** (Repeatable).

### Phase 2 — Excel template mould (ExcelJS)  🟢 in catalog
A downloadable `.xlsx` shaped to the chosen packages, pre-loaded with rules so data comes in
already-valid: strict dropdowns (choice+soft, list on a `veryHidden` sheet, referenced by
range), numeric-only `decimal` validation, date validation, frozen RTL header, real widths.
- source: `app.js` → `downloadTemplate` (async).
- catalog: **ExcelJS template-mould generator** (Reachable).
- key gotcha: ExcelJS drops formula cells unless given `result:''`; its *reader* chokes on
  full-column validation ranges (write is fine).

### Phase 3 — Data-quality gatekeeper  🟢 in catalog
Import → match columns by header → validate per cell/field/file → **block** hard errors,
**warn** soft ones → details table with **exact Excel row numbers** (grouped by column type).
Row-level identity gate: every row needs id + a name; rows missing id are excluded+flagged.
- source: `app.js` → `importBuffer`, `validate`.
- catalog: **Data-quality gatekeeper pattern** (Repeatable) + **→ standalone validation lib**
  (Upgradeable).

### Phase 4 — Logical per-column rules + auto-age  — project-only
Per-column logic beyond types: `name` fields reject pure numbers (Excel `custom ISTEXT`);
`date` fields reject rollover/illogical dates (component sanity check) and impossible ages;
id/famId/sponsor kept as **flexible codes** (real ids look like `O0001` — not forced numeric).
**Age auto-derives from dob** everywhere (form, validator skip, Excel formula in the mould).
- source: `app.js` → `derive`, `ageFromDob`, `pureNum`, `normDate`, `parseD` · `index.html`
  → `FIELD_META` (`name`/`date`/`age from:'dob'`).
- catalog: not harvested — **candidate** (a reusable "logical field-rule set").

### Phase 5 — Arab-world nationality → dependent city  — project-only
Fixed Arab-world nationality list; the city dropdown **follows the chosen nationality**. In the
form (`populateCity` on open + on nat change) AND in the Excel mould (per-nationality city
columns + `wb.definedNames.add(range, nationality)` + city validation `INDIRECT($natCol2)`).
- source: `index.html` → `NAT_CITIES`, `NATIONALITIES`, `ALL_CITIES` · `app.js` → `populateCity`,
  the mould's defined-names/INDIRECT block.
- catalog: not harvested — **candidate** (a reusable "dependent dropdown, form + Excel").

### Phase 6 — Statistics + charts (verified)  🟢 in catalog (partial)
KPIs + ~10 charts, each with a Y-axis; all measures independently recomputed in Python and
matched. Fixes found by that audit: median even-n bug (average the two middle values),
coverage-by-city silently hiding the 8th governorate. Sponsorship money redesigned into
actual-spend / per-case-average / gap-cost tiles.
- source: `app.js` → `renderKPIs`, `renderVuln`, `renderAge`, `renderCovByCity`, `renderGov`,
  `renderVisits`, `median`.
- catalog: the **stats-verification methodology** is a candidate; charts themselves are
  project-specific. Theme tokens they use → **Theme via design tokens** (Phase 10).

### Phase 7 — Editing suite  — project-only
Pagination (page-size 10/25/50/100), add/edit/delete from the dashboard, two-tier required
(`MANDATORY` hard-block + `RECOMMEND` gentle in-modal warning that **coexists** with hard
errors), save-to-file via `requestPermission({mode:'readwrite'})` + Excel file-lock messaging.
- source: `app.js` → `openEditor`, `collectEditor`, `saveEditor`, `deleteCase`, `saveToExcel`.
- catalog: not harvested — **candidate** (the two-tier required + coexisting-warnings pattern).

### Phase 8 — Search autocomplete  — project-only
Custom suggestion panel (native `<datalist>` failed): keeps focus on scroll (panel
`mousedown` preventDefault), keyboard nav, up to 50 scrollable results, matches **name OR id**.
Header search filters the whole view; table search sets `state.tq` (filters the table only,
doesn't open the editor).
- source: `app.js` → `acAttach`, `acHide`, `_acPos`, `_acHiSet`.
- catalog: not harvested — **candidate** (a robust "focus-safe autocomplete" widget).

### Phase 9 — Navigation, clear-board, view reset  — project-only
Page nav (dashboard ⇄ gate) with visible accent buttons; "مسح اللوحة" = empty all;
"عرض كل الحالات" = `resetView()` clears every filter/table-search back to all rows.
- source: `app.js` → `resetView`, the `#t-home`/`#g-back` handlers.
- catalog: not harvested (project UX).

### Phase 10 — Theme system + two editions  🟢 in catalog
One design-token set (`--accent`, `--b100..700` ramp, status colors); re-skin by overriding
tokens at build time. White-label = blue in `index.html :root`; Daleel = green+gold overlay
**only** in `build_daleel.py` (`DALEEL_CSS` + embedded logo/fonts + fixed page-1 identity).
Runtime code reads `--accent` (e.g. the export header fill) — never a hardcoded hex.
- source: `index.html :root` · `build/build_daleel.py` → `DALEEL_CSS`, `brand_js`.
- catalog: **Theme via design tokens** (Repeatable) + **Daleel brand identity** (Reachable).

### Phase 11 — Session persistence  — project-only
`saveSession`/`tryResume` via localStorage, key scoped **per file** (`…:'+location.pathname`)
so the editions don't share sessions. Reopen → lands on the dashboard with the last data.
- source: `app.js` → `saveSession`, `clearSession`, `tryResume`.
- catalog: not harvested — **candidate** (per-file session auto-resume).

### Phase 12 — Formatted Excel report ("تصدير التقرير")  — project-only
`exportReport` (ExcelJS): data sheets + a styled "ملخص إحصائي" summary (borders, themed header
fill from `--accent`, auto-fit widths). Always a copy; connected-file writes stay on autosave.
- source: `app.js` → `exportReport`.
- catalog: not harvested — **candidate** (themed formatted-report exporter).

### Phase 13 — Single-file build pipeline  🟢 in catalog
Portable Python builders inline vendor + engine + synthetic demo (+ Daleel branding) into one
offline `.html` (`esc()` escapes `</script>`; loadSample fetch → inlined constants). Bump
`app.js?v=N` in `index.html` AND `APPJS_TAG` in both builders on any `app.js` change.
- source: `build/build_standalone.py`, `build/build_daleel.py`.
- catalog: **Build scripts → generic "inline to one file" tool** (Upgradeable) + the **wrap**
  skill in `alpha-toolkit`.

### Phase 14 — Documentation  — project-only
`README.md` (product/usage), `CLAUDE.md` (golden rule + gotchas), two skills
(`orphans-dashboard-standalone`, `orphans-dashboard-daleel`), this `ROADMAP.md`.

---

## Open / next (not yet built)
- Remember file-handle + branding across sessions (IndexedDB) so writes reconnect automatically.
- Optional folder rename "Local doshboard" → "Local dashboard" (typo).
- Never pushed to GitHub yet — user's decision (outward action).
