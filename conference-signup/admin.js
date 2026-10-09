/* admin.js — the staff desk: see every teacher's evening at a glance, book for a
   family (before the link goes out, or by phone), cancel, block, run the team
   conference exception, and export the schedule as a workbook. Everything staff do
   goes through the same rules a family's booking does (core.js); the PIN only
   unlocks the extra operations. */
import { call, demo, DEMO_PIN } from './api.js';

const $ = (id) => document.getElementById(id);
const PK = 'conf-admin-pin';
const POLL_MS = 15000;
const XLSX_LIB = '../_shared/vendor/xlsx/xlsx.full.min.js';

let pin = '';
let data = null;

const el = (tag, attrs, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) n.append(k);
  return n;
};
const pm = (t) => t + ' PM';
const say = (id, text, kind) => {
  const n = $(id);
  n.textContent = text || '';
  n.className = 'status' + (kind ? ' ' + kind : '');
};
const teacher = (id) => data.teachers.find((t) => t.id === id);
const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();

const WHY = {
  pin: 'That PIN is not right.',
  locked: 'Too many wrong PINs from this network. Wait ten minutes.',
  'no-pin-configured': 'The server has no staff PIN set yet (see worker/README.md).',
  taken: 'That time already has a meeting. Cancel it first.',
  blocked: 'That time is blocked. Reopen it first.',
  student: "Type the student's full name.",
  none: 'There was no meeting to cancel.',
  'has-meetings': (b) => 'These teachers still have meetings, so they cannot be removed: ' + (b.teachers || []).join(', ') + '.',
  empty: 'There is nothing to save.',
  'too-many': 'That is too many.',
  confirm: 'Type RESET exactly to confirm.',
  unreachable: 'Cannot reach the server.',
};
const why = (b) => {
  const w = WHY[b.reason];
  return typeof w === 'function' ? w(b) : w || 'Something went wrong (' + (b.reason || 'unknown') + ').';
};

async function api(op, body) {
  try {
    return await call(op, body || {}, pin);
  } catch (e) {
    return { status: 0, body: { ok: false, reason: 'unreachable' } };
  }
}

/* ---------- the gate ---------- */

async function unlock(p, remember) {
  pin = p;
  const r = await api('admin/login');
  if (!r.body.ok) {
    pin = '';
    return r.body;
  }
  if (remember) {
    try {
      sessionStorage.setItem(PK, p);
    } catch (e) {
      /* the desk still works; it will ask again next load */
    }
  }
  $('gate').hidden = true;
  $('desk').hidden = false;
  await load();
  return r.body;
}

$('pinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  say('pinStatus', 'Checking…');
  const b = await unlock($('pin').value, true);
  if (!b.ok) say('pinStatus', why(b), 'err');
});
$('lockBtn').addEventListener('click', () => {
  try {
    sessionStorage.removeItem(PK);
  } catch (e) {
    /* ignore */
  }
  pin = '';
  data = null;
  $('desk').hidden = true;
  $('gate').hidden = false;
  $('pin').value = '';
  $('pin').focus();
});

/* ---------- loading ---------- */

async function load() {
  const r = await api('admin/state');
  if (!r.body.ok) {
    say('deskStatus', why(r.body), 'err');
    return false;
  }
  data = r.body;
  renderAll();
  return true;
}

function renderAll() {
  const c = data.config;
  $('deskTitle').textContent = [c.school, c.title].filter(Boolean).join(' · ') || 'Staff desk';
  $('demo').hidden = !demo;
  const open = $('openBtn');
  open.setAttribute('aria-pressed', String(c.open));
  open.textContent = c.open ? 'Open to families' : 'Closed to families';
  renderMatrix();
  renderList();
  fillSetup(false);
}

/* team conference = a student booked with several teachers at one time */
function cellKind(c, tid, time) {
  if (!c) return { cls: '', text: '', label: 'open' };
  if (c.blocked) return { cls: 's-blocked', text: 'Block', label: 'blocked' };
  if (c.booking) {
    let team = false;
    for (const t of data.teachers) {
      if (t.id === tid) continue;
      const o = data.cells[t.id + '|' + time];
      if (o && o.booking && o.booking.code === c.booking.code) team = true;
    }
    return { cls: team ? 's-team' : 's-booked', text: c.booking.student, label: (team ? 'team conference with ' : 'booked by ') + c.booking.student };
  }
  if (c.hold) return { cls: 's-held', text: 'holding…', label: 'held by a family' };
  return { cls: '', text: '', label: 'open' };
}

