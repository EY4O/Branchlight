/* Apply appearance before the stylesheet paints, including when opened offline. */
(function () {
  'use strict';
  const key = 'branchlight.appearance', allowed = ['system', 'light', 'dark'];
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try { const saved = localStorage.getItem(key); if (allowed.includes(saved)) preference = saved; } catch (_) { /* Storage may be disabled. Appearance still works for this window. */ }
  function apply() {
    const dark = preference === 'dark' || (preference === 'system' && media.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = dark ? '#1c2721' : '#fbfcf8';
  }
  apply();
  media.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('appearance');
    select.value = preference;
    select.addEventListener('change', () => {
      preference = allowed.includes(select.value) ? select.value : 'system';
      try { localStorage.setItem(key, preference); } catch (_) { /* Keep the in-memory choice. */ }
      apply();
    });
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return;
      preference = allowed.includes(event.newValue) ? event.newValue : 'system';
      select.value = preference; apply();
    });
  });
})();
