// sv-browser.js — the School Layout Visualizer's embedded Schedule Browser
// and its publisher: BR_CSS, the data derivation, the search menu, the
// teacher, group and map views, the geometry map, and brPublish(), which
// builds the standalone read-only file staff are emailed.
//
// Path 11 P2 increment 7 (BACKLOG.md, "Path 11", the P2 bullet). Moved
// verbatim from 035's second classic script (the "ROUND 41: SCHEDULE BROWSER
// JS" block) as one module (Devon, P11-10): not a character of any function
// changed, because the publisher .toString()s 35 of them into the published
// file. npm run check:publisher reads this file (it follows the page's module
// imports) and test:schedule-publish holds the published bytes to the
// committed baseline. Unlike the other sv-*.js modules this one is not pure:
// it is a view, it owns the #app-browser DOM, and at call time it reads the
// seven names the first global comment below lists from 035's classic script (a
// module sees a classic script's top-level declarations). The page's module
// script copies every export onto window, which is the global surface the
// classic script had (the markup's and the views' onclick="br…()" handlers,
// toggleApp, the suites' window.brBuildPublishedHTML()); the let state
// (BR_TEACHERS, brMode, …) is not exported, since a copy on window would go
// stale, and nothing outside this file reads it.
//
// Its top level still runs once at load: it injects BR_CSS as <style
// id="br-style"> and wires the document click and the tab keys. As a module
// that is after the page is parsed and before DOMContentLoaded.

/* global AppState, getSubjects, formatModTime, escHtml, escJsAttr, TOOL_VERSION, showToast -- 035's classic-script globals, read at call time */

/* ===== ROUND 41: SCHEDULE BROWSER JS ===== */

/* R60: single-source stylesheet — used by the live embedded browser (injected
   below) and copied verbatim into published standalone files by brPublish(). */
