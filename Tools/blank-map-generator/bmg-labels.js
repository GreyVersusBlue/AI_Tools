// bmg-labels.js — draggable, editable text labels anchored to stage
// (map-pixel) coordinates. Labels render as plain DOM nodes positioned in
// screen space via viewer.stageToScreen() and repositioned on every
// pan/zoom, so their on-screen size stays constant and readable instead of
// scaling with the map.

export function createLabelLayer(layerEl, viewer, { onChange, onDelete } = {}) {
  let labels = [];
  const nodes = new Map(); // id -> element

  function newId() {
    return crypto.randomUUID ? crypto.randomUUID() : `lbl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  function setLabels(list) {
    labels = list;
    reconcile();
  }

  function getLabels() { return labels; }

  function addAt(stageX, stageY, text = "") {
    const label = { id: newId(), x: stageX, y: stageY, text };
    labels.push(label);
    reconcile();
    return label;
  }

  function remove(id) {
    const removed = labels.find(l => l.id === id);
    labels = labels.filter(l => l.id !== id);
    reconcile();
    onChange?.(labels);
    if (removed) onDelete?.(removed);
  }

  /** Re-adds a previously removed label (used to undo a delete). */
  function restore(label) {
    labels.push(label);
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
      }
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
    wireDrag(node, label);
    node.addEventListener("dblclick", e => { e.stopPropagation(); startEdit(node, label); });
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
      onChange?.(labels);
    }
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);
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
    input.focus();
    input.select();

    // Guarded against reentrancy: replaceWith() on a focused input fires a
    // synchronous blur, which would otherwise re-enter commit() and try to
    // replace the same (already-detached) node a second time.
    let committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      const val = input.value.trim();
      if (!val) { remove(label.id); return; }
      label.text = val;
      const span = document.createElement("span");
      span.className = "lbl-text";
      span.textContent = val;
      input.replaceWith(span);
      node.classList.remove("editing");
      onChange?.(labels);
    }

    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") { e.preventDefault(); input.value = label.text; commit(); }
    });
    input.addEventListener("blur", commit);
    input.addEventListener("pointerdown", e => e.stopPropagation());
  }

  /** Starts editing a just-placed label by id (used right after addAt()). */
  function startEditing(id) {
    const label = labels.find(l => l.id === id);
    const node = nodes.get(id);
    if (label && node) startEdit(node, label);
  }

  return { setLabels, getLabels, addAt, remove, restore, reposition, startEditing };
}
