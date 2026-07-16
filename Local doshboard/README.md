# لوحة تحليل حالات الأيتام — Orphans Case‑Analytics Dashboard

An **offline, single‑file** dashboard that turns a charitable foundation's orphan‑care
Excel data into a clean, professional statistical dashboard — with no server, no
internet, and no install. A foundation opens one `.html` file, points it at **their
own** Excel (same fixed categorization, different data), and gets live KPIs, charts,
a data‑quality gatekeeper, in‑dashboard editing, and a formatted Excel report.

> Runs in **Chrome or Edge** (uses the File System Access API). Just double‑click the file.

---

## Two editions (both self‑contained, ship‑ready)

| File | Edition | Purpose |
|---|---|---|
| `dashboard-standalone.html` | **White‑label / abstracted** | Any foundation. The name + logo on page 1 are editable. |
| `dashboard-daleel.html` | **مركز الدليل (Al‑Daleel Center)** | Daleel's own brand — deep‑green + gold theme, fixed logo/name. Used to market the white‑label edition and for Daleel's internal use. |

**Same engine, same functionality, same statistics** — the Daleel edition only differs
in *theme* and a *fixed* page‑1 identity. Each standalone inlines everything (engine +
Excel libraries + a **synthetic** demo dataset — no real people), so it's safe to copy
and send to anyone.

---

## What it does

- **Capability‑driven** — the user picks data "packages" (bundles of fields, from just
  identity up to the full model). They get a matching Excel template, and the dashboard
  shows **only** the measures whose fields are present.
- **Bring‑your‑own‑Excel, two‑way** — connect a local `.xlsx`; edits in the dashboard can
  auto‑save back to the file (toggle), and external edits are pulled with *مزامنة*.
- **Data‑quality gatekeeper** — validates every cell against the categorization rules
  (dropdown values, numeric‑only, real dates, names ≠ numbers, unique id + name per row),
  then blocks / warns with a **details table showing exact cell locations**.
- **Smart Excel template** — dropdowns for fixed lists, numeric/date rules, **auto‑age**
  from date‑of‑birth, and a **dependent city list** that follows the chosen nationality
  (Arab‑world nationalities → their cities).
- **Add / edit / delete** from the dashboard, with the same rules enforced at entry and a
  gentle "incomplete fields" warning.
- **Statistics** (all verified against independent calculations): total, sponsorship
  coverage + gap, high/critical priority, urgent (emergency) cases, follow‑ups due,
  vulnerability distribution (mean + median), age bands, geographic + per‑governorate
  coverage, income, housing, visit outcomes over time, and a monthly sponsorship budget
  (actual spend · per‑case average · estimated cost to close the gap).
- **Formatted Excel report** — *تصدير التقرير* downloads a styled workbook (data sheets +
  a statistics‑summary sheet: borders, header fills, auto‑fit columns).
- **Session persistence** — close and reopen → it lands straight back on the dashboard
  with your last data (per‑file, stored locally).

---

## Using it

1. Open `dashboard-standalone.html` (or `dashboard-daleel.html`) in Chrome/Edge.
2. On page 1 choose your data packages, then:
   - **نزّل القالب** → download an Excel template shaped to your packages, fill it, or
   - **ربط ملف Excel والبدء** → connect an existing `.xlsx`, or
   - **استعراض ببيانات نموذجية** → explore with the built‑in synthetic demo.
3. On page 2 (the dashboard): filter/search, browse the case table, add/edit/delete,
   toggle **حفظ تلقائي للملف** to write edits back, and **تصدير التقرير** for a report.

---

## Repository layout

```
Local doshboard/
├── dashboard-standalone.html   ← deliverable (white‑label)   ── generated
├── dashboard-daleel.html       ← deliverable (Daleel brand)  ── generated
├── README.md                   ← this file
├── CLAUDE.md                   ← conventions for anyone (incl. Claude) editing this project
├── base version/               ← SOURCE (edit here)
│   ├── index.html              ← shell, styles, data model (CASE_COLS, PACKAGES, FIELD_META…)
│   ├── app.js                  ← the engine (all logic; see its header for a section map)
│   ├── vendor/                 ← SheetJS + ExcelJS (third‑party, minified)
│   ├── sample/                 ← demo data used only by the served dev version
│   └── daleel-assets/          ← Daleel logo + Alexandria/Tajawal fonts (for the branded build)
├── build/
│   ├── build_standalone.py     ← inlines base version → dashboard-standalone.html
│   └── build_daleel.py         ← same, + Daleel theme/branding → dashboard-daleel.html
└── .claude/skills/             ← guides that teach how to work on each edition
```

## Building

The two `dashboard-*.html` files are **generated** — do not hand‑edit them. Change the
source in `base version/` (or the theme in `build/build_daleel.py`), then rebuild:

```bash
python build/build_standalone.py     # → dashboard-standalone.html
python build/build_daleel.py         # → dashboard-daleel.html   (needs base version/daleel-assets/)
```

Requires Python 3 (standard library only). See **CLAUDE.md** for the full workflow,
the theme rules, and the gotchas.
