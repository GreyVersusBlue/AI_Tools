// ct-app.js — controller for all six Classroom Timer modes. One `phase` object
// is reused across modes; countdown-family modes (countdown, transition,
// round-robin, agenda) drive it from an `endAt` timestamp so pausing/resuming
// and tab throttling never drift, while random/stopwatch drive it from an
// accumulated elapsed base for the same reason.

import { load, save, loadRunning, saveRunning, clearRunning, MAX_AGENDA_SEGMENTS } from './ct-store.js';
import * as Sounds from './ct-sounds.js';

const RING_R = 90;
const RING_C = 2 * Math.PI * RING_R;
const COUNTDOWN_LIKE = new Set(['countdown', 'transition', 'roundrobin', 'agenda']);
// How long the silent "flash at zero" visual cue stays on screen once triggered
// (companion to the audio alert — see startZeroFlash()/stopZeroFlash() below).
const ZERO_FLASH_MS = 4000;
const BASE_TITLE = document.title;
const PRESET_ICONS = ['⏱', '📝', '🔔', '🤫', '🧹', '✋', '💬', '🎯'];

let prefs = load();
let mode = prefs.activeTab;
let timerId = null;
let phase = { status: 'idle' };

const els = {};
function q(id) { return document.getElementById(id); }

function effectiveVolume() {
  return prefs.sound.muted ? 0 : prefs.sound.volume;
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function setRing(fraction) {
  const f = Math.min(1, Math.max(0, fraction));
  els.ringFg.style.strokeDashoffset = String(RING_C * (1 - f));
}

function setRingVisible(visible) {
  els.ringWrap.classList.toggle('ring-hidden', !visible);
}

function paint(displayMs, fraction) {
  els.timeDisplay.textContent = formatTime(displayMs);
  if (fraction != null) setRing(fraction);
  updateTabTitle();
}

/** Mirrors the remaining/elapsed time into the browser tab title so it's
    readable from a taskbar or an alt-tab list when the tool is behind slides.
    Reverts to the plain title once nothing is running. */
function updateTabTitle() {
  document.title = (phase.status === 'running' || phase.status === 'paused')
    ? els.timeDisplay.textContent + ' — ' + BASE_TITLE
    : BASE_TITLE;
}

/** Green/amber/red urgency state for countdown-family modes, driven off
    configurable percent-of-total thresholds (prefs.display.amberPct/redPct).
    Colour is reinforced with a text badge (not colour alone) for colour-blind
    and grayscale-projector legibility — see the .urgency-badge CSS. */
function updateUrgency(fraction) {
  if (!els.ringWrap) return;
  if (fraction == null) { delete els.ringWrap.dataset.urgency; els.urgencyBadge.textContent = ''; return; }
  const redFrac = Math.max(0, (prefs.display.redPct || 0) / 100);
  const amberFrac = Math.max(redFrac, (prefs.display.amberPct || 0) / 100);
  let state = 'good';
  if (fraction <= redFrac) state = 'critical';
  else if (fraction <= amberFrac) state = 'warn';
  els.ringWrap.dataset.urgency = state;
  els.urgencyBadge.textContent = state === 'critical' ? '⏰ Almost time' : state === 'warn' ? '⚠ Wrapping up' : '';
}

let wakeLock = null;

/** Requests a screen wake lock while a timer runs — a projector laptop
    dimming or sleeping thirty seconds before the end is the single most
    annoying failure this tool can have. Silently no-ops where unsupported
    or refused (e.g. low battery); nothing here depends on it succeeding. */
async function acquireWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { /* denied, unsupported, or battery saver — timer still works */ }
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

// The wake lock is released by the browser whenever the tab is hidden, even
// if the timer keeps running underneath — re-request it on return so a
// teacher who alt-tabbed away and back still gets a screen that stays awake.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && phase.status === 'running') acquireWakeLock();
});

/** Read-only snapshot of what's currently on screen, for the "mirror to a
    device" feature (see the inline script at the bottom of the page) to
    poll and relay over its data channel. Deliberately a pull, not a push —
    the timer's own lifecycle (five modes, each with their own start/pause/
    resume/reset paths) shouldn't need to know a mirror might be listening. */
export function getDisplaySnapshot() {
  return {
    text: els.timeDisplay.textContent,
    sub: els.subDisplay.textContent,
    running: phase.status === 'running',
    mode,
  };
}

function updateSubDisplay(text) {
  els.subDisplay.textContent = text;
}

function flashDisplay() {
  els.timeDisplay.classList.remove('flash');
  void els.timeDisplay.offsetWidth; // restart the CSS animation
  els.timeDisplay.classList.add('flash');
}

let zeroFlashTimer = null;

/** Silent alternative/companion to the audio alert — a flashing border over
    the whole screen (so it still reads in fullscreen/projector mode) for
    testing rooms or hearing-impaired students. Opt-in via the "Flash at
    zero" checkbox; off does nothing, matching the pre-existing behavior. */
function startZeroFlash() {
  if (!prefs.sound.flashEnabled || !els.zeroFlashOverlay) return;
  els.zeroFlashOverlay.classList.add('active');
  if (zeroFlashTimer) clearTimeout(zeroFlashTimer);
  zeroFlashTimer = setTimeout(stopZeroFlash, ZERO_FLASH_MS);
}

