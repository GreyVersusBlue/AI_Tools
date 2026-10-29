// smoke-one-renderer.mjs — 044's .docx and its plain-text copy/print are drawn from one model (Path 10 P4, increment 3).
//
//   node Tools/sub-plan-builder/test/smoke-one-renderer.mjs [--update]   (or: npm run test:sub-plan-render; port 8600)
//
// What this pins:
//   - the Word document's body XML and the plain-text plan for three plans (the untouched defaults; a full
//     three-day plan with bold, a split-by-period day, a seating chart, student notes and every standing detail;
//     and a bare plan with nothing entered) equal the files in test/golden/, which were captured from the page
//     BEFORE the two builders were joined, so joining them changed nothing for these plans
//   - the two outputs say the same thing: every line of the plain text (bold marks removed, the "- " of a schedule
//     step removed) is found in the Word document's text, in the same order, for the full plan, except the lines
//     named in KNOWN_PLAIN_ONLY (the seating chart is an image in Word and a sentence in text)
//   - a standing detail typed with **bold** is bold in Word and plain in the text (the one place the two used
//     to disagree: attendance, rooms, phones and keys were printed with the asterisks)
//   - a change made in the shared model shows up in both outputs (the Quick checklist's "Keys" line)
//
// Line endings are normalised on both sides: the XML declaration ends in CRLF and git may rewrite the golden files.
// --update rewrites test/golden/ from the page as it is: use it only for a change the design says to make, and
// put the diff of the golden files in the same commit. Nothing here opens the .docx in Word. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8600;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '044-Sub%20Plan%20Builder.html';
const GOLDEN = path.join(SITE, 'Tools', 'sub-plan-builder', 'test', 'golden');
const UPDATE = process.argv.includes('--update');

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };

const STANDING_FULL = {
  teacherName: 'Ms. Example', roomNumber: '214', rosterLocation: 'Blue folder', absenceLocation: 'Tray by the door',
  emergencyLocation: 'Red bin', periods: [{ label: '1', time: '8:00-8:50', _id: 'p0' }, { label: '2', time: '', _id: 'p1' }, { label: '5', time: '1:00-1:50', _id: 'p2' }],
  fireRoute: 'Out the **east** door to the field', lockdownProcedure: 'Lights off, door locked', medicalAlerts: 'Max: **nut allergy**',
  keysLocation: 'On the hook by the door', whoToAsk: 'Mr. Neighbour, room 215', techFailureText: 'Use the **whiteboard**; call 4411',
  attendanceText: 'Pull the chips; read the roll.', behaviorVariant: 'custom', behaviorCustom: 'Be kind.\n**Stay in your seat.**',
  referralLines: '2', phoneNurse: '555-0100', phoneCounseling: '555-0101', phoneSupport: '555-0102', phoneOther: 'Posted on the cabinet',
  includeCallingOut: true, signOffName: 'Ms. E'
};
const STANDING_BARE = {
  teacherName: '', roomNumber: '', periods: [], rosterLocation: '', absenceLocation: '', emergencyLocation: '', attendanceText: '',
  behaviorVariant: 'short', behaviorCustom: '', referralLines: '0', phoneNurse: '', phoneCounseling: '', phoneSupport: '', phoneOther: '',
  includeCallingOut: false, signOffName: '', fireRoute: '', lockdownProcedure: '', medicalAlerts: '', keysLocation: '', whoToAsk: '', techFailureText: ''
};
const PLANS_FULL = {
  '2026-11-02': { lessonTitle: 'Fall of Rome', announcement: 'Assembly at 10:00\n**Bring your planner**', overviewText: 'Students watch the **video** and answer questions.\nThen a quick share-out.', scheduleText: '**Do now (5 min):** Name two causes.\n**Video (30 min):** pause at 12:00\nQuiet reading', samePeriods: true, sharedPeriodNotes: 'Same for everyone.\nCollect the **guides**.', perPeriodValues: {}, materialsNote: 'Guides are on the desk.\nVideo link is on the board.', dayType: 'video' },
  '2026-11-03': { lessonTitle: '', announcement: '', overviewText: 'Gallery walk.', scheduleText: '', samePeriods: false, sharedPeriodNotes: '', perPeriodValues: { p0: 'Period one starts at the back.', p1: '', p2: 'Half class\n**Test makeup** in the hall' }, materialsNote: '', dayType: 'lesson' },
  '2026-11-04': { lessonTitle: 'Review & <Quiz>', announcement: '', overviewText: '', scheduleText: 'Quiz 1 & 2\nReview', samePeriods: true, sharedPeriodNotes: '', perPeriodValues: {}, materialsNote: '', dayType: 'lesson' }
};

// The vendored JSZip is a UMD file; package.json says "type": "module", so require() would see an empty export.
const JSZip = (() => {
  const m = { exports: {} };
  new Function('module', 'exports', fs.readFileSync(path.join(SITE, '_shared', 'vendor', 'jszip', 'jszip.min.js'), 'utf8'))(m, m.exports);
  return m.exports;
})();

