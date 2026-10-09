/* The Worker front door and the room, run in Node against a fake Durable Object
   (a map for storage, a stub that calls room.fetch). This checks the wiring: CORS,
   the PIN, the saved state and the rate limits. The rules themselves are in
   core.test.mjs, and none of this has run on Cloudflare itself. */
import assert from 'node:assert/strict';
import worker, { ConferenceRoom } from '../worker/src/worker.js';

let n = 0;
const test = async (name, fn) => {
  await fn();
  n++;
  console.log('ok   ' + name);
};

const ORIGIN = 'https://aspermylessonplan.com';
function makeEnv(pin = '4321') {
  const store = new Map();
  const ctx = {
    storage: { get: async (k) => store.get(k), put: async (k, v) => store.set(k, structuredClone(v)) },
    blockConcurrencyWhile: (fn) => (ctx.ready = fn()),
  };
  let room = new ConferenceRoom(ctx, {});
  const env = {
    ADMIN_PIN: pin,
    ALLOWED_ORIGINS: ORIGIN,
    ROOM: {
      idFromName: () => 'main',
      get: () => ({ fetch: (url, init) => room.fetch(new Request(url, init)) }),
    },
  };
  const restart = async () => {
    room = new ConferenceRoom(ctx, {});
    await ctx.ready;
  };
  return { env, store, ctx, restart, ready: () => ctx.ready };
}
const post = (env, op, body, headers = {}) =>
  worker.fetch(new Request('https://api.example/api/' + op, { method: 'POST', headers: Object.assign({ origin: ORIGIN, 'content-type': 'application/json' }, headers), body: JSON.stringify(body || {}) }), env);

await test('a page on another origin is refused', async () => {
  const { env, ready } = makeEnv();
  await ready();
  const r = await worker.fetch(new Request('https://api.example/api/state', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' }), env);
  assert.equal(r.status, 403);
});

await test('preflight from the site is allowed and names the PIN header', async () => {
  const { env, ready } = makeEnv();
  await ready();
  const r = await worker.fetch(new Request('https://api.example/api/admin/state', { method: 'OPTIONS', headers: { origin: ORIGIN } }), env);
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  assert.match(r.headers.get('access-control-allow-headers'), /x-admin-pin/);
});

await test('a parent reads the state with no PIN, and the responses are never cached', async () => {
  const { env, ready } = makeEnv();
  await ready();
  const r = await post(env, 'state', { token: 'token-parent-A' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal((await r.json()).teachers.length, 32);
});

await test('admin routes: wrong or missing PIN is 401, right PIN works, no PIN set is 503', async () => {
  const { env, ready } = makeEnv();
  await ready();
  assert.equal((await post(env, 'admin/state', {})).status, 401);
  assert.equal((await post(env, 'admin/state', {}, { 'x-admin-pin': 'nope' })).status, 401);
  assert.equal((await post(env, 'admin/state', {}, { 'x-admin-pin': '4321' })).status, 200);
  const none = makeEnv('');
  await none.ready();
  assert.equal((await post(none.env, 'admin/state', {}, { 'x-admin-pin': '' })).status, 503);
});

await test('a caller cannot claim to be staff by sending the internal header', async () => {
  const { env, ready } = makeEnv();
  await ready();
  const r = await post(env, 'admin/state', {}, { 'x-room-admin': '1' });
  assert.equal(r.status, 401);
});

await test('ten wrong PINs lock that address out, even for the right PIN', async () => {
  const { env, ready } = makeEnv();
  await ready();
  for (let i = 0; i < 10; i++) await post(env, 'admin/state', {}, { 'x-admin-pin': 'wrong' + i });
  const r = await post(env, 'admin/state', {}, { 'x-admin-pin': '4321' });
  assert.equal(r.status, 429);
});

await test('a booking survives the room being thrown away and rebuilt from storage', async () => {
  const { env, ready, restart } = makeEnv();
  await ready();
  const pin = { 'x-admin-pin': '4321' };
  await post(env, 'admin/config', { open: true }, pin);
  const tid = (await (await post(env, 'state', { token: 'token-parent-A' })).json()).teachers[0].id;
  const h = await (await post(env, 'hold', { token: 'token-parent-A', student: 'Azul Pina', tid, time: '4:00' })).json();
  assert.ok(h.ok);
  const c = await (await post(env, 'checkout', { token: 'token-parent-A', student: 'Azul Pina', parent: 'Maria', items: [{ tid, time: '4:00' }] })).json();
  assert.match(c.code, /^[A-Z2-9]{6}$/);
  await restart();
  await ready();
  const v = await (await post(env, 'state', { token: 'token-parent-B' })).json();
  assert.equal(v.grid[tid][0], 't');
  assert.equal(v.config.open, true);
});

await test('malformed JSON and oversized bodies are refused cleanly', async () => {
  const { env, ready } = makeEnv();
  await ready();
  const bad = await worker.fetch(new Request('https://api.example/api/state', { method: 'POST', headers: { origin: ORIGIN }, body: '{nope' }), env);
  assert.equal(bad.status, 400);
  const big = await worker.fetch(new Request('https://api.example/api/state', { method: 'POST', headers: { origin: ORIGIN }, body: 'x'.repeat(20001) }), env);
  assert.equal(big.status, 413);
});

console.log(`\n${n} passed`);