function stopZeroFlash() {
  if (zeroFlashTimer) { clearTimeout(zeroFlashTimer); zeroFlashTimer = null; }
  if (els.zeroFlashOverlay) els.zeroFlashOverlay.classList.remove('active');
}

function renderLaps() {
  els.swLaps.innerHTML = phase.laps
    .map((ms, i) => `<li>Lap ${phase.laps.length - i}: ${formatTime(ms)}</li>`)
    .join('');
}

/** Countdown mode can target a wall-clock time ("Until 10:42") instead of a
    duration. Always resolves to the next occurrence of that time-of-day, so
    setting "Until 08:00" at 8:05am correctly means tomorrow, not a negative
    countdown. */
function getCountdownUntilMs() {
  const t = prefs.countdown.untilTime;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t || '')) return 0;
  const [h, m] = t.split(':').map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

function getConfiguredMs(m) {
  if (m === 'countdown' && prefs.countdown.untilEnabled) return getCountdownUntilMs();
  const p = prefs[m];
  return ((p.minutes || 0) * 60 + (p.seconds || 0)) * 1000;
}

function getAgendaSegmentMs(seg) {
  return ((seg.minutes || 0) * 60 + (seg.seconds || 0)) * 1000;
}

function agendaTotalMs(segments) {
  return segments.reduce((sum, s) => sum + getAgendaSegmentMs(s), 0);
}

function setButtonsIdle() {
  els.startBtn.hidden = false;
  els.pauseBtn.hidden = true;
  els.resumeBtn.hidden = true;
  els.panelDisableTarget.classList.remove('panel-disabled');
}

function setButtonsRunning() {
  els.startBtn.hidden = true;
  els.pauseBtn.hidden = false;
  els.resumeBtn.hidden = true;
  els.panelDisableTarget.classList.add('panel-disabled');
}

function setButtonsPaused() {
  els.startBtn.hidden = true;
  els.pauseBtn.hidden = true;
  els.resumeBtn.hidden = false;
}

function disableOtherTabs(disable) {
  els.tabs.forEach(btn => {
    if (btn.dataset.mode !== mode) btn.disabled = disable;
  });
}

function showPanel(m) {
  els.panels.forEach(p => { p.hidden = p.dataset.panel !== m; });
}

