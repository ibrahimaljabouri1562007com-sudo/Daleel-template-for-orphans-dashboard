<!-- This is the narrative plan (goal · architecture · permissions). For the step inventory
     with source anchors + transfer-catalog tags, see ROADMAP.md alongside this file. -->

# Build Plan — Orphans & Sponsored-Families Dashboard

## 🎯 Goal
Turn the current standalone HTML dashboard (data frozen inside the code) into a **real,
multi-user dashboard** where a small team (<10 people) sees and edits the **same live data**,
with the admin controlling who can enter and who can edit — all inside Google, no server to run.

---

## 🧱 The architecture (3 parts)

| Part | What it is | Role |
|---|---|---|
| 🏬 **Source of truth** | **One Google Sheet** (import/export as Excel anytime) | Holds all the data — the single warehouse |
| 🛣️ **The road + guard** | **Google Apps Script web app** | Safely reads/writes the Sheet, checks permissions, serves the dashboard at a link |
| 🪟 **The windows** | **The dashboard** (current HTML, served at a link) | Many people, all reading/writing the one Sheet |

**Rule:** users never touch the Sheet directly — only the admin does. Everyone else goes
**through the guarded app**. Downloads = a frozen Excel *copy*, never the live source.

---

## 🪜 The 4 steps

1. **SEPARATE** ✂️ — strip the frozen `DATA` / `VISITS` arrays out of the HTML.
2. **ANCHOR** ⚓ — move that data into one Google Sheet (built from your Excel).
3. **CONNECT** 🛣️ — add the Apps Script web app: it exposes the "doors" (get / add / edit /
   delete, for cases and visits), holds the key safely, and serves the dashboard at a URL.
4. **BUILD** 🏗️ — reconnect the dashboard's screens to those doors, then add features
   (add-case form, editing, view-only vs edit roles, filters that persist).

---

## 🔑 Permissions (how the admin controls access)

We **share a link**, not the file. Two control panels, both inside Google:

- **Panel 1 — Apps Script "Deploy" dropdown** → the coarse rule:
  *“anyone with the link”* (open) vs *“must log in with Google.”*
- **Panel 2 — a “Users” tab inside the Sheet** → per-person control:

  | email | can_enter | can_edit |
  |---|---|---|
  | worker1@… | yes | yes |
  | reviewer@… | yes | no |

The three modes you asked for:

| Mode | How |
|---|---|
| Anyone with link → **enter + edit** | Deploy = "anyone with link", default `can_edit: yes` |
| Anyone with link → **enter only (view)** | Same, default `can_edit: no` |
| Specific person → **enter only, no edit** | Users tab: their email → `can_enter: yes`, `can_edit: no` |

> ⚠️ For sensitive orphan data: use **per-person login for editors**; reserve
> “anyone with the link” for **view-only** at most.

---

## 📦 What you get at the end
- One live Google Sheet = the source of truth (Excel-compatible).
- A dashboard link you send to your team.
- Admin controls entry + edit rights by typing in the **Users tab** — no code changes.
- Edits are shared and permanent; a download is only a copy.

---

## ✅ Build order (execution)
1. Prepare the Google Sheet from your Excel (columns for cases + visits + a Users tab).
2. Write the Apps Script "doors" (read/write) + permission check.
3. Rewire the dashboard: replace frozen arrays with calls to those doors.
4. Deploy as a web app, set the access mode, test with 2 accounts (one editor, one viewer).
5. Add features on top (forms, roles, persistence).

---

## ⬆️ When to upgrade later (not now)
If you outgrow this — **>~20 users**, heavy roles/reporting, or data must not live on Google —
move up to **Supabase** or a small **Flask server**. Until then, this is the right-sized shape.
