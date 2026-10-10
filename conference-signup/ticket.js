/* ticket.js — the appointment tickets, as a PDF a parent can save or print.
   One dashed-edge ticket per meeting, a header with the child and the
   confirmation code. Drawn with the site's one vendored jsPDF. */

/* jsPDF's built-in fonts cover Latin-1 only; a character outside it would print as
   garbage, so fold the common ones and drop the rest. */
function latin(s) {
  return String(s == null ? '' : s)
    .normalize('NFC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^ -~ -ÿ]/g, '');
}

export function ticketPdf(receipt) {
  const lib = window.jspdf && window.jspdf.jsPDF;
  if (!lib) throw new Error('The PDF library has not loaded yet.');
  const doc = new lib({ unit: 'in', format: 'letter' });
  const W = 8.5;
  const M = 0.75;
  const navy = [31, 58, 95];
  const grey = [91, 98, 112];
  const kraft = [168, 118, 58];
  const kid = latin(receipt.bookings[0] && receipt.bookings[0].student);

  let y = M;
  const header = (cont) => {
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(latin(receipt.school || 'Conference'), M, y + 0.25);
    doc.setFontSize(12);
    doc.setTextColor(...grey);
    doc.setFont('helvetica', 'normal');
    doc.text(latin([receipt.title, receipt.date].filter(Boolean).join('  |  ')), M, y + 0.52);
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Conference pass for ' + kid + (cont ? ' (continued)' : ''), M, y + 0.88);
    doc.setFont('courier', 'bold');
    doc.setFontSize(16);
    doc.text('Confirmation ' + receipt.code, W - M, y + 0.25, { align: 'right' });
    y += 1.2;
  };
  header(false);

  const H = 1.25;
  for (const b of receipt.bookings) {
    if (y + H > 11 - M) {
      doc.addPage();
      y = M;
      header(true);
    }
    doc.setDrawColor(...kraft);
    doc.setLineWidth(0.02);
    doc.setLineDashPattern([0.08, 0.06], 0);
    doc.roundedRect(M, y, W - 2 * M, H, 0.12, 0.12);
    doc.setLineDashPattern([], 0);
    /* the tear-off stub: a dashed line a third of the way across */
    doc.setLineDashPattern([0.04, 0.05], 0);
    doc.line(M + 1.9, y + 0.1, M + 1.9, y + H - 0.1);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.text(latin(b.time), M + 0.25, y + 0.62);
    doc.setFontSize(12);
    doc.setTextColor(...grey);
    doc.text('PM', M + 0.25, y + 0.9);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.text(latin(b.teacher), M + 2.15, y + 0.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...grey);
    doc.text(latin(b.subject || ''), M + 2.15, y + 0.78);
    doc.text(latin('Student: ' + b.student), M + 2.15, y + 1.02);
    y += H + 0.2;
  }
  doc.setFontSize(10);
  doc.setTextColor(...grey);
  doc.text('Keep this page or take a photo of it. To change a time, contact the school office and give them the confirmation code.', M, Math.min(y + 0.1, 11 - M));
  return doc;
}

export function ticketName(receipt) {
  const kid = (receipt.bookings[0] && receipt.bookings[0].student) || 'student';
  return ('Conference tickets - ' + kid).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() + '.pdf';
}