function updateTabsUI() {
  els.tabs.forEach(btn => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function startTicking() {
  if (timerId) return;
  timerId = setInterval(tick, 100);
}

function stopTicking() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

/** Keeps `ct_running_v1` in sync with `phase` so a reload/tab-close mid
    countdown can pick back up — see tryRestoreRunning() in init(). Cheap to
    call after every state transition since it's just a JSON write. */
function syncRunningPersistence() {
  if (phase.status === 'running' || phase.status === 'paused') saveRunning(mode, phase);
  else clearRunning();
}

function setAgendaCurrent(segments, idx) {
  els.agendaCurrent.textContent = (segments && segments[idx]) ? segments[idx].name : '';
}

function agendaNextText(segments, idx) {
  const next = segments && segments[idx + 1];
  return next ? `Next: ${next.name}` : 'Last segment';
}

function displayEndMessage() {
  return (prefs.display.endMessage || '').trim();
}

/** Slim whole-period progress bar for Agenda mode — `elapsedInCurrentMs` is
    how far into the *current* segment we are; combined with segments already
    completed (phase.agendaElapsedBase) that gives progress across the whole
    chained run, independent of how long any one segment is. */
function updateAgendaBar(elapsedInCurrentMs) {
  if (!els.agendaBar) return;
  if (mode !== 'agenda' || !phase.agendaTotalMs) { els.agendaBar.hidden = true; return; }
  els.agendaBar.hidden = false;
  const done = phase.agendaElapsedBase + Math.min(Math.max(0, elapsedInCurrentMs), phase.totalMs || 0);
  const frac = phase.agendaTotalMs > 0 ? Math.min(1, done / phase.agendaTotalMs) : 0;
  els.agendaBarFill.style.width = (frac * 100) + '%';
}

function resetPhaseForMode() {
  stopZeroFlash();
  releaseWakeLock();
  phase = { status: 'idle', laps: [] };
  els.agendaCurrent.hidden = mode !== 'agenda';
  els.subDisplay.classList.remove('end-message');
  if (mode !== 'agenda') { els.agendaBar.hidden = true; }
  // Random Interval hides its numeric countdown so the cue is a genuine
  // surprise — the progress ring draining toward empty would leak the same
  // information visually, so it stays hidden right alongside the numbers.
  setRingVisible(mode !== 'stopwatch' && mode !== 'random');
  if (mode === 'agenda') {
    const segments = (prefs.agenda.segments || []).map(s => ({ ...s }));
    phase.segments = segments;
    phase.segIndex = 0;
    phase.agendaTotalMs = agendaTotalMs(segments);
    phase.agendaElapsedBase = 0;
    phase.totalMs = segments.length ? getAgendaSegmentMs(segments[0]) : 0;
    setAgendaCurrent(segments, 0);
    updateSubDisplay(segments.length ? agendaNextText(segments, 0) : 'Add at least one segment to begin.');
    paint(phase.totalMs, phase.totalMs > 0 ? 1 : 0);
    updateUrgency(phase.totalMs > 0 ? 1 : null);
    updateAgendaBar(0);
  } else if (COUNTDOWN_LIKE.has(mode)) {
    phase.totalMs = getConfiguredMs(mode === 'roundrobin' ? 'roundrobin' : mode);
    if (mode === 'roundrobin') {
      phase.stations = prefs.roundrobin.stations;
      phase.station = 1;
      phase.loop = prefs.roundrobin.loop;
      updateSubDisplay(`Station 1 of ${phase.stations}`);
    } else if (mode === 'countdown' && prefs.countdown.untilEnabled) {
      updateSubDisplay(prefs.countdown.untilTime ? `Until ${prefs.countdown.untilTime}` : '');
    } else {
      updateSubDisplay('');
    }
    paint(phase.totalMs, phase.totalMs > 0 ? 1 : 0);
    updateUrgency(phase.totalMs > 0 ? 1 : null);
  } else if (mode === 'random') {
    phase.elapsedBase = 0;
    updateSubDisplay('');
    paint(0, 1);
    updateUrgency(null);
  } else if (mode === 'stopwatch') {
    phase.elapsedBase = 0;
    updateSubDisplay('');
    paint(0, null);
    renderLaps();
    updateUrgency(null);
  }
  setButtonsIdle();
  syncRunningPersistence();
}

function switchMode(newMode) {
  if (phase.status === 'running' || phase.status === 'paused') return;
  mode = newMode;
  prefs = save({ activeTab: mode });
  updateTabsUI();
  showPanel(mode);
  resetPhaseForMode();
}

/** Enters overtime instead of stopping: `phase.status` stays 'running' so
    ticking, pause/resume, and the disabled other-tabs state all keep working
    unchanged — tick() just switches to painting `now - endAt` once it sees
    `phase.overtimeStarted`. Reset is the only way out. Not offered for
    Round-Robin (which segment would even be "over"?) or non-final Agenda
    segments (those advance instead — see onPhaseZero). */
function beginOvertime() {
  phase.overtimeStarted = true;
  const fallback = mode === 'transition' ? "Time's up — let's move on!" : "Time's up!";
  updateSubDisplay(displayEndMessage() || fallback);
  els.subDisplay.classList.add('end-message');
  syncRunningPersistence();
}

function onPhaseZero() {
  Sounds.play(prefs.sound.choice, effectiveVolume());
  flashDisplay();
  startZeroFlash();
  if (mode === 'roundrobin') {
    if (phase.station < phase.stations) {
      phase.station += 1;
      phase.totalMs = getConfiguredMs('roundrobin');
      phase.endAt = Date.now() + phase.totalMs;
      updateSubDisplay(`Station ${phase.station} of ${phase.stations}`);
      syncRunningPersistence();
      return;
    }
    if (phase.loop) {
      phase.station = 1;
      phase.totalMs = getConfiguredMs('roundrobin');
      phase.endAt = Date.now() + phase.totalMs;
      updateSubDisplay(`Station 1 of ${phase.stations}`);
      syncRunningPersistence();
      return;
    }
    updateSubDisplay('All stations complete!');
  } else if (mode === 'agenda') {
    if (phase.segIndex < phase.segments.length - 1) {
      phase.agendaElapsedBase += phase.totalMs;
      phase.segIndex += 1;
      const seg = phase.segments[phase.segIndex];
      phase.totalMs = getAgendaSegmentMs(seg);
      phase.endAt = Date.now() + phase.totalMs;
      setAgendaCurrent(phase.segments, phase.segIndex);
      updateSubDisplay(agendaNextText(phase.segments, phase.segIndex));
      updateAgendaBar(0);
      syncRunningPersistence();
      return;
    }
    phase.agendaElapsedBase += phase.totalMs;
    updateAgendaBar(0);
    if (prefs.display.overtimeEnabled) { beginOvertime(); return; }
    updateSubDisplay(displayEndMessage() || 'Agenda complete!');
    els.subDisplay.classList.add('end-message');
  } else if (mode === 'countdown' || mode === 'transition') {
    if (prefs.display.overtimeEnabled) { beginOvertime(); return; }
    updateSubDisplay(displayEndMessage() || (mode === 'transition' ? "Time's up — let's move on!" : "Time's up!"));
    els.subDisplay.classList.add('end-message');
  }
  phase.status = 'done';
  stopTicking();
  disableOtherTabs(false);
  releaseWakeLock();
  paint(0, 0);
  updateUrgency(null);
  setButtonsIdle();
  syncRunningPersistence();
}

function onRandomFire() {
  Sounds.play(prefs.sound.choice, effectiveVolume());
  flashDisplay();
  startZeroFlash();
  const firedAt = phase.targetMs;
  phase.status = 'done';
  stopTicking();
  disableOtherTabs(false);
  paint(firedAt, 0);
  updateSubDisplay(`Triggered at ${formatTime(firedAt)}`);
  setButtonsIdle();
  syncRunningPersistence();
}

function paintOvertime(overMs) {
  els.timeDisplay.textContent = '+' + formatTime(overMs);
  setRing(1);
  updateUrgency(0);
  updateTabTitle();
}

function tick() {
  const now = Date.now();
  if (COUNTDOWN_LIKE.has(mode)) {
    if (phase.overtimeStarted) { paintOvertime(now - phase.endAt); return; }
    const remaining = phase.endAt - now;
    if (remaining <= 0) { onPhaseZero(); return; }
    paint(remaining, phase.totalMs > 0 ? remaining / phase.totalMs : 0);
    updateUrgency(phase.totalMs > 0 ? remaining / phase.totalMs : 1);
    if (mode === 'agenda') updateAgendaBar(phase.totalMs - remaining);
  } else if (mode === 'random') {
    const elapsed = now - phase.startAt + phase.elapsedBase;
    if (elapsed >= phase.targetMs) { onRandomFire(); return; }
    paint(elapsed, 1 - Math.min(1, elapsed / phase.maxMs));
  } else if (mode === 'stopwatch') {
    const elapsed = now - phase.startAt + phase.elapsedBase;
    paint(elapsed, null);
  }
}

function onStart() {
  stopZeroFlash();
  Sounds.unlock();
  els.subDisplay.classList.remove('end-message');
  if (mode === 'countdown' || mode === 'transition') {
    phase.totalMs = getConfiguredMs(mode);
    if (phase.totalMs <= 0) return;
    phase.endAt = Date.now() + phase.totalMs;
    if (mode === 'countdown' && prefs.countdown.untilEnabled) {
      updateSubDisplay(`Until ${prefs.countdown.untilTime}`);
    }
  } else if (mode === 'roundrobin') {
    phase.stations = prefs.roundrobin.stations;
    phase.loop = prefs.roundrobin.loop;
    phase.station = 1;
    phase.totalMs = getConfiguredMs('roundrobin');
    if (phase.totalMs <= 0) return;
    phase.endAt = Date.now() + phase.totalMs;
    updateSubDisplay(`Station 1 of ${phase.stations}`);
  } else if (mode === 'agenda') {
    const segments = (prefs.agenda.segments || []).map(s => ({ ...s }));
    if (!segments.length) return;
    phase.segments = segments;
    phase.segIndex = 0;
    phase.agendaTotalMs = agendaTotalMs(segments);
    phase.agendaElapsedBase = 0;
    phase.totalMs = getAgendaSegmentMs(segments[0]);
    if (phase.totalMs <= 0) return;
    phase.endAt = Date.now() + phase.totalMs;
    setAgendaCurrent(segments, 0);
    updateSubDisplay(agendaNextText(segments, 0));
    updateAgendaBar(0);
  } else if (mode === 'random') {
    const lo = Math.min(prefs.random.minMinutes, prefs.random.maxMinutes);
    const hi = Math.max(prefs.random.minMinutes, prefs.random.maxMinutes);
    phase.targetMs = (lo + Math.random() * (hi - lo)) * 60000;
    phase.maxMs = Math.max(hi, 0.01) * 60000;
    phase.startAt = Date.now();
    phase.elapsedBase = 0;
    updateSubDisplay('Watching for the random cue…');
  } else if (mode === 'stopwatch') {
    phase.startAt = Date.now();
    phase.elapsedBase = phase.elapsedBase || 0;
  }
  phase.status = 'running';
  setButtonsRunning();
  disableOtherTabs(true);
  startTicking();
  acquireWakeLock();
  syncRunningPersistence();
}

function startPreset(modeKey, minutes, seconds) {
  prefs = save({ [modeKey]: { minutes, seconds } });
  const inputs = modeKey === 'transition' ? [els.trMinutes, els.trSeconds] : [els.cdMinutes, els.cdSeconds];
  inputs[0].value = minutes;
  inputs[1].value = seconds;
  if (phase.status === 'idle' || phase.status === 'done') {
    resetPhaseForMode();
    onStart();
  }
}

function onPause() {
  phase.status = 'paused';
  stopTicking();
  releaseWakeLock();
  if (COUNTDOWN_LIKE.has(mode)) {
    phase.remainingAtPause = phase.endAt - Date.now();
  } else {
    phase.elapsedBase = (phase.elapsedBase || 0) + (Date.now() - phase.startAt);
  }
  setButtonsPaused();
  syncRunningPersistence();
}

function onResume() {
  Sounds.unlock();
  if (COUNTDOWN_LIKE.has(mode)) {
    phase.endAt = Date.now() + phase.remainingAtPause;
  } else {
    phase.startAt = Date.now();
  }
  phase.status = 'running';
  setButtonsRunning();
  startTicking();
  acquireWakeLock();
  syncRunningPersistence();
}

function onReset() {
  stopTicking();
  disableOtherTabs(false);
  resetPhaseForMode();
}

function bindNumberInput(input, modeKey, field, max) {
  input.addEventListener('change', () => {
    const v = Math.max(0, Math.min(max, Math.floor(Number(input.value)) || 0));
    input.value = v;
    prefs = save({ [modeKey]: { ...prefs[modeKey], [field]: v } });
    if (phase.status === 'idle' && mode === modeKey) resetPhaseForMode();
  });
}

function initTabs() {
  els.tabs.forEach(btn => btn.addEventListener('click', () => switchMode(btn.dataset.mode)));
  updateTabsUI();
  showPanel(mode);
}

function renderCustomPresets() {
  const list = prefs.customPresets || [];
  els.cdCustomPresets.innerHTML = list.map((p, i) => `
    <span class="custom-preset-chip">
      <button type="button" class="cd-custom-load" data-i="${i}"${p.color ? ` style="border-color:${p.color}"` : ''}>${p.icon ? escapeHtmlCT(p.icon) + ' ' : ''}${escapeHtmlCT(p.name)} (${p.minutes}:${String(p.seconds).padStart(2, '0')})</button>
      <button type="button" class="cd-custom-del" data-i="${i}" aria-label="Delete preset ${escapeHtmlCT(p.name)}">&times;</button>
    </span>
  `).join('');
  els.cdCustomPresets.querySelectorAll('.cd-custom-load').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = list[Number(btn.dataset.i)];
      if (!p) return;
      els.cdMinutes.value = p.minutes;
      els.cdSeconds.value = p.seconds;
      prefs = save({ countdown: { minutes: p.minutes, seconds: p.seconds } });
      if (phase.status === 'idle' && mode === 'countdown') resetPhaseForMode();
    });
  });
  els.cdCustomPresets.querySelectorAll('.cd-custom-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = list.filter((_, i) => i !== Number(btn.dataset.i));
      prefs = save({ customPresets: next });
      renderCustomPresets();
    });
  });
}

