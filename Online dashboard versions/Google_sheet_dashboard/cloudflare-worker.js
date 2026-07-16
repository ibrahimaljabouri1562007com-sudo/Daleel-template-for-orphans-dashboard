/**
 * Cloudflare Worker — proxy between the dashboard and Google Apps Script.
 *
 * WHY: A browser calling script.google.com directly gets misrouted by Google's
 * account layer (the "/u/N/" problem). This Worker sits in the middle: the browser
 * calls the Worker (a neutral URL, no Google cookies), and the Worker relays to
 * Apps Script SERVER-TO-SERVER (anonymous, like curl) — which always works.
 * It also returns proper CORS headers, so the dashboard can use normal fetch().
 *
 * Deploy: dash.cloudflare.com → Workers & Pages → Create Worker → paste this → Deploy.
 */

const APPS_SCRIPT = 'https://script.google.com/macros/s/AKfycbw73G1dCQLxo_fzB0b6YRVdE0Dftfyzb8wZr13BhVCzzqHQWNZN1VkZFOM8MURiRHarQQ/exec';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    const url = new URL(request.url);
    const target = APPS_SCRIPT + url.search;         // forward the same query params
    try {
      const resp = await fetch(target, { method: 'GET', redirect: 'follow' });
      const body = await resp.text();
      return new Response(body, { status: 200, headers: cors() });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: 'proxy:' + String(e) }), { status: 200, headers: cors() });
    }
  }
};

function cors() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
