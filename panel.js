/* Panel navigateur du plugin Tuiles */
(function () {
  var conf = (typeof tuilesPanel !== 'undefined' && tuilesPanel) ? tuilesPanel : {};
  var rootEl = document.getElementById('tl-panel-root');
  if (!rootEl || !window.Tuiles) return;
  Tuiles.boot(rootEl, {
    pageId: conf.pageId || '',
    kiosk: !!conf.kiosk,
    mobile: 'auto',
    updateUrl: true,
    setTitle: true
  });
})();
