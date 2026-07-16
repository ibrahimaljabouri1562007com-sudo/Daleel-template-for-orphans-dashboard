---
name: sheets-brain
description: Turn a Google Sheet into a shared, multi-user app (live read + write + per-person roles) using a Google Apps Script "brain" and a plain HTML dashboard — no server. Use when a user has (or wants) their data in a Google Sheet and asks to build a dashboard/app on top of it, make a spreadsheet multi-user or editable by a team, add login/roles/permissions to a Sheet-backed tool, connect an HTML page to Google Sheets, or replicate the "Google Sheet + Apps Script + JSONP" pattern for a new sheet with different columns.
---

# Sheets‑Brain: Google Sheet → multi‑user app

Build a small, serverless, multi‑user app on top of a Google Sheet. The Sheet is the
source of truth; a Google Apps Script Web App ("the brain") is the API; a plain HTML page
is the window. They connect over ONE URL via **JSONP** (Apps Script can't do CORS), and a
**Users tab** governs who may view/edit.

## When to use
- The user's data is (or will be) in a Google Sheet and they want it shown/edited by
  several people, live and shared.
- They want spreadsheet data reachable from an HTML dashboard with **roles/permissions**
  but **no backend server**.
- They want to **adapt this proven pattern to a new sheet** (different columns/language).

## The only thing that changes per case
The brain is generic **except one `CONFIG` block** (which tabs, which columns, the Users
tab, and view/edit roles). Adapting to a new Sheet = rewrite `CONFIG`, redeploy. Do not
rewrite the engine.

## Procedure
1. **Read the docs in this repo first** (they hold the why + the gotchas):
   `docs/APPROACH.md`, `docs/BUILD-THE-BRAIN.md`, `docs/ADAPT-CHECKLIST.md`.
2. **Inventory the Sheet** with the user: list each data tab, its exact column headers, a
   short JSON key + type per column, and the unique id column. Identify/create a **Users
   tab** (email + role) and make the user an `admin`.
3. **Fill `CONFIG`** in `templates/Code.gs`. Implement `deriveRow_` only if a shown field
   isn't a real column. Hand the user the code to paste into Extensions → Apps Script.
4. **Guide deployment** (you can't do it for them — it's their Google account):
   Deploy ▸ Web app ▸ Execute as *Me* ▸ Access *Anyone* ▸ authorize ▸ copy the `/exec` URL.
   Updating code needs Manage deployments ▸ New version (same URL).
5. **Verify the brain yourself** from a terminal with `curl`/python against the `/exec` URL
   (anonymous = a clean test): unauthorized read is refused, authorized read returns data,
   `whoami` works, a fake‑id `upsert`→confirm→`remove` round‑trips, a viewer write is
   refused. Never write test rows with real‑sequence ids.
6. **Wire the dashboard** with `templates/client-snippet.js`: set `API_URL`, gate the read
   (login before data), gate the UI by role, route saves to `apiWrite`. Add input
   validation (block invalid before writing) and collision‑safe id generation.
7. **Share**: host the HTML (Netlify/GitHub Pages), ship no local data copy, and warn about
   the multi‑account quirk (use one account/incognito).

## Critical gotchas (do not skip)
- **No CORS → JSONP for everything.** Never use plain `fetch` to Apps Script; it's blocked.
- **Redeploy to publish code changes** (Manage deployments ▸ New version), else the live
  URL runs old code.
- **Read‑gating removes any local data fallback** — data must come only from the gated API,
  or you leak it.
- **Match columns by header name, not position.** Derived fields can't be written back —
  store the underlying columns.
- **Multi‑account browsers** can misroute `script.google.com`; single‑account/incognito
  works.

## Verification checklist before declaring done
Read works for authorized only; write works for editors/admins only; a real add/edit/delete
round‑trips in the Sheet; the dashboard renders live (`role` known); no test rows left
behind.
