/* core.js — the booking rules for the parent-conference sign-up. Pure: no DOM,
   no network, no clock of its own. The same file runs in three places:

     - the Worker's Durable Object (src/worker.js), which is the real thing;
     - the browser, in demo mode (app.js), so the page can be tried with no server;
     - Node, in test/core.test.mjs.

   One copy of the rules is the point. A Durable Object handles one request at a
   time, so "is this slot free? then hold it" cannot race, and nothing here needs
   a lock.

   State is one plain object (see newState). Every function takes `now` (epoch ms)
   from the caller. A hold is just { token, until }: nothing runs when it ends, a
   slot simply counts as free once `until` has passed (sweep() tidies them up).

   handle(state, op, body, ctx) is the whole API. ctx = { now, admin, rng }.
   It returns { status, body, changed }; `changed` tells the caller to persist. */

export const DEFAULTS = {
  school: 'East Middle School',
  title: 'Teacher Conferences',
  date: '',
  open: false,
  holdMinutes: 10,
  maxHolds: 6,
  notice: '',
};

export function makeTimes(startHour, startMin, count, step) {
  const out = [];
  let m = startHour * 60 + startMin;
  for (let i = 0; i < count; i++, m += step) {
    const h = Math.floor(m / 60) % 12 || 12;
    out.push(h + ':' + String(m % 60).padStart(2, '0'));
  }
  return out;
}

/* 4:00 to 6:45 PM in 15-minute slots: the twelve rows of the sheet this replaces. */
export const TIMES = makeTimes(16, 0, 12, 15);

export function newState(teachers, config) {
  return {
    v: 1,
    config: Object.assign({}, DEFAULTS, config || {}),
    times: TIMES.slice(),
    teachers: (teachers || []).map((t, i) => ({
      id: t.id || 't' + String(i + 1).padStart(2, '0'),
      name: String(t.name || '').trim(),
      subject: String(t.subject || '').trim(),
      grade: String(t.grade || '').trim(),
    })),
    slots: {},
  };
}

export const key = (tid, time) => tid + '|' + time;

/* "Jasmeet  KAUR" and "jasmeet kaur." are the same child. Accents and
   punctuation do not make a different student either. */
export function norm(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 80);

export function timeLabel(t) {
  return t + ' PM';
}

const fail = (status, reason, extra) => ({ status, body: Object.assign({ ok: false, reason }, extra), changed: false });
const done = (body, changed) => ({ status: 200, body: Object.assign({ ok: true }, body), changed: !!changed });

/* ---------- housekeeping ---------- */

export function sweep(state, now) {
  let n = 0;
  for (const k of Object.keys(state.slots)) {
    const s = state.slots[k];
    if (s.hold && s.hold.until <= now) {
      delete s.hold;
      n++;
    }
    if (!s.hold && !s.booking && !s.blocked) delete state.slots[k];
  }
  return n;
}

const teacherOf = (state, tid) => state.teachers.find((t) => t.id === tid);
const validTime = (state, time) => state.times.indexOf(time) >= 0;

function newCode(state, rng) {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
  const taken = new Set();
  for (const s of Object.values(state.slots)) if (s.booking) taken.add(s.booking.code);
  for (;;) {
    let c = '';
    for (let i = 0; i < 6; i++) c += A[Math.floor(rng() * A.length)];
    if (!taken.has(c)) return c;
  }
}

/* Is `student` already somewhere at `time` (with a teacher other than `tid`)?
   Counts bookings made by anyone, plus this token's own holds. Returns the
   teacher's name for the message, or null. */
function studentBusy(state, student, time, tid, token) {
  const n = norm(student);
  for (const t of state.teachers) {
    if (t.id === tid) continue;
    const s = state.slots[key(t.id, time)];
    if (!s) continue;
    if (s.booking && norm(s.booking.student) === n) return t.name;
    if (s.hold && token && s.hold.token === token && norm(s.hold.student) === n) return t.name;
  }
  return null;
}

/* ---------- what a parent may see ---------- */

