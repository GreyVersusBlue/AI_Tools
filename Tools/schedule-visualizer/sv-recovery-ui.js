// sv-recovery-ui.js — the School Layout Visualizer's recovery manager: the page side of the
// recovery ring in sv-recovery.js (when to capture a point, the crash and unreadable-save banner,
// restore, and the Settings tab's recovery list). Moved out of the page's classic script as a view
// module (rank 140, the eighth increment): the body is unchanged, line for line, apart from the
// `export`s, and one fix since (AI-66: restore() reads the point before its forced capture, so the
// oldest of three can be restored). sv-recovery.js stays the storage half (IndexedDB, the session flag) and knows nothing
// of the page; this file reaches the ring through `window.SVRecovery`, as it always did, and
// reaches the page's functions and `let`s by bare name at call time, as sv-apply.js does.
//
// The page's module script imports this beside sv-recovery.js and copies the exports onto window
// before it fires `sv-recovery-ready`, so `RecoveryManager` is on window exactly when the ring is:
// the page's init() calls RecoveryManager.init() then, the autosave calls
// window.RecoveryManager.markDirty(), and the import and clear paths call capture() through window.
//
// Its browser check is test/smoke-recovery-ui.mjs; the ring itself is test/smoke-recovery.mjs.

/* global serializeFullProject, applyFullProject, roomRegistry, AppState, getBlueprintLoadStatus, escHtml, showToast -- 035's page globals, read at call time */

/* ==============================================
   AUTOMATIC RECOVERY POINTS (crash recovery)

   The blueprint autosave answers "I closed the tab". This answers the rest:
   an autosaved payload that comes back unreadable, a quota failure that meant
   the last stretch of work never landed, a destructive action, or a browser
   that simply died. sv-recovery.js keeps three generations of the FULL
   project (blueprint + groups + settings + what-if) in IndexedDB — deliberately
   not localStorage, where a traced floor plan times three would compete with
   the live autosave for the same ~5MB (P12).

   Capture points: every RECOVERY_INTERVAL_MS while there have been changes,
   on pagehide, and immediately before an import replaces everything.
=============================================== */
export const RECOVERY_INTERVAL_MS = 5 * 60 * 1000;

