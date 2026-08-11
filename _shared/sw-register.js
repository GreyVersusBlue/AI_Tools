if ('serviceWorker' in navigator) {
  var swUrl = new URL('../sw.js', document.currentScript.src).href;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register(swUrl).catch(function () {});
  });
}
