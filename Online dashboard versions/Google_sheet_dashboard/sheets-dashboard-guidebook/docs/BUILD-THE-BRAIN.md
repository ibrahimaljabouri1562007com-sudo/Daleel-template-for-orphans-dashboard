# Building the brain for *your* Sheet

The brain (`templates/Code.gs`) is written so that **only the `CONFIG` block is
case‑specific**. This guide walks through filling it in and deploying.

## Step 0 — Understand what the brain must know

To read/write a Sheet generically, the brain needs, per data tab:
1. the **tab title** (exact),
2. the **id column** (to match rows on edit/delete) — or `null` for append‑only tabs,
3. a **column map**: for each column you care about, `[headerInSheet, keyInJSON, type]`.

Plus the **Users tab** (which columns hold email + role) and which roles may view/edit.

## Step 1 — Inventory your Sheet

Open your Sheet and write down, for each data tab, the **exact header text** of every
column and a short **key** you want in JSON (usually an English slug), and whether it's a
number or string.

Example (orphans case):

| Sheet header (Arabic) | key | type |
|---|---|---|
| رقم اليتيم | id | str |
| الاسم الأول | first | str |
| العمر | age | num |

Pick the **id column** (here `رقم اليتيم`). It must be unique per row.

## Step 2 — Fill `CONFIG`

```js
var CONFIG = {
  sheets: {
    cases: {                       // logical name (your choice)
      tab: 'الأيتام',              // exact tab title
      idCol: 'رقم اليتيم',         // unique-id column header (or null)
      cols: [
        ['رقم اليتيم','id','str'],
        ['الاسم الأول','first','str'],
        ['العمر','age','num'],
        // ...one row per column you care about...
      ]
    },
    visits: { tab: 'الزيارات', idCol: null, cols: [ ['رقم اليتيم','oid','str'], ['تاريخ الزيارة','date','str'] ] }
  },
  users: { tab: 'المستخدمون', emailCol: 'البريد الإلكتروني', roleCol: 'الدور' },
  viewRoles: ['admin','editor','viewer'],
  editRoles: ['admin','editor']
};
```

Notes:
- **Headers are matched by name, not position** — reordering columns in the Sheet is safe.
- Columns you don't list are ignored (read as absent, never written).
- `num` columns are returned as numbers; everything else as trimmed strings; blanks as `null`.

## Step 3 — Derived fields (optional)

Sometimes the dashboard wants a field the Sheet doesn't store as its own column (e.g. a
**full name** built from `first`/`father`/`family`). Use the `deriveRow_` hook:

```js
function deriveRow_(sheetName, row) {
  if (sheetName === 'cases' && !row.name)
    row.name = [row.first, row.father, row.family].filter(Boolean).join(' ');
  return row;
}
```

> ⚠️ If a field is *derived* (not a real column), the brain can't write it back. Store the
> underlying columns instead. (In the orphans case, the dashboard splits a typed full name
> into `first/father/family` before saving — see the client snippet.)

## Step 4 — The `Users` tab

Create a tab (name it in `CONFIG.users.tab`) with columns for email and role. One row per
person. Roles: `admin` (view+edit+manage), `editor` (view+edit), `viewer` (view only).
Add yourself as `admin`. **Share the Sheet itself only with trusted admins** — everyone
else goes through the dashboard.

## Step 5 — Deploy

1. **Extensions → Apps Script**, paste the whole `Code.gs`, **Save**.
2. **Deploy ▸ New deployment ▸** gear **▸ Web app**.
3. **Execute as: Me**, **Who has access: Anyone**, **Deploy**, authorize
   (Advanced → Go to project → Allow — it's your own script on your own Sheet).
4. Copy the **`/exec`** URL.

To update later: **Deploy ▸ Manage deployments ▸ ✎ ▸ Version: New version ▸ Deploy**
(same URL).

## Step 6 — Test the brain directly (before touching the dashboard)

Anonymous request from a terminal simulates a real user cleanly (no browser‑account noise):

```bash
# read (should be refused: no email in Users tab)
curl "https://script.google.com/macros/s/XXX/exec?email=stranger@x.com"
# read as an authorized user
curl "https://script.google.com/macros/s/XXX/exec?email=you@gmail.com"
# whoami
curl "https://script.google.com/macros/s/XXX/exec?action=whoami&email=you@gmail.com"
```

A write (URL‑encode the JSON row):
```bash
curl "https://script.google.com/macros/s/XXX/exec?action=upsert&sheet=cases&email=you@gmail.com&row=%7B%22id%22%3A%22X1%22%7D"
```

Expected shapes:
- Read OK → `{"ok":true,"role":"admin","data":{"cases":[...],"visits":[...]}}`
- Not authorized → `{"ok":false,"error":"not-authorized","role":"none"}`
- Write not allowed → `{"ok":false,"error":"not-allowed","role":"viewer"}`

## Step 7 — Wire the dashboard

Use `templates/client-snippet.js`: set `API_URL`, call `loadData()` (gated read),
`apiWrite('upsert', {sheet, row})` for edits. It handles JSONP, the login gate, and roles.

That's it — the brain is generic; you only ever revisit `CONFIG`.