const BR_CSS = `#app-browser {
  display:none; /* shown by toggleApp() */
  font-family:'Public Sans',system-ui,sans-serif;
  color:var(--br-ink); margin:0; padding:30px 18px 90px; font-size:16px; line-height:1.5;
  background:var(--br-page);
  min-height:100vh; box-sizing:border-box;
}

/* ── The palette, named twice (Path 5 P4) ─────────────────────────────────
   Every colour this browser paints is declared here as a a -light and a
   -dark value, and the blocks below only re-point the semantic token at
   one of them. No value is written down twice, so the two themes cannot
   drift; _shared/ink-paper.css uses the same -light idiom for the same
   reason. Declared on :root rather than on #app-browser because the
   published page's own <body> reads --br-page.

   --br-forest is the FILL and --br-forest-ink the INK. They were one token
   until this round — ten background uses against 24 colour and border ones
   — which is why no single dark value could exist: a green dark enough to
   carry white text is far too dark to BE text on a dark card.

   Contrast, measured on the dark values: every text pair is 4.85:1 or better
   (worst is the placeholder on a card), and ink / muted / forest-ink clear
   6.3:1 on all four dark surfaces. --br-gold-soft is the control border and
   clears WCAG 1.4.11's 3:1 in dark (3.48:1 on a card); light's #d9ca98 is
   1.63:1 and does not — the same asymmetry ink-paper.css records for
   --line-strong, and the same open backlog row, not something this round
   introduced. */
:root {
  --br-forest-light:#0c4b31;     --br-forest-dark:#12563a;
  --br-forest-ink-light:#0c4b31; --br-forest-ink-dark:#79cfa2;
  --br-forest-2-light:#155f3e;   --br-forest-2-dark:#1a7049;
  --br-gold-soft-light:#d9ca98;  --br-gold-soft-dark:#7a7355;
  --br-gold-line-light:#ece2c5;  --br-gold-line-dark:#3a3729;
  --br-cream-light:#fcfaf2;      --br-cream-dark:#222923;
  --br-paper-light:#f6f8f5;      --br-paper-dark:#272f28;
  --br-card-light:#fff;          --br-card-dark:#1a201c;
  --br-ink-light:#283831;        --br-ink-dark:#e7ece7;
  --br-muted-light:#62756a;      --br-muted-dark:#a3b4a7;
  --br-line-light:#e8eee9;       --br-line-dark:#2e372f;
  --br-placeholder-light:#9aa89f;--br-placeholder-dark:#7e8f83;
  --br-plan-ink-light:#9a8430;   --br-plan-ink-dark:#d9bb63;
  --br-plan-bg-light:#fdfaef;    --br-plan-bg-dark:#2a2718;
  --br-note-bg-light:#fffdf4;    --br-note-bg-dark:#2a2718;
  --br-common-bg-light:#fdf3d9;  --br-common-bg-dark:#2f2a16;
  --br-common-ink-light:#9a7415; --br-common-ink-dark:#e0b95e;
  --br-warn-bg-light:#fbe4c8;    --br-warn-bg-dark:#3a2412;
  --br-warn-ink-light:#7a3c0e;   --br-warn-ink-dark:#f0c08a;
  --br-alert-ink-light:#9a5b2a;  --br-alert-ink-dark:#e8a06b;
  --br-page-light:linear-gradient(180deg,#eef3ee 0%,#f4f7f4 240px,#f4f7f4 100%);
  --br-page-dark:#121713;
  --br-focus-ring-light:0 0 0 3px rgba(12,75,49,.13);
  --br-focus-ring-dark:0 0 0 3px rgba(121,207,162,.28);

  --br-forest:var(--br-forest-light);
  --br-forest-ink:var(--br-forest-ink-light);
  --br-forest-2:var(--br-forest-2-light);
  --br-gold-soft:var(--br-gold-soft-light);
  --br-gold-line:var(--br-gold-line-light);
  --br-cream:var(--br-cream-light);
  --br-paper:var(--br-paper-light);
  --br-card:var(--br-card-light);
  --br-ink:var(--br-ink-light);
  --br-muted:var(--br-muted-light);
  --br-line:var(--br-line-light);
  --br-placeholder:var(--br-placeholder-light);
  --br-plan-ink:var(--br-plan-ink-light);
  --br-plan-bg:var(--br-plan-bg-light);
  --br-note-bg:var(--br-note-bg-light);
  --br-common-bg:var(--br-common-bg-light);
  --br-common-ink:var(--br-common-ink-light);
  --br-warn-bg:var(--br-warn-bg-light);
  --br-warn-ink:var(--br-warn-ink-light);
  --br-alert-ink:var(--br-alert-ink-light);
  --br-page:var(--br-page-light);
  --br-focus-ring:var(--br-focus-ring-light);

  /* Fixed in both themes. The mast and the seal are a dark green card with
     white type either way; the five department hues are DATA, read out of
     the published file by brDColor(), and are handled by brDeptInk() and
     .dcink below rather than here. */
  --br-forest-deep:#08381f;
  --br-gold:#f3c63f;
  --br-warn-line:#c96a1f;
  --br-shadow:0 12px 34px -16px rgba(8,56,31,.30);
  --br-ela:#2563eb; --br-math:#c2520f; --br-sci:#0d7c69; --br-ss:#7c3aa8; --br-scsi:#71641f;
}
#app-browser *{box-sizing:border-box}
#app-browser .br-wrap{max-width:1040px;margin:0 auto}
#app-browser .mast{
  background:linear-gradient(165deg,var(--br-forest) 0%,var(--br-forest-deep) 100%);
  color:#fff;border-radius:16px 16px 0 0;padding:30px 36px;
  display:flex;align-items:center;gap:16px;border-bottom:4px solid var(--br-gold);
}
#app-browser .mast .seal{width:50px;height:50px;border-radius:50%;flex:none;
  background:radial-gradient(circle at 36% 32%,var(--br-gold),#c9a426);
  display:grid;place-items:center;font-family:'Fraunces',serif;font-weight:600;color:var(--br-forest-deep);
  font-size:21px;box-shadow:inset 0 0 0 3px rgba(255,255,255,.25);}
#app-browser .mast h1{font-family:'Fraunces',serif;font-weight:600;margin:0;font-size:27px;line-height:1.05}
#app-browser .mast .sub{margin:4px 0 0;color:var(--br-gold);font-weight:600;font-size:12px;letter-spacing:2px;text-transform:uppercase}
#app-browser .mast{justify-content:flex-start}
#app-browser .br-back-btn{
  margin-left:auto;display:inline-flex;align-items:center;gap:7px;
  font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:700;
  color:var(--br-forest-deep);background:var(--br-gold);
  border:none;border-radius:9px;padding:9px 16px;cursor:pointer;
  letter-spacing:.3px;white-space:nowrap;flex-shrink:0;
  box-shadow:0 2px 8px rgba(0,0,0,.18);
  transition:background .18s,transform .12s,box-shadow .18s;
}
#app-browser .br-back-btn:hover{background:#f7d050;box-shadow:0 4px 14px rgba(0,0,0,.22);transform:translateY(-1px)}
#app-browser .br-back-btn:active{transform:translateY(0);box-shadow:0 1px 4px rgba(0,0,0,.18)}
#app-browser .panel{background:var(--br-card);border:1px solid var(--br-gold-soft);border-top:none;border-radius:0 0 16px 16px;box-shadow:var(--br-shadow)}
#app-browser .toolbar{padding:20px 30px;background:var(--br-cream);border-bottom:1px solid var(--br-gold-line);
  display:flex;flex-wrap:wrap;gap:14px 20px;align-items:flex-end}
#app-browser .mode{display:inline-flex;background:var(--br-card);border:1px solid var(--br-gold-soft);border-radius:11px;padding:3px}
#app-browser .mode button{font:inherit;font-weight:600;font-size:14px;border:none;background:none;color:var(--br-muted);
  padding:9px 18px;border-radius:8px;cursor:pointer;transition:.18s}
#app-browser .mode button.on{background:var(--br-forest);color:#fff}
#app-browser .br-field{display:flex;flex-direction:column;gap:6px;min-width:250px;flex:1}
#app-browser .br-field label{font-size:13px;font-weight:700;color:var(--br-forest-ink)}
#app-browser .searchbox{position:relative}
#app-browser .searchbox input{width:100%;font:inherit;font-size:16px;font-weight:500;padding:12px 15px;border-radius:10px;
  border:1px solid var(--br-gold-soft);background:var(--br-card);color:var(--br-forest-ink);outline:none;transition:.18s}
#app-browser .searchbox input::placeholder{color:var(--br-placeholder);font-weight:400}
#app-browser .searchbox input:focus{border-color:var(--br-forest-ink);box-shadow:var(--br-focus-ring)}
#app-browser .br-menu{position:absolute;z-index:9000;top:calc(100% + 6px);left:0;right:0;background:var(--br-card);
  border:1px solid var(--br-gold-soft);border-radius:12px;
  box-shadow:0 20px 46px -18px rgba(8,56,31,.45);max-height:min(60vh,360px);overflow:auto;display:none}
#app-browser .br-menu.show{display:block}
#app-browser .br-menu .grp{font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;
  color:var(--br-muted);padding:12px 16px 5px;position:sticky;top:0;background:var(--br-card)}
#app-browser .br-menu .opt{padding:11px 16px;cursor:pointer;display:flex;align-items:center;gap:11px;font-size:15.5px;font-weight:500}
#app-browser .br-menu .opt:hover,#app-browser .br-menu .opt.active{background:var(--br-paper)}
#app-browser .br-menu .opt .tag{font-size:12.5px;color:var(--br-muted);margin-left:auto}
#app-browser .br-dot{width:10px;height:10px;border-radius:50%;flex:none}
#app-browser .btn-print{font:inherit;font-weight:600;font-size:13.5px;border:1px solid var(--br-gold-soft);background:var(--br-card);
  color:var(--br-forest-ink);padding:11px 17px;border-radius:10px;cursor:pointer;transition:.18s}
#app-browser .btn-print:hover{background:var(--br-forest);color:#fff;border-color:var(--br-forest)}
/* ── Staleness banner (ported from 034-schedule-browser.html R62; see
   BACKLOG.md / HISTORY.md, Round 8) ── */
#app-browser .stale-banner{display:none;margin:0 0 16px;padding:14px 20px;border-radius:0 0 10px 10px;
  background:var(--br-warn-bg);border:2px solid var(--br-warn-line);border-top:none;color:var(--br-warn-ink);font-size:14.5px;font-weight:700;line-height:1.5;text-align:center}
#app-browser .stale-banner.show{display:block}
/* Path 11 P6: which file a published copy is showing, when it is not its own */
#app-browser .br-open-note{margin:0 0 16px;padding:12px 20px;border:1px solid var(--br-gold-line);border-radius:10px;
  background:var(--br-card);color:var(--br-forest-ink);font-size:14px;line-height:1.5;text-align:center}
#app-browser .br-open-note .lnk{font:inherit;font-weight:700;background:none;border:none;padding:0;margin-left:6px;
  color:var(--br-forest-ink);text-decoration:underline;cursor:pointer}
/* Path 11 P6: the Directions tab */
#app-browser .br-dir-pick{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:flex-end;margin:10px 0 16px}
#app-browser .br-dir-pick select{font:inherit;font-size:15px;padding:9px 12px;border:1px solid var(--br-gold-soft);border-radius:10px;
  background:var(--br-card);color:var(--br-ink);min-width:200px}
#app-browser .br-dir-sf{display:inline-flex;align-items:center;gap:8px;font-size:14.5px;font-weight:600;color:var(--br-ink);cursor:pointer;padding-bottom:10px}
#app-browser .br-dir-steps{margin:0 0 16px;padding-left:24px;font-size:15px;line-height:1.7;color:var(--br-ink)}
#app-browser .br-dir-none{font-size:15px;font-weight:700;color:var(--br-alert-ink);margin:4px 0 14px}
#app-browser .br-dir-map{margin:0 0 16px}
#app-browser .br-dir-map figcaption{font-weight:700;color:var(--br-forest-ink);margin:0 0 6px}
/* Path 11 P6: the Sub Plan tab */
#app-browser .br-cover-pick input,#app-browser .br-cover-pick select{font:inherit;font-size:15px;padding:9px 12px;border:1px solid var(--br-gold-soft);
  border-radius:10px;background:var(--br-card);color:var(--br-ink);min-width:160px}
#app-browser .br-cover-table{width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14.5px;color:var(--br-ink)}
#app-browser .br-cover-table th,#app-browser .br-cover-table td{text-align:left;vertical-align:top;padding:9px 10px;border-bottom:1px solid var(--br-line)}
#app-browser .br-cover-table th{font-size:12.5px;font-weight:700;color:var(--br-forest-ink)}
#app-browser .br-cover-table tr.plan td{color:var(--br-muted);font-style:italic;background:var(--br-plan-bg)}
#app-browser .br-cover-table input{font:inherit;font-size:14.5px;padding:7px 10px;border:1px solid var(--br-gold-soft);border-radius:8px;
  background:var(--br-card);color:var(--br-ink);width:100%;min-width:140px;box-sizing:border-box}
#app-browser .br-cover-acts{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 12px}
#app-browser .br-cover-text{width:100%;min-height:180px;box-sizing:border-box;font:13.5px/1.5 ui-monospace,monospace;padding:10px;
  border:1px solid var(--br-gold-soft);border-radius:10px;background:var(--br-card);color:var(--br-ink)}
@media print{#app-browser .br-cover-pick,#app-browser .br-cover-acts,#app-browser .br-cover-text,#app-browser .br-cover-say{display:none!important}
  #app-browser .br-cover-table input{border:none;border-bottom:1px solid #000;border-radius:0;padding:4px 0}}
#app-browser .stale-banner::before{content:"⚠ "}
#app-browser .stage{padding:34px 34px 30px}
#app-browser .br-empty{text-align:center;color:var(--br-muted);padding:40px 20px}
/* font-weight:600 is explicit so this matches the other nine Fraunces rules.
   It used to inherit 400, which no loaded face provided, so it silently
   resolved to a lighter weight than every other heading. One weight shipped
   instead of two. */
#app-browser .br-empty .big{font-family:'Fraunces',serif;font-weight:600;font-size:22px;color:var(--br-forest-ink);margin-bottom:8px}
#app-browser .br-view{display:none;animation:br-rise .4s ease-out}
#app-browser .br-view.show{display:block}
@keyframes br-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
#app-browser .idhead{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:8px}
#app-browser .idhead .ibadge{width:56px;height:56px;border-radius:13px;flex:none;display:grid;place-items:center;
  font-family:'Fraunces',serif;font-weight:600;font-size:23px;color:#fff}
#app-browser .idhead h2{font-family:'Fraunces',serif;font-weight:600;font-size:28px;margin:0;color:var(--br-forest-ink);line-height:1.05}
#app-browser .idhead .role{font-size:15px;font-weight:600;margin-top:3px}
#app-browser .factline{color:var(--br-muted);font-size:15px;margin:4px 0 28px}
#app-browser .factline b{color:var(--br-forest-ink);font-weight:600}
#app-browser .days{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:0 0 8px}
@media(max-width:720px){#app-browser .days{grid-template-columns:1fr}}
#app-browser .daycard{border:1px solid var(--br-line);border-radius:13px;overflow:hidden;background:var(--br-card)}
#app-browser .daycard h3{margin:0;font-family:'Public Sans';font-size:15px;font-weight:700;letter-spacing:.5px;
  padding:13px 18px;color:#fff;background:var(--br-forest)}
#app-browser .daycard.B h3{background:#4d5f3f}
#app-browser .blockrow{display:flex;align-items:center;border-top:1px solid var(--br-line);min-height:56px}
#app-browser .blockrow .bk{width:62px;flex:none;text-align:center;padding:10px 0;border-right:1px solid var(--br-line);color:var(--br-muted)}
#app-browser .blockrow .bk .n{font-family:'Fraunces',serif;font-weight:600;font-size:20px;color:var(--br-forest-ink);display:block;line-height:1}
#app-browser .blockrow .bk .t{font-size:10.5px;letter-spacing:.4px}
#app-browser .blockrow .cell{flex:1;padding:10px 18px}
#app-browser .blockrow .cell .sec{font-weight:700;font-size:18px;color:var(--br-ink)}
#app-browser .blockrow .cell .who{font-size:13px;color:var(--br-muted);margin-top:1px}
#app-browser .blockrow.plan .cell{color:var(--br-plan-ink);font-style:italic;font-weight:600;background:var(--br-plan-bg)}
#app-browser .block-title{font-family:'Fraunces',serif;font-size:19px;color:var(--br-forest-ink);margin:30px 0 4px;font-weight:600}
#app-browser .hint{color:var(--br-muted);font-size:14.5px;margin:0 0 14px}
#app-browser .classrow{display:flex;flex-wrap:wrap;gap:9px}
#app-browser .gchip{border:1px solid var(--br-gold-soft);background:var(--br-card);border-radius:10px;padding:9px 15px;cursor:pointer;
  font-weight:600;font-size:15.5px;color:var(--br-forest-ink);transition:.15s;font-family:inherit}
#app-browser .gchip:hover{background:var(--br-forest);color:#fff;border-color:var(--br-forest)}
#app-browser .team{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:13px;margin-top:4px}
#app-browser .tcard{border:1px solid var(--br-line);border-left:5px solid var(--br-forest-ink);border-radius:11px;padding:14px 16px;
  background:var(--br-card);cursor:pointer;transition:.15s;text-align:left;width:100%;font:inherit}
#app-browser .tcard:hover{background:var(--br-paper);box-shadow:0 8px 18px -12px rgba(8,56,31,.4)}
#app-browser .tcard .nm{font-family:'Fraunces',serif;font-weight:600;font-size:18px;color:var(--br-forest-ink)}
#app-browser .tcard .sj{font-size:14px;font-weight:600;margin-top:2px}
#app-browser .tcard .rm{font-size:13px;color:var(--br-muted);margin-top:7px}
#app-browser .gtable{width:100%;border-collapse:collapse;margin-top:4px;font-size:15.5px;border:1px solid var(--br-line);border-radius:12px;overflow:hidden}
#app-browser .gtable th{font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:var(--br-muted);text-align:left;
  padding:11px 16px;background:var(--br-cream);border-bottom:1px solid var(--br-gold-line)}
#app-browser .gtable td{padding:13px 16px;border-bottom:1px solid var(--br-line)}
#app-browser .gtable tr:last-child td{border-bottom:none}
#app-browser .gtable .subj{font-weight:700}
#app-browser .gtable .lnk{font:inherit;font-weight:700;font-size:15.5px;background:none;border:none;color:var(--br-forest-ink);
  cursor:pointer;padding:0;text-decoration:underline;text-decoration-color:var(--br-gold-soft);text-underline-offset:3px}
#app-browser .gtable .lnk:hover{text-decoration-color:var(--br-forest-ink)}
#app-browser .overview{margin-top:34px;border-top:1px solid var(--br-line);padding-top:8px}
#app-browser .overview summary{cursor:pointer;font-weight:600;font-size:14.5px;color:var(--br-muted);padding:10px 2px;list-style:none}
#app-browser .overview summary::-webkit-details-marker{display:none}
#app-browser .overview summary::before{content:"▸ ";color:var(--br-gold-soft)}
#app-browser .overview[open] summary::before{content:"▾ "}
#app-browser .snap{padding:10px 2px 4px}
#app-browser .snap .row{display:flex;align-items:center;gap:12px;margin:11px 0}
#app-browser .snap .lbl{width:130px;flex:none;font-weight:600;font-size:14px}
#app-browser .snap .track{flex:1;height:24px;background:var(--br-paper);border-radius:6px;overflow:hidden}
#app-browser .snap .fill{height:100%;border-radius:6px;display:flex;align-items:center;padding-left:10px;color:#fff;font-size:12.5px;font-weight:700}
#app-browser .snap .cnt{width:92px;flex:none;font-size:13px;color:var(--br-muted)}
#app-browser .snap .note{font-size:13.5px;color:var(--br-muted);margin:14px 0 0;line-height:1.6}
#app-browser .footnote{color:var(--br-muted);font-size:12.5px;margin:22px 6px 0;line-height:1.6;text-align:center}
/* Building map */
#app-browser .maptop{display:flex;flex-wrap:wrap;gap:14px 18px;align-items:center;justify-content:space-between;margin-bottom:6px}
#app-browser .maptop h2{font-family:'Fraunces',serif;font-weight:600;font-size:26px;margin:0;color:var(--br-forest-ink)}
#app-browser .maptop .role{font-size:14.5px;color:var(--br-muted);margin-top:3px}
#app-browser .floortabs{display:inline-flex;background:var(--br-cream);border:1px solid var(--br-gold-soft);border-radius:11px;padding:3px}
#app-browser .floortabs button{font:inherit;font-weight:600;font-size:13.5px;border:none;background:none;color:var(--br-muted);
  padding:8px 15px;border-radius:8px;cursor:pointer;transition:.18s}
#app-browser .floortabs button.on{background:var(--br-forest);color:#fff}
#app-browser .maphint{color:var(--br-muted);font-size:14px;margin:2px 0 14px}
#app-browser .maplegend{display:flex;flex-wrap:wrap;gap:7px 16px;margin:0 0 16px;font-size:13px}
#app-browser .maplegend .lg{display:inline-flex;align-items:center;gap:7px;color:var(--br-ink);font-weight:600}
#app-browser .maplegend .sw{width:13px;height:13px;border-radius:4px;flex:none}
#app-browser .maplegend .sw.ctx{background:#eef2ee;border:1px solid #d4ddd5}
#app-browser .mapscroll{overflow-x:auto;border:1px solid var(--br-line);border-radius:14px;background:
  radial-gradient(circle at 20% 0,#fbfdfb,#f4f7f4);padding:14px 16px;-webkit-overflow-scrolling:touch}
#app-browser .floorplan{display:block}
#app-browser .corridor-t{font-family:'Public Sans';font-size:11px;font-weight:600;fill:#9aa89f;letter-spacing:.5px}
#app-browser .rcell .rbox{stroke-width:1.6;transition:.16s}
#app-browser .rcell .racc{transition:.16s}
#app-browser .rcell.ctx .rbox{fill:#f3f6f3;stroke:#d8e0d9}
#app-browser .rcell.ctx .rid{font-family:'Public Sans';font-weight:600;fill:#9fb0a4}
#app-browser .rcell.ctx .rnote{font-family:'Public Sans';font-style:italic;fill:#aebcb1}
#app-browser .rcell.live{cursor:pointer}
#app-browser .rcell.live:hover{filter:drop-shadow(0 0 7px var(--rc))}
#app-browser .rcell.live:hover .rbox{stroke-width:2.6;fill-opacity:.26}
#app-browser .rcell.live:hover .racc{width:8px}
#app-browser .rcell.here .rbox{fill-opacity:.30;stroke-width:2.6}
#app-browser .rcell .ring{fill:none;stroke:var(--rc);opacity:0}
#app-browser .rcell.here .ring{opacity:1;animation:br-pulsering 1.7s ease-in-out infinite}
@keyframes br-pulsering{0%,100%{opacity:.28;stroke-width:1.6}50%{opacity:.95;stroke-width:3.6}}
#app-browser .mini-wrap{display:flex;gap:18px;flex-wrap:wrap;align-items:stretch;margin-top:4px}
#app-browser .mini-card{flex:1;min-width:280px;border:1px solid var(--br-line);border-radius:14px;overflow:hidden;background:
  radial-gradient(circle at 20% 0,#fbfdfb,#f5f8f5)}
#app-browser .mini-card .mhd{font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--br-muted);
  padding:11px 16px;border-bottom:1px solid var(--br-line);background:var(--br-cream)}
#app-browser .mini-card .msvg{padding:12px}
#app-browser .mini-side{flex:0 0 220px;min-width:200px;display:flex;flex-direction:column;justify-content:center;gap:12px;
  border:1px solid var(--br-line);border-radius:14px;padding:18px;background:var(--br-card)}
#app-browser .mini-side .where{font-size:14px;color:var(--br-muted);line-height:1.5}
#app-browser .mini-side .where b{color:var(--br-forest-ink)}
#app-browser .mini-side .roomtag{font-family:'Fraunces',serif;font-size:30px;font-weight:600;line-height:1}
#app-browser .mini-side .floortag{font-size:13.5px;font-weight:600;color:var(--br-muted)}
#app-browser .btn-map{font:inherit;font-weight:600;font-size:14px;border:1px solid var(--br-forest);background:var(--br-forest);
  color:#fff;padding:11px 16px;border-radius:10px;cursor:pointer;transition:.18s;text-align:center}
#app-browser .btn-map:hover{background:var(--br-forest-2)}
#app-browser .offmap{padding:22px;color:var(--br-muted);font-size:14.5px;line-height:1.6}
#app-browser .offmap b{color:var(--br-forest-ink)}
@media(max-width:620px){#app-browser .mini-side{flex:1 1 100%}}
@media print{
  #app-browser .toolbar,#app-browser .btn-print,#app-browser .br-menu,
  #app-browser .overview,#app-browser .footnote,#app-browser .stale-banner,#btn-toggle-app,#btn-open-schedule-browser{display:none!important}
  #app-browser .mast,#app-browser .panel{box-shadow:none;border-radius:0;border:none}
  #app-browser .tcard,#app-browser .gchip{cursor:default}
  #app-browser .br-view{display:none!important}#app-browser .br-view.show{display:block!important}
}
/* ── R60 additions ── */
#app-browser .tscroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
#app-browser .blockrow .bk .bt{display:block;font-size:10px;font-weight:600;color:var(--br-muted);margin-top:2px;line-height:1.2}
#app-browser .daychips{display:inline-flex;background:var(--br-card);border:1px solid var(--br-gold-soft);border-radius:11px;padding:3px;margin:0 0 14px}
#app-browser .daychips button{font:inherit;font-weight:600;font-size:13.5px;border:none;background:none;color:var(--br-muted);padding:8px 16px;border-radius:8px;cursor:pointer}
#app-browser .daychips button.on{background:var(--br-forest);color:#fff}
#app-browser .groupmaps{display:grid;gap:16px}
#app-browser .geoplan{display:block}
/* Below 900px, stop the floor plan shrinking and let .mapscroll do its job.
   --geo-w is the drawing's natural width, set inline by brGeoFloorSVG(). */
@media(max-width:900px){#app-browser .geoplan{min-width:var(--geo-w)}}
#app-browser .geoplan .geo-room.live{cursor:pointer}
#app-browser .geoplan .geo-room.live:hover rect{fill-opacity:.32}
@media(max-width:640px){
  #app-browser{padding:16px 10px 60px}
  #app-browser .toolbar{flex-direction:column;align-items:stretch;padding:14px}
  #app-browser .mode{width:100%;display:flex}
  #app-browser .mode button{flex:1;padding-top:12px;padding-bottom:12px}
  #app-browser .br-field{min-width:0}
  #app-browser .btn-print{width:100%;padding:13px;min-height:44px}
  #app-browser .stage{padding:20px 14px}
  #app-browser .mini-wrap{flex-direction:column}
  #app-browser .mini-side{flex:1 1 100%}
  #app-browser .gchip,#app-browser .tcard,#app-browser .btn-map{min-height:44px}
  #app-browser .gtable{min-width:520px}
  #app-browser .idhead h2{font-size:23px}
}

/* ── Dark ─────────────────────────────────────────────────────────────────
   Nobody who owns data-theme on this page is this file, and there are
   three cases rather than one:

     034, the committed site copy   _shared/a11y.js owns the attribute. That
       page raises the window.A11Y_NATIVE_THEME flag, without which a11y.js
       would ALSO drop its CSS-filter invert on top and the two would cancel
       out. (Spelling the assignment out here would be read as 035 raising it
       too: this comment travels inside BR_CSS, and smoke-theme.mjs greps.)
     035, the visualizer            its own four-palette switcher owns it;
       two of the four are dark, so the embedded browser follows whichever
       palette the visualizer is wearing.
     a file a teacher was emailed   has no theme owner at all — no
       _shared/ folder next to it, no switcher — so the OS preference
       decides, and ONLY there. That is what body.br-published gates: an
       embedded browser must not go dark on a dark laptop while the
       visualizer around it stays light.

   The two assignment lists below are deliberately identical; smoke-dark-
   theme.mjs fails if they ever stop being. */
:root[data-theme="green-gold-dark"],
:root[data-theme="dark"]:not(.a11y-filter-dark) {
  color-scheme:dark;
  --br-forest:var(--br-forest-dark);
  --br-forest-ink:var(--br-forest-ink-dark);
  --br-forest-2:var(--br-forest-2-dark);
  --br-gold-soft:var(--br-gold-soft-dark);
  --br-gold-line:var(--br-gold-line-dark);
  --br-cream:var(--br-cream-dark);
  --br-paper:var(--br-paper-dark);
  --br-card:var(--br-card-dark);
  --br-ink:var(--br-ink-dark);
  --br-muted:var(--br-muted-dark);
  --br-line:var(--br-line-dark);
  --br-placeholder:var(--br-placeholder-dark);
  --br-plan-ink:var(--br-plan-ink-dark);
  --br-plan-bg:var(--br-plan-bg-dark);
  --br-note-bg:var(--br-note-bg-dark);
  --br-common-bg:var(--br-common-bg-dark);
  --br-common-ink:var(--br-common-ink-dark);
  --br-warn-bg:var(--br-warn-bg-dark);
  --br-warn-ink:var(--br-warn-ink-dark);
  --br-alert-ink:var(--br-alert-ink-dark);
  --br-page:var(--br-page-dark);
  --br-focus-ring:var(--br-focus-ring-dark);
}
@media (prefers-color-scheme:dark) {
  html:not([data-theme]) body.br-published {
    color-scheme:dark;
    --br-forest:var(--br-forest-dark);
    --br-forest-ink:var(--br-forest-ink-dark);
    --br-forest-2:var(--br-forest-2-dark);
    --br-gold-soft:var(--br-gold-soft-dark);
    --br-gold-line:var(--br-gold-line-dark);
    --br-cream:var(--br-cream-dark);
    --br-paper:var(--br-paper-dark);
    --br-card:var(--br-card-dark);
    --br-ink:var(--br-ink-dark);
    --br-muted:var(--br-muted-dark);
    --br-line:var(--br-line-dark);
    --br-placeholder:var(--br-placeholder-dark);
    --br-plan-ink:var(--br-plan-ink-dark);
    --br-plan-bg:var(--br-plan-bg-dark);
    --br-note-bg:var(--br-note-bg-dark);
    --br-common-bg:var(--br-common-bg-dark);
    --br-common-ink:var(--br-common-ink-dark);
    --br-warn-bg:var(--br-warn-bg-dark);
    --br-warn-ink:var(--br-warn-ink-dark);
    --br-alert-ink:var(--br-alert-ink-dark);
    --br-page:var(--br-page-dark);
    --br-focus-ring:var(--br-focus-ring-dark);
  }
}
body.br-published { background:var(--br-page); color:var(--br-ink); }

/* ── Department hues, which are data and not theme ────────────────────────
   brDColor() reads its five (or however many) hues out of PUBLISHED_DATA,
   where they were chosen against a white card. All five of East Middle's
   fail as text on a dark one — measured 2.39:1 (Social Studies) to 3.56:1
   (Math) — and they are written into a style attribute from script, where
   no token override can reach them. So each element that inks itself with a
   hue carries BOTH values inline (--dc and --dc-ink, the second from
   brDeptInk()) and the theme picks. A style attribute beats any stylesheet
   rule, which is why the value moved out of the color property and into a variable. */
#app-browser .dcink { color:var(--dc,var(--br-forest-ink)); }
#app-browser .br-muted-ink { color:var(--br-muted); }
:root[data-theme="green-gold-dark"] #app-browser .dcink,
:root[data-theme="dark"]:not(.a11y-filter-dark) #app-browser .dcink { color:var(--dc-ink,var(--dc)); }
@media (prefers-color-scheme:dark) {
  html:not([data-theme]) body.br-published #app-browser .dcink { color:var(--dc-ink,var(--dc)); }
}

/* ── The floor plan is a light mat in both themes ─────────────────────────
   Same call as 046's map mat (#225): the room fills are department hues at a
   fill-opacity tuned for a light ground, the SVG's own furniture — corridor
   labels, context rooms, the stair blocks — is painted with literals in
   brGeoFloorSVG(), and the map is the half of this tool that gets printed
   and pinned up. Restoring the light tokens here is what keeps the mini-map
   card's header legible on it. These are unconditional on purpose: a mat
   that is light in every theme needs no theme selector, and gets the print
   reset for free. */
#app-browser .mapscroll,
#app-browser .mini-card {
  --br-forest-ink:var(--br-forest-ink-light);
  --br-cream:var(--br-cream-light);
  --br-paper:var(--br-paper-light);
  --br-card:var(--br-card-light);
  --br-ink:var(--br-ink-light);
  --br-muted:var(--br-muted-light);
  --br-line:var(--br-line-light);
  color:var(--br-ink);
}

/* ── Print is always on paper ─────────────────────────────────────────────
   Last block in this stylesheet on purpose: it ties on specificity with the
   two dark blocks above (deliberately — matching their selectors is what
   makes the tie), so source order is what decides it. Do not move it. */
@media print {
  :root[data-theme]:not(.a11y-filter-dark),
  html:not([data-theme]) body.br-published {
    color-scheme:light;
    --br-forest:var(--br-forest-light);
    --br-forest-ink:var(--br-forest-ink-light);
    --br-forest-2:var(--br-forest-2-light);
    --br-gold-soft:var(--br-gold-soft-light);
    --br-gold-line:var(--br-gold-line-light);
    --br-cream:var(--br-cream-light);
    --br-paper:var(--br-paper-light);
    --br-card:var(--br-card-light);
    --br-ink:var(--br-ink-light);
    --br-muted:var(--br-muted-light);
    --br-line:var(--br-line-light);
    --br-placeholder:var(--br-placeholder-light);
    --br-plan-ink:var(--br-plan-ink-light);
    --br-plan-bg:var(--br-plan-bg-light);
    --br-note-bg:var(--br-note-bg-light);
    --br-common-bg:var(--br-common-bg-light);
    --br-common-ink:var(--br-common-ink-light);
    --br-warn-bg:var(--br-warn-bg-light);
    --br-warn-ink:var(--br-warn-ink-light);
    --br-alert-ink:var(--br-alert-ink-light);
    --br-page:var(--br-page-light);
    --br-focus-ring:var(--br-focus-ring-light);
  }
  :root[data-theme]:not(.a11y-filter-dark) #app-browser .dcink,
  html:not([data-theme]) body.br-published #app-browser .dcink { color:var(--dc); }
}

`;
(function(){
  const st = document.createElement('style');
  st.id = 'br-style';
  st.textContent = BR_CSS;
  document.head.appendChild(st);
})();

