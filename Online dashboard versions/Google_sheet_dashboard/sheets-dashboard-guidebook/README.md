# Sheets‑Brain — turn any Google Sheet into a shared, multi‑user app

A small, reusable pattern for building a **live, multi‑user dashboard** on top of a
**Google Sheet** — with **no server to run and nothing to pay for**.

You keep your data in a Google Sheet. A tiny **Google Apps Script** ("the brain")
turns that Sheet into a web API. Any plain **HTML dashboard** then reads and writes
that data from the browser, with **per‑person permissions** managed by a tab in the
Sheet itself.

> This repo is a **guidebook + template**. It teaches the approach and gives you a
> config‑driven "brain" you adapt to *your* Sheet (different columns, any language)
> by editing one `CONFIG` block.

---

## The mental model (3 parts)

```
   ┌──────────────┐        JSONP over the internet        ┌────────────────────┐
   │  Dashboard   │  ── read (GET) / write (GET+action) ──►│  Apps Script (brain)│
   │  (HTML/JS)   │◄── data / "saved ✓" / "not allowed" ──│  runs INSIDE Google │
   │  "the window"│                                        └─────────┬──────────┘
   └──────────────┘                                                  │ built‑in access
                                                                     ▼
                                                        ┌────────────────────────┐
                                                        │  Google Sheet (tabs)   │
                                                        │  = the source of truth │
                                                        └────────────────────────┘
```

| Part | What it is | Role |
|---|---|---|
| **Source of truth** | Your Google Sheet (data tabs + a `Users` tab) | Where data lives, permanently |
| **The brain** | An Apps Script Web App (`Code.gs`) | Reads/writes the Sheet, checks permissions, exposes ONE URL |
| **The window** | Any HTML dashboard | Shows the data; sends edits back |

The brain talks to the Sheet **for free** (it runs inside Google). The dashboard talks
to the brain over **one fixed URL** — the API.

---

## Why this approach

- **No server, no hosting bill.** Google runs the brain; the Sheet is the database.
- **Multi‑user & live.** One Sheet, many windows — everyone sees the same current data.
- **Permissions without a login system.** A `Users` tab (email → role) controls who can
  view and who can edit.
- **You keep working in a spreadsheet.** Non‑technical admins edit the Sheet directly.

Good fit for **small teams (< ~20 people)**. Beyond that, or if data must not live on
Google, graduate to a real database + server.

---

## What's in this repo

```
README.md                      ← you are here
docs/
  APPROACH.md                  the pattern in depth + the gotchas (CORS→JSONP, etc.)
  BUILD-THE-BRAIN.md           how to write the Apps Script brain for ANY sheet
  ADAPT-CHECKLIST.md           copy‑paste checklist to adapt to your own sheet
templates/
  Code.gs                      the generalized, CONFIG‑driven brain (the crown jewel)
  client-snippet.js            drop‑in dashboard helpers (JSONP read/write + login gate)
.claude/skills/
  sheets-brain/SKILL.md        a skill so a fresh Claude can do all this on request
```

---

## Quickstart (5 steps)

1. Put your data in a Google Sheet. Add a **`Users`** tab: columns `email`, `role`
   (`admin` / `editor` / `viewer`). Add yourself as `admin`.
2. Open **Extensions → Apps Script**, paste **`templates/Code.gs`**, and edit the
   **`CONFIG`** block to match your tabs and columns.
3. **Deploy ▸ New deployment ▸ Web app** — *Execute as: Me*, *Access: Anyone*. Copy the
   `/exec` URL.
4. In your dashboard, use **`templates/client-snippet.js`**: set `API_URL` to that link;
   it handles login, gated reads, and writes.
5. Test (see `docs/ADAPT-CHECKLIST.md`), then host the HTML anywhere (Netlify/GitHub
   Pages) and share one link.

Full detail: **`docs/BUILD-THE-BRAIN.md`** and **`docs/ADAPT-CHECKLIST.md`**.

---

## The one thing to remember

> **To adapt this to a new Sheet, you edit exactly one thing: the `CONFIG` block in
> `Code.gs`.** The read/write/permission/JSONP machinery is generic and never changes.
