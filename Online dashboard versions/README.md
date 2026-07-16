# Online dashboard versions

The **online** editions of the orphans dashboard — same data, a **shared source of truth**,
served to a small team. Each edition holds that truth in a **different backend**, but presents
the *same dashboard*. (The offline sibling, `../Local doshboard/`, uses a *local* source of
truth — bring-your-own-Excel.)

| Edition | ANCHOR (where the truth lives) | CONNECT (the road to it) | Status |
|---|---|---|---|
| `Google_sheet_dashboard/` | a **Google Sheet** | **Apps Script** Web App (JSONP) | ✅ built |
| *SQL version* (to come) | a **SQL database** | a **server / API** (e.g. Supabase or Flask) | ⬜ not built |

## The shared 4-step plan (SEPARATE → ANCHOR → CONNECT → BUILD)

Every edition follows the same 4 steps — but only **two of them are shared**; the middle two
are **unique to the tool** that holds the truth:

| Step | | Shared or per-tool? |
|---|---|---|
| **1 · SEPARATE** | pull the data out of the code into plain records | **shared** across all editions |
| **2 · ANCHOR** | put the data in the backend (Sheet / SQL DB) | **per-tool** — this is what differs |
| **3 · CONNECT** | the road that reads/writes it (Apps Script / server API) | **per-tool** — this is what differs |
| **4 · BUILD** | the dashboard on top (UI, charts, editing, roles) | **shared** — the same engine/UI |

So the **middle swaps, the ends stay.** Steps 1 and 4 are the same work reused; steps 2 and 3
are re-done for each backend. That's why the two online versions are siblings here — they *are*
the same project with a different ANCHOR+CONNECT.

## Where to look
- Each edition's own `_guide/ROADMAP.md` details **its** ANCHOR + CONNECT.
- The shared steps (SEPARATE, BUILD) + the migration method live in the transfer catalog
  (`Productivity/TRANSFER-CATALOG.md` → **SEPARATE→ANCHOR→CONNECT→BUILD**, **Re-point a dashboard
  onto a live backend**).
