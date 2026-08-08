// ct-app.js — controller for all five Classroom Timer modes. One `phase` object
// is reused across modes; countdown-family modes (countdown, transition,
// round-robin) drive it from an `endAt` timestamp so pausing/resuming and tab
// throttling never drift, while random/stopwatch drive it from an accumulated
// elapsed base for the same reason.

import { load, save } from './ct-store.js';
import * as Sounds from './ct-sounds.js';

const RING_R = 90;
const RING_C = 2 * Math.PI * RING_R;
const COUNTDOWN_LIKE = new Set(['countdown', 'transition', 'roundrobin']);

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
}

function updateSubDisplay(text) {
  els.subDisplay.textContent = text;
}

function flashDisplay() {
  els.timeDisplay.classList.remove('flash');
  void els.timeDisplay.offsetWidth; // restart the CSS animation
  els.timeDisplay.classList.add('flash');
}

function renderLaps() {
  els.swLaps.innerHTML = phase.laps
    .map((ms, i) => `<li>Lap ${phase.laps.length - i}: ${formatTime(ms)}</li>`)
    .join('');
}

function getConfiguredMs(m) {
  const p = prefs[m];
  return ((p.minutes || 0) * 60 + (p.seconds || 0)) * 1000;
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

function resetPhaseForMode() {
  phase = { status: 'idle', laps: [] };
  // Random Interval hides its numeric countdown so the cue is a genuine
  // surprise — the progress ring draining toward empty would leak the same
  // information visually, so it stays hidden right alongside the numbers.
  setRingVisible(mode !== 'stopwatch' && mode !== 'random');
  if (COUNTDOWN_LIKE.has(mode)) {
    phase.totalMs = getConfiguredMs(mode === 'roundrobin' ? 'roundrobin' : mode);
    if (mode === 'roundrobin') {
      phase.stations = prefs.roundrobin.stations;
      phase.station = 1;
      phase.loop = prefs.roundrobin.loop;
      updateSubDisplay(`Station 1 of ${phase.stations}`);
    } else {
      updateSubDisplay('');
    }
    paint(phase.totalMs, phase.totalMs > 0 ? 1 : 0);
  } else if (mode === 'random') {
    phase.elapsedBase = 0;
    updateSubDisplay('');
    paint(0, 1);
  } else if (mode === 'stopwatch') {
    phase.elapsedBase = 0;
    updateSubDisplay('');
    paint(0, null);
    renderLaps();
  }
  setButtonsIdle();
}

function switchMode(newMode) {
  if (phase.status === 'running' || phase.status === 'paused') return;
  mode = newMode;
  prefs = save({ activeTab: mode });
  updateTabsUI();
  showPanel(mode);
  resetPhaseForMode();
}

function onPhaseZero() {
  Sounds.play(prefs.sound.choice, effectiveVolume());
  flashDisplay();
  if (mode === 'roundrobin') {
    if (phase.station < phase.stations) {
      phase.station += 1;
      phase.totalMs = getConfiguredMs('roundrobin');
      phase.endAt = Date.now() + phase.totalMs;
      updateSubDisplay(`Station ${phase.station} of ${phase.stations}`);
      return;
    }
    if (phase.loop) {
      phase.station = 1;
      phase.totalMs = getConfiguredMs('roundrobin');
      phase.endAt = Date.now() + phase.totalMs;
      updateSubDisplay(`Station 1 of ${phase.stations}`);
      return;
    }
    updateSubDisplay('All stations complete!');
  } else {
    updateSubDisplay(mode === 'transition' ? "Time's up — let's move on!" : "Time's up!");
  }
  phase.status = 'done';
  stopTicking();
  disableOtherTabs(false);
  paint(0, 0);
  setButtonsIdle();
}

function onRandomFire() {
  Sounds.play(prefs.sound.choice, effectiveVolume());
  flashDisplay();
  const firedAt = phase.targetMs;
  phase.status = 'done';
  stopTicking();
  disableOtherTabs(false);
  paint(firedAt, 0);
  updateSubDisplay(`Triggered at ${formatTime(firedAt)}`);
  setButtonsIdle();
}

function tick() {
  const now = Date.now();
  if (COUNTDOWN_LIKE.has(mode)) {
    const remaining = phase.endAt - now;
    if (remaining <= 0) { onPhaseZero(); return; }
    paint(remaining, phase.totalMs > 0 ? remaining / phase.totalMs : 0);
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
  Sounds.unlock();
  if (mode === 'countdown' || mode === 'transition') {
    phase.totalMs = getConfiguredMs(mode);
    if (phase.totalMs <= 0) return;
    phase.endAt = Date.now() + phase.totalMs;
  } else if (mode === 'roundrobin') {
    phase.stations = prefs.roundrobin.stations;
    phase.loop = prefs.roundrobin.loop;
    phase.station = 1;
    phase.totalMs = getConfiguredMs('roundrobin');
    if (phase.totalMs <= 0) return;
    phase.endAt = Date.now() + phase.totalMs;
    updateSubDisplay(`Station 1 of ${phase.stations}`);
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
  if (COUNTDOWN_LIKE.has(mode)) {
    phase.remainingAtPause = phase.endAt - Date.now();
  } else {
    phase.elapsedBase = (phase.elapsedBase || 0) + (Date.now() - phase.startAt);
  }
  setButtonsPaused();
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

function initSoundPanel() {
  els.soundChoice.value = prefs.sound.choice;
  els.soundVolume.value = prefs.sound.volume;
  els.soundMute.checked = prefs.sound.muted;
  els.soundChoice.addEventListener('change', () => {
    prefs = save({ sound: { ...prefs.sound, choice: els.soundChoice.value } });
  });
  els.soundVolume.addEventListener('input', () => {
    prefs = save({ sound: { ...prefs.sound, volume: Number(els.soundVolume.value) } });
  });
  els.soundMute.addEventListener('change', () => {
    prefs = save({ sound: { ...prefs.sound, muted: els.soundMute.checked } });
  });
  els.soundTest.addEventListener('click', () => {
    Sounds.unlock();
    Sounds.play(prefs.sound.choice, effectiveVolume());
  });
}

function initControls() {
  els.startBtn.addEventListener('click', onStart);
  els.pauseBtn.addEventListener('click', onPause);
  els.resumeBtn.addEventListener('click', onResume);
  els.resetBtn.addEventListener('click', onReset);

  window.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    e.preventDefault();
    if (phase.status === 'running') onPause();
    else if (phase.status === 'paused') onResume();
    else onStart();
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
  els.soundChoice = q('soundChoice');
  els.soundVolume = q('soundVolume');
  els.soundMute = q('soundMute');
  els.soundTest = q('soundTest');
}

function init() {
  cacheEls();
  els.ringFg.style.strokeDasharray = String(RING_C);
  initTabs();
  initCountdownPanel();
  initTransitionPanel();
  initRandomPanel();
  initStopwatchPanel();
  initRoundrobinPanel();
  initSoundPanel();
  initControls();
  resetPhaseForMode();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
