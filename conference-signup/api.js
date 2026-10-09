/* api.js — how the pages talk to the booking rules.

   Live: config.js names the Worker (window.CONF_API) and every call is a POST to
   <that>/api/<op>. Demo: it names nothing, and the same rules from core.js run in
   this browser against a copy of the event kept in localStorage, so the page can be
   tried (and two tabs act as two families) before any server exists. */
import { handle, newState } from './core.js';

const BASE = String(window.CONF_API || '').replace(/\/+$/, '');
export const demo = !BASE;
export const DEMO_PIN = '1234';

let skew = 0;
/* The server's clock, as best this browser can tell. A hold's `until` is in server
   time; counting down against the phone's own clock would be wrong by however much
   the phone is wrong. */
export const serverNow = () => Date.now() + skew;

const DEMO_KEY = 'conf-demo-state';
let seed = null;

async function demoState() {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* private window: start fresh each call */
  }
  if (!seed) seed = await (await fetch('teachers.json')).json();
  return newState(seed, { open: true, date: 'Tuesday, October 13, 2026' });
}

function saveDemo(state) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(state));
  } catch (e) {
    /* nothing to do: the demo just will not remember */
  }
}

/* Resolves { status, body }. Rejects only when the server cannot be reached. */
export async function call(op, body, pin) {
  const isAdmin = op.indexOf('admin/') === 0;
  if (demo) {
    if (isAdmin && pin !== DEMO_PIN) return { status: 401, body: { ok: false, reason: 'pin' } };
    const state = await demoState();
    const res = handle(state, op, body || {}, { now: Date.now(), admin: isAdmin, rng: Math.random });
    if (res.changed) saveDemo(state);
    return { status: res.status, body: res.body };
  }
  const headers = { 'content-type': isAdmin ? 'application/json' : 'text/plain' }; // text/plain: no preflight for families
  if (isAdmin) headers['x-admin-pin'] = pin || '';
  let r;
  try {
    r = await fetch(BASE + '/api/' + op, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  } catch (e) {
    throw new Error('unreachable', { cause: e });
  }
  let b;
  try {
    b = await r.json();
  } catch (e) {
    b = { ok: false, reason: 'bad-response' };
  }
  if (b && typeof b.now === 'number') skew = b.now - Date.now();
  return { status: r.status, body: b };
}

export function resetDemo() {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch (e) {
    /* ignore */
  }
}

/* A random id for this browser's holds. It is not a login: it only lets the server
   tell "my hold" from "someone else's". */
export function myToken() {
  try {
    let t = localStorage.getItem('conf-token');
    if (!t || t.length < 16) {
      const a = new Uint8Array(16);
      crypto.getRandomValues(a);
      t = Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('conf-token', t);
    }
    return t;
  } catch (e) {
    if (!myToken.fallback) myToken.fallback = 'volatile-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    return myToken.fallback;
  }
}
