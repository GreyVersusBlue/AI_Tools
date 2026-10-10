/* parent.js — the family page. State of truth is the server: the bag is simply the
   holds the server says this browser owns (view.mine), so a reload, a second tab or
   a dropped connection cannot make the page disagree with what is actually held. */
import { call, demo, myToken, serverNow } from './api.js';
import { ticketPdf, ticketName } from './ticket.js';

const $ = (id) => document.getElementById(id);
const token = myToken();
const POLL_MS = 15000;

let view = null; // the last 'state' answer
let chosen = null; // teacher id picked in the search
let active = -1; // highlighted suggestion
let shown = []; // suggestions on screen

/* ---------- small helpers ---------- */

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
const teacher = (id) => view && view.teachers.find((t) => t.id === id);
const pm = (t) => t + ' PM';
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

function say(node, text, kind) {
  node.textContent = text || '';
  node.className = 'status' + (kind ? ' ' + kind : '');
}

const WHY = {
  held: () => 'Another family is holding that time right now. If they do not finish, it opens up again within a few minutes.',
  taken: () => 'Sorry, that time was just booked.',
  blocked: () => 'That time is not available.',
  closed: () => 'Sign-ups are not open right now.',
  'student-busy': (r) => `${r.student || 'Your child'} already has a conference at ${pm(r.time)} with ${r.teacher || 'another teacher'}. Pick a different time.`,
  'too-many': (r) => `You can hold up to ${r.max || 6} times at once. Check out, or remove one from your bag, first.`,
  student: () => "Please type your child's full name first.",
  parent: () => 'Please type your name first.',
  'slow-down': () => 'Lots of families are on at once. Wait a moment and try again.',
  token: () => 'This browser could not be recognised. Reload the page and try again.',
  slot: () => 'That time is no longer on the schedule. Reload the page.',
  empty: () => 'Your bag is empty.',
};
const why = (b, extra) => (WHY[b.reason] || (() => 'Something went wrong. Please try again.'))(Object.assign({}, b, extra));

async function api(op, body) {
  try {
    return await call(op, Object.assign({ token }, body));
  } catch (e) {
    return { status: 0, body: { ok: false, reason: 'unreachable' } };
  }
}

/* ---------- loading and rendering ---------- */

async function refresh(quiet) {
  const r = await api('state', {});
  if (!r.body.ok) {
    if (!quiet || !view) {
      const f = $('fatal');
      f.hidden = false;
      f.textContent = r.body.reason === 'unreachable' ? 'Cannot reach the sign-up server. Check your connection, then reload this page.' : 'The sign-up page is having trouble. Please try again in a minute.';
    }
    return false;
  }
  $('fatal').hidden = true;
  view = r.body;
  render();
  return true;
}

function render() {
  const c = view.config;
  document.title = (c.title ? c.title + ' · ' : '') + 'Conference Book Bag';
  $('title').textContent = 'Conference Book Bag';
  $('subtitle').textContent = [c.school, c.title, c.date].filter(Boolean).join(' · ');
  $('demo').hidden = !demo;
  const closed = $('closed');
  closed.hidden = c.open;
  if (!c.open) closed.innerHTML = '<b>Sign-ups are not open yet.</b> Check back when the school sends the link.';
  $('notice').hidden = !c.notice;
  $('notice').textContent = c.notice || '';
  for (const n of document.querySelectorAll('.holdMin')) n.textContent = String(c.holdMinutes);

  /* A bag fixes who it is for. */
  const mine = view.mine;
  if (mine.length) {
    $('student').value = mine[0].student;
    $('student').readOnly = true;
    $('lockNote').hidden = false;
  } else {
    $('student').readOnly = false;
    $('lockNote').hidden = true;
  }
  $('findCard').disabled = !c.open || !whoReady();
  renderBag();
  renderPicked();
}

const whoReady = () => $('student').value.trim().length >= 2;