/** Fires custom preset N (1-indexed) immediately — the "1-9 to fire saved
    presets" keyboard shortcut. Only wired up for Countdown, where presets
    live. */
function firePresetByIndex(n) {
  const p = (prefs.customPresets || [])[n - 1];
  if (!p || mode !== 'countdown' || (phase.status !== 'idle' && phase.status !== 'done')) return;
  els.cdMinutes.value = p.minutes;
  els.cdSeconds.value = p.seconds;
  prefs = save({ countdown: { minutes: p.minutes, seconds: p.seconds } });
  resetPhaseForMode();
  onStart();
}

function escapeHtmlCT(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function refreshCountdownUntilUI() {
  const on = els.cdUntilToggle.checked;
  els.cdDurationFields.hidden = on;
  els.cdUntilRow.hidden = !on;
}

function initCountdownPanel() {
  els.cdMinutes.value = prefs.countdown.minutes;
  els.cdSeconds.value = prefs.countdown.seconds;
  bindNumberInput(els.cdMinutes, 'countdown', 'minutes', 180);
  bindNumberInput(els.cdSeconds, 'countdown', 'seconds', 59);
  document.querySelectorAll('.cd-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const min = Number(btn.dataset.min);
      els.cdMinutes.value = min;
      els.cdSeconds.value = 0;
      prefs = save({ countdown: { minutes: min, seconds: 0 } });
      if (phase.status === 'idle' && mode === 'countdown') resetPhaseForMode();
    });
  });
  renderCustomPresets();
  els.presetIconRow.innerHTML = PRESET_ICONS.map(ic => `<button type="button" class="preset-icon-btn" data-icon="${ic}">${ic}</button>`).join('');
  els.presetIconRow.querySelectorAll('.preset-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      els.cdPresetIcon.value = btn.dataset.icon;
      els.presetIconRow.querySelectorAll('.preset-icon-btn').forEach(b => b.classList.toggle('selected', b === btn));
    });
  });
  els.cdSavePreset.addEventListener('click', () => {
    const name = els.cdPresetName.value.trim();
    if (!name) { els.cdPresetName.focus(); return; }
    const minutes = Math.max(0, Math.min(180, Math.floor(Number(els.cdMinutes.value)) || 0));
    const seconds = Math.max(0, Math.min(59, Math.floor(Number(els.cdSeconds.value)) || 0));
    if (minutes === 0 && seconds === 0) return;
    const next = (prefs.customPresets || []).filter(p => p.name !== name);
    next.push({ name, minutes, seconds, icon: els.cdPresetIcon.value.trim(), color: els.cdPresetColor.value });
    prefs = save({ customPresets: next });
    els.cdPresetName.value = '';
    els.cdPresetIcon.value = '';
    els.presetIconRow.querySelectorAll('.preset-icon-btn').forEach(b => b.classList.remove('selected'));
    renderCustomPresets();
  });

  els.cdUntilToggle.checked = prefs.countdown.untilEnabled;
  els.cdUntilTime.value = prefs.countdown.untilTime;
  refreshCountdownUntilUI();
  els.cdUntilToggle.addEventListener('change', () => {
    prefs = save({ countdown: { ...prefs.countdown, untilEnabled: els.cdUntilToggle.checked } });
    refreshCountdownUntilUI();
    if (phase.status === 'idle' && mode === 'countdown') resetPhaseForMode();
  });
  els.cdUntilTime.addEventListener('change', () => {
    prefs = save({ countdown: { ...prefs.countdown, untilTime: els.cdUntilTime.value } });
    if (phase.status === 'idle' && mode === 'countdown') resetPhaseForMode();
  });
}