/* One character per time: f free, t taken, h held by someone else, m held by
   you, b blocked. Names never leave the server on this route. */
export function publicView(state, now, token) {
  sweep(state, now);
  const grid = {};
  const mine = [];
  for (const t of state.teachers) {
    let row = '';
    for (const time of state.times) {
      const s = state.slots[key(t.id, time)];
      let c = 'f';
      if (s) {
        if (s.blocked) c = 'b';
        else if (s.booking) c = 't';
        else if (s.hold) {
          if (token && s.hold.token === token) {
            c = 'm';
            mine.push({ tid: t.id, time, until: s.hold.until, student: s.hold.student });
          } else c = 'h';
        }
      }
      row += c;
    }
    grid[t.id] = row;
  }
  const c = state.config;
  return {
    ok: true,
    now,
    config: { school: c.school, title: c.title, date: c.date, open: c.open, holdMinutes: c.holdMinutes, notice: c.notice },
    times: state.times,
    teachers: state.teachers,
    grid,
    mine,
  };
}

/* ---------- parent operations ---------- */

function checkNames(student, parent) {
  if (norm(student).length < 2) return 'student';
  if (parent !== undefined && norm(parent).length < 2) return 'parent';
  return null;
}

export function hold(state, now, b) {
  sweep(state, now);
  if (!state.config.open) return fail(403, 'closed');
  const token = clean(b.token, 80);
  if (token.length < 8) return fail(400, 'token');
  const student = clean(b.student, 80);
  if (checkNames(student)) return fail(400, 'student');
  if (!teacherOf(state, b.tid) || !validTime(state, b.time)) return fail(400, 'slot');

  const k = key(b.tid, b.time);
  const s = state.slots[k] || (state.slots[k] = {});
  if (s.blocked) return fail(409, 'blocked');
  if (s.booking) return fail(409, 'taken');
  if (s.hold && s.hold.token !== token) return fail(409, 'held');

  const busyWith = studentBusy(state, student, b.time, b.tid, token);
  if (busyWith) return fail(409, 'student-busy', { teacher: busyWith });

  if (!s.hold) {
    let mine = 0;
    for (const o of Object.values(state.slots)) if (o.hold && o.hold.token === token) mine++;
    if (mine >= state.config.maxHolds) return fail(429, 'too-many', { max: state.config.maxHolds });
  }
  s.hold = { token, student, until: now + state.config.holdMinutes * 60000 };
  return done({ until: s.hold.until }, true);
}

export function release(state, now, b) {
  const token = clean(b.token, 80);
  const s = state.slots[key(b.tid, b.time)];
  if (s && s.hold && s.hold.token === token) {
    delete s.hold;
    sweep(state, now);
    return done({}, true);
  }
  return done({}, false);
}

/* All or none. Each item must still be this token's live hold, or a free slot
   the parent can have back (their hold ran out a moment ago and nobody took it).
   Anything else is reported and nothing is booked, so a parent never walks away
   believing they have a time they do not. */
