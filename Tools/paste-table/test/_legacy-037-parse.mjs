// A frozen copy of 037 Grade Distribution Visualizer's score reader as it was before Path 16 P2 moved
// its tab splitting onto _shared/paste-table.js (taken verbatim from the page at v407). The parity
// suite holds the page's reader to it; do not edit.
export function tryNumber(raw) {
  if (raw == null) return null;
  var s = String(raw).trim().replace(/%$/, '');
  if (s === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function extractScore(line) {
  var t = line.trim();
  if (!t) return null;

  if (t.indexOf('\t') !== -1) {
    var tabParts = t.split('\t').map(function (p) { return p.trim(); }).filter(function (p) { return p !== ''; });
    var vTab = tabParts.length ? tryNumber(tabParts[tabParts.length - 1]) : null;
    if (vTab !== null) return vTab;
  }
  var lastColon = t.lastIndexOf(':');
  if (lastColon !== -1) {
    var vColon = tryNumber(t.slice(lastColon + 1));
    if (vColon !== null) return vColon;
  }
  var lastComma = t.lastIndexOf(',');
  if (lastComma !== -1) {
    var vComma = tryNumber(t.slice(lastComma + 1));
    if (vComma !== null) return vComma;
  }
  var vWhole = tryNumber(t);
  if (vWhole !== null) return vWhole;

  var wsParts = t.split(/\s+/);
  if (wsParts.length > 1) {
    var vWs = tryNumber(wsParts[wsParts.length - 1]);
    if (vWs !== null) return vWs;
  }
  return null;
}

export function parseScores(raw) {
  var lines = String(raw || '').split(/\r?\n/);
  var scores = [];
  var seen = 0, skipped = 0;
  lines.forEach(function (line) {
    if (!line.trim()) return;
    seen++;
    var v = extractScore(line);
    if (v !== null) scores.push(v);
    else skipped++;
  });
  return { scores: scores, seen: seen, skipped: skipped };
}