let _brAppVisible = false;

function toggleApp() {
  _brAppVisible = !_brAppVisible;
  const viz    = document.getElementById('app-visualizer');
  const br     = document.getElementById('app-browser');
  const hdrBtn = document.getElementById('btn-open-schedule-browser');

  if (_brAppVisible) {
    viz.style.display = 'none';
    br.style.display  = 'block';
    if (hdrBtn) {
      hdrBtn.querySelector('svg').innerHTML = '<polyline points="15 18 9 12 15 6"/>';
      hdrBtn.querySelector('svg').setAttribute('viewBox','0 0 24 24');
      hdrBtn.lastChild.textContent = ' ← Visualizer';
    }
    // Refresh data every time we switch to the browser
    brLoadFromVisualizer();
    brBuildOpts();
    brRenderMenu();
  } else {
    br.style.display  = 'none';
    viz.style.display = '';
    if (hdrBtn) {
      hdrBtn.querySelector('svg').innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/>';
      hdrBtn.querySelector('svg').setAttribute('viewBox','0 0 24 24');
      hdrBtn.lastChild.textContent = ' Schedule Browser';
    }
  }
}

/* === Data derivation === */
/* R59: BR_DEPT / BR_ORDER are now derived from settings.subjects (Settings →
   Subjects editor) via brSyncDeptFromSettings(). The seed values match the
   pre-R59 hardcoded palette, so existing data renders unchanged. Unknown
   codes (e.g. a deleted subject still on a room) fall back to a neutral grey. */
let BR_DEPT = {
  ELA:{c:'#2563eb',name:'English / ELA'},
  MATH:{c:'#c2520f',name:'Mathematics'},
  SCI:{c:'#0d7c69',name:'Science'},
  SS:{c:'#7c3aa8',name:'Social Studies'},
  'SCI/SS':{c:'#71641f',name:'Science / Social Studies'}
};
let BR_ORDER = {ELA:0,MATH:1,SCI:2,SS:3,'SCI/SS':4};
const BR_LEGACY_SHORT = {ELA:'ELA',MATH:'Math',SCI:'Science',SS:'Soc Studies','SCI/SS':'Sci / SS'};
const BR_DEPT_FALLBACK = { c:'#64748b', name:null };
/* How many days past a published file's publishedOn before brCheckStaleness()
   shows the "may be stale" banner. No effect in the live editor preview,
   which never sets PUBLISHED_DATA — see brCheckStaleness() below. */
const BR_STALE_DAYS = 60;
function brSyncDeptFromSettings() {
  try {
    const subjects = (typeof getSubjects === 'function') ? getSubjects() : null;
    if (!Array.isArray(subjects) || !subjects.length) return;
    const dept = {}, order = {};
    subjects.forEach((sub, i) => {
      dept[sub.code]  = { c: sub.color || '#64748b', name: sub.name || sub.code };
      order[sub.code] = i;
    });
    BR_DEPT = dept; BR_ORDER = order;
  } catch(e) { console.warn('[Browser] subject sync failed:', e); }
}
const brDColor = d => (BR_DEPT[d]||BR_DEPT_FALLBACK).c || '#64748b';
/* The department hues are DATA: brDColor() reads them out of the published
   file, where they were picked against a white card. On a dark card all five
   of East Middle's fail as text — 2.39:1 (Social Studies) to 3.56:1 (Math) —
   and they are written into a `style` attribute, which beats every stylesheet
   rule, so no CSS token can correct them. This returns the ink sibling of a
   hue: the same hue and saturation, lightened in 1% steps until it clears
   4.5:1 on --br-paper-dark (#272f28, the darkest surface one of these ever
   sits on), and giving up at 95% lightness. Every element that inks itself
   with a hue carries both values (`--dc`, `--dc-ink`) and .dcink picks. */
function brDeptInk(hex) {
  const raw = String(hex).trim().replace('#', '');
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#e7ece7';
  const lum = c => { const s = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; };
  const BG = lum([39, 47, 40]);
  const ratio = c => { const a = lum(c); return (Math.max(a, BG) + 0.05) / (Math.min(a, BG) + 0.05); };
  const rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  if (ratio(rgb) >= 4.5) return '#' + full.toLowerCase();
  const [r, g, b] = rgb.map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l0 = (mx + mn) / 2;
  let h = 0, sat = 0;
  if (d) {
    sat = l0 > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
  }
  const chan = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p; };
  for (let l = l0 + 0.01; l <= 0.95; l += 0.01) {
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    const out = (sat ? [chan(p, q, h + 1 / 3), chan(p, q, h), chan(p, q, h - 1 / 3)] : [l, l, l])
      .map(v => Math.max(0, Math.min(255, Math.round(v * 255))));
    if (ratio(out) >= 4.5) return '#' + out.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  return '#e7ece7';
}
const brTDept  = n => BR_TEACHERS[n] ? BR_TEACHERS[n].dept : (Object.keys(BR_DEPT)[0] || 'ELA');
const brDShort = d => {
  if (BR_LEGACY_SHORT[d] && BR_DEPT[d]) return BR_LEGACY_SHORT[d];
  const entry = BR_DEPT[d];
  if (entry && entry.name) return entry.name.length <= 12 ? entry.name : d;
  return d;
};
/* R59: unknown dept codes must sort deterministically after known ones. */
const brOrderOf = d => (d in BR_ORDER) ? BR_ORDER[d] : 999;

let BR_TEACHERS = {}, BR_SECTIONS = {}, BR_ROOM2TEACHER = {}, BR_MODCOUNT = 8, BR_MOD_LABEL = 'Mod';
/* R60: group room-by-mod map, bell-time snapshot, blueprint geometry snapshot */
let BR_GROUPROOMS = {}, BR_BELL = null, BR_GEOM = null;
let brMode = 'teacher', brCurrent = null, brActiveIdx = -1, brOpts = [];
let brMapFloor = 'f2';
let brGrpDay = 'A', brMapFloorIdx = 0;
/* Path 11 P6: the schedule a published file is showing. The preamble starts it
   at PUBLISHED_DATA; brUseSchedule() changes it when someone opens a newer
   file. Never set in the live app, where the stale banner has nothing to read. */
let brData = null;
/* The newest data format a published reader opens (brReadSchedule refuses a
   higher one). check:publisher holds it equal to the contract's FORMAT. */
const BR_READS_FORMAT = 1;

function brDeriveScheduleData(settings, blueprint, groups) {
  brSyncDeptFromSettings();   // R59: dept palette follows settings.subjects
  const modCount = settings.modCount || 8;
  const roomMap  = {};

  // Read from the live gridData 2D array (not floor.cells, which is the serialized
  // export format and does not exist on in-memory floor objects after import/load).
  for (const floor of (blueprint.floors || [])) {
    const { gridData, gridCols, gridRows } = floor;
    if (!gridData) continue;
    const seen = new Set();
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const t = gridData[r] && gridData[r][c];
        if (!t || t.type !== 'classroom' || !t.roomNumber) continue;
        if (t.groupId && seen.has(t.groupId)) continue;
        if (t.groupId) seen.add(t.groupId);
        roomMap[t.roomNumber] = { teacher: t.teacher || null, dept: t.dept || null };
      }
    }
  }

  const teacherRoomMap = {};
  for (const [rn, info] of Object.entries(roomMap)) {
    if (info.teacher) teacherRoomMap[info.teacher] = rn;
  }

  const teacherSlots = {};
  for (const [tName, tRoom] of Object.entries(teacherRoomMap)) {
    const A = Array(modCount).fill('Planning');
    const B = Array(modCount).fill('Planning');
    for (const g of groups) {
      const modsA = g.modsA || g.mods || [];
      const modsB = g.modsB || [];
      for (let i = 0; i < modCount; i++) {
        if (modsA[i] === tRoom) A[i] = g.name;
        if (modsB[i] === tRoom) B[i] = g.name;
      }
    }
    teacherSlots[tName] = { A, B };
  }

  const TEACHERS = {};
  for (const [tName, tRoom] of Object.entries(teacherRoomMap)) {
    const info  = roomMap[tRoom] || {};
    const slots = teacherSlots[tName] || { A: [], B: [] };
    const allSecs = [...new Set([
      ...slots.A.filter(x => x !== 'Planning'),
      ...slots.B.filter(x => x !== 'Planning')
    ])];
    const abDiff = JSON.stringify(slots.A) !== JSON.stringify(slots.B);
    const planA  = slots.A.map((x,i) => x==='Planning'?`A${i+1}`:null).filter(Boolean);
    const planB  = slots.B.map((x,i) => x==='Planning'?`B${i+1}`:null).filter(Boolean);
    const planStr = planA.length
      ? planA.join(' / ') + (abDiff && planB.length ? ' / '+planB.join(' / ') : '')
      : '—';
    TEACHERS[tName] = { dept: info.dept||'ELA', room:tRoom, plan:planStr, sec:allSecs, A:slots.A, B:slots.B, co:[] };
  }

  const SECTIONS = {};
  for (const g of groups) {
    const teachers = [];
    const modsA = g.modsA || g.mods || [];
    const modsB = g.modsB || [];
    const allRooms = new Set([...modsA, ...modsB].filter(Boolean));
    for (const room of allRooms) {
      const info = roomMap[room];
      if (info && info.teacher && !teachers.includes(info.teacher)) teachers.push(info.teacher);
    }
    if (teachers.length > 0 || g.name) SECTIONS[g.name] = teachers;
  }

  for (const [tName, t] of Object.entries(TEACHERS)) {
    const co = new Set();
    for (const sec of t.sec) {
      for (const other of (SECTIONS[sec]||[])) { if (other !== tName) co.add(other); }
    }
    t.co = [...co].sort();
  }

  const ROOM2TEACHER = {};
  for (const [tName, t] of Object.entries(TEACHERS)) ROOM2TEACHER[t.room] = tName;

  /* R60: room-by-mod arrays per group, for the group-view mini-map. B stays
     independent of A (matching teacherSlots): no B data means no B highlights. */
  const GROUPROOMS = {};
  for (const g of groups) {
    if (!g.name) continue;
    const modsA = g.modsA || g.mods || [];
    const modsB = g.modsB || [];
    GROUPROOMS[g.name] = {
      A: Array.from({ length: modCount }, (_, i) => modsA[i] || null),
      B: Array.from({ length: modCount }, (_, i) => modsB[i] || null)
    };
  }

  return { TEACHERS, SECTIONS, ROOM2TEACHER, GROUPROOMS, modCount };
}

/* R60 (live-only): snapshot per-mod bell labels for both days. Reads the
   Stage 1 helpers, which read AppState — published files get the result blob. */
function brSnapshotBell(modCount) {
  if (typeof formatModTime !== 'function') return null;
  const out = { A: [], B: [] };
  let any = false;
  for (let i = 0; i < modCount; i++) {
    const a = formatModTime('A', i) || '';
    const b = formatModTime('B', i) || '';
    if (a || b) any = true;
    out.A.push(a); out.B.push(b);
  }
  return any ? out : null;
}

/* R60 (live-only): lightweight geometry snapshot of the blueprint for the
   browser mini-maps and published files. Reads the live gridData 2D arrays
   (same traversal contract as brDeriveScheduleData). No paths, no heat —
   hallway/staircase cells plus room cell-lists with subject code + teacher. */
function brBuildGeometrySnapshot(blueprint) {
  const floors = [];
  for (const floor of ((blueprint && blueprint.floors) || [])) {
    const { gridData, gridCols, gridRows } = floor;
    if (!gridData) continue;
    const hall = [], stair = [], roomsByKey = {};
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const t = gridData[r] && gridData[r][c];
        if (!t) continue;
        if (t.type === 'hallway') hall.push([c, r]);
        else if (t.type === 'staircase') stair.push([c, r]);
        else if (t.type === 'classroom') {
          const key = t.groupId || ('solo_' + c + '_' + r);
          const R = roomsByKey[key] || (roomsByKey[key] = { rn: null, dept: null, teacher: null, cells: [] });
          R.cells.push([c, r]);
          if (t.roomNumber && !R.rn) { R.rn = t.roomNumber; R.dept = t.dept || null; R.teacher = t.teacher || null; }
        }
      }
    }
    const rooms = Object.values(roomsByKey);
    if (hall.length || stair.length || rooms.length) {
      floors.push({ id: floor.id, label: floor.label || ('Floor ' + (floors.length + 1)),
                    cols: gridCols, rows: gridRows, hall, stair, rooms });
    }
  }
  return { floors };
}