function renderBag() {
  const mine = view.mine.slice().sort((a, b) => view.times.indexOf(a.time) - view.times.indexOf(b.time));
  $('count').textContent = String(mine.length);
  $('bagEmpty').hidden = mine.length > 0;
  $('bagFoot').hidden = mine.length === 0;
  const ul = $('bagList');
  ul.textContent = '';
  for (const h of mine) {
    const t = teacher(h.tid);
    const left = el('span', { class: 'left', 'data-until': String(h.until) });
    const rm = el('button', { type: 'button', class: 'btn ghost sm', 'aria-label': `Remove ${pm(h.time)} with ${t.name}` }, 'Remove');
    rm.addEventListener('click', () => removeHold(h));
    ul.append(
      el('li', { 'data-tid': h.tid, 'data-time': h.time },
        el('div', null, el('div', { class: 'when', text: pm(h.time) }), el('div', { class: 'who', text: `${t.name}${t.subject ? ' · ' + t.subject : ''}` })),
        rm, left)
    );
  }
  tick();
}

/* once a second: the countdowns, and give up a hold the moment it runs out */
function tick() {
  if (!view) return;
  const now = serverNow();
  let lapsed = false;
  for (const li of document.querySelectorAll('#bagList li')) {
    const left = li.querySelector('.left');
    const ms = Number(left.dataset.until) - now;
    if (ms <= 0) lapsed = true;
    left.textContent = ms > 0 ? `held for ${clock(ms)}` : 'time ran out';
    li.classList.toggle('low', ms > 0 && ms < 60000);
  }
  if (lapsed && !tick.busy) {
    tick.busy = true;
    refresh(true).then(() => {
      say($('bagStatus'), 'A time in your bag ran out and went back to other families. You can add it again if it is still open.', 'err');
      tick.busy = false;
    });
  }
}

/* ---------- search ---------- */

const strip = (n) => n.replace(/^(mr|mrs|ms|miss|dr|coach)\.?\s+/i, '');