function renderMatrix() {
  const tbl = $('matrix');
  tbl.textContent = '';
  const head = el('tr', null, el('th', { scope: 'col', text: 'Time' }));
  for (const t of data.teachers) head.append(el('th', { scope: 'col' }, t.name, el('span', { class: 'sj', text: [t.subject, t.grade].filter(Boolean).join(' · ') })));
  tbl.append(el('thead', null, head));
  const body = el('tbody');
  for (const time of data.times) {
    const tr = el('tr', null, el('th', { scope: 'row', text: pm(time) }));
    for (const t of data.teachers) {
      const k = cellKind(data.cells[t.id + '|' + time], t.id, time);
      const b = el('button', { type: 'button', 'aria-label': `${t.name}, ${pm(time)}: ${k.label}`, 'data-tid': t.id, 'data-time': time, text: k.text });
      tr.append(el('td', { class: k.cls }, b));
    }
    body.append(tr);
  }
  tbl.append(body);
}

function meetings() {
  const out = [];
  for (const time of data.times) {
    for (const t of data.teachers) {
      const c = data.cells[t.id + '|' + time];
      if (c && c.booking) out.push({ t, time, b: c.booking });
    }
  }
  return out;
}

function renderList() {
  const q = norm($('filter').value);
  const all = meetings();
  const rows = all.filter((m) => !q || norm([m.b.student, m.b.parent, m.t.name, m.b.code, m.t.subject].join(' ')).includes(q));
  $('listCount').textContent = `${rows.length} of ${all.length} meetings`;
  const tbl = $('list');
  tbl.textContent = '';
  tbl.append(el('thead', null, el('tr', null, ...['Time', 'Teacher', 'Student', 'Parent', 'Code', 'By', ''].map((h) => el('th', { scope: 'col', text: h })))));
  const body = el('tbody');
  for (const m of rows) {
    const cancel = el('button', { type: 'button', class: 'btn danger sm', 'aria-label': `Cancel ${m.b.student} with ${m.t.name} at ${pm(m.time)}` }, 'Cancel');
    cancel.addEventListener('click', () => openCell(m.t.id, m.time));
    body.append(el('tr', null, el('td', { text: pm(m.time) }), el('td', { text: m.t.name }), el('td', { text: m.b.student }), el('td', { text: m.b.parent }), el('td', { text: m.b.code }), el('td', { text: m.b.by === 'admin' ? 'Staff' : 'Parent' }), el('td', null, cancel)));
  }
  if (!rows.length) body.append(el('tr', null, el('td', { colspan: '7', text: all.length ? 'No meeting matches that.' : 'No meetings yet.' })));
  tbl.append(body);
}
$('filter').addEventListener('input', () => data && renderList());

/* ---------- a cell ---------- */

const dlg = $('cell');
$('matrix').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tid]');
  if (b) openCell(b.dataset.tid, b.dataset.time);
});

function closeButton(label) {
  const b = el('button', { type: 'button', class: 'btn ghost', 'data-close': '1' }, label || 'Close');
  b.addEventListener('click', () => dlg.close());
  return b;
}

