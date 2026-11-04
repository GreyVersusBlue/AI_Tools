// sv-onboarding.js — the School Layout Visualizer's welcome and Help dialogs: the welcome
// dialog shown on first load until it is dismissed (`stviz_onboarded`), the Help dialog behind
// the header's Help button, and the backdrop and Escape dismissal of both. Moved out of the page's
// classic script as a view module (rank 140, the ninth increment): the body is the page's, line for
// line, with `export` on the function and ONBOARDING_KEY brought with it (nothing else read it).
// openModal() and closeModal() stay on the page, since its other dialogs and sv-editor.js use them;
// this file reaches them by bare name at call time, as sv-apply.js reaches the page's functions.
//
// The page's module script copies the export onto window; the page's init() (on DOMContentLoaded,
// after the module has run) calls initOnboardingAndHelp() by bare name, as it always did.
//
// Its browser check is test/smoke-onboarding.mjs.

/* global openModal, closeModal -- 035's page helpers, read at call time */

/* ==============================================
   ROUND 11 — ONBOARDING & HELP MODALS
=============================================== */
const ONBOARDING_KEY = 'stviz_onboarded';

export function initOnboardingAndHelp() {
  // Onboarding — shown on first load unless the user dismissed it.
  let onboarded = false;
  try { onboarded = localStorage.getItem(ONBOARDING_KEY) === '1'; } catch { onboarded = false; }
  if (!onboarded) {
    setTimeout(() => openModal('onboarding-modal'), 350);
  }

  const persistDismiss = () => {
    // The welcome dialog only auto-shows on first load, so any dismissal
    // records it. The checkbox is an explicit reassurance for the user.
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
  };

  document.getElementById('onboarding-start')?.addEventListener('click', () => {
    persistDismiss(); closeModal('onboarding-modal');
  });
  document.getElementById('onboarding-x')?.addEventListener('click', () => {
    persistDismiss(); closeModal('onboarding-modal');
  });

  // Help — opened from the header button, available any time.
  document.getElementById('btn-open-help')?.addEventListener('click', () => openModal('help-modal'));
  document.getElementById('help-x')?.addEventListener('click', () => closeModal('help-modal'));
  document.getElementById('help-done')?.addEventListener('click', () => closeModal('help-modal'));

  // Dismiss on overlay backdrop click + Escape key.
  ['onboarding-modal', 'help-modal'].forEach(id => {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) {
        if (id === 'onboarding-modal') persistDismiss();
        closeModal(id);
      }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    ['onboarding-modal', 'help-modal'].forEach(id => {
      const overlay = document.getElementById(id);
      if (overlay && overlay.classList.contains('open')) {
        if (id === 'onboarding-modal') persistDismiss();
        closeModal(id);
      }
    });
  });
}