/* Path 11 P6 increment 2 (live-only): the geometry snapshot with what the
   published Directions tab routes on (see brDirGraph), read off 035's own
   graph (window.SVGraph, sv-graph.js) so the published walk cannot disagree
   with it about which cell is a room's door. Only published when Settings →
   "Published copies show directions" is ticked; null stays null. */
function brRouteGeometry(geom, blueprint, settings) {
  if (!geom || !Array.isArray(geom.floors)) return geom;
  const G = window.SVGraph;
  const graph = G.buildGraph(blueprint);
  const marked = G.markedSteps(blueprint);
  const stepDoor = new Set(marked.doors.map(d => d[0] + '|' + d[1]));
  const stepHall = new Set(marked.hallways);
  const wait = G.settingsElevatorWait(settings);
  const floors = geom.floors.map(f => {
    const rooms = f.rooms.map(room => {
      const k = room.rn ? graph.roomToKey.get(room.rn) : null;
      const p = k ? G.parseKey(k) : null;
      if (!p || String(p.floorId) !== String(f.id) || !room.cells.some(c => c[0] === p.x && c[1] === p.y)) return room;
      const doors = (graph.adjacency.get(k) || []).map(e => {
        const q = G.parseKey(e.key);
        return stepDoor.has(k + '|' + e.key) ? [q.x, q.y, 1] : [q.x, q.y];
      });
      return Object.assign({}, room, { door: [p.x, p.y], doors });
    });
    const steps = f.hall.filter(c => stepHall.has(G.floorCellKey(f.id, c[0], c[1])));
    return Object.assign({}, f, { rooms, steps });
  });
  const links = [];
  for (const pair of (blueprint.crossFloorPairs || [])) {
    if (!pair || !pair.a || !pair.b) continue;
    const a = G.floorCellKey(pair.a.floorId, pair.a.col, pair.a.row);
    const b = G.floorCellKey(pair.b.floorId, pair.b.col, pair.b.row);
    if (graph.types.get(a) !== 'staircase' || graph.types.get(b) !== 'staircase' || !G.pairInService(pair)) continue;
    const access = G.pairAccess(pair);
    const l = { a: [pair.a.floorId, pair.a.col, pair.a.row], b: [pair.b.floorId, pair.b.col, pair.b.row], access };
    if (access === 'elevator') l.wait = G.elevatorWait(pair, wait);
    links.push(l);
  }
  return Object.assign({}, geom, { floors, links });
}

function brLoadFromVisualizer() {
  try {
    const settings  = AppState.settings;
    const blueprint = AppState.blueprint;
    const groups    = AppState.schedules.groups;
    const data      = brDeriveScheduleData(settings, blueprint, groups);
    BR_TEACHERS     = data.TEACHERS;
    BR_SECTIONS     = data.SECTIONS;
    BR_ROOM2TEACHER = data.ROOM2TEACHER;
    BR_GROUPROOMS   = data.GROUPROOMS || {};
    BR_MODCOUNT     = data.modCount || 8;
    BR_MOD_LABEL    = settings.modLabel || 'Mod';
    BR_BELL         = brSnapshotBell(BR_MODCOUNT);
    BR_GEOM         = brBuildGeometrySnapshot(blueprint);

    const school = settings.schoolName || 'Schedule Browser';
    const el = document.getElementById('br-mast-school');
    if (el) el.textContent = school;
    const init = document.getElementById('br-mast-initial');
    if (init) init.textContent = school.charAt(0) || 'S';

    if (Object.keys(BR_TEACHERS).length === 0) {
      document.getElementById('br-empty-title').textContent = 'No schedule data found.';
      document.getElementById('br-empty-sub').innerHTML =
        'Add rooms with teachers in the <b>Blueprint Builder</b> and assign them to groups in <b>Schedule Input</b>.';
    } else {
      document.getElementById('br-empty-title').textContent = 'Pick a name to see a schedule.';
      document.getElementById('br-empty-sub').innerHTML =
        'Or switch to <b>By Student Group</b> to see every teacher a class shares.';
    }
  } catch(e) {
    console.warn('[Browser] brLoadFromVisualizer error:', e);
    BR_TEACHERS = {}; BR_SECTIONS = {}; BR_ROOM2TEACHER = {};
    BR_GROUPROOMS = {}; BR_BELL = null; BR_GEOM = null;
  }
}

/* ── Staleness banner (ported from 034-schedule-browser.html R62; see
   BACKLOG.md / HISTORY.md, Round 8). Drives the
   #br-stale-banner div wired into both the live preview markup above and
   brBuildPublishedMarkup() below, and shares one CSS rule (BR_CSS) so a
   published file's banner never drifts from what this app previews. If a
   future export has no publishedOn field — or this runs in the live editor,
   which never sets PUBLISHED_DATA at all — it quietly does nothing rather
   than throwing. ── */
function brFormatDateLong(d) {
  try { return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch (e) { return d.toISOString().slice(0, 10); }
}
function brCheckStaleness() {
  const el = document.getElementById('br-stale-banner');
  if (!el) return;
  el.classList.remove('show');
  el.textContent = '';
  const raw = brData && brData.publishedOn;
  if (!raw) return;
  const pub = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T00:00:00' : raw);
  if (isNaN(pub.getTime())) return;
  const days = Math.floor((Date.now() - pub.getTime()) / 86400000);
  if (days <= BR_STALE_DAYS) return;
  el.textContent = 'This schedule was published on ' + brFormatDateLong(pub) + ' — ' + days + ' days ago. '
    + 'It may be out of date — check with the office or ask for a fresh export if anything looks off.';
  el.classList.add('show');
}

/* === Path 11 P6 increment 1: open a newer schedule file ===
   A published copy whose publisher ticked Settings → "Published copies can open
   a newer schedule file" shows "Open a newer schedule…". It reads the data out
   of another published file (its one PUBLISHED_DATA line) or a bare data .json,
   refuses a format newer than BR_READS_FORMAT, checks the shapes the views
   read, and swaps every BR_* table. Nothing is stored: closing the tab goes
   back to the file's own schedule, and so does the Back button. */

/* '' when data is a schedule this reader can show, else why not. Names no
   value from the file. A loaded file is refused if any of its text holds < or
   >: the views write names into markup, and a schedule never needs either. */
function brCheckSchedule(data) {
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const strs = a => Array.isArray(a) && a.every(x => typeof x === 'string');
  if (!isObj(data)) return 'it holds no schedule';
  if ('format' in data && !(Number.isInteger(data.format) && data.format >= 0)) return 'its format is not a number';
  if (typeof data.school !== 'string') return 'it has no school name';
  if (!Number.isInteger(data.modCount) || data.modCount < 1) return 'its number of mods is not a whole number';
  for (const k of ['dept', 'teachers', 'sections', 'room2teacher']) {
    if (!isObj(data[k])) return 'it has no ' + k + ' table';
  }
  for (const k of ['order', 'groupRooms']) {
    if (k in data && !isObj(data[k])) return 'its ' + k + ' table is not a table';
  }
  if ('modLabel' in data && typeof data.modLabel !== 'string') return 'its mod label is not text';
  if (data.bell != null && !(isObj(data.bell) && strs(data.bell.A) && strs(data.bell.B))) return 'its bell times are not lists of text';
  if (data.geometry != null && !(isObj(data.geometry) && Array.isArray(data.geometry.floors))) return 'its building map has no floors';
  for (const n of Object.keys(data.teachers)) {
    const t = data.teachers[n];
    if (!isObj(t) || !strs(t.A) || !strs(t.B) || !strs(t.sec) || ('co' in t && !strs(t.co))) return 'a teacher\'s day is not lists of text';
  }
  for (const g of Object.keys(data.sections)) {
    if (!strs(data.sections[g])) return 'a group\'s teachers are not a list of names';
  }
  if (/[<>]/.test(JSON.stringify(data))) return 'some of its text holds a < or > character';
  return '';
}

/* { data } or { error } from the text of a file someone picked. */
function brReadSchedule(text) {
  const raw = String(text == null ? '' : text);
  let json = raw.trim().charAt(0) === '{' ? raw.trim() : '';
  if (!json) {
    const lines = raw.replace(/\r/g, '').split('\n').filter(l => l.indexOf('const PUBLISHED' + '_DATA = ') === 0);
    if (lines.length === 1) json = lines[0].slice(('const PUBLISHED' + '_DATA = ').length).replace(/;\s*$/, '');
  }
  if (!json) return { error: 'That file is not a schedule browser this tool published, or its data.' };
  let data;
  try { data = JSON.parse(json); } catch (e) { return { error: 'That file\'s schedule could not be read.' }; }
  if (data && Number.isInteger(data.format) && data.format > BR_READS_FORMAT) {
    return { error: 'That schedule was made by a newer version of the School Layout Visualizer than this copy can read. Ask for a new copy of the schedule browser.' };
  }
  const why = brCheckSchedule(data);
  if (why) return { error: 'That file could not be opened: ' + why + '.' };
  return { data };
}

/* Show data in place of the schedule showing. from: the file's name, or ''
   for this file's own schedule. */
function brUseSchedule(data, from) {
  brData = data;
  BR_DEPT = data.dept; BR_ORDER = data.order || {};
  BR_TEACHERS = data.teachers; BR_SECTIONS = data.sections; BR_ROOM2TEACHER = data.room2teacher;
  BR_MODCOUNT = data.modCount; BR_MOD_LABEL = typeof data.modLabel === 'string' ? data.modLabel : 'Mod';
  BR_GROUPROOMS = data.groupRooms || {}; BR_BELL = data.bell || null; BR_GEOM = data.geometry || null;
  brGrpDay = 'A'; brMapFloorIdx = 0;
  const school = data.school || 'Schedule Browser';
  document.getElementById('br-mast-school').textContent = school;
  document.getElementById('br-mast-initial').textContent = school.charAt(0) || 'S';
  document.title = school + ' — Schedule Browser';
  brCheckStaleness();
  brSetMode('teacher');
  const none = !Object.keys(BR_TEACHERS).length;
  document.getElementById('br-empty-title').textContent = none ? 'No schedule data in this file.' : 'Pick a name to see a schedule.';
  const sub = document.getElementById('br-empty-sub');
  if (none) sub.textContent = 'Ask the publisher to re-export after adding rooms and groups.';
  else sub.innerHTML = 'Or switch to <b>By Student Group</b> to see every teacher a class shares.';
  const note = document.getElementById('br-open-note');
  const back = document.getElementById('br-open-back');
  if (from) {
    const pub = /^\d{4}-\d{2}-\d{2}$/.test(data.publishedOn || '') ? brFormatDateLong(new Date(data.publishedOn + 'T00:00:00')) : 'on a date it does not give';
    document.getElementById('br-open-text').textContent = 'Showing ' + school + ', published ' + pub + ', from the file ' + from + '. Closing this page forgets it.';
    note.hidden = false; back.hidden = false;
  } else {
    note.hidden = true; back.hidden = true;
  }
}

function brPickScheduleFile() {
  const input = document.getElementById('br-open-file');
  input.value = '';
  input.click();
}

function brOpenScheduleFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const say = msg => {
    document.getElementById('br-open-text').textContent = msg;
    document.getElementById('br-open-note').hidden = false;
  };
  file.text().then(text => {
    const r = brReadSchedule(text);
    if (r.error) { say(r.error); return; }
    brUseSchedule(r.data, file.name || 'you opened');
  }, () => say('That file could not be read.'));
}

/* === Path 11 P6 increment 2: directions ===
   A published copy whose publisher ticked Settings → "Published copies show
   directions" has a Directions tab: from a room to a room, as a list of
   moves and a line on each floor the walk crosses. The walk is worked out
   here, on the published geometry, which then carries what it needs and
   otherwise never does (brRouteGeometry): each room's door cell (`door`) and
   the corridor cells it opens onto (`doors`, a third element 1 marking a step
   at that door), each floor's hallway `steps`, and the staircase pairs as
   `links: [{ a: [floorId, c, r], b: [...], access, wait? }]`, out-of-service
   elevators left out. The search is sv-graph.js's rules on that data: hallway
   and staircase tiles joined side to side at a cost of 1, a pair at 0, a room
   entered and left only through its door cell. Step-free drops every stairs
   pair, every staircase tile that is not an end of an elevator or ramp, every
   marked step, and makes an elevator cost its wait.
   test/directions.test.mjs holds the cost of every route to sv-graph.js's. */

/* The walk a published file routes on, or null when its geometry has no links. */
function brDirGraph(geom, stepFree) {
  if (!geom || !Array.isArray(geom.floors) || !Array.isArray(geom.links)) return null;
  const key = (fi, c, r) => fi + ':' + c + ',' + r;
  const isCell = c => Array.isArray(c) && Number.isInteger(c[0]) && Number.isInteger(c[1]);
  const fidx = new Map();
  geom.floors.forEach((f, i) => { if (f && !fidx.has(String(f.id))) fidx.set(String(f.id), i); });
  const stair = new Set(), hall = new Set(), steps = new Set();
  geom.floors.forEach((f, fi) => {
    for (const c of (f && Array.isArray(f.hall) ? f.hall : [])) if (isCell(c)) hall.add(key(fi, c[0], c[1]));
    for (const c of (f && Array.isArray(f.stair) ? f.stair : [])) if (isCell(c)) stair.add(key(fi, c[0], c[1]));
    for (const c of (f && Array.isArray(f.steps) ? f.steps : [])) if (isCell(c)) steps.add(key(fi, c[0], c[1]));
  });
  const links = [], ends = new Set();
  for (const l of geom.links) {
    if (!l || !Array.isArray(l.a) || !Array.isArray(l.b)) continue;
    const ia = fidx.get(String(l.a[0])), ib = fidx.get(String(l.b[0]));
    if (ia === undefined || ib === undefined) continue;
    const a = key(ia, l.a[1], l.a[2]), b = key(ib, l.b[1], l.b[2]);
    if (!stair.has(a) || !stair.has(b)) continue;
    const access = (l.access === 'elevator' || l.access === 'ramp') ? l.access : 'stairs';
    const wait = (typeof l.wait === 'number' && isFinite(l.wait) && l.wait >= 0) ? l.wait : 10;
    links.push({ a, b, access, wait });
    if (access !== 'stairs') { ends.add(a); ends.add(b); }
  }
  const walkable = k => (hall.has(k) && !(stepFree && steps.has(k))) || (stair.has(k) && !(stepFree && !ends.has(k)));
  const edges = new Map(), via = new Map();
  const add = (a, b, cost) => { if (!edges.has(a)) edges.set(a, []); edges.get(a).push({ k: b, cost }); };
  for (const k of hall) if (walkable(k)) edges.set(k, []);
  for (const k of stair) if (walkable(k)) edges.set(k, []);
  for (const k of edges.keys()) {
    const m = /^(\d+):(-?\d+),(-?\d+)$/.exec(k);
    const fi = m[1], c = +m[2], r = +m[3];
    for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const n = key(fi, c + dc, r + dr);
      if (edges.has(n)) edges.get(k).push({ k: n, cost: 1 });
    }
  }
  for (const l of links) {
    if (stepFree && l.access === 'stairs') continue;
    const cost = (stepFree && l.access === 'elevator') ? l.wait : 0;
    add(l.a, l.b, cost); add(l.b, l.a, cost);
    if (!via.has(l.a + '>' + l.b)) via.set(l.a + '>' + l.b, l.access);
    if (!via.has(l.b + '>' + l.a)) via.set(l.b + '>' + l.a, l.access);
  }
  const rooms = new Map();
  geom.floors.forEach((f, fi) => {
    for (const room of (f && Array.isArray(f.rooms) ? f.rooms : [])) {
      if (!room || typeof room.rn !== 'string' || !isCell(room.door) || !Array.isArray(room.doors) || rooms.has(room.rn)) continue;
      const doors = room.doors.filter(d => isCell(d) && !(stepFree && d[2] === 1))
        .map(d => key(fi, d[0], d[1])).filter(k => edges.has(k));
      rooms.set(room.rn, { key: key(fi, room.door[0], room.door[1]), doors });
    }
  });
  return { edges, rooms, via, labels: geom.floors.map((f, i) => (f && typeof f.label === 'string' && f.label) || ('Floor ' + (i + 1))) };
}

