---
name: orphans-dashboard-daleel
description: >
  Work on the مركز الدليل (Al-Daleel Center) BRANDED orphans dashboard —
  `dashboard-daleel.html`, built by `build/build_daleel.py`. Use this whenever the user
  wants to change, fix, or rebuild the Daleel-themed edition specifically: its deep-green
  + gold theme, the fixed page-1 logo/name, the topbar icon+wordmark+date, the branded
  footer, the watermark, or the embedded Daleel logo/fonts. Triggers: "the Daleel
  version/edition", "مركز الدليل dashboard", "the branded dashboard", "the green/gold
  theme", or edits to `build/build_daleel.py` / `dashboard-daleel.html`.
---

# Daleel-branded orphans dashboard

`dashboard-daleel.html` is the **same engine and statistics** as the white-label build —
**only the theme and a fixed page-1 identity differ.** It's Daleel's marketing/internal
edition. Everything (engine, Excel libs, synthetic demo, **the Daleel logo + Alexandria/
Tajawal fonts**) is inlined into one offline file.

## Where the difference lives — and the golden rule
- **Shared engine/behavior** → `base version/app.js` (changing it affects BOTH editions).
- **Daleel look & branding** → `build/build_daleel.py` only. It:
  1. overrides the design tokens with the brand palette in `DALEEL_CSS` — deep green
     `#213430` / `#46573A`, gold `#BE913B`, warm neutrals — for light **and** dark;
  2. inlines `base version/daleel-assets/logo.png` + fonts as data-URIs;
  3. crops the lockup to just the **compass icon** for the topbar and pairs it with the
     "مركز الدليل" wordmark + a gold "تحليل ودعم القرار" tagline;
  4. fixes page 1: the name is locked to **مركز الدليل** and the logo is non-editable;
  5. adds the gold **date** (topbar centre), the branded **footer**, and the faint
     **watermark**.

**Never hand-edit `dashboard-daleel.html`.** Change the shared engine in `base version/`
or the theme/branding in `build/build_daleel.py`, then rebuild:

```
python build/build_daleel.py     # needs base version/daleel-assets/  → dashboard-daleel.html
```

## How to make a Daleel change (ASVL)
1. **Branding/theme only?** Edit `DALEEL_CSS` (or the HTML transforms / `brand_js`) in
   `build/build_daleel.py`. Keep the palette — the theme is "WONDERFUL, don't change it";
   tweak layout/spacing, not the brand colors, unless asked.
2. **Behavior/stats?** Edit `base version/app.js` (shared) — then rebuild the white-label
   build too, and verify both.
3. Rebuild: `python build/build_daleel.py`.
4. Verify in the browser (light **and** dark): brand intact (`BRANDING.name==='مركز الدليل'`,
   green `--accent`, gold tagline, date, footer, watermark), charts render, console clean.

## Brand facts (keep consistent)
- Name: **مركز الدليل** — "مركز الدليل للتدريب والاستشارات الإنسانية"; site `daleelconsult.org`.
- Palette: `#213430`, `#46573A`, gold `#BE913B`, text `#6F7775`, bg `#F5F6F2`, line `#DDDDDD`.
- Fonts: Alexandria / Tajawal (embedded). Icon crop coords are calibrated to `logo.png`
  (icon ≈ x 54→301 of a 707×353 image) — if the logo art changes, re-measure the crop.

## Don't
- Don't put Daleel colors/branding into `app.js` (it's shared with the white-label build).
- Don't change the palette or lock behavior unless the user asks — the brand is fixed.
- Don't hand-edit the generated file; don't ship real data (demo is synthetic).

See `CLAUDE.md` for the shared gotchas and the full workflow.