function matches(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const t of view.teachers) {
    const name = t.name.toLowerCase();
    const bare = strip(name);
    const hay = `${name} ${t.subject} ${t.grade}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    let score = 3;
    if (words.length && (bare.startsWith(words[0]) || name.startsWith(words[0]))) score = 0;
    else if (words.length && bare.split(/[\s-]+/).some((p) => p.startsWith(words[0]))) score = 1;
    else if (words.length && hay.split(/\s+/).some((p) => p.startsWith(words[0]))) score = 2;
    out.push({ t, score });
  }
  out.sort((a, b) => a.score - b.score || a.t.name.localeCompare(b.t.name));
  return out.map((x) => x.t);
}

const freeCount = (t) => (view.grid[t.id].match(/f/g) || []).length;

function showResults() {
  const box = $('results');
  const q = $('q').value.trim();
  shown = q ? matches(q) : view.teachers.slice().sort((a, b) => a.name.localeCompare(b.name));
  box.textContent = '';
  if (!shown.length) {
    box.append(el('li', { class: 'none', role: 'option', 'aria-disabled': 'true', text: 'No teacher matches that. Try a different spelling, or a subject.' }));
  }
  shown.forEach((t, i) => {
    const n = freeCount(t);
    box.append(
      el('li', { id: 'opt' + i, role: 'option', 'aria-selected': 'false', 'data-i': String(i) },
        el('span', { class: 'nm', text: t.name }),
        el('span', { class: 'meta', text: [t.subject, t.grade].filter(Boolean).join(' · ') + (n ? ` · ${n} open` : ' · fully booked') }))
    );
  });
  active = shown.length && q ? 0 : -1;
  paintActive();
  box.hidden = false;
  $('q').setAttribute('aria-expanded', 'true');
}

function hideResults() {
  $('results').hidden = true;
  $('q').setAttribute('aria-expanded', 'false');
  $('q').removeAttribute('aria-activedescendant');
}

function paintActive() {
  const opts = $('results').querySelectorAll('li[role=option]');
  opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === active && !o.classList.contains('none'))));
  if (active >= 0 && opts[active]) {
    $('q').setAttribute('aria-activedescendant', opts[active].id);
    opts[active].scrollIntoView({ block: 'nearest' });
  } else $('q').removeAttribute('aria-activedescendant');
}

function choose(t) {
  chosen = t.id;
  $('q').value = t.name;
  hideResults();
  say($('status'), '');
  renderPicked();
  $('time').focus();
}

function renderPicked() {
  const t = chosen && teacher(chosen);
  $('picked').hidden = !t;
  $('timeBox').hidden = !t;
  if (!t) return;
  $('picked').textContent = '';
  $('picked').append(el('b', { text: t.name }), el('span', { class: 'meta', text: [t.subject, t.grade && 'Grades ' + t.grade].filter(Boolean).join(' · ') }));
  const row = view.grid[t.id];
  const sel = $('time');
  const keep = sel.value;
  sel.textContent = '';
  const inBag = new Set(view.mine.map((h) => h.time));
  let free = 0;
  view.times.forEach((time, i) => {
    const c = row[i];
    if (c === 't' || c === 'b') return;
    let label = pm(time);
    let off = false;
    if (c === 'h') {
      label += ' (held by another family)';
      off = true;
    } else if (c === 'm') {
      label += ' (in your bag)';
      off = true;
    } else if (inBag.has(time)) {
      label += ' (you have another conference then)';
      off = true;
    } else free++;
    sel.append(el('option', { value: time, disabled: off }, label));
  });
  if (!free) {
    sel.prepend(el('option', { value: '', disabled: true, selected: true }, 'No open times'));
  } else {
    const firstFree = Array.from(sel.options).find((o) => !o.disabled);
    sel.value = keep && Array.from(sel.options).some((o) => o.value === keep && !o.disabled) ? keep : firstFree.value;
  }
  $('reserve').disabled = !free;
}

/* ---------- actions ---------- */

async function reserve() {
  const student = $('student').value.trim();
  if (student.length < 2) return say($('status'), why({ reason: 'student' }), 'err');
  const time = $('time').value;
  if (!chosen || !time) return;
  $('reserve').disabled = true;
  const r = await api('hold', { tid: chosen, time, student });
  if (r.body.ok) {
    const t = teacher(chosen);
    say($('status'), `${pm(time)} with ${t.name} is in your bag. Search for another teacher to add more, or check out.`, 'ok');
    chosen = null;
    $('q').value = '';
    await refresh(true);
    $('q').focus();
  } else {
    say($('status'), why(r.body, { student, time }), 'err');
    await refresh(true);
  }
  $('reserve').disabled = false;
}

async function removeHold(h) {
  await api('release', { tid: h.tid, time: h.time });
  say($('bagStatus'), '');
  await refresh(true);
}

async function checkout() {
  const parent = $('parent').value.trim();
  if (parent.length < 2) {
    say($('bagStatus'), why({ reason: 'parent' }), 'err');
    $('parent').focus();
    return;
  }
  const student = view.mine[0].student;
  $('checkout').disabled = true;
  say($('bagStatus'), 'Booking…');
  const r = await api('checkout', { student, parent, items: view.mine.map((h) => ({ tid: h.tid, time: h.time })) });
  $('checkout').disabled = false;
  if (r.body.ok) {
    remember(r.body);
    showDone(r.body);
    return;
  }
  if (r.body.reason === 'unavailable') {
    const lines = r.body.failures.map((f) => {
      const t = teacher(f.tid);
      const name = t ? t.name : 'that teacher';
      return `${pm(f.time)} with ${name}: ` + why(f, { student, time: f.time });
    });
    say($('bagStatus'), 'Nothing was booked, because ' + (lines.length > 1 ? 'some times are no longer available. ' : 'a time is no longer available. ') + lines.join(' '), 'err');
    await refresh(true);
    return;
  }
  say($('bagStatus'), r.body.reason === 'unreachable' ? 'Could not reach the server. Your times are still held; try again in a moment.' : why(r.body, { student }), 'err');
}

/* ---------- the confirmation ---------- */

const RK = 'conf-receipts';
function remember(rc) {
  try {
    const list = JSON.parse(localStorage.getItem(RK) || '[]').filter((x) => x.code !== rc.code);
    list.unshift(rc);
    localStorage.setItem(RK, JSON.stringify(list.slice(0, 8)));
  } catch (e) {
    /* storage blocked: the confirmation on screen is still real */
  }
}
const remembered = () => {
  try {
    return JSON.parse(localStorage.getItem(RK) || '[]');
  } catch (e) {
    return [];
  }
};

function showDone(rc) {
  $('booking').hidden = true;
  const box = $('done');
  box.hidden = false;
  box.textContent = '';
  const kid = rc.bookings[0].student;
  const list = el('ul', { class: 'tickets' });
  for (const b of rc.bookings) {
    list.append(
      el('li', { class: 'ticket' },
        el('div', { class: 't' }, b.time, ' ', el('small', { text: 'PM' })),
        el('div', null, el('div', { class: 'who', text: b.teacher }), el('div', { class: 'meta', text: [b.subject, 'for ' + b.student].filter(Boolean).join(' · ') })))
    );
  }
  const dl = el('button', { type: 'button', class: 'btn', id: 'dl' }, 'Download appointment tickets (PDF)');
  dl.addEventListener('click', () => {
    try {
      ticketPdf(rc).save(ticketName(rc));
    } catch (e) {
      say($('doneStatus'), 'The ticket could not be made: ' + e.message, 'err');
    }
  });
  const again = el('button', { type: 'button', class: 'btn ghost', id: 'another' }, 'Book for another child');
  again.addEventListener('click', backToStart);
  box.append(
    el('h2', { text: `You're booked, ${kid.split(' ')[0]}'s family!` }),
    el('p', { class: 'hint', text: [rc.school, rc.title, rc.date].filter(Boolean).join(' · ') }),
    el('div', null, 'Confirmation code ', el('span', { class: 'code', text: rc.code })),
    list,
    el('div', { class: 'row' }, dl, again),
    el('p', { class: 'status', id: 'doneStatus', 'aria-live': 'polite' }),
    el('p', { class: 'fine', text: 'Keep the code or save the PDF. To change a time, contact the school office and give them the code.' })
  );
  box.scrollIntoView({ block: 'start' });
  box.setAttribute('tabindex', '-1');
  box.focus();
}

function backToStart() {
  $('done').hidden = true;
  $('booking').hidden = false;
  $('student').value = '';
  chosen = null;
  $('q').value = '';
  refresh(true).then(() => $('student').focus());
  earlier();
}

function earlier() {
  const list = remembered();
  const box = $('earlier');
  box.hidden = !list.length;
  if (!list.length) return;
  box.textContent = '';
  box.append(el('h2', { text: 'Already booked from this device' }));
  const ul = el('ul');
  for (const rc of list) {
    const li = el('li');
    const b = el('button', { type: 'button', class: 'btn link' }, `${rc.bookings[0].student}: ${rc.bookings.length} conference${rc.bookings.length > 1 ? 's' : ''} (${rc.code})`);
    b.addEventListener('click', () => showDone(rc));
    li.append(b);
    ul.append(li);
  }
  box.append(ul);
}

/* ---------- wiring ---------- */

$('q').addEventListener('input', () => {
  if (view) {
    chosen = null;
    renderPicked();
    showResults();
  }
});
$('q').addEventListener('focus', () => view && showResults());
$('q').addEventListener('keydown', (e) => {
  const open = !$('results').hidden;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!open) showResults();
    else if (shown.length) active = (active + 1) % shown.length;
    paintActive();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (open && shown.length) active = (active - 1 + shown.length) % shown.length;
    paintActive();
  } else if (e.key === 'Enter') {
    if (open && active >= 0 && shown[active]) {
      e.preventDefault();
      choose(shown[active]);
    }
  } else if (e.key === 'Escape') hideResults();
});
$('results').addEventListener('mousedown', (e) => {
  const li = e.target.closest('li[data-i]');
  if (li) {
    e.preventDefault(); // keep focus in the box until we move it ourselves
    choose(shown[Number(li.dataset.i)]);
  }
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.combo')) hideResults();
});
$('student').addEventListener('input', () => {
  $('findCard').disabled = !(view && view.config.open && whoReady());
  try {
    localStorage.setItem('conf-who', JSON.stringify({ parent: $('parent').value }));
  } catch (e) {
    /* ignore */
  }
});
$('parent').addEventListener('input', () => {
  try {
    localStorage.setItem('conf-who', JSON.stringify({ parent: $('parent').value }));
  } catch (e) {
    /* ignore */
  }
});
$('reserve').addEventListener('click', reserve);
$('checkout').addEventListener('click', checkout);

try {
  const who = JSON.parse(localStorage.getItem('conf-who') || '{}');
  if (who.parent) $('parent').value = who.parent;
} catch (e) {
  /* ignore */
}

setInterval(tick, 1000);
setInterval(() => {
  if (!document.hidden && !$('booking').hidden) refresh(true);
}, POLL_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !$('booking').hidden) refresh(true);
});

refresh(false).then(earlier);
