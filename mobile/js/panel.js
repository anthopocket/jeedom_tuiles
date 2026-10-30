/* Panel mobile du plugin Tuiles.
 * Le HTML du panel démarre déjà le moteur ; cette fonction est appelée par
 * l'interface mobile du core si elle existe (démarrage protégé contre le double appel). */
function initTuilesPanel(_option) {
  var rootEl = document.getElementById('tl-mobile-root');
  if (rootEl && window.Tuiles) {
    window.Tuiles.boot(rootEl, { mobile: true, remember: true, pageId: (_option && typeof _option !== 'object') ? _option : undefined });
  }
}