function openCell(tid, time) {
  const t = teacher(tid);
  const c = data.cells[tid + '|' + time] || {};
  $('cellTitle').textContent = `${t.name} · ${pm(time)}`;
  const body = $('cellBody');
  body.textContent = '';
  const msg = el('p', { class: 'status', 'aria-live': 'polite' });

  if (c.booking) {
    const b = c.booking;
    const when = new Date(b.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const cancel = el('button', { type: 'button', class: 'btn danger' }, 'Cancel this meeting');
    cancel.addEventListener('click', async () => {
      const r = await api('admin/cancel', { tid, time });
      if (r.body.ok) {
        dlg.close();
        await load();
        say('deskStatus', `Cancelled ${b.student} with ${t.name} at ${pm(time)}.`, 'ok');
      } else say2(msg, why(r.body), 'err');
    });
    body.append(
      el('dl', { class: 'kv' }, el('dt', { text: 'Student' }), el('dd', { text: b.student }), el('dt', { text: 'Parent' }), el('dd', { text: b.parent || '—' }), el('dt', { text: 'Confirmation' }), el('dd', { text: b.code }), el('dt', { text: 'Booked' }), el('dd', { text: `${b.by === 'admin' ? 'by staff' : 'by the family'}, ${when}` })),
      el('div', { class: 'row' }, cancel, closeButton()), msg);
  } else if (c.blocked) {
    const reopen = el('button', { type: 'button', class: 'btn' }, 'Reopen this time');
    reopen.addEventListener('click', async () => {
      await api('admin/block', { on: false, cells: [{ tid, time }] });
      dlg.close();
      await load();
    });
    body.append(el('p', { text: 'This time is blocked. Families cannot see it.' }), el('div', { class: 'row' }, reopen, closeButton()));
  } else {
    body.append(bookForm(tid, time, c, msg), msg);
  }
  if (!dlg.open) dlg.showModal();
}

const say2 = (node, text, kind) => {
  node.textContent = text || '';
  node.className = 'status' + (kind ? ' ' + kind : '');
};

function bookForm(tid, time, c, msg) {
  const t = teacher(tid);
  const form = el('form');
  const kids = new Map();
  for (const m of meetings()) kids.set(norm(m.b.student), m.b);
  const list = el('datalist', { id: 'kidList' });
  for (const b of kids.values()) list.append(el('option', { value: b.student }));
  const student = el('input', { id: 'fStudent', type: 'text', list: 'kidList', maxlength: '80', autocomplete: 'off', required: true });
  const parent = el('input', { id: 'fParent', type: 'text', maxlength: '80', autocomplete: 'off' });
  student.addEventListener('change', () => {
    const known = kids.get(norm(student.value));
    if (known && !parent.value) parent.value = known.parent || '';
  });
  const team = el('div', { hidden: true });
  const save = el('button', { type: 'submit', class: 'btn' }, 'Book this time');
  const block = el('button', { type: 'button', class: 'btn ghost' }, 'Block this time');
  block.addEventListener('click', async () => {
    await api('admin/block', { on: true, cells: [{ tid, time }] });
    dlg.close();
    await load();
  });
  if (c.hold) form.append(el('p', { class: 'banner' }, 'A family is holding this time right now. Booking it here takes it from them.'));
  form.append(el('label', { for: 'fStudent', text: 'Student' }), student, el('label', { for: 'fParent', text: 'Parent or guardian (optional)' }), parent, team, el('div', { class: 'row', style: 'margin-top:14px' }, save, block, closeButton('Cancel')), list);

  const send = async (force) => {
    save.disabled = true;
    const r = await api('admin/book', { tid, time, student: student.value, parent: parent.value, force });
    save.disabled = false;
    if (r.body.ok) {
      dlg.close();
      await load();
      say('deskStatus', `Booked ${student.value.trim()} with ${t.name} at ${pm(time)} (code ${r.body.code})${r.body.team ? ' as a team conference' : ''}.`, 'ok');
      return;
    }
    if (r.body.reason === 'student-busy') {
      team.hidden = false;
      team.textContent = '';
      const yes = el('button', { type: 'button', class: 'btn' }, 'Yes, book as a team conference');
      yes.addEventListener('click', () => send(true));
      team.append(el('p', { class: 'banner' }, `${student.value.trim()} already meets ${r.body.teacher} at ${pm(time)}. A family can't do that on their own, but staff can: is this a team conference?`), yes);
      return;
    }
    say2(msg, why(r.body), 'err');
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    team.hidden = true;
    send(false);
  });
  return form;
}

/* ---------- open / closed ---------- */

$('openBtn').addEventListener('click', async () => {
  const next = !data.config.open;
  const r = await api('admin/config', { open: next });
  if (r.body.ok) {
    await load();
    say('deskStatus', next ? 'Sign-ups are open: families can book now.' : 'Sign-ups are closed. Families see "not open yet"; staff can still book.', 'ok');
  } else say('deskStatus', why(r.body), 'err');
});

/* ---------- tabs ---------- */

const TABS = ['grid', 'list', 'setup'];
function showTab(name) {
  for (const t of TABS) {
    $('tab-' + t).setAttribute('aria-selected', String(t === name));
    $('tab-' + t).tabIndex = t === name ? 0 : -1;
    $('pane-' + t).hidden = t !== name;
  }
}
for (const t of TABS) {
  $('tab-' + t).addEventListener('click', () => showTab(t));
  $('tab-' + t).addEventListener('keydown', (e) => {
    const i = TABS.indexOf(t);
    const to = e.key === 'ArrowRight' ? TABS[(i + 1) % 3] : e.key === 'ArrowLeft' ? TABS[(i + 2) % 3] : null;
    if (to) {
      e.preventDefault();
      showTab(to);
      $('tab-' + to).focus();
    }
  });
}

/* ---------- setup ---------- */

