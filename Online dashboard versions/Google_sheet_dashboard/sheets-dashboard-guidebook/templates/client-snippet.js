/* ============================================================================
 * Sheets‑Brain — dashboard client helpers (drop into your HTML's <script>).
 * Handles: JSONP transport (read + write), login, gated read, role in the UI.
 * Set API_URL to your Apps Script Web App /exec link.
 * ========================================================================== */

const API_URL = 'https://script.google.com/macros/s/XXXXX/exec'; // <-- your /exec link
window.__myRole = null;      // set after login/read: 'admin' | 'editor' | 'viewer' | null
window.__data   = {};        // { cases:[...], visits:[...] } — whatever your CONFIG returns

// --- transport: everything rides JSONP (a <script> tag) because Apps Script has no CORS.
function apiCall(params){
  return new Promise((resolve, reject)=>{
    const cb = '__api_' + Math.random().toString(36).slice(2);
    const s  = document.createElement('script');
    const timer = setTimeout(()=>{ cleanup(); reject(new Error('timeout')); }, 25000);
    function cleanup(){ clearTimeout(timer); try{ delete window[cb]; }catch(_){ } s.remove(); }
    window[cb] = (data)=>{ cleanup(); resolve(data); };
    s.onerror  = ()=>{ cleanup(); reject(new Error('script-error')); };
    const q = Object.keys(params||{}).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&');
    s.src = API_URL + '?callback=' + cb + (q ? '&'+q : '') + '&_=' + Date.now();
    document.body.appendChild(s);
  });
}

// --- identity (soft: the email typed at login) ---
function getEmail(){ return localStorage.getItem('appEmail') || ''; }
function setEmail(e){ localStorage.setItem('appEmail', e); }
function signOut(){ localStorage.removeItem('appEmail'); window.__myRole = null; }

// --- gated read: sends the email; brain returns data only if the email may view ---
async function loadData(){
  const res = await apiCall({ email: getEmail() });
  if (!res || !res.ok){
    if (res && res.error === 'not-authorized'){ const err = new Error('not-authorized'); err.authError = true; throw err; }
    throw new Error(res && res.error ? res.error : 'bad-response');
  }
  window.__data   = res.data || {};
  window.__myRole = res.role || null;
  return window.__data;
}

// --- login: validate + load. Call from your login form. ---
async function login(email){
  setEmail((email||'').trim());
  await loadData();          // throws err.authError if not allowed to view
  return window.__myRole;
}

// --- writes (editor/admin only; brain enforces it too) ---
function canEdit(){ return window.__myRole === 'admin' || window.__myRole === 'editor'; }
async function apiWrite(action, payload){
  const res = await apiCall(Object.assign({ action, email: getEmail() }, payload));
  return res; // { ok, mode } | { ok:false, error:'not-allowed', role }
}
// upsert (add/edit) a row into a tab:  apiWrite('upsert', { sheet:'cases', row: JSON.stringify(obj) })
// delete a row by id:                   apiWrite('remove', { sheet:'cases', id: 'O0001' })

/* ---- typical boot flow (adapt to your UI) ----
async function boot(){
  if (!getEmail()) return showLoginGate();          // no email -> block, show login
  try {
    await loadData();
    renderEverything(window.__data);
    applyRoleUI();                                   // hide edit controls unless canEdit()
    hideLoginGate();
  } catch (e) {
    if (e.authError) showLoginGate('You are not authorized to view this data.');
    else            showLoginGate('Could not load — check your connection.');
  }
}
boot();
------------------------------------------------ */
