// A frozen copy of 075 Staff Directory Builder's bulk-add row reader as it was before Path 16 P2
// moved it onto _shared/paste-table.js (the loop body of the "Add pasted rows" handler, taken
// verbatim at v408, returning the argument lists it handed to addPerson instead of calling it).
// The parity suite holds the page's readBulkRows to it; do not edit.
export function bulkArgs(text) {
  var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  var out = [];
  lines.forEach(function (line) {
    var parts = line.indexOf('\t') !== -1 ? line.split('\t') : line.split(',');
    parts = parts.map(function (p) { return p.trim(); });
    // addPerson's first act: a blank name adds nothing and counts nothing
    if (!(parts[0] || '').trim()) return;
    out.push(parts);
  });
  return out;
}