function fillSetup(force) {
  if (!force && fillSetup.done) return; // do not trample what staff are typing on every refresh
  fillSetup.done = true;
  const c = data.config;
  $('cSchool').value = c.school;
  $('cTitle').value = c.title;
  $('cDate').value = c.date;
  $('cNotice').value = c.notice;
  $('cHold').value = c.holdMinutes;
  $('cMax').value = c.maxHolds;
  $('tText').value = data.teachers.map((t) => `${t.name} | ${t.subject} | ${t.grade}`).join('\n');
  const tsel = $('bTeacher');
  tsel.textContent = '';
  tsel.append(el('option', { value: '*', text: 'All teachers' }));
  for (const t of data.teachers) tsel.append(el('option', { value: t.id, text: t.name }));
  for (const id of ['bFrom', 'bTo']) {
    const s = $(id);
    s.textContent = '';
    for (const time of data.times) s.append(el('option', { value: time, text: pm(time) }));
  }
  $('bTo').value = data.times[data.times.length - 1];
}

$('cfgForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await api('admin/config', { school: $('cSchool').value, title: $('cTitle').value, date: $('cDate').value, notice: $('cNotice').value, holdMinutes: $('cHold').value, maxHolds: $('cMax').value });
  if (r.body.ok) {
    await load();
    fillSetup(true);
  }
  say('cfgStatus', r.body.ok ? 'Saved.' : why(r.body), r.body.ok ? 'ok' : 'err');
});

$('blockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const on = e.submitter && e.submitter.dataset.on === '1';
  const a = data.times.indexOf($('bFrom').value);
  const z = data.times.indexOf($('bTo').value);
  if (a > z) return say('blockStatus', 'The start time is after the end time.', 'err');
  const who = $('bTeacher').value === '*' ? data.teachers : [teacher($('bTeacher').value)];
  const cells = [];
  for (const t of who) for (const time of data.times.slice(a, z + 1)) cells.push({ tid: t.id, time });
  const r = await api('admin/block', { on, cells });
  if (!r.body.ok) return say('blockStatus', why(r.body), 'err');
  await load();
  const skipped = r.body.refused.length;
  say('blockStatus', `${on ? 'Blocked' : 'Reopened'} ${r.body.changed} time${r.body.changed === 1 ? '' : 's'}.` + (skipped ? ` ${skipped} already had a meeting and were left alone: cancel those first.` : ''), skipped ? 'err' : 'ok');
});

$('teachForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await api('admin/teachers', { text: $('tText').value });
  if (r.body.ok) {
    await load();
    fillSetup(true);
  }
  say('teachStatus', r.body.ok ? `Saved ${r.body.teachers.length} teachers.` : why(r.body), r.body.ok ? 'ok' : 'err');
});

$('resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await api('admin/reset', { confirm: $('rConfirm').value.trim() });
  if (r.body.ok) {
    $('rConfirm').value = '';
    await load();
  }
  say('resetStatus', r.body.ok ? 'Every meeting, hold and block is cleared.' : why(r.body), r.body.ok ? 'ok' : 'err');
});

/* ---------- export ---------- */

let xlsxLoading = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  if (!xlsxLoading) {
    xlsxLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = XLSX_LIB;
      s.onload = resolve;
      s.onerror = () => {
        xlsxLoading = null;
        reject(new Error('Could not load the spreadsheet library.'));
      };
      document.head.append(s);
    });
  }
  return xlsxLoading;
}

$('exportBtn').addEventListener('click', async () => {
  say('deskStatus', 'Building the workbook…');
  try {
    const [r] = await Promise.all([api('admin/export', { tz: -new Date().getTimezoneOffset() * 60000 }), loadXlsx()]);
    if (!r.body.ok) throw new Error(why(r.body));
    const c = data.config;
    const name = window.ExportKit.filename(`${c.school} conference matrix ${new Date().toISOString().slice(0, 10)}`, 'xlsx');
    window.ExportKit.toXlsx(r.body.sheets, { filename: name });
    const n = r.body.sheets[1].rows.length - 1;
    say('deskStatus', `Saved ${name}: ${n} meeting${n === 1 ? '' : 's'}.`, 'ok');
  } catch (e) {
    say('deskStatus', 'Export failed: ' + e.message, 'err');
  }
});

/* ---------- start ---------- */

setInterval(() => {
  if (data && !document.hidden && !dlg.open) load();
}, POLL_MS);

(async () => {
  $('demo').hidden = !demo;
  let saved = '';
  try {
    saved = sessionStorage.getItem(PK) || '';
  } catch (e) {
    /* ignore */
  }
  if (demo && !saved) $('pin').placeholder = `Demo PIN: ${DEMO_PIN}`;
  if (saved) {
    const b = await unlock(saved, false);
    if (!b.ok) $('pin').focus();
  } else $('pin').focus();
})();
