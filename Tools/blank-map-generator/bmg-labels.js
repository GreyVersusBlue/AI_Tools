// bmg-labels.js — draggable, editable text labels anchored to stage
// (map-pixel) coordinates. Labels render as plain DOM nodes positioned in
// screen space via viewer.stageToScreen() and repositioned on every
// pan/zoom, so their on-screen size stays constant and readable instead of
// scaling with the map. Each label also carries its own optional color,
// size, and bold/italic flags (parity with what markers got in
// bmg-markers.js) — but unlike markers, labels aren't grouped by style in
// a shared legend (each one already shows its own text on the map), so
// style controls live inline on the label itself while it's being edited
// rather than in a toolbar or legend row.

import { PALETTE, colorHex } from "./bmg-colors.js";

export const LABEL_COLORS = PALETTE;
export const labelColorHex = colorHex;

export const LABEL_SIZES = [
  { key: "small", label: "S", rem: 0.7 },
  { key: "medium", label: "M", rem: 0.8 },
  { key: "large", label: "L", rem: 0.95 },
];
export const DEFAULT_LABEL_SIZE = "medium";

export function labelFontSizeRem(size) {
  return (LABEL_SIZES.find(s => s.key === size) || LABEL_SIZES[1]).rem;
}

export function labelFontSizePx(size) {
  return labelFontSizeRem(size) * 16;
}

