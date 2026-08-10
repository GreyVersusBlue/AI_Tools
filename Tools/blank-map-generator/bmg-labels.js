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

export function createLabelLayer(layerEl, viewer, { onChange } = {}) {
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
  }

  function isQuizMode() { return quizMode; }

  /** Shows/re-hides one label's text — called when its node is clicked in quiz mode. */
  function toggleReveal(id) {
    if (revealed.has(id)) revealed.delete(id);
    else revealed.add(id);
    const node = nodes.get(id);
    if (node) applyQuizState(node, id);
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

  /** Starts editing a just-placed label by id (used right after addAt()). */
  function startEditing(id) {
    const label = labels.find(l => l.id === id);
    const node = nodes.get(id);
    if (label && node) startEdit(node, label);
  }

  return { setLabels, getLabels, addAt, remove, reposition, startEditing, select, deselect, getSelectedId, nudge, setQuizMode, isQuizMode };
}