export function checkout(state, now, b, rng) {
  sweep(state, now);
  if (!state.config.open) return fail(403, 'closed');
  const token = clean(b.token, 80);
  if (token.length < 8) return fail(400, 'token');
  const student = clean(b.student, 80);
  const parent = clean(b.parent, 80);
  const bad = checkNames(student, parent);
  if (bad) return fail(400, bad);
  const items = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
  if (!items.length) return fail(400, 'empty');

  /* A retry after a dropped connection: if every item is already this token's
     booking, hand back the same confirmation rather than failing. */
  const existing = items.map((i) => state.slots[key(i.tid, i.time)]);
  if (existing.every((s) => s && s.booking && s.booking.token === token && norm(s.booking.student) === norm(student))) {
    return done(receipt(state, items.map((i) => [i.tid, i.time]), existing[0].booking.code), false);
  }

  const failures = [];
  const seenTimes = new Map();
  for (const i of items) {
    const t = teacherOf(state, i.tid);
    if (!t || !validTime(state, i.time)) {
      failures.push({ tid: i.tid, time: i.time, reason: 'slot' });
      continue;
    }
    const s = state.slots[key(i.tid, i.time)];
    if (s && s.blocked) failures.push({ tid: i.tid, time: i.time, reason: 'blocked' });
    else if (s && s.booking) failures.push({ tid: i.tid, time: i.time, reason: 'taken' });
    else if (s && s.hold && s.hold.token !== token) failures.push({ tid: i.tid, time: i.time, reason: 'held' });
    else if (seenTimes.has(i.time) && seenTimes.get(i.time) !== i.tid) {
      failures.push({ tid: i.tid, time: i.time, reason: 'student-busy', teacher: teacherOf(state, seenTimes.get(i.time)).name });
    } else if (studentBusy(state, student, i.time, i.tid, null)) {
      failures.push({ tid: i.tid, time: i.time, reason: 'student-busy', teacher: studentBusy(state, student, i.time, i.tid, null) });
    } else seenTimes.set(i.time, i.tid);
  }
  if (failures.length) return fail(409, 'unavailable', { failures });

  const code = newCode(state, rng);
  const at = now;
  for (const i of items) {
    const k = key(i.tid, i.time);
    const s = state.slots[k] || (state.slots[k] = {});
    delete s.hold;
    s.booking = { code, student, parent, token, at, by: 'parent' };
  }
  sweep(state, now);
  return done(receipt(state, items.map((i) => [i.tid, i.time]), code), true);
}

function receipt(state, pairs, code) {
  const rows = pairs
    .map(([tid, time]) => {
      const t = teacherOf(state, tid);
      const bk = state.slots[key(tid, time)].booking;
      return { tid, time, teacher: t.name, subject: t.subject, student: bk.student, parent: bk.parent };
    })
    .sort((a, b) => state.times.indexOf(a.time) - state.times.indexOf(b.time));
  return { code, school: state.config.school, title: state.config.title, date: state.config.date, bookings: rows };
}

/* ---------- admin operations ---------- */

export function adminView(state, now) {
  sweep(state, now);
  const cells = {};
  for (const [k, s] of Object.entries(state.slots)) {
    const c = {};
    if (s.blocked) c.blocked = true;
    if (s.booking) c.booking = { code: s.booking.code, student: s.booking.student, parent: s.booking.parent, at: s.booking.at, by: s.booking.by };
    if (s.hold) c.hold = { until: s.hold.until, student: s.hold.student };
    cells[k] = c;
  }
  return { ok: true, now, config: state.config, times: state.times, teachers: state.teachers, cells };
}

/* Staff booking. Skips the open/closed switch and holds. Overlapping a child's
   other conference is refused unless `force` is set: that is the team-style
   conference, one family meeting several teachers at once. */
export function adminBook(state, now, b, rng) {
  sweep(state, now);
  const student = clean(b.student, 80);
  const parent = clean(b.parent, 80);
  if (checkNames(student)) return fail(400, 'student');
  if (!teacherOf(state, b.tid) || !validTime(state, b.time)) return fail(400, 'slot');
  const k = key(b.tid, b.time);
  const s = state.slots[k] || (state.slots[k] = {});
  if (s.blocked) return fail(409, 'blocked');
  if (s.booking) return fail(409, 'taken');
  const busyWith = studentBusy(state, student, b.time, b.tid, null);
  if (busyWith && !b.force) return fail(409, 'student-busy', { teacher: busyWith });
  /* A team conference shares one code with the booking it joins, so the ticket
     and the export read as one meeting. */
  let code = null;
  let who = { student, parent };
  if (b.force && busyWith) {
    for (const t of state.teachers) {
      const o = state.slots[key(t.id, b.time)];
      if (o && o.booking && norm(o.booking.student) === norm(student)) {
        code = o.booking.code;
        /* the family's own spelling, so the export reads one child, not two */
        who = { student: o.booking.student, parent: parent || o.booking.parent };
      }
    }
  }
  delete s.hold;
  s.booking = { code: code || newCode(state, rng), student: who.student, parent: who.parent, token: null, at: now, by: 'admin' };
  return done({ code: s.booking.code, team: !!(b.force && busyWith) }, true);
}

