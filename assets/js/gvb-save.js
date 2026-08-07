// gvb-save.js — the site's shared save-slot module.
//
// One localStorage key, one shape: create a slot with a game/key/version and a
// validate/repair (and, when the on-disk shape has changed before, a migrate),
// and the slot handles read, write, export/import and the "storage is blocked
// entirely" case the same way everywhere it is used.
//
// Two consumers, two different needs, both served by the same functions:
//   Tools/name-picker/np-store.js    thirteen keys, each its own slot, boxed so
//                                    gvb-save's version stamp never touches disk.
//   Tools/seating-chart/seating.mjs  one slot, one key, the version stamp is
//                                    written straight through.
//
// validate() is the coarse gate — is this a save file at all, or somebody else's
// JSON. repair() is where every fill-in and coercion lives, and it runs on every
// load that passes validate, including a save this build just wrote, because
// "was true when it was written" and "still true when it was read" are not the
// same claim. A load that fails validate is refused outright: null, not a half
// repaired guess.
//
// createSaveSlot() does NOT protect its own default storage lookup — with no
// `storage` option it falls back to a bare `typeof localStorage`, which throws
// in a browser that blocks storage instead of failing safe. That is intentional:
// it is the reason every real caller on this site passes `storage: defaultStorage()`
// explicitly rather than leaving it to this module to work out. `defaultStorage()`
// is the guarded version — probe with a write, hand back a memory stub if
// anything throws — and it is the one callers should reach for.

function memoryFallback() {
  const mem = new Map();
  const store = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: k => { mem.delete(k); },
  };
  Object.defineProperty(store, '__memoryOnly', { value: true, enumerable: true });
  return store;
}

/** Guarded default storage: a real write probe, a memory stub if anything throws. */
export function defaultStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return memoryFallback();
    const probe = '__gvb_save_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch (e) {
    return memoryFallback();
  }
}

const isPlainObject = v => !!v && typeof v === 'object' && !Array.isArray(v);

function storedVersionOf(parsed) {
  return isPlainObject(parsed) && typeof parsed.__v === 'number' ? parsed.__v : 0;
}

/**
 * migrate (if the stored version is behind) then validate then, only when
 * validate passes, repair. A state that fails validate is refused outright
 * rather than handed to repair — repair fills in fields on data that is
 * recognizably a save; it is not the place to make sense of a stranger's JSON.
 */
function finalize(state, fromVersion, { version, migrate, validate, repair }) {
  let s = state;
  if (typeof migrate === 'function' && fromVersion < version) {
    try { s = migrate(s, fromVersion); } catch (e) { return null; }
  }
  let ok = false;
  try { ok = typeof validate === 'function' ? !!validate(s) : true; } catch (e) { ok = false; }
  if (!ok) return null;
  if (typeof repair === 'function') {
    try { s = repair(s); } catch (e) { return null; }
  }
  return s;
}

/**
 * One save slot: one key, one version, one validate/repair pair.
 *
 * `storage` should almost always be passed explicitly — see the module note
 * above. Everything else mirrors the shape callers already build: `defaults` is
 * a factory (so every fresh state gets its own ids), `migrate(state, fromVersion)`
 * is optional and only runs when the stored version is behind, `validate(state)`
 * decides whether the load is usable at all, and `repair(state)` normalizes it.
 */
