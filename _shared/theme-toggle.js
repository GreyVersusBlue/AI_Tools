(function () {
  var KEY = 'gvb-tools-theme';
  function apply(t) { document.documentElement.setAttribute('data-theme', t); }
  var saved = 'light';
  try { saved = localStorage.getItem(KEY) || 'light'; } catch (e) {}
  apply(saved);

  function wire() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    function sync() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.textContent = dark ? '☀ Light mode' : '☾ Dark mode';
    }
    sync();
    btn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      sync();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && e.newValue) apply(e.newValue);
  });
})();