export function adminCancel(state, now, b) {
  const k = key(b.tid, b.time);
  const s = state.slots[k];
  if (!s || !s.booking) return fail(404, 'none');
  delete s.booking;
  sweep(state, now);
  return done({}, true);
}

/* cells: [{ tid, time }]. on:true blocks, on:false clears. A booked cell is
   never blocked silently: cancel the meeting first. */
export function adminBlock(state, now, b) {
  const cells = Array.isArray(b.cells) ? b.cells.slice(0, 500) : [];
  const refused = [];
  let n = 0;
  for (const c of cells) {
    if (!teacherOf(state, c.tid) || !validTime(state, c.time)) continue;
    const k = key(c.tid, c.time);
    const s = state.slots[k] || (state.slots[k] = {});
    if (b.on) {
      if (s.booking) {
        refused.push({ tid: c.tid, time: c.time });
        continue;
      }
      delete s.hold;
      s.blocked = true;
    } else delete s.blocked;
    n++;
  }
  sweep(state, now);
  return done({ changed: n, refused }, n > 0);
}

export function adminConfig(state, now, b) {
  const c = state.config;
  if ('school' in b) c.school = clean(b.school, 80);
  if ('title' in b) c.title = clean(b.title, 80);
  if ('date' in b) c.date = clean(b.date, 80);
  if ('notice' in b) c.notice = clean(b.notice, 300);
  if ('open' in b) c.open = !!b.open;
  if ('holdMinutes' in b) c.holdMinutes = Math.min(60, Math.max(1, Math.round(Number(b.holdMinutes)) || DEFAULTS.holdMinutes));
  if ('maxHolds' in b) c.maxHolds = Math.min(20, Math.max(1, Math.round(Number(b.maxHolds)) || DEFAULTS.maxHolds));
  return done({ config: c }, true);
}

/* "Name | Subject | Grade" per line. A teacher keeps their id when the name is
   unchanged, so bookings follow them. A teacher with meetings cannot be dropped. */
export function parseTeachers(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const parts = line.split(/\s*[|\t]\s*/).map((p) => clean(p, 60));
    if (parts[0]) out.push({ name: parts[0], subject: parts[1] || '', grade: parts[2] || '' });
  }
  return out;
}

export function adminTeachers(state, now, b) {
  const list = Array.isArray(b.teachers) ? b.teachers : parseTeachers(b.text);
  if (!list.length) return fail(400, 'empty');
  if (list.length > 120) return fail(400, 'too-many');
  const byName = new Map(state.teachers.map((t) => [norm(t.name), t]));
  let next = 1;
  const used = new Set();
  const out = list.map((t) => {
    const old = byName.get(norm(t.name));
    let id = old && !used.has(old.id) ? old.id : null;
    if (!id) {
      while (state.teachers.some((o) => o.id === 't' + String(next).padStart(2, '0')) || used.has('t' + String(next).padStart(2, '0'))) next++;
      id = 't' + String(next).padStart(2, '0');
    }
    used.add(id);
    return { id, name: clean(t.name, 60), subject: clean(t.subject, 60), grade: clean(t.grade, 40) };
  });
  const kept = new Set(out.map((t) => t.id));
  const stranded = [];
  for (const t of state.teachers) {
    if (kept.has(t.id)) continue;
    for (const time of state.times) {
      const s = state.slots[key(t.id, time)];
      if (s && s.booking) {
        stranded.push(t.name);
        break;
      }
    }
  }
  if (stranded.length) return fail(409, 'has-meetings', { teachers: stranded });
  for (const k of Object.keys(state.slots)) if (!kept.has(k.split('|')[0])) delete state.slots[k];
  state.teachers = out;
  return done({ teachers: out }, true);
}

/* Clears every meeting, hold and block; keeps teachers and settings. */
export function adminReset(state, now, b) {
  if (b.confirm !== 'RESET') return fail(400, 'confirm');
  state.slots = {};
  return done({}, true);
}

