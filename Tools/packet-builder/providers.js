/* providers.js — the sections 090 Packet Builder starts with (Path 10 P1).
   Registers into window.PacketSections (sections.js, which has the contract).
   Every provider here is data in, blocks out: it reads only through ctx.read(key),
   treats an unreadable key as "nothing saved", and never touches the DOM.

   Each provider's `storageKeys` must be in 090's `reads` in _shared/tool-registry.js
   and be a key its source tool's row declares; Tools/packet-builder/test/providers.test.mjs
   holds all three to each other.

   Source shapes these read (keep the shape or bump the key version; the source
   tools carry a comment saying so):
     subPlanBuilder.standingDetails.v1  044's standing details: teacherName, roomNumber,
       rosterLocation, absenceLocation, emergencyLocation, periods [{label, time}], keysLocation,
       whoToAsk, techFailureText, attendanceText, behaviorCustom, phoneNurse, phoneCounseling,
       phoneSupport, phoneOther, signOffName, fireRoute, lockdownProcedure, medicalAlerts. */
(function (root) {
  'use strict';
  var PS = root.PacketSections;
  if (!PS) return;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(v) { return typeof v === 'string' && v.trim() !== ''; }

  var STANDING_KEY = 'subPlanBuilder.standingDetails.v1';
  var SUB_SETUP = 'Fill in your standing details once in Sub Plan Builder.';

  function standing(ctx) { var s = ctx.read(STANDING_KEY); return isObj(s) ? s : null; }

  function rows(pairs) { return pairs.filter(function (p) { return has(p[1]); }).map(function (p) { return [p[0], p[1].trim()]; }); }

  function standingBlocks(s) {
    var blocks = [];
    var facts = rows([
      ['Teacher', s.teacherName], ['Room', s.roomNumber], ['Roster', s.rosterLocation],
      ['Absence slips', s.absenceLocation], ['Sub folder', s.emergencyLocation],
      ['Keys', s.keysLocation], ['Who to ask', s.whoToAsk], ['If tech fails', s.techFailureText]
    ]);
    if (facts.length) blocks.push({ type: 'kv', rows: facts });
    var periods = Array.isArray(s.periods) ? s.periods.filter(isObj) : [];
    if (periods.length) {
      blocks.push({ type: 'h', text: 'Periods', level: 3 });
      blocks.push({ type: 'table', head: ['Period', 'Time'], rows: periods.map(function (p) { return [p.label, p.time]; }) });
    }
    var more = rows([
      ['Attendance', s.attendanceText], ['Behavior', s.behaviorCustom],
      ['Nurse', s.phoneNurse], ['Counseling', s.phoneCounseling], ['Support / office', s.phoneSupport],
      ['Other phone', s.phoneOther], ['Sign-off', s.signOffName]
    ]);
    if (more.length) blocks.push({ type: 'kv', rows: more });
    return blocks;
  }

  PS.register({
    id: 'sub-plan',
    title: 'Sub plan: standing details',
    sourceSlug: 'sub-plan-builder',
    setupHint: SUB_SETUP,
    storageKeys: [STANDING_KEY],
    evaluate: function (ctx) {
      var s = standing(ctx);
      if (!s) return { available: false, status: 'No standing details saved yet.' };
      if (!standingBlocks(s).length) return { available: false, status: 'Standing details exist but are empty.' };
      return { available: true, status: 'Saved.' };
    },
    build: function (ctx) {
      var s = standing(ctx);
      return { pages: [{ title: 'Substitute information', blocks: s ? standingBlocks(s) : [] }] };
    }
  });

  function emergencyRows(s) {
    return rows([['Fire / evacuation', s.fireRoute], ['Lockdown', s.lockdownProcedure], ['Medical alerts', s.medicalAlerts]]);
  }

  PS.register({
    id: 'emergency-info',
    title: 'Emergency information',
    sourceSlug: 'sub-plan-builder',
    setupHint: 'Add a fire route, lockdown procedure or medical alerts in Sub Plan Builder’s Emergency info card.',
    storageKeys: [STANDING_KEY],
    evaluate: function (ctx) {
      var s = standing(ctx);
      if (!s) return { available: false, status: 'No standing details saved yet.' };
      if (!emergencyRows(s).length) return { available: false, status: 'No fire route, lockdown procedure or medical alerts entered yet.' };
      return { available: true, status: 'Saved.' };
    },
    build: function (ctx) {
      var s = standing(ctx);
      return { pages: [{ title: 'Emergency information', blocks: s ? [{ type: 'kv', rows: emergencyRows(s) }] : [] }] };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