/* { path: [keys], cost, steps } from room `from` to room `to`, { same: true },
   or { error }. */
function brDirRoute(geom, from, to, stepFree) {
  const g = brDirGraph(geom, stepFree);
  if (!g) return { error: 'This file has no directions' };
  const A = g.rooms.get(from), B = g.rooms.get(to);
  if (!A || !B) return { error: 'This map does not show the way into that room' };
  if (from === to) return { same: true, path: [], cost: 0, steps: [] };
  const none = stepFree ? 'No step-free route between these rooms' : 'No route between these rooms on this map';
  const dist = new Map(), prev = new Map(), heap = [];
  const push = (k, d) => {
    heap.push([d, k]);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let s = i;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]]; i = s;
      }
    }
    return top;
  };
  for (const d of A.doors) if (!dist.has(d)) { dist.set(d, 1); prev.set(d, A.key); push(d, 1); }
  const goal = new Set(B.doors);
  let best = Infinity, last = null;
  while (heap.length) {
    const [d, k] = pop();
    if (d > dist.get(k) || d + 1 >= best) continue;
    if (goal.has(k)) { best = d + 1; last = k; continue; }
    for (const e of g.edges.get(k) || []) {
      const nd = d + e.cost;
      if (nd < (dist.has(e.k) ? dist.get(e.k) : Infinity)) { dist.set(e.k, nd); prev.set(e.k, k); push(e.k, nd); }
    }
  }
  if (!last) return { error: none };
  const path = [B.key];
  for (let k = last; k; k = prev.get(k)) path.push(k);
  path.reverse();
  return { path, cost: best, steps: brDirSteps(g, path).concat('Arrive at room ' + to + '.') };
}

/* The moves along a path of brDirGraph keys, in sv-routes.js routeSteps()'s words. */
function brDirSteps(g, path) {
  const at = k => { const m = /^(\d+):(-?\d+),(-?\d+)$/.exec(k); return { f: +m[1], c: +m[2], r: +m[3] }; };
  const word = (dc, dr) => dc === 1 ? 'east' : dc === -1 ? 'west' : dr === 1 ? 'south' : dr === -1 ? 'north' : null;
  const steps = [];
  let i = 0;
  while (i < path.length - 1) {
    const a = at(path[i]), b = at(path[i + 1]);
    const dc = b.c - a.c, dr = b.r - a.r;
    if (a.f !== b.f || Math.abs(dc) + Math.abs(dr) !== 1) {
      const access = g.via.get(path[i] + '>' + path[i + 1]);
      const by = access === 'elevator' ? 'the elevator' : access === 'ramp' ? 'the ramp' : 'the stairs';
      steps.push('Take ' + by + ' to ' + g.labels[b.f] + '.');
      i++;
      continue;
    }
    let count = 1, j = i + 1;
    while (j < path.length - 1) {
      const p = at(path[j]), q = at(path[j + 1]);
      if (p.f !== q.f || q.c - p.c !== dc || q.r - p.r !== dr) break;
      count++; j++;
    }
    steps.push('Head ' + word(dc, dr) + ' ' + count + ' tile' + (count === 1 ? '' : 's') + '.');
    i = j;
  }
  return steps;
}

/* The Directions tab: two room lists, a step-free switch when the building
   marks an elevator or a ramp, and the route below them. */
function brRenderDirections() {
  const v = document.getElementById('br-view');
  if (!BR_GEOM || !Array.isArray(BR_GEOM.floors) || !Array.isArray(BR_GEOM.links)) {
    v.innerHTML = '<div class="br-empty"><div class="big">This file has no directions.</div>'
      + '<div>Ask for a newer copy of the schedule browser.</div></div>';
    return;
  }
  const rooms = [];
  for (const f of BR_GEOM.floors) for (const r of ((f && f.rooms) || [])) {
    if (r && typeof r.rn === 'string' && Array.isArray(r.door) && rooms.indexOf(r.rn) < 0) rooms.push(r.rn);
  }
  rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const opts = '<option value="">Choose a room</option>' + rooms.map(rn => {
    const t = BR_ROOM2TEACHER[rn];
    return '<option value="' + escHtml(rn) + '">' + escHtml(rn) + (t ? ' · ' + escHtml(t) : '') + '</option>';
  }).join('');
  const sf = BR_GEOM.links.some(l => l && (l.access === 'elevator' || l.access === 'ramp'));
  v.innerHTML = `
   <div class="maptop"><div><h2>Directions</h2></div></div>
   <div class="br-dir-pick">
     <div class="br-field"><label for="br-dir-from">From room</label><select id="br-dir-from" onchange="brShowRoute()">${opts}</select></div>
     <div class="br-field"><label for="br-dir-to">To room</label><select id="br-dir-to" onchange="brShowRoute()">${opts}</select></div>
     ${sf ? '<label class="br-dir-sf"><input type="checkbox" id="br-dir-sf" onchange="brShowRoute()"> Step-free route (no stairs or steps)</label>' : ''}
   </div>
   <div id="br-dir-out" role="status"></div>`;
  brShowRoute();
}

function brShowRoute() {
  const out = document.getElementById('br-dir-out');
  const from = document.getElementById('br-dir-from').value, to = document.getElementById('br-dir-to').value;
  const sfBox = document.getElementById('br-dir-sf');
  if (!from || !to) { out.innerHTML = '<p class="maphint">Choose the room you are in and the room you are going to.</p>'; return; }
  const r = brDirRoute(BR_GEOM, from, to, !!(sfBox && sfBox.checked));
  if (r.error) { out.innerHTML = '<p class="br-dir-none">' + escHtml(r.error) + '.</p>'; return; }
  if (r.same) { out.innerHTML = '<p class="maphint">Those are the same room.</p>'; return; }
  out.innerHTML = '<ol class="br-dir-steps">' + r.steps.map(s => '<li>' + escHtml(s) + '</li>').join('') + '</ol>'
    + brDirMapsHTML(r.path, from, to);
}

/* One floor map per floor the path crosses, in order, the walk drawn on it. */
function brDirMapsHTML(path, from, to) {
  const px = 26;
  const at = k => { const m = /^(\d+):(-?\d+),(-?\d+)$/.exec(k); return { f: +m[1], c: +m[2], r: +m[3] }; };
  const parts = [];
  let run = [];
  for (let i = 0; i < path.length; i++) {
    const p = at(path[i]), q = run.length ? run[run.length - 1] : null;
    if (q && (q.f !== p.f || Math.abs(q.c - p.c) + Math.abs(q.r - p.r) !== 1)) {
      const last = parts[parts.length - 1];
      if (last && last.f === q.f) last.runs.push(run); else parts.push({ f: q.f, runs: [run] });
      run = [];
    }
    run.push(p);
  }
  if (run.length) {
    const last = parts[parts.length - 1];
    if (last && last.f === run[0].f) last.runs.push(run); else parts.push({ f: run[0].f, runs: [run] });
  }
  const hi = {}; hi[from] = 'Start'; hi[to] = 'End';
  return parts.map(part => {
    const fg = BR_GEOM.floors[part.f];
    const lines = part.runs.map(rn => {
      const pts = rn.map(p => (p.c * px + px / 2) + ',' + (p.r * px + px / 2)).join(' ');
      return '<polyline points="' + pts + '" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<polyline points="' + pts + '" fill="none" stroke="#0c4b31" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
    }).join('');
    const svg = brGeoFloorSVG(fg, { highlights: hi, clickable: false, px }).replace(/<\/svg>$/, lines + '</svg>');
    return '<figure class="br-dir-map"><figcaption>' + escHtml(fg.label) + '</figcaption><div class="mapscroll">' + svg + '</div></figure>';
  }).join('');
}

/* === Path 11 P6 increment 3: sub plan ===
   A published copy whose publisher ticked Settings → "Published copies show a
   sub plan" has a Sub Plan tab: pick the absent teacher and the day, and it
   lists each mod of that day with the class, the room, the bell time and the
   teachers whose own day has Planning in that mod (the colleagues free to
   cover). Each mod with a class has a box to type who covers it; "Copy the
   plan" copies it all as plain text for an email, and the tab prints as one
   sheet. It reads the teacher's day exactly as By Teacher shows it (an empty
   slot or 'Planning' is Planning, the room is the teacher's room) and stores
   nothing. Written beside 034's own Substitute Plan, not from it: 034's pieces
   are not touched. */

/* The rows of the plan: one per mod, { i, time, sec, room, free }; sec is
   null on a mod the absent teacher has Planning. */
function brCoverRows(n, day) {
  const t = BR_TEACHERS[n]; if (!t) return [];
  const arr = (day === 'B' ? t.B : t.A) || [];
  const bell = BR_BELL ? (day === 'B' ? BR_BELL.B : BR_BELL.A) : null;
  const planning = (name, i) => { const d = (day === 'B' ? BR_TEACHERS[name].B : BR_TEACHERS[name].A) || []; return !d[i] || d[i] === 'Planning'; };
  const rows = [];
  for (let i = 0; i < BR_MODCOUNT; i++) {
    const sec = arr[i] && arr[i] !== 'Planning' ? arr[i] : null;
    const free = sec ? Object.keys(BR_TEACHERS).filter(m => m !== n && planning(m, i))
      .sort((a, b) => (brOrderOf(brTDept(a)) - brOrderOf(brTDept(b))) || a.localeCompare(b)) : [];
    rows.push({ i, time: bell && typeof bell[i] === 'string' ? bell[i] : '', sec, room: t.room, free });
  }
  return rows;
}

/* The plan as plain text. covers: what was typed for each mod, by index. */
function brCoverText(school, n, day, date, rows, covers) {
  const t = BR_TEACHERS[n];
  const lines = ['Sub plan' + (school ? ' — ' + school : ''),
    'Absent: ' + n + (t ? ' (Room ' + t.room + ')' : ''), 'Day: ' + day + ' day' + (date ? ', ' + date : ''), ''];
  for (const r of rows) {
    const head = BR_MOD_LABEL + ' ' + (r.i + 1) + (r.time ? ' (' + r.time + ')' : '') + ': ';
    if (!r.sec) { lines.push(head + 'Planning, nothing to cover.'); continue; }
    const who = String(covers[r.i] || '').trim();
    lines.push(head + 'Class ' + r.sec + ', Room ' + r.room + '. '
      + (who ? 'Covered by ' + who + '.' : 'Not covered yet' + (r.free.length ? ' (free: ' + r.free.join(', ') + ').' : ' (no one is free).')));
  }
  return lines.join('\n');
}

/* The Sub Plan tab: the absent teacher, the day, a date as typed, and the plan below. */
function brRenderCover() {
  const v = document.getElementById('br-view');
  const names = Object.keys(BR_TEACHERS).sort((a, b) => a.localeCompare(b));
  if (!names.length) {
    v.innerHTML = '<div class="br-empty"><div class="big">This schedule has no teachers yet.</div></div>';
    return;
  }
  const opts = '<option value="">Choose a teacher</option>'
    + names.map(n => '<option value="' + escHtml(n) + '">' + escHtml(n) + ' · Room ' + escHtml(BR_TEACHERS[n].room) + '</option>').join('');
  v.innerHTML = `
   <div class="maptop"><div><h2>Sub Plan</h2></div></div>
   <div class="br-dir-pick br-cover-pick">
     <div class="br-field"><label for="br-cover-who">Absent teacher</label><select id="br-cover-who" onchange="brShowCover()">${opts}</select></div>
     <div class="br-field"><label for="br-cover-day">Day</label><select id="br-cover-day" onchange="brShowCover()"><option value="A">A day</option><option value="B">B day</option></select></div>
     <div class="br-field"><label for="br-cover-date">Date (optional)</label><input id="br-cover-date" type="text" autocomplete="off" placeholder="Like Tuesday, March 3"></div>
   </div>
   <div id="br-cover-out"></div>`;
  brShowCover();
}

function brShowCover() {
  const out = document.getElementById('br-cover-out');
  const n = document.getElementById('br-cover-who').value, day = document.getElementById('br-cover-day').value === 'B' ? 'B' : 'A';
  if (!n || !BR_TEACHERS[n]) { out.innerHTML = '<p class="maphint">Choose the teacher who is out.</p>'; return; }
  const rows = brCoverRows(n, day);
  const body = rows.map(r => {
    const mod = escHtml(BR_MOD_LABEL) + ' ' + (r.i + 1) + (r.time ? '<span class="bt"> · ' + escHtml(r.time) + '</span>' : '');
    if (!r.sec) return '<tr class="plan"><td>' + mod + '</td><td colspan="4">Planning, nothing to cover</td></tr>';
    const free = r.free.length ? r.free.map(escHtml).join(', ') : 'No one is free. Check with the office.';
    const id = 'br-cover-in-' + r.i;
    return '<tr><td>' + mod + '</td><td>Class ' + escHtml(r.sec) + '</td><td>Room ' + escHtml(r.room) + '</td><td>' + free + '</td>'
      + '<td><input id="' + id + '" type="text" autocomplete="off" aria-label="Who covers ' + escHtml(BR_MOD_LABEL) + ' ' + (r.i + 1) + '"'
      + (r.free.length ? ' list="' + id + '-free"' : '') + '>'
      + (r.free.length ? '<datalist id="' + id + '-free">' + r.free.map(m => '<option value="' + escHtml(m) + '">').join('') + '</datalist>' : '')
      + '</td></tr>';
  }).join('');
  const classes = rows.filter(r => r.sec).length;
  out.innerHTML = '<p class="factline">Absent: <b>' + escHtml(n) + '</b>, Room ' + escHtml(BR_TEACHERS[n].room) + ', ' + day + ' day. '
    + (classes ? classes + ' class' + (classes === 1 ? '' : 'es') + ' to cover.' : 'No classes that day, so nothing to cover.') + '</p>'
    + '<div class="tscroll"><table class="br-cover-table"><thead><tr><th scope="col">' + escHtml(BR_MOD_LABEL) + '</th><th scope="col">Class</th>'
    + '<th scope="col">Room</th><th scope="col">Free to cover (on Planning)</th><th scope="col">Covered by</th></tr></thead><tbody>' + body + '</tbody></table></div>'
    + '<div class="br-cover-acts"><button class="btn-print" type="button" onclick="brCopyCover()">Copy the plan</button>'
    + '<button class="btn-print" type="button" onclick="window.print()">Print the plan</button>'
    + '<span class="br-cover-say" id="br-cover-say" role="status"></span></div>'
    + '<textarea id="br-cover-text" class="br-cover-text" readonly hidden aria-label="The plan as text"></textarea>';
}

/* Copies the plan as text; the text is also shown, selected, for a browser
   that will not copy from a file. */
function brCopyCover() {
  const n = document.getElementById('br-cover-who').value, day = document.getElementById('br-cover-day').value === 'B' ? 'B' : 'A';
  const rows = brCoverRows(n, day), covers = {};
  for (const r of rows) { const el = document.getElementById('br-cover-in-' + r.i); if (el) covers[r.i] = el.value; }
  const text = brCoverText(document.getElementById('br-mast-school').textContent, n, day,
    document.getElementById('br-cover-date').value.trim(), rows, covers);
  const box = document.getElementById('br-cover-text'), say = document.getElementById('br-cover-say');
  box.value = text; box.hidden = false; box.focus(); box.select();
  const fallback = () => { say.textContent = 'Select the text below and copy it.'; };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => { say.textContent = 'Copied. Paste it into an email.'; }, fallback);
  } else fallback();
}

/* === Search menu === */
function brBuildOpts() {
  if (brMode === 'teacher') {
    brOpts = Object.keys(BR_TEACHERS).map(n => ({
      key:n, label:n, dept:BR_TEACHERS[n].dept,
      tag:BR_TEACHERS[n].room,
      grp:(BR_DEPT[BR_TEACHERS[n].dept]||{}).name||BR_TEACHERS[n].dept
    })).sort((a,b)=>(brOrderOf(a.dept)-brOrderOf(b.dept))||a.label.localeCompare(b.label));
  } else {
    brOpts = Object.keys(BR_SECTIONS).map(s=>({
      key:s, label:'Class '+s, dept:null,
      tag:BR_SECTIONS[s].length+' teachers',
      grp:'Grade '+s.split('-')[0]
    })).sort((a,b)=>a.key.localeCompare(b.key,undefined,{numeric:true}));
  }
}

