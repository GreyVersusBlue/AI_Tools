/* smoke-workerd.mjs — the Worker run for real, under Cloudflare's own runtime (workerd),
   through `wrangler dev --local` against conference-signup/worker/wrangler.toml.

     node conference-signup/test/smoke-workerd.mjs

   worker.test.mjs checks the wiring against a fake Durable Object in Node. This is the half
   it cannot: that wrangler bundles src/worker.js (the `import seed from '../../teachers.json'
   with { type: 'json' }`, the shared core.js), that the `v1` SQLite migration creates the
   ConferenceRoom class, that a booking survives the process being stopped and started again on
   the same storage, and that the origin, PIN and lock-out paths answer the same on workerd.

   Local mode only: no Cloudflare login, no account id, no token, nothing leaves the machine
   (`--local`, a throwaway `--persist-to`, `WRANGLER_SEND_METRICS=false`). The ADMIN_PIN here is a
   made-up test value passed with `--var`. Never `deploy`, never `login`.

   Ports: 8676 (the Worker), 8677 (wrangler's inspector). If `wrangler` is not on PATH (GitHub's
   runner has none; it is not a repo dependency, the repo keeps dependencies empty), the suite
   says so and exits 0 without testing anything. Set REQUIRE_WRANGLER=1 to make that a failure.

   Exits 1 on any failure. */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8676;
const INSPECTOR = 8677;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = 'https://aspermylessonplan.com';
const PIN = '4321-test-only';
const WORKER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker');

