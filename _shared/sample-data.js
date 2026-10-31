/* sample-data.js — the "Load sample data" bar for a tool that opens to an empty
   form (P15, BACKLOG rank 65). Publishes window.SampleData.

   WHAT IT DOES
     SampleData.mount({ before, label, fields, isEmpty, fill, clear, snapshot, what })
     puts one bar in front of `before` (an element):
       - while the tool is empty: a "Load sample ..." button;
       - after a press, while the form still holds exactly what the sample put
         there: a line saying so and a "Clear sample" button;
       - otherwise nothing. The moment a teacher types over the sample, or
         the tool already holds their work, the bar is gone, so a press can never
         overwrite anything and Clear can never delete anything they wrote.
     The bar never prints.

   HOW A TOOL USES IT
     fields    { elementId or '[selector]': text } — set as the value and announced with an 'input'
               event, so the tool's own handlers store and redraw exactly as if
               the teacher had typed (this is why a tool whose form saves as it
               goes keeps saving; `what` says so on the bar). Clear puts '' back.
     isEmpty   () => bool. Default: every field above is blank.
     fill      () => void. For what `fields` cannot reach (a list the tool draws
               itself). Runs after the fields are set.
     clear     () => void. Undoes what fill() did. Runs after the fields are blanked.
     snapshot  () => string. Whatever the tool needs compared to know the sample is
               untouched. Default: the field values joined.
     what      text after the label on the note, e.g. "It saves like anything you type."

   The sample is made up and is never student data; a tool's own sample text is
   written so it cannot read as a real person or school on a printout. Nothing is
   stored by this file. */
(function () {
  'use strict';
  var styled = false;
  function addStyle() {
    if (styled) return;
    styled = true;
    var s = document.createElement('style');
    s.textContent =
      '.sample-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 12px;padding:8px 12px;' +
      'border:1px dashed var(--line-strong,#999);border-radius:8px;background:var(--card-2,transparent);color:var(--ink,inherit);font-size:.92rem}' +
      '.sample-bar[hidden],.sample-bar [hidden]{display:none!important}' +
      '@media print{.sample-bar{display:none!important}}';
    document.head.appendChild(s);
  }
  function el(key) {
    // a bare word is an id; a key starting with # or [ is a selector (a field with no id)
    return /^[#\[]/.test(key) ? document.querySelector(key) : document.getElementById(key);
  }
  function setValue(node, v) {
    if (!node) return;
    node.value = v;
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function mount(o) {
    addStyle();
    var ids = o.fields ? Object.keys(o.fields) : [];
    var loaded = false, snap = '';
    function snapshot() {
      if (o.snapshot) return String(o.snapshot());
      return ids.map(function (id) { var n = el(id); return n ? n.value : ''; }).join('\u0001');
    }
    function isEmpty() {
      if (o.isEmpty) return !!o.isEmpty();
      return ids.every(function (id) { var n = el(id); return !n || !String(n.value).trim(); });
    }

    var bar = document.createElement('div');
    bar.className = 'sample-bar';
    bar.setAttribute('data-sample-bar', '');
    var load = document.createElement('button');
    load.type = 'button'; load.className = 'secondary'; load.textContent = o.label || 'Load sample data';
    var note = document.createElement('span');
    note.setAttribute('role', 'status');
    note.textContent = 'Sample loaded: made up, for looking around. ' + (o.what || '');
    var clr = document.createElement('button');
    clr.type = 'button'; clr.className = 'secondary'; clr.textContent = 'Clear sample';
    bar.appendChild(load); bar.appendChild(note); bar.appendChild(clr);
    o.before.parentNode.insertBefore(bar, o.before);

    function refresh() {
      var show = 'none';
      if (loaded && snapshot() === snap) show = 'note';
      else if (isEmpty()) { show = 'load'; loaded = false; }
      else loaded = false;
      load.hidden = show !== 'load';
      note.hidden = clr.hidden = show !== 'note';
      bar.hidden = show === 'none';
    }
    load.addEventListener('click', function () {
      if (!isEmpty()) { refresh(); return; }
      ids.forEach(function (id) { setValue(el(id), o.fields[id]); });
      if (o.fill) o.fill();
      loaded = true; snap = snapshot();
      refresh();
    });
    clr.addEventListener('click', function () {
      if (!(loaded && snapshot() === snap)) { refresh(); return; }
      ids.forEach(function (id) { setValue(el(id), ''); });
      if (o.clear) o.clear();
      loaded = false;
      refresh();
    });
    var t = 0;
    function later() { clearTimeout(t); t = setTimeout(refresh, 0); }
    document.addEventListener('input', later);
    document.addEventListener('change', later);
    document.addEventListener('click', later);
    refresh();
    return { refresh: refresh, element: bar };
  }

  window.SampleData = { mount: mount };
})();
