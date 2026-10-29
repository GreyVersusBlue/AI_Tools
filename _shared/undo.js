/* undo.js — one undo/redo stack for the tools whose undo is a snapshot of
   their state (Path 14 P5). Publishes window.UndoStack. Pure: it holds
   strings and calls the functions it is given, so the Node suite
   (Tools/undo/test/undo.test.mjs) drives all of it.

   WHAT IT KEEPS
     A snapshot is the tool's state (or the slice a step changes) turned into
     a string by `serialize` (default JSON.stringify) and read back by `parse`
     (default JSON.parse). Strings, not live objects, so a later edit cannot
     reach into history. Nothing here is saved: a stack lives in the page and
     goes when the page does, as the tools' single snapshots always did.

   THE SURFACE
     var u = UndoStack.create({ limit, maxBytes, serialize, parse, onChange });
     u.push(state)        record `state` as it is BEFORE a change. Clears redo.
     u.pushRaw(str)       the same, for a string already taken (a drag takes
                          its snapshot at pointerdown and pushes it on drop).
     u.undo(current?)     the last snapshot, parsed, or null if there is none.
                          Pass `current` and it goes on the redo side.
     u.redo(current?)     the reverse; `current` goes back on the undo side.
     u.canUndo() u.canRedo() u.depth() u.redoDepth() u.clear()
     UndoStack.keyHandler(u, { undo, redo })   a keydown handler for Ctrl/Cmd+Z
                          (undo), Ctrl+Y or Ctrl/Cmd+Shift+Z (redo) that leaves
                          text fields to their own undo.

   LIMITS
     limit     most steps kept (default 60, 005's old number); the oldest go.
     maxBytes  most characters kept across the undo side (default 0 = none).
               A tool that holds photos sets this; the newest step is always
               kept, however big, so one undo is never lost to the cap.
     Redo is kept to the same limit.

   onChange(u) is called after every push, undo, redo and clear, which is
   where a tool enables or disables its Undo and Redo buttons.
*/
(function (root) {
  'use strict';

  var DEFAULT_LIMIT = 60;

  function create(opts) {
    opts = opts || {};
    var limit = opts.limit > 0 ? opts.limit : DEFAULT_LIMIT;
    var maxBytes = opts.maxBytes > 0 ? opts.maxBytes : 0;
    var serialize = opts.serialize || JSON.stringify;
    var parse = opts.parse || JSON.parse;
    var undoS = [];
    var redoS = [];

    function changed(api) { if (typeof opts.onChange === 'function') opts.onChange(api); }
    function trim(list) {
      while (list.length > limit) list.shift();
      if (maxBytes) {
        var total = 0, i;
        for (i = 0; i < list.length; i++) total += list[i].length;
        while (total > maxBytes && list.length > 1) total -= list.shift().length;
      }
    }

    var api = {
      push: function (state) { return api.pushRaw(serialize(state)); },
      pushRaw: function (str) {
        undoS.push(str); redoS = []; trim(undoS); changed(api);
      },
      undo: function (current) {
        if (!undoS.length) return null;
        var str = undoS.pop();
        if (arguments.length && current !== undefined) { redoS.push(serialize(current)); trim(redoS); }
        changed(api);
        return parse(str);
      },
      redo: function (current) {
        if (!redoS.length) return null;
        var str = redoS.pop();
        if (arguments.length && current !== undefined) { undoS.push(serialize(current)); trim(undoS); }
        changed(api);
        return parse(str);
      },
      canUndo: function () { return undoS.length > 0; },
      canRedo: function () { return redoS.length > 0; },
      depth: function () { return undoS.length; },
      redoDepth: function () { return redoS.length; },
      clear: function () { undoS = []; redoS = []; changed(api); }
    };
    return api;
  }

  function keyHandler(u, acts) {
    return function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var k = (e.key || '').toLowerCase();
      var isUndo = k === 'z' && !e.shiftKey;
      var isRedo = (k === 'z' && e.shiftKey) || (k === 'y' && !e.metaKey);
      if (!isUndo && !isRedo) return;
      var tag = ((e.target && e.target.tagName) || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return; // text fields keep their own undo
      if (e.target && e.target.isContentEditable) return;
      if (isRedo && !(acts && acts.redo)) return;
      e.preventDefault();
      if (isUndo) acts.undo(); else acts.redo();
    };
  }

  root.UndoStack = { create: create, keyHandler: keyHandler, DEFAULT_LIMIT: DEFAULT_LIMIT };
})(typeof window !== 'undefined' ? window : globalThis);
