// sv-presentation.js — the School Layout Visualizer's presentation-mode glue: the Present and
// Exit buttons, the auto-cycle play and interval controls, the observer that keeps the mirrored
// legend fresh, and the P / Escape keys. Moved out of the page's classic script as a view module
// (rank 140, the tenth increment): the body is the page's, line for line, with `export` on the
// function. The `PresentationMode` object (enter, exit, toggle, the cycle timer, syncLegend)
// stays on the page; this file reaches it, and AppState, by bare name at call time, as
// sv-onboarding.js and sv-apply.js reach the page.
//
// The page's module script copies the export onto window; the page's init() (on DOMContentLoaded,
// after the module has run) calls initPresentationMode() by bare name, as it always did.
//
// Its browser check is test/smoke-presentation.mjs.

/* global PresentationMode, AppState -- 035's page objects, read at call time */

/* ==============================================
   PRESENTATION MODE — the wiring (R58)
=============================================== */
export function initPresentationMode() {
  document.getElementById('viz-present-btn')?.addEventListener('click', () => PresentationMode.enter());
  document.getElementById('pres-exit')?.addEventListener('click', () => PresentationMode.exit());
  document.getElementById('pres-cycle-play')?.addEventListener('click', () => {
    PresentationMode._cycleTimer ? PresentationMode._stopCycle() : PresentationMode._startCycle();
  });
  // Changing the interval while cycling restarts the timer at the new pace.
  document.getElementById('pres-cycle-interval')?.addEventListener('change', () => {
    if (PresentationMode._cycleTimer) PresentationMode._startCycle();
  });

  // Keep the mirrored legend fresh — renderVizLegend rewrites #viz-legend-list,
  // so observe it rather than threading a hook through the renderer.
  const legendSrc = document.getElementById('viz-legend-list');
  if (legendSrc && window.MutationObserver) {
    new MutationObserver(() => PresentationMode.syncLegend())
      .observe(legendSrc, { childList: true, subtree: true });
  }

  // Keyboard: P toggles (Visualize tab, not in a field); Esc exits.
  document.addEventListener('keydown', (e) => {
    if (AppState.ui.activeTab !== 'visualize') return;
    if (e.key === 'Escape') { if (PresentationMode.active) PresentationMode.exit(); return; }
    const t = e.target;
    const tag = (t && t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      PresentationMode.toggle();
    }
  });
}
