/* speak.js — read a word aloud with the browser's own voices (Path 19 P5). Publishes window.Speak.

   The one place a page asks the browser to speak: 040's self-quiz, 051's labels, 039's Listen
   buttons, 014's Speak buttons and 044's Read aloud all call it (the last three carried their own
   few lines until Path 19 P3). a11y.js reads a whole page and keeps its own, which is not this.

   Nothing here leaves the browser: speechSynthesis is the device's own voice (some browsers
   fetch a voice from their vendor; that is the browser's doing, not the page's, and is why a
   label's QR code still points at a page that says so on its own).

     Speak.supported()           true when the browser can speak at all
     Speak.langTag(id)           'es' -> 'es-ES'; a full tag ('pt-BR') is kept; '' for anything else
     Speak.voicesFor(tag)        the voices on this device for the tag's language, best match first
     Speak.hasVoice(tag)         whether there is one (false until the browser has listed its voices)
     Speak.onVoices(fn)          calls fn once the voices are listed (now, if they already are)
     Speak.say(text, tag, opts)  speaks; false when it could not start; cancels what was being said.
                                 opts: { onEnd, onError } called when the utterance ends or fails
     Speak.stop()
     Speak.state()               'unsupported' | 'speaking' | 'paused' | 'idle'
     Speak.pause() / resume()    for a long text (044's Read aloud)
   The pure half (primary, langTag, matchVoices) takes its voices as an argument, so a Node suite
   can run it against a fake list. */
(function (root) {
  'use strict';

  var TAGS = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-BR', la: 'la' };

  function primary(tag) { return String(tag || '').toLowerCase().split(/[-_]/)[0]; }

  function langTag(id) {
    var s = String(id || '').trim();
    if (/^[a-z]{2,3}[-_][A-Za-z0-9]{2,8}$/i.test(s)) return s.replace('_', '-');
    return TAGS[s.toLowerCase()] || '';
  }

  /* Voices whose language is the tag's: the exact tag first, then the same language in another region. */
  function matchVoices(voices, tag) {
    var want = String(tag || '').toLowerCase().replace('_', '-'), base = primary(tag), exact = [], loose = [];
    if (!base) return [];
    (voices || []).forEach(function (v) {
      var l = String((v && v.lang) || '').toLowerCase().replace('_', '-');
      if (l === want) exact.push(v); else if (primary(l) === base) loose.push(v);
    });
    return exact.concat(loose);
  }

  function synth() { return root.speechSynthesis && root.SpeechSynthesisUtterance ? root.speechSynthesis : null; }
  function supported() { return !!synth(); }
  function voicesFor(tag) { var s = synth(); return s ? matchVoices(s.getVoices(), tag) : []; }
  function hasVoice(tag) { return voicesFor(tag).length > 0; }

  function onVoices(fn) {
    var s = synth();
    if (!s) return;
    if (s.getVoices().length) { fn(); return; }
    if (s.addEventListener) s.addEventListener('voiceschanged', function once() { s.removeEventListener('voiceschanged', once); fn(); });
  }

  function say(text, tag, opts) {
    var s = synth(), t = String(text == null ? '' : text).trim();
    if (!s || !t) return false;
    s.cancel();
    var u = new root.SpeechSynthesisUtterance(t);
    if (opts && opts.onEnd) u.onend = opts.onEnd;
    if (opts && opts.onError) u.onerror = opts.onError;
    var want = langTag(tag) || String(tag || '');
    if (want) {
      u.lang = want;
      var v = matchVoices(s.getVoices(), want)[0];
      if (v) u.voice = v;
    }
    s.speak(u);
    return true;
  }

  function stop() { var s = synth(); if (s) s.cancel(); }
  function state() {
    var s = synth();
    if (!s) return 'unsupported';
    if (s.speaking && !s.paused) return 'speaking';
    return s.paused ? 'paused' : 'idle';
  }
  function pause() { var s = synth(); if (s) s.pause(); }
  function resume() { var s = synth(); if (s) s.resume(); }

  root.Speak = { supported: supported, langTag: langTag, primary: primary, matchVoices: matchVoices,
    voicesFor: voicesFor, hasVoice: hasVoice, onVoices: onVoices, say: say, stop: stop, state: state, pause: pause, resume: resume };
})(typeof window !== 'undefined' ? window : globalThis);