const probe = spawnSync('wrangler', ['--version'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  const msg = 'wrangler is not on PATH, so the Worker was not run under workerd';
  if (process.env.REQUIRE_WRANGLER) { console.log('FAIL ' + msg); process.exit(1); }
  console.log('SKIP ' + msg + ' (install it globally to run this suite; REQUIRE_WRANGLER=1 makes this a failure)');
  process.exit(0);
}
console.log('wrangler ' + probe.stdout.trim());

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-workerd-'));
const persist = path.join(scratch, 'state');
let current = null;

async function start({ pin = PIN } = {}) {
  const args = ['dev', '--local', '--ip', '127.0.0.1', '--port', String(PORT), '--inspector-port', String(INSPECTOR), '--persist-to', persist];
  if (pin) args.push('--var', 'ADMIN_PIN:' + pin);
  const log = [];
  const child = spawn('wrangler', args, {
    cwd: WORKER_DIR,
    detached: true, // its own process group, so stop() takes workerd down with it
    env: Object.assign({}, process.env, { CI: '1', WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: path.join(scratch, 'logs'), NO_COLOR: '1' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => log.push(String(d)));
  child.stderr.on('data', (d) => log.push(String(d)));
  let exited = false;
  child.on('exit', () => { exited = true; });
  current = { child, log, isExited: () => exited };
  const deadline = Date.now() + 90000;
  for (;;) {
    if (exited) throw new Error('wrangler exited before it was ready:\n' + log.join('').slice(-1500));
    if (Date.now() > deadline) throw new Error('wrangler was not ready in 90 s:\n' + log.join('').slice(-1500));
    try {
      const r = await fetch(BASE + '/nothing-here');
      if (r.status === 404) return;
    } catch (e) { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function stop() {
  if (!current) return;
  const { child, isExited } = current;
  current = null;
  const kill = (sig) => { try { process.kill(-child.pid, sig); } catch (e) { /* already gone */ } };
  kill('SIGTERM');
  for (let i = 0; i < 50 && !isExited(); i++) await new Promise((r) => setTimeout(r, 100));
  if (!isExited()) kill('SIGKILL');
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/nothing-here'); } catch (e) { return; } // refused: the port is free
    await new Promise((r) => setTimeout(r, 100));
  }
}

const call = (op, body, headers = {}, init = {}) =>
  fetch(BASE + '/api/' + op, Object.assign({ method: 'POST', headers: Object.assign({ origin: ORIGIN, 'content-type': 'application/json' }, headers), body: JSON.stringify(body || {}) }, init));
// Each group of PIN checks uses its own address (the front door trusts cf-connecting-ip, which
// Cloudflare sets in production and a local client can set freely), so the lock-out test cannot
// lock the others out.
const asIp = (ip, extra = {}) => Object.assign({ 'cf-connecting-ip': ip }, extra);

async function main() {
  console.log('-- first start: bundle, JSON import, migration');
  await start();

  let r = await call('state', { token: 'token-parent-A' }, asIp('10.0.0.1'));
  eq(r.status, 200, 'the bundled Worker answers a parent with 200');
  const s = await r.json();
  eq(s.ok, true, 'state is ok');
  eq(s.teachers.length, 32, 'teachers.json came through the bundle: 32 teachers');
  eq(s.times.length, 12, 'twelve slots');
  eq(s.config.open, false, 'a new room starts closed');
  eq(r.headers.get('cache-control'), 'no-store', 'responses are never cached');
  eq(r.headers.get('access-control-allow-origin'), ORIGIN, 'an allowed origin is echoed back');
  eq(r.headers.get('vary'), 'origin', 'vary: origin');

  console.log('-- origin, method and CORS');
  eq((await fetch(BASE + '/elsewhere')).status, 404, 'a path outside /api/ is 404');
  r = await call('state', {}, { origin: 'https://evil.example' });
  eq(r.status, 403, 'another origin is refused');
  eq(r.headers.get('access-control-allow-origin'), null, '…and gets no CORS header');
  r = await fetch(BASE + '/api/state', { method: 'POST', body: '{}' });
  eq(r.status, 403, 'no Origin header at all is refused');
  r = await fetch(BASE + '/api/state', { method: 'GET', headers: { origin: ORIGIN } });
  eq(r.status, 405, 'GET from the site is 405');
  r = await fetch(BASE + '/api/admin/state', { method: 'OPTIONS', headers: { origin: ORIGIN } });
  eq(r.status, 204, 'preflight from the site is 204');
  eq(r.headers.get('access-control-allow-origin'), ORIGIN, 'preflight names the origin');
  ok(/x-admin-pin/.test(r.headers.get('access-control-allow-headers') || ''), 'preflight allows the PIN header');
  eq(r.headers.get('access-control-allow-methods'), 'POST, OPTIONS', 'preflight methods');
  eq((await fetch(BASE + '/api/state', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })).status, 403, 'preflight from another origin is 403');

  console.log('-- body limits');
  r = await fetch(BASE + '/api/state', { method: 'POST', headers: { origin: ORIGIN }, body: '{nope' });
  eq(r.status, 400, 'malformed JSON is 400');
  r = await fetch(BASE + '/api/state', { method: 'POST', headers: { origin: ORIGIN }, body: 'x'.repeat(20001) });
  eq(r.status, 413, 'a body over 20000 characters is 413');

  console.log('-- the PIN');
  const ip2 = asIp('10.0.0.2');
  eq((await call('admin/state', {}, ip2)).status, 401, 'no PIN is 401');
  eq((await call('admin/state', {}, asIp('10.0.0.2', { 'x-admin-pin': 'nope' }))).status, 401, 'a wrong PIN is 401');
  eq((await call('admin/state', {}, asIp('10.0.0.2', { 'x-room-admin': '1' }))).status, 401, 'a caller cannot claim to be staff with the internal header');
  r = await call('admin/state', {}, asIp('10.0.0.2', { 'x-admin-pin': PIN }));
  eq(r.status, 200, 'the right PIN is 200');
  eq((await r.json()).ok, true, 'admin state is ok');
  eq((await call('admin/login', {}, asIp('10.0.0.2', { 'x-admin-pin': PIN }))).status, 200, 'admin/login with the right PIN is 200');

  console.log('-- booking, then stop the process');
  const staff = asIp('10.0.0.3', { 'x-admin-pin': PIN });
  eq((await (await call('admin/config', { open: true }, staff)).json()).ok, true, 'staff opens bookings');
  const tid = s.teachers[0].id;
  const parent = asIp('10.0.0.4');
  const hold = await (await call('hold', { token: 'token-parent-A', student: 'Azul Pina', tid, time: '4:00' }, parent)).json();
  eq(hold.ok, true, 'a hold is accepted');
  const co = await (await call('checkout', { token: 'token-parent-A', student: 'Azul Pina', parent: 'Maria', items: [{ tid, time: '4:00' }] }, parent)).json();
  ok(/^[A-Z2-9]{6}$/.test(String(co.code)), 'checkout gives a six-character code from crypto.getRandomValues (got ' + JSON.stringify(co.code) + ')');
  await stop();

  console.log('-- second start on the same storage: the Durable Object kept the event');
  await start();
  const again = await (await call('state', { token: 'token-parent-B' }, asIp('10.0.0.5'))).json();
  eq(again.config.open, true, 'the open switch survived the restart');
  eq(again.grid[tid][0], 't', 'the booked slot is still taken');
  r = await call('admin/export', {}, asIp('10.0.0.6', { 'x-admin-pin': PIN }));
  eq(r.status, 200, 'the staff export runs on workerd');
  ok(JSON.stringify(await r.json()).indexOf('Azul Pina') >= 0, 'the booking is in the export');

  console.log('-- the lock-out');
  const bad = (i) => call('admin/state', {}, asIp('10.0.0.9', { 'x-admin-pin': 'wrong' + i }));
  for (let i = 0; i < 10; i++) await bad(i);
  eq((await call('admin/state', {}, asIp('10.0.0.9', { 'x-admin-pin': PIN }))).status, 429, 'ten wrong PINs lock that address out, even for the right PIN');
  eq((await call('admin/state', {}, asIp('10.0.0.10', { 'x-admin-pin': PIN }))).status, 200, '…and another address is unaffected');
  await stop();

  console.log('-- no PIN configured');
  await start({ pin: '' });
  r = await call('admin/state', {}, asIp('10.0.0.11', { 'x-admin-pin': '' }));
  eq(r.status, 503, 'with ADMIN_PIN unset every staff call is 503');
  eq((await r.json()).reason, 'no-pin-configured', '…and says why');
  eq((await call('state', { token: 'token-parent-C' }, asIp('10.0.0.12'))).status, 200, 'parents are unaffected');
  await stop();
}

try {
  await main();
} catch (e) {
  failed++;
  console.log('  FAIL ' + (e && e.stack || e));
} finally {
  await stop();
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