function initTransitionPanel() {
  els.trMinutes.value = prefs.transition.minutes;
  els.trSeconds.value = prefs.transition.seconds;
  bindNumberInput(els.trMinutes, 'transition', 'minutes', 60);
  bindNumberInput(els.trSeconds, 'transition', 'seconds', 59);
  document.querySelectorAll('.tr-preset').forEach(btn => {
    btn.addEventListener('click', () => startPreset('transition', Number(btn.dataset.min), 0));
  });
  els.trCustomStart.addEventListener('click', () => {
    if (mode === 'transition' && phase.status === 'idle') onStart();
  });
}

function initRandomPanel() {
  els.rndMin.value = prefs.random.minMinutes;
  els.rndMax.value = prefs.random.maxMinutes;
  bindNumberInput(els.rndMin, 'random', 'minMinutes', 120);
  bindNumberInput(els.rndMax, 'random', 'maxMinutes', 120);
}

function initStopwatchPanel() {
  els.swLap.addEventListener('click', () => {
    if (phase.status !== 'running') return;
    const elapsed = Date.now() - phase.startAt + phase.elapsedBase;
    phase.laps.unshift(elapsed);
    renderLaps();
    syncRunningPersistence();
  });
}

function initRoundrobinPanel() {
  els.rrMinutes.value = prefs.roundrobin.minutes;
  els.rrSeconds.value = prefs.roundrobin.seconds;
  els.rrStations.value = prefs.roundrobin.stations;
  els.rrLoop.checked = prefs.roundrobin.loop;
  bindNumberInput(els.rrMinutes, 'roundrobin', 'minutes', 60);
  bindNumberInput(els.rrSeconds, 'roundrobin', 'seconds', 59);
  bindNumberInput(els.rrStations, 'roundrobin', 'stations', 20);
  els.rrLoop.addEventListener('change', () => {
    prefs = save({ roundrobin: { ...prefs.roundrobin, loop: els.rrLoop.checked } });
  });
}

