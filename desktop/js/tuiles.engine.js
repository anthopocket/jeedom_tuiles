/* Tuiles — moteur de rendu commun (panel navigateur, panel mobile, aperçu de l'éditeur).
 * - Mise à jour en direct : événements du core Jeedom (cmd::update), aucun démon.
 * - Actions : jeedom.cmd.execute natif.
 * - Grille automatique : demi-cases, remplissage dense, centrage et tailles de texte automatiques.
 */
(function (root) {
  'use strict';
  if (root.Tuiles && root.Tuiles.version) return;

  var VERSION = '1.69.1';
  var AJAX_URL = 'plugins/tuiles/core/ajax/tuiles.ajax.php';
  var PROXY_URL = 'plugins/tuiles/core/php/camProxy.php';
  var TOKENS = ['ok', 'warn', 'alert', 'info', 'neutral', 'on', 'off', 'text', 'title'];

  /* ================================================================== */
  /*  Utilitaires                                                        */
  /* ================================================================== */

  function isSet(v) { return v !== undefined && v !== null && String(v) !== ''; }
  function isNum(v) { return isSet(v) && !isNaN(parseFloat(v)) && isFinite(v); }
  function num(v, d) { return isNum(v) ? parseFloat(v) : d; }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined && html !== null) e.innerHTML = html;
    return e;
  }
  function cleanId(v) {
    v = String(v === undefined || v === null ? '' : v).replace(/#/g, '').trim();
    return /^\d+$/.test(v) ? v : '';
  }
  function collectIds(node, out) {
    out = out || [];
    if (!node || typeof node !== 'object') return out;
    Object.keys(node).forEach(function (k) {
      var v = node[k];
      if (/^cmd[A-Z]/.test(k)) {
        (Array.isArray(v) ? v : [v]).forEach(function (id) {
          id = cleanId(id);
          if (id && out.indexOf(id) < 0) out.push(id);
        });
      } else if (v && typeof v === 'object') {
        collectIds(v, out);
      }
    });
    return out;
  }
  function parseMap(str) {
    var map = {};
    String(str || '').split(/[;\n]/).forEach(function (part) {
      var i = part.indexOf('=');
      if (i > 0) map[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    });
    return map;
  }
  function parseList(str) {
    var list = [];
    String(str || '').split(';').forEach(function (part) {
      if (!part.trim()) return;
      var i = part.indexOf('|');
      if (i >= 0) list.push({ key: part.slice(0, i).trim(), label: part.slice(i + 1).trim() });
      else list.push({ key: part.trim(), label: part.trim() });
    });
    return list;
  }
  function parseDate(v) {
    if (!isSet(v)) return null;
    if (v instanceof Date) return v;
    if (isNum(v) && String(v).length >= 10 && String(v).indexOf('-') < 0) {
      var n = parseFloat(v);
      return new Date(n < 1e12 ? n * 1000 : n);
    }
    var d = new Date(String(v).replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function formatDate(d, fmt) {
    return String(fmt).replace('YYYY', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('DD', pad(d.getDate()))
      .replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())).replace('ss', pad(d.getSeconds()));
  }
  function relative(d) {
    var s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'à l\'instant';
    if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
    return 'il y a ' + Math.round(s / 86400) + ' j';
  }
  function color(c, fallback) {
    if (!isSet(c)) c = fallback;
    if (!isSet(c)) return '';
    return TOKENS.indexOf(c) >= 0 ? 'var(--tl-c-' + c + ')' : c;
  }
  function clampSpan(v, d) {
    v = num(v, d || 1);
    // grille en douzièmes de case : ¼, ⅓, ½, ⅔, ¾… possibles
    return Math.max(0.25, Math.min(12, Math.round(v * 12) / 12));
  }

  /* ---------- règles de couleur ---------- */
  function matchRule(r, v) {
    var op = r.op || '=';
    if (op === 'else') return true;
    if (!isSet(v)) return false;
    var numeric = isNum(v) && isNum(r.v);
    var n = parseFloat(v), a = parseFloat(r.v), b = parseFloat(r.v2);
    switch (op) {
      case '<': return numeric && n < a;
      case '<=': return numeric && n <= a;
      case '>': return numeric && n > a;
      case '>=': return numeric && n >= a;
      case '=': return numeric ? n === a : String(v).toLowerCase() === String(r.v).toLowerCase();
      case '!=': return numeric ? n !== a : String(v).toLowerCase() !== String(r.v).toLowerCase();
      case 'between': return isNum(v) && isNum(r.v) && isNum(r.v2) && n >= Math.min(a, b) && n <= Math.max(a, b);
      case 'contains': return String(v).toLowerCase().indexOf(String(r.v).toLowerCase()) >= 0;
    }
    return false;
  }
  function evalRules(rules, v) {
    if (!rules || !rules.length || !isSet(v)) return null;
    for (var i = 0; i < rules.length; i++) if (matchRule(rules[i], v)) return rules[i];
    return null;
  }
  /** Seuils (max 10) : valeur >= seuil → couleur du seuil le plus haut atteint ; dessous → couleur de base. */
  function thresholdRules(conf) {
    var th = (Array.isArray(conf.thresholds) ? conf.thresholds : []).filter(function (x) { return x && isSet(x.v) && isSet(x.color); }).slice(0, 10);
    var base = isSet(conf.thBase) ? [{ op: 'else', color: conf.thBase }] : [];
    if (!th.length) return base.length ? base : null;
    // textes : égalité, prioritaires ; nombres : le plus haut seuil atteint
    var texts = th.filter(function (x) { return !isNum(x.v); }).map(function (x) { return { op: '=', v: String(x.v).trim(), color: x.color }; });
    var nums = th.filter(function (x) { return isNum(x.v); }).sort(function (a, b) { return parseFloat(b.v) - parseFloat(a.v); })
      .map(function (x) { return { op: '>=', v: x.v, color: x.color }; });
    return texts.concat(nums, base);
  }
  /** Règles de couleur à partir d'une liste de seuils quelconque (cadre…). */
  function listRules(list, base) {
    return thresholdRules({ thresholds: list, thBase: base });
  }
  function rulesFor(conf, presets) {
    var th = thresholdRules(conf);
    if (th) return th;
    if (conf.rules && conf.rules.length) return conf.rules;
    if (conf.preset && presets && presets[conf.preset]) return presets[conf.preset];
    return null;
  }

  /* ---------- état binaire ---------- */
  function isActive(v, onValue, invert) {
    if (!isSet(v)) return null;
    var r;
    if (isSet(onValue)) {
      r = String(v).toLowerCase() === String(onValue).toLowerCase() || (isNum(v) && isNum(onValue) && parseFloat(v) === parseFloat(onValue));
    } else {
      var s = String(v).toLowerCase();
      r = ['1', 'on', 'true', 'ouvert', 'open', 'marche', 'allumé', 'allume'].indexOf(s) >= 0 || (isNum(v) && parseFloat(v) > 0);
    }
    return invert ? !r : r;
  }

  /** État d'une info à plusieurs valeurs (ex. Prêt / En cours / Terminé) :
   *  'run' (en marche), 'done' (terminé), 'idle' (au repos) ou null (inconnu). */
  function inList(v, list) {
    if (!isSet(list) || !isSet(v)) return false;
    var s = String(v).toLowerCase().trim();
    return String(list).split(';').some(function (x) {
      x = x.trim().toLowerCase();
      if (!x) return false;
      if (isNum(x) && isNum(s)) return parseFloat(x) === parseFloat(s);
      return s === x || s.indexOf(x) >= 0;
    });
  }
  function runState(t, v) {
    if (!isSet(v)) return null;
    if (isSet(t.runValues) || isSet(t.doneValues)) {
      if (inList(v, t.doneValues)) return 'done';
      if (inList(v, t.runValues)) return 'run';
      return 'idle';
    }
    var a = isActive(v, t.onValue, t.invert);
    return a === null ? null : (a ? 'run' : 'idle');
  }

  /* ---------- formatage d'une valeur ---------- */
  function fmt(conf, meta, raw) {
    var out = { text: '…', html: '…', unit: '', invalid: true };
    if (!isSet(raw)) return out;
    var unit = conf.unit === '-' ? '' : (isSet(conf.unit) ? conf.unit : (meta && meta.unite) || '');
    var text = String(raw);
    if (isNum(raw)) {
      var n = parseFloat(raw);
      if ((isNum(conf.min) && n < parseFloat(conf.min)) || (isNum(conf.max) && n > parseFloat(conf.max))) {
        return { text: '—', html: '—', unit: '', invalid: true };
      }
      if (isNum(conf.decimals)) text = n.toFixed(parseInt(conf.decimals, 10));
    }
    var map = parseMap(conf.map);
    if (map[String(raw)] !== undefined) { text = map[String(raw)]; unit = ''; }
    var html = esc(text);
    if (conf.dateFmt && conf.dateFmt !== 'brut') {
      var d = parseDate(raw);
      if (d) {
        unit = '';
        if (conf.dateFmt === '2lignes') { text = formatDate(d, 'YYYY-MM-DD HH:mm:ss'); html = esc(formatDate(d, 'YYYY-MM-DD')) + '<br>' + esc(formatDate(d, 'HH:mm:ss')); }
        else if (conf.dateFmt === 'heure') { text = html = formatDate(d, 'HH:mm'); }
        else if (conf.dateFmt === 'date') { text = html = formatDate(d, 'DD/MM/YYYY'); }
        else if (conf.dateFmt === 'ilya') { text = html = relative(d); }
      }
    }
    return { text: text, html: html, unit: unit, invalid: false };
  }

  /* ================================================================== */
  /*  Icônes intégrées (viewBox 0 0 100 100, couleur = currentColor)      */
  /* ================================================================== */

  var S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = {
    // glyphes (boutons)
    'play': '<path d="M38 25 L75 50 L38 75 Z" fill="currentColor"/>',
    'stop': '<rect x="31" y="31" width="38" height="38" rx="4" fill="currentColor"/>',
    'pause': '<rect x="31" y="27" width="13" height="46" rx="3" fill="currentColor"/><rect x="56" y="27" width="13" height="46" rx="3" fill="currentColor"/>',
    'check': '<path d="M25 52 L43 69 L76 32" ' + S + ' stroke-width="11"/>',
    'cross': '<path d="M30 30 L70 70 M70 30 L30 70" ' + S + ' stroke-width="11"/>',
    'power': '<path d="M50 20 V50" ' + S + ' stroke-width="10"/><path d="M34 31 A25 25 0 1 0 66 31" ' + S + ' stroke-width="10"/>',
    'up': '<path d="M22 64 L50 36 L78 64" ' + S + ' stroke-width="11"/>',
    'down': '<path d="M22 36 L50 64 L78 36" ' + S + ' stroke-width="11"/>',
    'square': '<rect x="27" y="27" width="46" height="46" rx="5" fill="currentColor"/>',
    'plus': '<path d="M50 24 V76 M24 50 H76" ' + S + ' stroke-width="11"/>',
    'minus': '<path d="M24 50 H76" ' + S + ' stroke-width="11"/>',
    'refresh': '<path d="M74 40 A26 26 0 1 0 76 56" ' + S + ' stroke-width="9"/><path d="M78 22 V42 H58" ' + S + ' stroke-width="9"/>',
    'bulb': '<path d="M50 14 C31 14 20 28 20 43 C20 55 28 61 33 69 C35 72 36 75 36 78 H64 C64 75 65 72 67 69 C72 61 80 55 80 43 C80 28 69 14 50 14 Z" fill="currentColor"/><rect x="37" y="81" width="26" height="6" rx="2" fill="currentColor"/><rect x="41" y="89" width="18" height="5" rx="2" fill="currentColor"/>',
    'flag': '<path d="M27 14 V88" ' + S + ' stroke-width="9"/><path d="M31 19 C46 9 57 30 77 20 V58 C57 68 46 47 31 57 Z" fill="currentColor"/>',
    'drop': '<path d="M50 12 C50 12 22 46 22 63 A28 28 0 0 0 78 63 C78 46 50 12 50 12 Z" fill="currentColor"/>',
    'thermo': '<path d="M42 16 A8 8 0 0 1 58 16 V58 A17 17 0 1 1 42 58 Z" ' + S + ' stroke-width="6"/><circle cx="50" cy="72" r="9" fill="currentColor"/><path d="M50 40 V68" ' + S + ' stroke-width="7"/>',
    'clock': '<circle cx="50" cy="55" r="34" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 36 V56 L63 64" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M14 24 L28 12 M86 24 L72 12" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
    'zz': '<path d="M18 30 H44 L18 62 H44 M54 46 H82 L54 82 H82" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
    'bolt': '<path d="M58 6 L20 56 H46 L40 94 L80 40 H54 Z" fill="currentColor"/>',
    'alert': '<path d="M50 10 L94 88 H6 Z" fill="currentColor"/><rect x="45" y="36" width="10" height="28" rx="4" fill="#111"/><circle cx="50" cy="75" r="6" fill="#111"/>',
    // icônes complètes
    'check-circle': '<circle cx="50" cy="50" r="46" fill="currentColor"/><path d="M28 52 L44 67 L73 35" fill="none" stroke="var(--tl-glyph,#000)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>',
    'play-circle': '<circle cx="50" cy="50" r="46" fill="currentColor"/><path d="M40 29 L72 50 L40 71 Z" fill="var(--tl-glyph,#000)"/>',
    'stop-circle': '<circle cx="50" cy="50" r="42" ' + S + ' stroke-width="7"/><rect x="34" y="34" width="32" height="32" rx="3" fill="currentColor"/>',
    'home': '<path d="M50 10 L92 46 L82 46 L82 90 L18 90 L18 46 L8 46 Z" fill="currentColor"/><rect x="66" y="16" width="10" height="20" fill="currentColor"/><circle cx="50" cy="52" r="10" fill="var(--tl-tile,#000)"/><path d="M30 82 C30 70 39 65 50 65 C61 65 70 70 70 82 Z" fill="var(--tl-tile,#000)"/>',
    // ouvrants (fermé / ouvert)
    'porte': '<rect x="27" y="9" width="46" height="83" rx="3" fill="currentColor"/><rect x="31" y="13" width="38" height="79" fill="#000" opacity=".12"/><circle cx="37" cy="53" r="2.6" fill="#000"/>',
    'porte-open': '<path d="M30 10 H70 V92" ' + S + ' stroke-width="5"/><path d="M30 10 L54 19 L54 96 L30 88 Z" fill="currentColor"/><circle cx="49" cy="56" r="2.2" fill="#000"/>',
    'fenetre': '<rect x="21" y="13" width="58" height="74" rx="2" ' + S + ' stroke-width="8"/><path d="M50 15 V85 M23 50 H77" ' + S + ' stroke-width="8"/>',
    'fenetre-open': '<rect x="34" y="27" width="32" height="46" ' + S + ' stroke-width="6"/><path d="M12 16 L32 28 L32 72 L12 84 Z M88 16 L68 28 L68 72 L88 84 Z" ' + S + ' stroke-width="6"/><path d="M22 22 V78 M78 22 V78" ' + S + ' stroke-width="5"/>',
    'baie': '<rect x="12" y="12" width="76" height="76" rx="2" ' + S + ' stroke-width="7"/><path d="M50 14 V86" ' + S + ' stroke-width="7"/><path d="M42 46 V56 M58 46 V56" ' + S + ' stroke-width="5"/>',
    'baie-open': '<rect x="12" y="12" width="76" height="76" rx="2" ' + S + ' stroke-width="7"/><rect x="50" y="15" width="35" height="70" fill="currentColor" opacity=".35"/><path d="M58 14 V86 M70 14 V86" ' + S + ' stroke-width="6"/>',
    // baie coulissante à 2 contacts : vantail gauche (l), droit (r), les deux (lr)
    'baie-l': '<rect x="12" y="12" width="76" height="76" rx="2" ' + S + ' stroke-width="7"/><rect x="50" y="15" width="35" height="70" fill="currentColor" opacity=".35"/><path d="M50 14 V86 M62 14 V86" ' + S + ' stroke-width="6"/><path d="M20 50 H40 M34 44 L40 50 L34 56" ' + S + ' stroke-width="5"/>',
    'baie-r': '<rect x="12" y="12" width="76" height="76" rx="2" ' + S + ' stroke-width="7"/><rect x="15" y="15" width="35" height="70" fill="currentColor" opacity=".35"/><path d="M50 14 V86 M38 14 V86" ' + S + ' stroke-width="6"/><path d="M80 50 H60 M66 44 L60 50 L66 56" ' + S + ' stroke-width="5"/>',
    'baie-lr': '<rect x="12" y="12" width="76" height="76" rx="2" ' + S + ' stroke-width="7"/><rect x="15" y="15" width="23" height="70" fill="currentColor" opacity=".35"/><rect x="62" y="15" width="23" height="70" fill="currentColor" opacity=".35"/><path d="M30 14 V86 M38 14 V86 M62 14 V86 M70 14 V86" ' + S + ' stroke-width="5"/>',
    // fenêtre à 2 vantaux (battants)
    'fenetre2': '<rect x="21" y="13" width="58" height="74" rx="2" ' + S + ' stroke-width="7"/><path d="M50 15 V85" ' + S + ' stroke-width="7"/><path d="M44 44 V56 M56 44 V56" ' + S + ' stroke-width="4"/>',
    'fenetre2-l': '<rect x="21" y="13" width="58" height="74" rx="2" ' + S + ' stroke-width="6"/><path d="M50 15 V85" ' + S + ' stroke-width="6"/><path d="M56 44 V56" ' + S + ' stroke-width="4"/><path d="M21 13 L6 22 V78 L21 87 Z" fill="currentColor" opacity=".35"/><path d="M21 13 L6 22 V78 L21 87" ' + S + ' stroke-width="6"/>',
    'fenetre2-r': '<rect x="21" y="13" width="58" height="74" rx="2" ' + S + ' stroke-width="6"/><path d="M50 15 V85" ' + S + ' stroke-width="6"/><path d="M44 44 V56" ' + S + ' stroke-width="4"/><path d="M79 13 L94 22 V78 L79 87 Z" fill="currentColor" opacity=".35"/><path d="M79 13 L94 22 V78 L79 87" ' + S + ' stroke-width="6"/>',
    'fenetre2-lr': '<rect x="21" y="13" width="58" height="74" rx="2" ' + S + ' stroke-width="6"/><path d="M21 13 L6 22 V78 L21 87 Z M79 13 L94 22 V78 L79 87 Z" fill="currentColor" opacity=".35"/><path d="M21 13 L6 22 V78 L21 87 M79 13 L94 22 V78 L79 87" ' + S + ' stroke-width="6"/>',
    // hublot (fenêtre ronde à croisillons) : battant qui pivote à gauche
    'hublot': '<circle cx="50" cy="50" r="40" ' + S + ' stroke-width="7"/><path d="M50 12 V88 M12 50 H88" ' + S + ' stroke-width="6"/>',
    'hublot-open': '<circle cx="60" cy="50" r="34" fill="currentColor" opacity=".14"/><circle cx="60" cy="50" r="34" ' + S + ' stroke-width="6"/>' +
      '<ellipse cx="17" cy="50" rx="11" ry="34" style="fill:var(--tl-tile,#000)"/><ellipse cx="17" cy="50" rx="11" ry="34" ' + S + ' stroke-width="6"/><path d="M17 17 V83 M6.5 50 H27.5" ' + S + ' stroke-width="4"/>',
    'portail': '<rect x="10" y="16" width="11" height="72" rx="1" fill="currentColor"/><rect x="79" y="16" width="11" height="72" rx="1" fill="currentColor"/><path d="M23 28 H77 M23 76 H77 M32 28 V76 M41 28 V76 M50 28 V76 M59 28 V76 M68 28 V76" ' + S + ' stroke-width="4"/>',
    'portail-open': '<rect x="10" y="16" width="11" height="72" rx="1" fill="currentColor"/><rect x="79" y="16" width="11" height="72" rx="1" fill="currentColor"/>',
    'garage': '<path d="M8 30 L50 12 L92 30" ' + S + ' stroke-width="6"/><path d="M16 30 V90 M84 30 V90" ' + S + ' stroke-width="6"/><rect x="22" y="36" width="56" height="54" fill="currentColor"/><path d="M22 47 H78 M22 58 H78 M22 69 H78 M22 80 H78" stroke="#000" stroke-width="3" opacity=".45"/>',
    'garage-open': '<path d="M8 30 L50 12 L92 30" ' + S + ' stroke-width="6"/><path d="M16 30 V90 M84 30 V90" ' + S + ' stroke-width="6"/><rect x="22" y="34" width="56" height="8" fill="currentColor"/><path d="M28 78 L32 64 C33 61 35 59 38 59 H62 C65 59 67 61 68 64 L72 78 Z" fill="currentColor"/><rect x="26" y="76" width="48" height="9" rx="3" fill="currentColor"/><circle cx="35" cy="87" r="4" fill="currentColor"/><circle cx="65" cy="87" r="4" fill="currentColor"/>',
    'volet': '<rect x="18" y="12" width="64" height="76" ' + S + ' stroke-width="5"/><path d="M20 24 H80 M20 36 H80 M20 48 H80 M20 60 H80 M20 72 H80" ' + S + ' stroke-width="4"/>',
    'volet-open': '<rect x="18" y="12" width="64" height="76" ' + S + ' stroke-width="5"/><path d="M20 20 H80 M20 28 H80" ' + S + ' stroke-width="4"/>'
  };

  /* ---- Icônes animées (svg:a-…) : tournent quand la tuile est active ---- */
  var ANIM_ICONS = (function () {
    // a = durée de base (s). Chaque animation : style="animation: name calc(Xs*var(--d)) ..."
    function A(name, s, extra) { return 'style="animation:' + name + ' calc(' + s + 's * var(--d)) ' + (extra || 'linear infinite') + '"'; }
    function O(x, y) { return 'transform-origin:' + x + 'px ' + y + 'px;'; }
    function AO(name, s, x, y, extra) { return 'style="' + O(x, y) + 'animation:' + name + ' calc(' + s + 's * var(--d)) ' + (extra || 'linear infinite') + '"'; }
    function drops(xs, y0, name, base, cls) { return xs.map(function (x, i) { return '<circle class="' + (cls || 'fl') + ' fx" cx="' + x + '" cy="' + y0 + '" r="2.4" ' + 'style="animation:' + name + ' calc(' + base + 's * var(--d)) linear infinite;animation-delay:calc(' + (i * base / xs.length).toFixed(2) + 's * var(--d))"/>'; }).join(''); }
    var blades6 = ''; for (var i = 0; i < 6; i++) blades6 += '<path class="fl" d="M45 58 C47 50 52 46 57 46 C55 51 51 55 45 58 Z" transform="rotate(' + i * 60 + ' 45 58)"/>';
    var fan3 = function (cx, cy, r) { var s = ''; for (var i = 0; i < 3; i++) s += '<path class="fl" d="M' + cx + ' ' + cy + ' C' + (cx + r * .25) + ' ' + (cy - r * .45) + ' ' + (cx + r * .75) + ' ' + (cy - r * .6) + ' ' + (cx + r) + ' ' + (cy - r * .2) + ' C' + (cx + r * .6) + ' ' + (cy - r * .05) + ' ' + (cx + r * .3) + ' ' + cy + ' ' + cx + ' ' + cy + ' Z" transform="rotate(' + i * 120 + ' ' + cx + ' ' + cy + ')"/>'; return s; };
    var I = [
    ['Pompe piscine', '#4fc3f7',
     '<path class="ln" d="M6 70 H20"/><path class="ln" d="M45 32 V16 H66"/><circle class="lt" cx="45" cy="58" r="25" style="stroke-width:4"/><rect class="fs" x="20" y="64" width="6" height="12" rx="2"/>' +
     '<g class="rot" ' + AO('spin', .8, 45, 58) + '>' + blades6 + '<circle class="dk" cx="45" cy="58" r="4"/></g>' +
     '<rect class="fl" x="22" y="84" width="46" height="6" rx="3"/>' + drops([70, 76, 82, 88], 18, 'rise', 1.6) ],
    ['Pompe d\'arrosage', '#26c6da',
     '<g class="mv" ' + A('shake', .12) + '><rect class="lt" x="8" y="40" width="40" height="30" rx="5" style="stroke-width:4"/><path class="lt" d="M16 40 V70 M24 40 V70 M32 40 V70 M40 40 V70"/><circle class="lt" cx="62" cy="55" r="15" style="stroke-width:4"/><circle class="fl" cx="62" cy="55" r="5"/></g>' +
     '<path class="ln" d="M62 40 V26 H94"/><rect class="fl" x="6" y="76" width="74" height="6" rx="3"/>' +
     '<path class="lt fx" d="M62 38 V26 H94" style="stroke:#fff;stroke-width:2;stroke-dasharray:3 7;animation:dash calc(.6s * var(--d)) linear infinite"/>'],
    ['Arroseur rotatif', '#29b6f6',
     '<path class="ln" d="M8 88 H92"/><path class="ln" d="M50 88 V60"/><rect class="fl" x="42" y="52" width="16" height="10" rx="3"/>' +
     '<g class="rot" ' + AO('sweep', 2.4, 50, 54, 'ease-in-out infinite') + '><path class="ln" d="M50 54 V44"/><path class="lt fx" d="M50 44 C50 26 62 16 80 14" style="stroke-dasharray:2 5;stroke-width:3"/><path class="lt fx" d="M50 44 C50 30 58 22 70 20" style="stroke-dasharray:2 5;stroke-width:3;opacity:.7"/>' + drops([80, 70], 16, 'fall', 1.2) + '</g>'],
    ['Arroseur oscillant', '#4dd0e1',
     '<path class="ln" d="M8 88 H92"/><rect class="fl" x="20" y="80" width="60" height="6" rx="3"/><path class="ln" d="M30 80 V70 M70 80 V70"/>' +
     '<g class="rot" ' + AO('rock', 2.2, 50, 72, 'ease-in-out infinite') + '><path class="ln" d="M26 70 Q50 60 74 70"/>' +
     [32, 41, 50, 59, 68].map(function (x, i) { var dx = (x - 50) * .9; return '<path class="lt fx" d="M' + x + ' ' + (i === 2 ? 64 : 66) + ' Q' + (x + dx * .5) + ' 30 ' + (x + dx) + ' 14" style="stroke-dasharray:2 5;stroke-width:2.5;animation:dash calc(.5s * var(--d)) linear infinite"/>'; }).join('') + '</g>'],
    ['Goutte-à-goutte', '#4fc3f7',
     '<path class="ln" d="M6 30 H94"/><rect class="fl" x="44" y="30" width="12" height="9" rx="2"/><path class="fl" d="M50 39 L47 44 H53 Z"/>' +
     '<path class="fl fx" d="M50 46 C50 46 45 53 45 56 A5 5 0 0 0 55 56 C55 53 50 46 50 46 Z" style="animation:fall calc(1.4s * var(--d)) ease-in infinite"/>' +
     '<ellipse class="lt fx" cx="50" cy="82" rx="10" ry="3" style="' + O(50, 82) + 'animation:ring calc(1.4s * var(--d)) ease-out infinite;animation-delay:calc(1.1s * var(--d))"/>' +
     '<path class="fs" d="M10 86 Q30 80 50 86 T90 86 V94 H10 Z" style="opacity:.4"/><path class="ln" d="M10 86 Q30 80 50 86 T90 86"/>' +
     '<path class="lt" d="M22 78 V70 M22 72 L17 67 M22 74 L27 69 M78 78 V70 M78 72 L73 67 M78 74 L83 69" style="stroke:#66bb6a"/>'],
    ['Électrovanne', '#4fc3f7',
     '<rect class="fs" x="4" y="58" width="92" height="16" style="opacity:.2"/><path class="ln" d="M4 58 H96 M4 74 H96"/><rect class="fl" x="34" y="52" width="32" height="28" rx="4"/>' +
     '<path class="ln" d="M50 52 V36"/><g class="rot" ' + AO('quarter', 3, 50, 30, 'ease-in-out infinite') + '><ellipse class="lt" cx="50" cy="30" rx="16" ry="6" style="stroke-width:4"/><path class="ln" d="M34 30 H66"/></g>' +
     '<path class="lt fx" d="M4 66 H34 M66 66 H96" style="stroke:#fff;stroke-width:2.5;stroke-dasharray:4 6;animation:dash calc(.6s * var(--d)) linear infinite"/>'],
    ['Robot de piscine', '#4fc3f7',
     '<defs><clipPath id="rp"><rect x="0" y="0" width="100" height="100"/></clipPath></defs><g clip-path="url(#rp)"><g class="mv" ' + A('wave', 1.6) + '><path class="lt" d="M0 22 q5 -4 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0"/></g></g><path class="fs" d="M0 24 H100 V92 H0 Z" style="opacity:.15"/><path class="ln" d="M4 90 H96"/>' +
     '<g class="mv" ' + A('back', 3, 'ease-in-out infinite') + '><rect class="fl" x="32" y="62" width="36" height="20" rx="6"/><rect class="dk" x="38" y="66" width="14" height="6" rx="2"/><rect class="lt" x="30" y="80" width="40" height="8" rx="4"/><path class="lt" d="M50 62 V46 Q50 40 56 38"/>' + drops([40, 46, 58], 60, 'rise', 1.4, 'lt') + '</g>'],
    ['Cuve d\'eau', '#29b6f6',
     '<rect class="lt" x="20" y="10" width="60" height="82" rx="8" style="stroke-width:4"/><defs><clipPath id="cv"><rect x="22" y="12" width="56" height="78" rx="6"/></clipPath></defs>' +
     '<g clip-path="url(#cv)"><g class="mv" ' + A('wave', 1.4) + '><path class="fl" d="M0 46 q5 -5 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 V100 H0 Z" style="opacity:.8"/></g>' + drops([34, 52, 66], 86, 'rise', 2, 'wh') + '</g><path class="lt" d="M76 30 H84 M76 50 H84 M76 70 H84"/>'],
    ['Ventilateur / VMI', '#90caf9',
     '<circle class="lt" cx="50" cy="48" r="38" style="stroke-width:4"/><g class="rot" ' + AO('spin', .7, 50, 48) + '>' + fan3(50, 48, 32) + '</g><circle class="dk" cx="50" cy="48" r="6"/><circle class="fl" cx="50" cy="48" r="3"/>'],
    ['Radiateur', '#ff7043',
     [0, 1, 2, 3, 4].map(function (k) { return '<rect class="lt" x="' + (14 + k * 15) + '" y="46" width="11" height="42" rx="5" style="stroke-width:4"/>'; }).join('') + '<path class="ln" d="M10 82 H90"/>' +
     [24, 50, 76].map(function (x, i) { return '<path class="ln fx" d="M' + x + ' 38 q-5 -6 0 -12 t0 -12" style="animation:rise calc(1.8s * var(--d)) ease-in infinite;animation-delay:calc(' + i * .6 + 's * var(--d))"/>'; }).join('')],
    ['Flamme (poêle, chaudière)', '#ffa726',
     '<g class="mv" ' + AO('flick', .9, 50, 88, 'ease-in-out infinite') + '><path class="fl" d="M50 8 C58 26 76 36 76 60 A26 26 0 0 1 24 60 C24 46 32 38 36 30 C38 40 42 44 46 46 C44 32 46 20 50 8 Z"/><path class="wh" d="M50 46 C54 54 62 58 62 68 A12 12 0 0 1 38 68 C38 60 46 56 50 46 Z" style="opacity:.85"/></g>'],
    ['Prise électrique', '#ffd54f',
     '<rect class="lt" x="14" y="14" width="72" height="72" rx="18" style="stroke-width:4"/><circle class="lt" cx="50" cy="50" r="24" style="stroke-width:3"/><circle class="fl" cx="40" cy="50" r="4"/><circle class="fl" cx="60" cy="50" r="4"/>' +
     '<path class="fl fx" d="M53 24 L40 50 H50 L46 76 L62 44 H52 Z" style="fill:#fff;animation:pulse calc(.9s * var(--d)) ease-in-out infinite"/>'],
    ['Panneau solaire', '#ffca28',
     '<g class="rot" ' + AO('spin', 8, 22, 22) + '><circle class="fl" cx="22" cy="22" r="9"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) { return '<path class="lt" d="M22 6 V10" transform="rotate(' + a + ' 22 22)"/>'; }).join('') + '</g>' +
     '<path class="lt" d="M30 52 H92 L82 84 H20 Z" style="stroke-width:4;stroke:#64b5f6"/><path class="lt" d="M51 52 L44 84 M71 52 L64 84 M25 68 H87" style="stroke:#64b5f6"/><path class="ln" d="M50 84 V94 M40 94 H60" style="stroke:#64b5f6"/>' +
     [[34, 30], [46, 26], [58, 30]].map(function (p, i) { return '<path class="lt fx" d="M' + p[0] + ' ' + p[1] + ' l6 12" style="stroke-dasharray:4 4;animation:dash calc(.6s * var(--d)) linear infinite;animation-delay:' + i * .2 + 's"/>'; }).join('')],
    ['Batterie', '#66bb6a',
     '<rect class="lt" x="12" y="26" width="70" height="48" rx="7" style="stroke-width:4"/><rect class="fl" x="84" y="40" width="6" height="20" rx="2"/>' +
     [0, 1, 2, 3].map(function (k) { return '<rect class="fl" x="' + (18 + k * 16) + '" y="32" width="12" height="36" rx="3" style="animation:fill1 calc(2.4s * var(--d)) steps(1) infinite;animation-delay:calc(' + (k * 0.4) + 's * var(--d))"/>'; }).join('')],
    ['Voiture en charge', '#26a69a',
     '<path class="ln" d="M8 66 V56 L18 52 L28 38 H56 L68 52 L80 54 V66 Z"/><circle class="fl" cx="24" cy="68" r="7"/><circle class="fl" cx="66" cy="68" r="7"/><path class="lt" d="M32 42 H52 L60 52 H26 Z" style="opacity:.6"/>' +
     '<path class="ln" d="M80 58 C90 58 92 74 86 82 C82 88 88 92 94 92"/><path class="lt fx" d="M80 58 C90 58 92 74 86 82 C82 88 88 92 94 92" style="stroke:#fff;stroke-width:2;stroke-dasharray:3 6;animation:dash calc(.5s * var(--d)) linear infinite reverse"/>' +
     '<path class="fl fx" d="M48 6 L38 24 H46 L42 36 L56 18 H48 Z" style="fill:#ffd54f;animation:pulse calc(1s * var(--d)) ease-in-out infinite"/>'],
    ['Lave-linge', '#4fc3f7',
     '<rect class="lt" x="16" y="8" width="68" height="84" rx="8" style="stroke-width:4"/><path class="lt" d="M16 24 H84"/><circle class="fl" cx="26" cy="16" r="3"/><circle class="lt" cx="70" cy="16" r="4"/>' +
     '<circle class="lt" cx="50" cy="58" r="25" style="stroke-width:4"/><defs><clipPath id="ll"><circle cx="50" cy="58" r="21"/></clipPath></defs>' +
     '<g clip-path="url(#ll)"><path class="fs" d="M28 64 q6 -4 11 0 t11 0 t11 0 t11 0 V82 H28 Z" style="opacity:.45"/><g class="rot" ' + AO('spin', 1.2, 50, 58) + '><path class="fl" d="M38 52 q6 -10 14 -4 q-4 8 -14 4 Z"/><path class="fl" d="M56 62 q8 2 6 12 q-8 -2 -6 -12 Z" style="opacity:.7"/><circle class="lt" cx="50" cy="58" r="15" style="stroke-dasharray:3 6;opacity:.6"/></g>' + drops([40, 50, 60], 76, 'rise', 1.6, 'wh') + '</g>'],
    ['Sèche-linge', '#ff8a65',
     '<rect class="lt" x="16" y="18" width="68" height="74" rx="8" style="stroke-width:4"/><path class="lt" d="M16 32 H84"/><circle class="fl" cx="26" cy="25" r="3"/><rect class="fl" x="56" y="22" width="20" height="6" rx="2"/>' +
     '<circle class="lt" cx="50" cy="62" r="22" style="stroke-width:4"/><g class="rot" ' + AO('spin', 1.6, 50, 62) + '><path class="fl" d="M40 56 q6 -10 14 -4 q-4 8 -14 4 Z"/><path class="fl" d="M54 66 q8 2 6 10 q-8 -2 -6 -10 Z" style="opacity:.7"/></g>' +
     [36, 50, 64].map(function (x, i) { return '<path class="lt fx" d="M' + x + ' 14 q-4 -4 0 -8 t0 -6" style="stroke-width:3;animation:rise calc(2s * var(--d)) ease-in infinite;animation-delay:calc(' + i * .6 + 's * var(--d))"/>'; }).join('')],
    ['Lave-vaisselle', '#80deea',
     '<rect class="lt" x="16" y="20" width="68" height="72" rx="6" style="stroke-width:4"/><path class="lt" d="M16 34 H84"/><rect class="fl" x="40" y="26" width="20" height="4" rx="2"/><path class="lt" d="M24 82 H76"/>' +
     '<rect class="lt" x="26" y="44" width="48" height="30" rx="3" style="opacity:.6"/>' + [32, 42, 52, 62].map(function (x) { return '<path class="lt" d="M' + x + ' 72 V56 a4 4 0 0 1 8 0 V72"/>'; }).join('') +
     drops([34, 48, 62], 50, 'fall', 1.1, 'fl') +
     [38, 62].map(function (x, i) { return '<path class="lt fx" d="M' + x + ' 16 q-4 -4 0 -8 t0 -6" style="stroke-width:3;animation:rise calc(2.2s * var(--d)) ease-in infinite;animation-delay:calc(' + i + 's * var(--d))"/>'; }).join('')],
    ['Robot aspirateur', '#b0bec5',
     '<path class="ln" d="M4 86 H96" style="opacity:.5"/><g class="mv" ' + A('back', 3.2, 'ease-in-out infinite') + '><circle class="lt" cx="50" cy="56" r="28" style="stroke-width:4"/><circle class="fl" cx="50" cy="50" r="7"/><path class="lt" d="M30 66 H70" style="opacity:.6"/>' +
     '<g class="rot" ' + AO('spin', .5, 26, 80) + '><path class="lt" d="M18 80 H34 M26 72 V88 M20 74 L32 86 M32 74 L20 86"/></g>' +
     '<path class="lt fx" d="M80 84 h6 M84 80 h4" style="opacity:.5"/></g>'],
    ['Portail motorisé', '#b39ddb',
     '<rect class="fl" x="6" y="20" width="9" height="70" rx="2"/><rect class="fl" x="85" y="20" width="9" height="70" rx="2"/><path class="ln" d="M4 92 H96" style="opacity:.4"/>' +
     '<g class="mv" ' + AO('gateL', 4, 15, 50, 'ease-in-out infinite') + '><path class="lt" d="M15 30 H50 M15 82 H50 M22 30 V82 M29 30 V82 M36 30 V82 M43 30 V82 M50 26 V84" style="stroke-width:3"/></g>' +
     '<g class="mv" ' + AO('gateL', 4, 85, 50, 'ease-in-out infinite') + '><path class="lt" d="M85 30 H50 M85 82 H50 M78 30 V82 M71 30 V82 M64 30 V82 M57 30 V82 M50 26 V84" style="stroke-width:3"/></g>' +
     '<circle class="fl fx" cx="10" cy="14" r="4" style="fill:#ffa726;animation:pulse calc(.6s * var(--d)) steps(1) infinite"/>'],
    ['Ampoule', '#ffd54f',
     '<g ' + A('glow', 2, 'ease-in-out infinite') + '><path class="fl" d="M50 10 C33 10 22 23 22 38 C22 50 30 56 34 65 C35.5 68 36 71 36 74 H64 C64 71 64.5 68 66 65 C70 56 78 50 78 38 C78 23 67 10 50 10 Z"/></g>' +
     '<path class="lt" d="M42 64 V50 L46 44 L50 50 L54 44 L58 50 V64" style="stroke:#fff8d6"/><rect x="37" y="77" width="26" height="6" rx="2" fill="#8b949e"/><rect x="39" y="85" width="22" height="5" rx="2" fill="#8b949e"/>' +
     [[-1, 0], [1, 0]].map(function (s) { return '<path class="ln fx" d="M' + (50 + s[0] * 36) + ' 16 l' + s[0] * 7 + ' -6 M' + (50 + s[0] * 42) + ' 36 h' + s[0] * 8 + '" style="animation:pulse calc(2s * var(--d)) ease-in-out infinite"/>'; }).join('')],
    ['Sirène / alarme', '#ef5350',
     '<path class="fl" d="M30 74 V50 A20 20 0 0 1 70 50 V74 Z"/><rect class="lt" x="22" y="74" width="56" height="12" rx="3" style="stroke-width:4"/><path class="wh" d="M40 50 A10 10 0 0 1 50 40" style="fill:none;stroke:#fff;stroke-width:3;opacity:.7"/>' +
     '<g class="fx" ' + A('beam', .7, 'steps(1) infinite') + '><path class="fl" d="M30 52 L6 40 V64 Z M70 52 L94 40 V64 Z" style="opacity:.5"/></g>' +
     [0, 1].map(function (k) { return '<path class="ln fx" d="M' + (32 - k * 8) + ' ' + (24 - k * 6) + ' Q50 ' + (10 - k * 8) + ' ' + (68 + k * 8) + ' ' + (24 - k * 6) + '" style="' + O(50, 30) + 'animation:ring calc(1s * var(--d)) ease-out infinite;animation-delay:calc(' + k * .5 + 's * var(--d))"/>'; }).join('')],
    ['Sonnette', '#ffb74d',
     '<g class="rot" ' + AO('swing', .9, 50, 14, 'ease-in-out infinite') + '><circle class="fl" cx="50" cy="12" r="4"/><path class="fl" d="M50 16 C34 16 28 30 28 46 C28 58 22 64 18 70 H82 C78 64 72 58 72 46 C72 30 66 16 50 16 Z"/><circle class="fl" cx="50" cy="80" r="7"/></g>' +
     '<path class="ln fx" d="M10 30 Q6 44 12 58 M90 30 Q94 44 88 58" style="animation:pulse calc(.45s * var(--d)) steps(1) infinite"/>'],
    ['Mangeoire du lapin', '#a1887f',
     '<path class="lt" d="M22 8 H62 L52 34 H32 Z" style="stroke-width:4"/>' + [[34, 14], [44, 20], [52, 13], [40, 26], [48, 28]].map(function (p) { return '<circle class="fl" cx="' + p[0] + '" cy="' + p[1] + '" r="2.6"/>'; }).join('') +
     '<rect class="lt" x="14" y="34" width="66" height="16" rx="8" style="stroke-width:4"/><defs><clipPath id="vs"><rect x="16" y="36" width="62" height="12" rx="6"/></clipPath></defs>' +
     '<g clip-path="url(#vs)"><g class="mv" ' + A('wave', .8) + '><path class="lt" d="M10 36 l6 12 M20 36 l6 12 M30 36 l6 12 M40 36 l6 12 M50 36 l6 12 M60 36 l6 12 M70 36 l6 12 M80 36 l6 12 M90 36 l6 12" style="stroke-width:3"/></g></g>' +
     '<rect class="fl" x="4" y="38" width="10" height="8" rx="2"/><path class="lt" d="M80 42 H86 V54"/>' + drops([86, 86, 86], 56, 'fall', 1.2, 'fl') +
     '<path class="lt" d="M70 82 H96 L92 92 H74 Z" style="stroke-width:4"/>'],
    ['Piège à moustiques', '#81c784',
     '<rect class="lt" x="34" y="30" width="32" height="58" rx="8" style="stroke-width:4"/><path class="lt" d="M30 30 H70" style="stroke-width:5"/><path class="lt" d="M40 40 H60 M40 46 H60 M40 52 H60" style="opacity:.6"/>' +
     '<rect class="fs" x="38" y="60" width="24" height="10" rx="3" style="fill:#7e57c2;opacity:.7"/>' +
     '<g class="rot" ' + AO('spinx', .35, 50, 22) + '><path class="fl" d="M50 22 L36 19 Q34 22 36 25 Z M50 22 L64 19 Q66 22 64 25 Z"/></g><circle class="fl" cx="50" cy="22" r="3"/>' +
     [[14, 8, 30, 12], [86, 12, -30, 10], [10, 40, 34, -16], [90, 46, -34, -22], [20, 70, 26, -46]].map(function (m, i) { return '<circle class="fl fx" cx="' + m[0] + '" cy="' + m[1] + '" r="2" style="--x:' + m[2] + 'px;--y:' + m[3] + 'px;animation:suck calc(1.8s * var(--d)) ease-in infinite;animation-delay:calc(' + (i * .35).toFixed(2) + 's * var(--d))"/>'; }).join('')],
    ['Pompe à chaleur (unité ext.)', '#ff7043',
     '<rect class="lt" x="8" y="20" width="84" height="62" rx="6" style="stroke-width:4"/><rect class="fl" x="72" y="28" width="12" height="46" rx="2" style="opacity:.35"/><path class="ln" d="M16 82 V90 M84 82 V90"/>' +
     '<circle class="lt" cx="40" cy="51" r="25" style="stroke-dasharray:3 4"/><g class="rot" ' + AO('spin', .8, 40, 51) + '>' + fan3(40, 51, 21) + '</g><circle class="dk" cx="40" cy="51" r="4"/>' +
     [32, 44, 56].map(function (y, i) { return '<path class="lt fx" d="M94 ' + y + ' h6" style="stroke-dasharray:3 3;animation:dash calc(.5s * var(--d)) linear infinite;animation-delay:' + i * .15 + 's"/>'; }).join('')],
    ['Pompe à chaleur piscine', '#29b6f6',
     '<rect class="lt" x="6" y="12" width="52" height="48" rx="6" style="stroke-width:4"/><circle class="lt" cx="32" cy="36" r="17" style="stroke-dasharray:3 4"/><g class="rot" ' + AO('spin', .8, 32, 36) + '>' + fan3(32, 36, 14) + '</g><circle class="dk" cx="32" cy="36" r="3"/>' +
     '<path class="ln" d="M58 26 H74 V70 M58 46 H66 V70" style="stroke:#ff7043"/><path class="lt fx" d="M58 26 H74 V70" style="stroke:#fff;stroke-width:2;stroke-dasharray:3 6;animation:dash calc(.6s * var(--d)) linear infinite"/><path class="lt fx" d="M66 70 V46 H58" style="stroke:#fff;stroke-width:2;stroke-dasharray:3 6;animation:dash calc(.6s * var(--d)) linear infinite"/>' +
     '<defs><clipPath id="pp"><rect x="40" y="70" width="60" height="30"/></clipPath></defs><path class="fs" d="M44 74 H98 V96 H44 Z" style="opacity:.3"/><g clip-path="url(#pp)"><g class="mv" ' + A('wave', 1.4) + '><path class="lt" d="M40 76 q5 -4 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0"/></g></g>' +
     [52, 66, 82].map(function (x, i) { return '<path class="lt fx" d="M' + x + ' 92 q-3 -3 0 -6 t0 -6" style="stroke:#ff7043;stroke-width:2;animation:rise calc(1.8s * var(--d)) ease-in infinite;animation-delay:calc(' + i * .6 + 's * var(--d))"/>'; }).join('')],
    ['Recharge batterie', '#66bb6a',
     '<path class="ln" d="M4 44 H10 M4 56 H10" style="stroke-width:3"/><rect class="fl" x="10" y="38" width="9" height="24" rx="3"/>' + [24,31,38].map(function (x, i) { return '<path class="ln fx" d="M' + x + ' 43 l6 7 l-6 7" style="stroke-width:3.5;opacity:.15;animation:chev calc(1.2s * var(--d)) ease-in-out infinite;animation-delay:calc(' + (i * .2) + 's * var(--d))"/>'; }).join('') + '' +
     '<rect class="lt" x="48" y="30" width="42" height="40" rx="6" style="stroke-width:4"/><rect class="fl" x="91" y="42" width="5" height="16" rx="2"/>' +
     [0, 1, 2, 3].map(function (k) { return '<rect class="fl" x="' + (53 + k * 9) + '" y="35" width="6.5" height="30" rx="2" style="animation:fill1 calc(2.4s * var(--d)) steps(1) infinite;animation-delay:calc(' + (k * 0.4) + 's * var(--d))"/>'; }).join('') +
     ''],
    ['Décharge batterie', '#ffa726',
     '<rect class="lt" x="4" y="30" width="42" height="40" rx="6" style="stroke-width:4"/><rect class="fl" x="47" y="42" width="5" height="16" rx="2"/>' +
     [0, 1, 2, 3].map(function (k) { return '<rect class="fl" x="' + (9 + k * 9) + '" y="35" width="6.5" height="30" rx="2" style="animation:drain1 calc(2.4s * var(--d)) steps(1) infinite;animation-delay:calc(' + ((3 - k) * 0.4) + 's * var(--d))"/>'; }).join('') +
      [58,65,72].map(function (x, i) { return '<path class="ln fx" d="M' + x + ' 43 l6 7 l-6 7" style="stroke-width:3.5;opacity:.15;animation:chev calc(1.2s * var(--d)) ease-in-out infinite;animation-delay:calc(' + (i * .2) + 's * var(--d))"/>'; }).join('') + '' +
     '<path class="ln" d="M82 50 L90 42 L98 50 M84 48 V60 H96 V48" style="stroke-width:3.5"/>']
    ];
    var slugs = ['pompe-piscine', 'pompe-arrosage', 'arroseur-rotatif', 'arroseur-oscillant', 'goutte-a-goutte', 'electrovanne', 'robot-piscine', 'cuve', 'ventilateur', 'radiateur', 'flamme', 'prise', 'solaire', 'batterie', 'voiture-charge', 'lave-linge', 'seche-linge', 'lave-vaisselle', 'robot-aspirateur', 'portail-motorise', 'ampoule', 'sirene', 'sonnette', 'mangeoire', 'piege-moustiques', 'pac-ext', 'pac-piscine', 'batterie-charge', 'batterie-decharge'];
    var out = [];
    I.forEach(function (it, i) {
      var body = it[2]
        .replace(/class="([^"]+)"/g, function (m, c) { return 'class="' + c.split(/\s+/).map(function (x) { return 'tla-' + x; }).join(' ') + '"'; })
        .replace(/animation:([a-z0-9]+)/g, 'animation:tla-$1')
        .replace(/var\(--d\)/g, 'var(--tla-d, 1)')
        .replace(/id="([a-z]+)"/g, 'id="tla$1__"').replace(/url\(#([a-z]+)\)/g, 'url(#tla$1__)');
      ICONS['a-' + slugs[i]] = body;
      out.push(['svg:a-' + slugs[i], it[0], it[1]]);
    });
    // caméra dôme : l'objectif regarde autour de lui, voyant REC qui clignote
    ICONS['a-camera-dome'] = '<path class="tla-ln" d="M12 30 H88"/><path class="tla-ln" d="M20 30 V36 H80 V30"/><path class="tla-ln" d="M22 36 A28 28 0 0 0 78 36"/>' +
      '<g class="tla-mv" style="animation:tla-look calc(4s * var(--tla-d, 1)) ease-in-out infinite"><circle cx="50" cy="48" r="11" style="fill:var(--tl-tile,#000)" stroke="currentColor" stroke-width="4"/><circle class="tla-fl" cx="50" cy="48" r="4.5"/><circle cx="47" cy="45" r="1.8" fill="#fff" opacity=".8"/></g>' +
      '<circle class="tla-fx" cx="76" cy="23" r="3.8" fill="#ff3b30" style="animation:tla-rec calc(1s * var(--tla-d, 1)) steps(1) infinite"/>';
    out.push(['svg:a-camera-dome', 'Caméra dôme', '#4fc3f7']);
    // monitoring : baie serveur (voyants), batterie qui se remplit, cœur qui bat
    var D = function (sec, extra) { return 'animation:' + extra + ' calc(' + sec + 's * var(--tla-d, 1))'; };
    ICONS['a-monitoring'] = [0, 1, 2].map(function (k) {
      var y = 26 + k * 21;
      return '<rect class="tla-ln" x="8" y="' + y + '" width="54" height="17" rx="4" style="stroke-width:4.5"/>' +
        '<circle class="tla-fl" cx="18" cy="' + (y + 8.5) + '" r="2.8" style="' + D(0.6 + k * 0.35, 'tla-rec') + ' steps(1) infinite"/>' +
        '<circle class="tla-fl" cx="27" cy="' + (y + 8.5) + '" r="2.8" style="' + D(0.9 + k * 0.2, 'tla-rec') + ' steps(1) infinite;animation-delay:.3s"/>' +
        '<path class="tla-lt" d="M37 ' + (y + 8.5) + ' H54" opacity=".55"/>';
    }).join('') + '<path class="tla-ln" d="M18 92 H52" style="stroke-width:4.5"/>' +
      '<rect class="tla-ln" x="70" y="46" width="22" height="44" rx="4" style="stroke-width:4.5"/><rect class="tla-fl" x="76" y="41" width="10" height="5" rx="1.5"/>' +
      [0, 1, 2].map(function (k) { return '<rect class="tla-fl" x="75" y="' + (79 - k * 12) + '" width="12" height="8" rx="1.5" style="' + D(2.4, 'tla-fill1') + ' steps(1) infinite;animation-delay:calc(' + (k * 0.4) + 's * var(--tla-d, 1))"/>'; }).join('') +
      '<g class="tla-mv" style="transform-origin:76px 22px;' + D(1.2, 'tla-beat') + ' ease-in-out infinite"><path class="tla-fl" d="M76 38 C64 30 58 25 58 18 A8.5 8.5 0 0 1 76 14 A8.5 8.5 0 0 1 94 18 C94 25 88 30 76 38 Z"/>' +
      '<path d="M61 22 H68 L71 16 L75 28 L78 22 H90" fill="none" style="stroke:var(--tl-tile,#000)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></g>';
    out.push(['svg:a-monitoring', 'Monitoring', '#2ecc71']);
    return out;
  })();

  function iconHtml(spec) {
    spec = isSet(spec) ? String(spec) : '';
    if (!spec) return '';
    if (spec.indexOf('|') >= 0) {
      return spec.split('|').map(function (s) { return '<span class="tl-ic">' + iconHtml(s.trim()) + '</span>'; }).join('');
    }
    if (spec.indexOf('svg:') === 0) {
      var key = spec.slice(4), body = ICONS[key];
      if (body && key.indexOf('a-') === 0) {
        var uid = Math.random().toString(36).slice(2, 8);
        return '<svg class="tl-svg tl-anim" viewBox="0 0 100 100" overflow="visible" aria-hidden="true">' + body.replace(/__/g, uid) + '</svg>';
      }
      return body ? '<svg class="tl-svg" viewBox="0 0 100 100" aria-hidden="true">' + body + '</svg>' : '';
    }
    if (spec.indexOf('img:') === 0) spec = spec.slice(4);
    if (/\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(spec) || spec.indexOf('data:image') === 0) {
      return '<img class="tl-img" src="' + esc(spec) + '" alt="">';
    }
    if (spec.indexOf('<') === 0) spec = coreIconClass(spec);
    return '<i class="tl-fi ' + esc(spec) + '"></i>';
  }

  /** Classe d'une icône renvoyée par le sélecteur Jeedom (sans les classes de couleur icon_xxx). */
  function coreIconClass(html) {
    var div = document.createElement('div');
    div.innerHTML = String(html || '');
    var img = div.querySelector('img');
    if (img && img.getAttribute('src')) return 'img:' + img.getAttribute('src');
    var i = div.querySelector('i');
    var cls = i ? (i.getAttribute('class') || '') : String(html || '');
    return cls.split(/\s+/).filter(function (c) { return c && !/^icon_[a-z]+$/i.test(c); }).join(' ').trim();
  }

  /* ================================================================== */
  /*  UI : toast, modal, confirmation                                    */
  /* ================================================================== */

  var UI = {
    toast: function (msg, kind) {
      var host = document.getElementById('tl-toasts');
      if (!host) { host = el('div', 'tl-toasts'); host.id = 'tl-toasts'; document.body.appendChild(host); }
      var t = el('div', 'tl-toast' + (kind ? ' tl-toast-' + kind : ''), esc(msg));
      host.appendChild(t);
      setTimeout(function () { t.classList.add('tl-hide'); }, 2600);
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3100);
    },
    modal: function (opts) {
      var ov = el('div', 'tl-modal-ov');
      var box = el('div', 'tl-modal' + (opts.wide ? ' tl-modal-wide' : ''));
      if (opts.title) box.appendChild(el('div', 'tl-modal-title', esc(opts.title)));
      var body = el('div', 'tl-modal-body');
      if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
      box.appendChild(body);
      var foot = el('div', 'tl-modal-foot');
      function close() {
        document.removeEventListener('keydown', onKey);
        if (ov.parentNode) ov.parentNode.removeChild(ov);
      }
      function onKey(e) { if (e.key === 'Escape') close(); }
      (opts.buttons || [{ label: 'Fermer' }]).forEach(function (b) {
        var btn = el('button', 'tl-mbtn' + (b.primary ? ' tl-mbtn-primary' : '') + (b.danger ? ' tl-mbtn-danger' : ''), esc(b.label));
        btn.type = 'button';
        btn.addEventListener('click', function () {
          if (b.click && b.click(close, body) === false) return;
          close();
        });
        foot.appendChild(btn);
      });
      box.appendChild(foot);
      ov.appendChild(box);
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(ov);
      return { close: close, body: body };
    },
    /** Plein écran (caméra, widget, page web) : fermeture au clic, à Échap ou avec la croix. */
    lightbox: function (content, onClose) {
      var ov = el('div', 'tl-lightbox');
      var x = el('div', 'tl-lb-close', '&times;');
      ov.appendChild(content);
      ov.appendChild(x);
      var close = function () {
        document.removeEventListener('keydown', key);
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        if (onClose) onClose();
      };
      var key = function (e) { if (e.key === 'Escape') close(); };
      ov.addEventListener('click', function (e) { if (e.target === ov || e.target === x || e.target.classList.contains('tl-lb-media')) close(); });
      document.addEventListener('keydown', key);
      document.body.appendChild(ov);
      return { close: close, el: ov };
    },
    confirm: function (msg, onOk) {
      UI.modal({
        title: 'Confirmation', body: '<p>' + esc(msg) + '</p>',
        buttons: [{ label: 'Annuler' }, { label: 'Valider', primary: true, click: function () { onOk(); } }]
      });
    }
  };

  /* ================================================================== */
  /*  Ajax                                                               */
  /* ================================================================== */

  function ajax(action, data) {
    return new Promise(function (resolve, reject) {
      var payload = { action: action };
      Object.keys(data || {}).forEach(function (k) {
        var v = data[k];
        payload[k] = (v && typeof v === 'object') ? JSON.stringify(v) : v;
      });
      if (typeof root.JEEDOM_AJAX_TOKEN !== 'undefined') payload.jeedom_token = root.JEEDOM_AJAX_TOKEN;
      var $ = root.jQuery;
      if (!$) { reject(new Error('jQuery absent')); return; }
      $.ajax({
        type: 'POST', url: AJAX_URL, data: payload, dataType: 'json', global: false, cache: false,
        success: function (r) {
          if (r && r.state === 'ok') resolve(r.result);
          else reject(new Error(r && r.result ? r.result : 'Erreur serveur'));
        },
        error: function (xhr, status, err) { reject(new Error(err || status || 'Erreur réseau')); }
      });
    });
  }

  /* ================================================================== */
  /*  Hub : réception des mises à jour du core                           */
  /* ================================================================== */

  var Hub = {
    pages: [],
    hooked: {},
    last: {},
    installed: false,
    install: function () {
      if (this.installed) return;
      this.installed = true;
      var self = this;
      var batch = function (list) {
        if (!list) return;
        if (!Array.isArray(list)) list = [list];
        list.forEach(function (o) { if (o && isSet(o.cmd_id)) self.dispatch(o); });
      };
      if (root.jQuery) root.jQuery('body').on('cmd::update', function (e, d) { batch(d); });
      document.body.addEventListener('cmd::update', function (e) { batch(e.detail); });
      // équipement mis à jour par son plugin (ex. nouvelle plage de slider) : relecture des commandes concernées
      var eqBatch = function (list) {
        if (!list) return;
        if (!Array.isArray(list)) list = [list];
        list.forEach(function (o) {
          var eq = o && (o.eqLogic_id || o.id);
          if (isSet(eq)) self.pages.forEach(function (p) { p.eqChanged(String(eq)); });
        });
      };
      if (root.jQuery) root.jQuery('body').on('eqLogic::update', function (e, d) { eqBatch(d); });
      document.body.addEventListener('eqLogic::update', function (e) { eqBatch(e.detail); });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) self.pages.forEach(function (p) { p.resync(); });
      });
    },
    watch: function (id) {
      var j = root.jeedom;
      if (this.hooked[id] || !j || !j.cmd) return;
      this.hooked[id] = true;
      var self = this;
      var fn = function (o) { self.dispatch(Object.assign({}, o || {}, { cmd_id: id })); };
      try {
        if (typeof j.cmd.addUpdateFunction === 'function') {
          j.cmd.addUpdateFunction(id, fn);
        } else {
          j.cmd.update = j.cmd.update || {};
          var prev = j.cmd.update[id];
          j.cmd.update[id] = function (o) {
            if (typeof prev === 'function') { try { prev(o); } catch (e) { /* widget tiers */ } }
            fn(o);
          };
        }
      } catch (e) { /* le hub reste alimenté par les événements body */ }
    },
    dispatch: function (o) {
      var id = String(o.cmd_id);
      var v = o.value !== undefined ? o.value : o.display_value;
      var key = String(v) + '|' + (o.collectDate || '') + '|' + (o.valueDate || '');
      if (this.last[id] === key) return;
      this.last[id] = key;
      // pages dont la racine a quitté le document (navigation Jeedom) : on les libère
      this.pages.filter(function (p) { return !document.body.contains(p.root); }).forEach(function (p) { p.destroy(); });
      this.pages.forEach(function (p) { p.onUpdate(id, o); });
    },
    add: function (p) { this.install(); if (this.pages.indexOf(p) < 0) this.pages.push(p); },
    remove: function (p) { var i = this.pages.indexOf(p); if (i >= 0) this.pages.splice(i, 1); }
  };

  /* ================================================================== */
  /*  Page                                                               */
  /* ================================================================== */

  function Page(rootEl, data, opts) {
    this.root = rootEl;
    this.data = data || {};
    this.opts = opts || {};
    this.cmds = this.data.cmds || {};
    this.presets = this.data.presets || {};
    this.tiles = [];
    this.byCmd = {};
    this.timers = [];
    this.destroyed = false;
    if (rootEl.__tuilesPage) rootEl.__tuilesPage.destroy();
    rootEl.__tuilesPage = this;
    Hub.add(this);
    this.render();
    var self = this;
    this.onResize = function () {
      clearTimeout(self.resizeTimer);
      self.resizeTimer = setTimeout(function () { self.layout(true); }, 120);
    };
    root.addEventListener('resize', this.onResize);
    if (num(this.data.poll, 0) > 0 && !this.opts.edit) {
      this.timers.push(setInterval(function () { self.resync(); }, Math.max(5, num(self.data.poll, 0)) * 1000));
    }
    this.timers.push(setInterval(function () { self.tiles.forEach(function (a) { self.markAge(a); }); }, 60000));
    if (!this.opts.edit) this.setupHomeReturn();
  }

  /** Retour à la page d'accueil sans bouton : glisser depuis le bord gauche, et / ou retour automatique après inactivité. */
  Page.prototype.setupHomeReturn = function () {
    var dev = this.data.device === 'mobile' ? 'mobile' : 'tablette', self = this, nav = navFor(this.data.nav, dev);
    var hp = String(((nav.homePages || {})[dev]) || ''), cur = String(this.data.id || '');
    if (hp && hp === cur) return;                       // déjà sur l'accueil
    var idle = num(nav.idleHome, 0);
    if (!nav.swipeHome && !(idle > 0)) return;
    var go = function () { if (self.destroyed) return; if (hp) self.navigate({ target: 'page', page: hp }); else self.navigate({ target: 'home' }); };
    var offs = this.homeOffs = [];
    var on = function (target, ev, fn, opt) { target.addEventListener(ev, fn, opt); offs.push(function () { target.removeEventListener(ev, fn, opt); }); };
    if (nav.swipeHome) {
      var st = null, hint = null;
      var clear = function () { st = null; if (hint && hint.parentNode) hint.parentNode.removeChild(hint); hint = null; };
      on(document, 'touchstart', function (e) {
        var t = e.touches[0];
        if (e.touches.length !== 1 || t.clientX > 28) return;
        st = { x: t.clientX, y: t.clientY, at: Date.now() };
      }, { passive: true });
      on(document, 'touchmove', function (e) {
        if (!st) return;
        var t = e.touches[0], dx = t.clientX - st.x, dy = Math.abs(t.clientY - st.y);
        if (dy > 70) { clear(); return; }
        if (dx > 12) {
          if (!hint) { hint = el('div', 'tl-swipe-home', iconHtml('svg:home')); hint.style.top = Math.max(10, st.y - 30) + 'px'; document.body.appendChild(hint); }
          var k = Math.min(1, dx / 110);
          hint.style.transform = 'translateX(' + Math.round(-60 + 80 * k) + 'px)';
          hint.classList.toggle('tl-swipe-ok', k >= 1);
        }
      }, { passive: true });
      on(document, 'touchend', function (e) {
        if (!st) return;
        var t = e.changedTouches[0], dx = t.clientX - st.x, dy = Math.abs(t.clientY - st.y), quick = Date.now() - st.at < 1200;
        clear();
        if (dx > 110 && dy < 70 && quick) go();
      }, { passive: true });
      on(document, 'touchcancel', clear, { passive: true });
    }
    if (idle > 0) {
      var last = Date.now();
      var bump = function () { last = Date.now(); };
      ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(function (ev) { on(document, ev, bump, { passive: true }); });
      this.timers.push(setInterval(function () {
        if (document.querySelector('.tl-modal-ov, .tl-lb')) { bump(); return; }  // fenêtre ou caméra ouverte : on attend
        if (Date.now() - last >= idle * 60000) { bump(); go(); }
      }, 10000));
    }
  };

  Page.prototype.destroy = function () {
    this.destroyed = true;
    Hub.remove(this);
    (this.homeOffs || []).forEach(function (f) { f(); });
    root.removeEventListener('resize', this.onResize);
    this.timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
    this.tiles.forEach(function (a) { if (a.waiting) clearTimeout(a.waiting.timer); if (a.closePopup) a.closePopup(); });
    this.tiles = [];
    this.byCmd = {};
  };

  Page.prototype.meta = function (id) { id = cleanId(id); return id ? this.cmds[id] || null : null; };
  Page.prototype.val = function (id) { var m = this.meta(id); return m ? m.value : undefined; };
  Page.prototype.toast = function (m, k) { UI.toast(m, k); };
  Page.prototype.confirm = function (m, ok) { UI.confirm(m, ok); };

  Page.prototype.onUpdate = function (id, o) {
    if (this.destroyed) return;
    if (this.dynMap && this.dynMap[id]) this.scheduleMetas(this.dynMap[id]);
    var m = this.cmds[id];
    if (!m) return;
    m.value = o.value !== undefined ? o.value : (o.display_value !== undefined ? o.display_value : m.value);
    if (o.collectDate) m.collectDate = o.collectDate;
    if (o.valueDate) m.valueDate = o.valueDate;
    (this.byCmd[id] || []).forEach(function (api) { api.refresh(id); });
    if (this.alertIds && this.alertIds[id]) this.checkAlerts(id);
  };

  /** Commandes slider / select dont la plage ou la liste peut changer : on surveille les infos de leur équipement. */
  Page.prototype.setupDynamic = function () {
    var self = this;
    this.dynMap = {};
    this.dynByEq = {};
    Object.keys(this.cmds).forEach(function (id) {
      var m = self.cmds[id];
      if (!m || m.type !== 'action' || (m.subType !== 'slider' && m.subType !== 'select')) return;
      var eq = String(m.eqId || '');
      if (eq) (self.dynByEq[eq] = self.dynByEq[eq] || []).push(id);
      (m.siblings || []).forEach(function (sid) {
        sid = String(sid);
        (self.dynMap[sid] = self.dynMap[sid] || []);
        if (self.dynMap[sid].indexOf(id) < 0) self.dynMap[sid].push(id);
        Hub.watch(sid);
      });
    });
  };

  Page.prototype.eqChanged = function (eq) {
    if (this.dynByEq && this.dynByEq[eq]) this.scheduleMetas(this.dynByEq[eq], 300);
    (this.widgets && this.widgets[eq] || []).forEach(function (api) { if (api.reload) api.reload(); });
  };

  Page.prototype.scheduleMetas = function (ids, delay) {
    var self = this, key = ids.slice().sort().join(',');
    this.dynTimers = this.dynTimers || {};
    clearTimeout(this.dynTimers[key]);
    this.dynTimers[key] = setTimeout(function () { self.refreshMetas(ids); }, delay || 1000);
    this.timers.push(this.dynTimers[key]);
  };

  /** Relit plage / pas / liste des commandes ; redessine seulement si quelque chose a changé. */
  Page.prototype.refreshMetas = function (ids) {
    var self = this;
    if (this.opts.noResync && this.opts.edit) return;
    ajax('refreshMetas', { ids: ids }).then(function (metas) {
      if (self.destroyed) return;
      var changed = false;
      Object.keys(metas || {}).forEach(function (id) {
        var o = self.cmds[id], n = metas[id];
        if (!o || !n) return;
        ['minValue', 'maxValue', 'step', 'listValue'].forEach(function (k) {
          var a = o[k] === undefined || o[k] === null ? '' : String(o[k]);
          var b = n[k] === undefined || n[k] === null ? '' : String(n[k]);
          if (a !== b) { o[k] = n[k]; changed = true; }
        });
      });
      if (changed) self.rerenderFor(Object.keys(metas || {}));
    }, function () { /* silencieux */ });
  };

  /** Redessine la page (garde la liste ouverte fermée proprement). */
  Page.prototype.rerenderFor = function () {
    this.render();
  };

  Page.prototype.resync = function () {
    var self = this;
    var ids = Object.keys(this.cmds).filter(function (id) { return self.cmds[id].type === 'info'; });
    if (!ids.length || this.opts.noResync) return;
    ajax('getValues', { ids: ids }).then(function (list) {
      (list || []).forEach(function (o) { Hub.dispatch(o); });
    }, function () { /* silencieux */ });
  };

  Page.prototype.device = function () {
    var g = (this.data.layout && this.data.layout.grid) || {};
    return g.device === 'mobile' ? 'mobile' : 'tablette';
  };

  Page.prototype.isMobile = function () {
    var g = (this.data.layout && this.data.layout.grid) || {};
    if (this.device() === 'mobile') return !(num(g.width, 0) > 0);   // page mobile : taille en px si renseignée, sinon mode mobile
    if (this.opts.mobile === true) return true;
    if (this.opts.mobile === false) return false;
    var w = this.root.clientWidth || root.innerWidth;
    return w < 700;
  };

  Page.prototype.grid = function () {
    var g = (this.data.layout && this.data.layout.grid) || {};
    return {
      cols: Math.max(1, Math.round(num(g.cols, 5))),
      size: Math.max(40, num(g.size, 200)),
      gap: Math.max(0, num(g.gap, 12)),
      width: Math.max(0, num(g.width, 0)),      // largeur du design en px (0 = auto)
      height: Math.max(0, num(g.height, 0)),    // hauteur du design en px (0 = libre)
      cellH: Math.max(0, num(g.cellH, 0)),      // hauteur d'une case en px (0 = carrée)
      pad: Math.max(0, num(g.pad, 12)),         // marge intérieure du design
      fit: g.fit === true || g.fit === '1' || g.fit === 1,
      sideCols: Math.max(0.5, Math.min(4, Math.round(num(g.sideCols, 1) * 2) / 2)),   // largeur de la colonne de gauche (cases)
      mobileCols: g.device === 'mobile' ? Math.max(1, Math.round(num(g.cols, 3))) : Math.max(1, Math.round(num(g.mobileCols, 3))),
      dense: g.dense !== false && g.dense !== '0' && g.dense !== 0
    };
  };

  var SKINS = ['neon-bleu', 'neon-vert', 'neon-violet', 'ambre', 'graphite', 'aurore', 'cockpit', 'ardoise'];
  Page.prototype.applyTheme = function () {
    var th = this.data.theme || {}, s = this.root.style;
    var map = { tileBg: '--tl-tile', title: '--tl-c-title', text: '--tl-c-text', ok: '--tl-c-ok', warn: '--tl-c-warn', alert: '--tl-c-alert', info: '--tl-c-info', neutral: '--tl-c-neutral', on: '--tl-c-on', off: '--tl-c-off', sepColor: '--tl-sep' };
    Object.keys(map).forEach(function (k) { if (isSet(th[k])) s.setProperty(map[k], th[k]); });
    if (isSet(th.radius)) s.setProperty('--tl-radius', parseFloat(th.radius) + 'px');
    if (isSet(th.font)) s.setProperty('--tl-font', th.font);
    var g = (this.data.layout && this.data.layout.grid) || {};
    var bg = isSet(g.bg) ? g.bg : (isSet(th.pageBg) ? th.pageBg : '');
    s.background = bg;
    // thème : fond de page, style des tuiles et des titres
    var self = this, skin = SKINS.indexOf(g.skin) >= 0 ? g.skin : '';
    SKINS.forEach(function (k) { self.root.classList.toggle('tl-skin-' + k, k === skin); });
    this.root.classList.toggle('tl-skin', !!skin);
    this.root.classList.toggle('tl-has-bg', !!bg || !!skin);
    this.fillHeight();
  };

  /** Avec un fond de page, la page remplit l'écran jusqu'en bas (pas de bande grise sous les tuiles). */
  Page.prototype.fillHeight = function () {
    var s = this.root.style;
    if (!this.root.classList.contains('tl-has-bg') || this.opts.edit) { s.minHeight = ''; return; }
    var top = this.root.getBoundingClientRect().top + (root.pageYOffset || 0);
    s.minHeight = Math.max(0, root.innerHeight - Math.max(0, top)) + 'px';
  };

  /** Tuiles effectives (mobile : masquage, éclatement des lignes, ordre). */
  Page.prototype.effectiveTiles = function (mobile) {
    var tiles = ((this.data.layout && this.data.layout.tiles) || []).filter(Boolean);
    // sur mobile, pas de bouton Accueil de la colonne de gauche : l'appli a sa propre navigation
    if (mobile || this.device() === 'mobile') {
      tiles = tiles.filter(function (t) { return !(t.zone === 'side' && t.type === 'lien' && (t.target || 'home') === 'home'); });
    }
    if (!mobile) return tiles;
    var list = [];
    tiles.forEach(function (t, i) {
      var m = t.mobile || {};
      if (m.hide) return;
      // sur mobile, la colonne de gauche passe après le contenu
      var base = (t.zone === 'side' ? 1000 : 0) + i;
      var order = isNum(m.order) ? parseFloat(m.order) : null;
      if (m.split && t.type === 'lignes' && t.lines && t.lines.length) {
        t.lines.filter(function (l) { return (l.kind || 'value') !== 'title'; }).forEach(function (l, j) {
          list.push({ t: lineToTile(t, l, j), order: order, idx: base + j / 100 });
        });
      } else {
        list.push({ t: t, order: order, idx: base });
      }
    });
    list.sort(function (a, b) {
      var oa = a.order === null ? 1e6 + a.idx : a.order, ob = b.order === null ? 1e6 + b.idx : b.order;
      return oa - ob || a.idx - b.idx;
    });
    return list.map(function (x) { return x.t; });
  };

  function lineToTile(t, l, j) {
    var title = j === 0 ? (t.title || l.label) : (l.label || t.title);
    var base = { id: t.id + '_' + j, title: title, w: 1, h: 1, mobileSplit: t.id };
    var kind = l.kind || 'value';
    if (kind === 'button') {
      return Object.assign(base, { type: 'bouton', cmdOn: l.cmdOn, cmdOff: l.cmdOff, cmdInfo: l.cmdInfo, icon: l.icon, preset: l.preset, behavior: 'auto' });
    }
    if (kind === 'icon') {
      return Object.assign(base, { type: 'icone', cmdInfo: l.cmdInfo, icon: l.icon, preset: l.preset, colorOn: l.color });
    }
    return Object.assign(base, { type: 'valeur', cmdInfo: l.cmdInfo, unit: l.unit, decimals: l.decimals, map: l.map, preset: l.preset, color: l.color });
  }

  Page.prototype.render = function () {
    var self = this;
    this.tiles.forEach(function (a) { if (a.waiting) clearTimeout(a.waiting.timer); if (a.closePopup) a.closePopup(); });
    this.tiles = [];
    this.byCmd = {};
    this.grids = [];
    this.pinPos = {};
    this.resolved = {};
    this.widgets = {};
    this.root.innerHTML = '';
    this.root.classList.add('tl-root');
    this.applyTheme();
    var mobile = this.mobile = this.isMobile();
    this.root.classList.toggle('tl-is-mobile', mobile);
    this.root.classList.toggle('tl-is-edit', !!this.opts.edit);
    var g = this.grid();
    var tiles = this.effectiveTiles(mobile);
    var side = mobile ? [] : tiles.filter(function (t) { return t.zone === 'side'; });
    var main = mobile ? tiles : tiles.filter(function (t) { return t.zone !== 'side'; });
    var cols = this.cols = mobile ? g.mobileCols : g.cols;
    this.fixed = !mobile && g.width > 0;

    var stage = this.stage = el('div', 'tl-stage');
    var page = this.pageEl = el('div', 'tl-page' + (this.fixed ? ' tl-fixed' : ''));
    stage.appendChild(page);
    this.sideEl = null;
    if (side.length) {
      this.sideEl = el('div', 'tl-zone tl-side');
      page.appendChild(this.sideEl);
      page.appendChild(el('div', 'tl-sep'));
    }
    var mainEl = this.mainEl = el('div', 'tl-zone tl-mainzone');
    page.appendChild(mainEl);
    this.navEl = null;
    var gnav = ((this.data.layout && this.data.layout.grid) || {}).nav, cnav = this.data.nav || {};
    var devOn = cnav.devices ? !!cnav.devices[this.data.device === 'mobile' ? 'mobile' : 'tablette'] : !!cnav.enabled;
    if (gnav === 'tabs' || (gnav !== 'none' && devOn)) this.buildTabs();
    this.root.appendChild(stage);
    var hooks = el('div', 'tl-hooks');
    hooks.style.display = 'none';
    this.root.appendChild(hooks);
    this.hooksEl = hooks;
    this.layout(false);

    if (this.sideEl) this.buildZone(this.sideEl, side, g.sideCols, g);
    this.buildZone(mainEl, main, cols, g);
    if (!tiles.length && this.opts.edit) {
      mainEl.appendChild(el('div', 'tl-empty', 'Page vide : cliquez sur « Ajouter une tuile ».'));
    }

    // Abonnement aux commandes
    Object.keys(this.byCmd).forEach(function (id) {
      Hub.watch(id);
      // repère data-cmd_id pour le core, sauf dans l'éditeur (le formulaire Jeedom prendrait ces éléments pour des commandes)
      if (self.opts.edit) return;
      var hook = el('span', 'cmd tl-hook');
      hook.setAttribute('data-cmd_id', id);
      hooks.appendChild(hook);
    });
    this.applyGrids();
    this.autoHeight();
    this.scale();
    this.refit();
    if (!this.opts.edit) this.setupDynamic();
    this.setupAlerts();
  };

  /** Barre d'onglets : les pages du même appareil, la page courante en surbrillance. */
  /** Liste ordonnée des onglets : réglage commun (ordre, nom, icône, visible), puis les pages non classées. */
  /** Réglages de la barre pour un appareil : ceux de l'appareil (nav.dev[dev]) priment sur les réglages communs. */
  var NAV_DEV_KEYS = ['size', 'home', 'homeLabel', 'homeIcon', 'swipeHome', 'idleHome', 'full'];
  function navFor(nav, dev) {
    nav = nav || {};
    var out = {}, d = (nav.dev && nav.dev[dev]) || {};
    Object.keys(nav).forEach(function (k) { out[k] = nav[k]; });
    NAV_DEV_KEYS.forEach(function (k) { if (d[k] !== undefined && d[k] !== null) out[k] = d[k]; });
    return out;
  }
  function navItems(data) {
    var nav = data.nav || {}, pages = data.pages || [], byId = {}, out = [], seen = {};
    pages.forEach(function (pg) { byId[String(pg.id)] = pg; });
    var list = (nav.items || []).slice();
    // ordre propre à chaque appareil (nav.dev.tablette.items / nav.dev.mobile.items) avant l'ordre commun
    ['tablette', 'mobile'].forEach(function (d) { var di = nav.dev && nav.dev[d] && nav.dev[d].items; if (Array.isArray(di)) list = di.concat(list); });
    list.forEach(function (it) {
      var pg = byId[String(it.id)];
      if (!pg || seen[pg.id]) return;
      seen[pg.id] = true;
      out.push({ id: String(pg.id), name: pg.name, device: pg.device === 'mobile' ? 'mobile' : 'tablette', label: it.label || '', icon: it.icon || '', pageIcon: pg.icon || '', show: it.show !== false && it.show !== 'false' });
    });
    pages.forEach(function (pg) {
      if (seen[pg.id]) return;
      out.push({ id: String(pg.id), name: pg.name, device: pg.device === 'mobile' ? 'mobile' : 'tablette', label: pg.navLabel || '', icon: '', pageIcon: pg.icon || '', show: !pg.navHide });
    });
    return out;
  }

  /** Barre d'onglets commune : les pages du même appareil, la page courante en surbrillance. */
  Page.prototype.buildTabs = function () {
    var self = this, cur = String(this.data.id || ''), dev = this.data.device === 'mobile' ? 'mobile' : 'tablette', nav = navFor(this.data.nav, dev);
    var g = (this.data.layout && this.data.layout.grid) || {};
    // toute la largeur : par défaut sur mobile, au choix sur tablette
    var full = nav.full === undefined || nav.full === null ? dev === 'mobile' : (nav.full === true || nav.full === 'true' || nav.full === 1);
    var bar = this.navEl = el('div', 'tl-tabs' + (full ? ' tl-tabs-full' : ''));
    bar.style.setProperty('--tk', Math.max(0.5, Math.min(4, num(nav.size, 100) / 100)));
    var inner = el('div', 'tl-tabs-in');
    bar.appendChild(inner);
    var go = function (id) { if (!self.opts.edit) self.navigate({ target: 'page', page: id }); };
    // bouton accueil : page choisie pour cet appareil (sinon l'accueil du plugin)
    var hp = String(((nav.homePages || {})[dev]) || '');
    if (nav.home || g.navHome) {
      var lab = nav.homeLabel || '';
      var home = el('button', 'tl-tab tl-tab-home' + (lab ? ' tl-tab-homelab' : '') + (hp && hp === cur ? ' tl-on' : ''),
        '<span class="tl-tab-ico">' + iconHtml(nav.homeIcon || 'svg:home') + '</span>' + (lab ? '<span class="tl-tab-txt">' + esc(lab) + '</span>' : ''));
      home.type = 'button';
      home.title = lab || 'Accueil';
      home.addEventListener('click', function () {
        if (self.opts.edit) return;
        if (hp) { if (hp !== cur) go(hp); } else self.navigate({ target: 'home' });
      });
      inner.appendChild(home);
    }
    navItems(this.data).filter(function (it) { return it.device === dev && it.show && !(hp && it.id === hp && (nav.home || g.navHome)); }).forEach(function (it) {
      var b = el('button', 'tl-tab' + (it.id === cur ? ' tl-on' : ''),
        '<span class="tl-tab-ico">' + iconHtml(it.icon || it.pageIcon || 'fas fa-th-large') + '</span><span class="tl-tab-txt">' + esc(it.label || it.name) + '</span>');
      b.type = 'button';
      b.addEventListener('click', function () { if (it.id !== cur) go(it.id); });
      inner.appendChild(b);
    });
    // dans la zone principale : alignée sur la grille et mise à l'échelle avec le design
    (this.mainEl || this.root).insertBefore(bar, (this.mainEl || this.root).firstChild);
    // l'onglet actif reste visible sur mobile (barre qui défile)
    setTimeout(function () { var on = inner.querySelector('.tl-on'); if (on && inner.scrollWidth > inner.clientWidth) inner.scrollLeft = on.offsetLeft - 20; }, 50);
  };

  /** Une zone = suite de rangées ; chaque tuile « rangée » ouvre une nouvelle grille avec son espace. */
  Page.prototype.buildZone = function (zoneEl, tiles, maxCols, g) {
    var self = this;
    var grid = null;
    var newGrid = function () {
      grid = el('div', 'tl-grid' + (g.dense ? ' tl-dense' : ''));
      grid.__cols = maxCols;
      zoneEl.appendChild(grid);
      self.grids.push(grid);
      if (self.opts.edit && self.opts.onPlace) self.placeBindings(grid, zoneEl === self.sideEl ? 'side' : '');
    };
    // piles : une tuile « empilée » rejoint la tuile précédente, la hauteur de la pile est partagée
    var items = [];
    tiles.forEach(function (t) {
      var last = items[items.length - 1];
      if (t.stack && t.type !== 'rangee' && last && last.type !== 'rangee') {
        if (!last.__stack) items[items.length - 1] = last = { __stack: [last], type: 'pile' };
        last.__stack.push(t);
      } else {
        items.push(t);
      }
    });
    // anti-chevauchement des tuiles placées, segment par segment (une rangée = une grille)
    var seg = [];
    var flush = function () { self.resolvePins(seg, maxCols); seg = []; };
    items.forEach(function (it) { if (it.type === 'rangee') flush(); else seg.push(it); });
    flush();
    items.forEach(function (t) {
      if (t.__stack) {
        if (!grid) newGrid();
        self.buildStack(t.__stack, grid, maxCols);
        return;
      }
      if (t.type === 'rangee') {
        var space = Math.max(0, num(t.space, 30));
        var sp = el('div', 'tl-row-space');
        sp.style.height = space + 'px';
        sp.setAttribute('data-id', t.id || '');
        if (t.title && !t.hideTitle) {
          var lab = el('div', 'tl-row-label', esc(t.title));
          if (isSet(t.titleColor)) lab.style.color = color(t.titleColor);
          sp.appendChild(lab);
        }
        if (self.opts.edit) {
          sp.classList.add('tl-row-edit');
          sp.appendChild(el('span', 'tl-row-hint', 'rangée · ' + space + ' px'));
          self.editBindings({ t: t, el: sp });
        }
        zoneEl.appendChild(sp);
        grid = null;
        return;
      }
      if (!grid) newGrid();
      self.buildTile(t, grid, maxCols);
    });
    if (!this.grids.length || !grid) newGrid();
  };

  /** Calcule la taille des cases (px) selon la largeur du design ou l'écran. */
  Page.prototype.layout = function (fromResize) {
    if (fromResize && this.isMobile() !== this.mobile) { this.render(); return; }
    var g = this.grid();
    var cols = this.cols || g.cols;
    var side = this.sideEl ? g.sideCols : 0;
    var sideGaps = side > 1 ? (Math.ceil(side) - 1) * g.gap : 0;
    var sepW = side ? 26 + 2 * g.gap : 0;   // trait de séparation + espaces autour
    var w;
    if (this.fixed) {
      w = (g.width - 2 * g.pad - sepW - (cols - 1) * g.gap - sideGaps) / (cols + side);
    } else {
      var avail = (this.root.clientWidth || root.innerWidth) - 2 * (this.mobile ? 4 : g.pad);
      w = (avail - sepW - (cols - 1) * g.gap - sideGaps) / (cols + side);
      w = this.mobile ? Math.min(w, 260) : Math.min(g.size, w);
    }
    w = Math.max(40, Math.floor(w * 10) / 10);
    var h = g.cellH > 0 && !this.mobile ? g.cellH : w;
    this.cellW = w;
    this.cellH = h;
    var s = this.root.style;
    s.setProperty('--tl-s', Math.min(w, h) + 'px');
    s.setProperty('--tl-gap', g.gap + 'px');
    // 12 pistes par case ; l'espace entre tuiles est porté par la marge de chaque tuile
    s.setProperty('--tl-uw', ((w + g.gap) / 12) + 'px');
    s.setProperty('--tl-uh', ((h + g.gap) / 12) + 'px');
    s.setProperty('--tl-pad', (this.mobile ? 4 : g.pad) + 'px');
    if (this.pageEl) {
      this.pageEl.style.width = this.fixed ? g.width + 'px' : '';
      this.pageEl.style.height = this.fixed && g.height > 0 ? g.height + 'px' : '';
    }
    if (fromResize) { this.applyGrids(); this.autoHeight(); this.scale(); this.refit(); this.fillHeight(); }
  };

  /** Hauteur auto : réduit la hauteur des cases pour que toutes les rangées tiennent dans l'écran
   *  (ou dans la hauteur du design), au lieu d'être coupées en bas. Jamais plus haut que la case de base. */
  Page.prototype.autoHeight = function () {
    var self = this, raw = (this.data.layout && this.data.layout.grid) || {};
    if (this.mobile || raw.autoH === false || raw.autoH === '0' || raw.autoH === 0) return;
    var g = this.grid(), pad = g.pad, avail;
    if (this.fixed) {
      if (!(g.height > 0) || !this.pageEl) return;
      avail = this.pageEl.clientHeight - 2 * pad;
    } else {
      if (this.opts.edit) return;
      var top = this.root.getBoundingClientRect().top;
      avail = root.innerHeight - Math.max(0, top) - 2;
    }
    // hors grilles : marges de page, onglets, rangées… (design en px : dans la page ; sinon : toute la racine)
    var outer = this.fixed ? function () { return 0; } : function (z) { return self.root.offsetHeight - z.offsetHeight; };
    if (!(avail > 80)) return;
    // design en px (ex. tablette 1920 × 1200) : les rangées remplissent exactement la hauteur du design (plus hautes ou plus basses) ;
    // écran libre : seulement réduites si ça déborde
    var base = this.fixed ? this.cellW * 2.5 : (g.cellH > 0 ? g.cellH : this.cellW);
    var zones = [this.mainEl, this.sideEl].filter(Boolean);
    for (var pass = 0; pass < 3; pass++) {
      var hNow = this.cellH, best = base;
      zones.forEach(function (z) {
        var gridsH = 0;
        self.grids.forEach(function (gr) { if (gr.parentNode === z) gridsH += gr.offsetHeight; });
        if (!gridsH) return;
        var other = z.offsetHeight - gridsH + outer(z);
        best = Math.min(best, (avail - other) * (hNow + g.gap) / gridsH - g.gap);
      });
      best = Math.max(30, Math.floor(best * 10) / 10);
      if (Math.abs(best - hNow) < 0.5) break;
      this.cellH = best;
      var st = this.root.style;
      st.setProperty('--tl-uh', ((best + g.gap) / 12) + 'px');
      st.setProperty('--tl-s', Math.min(this.cellW, best) + 'px');
    }
    this.root.classList.add('tl-autoh');
  };

  Page.prototype.applyGrids = function () {
    (this.grids || []).forEach(function (gr) {
      gr.style.gridTemplateColumns = 'repeat(' + Math.max(1, Math.round(gr.__cols * 12)) + ', var(--tl-uw))';
    });
  };

  /** Mise à l'échelle d'un design en px : « adapter à l'écran », ou réduction dans l'aperçu. */
  Page.prototype.scale = function () {
    var st = this.stage, pg = this.pageEl;
    if (!st || !pg) return;
    this.k = 1;
    pg.style.transform = '';
    st.style.width = '';
    st.style.height = '';
    if (!this.fixed) return;
    var g = this.grid();
    var edit = !!this.opts.edit;
    if (!g.fit && !edit) return;
    var W = g.width, H = g.height > 0 ? g.height : pg.offsetHeight;
    var availW = (this.root.clientWidth || root.innerWidth) - 8;
    var k = availW / W;
    if (g.fit && !edit) {
      var top = this.root.getBoundingClientRect().top + (root.pageYOffset || 0);
      var availH = root.innerHeight - Math.max(0, top) - 8;
      if (availH > 100) k = Math.min(k, availH / H);
    } else {
      k = Math.min(1, k);
    }
    if (Math.abs(k - 1) < 0.005) return;
    pg.style.transform = 'scale(' + k + ')';
    st.style.width = (W * k) + 'px';
    st.style.height = (H * k) + 'px';
    this.k = k;
  };

  Page.prototype.refit = function () {
    var self = this;
    if (this.fitRaf) cancelAnimationFrame(this.fitRaf);
    this.fitRaf = requestAnimationFrame(function () {
      self.tiles.forEach(function (a) { self.fitTile(a); });
    });
  };

  Page.prototype.fitTile = function (api) {
    if (api.onFit) { try { api.onFit(); } catch (e) { /* widget tiers */ } }
    // tuile très basse (pile de 3, ¼ de hauteur…) : nom et valeur sur une seule ligne, taille selon la hauteur
    var th = api.el.clientHeight;
    if (th > 0) {
      api.el.style.setProperty('--th', th + 'px');
      var simple = ['valeur', 'icone', 'ouvrant', 'bouton', 'lien', 'vide', 'select', 'horloge', 'texte'].indexOf(api.t.type) >= 0;
      api.el.classList.toggle('tl-row', simple && th < 76 && !api.t.hideTitle && api.el.clientWidth > th * 1.6);
      api.el.classList.toggle('tl-low', th < 76);
    }
    api.el.querySelectorAll('.tl-fit').forEach(function (e) { fitLine(e); });
    api.el.querySelectorAll('.tl-fitbox').forEach(function (e) { fitBox(e); });
  };

  function fitLine(e) {
    e.style.fontSize = e.getAttribute('data-fs') || '';
    if (!e.offsetParent || !e.clientWidth) return;
    var size = parseFloat(root.getComputedStyle(e).fontSize), i = 0;
    while (e.scrollWidth > e.clientWidth + 1 && size > 8 && i++ < 40) {
      size *= 0.92;
      e.style.fontSize = size + 'px';
    }
  }
  function fitBox(e) {
    e.style.fontSize = e.getAttribute('data-fs') || '';
    if (!e.offsetParent || !e.clientHeight) return;
    var size = parseFloat(root.getComputedStyle(e).fontSize), i = 0;
    while ((e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) && size > 8 && i++ < 40) {
      size *= 0.92;
      e.style.fontSize = size + 'px';
    }
  }

  /** Tailles fixes en px (comme dans Word) : nom, texte. Le texte ne rétrécit que s'il déborde. */
  var TEXT_SEL = '.tl-val, .tl-text, .tl-lines, .tl-ov, .tl-popsel-val, .tl-vstate, .tl-sl-val, .tl-sub, .tl-list .tl-item, .tl-seg .tl-item, .tl-bar-txt, .tl-badge, .tl-selectbox, .tl-input';
  function applyPx(api) {
    var t = api.t;
    var set = function (e, px) { e.setAttribute('data-fs', px); e.style.fontSize = px; };
    if (isNum(t.titlePx)) {
      var ti = api.el.querySelector('.tl-title');
      if (ti) set(ti, parseFloat(t.titlePx) + 'px');
    }
    if (isNum(t.textPx)) {
      var px = parseFloat(t.textPx) + 'px';
      api.el.querySelectorAll(TEXT_SEL).forEach(function (e) { set(e, px); });
    }
  }

  /* ---------- construction d'une tuile ---------- */

  /** Place un élément dans la grille : taille en douzièmes de case, position libre éventuelle. */
  Page.prototype.gridPlace = function (elm, t, w, h, maxCols) {
    var spanW = Math.round(w * 12), spanH = Math.round(h * 12);
    elm.style.gridColumn = 'span ' + spanW;
    elm.style.gridRow = 'span ' + spanH;
    var pin = this.pinPos && t.id ? this.pinPos[t.id] : null;
    if (pin) {
      // position libre déjà vérifiée : aucune tuile placée ne se chevauche
      elm.style.gridColumn = pin.cx + ' / span ' + spanW;
      elm.style.gridRow = pin.cy + ' / span ' + spanH;
      elm.classList.add('tl-pinned');
      return;
    }
    if (!this.mobile && isNum(t.x)) {
      var cx = Math.round((parseFloat(t.x) - 1) * 12) + 1;
      cx = Math.max(1, Math.min(cx, Math.round(maxCols * 12) - spanW + 1));
      elm.style.gridColumn = cx + ' / span ' + spanW;
      elm.classList.add('tl-pinned');
    }
    if (!this.mobile && isNum(t.y)) {
      var cy = Math.max(1, Math.round((parseFloat(t.y) - 1) * 12) + 1);
      elm.style.gridRow = cy + ' / span ' + spanH;
      elm.classList.add('tl-pinned');
    }
  };

  /** Calcule une position libre pour chaque tuile placée : si elle tombe sur une autre, elle se cale à la place libre la plus proche. */
  Page.prototype.resolvePins = function (segment, maxCols) {
    var self = this, maxT = Math.max(1, Math.round(maxCols * 12)), occ = [], list = [];
    this.pinPos = this.pinPos || {};
    this.resolved = this.resolved || {};
    if (this.mobile) return;
    segment.forEach(function (it) {
      var t = it.__stack ? it.__stack[0] : it;
      if (!t || !t.id || !isNum(t.x) || !isNum(t.y)) return;
      var w = Math.min(clampSpan(t.w), maxCols);
      var h = it.__stack ? Math.max(1, Math.max.apply(null, it.__stack.map(function (m) { return clampSpan(m.h); }))) : clampSpan(t.h);
      var sw = Math.round(w * 12), sh = Math.round(h * 12);
      var rx = Math.round((parseFloat(t.x) - 1) * 12) + 1, ry = Math.round((parseFloat(t.y) - 1) * 12) + 1;
      var cx = Math.max(1, Math.min(rx, maxT - sw + 1));
      var cy = Math.max(1, ry);
      list.push({ id: t.id, cx: cx, cy: cy, rx: rx, ry: ry, sw: sw, sh: sh });
    });
    // la tuile qu'on vient de déplacer s'adapte aux autres (les autres ne bougent pas)
    var last = this.opts.lastMoved;
    list.sort(function (a, b) { return (a.id === last ? 1 : 0) - (b.id === last ? 1 : 0); });
    list.forEach(function (p) {
      var hit = function (x, y) {
        for (var i = 0; i < occ.length; i++) {
          var o = occ[i];
          if (x < o.x + o.w && x + p.sw > o.x && y < o.y + o.h && y + p.sh > o.y) return true;
        }
        return false;
      };
      var bx = p.cx, by = p.cy;
      if (hit(bx, by)) {
        var best = null, bd = Infinity, maxY = p.cy + p.sh;
        occ.forEach(function (o) { maxY = Math.max(maxY, o.y + o.h); });
        for (var y = 1; y <= maxY + 1; y++) {
          if ((y - p.cy) * (y - p.cy) > bd) { if (y > p.cy) break; else continue; }
          for (var x = 1; x <= maxT - p.sw + 1; x++) {
            var d = (x - p.cx) * (x - p.cx) + (y - p.cy) * (y - p.cy);
            if (d < bd && !hit(x, y)) { bd = d; best = [x, y]; }
          }
        }
        if (best) { bx = best[0]; by = best[1]; }
      }
      occ.push({ x: bx, y: by, w: p.sw, h: p.sh });
      self.pinPos[p.id] = { cx: bx, cy: by };
      if (bx !== p.rx || by !== p.ry) {
        self.resolved[p.id] = { x: Math.round((1 + (bx - 1) / 12) * 1e4) / 1e4, y: Math.round((1 + (by - 1) / 12) * 1e4) / 1e4 };
      }
    });
  };

  /** Pile : 2, 3… tuiles superposées qui se partagent la hauteur de la première, la rangée reste droite. */
  Page.prototype.buildStack = function (members, grid, maxCols) {
    var first = members[0], n = members.length;
    // hauteur de la pile = la plus grande hauteur de ses tuiles, au minimum 1 case : la rangée reste droite
    var W = Math.min(clampSpan(first.w), maxCols);
    var H = Math.max(1, Math.max.apply(null, members.map(function (m) { return clampSpan(m.h); })));
    var box = el('div', 'tl-stack');
    this.gridPlace(box, first, W, H, maxCols);
    grid.appendChild(box);
    var self = this;
    members.forEach(function (m, i) {
      var copy = Object.assign({}, m, { w: W, h: H / n });
      delete copy.x; delete copy.y;
      var api = self.buildTile(copy, box, maxCols);
      api.el.style.gridColumn = '';
      api.el.style.gridRow = '';
      // hauteur strictement égale pour chaque tuile de la pile
      api.el.style.height = 'calc((100% - ' + (n - 1) + ' * var(--tl-gap)) / ' + n + ')';
      api.el.classList.add('tl-stacked');
      if (i > 0) api.el.classList.add('tl-stacked-next');
    });
  };

  Page.prototype.buildTile = function (t, parent, maxCols) {
    var self = this;
    // recto-verso : l'appui long sert à retourner la tuile
    if (t.flip && t.cmdLong && !this.opts.edit) t = Object.assign({}, t, { cmdLong: '' });
    // tailles communes de la page (nom, texte, icône) : s'appliquent aux tuiles qui n'ont pas leur propre taille
    var pg = (this.data.layout && this.data.layout.grid) || {}, inh = {};
    ['titlePx', 'textPx', 'iconPx'].forEach(function (k) { if (!isNum(t[k]) && isNum(pg[k]) && parseFloat(pg[k]) > 0) inh[k] = parseFloat(pg[k]); });
    if (Object.keys(inh).length) t = Object.assign({}, t, inh);
    var type = R[t.type] ? t.type : 'vide';
    var w = Math.min(clampSpan(t.w), maxCols), h = clampSpan(t.h);
    var tileEl = el('div', 'tl-tile tl-t-' + type);
    // placement libre : colonne / ligne en cases (1 = première), au douzième de case près ; ignoré en mode mobile
    this.gridPlace(tileEl, t, w, h, maxCols);
    tileEl.style.setProperty('--k', Math.max(0.25, Math.min(w, h)));
    if (w < 0.5) tileEl.classList.add('tl-narrow');
    if (isNum(t.iconPx)) { tileEl.setAttribute('data-ipx', '1'); tileEl.style.setProperty('--tl-ipx', parseFloat(t.iconPx) + 'px'); }
    tileEl.setAttribute('data-id', t.id || '');
    if (h <= 0.5) tileEl.classList.add('tl-short');
    if (isSet(t.bg)) tileEl.style.background = color(t.bg);
    if (isNum(t.radius)) tileEl.style.borderRadius = Math.max(0, parseFloat(t.radius)) + 'px';
    if (t.title && !t.hideTitle) {
      var ti = el('div', 'tl-title tl-fit' + (t.titleSize === 'grand' ? ' tl-title-big' : ''), (isSet(t.titleIcon) ? '<span class="tl-tico">' + iconHtml(t.titleIcon) + '</span>' : '') + '<span class="tl-ttxt">' + esc(t.title) + '</span>');
      if (isSet(t.titleColor)) { ti.style.color = color(t.titleColor); ti.classList.add('tl-title-custom'); }
      tileEl.appendChild(ti);
    } else {
      tileEl.classList.add('tl-notitle');
    }
    var body = el('div', 'tl-body');
    if (t.align === 'gauche') body.classList.add('tl-left');
    tileEl.appendChild(body);
    parent.appendChild(tileEl);

    var api = { t: t, el: tileEl, body: body, w: w, h: h, deps: collectIds(t), waiting: null };
    var refresh = function () {};
    try {
      refresh = R[type](self, t, api) || refresh;
    } catch (e) {
      body.innerHTML = '<div class="tl-err">Erreur : ' + esc(e.message) + '</div>';
      if (root.console) console.error('[tuiles]', e);
    }
    api.refresh = function (id) {
      if (api.waiting && id && id === api.waiting.id) {
        clearTimeout(api.waiting.timer);
        api.waiting = null;
        tileEl.classList.remove('tl-pending');
        self.flash(api, true);
      }
      try { refresh(id); } catch (e) { if (root.console) console.error('[tuiles]', e); }
      self.markAge(api);
      if (id) self.fitTile(api);
      try { self.effects(api, id); } catch (e) { if (root.console) console.error('[tuiles]', e); }
    };
    api.deps.forEach(function (id) {
      (self.byCmd[id] = self.byCmd[id] || []).push(api);
    });
    applyPx(api);
    this.setupEffects(api);
    if (!this.opts.edit) this.setupDetails(api);
    api.refresh();
    this.tiles.push(api);

    if (this.opts.edit) this.editBindings(api);
    return api;
  };

  /** Ajoute une dépendance découverte au rendu (ex. info liée à une action). */
  Page.prototype.depend = function (api, id) {
    id = cleanId(id);
    if (!id || api.deps.indexOf(id) >= 0) return;
    api.deps.push(id);
    (this.byCmd[id] = this.byCmd[id] || []).push(api);
    Hub.watch(id);
  };

  Page.prototype.editBindings = function (api) {
    var self = this, t = api.t;
    var id = t.mobileSplit || t.id;
    if (this.opts.selected === id) api.el.classList.add('tl-selected');
    api.el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (self.opts.onSelect) self.opts.onSelect(id);
    }, true);
    if (!this.opts.onMove || t.mobileSplit) return;
    api.el.draggable = true;
    api.el.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      var r = api.el.getBoundingClientRect();
      self.drag = { id: id, gx: e.clientX - r.left, gy: e.clientY - r.top };
      api.el.classList.add('tl-dragging');
    });
    api.el.addEventListener('dragend', function () { api.el.classList.remove('tl-dragging'); });
    // tuile : le dépôt est géré par la grille (placement libre) ; rangée : dépôt = réordonner
    if (t.type !== 'rangee') return;
    api.el.addEventListener('dragover', function (e) { e.preventDefault(); api.el.classList.add('tl-dropover'); });
    api.el.addEventListener('dragleave', function () { api.el.classList.remove('tl-dropover'); });
    api.el.addEventListener('drop', function (e) {
      e.preventDefault();
      api.el.classList.remove('tl-dropover');
      var src = e.dataTransfer.getData('text/plain');
      if (src && src !== id) self.opts.onMove(src, id);
    });
  };

  /* ================================================================== */
  /*  Effets : animation, halo, mini-courbe, recto-verso                 */
  /* ================================================================== */

  /** La tuile est-elle « active » ? (bouton en marche, info à 1, ouvrant ouvert, seuil atteint…) */
  Page.prototype.tileActive = function (t) {
    if (t.type === 'interphone') return hikState(this, t) === 'ring';
    if (t.type === 'bouton') return btnState(this, t).act === true;
    var info = cleanId(t.cmdInfo) || cleanId(t.cmdV1) || cleanId(t.cmdBadge);
    if (t.type === 'lien' && Array.isArray(t.cmdList) && t.cmdList.length) {
      var self = this, rule = { op: t.countOp || '=', v: isSet(t.countVal) ? t.countVal : '1' };
      return t.cmdList.filter(function (id) { return matchRule(rule, self.val(id)); }).length > 0;
    }
    if (!info) return false;
    var v = this.val(info);
    if (!isSet(v)) return false;
    var th = (Array.isArray(t.thresholds) ? t.thresholds : []).filter(function (x) { return x && isSet(x.v); });
    if (th.length) {
      var r = evalRules(thresholdRules(t), v);
      return !!(r && r.op !== 'else');
    }
    if (t.type === 'ouvrant') return ouvState(this, t).open === true;
    if (t.type === 'icone' && (isSet(t.runValues) || isSet(t.doneValues))) return runState(t, v) === 'run';
    return isActive(v, t.onValue, t.invert) === true;
  };

  Page.prototype.setupEffects = function (api) {
    var t = api.t, self = this;
    if (t.anim && t.anim !== 'aucune') api.el.setAttribute('data-anim', t.anim);
    if (t.glow && t.glow !== 'aucun') api.el.setAttribute('data-glow', t.glow);
    // mini-courbe
    var sparkId = cleanId(t.cmdSpark) || cleanId(t.cmdInfo);
    if (t.spark && sparkId) {
      api.sparkId = sparkId;
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'tl-spark');
      svg.setAttribute('viewBox', '0 0 100 40');
      svg.setAttribute('preserveAspectRatio', 'none');
      api.el.insertBefore(svg, api.el.firstChild);
      api.el.classList.add('tl-has-spark');
      api.spark = svg;
      if (sparkId !== cleanId(t.cmdInfo)) this.depend(api, sparkId);
      this.history(sparkId, num(t.sparkHours, 24)).then(function (h) {
        api.sparkPts = (h.points || []).slice();
        self.drawSpark(api);
      }, function () {});
      this.timers.push(setInterval(function () {
        self.history(sparkId, num(t.sparkHours, 24), true).then(function (h) { api.sparkPts = (h.points || []).slice(); self.drawSpark(api); }, function () {});
      }, 10 * 60000));
    }
    // recto-verso (appui long)
    if (t.flip && !this.opts.edit) this.setupFlip(api);
  };

  /** Valeur « principale » d'une tuile (info, compteur…). */
  Page.prototype.mainValue = function (t, cmdId) {
    var id = cleanId(cmdId);
    if (id) return this.val(id);
    if (t.type === 'lien' && Array.isArray(t.cmdList) && t.cmdList.length) {
      var self = this, rule = { op: t.countOp || '=', v: isSet(t.countVal) ? t.countVal : '1' };
      return t.cmdList.filter(function (x) { return matchRule(rule, self.val(x)); }).length;
    }
    return this.val(cleanId(t.cmdInfo) || cleanId(t.cmdV1) || cleanId(t.cmdBadge));
  };

  /** Cadre coloré selon la valeur, indépendant de la couleur de la valeur. */
  Page.prototype.frame = function (api) {
    var t = api.t;
    // coche « Activer la couleur du cadre » (anciennes tuiles sans la coche : actif si un cadre est configuré)
    var on = t.frameOn === true || (t.frameOn === undefined && ((Array.isArray(t.frameTh) && t.frameTh.length) || isSet(t.frameBase)));
    var rules = on ? listRules(t.frameTh, t.frameBase) : null;
    var fr = api.el.querySelector(':scope > .tl-frame');
    if (!rules) { if (fr) fr.parentNode.removeChild(fr); return; }
    var r = evalRules(rules, this.mainValue(t, t.cmdFrame));
    if (!fr) { fr = el('div', 'tl-frame'); api.el.appendChild(fr); }
    var c = r && r.color ? color(r.color) : '';
    fr.style.display = c ? '' : 'none';
    if (!c) return;
    var w = isNum(t.frameW) ? Math.max(0, parseFloat(t.frameW)) : 3;
    fr.style.borderWidth = w + 'px';
    fr.style.borderColor = c;
    fr.style.boxShadow = t.frameGlow ? '0 0 calc(var(--tl-s) * .1) ' + c + ', inset 0 0 calc(var(--tl-s) * .05) ' + c : '';
  };

  Page.prototype.effects = function (api, id) {
    var t = api.t;
    this.frame(api);
    // icônes animées : en mouvement quand la tuile est active (ou toujours)
    if (t.type === 'lien') {
      var la = linkAnim(this, t.cmdAnim, t.animOp, t.animVal, t.animOn);
      if (la !== null) {
        var run = !!(this.opts && this.opts.edit) || la;
        var svgAnim = !!api.el.querySelector('.tl-anim');
        api.el.classList.toggle('tl-run', run && svgAnim);
        api.el.classList.toggle('tl-pulse-on', run && !svgAnim);   // image ou icône simple : pulsation
        var sp0 = { lent: 1.8, rapide: 0.55 }[t.animSpeed];
        api.el.style.setProperty('--tla-d', sp0 || 1);
        return this.effectsRest(api, id, t);
      }
    }
    if (t.type === 'lien2') return this.effectsRest(api, id, t);
    if (api.el.querySelector('.tl-anim')) {
      var mode = t.iconAnim || (t.animWhen === 'toujours' ? 'toujours' : '');
      // dans l'éditeur, l'icône bouge toujours pour qu'on voie l'animation
      // sans info d'état (ex. lien d'accueil sans compteur), « quand actif » n'a pas de sens : l'icône bouge en permanence
      var hasState = (t.type === 'lien' && Array.isArray(t.cmdList) && t.cmdList.length) || !!(cleanId(t.cmdInfo) || cleanId(t.cmdV1) || cleanId(t.cmdBadge) || cleanId(t.cmdState));
      api.el.classList.toggle('tl-run', !!(this.opts && this.opts.edit) || mode === 'toujours' || (mode !== 'jamais' && (!hasState || this.tileActive(t))));
      var sp = { lent: 1.8, rapide: 0.55 }[t.animSpeed];
      api.el.style.setProperty('--tla-d', sp || 1);
    } else api.el.classList.remove('tl-run');
    this.effectsRest(api, id, t);
  };

  Page.prototype.effectsRest = function (api, id, t) {
    var needActive = (t.anim && t.anim !== 'aucune') || (t.glow && t.glow !== 'aucun');
    if (needActive) {
      var act = this.tileActive(t);
      api.el.classList.toggle('tl-fx-on', (t.animWhen === 'toujours') ? true : act);
      api.el.classList.toggle('tl-glow-on', (t.glowWhen === 'toujours') ? true : act);
      // couleur du halo = couleur actuelle de la valeur / de l'icône / du bouton
      var c = '';
      var btn = api.el.querySelector('.tl-btn');
      if (btn && btn.style.background) c = root.getComputedStyle(btn).backgroundColor;
      if (!c) {
        var main = api.el.querySelector('.tl-val, .tl-ico, .tl-icons, .tl-vstate, .tl-popsel-val, .tl-text, .tl-lines .tl-lv, .tl-sl-val');
        if (main) c = root.getComputedStyle(main).color;
      }
      if (c) api.el.style.setProperty('--tl-glowc', c);
    }
    if (api.spark && id && id === api.sparkId) {
      var m = this.meta(id);
      if (m && isNum(m.value)) {
        api.sparkPts = api.sparkPts || [];
        api.sparkPts.push([Date.now(), parseFloat(m.value)]);
        var limit = Date.now() - num(t.sparkHours, 24) * 3600000;
        while (api.sparkPts.length > 2 && api.sparkPts[0][0] < limit) api.sparkPts.shift();
        this.drawSpark(api);
      }
    }
  };

  /** Historique (cache 10 min par page). */
  Page.prototype.history = function (id, hours, force, points) {
    this.histCache = this.histCache || {};
    var key = id + ':' + hours + ':' + (points || 120), c = this.histCache[key];
    if (c && !force && Date.now() - c.at < 600000) return c.p;
    var p = ajax('getHistory', { id: id, hours: hours, points: points || 120 });
    this.histCache[key] = { at: Date.now(), p: p };
    return p;
  };

  /* ---------- Bandeau d'alertes (réglé dans la page) ---------- */

  function alertTest(a, v) {
    if (!isSet(v)) return false;
    var op = a.op || '>';
    var cmp = function (x, y) {
      if (isNum(x) && isNum(y)) { x = parseFloat(x); y = parseFloat(y); return x < y ? -1 : (x > y ? 1 : 0); }
      x = String(x).toLowerCase(); y = String(y).toLowerCase();
      return x < y ? -1 : (x > y ? 1 : 0);
    };
    switch (op) {
      case '>': return cmp(v, a.v) > 0;
      case '>=': return cmp(v, a.v) >= 0;
      case '<': return cmp(v, a.v) < 0;
      case '<=': return cmp(v, a.v) <= 0;
      case '=': return cmp(v, a.v) === 0;
      case '!=': return cmp(v, a.v) !== 0;
      case 'out': return cmp(v, a.v) < 0 || cmp(v, a.v2) > 0;
      case 'in': return cmp(v, a.v) >= 0 && cmp(v, a.v2) <= 0;
    }
    return false;
  }
  function since(ms) {
    var m = Math.max(0, Math.round(ms / 60000));
    if (m < 1) return 'à l\'instant';
    if (m < 60) return 'depuis ' + m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    if (h < 24) return 'depuis ' + h + ' h' + (r ? ' ' + pad(r) : '');
    return 'depuis ' + Math.floor(h / 24) + ' j';
  }

  /** Lignes de message d'une info texte (rapport…) : découpe sur retour ligne, <br>, | ou ; ; ignore les valeurs « tout va bien ». */
  function msgLines(v, okList, sep) {
    if (!isSet(v)) return [];
    var tmp = document.createElement('div');
    tmp.innerHTML = String(v).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n');
    var txt = tmp.textContent || '';
    var re = sep === 'nl' ? /\n/ : (sep === 'pipe' ? /[\n|]/ : (sep === 'semi' ? /[\n;]/ : (sep === 'none' ? /$^/ : /[\n|]/)));
    var ok = String(isSet(okList) ? okList : 'ok;0;aucun;aucune;rien;none;-;vide').toLowerCase().split(/[;,]/).map(function (x) { return x.trim(); });
    return txt.split(re).map(function (l) { return l.replace(/\s+/g, ' ').trim(); })
      .filter(function (l) { return l && ok.indexOf(l.toLowerCase()) < 0; });
  }
  function hashStr(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  /** Couleur automatique d'une ligne selon ses mots (erreur → rouge, attention → orange, info → bleu). */
  function msgLevel(l) {
    var s = l.toLowerCase();
    if (/(erreur|défaut|defaut|panne|alarme|alerte|critique|hs\b|bloqu|fuite|intrusion)/.test(s)) return 'err';
    if (/(attention|avertissement|warning|bas\b|faible|haut\b|élevé|eleve|retard|ouvert|batterie)/.test(s)) return 'warn';
    return 'info';
  }
  var MSG_COLORS = { err: '#e5484d', warn: '#f5a623', info: '#2f9bff', ok: '#30c46c' };

  Page.prototype.setupAlerts = function () {
    var self = this, list = (((this.data.layout && this.data.layout.grid) || {}).alerts || []).filter(function (a) { return a && cleanId(a.cmdA); });
    this.alerts = list;
    this.alertIds = {};
    this.alertState = this.alertState || {};
    if (this.alertTimer) clearInterval(this.alertTimer);
    if (!list.length || this.opts.edit) { this.alerts = []; return; }
    this.alertEl = el('div', 'tl-alerts');
    this.root.insertBefore(this.alertEl, this.root.firstChild);
    list.forEach(function (a) { var id = cleanId(a.cmdA); self.alertIds[id] = true; Hub.watch(id); });
    this.alertTimer = setInterval(function () { self.checkAlerts(); }, 30000);
    this.timers.push(this.alertTimer);
    this.checkAlerts();
  };

  Page.prototype.checkAlerts = function () {
    var self = this, host = this.alertEl;
    if (!host || !this.alerts) return;
    var now = Date.now(), pid = String(this.data.id || 'x');
    host.innerHTML = '';
    this.alerts.forEach(function (a, i) {
      var id = cleanId(a.cmdA), m = self.meta(id), v = m ? m.value : undefined;
      var st = self.alertState[i] = self.alertState[i] || {};
      var addItem = function (key, html, c, sinceTxt) {
        try { if (root.localStorage.getItem(key)) return; } catch (e) { /* stockage indisponible */ }
        if (st.dismissed && st.dismissed[key]) return;
        var item = el('div', 'tl-alert' + (a.blink ? ' tl-alert-blink' : ''),
          '<span class="tl-alert-ico">' + iconHtml(a.icon || 'svg:alert') + '</span>' +
          '<span class="tl-alert-txt">' + html + '</span>' +
          (sinceTxt ? '<span class="tl-alert-since">' + sinceTxt + '</span>' : '') + '<span class="tl-alert-x">✕</span>');
        item.style.setProperty('--tl-ac', c);
        item.title = 'Appuyer pour masquer';
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          st.dismissed = st.dismissed || {};
          st.dismissed[key] = true;
          try { root.localStorage.setItem(key, '1'); } catch (er) { /* stockage indisponible */ }
          item.classList.add('tl-alert-out');
          setTimeout(function () { self.checkAlerts(); }, 250);
        });
        host.appendChild(item);
      };
      // texte de la commande : une alerte par ligne (rapport, liste de problèmes…)
      if (a.op === 'text') {
        msgLines(v, a.okVals, a.sep).forEach(function (l) {
          var c = isSet(a.color) ? color(a.color) : MSG_COLORS[msgLevel(l)];
          addItem('tl_alert_' + pid + '_' + i + '_' + hashStr(l), esc(l), c, '');
        });
        return;
      }
      var on = alertTest(a, v);
      if (!on) { st.since = null; return; }
      if (!st.since) {
        // depuis quand ? date de changement de valeur connue du core, sinon maintenant
        var d = m && parseDate(m.valueDate);
        st.since = d && d.getTime() <= now ? d.getTime() : now;
      }
      if (now - st.since < num(a.delay, 0) * 60000) return;
      var unit = (m && m.unite) || '';
      var txt = isSet(a.text) ? String(a.text) : ((m && m.name) || 'Alerte') + ' : #value#';
      txt = esc(txt).replace(/#value#/g, esc(String(v)) + (unit ? ' ' + esc(unit) : '')).replace(/#name#/g, esc((m && m.name) || '')).replace(/#since#/g, since(now - st.since));
      addItem('tl_alert_' + pid + '_' + i + '_' + st.since, txt, color(a.color || '#e5484d'), String(a.text || '').indexOf('#since#') >= 0 ? '' : since(now - st.since));
    });
    host.classList.toggle('tl-alerts-on', host.children.length > 0);
  };

  /* ---------- Détails au clic : courbe 24 h / 7 j / 30 j ---------- */

  var DETAIL_TYPES = { valeur: 'cmdInfo', jauge: 'cmdInfo', puissance: 'cmdInfo', thermostat: 'cmdTemp', chauffeeau: 'cmdTop' };
  Page.prototype.setupDetails = function (api) {
    var self = this, t = api.t, key = DETAIL_TYPES[t.type];
    // courbe au clic : seulement si elle est demandée dans la tuile
    if (!key || (t.details !== 'clic' && t.details !== 'long') || !cleanId(t[key]) || t.flip || t.cmdLong) return;
    var id = cleanId(t[key]), elx = api.el, timer = null, start = null, suppress = false;
    var target = t.type === 'thermostat' ? api.el.querySelector('.tl-th-cur') || elx : (t.type === 'chauffeeau' ? api.el.querySelector('.tl-ce2-tank') || elx : elx);
    var open = function () { self.details(id, t); };
    target.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.tl-th-btn, .tl-th-mode, .tl-th-power, .tl-th-ring-hit, .tl-ce2-btn, .tl-ce2-act')) return;
      start = [e.clientX, e.clientY];
      suppress = false;
      clearTimeout(timer);
      timer = setTimeout(function () { suppress = true; open(); }, 600);
    });
    target.addEventListener('pointermove', function (e) {
      if (start && Math.abs(e.clientX - start[0]) + Math.abs(e.clientY - start[1]) > 12) clearTimeout(timer);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { target.addEventListener(ev, function () { clearTimeout(timer); }); });
    target.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    target.addEventListener('click', function (e) {
      if (suppress) { suppress = false; e.stopImmediatePropagation(); e.preventDefault(); return; }
      // sans action au clic, un simple appui ouvre aussi les détails
      if (!t.cmdOn && t.type !== 'thermostat' && t.details !== 'long') { e.stopPropagation(); open(); }
    }, true);
    if (!t.cmdOn && t.type !== 'thermostat') target.classList.add('tl-click');
  };

  Page.prototype.details = function (id, t) {
    var self = this, m = this.meta(id) || {};
    var unit = m.unite || t.unit || '';
    var body = el('div', 'tl-det');
    var head = el('div', 'tl-det-head');
    var cur = el('div', 'tl-det-cur');
    var tabs = el('div', 'tl-det-tabs');
    head.appendChild(cur);
    head.appendChild(tabs);
    var stats = el('div', 'tl-det-stats');
    var chart = el('div', 'tl-det-chart');
    var foot = el('div', 'tl-det-foot');
    body.appendChild(head);
    body.appendChild(stats);
    body.appendChild(chart);
    body.appendChild(foot);
    var f = fmt(t.type === 'valeur' ? t : {}, m, m.value);
    cur.innerHTML = '<b>' + f.html + '</b>' + (unit ? '<span>' + esc(unit) + '</span>' : '');
    var d = parseDate(m.collectDate), dv = parseDate(m.valueDate);
    foot.innerHTML = (d ? 'Dernière mise à jour : <b>' + relative(d) + '</b> (' + formatDate(d, 'DD/MM HH:mm') + ')' : '') +
      (dv ? ' · valeur inchangée ' + since(Date.now() - dv.getTime()).replace('depuis', 'depuis') : '');
    var dec = isNum(t.decimals) ? parseInt(t.decimals, 10) : null;
    var nf = function (v) {
      if (!isNum(v)) return '–';
      var x = parseFloat(v);
      return (dec !== null ? x.toFixed(dec) : String(Math.round(x * 100) / 100)) + (unit ? ' ' + unit : '');
    };
    var load = function (hours, btn) {
      [].forEach.call(tabs.children, function (b) { b.classList.toggle('tl-on', b === btn); });
      chart.innerHTML = '<div class="tl-det-msg">Chargement…</div>';
      stats.innerHTML = '';
      self.history(id, hours, false, 300).then(function (h) {
        if (!h.historized && !(h.points || []).length) {
          chart.innerHTML = '<div class="tl-det-msg">Cette commande n\'est pas historisée.<br><small>Activez « Historiser » dans la configuration de la commande.</small></div>';
          return;
        }
        if (!(h.points || []).length) { chart.innerHTML = '<div class="tl-det-msg">Aucune donnée sur la période</div>'; return; }
        stats.innerHTML = '<div><span>Min</span><b>' + esc(nf(h.min)) + '</b></div><div><span>Moyenne</span><b>' + esc(nf(h.avg)) + '</b></div><div><span>Max</span><b>' + esc(nf(h.max)) + '</b></div>';
        drawChart(chart, h.points.concat(isNum(m.value) ? [[Date.now(), parseFloat(m.value)]] : []), hours, nf, t.color);
      }, function (err) { chart.innerHTML = '<div class="tl-det-msg">' + esc(err.message) + '</div>'; });
    };
    [[24, '24 h'], [168, '7 j'], [720, '30 j']].forEach(function (x, i) {
      var b = el('button', 'tl-det-tab', x[1]);
      b.type = 'button';
      b.addEventListener('click', function () { load(x[0], b); });
      tabs.appendChild(b);
      if (i === 0) setTimeout(function () { load(x[0], b); }, 0);
    });
    UI.modal({ title: t.title || m.name || 'Détails', body: body, wide: true });
  };

  function drawChart(host, pts, hours, nf, col) {
    var W = 600, H = 220, L = 46, R2 = 10, T = 12, B = 26;
    var t0 = pts[0][0], t1 = pts[pts.length - 1][0];
    var lo = Infinity, hi = -Infinity;
    pts.forEach(function (p) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    var padv = (hi - lo) * 0.08; lo -= padv; hi += padv;
    var X = function (x) { return L + (t1 > t0 ? (x - t0) / (t1 - t0) : 0) * (W - L - R2); };
    var Y = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); };
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ');
    var g = '';
    for (var k = 0; k <= 4; k++) {
      var v = lo + (hi - lo) * k / 4, y = Y(v);
      g += '<line x1="' + L + '" x2="' + (W - R2) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" class="tl-ch-grid"/>' +
        '<text x="' + (L - 6) + '" y="' + (y + 4).toFixed(1) + '" class="tl-ch-ylab">' + esc(String(Math.round(v * 10) / 10)) + '</text>';
    }
    for (var j = 0; j <= 4; j++) {
      var tx = t0 + (t1 - t0) * j / 4, dd = new Date(tx);
      g += '<text x="' + X(tx).toFixed(1) + '" y="' + (H - 6) + '" class="tl-ch-xlab" text-anchor="' + (j === 0 ? 'start' : (j === 4 ? 'end' : 'middle')) + '">' +
        (hours <= 24 ? pad(dd.getHours()) + ':' + pad(dd.getMinutes()) : pad(dd.getDate()) + '/' + pad(dd.getMonth() + 1)) + '</text>';
    }
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tl-ch">' + g +
      '<path d="' + line + ' L' + X(t1).toFixed(1) + ' ' + (H - B) + ' L' + L + ' ' + (H - B) + ' Z" class="tl-ch-area"/>' +
      '<path d="' + line + '" class="tl-ch-line"/>' +
      '<line class="tl-ch-cur" y1="' + T + '" y2="' + (H - B) + '" x1="-10" x2="-10"/><circle class="tl-ch-dot" r="4" cx="-10" cy="-10"/></svg>' +
      '<div class="tl-ch-tip"></div>';
    if (isSet(col) && String(col).charAt(0) === '#') host.style.setProperty('--tl-chc', col);
    var svg = host.querySelector('svg'), cl = svg.querySelector('.tl-ch-cur'), dot = svg.querySelector('.tl-ch-dot'), tip = host.querySelector('.tl-ch-tip');
    var move = function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
      var best = pts[0];
      pts.forEach(function (p) { if (Math.abs(X(p[0]) - x) < Math.abs(X(best[0]) - x)) best = p; });
      var px = X(best[0]), py = Y(best[1]);
      cl.setAttribute('x1', px); cl.setAttribute('x2', px);
      dot.setAttribute('cx', px); dot.setAttribute('cy', py);
      var dd = new Date(best[0]);
      tip.innerHTML = '<b>' + esc(nf(best[1])) + '</b> ' + pad(dd.getDate()) + '/' + pad(dd.getMonth() + 1) + ' ' + pad(dd.getHours()) + ':' + pad(dd.getMinutes());
      tip.style.display = 'block';
      tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth, px / W * r.width - tip.offsetWidth / 2)) + 'px';
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', function () { tip.style.display = 'none'; cl.setAttribute('x1', -10); cl.setAttribute('x2', -10); dot.setAttribute('cx', -10); });
  }

  Page.prototype.drawSpark = function (api) {
    var pts = (api.sparkPts || []).slice();
    var m = this.meta(api.sparkId);
    if (m && isNum(m.value)) pts.push([Date.now(), parseFloat(m.value)]);
    var svg = api.spark;
    if (!svg) return;
    if (pts.length < 2) { svg.innerHTML = ''; return; }
    var t0 = pts[0][0], t1 = pts[pts.length - 1][0];
    var lo = Infinity, hi = -Infinity;
    pts.forEach(function (p) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    var X = function (t) { return t1 > t0 ? (t - t0) / (t1 - t0) * 100 : 0; };
    var Y = function (v) { return 38 - (v - lo) / (hi - lo) * 34; };
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(2) + ' ' + Y(p[1]).toFixed(2); }).join(' ');
    var area = line + ' L100 40 L0 40 Z';
    var last = pts[pts.length - 1];
    svg.innerHTML = '<path class="tl-spark-area" d="' + area + '"/><path class="tl-spark-line" d="' + line + '" vector-effect="non-scaling-stroke"/>' +
      '<circle class="tl-spark-dot" cx="' + X(last[0]).toFixed(2) + '" cy="' + Y(last[1]).toFixed(2) + '" r="1.6"/>';
    var main = api.el.querySelector('.tl-val, .tl-ico, .tl-lines .tl-lv, .tl-text');
    var c = main ? root.getComputedStyle(main).color : '';
    if (c) svg.style.color = c;
  };

  /** Recto-verso : appui long → la tuile se retourne et montre le détail au dos. */
  Page.prototype.setupFlip = function (api) {
    var self = this, el = api.el, timer = null, start = null, suppress = false;
    el.classList.add('tl-flippable');
    el.addEventListener('pointerdown', function (e) {
      start = [e.clientX, e.clientY];
      clearTimeout(timer);
      timer = setTimeout(function () { suppress = true; self.flip(api); }, 600);
    });
    el.addEventListener('pointermove', function (e) {
      if (start && Math.abs(e.clientX - start[0]) + Math.abs(e.clientY - start[1]) > 12) clearTimeout(timer);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, function () { clearTimeout(timer); }); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // après un appui long, le clic qui suit ne déclenche pas l'action de la tuile
    el.addEventListener('click', function (e) {
      if (suppress) { suppress = false; e.stopImmediatePropagation(); e.preventDefault(); return; }
      if (el.classList.contains('tl-show-back') && !e.target.closest('.tl-back-act')) {
        e.stopImmediatePropagation();
        self.flip(api);
      }
    }, true);
  };

  Page.prototype.flip = function (api) {
    var self = this, el = api.el, t = api.t;
    if (el.classList.contains('tl-flipping')) return;
    var toBack = !el.classList.contains('tl-show-back');
    if (toBack) this.buildBack(api);
    el.classList.add('tl-flipping');
    setTimeout(function () {
      el.classList.toggle('tl-show-back', toBack);
      el.classList.remove('tl-flipping');
      el.classList.add('tl-flipping-in');
      setTimeout(function () { el.classList.remove('tl-flipping-in'); }, 200);
    }, 180);
    clearTimeout(api.backTimer);
    if (toBack) api.backTimer = setTimeout(function () { if (el.classList.contains('tl-show-back')) self.flip(api); }, 15000);
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* non supporté */ } }
  };

  Page.prototype.buildBack = function (api) {
    var self = this, t = api.t;
    var back = api.el.querySelector('.tl-back');
    if (!back) { back = el('div', 'tl-back'); api.el.appendChild(back); }
    back.innerHTML = '';
    back.appendChild(el('div', 'tl-back-title', esc(t.title || 'Détails')));
    var info = cleanId(t.cmdInfo) || cleanId(t.cmdV1) || cleanId(t.cmdSpark);
    var list = el('div', 'tl-back-lines');
    back.appendChild(list);
    var m = this.meta(info);
    var unit = t.unit === '-' ? '' : (isSet(t.unit) ? t.unit : (m && m.unite) || '');
    var dec = isNum(t.decimals) ? parseInt(t.decimals, 10) : 1;
    var line = function (lab, val) {
      var r = el('div', 'tl-back-line');
      r.appendChild(el('span', 'tl-back-lab', esc(lab)));
      r.appendChild(el('span', 'tl-back-val', esc(val)));
      list.appendChild(r);
      return r;
    };
    if (m) {
      var f = fmt(t, m, m.value);
      line('Actuel', f.text + (f.unit ? ' ' + f.unit : ''));
      var d = parseDate(m.collectDate || m.valueDate);
      if (d) line('Mise à jour', relative(d));
      if (isNum(m.value)) {
        var hours = num(t.sparkHours, 24);
        var lMin = line('Min ' + hours + ' h', '…'), lMax = line('Max ' + hours + ' h', '…'), lAvg = line('Moyenne', '…');
        this.history(info, hours).then(function (h) {
          var fx = function (v) { return isNum(v) ? parseFloat(v).toFixed(dec) + (unit ? ' ' + unit : '') : '—'; };
          lMin.lastChild.textContent = fx(h.min);
          lMax.lastChild.textContent = fx(h.max);
          lAvg.lastChild.textContent = fx(h.avg);
          if (!h.historized && !isNum(h.min)) lAvg.lastChild.textContent = 'non historisée';
        }, function () { lMin.lastChild.textContent = lMax.lastChild.textContent = lAvg.lastChild.textContent = '—'; });
      }
    } else {
      line('Info', 'aucune');
    }
    var acts = (Array.isArray(t.cmdBack) ? t.cmdBack : []).map(cleanId).filter(Boolean);
    if (acts.length) {
      var bar = el('div', 'tl-back-acts');
      acts.forEach(function (id) {
        var am = self.meta(id);
        var b = el('div', 'tl-back-act', esc(am ? am.name : '#' + id));
        b.addEventListener('click', function (e) { e.stopPropagation(); self.run(api, id, {}, { confirm: t.confirm }); });
        bar.appendChild(b);
      });
      back.appendChild(bar);
    }
    back.appendChild(el('div', 'tl-back-hint', 'toucher pour revenir'));
  };

  /** Éditeur : déposer une tuile dans une grille la place à cet endroit (colonne / ligne en cases). */
  Page.prototype.placeBindings = function (grid, zone) {
    var self = this;
    var tileUnder = function (e, src) {
      var tg = e.target && e.target.closest ? e.target.closest('.tl-tile[data-id]') : null;
      if (!tg || !grid.contains(tg)) return null;
      var id = tg.getAttribute('data-id');
      return id && id !== src ? tg : null;
    };
    var clearOver = function () { grid.querySelectorAll('.tl-dropover').forEach(function (x) { x.classList.remove('tl-dropover'); }); };
    grid.addEventListener('dragover', function (e) {
      e.preventDefault();
      grid.classList.add('tl-grid-over');
      clearOver();
      var tg = tileUnder(e, self.drag && self.drag.id);
      if (tg) tg.classList.add('tl-dropover');
    });
    grid.addEventListener('dragleave', function (e) { if (!grid.contains(e.relatedTarget)) { grid.classList.remove('tl-grid-over'); clearOver(); } });
    grid.addEventListener('drop', function (e) {
      e.preventDefault();
      grid.classList.remove('tl-grid-over');
      clearOver();
      var d = self.drag, src = e.dataTransfer.getData('text/plain') || (d && d.id);
      if (!src) return;
      // lâchée sur une autre tuile : on échange les deux tuiles
      var tg = tileUnder(e, src);
      if (tg && self.opts.onSwap) { self.drag = null; self.opts.onSwap(src, tg.getAttribute('data-id')); return; }
      var g = self.grid(), k = self.k || 1;
      var r = grid.getBoundingClientRect();
      var uw = (self.cellW + g.gap) / 12 * k, uh = (self.cellH + g.gap) / 12 * k;
      var gx = d && d.id === src ? d.gx : 0, gy = d && d.id === src ? d.gy : 0;
      // aimant : calage sur les quarts et les tiers de case (pistes multiples de 3 ou de 4)
      var snap = function (v) {
        v = Math.max(0, v);
        var a3 = Math.round(v / 3) * 3, a4 = Math.round(v / 4) * 4;
        return Math.abs(a3 - v) <= Math.abs(a4 - v) ? a3 : a4;
      };
      var tx = snap((e.clientX - gx - r.left) / uw), ty = snap((e.clientY - gy - r.top) / uh);
      var x = 1 + Math.max(0, tx) / 12, y = 1 + Math.max(0, ty) / 12;
      self.drag = null;
      self.opts.onPlace(src, Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4, zone);
    });
  };

  Page.prototype.markAge = function (api) {
    var t = api.t;
    if (!isNum(t.maxAge) || !t.cmdInfo) { api.el.classList.remove('tl-stale'); return; }
    var m = this.meta(t.cmdInfo);
    var d = m && parseDate(m.collectDate || m.valueDate);
    var stale = !d || (Date.now() - d.getTime()) > parseFloat(t.maxAge) * 60000;
    api.el.classList.toggle('tl-stale', stale);
    if (stale) api.el.setAttribute('title', 'Pas de valeur récente' + (d ? ' (' + relative(d) + ')' : ''));
    else api.el.removeAttribute('title');
  };

  /* ---------- actions ---------- */

  Page.prototype.exec = function (id, value) {
    var self = this;
    return new Promise(function (resolve, reject) {
      id = cleanId(id);
      if (!id) { reject(new Error('Aucune commande action configurée')); return; }
      if (self.opts.edit) { resolve(); return; }
      var j = root.jeedom;
      if (!j || !j.cmd || typeof j.cmd.execute !== 'function') { reject(new Error('jeedom.cmd.execute indisponible')); return; }
      j.cmd.execute({
        id: id,
        value: value || {},
        success: function () { resolve(); },
        error: function (err) { reject(new Error((err && (err.message || err.result)) || 'Erreur d\'exécution')); }
      });
    });
  };

  /** Exécution avec confirmation, flash et attente du retour d'état. */
  Page.prototype.run = function (api, cmdId, value, o) {
    if (this.opts.edit) return;
    o = o || {};
    var self = this;
    var go = function () {
      api.el.classList.add('tl-busy');
      self.exec(cmdId, value).then(function () {
        api.el.classList.remove('tl-busy');
        var wait = num(o.wait, 0), infoId = cleanId(o.infoId);
        if (infoId && wait > 0) self.waitFeedback(api, infoId, wait);
        else self.flash(api, true);
      }, function (err) {
        api.el.classList.remove('tl-busy');
        self.flash(api, false);
        self.toast(err.message || 'Erreur', 'error');
      });
    };
    if (isSet(o.confirm)) this.confirm(o.confirm, go); else go();
  };

  Page.prototype.waitFeedback = function (api, infoId, seconds) {
    var self = this;
    if (api.waiting) clearTimeout(api.waiting.timer);
    api.el.classList.add('tl-pending');
    api.waiting = {
      id: infoId,
      timer: setTimeout(function () {
        api.waiting = null;
        api.el.classList.remove('tl-pending');
        api.el.classList.add('tl-nofb');
        setTimeout(function () { api.el.classList.remove('tl-nofb'); }, 6000);
        self.toast('Pas de retour : ' + (api.t.title || 'commande'), 'error');
      }, seconds * 1000)
    };
  };

  Page.prototype.flash = function (api, ok) {
    var c = ok ? 'tl-flash-ok' : 'tl-flash-ko';
    api.el.classList.remove('tl-flash-ok', 'tl-flash-ko');
    void api.el.offsetWidth;
    api.el.classList.add(c);
    setTimeout(function () { api.el.classList.remove(c); }, 900);
  };

  /** Clic simple + appui long optionnel, sur toute la tuile ou un élément. */
  Page.prototype.press = function (target, onClick, onLong) {
    if (this.opts.edit) return;
    target.classList.add('tl-click');
    if (!onLong) {
      target.addEventListener('click', function (e) { e.stopPropagation(); onClick(e); });
      return;
    }
    var timer = null, long = false;
    target.addEventListener('pointerdown', function () {
      long = false;
      timer = setTimeout(function () { long = true; onLong(); }, 650);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      target.addEventListener(ev, function () { clearTimeout(timer); });
    });
    target.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!long) onClick(e);
    });
    target.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  Page.prototype.navigate = function (t) {
    if (this.opts.edit) return;
    var target = t.target || (t.url ? 'url' : (t.page ? 'page' : 'home'));
    if (target === 'url' && t.url) {
      if (t.newTab) root.open(t.url, '_blank'); else root.location.href = t.url;
      return;
    }
    if (target === 'home' && isSet(this.data.homeUrl)) { root.location.href = this.data.homeUrl; return; }
    var id = target === 'page' ? cleanId(t.page) : (target === 'index' ? 'index' : (this.data.homeId || 'index'));
    if (this.opts.onNavigate) this.opts.onNavigate(id);
    else Tuiles.open(this.root, id, this.opts);
  };

  /* ---------- peinture ---------- */

  function paint(api, target, c, where) {
    var col = color(c);
    where = where || 'value';
    if (where === 'bg') {
      api.el.style.background = col || (isSet(api.t.bg) ? color(api.t.bg) : '');
      target.style.color = '';
    } else if (where === 'border') {
      api.el.style.boxShadow = col ? 'inset 0 0 0 3px ' + col : '';
      target.style.color = '';
    } else if (where === 'title') {
      var ti = api.el.querySelector('.tl-title');
      if (ti) { ti.style.color = col || (isSet(api.t.titleColor) ? color(api.t.titleColor) : ''); ti.classList.toggle('tl-title-custom', !!ti.style.color); }
    } else {
      target.style.color = col;
    }
  }

  function setIcon(holder, spec, state) {
    if (state.icon === spec) return;
    state.icon = spec;
    holder.innerHTML = iconHtml(spec);
  }

  /* ================================================================== */
  /*  Types de tuiles                                                    */
  /* ================================================================== */

  var R = {};

  R.vide = function () { return function () {}; };

  /* ---- Valeur ---- */
  R.valeur = function (p, t, api) {
    var box = el('div', 'tl-val tl-fit');
    var n = el('span', 'tl-num'), u = el('span', 'tl-unit');
    box.appendChild(n);
    box.appendChild(u);
    if (t.size === 'petit') box.classList.add('tl-small');
    if (t.size === 'grand') box.classList.add('tl-big');
    api.body.appendChild(box);
    if (t.cmdOn) p.press(api.el, function () { p.run(api, t.cmdOn, {}, { confirm: t.confirm, infoId: t.cmdInfo, wait: t.wait }); });
    return function () {
      var m = p.meta(t.cmdInfo), raw = m ? m.value : undefined;
      var f = fmt(t, m, raw);
      var r = f.invalid ? null : evalRules(rulesFor(t, p.presets), raw);
      if (f.html.indexOf('<br>') >= 0) box.classList.add('tl-2l'); else box.classList.remove('tl-2l');
      var label = r && isSet(r.label);
      var newNum = !label && !f.invalid && isNum(raw) && !(isSet(t.dateFmt) && t.dateFmt !== 'brut') && !parseMap(t.map)[String(raw)] ? parseFloat(raw) : null;
      if (newNum !== null && api.lastNum !== undefined && api.lastNum !== null && newNum !== api.lastNum && !p.opts.edit && t.roll !== 'non') {
        var dec = isNum(t.decimals) ? parseInt(t.decimals, 10) : ((String(f.text).split('.')[1] || '').length);
        rollNumber(n, api.lastNum, newNum, dec, f.html);
        flashValue(box);
      } else {
        if (api.rollRaf) cancelAnimationFrame(api.rollRaf);
        n.innerHTML = label ? esc(r.label) : f.html;
      }
      api.lastNum = newNum;
      u.textContent = (r && isSet(r.label)) || !f.unit ? '' : ' ' + f.unit;
      paint(api, box, r ? r.color : (f.invalid ? 'neutral' : t.color), t.colorTarget);
    };
  };

  /** Le chiffre glisse de l'ancienne à la nouvelle valeur (≈ 0,7 s). */
  function rollNumber(node, from, to, dec, finalHtml) {
    if (node.__roll) cancelAnimationFrame(node.__roll);
    var t0 = null, dur = 700;
    var step = function (ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      node.textContent = (from + (to - from) * e).toFixed(dec);
      if (k < 1) node.__roll = requestAnimationFrame(step);
      else { node.innerHTML = finalHtml; node.__roll = null; }
    };
    node.__roll = requestAnimationFrame(step);
  }
  function flashValue(box) {
    box.classList.remove('tl-valflash');
    void box.offsetWidth;
    box.classList.add('tl-valflash');
    setTimeout(function () { box.classList.remove('tl-valflash'); }, 900);
  }

  /* ---- Icône d'état ---- */
  R.icone = function (p, t, api) {
    var ico = el('div', 'tl-ico'), state = {};
    api.body.appendChild(ico);
    var hasLabels = isSet(t.labelOn) || isSet(t.labelOff) || isSet(t.labelDone);
    var sub = (t.showValue || hasLabels) ? el('div', 'tl-sub tl-fit') : null;
    if (sub) api.body.appendChild(sub);
    if (t.cmdOn) {
      p.press(api.el, function () {
        p.run(api, t.cmdOn, {}, { confirm: t.confirm, infoId: t.cmdInfo, wait: t.wait });
      }, t.cmdLong ? function () { p.run(api, t.cmdLong, {}, { confirm: t.confirm }); } : null);
    }
    return function () {
      var m = p.meta(t.cmdInfo), v = m ? m.value : undefined;
      var st = t.cmdInfo ? runState(t, v) : null, act = st === null ? null : st === 'run', done = st === 'done';
      var r = evalRules(rulesFor(t, p.presets), v);
      var spec = (r && r.icon) || (done && isSet(t.iconDone) ? t.iconDone : (act === false && !done && isSet(t.iconOff) ? t.iconOff : (t.icon || 'svg:check-circle')));
      setIcon(ico, spec, state);
      var c = r && r.color ? r.color : (st === null ? 'neutral' : (done ? (t.colorDone || 'ok') : (act ? (t.colorOn || 'on') : (t.colorOff || 'neutral'))));
      paint(api, ico, c, t.colorTarget);
      api.el.classList.toggle('tl-done', done);
      if (done) api.el.style.setProperty('--tl-donec', ico.style.color || '');
      if (sub) {
        var f = fmt(t, m, v), txt;
        if (r && isSet(r.label)) txt = r.label;
        else if (done && isSet(t.labelDone)) txt = t.labelDone;
        else if (hasLabels && act !== null) txt = act ? (t.labelOn || '') : (t.labelOff || '');
        else txt = f.text + (f.unit ? ' ' + f.unit : '');
        sub.textContent = txt;
        sub.style.color = hasLabels ? ico.style.color : '';
      }
    };
  };

  /* ---- Ouvrant ---- */
  /* Baie coulissante ou fenêtre 2 vantaux : 2 contacts (gauche = cmdInfo, droit = cmdInfo2)
   * → fermé, ouvert à gauche, ouvert à droite, les deux. */
  var OUV_TWO = { baie: 1, fenetre2: 1 };
  function ouvOpen(p, t, id) {
    var m = cleanId(id) ? p.meta(id) : null;
    return m ? isActive(m.value, isSet(t.openValue) ? t.openValue : '1', t.invert) : null;
  }
  function ouvState(p, t) {
    var l = ouvOpen(p, t, t.cmdInfo), two = OUV_TWO[t.kind] && cleanId(t.cmdInfo2);
    var r = two ? ouvOpen(p, t, t.cmdInfo2) : null;
    if (!two) return { open: l, side: l ? 'lr' : '' };
    if (l === null && r === null) return { open: null, side: '' };
    return { open: !!(l || r), side: (l ? 'l' : '') + (r ? 'r' : ''), two: true };
  }
  R.ouvrant = function (p, t, api) {
    var ico = el('div', 'tl-ico tl-ico-open'), state = {};
    api.body.appendChild(ico);
    var sub = t.showState ? el('div', 'tl-sub tl-fit') : null;
    if (sub) api.body.appendChild(sub);
    if (t.cmdOn || t.cmdOff) {
      p.press(api.el, function () {
        var cmd = (t.cmdOn && t.cmdOff) ? (ouvState(p, t).open ? t.cmdOff : t.cmdOn) : (t.cmdOn || t.cmdOff);
        p.run(api, cmd, {}, { confirm: t.confirm, infoId: t.cmdInfo, wait: t.wait });
      });
    }
    return function () {
      var kind = t.kind || 'fenetre';
      var st = ouvState(p, t), open = st.open;
      var name = kind;
      if (open) {
        if (kind === 'fenetre2') name += '-' + st.side;
        else if (kind === 'baie' && st.two) name += '-' + st.side;
        else name += '-open';
      }
      setIcon(ico, 'svg:' + name, state);
      var r = evalRules(rulesFor(t, p.presets), p.val(t.cmdInfo));
      var c = r && r.color ? r.color : (open === null ? 'neutral' : (open ? (t.colorOpen || 'alert') : (t.colorClosed || 'neutral')));
      paint(api, ico, c, t.colorTarget);
      api.el.classList.toggle('tl-is-open', open === true);
      if (sub) {
        var txt = open === null ? '…' : (open ? (t.labelOpen || 'Ouvert') : (t.labelClosed || 'Fermé'));
        if (open && st.two && st.side !== 'lr') txt += st.side === 'l' ? ' à gauche' : ' à droite';
        sub.textContent = txt;
        sub.style.color = ico.style.color;
      }
    };
  };

  /* ---- Bouton ---- */
  /* Types de bouton :
   *  impulsion : 1 action, pas de retour
   *  on        : 1 action « On » toujours la même, couleur selon l'info
   *  toggle    : 1 action toggle, couleur selon l'info
   *  onoff     : On si inactif, Off si actif, selon l'info
   *  split     : 2 boutons On et Off, pas de retour
   */
  function btnKind(conf) {
    var k = conf.behavior || 'auto';
    if (k === 'single') k = conf.cmdInfo ? 'on' : 'impulsion';
    if (k === 'auto') k = (conf.cmdOn && conf.cmdOff) ? (conf.cmdInfo ? 'onoff' : 'split') : (conf.cmdInfo ? 'toggle' : 'impulsion');
    return k;
  }
  function btnMode(conf) {
    var k = btnKind(conf);
    return (k === 'onoff' || k === 'split') ? k : 'single';
  }
  function btnState(p, conf) {
    var info = btnKind(conf) === 'impulsion' || btnKind(conf) === 'split' ? '' : conf.cmdInfo;
    var v = p.val(info);
    var act = info ? isActive(v, conf.onValue, conf.invert) : null;
    var r = info ? evalRules(rulesFor(conf, p.presets), v) : null;
    var c = r && r.color ? r.color : (act === null ? (conf.colorNeutral || 'neutral') : (act ? (conf.colorOn || 'on') : (conf.colorOff || 'off')));
    return { act: act, color: c, rule: r };
  }
  function makeBtn(style) {
    return el('div', 'tl-btn tl-btn-' + (style || 'rond'));
  }
  function drawBtn(btn, spec, col, style, state) {
    setIcon(btn, spec, state);
    if ((style || 'rond') === 'rond') { btn.style.background = color(col); btn.style.color = 'var(--tl-tile)'; }
    else { btn.style.background = ''; btn.style.color = color(col); }
  }
  function btnClick(p, api, conf, mode, getAct) {
    return function () {
      if (!conf.cmdOn) { p.toast('Aucune commande action configurée', 'error'); return; }
      var act = getAct();
      if (mode === 'single' && conf.disableWhenActive && act === true) { p.toast('Déjà actif'); return; }
      var cmd = (mode === 'onoff' && act === true) ? conf.cmdOff : conf.cmdOn;
      var info = btnKind(conf) === 'impulsion' ? '' : conf.cmdInfo;
      p.run(api, cmd, {}, { confirm: conf.confirm, infoId: info, wait: conf.wait });
    };
  }

  R.bouton = function (p, t, api) {
    var mode = btnMode(t), style = t.style || 'rond';
    if (mode === 'split') {
      var row = el('div', 'tl-btnrow');
      var b1 = makeBtn(style), b2 = makeBtn(style), s1 = {}, s2 = {};
      row.appendChild(b1);
      row.appendChild(b2);
      api.body.appendChild(row);
      drawBtn(b1, t.icon || 'svg:play', t.colorOn || 'on', style, s1);
      drawBtn(b2, t.iconOff || 'svg:stop', t.colorOff || 'off', style, s2);
      p.press(b1, function () { p.run(api, t.cmdOn, {}, { confirm: t.confirm }); });
      p.press(b2, function () { p.run(api, t.cmdOff, {}, { confirm: t.confirm }); });
      return function () {};
    }
    var btn = makeBtn(style), state = {}, cur = null;
    api.body.appendChild(btn);
    var sub = t.showState ? el('div', 'tl-sub tl-fit') : null;
    if (sub) api.body.appendChild(sub);
    p.press(api.el, btnClick(p, api, t, mode, function () { return cur; }),
      t.cmdLong ? function () { p.run(api, t.cmdLong, {}, { confirm: t.confirmLong || t.confirm }); } : null);
    return function () {
      var s = btnState(p, t);
      cur = s.act;
      var spec = (s.rule && s.rule.icon) || (s.act === true && isSet(t.iconActive) ? t.iconActive : (t.icon || 'svg:play'));
      drawBtn(btn, spec, s.color, style, state);
      api.el.classList.toggle('tl-disabled', mode === 'single' && !!t.disableWhenActive && s.act === true);
      if (sub) sub.textContent = s.act === null ? '' : (s.act ? (t.labelOn || 'Marche') : (t.labelOff || 'Arrêt'));
    };
  };

  /* ---- Slider ---- */
  /** Plage du slider en auto : réglage de la tuile, sinon commande action, sinon info liée, sinon 0–100. */
  function sliderRange(p, t) {
    var am = p.meta(t.cmdOn) || {};
    var im = p.meta(cleanId(t.cmdInfo) || cleanId(am.linked)) || {};
    var mi = num(t.sMin, num(am.minValue, num(im.minValue, 0)));
    var ma = num(t.sMax, num(am.maxValue, num(im.maxValue, 100)));
    var st = num(t.sStep, num(am.step, 1));
    if (!(st > 0)) st = 1;
    if (ma <= mi) ma = mi + 100;
    return { min: mi, max: ma, step: st };
  }

  R.slider = function (p, t, api) {
    var am = p.meta(t.cmdOn) || {};
    var info = cleanId(t.cmdInfo) || cleanId(am.linked);
    if (info) p.depend(api, info);
    var range = sliderRange(p, t);
    var mi = range.min, ma = range.max, stp = range.step;
    var unit = t.unit === '-' ? '' : (isSet(t.unit) ? t.unit : ((p.meta(info) || {}).unite || am.unite || ''));
    var style = ['classique', 'neon', 'pilule', 'segments', 'arc'].indexOf(t.sStyle) >= 0 ? t.sStyle : 'classique';
    var wrap = el('div', 'tl-slider tl-sl-' + style + (t.orient === 'vertical' && style !== 'arc' ? ' tl-vertical' : ''));
    var val = el('div', 'tl-sl-val tl-fit');
    var dragging = false, local = null, sendTimer = null, cur = mi;
    var snapV = function (v) {
      v = Math.max(mi, Math.min(ma, v));
      v = mi + Math.round((v - mi) / stp) * stp;
      return Math.round(v * 1e6) / 1e6;
    };
    var accent = function (v) {
      var r = evalRules(rulesFor(t, p.presets), v);
      return r && r.color ? color(r.color) : (isSet(t.sColor) ? color(t.sColor) : '');
    };
    var send = function (v) {
      local = v;
      p.run(api, t.cmdOn, { slider: v }, { infoId: info, wait: t.wait, confirm: t.confirm });
    };
    var stopProp = function (elm) {
      ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(function (ev) {
        elm.addEventListener(ev, function (e) { if (!p.opts.edit) e.stopPropagation(); }, { passive: true });
      });
    };
    var fmtV = function (v) {
      var f = fmt({ decimals: t.decimals, unit: '-' }, null, v);
      return isNum(v) ? f.text + (unit ? ' ' + unit : '') : (info ? '…' : '');
    };
    var input = null, arc = null, segs = [], show;

    if (style === 'arc') {
      // molette en arc de 270° : on tourne avec le doigt, envoi au relâchement
      var NS = 'http://www.w3.org/2000/svg';
      arc = document.createElementNS(NS, 'svg');
      arc.setAttribute('viewBox', '0 0 100 100');
      arc.setAttribute('class', 'tl-sl-arcsvg');
      var A0 = 135, SW = 270, R0 = 38, CX = 50, CY = 52;
      var pt = function (deg) { var r = deg * Math.PI / 180; return [CX + R0 * Math.cos(r), CY + R0 * Math.sin(r)]; };
      var s0 = pt(A0), s1 = pt(A0 + SW);
      var d = 'M' + s0[0].toFixed(2) + ' ' + s0[1].toFixed(2) + ' A' + R0 + ' ' + R0 + ' 0 1 1 ' + s1[0].toFixed(2) + ' ' + s1[1].toFixed(2);
      arc.innerHTML = '<path class="tl-arc-bg" d="' + d + '"/><path class="tl-arc-fg" d="' + d + '" pathLength="100"/>' +
        '<circle class="tl-arc-knob" r="5.2"/><text class="tl-arc-txt" x="50" y="56" text-anchor="middle"></text>' +
        '<text class="tl-arc-min" x="' + s0[0].toFixed(1) + '" y="96" text-anchor="middle"></text><text class="tl-arc-max" x="' + s1[0].toFixed(1) + '" y="96" text-anchor="middle"></text>';
      wrap.appendChild(arc);
      arc.querySelector('.tl-arc-min').textContent = mi;
      arc.querySelector('.tl-arc-max').textContent = ma;
      stopProp(arc);
      show = function (v) {
        var pct = (ma > mi && isNum(v)) ? Math.max(0, Math.min(1, (parseFloat(v) - mi) / (ma - mi))) : 0;
        var fg = arc.querySelector('.tl-arc-fg');
        fg.style.strokeDasharray = (pct * 100) + ' 100';
        var k = pt(A0 + pct * SW);
        var kn = arc.querySelector('.tl-arc-knob');
        kn.setAttribute('cx', k[0].toFixed(2)); kn.setAttribute('cy', k[1].toFixed(2));
        arc.querySelector('.tl-arc-txt').textContent = fmtV(v);
        wrap.style.setProperty('--sl-c', accent(v) || '');
      };
      var fromPointer = function (e) {
        var r = arc.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
        var a = Math.atan2(y - CY, x - CX) * 180 / Math.PI;
        a = a - A0; while (a < 0) a += 360; while (a >= 360) a -= 360;
        if (a > SW) a = (a > SW + (360 - SW) / 2) ? 0 : SW;
        return snapV(mi + a / SW * (ma - mi));
      };
      if (!p.opts.edit) {
        arc.style.touchAction = 'none';
        arc.addEventListener('pointerdown', function (e) {
          dragging = true;
          try { arc.setPointerCapture(e.pointerId); } catch (x) { /* ancien navigateur */ }
          cur = fromPointer(e); show(cur);
        });
        arc.addEventListener('pointermove', function (e) { if (dragging) { cur = fromPointer(e); show(cur); } });
        var end = function () { if (!dragging) return; dragging = false; send(cur); };
        arc.addEventListener('pointerup', end);
        arc.addEventListener('pointercancel', end);
      }
    } else {
      var row = el('div', 'tl-sl-row');
      input = el('input', 'tl-range');
      input.type = 'range'; input.min = mi; input.max = ma; input.step = stp; input.value = mi;
      var minus = null, plus = null;
      if (t.plusMinus) { minus = el('button', 'tl-pm', iconHtml('svg:minus')); minus.type = 'button'; row.appendChild(minus); }
      var track = row;
      if (style === 'pilule' || style === 'segments') {
        // piste maison + curseur natif invisible par-dessus (glisser au doigt conservé)
        track = el('div', 'tl-sl-track');
        row.appendChild(track);
        if (style === 'segments') {
          var bar = el('div', 'tl-sl-segs');
          var n = Math.max(6, Math.min(24, Math.round(num(t.sSegs, 12))));
          for (var i = 0; i < n; i++) { var sg = el('span', 'tl-sl-seg'); bar.appendChild(sg); segs.push(sg); }
          track.appendChild(bar);
        } else {
          track.appendChild(el('div', 'tl-sl-fill'));
          track.appendChild(val);
          val.classList.add('tl-sl-inval');
        }
        track.appendChild(input);
        input.classList.add('tl-range-ghost');
      } else {
        row.appendChild(input);
      }
      if (t.plusMinus) { plus = el('button', 'tl-pm', iconHtml('svg:plus')); plus.type = 'button'; row.appendChild(plus); }
      if (style !== 'pilule' && t.showValue !== false && t.showValue !== '0') wrap.appendChild(val);
      wrap.appendChild(row);
      stopProp(input);
      show = function (v) {
        val.textContent = fmtV(v);
        var c = accent(v);
        val.style.color = style === 'pilule' ? '' : c;
        wrap.style.setProperty('--sl-c', c || '');
        var pct = (ma > mi && isNum(v)) ? Math.max(0, Math.min(100, (parseFloat(v) - mi) / (ma - mi) * 100)) : 0;
        input.style.setProperty('--pct', pct + '%');
        wrap.style.setProperty('--pct', pct + '%');
        if (segs.length) {
          var lit = Math.round(pct / 100 * segs.length);
          segs.forEach(function (sg, k) { sg.classList.toggle('tl-on', k < lit); });
        }
      };
      input.addEventListener('input', function () { dragging = true; show(input.value); });
      input.addEventListener('change', function () { dragging = false; send(input.value); });
      var step = function (dlt) {
        var v = snapV(parseFloat(input.value) + dlt * stp);
        input.value = v;
        show(v);
        clearTimeout(sendTimer);
        sendTimer = setTimeout(function () { send(input.value); }, 700);
      };
      if (minus) p.press(minus, function () { step(-1); });
      if (plus) p.press(plus, function () { step(1); });
    }
    api.body.appendChild(wrap);
    return function () {
      if (dragging) return;
      var m = p.meta(info);
      var v = m && isNum(m.value) ? m.value : local;
      if (isNum(v)) { cur = parseFloat(v); if (input) input.value = v; }
      show(isNum(v) ? v : (style === 'arc' ? undefined : v));
    };
  };

  /* ---- Select / liste ---- */
  function selectOptions(p, t) {
    var am = p.meta(t.cmdOn) || {};
    var list = (t.options && t.options.length)
      ? t.options.map(function (o, i) { return { key: String(i), label: o.label || ('Option ' + (i + 1)), cmd: cleanId(o.cmdAction) }; })
      : parseList(am.listValue);
    var hide = String(t.hide || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    var rename = parseMap(t.rename);
    return list.filter(function (o) {
      return hide.indexOf(String(o.key).toLowerCase()) < 0 && hide.indexOf(String(o.label).toLowerCase()) < 0;
    }).map(function (o) {
      var lbl = rename[o.key] !== undefined ? rename[o.key] : (rename[o.label] !== undefined ? rename[o.label] : o.label);
      return { key: o.key, label: lbl, raw: o.label, cmd: o.cmd };
    });
  }

  R.select = function (p, t, api) {
    var am = p.meta(t.cmdOn) || {};
    var info = cleanId(t.cmdInfo) || cleanId(am.linked);
    if (info) p.depend(api, info);
    var options = selectOptions(p, t);
    var display = t.display || 'popup';
    var local = null, items = [], cur = null, popup = null;
    var choose = function (o) {
      local = o.key;
      if (o.clear) p.run(api, o.cmd, {}, { confirm: t.confirm });
      else if (o.cmd) p.run(api, o.cmd, {}, { confirm: t.confirm, infoId: info, wait: t.wait });
      else p.run(api, t.cmdOn, { select: o.key }, { confirm: t.confirm, infoId: info, wait: t.wait });
      refresh();
    };
    var all = options.slice();
    if (t.cmdClear) all.push({ key: '__clear', label: t.clearLabel || 'Effacer la sélection', cmd: cleanId(t.cmdClear), clear: true });
    var holder;
    if (display === 'popup') {
      // tuile fermée : valeur actuelle ; clic → liste par-dessus la page
      holder = el('div', 'tl-popsel');
      var curEl = el('div', 'tl-popsel-val tl-fit');
      var caret = el('div', 'tl-popsel-caret', '<i class="fas fa-chevron-down"></i>');
      holder.appendChild(curEl);
      holder.appendChild(caret);
      api.curEl = curEl;
      p.press(api.el, function () { openPopup(); });
    } else if (display === 'menu') {
      holder = el('select', 'tl-selectbox');
      holder.appendChild(el('option', '', esc(t.placeholder || '— Choisir —')));
      all.forEach(function (o, i) { var op = el('option', '', esc(o.label)); op.value = String(i); holder.appendChild(op); });
      holder.addEventListener('change', function () {
        var o = all[parseInt(holder.value, 10)];
        if (o) choose(o);
      });
      ['click', 'pointerdown'].forEach(function (ev) { holder.addEventListener(ev, function (e) { if (!p.opts.edit) e.stopPropagation(); }); });
      if (p.opts.edit) holder.disabled = true;
    } else {
      holder = el('div', display === 'boutons' ? 'tl-seg' : 'tl-list');
      if (display !== 'boutons' && api.h >= 2) api.body.classList.add('tl-top');
      all.forEach(function (o) {
        var it = el('div', 'tl-item' + (o.clear ? ' tl-item-clear' : ''), esc(o.label));
        p.press(it, function () { choose(o); });
        holder.appendChild(it);
        items.push({ o: o, el: it });
      });
    }
    api.body.appendChild(holder);
    if (!all.length) api.body.innerHTML = '<div class="tl-sub">Aucune option</div>';
    var refresh = function () {
      var v = p.val(info);
      cur = null;
      options.forEach(function (o) {
        if (!isSet(v)) return;
        var sv = String(v).toLowerCase();
        if (String(o.key).toLowerCase() === sv || String(o.raw).toLowerCase() === sv || String(o.label).toLowerCase() === sv) cur = o.key;
      });
      if (cur === null && !info) cur = local;
      if (api.curEl) {
        var lbl = null;
        options.forEach(function (o) { if (o.key === cur) lbl = o.label; });
        if (lbl === null && isSet(v)) lbl = String(v);
        api.curEl.textContent = lbl !== null ? lbl : (t.placeholder || '— Choisir —');
        api.curEl.classList.toggle('tl-popsel-empty', lbl === null);
      }
      items.forEach(function (x) { x.el.classList.toggle('tl-active', !x.o.clear && x.o.key === cur); });
      if (display === 'menu') {
        var idx = -1;
        all.forEach(function (o, i) { if (!o.clear && o.key === cur) idx = i; });
        holder.value = idx >= 0 ? String(idx) : holder.options[0].value;
      }
    };
    function closePopup() {
      if (!popup) return;
      document.removeEventListener('pointerdown', popup.outside, true);
      document.removeEventListener('keydown', popup.key, true);
      root.removeEventListener('resize', popup.close);
      root.removeEventListener('scroll', popup.scroll, true);
      if (popup.el.parentNode) popup.el.parentNode.removeChild(popup.el);
      api.el.classList.remove('tl-open');
      popup = null;
    }
    function openPopup() {
      if (popup) { closePopup(); return; }
      if (!all.length) return;
      var maxH = Math.max(120, num(t.maxH, 400));
      var box = el('div', 'tl-pop');
      // reprend seulement les variables de couleur de la page (pas sa hauteur, son fond…)
      for (var si = 0; si < p.root.style.length; si++) {
        var prop = p.root.style[si];
        if (prop.indexOf('--') === 0) box.style.setProperty(prop, p.root.style.getPropertyValue(prop));
      }
      box.style.position = 'fixed';
      var search = null;
      if (t.search === 'oui' || (t.search !== 'non' && all.length > 10)) {
        search = el('input', 'tl-pop-search');
        search.type = 'search';
        search.placeholder = 'Rechercher…';
        box.appendChild(search);
      }
      var list = el('div', 'tl-pop-list');
      list.style.maxHeight = maxH + 'px';
      box.appendChild(list);
      var rows = all.map(function (o) {
        var it = el('div', 'tl-pop-item' + (o.clear ? ' tl-pop-clear' : '') + (!o.clear && o.key === cur ? ' tl-active' : ''), esc(o.label));
        it.addEventListener('click', function (e) { e.stopPropagation(); closePopup(); choose(o); });
        list.appendChild(it);
        return { o: o, el: it };
      });
      if (search) {
        search.addEventListener('input', function () {
          var q = search.value.toLowerCase().trim();
          rows.forEach(function (r) { r.el.style.display = (!q || r.o.clear || String(r.o.label).toLowerCase().indexOf(q) >= 0) ? '' : 'none'; });
        });
        search.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return;
          var first = rows.filter(function (r) { return r.el.style.display !== 'none' && !r.o.clear; })[0];
          if (first) { closePopup(); choose(first.o); }
        });
      }
      document.body.appendChild(box);
      // position : sous la tuile si la place suffit, sinon au-dessus ; jamais hors écran
      var r = api.el.getBoundingClientRect();
      var vw = root.innerWidth, vh = root.innerHeight, m = 8;
      var w = Math.min(Math.max(r.width, num(t.popW, 260)), vw - 2 * m);
      box.style.width = w + 'px';
      var h = box.offsetHeight;
      var left = Math.min(Math.max(m, r.left + r.width / 2 - w / 2), vw - w - m);
      var below = vh - r.bottom - m, above = r.top - m, top;
      if (h <= below || below >= above) {
        top = r.bottom + 4;
        if (h > below) list.style.maxHeight = Math.max(80, Math.min(maxH, below - (h - list.offsetHeight) - 4)) + 'px';
      } else {
        if (h > above) list.style.maxHeight = Math.max(80, Math.min(maxH, above - (h - list.offsetHeight) - 4)) + 'px';
        top = r.top - box.offsetHeight - 4;
      }
      box.style.left = left + 'px';
      box.style.top = Math.max(m, top) + 'px';
      var act = list.querySelector('.tl-active');
      if (act) list.scrollTop = act.offsetTop - list.clientHeight / 2 + act.offsetHeight / 2;
      api.el.classList.add('tl-open');
      popup = {
        el: box,
        close: closePopup,
        outside: function (e) { if (!box.contains(e.target) && !api.el.contains(e.target)) closePopup(); },
        key: function (e) { if (e.key === 'Escape') closePopup(); },
        scroll: function (e) { if (!box.contains(e.target)) closePopup(); }
      };
      setTimeout(function () {
        if (!popup) return;
        document.addEventListener('pointerdown', popup.outside, true);
        document.addEventListener('keydown', popup.key, true);
        root.addEventListener('resize', popup.close);
        root.addEventListener('scroll', popup.scroll, true);
      }, 0);
      if (search && !('ontouchstart' in root)) search.focus();
    }
    api.closePopup = closePopup;
    return refresh;
  };

  /* ---- Envoi de valeur (date, saisie) ---- */
  function valueFor(meta, str, title) {
    var st = meta ? meta.subType : 'message';
    if (st === 'slider') return { slider: str };
    if (st === 'select') return { select: str };
    if (st === 'color') return { color: str };
    return { title: title || '', message: str };
  }

  R.date = function (p, t, api) {
    var mode = t.dmode || 'datetime';
    var formats = { date: 'YYYY-MM-DD', time: 'HH:mm', datetime: 'YYYY-MM-DD HH:mm' };
    var input = el('input', 'tl-input');
    input.type = { date: 'date', time: 'time', datetime: 'datetime-local' }[mode] || 'datetime-local';
    var row = el('div', 'tl-inrow');
    var ok = el('button', 'tl-send', iconHtml('svg:check'));
    ok.type = 'button';
    row.appendChild(input);
    row.appendChild(ok);
    var cur = el('div', 'tl-sub tl-fit');
    api.body.appendChild(cur);
    api.body.appendChild(row);
    ['click', 'pointerdown'].forEach(function (ev) { input.addEventListener(ev, function (e) { if (!p.opts.edit) e.stopPropagation(); }); });
    if (p.opts.edit) input.disabled = true;
    var send = function () {
      if (!input.value) { p.toast('Choisissez une valeur'); return; }
      var d = mode === 'time' ? parseDate('2000-01-01T' + input.value) : parseDate(input.value);
      if (!d) return;
      p.run(api, t.cmdOn, valueFor(p.meta(t.cmdOn), formatDate(d, t.dformat || formats[mode]), t.msgTitle), { confirm: t.confirm, infoId: t.cmdInfo, wait: t.wait });
    };
    p.press(ok, send);
    return function () {
      var v = p.val(t.cmdInfo);
      cur.textContent = isSet(v) ? String(v) : (t.cmdInfo ? '…' : '');
      var rd = evalRules(rulesFor(t, p.presets), v);
      cur.style.color = rd && rd.color ? color(rd.color) : '';
      if (document.activeElement === input) return;
      var d = parseDate(v);
      if (d) input.value = formatDate(d, { date: 'YYYY-MM-DD', time: 'HH:mm', datetime: 'YYYY-MM-DDTHH:mm' }[mode]);
    };
  };

  R.saisie = function (p, t, api) {
    var input = el('input', 'tl-input');
    input.type = t.inputType === 'number' ? 'number' : 'text';
    if (isSet(t.placeholder)) input.placeholder = t.placeholder;
    var row = el('div', 'tl-inrow');
    var ok = el('button', 'tl-send', iconHtml('svg:check'));
    ok.type = 'button';
    row.appendChild(input);
    row.appendChild(ok);
    var cur = el('div', 'tl-sub tl-fit');
    api.body.appendChild(cur);
    api.body.appendChild(row);
    ['click', 'pointerdown'].forEach(function (ev) { input.addEventListener(ev, function (e) { if (!p.opts.edit) e.stopPropagation(); }); });
    if (p.opts.edit) input.disabled = true;
    var send = function () {
      if (!isSet(input.value)) return;
      p.run(api, t.cmdOn, valueFor(p.meta(t.cmdOn), input.value, t.msgTitle), { confirm: t.confirm, infoId: t.cmdInfo, wait: t.wait });
      input.value = '';
      input.blur();
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    p.press(ok, send);
    return function () {
      var m = p.meta(t.cmdInfo);
      var f = fmt(t, m, m ? m.value : undefined);
      cur.textContent = t.cmdInfo ? f.text + (f.unit ? ' ' + f.unit : '') : '';
      var rs = m ? evalRules(rulesFor(t, p.presets), m.value) : null;
      cur.style.color = rs && rs.color ? color(rs.color) : '';
    };
  };

  /* ---- Volet ---- */
  /* ---- Groupe de volets (Tous, RDC, Étage…) : position moyenne, boutons qui commandent tous les volets ---- */
  R.voletgroupe = function (p, t, api) {
    var ids = function (k) { return (Array.isArray(t[k]) ? t[k] : []).map(cleanId).filter(Boolean); };
    var infos = ids('cmdInfos'), groups = { up: ids('cmdUps'), down: ids('cmdDowns'), stop: ids('cmdStops'), sl: ids('cmdSliders') };
    var openMin = num(t.openMin, 99);
    var stats = function () {
      var vals = infos.map(function (id) { var v = p.val(id); return isNum(v) ? parseFloat(v) : (isSet(v) ? (isActive(v) ? 100 : 0) : null); })
        .filter(function (v) { return v !== null; });
      if (!vals.length) return null;
      var sum = vals.reduce(function (a, b) { return a + b; }, 0);
      return { avg: Math.round(sum / vals.length), open: vals.filter(function (v) { return v >= openMin; }).length, n: vals.length };
    };
    var pp = Object.create(p);
    pp.meta = function (id) {
      if (id === '__grp') { var st = stats(); return st ? { value: st.avg, subType: 'numeric', unite: '%' } : null; }
      return p.meta(id);
    };
    pp.val = function (id) { var m = pp.meta(id); return m ? m.value : undefined; };
    pp.run = function (a, cmd, opts, o) {
      var key = { __up: 'up', __down: 'down', __stop: 'stop', __sl: 'sl' }[cmd];
      if (!key) return p.run(a, cmd, opts, o);
      var go = function () { groups[key].forEach(function (id) { p.run(a, id, opts || {}, {}); }); };
      if (t.confirm && key !== 'stop' && !p.opts.edit) UI.confirm(t.confirm, go); else go();
    };
    var tt = {};
    Object.keys(t).forEach(function (k) { if (!/^cmd/.test(k)) tt[k] = t[k]; });
    tt.cmdInfo = infos.length ? '__grp' : '';
    if (groups.up.length) tt.cmdUp = '__up';
    if (groups.stop.length) tt.cmdStop = '__stop';
    if (groups.down.length) tt.cmdDown = '__down';
    if (groups.sl.length) tt.cmdSlider = '__sl';
    api.el.classList.add('tl-vgrp');
    var refresh = R.volet(pp, tt, api);
    var stEl = api.body.querySelector('.tl-v-state'), bigEl = api.body.querySelector('.tl-v-pct');
    return function () {
      refresh();
      var st = stats();
      // pas de pourcentage : le nombre de volets ouverts
      if (st && bigEl) bigEl.textContent = st.open + ' / ' + st.n;
      if (st && stEl) stEl.textContent = 'ouvert' + (st.open > 1 ? 's' : '');
    };
  };

  R.volet = function (p, t, api) {
    // disposition : en ligne si la tuile est large, sinon en colonne
    var wide = api.w >= api.h * 1.4;
    var box = el('div', 'tl-v ' + (wide ? 'tl-v-row' : 'tl-v-col'));
    var uid = 'v' + Math.random().toString(36).slice(2, 8);
    // fenêtre dessinée : le tablier descend selon la position
    var win = el('div', 'tl-v-win');
    win.innerHTML = '<svg viewBox="0 0 60 72" preserveAspectRatio="xMidYMid meet">' +
      '<defs><clipPath id="' + uid + 'c"><rect x="7" y="9" width="46" height="56" rx="2"/></clipPath>' +
      '<linearGradient id="' + uid + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f5d8a"/><stop offset="1" stop-color="#9fd3ff"/></linearGradient>' +
      '<pattern id="' + uid + 'p" width="46" height="5" patternUnits="userSpaceOnUse"><rect width="46" height="5" fill="#cfd3d8"/><rect y="4" width="46" height="1" fill="#8e959c"/></pattern></defs>' +
      '<rect class="tl-v-box" x="3" y="2" width="54" height="7" rx="2"/>' +
      '<rect x="7" y="9" width="46" height="56" fill="url(#' + uid + 'g)" rx="2"/>' +
      '<path d="M30 9 V65 M7 37 H53" stroke="#0b1a26" stroke-width="1.6" opacity=".5"/>' +
      '<g clip-path="url(#' + uid + 'c)"><g class="tl-v-slats"><rect x="7" y="9" width="46" height="56" fill="url(#' + uid + 'p)"/>' +
      '<rect class="tl-v-bar" x="7" y="63" width="46" height="2.5" rx="1"/></g></g>' +
      '<rect class="tl-v-frame" x="5" y="9" width="50" height="58" rx="3"/>' +
      '<text class="tl-v-hint" x="30" y="40" text-anchor="middle"></text></svg>';
    var info = el('div', 'tl-v-info');
    var big = el('div', 'tl-v-pct tl-fit');
    var sub = el('div', 'tl-v-state tl-fit');
    info.appendChild(big);
    info.appendChild(sub);
    var seg = el('div', 'tl-v-seg');
    var mk = function (cmd, icon, tip) {
      if (!cmd) return;
      var b = el('div', 'tl-v-btn', iconHtml(icon));
      b.setAttribute('title', tip);
      p.press(b, function () { p.run(api, cmd, {}, { confirm: t.confirm }); });
      seg.appendChild(b);
    };
    mk(t.cmdUp, 'svg:up', 'Monter');
    mk(t.cmdStop, 'svg:square', 'Stop');
    mk(t.cmdDown, 'svg:down', 'Descendre');
    if (wide) {
      box.appendChild(win);
      box.appendChild(info);
      if (seg.children.length) info.appendChild(seg);
    } else {
      // tuile carrée : fenêtre + pourcentage côte à côte, boutons en dessous
      var top = el('div', 'tl-v-top');
      top.appendChild(win);
      top.appendChild(info);
      box.appendChild(top);
      if (seg.children.length) box.appendChild(seg);
    }
    api.body.appendChild(box);

    var slats = win.querySelector('.tl-v-slats');
    var hint = win.querySelector('.tl-v-hint');
    var openPct = null;      // 0 = fermé, 100 = ouvert
    var dragPct = null;
    var draw = function (pct) {
      // pct ouvert → le tablier couvre (100 - pct) % de la fenêtre
      var closed = isNum(pct) ? Math.max(0, Math.min(100, 100 - pct)) / 100 : 0;
      slats.setAttribute('transform', 'translate(0 ' + (-(1 - closed) * 56).toFixed(2) + ')');
    };
    // glisser sur la fenêtre pour régler la position (si commande de position)
    if (t.cmdSlider && !p.opts.edit) {
      win.classList.add('tl-v-drag');
      win.style.touchAction = 'none';
      var svgEl = win.querySelector('svg');
      var fromY = function (e) {
        var r = svgEl.getBoundingClientRect();
        var y = (e.clientY - r.top) / r.height * 72;
        var closed = Math.max(0, Math.min(1, (y - 9) / 56));
        return Math.round((1 - closed) * 100);
      };
      win.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        try { win.setPointerCapture(e.pointerId); } catch (x) { /* ancien navigateur */ }
        dragPct = fromY(e); draw(dragPct); hint.textContent = dragPct + ' %';
      });
      win.addEventListener('pointermove', function (e) { if (dragPct !== null) { dragPct = fromY(e); draw(dragPct); hint.textContent = dragPct + ' %'; } });
      var end = function () {
        if (dragPct === null) return;
        var v = t.invert ? 100 - dragPct : dragPct;
        dragPct = null; hint.textContent = '';
        p.run(api, t.cmdSlider, { slider: v }, {});
      };
      win.addEventListener('pointerup', end);
      win.addEventListener('pointercancel', end);
      win.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    return function () {
      var m = p.meta(t.cmdInfo), v = m ? m.value : undefined;
      var text = '', state = '', c = 'neutral';
      if (isSet(v)) {
        if (m.subType === 'binary') {
          var o = isActive(v, '1', t.invert);
          openPct = o ? 100 : 0;
          text = o ? 'Ouvert' : 'Fermé'; state = '';
          c = o ? 'ok' : 'alert';
        } else if (isNum(v)) {
          var n = parseFloat(v);
          if (t.invert) n = 100 - n;
          openPct = n;
          text = Math.round(n) + ' %';
          if (n <= num(t.closedMax, 0)) { state = 'Fermé'; c = 'alert'; }
          else if (n >= num(t.openMin, 99)) { state = 'Ouvert'; c = 'ok'; }
          else { state = 'Partiel'; c = 'warn'; }
        } else {
          text = String(v);
        }
        var r = evalRules(rulesFor(t, p.presets), v);
        if (r) { if (isSet(r.label)) state = r.label; if (r.color) c = r.color; }
      } else if (t.cmdInfo) {
        text = '…';
      }
      big.textContent = text;
      sub.textContent = state;
      sub.style.display = state ? '' : 'none';
      var col = color(c);
      box.style.setProperty('--v-c', col);
      if (dragPct === null) draw(openPct === null ? 100 : openPct);
    };
  };

  /* ---- Intégration : widget Jeedom ---- */

  /** Insère du HTML et exécute ses scripts (les widgets Jeedom en contiennent). */
  function injectHtml(host, html) {
    host.innerHTML = html;
    host.querySelectorAll('script').forEach(function (old) {
      var sc = document.createElement('script');
      for (var i = 0; i < old.attributes.length; i++) sc.setAttribute(old.attributes[i].name, old.attributes[i].value);
      sc.text = old.text || old.textContent || '';
      old.parentNode.replaceChild(sc, old);
    });
  }

  /** Charge le widget dashboard d'un équipement dans « box », mis à l'échelle. */
  function mountWidget(p, eqId, box, fit, transparent, hideName) {
    box.classList.add('tl-wg-host');
    if (transparent) box.classList.add('tl-wg-transparent');
    if (hideName) box.classList.add('tl-wg-noname');
    var scaler = el('div', 'tl-wg-scale');
    box.innerHTML = '';
    box.appendChild(scaler);
    var natural = null;
    var place = function () {
      var w0 = scaler.firstElementChild;
      if (!w0) return;
      // taille réelle du widget, contenu qui dépasse compris (mesurée à chaque fois : images et polices arrivent après)
      natural = { w: Math.max(w0.offsetWidth, w0.scrollWidth) || 200, h: Math.max(w0.offsetHeight, w0.scrollHeight) || 150 };
      var W = box.clientWidth, H = box.clientHeight;
      if (!W || !H) return;
      var k = fit === 'none' ? 1 : (fit === 'cover' ? Math.max(W / natural.w, H / natural.h) : Math.min(W / natural.w, H / natural.h));
      scaler.style.width = natural.w + 'px';
      scaler.style.height = natural.h + 'px';
      scaler.style.transform = 'scale(' + k + ')';
      scaler.style.left = fit === 'none' ? '0px' : ((W - natural.w * k) / 2) + 'px';
      scaler.style.top = fit === 'none' ? '0px' : ((H - natural.h * k) / 2) + 'px';
    };
    var load = function () {
      if (!cleanId(eqId)) { scaler.innerHTML = '<div class="tl-sub">Choisissez un équipement</div>'; return Promise.resolve(); }
      return ajax('widgetHtml', { id: eqId }).then(function (r) {
        if (r.disabled) { scaler.innerHTML = '<div class="tl-sub">Équipement désactivé</div>'; return; }
        natural = null;
        injectHtml(scaler, r.html || '');
        setTimeout(place, 50);
        setTimeout(place, 600);
        setTimeout(place, 2000);
      }, function (e) { scaler.innerHTML = '<div class="tl-err">' + esc(e.message) + '</div>'; });
    };
    load();
    return { place: place, reload: load };
  }

  R.widget = function (p, t, api) {
    var box = el('div', 'tl-wg');
    api.body.appendChild(box);
    api.el.classList.add('tl-embed');
    var w = mountWidget(p, t.eqId, box, t.wFit, !!t.wTransparent, t.wHideName !== false && t.wHideName !== 'non');
    api.onFit = w.place;
    api.reload = w.reload;
    if (cleanId(t.eqId)) (p.widgets[String(cleanId(t.eqId))] = p.widgets[String(cleanId(t.eqId))] || []).push(api);
    if (t.wZoom && !p.opts.edit) {
      var zb = el('div', 'tl-embed-zoom', iconHtml('fas fa-expand'));
      api.el.appendChild(zb);
      zb.addEventListener('click', function (e) {
        e.stopPropagation();
        var big = el('div', 'tl-lb-box');
        var lb = UI.lightbox(big);
        mountWidget(p, t.eqId, big, 'contain', !!t.wTransparent, t.wHideName !== false && t.wHideName !== 'non');
        void lb;
      });
    }
    return function () {};
  };

  /* ---- Intégration : caméra ---- */
  function bust(url) {
    if (!isSet(url) || String(url).indexOf('data:') === 0) return url;
    return url + (String(url).indexOf('?') >= 0 ? '&' : '?') + '_tl=' + Date.now();
  }

  /* ---- Caméra Frigate ---- */
  var CAM_ICONS = {
    rec: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>',
    det: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="4.5" r="2" fill="currentColor"/><path d="M9 21l2.5-5.5L14 18v3M6.5 12.5l2-4 4-1 3 3 2.5 1M11.5 15.5l1.5-6"/></svg>'
  };

  /** Commandes PTZ et positions prédéfinies, dans la vue agrandie d'une caméra. */
  var PTZ_ICO = {
    up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="currentColor"/></svg>',
    zin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20M10.5 7.5v6M7.5 10.5h6"/></svg>',
    zout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20M7.5 10.5h6"/></svg>'
  };
  function ptzPanel(p, t, lb) {
    if (p.opts.edit || !lb || !lb.el) return;
    var dirs = { up: t.cmdPtzUp, down: t.cmdPtzDown, left: t.cmdPtzLeft, right: t.cmdPtzRight, zin: t.cmdPtzIn, zout: t.cmdPtzOut };
    var presets = (t.options || []).filter(function (o) { return o && cleanId(o.cmdAction); });
    var hasDir = Object.keys(dirs).some(function (k) { return cleanId(dirs[k]); });
    if (!hasDir && !presets.length && !cleanId(t.cmdPtzHome)) return;
    var hold = t.ptzMode === 'maintenir' && cleanId(t.cmdPtzStop);
    var wrap = el('div', 'tl-ptz');
    var fire = function (id, btn) {
      if (!cleanId(id)) return;
      if (btn) { btn.classList.remove('tl-ptz-hit'); void btn.offsetWidth; btn.classList.add('tl-ptz-hit'); }
      p.exec(id).catch(function (err) { UI.toast(err.message, 'error'); });
    };
    var bindMove = function (btn, id) {
      if (!cleanId(id)) { btn.disabled = true; return; }
      if (hold) {
        var down = false;
        btn.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); down = true; btn.classList.add('tl-ptz-on'); fire(id); });
        var up = function () { if (!down) return; down = false; btn.classList.remove('tl-ptz-on'); fire(t.cmdPtzStop); };
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, up); });
        btn.addEventListener('click', function (e) { e.stopPropagation(); });
      } else {
        btn.addEventListener('click', function (e) { e.stopPropagation(); fire(id, btn); });
      }
    };
    if (hasDir || cleanId(t.cmdPtzHome)) {
      var pad = el('div', 'tl-ptz-pad');
      [['up', 0], ['right', 90], ['down', 180], ['left', 270]].forEach(function (d) {
        var b = el('button', 'tl-ptz-dir tl-ptz-' + d[0], '<span style="transform:rotate(' + d[1] + 'deg)">' + PTZ_ICO.up + '</span>');
        b.type = 'button';
        b.title = { up: 'Haut', right: 'Droite', down: 'Bas', left: 'Gauche' }[d[0]];
        bindMove(b, dirs[d[0]]);
        pad.appendChild(b);
        d.push(b);
      });
      var home = el('button', 'tl-ptz-home', PTZ_ICO.home);
      home.type = 'button';
      home.title = 'Position d\'origine';
      if (cleanId(t.cmdPtzHome)) home.addEventListener('click', function (e) { e.stopPropagation(); fire(t.cmdPtzHome, home); });
      else home.disabled = true;
      pad.appendChild(home);
      wrap.appendChild(pad);
      if (cleanId(dirs.zin) || cleanId(dirs.zout)) {
        var zoom = el('div', 'tl-ptz-zoom');
        [['zin', 'Zoom +'], ['zout', 'Zoom −']].forEach(function (z) {
          var b = el('button', 'tl-ptz-z', PTZ_ICO[z[0]]);
          b.type = 'button';
          b.title = z[1];
          bindMove(b, dirs[z[0]]);
          zoom.appendChild(b);
        });
        wrap.appendChild(zoom);
      }
    }
    if (presets.length) {
      var pr = el('div', 'tl-ptz-presets');
      presets.forEach(function (o, i) {
        var b = el('button', 'tl-ptz-pre', '<b>' + (i + 1) + '</b><span>' + esc(o.label || ('Position ' + (i + 1))) + '</span>');
        b.type = 'button';
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          [].forEach.call(pr.children, function (c) { c.classList.toggle('tl-on', c === b); });
          fire(o.cmdAction, b);
        });
        pr.appendChild(b);
      });
      lb.el.appendChild(pr);
    }
    ['click', 'pointerdown'].forEach(function (ev) { wrap.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    lb.el.appendChild(wrap);
    lb.el.classList.add('tl-lb-ptz');
    // clavier : flèches, +/−, 1…9 pour les positions
    var keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', '+': 'zin', '-': 'zout' };
    var onKey = function (e) {
      if (!lb.el.parentNode) { document.removeEventListener('keydown', onKey); return; }
      if (keyMap[e.key] && cleanId(dirs[keyMap[e.key]])) { e.preventDefault(); fire(dirs[keyMap[e.key]]); if (hold) setTimeout(function () { fire(t.cmdPtzStop); }, 400); }
      else if (/^[1-9]$/.test(e.key) && presets[+e.key - 1]) fire(presets[+e.key - 1].cmdAction);
      else if ((e.key === 'h' || e.key === 'Home') && cleanId(t.cmdPtzHome)) fire(t.cmdPtzHome);
    };
    document.addEventListener('keydown', onKey);
  }

  /**
   * Pastille LIVE liée au vrai état de la caméra : Jeedom interroge Frigate (images/s de la caméra)
   * toutes les 30 s ; une erreur de chargement de l'image la passe aussi hors ligne.
   */
  function camBadge(p, t, host, abs) {
    var b = el('div', 'tl-cam-live' + (abs ? ' tl-cam-live-abs' : '') + ' tl-cam-st-wait', '<span></span><b>LIVE</b>');
    host.appendChild(b);
    var state = '', set = function (st, title) {
      if (st === state && !title) return;
      state = st;
      b.className = 'tl-cam-live' + (abs ? ' tl-cam-live-abs' : '') + ' tl-cam-st-' + st;
      b.querySelector('b').textContent = st === 'off' ? 'HORS LIGNE' : (st === 'pause' ? 'PAUSE' : 'LIVE');
      b.title = title || '';
    };
    var pid = String((p.data && p.data.id) || '');
    var check = function () {
      if (document.hidden || state === 'pause') return;
      ajax('camStatus', { page: pid, tile: t.id }).then(function (r) {
        if (!r || r.online === null || r.online === undefined) return;   // page non enregistrée : on garde l'état de l'image
        set(r.online ? 'live' : 'off', r.online ? (r.fps ? r.fps + ' images/s' : '') : (r.detail || 'Hors ligne'));
      }, function () {});
    };
    if (p.opts.edit) set('live');
    else if (pid && t.id) { check(); p.timers.push(setInterval(check, 30000)); }
    return { set: set, get: function () { return state; } };
  }

  R.camera = function (p, t, api) {
    api.el.classList.add('tl-embed', 'tl-cam');
    if (t.title && !t.hideTitle) api.el.classList.add('tl-has-title');
    var fb = String(t.frigateUrl || '').replace(/\/+$/, ''), cam = encodeURIComponent(t.frigateCam || '');
    var fm = t.frigateMode || 'mjpeg', hh = Math.round(num(t.frigateH, 720)), fps = Math.round(num(t.frigateFps, 5));
    var pid = String((p.data && p.data.id) || '');
    // Relais par Jeedom : le navigateur ne demande que « page + tuile », le serveur lit l'adresse enregistrée
    var proxy = (t.camProxy && !p.opts.edit && pid && t.id) ? PROXY_URL + '?page=' + encodeURIComponent(pid) + '&tile=' + encodeURIComponent(t.id) : '';
    var chips = el('div', 'tl-cam-chips');

    // go2rtc : flux MJPEG de go2rtc dans une image (une page go2rtc en cadre est bloquée par la sécurité de Jeedom)
    var g2 = String(t.go2rtcUrl || (fb ? fb.replace(/:\d+$/, '') + ':1984' : '')).replace(/\/+$/, '');
    // « rapide » : captures enchaînées (aucune connexion gardée ouverte : le plus fiable, plusieurs caméras sur la même page)
    var rapid = fm === 'rapide';
    var stream = fm !== 'snapshot' && !rapid;
    var direct, snapUrl;
    if (fm === 'go2rtc' && g2 && cam) {
      direct = g2 + '/api/stream.mjpeg?src=' + cam;
      snapUrl = g2 + '/api/frame.jpeg?src=' + cam;
    } else {
      direct = fb && cam ? (stream ? fb + '/api/' + cam + '?fps=' + fps + '&h=' + hh : fb + '/api/' + cam + '/latest.jpg?h=' + hh) : '';
      snapUrl = fb && cam ? fb + '/api/' + cam + '/latest.jpg?h=' + hh : '';
    }
    if (proxy) snapUrl = proxy + '&snap=1';
    var url = proxy ? (stream ? proxy : proxy + '&snap=1') : direct;

    var box = el('div', 'tl-cam-box');
    var img = el('img', 'tl-cam-img' + (t.camFit === 'contain' ? ' tl-fit-contain' : ''));
    img.alt = '';
    var msg = el('div', 'tl-cam-msg');
    box.appendChild(img);
    box.appendChild(msg);
    var badge = t.camLive ? camBadge(p, t, box, false) : { set: function () {}, get: function () { return ''; } };
    var stamp = el('div', 'tl-cam-time');
    box.appendChild(stamp);
    box.appendChild(chips);
    api.body.appendChild(box);

    // flux relayé : coupé côté serveur après 60 s → pause, un appui relance
    var cutTimer = null, paused = false;
    var startCut = function () {
      if (paused) badge.set('wait');
      paused = false;
      api.el.classList.remove('tl-cam-paused');
      clearTimeout(cutTimer);
      cutTimer = setTimeout(function () {
        paused = true;
        badge.set('pause');
        api.el.classList.add('tl-cam-paused');
        var still = new Image();
        still.onload = function () { if (paused) img.src = still.src; };
        still.src = bust(snapUrl);
      }, 58000);
      p.timers.push(cutTimer);
    };
    if (proxy && stream) box.appendChild(el('div', 'tl-cam-play', '<span>▶</span>'));

    var loading = false;
    var refresh = function (target) {
      target = target || img;
      if (!url) { msg.textContent = p.opts.edit ? 'Renseignez l\'adresse de Frigate et le nom de la caméra' : 'Caméra non configurée'; msg.style.display = ''; return; }
      if (stream) {
        if (proxy) { target.src = bust(url); if (target === img) startCut(); }
        else if (target.getAttribute('src') !== url) target.src = url;
        return;
      }
      if (loading && target === img) return;
      loading = true;
      var pre = new Image();
      pre.onload = function () {
        loading = false;
        target.src = pre.src;
        msg.style.display = 'none';
        var d = new Date();
        if (target === img) { stamp.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); if (badge.get() === 'wait') badge.set('live'); }
      };
      pre.onerror = function () { loading = false; if (target === img) { msg.textContent = 'Caméra injoignable'; msg.style.display = ''; badge.set('off', 'Image injoignable'); } };
      pre.src = bust(url);
    };
    img.onload = function () { msg.style.display = 'none'; if (badge.get() === 'wait') badge.set('live'); };
    img.onerror = function () { if (stream && !paused) { msg.textContent = 'Flux injoignable'; msg.style.display = ''; badge.set('off', 'Flux injoignable'); } };
    refresh();
    var every = rapid ? Math.max(0.15, 1 / Math.max(0.2, num(t.frigateFps, 3))) : Math.max(1, num(t.camRefresh, 5));
    if (!stream) p.timers.push(setInterval(function () { if (!document.hidden) refresh(); }, every * 1000));
    if (t.camZoom !== false && t.camZoom !== '0') {
      p.press(api.el, function () {
        if (paused) { refresh(); return; }
        var big = el('img', 'tl-lb-media');
        var timer = null;
        var lb = UI.lightbox(big, function () { clearInterval(timer); if (stream) big.src = ''; });
        ptzPanel(p, t, lb);
        refresh(big);
        if (!stream) timer = setInterval(function () { refresh(big); }, Math.min(every, 2) * 1000);
      });
    } else if (proxy && stream) p.press(api.el, function () { if (paused) refresh(); });
    return camChips(p, t, chips);
  };

  /** Pastilles Enregistrement / Détection : état (info binaire) + bascule (actions on/off optionnelles). */
  function camChips(p, t, box) {
    var defs = [
      { k: 'Rec', icon: CAM_ICONS.rec, label: 'REC', cls: 'tl-chip-rec' },
      { k: 'Det', icon: CAM_ICONS.det, label: 'Détection', cls: 'tl-chip-det' }
    ];
    var items = [];
    defs.forEach(function (d) {
      var info = t['cmd' + d.k], on = t['cmd' + d.k + 'On'], off = t['cmd' + d.k + 'Off'];
      if (!isSet(info) && !isSet(on)) return;
      var c = el('div', 'tl-cam-chip ' + d.cls, '<i>' + d.icon + '</i><b>' + d.label + '</b>');
      box.appendChild(c);
      var it = { c: c, info: cleanId(info), state: null };
      items.push(it);
      if ((isSet(on) || isSet(off)) && !p.opts.edit) {
        c.classList.add('tl-click');
        var act = function (e) {
          e.stopPropagation();
          e.preventDefault();
          var target = it.state ? (off || on) : (on || off);
          c.classList.add('tl-chip-busy');
          p.exec(target).then(function () {
            setTimeout(function () { c.classList.remove('tl-chip-busy'); }, 600);
          }, function (err) { c.classList.remove('tl-chip-busy'); UI.toast(err.message, 'error'); });
        };
        c.addEventListener('click', act);
        ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(function (ev) { c.addEventListener(ev, function (e) { e.stopPropagation(); }); });
      }
    });
    var paintAll = function () {
      items.forEach(function (it) {
        if (!it.info) return;
        it.state = isActive(p.val(it.info));
        it.c.classList.toggle('tl-chip-on', it.state === true);
        it.c.classList.toggle('tl-chip-off', it.state === false);
      });
    };
    paintAll();
    return function () { paintAll(); };
  }

  /* ---- Intégration : page web ---- */
  R.web = function (p, t, api) {
    api.el.classList.add('tl-embed');
    var box = el('div', 'tl-web');
    var fr = el('iframe', 'tl-web-frame');
    fr.setAttribute('loading', 'lazy');
    fr.setAttribute('referrerpolicy', 'no-referrer');
    var zoom = Math.max(10, Math.min(400, num(t.webZoom, 100))) / 100;
    fr.style.width = (100 / zoom) + '%';
    fr.style.height = (100 / zoom) + '%';
    fr.style.transform = 'scale(' + zoom + ')';
    if (!t.webInteractive || p.opts.edit) fr.style.pointerEvents = 'none';
    if (isSet(t.webUrl)) fr.src = t.webUrl; else box.appendChild(el('div', 'tl-cam-msg', 'Renseignez l\'adresse de la page'));
    box.appendChild(fr);
    api.body.appendChild(box);
    var mins = num(t.webRefresh, 0);
    if (mins > 0 && isSet(t.webUrl)) p.timers.push(setInterval(function () { if (!document.hidden) fr.src = t.webUrl; }, mins * 60000));
    if (!t.webInteractive && isSet(t.webUrl)) {
      p.press(api.el, function () {
        var big = el('iframe', 'tl-lb-frame');
        big.src = t.webUrl;
        var lbw = UI.lightbox(big);
        if (t._lbExtra) t._lbExtra(lbw);
      });
    }
    return function () {};
  };

  /* ---- Éclairage : on / off avec retour d'état, variateur en option ---- */
  var BULB = '<svg viewBox="0 0 100 100"><defs><radialGradient id="tlBulbG"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="currentColor" stop-opacity=".9"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs>' +
    '<circle class="tl-li-halo" cx="50" cy="42" r="44" fill="url(#tlBulbG)"/>' +
    '<path class="tl-li-glass" d="M50 12 C33 12 22 25 22 39 C22 51 30 57 34 66 C35.5 69 36 72 36 75 H64 C64 72 64.5 69 66 66 C70 57 78 51 78 39 C78 25 67 12 50 12 Z"/>' +
    '<path class="tl-li-fil" d="M42 66 V52 L46 46 L50 52 L54 46 L58 52 V66" fill="none"/>' +
    '<rect class="tl-li-cap" x="37" y="77" width="26" height="6" rx="2"/><rect class="tl-li-cap" x="39" y="85" width="22" height="5" rx="2"/><path class="tl-li-cap" d="M43 92 H57 L54 96 H46 Z"/></svg>';
  R.lumiere = function (p, t, api) { return lightTile(p, t, api, false); };
  R.variateur = function (p, t, api) { return lightTile(p, t, api, true); };
  function lightTile(p, t, api, dim) {
    api.el.classList.add('tl-li-tile');
    var box = el('div', 'tl-li' + (dim ? ' tl-li-dim' : ''));
    var c = isSet(t.liColor) ? color(t.liColor) : '#ffc94a';
    box.style.setProperty('--li', c);
    box.innerHTML = '<div class="tl-li-bulb">' + BULB + '</div><div class="tl-li-state"></div>' +
      (dim ? '<div class="tl-li-sl"><div class="tl-li-track"><i class="tl-li-fill"></i><b class="tl-li-knob"></b></div></div>' : '');
    api.body.appendChild(box);
    var q = function (x) { return box.querySelector(x); };
    var am = p.meta(t.cmdSlider) || {};
    var lvlId = cleanId(t.cmdLevel) || cleanId(am.linked);
    if (lvlId) p.depend(api, lvlId);
    var lo = num(t.liMin, num(am.minValue, 0)), hi = num(t.liMax, num(am.maxValue, 100));
    if (!(hi > lo)) { lo = 0; hi = 100; }
    var local = null, sendT = null, dragging = false, lastOn = num(t.liLast, null);
    var levelPct = function () {
      var v = local !== null ? local : p.val(lvlId);
      return isNum(v) ? Math.max(0, Math.min(100, (parseFloat(v) - lo) / (hi - lo) * 100)) : null;
    };
    var isOn = function () {
      var st = cleanId(t.cmdState) ? isActive(p.val(t.cmdState), t.onValue) : null;
      if (st !== null) return st;
      var pc = levelPct();
      return pc !== null ? pc > 0 : null;
    };
    var paintNow = function () {
      var on = isOn(), pc = dim ? levelPct() : null;
      if (on && pc === 0) pc = null;
      var k = on ? (pc !== null ? Math.max(0.25, pc / 100) : 1) : 0;
      box.classList.toggle('tl-li-on', on === true);
      box.classList.toggle('tl-li-unknown', on === null);
      box.style.setProperty('--k', k);
      q('.tl-li-state').textContent = on && pc !== null ? Math.round(pc) + ' %' : '';
      if (dim) {
        var shown = pc !== null ? pc : (on ? 100 : 0);
        if (!on && local === null) shown = 0;
        q('.tl-li-fill').style.width = shown + '%';
        q('.tl-li-knob').style.left = shown + '%';
      }
    };
    // appui sur la tuile : allumer / éteindre
    if (!p.opts.edit) {
      p.press(api.el, function () {
        var on = isOn();
        var id = on ? (t.cmdOff || t.cmdToggle) : (t.cmdOn || t.cmdToggle);
        if (!cleanId(id) && dim && cleanId(t.cmdSlider)) {
          // pas d'action on / off : le variateur fait l'affaire (dernier niveau ou 100 %)
          var target = on ? lo : (lastOn !== null ? lastOn : hi);
          p.run(api, t.cmdSlider, { slider: target }, { infoId: lvlId });
          return;
        }
        if (cleanId(id)) p.run(api, id, {}, { infoId: t.cmdState || lvlId });
      });
    }
    if (dim && !p.opts.edit && cleanId(t.cmdSlider)) {
      var track = q('.tl-li-track'), sl = q('.tl-li-sl');
      var step = Math.max(0.01, num(t.liStep, num(am.step, 1)));
      var fromX = function (e) {
        var r = track.getBoundingClientRect();
        var pc = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        var v = lo + Math.round(pc * (hi - lo) / step) * step;
        local = Math.max(lo, Math.min(hi, parseFloat(v.toFixed(3))));
        paintNow();
      };
      var send = function () {
        if (local === null) return;
        var v = local;
        if (v > lo) lastOn = v;
        p.exec(t.cmdSlider, { slider: v }).then(function () { setTimeout(function () { local = null; paintNow(); }, 2500); }, function (err) { local = null; paintNow(); UI.toast(err.message, 'error'); });
      };
      ['pointerdown', 'click'].forEach(function (ev) { sl.addEventListener(ev, function (e) { e.stopPropagation(); }); });
      sl.addEventListener('pointerdown', function (e) { e.preventDefault(); dragging = true; try { sl.setPointerCapture(e.pointerId); } catch (er) { /* rien */ } fromX(e); });
      sl.addEventListener('pointermove', function (e) { if (dragging) fromX(e); });
      ['pointerup', 'pointercancel'].forEach(function (ev) { sl.addEventListener(ev, function () { if (!dragging) return; dragging = false; clearTimeout(sendT); sendT = setTimeout(send, 150); }); });
    }
    return function (id) {
      if (id && id === lvlId) { var v = p.val(lvlId); if (isNum(v) && parseFloat(v) > lo) lastOn = parseFloat(v); }
      paintNow();
    };
  }

  /* ---- Interphone Hikvision (plugin hikinterphone) ---- */
  function hikState(page, t) {
    var on = cleanId(t.cmdOnline) ? page.val(t.cmdOnline) : null;
    if (isSet(on) && String(on) === '0') return 'off';
    var st = String(isSet(page.val(t.cmdEtat)) ? page.val(t.cmdEtat) : '').toLowerCase();
    if (/ring/.test(st) || isActive(page.val(t.cmdRing)) === true) return 'ring';
    if (/oncall|talk|call/.test(st) || isActive(page.val(t.cmdTalk)) === true) return 'call';
    return 'idle';
  }
  var HIK_TXT = { idle: 'Au repos', ring: 'On sonne !', call: 'En communication', off: 'Hors ligne' };
  var HIK_ICO = {
    answer: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
    hangup: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 9c-1.6 0-3.15.25-4.6.72v3.1a1 1 0 0 1-.56.9 11.5 11.5 0 0 0-2.66 1.85 1 1 0 0 1-1.41 0L.29 13.08a1 1 0 0 1 0-1.41A16.9 16.9 0 0 1 12 7c4.57 0 8.72 1.8 11.71 4.67a1 1 0 0 1 0 1.41l-2.48 2.49a1 1 0 0 1-1.41 0 11.3 11.3 0 0 0-2.67-1.85 1 1 0 0 1-.56-.9v-3.1A15 15 0 0 0 12 9z"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></svg>',
    door: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 21h16M6 21V4a1 1 0 0 1 1-1h7v18M14 3l4 2v16"/><circle cx="11.5" cy="12.5" r="1.2" fill="currentColor"/></svg>'
  };
  R.interphone = function (p, t, api) {
    api.el.classList.add('tl-hk-tile');
    var box = el('div', 'tl-hk');
    var fb = String(t.frigateUrl || '').replace(/\/+$/, ''), cam = encodeURIComponent(t.frigateCam || '');
    var pid = String((p.data && p.data.id) || '');
    var proxy = (t.camProxy && !p.opts.edit && pid && t.id) ? PROXY_URL + '?page=' + encodeURIComponent(pid) + '&tile=' + encodeURIComponent(t.id) + '&snap=1' : '';
    var hh = Math.round(num(t.frigateH, 720));
    var snap = proxy || (fb && cam ? fb + '/api/' + cam + '/latest.jpg?h=' + hh : '');
    box.innerHTML = '<div class="tl-hk-view">' + (snap ? '<img class="tl-hk-img" alt="">' : '<div class="tl-hk-bell">' + iconHtml('svg:a-sonnette') + '</div>') +
      '<div class="tl-hk-state"><i></i><span></span><em></em></div></div>' +
      '<div class="tl-hk-btns">' +
      (cleanId(t.cmdAnswer) ? '<button type="button" class="tl-hk-b tl-hk-answer">' + HIK_ICO.answer + '<span>Décrocher</span></button>' : '') +
      (cleanId(t.cmdReject) ? '<button type="button" class="tl-hk-b tl-hk-reject">' + HIK_ICO.hangup + '<span>Refuser</span></button>' : '') +
      (cleanId(t.cmdHangup) ? '<button type="button" class="tl-hk-b tl-hk-hangup">' + HIK_ICO.hangup + '<span>Raccrocher</span></button>' : '') +
      (cleanId(t.cmdTalkUrl) ? '<button type="button" class="tl-hk-b tl-hk-talk">' + HIK_ICO.mic + '<span>Parler</span></button>' : '') +
      (cleanId(t.cmdOpen) ? '<button type="button" class="tl-hk-b tl-hk-open">' + HIK_ICO.door + '<span>' + esc(t.openLabel || 'Ouvrir') + '</span></button>' : '') +
      '</div><div class="tl-hk-ev"></div>';
    api.body.appendChild(box);
    var q = function (x) { return box.querySelector(x); };
    var img = q('.tl-hk-img'), cur = null, callStart = 0, popup = null;
    // image de la caméra : rafraîchie vite pendant un appel, lentement au repos
    var loadImg = function (target) {
      if (!snap || !target) return;
      var pre = new Image();
      pre.onload = function () { target.src = pre.src; };
      pre.src = bust(snap);
    };
    if (img) {
      loadImg(img);
      var lastLoad = Date.now();
      p.timers.push(setInterval(function () {
        if (document.hidden) return;
        var busy = cur === 'ring' || cur === 'call';
        var every = busy ? 1000 : Math.max(2, num(t.camRefresh, 10)) * 1000;
        if (Date.now() - lastLoad >= every) { lastLoad = Date.now(); loadImg(img); if (popup && popup.img) loadImg(popup.img); }
      }, 500));
    }
    var act = function (key) {
      var id = t[key];
      if (!cleanId(id)) return;
      p.run(api, id, {}, { infoId: t.cmdEtat });
    };
    var doorConfirm = t.doorConfirm !== false && t.doorConfirm !== '0' && t.doorConfirm !== 'non';
    // Parler : page « Parler » du plugin hikinterphone (two-way audio) dans une fenêtre
    var talk = null;
    var openTalk = function () {
      var url = p.val(t.cmdTalkUrl);
      if (!isSet(url) || !/^https?:\/\//.test(String(url))) { UI.toast('Lien Parler indisponible : enregistrez l\'équipement hikinterphone', 'error'); return; }
      url = String(url);
      closePopup();
      if (talk) return;
      var full = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'embed=1&video=1&bg=transparent&mode=' + (t.talkMode === 'free' ? 'free' : 'ptt');
      var body = el('div', 'tl-hk-talkbox');
      var warn = root.isSecureContext === false
        ? '<div class="tl-hk-warn">Micro bloqué par le navigateur : cette page Jeedom n\'est pas en https. Ouvrez Jeedom en https, ou déclarez son adresse comme sûre (Chrome : chrome://flags, « Insecure origins treated as secure » ; Fully Kiosk : accès micro).</div>' : '';
      body.innerHTML = warn + '<iframe class="tl-hk-frame" allow="microphone; autoplay; screen-wake-lock" src="' + esc(full) + '"></iframe>' +
        '<div class="tl-hk-note">Écran blanc ? Acceptez une fois le certificat : <a href="' + esc(url) + '" target="_blank" rel="noopener">ouvrir la page Parler</a>, « Continuer », puis revenez ici.</div>';
      talk = UI.modal({ title: (t.title || 'Interphone') + ' — Parler', body: body, wide: true, buttons: [{ label: 'Fermer', click: function () { talk = null; } }] });
    };
    var bind = function (root2) {
      var tb = root2.querySelector('.tl-hk-talk');
      if (tb && !p.opts.edit) tb.addEventListener('click', function (e) { e.stopPropagation(); openTalk(); });
      [['.tl-hk-answer', 'cmdAnswer'], ['.tl-hk-reject', 'cmdReject'], ['.tl-hk-hangup', 'cmdHangup'], ['.tl-hk-open', 'cmdOpen']].forEach(function (b) {
        var bt = root2.querySelector(b[0]);
        if (!bt || p.opts.edit) return;
        bt.addEventListener('click', function (e) {
          e.stopPropagation();
          if (b[1] === 'cmdAnswer' && t.talkOnAnswer && cleanId(t.cmdTalkUrl)) { act('cmdAnswer'); openTalk(); return; }
          if (b[1] === 'cmdOpen' && doorConfirm) { UI.confirm('Ouvrir la porte ?', function () { act('cmdOpen'); }); return; }
          act(b[1]);
        });
      });
    };
    bind(box);
    // fenêtre automatique quand ça sonne (tablette murale)
    var openPopup = function () {
      if (popup || p.opts.edit) return;
      var body = el('div', 'tl-hk tl-hk-pop');
      body.innerHTML = (snap ? '<div class="tl-hk-view"><img class="tl-hk-img" alt=""></div>' : '<div class="tl-hk-view"><div class="tl-hk-bell">' + iconHtml('svg:a-sonnette') + '</div></div>') + q('.tl-hk-btns').outerHTML;
      popup = UI.modal({ title: t.title || 'Interphone', body: body, wide: true, buttons: [{ label: 'Fermer', click: function () { popup = null; } }] });
      popup.img = body.querySelector('.tl-hk-img');
      popup.root = body;
      body.classList.add('tl-run');
      loadImg(popup.img);
      bind(body);
    };
    var closePopup = function () { if (popup) { popup.close(); popup = null; } };
    var tick = null;
    var paintTime = function () {
      q('.tl-hk-state em').textContent = cur === 'call' && callStart ? (function (sec) { return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); })(Math.floor((Date.now() - callStart) / 1000)) : '';
    };
    return function () {
      var st = hikState(p, t);
      if (st !== cur) {
        if (st === 'call') { callStart = Date.now(); clearInterval(tick); tick = setInterval(paintTime, 1000); p.timers.push(tick); } else { clearInterval(tick); callStart = 0; }
        if (st === 'ring' && t.ringPopup) openPopup();
        if ((st === 'idle' || st === 'off') && popup && popup.root) setTimeout(function () { if (cur === 'idle' || cur === 'off') closePopup(); }, 4000);
        cur = st;
        if (img && (st === 'ring' || st === 'call')) loadImg(img);
      }
      box.className = 'tl-hk tl-hk-' + st;
      [box, popup && popup.root].forEach(function (b) {
        if (!b) return;
        b.classList.toggle('tl-hk-' + st, true);
        var show = { '.tl-hk-answer': st === 'ring', '.tl-hk-reject': st === 'ring', '.tl-hk-hangup': st === 'call' || (st === 'ring' && !cleanId(t.cmdReject)), '.tl-hk-open': st !== 'off', '.tl-hk-talk': st === 'ring' || st === 'call' || (!!t.talkAlways && st !== 'off') };
        Object.keys(show).forEach(function (k) { var x = b.querySelector(k); if (x) x.style.display = show[k] ? '' : 'none'; });
      });
      if (popup && popup.root) popup.root.className = 'tl-hk tl-hk-pop tl-run tl-hk-' + st;
      q('.tl-hk-state span').textContent = HIK_TXT[st];
      paintTime();
      var ev = t.showEvent && cleanId(t.cmdEvent) ? p.val(t.cmdEvent) : '';
      q('.tl-hk-ev').textContent = isSet(ev) ? String(ev) : '';
    };
  };

  /* ---- Bons Points (plugin bonsPoints) : score de la semaine, paliers, comportements ---- */
  var BP_STAR = '<svg viewBox="0 0 100 100"><path d="M50 6l12.4 27.6 30 3.2-22.5 20.2 6.4 29.6L50 71.3 23.7 86.6l6.4-29.6L7.6 36.8l30-3.2z"/></svg>';
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }
  R.bonspoints = function (p, t, api) {
    var style = t.bpStyle || 'grande';
    api.el.classList.add('tl-bp-tile');
    var pals = (Array.isArray(t.bpPal) ? t.bpPal : []).filter(function (x) { return x && isNum(x.pts) && !/^palier (atteint|semaine)/i.test(x.name || ''); })
      .map(function (x) { return { name: x.name || '', pts: parseFloat(x.pts), icon: x.icon || '' }; })
      .sort(function (a, b) { return a.pts - b.pts; });
    // paliers positifs = récompenses (atteints si score >= points) ; paliers négatifs = sanctions (si score <= points)
    var icons = String(isSet(t.bpIcons) ? t.bpIcons : '🍨 🎳 🏉 🎁 ⭐ 🏆').split(/\s+/).filter(Boolean);
    var sIcons = String(isSet(t.bpSancIcons) ? t.bpSancIcons : '⛔').split(/\s+/).filter(Boolean);
    var gifts = pals.filter(function (x) { return x.pts >= 0; }), sancs = pals.filter(function (x) { return x.pts < 0; });
    gifts.forEach(function (x, i) { x.sanc = false; if (!x.icon) x.icon = icons[i % icons.length] || '🎁'; });
    sancs.slice().reverse().forEach(function (x, i) { x.sanc = true; if (!x.icon) x.icon = sIcons[i % sIcons.length] || '⛔'; });
    var reached = function (x, sc) { return x.sanc ? sc <= x.pts : sc >= x.pts; };
    var behav = (Array.isArray(t.bpBehav) ? t.bpBehav : []).filter(function (x) { return x && cleanId(x.cmdAct); });
    var MAX = gifts.length ? Math.max(1, gifts[gifts.length - 1].pts) : 30;
    var NEG = Math.min(-1, num(t.bpNeg, -10), sancs.length ? sancs[0].pts - Math.max(2, Math.round((MAX - sancs[0].pts) * 0.06)) : 0);
    var pos = function (v) { return (Math.max(NEG, Math.min(MAX, v)) - NEG) / (MAX - NEG) * 100; };
    var lvl = function (sc) { var r = null; gifts.forEach(function (x) { if (sc >= x.pts) r = x; }); return r; };
    var next = function (sc) { return gifts.filter(function (x) { return sc < x.pts; })[0] || null; };
    var hitS = function (sc) { return sancs.filter(function (x) { return sc <= x.pts; })[0] || null; }; // la plus lourde atteinte
    var nextS = function (sc) { var r = null; sancs.forEach(function (x) { if (x.pts < sc) r = x; }); return r; };
    var box = el('div', 'tl-bp tl-bp-' + style);
    box.style.setProperty('--bp-cols', Math.max(1, Math.min(6, Math.round(num(t.bpCols, style === 'compacte' ? 2 : 3)))));
    var kid = style === 'compacte' ? (t.bpKidBtns || '') : (style === 'grande' ? 'tous' : '');
    var shown = behav.filter(function (b) { return kid === 'tous' || (kid === 'plus' && num(b.pts, 0) > 0); });
    var btnHtml = shown.map(function (b, i) {
      var v = num(b.pts, 0);
      return '<button type="button" class="tl-bp-b' + (v < 0 ? ' tl-bp-neg' : '') + '" data-i="' + behav.indexOf(b) + '"><em>' + (v > 0 ? '+' : (v < 0 ? '−' : '')) + Math.abs(v) + '</em><span>' + esc(b.label || '') + '</span></button>';
    }).join('');
    var week = 'Semaine ' + isoWeek(new Date());
    if (style === 'grande') {
      box.innerHTML = '<div class="tl-bp-week">' + week + '</div><div class="tl-bp-offb">Hors garde</div>' +
        '<div class="tl-bp-head"><div class="tl-bp-star">' + BP_STAR + '<b></b></div><div class="tl-bp-hs"><div class="tl-bp-t1"></div><div class="tl-bp-t2"></div></div></div>' +
        '<div class="tl-bp-path"><div class="tl-bp-track"><div class="tl-bp-negz"></div><div class="tl-bp-fill"></div></div><div class="tl-bp-zero"><b>0</b></div>' +
        pals.map(function (x, k) { return '<div class="tl-bp-ms' + (x.sanc ? ' tl-bp-sanc' : '') + (k === pals.length - 1 ? ' tl-bp-ms-end' : '') + (k === 0 && x.sanc ? ' tl-bp-ms-start' : '') + '" style="left:' + pos(x.pts) + '%"><i>' + esc(x.icon) + '</i><span>' + esc(x.name) + '</span></div>'; }).join('') +
        '<div class="tl-bp-cur"></div></div>' +
        (btnHtml ? '<div class="tl-bp-bh">' + btnHtml + '</div>' : '') +
        '<div class="tl-bp-foot"><div class="tl-bp-st"><small>Semaine dernière</small><b class="tl-bp-prev">—</b></div><div class="tl-bp-st"><small>Total</small><b class="tl-bp-tot">—</b></div>' +
        (cleanId(t.cmdUndo) ? '<button type="button" class="tl-bp-undo">↶ Annuler</button>' : '') + '</div><div class="tl-bp-last"></div>';
    } else if (style === 'compacte') {
      box.innerHTML = '<div class="tl-bp-offb">Hors garde</div><div class="tl-bp-ring"><svg viewBox="0 0 140 140"><circle class="tl-bp-rbg" cx="70" cy="70" r="58"/><circle class="tl-bp-rfg" cx="70" cy="70" r="58" stroke-dasharray="364.4" stroke-dashoffset="364.4"/></svg>' +
        '<div class="tl-bp-in"><b></b><small>points</small></div></div><div class="tl-bp-nx"></div>' + (btnHtml ? '<div class="tl-bp-bh">' + btnHtml + '</div>' : '');
    } else {
      box.innerHTML = '<div class="tl-bp-ln"><b></b><span>pts cette semaine</span></div><div class="tl-bp-gifts">' + pals.map(function (x) { return '<span class="' + (x.sanc ? 'tl-bp-sanc' : '') + '" title="' + esc(x.name + ' (' + x.pts + ')') + '">' + esc(x.icon) + '</span>'; }).join('') + '</div>';
    }
    api.body.appendChild(box);
    var q = function (x) { return box.querySelector(x); };
    var last = null, fx = function (cls, life, setup) { var e2 = el('div', cls); setup(e2); box.appendChild(e2); setTimeout(function () { if (e2.parentNode) e2.parentNode.removeChild(e2); }, life); };
    var confetti = function () {
      var cols = ['#ffca28', '#2ecc71', '#4fc3f7', '#ef5350', '#ab47bc'];
      for (var i = 0; i < 36; i++) fx('tl-bp-conf', 2300, function (c) { c.style.left = (Math.random() * 100) + '%'; c.style.background = cols[i % 5]; c.style.setProperty('--x', (Math.random() * 120 - 60) + 'px'); c.style.setProperty('--r', (Math.random() * 720) + 'deg'); c.style.animationDelay = (Math.random() * .4) + 's'; });
    };
    if (!p.opts.edit) {
      [].forEach.call(box.querySelectorAll('.tl-bp-b'), function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          if (box.classList.contains('tl-bp-off')) { UI.toast('Hors garde : points bloqués', 'error'); return; }
          var it = behav[parseInt(b.getAttribute('data-i'), 10)], v = num(it.pts, 0), r = box.getBoundingClientRect();
          fx('tl-bp-fly', 1000, function (f) { f.textContent = (v > 0 ? '+' : '−') + Math.abs(v); f.style.color = v >= 0 ? '#2ecc71' : '#ef5350'; f.style.left = (e.clientX - r.left - 12) + 'px'; f.style.top = (e.clientY - r.top - 20) + 'px'; });
          p.run(api, it.cmdAct, {}, { infoId: t.cmdScore });
        });
      });
      var ub = q('.tl-bp-undo');
      if (ub) ub.addEventListener('click', function (e) { e.stopPropagation(); p.run(api, t.cmdUndo, {}, { infoId: t.cmdScore, confirm: t.bpUndoConfirm ? 'Annuler le dernier point ?' : undefined }); });
    }
    return function () {
      var raw = p.val(t.cmdScore), sc = isNum(raw) ? parseFloat(raw) : null;
      var actV = cleanId(t.cmdActif) ? p.val(t.cmdActif) : null;
      box.classList.toggle('tl-bp-off', isSet(actV) && isActive(actV) === false);
      if (sc === null) { box.classList.add('tl-bp-unknown'); return; }
      box.classList.remove('tl-bp-unknown');
      var neg = sc < 0, n = next(sc), l = lvl(sc), hs = hitS(sc), ns = nextS(sc);
      box.classList.toggle('tl-bp-punished', !!hs);
      box.classList.toggle('tl-bp-isneg', neg);
      if (last !== null && sc > last) {
        var st = q('.tl-bp-star'); if (st) { st.classList.remove('tl-bp-pop'); void st.offsetWidth; st.classList.add('tl-bp-pop'); }
        if (l && l !== lvl(last) && !p.opts.edit) confetti();
      }
      if (last !== null && hs && hs !== hitS(last) && !p.opts.edit) { box.classList.remove('tl-bp-shake'); void box.offsetWidth; box.classList.add('tl-bp-shake'); }
      last = sc;
      var txt = String(Math.round(sc * 10) / 10);
      if (style === 'grande') {
        q('.tl-bp-star b').textContent = txt;
        var z = pos(0), c = pos(sc), fill = q('.tl-bp-fill');
        fill.classList.toggle('tl-bp-fneg', neg);
        fill.style.left = (neg ? c : z) + '%'; fill.style.width = Math.abs(c - z) + '%';
        q('.tl-bp-negz').style.width = z + '%'; q('.tl-bp-zero').style.left = z + '%';
        q('.tl-bp-cur').style.left = c + '%';
        [].forEach.call(box.querySelectorAll('.tl-bp-ms'), function (m, k) { m.classList.toggle('tl-bp-ok', reached(pals[k], sc)); m.classList.toggle('tl-bp-next', n === pals[k] || (neg && !hs && ns === pals[k])); });
        q('.tl-bp-t1').textContent = hs ? 'Sanction : ' + hs.name + ' ' + hs.icon : (neg ? 'Oups, score négatif 😕' : (l ? 'Bravo ! ' + l.name + ' gagné ' + l.icon : 'Allez, on y va !'));
        q('.tl-bp-t2').innerHTML = neg ? 'Encore <b>' + esc(String(-sc)) + ' points</b> pour revenir à 0' + (!hs && ns ? ' · attention, sanction à ' + esc(String(ns.pts)) : '') : (n ? 'Encore <b>' + esc(String(n.pts - sc)) + ' points</b> pour : ' + esc(n.name) + ' ' + esc(n.icon) : (gifts.length ? '<b>Tous les paliers atteints !</b> 🎉' : ''));
        var pv = p.val(t.cmdPrev), tv = p.val(t.cmdTotal), lv = p.val(t.cmdLast);
        q('.tl-bp-prev').textContent = isSet(pv) ? pv : '—';
        q('.tl-bp-tot').textContent = isSet(tv) ? tv : '—';
        q('.tl-bp-last').textContent = isSet(lv) && String(lv) !== '' ? 'Dernier : ' + lv : '';
      } else if (style === 'compacte') {
        q('.tl-bp-in b').textContent = txt;
        var fr = neg ? Math.min(1, sc / NEG) : Math.min(1, sc / MAX), rg = q('.tl-bp-rfg');
        rg.classList.toggle('tl-bp-fneg', neg);
        rg.style.strokeDashoffset = (neg ? -1 : 1) * 364.4 * (1 - fr);
        q('.tl-bp-nx').innerHTML = hs ? '<b>' + esc(hs.icon + ' ' + hs.name) + '</b>' : neg ? 'Encore <b>' + esc(String(-sc)) + '</b> pour revenir à 0' : (n ? 'Plus que <b>' + esc(String(n.pts - sc)) + '</b> pour ' + esc(n.icon) : (gifts.length ? 'Tout gagné ! 🎉' : ''));
      } else {
        q('.tl-bp-ln b').textContent = txt;
        [].forEach.call(box.querySelectorAll('.tl-bp-gifts span'), function (g, k) { g.classList.toggle('tl-bp-ok', reached(pals[k], sc)); });
      }
    };
  };

  /* ---- Thermostat : anneau, consigne +/− ou glisser, mesure, modes ---- */
  R.thermostat = function (p, t, api) {
    api.el.classList.add('tl-th-tile');
    var kind = t.thKind || 'chauffage';
    var box = el('div', 'tl-th tl-th-' + kind);
    var A0 = 225, SWEEP = 270, CX = 100, CY = 100, RR = 82;
    var polar = function (deg) { var r = (deg - 90) * Math.PI / 180; return [CX + RR * Math.cos(r), CY + RR * Math.sin(r)]; };
    var arc = function (a, b) {
      if (b - a < 0.01) return '';
      var s0 = polar(a), s1 = polar(b);
      return 'M' + s0[0].toFixed(2) + ' ' + s0[1].toFixed(2) + ' A' + RR + ' ' + RR + ' 0 ' + (b - a > 180 ? 1 : 0) + ' 1 ' + s1[0].toFixed(2) + ' ' + s1[1].toFixed(2);
    };
    box.innerHTML = '<div class="tl-th-ringbox"><svg viewBox="0 0 200 200" class="tl-th-ring">' +
      '<path class="tl-th-track" d="' + arc(A0, A0 + SWEEP) + '"/>' +
      '<path class="tl-th-fill" d=""/>' +
      '<circle class="tl-th-curdot" r="4.5" cx="-20" cy="-20"/>' +
      '<circle class="tl-th-knob" r="9" cx="-20" cy="-20"/>' +
      '<path class="tl-th-ring-hit" d="' + arc(A0, A0 + SWEEP) + '"/></svg>' +
      '<div class="tl-th-center"><div class="tl-th-state"></div><div class="tl-th-set"><b></b><span>°</span></div>' +
      '<div class="tl-th-cur"></div></div></div>' +
      '<div class="tl-th-ctrl"><button type="button" class="tl-th-btn tl-th-minus">−</button><div class="tl-th-modes"></div><button type="button" class="tl-th-btn tl-th-plus">+</button></div>';
    api.body.appendChild(box);
    var q = function (c) { return box.querySelector(c); };
    var fill = q('.tl-th-fill'), knob = q('.tl-th-knob'), curdot = q('.tl-th-curdot'), setB = q('.tl-th-set b'), cur = q('.tl-th-cur'), stateEl = q('.tl-th-state'), modes = q('.tl-th-modes');
    var range = function () {
      var am = p.meta(t.cmdSet) || {}, im = p.meta(cleanId(t.cmdSetInfo) || cleanId(am.linked)) || {};
      var lo = num(t.thMin, num(am.minValue, num(im.minValue, 5)));
      var hi = num(t.thMax, num(am.maxValue, num(im.maxValue, 30)));
      return hi > lo ? [lo, hi] : [5, 30];
    };
    var step = Math.max(0.05, num(t.thStep, 0.5));
    var dec = step < 1 ? (String(step).split('.')[1] || '').length : 0;
    var pending = null, sendTimer = null, dragging = false, lastSent = null;
    var setpoint = function () {
      if (pending !== null) return pending;
      var v = p.val(t.cmdSetInfo);
      if (!isNum(v) && t.cmdSet) { var m = p.meta(t.cmdSet); if (m && m.linked) v = p.val(m.linked); }
      return isNum(v) ? parseFloat(v) : lastSent;
    };
    var angleOf = function (v) { var r = range(); return A0 + Math.max(0, Math.min(1, (v - r[0]) / (r[1] - r[0]))) * SWEEP; };
    var paintNow = function () {
      var sp = setpoint(), mv = p.val(t.cmdTemp);
      var r = range();
      if (sp !== null) {
        var a = angleOf(sp), k = polar(a);
        fill.setAttribute('d', arc(A0, a));
        knob.setAttribute('cx', k[0]); knob.setAttribute('cy', k[1]); knob.style.display = '';
        setB.textContent = sp.toFixed(dec).replace('.', ',');
      } else { fill.setAttribute('d', ''); knob.style.display = 'none'; setB.textContent = '–'; }
      if (isNum(mv)) {
        var c = polar(angleOf(parseFloat(mv)));
        curdot.setAttribute('cx', c[0]); curdot.setAttribute('cy', c[1]); curdot.style.display = '';
        cur.innerHTML = iconHtml('svg:thermo') + '<span>' + parseFloat(mv).toFixed(1).replace('.', ',') + '°</span>';
      } else { cur.textContent = ''; curdot.style.display = 'none'; }
      // état : en chauffe / en froid / arrêt
      var act = t.cmdState ? isActive(p.val(t.cmdState)) : null;
      var off = t.cmdPower ? isActive(p.val(t.cmdPower)) === false : false;
      box.classList.toggle('tl-th-active', act === true && !off);
      box.classList.toggle('tl-th-off', off);
      stateEl.textContent = off ? 'Arrêt' : (act === true ? (kind === 'clim' ? 'Refroidit' : (kind === 'auto' ? 'En marche' : 'Chauffe')) : (act === false ? 'Repos' : ''));
      if (t.cmdMode) {
        var mv2 = String(p.val(t.cmdMode) || '').toLowerCase();
        [].forEach.call(modes.children, function (b) { b.classList.toggle('tl-on', b.__label.toLowerCase() === mv2 || b.__val.toLowerCase() === mv2); });
      }
      api.el.setAttribute('data-range', r[0] + '-' + r[1]);
    };
    var change = function (v) {
      var r = range();
      v = Math.round(v / step) * step;
      v = Math.max(r[0], Math.min(r[1], v));
      pending = parseFloat(v.toFixed(dec));
      paintNow();
      clearTimeout(sendTimer);
      sendTimer = setTimeout(send, dragging ? 99999 : 900);
    };
    var send = function () {
      clearTimeout(sendTimer);
      if (pending === null || p.opts.edit) return;
      var v = lastSent = pending;
      if (!t.cmdSet) { pending = null; paintNow(); return; }
      box.classList.add('tl-th-sending');
      p.exec(t.cmdSet, { slider: v }).then(function () {
        setTimeout(function () { pending = null; box.classList.remove('tl-th-sending'); paintNow(); }, 1500);
      }, function (err) { pending = null; box.classList.remove('tl-th-sending'); paintNow(); UI.toast(err.message, 'error'); });
    };
    if (!p.opts.edit && t.cmdSet) {
      var stop = function (e) { e.stopPropagation(); };
      q('.tl-th-minus').addEventListener('click', function (e) { stop(e); change((setpoint() || range()[0]) - step); });
      q('.tl-th-plus').addEventListener('click', function (e) { stop(e); change((setpoint() || range()[0]) + step); });
      // glisser sur l'anneau
      var svg = q('.tl-th-ring');
      var fromPt = function (e) {
        var r = svg.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width * 200 - CX, y = (e.clientY - r.top) / r.height * 200 - CY;
        var deg = Math.atan2(y, x) * 180 / Math.PI + 90;
        if (deg < 0) deg += 360;
        var rel = deg - A0; if (rel < 0) rel += 360;
        if (rel > SWEEP) rel = rel > SWEEP + (360 - SWEEP) / 2 ? 0 : SWEEP;
        var rg = range();
        change(rg[0] + rel / SWEEP * (rg[1] - rg[0]));
      };
      var hit = q('.tl-th-ring-hit');
      [hit, knob].forEach(function (h) {
        h.addEventListener('pointerdown', function (e) {
          stop(e); e.preventDefault(); dragging = true;
          try { svg.setPointerCapture(e.pointerId); } catch (er) { /* capture indisponible */ }
          fromPt(e);
        });
      });
      svg.addEventListener('pointermove', function (e) { if (dragging) { e.preventDefault(); fromPt(e); } });
      ['pointerup', 'pointercancel'].forEach(function (ev) { svg.addEventListener(ev, function () { if (dragging) { dragging = false; clearTimeout(sendTimer); sendTimer = setTimeout(send, 600); } }); });
      svg.addEventListener('click', stop);
    } else {
      q('.tl-th-minus').style.visibility = 'hidden';
      q('.tl-th-plus').style.visibility = 'hidden';
    }
    // modes : boutons (action par mode)
    (t.options || []).slice(0, 5).forEach(function (o) {
      if (!o || !cleanId(o.cmdAction)) return;
      var b = el('button', 'tl-th-mode', esc(o.label || 'Mode'));
      b.type = 'button';
      b.__label = String(o.label || '');
      b.__val = String(o.value || o.label || '');
      if (!p.opts.edit) b.addEventListener('click', function (e) { e.stopPropagation(); p.run(api, o.cmdAction, {}, {}); });
      modes.appendChild(b);
    });
    if (t.cmdPowerOn || t.cmdPowerOff) {
      var pw = el('button', 'tl-th-power', iconHtml('svg:power'));
      pw.type = 'button';
      if (!p.opts.edit) pw.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = t.cmdPower ? isActive(p.val(t.cmdPower)) : null;
        p.run(api, on ? (t.cmdPowerOff || t.cmdPowerOn) : (t.cmdPowerOn || t.cmdPowerOff), {}, {});
      });
      box.appendChild(pw);
    }
    if (api.h < 1.4 || api.w < 1) box.classList.add('tl-th-compact');
    return function () { paintNow(); };
  };

  /* ---- Chauffe-eau (thermodynamique ou électrique) ---- */
  var TEMP_STOPS = [[15, [47, 128, 255]], [32, [140, 90, 255]], [42, [255, 130, 60]], [55, [255, 60, 45]]];
  function tempColor(v) {
    var S0 = TEMP_STOPS;
    if (v <= S0[0][0]) return 'rgb(' + S0[0][1].join(',') + ')';
    for (var i = 1; i < S0.length; i++) {
      if (v <= S0[i][0]) {
        var a = S0[i - 1], b = S0[i], k = (v - a[0]) / (b[0] - a[0]);
        return 'rgb(' + a[1].map(function (c, j) { return Math.round(c + (b[1][j] - c) * k); }).join(',') + ')';
      }
    }
    return 'rgb(' + S0[S0.length - 1][1].join(',') + ')';
  }
  var CE_ICO = {
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/></svg>',
    auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/></svg>',
    palm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22c0-6 1-10 0-13"/><path d="M12 9C9 5 5 5 3 7c3 0 6 0 9 2zM12 9c3-4 7-4 9-2-3 0-6 0-9 2zM12 9c-1-4 1-6 3-7-1 3-2 5-3 7z" fill="currentColor"/></svg>',
    leaf: '<svg viewBox="0 0 24 24"><path d="M5 19C5 9 12 4 20 4c0 9-5 15-15 15zm0 0 8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    dot: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>'
  };
  function ceIcon(label) {
    var l = String(label || '').toLowerCase();
    if (/boost|forc|turbo/.test(l)) return CE_ICO.bolt;
    if (/vacan|absen/.test(l)) return CE_ICO.palm;
    if (/auto|prog/.test(l)) return CE_ICO.auto;
    if (/eco|éco|green/.test(l)) return CE_ICO.leaf;
    return CE_ICO.dot;
  }

  R.chauffeeau = function (p, t, api) {
    api.el.classList.add('tl-ce-tile');
    var uid = 'ce' + Math.random().toString(36).slice(2, 8);
    var pac = t.ceKind === 'pac' || (t.ceKind !== 'elec' && isSet(t.cmdFan));
    var box = el('div', 'tl-ce2' + (pac ? ' tl-ce-pac' : ' tl-ce-elec'));
    // ballon : viewBox 120 × 240, le cadre HTML garde le même ratio pour poser les étiquettes
    var Y0 = pac ? 66 : 30, H0 = pac ? 166 : 200, X0 = 20, W0 = 80;
    var bubbles = '';
    for (var i = 0; i < 9; i++) {
      var bx = X0 + 10 + (i * 37) % (W0 - 20), br = 1.6 + (i % 3) * 0.9;
      bubbles += '<circle class="tl-ce-bub" cx="' + bx + '" cy="' + (Y0 + H0 - 14) + '" r="' + br + '" style="animation-delay:' + (i * 0.37).toFixed(2) + 's;animation-duration:' + (2.2 + (i % 4) * 0.45).toFixed(2) + 's"/>';
    }
    var wave = function (cls, amp) {
      var d = 'M-120 0';
      for (var k = -120; k < 240; k += 30) d += ' q7.5 ' + (-amp) + ' 15 0 t15 0';
      return '<path class="' + cls + '" d="' + d + ' V260 H-120 Z"/>';
    };
    box.innerHTML =
      '<div class="tl-ce2-tank"><svg viewBox="0 0 120 240">' +
      '<defs>' +
      '<linearGradient id="' + uid + 'g" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse"><stop class="tl-ce-st" offset="0"/><stop class="tl-ce-sm" offset=".5"/><stop class="tl-ce-sb" offset="1"/></linearGradient>' +
      '<linearGradient id="' + uid + 'glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".18" stop-color="#fff" stop-opacity=".06"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>' +
      '<linearGradient id="' + uid + 'metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#59636e"/><stop offset=".45" stop-color="#c9d2dc"/><stop offset="1" stop-color="#4a535d"/></linearGradient>' +
      '<clipPath id="' + uid + 'c"><rect x="' + X0 + '" y="' + Y0 + '" width="' + W0 + '" height="' + H0 + '" rx="30"/></clipPath>' +
      '</defs>' +
      (pac ?
        '<g class="tl-ce-air">' +
          '<path d="M100 20 q8 -4 16 0" /><path d="M102 32 q8 -4 16 0" /><path d="M100 44 q8 -4 16 0" /></g>' +
        '<rect x="14" y="6" width="92" height="52" rx="14" fill="url(#' + uid + 'metal)" class="tl-ce-unit"/>' +
        '<rect x="20" y="12" width="80" height="40" rx="10" class="tl-ce-unitin"/>' +
        '<g class="tl-ce-grille">' + [0, 1, 2, 3, 4].map(function (k) { return '<line x1="26" x2="40" y1="' + (20 + k * 6) + '" y2="' + (20 + k * 6) + '"/><line x1="80" x2="94" y1="' + (20 + k * 6) + '" y2="' + (20 + k * 6) + '"/>'; }).join('') + '</g>' +
        '<circle cx="60" cy="32" r="16" class="tl-ce-fanring"/>' +
        '<g class="tl-ce-fan" style="transform-origin:60px 32px">' +
          [0, 72, 144, 216, 288].map(function (r) { return '<path transform="rotate(' + r + ' 60 32)" d="M60 32 C58 24 61 18 66 18 C66 24 63 28 60 32Z"/>'; }).join('') +
          '<circle cx="60" cy="32" r="3.2" class="tl-ce-hub"/></g>'
        : '<g class="tl-ce-steam"><path d="M48 24 q-6 -8 0 -14 q6 -6 0 -12"/><path d="M60 26 q-6 -8 0 -14 q6 -6 0 -12"/><path d="M72 24 q-6 -8 0 -14 q6 -6 0 -12"/></g>') +
      '<rect x="' + (X0 - 4) + '" y="' + (Y0 - 4) + '" width="' + (W0 + 8) + '" height="' + (H0 + 8) + '" rx="34" class="tl-ce-case"/>' +
      '<g clip-path="url(#' + uid + 'c)">' +
        '<rect x="' + X0 + '" y="' + Y0 + '" width="' + W0 + '" height="' + H0 + '" class="tl-ce-empty"/>' +
        '<g class="tl-ce-waterg"><g class="tl-ce-wave2">' + wave('tl-ce-wv2', 3) + '</g><g class="tl-ce-wave1">' + wave('tl-ce-wv1', 4) + '</g></g>' +
        '<g class="tl-ce-bubs">' + bubbles + '</g>' +
        '<path class="tl-ce-res" d="M' + (X0 + 14) + ' ' + (Y0 + H0 - 12) + ' l7 -7 l7 7 l7 -7 l7 7 l7 -7 l7 7 l7 -7 l6 6"/>' +
        '<rect x="' + X0 + '" y="' + Y0 + '" width="' + W0 + '" height="' + H0 + '" fill="url(#' + uid + 'glass)"/>' +
      '</g>' +
      '<rect x="' + X0 + '" y="' + Y0 + '" width="' + W0 + '" height="' + H0 + '" rx="30" class="tl-ce-rim"/>' +
      '<rect x="' + (X0 + 8) + '" y="' + (Y0 + 14) + '" width="6" height="' + (H0 - 40) + '" rx="3" class="tl-ce-shine"/>' +
      '<g class="tl-ce2-tag tl-ce2-tagt" transform="translate(60 ' + (Y0 + 26) + ')"><rect x="-27" y="-11" width="54" height="22" rx="11"/><circle cx="-16" cy="0" r="5"/><text x="5" y="5"></text></g>' +
      '<g class="tl-ce2-tag tl-ce2-tagb" transform="translate(60 ' + (Y0 + H0 - 36) + ')"><rect x="-27" y="-11" width="54" height="22" rx="11"/><circle cx="-16" cy="0" r="5"/><text x="5" y="5"></text></g>' +
      '</svg>' +
      '<div class="tl-ce2-pct"></div></div>' +
      '<div class="tl-ce2-side">' +
        '<div class="tl-ce2-chip"><span class="tl-ce2-led"></span><span class="tl-ce2-st"></span></div>' +
        '<div class="tl-ce2-setbox"><div class="tl-ce2-setlab">Consigne</div>' +
          '<div class="tl-ce2-setrow"><button type="button" class="tl-ce2-btn tl-ce2-minus">−</button>' +
          '<div class="tl-ce2-set"><b></b><span>°</span></div>' +
          '<button type="button" class="tl-ce2-btn tl-ce2-plus">+</button></div>' +
          '<div class="tl-ce2-bar"><i></i></div></div>' +
        '<div class="tl-ce2-infos"></div>' +
        '<div class="tl-ce2-acts"></div>' +
      '</div>';
    api.body.appendChild(box);
    var q = function (c) { return box.querySelector(c); };
    var stT = q('.tl-ce-st'), stM = q('.tl-ce-sm'), stB = q('.tl-ce-sb');
    var grad = q('#' + uid + 'g');
    var waterG = q('.tl-ce-waterg'), tagT = q('.tl-ce2-tagt'), tagB = q('.tl-ce2-tagb'), pct = q('.tl-ce2-pct');
    var setB = q('.tl-ce2-set b'), stTxt = q('.tl-ce2-st'), chip = q('.tl-ce2-chip'), bar = q('.tl-ce2-bar i');
    var infos = q('.tl-ce2-infos'), acts = q('.tl-ce2-acts'), fan = q('.tl-ce-fan');
    q('.tl-ce-wv1').setAttribute('fill', 'url(#' + uid + 'g)');
    q('.tl-ce-wv2').setAttribute('fill', 'url(#' + uid + 'g)');
    if (!t.cmdBottom) tagB.style.display = 'none';

    var extra = [];
    for (var j = 1; j <= 6; j++) {
      if (!cleanId(t['cmdX' + j])) continue;
      var row = el('div', 'tl-ce2-info', '<span></span><b></b>');
      row.querySelector('span').textContent = t['lab' + j] || ((p.meta(t['cmdX' + j]) || {}).name) || '';
      infos.appendChild(row);
      extra.push({ id: t['cmdX' + j], b: row.querySelector('b') });
    }
    // consigne
    var step = Math.max(0.1, num(t.ceStep, 1)), pending = null, timer = null, lastSent = null;
    var rng = function () {
      var am = p.meta(t.cmdSet) || {}, im = p.meta(cleanId(t.cmdSetInfo) || cleanId(am.linked)) || {};
      var lo = num(t.ceMin, num(am.minValue, num(im.minValue, 40))), hi = num(t.ceMax, num(am.maxValue, num(im.maxValue, 65)));
      return hi > lo ? [lo, hi] : [40, 65];
    };
    var setpoint = function () {
      if (pending !== null) return pending;
      var v = p.val(t.cmdSetInfo);
      if (!isNum(v) && t.cmdSet) { var m = p.meta(t.cmdSet); if (m && m.linked) v = p.val(m.linked); }
      return isNum(v) ? parseFloat(v) : lastSent;
    };
    var send = function () {
      if (pending === null) return;
      var v = lastSent = pending;
      box.classList.add('tl-ce-sending');
      p.exec(t.cmdSet, { slider: v }).then(function () {
        setTimeout(function () { pending = null; box.classList.remove('tl-ce-sending'); paintNow(); }, 1500);
      }, function (err) { pending = null; box.classList.remove('tl-ce-sending'); paintNow(); UI.toast(err.message, 'error'); });
    };
    var change = function (d) {
      var r = rng(), cur = setpoint();
      if (cur === null) cur = r[0];
      pending = parseFloat(Math.max(r[0], Math.min(r[1], Math.round((cur + d) / step) * step)).toFixed(2));
      paintNow();
      var sb = q('.tl-ce2-set');
      sb.classList.remove('tl-ce2-pop'); void sb.offsetWidth; sb.classList.add('tl-ce2-pop');
      clearTimeout(timer);
      timer = setTimeout(send, 900);
    };
    if (t.cmdSet && !p.opts.edit) {
      q('.tl-ce2-minus').addEventListener('click', function (e) { e.stopPropagation(); change(-step); });
      q('.tl-ce2-plus').addEventListener('click', function (e) { e.stopPropagation(); change(step); });
    } else if (!t.cmdSet) {
      q('.tl-ce2-minus').style.visibility = 'hidden';
      q('.tl-ce2-plus').style.visibility = 'hidden';
      if (!cleanId(t.cmdSetInfo)) q('.tl-ce2-setbox').style.display = 'none';
    }
    // boutons
    var buttons = [];
    if (cleanId(t.cmdBoost)) buttons.push({ label: t.boostLabel || 'Boost', cmd: t.cmdBoost, info: t.cmdBoostInfo, cls: 'tl-ce2-boost' });
    (t.options || []).slice(0, 4).forEach(function (o) { if (o && cleanId(o.cmdAction)) buttons.push({ label: o.label || 'Action', cmd: o.cmdAction }); });
    buttons.forEach(function (bt) {
      var b = el('button', 'tl-ce2-act ' + (bt.cls || ''), '<i>' + ceIcon(bt.label) + '</i><span>' + esc(bt.label) + '</span>');
      b.type = 'button';
      b.title = bt.label;
      bt.el = b;
      if (!p.opts.edit) b.addEventListener('click', function (e) {
        e.stopPropagation();
        b.classList.remove('tl-ce2-tap'); void b.offsetWidth; b.classList.add('tl-ce2-tap');
        p.run(api, bt.cmd, {}, { confirm: t.confirm });
      });
      acts.appendChild(b);
    });
    var f1 = function (v, unit) {
      if (!isSet(v)) return '–';
      return isNum(v) ? String(Math.round(parseFloat(v) * 10) / 10).replace('.', ',') + (unit || '') : esc(String(v));
    };
    var paintNow = function () {
      var top = p.val(t.cmdTop), bot = p.val(t.cmdBottom);
      var hasT = isNum(top), hasB = isNum(bot);
      if (!hasT && hasB) top = bot;
      if (!hasB && hasT) bot = top;
      if (isNum(top)) {
        top = parseFloat(top); bot = parseFloat(bot);
        stT.setAttribute('stop-color', tempColor(top));
        stM.setAttribute('stop-color', tempColor((top + bot) / 2));
        stB.setAttribute('stop-color', tempColor(bot));
        tagT.querySelector('text').textContent = f1(top, '°');
        tagT.querySelector('circle').setAttribute('fill', tempColor(top));
        tagB.querySelector('text').textContent = f1(bot, '°');
        tagB.querySelector('circle').setAttribute('fill', tempColor(bot));
        box.style.setProperty('--ce-hot', tempColor(top));
      }
      // niveau : info % sinon plein
      var lv = p.val(t.cmdLevel), k = isNum(lv) ? Math.max(0, Math.min(100, parseFloat(lv))) / 100 : 0.96;
      waterG.setAttribute('transform', 'translate(0 ' + (Y0 + H0 * (1 - k)).toFixed(1) + ')');
      grad.setAttribute('y1', 0); grad.setAttribute('y2', (H0 * k).toFixed(1));
      pct.textContent = isNum(lv) ? Math.round(parseFloat(lv)) + ' %' : '';
      // consigne
      var sp = setpoint(), r = rng();
      setB.textContent = sp === null ? '–' : String(sp).replace('.', ',');
      setB.style.color = sp === null ? '' : tempColor(sp);
      bar.style.width = sp === null ? '0' : Math.max(4, Math.min(100, (sp - r[0]) / (r[1] - r[0]) * 100)) + '%';
      // états
      var heat = isSet(t.cmdHeat) ? isActive(p.val(t.cmdHeat), t.heatOn) : null;
      var fanV = p.val(t.cmdFan), fanOn = isNum(fanV) ? parseFloat(fanV) > 0 : isActive(fanV) === true;
      var boost = isSet(t.cmdBoostInfo) ? isActive(p.val(t.cmdBoostInfo)) === true : false;
      box.classList.toggle('tl-ce-heating', heat === true || boost);
      box.classList.toggle('tl-ce-fanon', !!fanOn);
      box.classList.toggle('tl-ce-boosting', boost);
      box.classList.toggle('tl-ce-hotwater', isNum(top) && top >= 45);
      if (fan) fan.style.animationDuration = (isNum(fanV) && parseFloat(fanV) > 100 ? Math.max(0.2, 600 / parseFloat(fanV)) : 0.9) + 's';
      var stv = isSet(t.cmdStatus) ? p.val(t.cmdStatus) : undefined, mp = isSet(stv) ? parseMap(t.statusMap)[String(stv)] : undefined;
      var label = boost ? 'Boost' : (isSet(stv) ? (isSet(mp) ? mp : String(stv)) : (heat === true ? (pac && fanOn ? 'Chauffe PAC' : 'Chauffe') : (heat === false ? 'En veille' : '')));
      stTxt.textContent = label;
      chip.style.display = label ? '' : 'none';
      chip.classList.toggle('tl-on', heat === true || boost);
      buttons.forEach(function (bt) { if (bt.info) bt.el.classList.toggle('tl-on', isActive(p.val(bt.info)) === true); });
      extra.forEach(function (x) { var m = p.meta(x.id) || {}; x.b.innerHTML = f1(m.value, m.unite ? ' ' + esc(m.unite) : ''); });
    };
    if (api.w < 1.4) box.classList.add('tl-ce2-narrow');
    return function () { paintNow(); };
  };

  /* ---- Messages / alertes : texte d'une ou plusieurs infos (plugin rapport…) ---- */
  R.messages = function (p, t, api) {
    api.el.classList.add('tl-msg-tile');
    var box = el('div', 'tl-msg');
    listLook(t, box);
    var list = el('div', 'tl-msg-list');
    var okBox = el('div', 'tl-msg-ok', '<span class="tl-msg-okico">' + iconHtml('svg:check-circle') + '</span><span class="tl-msg-oktxt"></span>');
    var count = el('div', 'tl-msg-count');
    box.appendChild(list);
    box.appendChild(okBox);
    api.el.appendChild(count);
    api.body.appendChild(box);
    var pid = String((p.data && p.data.id) || 'x'), dismissed = {};
    var ids = [t.cmdMsg, t.cmdMsg2, t.cmdMsg3].map(cleanId).filter(Boolean);
    return function () {
      var rows = [];
      ids.forEach(function (id) {
        var m = p.meta(id) || {};
        msgLines(m.value, t.okVals, t.sep).forEach(function (l) { rows.push({ l: l, d: parseDate(m.valueDate) }); });
      });
      list.innerHTML = '';
      var shown = 0;
      rows.forEach(function (r) {
        var key = 'tl_msg_' + pid + '_' + (t.id || '') + '_' + hashStr(r.l);
        var gone = dismissed[key];
        if (!gone && t.msgDismiss) { try { gone = !!root.localStorage.getItem(key); } catch (e) { gone = false; } }
        if (gone) return;
        var lvl = msgLevel(r.l), c = isSet(t.msgColor) ? color(t.msgColor) : MSG_COLORS[lvl];
        var row = el('div', 'tl-msg-row tl-msg-' + lvl,
          '<span class="tl-msg-ico">' + iconHtml(isSet(t.icon) ? t.icon : (lvl === 'info' ? 'svg:bulb' : 'svg:alert')) + '</span>' +
          '<span class="tl-msg-txt">' + esc(r.l) + '</span>' +
          (t.msgTime && r.d ? '<span class="tl-msg-time">' + relative(r.d) + '</span>' : '') +
          (t.msgDismiss && !p.opts.edit ? '<span class="tl-msg-x">✕</span>' : ''));
        row.style.setProperty('--tl-ac', c);
        row.style.animationDelay = (shown * 0.06) + 's';
        if (t.msgDismiss && !p.opts.edit) {
          row.classList.add('tl-click');
          row.addEventListener('click', function (e) {
            e.stopPropagation();
            dismissed[key] = true;
            try { root.localStorage.setItem(key, '1'); } catch (er) { /* stockage indisponible */ }
            row.classList.add('tl-msg-out');
            setTimeout(function () { if (row.parentNode) row.parentNode.removeChild(row); upd(); }, 250);
          });
        }
        list.appendChild(row);
        shown++;
      });
      var upd = function () {
        var n = list.children.length;
        count.textContent = n;
        count.style.display = n > 1 ? '' : 'none';
        var okTxt = isSet(t.okText) ? t.okText : 'Tout va bien';
        okBox.style.display = n === 0 && okTxt !== '-' ? '' : 'none';
        okBox.querySelector('.tl-msg-oktxt').textContent = okTxt;
        api.el.classList.toggle('tl-msg-has', n > 0);
        var worst = [].some.call(list.children, function (c) { return c.classList.contains('tl-msg-err'); }) ? 'err' :
          ([].some.call(list.children, function (c) { return c.classList.contains('tl-msg-warn'); }) ? 'warn' : (n ? 'info' : 'ok'));
        api.el.setAttribute('data-level', worst);
      };
      upd();
    };
  };

  /* ---- Carte puissance : valeur, anneau, courbe en fond ---- */
  R.puissance = function (p, t, api) {
    api.el.classList.add('tl-pw-tile');
    var uid = 'pw' + Math.random().toString(36).slice(2, 8);
    var box = el('div', 'tl-pw');
    box.innerHTML =
      '<svg class="tl-pw-chart" viewBox="0 0 100 40" preserveAspectRatio="none"><defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="currentColor" stop-opacity=".45"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="tl-pw-area" fill="url(#' + uid + ')"/><path class="tl-pw-line" vector-effect="non-scaling-stroke"/></svg>' +
      '<div class="tl-pw-head">' + (isSet(t.caption) ? '<div class="tl-pw-cap">' + esc(t.caption) + '</div>' : '') +
      '<div class="tl-pw-val"><span class="tl-pw-ico">' + iconHtml(isSet(t.icon) ? t.icon : 'svg:bolt') + '</span><b class="tl-pw-num"></b><span class="tl-pw-unit"></span></div>' +
      (isSet(t.sub) ? '<div class="tl-pw-sub">' + esc(t.sub) + '</div>' : '') + '</div>' +
      '<div class="tl-pw-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" class="tl-pw-rtrack"/>' +
      '<circle cx="50" cy="50" r="40" class="tl-pw-rfill" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90 50 50)"/></svg>' +
      '<div class="tl-pw-rtxt"><b></b><span></span></div></div>';
    api.body.appendChild(box);
    var q = function (c) { return box.querySelector(c); };
    var num0 = q('.tl-pw-num'), unitEl = q('.tl-pw-unit'), rfill = q('.tl-pw-rfill'), rtxt = q('.tl-pw-rtxt b'), rsub = q('.tl-pw-rtxt span');
    var area = q('.tl-pw-area'), line = q('.tl-pw-line'), chart = q('.tl-pw-chart');
    if (t.pwRing === 'non') q('.tl-pw-ring').style.display = 'none';
    var pts = [], id = cleanId(t.cmdInfo);
    var draw = function () {
      var all = pts.slice(), m = p.meta(id);
      if (m && isNum(m.value)) all.push([Date.now(), parseFloat(m.value)]);
      if (all.length < 2) { area.setAttribute('d', ''); line.setAttribute('d', ''); return; }
      var t0 = all[0][0], t1 = all[all.length - 1][0], lo = Math.min(0, Math.min.apply(null, all.map(function (x) { return x[1]; }))), hi = Math.max.apply(null, all.map(function (x) { return x[1]; }));
      if (hi - lo < 1e-9) hi = lo + 1;
      var X = function (x) { return (x - t0) / Math.max(1, t1 - t0) * 100; }, Y = function (v) { return 40 - (v - lo) / (hi - lo) * 34; };
      var d = all.map(function (q2, i) { return (i ? 'L' : 'M') + X(q2[0]).toFixed(2) + ' ' + Y(q2[1]).toFixed(2); }).join(' ');
      line.setAttribute('d', d);
      area.setAttribute('d', d + ' L100 40 L0 40 Z');
    };
    if (id && t.pwChart !== 'non' && !p.opts.edit) {
      var load = function () { p.history(id, num(t.pwHours, 6), true, 80).then(function (h) { pts = (h.points || []).slice(); draw(); }, function () {}); };
      load();
      p.timers.push(setInterval(function () { if (!document.hidden) load(); }, 600000));
    } else if (p.opts.edit) {
      for (var i = 0; i < 24; i++) pts.push([i * 1000, 40 + 30 * Math.sin(i / 3) + (i % 5) * 6]);
    }
    if (t.pwChart === 'non') chart.style.display = 'none';
    return function () {
      var m = p.meta(id), raw = m ? m.value : undefined;
      var f = fmt(t, m, raw);
      var r = f.invalid ? null : evalRules(rulesFor(t, p.presets), raw);
      var c = r && r.color ? color(r.color) : (isSet(t.color) ? color(t.color) : '');
      box.style.setProperty('--pw-c', c || 'var(--tl-acc, #38bdf8)');
      var newNum = isNum(raw) ? parseFloat(raw) : null;
      if (newNum !== null && api.lastNum !== undefined && api.lastNum !== null && newNum !== api.lastNum && !p.opts.edit) {
        rollNumber(num0, api.lastNum, newNum, isNum(t.decimals) ? parseInt(t.decimals, 10) : 0, f.html);
      } else num0.innerHTML = f.html;
      api.lastNum = newNum;
      unitEl.textContent = f.unit ? ' ' + f.unit : '';
      var mx = num(t.gMax, num(m && m.maxValue, 0)), mn = num(t.gMin, 0);
      var k = mx > mn && isNum(raw) ? Math.max(0, Math.min(1, (parseFloat(raw) - mn) / (mx - mn))) : null;
      rfill.setAttribute('stroke-dasharray', (k === null ? 0 : (k * 100).toFixed(1)) + ' 100');
      rtxt.innerHTML = k === null ? f.html : Math.round(k * 100) + '<small>%</small>';
      rsub.textContent = isSet(t.ringLabel) ? t.ringLabel : (k === null ? (f.unit || '') : 'de ' + mx + (f.unit ? ' ' + f.unit : ''));
      draw();
    };
  };

  /* ---- Soleil : arc lever → coucher, hauteur, lune la nuit ---- */
  var RAD = Math.PI / 180;
  function sunCalc(date, lat, lon) {
    // NOAA (simplifié) : élévation et heures de lever / coucher (‑0,833°)
    var jd = date.getTime() / 86400000 + 2440587.5, n = jd - 2451545.0;
    var L = (280.46 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) % 360;
    var lam = L + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD);
    var eps = 23.439 - 0.0000004 * n;
    var dec = Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD)) / RAD;
    var ra = Math.atan2(Math.cos(eps * RAD) * Math.sin(lam * RAD), Math.cos(lam * RAD)) / RAD;
    var eqt = 4 * (((L - ra) % 360 + 540) % 360 - 180);      // minutes
    var utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    var ha = (utcMin + eqt + 4 * lon) / 4 - 180;
    var el2 = Math.asin(Math.sin(lat * RAD) * Math.sin(dec * RAD) + Math.cos(lat * RAD) * Math.cos(dec * RAD) * Math.cos(ha * RAD)) / RAD;
    var cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(dec * RAD)) / (Math.cos(lat * RAD) * Math.cos(dec * RAD));
    var day0 = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    var noon = 720 - 4 * lon - eqt;
    var res = { elev: el2, noon: new Date(day0 + noon * 60000) };
    if (cosH > -1 && cosH < 1) {
      var H = Math.acos(cosH) / RAD;
      res.rise = new Date(day0 + (noon - 4 * H) * 60000);
      res.set = new Date(day0 + (noon + 4 * H) * 60000);
    }
    var mx = Math.asin(Math.sin(lat * RAD) * Math.sin(dec * RAD) + Math.cos(lat * RAD) * Math.cos(dec * RAD)) / RAD;
    res.max = mx;
    return res;
  }
  function moonPhase(date) {
    var syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14) ;
    var a = ((date.getTime() - ref) / 86400000) % syn;
    return (a < 0 ? a + syn : a) / syn;   // 0 nouvelle, 0,5 pleine
  }
  R.soleil = function (p, t, api) {
    api.el.classList.add('tl-sun-tile');
    var box = el('div', 'tl-sun');
    box.innerHTML = '<svg viewBox="0 0 200 110" class="tl-sun-svg">' +
      '<defs><radialGradient id="tlSunG"><stop offset="0" stop-color="#fff7c2"/><stop offset=".45" stop-color="#ffd23a"/><stop offset="1" stop-color="#ff9d00" stop-opacity="0"/></radialGradient></defs>' +
      '<line x1="8" y1="92" x2="192" y2="92" class="tl-sun-hz"/>' +
      '<path d="M20 92 A80 80 0 0 1 180 92" class="tl-sun-arc"/>' +
      '<path d="" class="tl-sun-done"/>' +
      '<g class="tl-sun-body"><circle r="16" fill="url(#tlSunG)"/><circle r="7.5" class="tl-sun-core"/></g>' +
      '<clipPath id="tlMoonC"><circle r="8"/></clipPath>' +
      '<g class="tl-moon-body"><circle r="8" class="tl-moon-disc"/><circle r="8.4" class="tl-moon-shade" clip-path="url(#tlMoonC)"/></g>' +
      '</svg>' +
      '<div class="tl-sun-mid"><span>Hauteur du soleil</span><b></b></div>' +
      '<div class="tl-sun-rise"><i>' + iconHtml('svg:up') + '</i><b></b><span>Lever</span></div>' +
      '<div class="tl-sun-set"><i>' + iconHtml('svg:down') + '</i><b></b><span>Coucher</span></div>' +
      '<div class="tl-sun-len"></div>';
    api.body.appendChild(box);
    var q = function (c) { return box.querySelector(c); };
    var lat = num(t.lat, num(p.data.lat, 43.6)), lon = num(t.lon, num(p.data.lon, 1.44));
    if (!isNum(t.lat) && !isNum(p.data.lat)) q('.tl-sun-len').textContent = 'Position : configurez la latitude dans Jeedom';
    var hm = function (d) { return d ? pad(d.getHours()) + 'h' + pad(d.getMinutes()) : '–'; };
    var pos = function (k) { var a = Math.PI * (1 - k); return [100 + 80 * Math.cos(a), 92 - 80 * Math.sin(a)]; };
    var draw = function () {
      var now = new Date(), sc = sunCalc(now, lat, lon);
      var elv = isSet(t.cmdElev) && isNum(p.val(t.cmdElev)) ? parseFloat(p.val(t.cmdElev)) : sc.elev;
      var rise = sc.rise, set = sc.set;
      q('.tl-sun-rise b').textContent = hm(rise);
      q('.tl-sun-set b').textContent = hm(set);
      q('.tl-sun-mid b').textContent = (Math.round(elv * 10) / 10).toFixed(1).replace('.', ',') + '°';
      var dayLen = rise && set ? Math.round((set - rise) / 60000) : 0;
      if (isNum(t.lat) || isNum(p.data.lat)) q('.tl-sun-len').textContent = dayLen ? 'Jour ' + Math.floor(dayLen / 60) + 'h' + pad(dayLen % 60) : '';
      var isDay = rise && set && now >= rise && now <= set;
      box.classList.toggle('tl-sun-night', !isDay);
      var sb = q('.tl-sun-body'), mb = q('.tl-moon-body');
      if (isDay) {
        var k = (now - rise) / (set - rise), pt = pos(k);
        sb.setAttribute('transform', 'translate(' + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1) + ')');
        sb.style.display = ''; mb.style.display = 'none';
        var a0 = pos(0), a1 = pt;
        q('.tl-sun-done').setAttribute('d', 'M' + a0[0] + ' ' + a0[1] + ' A80 80 0 0 1 ' + a1[0].toFixed(1) + ' ' + a1[1].toFixed(1));
      } else {
        // nuit : la lune parcourt l'arc du coucher au lever suivant
        var prevSet = set && now > set ? set : new Date((set ? set.getTime() : now.getTime()) - 86400000);
        var nextRise = rise && now < rise ? rise : new Date((rise ? rise.getTime() : now.getTime()) + 86400000);
        var kn = Math.max(0, Math.min(1, (now - prevSet) / Math.max(1, nextRise - prevSet))), pm = pos(kn);
        mb.setAttribute('transform', 'translate(' + pm[0].toFixed(1) + ' ' + pm[1].toFixed(1) + ')');
        mb.style.display = ''; sb.style.display = 'none';
        q('.tl-sun-done').setAttribute('d', '');
        var ph = moonPhase(now), off = 16 * (1 - Math.abs(1 - 2 * ph));
        q('.tl-moon-shade').setAttribute('cx', (ph < 0.5 ? -off : off).toFixed(2));
      }
    };
    draw();
    p.timers.push(setInterval(draw, 60000));
    return function () { draw(); };
  };

  /* ---- Barre de séparation (verticale ou horizontale), placée librement ---- */
  R.separateur = function (p, t, api) {
    var horiz = t.sepDir === 'h';
    api.el.classList.add('tl-sep-tile', horiz ? 'tl-sep-h' : 'tl-sep-v');
    var bar = el('div', 'tl-sepbar tl-sepbar-' + (t.sepStyle || 'degrade'));
    var w = Math.max(1, num(t.sepW, 2)), len = Math.max(5, Math.min(100, num(t.sepLen, 100)));
    if (horiz) { bar.style.height = w + 'px'; bar.style.width = len + '%'; } else { bar.style.width = w + 'px'; bar.style.height = len + '%'; }
    if (isSet(t.sepColor)) bar.style.setProperty('--sep-c', color(t.sepColor));
    if (t.sepGlow) bar.classList.add('tl-sepbar-glow');
    api.body.appendChild(bar);
    return function () {};
  };

  /** Listes (réseau, batteries, messages) : taille en % et lignes réparties sur toute la hauteur. */
  function listLook(t, box) {
    box.style.setProperty('--ls-k', Math.max(0.5, Math.min(4, num(t.lsSize, 100) / 100)));
    box.classList.toggle('tl-ls-fill', t.lsFill === 'remplir');
    var cols = t.lsCols === 'auto' ? 'auto' : Math.max(1, Math.min(6, Math.round(num(t.lsCols, 1))));
    box.classList.toggle('tl-ls-grid', cols === 'auto' || cols > 1);
    box.style.setProperty('--ls-cols', cols === 'auto' ? 'auto-fill' : cols);
  }
  /** Ligne « + N autres » quand le nombre de lignes est limité. */
  function moreRow(list, n) {
    if (n > 0) list.appendChild(el('div', 'tl-ls-more', '+ ' + n + ' autre' + (n > 1 ? 's' : '')));
  }

  /* ---- Batteries : équipements à pile de Jeedom, du plus faible au plus fort ---- */
  R.batteries = function (p, t, api) {
    api.el.classList.add('tl-bat-tile');
    var box = el('div', 'tl-bat');
    listLook(t, box);
    var list = el('div', 'tl-bat-list');
    var empty = el('div', 'tl-msg-ok', '<span class="tl-msg-okico">' + iconHtml('svg:check-circle') + '</span><span></span>');
    var count = el('div', 'tl-msg-count');
    box.appendChild(list);
    box.appendChild(empty);
    api.el.appendChild(count);
    api.body.appendChild(box);
    var demo = [{ name: 'Détecteur cuisine', object: 'Cuisine', level: 8, danger: 20, warning: 30 }, { name: 'Fenêtre salon', object: 'Salon', level: 26, danger: 20, warning: 30 },
      { name: 'Thermomètre chambre', object: 'Chambre', level: 64, danger: 20, warning: 30 }, { name: 'Bouton entrée', object: 'Entrée', level: 92, danger: 20, warning: 30 }];
    var draw = function (rows) {
      var all = t.btMode === 'tous';
      var shown = rows.filter(function (r) { return all || r.level <= r.warning; });
      var max = Math.max(1, Math.round(num(t.btMax, 50)));
      list.innerHTML = '';
      shown.slice(0, max).forEach(function (r, i) {
        var lvl = r.level <= r.danger ? 'err' : (r.level <= r.warning ? 'warn' : 'ok');
        var d = parseDate(r.date), old = d && (Date.now() - d.getTime()) > num(t.btStale, 48) * 3600000;
        var row = el('div', 'tl-bat-row tl-bat-' + lvl,
          '<div class="tl-bat-name"><b></b><span></span></div>' +
          '<div class="tl-bat-cell"><i style="width:' + r.level + '%"></i></div>' +
          '<div class="tl-bat-pct">' + r.level + '<small>%</small></div>');
        row.querySelector('b').textContent = r.name;
        row.querySelector('span').textContent = [r.object, r.type, old ? 'sans nouvelles ' + relative(d).replace('il y a ', 'depuis ') : ''].filter(Boolean).join(' · ');
        if (old) row.classList.add('tl-bat-old');
        row.style.animationDelay = (i * 0.04) + 's';
        list.appendChild(row);
      });
      moreRow(list, shown.length - max);
      var low = rows.filter(function (r) { return r.level <= r.warning; }).length;
      count.textContent = low;
      count.style.display = low ? '' : 'none';
      api.el.setAttribute('data-level', rows.some(function (r) { return r.level <= r.danger; }) ? 'err' : (low ? 'warn' : 'ok'));
      empty.style.display = list.children.length ? 'none' : '';
      empty.querySelector('span:last-child').textContent = rows.length ? (isSet(t.okText) ? t.okText : 'Toutes les piles sont bonnes') : 'Aucun équipement à pile';
    };
    var load = function () { ajax('getBatteries', {}).then(draw, function (err) { list.innerHTML = '<div class="tl-det-msg">' + esc(err.message) + '</div>'; }); };
    if (p.opts.edit) draw(demo); else { load(); p.timers.push(setInterval(function () { if (!document.hidden) load(); }, 900000)); }
    return function () {};
  };

  /* ---- Alarme (Risco) : une partition, ses zones, sans les groupes ---- */
  var SHIELD = '<svg viewBox="0 0 100 100"><path d="M50 6 L86 20 V48 C86 72 70 88 50 95 C30 88 14 72 14 48 V20 Z" fill="currentColor" opacity=".18"/><path d="M50 6 L86 20 V48 C86 72 70 88 50 95 C30 88 14 72 14 48 V20 Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>';
  var SH_IN = {
    off: '<path d="M38 50 V40 a12 12 0 0 1 24 0" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><rect x="34" y="48" width="32" height="24" rx="5" fill="currentColor"/>',
    away: '<path d="M38 48 V38 a12 12 0 0 1 24 0 V48" fill="none" stroke="currentColor" stroke-width="6"/><rect x="34" y="47" width="32" height="25" rx="5" fill="currentColor"/>',
    home: '<path d="M30 54 L50 36 L70 54" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><rect x="37" y="52" width="26" height="20" rx="3" fill="currentColor"/>',
    alarm: '<path d="M50 30 V58" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="70" r="5" fill="currentColor"/>'
  };
  var AL_LABEL = { off: 'Désarmée', away: 'Armée', home: 'Armée partiel', alarm: 'ALARME', unknown: '—' };
  function zoneIn(p, z, part) {
    if (!part) return true;
    var v = String(p.val(z.cmdZParts) || '');
    var nums = v.match(/\d+/g) || [];
    return !nums.length || nums.indexOf(String(part)) >= 0;
  }
  function zoneName(p, z) { var v = p.val(z.cmdZName); return isSet(v) ? String(v) : 'Zone ' + z.n; }

  R.alarme = function (p, t, api) {
    api.el.classList.add('tl-al-tile');
    var box = el('div', 'tl-al');
    box.innerHTML = '<div class="tl-al-shield">' + SHIELD + '<g class="tl-al-in"></g></svg></div>' +
      '<div class="tl-al-state"></div><div class="tl-al-part"></div><div class="tl-al-ready"></div><div class="tl-al-trbl"></div>' +
      '<div class="tl-al-acts"><button type="button" data-a="away"><i>' + SH_IN.away.replace(/currentColor/g, 'currentColor') + '</i>Total</button>' +
      '<button type="button" data-a="home">Partiel</button><button type="button" data-a="off">Désarmer</button></div><div class="tl-al-last"></div>';
    // icônes des boutons (svg dans <i>)
    var bIco = { away: SH_IN.away, home: SH_IN.home, off: SH_IN.off };
    [].forEach.call(box.querySelectorAll('.tl-al-acts button'), function (b) {
      var a = b.getAttribute('data-a');
      b.innerHTML = '<svg viewBox="22 26 56 50">' + bIco[a] + '</svg><span>' + (a === 'away' ? 'Total' : (a === 'home' ? 'Partiel' : 'Désarmer')) + '</span>';
      var cmd = a === 'away' ? t.cmdArmTotal : (a === 'home' ? t.cmdArmPartial : t.cmdDisarm);
      if (!cleanId(cmd)) { b.style.display = 'none'; return; }
      if (p.opts.edit) return;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var label = a === 'away' ? 'Armer en total' : (a === 'home' ? 'Armer en partiel' : 'Désarmer');
        var go = function () { p.run(api, cmd, {}, { infoId: a === 'off' ? (t.cmdArmed || t.cmdState) : (a === 'home' ? (t.cmdPartial || t.cmdArmed) : t.cmdArmed) }); };
        if (t.rsConfirm === 'non') go(); else UI.confirm(label + ' : ' + (p.val(t.cmdPartName) || t.title || 'alarme') + ' ?', go);
      });
    });
    api.body.appendChild(box);
    var q = function (c) { return box.querySelector(c); };
    var zones = (t.rsZones || []).filter(function (z) { return cleanId(z.cmdZName) || cleanId(z.cmdZOpen); });
    var part = Math.max(1, Math.round(num(t.rsPart, 1)));
    var stateOf = function () {
      var al = isActive(p.val(t.cmdAlarm)) === true || isActive(p.val(t.cmdTriggered)) === true;
      if (al) return 'alarm';
      if (isActive(p.val(t.cmdPartial)) === true) return 'home';
      if (isActive(p.val(t.cmdArmed)) === true) return 'away';
      var st = String(p.val(t.cmdState) || '').toLowerCase();
      if (/disarm|desarm|désarm/.test(st)) return 'off';
      if (/trigger|alarm/.test(st)) return 'alarm';
      if (/home|partial|stay|night/.test(st)) return 'home';
      if (/away|armed/.test(st)) return 'away';
      if (/disarm/.test(st) || isSet(p.val(t.cmdArmed))) return 'off';
      return p.opts.edit ? 'off' : 'unknown';
    };
    return function () {
      var st = stateOf();
      box.setAttribute('data-st', st);
      api.el.classList.toggle('tl-al-alarming', st === 'alarm');
      q('.tl-al-in').innerHTML = SH_IN[st] || SH_IN.off;
      q('.tl-al-state').textContent = AL_LABEL[st];
      var pn = p.val(t.cmdPartName);
      q('.tl-al-part').textContent = t.rsName !== 'non' && isSet(pn) && String(pn) !== t.title ? String(pn) : '';
      [].forEach.call(box.querySelectorAll('.tl-al-acts button'), function (b) { b.classList.toggle('tl-on', b.getAttribute('data-a') === st); });
      // prête ? sinon les zones ouvertes de la partition
      var rd = q('.tl-al-ready');
      if (t.rsZonesShow !== 'non' && st === 'off') {
        var open = zones.filter(function (z) { return zoneIn(p, z, part) && isActive(p.val(z.cmdZOpen)) === true && isActive(p.val(z.cmdZBypass)) !== true; });
        var ready = cleanId(t.cmdReady) ? isActive(p.val(t.cmdReady)) !== false : !open.length;
        rd.className = 'tl-al-ready ' + (ready ? 'tl-al-ok' : 'tl-al-ko');
        rd.innerHTML = ready ? (t.rsZonesShow === 'pb' ? '' : '✓ Prête à armer') : 'Pas prête' + (open.length ? ' : ' + open.slice(0, 3).map(function (z) { return esc(zoneName(p, z)); }).join(', ') + (open.length > 3 ? ' +' + (open.length - 3) : '') + ' ouvert' + (open.length > 1 ? 's' : '') : '');
      } else if (st === 'alarm') {
        var al = zones.filter(function (z) { return zoneIn(p, z, part) && isActive(p.val(z.cmdZAlarm)) === true; });
        rd.className = 'tl-al-ready tl-al-ko';
        rd.innerHTML = al.length ? 'Zone : ' + al.map(function (z) { return esc(zoneName(p, z)); }).join(', ') : '';
      } else { rd.className = 'tl-al-ready'; rd.innerHTML = ''; }
      // défauts de la centrale
      var tr = q('.tl-al-trbl'), list = [];
      if (t.rsTroubles !== 'non') {
        if (cleanId(t.cmdConn) && isActive(p.val(t.cmdConn)) === false) list.push('Centrale déconnectée');
        (t.cmdTroubles || []).forEach(function (id) { if (isActive(p.val(id)) === true) { var m = p.meta(id); list.push(m && m.name ? m.name : 'Défaut'); } });
      }
      tr.innerHTML = list.map(function (x) { return '<span>⚠ ' + esc(x) + '</span>'; }).join('');
      // dernier événement
      var ln = p.val(t.cmdLastName), lt = p.val(t.cmdLastTime), lz = p.val(t.cmdLastZone);
      q('.tl-al-last').textContent = t.rsLast === 'non' || !isSet(ln) ? '' : [lt, ln, lz].filter(isSet).join(' · ');
    };
  };

  /** Zones d'alarme : ouvertes, en alarme, bypassées (ou toutes) ; bypasser / débypasser d'un appui. */
  R.zones = function (p, t, api) {
    api.el.classList.add('tl-bat-tile', 'tl-zn-tile');
    var box = el('div', 'tl-bat');
    listLook(t, box);
    var list = el('div', 'tl-bat-list');
    var empty = el('div', 'tl-msg-ok', '<span class="tl-msg-okico">' + iconHtml('svg:check-circle') + '</span><span></span>');
    var count = el('div', 'tl-msg-count');
    box.appendChild(list);
    box.appendChild(empty);
    api.el.appendChild(count);
    api.body.appendChild(box);
    var zones = (t.rsZones || []).filter(function (z) { return cleanId(z.cmdZName) || cleanId(z.cmdZOpen); });
    if (p.opts.edit && !zones.length) zones = [{ n: 1, demo: ['Pir Cuisine', 1, 0, 0] }, { n: 2, demo: ['Fenêtre salon', 1, 0, 0] }, { n: 3, demo: ['Pir Garage', 0, 0, 1] }, { n: 4, demo: ['Incendie RDC', 0, 0, 0] }];
    var part = isNum(t.zsPart) ? Math.round(parseFloat(t.zsPart)) : 0;
    var drawn = false;
    return function () {
      var rows = zones.filter(function (z) { return z.demo || zoneIn(p, z, part); }).map(function (z) {
        var d = z.demo;
        var o = { z: z, name: d ? d[0] : zoneName(p, z), open: d ? !!d[1] : isActive(p.val(z.cmdZOpen)) === true, alarm: d ? !!d[2] : isActive(p.val(z.cmdZAlarm)) === true,
          bypass: d ? !!d[3] : isActive(p.val(z.cmdZBypass)) === true, armed: d ? false : isActive(p.val(z.cmdZArmed)) === true };
        o.rank = o.alarm ? 0 : (o.open ? 1 : (o.bypass ? 2 : 3));
        return o;
      });
      rows.sort(function (a, b) { return (a.rank - b.rank) || (a.z.n - b.z.n); });
      var shown = t.zsMode === 'tous' ? rows : rows.filter(function (r) { return r.rank < 3; });
      list.innerHTML = '';
      shown.forEach(function (r) {
        var cls = r.alarm ? 'tl-bat-err tl-zn-alarm' : (r.open ? 'tl-bat-warn' : (r.bypass ? 'tl-zn-byp' : 'tl-zn-ok'));
        var chips = (r.alarm ? '<span class="tl-dm-chip tl-dm-ko">ALARME</span>' : '') + (r.open ? '<span class="tl-dm-chip tl-zn-c-open">Ouvert</span>' : '') +
          (r.bypass ? '<span class="tl-dm-chip tl-dm-off">Bypassé</span>' : '') + (r.armed ? '<span class="tl-dm-chip tl-zn-c-armed">Armé</span>' : '') +
          (!r.alarm && !r.open && !r.bypass ? '<span class="tl-dm-chip tl-dm-ok">Fermé</span>' : '');
        var row = el('div', 'tl-bat-row tl-zn-row ' + cls, '<span class="tl-zn-n">Z' + r.z.n + '</span><div class="tl-bat-name"><b></b><span class="tl-dm-chips">' + chips + '</span></div><span class="tl-net-dot"></span>');
        row.querySelector('b').textContent = r.name;
        if (!p.opts.edit && (cleanId(r.z.cmdZByp) || cleanId(r.z.cmdZUnbyp))) {
          row.classList.add('tl-click');
          row.addEventListener('click', function (e) {
            e.stopPropagation();
            var btns = [{ label: 'Fermer' }];
            if (r.bypass && cleanId(r.z.cmdZUnbyp)) btns.push({ label: 'Débypasser', primary: true, click: function () { p.run(api, r.z.cmdZUnbyp, {}, { infoId: r.z.cmdZBypass }); } });
            if (!r.bypass && cleanId(r.z.cmdZByp)) btns.push({ label: 'Bypasser', primary: true, click: function () { p.run(api, r.z.cmdZByp, {}, { infoId: r.z.cmdZBypass }); } });
            UI.modal({ title: 'Z' + r.z.n + ' · ' + r.name, body: '<p>' + [r.alarm ? 'En alarme' : '', r.open ? 'Ouverte' : 'Fermée', r.bypass ? 'Bypassée (ignorée à l\'armement)' : '', r.armed ? 'Armée' : ''].filter(Boolean).join(' · ') + '</p>', buttons: btns });
          });
        }
        list.appendChild(row);
      });
      if (!drawn) { drawn = true; } else list.classList.add('tl-noanim');
      var n = rows.filter(function (r) { return r.rank < 2; }).length;
      count.textContent = n;
      count.style.display = n ? '' : 'none';
      api.el.setAttribute('data-level', rows.some(function (r) { return r.alarm; }) ? 'err' : (n ? 'warn' : 'ok'));
      empty.style.display = list.children.length ? 'none' : '';
      empty.querySelector('span:last-child').textContent = zones.length ? (isSet(t.okText) ? t.okText : 'Toutes les zones sont fermées') : 'Choisissez l\'équipement alarme';
    };
  };

  /* ---- VigiEau : niveau de restriction d'eau, arrêté, mesures, verdict arrosage ---- */
  // aucune restriction (blanc) + 4 niveaux officiels VigiEau
  var VG_LEVELS = [['Aucune restriction', '#f5f7fa', '#1f2937'], ['Vigilance', '#22c55e', '#06210f'], ['Alerte', '#facc15', '#2e2500'], ['Alerte renforcée', '#f97316', '#2a1200'], ['Crise', '#ef4444', '#fff']];
  var VG_INFO = [['Aucune restriction en vigueur : tout va bien.', ['Pas de mesure particulière ; les éco-gestes restent bienvenus.']],
    ['Sensibiliser et inciter à la sobriété.', ['Aucune limitation légale : simple invitation aux éco-gestes (ne pas laisser couler l\'eau, arroser aux heures fraîches).']],
    ['Réduire les activités non prioritaires les plus gourmandes.', ['Arrosage des pelouses et espaces verts interdit en journée (en général de 8 h à 20 h).', 'Remplissage des piscines privées interdit.', 'Lavage de voiture à domicile interdit.', 'Horaires de prélèvement réduits pour l\'irrigation agricole.']],
    ['Limiter drastiquement les prélèvements impactant les milieux aquatiques.', ['Arrosage des pelouses, massifs fleuris et espaces verts totalement interdit.', 'Arrosage des potagers fortement limité (tôt le matin ou tard le soir).', 'Lavage des voitures seulement en station professionnelle avec recyclage.']],
    ['Réserver l\'eau aux usages vitaux et prioritaires (santé, salubrité, sécurité civile, eau potable).', ['Arrosage totalement interdit (potagers compris le plus souvent, ou restrictions de nuit selon l\'arrêté).', 'Remplissage et mise à niveau des piscines privées interdits.', 'Lavage des véhicules interdit, même en station.', 'Prélèvements agricoles interdits (sauf dérogations).']]];
  function vgLevel(num0, txt) {
    var t0 = normTxt(txt), n0 = normTxt(num0);
    var fromTxt = function (x) {
      if (!x) return null;
      if (/crise/.test(x)) return 4;
      if (/renforc/.test(x)) return 3;
      if (/alerte/.test(x)) return 2;
      if (/vigilance/.test(x)) return 1;
      if (/pas de restriction|aucun|sans|normal|^0$/.test(x)) return 0;
      return null;
    };
    if (isNum(num0)) return Math.max(0, Math.min(4, Math.round(parseFloat(num0))));
    var a = fromTxt(n0);
    if (a !== null) return a;
    return fromTxt(t0);
  }
  function normTxt(v) { return isSet(v) ? String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() : ''; }
  function vgDate(v) {
    if (!isSet(v)) return null;
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v));
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    return parseDate(v);
  }
  R.vigieau = function (p, t, api) {
    api.el.classList.add('tl-vg-tile');
    var compact = t.vgStyle === 'compact';
    var box = el('div', 'tl-vg' + (compact ? ' tl-vg-compact' : ''));
    box.innerHTML = '<div class="tl-vg-top"><span class="tl-vg-drop"><svg viewBox="0 0 24 24"><path d="M12 2.5C12 2.5 5 10.2 5 14.8a7 7 0 0 0 14 0C19 10.2 12 2.5 12 2.5z" fill="currentColor"/></svg></span><span class="tl-vg-where"></span></div>' +
      '<div class="tl-vg-badge"></div><div class="tl-vg-bar">' + VG_LEVELS.map(function (l, i) { return '<i data-l="' + i + '" style="--c:' + l[1] + '" title="' + l[0] + '"></i>'; }).join('') + '</div>' +
      '<div class="tl-vg-zone"></div><div class="tl-vg-dates"></div><div class="tl-vg-arr"></div><div class="tl-vg-mes"></div><div class="tl-vg-info"></div><div class="tl-vg-imp"></div>';
    api.body.appendChild(box);
    var q = function (c) { return box.querySelector(c); };
    var v = function (k) { var x = p.val(t[k]); return isSet(x) ? String(x) : ''; };
    var dmy = function (d) { return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); };
    return function () {
      var lv = p.opts.edit && !cleanId(t.cmdLevel) && !cleanId(t.cmdLevelTxt) ? 3 : vgLevel(p.val(t.cmdLevel), p.val(t.cmdLevelTxt));
      var L = lv === null ? null : VG_LEVELS[lv];
      box.setAttribute('data-level', lv === null ? 'x' : lv);
      box.style.setProperty('--vg', L ? L[1] : '#666');
      box.style.setProperty('--vg-fg', L ? L[2] : '#fff');
      var label = v('cmdLevelTxt') && !isNum(v('cmdLevelTxt')) ? v('cmdLevelTxt') : (L ? L[0] : 'Inconnu');
      q('.tl-vg-badge').textContent = label;
      [].forEach.call(box.querySelectorAll('.tl-vg-bar i'), function (b) { b.classList.toggle('tl-on', lv !== null && +b.getAttribute('data-l') === lv); });
      q('.tl-vg-where').textContent = [v('cmdCommune') || (p.opts.edit ? 'Flourens (31)' : ''), v('cmdUsage')].filter(Boolean).join(' · ');
      if (compact) return;
      q('.tl-vg-zone').textContent = v('cmdZone') || (p.opts.edit ? 'Zone de gestion Garonne aval' : '');
      var d1 = vgDate(p.val(t.cmdStart)), d2 = vgDate(p.val(t.cmdEnd)), left = d2 ? Math.ceil((d2.getTime() + 86400000 - Date.now()) / 86400000) : null;
      q('.tl-vg-dates').innerHTML = d1 || d2 ? (d1 ? 'du <b>' + dmy(d1) + '</b> ' : '') + (d2 ? 'au <b>' + dmy(d2) + '</b>' + (left !== null && left >= 0 ? ' · encore ' + left + ' j' : '') : '') : '';
      q('.tl-vg-arr').textContent = [v('cmdArrete') ? 'Arrêté n° ' + v('cmdArrete').replace(/^n°\s*/i, '') : '', v('cmdCadre') ? 'cadre n° ' + v('cmdCadre').replace(/^n°\s*/i, '') : ''].filter(Boolean).join(' · ');
      var mes = v('cmdMesures');
      var mq = q('.tl-vg-mes');
      mq.innerHTML = mes && !/aucune information/i.test(mes) ? '<b>Mesures</b>' + esc(mes).replace(/\n/g, '<br>') : '';
      // rappel du niveau (texte officiel général) : objectif et exemples, l'arrêté local fait foi
      var inf = q('.tl-vg-info'), I = lv !== null ? VG_INFO[lv] : null;
      inf.innerHTML = t.vgInfo !== 'non' && I ? '<b>Ce que prévoit ce niveau</b><span class="tl-vg-obj">' + esc(I[0]) + '</span><ul>' + I[1].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><small>Exemples nationaux : l\'arrêté préfectoral fait foi.</small>' : '';
      var imp = parseDate(p.val(t.cmdImport)) || vgDate(p.val(t.cmdImport));
      q('.tl-vg-imp').textContent = imp ? 'Données VigiEau ' + relative(imp) : (v('cmdImport') ? 'Import : ' + v('cmdImport') : '');
    };
  };

  /* ---- Démons et dépendances des plugins ---- */
  function dmProblem(r) {
    var dErr = r.hasDaemon && r.daemon !== 'ok' && r.auto !== 0;          // démon en gestion auto mais arrêté
    var depErr = r.hasDep && r.dep !== 'ok' && r.dep !== 'in_progress';
    return dErr || depErr;
  }
  R.demons = function (p, t, api) {
    api.el.classList.add('tl-bat-tile', 'tl-dm-tile');
    var box = el('div', 'tl-bat');
    listLook(t, box);
    var list = el('div', 'tl-bat-list');
    var empty = el('div', 'tl-msg-ok', '<span class="tl-msg-okico">' + iconHtml('svg:check-circle') + '</span><span></span>');
    var count = el('div', 'tl-msg-count');
    box.appendChild(list);
    box.appendChild(empty);
    api.el.appendChild(count);
    api.body.appendChild(box);
    var rows = [], timer = null;
    var chip = function (label, st, extra) {
      var cls = st === 'ok' ? 'ok' : (st === 'in_progress' ? 'run' : (st === 'off' ? 'off' : 'ko'));
      return '<span class="tl-dm-chip tl-dm-' + cls + '">' + label + (extra ? ' ' + esc(extra) : '') + '</span>';
    };
    var draw = function () {
      var shown = t.dmMode === 'tous' ? rows.slice() : rows.filter(dmProblem);
      shown.sort(function (a, b) { return (dmProblem(b) - dmProblem(a)) || String(a.name).localeCompare(String(b.name)); });
      list.innerHTML = '';
      shown.forEach(function (r, i) {
        var bad = dmProblem(r);
        var chips = '';
        if (r.hasDep) chips += chip('Dépendances', r.dep, r.dep === 'in_progress' ? (r.depProgress ? r.depProgress + '%' : '…') : (r.dep === 'ok' ? 'OK' : 'NOK'));
        if (r.hasDaemon) chips += chip('Démon', r.auto === 0 && r.daemon !== 'ok' ? 'off' : r.daemon, r.daemon === 'ok' ? 'OK' : (r.auto === 0 ? 'arrêté (manuel)' : 'NOK')) + (r.auto === 0 ? '<span class="tl-dm-chip tl-dm-off">auto off</span>' : '');
        var row = el('div', 'tl-bat-row tl-dm-row ' + (bad ? 'tl-bat-err' : 'tl-dm-okrow'),
          '<img class="tl-dm-ico" alt="">' + '<div class="tl-bat-name"><b></b><span class="tl-dm-chips">' + chips + '</span></div><span class="tl-net-dot"></span>');
        row.querySelector('img').src = r.icon || '';
        row.querySelector('b').textContent = r.name;
        if (r.launchable === 'nok' && r.launchMsg) row.title = r.launchMsg;
        row.style.animationDelay = (i * 0.04) + 's';
        if (!p.opts.edit) {
          row.classList.add('tl-click');
          row.addEventListener('click', function (e) { e.stopPropagation(); menu(r); });
        }
        list.appendChild(row);
      });
      setTimeout(function () { list.classList.add('tl-noanim'); }, 800);
      var n = rows.filter(dmProblem).length;
      count.textContent = n;
      count.style.display = n ? '' : 'none';
      api.el.setAttribute('data-level', n ? 'err' : 'ok');
      empty.style.display = list.children.length ? 'none' : '';
      empty.querySelector('span:last-child').textContent = rows.length ? (isSet(t.okText) ? t.okText : 'Démons et dépendances OK') : 'Aucun plugin avec démon';
    };
    var act = function (r, what, label) {
      ajax('daemonAction', { plugin: r.id, 'do': what }).then(function () {
        UI.toast(label + ' : ' + r.name);
        setTimeout(load, what === 'dep' ? 3000 : 4000);
        if (what === 'dep') { clearInterval(timer); timer = setInterval(function () { if (!document.hidden) load(); }, 10000); p.timers.push(timer); }
      }, function (err) { UI.toast(err.message, 'error'); });
    };
    var menu = function (r) {
      var lines = [];
      if (r.hasDep) lines.push('Dépendances : <b>' + (r.dep === 'ok' ? 'OK' : (r.dep === 'in_progress' ? 'installation en cours' + (r.depProgress ? ' (' + esc(r.depProgress) + ' %)' : '') : 'à installer')) + '</b>');
      if (r.hasDaemon) lines.push('Démon : <b>' + (r.daemon === 'ok' ? 'en marche' : 'arrêté') + '</b> · gestion automatique ' + (r.auto === 0 ? 'désactivée' : 'activée'));
      if (r.launchable === 'nok' && r.launchMsg) lines.push('<span class="tl-dm-warn">' + esc(r.launchMsg) + '</span>');
      var btns = [{ label: 'Fermer' }, { label: 'Logs', click: function () { setTimeout(function () { logView(r); }, 0); } }];
      if (r.hasDep && r.dep !== 'in_progress') btns.push({ label: 'Relancer les dépendances', click: function () { act(r, 'dep', 'Installation des dépendances lancée'); } });
      if (r.hasDaemon) {
        btns.push({ label: r.auto === 0 ? 'Gestion auto : activer' : 'Gestion auto : couper', click: function () { act(r, r.auto === 0 ? 'autoOn' : 'autoOff', 'Gestion automatique ' + (r.auto === 0 ? 'activée' : 'désactivée')); } });
        if (r.daemon === 'ok') btns.push({ label: 'Arrêter', danger: true, click: function () { act(r, 'stop', 'Démon arrêté'); } });
        btns.push({ label: r.daemon === 'ok' ? 'Redémarrer' : 'Démarrer', primary: true, click: function () { act(r, r.daemon === 'ok' ? 'restart' : 'start', r.daemon === 'ok' ? 'Démon redémarré' : 'Démon démarré'); } });
      }
      UI.modal({ title: r.name, body: '<div class="tl-dm-info">' + lines.map(function (l) { return '<p>' + l + '</p>'; }).join('') + '</div>', buttons: btns });
    };
    /** Fenêtre de logs dans la tuile (log du plugin / du démon), rafraîchie toutes les 3 s. */
    var logView = function (r) {
      var names = [r.id].concat(r.hasDaemon ? [r.id + '_daemon', r.id + 'd'] : []);
      var body = el('div', 'tl-log');
      var bar = el('div', 'tl-log-bar');
      var pre = el('div', 'tl-log-pre');
      body.appendChild(bar);
      body.appendChild(pre);
      var cur = names[0], auto = true, stick = true, tm = null, filt = '';
      var tabs = {};
      names.forEach(function (n) {
        var b = el('button', 'tl-log-tab', esc(n));
        b.type = 'button';
        b.addEventListener('click', function () { cur = n; stick = true; paintTabs(); fetch(); });
        tabs[n] = b;
        bar.appendChild(b);
      });
      var lv = el('select', 'tl-log-lv', '<option value="">Tout</option><option value="warn">Avertissements et erreurs</option><option value="error">Erreurs</option>');
      lv.addEventListener('change', function () { filt = lv.value; fetch(); });
      var ab = el('button', 'tl-log-tab tl-on', '⟳ Auto');
      ab.type = 'button';
      ab.addEventListener('click', function () { auto = !auto; ab.classList.toggle('tl-on', auto); });
      bar.appendChild(lv);
      bar.appendChild(ab);
      var paintTabs = function () { Object.keys(tabs).forEach(function (n) { tabs[n].classList.toggle('tl-on', n === cur); }); };
      pre.addEventListener('scroll', function () { stick = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 20; });
      var fetch = function () {
        ajax('logTail', { log: cur, lines: 300 }).then(function (res) {
          if (!res.exists) {
            // le log du démon peut porter un autre nom : on retire l'onglet absent
            if (cur !== names[0] && tabs[cur]) { tabs[cur].remove(); delete tabs[cur]; cur = names[0]; paintTabs(); return fetch(); }
            pre.innerHTML = '<div class="tl-log-empty">Log vide ou absent</div>'; return;
          }
          var html = res.lines.filter(function (l) {
            if (filt === 'error') return /\[(ERROR|CRITICAL|EMERGENCY|ALERT)\]/i.test(l);
            if (filt === 'warn') return /\[(ERROR|CRITICAL|EMERGENCY|ALERT|WARNING)\]/i.test(l);
            return true;
          }).map(function (l) {
            var c = /\[(ERROR|CRITICAL|EMERGENCY|ALERT)\]/i.test(l) ? 'e' : (/\[WARNING\]/i.test(l) ? 'w' : (/\[DEBUG\]/i.test(l) ? 'd' : ''));
            return '<div class="tl-log-l' + (c ? ' tl-log-' + c : '') + '">' + esc(l) + '</div>';
          }).join('');
          pre.innerHTML = html || '<div class="tl-log-empty">Aucune ligne</div>';
          if (stick) pre.scrollTop = pre.scrollHeight;
        }, function (err) { pre.innerHTML = '<div class="tl-log-empty">' + esc(err.message) + '</div>'; });
      };
      paintTabs();
      fetch();
      // onglets des logs de démon : on ne garde que ceux qui existent
      names.slice(1).forEach(function (n) {
        ajax('logTail', { log: n, lines: 20 }).then(function (res) { if (!res.exists && tabs[n]) { tabs[n].remove(); delete tabs[n]; } }, function () {});
      });
      tm = setInterval(function () { if (!document.body.contains(body)) { clearInterval(tm); return; } if (auto && !document.hidden) fetch(); }, 3000);
      UI.modal({ title: 'Logs · ' + r.name, body: body, wide: true, buttons: [{ label: 'Fermer', click: function () { clearInterval(tm); } }] });
    };
    var load = function () {
      ajax('getDaemons', {}).then(function (r) {
        rows = r || [];
        draw();
        // tant qu'une installation de dépendances tourne, on suit sa progression
        if (!rows.some(function (x) { return x.dep === 'in_progress'; }) && timer) { clearInterval(timer); timer = null; }
      }, function (err) { list.innerHTML = '<div class="tl-det-msg">' + esc(err.message) + '</div>'; });
    };
    if (p.opts.edit) {
      rows = [{ id: 'roborock', name: 'Roborock', hasDaemon: true, hasDep: true, daemon: 'nok', auto: 1, dep: 'ok' },
        { id: 'jMQTT', name: 'jMQTT', hasDaemon: true, hasDep: true, daemon: 'ok', auto: 1, dep: 'ok' },
        { id: 'victron', name: 'Victron GX', hasDaemon: true, hasDep: true, daemon: 'nok', auto: 1, dep: 'nok' },
        { id: 'networks', name: 'Network', hasDaemon: false, hasDep: true, dep: 'in_progress', depProgress: '45' }];
      draw();
    } else { load(); p.timers.push(setInterval(function () { if (!document.hidden) load(); }, num(t.dmEvery, 60) * 1000)); }
    return function () {};
  };

  /* ---- Réseau : équipements du plugin Network (ping), hors ligne en premier ---- */
  R.reseau = function (p, t, api) {
    api.el.classList.add('tl-bat-tile', 'tl-net-tile');
    var box = el('div', 'tl-bat');
    listLook(t, box);
    var list = el('div', 'tl-bat-list');
    var empty = el('div', 'tl-msg-ok', '<span class="tl-msg-okico">' + iconHtml('svg:check-circle') + '</span><span></span>');
    var count = el('div', 'tl-msg-count');
    box.appendChild(list);
    box.appendChild(empty);
    api.el.appendChild(count);
    api.body.appendChild(box);
    var items = [];
    var since = function (d) { return d ? relative(d).replace('il y a ', 'depuis ') : ''; };
    var draw = function () {
      // l'état peut avoir changé en direct (commande « Statut » suivie par le core)
      items.forEach(function (r) { var v = p.val(r.statusId); if (v !== undefined) r.status = v; var m = p.meta(r.statusId); if (m && m.valueDate) r.since = m.valueDate; if (r.latencyId && p.val(r.latencyId) !== undefined) r.latency = p.val(r.latencyId); });
      var rows = items.map(function (r) { return Object.assign({ on: isActive(r.status) === true }, r); });
      rows.sort(function (a, b) { return (a.on - b.on) || String(a.name).localeCompare(String(b.name)); });
      var shown = t.ntMode === 'tous' ? rows : rows.filter(function (r) { return !r.on; });
      list.innerHTML = '';
      var maxN = Math.max(1, Math.round(num(t.ntMax, 50)));
      shown.slice(0, maxN).forEach(function (r, i) {
        var d = parseDate(r.since);
        var row = el('div', 'tl-bat-row tl-net-row ' + (r.on ? 'tl-net-on' : 'tl-bat-err'),
          '<div class="tl-bat-name"><b></b><span></span></div><span class="tl-net-dot"></span>' +
          '<div class="tl-bat-pct tl-net-lat"></div>');
        row.querySelector('b').textContent = r.name;
        row.querySelector('span').textContent = [r.object, t.ntIp === 'non' ? '' : r.ip, !r.on ? 'hors ligne ' + since(d) : ''].filter(Boolean).join(' · ');
        var lat = isNum(r.latency) && r.on ? Math.round(parseFloat(r.latency)) : null;
        row.querySelector('.tl-net-lat').innerHTML = r.on ? (lat !== null && t.ntLat !== 'non' ? lat + '<small>ms</small>' : 'OK') : 'HS';
        if (r.on && lat !== null && lat >= num(t.ntSlow, 100)) row.classList.add('tl-net-slow');
        row.style.animationDelay = (i * 0.04) + 's';
        if (!p.opts.edit && (r.refreshId || r.wolId)) {
          row.classList.add('tl-click');
          row.addEventListener('click', function (e) {
            e.stopPropagation();
            var btns = [{ label: 'Fermer' }];
            if (r.refreshId) btns.push({ label: 'Ping maintenant', click: function () { p.exec(r.refreshId).then(function () { UI.toast('Ping de ' + r.name + ' lancé'); load(); }, function (er) { UI.toast(er.message, 'error'); }); } });
            if (r.wolId) btns.push({ label: 'Réveiller (WOL)', primary: true, click: function () { p.exec(r.wolId).then(function () { UI.toast('Réveil de ' + r.name + ' envoyé'); }, function (er) { UI.toast(er.message, 'error'); }); } });
            UI.modal({ title: r.name, body: '<p>' + esc([r.object, r.ip].filter(Boolean).join(' · ')) + '</p><p><b>' + (r.on ? 'En ligne' + (lat !== null ? ' · ' + lat + ' ms' : '') : 'Hors ligne ' + esc(since(d))) + '</b></p>', buttons: btns });
          });
        }
        list.appendChild(row);
      });
      moreRow(list, shown.length - maxN);
      // l'animation d'arrivée seulement au premier affichage (pas à chaque mise à jour en direct)
      setTimeout(function () { list.classList.add('tl-noanim'); }, 800);
      var off = rows.filter(function (r) { return !r.on; }).length;
      count.textContent = off;
      count.style.display = off ? '' : 'none';
      api.el.setAttribute('data-level', off ? 'err' : 'ok');
      empty.style.display = list.children.length ? 'none' : '';
      empty.querySelector('span:last-child').textContent = rows.length ? (isSet(t.okText) ? t.okText : 'Tout est en ligne') : 'Aucun équipement Network';
    };
    var load = function () {
      ajax('getNetworks', {}).then(function (r) {
        if (r && r.installed === false) { list.innerHTML = '<div class="tl-det-msg">Plugin Network non installé</div>'; return; }
        items = (r && r.items) || [];
        // suivi en direct de l'état et de la latence
        items.forEach(function (it) {
          [[it.statusId, it.status, it.since], [it.latencyId, it.latency, '']].forEach(function (x) {
            var id = cleanId(x[0]);
            if (!id) return;
            if (!p.cmds[id]) p.cmds[id] = { id: id, value: x[1], valueDate: x[2] };
            p.depend(api, id);
          });
        });
        draw();
      }, function (err) { list.innerHTML = '<div class="tl-det-msg">' + esc(err.message) + '</div>'; });
    };
    if (p.opts.edit) {
      items = [{ name: 'Box internet', object: 'Salon', ip: '192.168.1.1', status: 1, latency: 3 }, { name: 'Caméra portail', object: 'Extérieur', ip: '192.168.1.60', status: 0, since: new Date(Date.now() - 2 * 3600000) },
        { name: 'NAS', object: 'Bureau', ip: '192.168.1.20', status: 1, latency: 1 }, { name: 'Imprimante 3D', object: 'Garage', ip: '192.168.1.45', status: 1, latency: 140 }];
      draw();
    } else { load(); p.timers.push(setInterval(function () { if (!document.hidden) load(); }, 300000)); }
    return function () { if (items.length) draw(); };
  };

  /* ---- Réveil (plugin Réveil ou tout réveil) : prochain réveil, compte à rebours, marche / arrêt, snooze / stop ---- */
  var JOURS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  function parseWake(v) {
    if (!isSet(v)) return null;
    var str = String(v).trim();
    var m = /^(\d{1,2})[:h](\d{2})$/.exec(str);
    if (m) {
      // heure seule : prochaine occurrence
      var d = new Date(); d.setSeconds(0, 0); d.setHours(+m[1], +m[2]);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      return d;
    }
    if (/^\d{3,4}$/.test(str)) { var hh = Math.floor(+str / 100), mm = +str % 100; return parseWake(hh + ':' + pad(mm)); }
    var f = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/.exec(str);
    if (f) return new Date(+f[3], +f[2] - 1, +f[1], +f[4], +f[5]);
    return parseDate(str);
  }
  /* ---- Plugin Réveils (Alexa + Rémi) : prochain réveil, état de synchro, heure / pas de réveil / resynchroniser ---- */
  function rvLevel(st, ok) {
    var s2 = String(st || '').toLowerCase();
    if (/échec|echec|écart|ecart|erreur/.test(s2)) return 'err';
    if (/dérogation|derogation/.test(s2)) return 'manual';
    if (/attente|programmé|programme/.test(s2)) return 'wait';
    if (/^ok/.test(s2) || ok === true) return 'ok';
    if (ok === false) return 'wait';
    return s2 ? 'wait' : 'none';
  }
  var RV_LABEL = { ok: 'Synchro OK', wait: 'Vérification en attente', manual: 'Dérogation manuelle', err: 'Écart', none: '' };
  function rvDay(d) {
    var now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var dd = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today) / 86400000);
    return dd === 0 ? 'Aujourd\'hui' : (dd === 1 ? 'Demain' : (dd > 1 && dd < 7 ? JOURS[d.getDay()] + ' ' + d.getDate() : pad(d.getDate()) + '/' + pad(d.getMonth() + 1)));
  }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  /** Fenêtre : changer l'heure du prochain réveil, pas de réveil, revenir au planning, resynchroniser. */
  function rvEdit(p, api, it) {
    if (p.opts.edit) return;
    var d = parseWake(p.val(it.cmdNext));
    var body = el('div', 'tl-rv-edit');
    body.innerHTML = '<div class="tl-rv-edit-day"></div><input type="time" class="tl-rv-edit-time"><div class="tl-rv-edit-hint"></div>';
    body.querySelector('.tl-rv-edit-day').textContent = d ? rvDay(d) + ' · réveil prévu ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : 'Aucun réveil prévu';
    var inp = body.querySelector('input');
    inp.value = d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : '07:00';
    body.querySelector('.tl-rv-edit-hint').textContent = d ? 'S\'applique seulement à ce réveil (exception) ; le planning reprend ensuite.' : '';
    var exc = function (msg) { return p.exec(it.cmdException, { title: ymd(d), message: msg }); };
    var done = function (txt) { UI.toast(txt); };
    var btns = [{ label: 'Fermer' }];
    if (d && cleanId(it.cmdSkip)) btns.push({ label: 'Pas de réveil', danger: true, click: function () { p.exec(it.cmdSkip).then(function () { done('Réveil du ' + rvDay(d).toLowerCase() + ' supprimé'); }, function (e) { UI.toast(e.message, 'error'); }); } });
    if (d && cleanId(it.cmdException)) btns.push({ label: 'Revenir au planning', click: function () { exc('').then(function () { done('Planning rétabli'); }, function (e) { UI.toast(e.message, 'error'); }); } });
    if (cleanId(it.cmdVerify)) btns.push({ label: 'Vérifier', click: function () { p.exec(it.cmdVerify).then(function () { done('Vérification lancée'); }, function (e) { UI.toast(e.message, 'error'); }); } });
    if (cleanId(it.cmdResync)) btns.push({ label: 'Resynchroniser', click: function () { p.exec(it.cmdResync).then(function () { done('Resynchronisation lancée'); }, function (e) { UI.toast(e.message, 'error'); }); } });
    if (d && cleanId(it.cmdException)) btns.push({ label: 'Changer l\'heure', primary: true, click: function () {
      if (!/^\d{2}:\d{2}$/.test(inp.value)) return false;
      exc(inp.value).then(function () { done('Réveil réglé à ' + inp.value); }, function (e) { UI.toast(e.message, 'error'); });
    } });
    UI.modal({ title: it.name || 'Réveil', body: body, buttons: btns });
  }

  R.reveil = function (p, t, api) {
    api.el.classList.add('tl-rv-tile');
    var box = el('div', 'tl-rv' + (t.rvCompact ? ' tl-rv-compact' : ''));
    box.innerHTML =
      '<div class="tl-rv-top"><span class="tl-rv-ico">' + iconHtml('svg:clock') + '</span><span class="tl-rv-day"></span><span class="tl-rv-dot" title=""></span></div>' +
      '<div class="tl-rv-time"><b></b></div>' +
      '<div class="tl-rv-left"></div>' +
      '<div class="tl-rv-devs"></div>' +
      '<div class="tl-rv-sync"></div>';
    api.body.appendChild(box);
    var q = function (c) { return box.querySelector(c); };
    var it = { name: t.title, cmdNext: t.cmdNext, cmdException: t.cmdException, cmdSkip: t.cmdSkip, cmdResync: t.cmdResync, cmdVerify: t.cmdVerify };
    if (!p.opts.edit && (cleanId(t.cmdException) || cleanId(t.cmdSkip) || cleanId(t.cmdResync) || cleanId(t.cmdVerify))) p.press(api.el, function () { rvEdit(p, api, it); });
    var devs = [['Alexa', t.cmdAlexaOk, 'alexa'], ['Rémi', t.cmdRemiOk, 'remi']].filter(function (x) { return cleanId(x[1]) && (!t.rvDevice || t.rvDevice === x[2]); });
    var paintNow = function () {
      var raw = p.val(t.cmdNext), d = parseWake(raw);
      if (p.opts.edit && !d) { d = new Date(); d.setDate(d.getDate() + 1); d.setHours(6, 45, 0, 0); }
      var st = p.val(t.cmdStatus), ok = cleanId(t.cmdSyncOk) ? isActive(p.val(t.cmdSyncOk)) : null;
      var lvl = rvLevel(st, ok);
      box.setAttribute('data-sync', lvl);
      var dot = q('.tl-rv-dot');
      dot.title = isSet(st) ? String(st) : RV_LABEL[lvl];
      dot.style.display = lvl === 'none' ? 'none' : '';
      q('.tl-rv-time b').textContent = d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : '--:--';
      q('.tl-rv-day').textContent = d ? rvDay(d) : 'Aucun réveil';
      box.classList.toggle('tl-rv-off', !d);
      var mins = d ? Math.round((d.getTime() - Date.now()) / 60000) : 0;
      var lc = parseDate(p.val(t.cmdLastCheck));
      q('.tl-rv-left').textContent = [d && mins > 0 ? 'dans ' + (mins >= 60 ? Math.floor(mins / 60) + ' h ' + pad(mins % 60) : mins + ' min') : '', lc ? 'vérifié ' + relative(lc) : ''].filter(Boolean).join(' · ');
      q('.tl-rv-devs').innerHTML = devs.map(function (x) {
        var v = isActive(p.val(x[1]));
        return '<span class="tl-rv-dev tl-rv-dev-' + (v === true ? 'ok' : (v === false ? 'ko' : 'na')) + '">' + (v === true ? '✓ ' : (v === false ? '✗ ' : '')) + x[0] + '</span>';
      }).join('');
      // détail du statut (une ligne par appareil), seulement s'il y a un souci
      var sync = q('.tl-rv-sync');
      if (!t.rvCompact && isSet(st) && lvl !== 'ok') {
        var txt = String(st).replace(/^[^:]{0,40}:\s*/, '');
        var dvRe = t.rvDevice === 'alexa' ? /alexa/i : (t.rvDevice === 'remi' ? /r[ée]mi/i : null);
        sync.innerHTML = '<b>' + esc(RV_LABEL[lvl]) + '</b>' + txt.split(/\s*\|\s*|\n/).filter(Boolean).filter(function (l) { return !dvRe || dvRe.test(l) || !/alexa|r[ée]mi/i.test(l); }).slice(0, 3).map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('');
        sync.style.display = '';
      } else sync.style.display = 'none';
    };
    p.timers.push(setInterval(paintNow, 30000));
    return function () { paintNow(); };
  };

  /** Liste de plusieurs réveils (une ligne par équipement Réveils). */
  R.reveils = function (p, t, api) {
    api.el.classList.add('tl-rvl-tile');
    var list = el('div', 'tl-rvl');
    api.body.appendChild(list);
    var items = (t.rvItems || []).filter(function (x) { return x && cleanId(x.cmdNext); });
    if (p.opts.edit && !items.length) items = [{ name: 'Moi', demo: '06:45' }, { name: 'Armand', demo: '07:15' }];
    var rows = items.map(function (x) {
      var row = el('div', 'tl-rvl-row', '<span class="tl-rvl-dot"></span><span class="tl-rvl-name"></span><span class="tl-rvl-day"></span><b class="tl-rvl-time"></b>');
      row.querySelector('.tl-rvl-name').textContent = x.name || '';
      list.appendChild(row);
      if (!p.opts.edit && (cleanId(x.cmdException) || cleanId(x.cmdSkip) || cleanId(x.cmdResync) || cleanId(x.cmdVerify))) {
        row.classList.add('tl-click');
        row.addEventListener('click', function (e) { e.stopPropagation(); rvEdit(p, api, x); });
      }
      return { x: x, row: row };
    });
    var paintNow = function () {
      rows.forEach(function (r) {
        var d = r.x.demo ? parseWake(r.x.demo) : parseWake(p.val(r.x.cmdNext));
        var lvl = rvLevel(p.val(r.x.cmdStatus), cleanId(r.x.cmdSyncOk) ? isActive(p.val(r.x.cmdSyncOk)) : null);
        r.row.setAttribute('data-sync', lvl);
        r.row.classList.toggle('tl-rv-off', !d);
        r.row.querySelector('.tl-rvl-day').textContent = d ? rvDay(d) : 'Aucun réveil';
        r.row.querySelector('.tl-rvl-time').textContent = d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : '--:--';
        r.row.querySelector('.tl-rvl-dot').title = p.val(r.x.cmdStatus) || RV_LABEL[lvl];
      });
    };
    p.timers.push(setInterval(paintNow, 60000));
    return function () { paintNow(); };
  };

  /* ---- Planning du plugin Réveils : 4 semaines, congé / enfant / profil du jour d'un clic, paramètres ---- */
  var JL = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  R.reveilplan = function (p, t, api) {
    api.el.classList.add('tl-rp-tile');
    var eqId = cleanId(t.eqId);
    var box = el('div', 'tl-rp');
    var bar = el('div', 'tl-rp-bar');
    var grid = el('div', 'tl-rp-grid');
    var foot = el('div', 'tl-rp-foot');
    var head = el('div', 'tl-rp-headline');
    box.appendChild(head);
    box.appendChild(bar);
    box.appendChild(grid);
    box.appendChild(foot);
    var act = function (what, extra, okMsg) {
      if (p.opts.edit || busy) return;
      busy = true;
      box.classList.add('tl-rp-working');
      ajax('reveilAction', Object.assign({ id: eqId, 'do': what }, extra || {})).then(function (r) {
        busy = false; box.classList.remove('tl-rp-working'); data = r; drawHead(); draw(); if (okMsg) UI.toast(okMsg);
      }, function (err) { busy = false; box.classList.remove('tl-rp-working'); UI.toast(err.message, 'error'); });
    };
    var drawHead = function () {
      if (!data || t.rpHead === 'non') { head.style.display = 'none'; return; }
      var d = parseWake(data.next), lvl = rvLevel(data.status, data.syncOk === '' ? null : isActive(data.syncOk));
      var lines = String(data.status || '').replace(/^[^:]{0,40}:\s*/, '').split(/\s*\|\s*|\n/).filter(Boolean).slice(0, 3);
      head.setAttribute('data-sync', lvl);
      head.innerHTML = '<div class="tl-rp-next"><span class="tl-rv-dot"></span><b>' + (d ? esc(rvDay(d)) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : 'Aucun réveil') + '</b></div>' +
        (lines.length ? '<div class="tl-rp-st">' + lines.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>' : '');
    };
    // heure à la main pour un jour (exception du plugin) : HH:MM, pas de réveil, ou retour au planning
    var timeEdit = function (d) {
      var body = el('div', 'tl-rv-edit');
      body.innerHTML = '<div class="tl-rv-edit-day"></div><input type="time" class="tl-rv-edit-time"><div class="tl-rv-edit-hint">Réveil manuel pour ce jour seulement ; le planning reste inchangé pour les autres jours.</div>';
      body.querySelector('.tl-rv-edit-day').textContent = d.date.split('-').reverse().join('/') + (d.source ? ' · ' + d.source : '');
      var inp = body.querySelector('input');
      inp.value = d.time || '07:00';
      var label = d.date.split('-').reverse().slice(0, 2).join('/');
      UI.modal({ title: 'Réveil du ' + label, body: body, buttons: [
        { label: 'Fermer' },
        { label: 'Pas de réveil', danger: true, click: function () { act('exception', { date: d.date, value: 'off' }, 'Pas de réveil le ' + label); } },
        { label: 'Revenir au planning', click: function () { act('exception', { date: d.date, value: '' }, 'Planning rétabli le ' + label); } },
        { label: 'Enregistrer', primary: true, click: function () { if (!/^\d{2}:\d{2}$/.test(inp.value)) return false; act('exception', { date: d.date, value: inp.value }, 'Réveil à ' + inp.value + ' le ' + label); } }
      ] });
      setTimeout(function () { try { inp.focus(); } catch (e) { /* rien */ } }, 50);
    };
    api.body.appendChild(box);
    var mode = { m: '', profile: '' }, data = null, busy = false;
    var setMode = function (m, prof) {
      mode = { m: mode.m === m && mode.profile === (prof || '') ? '' : m, profile: prof || '' };
      paintMode();
    };
    var paintMode = function () {
      [].forEach.call(bar.querySelectorAll('.tl-rp-mode'), function (b) { b.classList.toggle('tl-on', b.__m === mode.m && b.__p === mode.profile); });
      box.classList.toggle('tl-rp-editing', !!mode.m);
      if (!mode.m && t.rpLegend !== 'non') { foot.innerHTML = '<span class="tl-rp-lg tl-rp-lg-leave">Congé</span><span class="tl-rp-lg tl-rp-lg-exc">Modifié</span><span class="tl-rp-lg tl-rp-lg-child">Avec enfant</span><span class="tl-rp-lg tl-rp-lg-prof">Profil du jour</span>'; return; }
      foot.textContent = mode.m ? (mode.m === 'time' ? 'Touchez un jour pour régler son réveil à la main' : 'Touchez les jours à basculer (' + (mode.m === 'leave' ? 'congé' : (mode.m === 'child' ? 'avec enfant' : mode.profile)) + ')') : '';
    };
    var modeBtn = function (m, label, cls, prof) {
      var b = el('button', 'tl-rp-mode ' + cls, label);
      b.type = 'button'; b.__m = m; b.__p = prof || '';
      b.addEventListener('click', function (e) { e.stopPropagation(); setMode(m, prof); });
      bar.appendChild(b);
    };
    var drawBar = function () {
      bar.innerHTML = '';
      if (t.rpEdit === 'non') return;
      modeBtn('time', '✎ Heure', 'tl-rp-m-time');
      modeBtn('leave', '✎ Congé', 'tl-rp-m-leave');
      if (!data || data.custody) modeBtn('child', '✎ Enfant', 'tl-rp-m-child');
      ((data && data.dayProfiles) || []).forEach(function (pr) { modeBtn('profile', '✎ ' + esc(pr.name) + (pr.time ? ' ' + esc(pr.time) : ''), 'tl-rp-m-prof', pr.name); });
      var tools = el('div', 'tl-rp-tools');
      [['verify', 'fas fa-check-double', 'Vérifier (relit l\'Alexa et le Rémi, sans reprogrammer)', 'Vérification lancée'],
        ['resync', 'fas fa-sync-alt', 'Resynchroniser (réapplique le planning, annule les dérogations)', 'Resynchronisation lancée']].forEach(function (b) {
        var bt = el('button', 'tl-rp-tool', '<i class="' + b[1] + '"></i>');
        bt.type = 'button';
        bt.title = b[2];
        bt.addEventListener('click', function (e) { e.stopPropagation(); act(b[0], {}, b[3]); });
        tools.appendChild(bt);
      });
      bar.appendChild(tools);
      if (!p.opts.edit && eqId) {
        var g = el('button', 'tl-rp-gear', '<i class="fas fa-cog"></i><span>Paramètres</span>');
        g.type = 'button';
        g.addEventListener('click', function (e) { e.stopPropagation(); openSettings(); });
        bar.appendChild(g);
      }
    };
    var openSettings = function () {
      var url = 'index.php?v=d&plugin=reveil&modal=reveil.editor&id=' + eqId;
      var title = 'Paramètres du réveil ' + ((data && data.name) || '');
      try {
        if (root.jeeDialog && jeeDialog.dialog) { jeeDialog.dialog({ id: 'jee_modal', title: title, contentUrl: url, onClose: function () { load(); } }); return; }
        var $ = root.jQuery;
        if ($ && $('#md_modal').length) { $('#md_modal').dialog({ title: title }).load(url).dialog('open'); return; }
      } catch (e) { /* fenêtre Jeedom indisponible */ }
      root.open(url, '_blank');
    };
    var draw = function () {
      grid.innerHTML = '';
      JL.forEach(function (j, i) { grid.appendChild(el('div', 'tl-rp-head' + (i > 4 ? ' tl-rp-we' : ''), j)); });
      grid.insertBefore(el('div', 'tl-rp-head tl-rp-wk', ''), grid.firstChild);
      if (!data) return;
      var days = data.days || [];
      grid.style.gridTemplateRows = 'auto repeat(' + Math.max(1, Math.ceil(days.length / 7)) + ', minmax(0, 1fr))';
      for (var w = 0; w < days.length; w += 7) {
        grid.appendChild(el('div', 'tl-rp-wk', 'S' + days[w].week));
        days.slice(w, w + 7).forEach(function (d) {
          var cls = ['tl-rp-day'];
          if (d.past) cls.push('tl-rp-gone');
          if (d.today) cls.push('tl-rp-today');
          if (d.leave) cls.push('tl-rp-leave');
          if (d.child) cls.push('tl-rp-child');
          if (d.dayProfile) cls.push('tl-rp-prof');
          if (d.exception) cls.push('tl-rp-exc');
          if (d.holiday) cls.push('tl-rp-hol');
          if (!d.time) cls.push('tl-rp-none');
          var c = el('div', cls.join(' '), d.past ? '' : '<span class="tl-rp-n">' + parseInt(d.date.slice(8), 10) + '</span><b>' + (d.time ? esc(d.time) : '—') + '</b>' + (d.dayProfile ? '<i>' + esc(d.dayProfile) + '</i>' : ''));
          c.title = d.source || '';
          if (!d.past) c.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!mode.m || busy || p.opts.edit) { if (!mode.m && d.source) UI.toast(d.date.split('-').reverse().join('/') + ' : ' + (d.time || 'pas de réveil') + ' (' + d.source + ')'); return; }
            if (mode.m === 'time') { timeEdit(d); return; }
            busy = true;
            c.classList.add('tl-rp-busy');
            ajax('reveilToggle', { id: eqId, mode: mode.m, date: d.date, profile: mode.profile }).then(function (r) { busy = false; data = r; draw(); }, function (err) { busy = false; c.classList.remove('tl-rp-busy'); UI.toast(err.message, 'error'); });
          });
          grid.appendChild(c);
        });
      }
    };
    var demo = function () {
      var m0 = new Date(); m0.setDate(m0.getDate() - ((m0.getDay() + 6) % 7));
      var days = [];
      for (var i = 0; i < 28; i++) {
        var d = new Date(m0); d.setDate(m0.getDate() + i);
        var dow = (d.getDay() + 6) % 7, iso = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        days.push({ date: iso, week: 43 + Math.floor(i / 7), time: dow < 5 ? (dow === 2 ? '07:30' : '06:45') : (dow === 5 && i > 7 ? '08:00' : null), dayProfile: dow === 5 && i > 7 ? 'Rugby' : '', child: Math.floor(i / 7) % 2 === 0, leave: i === 10, past: false, today: i === 0 });
      }
      return { name: 'Moi', days: days, dayProfiles: [{ name: 'Rugby', time: '08:00' }], custody: true, next: days[1].date + ' 06:45', status: 'OK : Alexa 06:45 OK | Rémi 06:45 OK', syncOk: 1 };
    };
    var load = function () {
      if (!eqId) { grid.innerHTML = '<div class="tl-det-msg">Choisissez l\'équipement Réveils</div>'; return; }
      ajax('reveilPlanning', { id: eqId, weeks: num(t.rpWeeks, 4) }).then(function (r) { data = r; drawHead(); drawBar(); draw(); paintMode(); }, function (err) { grid.innerHTML = '<div class="tl-det-msg">' + esc(err.message) + '</div>'; });
    };
    api.reload = load;
    if (eqId) (p.widgets[eqId] = p.widgets[eqId] || []).push(api);
    if (p.opts.edit) { data = demo(); drawHead(); drawBar(); draw(); paintMode(); } else { load(); p.timers.push(setInterval(function () { if (!document.hidden && !busy) load(); }, 600000)); }
    return function () {};
  };

  /* ---- Jauge ---- */
  R.jauge = function (p, t, api) {
    var style = t.style || 'cuve';
    var box = el('div', 'tl-gauge tl-gauge-' + style);
    var uid = 'g' + Math.random().toString(36).slice(2, 8);
    if (style === 'cuve') {
      box.innerHTML = '<svg viewBox="0 0 100 140" class="tl-tank">' +
        '<defs><clipPath id="' + uid + 'c"><rect x="14" y="12" width="72" height="116" rx="20"/></clipPath>' +
        '<linearGradient id="' + uid + 'l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fdcff"/><stop offset="1" stop-color="#1e9be6"/></linearGradient>' +
        '<linearGradient id="' + uid + 'g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9fb3c8" stop-opacity=".55"/><stop offset=".5" stop-color="#e8f0f8" stop-opacity=".35"/><stop offset="1" stop-color="#9fb3c8" stop-opacity=".55"/></linearGradient></defs>' +
        '<rect x="14" y="12" width="72" height="116" rx="20" fill="url(#' + uid + 'g)"/>' +
        '<g clip-path="url(#' + uid + 'c)"><g class="tl-liquid"><rect x="0" y="12" width="100" height="130" fill="url(#' + uid + 'l)"/>' +
        '<ellipse cx="50" cy="12" rx="36" ry="5" fill="#a5e8ff"/></g></g>' +
        '<path d="M28 24 C24 40 24 60 27 74" stroke="#fff" stroke-opacity=".5" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<rect x="14" y="12" width="72" height="116" rx="20" fill="none" stroke="#8091a5" stroke-width="4"/>' +
        '<text x="50" y="120" text-anchor="middle" class="tl-tank-txt"></text></svg>';
    } else if (style === 'anneau') {
      box.innerHTML = '<svg viewBox="0 0 100 100" class="tl-ring"><circle cx="50" cy="50" r="40" class="tl-ring-bg"/>' +
        '<circle cx="50" cy="50" r="40" class="tl-ring-fg" transform="rotate(-90 50 50)"/>' +
        '<text x="50" y="57" text-anchor="middle" class="tl-ring-txt"></text></svg>';
    } else {
      box.innerHTML = '<div class="tl-bar-txt tl-fit"></div><div class="tl-bar"><div class="tl-bar-fill"></div></div>';
    }
    api.body.appendChild(box);
    return function () {
      var m = p.meta(t.cmdInfo), v = m ? m.value : undefined;
      var mi = num(t.gMin, num(m && m.minValue, 0)), ma = num(t.gMax, num(m && m.maxValue, 100));
      if (ma <= mi) ma = mi + 100;
      var pct = isNum(v) ? Math.max(0, Math.min(1, (parseFloat(v) - mi) / (ma - mi))) : 0;
      var f = fmt(t, m, v);
      var txt = isNum(v) ? f.text + (f.unit ? (f.unit === '%' ? '' : ' ') + f.unit : '') : '…';
      var r = evalRules(rulesFor(t, p.presets), v);
      var col = r && r.color ? color(r.color) : '';
      if (style === 'cuve') {
        var liquid = box.querySelector('.tl-liquid');
        liquid.style.transform = 'translateY(' + ((1 - pct) * 116) + 'px)';
        box.querySelector('.tl-tank-txt').textContent = txt;
        box.querySelectorAll('.tl-liquid rect, .tl-liquid ellipse').forEach(function (e) { e.style.fill = col; });
      } else if (style === 'anneau') {
        var fg = box.querySelector('.tl-ring-fg');
        var circ = 2 * Math.PI * 40;
        fg.style.strokeDasharray = circ;
        fg.style.strokeDashoffset = circ * (1 - pct);
        fg.style.stroke = col;
        box.querySelector('.tl-ring-txt').textContent = txt;
      } else {
        box.querySelector('.tl-bar-fill').style.width = (pct * 100) + '%';
        box.querySelector('.tl-bar-fill').style.background = col;
        box.querySelector('.tl-bar-txt').textContent = txt;
      }
    };
  };

  /* ---- Lignes ---- */
  /* ---- Liste d'ouvrants : bandeau « N ouverts », groupes, état en texte + dessin ----
   * items : [{ kind: 'title', label } | { kind: porte|fenetre|fenetre2|baie|hublot|portail|garage, label,
   *            cmdInfo, cmdInfo2 (2e contact baie / 2 vantaux), invert, openValue, genre: ''|m|f }]
   * ovMode 'resume' : tuile compacte (icône + « Tout fermé » / « 2 ouverts »), clic → page choisie. */
  var OUV_FEM = { porte: 1, fenetre: 1, fenetre2: 1, baie: 1, garage: 1 };
  function ovItems(t) {
    return (Array.isArray(t.items) ? t.items : []).filter(function (it) { return it && (it.kind === 'title' || cleanId(it.cmdInfo)); });
  }
  function ovRead(p, it) {
    var st = ouvState(p, it), f = it.genre ? it.genre === 'f' : !!OUV_FEM[it.kind || 'fenetre'];
    var txt = st.open === null ? '…' : (st.open ? (f ? 'Ouverte' : 'Ouvert') : (f ? 'Fermée' : 'Fermé'));
    var side = st.open && st.two && st.side !== 'lr' ? (st.side === 'l' ? 'gauche' : 'droite') : '';
    if (side) txt += ' à ' + side;
    var kind = it.kind || 'fenetre', name = kind;
    if (st.open) name += (kind === 'fenetre2' || (kind === 'baie' && st.two)) ? '-' + st.side : '-open';
    return { open: st.open, txt: txt, side: side, icon: 'svg:' + name };
  }
  function ovCount(p, items) {
    var open = [], known = 0;
    items.forEach(function (it) {
      if (it.kind === 'title') return;
      var r = ovRead(p, it);
      if (r.open !== null) known++;
      if (r.open) open.push((it.label || '') + (r.side ? ' (' + r.side + ')' : ''));
    });
    return { open: open, known: known };
  }
  function ovHead(n) { return n === 0 ? 'Tout est fermé' : n + (n > 1 ? ' ouverts' : ' ouvert'); }
  R.ouvrants = function (p, t, api) {
    var items = ovItems(t);
    var cOpen = t.colorOpen || '#ffa726', cClosed = t.colorClosed || '#2ecc71';
    if (t.ovMode === 'resume') {
      var ico = el('div', 'tl-ico'), st = {}, sub = el('div', 'tl-sub tl-fit');
      api.body.appendChild(ico); api.body.appendChild(sub);
      if (t.page || t.target === 'home') p.press(api.el, function () { p.navigate({ target: t.target || 'page', page: t.page }); });
      return function () {
        var c = ovCount(p, items), n = c.open.length;
        setIcon(ico, n ? (t.icon ? t.icon : 'svg:fenetre-open') : (t.icon || 'svg:fenetre'), st);
        var col = !c.known ? 'neutral' : (n ? cOpen : cClosed);
        paint(api, ico, col);
        sub.textContent = !c.known ? '…' : (n ? (n === 1 ? c.open[0] : ovHead(n)) : 'Tout fermé');
        sub.style.color = ico.style.color;
        api.el.classList.toggle('tl-is-open', n > 0);
      };
    }
    api.el.classList.add('tl-ov-tile');
    var box = el('div', 'tl-ov');
    api.body.appendChild(box);
    var sum = null, sumIco = null, sumSt = {}, sumH, sumS;
    if (t.ovSum !== 'non') {
      sum = el('div', 'tl-ov-card tl-ov-sum');
      sumIco = el('div', 'tl-ov-sico');
      var tx = el('div', 'tl-ov-stx');
      sumH = el('div', 'tl-ov-sh'); sumS = el('div', 'tl-ov-ss');
      tx.appendChild(sumH); tx.appendChild(sumS);
      sum.appendChild(sumIco); sum.appendChild(tx);
      box.appendChild(sum);
    }
    // groupes : un titre ouvre une nouvelle carte ; des lignes sans titre au début → carte sans titre
    var groups = [], g = null;
    items.forEach(function (it) {
      if (it.kind === 'title' || !g) {
        g = { el: el('div', 'tl-ov-card'), rows: [] };
        if (it.kind === 'title') g.el.appendChild(el('div', 'tl-ov-gt', esc(it.label || '')));
        g.list = el('div', 'tl-ov-list');
        g.el.appendChild(g.list);
        box.appendChild(g.el);
        groups.push(g);
        if (it.kind === 'title') return;
      }
      var r = el('div', 'tl-ov-row');
      var lab = el('span', 'tl-ov-lab', esc(it.label || ''));
      var right = el('span', 'tl-ov-r');
      var val = el('b', 'tl-ov-val'), ic = el('span', 'tl-ov-ico');
      right.appendChild(val); right.appendChild(ic);
      r.appendChild(lab); r.appendChild(right);
      g.list.appendChild(r);
      g.rows.push({ it: it, el: r, val: val, ico: ic, st: {}, idx: g.rows.length });
    });
    return function () {
      var c = ovCount(p, items), n = c.open.length;
      if (sum) {
        var col = color(!c.known ? 'neutral' : (n ? cOpen : cClosed));
        setIcon(sumIco, n ? 'svg:fenetre-open' : 'svg:fenetre', sumSt);
        sumIco.style.color = col;
        sumH.textContent = !c.known ? '…' : ovHead(n);
        sumH.style.color = col;
        sumS.textContent = n ? c.open.join(', ') : (c.known ? (t.okText || '') : '');
        sumS.style.display = sumS.textContent ? '' : 'none';
      }
      groups.forEach(function (gr) {
        gr.rows.forEach(function (row) {
          var r = ovRead(p, row.it), col = color(r.open === null ? 'neutral' : (r.open ? cOpen : cClosed));
          row.val.textContent = r.txt;
          row.val.style.color = col;
          setIcon(row.ico, r.icon, row.st);
          row.ico.style.color = col;
          row.open = !!r.open;
          row.el.classList.toggle('tl-ov-open', !!r.open);
        });
        if (t.ovOpenFirst) {
          gr.rows.slice().sort(function (a, b) { return (b.open - a.open) || (a.idx - b.idx); })
            .forEach(function (row) { gr.list.appendChild(row.el); });
        }
      });
    };
  };

  /* ================================================================== */
  /*  Énergie : chiffre clé, batterie, bilan du jour, prévision solaire, */
  /*  conseils. Pas de courbe en direct : toucher une valeur = historique */
  /* ================================================================== */

  /** Valeur numérique d'une info, convertie en kWh si l'info est en Wh. */
  function enVal(p, id) {
    var m = cleanId(id) ? p.meta(id) : null;
    if (!m || !isNum(m.value)) return null;
    var v = parseFloat(m.value);
    if (/^wh$/i.test(String(m.unite || '').trim())) v = v / 1000;
    return v;
  }
  function enNum(v, dec) {
    if (v === null || v === undefined || !isFinite(v)) return '…';
    return v.toFixed(dec).replace('.', ',');
  }
  /** Puissance lisible : W, ou kW au-delà de 1000 W. */
  function enPower(v) {
    if (v === null) return { v: '…', u: '' };
    var a = Math.abs(v);
    return a >= 1000 ? { v: enNum(v / 1000, 2), u: 'kW' } : { v: String(Math.round(v)), u: 'W' };
  }
  /** Une valeur cliquable : ouvre la courbe 24 h / 7 j / 30 j de l'info. */
  function enClick(p, t, node, id, unit) {
    if (!cleanId(id) || t.details === 'non' || p.opts.edit) return;
    node.classList.add('tl-en-click');
    node.addEventListener('click', function (e) { e.stopPropagation(); p.details(cleanId(id), { unit: unit || '' }); });
  }
  function enBig(cls) {
    return el('div', 'tl-en-big ' + (cls || ''), '<span class="tl-en-v">…</span><span class="tl-en-u"></span>');
  }
  function enSet(node, v, u, col) {
    node.querySelector('.tl-en-v').textContent = v;
    node.querySelector('.tl-en-u').textContent = u || '';
    if (col !== undefined) node.style.color = col;
  }
  function hhmm(ms) { var d = new Date(Date.now() + ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* ---- Chiffre clé : grosse valeur + petite ligne, liseré de couleur ---- */
  R.kpi = function (p, t, api) {
    var col = color(t.accent || t.color || '#ffb000');
    api.el.classList.add('tl-en-kpi');
    api.el.style.setProperty('--en-acc', col);
    var box = el('div', 'tl-en');
    var big = enBig();
    var sub = el('div', 'tl-en-sub');
    box.appendChild(big); box.appendChild(sub);
    api.body.appendChild(box);
    var calc = t.kpiCalc || '';
    if (!calc) enClick(p, t, big, t.cmdInfo, t.unit);
    if (cleanId(t.cmdSub)) enClick(p, t, sub, t.cmdSub);
    return function () {
      var v = null, u = '', dec = isNum(t.decimals) ? parseInt(t.decimals, 10) : null, txt;
      if (calc === 'autonomie' || calc === 'autoconso') {
        // autonomie = part de la conso non achetée ; autoconsommation = part de la production non revendue
        var a = enVal(p, calc === 'autonomie' ? t.cmdConso : t.cmdProd), b = enVal(p, calc === 'autonomie' ? t.cmdBuy : t.cmdSell);
        v = a && a > 0 && b !== null ? Math.max(0, Math.min(100, (a - b) / a * 100)) : null;
        txt = v === null ? '…' : String(Math.round(v)); u = '%';
      } else {
        var m = p.meta(t.cmdInfo), raw = m ? m.value : undefined;
        u = isSet(t.unit) ? t.unit : ((m && m.unite) || '');
        if (isNum(raw)) {
          v = parseFloat(raw);
          if (/^wh$/i.test(String((m && m.unite) || '').trim()) && !/^wh$/i.test(String(t.unit || ''))) { v = v / 1000; u = 'kWh'; }
          if (u === 'W' && t.autoKw !== false && Math.abs(v) >= 1000 && dec === null) { var pw = enPower(v); txt = pw.v; u = pw.u; }
          else txt = enNum(v, dec === null ? (Math.abs(v) < 10 && v % 1 ? 1 : 0) : dec);
        } else txt = isSet(raw) ? fmt(t, m, raw).text : '…';
      }
      var r = evalRules(rulesFor(t, p.presets), v);
      enSet(big, txt, u, r && r.color ? color(r.color) : col);
      // petite ligne : texte avec {1} = valeur de l'info secondaire
      var st = isSet(t.subText) ? String(t.subText) : '';
      if (cleanId(t.cmdSub)) {
        var sv = enVal(p, t.cmdSub), sm = p.meta(t.cmdSub);
        var s = sv === null ? (sm && isSet(sm.value) ? String(sm.value) : '…') : enNum(sv, isNum(t.subDecimals) ? parseInt(t.subDecimals, 10) : 1);
        st = st.indexOf('{1}') >= 0 ? st.replace('{1}', s) : (st ? st + ' ' : '') + s;
      }
      if (!cleanId(t.cmdSub) && st.indexOf('{1}') >= 0) st = '';
      sub.textContent = st;
      sub.style.display = st ? '' : 'none';
    };
  };

  /* ---- Batterie : charge, puissance, pleine vers / tiendra jusqu'à, Marche / Arrêt ---- */
  R.batterie2 = function (p, t, api) {
    var box = el('div', 'tl-en tl-en-bat');
    var top = el('div', 'tl-en-battop');
    var ring = el('div', 'tl-en-ring', '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" class="tl-en-rbg"/><circle cx="50" cy="50" r="40" class="tl-en-rfg" transform="rotate(-90 50 50)"/>' +
      '<text x="50" y="57" text-anchor="middle" class="tl-en-rtx">…</text></svg>');
    var info = el('div', 'tl-en-batinfo');
    var state = el('div', 'tl-en-batstate');
    var lines = el('div', 'tl-en-batlines');
    info.appendChild(state); info.appendChild(lines);
    top.appendChild(ring); top.appendChild(info);
    box.appendChild(top);
    enClick(p, t, ring, t.cmdSoc, '%');
    enClick(p, t, state, t.cmdPower, 'W');
    var btns = null, bOn = null, bOff = null;
    if (cleanId(t.cmdOn) || cleanId(t.cmdOff)) {
      btns = el('div', 'tl-en-batbtns');
      bOn = el('div', 'tl-en-bbtn tl-en-bon', '<span>⏻</span> ' + esc(t.labelOn || 'Marche'));
      bOff = el('div', 'tl-en-bbtn tl-en-boff', '<span>⏻</span> ' + esc(t.labelOff || 'Arrêt'));
      var bAuto = el('div', 'tl-en-bbtn tl-en-bauto', '<span>⟳</span> ' + esc(t.labelAuto || 'Auto'));
      if (cleanId(t.cmdAuto)) { btns.appendChild(bAuto); p.press(bAuto, function () { p.run(api, t.cmdAuto, {}, { infoId: t.cmdState }); }); }
      if (cleanId(t.cmdOn)) { btns.appendChild(bOn); p.press(bOn, function () { p.run(api, t.cmdOn, {}, { confirm: t.confirmOn, infoId: t.cmdState }); }); }
      if (cleanId(t.cmdOff)) {
        btns.appendChild(bOff);
        p.press(bOff, function () { p.run(api, t.cmdOff, {}, { confirm: t.confirmOff === undefined ? 'Arrêter la batterie ?' : t.confirmOff, infoId: t.cmdState }); });
      }
      box.appendChild(btns);
    }
    api.body.appendChild(box);
    var fg = ring.querySelector('.tl-en-rfg'), rtx = ring.querySelector('.tl-en-rtx'), circ = 2 * Math.PI * 40;
    fg.style.strokeDasharray = circ;
    return function () {
      var soc = enVal(p, t.cmdSoc), pw = enVal(p, t.cmdPower);
      if (pw !== null && t.powerSign === 'inv') pw = -pw;
      var cap = num(t.capacity, 0), minSoc = num(t.minSoc, 0);
      var low = num(t.socLow, 20), mid = num(t.socMid, 50);
      var col = soc === null ? color('neutral') : (soc < low ? '#ef5350' : (soc < mid ? '#ffa726' : '#7ee081'));
      fg.style.strokeDashoffset = circ * (1 - (soc === null ? 0 : Math.max(0, Math.min(1, soc / 100))));
      fg.style.stroke = col;
      rtx.textContent = soc === null ? '…' : Math.round(soc) + ' %';
      var idle = pw === null || Math.abs(pw) < num(t.idleW, 30);
      var pp = enPower(pw === null ? null : Math.abs(pw));
      state.textContent = pw === null ? '…' : (idle ? 'Au repos' : (pw > 0 ? 'En charge · +' : 'En décharge · −') + pp.v + ' ' + pp.u);
      state.style.color = idle ? color('neutral') : (pw > 0 ? '#7ee081' : '#ffa726');
      var L = [];
      if (cap > 0 && soc !== null) {
        L.push('Énergie stockée <b>' + enNum(cap * soc / 100, 1) + ' / ' + enNum(cap, 1) + ' kWh</b>');
        if (!idle && pw > 0 && soc < 99.5) L.push('Pleine vers <b>' + hhmm((100 - soc) / 100 * cap * 1000 / pw * 3600000) + '</b>');
        if (!idle && pw < 0 && soc > minSoc) L.push('Tiendra jusqu\'à <b>' + hhmm((soc - minSoc) / 100 * cap * 1000 / -pw * 3600000) + '</b>' + (minSoc ? ' (' + minSoc + ' %)' : ''));
      }
      lines.innerHTML = L.join('<br>');
      if (btns) {
        // état : « auto », sinon marche / arrêt (1 / on / marche…)
        var sv = cleanId(t.cmdState) ? p.val(t.cmdState) : undefined, low = isSet(sv) ? String(sv).trim().toLowerCase() : '';
        var isAuto = !!low && low === String(t.autoValue || 'auto').toLowerCase();
        var on = !isSet(sv) || isAuto ? null : isActive(sv, t.onValue, t.invert);
        bOn.classList.toggle('tl-on', on === true);
        bOff.classList.toggle('tl-on', on === false);
        var ba = btns.querySelector('.tl-en-bauto');
        if (ba) ba.classList.toggle('tl-on', isAuto);
      }
    };
  };

  /* ---- Bilan du jour : produit, consommé, acheté, revendu + où est partie la production ----
   * Chaque info peut être un compteur « du jour » ou un compteur cumulé (total depuis l'installation) :
   * pour un cumulé, la valeur du jour = valeur actuelle − valeur à minuit (historique Jeedom).
   * La consommation peut être calculée : production + achat − revente − charge batterie + décharge batterie. */
  var EN_KEYS = ['cmdProd', 'cmdConso', 'cmdBuy', 'cmdSell', 'cmdBatIn', 'cmdBatOut'];
  R.bilanjour = function (p, t, api) {
    var box = el('div', 'tl-en tl-en-bilan');
    var grid = el('div', 'tl-en-g4');
    var consoCalc = t.consoCalc === 'calc';
    var defs = [
      ['cmdProd', '#ffb000', 'produits'], ['cmdConso', '#26c6da', 'consommés'],
      ['cmdBuy', '#4fc3f7', 'achetés au réseau'], ['cmdSell', '#9aa4b2', 'revendus']];
    var cells = [];
    defs.forEach(function (d) {
      if (!cleanId(t[d[0]]) && !(d[0] === 'cmdConso' && consoCalc)) return;
      var c = el('div', 'tl-en-cell'), b = enBig(), s = el('div', 'tl-en-sub', esc(d[2]));
      b.style.color = d[1];
      c.appendChild(b); c.appendChild(s); grid.appendChild(c);
      if (cleanId(t[d[0]])) enClick(p, t, c, t[d[0]], 'kWh');
      cells.push({ k: d[0], big: b, sub: s, lab: d[2] });
    });
    box.appendChild(grid);
    var bar = el('div', 'tl-en-split'), leg = el('div', 'tl-en-leg'), ratio = el('div', 'tl-en-ratio');
    box.appendChild(bar); box.appendChild(leg); box.appendChild(ratio);
    api.body.appendChild(box);
    var dec = isNum(t.decimals) ? parseInt(t.decimals, 10) : 1;
    // compteurs cumulés : valeur à minuit demandée au serveur, redemandée au changement de jour
    var cum = EN_KEYS.filter(function (k) { return cleanId(t[k]) && t[k + 'Cum']; });
    var base = {}, baseDay = '', asking = false, self = this;
    var today = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var refresh;
    var askBase = function () {
      if (!cum.length || asking || p.opts.edit && p.opts.noAjax) return;
      asking = true;
      ajax('dayStart', { ids: cum.map(function (k) { return cleanId(t[k]); }) }).then(function (r) {
        asking = false; base = (r && r.cmds) || {}; baseDay = today(); if (refresh) refresh();
      }, function () { asking = false; baseDay = today(); });
    };
    var dayVal = function (k) {
      var v = enVal(p, t[k]);
      if (v === null || !t[k + 'Cum']) return v;
      var b = base[cleanId(t[k])];
      if (!b || b.base === null || b.base === undefined) return null;
      var m = p.meta(t[k]), bv = parseFloat(b.base);
      if (/^wh$/i.test(String((m && m.unite) || '').trim())) bv = bv / 1000;
      return Math.max(0, v - bv);
    };
    refresh = function () {
      if (cum.length && baseDay !== today()) askBase();
      var V = {};
      EN_KEYS.forEach(function (k) { V[k] = cleanId(t[k]) ? dayVal(k) : null; });
      V.cmdForecast = enVal(p, t.cmdForecast);
      if (consoCalc && V.cmdProd !== null) {
        V.cmdConso = Math.max(0, V.cmdProd + (V.cmdBuy || 0) - (V.cmdSell || 0) - (V.cmdBatIn || 0) + (V.cmdBatOut || 0));
      }
      cells.forEach(function (c) {
        enSet(c.big, enNum(V[c.k], dec), 'kWh');
        c.sub.textContent = c.lab + (c.k === 'cmdProd' && V.cmdForecast !== null ? ' · prévu ' + enNum(V.cmdForecast, 1) : '') + (c.k === 'cmdConso' && consoCalc ? ' (calculé)' : '');
      });
      // production répartie : maison / batterie / revendu
      var prod = V.cmdProd;
      if (prod && prod > 0 && (V.cmdSell !== null || V.cmdBatIn !== null)) {
        var sell = Math.min(prod, Math.max(0, V.cmdSell || 0)), bat = Math.min(prod - sell, Math.max(0, V.cmdBatIn || 0)), home = Math.max(0, prod - sell - bat);
        var tot = home + bat + sell || 1, P = function (x) { return Math.round(x / tot * 100); };
        bar.innerHTML = '<i style="width:' + (home / tot * 100) + '%;background:#26c6da"></i><i style="width:' + (bat / tot * 100) + '%;background:#7ee081"></i><i style="width:' + (sell / tot * 100) + '%;background:#4fc3f7;opacity:.6"></i>';
        leg.innerHTML = '<span><b style="color:#26c6da">■</b> maison ' + P(home) + ' %</span>' + (V.cmdBatIn !== null ? '<span><b style="color:#7ee081">■</b> batterie ' + P(bat) + ' %</span>' : '') +
          (V.cmdSell !== null ? '<span><b style="color:#4fc3f7">■</b> revendu ' + P(sell) + ' %</span>' : '');
        bar.style.display = leg.style.display = '';
      } else { bar.style.display = leg.style.display = 'none'; }
      // autonomie (part de la conso non achetée) et autoconsommation (part de la production non revendue)
      var R2 = [];
      if (V.cmdConso && V.cmdConso > 0 && V.cmdBuy !== null) R2.push('Autonomie <b>' + Math.round(Math.max(0, Math.min(100, (V.cmdConso - V.cmdBuy) / V.cmdConso * 100))) + ' %</b>');
      if (prod && prod > 0 && V.cmdSell !== null) R2.push('Autoconsommation <b>' + Math.round(Math.max(0, Math.min(100, (prod - V.cmdSell) / prod * 100))) + ' %</b>');
      ratio.innerHTML = R2.join(' · ');
      ratio.style.display = R2.length ? '' : 'none';
    };
    return refresh;
  };

  /* ---- Prévision solaire (Solcast…) ---- */
  R.prevsolaire = function (p, t, api) {
    var box = el('div', 'tl-en tl-en-prev');
    var grid = el('div', 'tl-en-g4');
    var defs = [['cmdToday', t.labToday || 'aujourd\'hui'], ['cmdRemain', t.labRemain || 'encore à venir'], ['cmdTomorrow', t.labTomorrow || 'demain'], ['cmdAfter', t.labAfter || 'après-demain']];
    var cells = [];
    defs.forEach(function (d) {
      if (!cleanId(t[d[0]])) return;
      var c = el('div', 'tl-en-cell'), b = enBig(), s = el('div', 'tl-en-sub', esc(d[1]));
      b.style.color = color(t.color || '#ffb000');
      c.appendChild(b); c.appendChild(s); grid.appendChild(c);
      enClick(p, t, c, t[d[0]], 'kWh');
      cells.push({ k: d[0], big: b, sub: s, lab: d[1] });
    });
    box.appendChild(grid);
    api.body.appendChild(box);
    var dec = isNum(t.decimals) ? parseInt(t.decimals, 10) : 1;
    return function () {
      cells.forEach(function (c) {
        enSet(c.big, enNum(enVal(p, t[c.k]), dec), 'kWh');
        var f = c.k === 'cmdToday' && cleanId(t.cmdForecast) ? enVal(p, t.cmdForecast) : null;
        c.sub.textContent = c.lab + (f !== null ? ' (prévu ' + enNum(f, 1) + ')' : '');
      });
    };
  };

  /* ---- Conseils (IA) : texte d'une info, une ligne par conseil, et choix du mode ---- */
  R.conseils = function (p, t, api) {
    var box = el('div', 'tl-en tl-en-ia');
    var txt = el('div', 'tl-en-iatxt');
    var txt2 = cleanId(t.cmdText2) ? el('div', 'tl-en-iatxt tl-en-iatxt2') : null;
    var pend = cleanId(t.cmdPending) ? el('div', 'tl-en-pend', '<div class="tl-en-pendtx"></div><div class="tl-en-pendbt"></div>') : null;
    var modes = el('div', 'tl-en-iamodes');
    box.appendChild(txt); if (txt2) box.appendChild(txt2); if (pend) box.appendChild(pend); box.appendChild(modes);
    if (pend) {
      [['cmdAccept', '✓ Valider', 'tl-en-acc'], ['cmdRefuse', '✗ Refuser', 'tl-en-ref']].forEach(function (b) {
        if (!cleanId(t[b[0]])) return;
        var x = el('div', 'tl-en-chip ' + b[2], b[1]);
        p.press(x, function () { p.run(api, t[b[0]], {}, {}); });
        pend.querySelector('.tl-en-pendbt').appendChild(x);
      });
    }
    var split = function (v) { return isSet(v) && String(v).trim() ? String(v).split(/\r?\n|\s*\|\s*|;\s+/).filter(function (s) { return s.trim(); }) : []; };
    api.body.appendChild(box);
    var list = (Array.isArray(t.options) ? t.options : []).filter(function (o) { return o && cleanId(o.cmdAction); });
    var chips = list.map(function (o) {
      var c = el('div', 'tl-en-chip', esc(o.label || 'Mode'));
      p.press(c, function () { p.run(api, o.cmdAction, {}, { confirm: t.confirm, infoId: t.cmdMode }); });
      modes.appendChild(c);
      return { o: o, el: c };
    });
    var cur = cleanId(t.cmdMode) && !chips.length ? el('div', 'tl-en-chip tl-on') : null;
    if (cur) modes.appendChild(cur);
    return function () {
      var v = p.val(t.cmdText);
      var lines = split(v);
      if (txt2) { var l2 = split(p.val(t.cmdText2)); txt2.innerHTML = l2.map(function (s) { return '<div>' + esc(s.trim()) + '</div>'; }).join(''); txt2.style.display = l2.length ? '' : 'none'; }
      if (pend) {
        var pv = p.val(t.cmdPending), has = isSet(pv) && String(pv).trim() && !/^(aucun|none|0|-)$/i.test(String(pv).trim());
        pend.style.display = has ? '' : 'none';
        pend.querySelector('.tl-en-pendtx').textContent = has ? 'En attente de validation : ' + String(pv).trim() : '';
      }
      txt.innerHTML = lines.length ? lines.map(function (s) { return '<div>' + esc(s.trim()) + '</div>'; }).join('') : '<div class="tl-en-dim">' + esc(t.okText || 'Aucun conseil pour le moment') + '</div>';
      var mv = String(p.val(t.cmdMode) || '');
      chips.forEach(function (c) { c.el.classList.toggle('tl-on', !!mv && mv.toLowerCase().indexOf(String(c.o.label || '').toLowerCase()) >= 0); });
      if (cur) cur.textContent = mv ? 'Mode ' + mv : '';
    };
  };

  R.lignes = function (p, t, api) {
    // tableau (par défaut) : libellés à gauche, valeurs / boutons alignés à droite ; « centré » : ancienne présentation
    var table = t.lnAlign !== 'centre';
    var box = el('div', 'tl-lines tl-fitbox' + (table ? ' tl-lines-table' : ''));
    api.body.appendChild(box);
    var rows = (t.lines || []).map(function (l) {
      var kind = l.kind || 'value';
      var r = el('div', 'tl-line tl-line-' + kind);
      var row = { l: l, kind: kind, el: r };
      if (kind === 'title') {
        r.textContent = l.label || '';
        r.style.color = color(l.color, 'info');
      } else {
        var lab = el('span', 'tl-lab', l.label ? esc(l.label) + (table ? '' : '&nbsp;:&nbsp;') : '');
        r.appendChild(lab);
        if (kind === 'button') {
          row.btn = makeBtn('rond');
          row.btn.classList.add('tl-mini');
          row.state = {};
          r.appendChild(row.btn);
          var mode = btnMode(l);
          row.mode = mode;
          p.press(row.btn, btnClick(p, api, l, mode === 'split' ? 'single' : mode, function () { return row.act; }));
        } else if (kind === 'icon') {
          row.ico = el('span', 'tl-mini-ico');
          row.state = {};
          r.appendChild(row.ico);
        } else {
          row.v = el('span', 'tl-lv');
          r.appendChild(row.v);
        }
      }
      box.appendChild(r);
      return row;
    });
    return function () {
      rows.forEach(function (row) {
        var l = row.l;
        if (row.kind === 'button') {
          var s = btnState(p, l);
          row.act = s.act;
          drawBtn(row.btn, l.icon || 'svg:play', s.color, 'rond', row.state);
        } else if (row.kind === 'icon') {
          var v = p.val(l.cmdInfo), act = isActive(v, l.onValue, l.invert);
          var r = evalRules(rulesFor(l, p.presets), v);
          setIcon(row.ico, (r && r.icon) || (act === false && isSet(l.iconOff) ? l.iconOff : (l.icon || 'svg:check-circle')), row.state);
          var ic = r && r.color ? r.color : (act === null ? 'neutral' : (act ? (l.color || 'on') : 'neutral'));
          // priorité : info « alerte » active (rouge) > info principale active > info « OK » active (vert)
          if (cleanId(l.cmdAlert) && isActive(p.val(l.cmdAlert)) === true) ic = l.colorAlert || 'alert';
          else if (act !== true && cleanId(l.cmdOk) && isActive(p.val(l.cmdOk)) === true) ic = l.colorOk || 'ok';
          row.ico.style.color = color(ic);
        } else if (row.kind === 'value') {
          var m = p.meta(l.cmdInfo), raw = m ? m.value : undefined;
          var f = fmt(l, m, raw);
          var rr = f.invalid ? null : evalRules(rulesFor(l, p.presets), raw);
          row.v.textContent = (rr && isSet(rr.label)) ? rr.label : f.text + (f.unit ? ' ' + f.unit : '');
          row.v.style.color = color(rr && rr.color ? rr.color : (f.invalid ? 'neutral' : l.color));
        }
      });
    };
  };

  /* ---- Texte libre avec valeurs {1}..{4} ---- */
  R.texte = function (p, t, api) {
    var box = el('div', 'tl-text tl-fitbox' + (t.size === 'grand' ? ' tl-big' : '') + (t.size === 'petit' ? ' tl-small' : ''));
    api.body.appendChild(box);
    if (t.cmdOn) p.press(api.el, function () { p.run(api, t.cmdOn, {}, { confirm: t.confirm }); });
    return function () {
      var html = esc(t.template || '').replace(/\n/g, '<br>').replace(/\{([1-4])\}/g, function (all, i) {
        var m = p.meta(t['cmdV' + i]);
        var f = fmt({ decimals: t.decimals, unit: '-', min: t.min, max: t.max }, m, m ? m.value : undefined);
        return '<span class="tl-tv">' + f.html + '</span>';
      });
      box.innerHTML = '<div class="tl-tx">' + html + '</div>';
      var r = evalRules(rulesFor(t, p.presets), p.val(t.cmdV1));
      box.style.color = color(r && r.color ? r.color : t.color);
    };
  };

  /* ---- Horloge / date ---- */
  R.horloge = function (p, t, api) {
    var box = el('div', 'tl-text tl-fit' + (t.size === 'grand' ? ' tl-big' : ''));
    if (isSet(t.color)) box.style.color = color(t.color);
    api.body.appendChild(box);
    var tick = function () {
      var d = new Date(), f = t.format || 'date';
      var date = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      var hour = pad(d.getHours()) + ':' + pad(d.getMinutes());
      box.textContent = f === 'heure' ? hour
        : f === 'dateheure' ? date + ' · ' + hour
          : f === 'complet' ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            : date;
    };
    tick();
    p.timers.push(setInterval(tick, 15000));
    return function () {};
  };

  /* ---- Lien (navigation) avec compteur ---- */
  R.lien = function (p, t, api) {
    var icons = el('div', 'tl-icons');
    icons.innerHTML = isSet(t.img) ? iconHtml('img:' + t.img) : iconHtml(t.icon || 'fas fa-arrow-right');
    api.body.appendChild(icons);
    var badge = el('div', 'tl-badge');
    api.el.appendChild(badge);
    if (t.desc) api.body.appendChild(el('div', 'tl-sub tl-fit', esc(t.desc)));
    p.press(api.el, function () { p.navigate(t); });
    var list = Array.isArray(t.cmdList) ? t.cmdList.map(cleanId).filter(Boolean) : [];
    return function () {
      var value = null;
      if (list.length) {
        var rule = { op: t.countOp || '=', v: isSet(t.countVal) ? t.countVal : '1' };
        value = list.filter(function (id) { return matchRule(rule, p.val(id)); }).length;
      } else if (t.cmdBadge) {
        var m = p.meta(t.cmdBadge), f = fmt(t, m, m ? m.value : undefined);
        value = f.invalid ? null : f.text + (f.unit ? ' ' + f.unit : '');
        if (m && isNum(m.value)) value = isNum(t.decimals) ? f.text : m.value;
      }
      var show = value !== null && !(t.hideZero && String(value) === '0');
      badge.textContent = show ? String(value) : '';
      badge.style.display = show ? '' : 'none';
      var r = evalRules(rulesFor(t, p.presets), value);
      icons.style.color = color(r && r.color ? r.color : t.color, '#ffffff');
    };
  };

  /** Animation d'un lien : condition (info + comparaison) si renseignée, sinon la case « animer ». null = ancien réglage. */
  function linkAnim(page, cmd, op, val, on) {
    if (cleanId(cmd)) return matchRule({ op: op || '=', v: isSet(val) && val !== '' ? val : '1' }, page.val(cmd));
    if (on === true || on === 'true' || on === 1) return true;
    if (on === false || on === 'false' || on === 0) return false;
    return null;
  }

  /* ---- Double lien : 2 images / icônes, 2 destinations dans une même tuile ---- */
  R.lien2 = function (p, t, api) {
    api.el.classList.add('tl-l2-tile');
    var halves = [];
    var box = el('div', 'tl-l2 tl-l2-' + (t.l2Dir === 'dessus' ? 'col' : 'row') + (t.l2Sep === false || t.l2Sep === '0' || t.l2Sep === 'non' ? '' : ' tl-l2-sep'));
    ['a', 'b'].forEach(function (k) {
      var img = t[k + 'Img'], ico = t[k + 'Icon'], lab = t[k + 'Label'];
      if (lab === 'Lien 1' || lab === 'Lien 2') lab = '';   // anciens textes par défaut : pas affichés
      var half = el('div', 'tl-l2-half' + (isSet(img) ? ' tl-l2-hasimg' : ''));
      var vis = isSet(img) ? '<img class="tl-l2-img tl-fit-' + (t.l2Fit === 'cover' ? 'cover' : 'contain') + '" src="' + esc(img) + '" alt="">' :
        '<div class="tl-l2-ico">' + iconHtml(ico || (k === 'a' ? 'fas fa-arrow-left' : 'fas fa-arrow-right')) + '</div>';
      var K = k.toUpperCase(), sub = t[k + 'Desc'], hasSub = isSet(sub) && sub !== '' || cleanId(t['cmdDesc' + K]);
      half.innerHTML = vis + (isSet(lab) && lab !== '' ? '<div class="tl-l2-lab tl-fit">' + esc(lab) + '</div>' : '') +
        (hasSub ? '<div class="tl-l2-sub tl-fit">' + esc(isSet(sub) ? sub : '') + '</div>' : '');
      var c = color(t[k + 'Color'], '');
      if (c) half.style.color = c;
      box.appendChild(half);
      var dest = { target: t[k + 'Target'] || 'page', page: t[k + 'Page'], url: t[k + 'Url'], newTab: t[k + 'NewTab'] };
      p.press(half, function () { p.navigate(dest); });
      halves.push({ el: half, K: K, svg: !!half.querySelector('.tl-anim'), sub: half.querySelector('.tl-l2-sub'), pre: isSet(sub) ? String(sub) : '' });
    });
    api.body.appendChild(box);
    api.el.style.setProperty('--tla-d', { lent: 1.8, rapide: 0.55 }[t.animSpeed] || 1);
    // animation de chaque moitié : condition (info) si renseignée, sinon la case « animer »
    return function () {
      halves.forEach(function (h) {
        // sous-texte : texte fixe, suivi de la valeur d'une info si choisie (ex. « 3 ouverts »)
        var dc = t['cmdDesc' + h.K];
        if (h.sub && cleanId(dc)) {
          var m = p.meta(dc), f = fmt({ decimals: t['descDec' + h.K], map: t['descMap' + h.K] }, m, m ? m.value : undefined);
          var v = f.invalid ? '…' : f.text + (f.unit ? ' ' + f.unit : '');
          h.sub.textContent = h.pre ? (h.pre.indexOf('#') >= 0 ? h.pre.replace('#', v) : h.pre + ' ' + v) : v;
        }
        var la = linkAnim(p, t['cmdAnim' + h.K], t['animOp' + h.K], t['animVal' + h.K], t['animOn' + h.K]);
        if (la === null) la = h.svg;   // icône animée sans réglage : elle bouge
        var run = !!p.opts.edit || la;
        h.el.classList.toggle('tl-run', run && h.svg);
        h.el.classList.toggle('tl-pulse-on', run && !h.svg && (la === true && (cleanId(t['cmdAnim' + h.K]) || t['animOn' + h.K] === true)));
      });
    };
  };

  /* ---- Image ---- */
  R.image = function (p, t, api) {
    api.body.innerHTML = isSet(t.img) ? '<img class="tl-photo tl-fit-' + (t.fit || 'contain') + '" src="' + esc(t.img) + '" alt="">' : '<div class="tl-sub">Aucune image</div>';
    if (t.url || t.page) p.press(api.el, function () { p.navigate(t); });
    return function () {};
  };

  /* ================================================================== */
  /*  Page d'index (liste des pages)                                     */
  /* ================================================================== */

  function indexData(data, mobile) {
    var labels = { tablette: 'Tablette', mobile: 'Mobile' };
    var order = mobile ? ['mobile', 'tablette'] : ['tablette', 'mobile'];
    var tiles = [];
    order.forEach(function (dev) {
      var pages = (data.pages || []).filter(function (pg) { return (pg.device === 'mobile' ? 'mobile' : 'tablette') === dev; });
      if (!pages.length) return;
      tiles.push({ id: 'r' + dev, type: 'rangee', space: tiles.length ? 30 : 0, title: labels[dev] });
      pages.forEach(function (pg) {
        tiles.push({ id: 'p' + pg.id, type: 'lien', title: pg.name, icon: pg.icon || 'fas fa-th-large', target: 'page', page: pg.id, w: 1, h: 1, titleColor: '#ffffff' });
      });
    });
    return Object.assign({}, data, {
      name: 'Pages',
      layout: { grid: { cols: 5, size: 200, gap: 12, mobileCols: 3, dense: true }, tiles: tiles },
      cmds: {}
    });
  }

  /* ================================================================== */
  /*  API publique                                                       */
  /* ================================================================== */

  var Tuiles = {
    version: VERSION,
    ajax: ajax,
    navItems: navItems,
    navFor: navFor,
    ui: UI,
    icons: ICONS,
    iconHtml: iconHtml,
    animIcons: ANIM_ICONS,
    coreIconClass: coreIconClass,
    sliderRange: sliderRange,
    util: { isSet: isSet, isNum: isNum, num: num, esc: esc, el: el, cleanId: cleanId, collectIds: collectIds, parseMap: parseMap, parseList: parseList, evalRules: evalRules, matchRule: matchRule, color: color, thresholdRules: thresholdRules },

    /** Monte une page à partir de données déjà chargées. */
    mount: function (rootEl, data, opts) {
      if (data && data.index) data = indexData(data, opts && opts.mobile === true);
      return new Page(rootEl, data, opts || {});
    },

    /** Charge une page par son id ('' = accueil, 'index' = liste) et la monte. */
    open: function (rootEl, id, opts) {
      opts = opts || {};
      rootEl.classList.add('tl-loading');
      var req = id === 'index' ? { index: 1 } : { id: id || '' };
      if (opts.mobile === true) req.mobile = 1;
      return ajax('getPage', req).then(function (data) {
        rootEl.classList.remove('tl-loading');
        var page = Tuiles.mount(rootEl, data, opts);
        var pid = data.index ? 'index' : String(data.id || '');
        if (opts.remember) { try { root.localStorage.setItem('tuiles_last', pid); } catch (e) { /* stockage indisponible */ } }
        if (opts.updateUrl && root.history && root.history.replaceState) {
          try {
            var url = new URL(root.location.href);
            if (pid && pid !== 'index') url.searchParams.set('page_id', pid); else url.searchParams.delete('page_id');
            root.history.replaceState(null, '', url.toString());
          } catch (e) { /* URL non modifiable */ }
        }
        if (data.name && opts.setTitle) document.title = data.name;
        return page;
      }, function (err) {
        rootEl.classList.remove('tl-loading');
        rootEl.innerHTML = '<div class="tl-error">' + esc(err.message) + '</div>';
        throw err;
      });
    },

    /** Démarrage d'un panel (navigateur ou mobile). */
    boot: function (rootEl, opts) {
      opts = opts || {};
      if (rootEl.__tuilesBooted) return;
      rootEl.__tuilesBooted = true;
      var id = opts.pageId;
      if (!isSet(id)) {
        try { id = new URL(root.location.href).searchParams.get('page_id'); } catch (e) { id = ''; }
      }
      if (!isSet(id) && opts.remember) {
        try { id = root.localStorage.getItem('tuiles_last') || ''; } catch (e) { id = ''; }
      }
      if (opts.kiosk) document.body.classList.add('tl-kiosk');
      return Tuiles.open(rootEl, id || '', opts).catch(function () {
        if (id) return Tuiles.open(rootEl, '', opts);
      });
    }
  };

  root.Tuiles = Tuiles;
})(window);