export const RecoveryManager = {
  _dirty: false,
  _timer: null,
  _capturing: false,
  _prevSession: null,

  /** True once sv-recovery.js has been evaluated (it's a deferred module). */
  get api() { return window.SVRecovery || null; },

  init() {
    const api = this.api;
    if (!api) return;                       // module blocked — live autosave is untouched
    this._prevSession = api.markSessionOpen();

    // pagehide covers tab close, navigation and (on mobile) the app being
    // backgrounded; visibilitychange catches the switch-away that often
    // precedes a machine going to sleep and never waking as the same session.
    window.addEventListener('pagehide', () => {
      this.capture('leaving');
      api.markSessionClosed();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.capture('leaving');
    });

    this._timer = setInterval(() => this.capture('periodic'), RECOVERY_INTERVAL_MS);

    this.renderList();
    this.offerIfNeeded();
  },

  /** Called from the autosave funnel, so "changed" means exactly what it does
   *  for the blueprint autosave. */
  markDirty() { this._dirty = true; },

  /**
   * Writes one recovery point. `force` skips the dirty check (used before a
   * destructive action, where the point is the whole reason for capturing).
   */
  capture(reason, force) {
    const api = this.api;
    if (!api) return Promise.resolve(null);
    if (!force && !this._dirty) return Promise.resolve(null);
    if (this._capturing) return Promise.resolve(null);
    let payload;
    // Portable: a recovery point is the copy of last resort, so it carries the
    // trace images themselves rather than references into another store.
    try { payload = serializeFullProject({ portable: true }); }
    catch (e) { return Promise.resolve(null); }   // never let this break an edit
    this._capturing = true;
    this._dirty = false;
    return api.putPoint(payload, {
      reason: reason || 'periodic',
      rooms: roomRegistry.length,
      groups: AppState.schedules.groups.length,
      floors: (AppState.blueprint.floors && AppState.blueprint.floors.length) || 1,
    }).then(rec => {
      this._capturing = false;
      if (rec) this.renderList();
      return rec;
    }).catch(() => { this._capturing = false; return null; });
  },

  /**
   * Decides whether to put a recovery offer in front of the teacher, and says
   * plainly which of the two reasons it is. Anything else stays quiet — the
   * recovery list in Settings is always there for a deliberate rollback.
   */
  offerIfNeeded() {
    const api = this.api;
    if (!api) return;
    const crashed = !!this._prevSession;
    const corrupt = getBlueprintLoadStatus() === 'corrupt';
    if (!crashed && !corrupt) return;
    api.listPointHeaders().then(points => {
      if (!points.length) {
        if (corrupt) {
          this.showBanner('The layout saved in this browser could not be read, and there is no recovery point to fall back on. ' +
            'The unreadable copy has been set aside rather than overwritten. Import your last exported project file if you have one.', null);
        }
        return;
      }
      const newest = points[0];
      const when = formatRecoveryTime(newest.savedAt);
      this.showBanner(corrupt
        ? 'The layout saved in this browser could not be read. A recovery point from ' + when +
          ' is available (' + newest.rooms + ' room' + (newest.rooms !== 1 ? 's' : '') + ', ' +
          newest.groups + ' group' + (newest.groups !== 1 ? 's' : '') + ').'
        : 'This project wasn’t closed cleanly last time. If anything looks missing, a recovery point from ' + when +
          ' is available (' + newest.rooms + ' room' + (newest.rooms !== 1 ? 's' : '') + ', ' +
          newest.groups + ' group' + (newest.groups !== 1 ? 's' : '') + ').',
        newest.id);
    });
  },

  showBanner(message, restoreId) {
    let el = document.getElementById('stviz-recovery-offer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'stviz-recovery-offer';
      el.setAttribute('role', 'alert');
      document.body.appendChild(el);
    }
    el.className = 'stviz-recovery-banner';
    el.innerHTML = '<span>' + escHtml(message) + '</span><span class="banner-actions">' +
      (restoreId ? '<button type="button" class="primary" id="stviz-recovery-restore">Restore it</button>' : '') +
      '<button type="button" id="stviz-recovery-dismiss">Dismiss</button></span>';
    el.style.display = 'flex';
    const dismiss = () => { el.style.display = 'none'; };
    document.getElementById('stviz-recovery-dismiss').addEventListener('click', dismiss);
    if (restoreId) {
      document.getElementById('stviz-recovery-restore').addEventListener('click', () => {
        this.restore(restoreId).then(ok => { if (ok) dismiss(); });
      });
    }
  },

  /**
   * Restores a recovery point over the current project. Captures the state
   * being replaced first (forced), so "restore" is itself undoable — the
   * whole point of this feature is that nothing disappears silently.
   *
   * The point is read BEFORE that capture (AI-66): the ring holds MAX_POINTS, so the capture
   * trims the oldest point, and when that is the one being restored it used to be gone by the
   * time it was read ("could not be read"). Read first, it is in memory when the ring drops it.
   * A point that cannot be read now captures nothing, since nothing is replaced (it used to
   * capture anyway, and so trim another point for no reason).
   */
  restore(id) {
    const api = this.api;
    if (!api) return Promise.resolve(false);
    let point;
    return api.getPoint(id)
      .then(p => {
        point = p;
        if (!point || !point.data) return null;
        return this.capture('before restore', true);
      })
      .then(() => {
        if (!point || !point.data) { showToast('That recovery point could not be read.', 'error'); return false; }
        try {
          const res = applyFullProject(point.data);
          showToast('Recovered the project from ' + formatRecoveryTime(point.savedAt) +
            ' (' + res.rooms + ' room' + (res.rooms !== 1 ? 's' : '') + ', ' +
            res.groups + ' group' + (res.groups !== 1 ? 's' : '') + ').', 'success');
          this.renderList();
          return true;
        } catch (e) {
          showToast('Recovery failed: ' + e.message, 'error');
          return false;
        }
      });
  },

  renderList() {
    const listEl = document.getElementById('recovery-list');
    if (!listEl) return;
    const api = this.api;
    if (!api) {
      listEl.innerHTML = '<div class="recovery-empty">Recovery points are unavailable in this browser.</div>';
      return;
    }
    api.listPointHeaders().then(points => {
      if (!points.length) {
        listEl.innerHTML = '<div class="recovery-empty">No recovery points yet — the first one is taken a few minutes into editing.</div>';
        return;
      }
      listEl.innerHTML = points.map(p => `<div class="snapshot-item auto">
        <span class="snapshot-item-icon">
          <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/></svg>
        </span>
        <div class="snapshot-item-info">
          <div class="snapshot-item-name">${escHtml(formatRecoveryTime(p.savedAt))} · ${escHtml(p.reason)}</div>
          <div class="snapshot-item-ts">${p.rooms} room${p.rooms !== 1 ? 's' : ''} · ${p.groups} group${p.groups !== 1 ? 's' : ''} · ${(p.sizeBytes / 1024).toFixed(1)} KB</div>
        </div>
        <div class="snapshot-item-actions">
          <button class="snapshot-action-btn restore" data-recovery-restore="${escHtml(p.id)}">Restore</button>
        </div>
      </div>`).join('');
      listEl.querySelectorAll('[data-recovery-restore]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!confirm('Restore this recovery point? The project as it stands now is captured as a recovery point first, so this can be undone.')) return;
          this.restore(btn.dataset.recoveryRestore);
        });
      });
    });
  },
};


export function formatRecoveryTime(iso) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return sameDay ? time : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + time;
  } catch (e) { return String(iso); }
}
