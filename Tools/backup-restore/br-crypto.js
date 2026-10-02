/* br-crypto.js — the optional passphrase lock on a Backup & Restore file.
 *
 * A backup holds student names, so a teacher may want the file unreadable to
 * anyone who finds it on a shared drive or a flash drive. This wraps the whole
 * backup envelope (the JSON text 009 would otherwise download) in AES-GCM,
 * keyed by PBKDF2-SHA-256 from a passphrase. Everything happens in WebCrypto,
 * in this browser; nothing leaves it.
 *
 * The locked file is still JSON and still says what it is, so the restore
 * card can recognise it and ask for the passphrase:
 *
 *   { source, format, formatVersion, exportedAt,
 *     encrypted: { v: 1, cipher: 'AES-GCM', kdf: 'PBKDF2', hash: 'SHA-256',
 *                  iterations, salt, iv },        // salt and iv are base64
 *     ciphertext }                                 // base64
 *
 * The label is deliberately not copied to the outside: a teacher writes
 * "P3-Smith" into it. `exportedAt` is, so the verify box can still say when.
 * A wrong passphrase and a damaged file fail the same way (GCM's tag check),
 * and the message says both.
 *
 * window.BrCrypto = { available, isEncrypted, encrypt(text, pass, outer),
 *                     decrypt(locked, pass) }
 */
(function () {
  'use strict';

  var ITERATIONS = 600000;   // OWASP's 2023 figure for PBKDF2-HMAC-SHA256
  var subtle = (window.crypto && window.crypto.subtle) || null;

  function available() { return !!(subtle && window.crypto.getRandomValues && window.TextEncoder); }

  function isEncrypted(parsed) {
    return !!(parsed && typeof parsed === 'object' && parsed.encrypted &&
      typeof parsed.encrypted === 'object' && typeof parsed.ciphertext === 'string');
  }

  function toB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }
  function fromB64(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function deriveKey(pass, salt, iterations) {
    return subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  /* `outer` is the plain fields to keep on the outside (source, format,
     formatVersion, exportedAt). Resolves to the locked object. */
  function encrypt(text, pass, outer) {
    if (!available()) return Promise.reject(new Error('WebCrypto is not available here'));
    var salt = window.crypto.getRandomValues(new Uint8Array(16));
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(pass, salt, ITERATIONS).then(function (key) {
      return subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(text));
    }).then(function (ct) {
      var locked = {};
      Object.keys(outer || {}).forEach(function (k) { locked[k] = outer[k]; });
      locked.encrypted = { v: 1, cipher: 'AES-GCM', kdf: 'PBKDF2', hash: 'SHA-256',
        iterations: ITERATIONS, salt: toB64(salt), iv: toB64(iv) };
      locked.ciphertext = toB64(new Uint8Array(ct));
      return locked;
    });
  }

  /* Resolves to the envelope's JSON text. Rejects with err.code 'unsupported'
     for a lock this page does not know, 'wrong' for a bad passphrase or a
     damaged file. */
  function decrypt(locked, pass) {
    var e = locked && locked.encrypted;
    function fail(code, msg) { var err = new Error(msg); err.code = code; return Promise.reject(err); }
    if (!available()) return fail('unsupported', 'WebCrypto is not available here');
    if (!e || e.v !== 1 || e.cipher !== 'AES-GCM' || e.kdf !== 'PBKDF2' || e.hash !== 'SHA-256' ||
        !(e.iterations > 0)) {
      return fail('unsupported', 'This file is locked in a way this page does not know');
    }
    var salt, iv, ct;
    try { salt = fromB64(e.salt); iv = fromB64(e.iv); ct = fromB64(locked.ciphertext); }
    catch (x) { return fail('wrong', 'The file is damaged'); }
    return deriveKey(pass, salt, e.iterations).then(function (key) {
      return subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
    }).then(function (plain) {
      return new TextDecoder().decode(plain);
    }, function () {
      var err = new Error('Wrong passphrase, or the file is damaged');
      err.code = 'wrong';
      throw err;
    });
  }

  window.BrCrypto = { available: available, isEncrypted: isEncrypted, encrypt: encrypt, decrypt: decrypt };
})();
