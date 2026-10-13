// "Babysitter mode" on the frame: the same timeline as /sitter, full screen, with a Close button.
(function () {
  function open() {
    if (document.querySelector('.sitter-ov')) return;
    var ov = document.createElement('div'); ov.className = 'sitter-ov';
    ov.innerHTML = '<iframe src="/sitter/?frame=1" title="Babysitter mode"></iframe>';
    document.body.appendChild(ov);
  }
  function close() { var ov = document.querySelector('.sitter-ov'); if (ov) ov.remove(); if (window.App) App.resetIdle(); }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#railSitter')) open(); });
  window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.type === 'hq-sitter-close') close(); });
  window.HQSitter = { open: open, close: close };
})();
