# Adapt‑to‑your‑Sheet checklist

A linear checklist for taking this pattern to a **new Sheet with different columns**.
Tick each box.

## A. Prepare the Sheet
- [ ] Data lives in one Google Sheet, one tab per entity (e.g. `cases`, `visits`).
- [ ] Each row‑editable tab has a **unique id column**.
- [ ] Add a **`Users`** tab: columns for **email** and **role**.
- [ ] Add yourself as **`admin`**. Decide the other people + roles.
- [ ] **Share** (green Share button) the Sheet with **admins only** — not the whole team.

## B. Configure the brain
- [ ] Copy `templates/Code.gs` into **Extensions → Apps Script**.
- [ ] In `CONFIG.sheets`, add one entry per tab: `tab`, `idCol`, `cols` (`[header,key,type]`).
- [ ] Set `CONFIG.users` to your Users tab's tab title + email/role header text.
- [ ] Set `viewRoles` / `editRoles` (defaults are sensible).
- [ ] If you have a derived field, implement `deriveRow_` (else leave it).
- [ ] **Save.**

## C. Deploy
- [ ] **Deploy ▸ New deployment ▸ Web app**, Execute as **Me**, Access **Anyone**.
- [ ] Authorize (Advanced → Go to project → Allow).
- [ ] Copy the **`/exec`** URL.

## D. Test the brain (terminal)
- [ ] Read as an **unlisted** email → `not-authorized`.
- [ ] Read as **you** → `ok:true` with `data`.
- [ ] `whoami` for you → your role.
- [ ] `upsert` a throwaway row as you → `ok, mode:'added'`; confirm it appears; `remove` it.
- [ ] `upsert` as a **viewer** email → `not-allowed`.

> Use a **fake id** (e.g. `TEST‑9999`) for write tests so you never collide with real data,
> and delete it after.

## E. Wire the dashboard
- [ ] Put `templates/client-snippet.js` logic in your HTML.
- [ ] Set `API_URL` to your `/exec` link.
- [ ] On load: if not signed in → show a **login gate**; else `loadData()`.
- [ ] Gate the UI by role: `viewer` = read‑only; `editor`/`admin` = show edit controls.
- [ ] Wire your save/delete buttons to `apiWrite('upsert'|'remove', ...)`.

## F. Validate & guardrails (recommended)
- [ ] Required‑field checks before a write (block + inline message; don't send until valid).
- [ ] Collision‑safe new ids (`max existing id + 1`, not `count + 1`).
- [ ] Any field the dashboard *shows* but the Sheet *derives* must be split back into real
      columns before saving.

## G. Share
- [ ] Host the HTML (Netlify Drop / GitHub Pages) → one link. **Don't ship any local data
      copy** (data must come only from the gated API).
- [ ] Tell multi‑account users to use one account or **incognito** (the known quirk).

## Redeploy reminder
Editing the Apps Script does nothing to the live app until you **Deploy ▸ Manage
deployments ▸ ✎ ▸ New version ▸ Deploy** (keeps the same URL).
