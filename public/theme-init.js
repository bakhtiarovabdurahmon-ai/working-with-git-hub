(function () {
  try {
    var stored = localStorage.getItem('wb_clone_theme');
    if (stored === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();