export function createLabelLayer(layerEl, viewer, { onChange, onQuizChange } = {}) {
  let labels = [];
  const nodes = new Map(); // id -> element
  let selectedId = null; // for keyboard-nudge — see select()/nudge()
  // Self-check quiz mode: while on, every label's text is hidden until
  // clicked (dragging/editing/deleting are disabled so it stays a read-only
  // study view). `revealed` tracks which labels the student has tapped so
  // far this round — session-only, never saved with the project.
  let quizMode = false;
  const revealed = new Set();

  function newId() {
    return crypto.randomUUID ? crypto.randomUUID() : `lbl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  function setLabels(list) {
    labels = list;
    selectedId = null;
    revealed.clear();
    reconcile();
  }

  /** Turns self-check quiz mode on/off — clears any previously revealed labels so a fresh round starts fully hidden. */
  function setQuizMode(on) {
    quizMode = !!on;
    revealed.clear();
    if (quizMode) deselect();
    nodes.forEach((node, id) => applyQuizState(node, id));
    onQuizChange?.(getQuizProgress());
  }

  function isQuizMode() { return quizMode; }

  /** Shows/re-hides one label's text — called when its node is clicked in quiz mode. */
  function toggleReveal(id) {
    if (revealed.has(id)) revealed.delete(id);
    else revealed.add(id);
    const node = nodes.get(id);
    if (node) applyQuizState(node, id);
    onQuizChange?.(getQuizProgress());
  }

  /** Labels that can actually be quizzed on — an empty label has nothing to hide or guess. */
  function quizzableLabels() {
    return labels.filter(l => l.text);
  }

  function getQuizProgress() {
    const total = quizzableLabels().length;
    return { total, revealed: quizzableLabels().filter(l => revealed.has(l.id)).length };
  }

  /**
   * Reveals one still-hidden label at random and returns it (or null if all
   * are already showing). This is what makes quiz mode work on a projector
   * for whole-class review: the teacher drives the round from a button
   * instead of hunting for the next unrevealed label on screen, and the
   * random pick means the same map gives a different sequence every time.
   */
  function revealNext() {
    const hidden = quizzableLabels().filter(l => !revealed.has(l.id));
    if (!hidden.length) return null;
    const pick = hidden[Math.floor(Math.random() * hidden.length)];
    revealed.add(pick.id);
    const node = nodes.get(pick.id);
    if (node) applyQuizState(node, pick.id);
    onQuizChange?.(getQuizProgress());
    return pick;
  }

  function revealAll() {
    quizzableLabels().forEach(l => revealed.add(l.id));
    nodes.forEach((node, id) => applyQuizState(node, id));
    onQuizChange?.(getQuizProgress());
  }

  /** Re-hides everything — a fresh round on the same map. */
  function hideAll() {
    revealed.clear();
    nodes.forEach((node, id) => applyQuizState(node, id));
    onQuizChange?.(getQuizProgress());
  }

  function applyQuizState(node, id) {
    node.classList.toggle('quiz-mode', quizMode);
    node.classList.toggle('quiz-hidden', quizMode && !revealed.has(id));
  }

  /** Selects a label (highlighting it and making it the keyboard-nudge target), or clears selection if id is null/missing. Only one label or marker can be selected at a time — the main script coordinates that across layers. */
  function select(id) {
    if (selectedId === id) return;
    const prevNode = nodes.get(selectedId);
    if (prevNode) prevNode.classList.remove("selected");
    selectedId = labels.some(l => l.id === id) ? id : null;
    const node = nodes.get(selectedId);
    if (node) node.classList.add("selected");
  }

  function deselect() { select(null); }
  function getSelectedId() { return selectedId; }

  /** Nudges a label's position by a stage-space (dx, dy) — used for arrow-key nudging of the selected label. */
  function nudge(id, dx, dy) {
    const label = labels.find(l => l.id === id);
    if (!label) return;
    label.x += dx;
    label.y += dy;
    reposition();
    onChange?.(labels);
  }

  function getLabels() { return labels; }

  function addAt(stageX, stageY, text = "") {
    const label = { id: newId(), x: stageX, y: stageY, text, color: null, bold: false, italic: false, size: DEFAULT_LABEL_SIZE };
    labels.push(label);
    reconcile();
    return label;
  }

  function remove(id) {
    labels = labels.filter(l => l.id !== id);
    if (selectedId === id) selectedId = null;
    reconcile();
    onChange?.(labels);
  }

  function reposition() {
    labels.forEach(l => {
      const node = nodes.get(l.id);
      if (!node) return;
      const pt = viewer.stageToScreen(l.x, l.y);
      node.style.left = `${pt.x}px`;
      node.style.top = `${pt.y}px`;
    });
  }

  /** Applies a label's color/size/bold/italic to its dot and text (or in-progress input) node. */
  function applyStyle(node, label) {
    const dot = node.querySelector(".lbl-dot");
    if (dot) dot.style.background = label.color ? labelColorHex(label.color) : "";
    const textEl = node.querySelector(".lbl-text, .lbl-input");
    if (!textEl) return;
    textEl.style.color = label.color ? labelColorHex(label.color) : "";
    textEl.style.fontSize = `${labelFontSizeRem(label.size)}rem`;
    textEl.style.fontWeight = label.bold ? "700" : "";
    textEl.style.fontStyle = label.italic ? "italic" : "";
  }

  function reconcile() {
    for (const [id, node] of nodes) {
      if (!labels.some(l => l.id === id)) { node.remove(); nodes.delete(id); }
    }
    labels.forEach(l => {
      let node = nodes.get(l.id);
      if (!node) {
        node = buildNode(l);
        nodes.set(l.id, node);
        layerEl.appendChild(node);
      } else {
        const textEl = node.querySelector(".lbl-text");
        if (textEl && textEl.textContent !== l.text) textEl.textContent = l.text;
        applyStyle(node, l);
      }
      applyQuizState(node, l.id);
    });
    reposition();
  }

  function buildNode(label) {
    const node = document.createElement("div");
    node.className = "bmg-label";
    node.dataset.id = label.id;
    node.setAttribute("data-no-pan", "");
    node.innerHTML = `
      <span class="lbl-dot"></span>
      <span class="lbl-text"></span>
      <button class="lbl-del" type="button" title="Delete label" data-no-pan>&times;</button>
    `;
    node.querySelector(".lbl-text").textContent = label.text;
    applyStyle(node, label);
    wireDrag(node, label);
    node.addEventListener("dblclick", e => {
      e.stopPropagation();
      if (quizMode) return;
      startEdit(node, label);
    });
    node.querySelector(".lbl-del").addEventListener("click", e => {
      e.stopPropagation();
      remove(label.id);
    });
    return node;
  }

  function wireDrag(node, label) {
    let dragging = false, startX = 0, startY = 0, startStage = null;
    node.addEventListener("pointerdown", e => {
      if (e.target.closest(".lbl-del") || node.classList.contains("editing")) return;
      if (quizMode) return; // a plain click reveals/hides instead — see the "click" listener below
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startStage = { x: label.x, y: label.y };
      node.setPointerCapture(e.pointerId);
      node.classList.add("dragging");
      e.stopPropagation();
    });
    node.addEventListener("pointermove", e => {
      if (!dragging) return;
      const scale = viewer.getView().scale;
      label.x = startStage.x + (e.clientX - startX) / scale;
      label.y = startStage.y + (e.clientY - startY) / scale;
      reposition();
      e.stopPropagation();
    });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      node.classList.remove("dragging");
      // A pointerdown+up with barely any movement is a click, not a drag —
      // select this label (for keyboard nudging) rather than treat it as
      // having been dragged in place.
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < 4) select(label.id);
      onChange?.(labels);
    }
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);

    node.addEventListener("click", e => {
      if (!quizMode) return;
      e.stopPropagation();
      toggleReveal(label.id);
    });
  }

  /** Builds the inline style bar (color/size/bold/italic) shown only while a label is being edited. */
  function buildStyleBar(label, node) {
    const bar = document.createElement("div");
    bar.className = "lbl-style-bar";
    bar.setAttribute("data-no-pan", "");
    bar.innerHTML = `
      <select class="lbl-color-select" data-no-pan title="Text color">
        <option value="">Default</option>
        ${LABEL_COLORS.map(c => `<option value="${c.key}">${c.name}</option>`).join("")}
      </select>
      <select class="lbl-size-select" data-no-pan title="Text size">
        ${LABEL_SIZES.map(s => `<option value="${s.key}">${s.label}</option>`).join("")}
      </select>
      <button type="button" class="lbl-bold-btn" data-no-pan title="Bold"><b>B</b></button>
      <button type="button" class="lbl-italic-btn" data-no-pan title="Italic"><i>I</i></button>
    `;
    const colorSelect = bar.querySelector(".lbl-color-select");
    const sizeSelect = bar.querySelector(".lbl-size-select");
    const boldBtn = bar.querySelector(".lbl-bold-btn");
    const italicBtn = bar.querySelector(".lbl-italic-btn");
    colorSelect.value = label.color || "";
    sizeSelect.value = label.size || DEFAULT_LABEL_SIZE;
    boldBtn.classList.toggle("active", !!label.bold);
    italicBtn.classList.toggle("active", !!label.italic);

    function commitStyle() { applyStyle(node, label); onChange?.(labels); }

    colorSelect.addEventListener("pointerdown", e => e.stopPropagation());
    colorSelect.addEventListener("change", () => { label.color = colorSelect.value || null; commitStyle(); });
    sizeSelect.addEventListener("pointerdown", e => e.stopPropagation());
    sizeSelect.addEventListener("change", () => { label.size = sizeSelect.value; commitStyle(); });
    boldBtn.addEventListener("pointerdown", e => e.stopPropagation());
    boldBtn.addEventListener("click", e => { e.stopPropagation(); label.bold = !label.bold; boldBtn.classList.toggle("active", label.bold); commitStyle(); });
    italicBtn.addEventListener("pointerdown", e => e.stopPropagation());
    italicBtn.addEventListener("click", e => { e.stopPropagation(); label.italic = !label.italic; italicBtn.classList.toggle("active", label.italic); commitStyle(); });

    return bar;
  }

  function startEdit(node, label) {
    if (node.classList.contains("editing")) return;
    node.classList.add("editing");
    const textEl = node.querySelector(".lbl-text");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "lbl-input";
    input.placeholder = "Label text";
    input.value = label.text;
    input.setAttribute("data-no-pan", "");
    textEl.replaceWith(input);
    applyStyle(node, label);
    const styleBar = buildStyleBar(label, node);
    node.appendChild(styleBar);
    input.focus();
    input.select();

    // Guarded against reentrancy: replaceWith() on a focused input fires a
    // synchronous blur, which would otherwise re-enter commit() and try to
    // replace the same (already-detached) node a second time.
    let committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      node.removeEventListener("focusout", onFocusOut);
      styleBar.remove();
      const val = input.value.trim();
      if (!val) { remove(label.id); return; }
      label.text = val;
      const span = document.createElement("span");
      span.className = "lbl-text";
      span.textContent = val;
      input.replaceWith(span);
      node.classList.remove("editing");
      applyStyle(node, label);
      onChange?.(labels);
    }

    // Focus can hop between the text input and the style bar's own
    // select/button controls without the user being "done" editing — only
    // commit once focus leaves the whole editing node (input + style bar).
    function onFocusOut(e) {
      if (node.contains(e.relatedTarget)) return;
      commit();
    }
    node.addEventListener("focusout", onFocusOut);

    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") { e.preventDefault(); input.value = label.text; commit(); }
    });
    input.addEventListener("pointerdown", e => e.stopPropagation());
  }

  /**
   * Nudges overlapping labels apart until none of their boxes collide,
   * keeping each as close to where it was as the crowding allows.
   *
   * A dense map (anything placed from a coordinate list or a saved label
   * set, especially) lands labels wherever their real coordinates fall,
   * which on a zoomed-out map means stacks of unreadable overlapping text
   * that has to be dragged apart one at a time. This is that job, done in
   * one pass: a simple iterative relaxation over each label's *rendered*
   * box (measured from the DOM, so it accounts for the label's own text
   * length, font size, bold/italic, and the node's CSS transform rather
   * than assuming a size), pushing colliding pairs apart along whichever
   * axis they overlap least — usually vertically, since label boxes are
   * wide and short — with a weak spring pulling each back toward where the
   * teacher (or the coordinate list) originally put it.
   *
   * Works in screen pixels and converts the result back to stage
   * coordinates at the end, so the amount of separation is what looks right
   * at the *current* zoom. Runs through onChange like any other edit, so
   * it's a single Ctrl+Z away from being undone. Returns how many labels
   * actually moved.
   */
  function tidyOverlaps({ padding = 5, iterations = 260 } = {}) {
    const scale = viewer.getView().scale;
    const layerRect = layerEl.getBoundingClientRect();
    const boxes = [];
    labels.forEach(l => {
      const node = nodes.get(l.id);
      if (!node || !l.text) return;
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const anchor = viewer.stageToScreen(l.x, l.y);
      boxes.push({
        label: l,
        offX: r.left - (layerRect.left + anchor.x), // box position relative to the anchor point
        offY: r.top - (layerRect.top + anchor.y),
        w: r.width, h: r.height,
        x: anchor.x, y: anchor.y,
        homeX: anchor.x, homeY: anchor.y,
      });
    });
    if (boxes.length < 2) return 0;

    for (let iter = 0; iter < iterations; iter++) {
      let collided = false;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          const ax = a.x + a.offX, ay = a.y + a.offY;
          const bx = b.x + b.offX, by = b.y + b.offY;
          const overlapX = Math.min(ax + a.w, bx + b.w) - Math.max(ax, bx) + padding;
          const overlapY = Math.min(ay + a.h, by + b.h) - Math.max(ay, by) + padding;
          if (overlapX <= 0 || overlapY <= 0) continue;
          collided = true;
          if (overlapX < overlapY) {
            const dir = (ax + a.w / 2) <= (bx + b.w / 2) ? -1 : 1;
            const shift = (overlapX / 2) * 0.5;
            a.x += dir * shift;
            b.x -= dir * shift;
          } else {
            const dir = (ay + a.h / 2) <= (by + b.h / 2) ? -1 : 1;
            const shift = (overlapY / 2) * 0.5;
            a.y += dir * shift;
            b.y -= dir * shift;
          }
        }
      }
      // Weak pull back toward the original position, so a label that was
      // shoved aside drifts home again once whatever crowded it has moved.
      boxes.forEach(box => {
        box.x += (box.homeX - box.x) * 0.03;
        box.y += (box.homeY - box.y) * 0.03;
      });
      if (!collided) break;
    }

    let moved = 0;
    boxes.forEach(box => {
      const dx = box.x - box.homeX, dy = box.y - box.homeY;
      if (Math.hypot(dx, dy) < 0.75) return;
      box.label.x += dx / scale;
      box.label.y += dy / scale;
      moved++;
    });
    if (moved) { reposition(); onChange?.(labels); }
    return moved;
  }

  /** Starts editing a just-placed label by id (used right after addAt()). */
  function startEditing(id) {
    const label = labels.find(l => l.id === id);
    const node = nodes.get(id);
    if (label && node) startEdit(node, label);
  }

  return {
    setLabels, getLabels, addAt, remove, reposition, startEditing, select, deselect, getSelectedId, nudge,
    setQuizMode, isQuizMode, revealNext, revealAll, hideAll, getQuizProgress, tidyOverlaps,
  };
}