function brRenderMenu(filter='') {
  const m = document.getElementById('br-menu');
  if (!m) return;
  const f = filter.trim().toLowerCase();
  const shown = brOpts.filter(o =>
    o.label.toLowerCase().includes(f) || (''+o.tag).toLowerCase().includes(f)
  );
  let html='', lastG=null;
  shown.forEach((o,i) => {
    if (o.grp !== lastG) { html += `<div class="grp">${o.grp}</div>`; lastG=o.grp; }
    const dot = `<span class="br-dot" style="background:${o.dept?brDColor(o.dept):'#0c4b31'}"></span>`;
    html += `<div class="opt${i===brActiveIdx?' active':''}" onmousedown="brChoose('${o.key}')">${dot}<span>${o.label}</span><span class="tag">${o.tag}</span></div>`;
  });
  m.innerHTML = html || '<div class="opt br-muted-ink">No matches</div>';
  m._shown = shown;
}

function brOpenMenu()  { brActiveIdx=-1; brRenderMenu(document.getElementById('br-search').value);
  document.getElementById('br-menu').classList.add('show'); }
function brCloseMenu() { document.getElementById('br-menu').classList.remove('show'); }
function brOnType()    { brActiveIdx=-1; brRenderMenu(document.getElementById('br-search').value);
  document.getElementById('br-menu').classList.add('show'); }
function brOnKey(e) {
  const m=document.getElementById('br-menu'); const sh=m._shown||[];
  if (e.key==='ArrowDown') { e.preventDefault(); brActiveIdx=Math.min(brActiveIdx+1,sh.length-1); brRenderMenu(document.getElementById('br-search').value); }
  else if (e.key==='ArrowUp')  { e.preventDefault(); brActiveIdx=Math.max(brActiveIdx-1,0); brRenderMenu(document.getElementById('br-search').value); }
  else if (e.key==='Enter')    { e.preventDefault(); if(sh[brActiveIdx])brChoose(sh[brActiveIdx].key); else if(sh.length===1)brChoose(sh[0].key); }
  else if (e.key==='Escape')   { brCloseMenu(); }
}
/* R60: wrapped so the published file can re-register the same handler. */
function brWireDocClick() {
  document.addEventListener('click', e => {
    if (!e.target.closest('#app-browser .searchbox')) brCloseMenu();
  });
}
brWireDocClick();
brWireTabKeys();

/* === Mode & selection === */
/* 2026-09-05: the mode switcher is a real ARIA tablist. The buttons carry role="tab"
   and the stage is the one tabpanel they all control, so brSyncTabs keeps
   aria-selected, the roving tabindex and the panel's label in step with the
   .on styling. Mirrors the visualizer's own tab bar; brSetMode calls it, and
   missing buttons are skipped so the same helper serves the published file
   (six modes) and the in-app browser (three). */
function brSyncTabs(mo) {
  const ids = { teacher:'br-mTeacher', group:'br-mGroup', compare:'br-mCompare',
                free:'br-mFree', map:'br-mMap', sub:'br-mSub' };
  const panel = document.getElementById('br-stage');
  for (const key in ids) {
    const btn = document.getElementById(ids[key]);
    if (!btn) continue;
    const on = key === mo;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.tabIndex = on ? 0 : -1;
    if (on && panel) panel.setAttribute('aria-labelledby', ids[key]);
  }
}

/* Arrow/Home/End move between the mode tabs and activate on arrival, the
   automatic-activation half of the ARIA tabs pattern. */
function brWireTabKeys() {
  const bar = document.querySelector('#app-browser .mode');
  if (!bar) return;
  bar.addEventListener('keydown', e => {
    const tabs = Array.prototype.slice.call(bar.querySelectorAll('button[role="tab"]'));
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    e.preventDefault();
    next.focus();
    next.click();
  });
}

function brSetMode(mo) {
  brMode=mo; brCurrent=null;
  brSyncTabs(mo);
  /* Path 11 P6: brSyncTabs (034's copy too) knows no Directions tab. */
  const dt = document.getElementById('br-mDir');
  if (dt) { dt.classList.toggle('on', mo==='dir'); dt.setAttribute('aria-selected', mo==='dir' ? 'true' : 'false'); dt.tabIndex = mo==='dir' ? 0 : -1; }
  if (dt && mo==='dir') document.getElementById('br-stage').setAttribute('aria-labelledby', 'br-mDir');
  const sf = document.getElementById('br-searchField');
  if (mo==='map' || mo==='dir' || mo==='sub') {
    sf.style.display='none';
    document.getElementById('br-empty').style.display='none';
    const v=document.getElementById('br-view'); v.classList.remove('show'); void v.offsetWidth;
    if (mo==='map') brRenderMap(); else if (mo==='dir') brRenderDirections(); else brRenderCover();
    v.classList.add('show');
    return;
  }
  sf.style.display='';
  document.getElementById('br-searchLabel').textContent = mo==='teacher'?'Find a teacher':'Find a student group';
  document.getElementById('br-search').placeholder = mo==='teacher'?'Type a name…':'Type a class, like 7-5…';
  document.getElementById('br-search').value='';
  document.getElementById('br-view').classList.remove('show');
  document.getElementById('br-empty').style.display='';
  brBuildOpts(); brRenderMenu();
}

function brChoose(key) {
  document.getElementById('br-search').value = brMode==='teacher' ? key : ('Class '+key);
  brCloseMenu(); brCurrent=key;
  document.getElementById('br-empty').style.display='none';
  const v=document.getElementById('br-view'); v.classList.remove('show'); void v.offsetWidth;
  if (brMode==='teacher') brRenderTeacher(key); else brRenderGroup(key);
  v.classList.add('show');
  v.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function brJumpTeacher(n) { brSetMode('teacher'); brChoose(n); }
function brJumpGroup(s)   { brSetMode('group');   brChoose(s); }

/* === Teacher view === */
function brDayRows(arr, room, day) {
  let out='';
  const bell = BR_BELL ? (day==='B' ? BR_BELL.B : BR_BELL.A) : null;
  for (let i=0; i<BR_MODCOUNT; i++) {
    const sec=arr[i]; const plan=!sec||sec==='Planning';
    const time = bell ? (bell[i]||'') : '';
    const cell=plan
      ? `<div class="cell">Planning / Intervention</div>`
      : `<div class="cell"><div class="sec">Class ${sec}</div><div class="who">Room ${room}</div></div>`;
    out += `<div class="blockrow${plan?' plan':''}"><div class="bk"><span class="n">${i+1}</span><span class="t">${BR_MOD_LABEL}</span>${time?`<span class="bt">${time}</span>`:''}</div>${cell}</div>`;
  }
  return out;
}

function brRenderTeacher(n) {
  const t=BR_TEACHERS[n]; if (!t) return;
  const col=brDColor(t.dept);
  const split=JSON.stringify(t.A)!==JSON.stringify(t.B);
  const mates=(t.co||[]).map(m=>({n:m,dept:brTDept(m)})).sort((a,b)=>(brOrderOf(a.dept)-brOrderOf(b.dept))||a.n.localeCompare(b.n));
  const deptLabel=(BR_DEPT[t.dept]||{}).name||t.dept;
  document.getElementById('br-view').innerHTML=`
   <div class="idhead">
     <div class="ibadge" style="background:${col}">${escHtml(n[0])}</div>
     <div><h2>${escHtml(n)}</h2><div class="role dcink" style="--dc:${col};--dc-ink:${brDeptInk(col)}">${escHtml(deptLabel)} · Room ${escHtml(t.room)}</div></div>
   </div>
   <p class="factline">Teaches <b>${t.sec.length} class${t.sec.length!==1?'es':''}</b>. Planning is <b>${BR_MOD_LABEL} ${t.plan}</b>.
     ${split?'A&nbsp;days and B&nbsp;days are different — both are shown below.':'A&nbsp;days and B&nbsp;days are the same.'}</p>
   <div class="days">
     <div class="daycard"><h3>${split?'A&nbsp;Day':'Every day (A &amp; B the same)'}</h3>${brDayRows(t.A,t.room,'A')}</div>
     ${split?`<div class="daycard B"><h3>B&nbsp;Day</h3>${brDayRows(t.B,t.room,'B')}</div>`:''}
   </div>
   <h3 class="block-title">Where to find you</h3>
   <p class="hint">Your classroom on the building map — tap any colored neighbor to hop to their schedule.</p>
   ${brMiniMapHTML(n)}
   <h3 class="block-title">Your classes</h3>
   <p class="hint">Tap a class to see everyone else who teaches those students.</p>
   <div class="classrow">${t.sec.map(s=>`<button class="gchip" onclick="brJumpGroup('${escJsAttr(s)}')">${escHtml(s)}</button>`).join('')}</div>
   ${mates.length>0?`
   <h3 class="block-title">Other teachers for your students</h3>
   <p class="hint">Tap a card to open that teacher's schedule.</p>
   <div class="team">${mates.map(m=>{const mc=brDColor(m.dept);const mt=BR_TEACHERS[m.n];if(!mt)return '';
     const shared=t.sec.filter(s=>(BR_SECTIONS[s]||[]).includes(m.n));
     const mdLabel=(BR_DEPT[m.dept]||{}).name||m.dept;
     return `<button class="tcard" style="border-left-color:${mc}" onclick="brJumpTeacher('${escJsAttr(m.n)}')">
       <div class="nm">${escHtml(m.n)}</div><div class="sj dcink" style="--dc:${mc};--dc-ink:${brDeptInk(mc)}">${escHtml(mdLabel)}</div>
       <div class="rm">Room ${escHtml(mt.room)} · shares ${escHtml(shared.join(', '))}</div></button>`;}).join('')}</div>`:''}
   ${brOverviewHTML()}`;
}

/* === Group view === */
function brRenderGroup(sec) {
  if (!BR_SECTIONS[sec]) return;
  const grade=sec.split('-')[0];
  const list=(BR_SECTIONS[sec]||[]).slice().sort((a,b)=>brOrderOf(brTDept(a))-brOrderOf(brTDept(b)));
  const slot = name => {
    const t=BR_TEACHERS[name]; if (!t) return {a:'—',b:'—'};
    const f = idx => idx<0?'—':`${BR_MOD_LABEL} ${idx+1}`;
    return { a:f(t.A.indexOf(sec)), b:f(t.B.indexOf(sec)) };
  };
  document.getElementById('br-view').innerHTML=`
   <div class="idhead">
     <div class="ibadge" style="background:#0c4b31">${escHtml(grade)}</div>
     <div><h2>Class ${escHtml(sec)}</h2><div class="role br-muted-ink">Grade ${escHtml(grade)} · ${list.length} teacher${list.length!==1?'s':''}</div></div>
   </div>
   <h3 class="block-title">Who teaches class ${escHtml(sec)}</h3>
   <p class="hint">Tap a name to open that teacher's full schedule.</p>
   <div class="tscroll"><table class="gtable">
     <thead><tr><th>Subject</th><th>Teacher</th><th>Room</th><th>A day</th><th>B day</th></tr></thead>
     <tbody>${list.map(name=>{const t=BR_TEACHERS[name];if(!t)return '';const c=brDColor(t.dept);const s=slot(name);
       const dLabel=(BR_DEPT[t.dept]||{}).name||t.dept;
       return `<tr><td class="subj dcink" style="--dc:${c};--dc-ink:${brDeptInk(c)}">${escHtml(dLabel)}</td>
         <td><button class="lnk" onclick="brJumpTeacher('${escJsAttr(name)}')">${escHtml(name)}</button></td>
         <td>${escHtml(t.room)}</td><td>${escHtml(s.a)}</td><td>${escHtml(s.b)}</td></tr>`;}).join('')}</tbody>
   </table></div>
   ${brGroupMapHTML(sec)}
   ${brOverviewHTML()}`;
}

/* === Staffing overview === */
function brOverviewHTML() {
  if (Object.keys(BR_TEACHERS).length===0) return '';
  const agg={};
  Object.values(BR_TEACHERS).forEach(t=>{const d=t.dept;agg[d]=agg[d]||{teachers:0,inst:0};
    agg[d].teachers++;agg[d].inst+=(t.A||[]).filter(x=>x!=='Planning').length+(t.B||[]).filter(x=>x!=='Planning').length;});
  const ord=['ELA','MATH','SCI','SS','SCI/SS'];
  const max=Math.max(1,...Object.values(agg).map(a=>a.inst));
  const rows=ord.filter(d=>agg[d]).map(d=>{const a=agg[d];const c=brDColor(d);const w=Math.round(a.inst/max*100);
    return `<div class="row"><div class="lbl dcink" style="--dc:${c};--dc-ink:${brDeptInk(c)}">${(BR_DEPT[d]||{}).name||d}</div>
      <div class="track"><div class="fill" style="width:${w}%;background:${c}">${a.inst}</div></div>
      <div class="cnt">${a.teachers} teacher${a.teachers>1?'s':''}</div></div>`;}).join('');
  return `<details class="overview"><summary>Whole-school staffing overview (optional)</summary>
    <div class="snap">${rows}<p class="note">Weekly class-blocks taught per department, across A and B days.</p></div></details>`;
}

/* === R60: dynamic blueprint mini-map (geometry-snapshot renderer) ===
   Draws BR_GEOM floors as a static SVG: hallway/staircase cells plus rooms
   colored by subject. No paths, no heat. Shared with published files. */
function brGeoFindRoom(rn) {
  if (!rn || !BR_GEOM || !Array.isArray(BR_GEOM.floors)) return null;
  for (let i = 0; i < BR_GEOM.floors.length; i++) {
    const fg = BR_GEOM.floors[i];
    if ((fg.rooms || []).some(r => r.rn === rn)) return { floorIdx: i, floor: fg };
  }
  return null;
}

function brGeoFloorSVG(fg, opts) {
  opts = opts || {};
  const px = opts.px || 26, W = fg.cols * px, H = fg.rows * px;
  const hi = opts.highlights || {};              /* { roomNumber: badgeLabel|true } */
  const clickable = opts.clickable !== false;
  let s = `<rect x="-4" y="-4" width="${W+8}" height="${H+8}" rx="10" fill="#fbfcfa" stroke="#e3eae4" stroke-width="1.5"/>`;
  for (const [c, r] of (fg.hall || []))
    s += `<rect x="${c*px}" y="${r*px}" width="${px}" height="${px}" fill="#eef2ee"/>`;
  for (const [c, r] of (fg.stair || []))
    s += `<rect x="${c*px}" y="${r*px}" width="${px}" height="${px}" fill="#d9e4da"/>`
       + `<text x="${c*px+px/2}" y="${r*px+px*0.7}" text-anchor="middle" font-size="${px*0.5}" font-family="Public Sans,sans-serif" font-weight="700" fill="#4c6355">S</text>`;
  const rings = [], badges = [];
  for (const room of (fg.rooms || [])) {
    const named = !!room.rn;
    const col = (named && room.dept) ? brDColor(room.dept) : '#9aa89f';
    const isHi = named && (room.rn in hi);
    const teacher = named ? BR_ROOM2TEACHER[room.rn] : null;
    const canClick = clickable && !!teacher;
    let cellsSvg = '', minC = Infinity, minR = Infinity, maxC = -1, maxR = -1;
    for (const [c, r] of room.cells) {
      cellsSvg += `<rect x="${c*px+1}" y="${r*px+1}" width="${px-2}" height="${px-2}" rx="3" fill="${col}" fill-opacity="${isHi?0.38:(named?0.16:0.08)}"/>`;
      if (c < minC) minC = c; if (r < minR) minR = r;
      if (c > maxC) maxC = c; if (r > maxR) maxR = r;
    }
    const bx = minC*px, by = minR*px, bw = (maxC-minC+1)*px, bh = (maxR-minR+1)*px;
    const fs = named ? Math.max(8, Math.min(px*0.42, (bw-6)/Math.max(1, room.rn.length)*1.65)) : 0;
    const label = named
      ? `<text x="${bx+bw/2}" y="${by+bh/2+fs*0.36}" text-anchor="middle" font-size="${fs}" font-family="Public Sans,sans-serif" font-weight="600" fill="#3c4a42">${escHtml(room.rn)}</text>`
      : '';
    const click = canClick ? ` onclick="brJumpTeacher('${escJsAttr(teacher)}')"` : '';
    s += `<g class="geo-room${canClick?' live':''}"${click}>${cellsSvg}${label}${canClick?`<title>${escHtml(teacher)} · ${escHtml(room.rn)}</title>`:''}</g>`;
    if (isHi) {
      rings.push(`<rect x="${bx-2.5}" y="${by-2.5}" width="${bw+5}" height="${bh+5}" rx="6" fill="none" stroke="${col}" stroke-width="3"/>`);
      const badge = hi[room.rn];
      if (badge && badge !== true) {
        const btxt = String(badge);
        const bwid = Math.max(34, btxt.length*px*0.27 + 14);
        const byTop = (by - px*0.78 < -px) ? (by + bh + 4) : (by - px*0.78);
        badges.push(`<g><rect x="${bx+bw/2-bwid/2}" y="${byTop}" width="${bwid}" height="${px*0.62}" rx="${px*0.31}" fill="${col}"/>`
                  + `<text x="${bx+bw/2}" y="${byTop+px*0.44}" text-anchor="middle" font-size="${px*0.36}" font-family="Public Sans,sans-serif" font-weight="700" fill="#fff">${btxt}</text></g>`);
      }
    }
  }
  s += rings.join('') + badges.join('');
  /* min-width, not just width:100%. .mapscroll is overflow-x:auto and could
     never scroll, because width:100% told the SVG to shrink to whatever it
     was given. On a 375px phone that squeezed a whole floor into 375px and
     drew the room numbers about 4px tall. Checking a room assignment on a
     phone is the main thing anyone does with a published file, so that was
     the wrong end of the trade to lose.

     The floor is the drawing's own width: `px` user units per cell is the
     scale the labels were sized for, so 1:1 is where they stop being
     readable. It is handed over as a custom property rather than as
     min-width, and .geoplan only applies it below 900px — see the media
     query in BR_CSS. Wide screens keep shrink-to-fit, because seeing a whole
     floor at once is the thing the desktop map is for and East Middle's is
     wider than the panel. Narrow screens scroll instead of squinting. */
  const vbW = W + 16;
  return `<svg class="geoplan" viewBox="-8 -${px+6} ${vbW} ${H+px+18}" `
       + `style="width:100%;--geo-w:${vbW}px" `
       + `xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

/* === Building map (legacy hardcoded geometry — live-app fallback only) === */
const BR_A_TPL=[
 [18,14,156,80,'A108','A208'],[178,22,26,64,'A108A','A208A'],[210,14,126,80,'A109','A209'],[344,16,42,64,'S001','S001'],
 [18,110,104,86,'A107','A207'],[18,202,104,86,'A106','A206'],[18,294,104,86,'A104','A204'],
 [18,386,104,86,'A103','A202'],[18,478,104,104,'A101','A201'],
 [156,110,88,120,'A105','A205'],[156,238,88,150,'A100','200B'],[156,396,88,84,'A102','A203'],
 [156,488,88,66,'A115','DA-1'],[156,560,88,22,'A116','A215'],
 [256,110,100,92,'A110','A210'],[256,210,100,82,'A111','A211'],
 [256,300,100,82,'A112','A212'],[256,390,100,92,'A113','A213'],[256,490,100,92,'A114','A214'],
 [362,496,34,86,'S002','S002']
];
const brAR = idx => BR_A_TPL.map(r=>({x:r[0],y:r[1],w:r[2],h:r[3],id:r[idx]}));
const brCR = arr => arr.map(r=>({x:r[0],y:r[1],w:r[2],h:r[3],id:r[4]}));
const BR_WINGS={
  A1:{w:404,h:600,rooms:brAR(4)},
  A2:{w:404,h:600,rooms:brAR(5)},
  C2:{w:768,h:372,rooms:brCR([
    [116,14,116,86,'C204'],[238,14,116,86,'C203'],[360,14,116,86,'C202'],[482,14,132,86,'C201'],
    [14,106,92,42,'S004'],[14,154,92,78,'C205'],[14,238,92,28,'C205A'],
    [116,110,78,150,'C214'],[200,110,96,150,'C-WORK'],[384,110,72,150,'C213'],[462,110,66,150,'C212'],[534,110,80,150,'C211'],
    [14,272,140,86,'C206'],[160,272,116,86,'C207'],[282,272,116,86,'C208'],[404,272,116,86,'C209'],[526,272,112,86,'C210'],[650,272,108,86,'B201']
  ])}
};
const BR_CTXLABEL={S001:'Stairs',S002:'Stairs',S004:'Stairs',A105:'Workroom',A205:'Workroom',C214:'Workroom',
  'A100':'','200B':'','C-WORK':'',A116:'Elev',A215:'Elev','DA-1':'Office',A108A:'',A208A:'',A104A:'',A204A:'',A111A:'',A211A:''};
const brWingOf=room=>{if(!room)return null;for(const w of['A1','A2','C2'])if(BR_WINGS[w].rooms.some(r=>r.id===room))return w;return null;};
const brFloorOfWing=w=>w==='A1'?'f1':'f2';

function brRoomCellSVG(r, opts) {
  opts=opts||{};
  const t=BR_ROOM2TEACHER[r.id]; const cx=r.x+r.w/2;
  if (!t) {
    const named=(r.id in BR_CTXLABEL)&&BR_CTXLABEL[r.id]!=='';
    let inner='';
    if (named) {
      inner=`<text class="rnote" x="${cx}" y="${r.y+r.h/2+(r.h>70?-2:3)}" text-anchor="middle" font-size="10">${BR_CTXLABEL[r.id]}</text>`
           +(r.h>70?`<text class="rid" x="${cx}" y="${r.y+r.h/2+12}" text-anchor="middle" font-size="9">${r.id}</text>`:'');
    } else { inner=!(r.id in BR_CTXLABEL)?`<text class="rid" x="${cx}" y="${r.y+r.h/2+4}" text-anchor="middle" font-size="${r.w<40?8:10}">${r.id}</text>`:''; }
    return `<g class="rcell ctx"><rect class="rbox" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6"/>${inner}</g>`;
  }
  const dep=BR_TEACHERS[t]?BR_TEACHERS[t].dept:'ELA', col=brDColor(dep);
  const here=opts.highlight===true, live=opts.live!==false;
  const nameSize=r.w<92?12:13.5, subSize=r.w<92?9:9.5;
  const cyName=r.y+r.h/2-3, cySub=r.y+r.h/2+12;
  const ring=here?`<rect class="ring" x="${r.x-3}" y="${r.y-3}" width="${r.w+6}" height="${r.h+6}" rx="9"/>`:'';
  return `<g class="rcell${live?' live':''}${here?' here':''}" style="--rc:${col}"${live?` onclick="brJumpTeacher('${t}')"`:''}>\
<rect class="rbox" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="${col}" fill-opacity="${here?0.30:0.13}" stroke="${col}"/>\
<rect class="racc" x="${r.x}" y="${r.y+6}" width="5" height="${Math.max(8,r.h-12)}" rx="2.5" fill="${col}"/>\
<text class="rname" x="${cx}" y="${cyName}" text-anchor="middle" font-size="${nameSize}" font-family="Fraunces,serif" font-weight="600" fill="#283831">${t}</text>\
<text class="rsub" x="${cx}" y="${cySub}" text-anchor="middle" font-size="${subSize}" font-family="Public Sans,sans-serif" font-weight="600" fill="${col}">${r.id} · ${brDShort(dep)}</text>\
${ring}</g>`;
}

