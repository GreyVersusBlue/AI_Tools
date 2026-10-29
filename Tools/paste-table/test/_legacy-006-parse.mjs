// A frozen copy of Roster.splitCells and Roster.parseDelimited, the pasted-table reader 006 Class Roster
// Hub used before Path 16 P2 (taken verbatim from _shared/roster.js at v409). parseDelimited left
// roster.js then; splitCells stays there for 016's bulk codes. The parity suite holds 006's parseTable
// to this; do not edit.
export function splitCells(line, delim) {
    var out = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  /** CSV/TSV text → `{rows, cols}`, every row right-padded to `cols`. */
export function parseDelimited(text) {
    var lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return { rows: [], cols: 0 };
    var delim = lines[0].indexOf('\t') !== -1 ? '\t' : (lines[0].indexOf(',') !== -1 ? ',' : '\t');
    var rows = lines.map(function (l) { return splitCells(l, delim); });
    var cols = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    rows.forEach(function (r) { while (r.length < cols) r.push(''); });
    return { rows: rows, cols: cols };
  }