function renderAgendaSegments() {
  const segs = prefs.agenda.segments || [];
  els.agendaSegList.innerHTML = segs.map((s, i) => `
    <li class="agenda-seg-row">
      <input type="text" class="agenda-seg-name" data-i="${i}" value="${escapeHtmlCT(s.name)}" maxlength="40" aria-label="Segment ${i + 1} name">
      <input type="number" class="agenda-seg-min num-input" data-i="${i}" value="${s.minutes}" min="0" max="180" aria-label="Segment ${i + 1} minutes">
      <span class="field-sep">:</span>
      <input type="number" class="agenda-seg-sec num-input" data-i="${i}" value="${s.seconds}" min="0" max="59" aria-label="Segment ${i + 1} seconds">
      <button type="button" class="agenda-seg-up" data-i="${i}" aria-label="Move segment ${i + 1} up" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
      <button type="button" class="agenda-seg-down" data-i="${i}" aria-label="Move segment ${i + 1} down" ${i === segs.length - 1 ? 'disabled' : ''}>&darr;</button>
      <button type="button" class="agenda-seg-del" data-i="${i}" aria-label="Delete segment ${i + 1}">&times;</button>
    </li>
  `).join('');
  els.agendaTotal.textContent = segs.length ? `Total: ${formatTime(agendaTotalMs(segs))}` : 'No segments yet — add one below.';

  function patchAndMaybeRerender(next, needsRerender) {
    prefs = save({ agenda: { segments: next } });
    if (needsRerender) renderAgendaSegments();
    if (phase.status === 'idle' && mode === 'agenda') resetPhaseForMode();
  }

  // Field edits (name/minutes/seconds) don't trigger a rerender, so each one
  // reads prefs.agenda.segments fresh at event time rather than closing over
  // the `segs` snapshot from the last render — otherwise two quick edits to
  // different fields would silently clobber each other.
  els.agendaSegList.querySelectorAll('.agenda-seg-name').forEach(inp => {
    inp.addEventListener('change', () => {
      const next = (prefs.agenda.segments || []).map((s, j) => j === Number(inp.dataset.i) ? { ...s, name: inp.value.trim().slice(0, 40) || 'Segment' } : s);
      patchAndMaybeRerender(next, false);
    });
  });
  els.agendaSegList.querySelectorAll('.agenda-seg-min').forEach(inp => {
    inp.addEventListener('change', () => {
      const v = Math.max(0, Math.min(180, Math.floor(Number(inp.value)) || 0));
      const next = (prefs.agenda.segments || []).map((s, j) => j === Number(inp.dataset.i) ? { ...s, minutes: v } : s);
      patchAndMaybeRerender(next, false);
    });
  });
  els.agendaSegList.querySelectorAll('.agenda-seg-sec').forEach(inp => {
    inp.addEventListener('change', () => {
      const v = Math.max(0, Math.min(59, Math.floor(Number(inp.value)) || 0));
      const next = (prefs.agenda.segments || []).map((s, j) => j === Number(inp.dataset.i) ? { ...s, seconds: v } : s);
      patchAndMaybeRerender(next, false);
    });
  });
  els.agendaSegList.querySelectorAll('.agenda-seg-del').forEach(btn => {
    btn.addEventListener('click', () => patchAndMaybeRerender(segs.filter((_, j) => j !== Number(btn.dataset.i)), true));
  });
  els.agendaSegList.querySelectorAll('.agenda-seg-up').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      if (i === 0) return;
      const next = segs.slice();
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      patchAndMaybeRerender(next, true);
    });
  });
  els.agendaSegList.querySelectorAll('.agenda-seg-down').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      if (i === segs.length - 1) return;
      const next = segs.slice();
      [next[i + 1], next[i]] = [next[i], next[i + 1]];
      patchAndMaybeRerender(next, true);
    });
  });
}

