/* The conference sign-up API. Two parts:

     default export   the front door. Checks the origin and the staff PIN, then
                      hands the request to the one room.
     ConferenceRoom   a Durable Object. There is exactly one (idFromName('main')),
                      it runs one request at a time, and it holds the whole event
                      (32 teachers x 12 slots, a few KB) in memory, saving to its
                      own storage after every change. All the rules are in
                      ../../core.js, which the tests and the demo page also run.

   The front door sets the x-room-* headers itself and drops any the caller sent,
   so a browser cannot claim to be staff by naming a header. */
import { handle, newState } from '../../core.js';
import seed from '../../teachers.json' with { type: 'json' };

const MAX_BODY = 20000;
const PARENT_PER_MIN = 600; // per IP; a school's wifi is one address, so this is generous
const PIN_FAILS = 10; // wrong PINs per IP per 10 minutes

const json = (body, status, cors) =>
  new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'content-type': 'application/json', 'cache-control': 'no-store' }, cors),
  });

function corsFor(request, env) {
  const origin = request.headers.get('origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || allowed.indexOf(origin) < 0) return null;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, x-admin-pin',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '600',
    vary: 'origin',
  };
}

async function samePin(given, wanted) {
  if (!wanted) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(given || ''))),
    crypto.subtle.digest('SHA-256', enc.encode(String(wanted))),
  ]);
  /* Both sides are 32-byte digests, so a plain loop that never exits early is
     constant-time enough, and runs the same in Node, where the tests are. */
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    const cors = corsFor(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    if (!cors) return json({ ok: false, reason: 'origin' }, 403, {});
    if (request.method !== 'POST') return json({ ok: false, reason: 'method' }, 405, cors);

    const op = url.pathname.slice(5);
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ ok: false, reason: 'too-big' }, 413, cors);

    const headers = new Headers({ 'content-type': 'application/json' });
    headers.set('x-room-ip', request.headers.get('cf-connecting-ip') || 'unknown');
    if (op.startsWith('admin/')) {
      if (!env.ADMIN_PIN) return json({ ok: false, reason: 'no-pin-configured' }, 503, cors);
      const ok = await samePin(request.headers.get('x-admin-pin'), env.ADMIN_PIN);
      headers.set('x-room-admin', ok ? '1' : '0');
    }
    const stub = env.ROOM.get(env.ROOM.idFromName('main'));
    const res = await stub.fetch('https://room/' + op, { method: 'POST', headers, body: text });
    return new Response(res.body, { status: res.status, headers: Object.assign({ 'content-type': 'application/json', 'cache-control': 'no-store' }, cors) });
  },
};

function secureRng() {
  const a = new Uint32Array(1);
  return () => {
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  };
}

export class ConferenceRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.state = null;
    this.rng = secureRng();
    this.hits = new Map(); // ip -> [count, windowStart]
    this.bad = new Map(); // ip -> [fails, windowStart]
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get('state')) || newState(seed);
    });
  }

  over(map, ip, limit, windowMs, now) {
    const e = map.get(ip);
    if (!e || now - e[1] > windowMs) {
      map.set(ip, [0, now]);
      return false;
    }
    return e[0] >= limit;
  }

  bump(map, ip) {
    const e = map.get(ip);
    if (e) e[0]++;
  }

  async fetch(request) {
    const op = new URL(request.url).pathname.slice(1);
    const ip = request.headers.get('x-room-ip') || 'unknown';
    const now = Date.now();
    let body = {};
    try {
      body = JSON.parse((await request.text()) || '{}');
    } catch (e) {
      return Response.json({ ok: false, reason: 'json' }, { status: 400 });
    }
    const pinHeader = request.headers.get('x-room-admin');
    const isAdminOp = op.startsWith('admin/');
    if (isAdminOp) {
      if (this.over(this.bad, ip, PIN_FAILS, 600000, now)) return Response.json({ ok: false, reason: 'locked' }, { status: 429 });
      if (pinHeader !== '1') {
        this.bump(this.bad, ip);
        return Response.json({ ok: false, reason: 'pin' }, { status: 401 });
      }
    } else {
      if (this.over(this.hits, ip, PARENT_PER_MIN, 60000, now)) return Response.json({ ok: false, reason: 'slow-down' }, { status: 429 });
      this.bump(this.hits, ip);
    }
    const res = handle(this.state, op, body, { now, admin: isAdminOp && pinHeader === '1', rng: this.rng });
    if (res.changed) await this.ctx.storage.put('state', this.state);
    return Response.json(res.body, { status: res.status });
  }
}
