// ct-board.js — the Classroom Timer's board: two to four independent timers on
// one screen, for stations, differentiated groups or a lab with staggered
// steps. The single-timer view is still the default and is not touched by
// this file; the board is a second view the header button switches to.
//
// Each timer has its own label, length, start / pause / reset and finished
// state, and runs off a wall-clock end time (ct-board-core.js on
// _shared/countdown.js), so it stays right when the tab is in the background
// or the laptop sleeps. The board is saved in the same ct_prefs key, as
// `board`. A timer still running when the page is reloaded keeps counting from
// its saved end time; one that ran out while the page was closed comes back
// finished and does not ring.
//
// Sound, the flash at zero and the wake lock stay ct-app.js's: it hands this
// file three callbacks, and a tick in which several timers finish calls
// `onRing` once, so the board never plays more than one sound at a time.

import { load, save } from './ct-store.js';
import * as Core from './ct-board-core.js';

const TICK_MS = 250;

function el(tag, props, children) {
  const n = document.createElement(tag);
  Object.keys(props || {}).forEach((k) => {
    if (k === 'text') n.textContent = props[k];
    else if (k === 'class') n.className = props[k];
    else n.setAttribute(k, props[k]);
  });
  (children || []).forEach((c) => n.appendChild(c));
  return n;
}

/** opts: getPrefs() -> the page's current prefs (display thresholds, end
    message); isSingleBusy() -> true while the single timer runs or is paused;
    unlock() -> start audio inside a click; onRing(labels) -> sound and flash,
    once per tick; onRunning(bool) -> wake lock. */