function initAgendaPanel() {
  renderAgendaSegments();
  els.agendaAddSeg.addEventListener('click', () => {
    const segs = prefs.agenda.segments || [];
    if (segs.length >= MAX_AGENDA_SEGMENTS) return;
    const next = segs.concat([{ name: `Segment ${segs.length + 1}`, minutes: 5, seconds: 0 }]);
    prefs = save({ agenda: { segments: next } });
    renderAgendaSegments();
    if (phase.status === 'idle' && mode === 'agenda') resetPhaseForMode();
  });
}

function initSoundPanel() {
  els.soundChoice.value = prefs.sound.choice;
  els.soundVolume.value = prefs.sound.volume;
  els.soundMute.checked = prefs.sound.muted;
  els.flashZero.checked = prefs.sound.flashEnabled;
  els.soundChoice.addEventListener('change', () => {
    prefs = save({ sound: { ...prefs.sound, choice: els.soundChoice.value } });
    Sounds.unlock();
    Sounds.play(prefs.sound.choice, effectiveVolume());
  });
  els.soundVolume.addEventListener('input', () => {
    prefs = save({ sound: { ...prefs.sound, volume: Number(els.soundVolume.value) } });
  });
  els.soundVolume.addEventListener('change', () => {
    Sounds.unlock();
    Sounds.play(prefs.sound.choice, effectiveVolume());
  });
  els.soundMute.addEventListener('change', () => {
    prefs = save({ sound: { ...prefs.sound, muted: els.soundMute.checked } });
  });
  els.flashZero.addEventListener('change', () => {
    prefs = save({ sound: { ...prefs.sound, flashEnabled: els.flashZero.checked } });
    if (!els.flashZero.checked) stopZeroFlash();
  });
  els.soundTest.addEventListener('click', () => {
    Sounds.unlock();
    Sounds.play(prefs.sound.choice, effectiveVolume());
  });
}

function initDisplayPanel() {
  els.amberPct.value = prefs.display.amberPct;
  els.redPct.value = prefs.display.redPct;
  els.overtimeEnabled.checked = prefs.display.overtimeEnabled;
  els.endMessage.value = prefs.display.endMessage;
  els.amberPct.addEventListener('change', () => {
    const v = Math.max(1, Math.min(90, Math.floor(Number(els.amberPct.value)) || 25));
    els.amberPct.value = v;
    prefs = save({ display: { ...prefs.display, amberPct: v } });
  });
  els.redPct.addEventListener('change', () => {
    const v = Math.max(0, Math.min(90, Math.floor(Number(els.redPct.value)) || 10));
    els.redPct.value = v;
    prefs = save({ display: { ...prefs.display, redPct: v } });
  });
  els.overtimeEnabled.addEventListener('change', () => {
    prefs = save({ display: { ...prefs.display, overtimeEnabled: els.overtimeEnabled.checked } });
  });
  els.endMessage.addEventListener('change', () => {
    prefs = save({ display: { ...prefs.display, endMessage: els.endMessage.value.slice(0, 60) } });
  });
}

function toggleHelpOverlay(show) {
  const willShow = show != null ? show : els.helpOverlay.hidden;
  els.helpOverlay.hidden = !willShow;
}

function initControls() {
  els.startBtn.addEventListener('click', onStart);
  els.pauseBtn.addEventListener('click', onPause);
  els.resumeBtn.addEventListener('click', onResume);
  els.resetBtn.addEventListener('click', onReset);
  els.helpBtn.addEventListener('click', () => toggleHelpOverlay(true));
  els.helpCloseBtn.addEventListener('click', () => toggleHelpOverlay(false));
  els.helpOverlay.addEventListener('mousedown', e => { if (e.target === els.helpOverlay) toggleHelpOverlay(false); });

  window.addEventListener('keydown', e => {
    const tag = document.activeElement && document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

    if (e.key === 'Escape' && !els.helpOverlay.hidden) { toggleHelpOverlay(false); return; }
    if (e.key === '?' && !typing) { e.preventDefault(); toggleHelpOverlay(); return; }
    if (typing) return;

    if (e.code === 'Space') {
      if (tag === 'BUTTON') return;
      e.preventDefault();
      if (phase.status === 'running') onPause();
      else if (phase.status === 'paused') onResume();
      else onStart();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.toLowerCase() === 'r') { onReset(); return; }
    if (/^[1-9]$/.test(e.key)) { firePresetByIndex(Number(e.key)); return; }
  });
}

