# The approach, in depth

This document explains **why** the pattern is shaped the way it is — so you can adapt it
with judgement, not just copy it.

## 1. The problem it solves

You have data in a spreadsheet. You want several people to **see and edit the same live
data**, ideally through a nice screen, without standing up a server or a database.

The naive move — putting the data inside an HTML file — fails: every copy is frozen and
edits don't persist. You need to **separate the data from the presentation** and give
them a **connection** (an API). This pattern is the cheapest correct way to do that.

## 2. The three layers

- **Source of truth — the Google Sheet.** Your tabs of data, plus one `Users` tab.
- **The brain — Apps Script.** A tiny program that *lives inside Google*, attached to the
  Sheet. It can touch the Sheet directly (no keys, no setup), and when **deployed as a Web
  App** it exposes **one URL** the outside world can call.
- **The window — an HTML dashboard.** Reads from the brain, renders; sends edits back.

The brain is both the **road** (the API the dashboard calls) and the **guard** (it checks
who's allowed before it reads or writes).

## 3. The two directions (read + write) — one URL

Everything travels over the single Web‑App URL. What differs is the request:

- **Read:** dashboard asks the URL (no `action`) → brain returns all data.
- **Write:** dashboard asks the same URL with `action=upsert|remove` (+ payload) → brain
  changes the Sheet.

Think of the URL as the warehouse's **one phone number**: everyone calls the same number;
what you *say* (read vs write) decides what happens.

## 4. The gotcha that shapes everything: **no CORS → use JSONP**

A browser normally calls an API with `fetch()`. But Apps Script **cannot send the CORS
header** a cross‑origin `fetch` requires, and there is **no setting to add it**. So a plain
`fetch` from your dashboard is **blocked**.

**Solution: JSONP.** Instead of `fetch`, the dashboard loads the URL as a `<script>` tag
(script tags are exempt from CORS). The brain wraps its reply as `callback(<json>)`, and
the script tag runs it. This works for **both read and write** — the write's `action` and
payload ride in the URL query string, and the brain replies with `callback(result)` so the
dashboard can read "saved ✓" or "not allowed ⛔".

This is why the brain has a `reply_(e, obj)` helper: if `?callback=NAME` is present it
returns JavaScript (`NAME(json)`); otherwise plain JSON (handy for `curl`/testing).

## 5. Permissions — a `Users` tab, not a login system

Authentication is hard. For a small trusted team you don't need it. Instead:

- A **`Users` tab**: one row per person — `email`, `role` (`admin` / `editor` / `viewer`).
- The brain's `getRole_(email)` looks the email up on **every** request.
- **View gating:** reads are refused unless the email is listed (any role).
- **Edit gating:** writes are refused unless the role is `editor` or `admin`.

The admin manages access by **typing rows in the Sheet** — the same familiar surface. No
separate console.

> Identity here is "soft": the dashboard sends the email the user typed at a login screen.
> That's fine for an internal tool. If you need strong identity, add a per‑user token/PIN
> column the brain checks, or move to real OAuth.

## 6. Deployment truths (save yourself pain)

- **Execute as: Me** — so the brain has full access to *your* Sheet.
- **Who has access: Anyone** — required so the browser can reach it without a Google login
  redirect. (The `Users` tab is what actually restricts things; treat the URL as a secret.)
- **Editing the code doesn't update the live URL** until you **Deploy ▸ Manage deployments
  ▸ ✎ ▸ New version ▸ Deploy**. Same URL, new code.

## 7. Known limitation: the multi‑account quirk

If a user's browser is signed into **several Google accounts at once**, `script.google.com`
may route the request to the wrong account and error. **Single‑account, logged‑out, or
incognito users are fine.** Mitigations: tell users to use one account/incognito, or add a
tiny proxy. This is a Google behaviour, not a bug in your code.

## 8. When to outgrow this

Move to a real backend (database + server, e.g. Supabase/Flask) when you need: many more
users, heavy concurrent writes, strong auth/roles, or the data must not live on Google.
Until then, this pattern is the right‑sized tool.
