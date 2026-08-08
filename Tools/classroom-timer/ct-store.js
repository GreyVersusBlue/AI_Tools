// ct-store.js — Classroom Timer preferences, one localStorage key ('ct_prefs').
// Guarded read/write so a corrupt or missing value never throws; callers always
// get a fully-shaped object back.

const KEY = 'ct_prefs';
// Separate key from KEY: this is a snapshot of an in-progress `phase` object,
// not a preference, and its shape varies per mode — sanitize() above assumes
// a fixed schema, so this gets its own guarded, unvalidated read/write.
const RUNNING_KEY = 'ct_running_v1';
const TABS = ['countdown', 'transition', 'random', 'stopwatch', 'roundrobin'];
const SOUNDS = ['chime', 'bell', 'buzzer', 'none'];

export const MAX_CUSTOM_PRESETS = 12;

const DEFAULTS = {
  v: 1,
  activeTab: 'countdown',
  countdown: { minutes: 5, seconds: 0 },
  transition: { minutes: 2, seconds: 0 },
  random: { minMinutes: 3, maxMinutes: 8 },
  roundrobin: { minutes: 2, seconds: 0, stations: 5, loop: false },
  sound: { choice: 'chime', volume: 0.7, muted: false },
  customPresets: []
};

function clamp(n, lo, hi, fallback) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

function sanitize(raw) {
  const out = JSON.parse(JSON.stringify(DEFAULTS));
  if (!raw || typeof raw !== 'object') return out;

  if (TABS.includes(raw.activeTab)) out.activeTab = raw.activeTab;

  if (raw.countdown && typeof raw.countdown === 'object') {
    out.countdown.minutes = clamp(raw.countdown.minutes, 0, 180, out.countdown.minutes);
    out.countdown.seconds = clamp(raw.countdown.seconds, 0, 59, out.countdown.seconds);
  }
  if (raw.transition && typeof raw.transition === 'object') {
    out.transition.minutes = clamp(raw.transition.minutes, 0, 60, out.transition.minutes);
    out.transition.seconds = clamp(raw.transition.seconds, 0, 59, out.transition.seconds);
  }
  if (raw.random && typeof raw.random === 'object') {
    out.random.minMinutes = clamp(raw.random.minMinutes, 0, 120, out.random.minMinutes);
    out.random.maxMinutes = clamp(raw.random.maxMinutes, 0, 120, out.random.maxMinutes);
    if (out.random.maxMinutes < out.random.minMinutes) {
      const t = out.random.maxMinutes; out.random.maxMinutes = out.random.minMinutes; out.random.minMinutes = t;
    }
  }
  if (raw.roundrobin && typeof raw.roundrobin === 'object') {
    out.roundrobin.minutes = clamp(raw.roundrobin.minutes, 0, 60, out.roundrobin.minutes);
    out.roundrobin.seconds = clamp(raw.roundrobin.seconds, 0, 59, out.roundrobin.seconds);
    out.roundrobin.stations = clamp(raw.roundrobin.stations, 2, 20, out.roundrobin.stations);
    out.roundrobin.loop = !!raw.roundrobin.loop;
  }
  if (raw.sound && typeof raw.sound === 'object') {
    if (SOUNDS.includes(raw.sound.choice)) out.sound.choice = raw.sound.choice;
    out.sound.volume = clamp(raw.sound.volume, 0, 1, out.sound.volume);
    out.sound.muted = !!raw.sound.muted;
  }
  if (Array.isArray(raw.customPresets)) {
    out.customPresets = raw.customPresets
      .filter(p => p && typeof p === 'object')
      .map(p => ({
        name: String(p.name || '').trim().slice(0, 40),
        minutes: clamp(p.minutes, 0, 180, 0),
        seconds: clamp(p.seconds, 0, 59, 0)
      }))
      .filter(p => p.name && (p.minutes > 0 || p.seconds > 0))
      .slice(0, MAX_CUSTOM_PRESETS);
  }
  return out;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return sanitize(null);
  }
}

/** Shallow-merges `patch` into the stored prefs and writes the result back. */
export function save(patch) {
  const current = load();
  const next = sanitize({ ...current, ...patch });
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* storage full/blocked */ }
  return next;
}

/** A running/paused timer snapshot ({mode, phase}), or null if there isn't
    one worth resuming — nothing saved, corrupt JSON, or a phase that was
    idle/done when it was last written. */
export function loadRunning() {
  try {
    const raw = localStorage.getItem(RUNNING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!TABS.includes(parsed.mode)) return null;
    if (!parsed.phase || (parsed.phase.status !== 'running' && parsed.phase.status !== 'paused')) return null;
    return parsed;
  } catch (e) { return null; }
}

export function saveRunning(mode, phase) {
  try { localStorage.setItem(RUNNING_KEY, JSON.stringify({ mode, phase })); } catch (e) { /* storage full/blocked */ }
}

export function clearRunning() {
  try { localStorage.removeItem(RUNNING_KEY); } catch (e) { /* ignore */ }
}

export default { load, save, loadRunning, saveRunning, clearRunning, DEFAULTS, TABS, SOUNDS, MAX_CUSTOM_PRESETS };
