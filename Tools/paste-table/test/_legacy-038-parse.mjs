// A frozen copy of 038 Data Chart Builder's table parser as it was before Path 16 P2 moved it onto
// _shared/paste-table.js (taken verbatim from Tools/038-data-chart-builder.html at v405, with the
// checkbox read from an argument). The parity suite holds the page's parseTable to it; do not edit.
export function splitLine(line, delim) {
  var result = [], cur = '', inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQuotes) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) { result.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result.map(function (s) { return s.trim(); });
}

export function parseTable(text, hasHeaders) {
  var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length; });
  if (!lines.length) return null;
  var delim = lines[0].indexOf('\t') !== -1 ? '\t' : ',';
  var rows = lines.map(function (l) { return splitLine(l, delim); });
  var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
  rows = rows.map(function (r) { while (r.length < width) r.push(''); return r; });

  var headers;
  if (hasHeaders) {
    headers = rows.shift();
  } else {
    headers = [];
    for (var i = 0; i < width; i++) headers.push('Column ' + (i + 1));
  }
  return { headers: headers, rows: rows };
}