// A 1x1 PNG: the seating chart's pixels are not in document.xml, only its size and the heading.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// The page is one closure, so it is driven the way a teacher drives it: a saved-details seed or a ?plan= link in,
// the Word file and the quick-copy box out.
async function open(browser, { standing, link } = {}) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 1000 });
  page.on('dialog', d => d.accept());
  await page.addInitScript(([standing]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (standing) localStorage.setItem('subPlanBuilder.standingDetails.v1', JSON.stringify(standing));
  }, [standing || null]);
  let url = `${BASE}/Tools/${FILE}`;
  if (link) url += '?plan=' + encodeURIComponent(Buffer.from(encodeURIComponent(JSON.stringify(link)).replace(/%([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('base64'));
  await page.goto(url, { waitUntil: 'load' });
  await settle(page, 500);
  return page;
}

async function build(page, { studentNotes, seating } = {}) {
  if (studentNotes) await page.fill('#studentNotes', studentNotes);
  if (seating) {
    await page.setInputFiles('#seatingChartFile', { name: 'room.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForFunction(() => /attached|Attached|Image|×/.test(document.getElementById('seatingChartStatus').textContent));
  }
  await page.click('#btnGenerate');
  await page.waitForFunction(() => document.getElementById('downloadArea').style.display === 'block', null, { timeout: 15000 });
  const b64 = await page.evaluate(async () => {
    const buf = new Uint8Array(await (await fetch(document.getElementById('downloadLink').href)).arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  });
  const zip = await JSZip.loadAsync(Buffer.from(b64, 'base64'));
  const docx = await zip.file('word/document.xml').async('string');
  await page.click('#btnQuickCopy');
  await page.waitForSelector('#qcText');
  const text = await page.inputValue('#qcText');
  await page.click('#qcClose');
  return { docx, text };
}

const plain = s => s.replace(/<[^>]*>/g, '');
function docxLines(xml) {
  return xml.split(/<\/w:p>/).map(p => plain(p.replace(/<w:tab\/>/g, ' ')).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()).filter(Boolean);
}
// Lines the text says and Word draws instead of saying, and the one rule the two do not share.
const KNOWN_PLAIN_ONLY = [/^Seating chart: attached/];

function check(name, got) {
  fs.mkdirSync(GOLDEN, { recursive: true });
  const files = { [name + '.docx.xml']: got.docx, [name + '.txt']: got.text };
  for (const [f, body] of Object.entries(files)) {
    const p = path.join(GOLDEN, f);
    if (UPDATE) { fs.writeFileSync(p, body); continue; }
    ok(fs.existsSync(p) && fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === body.replace(/\r\n/g, '\n'), `${name}: ${f} equals the golden file`);
  }
}

console.log('044 — one model, two renderers');
const server = await serve(PORT);
const browser = await launch();
try {
  {
    const page = await open(browser);
    await page.fill('#planDate', '2026-11-02');
    check('default', await build(page));
    await page.close();
  }
  let full;
  {
    const page = await open(browser, { link: { v: 1, standing: STANDING_FULL, planDate: '2026-11-02', numDays: '3', days: PLANS_FULL } });
    full = await build(page, { studentNotes: 'Jane: extended time\n**Sam**: nurse at 10', seating: true });
    check('full', full);
    await page.close();
  }
  {
    const page = await open(browser, { standing: STANDING_BARE });
    await page.fill('#planDate', '2026-11-02');
    check('bare', await build(page));
    await page.close();
  }

  if (!UPDATE) {
    // A mark typed in a standing detail is bold in Word and gone from the text; no asterisk reaches either file.
    ok(!full.docx.includes('**') && !full.text.includes('**'), 'full plan: no ** reaches the Word file or the text, even in announcements and behavior lines');
    const page = await open(browser, { standing: { ...STANDING_FULL, attendanceText: 'Pull the **chips**', keysLocation: 'Hook **3**', phoneNurse: 'Ext **9**' } });
    await page.fill('#planDate', '2026-11-02');
    const rich = await build(page);
    ok(rich.text.includes('Attendance: Pull the chips') && rich.text.includes('Keys: Hook 3') && rich.text.includes('Nurse: Ext 9') && !rich.text.includes('*'), 'rich: attendance, keys and phone lose their marks in the text');
    ok(rich.docx.includes('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">chips</w:t>') && rich.docx.includes('>3</w:t>') && rich.docx.includes('>9</w:t>') && !rich.docx.includes('*'), 'rich: and are bold runs in Word');
    // The same model feeds both: one more line in the checklist reaches each.
    await page.fill('#keysLocation', 'Under the plant');
    const moved = await build(page);
    ok(moved.text.includes('  Keys: Under the plant') && moved.docx.includes('Keys: Under the plant'), 'a changed standing detail reaches both outputs');
    await page.close();
  }

  if (!UPDATE) {
    // The two outputs say the same thing.
    const word = docxLines(full.docx).map(l => l.toLowerCase());
    let at = 0, missing = [];
    for (const raw of full.text.split('\n')) {
      const line = raw.replace(/^\s*-\s+/, '').trim();
      if (!line || /^=+$/.test(line) || KNOWN_PLAIN_ONLY.some(r => r.test(line))) continue;
      // The text spells the one quotation mark with straight quotes; Word has always had curly ones.
      const want = line.toLowerCase().replace(/"call"/, '“call”');
      // A period is a row of a table in Word: its name and its time are two cells.
      const row = /^(period \S+)(?: \((.*)\))?$/.exec(want);
      const parts = row ? [row[1], row[2]].filter(Boolean) : [want];
      for (const part of parts) {
        const i = word.findIndex((w, k) => k >= at && w.replace(/\s+/g, ' ') === part.replace(/\s+/g, ' '));
        if (i < 0) missing.push(line); else at = i;
      }
    }
    ok(missing.length === 0, 'every plain-text line is in the Word document, in order — not found: ' + JSON.stringify(missing.slice(0, 6)));
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
