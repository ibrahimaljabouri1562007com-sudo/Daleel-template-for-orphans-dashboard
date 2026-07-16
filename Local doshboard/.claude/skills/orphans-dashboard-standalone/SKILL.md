---
name: orphans-dashboard-standalone
description: >
  Work on the WHITE-LABEL (abstracted) orphans case-analytics dashboard —
  `dashboard-standalone.html` and its source in `base version/`. Use this whenever the
  user wants to change, fix, or rebuild the generic/abstracted edition that any
  charitable foundation uses (editable name+logo, blue theme): its statistics, charts,
  Excel template/gatekeeper, editing, export, or the engine shared with the Daleel
  edition. Triggers: "the standalone dashboard", "the abstracted version", "the
  white-label orphans dashboard", "the generic edition", or edits to `app.js` /
  `index.html` / `dashboard-standalone.html`.
---

# White-label orphans dashboard

`dashboard-standalone.html` is a **generated, single, offline** file (Chrome/Edge). It
inlines: SheetJS + ExcelJS (vendor), a **synthetic** demo dataset, and the **engine**
(`app.js`) around the page shell (`index.html`). The name + logo on page 1 are editable
so any foundation can brand it.

## Golden rule
**Do not edit `dashboard-standalone.html` by hand.** Edit the source, then rebuild:

```
# source:  base version/index.html  (shell, CSS, data model)
#          base version/app.js      (engine — read its header section-map first)
python build/build_standalone.py    # → dashboard-standalone.html
```

## How to make a change (ASVL)
1. Find the code: behavior → `base version/app.js`; layout/CSS/data-model →
   `base version/index.html`. The engine's top comment lists every section.
2. Edit in the existing style (Arabic RTL strings, tabular figures, the token system).
   Keep the fixed categorization (`CASE_COLS`/`FIELD_META`) intact unless that's the task.
3. If you changed `app.js`, bump the cache version: `app.js?v=N` in `index.html` **and**
   the `APPJS_TAG` in `build/build_standalone.py` **and** `build/build_daleel.py`.
4. `python build/build_standalone.py` (and `build_daleel.py` too — the engine is shared).
5. Verify: open the generated file, drive the affected flow, check the console, DOM-inspect
   the result. Confirm nothing regressed in light **and** dark mode.

## What lives where
- **Charts/measures**: `renderKPIs`, `renderCoverage`, `renderVuln`, `renderPriority`,
  `renderGeo`, `renderIncome`, `renderHousing`, `renderAge`, `renderCovByCity`,
  `renderVisits`, `renderGov` — all gated by `has(...)` on available fields.
- **Template mould** (ExcelJS): `downloadTemplate` — dropdowns, numeric/date rules,
  auto-age formula, dependent city list.
- **Import + gatekeeper**: `importBuffer` → `validate` → report; details table with exact
  cell locations.
- **Editing**: `openEditor`/`collectEditor`/`saveEditor`/`deleteCase`.
- **Export report** (ExcelJS, formatted): `exportReport` — header fill uses the theme
  `--accent` at runtime (blue here), so it stays correct without hardcoding.
- **Persistence**: `saveSession`/`tryResume` (per-file localStorage key).

## Don't
- Don't hand-edit the generated HTML. Don't hardcode brand colors in `app.js`
  (read `--accent`). Don't change the categorization casually. Don't ship real data — the
  demo is synthetic on purpose.

See `CLAUDE.md` for the full gotcha list (ExcelJS `result`, full-column validation reader
limit, `</script>` escaping, file-lock on write, etc.).