export function initBoard(opts) {
  const root = document.getElementById('board');
  const btn = document.getElementById('boardBtn');
  const grid = document.getElementById('boardGrid');
  const countSel = document.getElementById('boardCount');
  const resetAll = document.getElementById('boardResetAll');
  const live = document.getElementById('boardLive');
  const note = document.getElementById('boardNote');
  if (!root || !btn || !grid) return null;

  const saved = load().board;
  let open = false;
  let count = saved ? saved.count : Core.MIN_TIMERS;
  const entries = [];
  const rows = [];                  // per shown timer: its DOM references
  let timerId = null;

  const now0 = Date.now();
  (saved ? saved.timers : Core.defaultTimers()).forEach((t) => {
    entries.push(Core.fromSaved(t, now0).entry);
  });

  function persist() {
    save({ board: { open, count, timers: entries.map(Core.toSaved) } });
  }

  function say(text) {
    live.textContent = '';
    live.textContent = text;
  }

  function showNote(text) {
    note.textContent = text;
    note.hidden = !text;
  }

  function labelOf(i) {
    return entries[i].label || ('Timer ' + (i + 1));
  }

  /* ---- painting ---------------------------------------------------------- */
  const STATE_TEXT = { idle: 'Ready', running: '▶ Running', paused: '⏸ Paused' };

  function paintRow(i, now) {
    const r = rows[i];
    const e = entries[i];
    const st = Core.stateOf(e);
    const left = window.Countdown.left(e.c, now);
    const total = e.c.totalMs;
    const prefs = opts.getPrefs();
    const text = window.Countdown.format(st === 'idle' ? total : left, { pad: true });
    if (r.time.textContent !== text) r.time.textContent = text;
    const fraction = total > 0 ? Math.min(1, left / total) : 0;
    r.fill.style.width = (st === 'idle' ? 100 : fraction * 100) + '%';
    let urgency = '';
    if (st === 'running' || st === 'paused') urgency = Core.urgencyOf(fraction, prefs.display.amberPct, prefs.display.redPct);
    const badge = urgency === 'critical' ? '⏰ Almost time' : urgency === 'warn' ? '⚠ Wrapping up' : '';
    let stateText = STATE_TEXT[st];
    if (st === 'done') stateText = '⏰ ' + ((prefs.display.endMessage || '').trim() || "Time's up");
    else if (st === 'idle' && total <= 0) stateText = 'Set a time first';
    if (r.state.textContent !== stateText) r.state.textContent = stateText;
    if (r.badge.textContent !== badge) r.badge.textContent = badge;
    r.card.dataset.state = st;
    if (urgency && urgency !== 'good') r.card.dataset.urgency = urgency; else delete r.card.dataset.urgency;
    const go = st === 'running' ? 'Pause' : st === 'paused' ? 'Resume' : 'Start';
    if (r.go.textContent !== go) r.go.textContent = go;
    r.go.classList.toggle('btn-primary', st !== 'running');
    const locked = st === 'running' || st === 'paused';
    r.min.disabled = locked;
    r.sec.disabled = locked;
  }

  function paintAll() {
    const now = Date.now();
    for (let i = 0; i < count; i++) paintRow(i, now);
    paintCountOptions();
  }

  function paintCountOptions() {
    const min = Core.minCountFor(entries);
    Array.from(countSel.options).forEach((o) => { o.disabled = Number(o.value) < min; });
    countSel.value = String(count);
  }

  function buttonText() {
    return open ? 'Single timer' : 'Timer board';
  }

  /* ---- building ---------------------------------------------------------- */
  function build() {
    grid.textContent = '';
    rows.length = 0;
    grid.dataset.count = String(count);
    for (let i = 0; i < count; i++) {
      const e = entries[i];
      const n = i + 1;
      const label = el('input', { type: 'text', class: 'bt-label', maxlength: String(Core.MAX_LABEL), placeholder: 'Timer ' + n, 'aria-label': 'Timer ' + n + ' label' });
      label.value = e.label;
      const time = el('div', { class: 'bt-time', role: 'timer', 'aria-label': labelOf(i) });
      const state = el('div', { class: 'bt-state' });
      const badge = el('div', { class: 'bt-badge' });
      const fill = el('div', { class: 'bt-fill' });
      const bar = el('div', { class: 'bt-track', 'aria-hidden': 'true' }, [fill]);
      const min = el('input', { type: 'number', class: 'num-input', min: '0', max: '180', 'aria-label': 'Timer ' + n + ' minutes' });
      const sec = el('input', { type: 'number', class: 'num-input', min: '0', max: '59', 'aria-label': 'Timer ' + n + ' seconds' });
      min.value = e.minutes;
      sec.value = e.seconds;
      const go = el('button', { type: 'button', class: 'bt-go btn-primary', 'aria-keyshortcuts': String(n), text: 'Start' });
      const reset = el('button', { type: 'button', class: 'bt-reset btn-danger-outline', text: 'Reset' });
      const card = el('article', { class: 'bt', 'data-i': String(i), 'aria-label': 'Timer ' + n }, [
        label, time, bar,
        el('div', { class: 'bt-status' }, [state, badge]),
        el('div', { class: 'field-row bt-dur' }, [min, el('span', { class: 'field-sep', text: ':' }), sec]),
        el('div', { class: 'controls bt-controls' }, [go, reset])
      ]);
      grid.appendChild(card);
      rows.push({ card, label, time, state, badge, fill, min, sec, go, reset });

      label.addEventListener('change', () => {
        entries[i].label = label.value.trim().slice(0, Core.MAX_LABEL);
        label.value = entries[i].label;
        time.setAttribute('aria-label', labelOf(i));
        persist();
      });
      const onDuration = () => {
        if (!Core.setDuration(entries[i], Number(min.value), Number(sec.value))) {
          min.value = entries[i].minutes; sec.value = entries[i].seconds; return;
        }
        min.value = entries[i].minutes; sec.value = entries[i].seconds;
        persist(); paintAll();
      };
      min.addEventListener('change', onDuration);
      sec.addEventListener('change', onDuration);
      go.addEventListener('click', () => toggleTimer(i));
      reset.addEventListener('click', () => { Core.reset(entries[i]); afterChange(); });
    }
    paintAll();
  }

  /* ---- running ----------------------------------------------------------- */
  function startTicking() { if (!timerId) timerId = setInterval(onTick, TICK_MS); }
  function stopTicking() { if (timerId) { clearInterval(timerId); timerId = null; } }

  function afterChange() {
    persist();
    paintAll();
    const running = Core.anyRunning(entries, count);
    if (running) startTicking(); else stopTicking();
    opts.onRunning(running);
  }

  function toggleTimer(i) {
    opts.unlock();
    if (!Core.toggle(entries[i], Date.now())) { paintAll(); return; }
    afterChange();
  }

  function onTick() {
    const now = Date.now();
    const finished = Core.tick(entries, count, now);
    if (finished.length) {
      const labels = finished.map(labelOf);
      say(Core.finishedMessage(labels));
      opts.onRing(labels);
      afterChange();
      return;
    }
    for (let i = 0; i < count; i++) paintRow(i, now);
  }

  /* ---- switching views --------------------------------------------------- */
  function setOpen(want) {
    if (want === open) return true;
    if (want && opts.isSingleBusy()) {
      showNote('Reset the single timer before opening the board.');
      return false;
    }
    if (!want && entries.some((e) => { const st = Core.stateOf(e); return st === 'running' || st === 'paused'; })) {
      showNote('Reset or finish the board timers before going back to the single timer.');
      return false;
    }
    showNote('');
    open = want;
    root.hidden = !open;
    document.body.classList.toggle('board-mode', open);
    btn.textContent = buttonText();
    if (open) { build(); onTick(); afterChange(); }
    else { persist(); }
    return true;
  }

  btn.addEventListener('click', () => { setOpen(!open); });

  countSel.addEventListener('change', () => {
    count = Number(countSel.value);
    build();
    afterChange();
  });

  resetAll.addEventListener('click', () => {
    for (let i = 0; i < count; i++) Core.reset(entries[i]);
    afterChange();
  });

  // Timers 1-4 from the keyboard. Never while typing (a label has digits in
  // it), never with a modifier, and never behind the shortcuts dialog.
  window.addEventListener('keydown', (e) => {
    if (!open || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement;
    const tag = a && a.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (a && a.isContentEditable)) return;
    const help = document.getElementById('helpOverlay');
    const mirror = document.getElementById('mirrorOverlay');
    if ((help && !help.hidden) || (mirror && !mirror.hidden)) return;
    const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code || '');
    if (!m) return;
    const i = Number(m[1]) - 1;
    if (i >= count) return;
    e.preventDefault();
    toggleTimer(i);
  });

  // A hidden tab's interval is throttled, but the end times are wall-clock, so
  // coming back only needs one tick to be right.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && open) onTick();
  });

  btn.textContent = buttonText();
  if (saved && saved.open && !opts.isSingleBusy()) setOpen(true);

  return {
    isOpen: () => open,
    isBusy: () => Core.anyRunning(entries, count),
  };
}

export default { initBoard };
