// A frozen copy of bmg-choropleth.js's pasted-text parsers as they were before Path 16 P2 moved them
// to _shared/paste-table.js (taken verbatim from the file at v404). The parity suite holds PasteTable
// to this for every input; do not edit it.

// One "name, value" line. The name is matched lazily and the value must be
// the whole rest of the line, so a name containing the delimiter still
// works: in "Congo, Dem. Rep., 95000000" the first split leaves a value of
// "Dem. Rep., 95000000", which isn't numeric, so the match backtracks to
// the last comma and the name comes out whole. Thousands separators, a
// leading $ and a trailing % all survive, since spreadsheets emit them.
const ROW_RE = /^\s*(.*?)\s*[\t;,|]\s*\$?\s*(-?[\d][\d,\s]*(?:\.\d+)?\s*%?)\s*$/;

function toNumber(token) {
  const cleaned = String(token).replace(/[,\s%$]/g, "");
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses pasted text into rows. Blank lines are ignored. A first line that
 * isn't a name/number pair is treated as a header ("state, population") and
 * skipped, as long as something after it does parse — otherwise it is
 * reported like any other unreadable line rather than being swallowed.
 * Later duplicates of the same name win, matching what a spreadsheet does
 * when you look up a key.
 */
export function parseDataRows(text) {
  const lines = String(text == null ? "" : text).split(/\r?\n/);
  const parsed = [];
  const unreadable = [];
  let headerSkipped = null;
  let firstBad = null;

  lines.forEach(line => {
    if (!line.trim()) return;
    const m = ROW_RE.exec(line);
    const value = m ? toNumber(m[2]) : null;
    if (!m || !m[1].trim() || value === null) {
      if (firstBad === null && parsed.length === 0) firstBad = line.trim();
      else unreadable.push(line.trim());
      return;
    }
    parsed.push({ name: m[1].trim(), value });
  });

  if (firstBad !== null) {
    if (parsed.length) headerSkipped = firstBad;
    else unreadable.unshift(firstBad);
  }
  return { rows: parsed, headerSkipped, unreadable };
}



/**
 * Which character separates the columns. Order matters and is not arbitrary:
 * a real spreadsheet paste is tab-separated, and a tab can never appear
 * inside a number, so preferring it removes the whole ambiguity below
 * whenever it is available.
 */
function pickDelimiter(text) {
  if (text.includes("\t")) return "\t";
  if (text.includes(";")) return ";";
  if (text.includes("|")) return "|";
  return ",";
}

/** A field that is exactly three digits — the shape of a thousands group, and the reason a comma is a poor column separator for a table of big numbers. */
const THOUSANDS_GROUP = /^\d{3}$/;

function isNumberField(s) { return toNumber(s) !== null; }

/** How many fields at the end of a row read as numbers. */
function trailingNumberCount(fields) {
  let n = 0;
  for (let i = fields.length - 1; i >= 1; i--) {
    if (!isNumberField(fields[i])) break;
    n++;
  }
  return n;
}

/**
 * Whether a line is naming the columns rather than filling them.
 *
 * The single-column parser could tell by asking "does this parse as data?",
 * because a header like `State, Population` doesn't. A time-slice header
 * does: `State, 1790, 1850, 1900` is, read literally, Virginia with three
 * numbers in it. So the test is about *shape* instead. A header's first
 * field is a label, never a number, and its remaining fields are either
 * words (the classic case) or four-digit years (the case this whole feature
 * exists for). Six-digit populations are not years, so a data row is never
 * mistaken for a header and quietly eaten.
 */
function looksLikeHeader(fields) {
  if (fields.length < 2 || isNumberField(fields[0]) || !fields[0]) return false;
  const values = fields.slice(1);
  if (values.every(v => v && !isNumberField(v))) return true;
  return values.every(v => /^\d{4}$/.test(v) && Number(v) >= 1000 && Number(v) <= 2999);
}

/**
 * Parses a table with one *or more* value columns per place:
 *
 *     State, 1790, 1850, 1900
 *     Maryland, 320000, 583000, 1188000
 *
 * **The comma problem, stated honestly.** The single-column parser gets away
 * with commas because it requires the value to run to the end of the line,
 * so `6,200,000` is one token and can only be one number. With several value
 * columns that trick is gone, and `Maryland, 69,000, 148,000` is genuinely
 * ambiguous: two numbers with thousands separators, or four plain numbers?
 * No rule decides that correctly in every case, and a parser that guesses
 * puts a wrong number on a map a class is about to read.
 *
 * So it does not guess. A tab, semicolon or pipe removes the ambiguity
 * outright and is preferred whenever the paste contains one — which covers
 * every real spreadsheet paste. With commas, the header row fixes the column
 * count, and a row that then carries surplus three-digit fields is reported
 * by name with advice, rather than silently becoming a different number.
 *
 * A header row names the slices. Without one they are "Column 1", "Column
 * 2", so a printed series is still labelled with something.
 */
export function parseDataTable(text) {
  const raw = String(text == null ? "" : text);
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const delim = pickDelimiter(raw);
  const split = lines.map(line => line.split(delim).map(f => f.trim()));

  if (!split.length) {
    return { slices: [], rows: [], headerSkipped: null, unreadable: [], ambiguous: [], delimiter: delim };
  }
  const hasHeader = split.length > 1 && looksLikeHeader(split[0]);
  const firstDataAt = hasHeader ? 1 : 0;
  const headerFields = hasHeader ? split[0] : null;
  const headerSkipped = hasHeader ? lines[0].trim() : null;

  // With commas, only a header can establish how many value columns there
  // are — the data rows alone cannot be trusted to say. With an unambiguous
  // delimiter the first data row is enough.
  let sliceCount;
  if (headerFields && headerFields.length >= 2) sliceCount = headerFields.length - 1;
  else if (delim === ",") sliceCount = 1;
  else sliceCount = trailingNumberCount(split[firstDataAt]);
  sliceCount = Math.max(1, sliceCount);

  let slices = headerFields && headerFields.length >= sliceCount + 1
    ? headerFields.slice(headerFields.length - sliceCount).map(s => s || "")
    : null;
  if (!slices || slices.some(s => !s)) {
    slices = Array.from({ length: sliceCount }, (_, i) => `Column ${i + 1}`);
  }

  const rows = [];
  const unreadable = [];
  const ambiguous = [];
  split.forEach((fields, i) => {
    if (i < firstDataAt) return;
    const line = lines[i].trim();
    if (fields.length <= sliceCount) { unreadable.push(line); return; }
    const values = fields.slice(fields.length - sliceCount).map(toNumber);
    const nameParts = fields.slice(0, fields.length - sliceCount);
    const name = nameParts.join(delim).trim();
    if (values.some(v => v === null) || !name) { unreadable.push(line); return; }
    // The surplus-field test: with commas, a name column that has picked up
    // three-digit numeric fields is a thousands separator being read as a
    // column break. Say so instead of shading a state with 69000148.
    if (delim === "," && sliceCount > 1 && nameParts.length > 1
        && nameParts.slice(1).every(f => THOUSANDS_GROUP.test(f) || isNumberField(f))) {
      ambiguous.push(line);
      return;
    }
    rows.push({ name, values });
  });

  return { slices, rows, headerSkipped, unreadable, ambiguous, delimiter: delim };
}