function cacheEls() {
  els.tabs = Array.from(document.querySelectorAll('.mode-tab'));
  els.panels = Array.from(document.querySelectorAll('.settings-panel'));
  els.panelDisableTarget = q('modeSettings');
  els.timeDisplay = q('timeDisplay');
  els.subDisplay = q('subDisplay');
  els.ringWrap = q('ringWrap');
  els.ringFg = q('ringFg');
  els.startBtn = q('startBtn');
  els.pauseBtn = q('pauseBtn');
  els.resumeBtn = q('resumeBtn');
  els.resetBtn = q('resetBtn');
  els.cdMinutes = q('cdMinutes');
  els.cdSeconds = q('cdSeconds');
  els.cdPresetName = q('cdPresetName');
  els.cdPresetIcon = q('cdPresetIcon');
  els.cdPresetColor = q('cdPresetColor');
  els.presetIconRow = q('presetIconRow');
  els.cdSavePreset = q('cdSavePreset');
  els.cdCustomPresets = q('cdCustomPresets');
  els.cdDurationFields = q('cdDurationFields');
  els.cdUntilToggle = q('cdUntilToggle');
  els.cdUntilRow = q('cdUntilRow');
  els.cdUntilTime = q('cdUntilTime');
  els.trMinutes = q('trMinutes');
  els.trSeconds = q('trSeconds');
  els.trCustomStart = q('trCustomStart');
  els.rndMin = q('rndMin');
  els.rndMax = q('rndMax');
  els.swLap = q('swLap');
  els.swLaps = q('swLaps');
  els.rrMinutes = q('rrMinutes');
  els.rrSeconds = q('rrSeconds');
  els.rrStations = q('rrStations');
  els.rrLoop = q('rrLoop');
  els.agendaSegList = q('agendaSegList');
  els.agendaAddSeg = q('agendaAddSeg');
  els.agendaTotal = q('agendaTotal');
  els.agendaCurrent = q('agendaCurrent');
  els.agendaBar = q('agendaBar');
  els.agendaBarFill = q('agendaBarFill');
  els.soundChoice = q('soundChoice');
  els.soundVolume = q('soundVolume');
  els.soundMute = q('soundMute');
  els.soundTest = q('soundTest');
  els.flashZero = q('flashZero');
  els.zeroFlashOverlay = q('zeroFlashOverlay');
  els.urgencyBadge = q('urgencyBadge');
  els.amberPct = q('amberPct');
  els.redPct = q('redPct');
  els.overtimeEnabled = q('overtimeEnabled');
  els.endMessage = q('endMessage');
  els.helpBtn = q('helpBtn');
  els.helpOverlay = q('helpOverlay');
  els.helpCloseBtn = q('helpCloseBtn');
}

/** Paints the display from a restored `phase` without waiting for the next
    tick — subDisplay text isn't part of the persisted phase (it's derived,
    same as resetPhaseForMode() derives it), so it's recomputed here too. */
function renderRestoredDisplay() {
  if (mode === 'agenda') {
    els.agendaCurrent.hidden = false;
    setAgendaCurrent(phase.segments, phase.segIndex);
    updateSubDisplay(phase.segments ? agendaNextText(phase.segments, phase.segIndex) : '');
  }
  if (COUNTDOWN_LIKE.has(mode) && phase.overtimeStarted) {
    els.subDisplay.classList.add('end-message');
    if (phase.status === 'running') { paintOvertime(Date.now() - phase.endAt); return; }
    paintOvertime(-phase.remainingAtPause);
    return;
  }
  if (COUNTDOWN_LIKE.has(mode)) {
    const remaining = phase.status === 'running' ? Math.max(0, phase.endAt - Date.now()) : phase.remainingAtPause;
    paint(remaining, phase.totalMs > 0 ? remaining / phase.totalMs : 0);
    updateUrgency(phase.totalMs > 0 ? remaining / phase.totalMs : 1);
    if (mode === 'roundrobin') updateSubDisplay(`Station ${phase.station} of ${phase.stations}`);
    else if (mode === 'agenda') updateAgendaBar(phase.totalMs - remaining);
    else if (mode === 'countdown' && prefs.countdown.untilEnabled) updateSubDisplay(`Until ${prefs.countdown.untilTime}`);
    else updateSubDisplay('');
  } else if (mode === 'random') {
    const elapsed = phase.status === 'running' ? (Date.now() - phase.startAt + phase.elapsedBase) : phase.elapsedBase;
    paint(elapsed, 1 - Math.min(1, elapsed / phase.maxMs));
    updateSubDisplay('Watching for the random cue…');
  } else if (mode === 'stopwatch') {
    const elapsed = phase.status === 'running' ? (Date.now() - phase.startAt + phase.elapsedBase) : phase.elapsedBase;
    paint(elapsed, null);
  }
}

/** Picks a running/paused timer back up after a reload or tab-close —
    `endAt`/`startAt` are absolute timestamps, so the elapsed real time during
    the reload is already correctly reflected without any adjustment.
    Returns true if it restored something, so init() knows to skip the normal
    idle reset. */
function tryRestoreRunning() {
  const running = loadRunning();
  if (!running) return false;
  mode = running.mode;
  phase = running.phase;
  phase.laps = phase.laps || [];
  prefs = save({ activeTab: mode });
  setRingVisible(mode !== 'stopwatch' && mode !== 'random');
  if (mode === 'stopwatch') renderLaps();
  renderRestoredDisplay();
  disableOtherTabs(true);
  if (phase.status === 'running') {
    setButtonsRunning();
    startTicking();
    acquireWakeLock();
  } else {
    setButtonsPaused();
  }
  return true;
}

function init() {
  cacheEls();
  els.ringFg.style.strokeDasharray = String(RING_C);
  const restored = tryRestoreRunning();
  initTabs();
  initCountdownPanel();
  initTransitionPanel();
  initRandomPanel();
  initStopwatchPanel();
  initRoundrobinPanel();
  initAgendaPanel();
  initSoundPanel();
  initDisplayPanel();
  initControls();
  if (!restored) resetPhaseForMode();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
