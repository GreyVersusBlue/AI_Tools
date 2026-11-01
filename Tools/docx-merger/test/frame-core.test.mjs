// frame-core.test.mjs — dm-frame.js, the cover/header/footer XML of 031, pure Node.
//   node Tools/docx-merger/test/frame-core.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(here, '..', 'dm-frame.js'), 'utf8'), ctx);
const F = ctx.DocxFrame;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/** Tag-balance check: the tests cannot call DOMParser, so walk the tags. */
function wellFormed(xml) {
  const body = xml.replace(/<\?xml[^?]*\?>/, '');
  const re = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g;
  const stack = []; let last = 0, m;
  while ((m = re.exec(body))) {
    if (body.slice(last, m.index).includes('<')) return false;       // a stray "<" in text
    if (/&(?!amp;|lt;|gt;|quot;|apos;)/.test(body.slice(last, m.index))) return false; // a bare &
    last = re.lastIndex;
    if (m[4]) continue;
    if (m[1]) { if (stack.pop() !== m[2]) return false; } else stack.push(m[2]);
  }
  return stack.length === 0 && !body.slice(last).includes('<');
}

console.log('Word Doc Merger — cover, header, footer (core)');

// cleanSpec
for (const junk of [null, undefined, 3, 'x', [], {}]) {
  const s = F.cleanSpec(junk);
  ok(!s.cover.on && s.header === '' && s.footer === '' && s.numbers === 'none' && s.align === 'center' && s.clearFirst === true, 'junk is the empty spec: ' + JSON.stringify(junk));
  ok(!F.hasFrame(s), 'and asks for no frame');
}
let s = F.cleanSpec({ cover: { on: 'yes', title: ' T ' }, numbers: 'roman', align: 'up', clearFirst: 0 });
ok(s.cover.on === false, 'only a real true turns the cover on');
eq([s.cover.title, s.numbers, s.align, s.clearFirst], ['T', 'none', 'center', true], 'bad numbers/align fall back; clearFirst is on unless explicitly false');
eq(F.cleanSpec({ clearFirst: false }).clearFirst, false, 'explicit false is kept');
eq(F.text('a\u0000b\u0008c\u000Bd\u001Fe', 50), 'abcde', 'control characters XML forbids are removed');
eq(F.text('a \n\t b', 50), 'a b', 'whitespace is squeezed');
eq(F.text('x'.repeat(500), 120).length, 120, 'text is capped');
eq(F.text(null, 5), '', 'null is empty');
eq(F.cleanSpec({ cover: { date: '2026-02-30' } }).cover.date, '', 'an impossible date is dropped');
eq(F.cleanSpec({ cover: { date: '2026-10-12' } }).cover.date, '2026-10-12', 'a real date is kept');
eq(F.formatDate('2026-10-12'), 'October 12, 2026', 'dates print long, with no day shift');
eq(F.formatDate('2026-01-01'), 'January 1, 2026', 'no leading zero on the day');
eq(F.formatDate('nope'), '', 'a bad date prints nothing');

// hasHeader / hasFooter / hasFrame
ok(F.hasHeader(F.cleanSpec({ header: 'H' })) && !F.hasFooter(F.cleanSpec({ header: 'H' })), 'a header alone');
ok(F.hasFooter(F.cleanSpec({ footer: 'F' })) && !F.hasHeader(F.cleanSpec({ footer: 'F' })), 'footer text alone');
ok(F.hasFooter(F.cleanSpec({ numbers: 'plain' })), 'page numbers alone make a footer');
ok(!F.hasFrame(F.cleanSpec({ cover: { on: true, title: 'T' } })), 'a cover alone is not a header or footer');

// parts
const full = F.cleanSpec({ header: 'Unit 3 <Packet> & more', footer: 'Room 12', numbers: 'pageOf', align: 'right' });
const hdr = F.headerPartXml(full), ftr = F.footerPartXml(full);
ok(wellFormed(hdr) && wellFormed(ftr), 'header and footer are well-formed even with < and & in the text');
ok(hdr.includes('Unit 3 &lt;Packet&gt; &amp; more') && !hdr.includes('<Packet>'), 'markup typed in the header is escaped text');
ok(hdr.includes('w:val="right"') && ftr.includes('w:val="right"'), 'alignment applies to both');
ok(ftr.includes('Room 12') && ftr.includes(' PAGE ') && ftr.includes(' NUMPAGES ') && ftr.includes('Page ') && ftr.includes(' of '), 'footer text, then "Page X of Y" fields');
eq((ftr.match(/<w:p>/g) || []).length, 2, 'footer text and numbers are two lines');
eq((F.footerPartXml(F.cleanSpec({ numbers: 'page' })).match(/NUMPAGES/g) || []).length, 0, '"Page 1" has no total');
const plain = F.footerPartXml(F.cleanSpec({ numbers: 'plain' }));
ok(plain.includes(' PAGE ') && !plain.includes('Page ') && !plain.includes('NUMPAGES'), 'a bare number is only the field');
eq((F.footerPartXml(F.cleanSpec({ footer: 'F' })).match(/PAGE/g) || []).length, 0, 'footer text alone has no field');
ok(['none', 'page', 'pageOf', 'plain'].every(n => wellFormed(F.footerPartXml(F.cleanSpec({ numbers: n, footer: n === 'none' ? 'x' : '' })))), 'every numbering style is well-formed');

// cover
const cov = F.coverXml(F.cleanSpec({ cover: { on: true, title: 'Fractions & Ratios', subtitle: 'Math 7', teacher: 'Pat <Example>', date: '2026-10-12' } }), 'ignored');
ok(wellFormed(cov), 'the cover is well-formed');
ok(cov.includes('Fractions &amp; Ratios') && cov.includes('Math 7') && cov.includes('Pat &lt;Example&gt;') && cov.includes('October 12, 2026'), 'every cover line is there, escaped');
ok(cov.indexOf('Fractions') < cov.indexOf('Math 7') && cov.indexOf('Math 7') < cov.indexOf('Pat') && cov.indexOf('Pat') < cov.indexOf('October'), 'title, class, teacher, date, in that order');
ok(/<w:br w:type="page"\/><\/w:r><\/w:p><\/w:body>$/.test(cov), 'the cover ends with a page break');
ok(!F.coverXml(F.cleanSpec({ cover: { on: true } }), 'Unit 3 Packet').includes('Math 7') && F.coverXml(F.cleanSpec({ cover: { on: true } }), 'Unit 3 Packet').includes('Unit 3 Packet'), 'a blank title falls back to the file name');
ok(F.coverXml(F.cleanSpec({ cover: { on: true } }), '').includes('Merged Document'), 'and to "Merged Document" with no name at all');
eq((F.coverXml(F.cleanSpec({ cover: { on: true, title: 'T' } }), '').match(/<w:p>/g) || []).length, 2, 'a title-only cover is the title and the break');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