/* ---------- export ---------- */

const mdy = (ms) => {
  const d = new Date(ms);
  return d.getMonth() + 1 + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2);
};

/* The workbook: the same matrix the old sign-up sheet exported (teachers across,
   times down, the student in each booked cell, "Block" for a staff block, open
   counts at the edges) and a flat list of meetings for the front office. */
export function exportSheets(state, now, tz) {
  sweep(state, now);
  const T = state.teachers;
  const head = ['Time (PM)'].concat(T.map((t) => t.name), ['Open Slots']);
  const matrix = [
    [`${state.config.school} – ${state.config.title}${state.config.date ? ', ' + state.config.date : ''}`],
    [`Sign-up export dated ${mdy(now + (tz || 0))}. Cells show the student name entered on the sign-up; blank = slot still open; Block = unavailable. Row = start time (PM), 15-min slots.`],
    head,
    ['Subject'].concat(T.map((t) => t.subject), ['']),
    ['Grade'].concat(T.map((t) => t.grade), ['']),
  ];
  const openPer = T.map(() => 0);
  let openAll = 0;
  for (const time of state.times) {
    const row = [time];
    let open = 0;
    T.forEach((t, i) => {
      const s = state.slots[key(t.id, time)];
      if (s && s.blocked) row.push('Block');
      else if (s && s.booking) row.push(s.booking.student);
      else {
        row.push('');
        open++;
        openPer[i]++;
      }
    });
    row.push(open);
    openAll += open;
    matrix.push(row);
  }
  matrix.push(['Open per teacher'].concat(openPer, [openAll]));
  matrix.push(['Notes']);
  matrix.push(['Names are as typed by families, so spellings and capitalisation are as submitted.']);
  matrix.push(['A cell reading Block is a staff placeholder, not a student.']);

  const list = [['Time (PM)', 'Teacher', 'Subject', 'Grade', 'Student', 'Parent / guardian', 'Confirmation', 'Booked by', 'Booked at']];
  for (const time of state.times) {
    for (const t of T) {
      const s = state.slots[key(t.id, time)];
      if (s && s.booking) {
        const b = s.booking;
        list.push([time, t.name, t.subject, t.grade, b.student, b.parent, b.code, b.by === 'admin' ? 'Staff' : 'Parent', new Date(b.at + (tz || 0)).toISOString().slice(0, 16).replace('T', ' ')]);
      }
    }
  }
  return [
    { name: 'Conference Matrix', rows: matrix, widths: [16].concat(T.map(() => 22), [11]) },
    { name: 'Meetings', rows: list, widths: [11, 18, 22, 12, 26, 26, 14, 10, 18] },
  ];
}

/* ---------- the API ---------- */

const PARENT_OPS = { state: 1, hold: 1, release: 1, checkout: 1 };

export function handle(state, op, body, ctx) {
  const now = ctx.now;
  const rng = ctx.rng || Math.random;
  const b = body && typeof body === 'object' ? body : {};
  if (PARENT_OPS[op]) {
    if (op === 'state') return { status: 200, body: publicView(state, now, clean(b.token, 80)), changed: false };
    if (op === 'hold') return hold(state, now, b);
    if (op === 'release') return release(state, now, b);
    return checkout(state, now, b, rng);
  }
  if (!ctx.admin) return fail(401, 'pin');
  switch (op) {
    case 'admin/login': return done({}, false);
    case 'admin/state': return { status: 200, body: adminView(state, now), changed: false };
    case 'admin/book': return adminBook(state, now, b, rng);
    case 'admin/cancel': return adminCancel(state, now, b);
    case 'admin/block': return adminBlock(state, now, b);
    case 'admin/config': return adminConfig(state, now, b);
    case 'admin/teachers': return adminTeachers(state, now, b);
    case 'admin/reset': return adminReset(state, now, b);
    case 'admin/export': return done({ sheets: exportSheets(state, now, Number(b.tz) || 0) }, false);
    default: return fail(404, 'op');
  }
}