export function createSaveSlot({ game, key, version, storage, defaults, validate, migrate, repair } = {}) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : memoryFallback());
  const fresh = () => (typeof defaults === 'function' ? defaults() : (defaults ?? null));

  function readRaw() {
    let text;
    try { text = store.getItem(key); } catch (e) { return null; }
    if (text === null || text === undefined) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  /** The repaired, validated state on disk, or null — never throws, never guesses. */
  function load() {
    const parsed = readRaw();
    if (parsed === null) return null;
    return finalize(parsed, storedVersionOf(parsed), { version, migrate, validate, repair });
  }

  /** Writes `state` with the slot's version stamped in. Returns whether it stuck. */
  function save(state) {
    try {
      store.setItem(key, JSON.stringify({ ...state, __v: version }));
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Clears the key and hands back a brand-new default state. */
  function reset() {
    try { store.removeItem(key); } catch (e) { /* nothing to undo */ }
    return fresh();
  }

  /** A shareable export: the envelope this whole site's save files use. */
  function serialize(state) {
    return JSON.stringify({
      format: 'gvb-save',
      game,
      version,
      savedAt: new Date().toISOString(),
      state,
    });
  }

  /**
   * The inverse of serialize(), and also the door old, envelope-less save files
   * (whatever a build before this one wrote to disk) come back in through: no
   * `format` field reads as a bare legacy state at version 0, so `migrate` gets
   * the whole file. Refuses anything unparsable, anything that is not a plain
   * object, a modern envelope for a different game, or a state that fails
   * validate even after migrating.
   */
  function deserialize(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { return null; }
    if (!isPlainObject(parsed)) return null;

    let state, fromVersion;
    if (parsed.format !== undefined) {
      if (parsed.format !== 'gvb-save' || parsed.game !== game) return null;
      state = parsed.state;
      fromVersion = typeof parsed.version === 'number' ? parsed.version : 0;
    } else {
      state = parsed;
      fromVersion = 0;
    }
    return finalize(state, fromVersion, { version, migrate, validate, repair });
  }

  /** Runs `save(getState())` `delay`ms after the last mark(), coalescing bursts. */
  function autosave(getState, delay = 1000) {
    let timer = null;
    function flush() { timer = null; save(getState()); }
    function mark() { if (timer) clearTimeout(timer); timer = setTimeout(flush, delay); }
    function stop() { if (timer) { clearTimeout(timer); timer = null; } }
    return { mark, stop };
  }

  return {
    game, key, version,
    load, save, reset, fresh, serialize, deserialize, autosave,
    get memoryOnly() { try { return !!store.__memoryOnly; } catch (e) { return true; } },
  };
}

/**
 * A small export/import/erase toolbar wired to one save slot. Renders one
 * `<button data-gvb="...">` per entry in `opts.buttons` (any of "export",
 * "import", "reset") into `container`, and nothing else — labels, styling and
 * confirmation copy belong to the page, which is why callers on this site
 * relabel the buttons right after mounting.
 *
 * `opts.getState()` / `opts.setState(next)` are how the bar reads and writes the
 * page's live state; `opts.onMessage(text)` is how it reports back ("Saved to
 * file.", "That file is not a valid <game> file.", …) so the page can show it
 * however it likes.
 */
export function mountSaveBar(container, slot, opts = {}) {
  const buttons = opts.buttons || ['export', 'import', 'reset'];
  const getState = opts.getState || (() => null);
  const setState = opts.setState || (() => {});
  const onMessage = opts.onMessage || (() => {});
  const LABELS = { export: 'Export', import: 'Import', reset: 'Reset' };

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.hidden = true;
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    let text;
    try { text = await file.text(); }
    catch (e) { onMessage('Could not read that file.'); return; }
    const imported = slot.deserialize(text);
    if (imported === null) {
      onMessage(`That file is not a valid ${slot.game || 'save'} file.`);
      return;
    }
    slot.save(imported);
    setState(imported);
    onMessage('Loaded from file.');
  });
  container.appendChild(fileInput);

  const nodes = {};
  for (const kind of buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.gvb = kind;
    btn.textContent = LABELS[kind] || kind;
    container.appendChild(btn);
    nodes[kind] = btn;

    if (kind === 'export') {
      btn.addEventListener('click', () => {
        const text = slot.serialize(getState());
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `${slot.game}-save-${today}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        onMessage('Saved to file.');
      });
    } else if (kind === 'import') {
      btn.addEventListener('click', () => fileInput.click());
    } else if (kind === 'reset') {
      btn.addEventListener('click', () => {
        if (!confirm('Erase everything saved in this browser? This cannot be undone.')) return;
        setState(slot.reset());
        onMessage('Erased.');
      });
    }
  }

  return {
    nodes,
    destroy() { for (const k in nodes) nodes[k].remove(); fileInput.remove(); },
  };
}

export default { createSaveSlot, defaultStorage, mountSaveBar };