function brWingInner(wing, dx, dy, opts) {
  opts=opts||{};
  const cells=BR_WINGS[wing].rooms.map(r=>brRoomCellSVG(r,{highlight:opts.highlight===r.id,live:opts.highlight!==r.id})).join('');
  return `<g transform="translate(${dx},${dy})">${cells}</g>`;
}

function brBuildFloorSVG(floor) {
  if (floor==='f1') {
    return `<svg class="floorplan" viewBox="-16 -14 436 632" style="width:100%;min-width:430px;max-width:560px;margin:0 auto" xmlns="http://www.w3.org/2000/svg">
      <rect x="-8" y="-6" width="420" height="616" rx="14" fill="#fff" stroke="#e3eae4" stroke-width="1.5"/>
      ${brWingInner('A1',0,0,{})}
      <text class="corridor-t" x="208" y="600" text-anchor="middle">↑ stairs lead to the A-wing 2nd floor</text>
    </svg>`;
  }
  const aDX=812,aDY=40,cDX=20,cDY=362;
  return `<svg class="floorplan" viewBox="0 0 1252 748" style="width:100%;min-width:980px" xmlns="http://www.w3.org/2000/svg">
    <rect x="${cDX-8}" y="${cDY-6}" width="786" height="384" rx="14" fill="#fff" stroke="#e3eae4" stroke-width="1.5"/>
    <rect x="${aDX-8}" y="${aDY-6}" width="420" height="616" rx="14" fill="#fff" stroke="#e3eae4" stroke-width="1.5"/>
    <text x="${cDX+370}" y="${cDY-16}" text-anchor="middle" font-size="15" letter-spacing="2" font-family="Fraunces,serif" font-weight="600" fill="#0c4b31" opacity=".85">C WING</text>
    <text x="${aDX+200}" y="${aDY-16}" text-anchor="middle" font-size="15" letter-spacing="2" font-family="Fraunces,serif" font-weight="600" fill="#0c4b31" opacity=".85">A WING</text>
    <rect class="corridor" x="760" y="${cDY+44}" width="${aDX+18-760}" height="58" rx="6" fill="#f1f5f1" stroke="#dbe4dd" stroke-width="1.4"/>
    <text class="corridor-t" x="${(760+aDX+18)/2}" y="${cDY+78}" text-anchor="middle">200 CORR.</text>
    ${brWingInner('C2',cDX,cDY,{})}
    ${brWingInner('A2',aDX,aDY,{})}
  </svg>`;
}

function brBuildMiniSVG(wing, room) {
  const W=BR_WINGS[wing];
  return `<svg class="floorplan" viewBox="-12 -12 ${W.w+24} ${W.h+24}" style="width:100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="-6" y="-6" width="${W.w+12}" height="${W.h+12}" rx="12" fill="#fff" stroke="#e6ece7" stroke-width="1.5"/>
    ${brWingInner(wing,0,0,{highlight:room})}
  </svg>`;
}

function brMiniMapHTML(name) {
  const t = BR_TEACHERS[name]; if (!t) return '';
  const col = brDColor(t.dept);
  const loc = brGeoFindRoom(t.room);
  if (!loc) {
    const hasGeo = BR_GEOM && BR_GEOM.floors && BR_GEOM.floors.length;
    return `<div class="mini-wrap"><div class="mini-side" style="flex:1 1 100%">
      <div><div class="roomtag dcink" style="--dc:${col};--dc-ink:${brDeptInk(col)}">${escHtml(t.room)}</div><div class="floortag">Location not mapped</div></div>
      <div class="offmap">Room <b>${escHtml(t.room)}</b> isn't on the blueprint floor plan${hasGeo?'':' — no blueprint data is available'}.</div>
      ${hasGeo?`<button class="btn-map" onclick="brSetMode('map')">Open building map</button>`:''}</div></div>`;
  }
  const hiOne = {}; hiOne[t.room] = true;
  return `<div class="mini-wrap">
    <div class="mini-card"><div class="mhd">${escHtml(loc.floor.label)}</div><div class="msvg">${brGeoFloorSVG(loc.floor,{highlights:hiOne})}</div></div>
    <div class="mini-side">
      <div><div class="roomtag dcink" style="--dc:${col};--dc-ink:${brDeptInk(col)}">${escHtml(t.room)}</div><div class="floortag">${escHtml(loc.floor.label)}</div></div>
      <div class="where">You're <b>highlighted</b> here. Colored rooms with teachers are clickable.</div>
      <button class="btn-map" onclick="brOpenMapFloorIdx(${loc.floorIdx})">See the whole floor</button>
    </div></div>`;
}

/* R60: group-view mini-map — every room the class visits, badged by mod/time. */
function brGroupMapHTML(sec) {
  const gr = BR_GROUPROOMS[sec];
  if (!gr || !BR_GEOM || !BR_GEOM.floors || !BR_GEOM.floors.length) return '';
  const bHasData = Array.isArray(gr.B) && gr.B.some(Boolean);
  const abDiff = bHasData && JSON.stringify(gr.A) !== JSON.stringify(gr.B);
  const day = (brGrpDay === 'B' && bHasData) ? 'B' : 'A';
  const rooms = (day === 'B' ? gr.B : gr.A) || [];
  const perFloor = {};
  rooms.forEach((rn, i) => {
    if (!rn) return;
    const loc = brGeoFindRoom(rn); if (!loc) return;
    const time = BR_BELL ? ((day === 'B' ? BR_BELL.B : BR_BELL.A)[i] || '') : '';
    const lbl = `${BR_MOD_LABEL} ${i+1}${time ? ' · ' + time : ''}`;
    const m = perFloor[loc.floorIdx] || (perFloor[loc.floorIdx] = {});
    m[rn] = m[rn] ? (m[rn] + ' + ' + (i+1)) : lbl;   /* revisited room: append mod # */
  });
  const idxs = Object.keys(perFloor).map(Number).sort((a,b)=>a-b);
  if (!idxs.length) return '';
  const maps = idxs.map(fi => {
    const fg = BR_GEOM.floors[fi];
    return `<div class="mini-card"><div class="mhd">${escHtml(fg.label)}</div><div class="msvg">${brGeoFloorSVG(fg,{highlights:perFloor[fi]})}</div></div>`;
  }).join('');
  const toggle = abDiff
    ? `<div class="daychips"><button class="${day==='A'?'on':''}" onclick="brSetGrpDay('A')">A Day</button><button class="${day==='B'?'on':''}" onclick="brSetGrpDay('B')">B Day</button></div>`
    : '';
  return `<h3 class="block-title">Where this class goes</h3>
   <p class="hint">Every room class ${escHtml(sec)} visits on a${day==='B'?' B':'n A'} day, labeled by ${BR_MOD_LABEL.toLowerCase()}${BR_BELL?' and time':''}. Tap a room to open that teacher's schedule.</p>
   ${toggle}<div class="groupmaps">${maps}</div>`;
}
function brSetGrpDay(d) { brGrpDay = d; if (brMode === 'group' && brCurrent) brRenderGroup(brCurrent); }

function brOpenMapFloor(f) { brMapFloor=f; brSetMode('map'); }
function brSetMapFloor(f)  { brMapFloor=f; brRenderMap(); }

/* R60: map mode dispatcher — dynamic blueprint geometry when available,
   legacy hardcoded wings as live-app fallback (excluded from published files,
   hence the typeof guard). */
function brOpenMapFloorIdx(i) { brMapFloorIdx = i; brSetMode('map'); }
function brSetMapFloorIdx(i)  { brMapFloorIdx = i; brRenderMap(); }

function brRenderMap() {
  if (BR_GEOM && BR_GEOM.floors && BR_GEOM.floors.length) { brRenderMapDyn(); return; }
  if (typeof BR_WINGS !== 'undefined') { brRenderMapLegacy(); return; }
  document.getElementById('br-view').innerHTML =
    '<div class="br-empty"><div class="big">No building map available.</div>' +
    '<div>No blueprint geometry was included with this schedule data.</div></div>';
}

function brRenderMapDyn() {
  if (brMapFloorIdx >= BR_GEOM.floors.length) brMapFloorIdx = 0;
  const fg = BR_GEOM.floors[brMapFloorIdx];
  const legend = Object.keys(BR_DEPT).map(d =>
    `<span class="lg"><span class="sw" style="background:${brDColor(d)}"></span>${(BR_DEPT[d]||{}).name||d}</span>`).join('')
    + `<span class="lg"><span class="sw ctx"></span>Other spaces</span>`;
  const tabs = BR_GEOM.floors.length > 1
    ? `<div class="floortabs">${BR_GEOM.floors.map((f,i)=>`<button class="${i===brMapFloorIdx?'on':''}" onclick="brSetMapFloorIdx(${i})">${f.label}</button>`).join('')}</div>`
    : '';
  document.getElementById('br-view').innerHTML = `
   <div class="maptop">
     <div><h2>Building Map</h2><div class="role">${fg.label}</div></div>
     ${tabs}
   </div>
   <p class="maphint">Rooms are colored by subject. <b>Tap a room</b> with an assigned teacher to open their schedule.</p>
   <div class="maplegend">${legend}</div>
   <div class="mapscroll">${brGeoFloorSVG(fg,{})}</div>`;
}

