/* dm-frame.js — a cover page, a header and page numbers for 031's merged document (BACKLOG row 74).

   Pure functions that make WordprocessingML strings; no DOM, no storage. The page parses
   them and wires the header and footer parts into the package. Every string a teacher
   types goes through text(): XML-escaped and stripped of the control characters XML 1.0
   forbids, which would otherwise make the whole merged file unreadable to Word.

   The merged document is one section (the last file's page setup, as before), so the
   header, footer and page numbers apply to every page; "leave the first page clear" is
   w:titlePg, which blanks the first page's header and footer without touching the count.
   The first page is numbered 1 even when it is the cover. */
(function (root) {
  'use strict';

  var W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var NUMBER_STYLES = ['none', 'page', 'pageOf', 'plain'];
  var ALIGNS = ['left', 'center', 'right'];
  var MAX = { title: 120, line: 120, header: 200, footer: 200 };

  function text(s, max) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function validIso(d) {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    var t = new Date(d + 'T00:00:00Z');
    return !isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
  }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /* Plain and zone-proof: the date a teacher picked is the date printed. */
  function formatDate(iso) {
    if (!validIso(iso)) return '';
    var p = iso.split('-');
    return MONTHS[parseInt(p[1], 10) - 1] + ' ' + parseInt(p[2], 10) + ', ' + p[0];
  }

  /* Whatever was stored or typed becomes a spec the rest can trust. */
  function cleanSpec(raw) {
    var r = raw && typeof raw === 'object' ? raw : {};
    var c = r.cover && typeof r.cover === 'object' ? r.cover : {};
    return {
      cover: {
        on: c.on === true,
        title: text(c.title, MAX.title),
        subtitle: text(c.subtitle, MAX.line),
        teacher: text(c.teacher, MAX.line),
        date: validIso(c.date) ? c.date : ''
      },
      header: text(r.header, MAX.header),
      footer: text(r.footer, MAX.footer),
      numbers: NUMBER_STYLES.indexOf(r.numbers) >= 0 ? r.numbers : 'none',
      align: ALIGNS.indexOf(r.align) >= 0 ? r.align : 'center',
      clearFirst: r.clearFirst !== false
    };
  }
  function hasHeader(spec) { return !!spec.header; }
  function hasFooter(spec) { return !!spec.footer || spec.numbers !== 'none'; }
  function hasFrame(spec) { return hasHeader(spec) || hasFooter(spec); }

  function run(t, rpr) {
    return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>';
  }
  function para(inner, jc, spacing) {
    return '<w:p><w:pPr>' + (spacing ? '<w:spacing ' + spacing + '/>' : '') + '<w:jc w:val="' + jc + '"/></w:pPr>' + inner + '</w:p>';
  }
  function field(instr, shown) {
    return '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ' + instr + ' </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>' + shown + '</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
  }

  /* The cover's paragraphs, ending in a page break, as the children of a w:body.
     `fallbackTitle` is used when no title was typed (the output file name). */
  function coverXml(spec, fallbackTitle) {
    var c = spec.cover, out = '';
    var title = c.title || text(fallbackTitle, MAX.title) || 'Merged Document';
    out += para(run(title, '<w:b/><w:sz w:val="56"/><w:szCs w:val="56"/>'), 'center', 'w:before="3000" w:after="360"');
    if (c.subtitle) out += para(run(c.subtitle, '<w:sz w:val="32"/><w:szCs w:val="32"/>'), 'center', 'w:after="240"');
    if (c.teacher) out += para(run(c.teacher, '<w:sz w:val="28"/><w:szCs w:val="28"/>'), 'center', 'w:after="120"');
    var d = formatDate(c.date);
    if (d) out += para(run(d, '<w:sz w:val="28"/><w:szCs w:val="28"/>'), 'center', 'w:after="120"');
    out += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    return '<w:body xmlns:w="' + W_NS + '">' + out + '</w:body>';
  }

  function headerPartXml(spec) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr xmlns:w="' + W_NS + '">' +
      para(run(spec.header), spec.align) + '</w:hdr>';
  }
  function numberRuns(style) {
    if (style === 'page') return run('Page ') + field('PAGE', '1');
    if (style === 'pageOf') return run('Page ') + field('PAGE', '1') + run(' of ') + field('NUMPAGES', '1');
    if (style === 'plain') return field('PAGE', '1');
    return '';
  }
  function footerPartXml(spec) {
    var out = '';
    if (spec.footer) out += para(run(spec.footer), spec.align);
    if (spec.numbers !== 'none') out += para(numberRuns(spec.numbers), spec.align);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr xmlns:w="' + W_NS + '">' + out + '</w:ftr>';
  }

  root.DocxFrame = {
    W_NS: W_NS, NUMBER_STYLES: NUMBER_STYLES, ALIGNS: ALIGNS, MAX: MAX,
    text: text, esc: esc, formatDate: formatDate, validIso: validIso,
    cleanSpec: cleanSpec, hasHeader: hasHeader, hasFooter: hasFooter, hasFrame: hasFrame,
    coverXml: coverXml, headerPartXml: headerPartXml, footerPartXml: footerPartXml
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
