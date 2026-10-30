// smoke-pron.mjs — 051's Hear it and Record buttons (Path 19 P5).
//
//   node Tools/classroom-label-maker/test/smoke-pron.mjs        (port 8620)
//
// Hear speaks the word through _shared/speak.js; Record keeps the teacher's own recording in the
// media store (namespace `labels`) when this device has no voice for the language, and it plays
// back there. The microphone is Chromium's fake device playing a short tone, and the speech
// engine is a stub that logs what it was asked to say: this proves the logic and the storage,
// NOT that a real speaker says the word or a real microphone hears a real voice, and it
// does not touch the printed label's QR (smoke-print.mjs holds that).
//
// Exits 1 on any failure. Every word here is invented.

/* global ClmPron -- 051's recorder module, read inside page.evaluate() */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8620;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// one second of a 440 Hz tone, 16 kHz mono 16-bit, for the fake microphone
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clm-pron-'));
const TONE = path.join(dir, 'tone.wav');
{
  const n = 16000, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(16000, 24); buf.writeUInt32LE(32000, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / 16000) * 8000), 44 + i * 2);
  fs.writeFileSync(TONE, buf);
}

const server = await serve(PORT);
const browser = await launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-audio-capture=' + TONE] });
console.log('Classroom Label Maker — Hear it and Record');

const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
await page.addInitScript(() => {
  window.__said = [];
  const synth = { getVoices: () => [], cancel() {}, speak(u) { window.__said.push([u.text, u.lang]); }, addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
});
await page.goto(`${BASE}/Tools/051-classroom-label-maker.html`, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.selectOption('#langSelect', 'es-ES');
await page.fill('#wordInput', 'la mesa: the table\nla silla: the chair');
await page.click('#saveWordsBtn');
await settle(page, 400);

eq(await page.$$eval('#wordTable th', (e) => e.map((x) => x.textContent)), ['Target word', 'English', 'Pronunciation', 'Say it'], 'the table has a Say it column');
ok(/no voice for es-ES/.test(await page.textContent('#sayNote')), 'with no Spanish voice the page says so');
ok(/QR on a printed label still speaks with the scanning phone/.test(await page.textContent('#sayNote')), 'and says what a recording does not do');

/* Hear */
await page.click('button[aria-label="Hear la mesa"]');
eq(await page.evaluate(() => window.__said), [['la mesa', 'es-ES']], 'Hear speaks the word in the language');

/* Record, Stop, Play, Delete */
const rowBtns = (i) => page.$$eval(`#wordTable tr:nth-child(${i + 1}) td.say button`, (e) => e.map((x) => x.textContent));
eq(await rowBtns(1), ['Hear', 'Record'], 'a word with no recording has Hear and Record');
await page.click('button[aria-label="Record la mesa"]');
await page.waitForFunction(() => /Recording la mesa/.test(document.getElementById('recStatus').textContent));
ok(!!(await page.waitForSelector('button[aria-label="Stop recording la mesa"]', { timeout: 10000 }).catch(() => null)), 'while recording the button is Stop');
await settle(page, 1200);
await page.click('button[aria-label="Stop recording la mesa"]');
await page.waitForFunction(() => /Saved your recording of la mesa/.test(document.getElementById('recStatus').textContent), null, { timeout: 15000 });
eq(await rowBtns(1), ['Hear', 'Record', 'Play', 'Delete'], 'a recorded word gains Play and Delete');
eq(await rowBtns(2), ['Hear', 'Record'], 'the other word does not');
const rec = await page.evaluate(async () => {
  const r = await MediaDB.store({ ns: 'labels' }).list();
  const b = r.length ? await MediaDB.store({ ns: 'labels' }).getBlob(r[0].id) : null;
  return { n: r.length, id: r[0] && r[0].id, size: b && b.size, type: b && b.type, kind: r[0] && r[0].kind };
});
eq(rec.n, 1, 'one recording in the labels namespace');
eq(rec.id, 'pron:' + encodeURIComponent('es-es|la mesa'), 'its id is made from the language and the word');
ok(rec.size > 500, `it holds sound (${rec.size} bytes)`);
ok(/^audio\//.test(rec.type), `of an audio type (${rec.type})`);
eq(rec.kind, 'pronunciation', 'marked as a pronunciation');
await page.evaluate(() => { window.__played = 0; HTMLMediaElement.prototype.play = function () { window.__played++; return Promise.resolve(); }; });
await page.click('button[aria-label="Play your recording of la mesa"]');
await settle(page, 300);
eq(await page.evaluate(() => window.__played), 1, 'Play plays it');
// a recording is per language: the same word in another language has none
await page.selectOption('#langSelect', 'fr-FR'); await settle(page, 400);
eq(await rowBtns(1), ['Hear', 'Record'], 'the same word under another language has no recording');
await page.selectOption('#langSelect', 'es-ES'); await settle(page, 400);
eq(await rowBtns(1), ['Hear', 'Record', 'Play', 'Delete'], 'and it is back under the first');
await page.click('button[aria-label="Delete your recording of la mesa"]');
await page.waitForFunction(() => /Deleted the recording of la mesa/.test(document.getElementById('recStatus').textContent));
eq(await rowBtns(1), ['Hear', 'Record'], 'Delete takes it away');
eq(await page.evaluate(async () => (await MediaDB.store({ ns: 'labels' }).list()).length), 0, 'and out of the store');

/* a recording stops itself at its limit */
await page.evaluate(() => { ClmPron.MAX_MS = 1200; });
await page.click('button[aria-label="Record la silla"]');
await page.waitForFunction(() => /Saved your recording of la silla/.test(document.getElementById('recStatus').textContent), null, { timeout: 15000 });
ok(true, 'a recording left running stops at its limit and is kept');
await page.click('button[aria-label="Delete your recording of la silla"]');
await settle(page, 300);

/* a blocked microphone says so */
await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })); });
await page.click('button[aria-label="Record la mesa"]');
await page.waitForFunction(() => /microphone is blocked/.test(document.getElementById('recStatus').textContent));
ok(true, 'a blocked microphone says it is blocked');
eq(await rowBtns(1), ['Hear', 'Record'], 'and leaves the row as it was');

/* a voice that exists removes the warning */
await page.evaluate(() => { Object.defineProperty(window.speechSynthesis, 'getVoices', { value: () => [{ lang: 'es_MX', name: 'x' }] }); });
await page.selectOption('#langSelect', 'fr-FR'); await page.selectOption('#langSelect', 'es-ES'); await settle(page, 400);
eq(await page.textContent('#sayNote'), '', 'with a Spanish voice on the device there is no warning');

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 5)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 5)));
await browser.close();
server.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
