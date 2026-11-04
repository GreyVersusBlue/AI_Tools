/* pb-library.js — 029's prompt library, grouped by teaching task (BACKLOG row 73).

   Pure data and lookups, no DOM, no storage. An entry is either
     { id, title, about, preset: '<key of the page's PRESETS>' }   — one of the page's own examples, filed by task
   or
     { id, title, about, fields: { ...a full form state... } }    — a form state in applyFieldsFromData's shape
   where `fields` uses the page's own field ids (and may carry `toolTypeOther`, `toneOther`, `dyn`).

   Entries written for the library keep their topic, grade and texts as {{placeholders}},
   so loading one hands the teacher a blank to fill, not last unit's example, and nothing in
   any entry names a student. The wording of the five entries added with the library
   (feedback, reading level, accommodation ideas, family translation, difficult conversation)
   was read and kept by Devon on 2026-11-03. */
(function (root) {
  'use strict';

  var GROUPS = [
    { id: 'plan', title: 'Plan and teach', entries: [
      { id: 'lesson', title: 'Lesson plan', about: 'A one-period plan with a warm-up, a task and an exit ticket.', preset: 'lesson' },
      { id: 'differentiated', title: 'Differentiated materials', about: 'The same task at below, on and above grade level.', preset: 'differentiated' }
    ] },
    { id: 'assess', title: 'Assess and give feedback', entries: [
      { id: 'quiz', title: 'Quiz with an answer key', about: 'A printable quiz, multiple choice and short answer.', preset: 'quiz' },
      { id: 'rubric', title: 'Grading rubric', about: 'A table you can paste into a document.', preset: 'rubric' },
      { id: 'exitTickets', title: 'Exit ticket prompts', about: 'Short prompts answerable in two or three sentences.', preset: 'exitTickets' },
      { id: 'feedbackBank', title: 'Feedback comment bank', about: 'Comments a student can act on, at four performance levels.', fields: {
        toolType: 'other',
        toolTypeOther: 'a bank of feedback comments for {{assignment type}}',
        topic: '{{assignment}}',
        objective: '{{what the work should show}}',
        exampleCount: '12 comments, 3 at each of four performance levels',
        format: 'a plain list under four headings (Beginning, Developing, Proficient, Advanced), each comment one or two sentences a student can act on',
        tone: 'warm and encouraging',
        avoidInclude: 'no grades or scores inside the comments, and no student names'
      } }
    ] },
    { id: 'reach', title: 'Reach every learner', entries: [
      { id: 'readingLevel', title: 'Adjust a text’s reading level', about: 'Rewrite a passage you paste in, keeping the ideas and key terms.', fields: {
        toolType: 'other',
        toolTypeOther: 'a rewrite of a text at a different reading level',
        topic: '{{title of the text}}',
        objective: 'keep the same main ideas and key vocabulary, and explain each key term the first time it appears',
        readingLevel: '{{target level, for example grade 4}}',
        format: 'the rewritten text, then a short list of what you changed',
        avoidInclude: 'do not add facts that are not in the original',
        extra: 'The original text: {{paste the text here}}'
      } },
      { id: 'accommodationIdeas', title: 'Accommodation ideas', about: 'General ideas to consider for a task. You check them against the real plan.', fields: {
        toolType: 'other',
        toolTypeOther: 'a list of general classroom accommodation ideas',
        topic: '{{the task or lesson}}',
        studentNeeds: 'a learning need described in general terms: {{need}}',
        accommodations: '{{accommodations already in place}}',
        format: 'a list of 8 to 10 ideas grouped under Presenting, Responding, Setting and Timing',
        tone: 'direct and concise',
        avoidInclude: 'these are ideas to consider, not a plan; do not suggest a diagnosis'
      } }
    ] },
    { id: 'families', title: 'Talk with families', entries: [
      { id: 'email', title: 'Parent email', about: 'A friendly, short note home.', preset: 'email' },
      { id: 'familyTranslation', title: 'Translate a letter for families', about: 'Plain English first, then the translation, with anything unsure flagged.', fields: {
        toolType: 'other',
        toolTypeOther: 'a translation of a letter to families',
        topic: '{{what the letter is about}}',
        languageNeeds: '{{the home language}}',
        tone: 'warm and encouraging',
        format: 'the letter in plain English first, then the translation with the same paragraph breaks',
        avoidInclude: 'idioms, school jargon and acronyms; tell me anything you were unsure how to translate so a fluent colleague can check it',
        extra: 'The letter: {{paste the letter here}}'
      } },
      { id: 'difficultConversation', title: 'Prepare a difficult conversation', about: 'A short email and three talking points, with one next step.', fields: {
        toolType: 'an email or letter',
        topic: '{{the concern, in one sentence, without a student’s name}}',
        tone: 'serious and matter-of-fact',
        format: 'a short email, then three talking points for a phone call',
        avoidInclude: 'no blame, no diagnosis and no comparison to other students; end with one concrete next step and an invitation to talk',
        extra: 'Things that have gone well: {{one or two real positives}}',
        dyn: { x_recipient: 'a parent or guardian' }
      } }
    ] },
    { id: 'toolkit', title: 'Make content for other tools on this site', entries: [
      { id: 'reviewBoard', title: 'Review game questions', about: 'A CSV the review game board imports.', preset: 'reviewBoard' },
      { id: 'vocabList', title: 'Vocabulary list', about: 'term: definition lines the flashcard tool reads.', preset: 'vocabList' }
    ] }
  ];

  function all() {
    var out = [];
    GROUPS.forEach(function (g) { g.entries.forEach(function (e) { out.push(e); }); });
    return out;
  }
  function find(id) {
    var list = all();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /* The entry ids that match every word typed, in title, blurb or group name; blank matches all. */
  function search(q) {
    var words = String(q == null ? '' : q).toLowerCase().split(/\s+/).filter(Boolean);
    var out = [];
    GROUPS.forEach(function (g) {
      g.entries.forEach(function (e) {
        var hay = (e.title + ' ' + e.about + ' ' + g.title).toLowerCase();
        if (words.every(function (w) { return hay.indexOf(w) >= 0; })) out.push(e.id);
      });
    });
    return out;
  }
  /* The distinct {{placeholder}} names an entry's own fields carry (not the page's presets). */
  function placeholders(entry) {
    var seen = [], text = JSON.stringify(entry && entry.fields ? entry.fields : {}), re = /\{\{\s*([^{}]{1,60}?)\s*\}\}/g, m;
    while ((m = re.exec(text))) { var k = m[1].trim().toLowerCase().replace(/\s+/g, ' '); if (seen.indexOf(k) < 0) seen.push(k); }
    return seen;
  }

  root.PromptLibrary = { GROUPS: GROUPS, all: all, find: find, search: search, placeholders: placeholders };
}(typeof globalThis !== 'undefined' ? globalThis : this));