function brRenderMapLegacy() {
  const f=brMapFloor;
  const title=f==='f1'?'First Floor':'Second Floor';
  const sub=f==='f1'?'A&nbsp;Wing · Room A100s':'A&nbsp;Wing (A200s) + C&nbsp;Wing (C200s)';
  const legend=['ELA','MATH','SCI','SS','SCI/SS'].map(d=>
    `<span class="lg"><span class="sw" style="background:${brDColor(d)}"></span>${(BR_DEPT[d]||{}).name||d}</span>`).join('')
    +`<span class="lg"><span class="sw ctx"></span>Other spaces</span>`;
  document.getElementById('br-view').innerHTML=`
   <div class="maptop">
     <div><h2>Building Map</h2><div class="role">${title} · ${sub}</div></div>
     <div class="floortabs">
       <button class="${f==='f1'?'on':''}" onclick="brSetMapFloor('f1')">1st Floor · A</button>
       <button class="${f==='f2'?'on':''}" onclick="brSetMapFloor('f2')">2nd Floor · A + C</button>
     </div>
   </div>
   <p class="maphint">Every classroom shows its assigned teacher. <b>Tap a colored room</b> to open their schedule.</p>
   <div class="maplegend">${legend}</div>
   <div class="mapscroll">${brBuildFloorSVG(f)}</div>`;
}

/* === R60: Publish for Teachers ===================================
   Exports a standalone, read-only Schedule Browser HTML file with all
   schedule data + blueprint geometry baked in as PUBLISHED_DATA. Assembly
   uses Function.prototype.toString() on an explicit allowlist of shared
   functions — no DOM scraping, no eval in the live app, and zero references
   to live-sync functions (brLoadFromVisualizer / AppState / getSubjects /
   toggleApp) or localStorage in the published output. Live-only. */

function brEscHTML(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Shared browser runtime: every function the published file needs. Order
   matters only for readability — all are hoisted declarations except the
   arrow-const helpers, which are emitted separately below. */
function brPublishFnList() {
  return [
    brBuildOpts, brRenderMenu, brOpenMenu, brCloseMenu, brOnType, brOnKey,
    brWireDocClick, brSyncTabs, brWireTabKeys, brSetMode, brChoose, brJumpTeacher, brJumpGroup,
    brDayRows, brRenderTeacher, brRenderGroup, brOverviewHTML,
    brGeoFindRoom, brGeoFloorSVG, brMiniMapHTML, brGroupMapHTML, brSetGrpDay,
    brOpenMapFloorIdx, brSetMapFloorIdx, brRenderMap, brRenderMapDyn,
    brFormatDateLong, brCheckStaleness,
    brCheckSchedule, brReadSchedule, brUseSchedule, brPickScheduleFile, brOpenScheduleFile,
    brDirGraph, brDirRoute, brDirSteps, brRenderDirections, brShowRoute, brDirMapsHTML,
    brCoverRows, brCoverText, brRenderCover, brShowCover, brCopyCover
  ];
}

/* opts.canOpen (Settings → Publishing, Path 11 P6): show "Open a newer
   schedule…". Off, the button is in the file but hidden. opts.directions:
   a fourth tab, Directions. Off, there is no such tab (a hidden one would
   still be a stop for brWireTabKeys's arrow keys). opts.subPlan: a Sub Plan
   tab, left out the same way when off. It is mode 'sub', whose tab id
   br-mSub brSyncTabs (034's copy too) already knows. */
function brBuildPublishedMarkup(school, dateStr, opts) {
  const esc = brEscHTML(school);
  const canOpen = !!(opts && opts.canOpen);
  const directions = !!(opts && opts.directions);
  const subPlan = !!(opts && opts.subPlan);
  return `<div id="app-browser">
  <div class="br-wrap">
    <header class="mast">
      <div class="seal" id="br-mast-initial">${esc.charAt(0) || 'S'}</div>
      <div>
        <h1 id="br-mast-school">${esc}</h1>
        <p class="sub">Teacher Schedule Browser</p>
      </div>
    </header>
    <div id="br-stale-banner" class="stale-banner" role="note"></div>
    <div class="panel">
      <div class="toolbar">
        <div class="mode" role="tablist" aria-label="Schedule view">
          <button id="br-mTeacher" class="on" role="tab" aria-selected="true"  aria-controls="br-stage" tabindex="0"  onclick="brSetMode('teacher')">By Teacher</button>
          <button id="br-mGroup"   role="tab" aria-selected="false" aria-controls="br-stage" tabindex="-1" onclick="brSetMode('group')">By Student Group</button>
          <button id="br-mMap"     role="tab" aria-selected="false" aria-controls="br-stage" tabindex="-1" onclick="brSetMode('map')">Building Map</button>${directions ? `
          <button id="br-mDir"     role="tab" aria-selected="false" aria-controls="br-stage" tabindex="-1" onclick="brSetMode('dir')">Directions</button>` : ''}${subPlan ? `
          <button id="br-mSub"     role="tab" aria-selected="false" aria-controls="br-stage" tabindex="-1" onclick="brSetMode('sub')">Sub Plan</button>` : ''}
        </div>
        <div class="br-field" id="br-searchField">
          <label id="br-searchLabel" for="br-search">Find a teacher</label>
          <div class="searchbox">
            <input id="br-search" type="text" autocomplete="off" placeholder="Type a name…"
              oninput="brOnType()" onfocus="brOpenMenu()" onkeydown="brOnKey(event)">
            <div id="br-menu" class="br-menu"></div>
          </div>
        </div>
        <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
        <button class="btn-print" id="br-open-btn" type="button" onclick="brPickScheduleFile()"${canOpen ? '' : ' hidden'}>Open a newer schedule…</button>
        <input id="br-open-file" type="file" accept=".html,.htm,.json,text/html,application/json" hidden onchange="brOpenScheduleFile(this)">
      </div>
      <div id="br-open-note" class="br-open-note" role="status" hidden><span id="br-open-text"></span>
        <button class="lnk" id="br-open-back" type="button" hidden onclick="brUseSchedule(PUBLISHED_DATA, '')">Back to this file's own schedule</button></div>
      <div class="stage" id="br-stage" role="tabpanel" tabindex="0" aria-labelledby="br-mTeacher">
        <div id="br-empty" class="br-empty">
          <div class="big" id="br-empty-title">Pick a name to see a schedule.</div>
          <div id="br-empty-sub">Or switch to <b>By Student Group</b> to see every teacher a class shares.</div>
        </div>
        <div id="br-view" class="br-view"></div>
      </div>
    </div>
    <p class="footnote">Published ${dateStr} from the School Layout Visualizer ${TOOL_VERSION}. This file is a read-only snapshot — republish to update.</p>
  </div>
</div>`;
}

/* The local calendar date as YYYY-MM-DD. toISOString() gives the UTC date,
   so a file published after 8 pm eastern was dated tomorrow, beside a
   footnote saying today, and read back as local midnight by the banner. */
function brLocalISODate(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function brBuildPublishedHTML() {
  /* Refresh every snapshot from the live app immediately before assembly. */
  brLoadFromVisualizer();
  const school  = (AppState.settings.schoolName || 'Schedule Browser').trim() || 'Schedule Browser';
  const now     = new Date();
  const dateStr = now.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });
  const iso     = brLocalISODate(now);

  /* format and tool: the published data's contract (Path 11 P1,
     Tools/schedule-visualizer/test/published-contract.mjs). A file with no format is
     format 0, which is every file published up to v61. */
  const data = {
    format: 1, tool: TOOL_VERSION,
    school, publishedOn: iso,
    dept: BR_DEPT, order: BR_ORDER,
    teachers: BR_TEACHERS, sections: BR_SECTIONS, room2teacher: BR_ROOM2TEACHER,
    groupRooms: BR_GROUPROOMS, modCount: BR_MODCOUNT, modLabel: BR_MOD_LABEL,
    bell: BR_BELL,
    /* Path 11 P6: door cells and staircase pairs only when the publisher ticked "show directions". */
    geometry: AppState.settings.publishDirections ? brRouteGeometry(BR_GEOM, AppState.blueprint, AppState.settings) : BR_GEOM
  };

  const consts = [
    'const BR_LEGACY_SHORT = ' + JSON.stringify(BR_LEGACY_SHORT) + ';',
    'const BR_DEPT_FALLBACK = ' + JSON.stringify(BR_DEPT_FALLBACK) + ';',
    'const brDColor = '  + brDColor.toString()  + ';',
    'const brDeptInk = ' + brDeptInk.toString() + ';',
    'const brTDept = '   + brTDept.toString()   + ';',
    'const brDShort = '  + brDShort.toString()  + ';',
    'const brOrderOf = ' + brOrderOf.toString() + ';',
    /* brDayRows/brRenderTeacher/brRenderGroup/brMiniMapHTML/brGroupMapHTML/
       brGeoFloorSVG/brOverviewHTML (all published via brPublishFnList() below)
       call these two unprefixed — they're the app-wide escaping helpers, not
       br-specific ones. Without them here the published file throws a
       ReferenceError the instant anyone opens a teacher or group: this was
       missing (see BACKLOG.md / HISTORY.md, Round 7). */
    'const escHtml = '   + escHtml.toString()   + ';',
    'const escJsAttr = ' + escJsAttr.toString() + ';',
    'const BR_STALE_DAYS = ' + BR_STALE_DAYS + ';',
    'const BR_READS_FORMAT = ' + BR_READS_FORMAT + ';'
  ].join('\n');

  const js = [
    "'use strict';",
    '/* Published by the School Layout Visualizer — read-only schedule snapshot. */',
    /* Every < written \u003c, so a name holding a closing script tag (it can
       arrive in an imported project or a hand-off) cannot end this script. */
    'const PUBLISHED_DATA = ' + JSON.stringify(data).replace(/</g, '\\u003c') + ';',
    'let BR_DEPT = PUBLISHED_DATA.dept, BR_ORDER = PUBLISHED_DATA.order;',
    consts,
    'let BR_TEACHERS = PUBLISHED_DATA.teachers, BR_SECTIONS = PUBLISHED_DATA.sections,',
    '    BR_ROOM2TEACHER = PUBLISHED_DATA.room2teacher, BR_MODCOUNT = PUBLISHED_DATA.modCount,',
    '    BR_MOD_LABEL = PUBLISHED_DATA.modLabel;',
    'let BR_GROUPROOMS = PUBLISHED_DATA.groupRooms || {}, BR_BELL = PUBLISHED_DATA.bell,',
    '    BR_GEOM = PUBLISHED_DATA.geometry;',
    "let brMode = 'teacher', brCurrent = null, brActiveIdx = -1, brOpts = [];",
    "let brGrpDay = 'A', brMapFloorIdx = 0;",
    'let brData = PUBLISHED_DATA;',
    brPublishFnList().map(f => f.toString()).join('\n\n'),
    'brWireDocClick();',
    'brWireTabKeys();',
    'brBuildOpts();',
    'brRenderMenu();',
    'brCheckStaleness();',
    'if (!Object.keys(BR_TEACHERS).length) {',
    "  document.getElementById('br-empty-title').textContent = 'No schedule data in this file.';",
    "  document.getElementById('br-empty-sub').textContent = 'Ask the publisher to re-export after adding rooms and groups.';",
    '}'
  ].join('\n');

  /* Fonts go in as base64 @font-face, not as a Google Fonts link.
     A published file is downloaded and emailed to staff: it has no folder
     next to it, so a relative path is impossible, and a hotlink means it
     renders in Times New Roman on any machine behind a filter that blocks
     Google Fonts — which is most school wifi. Roughly 100 KB, from
     schedule-visualizer/fonts/published-fonts.js.

     If that script did not load, fall back to a system stack. Never fall back
     to a hotlink: the whole point is that a published file reaches for
     nothing. */
  const fontCss = (typeof window.BR_PUBLISHED_FONT_CSS === 'string' && window.BR_PUBLISHED_FONT_CSS)
    ? window.BR_PUBLISHED_FONT_CSS
    : '/* schedule-visualizer/fonts/published-fonts.js did not load; using system fonts */\n'
      + "#app-browser{font-family:system-ui,-apple-system,'Segoe UI',sans-serif}\n"
      + "#app-browser .mast h1,#app-browser .idhead h2,#app-browser .block-title,"
      + "#app-browser .tcard .nm,#app-browser .maptop h2{font-family:Georgia,'Times New Roman',serif}\n";
  if (typeof window.BR_PUBLISHED_FONT_CSS !== 'string') {
    console.warn('[Browser] published-fonts.js missing — publishing with system fonts.');
  }

  const css = fontCss + '\n'
    + BR_CSS
    + '\n/* published overrides */\n'
    + '#app-browser{display:block}\n'
    /* <body> carries the page colour on its own so it propagates to the
       canvas, which leaves the theme one element to repaint instead of two;
       the colour itself is var(--br-page), set on body.br-published in
       BR_CSS. */
    + 'html,body{margin:0;padding:0}\n';

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
    + '<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>' + brEscHTML(school) + ' — Schedule Browser</title>\n'
    + '<style>\n' + css + '\n</style>\n</head>\n<body class="br-published">\n'
    + brBuildPublishedMarkup(school, dateStr, { canOpen: !!AppState.settings.publishCanOpen,
      directions: !!AppState.settings.publishDirections, subPlan: !!AppState.settings.publishSubPlan })
    + '\n<script>\n' + js + '\n<\/script>\n</body>\n</html>\n';
}

function brPublish() {
  try {
    const html   = brBuildPublishedHTML();
    const school = (AppState.settings.schoolName || 'School').trim() || 'School';
    const safe   = school.replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '_') || 'School';
    const iso    = brLocalISODate(new Date());
    const blob   = new Blob([html], { type: 'text/html' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url;
    a.download = `Schedule_Browser_${safe}_${iso}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if (typeof showToast === 'function') showToast('Published: ' + a.download, 'success');
  } catch (e) {
    console.error('[Browser] publish failed:', e);
    if (typeof showToast === 'function') showToast('Publish failed: ' + e.message, 'error');
    else alert('Publish failed: ' + e.message);
  }
}

function brCopyPublishedHTML() {
  try {
    const html = brBuildPublishedHTML();
    navigator.clipboard.writeText(html).then(() => {
      if (typeof showToast === 'function') showToast('Publish HTML copied to clipboard', 'success');
    }, (e) => {
      console.error('[Browser] copy failed:', e);
      if (typeof showToast === 'function') showToast('Copy failed: ' + e.message, 'error');
      else alert('Copy failed: ' + e.message);
    });
  } catch (e) {
    console.error('[Browser] copy failed:', e);
    if (typeof showToast === 'function') showToast('Copy failed: ' + e.message, 'error');
    else alert('Copy failed: ' + e.message);
  }
}

/* ===== END SCHEDULE BROWSER JS ===== */

export {
  toggleApp, brSyncDeptFromSettings, brDeptInk, brDeriveScheduleData, brSnapshotBell,
  brBuildGeometrySnapshot, brLoadFromVisualizer, brFormatDateLong, brCheckStaleness, brBuildOpts,
  brRenderMenu, brOpenMenu, brCloseMenu, brOnType, brOnKey, brWireDocClick, brSyncTabs, brWireTabKeys,
  brSetMode, brChoose, brJumpTeacher, brJumpGroup, brDayRows, brRenderTeacher, brRenderGroup, brOverviewHTML,
  brGeoFindRoom, brGeoFloorSVG, brRoomCellSVG, brWingInner, brBuildFloorSVG, brBuildMiniSVG, brMiniMapHTML,
  brGroupMapHTML, brSetGrpDay, brOpenMapFloor, brSetMapFloor, brOpenMapFloorIdx, brSetMapFloorIdx,
  brRenderMap, brRenderMapDyn, brRenderMapLegacy, brEscHTML, brPublishFnList, brBuildPublishedMarkup,
  brLocalISODate, brBuildPublishedHTML, brPublish, brCopyPublishedHTML, BR_CSS, BR_LEGACY_SHORT,
  BR_DEPT_FALLBACK, BR_STALE_DAYS, brDColor, brTDept, brDShort, brOrderOf, BR_A_TPL, brAR, brCR, BR_WINGS,
  BR_CTXLABEL, brWingOf, brFloorOfWing, brCheckSchedule, brReadSchedule, brUseSchedule, brPickScheduleFile,
  brOpenScheduleFile, BR_READS_FORMAT, brRouteGeometry, brDirGraph, brDirRoute, brDirSteps, brRenderDirections,
  brShowRoute, brDirMapsHTML, brCoverRows, brCoverText, brRenderCover, brShowCover, brCopyCover
};
