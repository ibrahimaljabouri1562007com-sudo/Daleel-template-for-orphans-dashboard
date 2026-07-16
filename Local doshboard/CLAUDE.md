# Project conventions — Orphans Dashboard (Local edition)

Read this before touching anything. It's the judgment layer: **how** to work here so a
change stays clean, correct, and consistent. Pair it with `README.md` (the *what*) and
`_guide/ROADMAP.md` (the *steps* — the full build inventory, in order, with source anchors;
the cross-project `Productivity/TRANSFER-CATALOG.md` points back here for step details).
Other orientation docs live in **`_guide/`** (guidance only — nothing runtime).

## The one rule that governs everything

**The two `dashboard-*.html` files are GENERATED. Never hand‑edit them.**
The real source is in `base version/`:

- `base version/index.html` — the page shell, all CSS/design tokens, and the **data
  model** (`CASE_COLS`, `VISIT_COLS`, `PACKAGES`, `FIELD_META`, `NAT_CITIES`, `state`,
  `BRANDING`).
- `base version/app.js` — the **engine** (every behavior). Its top comment is a section
  map — read it first.

A change flows: **edit `base version/` → rebuild → verify the generated file**. If you
edit a `dashboard-*.html` directly, the next rebuild silently erases your change.

## First, get your bearings (once)

1. Skim `base version/app.js`'s header + section markers (`/* ==== … ==== */`).
2. Skim the data model in `base version/index.html` (`CASE_COLS`, `PACKAGES`,
   `FIELD_META`, `NAT_CITIES`).
3. Note the two builders in `build/`. `build_standalone.py` = white‑label;
   `build_daleel.py` = the same engine + a **theme/branding overlay only**.

## The core workflow — change → rebuild → verify (ASVL)

Never hand back unverified work. On every change:

1. **Edit the source** (`base version/…`, or the theme in `build/build_daleel.py`),
   matching the surrounding style (naming, comment density, Arabic RTL strings).
2. **Rebuild** the affected file(s):
   `python build/build_standalone.py` and/or `python build/build_daleel.py`.
3. **Run + observe** — open the generated file (served, e.g. a local static server) and
   drive the affected flow; read the browser **console for errors**. Verify via the DOM
   when screenshots aren't available.
4. **Detect & fix** flaws (didn't do what was asked) and regressions (broke something
   that worked); repeat until clean.
5. **Then report**, confirming it was verified live.

Where feasible, verify **both** editions (the engine is shared) and **both** themes
(light/dark) — the dashboard is theme‑aware.

## Theme rule (keep the brand separation clean)

- The **abstracted** theme (blue accent) lives in `base version/index.html` `:root`.
- The **Daleel** theme (deep‑green + gold) lives **only** in `build/build_daleel.py`'s
  `DALEEL_CSS`, which *overrides* the tokens at build time. It also inlines the Daleel
  logo + fonts from `base version/daleel-assets/` and fixes the page‑1 name/logo.
- So: shared behavior → `app.js`; Daleel look → `build_daleel.py`. Don't hardcode brand
  colors in `app.js`. When something must match the theme at runtime (e.g. the export
  header fill), read `--accent` from the computed style — don't pick a fixed hex.

## The data model is fixed — treat it carefully

`CASE_COLS` (48 columns) + `VISIT_COLS` (5) are the **fixed categorization** every
foundation shares. Charts, the template, the gatekeeper, and the export all key off it.
Changing a field key or type ripples everywhere — do it deliberately and re‑verify the
template, the gatekeeper, and the affected charts. `FIELD_META` types: `choice` (strict
list), `soft` (known list, tolerant on import / strict dropdown in the mould), `num`
(range), `name` (text, rejects pure numbers), `date`; `age` derives from `dob`.

## Gotchas (learned the hard way)

- **Cache versioning.** The dev `index.html` loads `app.js?v=N`. On any `app.js` change,
  bump `N` in `index.html` **and** the `APPJS_TAG` string in **both** build scripts (they
  must match, or the replace fails). Standalones inline the engine, so they're immune —
  but a served dev page needs a hard refresh (Ctrl+F5).
- **SheetJS can't style cells** (borders/fills) — that's why the *template* and the
  *formatted report* use **ExcelJS**. SheetJS is only for reading imports and the plain
  file‑sync write.
- **ExcelJS formula cells are dropped unless you pass `result`** (e.g. `{formula, result:''}`).
- **ExcelJS's reader chokes on full‑column data‑validation ranges** (it enumerates every
  address). The mould writes them fine; just don't try to *re‑read* a full‑column mould
  with ExcelJS — verify with SheetJS or a finite‑range round‑trip.
- **Inlined JS must escape `</script>`** → `<\/script>` (the builders do this via `esc`).
- **Dates:** the dashboard's "today" is `TODAY = new Date()`; date validity checks reject
  rollover dates (e.g. `13/40`) and impossible ages.
- **Session key is scoped per file** (`…:'+location.pathname`) so the editions don't share
  saved sessions on the same origin (including `file://`).
- **Chrome/Edge only** — writing back to a connected file needs the File System Access
  API + read‑write permission (requested on connect). If the `.xlsx` is open in Excel,
  the write fails (file lock) — the UI says so.

## Outward actions

Editing source, rebuilding, and local verification are automatic. **Pushing to GitHub is
outward** — do it only when the user asks. Never commit real orphan data; the shipped
demo is synthetic by design.
