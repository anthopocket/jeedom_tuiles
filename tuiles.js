/* Tuiles — éditeur de page (page de configuration du plugin) */
(function () {
  'use strict';
  var T = window.Tuiles, U = T.util;
  var isSet = U.isSet, esc = U.esc, cleanId = U.cleanId;

  /* ================================================================== */
  /*  Catalogue                                                          */
  /* ================================================================== */

  var FUNCS = [
    ['Afficher une info', {
      valeur: 'Info numérique / texte',
      icone: 'Info icône (binaire ou états : prêt / en cours / terminé)',
      ouvrant: 'Info ouvrant (porte, fenêtre, portail, garage)',
      ouvrants: 'Liste d\'ouvrants (bandeau « N ouverts » + liste par étage)',
      jauge: 'Info jauge (cuve, barre, anneau)',
      lignes: 'Plusieurs infos (lignes)',
      texte: 'Texte avec infos',
      messages: 'Messages / alertes (texte d\'une info)',
      puissance: 'Carte puissance (valeur + anneau + courbe)',
      batteries: 'Batteries (piles des équipements)',
      reseau: 'Réseau (plugin Network)',
      demons: 'Démons et dépendances des plugins',
      sante: 'Santé de la maison (piles, réseau, démons, VM Jeedom)',
      zones: 'Zones d\'alarme (Risco)',
      vigieau: 'VigiEau (restrictions d\'eau)'
    }],
    ['Énergie', {
      kpi: 'Chiffre clé (grosse valeur + petite ligne)',
      batterie2: 'Batterie (charge, autonomie, Marche / Arrêt)',
      bilanjour: 'Bilan énergie du jour',
      prevsolaire: 'Prévision solaire (Solcast…)',
      conseils: 'Conseils (energIA…) et mode'
    }],
    ['Commander', {
      bouton: 'Bouton',
      slider: 'Slider',
      select: 'Select / liste',
      volet: 'Volet',
      voletgroupe: 'Groupe de volets (tous, RDC, étage…)',
      saisie: 'Saisie texte / nombre',
      date: 'Envoi date / heure',
      lumiere: 'Éclairage on / off',
      variateur: 'Éclairage variateur (on / off + variation)',
      interphone: 'Interphone (plugin hikinterphone)',
      bonspoints: 'Bons Points (plugin bonsPoints)',
      thermostat: 'Thermostat',
      alarme: 'Alarme : partition (Risco)',
      reveil: 'Réveil (plugin Réveils)',
      reveils: 'Liste des réveils (plugin Réveils)',
      reveilplan: 'Planning d\'un réveil (plugin Réveils)',
      chauffeeau: 'Chauffe-eau'
    }],
    ['Intégrer', {
      widget: 'Widget Jeedom (équipement)',
      camera: 'Caméra Frigate',
      web: 'Page web'
    }],
    ['Page', {
      lien: 'Lien / navigation',
      lien2: 'Double lien (2 images ou icônes, 2 destinations)',
      horloge: 'Date / heure du jour',
      soleil: 'Soleil (lever, coucher, hauteur)',
      separateur: 'Barre de séparation',
      image: 'Image',
      vide: 'Vide / réserve'
    }]
  ];
  var TYPES = {};
  FUNCS.forEach(function (g) { Object.keys(g[1]).forEach(function (k) { TYPES[k] = g[1][k]; }); });
  TYPES.rangee = 'Nouvelle rangée';
  // tailles en cases (grille en douzièmes) ; l'ordre d'affichage suit ce tableau
  var SIZE_LIST = [
    [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '1'],
    [1.25, '1¼'], [4 / 3, '1⅓'], [1.5, '1½'], [5 / 3, '1⅔'], [1.75, '1¾'], [2, '2'],
    [2.25, '2¼'], [7 / 3, '2⅓'], [2.5, '2½'], [8 / 3, '2⅔'], [2.75, '2¾'], [3, '3'],
    [3.5, '3½'], [4, '4'], [4.5, '4½'], [5, '5'], [6, '6'], [7, '7'], [8, '8'], [10, '10'], [12, '12']];
  var SIZES = {};
  SIZE_LIST.forEach(function (x) { SIZES[x[0].toFixed(4)] = x[1]; });
  var TARGETS = { value: 'La valeur / l\'icône', bg: 'Le fond de la tuile', title: 'Le nom' };
  var ICON_GROUPS = [
    ['Boutons', [['svg:play', 'Lecture'], ['svg:stop', 'Stop'], ['svg:pause', 'Pause'], ['svg:power', 'Marche'], ['svg:play-circle', 'Lecture rond'],
      ['svg:stop-circle', 'Stop rond'], ['svg:up', 'Haut'], ['svg:down', 'Bas'], ['svg:plus', 'Plus'], ['svg:minus', 'Moins'], ['svg:refresh', 'Cycle']]],
    ['États', [['svg:check-circle', 'OK rond'], ['svg:check', 'OK'], ['svg:cross', 'Erreur'], ['svg:flag', 'Drapeau'], ['svg:bulb', 'Ampoule'],
      ['svg:drop', 'Goutte'], ['svg:thermo', 'Thermomètre'], ['svg:home', 'Accueil']]],
    ['Ouvrants (fermé / ouvert)', [['svg:porte', 'Porte'], ['svg:porte-open', 'Porte ouverte'], ['svg:fenetre', 'Fenêtre'], ['svg:fenetre-open', 'Fenêtre ouverte'], ['svg:hublot', 'Hublot'], ['svg:hublot-open', 'Hublot ouvert'],
      ['svg:baie', 'Baie'], ['svg:baie-open', 'Baie ouverte'], ['svg:portail', 'Portail'], ['svg:portail-open', 'Portail ouvert'],
      ['svg:garage', 'Garage'], ['svg:garage-open', 'Garage ouvert'], ['svg:volet', 'Volet'], ['svg:volet-open', 'Volet ouvert']]]
  ];

  var C_INFO = { type: 'info' }, C_ACTION = { type: 'action' };
  var BTN_KINDS = { impulsion: 'Sans retour (impulsion)', on: 'On seul, avec retour d\'état', toggle: 'Toggle, avec retour d\'état', onoff: 'On / Off, avec retour d\'état', split: '2 boutons On et Off, sans retour' };
  function btnKind(t) {
    var k = t.behavior || 'auto';
    if (k === 'single') k = t.cmdInfo ? 'on' : 'impulsion';
    if (k === 'auto' || !BTN_KINDS[k]) k = (t.cmdOn && t.cmdOff) ? (t.cmdInfo ? 'onoff' : 'split') : (t.cmdInfo ? 'toggle' : 'impulsion');
    return k;
  }
  function kindIs() {
    var list = Array.prototype.slice.call(arguments);
    return function (t) { return list.indexOf(btnKind(t)) >= 0; };
  }

  var F = {
    iconAnim: { k: 'iconAnim', l: 'Icône animée : bouge', f: 'sel', o: { '': 'Quand la tuile est active (en marche)', toujours: 'Toujours', jamais: 'Jamais (figée)' }, help: 'Dans l\'éditeur, « Quand la tuile est active » bouge toujours pour l\'aperçu ; « Jamais » reste figée.', show: function (t) { return hasAnimIcon(t); } },
    animSpeed: { k: 'animSpeed', l: 'Animation : vitesse', f: 'sel', o: { '': 'Normale', lent: 'Lente', rapide: 'Rapide' }, show: function (t) { return hasAnimIcon(t); } },
    info: { k: 'cmdInfo', l: 'Info', f: 'cmd', filter: C_INFO },
    th: { k: 'thresholds', base: 'thBase', l: 'Couleur de la valeur selon la valeur', f: 'thresholds', help: 'Jusqu\'à 10 lignes. Un nombre = à partir de cette valeur (le plus haut seuil atteint gagne). Un texte = si la valeur est égale à ce texte. La couleur s\'applique au texte comme à l\'icône.' },
    target: { k: 'colorTarget', l: 'Ces couleurs colorent', f: 'sel', o: TARGETS },
    unit: { k: 'unit', l: 'Unité', ph: 'auto (- = aucune)' },
    decimals: { k: 'decimals', l: 'Décimales', f: 'num', ph: 'auto' },
    map: { k: 'map', l: 'Libellés', ph: '0=Fermé;1=Ouvert', help: 'Remplace une valeur par un texte' },
    min: { k: 'min', l: 'Plage plausible : min', f: 'num', ph: 'aucun', help: 'Hors plage, la tuile affiche « — »' },
    max: { k: 'max', l: 'Plage plausible : max', f: 'num', ph: 'aucun' },
    confirm: { k: 'confirm', l: 'Confirmation', ph: 'vide = aucune', help: 'Texte demandé avant d\'exécuter' },
    wait: { k: 'wait', l: 'Attente du retour (s)', f: 'num', ph: '0 = non', help: 'Clignote jusqu\'au changement de l\'info, rouge si rien après ce délai' },
    invert: { k: 'invert', l: 'Inverser l\'état', f: 'check' },
    onValue: { k: 'onValue', l: 'Valeur « actif »', ph: 'auto (1, on, >0…)' }
  };

  var SCHEMA = {
    valeur: [F.info, F.unit, F.decimals, F.map, { k: 'dateFmt', l: 'Si c\'est une date', f: 'sel', o: { brut: 'Telle quelle', '2lignes': 'Date + heure sur 2 lignes', heure: 'Heure seule', date: 'Date seule', ilya: '« il y a … »' } },
      F.min, F.max, F.th, F.target,
      { k: 'cmdOn', l: 'Action au clic (option)', f: 'cmd', filter: C_ACTION }, F.confirm,
      { k: 'details', l: 'Courbe et détails', f: 'sel', o: { '': 'Non', clic: 'Au clic (appui long si la tuile a une action)', long: 'Appui long seulement' }, help: 'Fenêtre avec la courbe 24 h / 7 j / 30 j, min / moyenne / max. La commande doit être historisée.' }],
    icone: [{ k: 'cmdInfo', l: 'Info (binaire ou texte d\'état)', f: 'cmd', filter: C_INFO },
      { k: 'onValue', l: 'Valeur de l\'état 1', ph: '1', show: function (t) { return !isSet(t.runValues) && !isSet(t.doneValues); } }, F.invert,
      { k: 'runValues', l: 'Valeurs « en marche » (info texte)', ph: 'En cours;Lavage;Essorage', help: 'Pour une info à plusieurs états (ex. Prêt / En cours / Terminé). Séparées par ; — un mot contenu dans la valeur suffit. L\'icône animée bouge sur ces valeurs.', blurRebuild: true },
      { k: 'doneValues', l: 'Valeurs « terminé »', ph: 'Terminé;Fini', help: 'Affiche l\'état terminé : couleur, icône et texte dédiés, petite coche sur l\'icône.', blurRebuild: true },
      { k: 'iconDone', l: 'Icône terminé (option)', f: 'icon', ph: 'même icône', show: function (t) { return isSet(t.doneValues); } },
      { k: 'colorDone', l: 'Couleur terminé', f: 'color', ph: 'ok', show: function (t) { return isSet(t.doneValues); } },
      { k: 'labelDone', l: 'Texte terminé (option)', ph: 'ex. Terminé', show: function (t) { return isSet(t.doneValues); } },
      { k: 'icon', l: 'Icône état 1', f: 'icon', ph: 'svg:check-circle' }, { k: 'iconOff', l: 'Icône état 0', f: 'icon', ph: 'même icône' }, F.iconAnim, F.animSpeed,
      { k: 'colorOn', l: 'Couleur état 1', f: 'color', ph: 'on' }, { k: 'colorOff', l: 'Couleur état 0', f: 'color', ph: 'neutral' },
      { k: 'labelOn', l: 'Texte état 1 (option)', ph: 'ex. Marche' }, { k: 'labelOff', l: 'Texte état 0 (option)', ph: 'ex. Arrêt' },
      { k: 'thresholds', l: 'Couleurs selon la valeur (option, remplace état 1 / 0)', f: 'thresholds', help: 'Pour une info à plusieurs valeurs (ex. état général 1 à 4)' },
      { k: 'cmdOn', l: 'Action au clic (option)', f: 'cmd', filter: C_ACTION }, F.confirm],
    ouvrant: [{ k: 'kind', l: 'Dessin', f: 'sel', o: { porte: 'Porte', fenetre: 'Fenêtre', fenetre2: 'Fenêtre 2 vantaux', hublot: 'Hublot (fenêtre ronde)', baie: 'Baie coulissante', portail: 'Portail', garage: 'Garage', volet: 'Volet' } },
      { k: 'cmdInfo', l: 'Info', f: 'cmd', filter: C_INFO, show: function (t) { return !(t.kind === 'baie' || t.kind === 'fenetre2'); } },
      { k: 'cmdInfo', l: 'Info vantail gauche', f: 'cmd', filter: C_INFO, show: function (t) { return t.kind === 'baie' || t.kind === 'fenetre2'; } },
      { k: 'cmdInfo2', l: 'Info vantail droit (option)', f: 'cmd', filter: C_INFO, help: 'Second contact : la tuile montre ouvert à gauche, à droite ou les deux. Vide = un seul contact pour toute la baie / fenêtre.', show: function (t) { return t.kind === 'baie' || t.kind === 'fenetre2'; } },
      { k: 'openValue', l: 'Valeur « ouvert »', ph: '1' }, F.invert,
      { k: 'colorOpen', l: 'Couleur ouvert', f: 'color', ph: 'alert' }, { k: 'colorClosed', l: 'Couleur fermé', f: 'color', ph: 'neutral' },
      { k: 'showState', l: 'Afficher Ouvert / Fermé', f: 'check' },
      { k: 'cmdOn', l: 'Action ouvrir / basculer', f: 'cmd', filter: C_ACTION }, { k: 'cmdOff', l: 'Action fermer (option)', f: 'cmd', filter: C_ACTION },
      F.confirm, F.wait,
      { k: 'thresholds', l: 'Couleurs selon la valeur', f: 'thresholds', help: 'Jusqu\'à 10 lignes. Un nombre = à partir de cette valeur ; un texte = si égal. Remplace les couleurs par défaut.' }],
    bouton: [
      { k: 'behavior', l: 'Type de bouton', f: 'sel', o: BTN_KINDS, keep: true },
      { k: 'cmdOn', l: 'Action', f: 'cmd', filter: C_ACTION, show: kindIs('impulsion') },
      { k: 'cmdOn', l: 'Action On', f: 'cmd', filter: C_ACTION, show: kindIs('on', 'onoff', 'split') },
      { k: 'cmdOn', l: 'Action toggle', f: 'cmd', filter: C_ACTION, show: kindIs('toggle') },
      { k: 'cmdOff', l: 'Action Off', f: 'cmd', filter: C_ACTION, show: kindIs('onoff', 'split') },
      { k: 'cmdInfo', l: 'Info d\'état (retour)', f: 'cmd', filter: C_INFO, show: kindIs('on', 'toggle', 'onoff') },
      { k: 'icon', l: 'Icône', f: 'icon', ph: 'svg:play' },
      { k: 'iconActive', l: 'Icône si actif (option)', f: 'icon', show: kindIs('on', 'toggle', 'onoff') },
      { k: 'iconOff', l: 'Icône du bouton Off', f: 'icon', ph: 'svg:stop', show: kindIs('split') }, F.iconAnim, F.animSpeed,
      { k: 'style', l: 'Style', f: 'sel', o: { rond: 'Rond plein', icone: 'Icône seule' } },
      { k: 'colorNeutral', l: 'Couleur', f: 'color', ph: 'neutral', show: kindIs('impulsion') },
      { k: 'colorOn', l: 'Couleur actif', f: 'color', ph: 'on', show: kindIs('on', 'toggle', 'onoff', 'split') },
      { k: 'colorOff', l: 'Couleur inactif', f: 'color', ph: 'off', show: kindIs('on', 'toggle', 'onoff', 'split') },
      { k: 'onValue', l: 'Valeur « actif »', ph: '1', show: kindIs('on', 'toggle', 'onoff') },
      { k: 'invert', l: 'Inverser l\'état', f: 'check', show: kindIs('on', 'toggle', 'onoff'), help: 'Change l\'affichage (couleur, icône, Marche / Arrêt). En On / Off, la commande envoyée suit toujours la vraie valeur de l\'info : 1 → Action Off, 0 → Action On.' },
      { k: 'swapCmds', l: 'Inverser les commandes', f: 'check', show: kindIs('onoff'), help: 'Envoie Action On quand l\'info vaut 1 et Action Off quand elle vaut 0 (ex. info qui vaut 1 quand l\'appareil est arrêté).' },
      { k: 'disableWhenActive', l: 'Grisé si déjà actif', f: 'check', show: kindIs('on') },
      { k: 'showState', l: 'Afficher Marche / Arrêt', f: 'check', show: kindIs('on', 'toggle', 'onoff') },
      { k: 'cmdLong', l: 'Action appui long (option)', f: 'cmd', filter: C_ACTION, show: kindIs('impulsion', 'on', 'toggle', 'onoff') },
      F.confirm,
      { k: 'wait', l: 'Attente du retour (s)', f: 'num', ph: '0 = non', show: kindIs('on', 'toggle', 'onoff'), help: 'Clignote jusqu\'au changement de l\'info, rouge si rien après ce délai' },
      { k: 'thresholds', l: 'Couleurs selon la valeur de l\'info', f: 'thresholds', show: kindIs('on', 'toggle', 'onoff'), help: 'Remplace les couleurs actif / inactif' }],
    slider: [{ k: 'cmdOn', l: 'Action slider', f: 'cmd', filter: { type: 'action', subType: 'slider' } }, { k: 'cmdInfo', l: 'Info de position (option)', f: 'cmd', filter: C_INFO },
      { k: 'sStyle', l: 'Style', f: 'sel', o: { '': 'Classique', neon: 'Néon', pilule: 'Pilule (valeur dedans)', segments: 'Segments', arc: 'Molette (arc)' } },
      { k: 'sColor', l: 'Couleur du slider', f: 'color', ph: '#2f9bff', help: 'Si des « Couleurs selon la valeur » sont réglées, elles prennent le dessus.' },
      { k: 'sSegs', l: 'Nombre de segments', f: 'num', ph: '12', show: function (t) { return t.sStyle === 'segments'; } },
      { k: 'sMin', l: 'Min', f: 'num', phFn: function (t) { return 'auto (' + autoRange(t).min + ')'; } },
      { k: 'sMax', l: 'Max', f: 'num', phFn: function (t) { return 'auto (' + autoRange(t).max + ')'; } },
      { k: 'sStep', l: 'Pas', f: 'num', phFn: function (t) { return 'auto (' + autoRange(t).step + ')'; } },
      F.unit, F.decimals, { k: 'orient', l: 'Orientation', f: 'sel', o: { '': 'Horizontale', vertical: 'Verticale' } },
      { k: 'plusMinus', l: 'Boutons + / −', f: 'check' }, F.th, F.wait, F.confirm],
    select: [{ k: 'cmdOn', l: 'Action select', f: 'cmd', filter: C_ACTION, help: 'Les options sont lues dans la liste de la commande' },
      { k: 'options', l: 'Ou : liste de commandes séparées', f: 'options' },
      { k: 'cmdInfo', l: 'Info de l\'option active (option)', f: 'cmd', filter: C_INFO },
      { k: 'display', l: 'Affichage', f: 'sel', o: { popup: 'Fermé, liste par-dessus la page au clic', liste: 'Liste dans la tuile', menu: 'Menu déroulant du navigateur', boutons: 'Boutons côte à côte' }, keep: true },
      { k: 'maxH', l: 'Hauteur maxi de la liste (px)', f: 'num', ph: '400', show: function (t) { return !t.display || t.display === 'popup'; } },
      { k: 'popW', l: 'Largeur mini de la liste (px)', f: 'num', ph: '260', show: function (t) { return !t.display || t.display === 'popup'; } },
      { k: 'search', l: 'Recherche', f: 'sel', o: { '': 'Auto (plus de 10 choix)', oui: 'Toujours', non: 'Jamais' }, show: function (t) { return !t.display || t.display === 'popup'; } },
      { k: 'placeholder', l: 'Texte si rien choisi', ph: '— Choisir —', show: function (t) { return !t.display || t.display === 'popup' || t.display === 'menu'; } },
      { k: 'cmdClear', l: 'Action « effacer » (option)', f: 'cmd', filter: C_ACTION }, { k: 'clearLabel', l: 'Libellé effacer', ph: 'Effacer la sélection' },
      { k: 'hide', l: 'Options masquées', ph: 'clé ou libellé, séparés par des virgules' }, { k: 'rename', l: 'Renommer', ph: '1=Coton;2=Synthétique' },
      F.confirm, F.wait],
    date: [{ k: 'cmdOn', l: 'Action (message, slider…)', f: 'cmd', filter: C_ACTION }, { k: 'cmdInfo', l: 'Info valeur actuelle (option)', f: 'cmd', filter: C_INFO },
      { k: 'dmode', l: 'Saisie', f: 'sel', o: { datetime: 'Date et heure', date: 'Date', time: 'Heure' } },
      { k: 'dformat', l: 'Format envoyé', ph: 'YYYY-MM-DD HH:mm' }, { k: 'msgTitle', l: 'Titre du message (option)' }, F.confirm, F.wait,
      { k: 'thresholds', l: 'Couleurs selon la valeur', f: 'thresholds', help: 'Jusqu\'à 10 lignes. Un nombre = à partir de cette valeur ; un texte = si égal. Remplace les couleurs par défaut.' }],
    saisie: [{ k: 'cmdOn', l: 'Action (message, slider…)', f: 'cmd', filter: C_ACTION }, { k: 'cmdInfo', l: 'Info valeur actuelle (option)', f: 'cmd', filter: C_INFO },
      { k: 'inputType', l: 'Type', f: 'sel', o: { text: 'Texte', number: 'Nombre' } }, { k: 'placeholder', l: 'Texte d\'aide' }, F.unit, { k: 'msgTitle', l: 'Titre du message (option)' }, F.confirm, F.wait,
      { k: 'thresholds', l: 'Couleurs selon la valeur', f: 'thresholds', help: 'Jusqu\'à 10 lignes. Un nombre = à partir de cette valeur ; un texte = si égal. Remplace les couleurs par défaut.' }],
    voletgroupe: [{ k: 'cmdInfos', l: 'Infos position des volets du groupe', f: 'cmdlist', filter: C_INFO, noQuick: true, help: 'La tuile affiche la position moyenne et le nombre de volets ouverts.' },
      { k: 'cmdUps', l: 'Actions monter', f: 'cmdlist', filter: C_ACTION, noQuick: true },
      { k: 'cmdStops', l: 'Actions stop', f: 'cmdlist', filter: C_ACTION, noQuick: true },
      { k: 'cmdDowns', l: 'Actions descendre', f: 'cmdlist', filter: C_ACTION, noQuick: true },
      { k: 'cmdSliders', l: 'Actions position (option : glisser sur la fenêtre)', f: 'cmdlist', filter: C_ACTION, noQuick: true },
      { k: 'confirm', l: 'Confirmation avant de monter / descendre', ph: 'vide = aucune' },
      { k: 'closedMax', l: 'Fermé jusqu\'à (%)', f: 'num', ph: '0' }, { k: 'openMin', l: 'Ouvert à partir de (%)', f: 'num', ph: '99' },
      { k: 'vbSize', l: 'Taille des boutons ▲ ■ ▼ (%)', f: 'num', ph: '140' }],
    volet: [{ k: 'cmdInfo', l: 'Info position / état', f: 'cmd', filter: C_INFO }, { k: 'cmdUp', l: 'Action monter', f: 'cmd', filter: C_ACTION },
      { k: 'cmdDown', l: 'Action descendre', f: 'cmd', filter: C_ACTION }, { k: 'cmdStop', l: 'Action stop', f: 'cmd', filter: C_ACTION },
      { k: 'cmdSlider', l: 'Action position (option)', f: 'cmd', filter: { type: 'action', subType: 'slider' }, help: 'Permet de régler la position en glissant le doigt sur la fenêtre dessinée.' },
      { k: 'vbSize', l: 'Taille des boutons ▲ ■ ▼ (%)', f: 'num', ph: '140', help: '100 = petite taille d\'origine, 140 par défaut, jusqu\'à 300.' },
      F.invert, { k: 'closedMax', l: 'Fermé jusqu\'à (%)', f: 'num', ph: '0' }, { k: 'openMin', l: 'Ouvert à partir de (%)', f: 'num', ph: '99' }, F.confirm,
      { k: 'thresholds', l: 'Couleurs selon la valeur', f: 'thresholds', help: 'Jusqu\'à 10 lignes. Un nombre = à partir de cette valeur ; un texte = si égal. Remplace les couleurs par défaut.' }],
    jauge: [F.info, { k: 'style', l: 'Style', f: 'sel', o: { cuve: 'Cuve', barre: 'Barre', anneau: 'Anneau' } },
      { k: 'gMin', l: 'Min', f: 'num', ph: 'auto (0)' }, { k: 'gMax', l: 'Max', f: 'num', ph: 'auto (100)' }, F.unit, F.decimals, F.th, { k: 'details', l: 'Courbe et détails', f: 'sel', o: { '': 'Non', clic: 'Au clic (appui long si la tuile a une action)', long: 'Appui long seulement' }, help: 'Fenêtre avec la courbe 24 h / 7 j / 30 j, min / moyenne / max et la dernière mise à jour. La commande doit être historisée.' }],
    ouvrants: [{ k: 'ovMode', l: 'Affichage', f: 'sel', o: { '': 'Liste complète (bandeau + groupes)', resume: 'Résumé (icône + « 2 ouverts »), pour l\'accueil' }, rebuild: true },
      { k: 'ovSum', l: 'Bandeau « N ouverts »', f: 'sel', o: { '': 'Afficher', non: 'Masquer' }, show: function (t) { return t.ovMode !== 'resume'; } },
      { k: 'okText', l: 'Sous-texte quand tout est fermé', ph: 'vide = rien', show: function (t) { return t.ovMode !== 'resume' && t.ovSum !== 'non'; } },
      { k: 'ovOpenFirst', l: 'Ouvrants ouverts en tête de leur groupe', f: 'check', show: function (t) { return t.ovMode !== 'resume'; } },
      { k: 'target', l: 'Au toucher, ouvre', f: 'sel', o: { page: 'Une page', home: 'L\'accueil' }, show: function (t) { return t.ovMode === 'resume'; } },
      { k: 'page', l: 'Page', f: 'page', show: function (t) { return t.ovMode === 'resume' && t.target !== 'home'; } },
      { k: 'colorOpen', l: 'Couleur ouvert', f: 'color', ph: '#ffa726' }, { k: 'colorClosed', l: 'Couleur fermé', f: 'color', ph: '#2ecc71' },
      { k: 'items', l: 'Ouvrants', f: 'lines', schema: 'ouv', help: 'Un « Titre de groupe » (RDC, Étage…) commence une nouvelle carte. Baie et fenêtre 2 vantaux : 2 contacts (gauche, droite).' }],
    kpi: [{ k: 'kpiCalc', l: 'Valeur', f: 'sel', o: { '': 'Une info', autonomie: 'Autonomie % (calculée : conso et achat)', autoconso: 'Autoconsommation % (calculée : production et revente)' }, rebuild: true },
      { k: 'cmdInfo', l: 'Info', f: 'cmd', filter: C_INFO, show: function (t) { return !t.kpiCalc; } },
      { k: 'cmdConso', l: 'Info conso du jour', f: 'cmd', filter: C_INFO, show: function (t) { return t.kpiCalc === 'autonomie'; } },
      { k: 'cmdBuy', l: 'Info achat réseau du jour', f: 'cmd', filter: C_INFO, show: function (t) { return t.kpiCalc === 'autonomie'; } },
      { k: 'cmdProd', l: 'Info production du jour', f: 'cmd', filter: C_INFO, show: function (t) { return t.kpiCalc === 'autoconso'; } },
      { k: 'cmdSell', l: 'Info revente du jour', f: 'cmd', filter: C_INFO, show: function (t) { return t.kpiCalc === 'autoconso'; } },
      { k: 'unit', l: 'Unité', ph: 'auto (W passe en kW au-delà de 1000)', show: function (t) { return !t.kpiCalc; } },
      { k: 'decimals', l: 'Décimales', f: 'num', ph: 'auto', show: function (t) { return !t.kpiCalc; } },
      { k: 'accent', l: 'Couleur', f: 'color', ph: '#ffb000' },
      { k: 'subText', l: 'Petite ligne', ph: '{1} kWh aujourd\'hui', help: '{1} = valeur de l\'info ci-dessous (Wh converti en kWh).' },
      { k: 'cmdSub', l: 'Info de la petite ligne (option)', f: 'cmd', filter: C_INFO },
      { k: 'subDecimals', l: 'Décimales de la petite ligne', f: 'num', ph: '1' },
      { k: 'thresholds', l: 'Couleurs selon la valeur', f: 'thresholds' },
      { k: 'details', l: 'Courbe au toucher', f: 'sel', o: { '': 'Oui', non: 'Non' } }],
    batterie2: [{ k: 'cmdSoc', l: 'Info charge (%)', f: 'cmd', filter: C_INFO }, { k: 'cmdPower', l: 'Info puissance batterie (W)', f: 'cmd', filter: C_INFO },
      { k: 'powerSign', l: 'Sens de la puissance', f: 'sel', o: { '': 'Positive = charge', inv: 'Positive = décharge' } },
      { k: 'capacity', l: 'Capacité (kWh)', f: 'num', ph: 'ex. 14.2', help: 'Pour « énergie stockée », « pleine vers » et « tiendra jusqu\'à ».' },
      { k: 'minSoc', l: 'Charge mini utilisable (%)', f: 'num', ph: '0', help: 'Ex. SOC mini ESS : « tiendra jusqu\'à » s\'arrête à ce niveau.' },
      { k: 'socLow', l: 'Rouge sous (%)', f: 'num', ph: '20' }, { k: 'socMid', l: 'Orange sous (%)', f: 'num', ph: '50' },
      { k: 'cmdOn', l: 'Action Marche (option)', f: 'cmd', filter: C_ACTION }, { k: 'cmdOff', l: 'Action Arrêt (option)', f: 'cmd', filter: C_ACTION },
      { k: 'cmdAuto', l: 'Action Auto (option, 3e bouton)', f: 'cmd', filter: C_ACTION },
      { k: 'cmdState', l: 'Info état (option)', f: 'cmd', filter: C_INFO, help: 'Allume le bouton de l\'état : « auto », sinon Marche (1 / on / marche) ou Arrêt.' }, { k: 'onValue', l: 'Valeur « Marche »', ph: '1 / On' },
      { k: 'autoValue', l: 'Valeur « Auto »', ph: 'auto', show: function (t) { return !!t.cmdAuto; } }, { k: 'labelAuto', l: 'Texte bouton Auto', ph: 'Auto', show: function (t) { return !!t.cmdAuto; } },
      { k: 'labelOn', l: 'Texte bouton Marche', ph: 'Marche' }, { k: 'labelOff', l: 'Texte bouton Arrêt', ph: 'Arrêt' },
      { k: 'confirmOff', l: 'Confirmation avant Arrêt', ph: 'Arrêter la batterie ?' },
      { k: 'details', l: 'Courbe au toucher', f: 'sel', o: { '': 'Oui', non: 'Non' } }],
    bilanjour: [{ k: 'cmdProd', l: 'Production', f: 'cmd', filter: C_INFO }, { k: 'cmdProdCum', l: '↳ compteur cumulé (total)', f: 'check', help: 'Coché : la valeur du jour = valeur actuelle − valeur à minuit (historique Jeedom, commande historisée conseillée).', show: function (t) { return !!t.cmdProd; } },
      { k: 'cmdForecast', l: 'Prévision du jour (option)', f: 'cmd', filter: C_INFO },
      { k: 'consoCalc', l: 'Consommation', f: 'sel', o: { '': 'Une info', calc: 'Calculée : production + achat − revente − charge + décharge batterie' }, rebuild: true },
      { k: 'cmdConso', l: 'Consommation', f: 'cmd', filter: C_INFO, show: function (t) { return t.consoCalc !== 'calc'; } }, { k: 'cmdConsoCum', l: '↳ compteur cumulé (total)', f: 'check', help: 'Coché : la valeur du jour = valeur actuelle − valeur à minuit (historique Jeedom, commande historisée conseillée).', show: function (t) { return !!t.cmdConso && t.consoCalc !== 'calc'; } },
      { k: 'cmdBuy', l: 'Achat réseau', f: 'cmd', filter: C_INFO }, { k: 'cmdBuyCum', l: '↳ compteur cumulé (total)', f: 'check', help: 'Coché : la valeur du jour = valeur actuelle − valeur à minuit (historique Jeedom, commande historisée conseillée).', show: function (t) { return !!t.cmdBuy; } },
      { k: 'cmdSell', l: 'Revente (option)', f: 'cmd', filter: C_INFO }, { k: 'cmdSellCum', l: '↳ compteur cumulé (total)', f: 'check', help: 'Coché : la valeur du jour = valeur actuelle − valeur à minuit (historique Jeedom, commande historisée conseillée).', show: function (t) { return !!t.cmdSell; } },
      { k: 'cmdBatIn', l: 'Énergie entrée batterie (option)', f: 'cmd', filter: C_INFO }, { k: 'cmdBatInCum', l: '↳ compteur cumulé (total)', f: 'check', help: 'Coché : la valeur du jour = valeur actuelle − valeur à minuit (historique Jeedom, commande historisée conseillée).', show: function (t) { return !!t.cmdBatIn; } },
      { k: 'cmdBatOut', l: 'Énergie sortie batterie (option, pour le calcul)', f: 'cmd', filter: C_INFO }, { k: 'cmdBatOutCum', l: '↳ compteur cumulé (total)', f: 'check', help: 'Coché : la valeur du jour = valeur actuelle − valeur à minuit (historique Jeedom, commande historisée conseillée).', show: function (t) { return !!t.cmdBatOut; } },
      { k: 'decimals', l: 'Décimales', f: 'num', ph: '1' }, { k: 'details', l: 'Courbe au toucher', f: 'sel', o: { '': 'Oui', non: 'Non' } }],
    prevsolaire: [{ k: 'cmdToday', l: 'Produit aujourd\'hui', f: 'cmd', filter: C_INFO }, { k: 'cmdForecast', l: 'Prévu aujourd\'hui (option)', f: 'cmd', filter: C_INFO },
      { k: 'cmdRemain', l: 'Encore à venir aujourd\'hui (option)', f: 'cmd', filter: C_INFO }, { k: 'cmdTomorrow', l: 'Demain', f: 'cmd', filter: C_INFO },
      { k: 'cmdAfter', l: 'Après-demain (option)', f: 'cmd', filter: C_INFO }, { k: 'color', l: 'Couleur', f: 'color', ph: '#ffb000' },
      { k: 'decimals', l: 'Décimales', f: 'num', ph: '1' }, { k: 'details', l: 'Courbe au toucher', f: 'sel', o: { '': 'Oui', non: 'Non' } }],
    conseils: [{ k: 'cmdText', l: 'Info texte des conseils', f: 'cmd', filter: C_INFO, help: 'Une ligne par conseil (retour à la ligne, « | » ou « ; »).' },
      { k: 'cmdText2', l: 'Info texte en plus (option, ex. jours suivants)', f: 'cmd', filter: C_INFO },
      { k: 'cmdPending', l: 'Info plan en attente de validation (option)', f: 'cmd', filter: C_INFO },
      { k: 'cmdAccept', l: 'Action Valider', f: 'cmd', filter: C_ACTION, show: function (t) { return !!t.cmdPending; } },
      { k: 'cmdRefuse', l: 'Action Refuser', f: 'cmd', filter: C_ACTION, show: function (t) { return !!t.cmdPending; } },
      { k: 'okText', l: 'Texte s\'il n\'y a rien', ph: 'Aucun conseil pour le moment' },
      { k: 'cmdMode', l: 'Info mode (option)', f: 'cmd', filter: C_INFO },
      { k: 'options', l: 'Boutons de mode (libellé = valeur du mode)', f: 'options' },
      { k: 'confirm', l: 'Confirmation avant de changer de mode', ph: 'vide = aucune' }],
    lignes: [{ k: 'lnAlign', l: 'Présentation', f: 'sel', o: { '': 'Tableau : libellés à gauche, valeurs alignées à droite', centre: 'Centrée (libellé : valeur)' } }, { k: 'lines', l: 'Lignes', f: 'lines' }],
    texte: [{ k: 'evList', l: 'Journal : une ligne par événement (info {1})', f: 'check', rebuild: true, help: 'Pour une info qui contient plusieurs événements à la suite (« 02/11 18:08 🔓 Désarmement… 02/11 18:07 🔒 Armement… ») : une ligne par date, le plus récent en haut, couleur selon l\'événement.' },
      { k: 'evMax', l: 'Nombre d\'événements affichés', f: 'num', ph: '8', show: function (t) { return !!t.evList; } },
      { k: 'template', l: 'Texte', f: 'area', ph: '{1}°C | {2}%', help: '{1} à {4} sont remplacés par les infos ci-dessous', show: function (t) { return !t.evList; } },
      { k: 'cmdV1', l: 'Info {1}', f: 'cmd', filter: C_INFO }, { k: 'cmdV2', l: 'Info {2}', f: 'cmd', filter: C_INFO },
      { k: 'cmdV3', l: 'Info {3}', f: 'cmd', filter: C_INFO }, { k: 'cmdV4', l: 'Info {4}', f: 'cmd', filter: C_INFO },
      F.decimals, F.min, F.max,
      { k: 'align', l: 'Alignement', f: 'sel', o: { '': 'Centré', gauche: 'À gauche' } }, { k: 'color', l: 'Couleur', f: 'color' },
      { k: 'thresholds', l: 'Couleurs selon {1}', f: 'thresholds' }, { k: 'cmdOn', l: 'Action au clic (option)', f: 'cmd', filter: C_ACTION }],
    horloge: [{ k: 'format', l: 'Affichage', f: 'sel', o: { date: 'jeudi 22 octobre', complet: 'jeudi 22 octobre 2026', heure: '22:15', dateheure: 'jeudi 22 octobre · 22:15' } },
      { k: 'align', l: 'Alignement', f: 'sel', o: { '': 'Centré', gauche: 'À gauche' } }, { k: 'color', l: 'Couleur', f: 'color' }],
    lien: [{ k: 'target', l: 'Ouvre', f: 'sel', o: { home: 'L\'accueil', page: 'Une page Tuiles', url: 'Une adresse (Design, dashboard…)', index: 'La liste des pages' } },
      { k: 'page', l: 'Page', f: 'page', show: function (t) { return t.target === 'page'; } },
      { k: 'url', l: 'Adresse', ph: 'index.php?v=d&p=plan&plan_id=1', show: function (t) { return t.target === 'url'; } },
      { k: 'newTab', l: 'Nouvel onglet', f: 'check', show: function (t) { return t.target === 'url'; } },
      { k: 'icon', l: 'Icône(s)', f: 'icon', help: 'Plusieurs icônes : séparez par |' }, { k: 'img', l: 'Ou image (adresse)', ph: 'plugins/…/logo.png' },
      { k: 'animOn', l: 'Animer l\'icône / l\'image', f: 'check', keepFalse: true, defOn: function (t) { return !t.cmdAnim && hasAnimIcon(t); }, help: 'Sans condition : coché = animée en permanence, décoché = fixe. Une image ou une icône simple pulse ; une icône animée bouge.' },
      { k: 'cmdAnim', l: 'Animer seulement si l\'info…', f: 'cmd', filter: C_INFO, help: 'Option. Renseignée : animée quand la condition est vraie, sinon fixe (la case ci-dessus est alors ignorée).' },
      { k: 'animOp', l: '…a une valeur', f: 'sel', o: { '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤' }, keep: true, show: function (t) { return !!t.cmdAnim; } },
      { k: 'animVal', l: 'Valeur', ph: '1', show: function (t) { return !!t.cmdAnim; } },
      F.animSpeed,
      { k: 'color', l: 'Couleur de l\'icône', f: 'color', ph: '#ffffff' }, { k: 'desc', l: 'Sous-titre (option)' },
      { k: 'cmdList', l: 'Compteur : nombre de commandes…', f: 'cmdlist' },
      { k: 'countOp', l: '…dont la valeur est', f: 'sel', o: { '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤' }, show: function (t) { return t.cmdList && t.cmdList.length; } },
      { k: 'countVal', l: 'Valeur comptée', ph: '1', show: function (t) { return t.cmdList && t.cmdList.length; } },
      { k: 'cmdBadge', l: 'Ou : badge = valeur d\'une info', f: 'cmd', filter: C_INFO, show: function (t) { return !(t.cmdList && t.cmdList.length); } },
      { k: 'hideZero', l: 'Masquer le badge à 0', f: 'check' }, { k: 'thresholds', l: 'Couleur de l\'icône selon le compteur', f: 'thresholds' }],
    lien2: [{ k: 'l2Dir', l: 'Disposition', f: 'sel', o: { '': 'Côte à côte', dessus: 'L\'un au-dessus de l\'autre' } }, { k: 'l2Sep', l: 'Trait de séparation', f: 'sel', o: { '': 'Oui', non: 'Non' }, keep: true }, { k: 'l2Fit', l: 'Images', f: 'sel', o: { '': 'Entières', cover: 'Remplir la moitié (rognées)' } }, F.animSpeed,
      { k: 'aLabel', l: 'Lien 1 : texte', ph: 'aucun' },
      { k: 'aDesc', l: 'Lien 1 : sous-texte (sous l\'image)', ph: 'aucun', help: 'Petit texte sous le texte principal. Avec une info ci-dessous : # est remplacé par sa valeur (ex. « # ouverts »), sinon la valeur est ajoutée à la fin.' },
      { k: 'cmdDescA', l: 'Lien 1 : valeur d\'une info dans le sous-texte (option)', f: 'cmd', filter: C_INFO },
      { k: 'descMapA', l: 'Lien 1 : libellés de la valeur', ph: 'disarmed=Désarmée;armed_away=Armée', show: function (t) { return !!t.cmdDescA; } },
      { k: 'aTarget', l: 'Lien 1 : ouvre', f: 'sel', o: { page: 'Une page Tuiles', home: 'L\'accueil', url: 'Une adresse (Design, dashboard…)', index: 'La liste des pages' }, keep: true },
      { k: 'aPage', l: 'Lien 1 : page', f: 'page', show: function (t) { return !t.aTarget || t.aTarget === 'page'; } },
      { k: 'aUrl', l: 'Lien 1 : adresse', ph: 'index.php?v=d&p=plan&plan_id=1', show: function (t) { return t.aTarget === 'url'; } },
      { k: 'aNewTab', l: 'Lien 1 : nouvel onglet', f: 'check', show: function (t) { return t.aTarget === 'url'; } },
      { k: 'aImg', l: 'Lien 1 : image (adresse)', ph: 'plugins/…/photo.jpg', help: 'Une image (photo, logo). Vide = l\'icône ci-dessous.' },
      { k: 'aIcon', l: 'Lien 1 : icône', f: 'icon', show: function (t) { return !t.aImg; } },
      { k: 'aColor', l: 'Lien 1 : couleur', f: 'color', ph: '#ffffff' },
      { k: 'animOnA', l: 'Lien 1 : Animer l\'icône / l\'image', f: 'check', keepFalse: true, defOn: function (t) { return !t.cmdAnimA && /svg:a-/.test(t.aIcon || ''); }, help: 'Sans condition : coché = animée en permanence, décoché = fixe. Une image ou une icône simple pulse ; une icône animée bouge.' },
      { k: 'cmdAnimA', l: 'Lien 1 : Animer seulement si l\'info…', f: 'cmd', filter: C_INFO, help: 'Option. Renseignée : animée quand la condition est vraie, sinon fixe (la case ci-dessus est alors ignorée).' },
      { k: 'animOpA', l: 'Lien 1 : …a une valeur', f: 'sel', o: { '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤' }, keep: true, show: function (t) { return !!t.cmdAnimA; } },
      { k: 'animValA', l: 'Lien 1 : Valeur', ph: '1', show: function (t) { return !!t.cmdAnimA; } },
      { k: 'bLabel', l: 'Lien 2 : texte', ph: 'aucun' },
      { k: 'bDesc', l: 'Lien 2 : sous-texte (sous l\'image)', ph: 'aucun', help: 'Petit texte sous le texte principal. Avec une info ci-dessous : # est remplacé par sa valeur (ex. « # ouverts »), sinon la valeur est ajoutée à la fin.' },
      { k: 'cmdDescB', l: 'Lien 2 : valeur d\'une info dans le sous-texte (option)', f: 'cmd', filter: C_INFO },
      { k: 'descMapB', l: 'Lien 2 : libellés de la valeur', ph: 'disarmed=Désarmée;armed_away=Armée', show: function (t) { return !!t.cmdDescB; } },
      { k: 'bTarget', l: 'Lien 2 : ouvre', f: 'sel', o: { page: 'Une page Tuiles', home: 'L\'accueil', url: 'Une adresse (Design, dashboard…)', index: 'La liste des pages' }, keep: true },
      { k: 'bPage', l: 'Lien 2 : page', f: 'page', show: function (t) { return !t.bTarget || t.bTarget === 'page'; } },
      { k: 'bUrl', l: 'Lien 2 : adresse', ph: 'index.php?v=d&p=plan&plan_id=1', show: function (t) { return t.bTarget === 'url'; } },
      { k: 'bNewTab', l: 'Lien 2 : nouvel onglet', f: 'check', show: function (t) { return t.bTarget === 'url'; } },
      { k: 'bImg', l: 'Lien 2 : image (adresse)', ph: 'plugins/…/photo.jpg', help: 'Une image (photo, logo). Vide = l\'icône ci-dessous.' },
      { k: 'bIcon', l: 'Lien 2 : icône', f: 'icon', show: function (t) { return !t.bImg; } },
      { k: 'bColor', l: 'Lien 2 : couleur', f: 'color', ph: '#ffffff' },
      { k: 'animOnB', l: 'Lien 2 : Animer l\'icône / l\'image', f: 'check', keepFalse: true, defOn: function (t) { return !t.cmdAnimB && /svg:a-/.test(t.bIcon || ''); }, help: 'Sans condition : coché = animée en permanence, décoché = fixe. Une image ou une icône simple pulse ; une icône animée bouge.' },
      { k: 'cmdAnimB', l: 'Lien 2 : Animer seulement si l\'info…', f: 'cmd', filter: C_INFO, help: 'Option. Renseignée : animée quand la condition est vraie, sinon fixe (la case ci-dessus est alors ignorée).' },
      { k: 'animOpB', l: 'Lien 2 : …a une valeur', f: 'sel', o: { '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤' }, keep: true, show: function (t) { return !!t.cmdAnimB; } },
      { k: 'animValB', l: 'Lien 2 : Valeur', ph: '1', show: function (t) { return !!t.cmdAnimB; } }],
    image: [{ k: 'img', l: 'Adresse de l\'image', ph: 'plugins/…/logo.png' }, { k: 'fit', l: 'Ajustement', f: 'sel', o: { contain: 'Entière', cover: 'Remplir' } },
      { k: 'url', l: 'Lien au clic (option)' }],
    vide: [],
    widget: [{ k: 'eqId', l: 'Équipement', f: 'eq', help: 'Le widget du dashboard de cet équipement est affiché dans la tuile (ex. plugin de flux d\'énergie). Il se met à jour tout seul.' },
      { k: 'wFit', l: 'Ajustement', f: 'sel', o: { '': 'Adapter à la tuile (entier)', cover: 'Remplir la tuile (rogné)', none: 'Taille réelle' } },
      { k: 'wHideName', l: 'Nom de l\'équipement (barre de titre du widget)', f: 'sel', o: { '': 'Masquer', non: 'Afficher' } },
      { k: 'wTransparent', l: 'Fond du widget transparent', f: 'check' },
      { k: 'wZoom', l: 'Bouton plein écran', f: 'check' }],
    lumiere: [
      { k: 'cmdState', l: 'Info état (allumé / éteint)', f: 'cmd', filter: C_INFO, help: 'Retour d\'état : binaire 0/1. Vide sur un variateur = allumé si la luminosité est > 0.' },
      { k: 'onValue', l: 'Valeur « allumé » (option)', ph: '1', help: 'Si l\'info n\'est pas binaire (ex. ON).' },
      { k: 'cmdOn', l: 'Action allumer', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdOff', l: 'Action éteindre', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdToggle', l: 'Ou action basculer (toggle)', f: 'cmd', filter: C_ACTION },
      { k: 'liColor', l: 'Couleur de la lumière', f: 'color', ph: '#ffc94a', help: 'Vide = blanc chaud.' }],
    variateur: [
      { k: 'cmdState', l: 'Info état (allumé / éteint)', f: 'cmd', filter: C_INFO, help: 'Retour d\'état : binaire 0/1. Vide sur un variateur = allumé si la luminosité est > 0.' },
      { k: 'onValue', l: 'Valeur « allumé » (option)', ph: '1', help: 'Si l\'info n\'est pas binaire (ex. ON).' },
      { k: 'cmdOn', l: 'Action allumer', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdOff', l: 'Action éteindre', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdToggle', l: 'Ou action basculer (toggle)', f: 'cmd', filter: C_ACTION },
      { k: 'cmdSlider', l: 'Action variation (slider)', f: 'cmd', filter: C_ACTION, help: 'Sans actions allumer / éteindre, un appui sur la tuile passe le variateur à 0 ou au dernier niveau.' },
      { k: 'cmdLevel', l: 'Info luminosité', f: 'cmd', filter: C_INFO, help: 'Vide = l\'info liée à l\'action slider.' },
      { k: 'liMin', l: 'Mini', f: 'num', ph: 'auto (0)', half: true },
      { k: 'liMax', l: 'Maxi', f: 'num', ph: 'auto (100)', half: true },
      { k: 'liStep', l: 'Pas', f: 'num', ph: '1', half: true },
      { k: 'liColor', l: 'Couleur de la lumière', f: 'color', ph: '#ffc94a', help: 'Vide = blanc chaud.' }],
    interphone: [{ k: 'eqId', l: 'Équipement interphone', f: 'eq', pluginRe: /hik/i, help: 'Les commandes du plugin hikinterphone sont retrouvées automatiquement ; vérifiez-les ci-dessous.', onPick: function (t, e) { fillHik(t, e.id).then(function () { onTileChange({ f: 'sel' }); }).catch(fail); } },
      { k: 'cmdEtat', l: 'Info état appel', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdRing', l: 'Info sonnerie', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdTalk', l: 'Info en communication', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdOnline', l: 'Info en ligne', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdAnswer', l: 'Action décrocher', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdHangup', l: 'Action raccrocher', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdReject', l: 'Action refuser', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdOpen', l: 'Action ouvrir la porte', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'openLabel', l: 'Texte du bouton porte', ph: 'Ouvrir', half: true },
      { k: 'cmdOpen2', l: 'Action 2e sortie (option)', f: 'cmd', filter: C_ACTION, half: true, help: 'Deuxième relais du portier (ex. portail) : ajoute un 2e bouton.' },
      { k: 'openLabel2', l: 'Texte du 2e bouton', ph: 'Ouvrir 2', half: true, show: function (t) { return !!t.cmdOpen2; } },
      { k: 'doorConfirm', l: 'Confirmer l\'ouverture', f: 'sel', o: { '': 'Oui', non: 'Non' }, keep: true },
      { k: 'cmdTalkUrl', l: 'Info lien Parler (two-way audio)', f: 'cmd', filter: C_INFO, help: 'Commande « Lien Parler » du plugin hikinterphone : ajoute un bouton Parler (micro de la tablette).' },
      { k: 'talkMode', l: 'Parler : mode', f: 'sel', o: { '': 'Appuyer pour parler', free: 'Mains libres' }, keep: true, show: function (t) { return !!t.cmdTalkUrl; } },
      { k: 'talkOnAnswer', l: 'Décrocher ouvre aussi Parler', f: 'check', show: function (t) { return !!t.cmdTalkUrl; } },
      { k: 'talkAlways', l: 'Bouton Parler aussi au repos', f: 'check', show: function (t) { return !!t.cmdTalkUrl; } },
      { k: 'ringPopup', l: 'Fenêtre automatique quand ça sonne', f: 'check', help: 'Sur la tablette, une fenêtre s\'ouvre avec l\'image et les boutons dès qu\'on sonne, et se ferme 4 s après la fin de l\'appel.' },
      { k: 'ringAll', l: 'Fenêtre sur toutes les pages', f: 'check', show: function (t) { return !!t.ringAll; }, help: 'Ancien réglage : utilisez plutôt Navigation → Fenêtre portier (activer, désactiver, taille…).' },
      { k: 'cmdEvent', l: 'Info dernier événement (option)', f: 'cmd', filter: C_INFO },
      { k: 'showEvent', l: 'Afficher le dernier événement', f: 'check' },
      { k: 'frigateUrl', l: 'Caméra : adresse de Frigate (option)', ph: 'http://192.168.1.x:5000' },
      { k: 'frigateCam', l: 'Caméra : nom dans Frigate', ph: 'ex. portier' },
      { k: 'camProxy', l: 'Via Jeedom (accès à distance)', f: 'check', help: 'L\'image passe par Jeedom : visible partout où Jeedom l\'est, sans ouvrir Frigate à l\'extérieur. Enregistrez la page pour l\'activer.' },
      { k: 'camRefresh', l: 'Image au repos : toutes les (s)', f: 'num', ph: '10', help: 'Pendant un appel, l\'image se rafraîchit chaque seconde.' }],
    bonspoints: [{ k: 'eqId', l: 'Enfant (équipement bonsPoints)', f: 'eq', pluginRe: /bonspoints/i, help: 'Scores, comportements (boutons) et paliers sont repris automatiquement. Après avoir modifié les comportements ou les paliers dans le plugin, choisissez à nouveau l\'équipement pour les relire.', onPick: function (t, e) { fillBonsPoints(t, e.id).then(function () { onTileChange({ f: 'sel' }); }).catch(fail); } },
      { k: 'bpStyle', l: 'Format', f: 'sel', o: { grande: 'Grande : chemin des paliers + boutons (parents)', compacte: 'Compacte : anneau (vue enfant)', mini: 'Mini : score + récompenses' }, keep: true },
      { k: 'bpKidBtns', l: 'Boutons sur la vue compacte', f: 'sel', o: { '': 'Aucun', plus: 'Seulement les « + »', tous: 'Tous' }, keep: true, show: function (t) { return t.bpStyle === 'compacte'; } },
      { k: 'bpIcons', l: 'Icônes des paliers (dans l\'ordre)', ph: '🍨 🎳 🏉 🎁 ⭐ 🏆', help: 'Un emoji par palier, séparés par un espace, du plus petit au plus grand.' },
      { k: 'bpSancIcons', l: 'Icônes des sanctions (paliers négatifs)', ph: '⛔', help: 'Un palier à points négatifs est une sanction : déclenchée quand le score descend jusqu\'à ce palier. Un emoji par sanction, de la plus légère à la plus lourde.' },
      { k: 'bpNeg', l: 'Zone rouge jusqu\'à', f: 'num', ph: '-10', help: 'Bas de la barre / de l\'anneau quand le score est négatif.' },
      { k: 'bpCols', l: 'Colonnes de boutons', f: 'num', ph: '3', show: function (t) { return !t.bpStyle || t.bpStyle === 'grande' || t.bpStyle === 'compacte'; } },
      { k: 'bpUndoConfirm', l: 'Confirmer « Annuler »', f: 'check' },
      { k: 'cmdScore', l: 'Info score semaine', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdPrev', l: 'Info semaine précédente', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdTotal', l: 'Info score total', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdLast', l: 'Info dernier événement', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdActif', l: 'Info suivi actif (garde)', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdUndo', l: 'Action annuler le dernier', f: 'cmd', filter: C_ACTION, half: true }],
    thermostat: [{ k: 'cmdTemp', l: 'Température mesurée', f: 'cmd', filter: C_INFO },
      { k: 'cmdSet', l: 'Action consigne (slider)', f: 'cmd', filter: C_ACTION, help: 'Commande action de type slider qui règle la consigne.' },
      { k: 'cmdSetInfo', l: 'Info consigne', f: 'cmd', filter: C_INFO, help: 'Vide = l\'info liée à l\'action consigne.' },
      { k: 'thKind', l: 'Type', f: 'sel', o: { chauffage: 'Chauffage (orange)', clim: 'Climatisation (bleu)', auto: 'Pompe à chaleur / auto (vert)' }, keep: true },
      { k: 'thMin', l: 'Consigne mini', f: 'num', ph: 'auto (5)', half: true },
      { k: 'thMax', l: 'Consigne maxi', f: 'num', ph: 'auto (30)', half: true },
      { k: 'thStep', l: 'Pas', f: 'num', ph: '0.5', half: true },
      { k: 'cmdState', l: 'Info en chauffe / en marche (binaire)', f: 'cmd', filter: C_INFO, help: 'L\'anneau s\'illumine quand l\'appareil chauffe ou refroidit.' },
      { k: 'cmdMode', l: 'Info mode (option)', f: 'cmd', filter: C_INFO, help: 'Le bouton dont le libellé correspond à la valeur est mis en avant.' },
      { k: 'options', l: 'Boutons de mode (libellé + action)', f: 'options' },
      { k: 'cmdPower', l: 'Info marche / arrêt (option)', f: 'cmd', filter: C_INFO },
      { k: 'cmdPowerOn', l: 'Action marche (option)', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdPowerOff', l: 'Action arrêt (option)', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'details', l: 'Courbe de la température', f: 'sel', o: { '': 'Non', long: 'Oui (appui long sur la température)' } }],
    alarme: [{ k: 'eqId', l: 'Équipement alarme', f: 'eq', pluginRe: /risco/i, help: 'Les commandes de la partition (P1 Armé, P1 Armer total…) et des zones sont retrouvées automatiquement.', onPick: function (t, e) { fillRisco(t, e.id).then(function () { onTileChange({ f: 'sel' }); }).catch(fail); } },
      { k: 'rsPart', l: 'Partition (numéro)', f: 'num', ph: '1', after: function (t) { if (cleanId(t.eqId)) fillRisco(t, t.eqId).then(function () { onTileChange({ f: 'sel' }); }).catch(fail); } },
      { k: 'rsConfirm', l: 'Confirmation avant d\'armer / désarmer', f: 'sel', o: { '': 'Oui', non: 'Non' } },
      { k: 'rsName', l: 'Nom de la partition', f: 'sel', o: { '': 'Afficher', non: 'Masquer' } },
      { k: 'rsZonesShow', l: 'Prête / pas prête', f: 'sel', o: { '': 'Afficher (« prête » ou « pas prête » et pourquoi)', pb: 'Seulement « pas prête » et pourquoi', non: 'Masquer' } },
      { k: 'rsTroubles', l: 'Défauts de la centrale', f: 'sel', o: { '': 'Afficher s\'il y en a', non: 'Masquer' } },
      { k: 'rsLast', l: 'Dernier événement', f: 'sel', o: { '': 'Afficher', non: 'Masquer' } },
      { k: 'cmdArmed', l: 'Info armé', f: 'cmd', filter: C_INFO },
      { k: 'cmdPartial', l: 'Info armé partiel', f: 'cmd', filter: C_INFO },
      { k: 'cmdAlarm', l: 'Info en alarme', f: 'cmd', filter: C_INFO },
      { k: 'cmdTriggered', l: 'Info déclenché', f: 'cmd', filter: C_INFO },
      { k: 'cmdReady', l: 'Info prêt', f: 'cmd', filter: C_INFO },
      { k: 'cmdArmTotal', l: 'Action armer total', f: 'cmd', filter: C_ACTION },
      { k: 'cmdArmPartial', l: 'Action armer partiel', f: 'cmd', filter: C_ACTION },
      { k: 'cmdDisarm', l: 'Action désarmer', f: 'cmd', filter: C_ACTION }],
    zones: [{ k: 'eqId', l: 'Équipement alarme', f: 'eq', pluginRe: /risco/i, help: 'Les zones (Z1 Nom, Z1 Ouvert, Z1 Alarme, Z1 Bypassé, Z1 Bypasser…) sont retrouvées automatiquement.', onPick: function (t, e) { fillRisco(t, e.id).then(function () { onTileChange({ f: 'sel' }); }).catch(fail); } },
      { k: 'zsMode', l: 'Afficher', f: 'sel', o: { '': 'Seulement les zones ouvertes, en alarme ou bypassées', tous: 'Toutes les zones' } },
      { k: 'zsPart', l: 'Seulement la partition (numéro)', f: 'num', ph: 'toutes' },
      { k: 'okText', l: 'Texte quand tout est fermé', ph: 'Toutes les zones sont fermées' },
      { k: 'lsSize', l: 'Taille du texte et des lignes (%)', f: 'num', ph: '100' },
      { k: 'lsFill', l: 'Lignes', f: 'sel', o: { '': 'Taille normale, en haut de la tuile', remplir: 'Remplir la hauteur de la tuile' } },
      { k: 'lsCols', l: 'Colonnes', f: 'sel', o: { '1': '1 colonne', '2': '2 colonnes', '3': '3 colonnes', '4': '4 colonnes', auto: 'Automatique selon la largeur' } }],
    vigieau: [{ k: 'eqId', l: 'Équipement VigiEau', f: 'eq', pluginRe: /vigi/i, help: 'Les commandes (niveau, zone, arrêté, dates, mesures) sont retrouvées automatiquement ; vérifiez-les ci-dessous.', onPick: function (t, e) { fillVigieau(t, e.id).then(function () { onTileChange({ f: 'sel' }); }).catch(fail); } },
      { k: 'vgStyle', l: 'Affichage', f: 'sel', o: { '': 'Complet (zone, arrêté, dates, mesures)', compact: 'Compact (niveau et barre)' } },
      { k: 'vgInfo', l: 'Rappel du niveau (objectif et exemples nationaux)', f: 'sel', o: { '': 'Afficher (mode complet)', non: 'Masquer' } },
      { k: 'cmdLevel', l: 'Info niveau (0 à 4 ou texte)', f: 'cmd', filter: C_INFO },
      { k: 'cmdLevelTxt', l: 'Info libellé de la restriction', f: 'cmd', filter: C_INFO },
      { k: 'cmdCommune', l: 'Info commune', f: 'cmd', filter: C_INFO },
      { k: 'cmdZone', l: 'Info zone', f: 'cmd', filter: C_INFO },
      { k: 'cmdUsage', l: 'Info type d\'eau', f: 'cmd', filter: C_INFO },
      { k: 'cmdArrete', l: 'Info arrêté de restriction', f: 'cmd', filter: C_INFO },
      { k: 'cmdCadre', l: 'Info arrêté cadre', f: 'cmd', filter: C_INFO },
      { k: 'cmdStart', l: 'Info date de début', f: 'cmd', filter: C_INFO },
      { k: 'cmdEnd', l: 'Info date de fin', f: 'cmd', filter: C_INFO },
      { k: 'cmdMesures', l: 'Info mesures', f: 'cmd', filter: C_INFO },
      { k: 'cmdImport', l: 'Info date d\'import', f: 'cmd', filter: C_INFO }],
    sante: [{ k: 'hsStyle', l: 'Affichage', f: 'sel', o: { '': 'Liste des problèmes avec onglets (Piles, Réseau…)', resume: 'Résumé : grand compteur de problèmes', vm: 'VM Jeedom : jauges (plugin Monitoring)' }, keep: true },
      { k: 'hsBat', l: '🔋 Piles faibles', f: 'check', keepFalse: true, defOn: function () { return true; } },
      { k: 'hsStale', l: 'Piles sans nouvelles depuis (h)', f: 'num', ph: '72', help: '0 = ne pas signaler.' },
      { k: 'hsNet', l: '📡 Réseau hors ligne (plugin Network)', f: 'check', keepFalse: true, defOn: function () { return true; } },
      { k: 'hsDm', l: '⚙ Démons et dépendances', f: 'check', keepFalse: true, defOn: function () { return true; } },
      { k: 'hsTo', l: '⏱ Équipements qui ne communiquent plus', f: 'check' },
      { k: 'hsVm', l: 'VM Jeedom (commandes du plugin Monitoring)', f: 'lines', schema: 'vm', help: 'Une ligne par valeur : disque, mémoire, CPU… Au-delà des seuils, elle compte comme un problème.' },
      { k: 'hsIgnore', l: 'Ignorer (noms, séparés par ;)', ph: 'ex. OMG Garage; HomeAssistant' },
      { k: 'okText', l: 'Texte quand tout va bien', ph: 'Aucun problème' },
      { k: 'hsEvery', l: 'Vérifier toutes les (s)', f: 'num', ph: '300' }],
    demons: [{ k: 'dmMode', l: 'Afficher', f: 'sel', o: { '': 'Seulement les problèmes', tous: 'Tous les plugins avec démon ou dépendances' }, help: 'Problème = démon arrêté alors que sa gestion automatique est activée, ou dépendances non installées. Un appui sur une ligne : démarrer, redémarrer, arrêter, relancer les dépendances, gestion automatique, logs (droits administrateur).' },
      { k: 'dmEvery', l: 'Vérifier toutes les (s)', f: 'num', ph: '60' },
      { k: 'okText', l: 'Texte quand tout va bien', ph: 'Démons et dépendances OK' },
      { k: 'lsSize', l: 'Taille du texte et des lignes (%)', f: 'num', ph: '100' },
      { k: 'lsFill', l: 'Lignes', f: 'sel', o: { '': 'Taille normale, en haut de la tuile', remplir: 'Remplir la hauteur de la tuile' } },
      { k: 'lsCols', l: 'Colonnes', f: 'sel', o: { '1': '1 colonne', '2': '2 colonnes', '3': '3 colonnes', '4': '4 colonnes', auto: 'Automatique selon la largeur' } }],
    reseau: [{ k: 'ntMode', l: 'Afficher', f: 'sel', o: { '': 'Seulement les équipements hors ligne', tous: 'Tous (hors ligne en premier)' }, help: 'Les équipements du plugin Network sont lus automatiquement (état du ping, depuis quand, latence). Mise à jour en direct.' },
      { k: 'ntLat', l: 'Latence', f: 'sel', o: { '': 'Afficher', non: 'Masquer' } },
      { k: 'ntSlow', l: 'Latence lente à partir de (ms)', f: 'num', ph: '100', help: 'Au-delà, la ligne passe en orange.' },
      { k: 'ntIp', l: 'Adresse IP', f: 'sel', o: { '': 'Afficher', non: 'Masquer' } },
      { k: 'ntMax', l: 'Nombre maximum de lignes', f: 'num', ph: '50' },
      { k: 'okText', l: 'Texte quand tout va bien', ph: 'Tout est en ligne' },
      { k: 'lsSize', l: 'Taille du texte et des lignes (%)', f: 'num', ph: '100', help: 'Agrandit tout : texte, points, piles, espacements. Ex. 160.' },
      { k: 'lsFill', l: 'Lignes', f: 'sel', o: { '': 'Taille normale, en haut de la tuile', remplir: 'Remplir la hauteur de la tuile' } },
      { k: 'lsCols', l: 'Colonnes', f: 'sel', o: { '1': '1 colonne', '2': '2 colonnes', '3': '3 colonnes', '4': '4 colonnes', auto: 'Automatique selon la largeur' }, help: 'S\'il y a trop de lignes pour la hauteur, la liste défile.' }],
    batteries: [{ k: 'btMode', l: 'Afficher', f: 'sel', o: { '': 'Seulement les piles faibles', tous: 'Toutes les piles (de la plus faible à la plus forte)' }, help: 'Les équipements et leurs niveaux sont lus automatiquement dans Jeedom. Seuils : ceux de Jeedom (Réglages → Système → Configuration → Équipements) ou de chaque équipement.' },
      { k: 'btMax', l: 'Nombre maximum de lignes', f: 'num', ph: '50' },
      { k: 'btStale', l: 'Signaler sans nouvelles après (h)', f: 'num', ph: '48', help: 'Le niveau n\'a pas été remonté depuis ce temps : « sans nouvelles depuis 3 j ».' },
      { k: 'okText', l: 'Texte quand tout va bien', ph: 'Toutes les piles sont bonnes' },
      { k: 'lsSize', l: 'Taille du texte et des lignes (%)', f: 'num', ph: '100', help: 'Agrandit tout : texte, points, piles, espacements. Ex. 160.' },
      { k: 'lsFill', l: 'Lignes', f: 'sel', o: { '': 'Taille normale, en haut de la tuile', remplir: 'Remplir la hauteur de la tuile' } },
      { k: 'lsCols', l: 'Colonnes', f: 'sel', o: { '1': '1 colonne', '2': '2 colonnes', '3': '3 colonnes', '4': '4 colonnes', auto: 'Automatique selon la largeur' }, help: 'S\'il y a trop de lignes pour la hauteur, la liste défile.' }],
    reveil: [{ k: 'rvDevice', l: 'Appareil', f: 'sel', o: { '': 'Alexa et Rémi', alexa: 'Alexa seulement', remi: 'Rémi seulement' }, help: 'Une tuile par appareil : par exemple « Moi » sur l\'Alexa et « Armand » sur le Rémi, avec le même équipement Réveils.', after: function (t) { if (cleanId(t.eqId)) fillReveil(t, t.eqId).then(function () { onTileChange({ f: 'sel' }); }).catch(fail); } },
      { k: 'eqId', l: 'Équipement Réveils', f: 'eq', plugin: 'reveil', help: 'Choisissez le réveil (plugin Réveils) : ses commandes sont retrouvées automatiquement ci-dessous.', onPick: function (t, e) { fillReveil(t, e.id).then(function () { onTileChange({ f: 'sel' }); }).catch(fail); } },
      { k: 'cmdNext', l: 'Prochain réveil', f: 'cmd', filter: C_INFO },
      { k: 'cmdStatus', l: 'Statut synchro', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdSyncOk', l: 'Synchro OK', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdAlexaOk', l: 'Alexa OK', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdRemiOk', l: 'Rémi OK', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdLastCheck', l: 'Dernière vérification', f: 'cmd', filter: C_INFO },
      { k: 'cmdException', l: 'Action Exception (changer l\'heure)', f: 'cmd', filter: C_ACTION },
      { k: 'cmdSkip', l: 'Action Pas de prochain réveil', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdResync', l: 'Action Resynchroniser', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdVerify', l: 'Action Vérifier', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'rvDetail', l: 'Détail par appareil', f: 'sel', o: { '': 'Seulement s\'il y a un souci (attente, dérogation, écart)', toujours: 'Toujours (ex. « Alexa 06:30 OK »)' }, show: function (t) { return !t.rvCompact; } },
      { k: 'rvCompact', l: 'Compact (heure et pastille seulement)', f: 'check' }],
    reveilplan: [{ k: 'eqId', l: 'Équipement Réveils', f: 'eq', plugin: 'reveil', help: 'Planning calculé par le plugin Réveils (semaine en cours + suivantes). Congés et garde sont communs à tous les réveils.' },
      { k: 'rpWeeks', l: 'Nombre de semaines', f: 'num', ph: '4' },
      { k: 'rpEdit', l: 'Modification depuis la tuile', f: 'sel', o: { '': 'Oui : heure, congé, enfant, profils du jour, vérifier, resynchroniser, paramètres', non: 'Non (lecture seule)' } },
      { k: 'rpHead', l: 'Prochain réveil et statut en haut', f: 'sel', o: { '': 'Afficher', non: 'Masquer' } },
      { k: 'rpLegend', l: 'Légende', f: 'sel', o: { '': 'Afficher', non: 'Masquer' } }],
    reveils: [{ k: 'rvStyle', l: 'Format', f: 'sel', o: { '': 'Liste (une ligne par réveil)', accueil: 'Accueil : grandes heures côte à côte + icône réveil' }, keep: true },
      { k: 'rvItems', l: 'Réveils', f: 'rvlist', help: 'Une ligne par équipement Réveils (toi, Armand…). Un appui sur un réveil permet de changer l\'heure ou de supprimer ce réveil.' },
      { k: 'page', l: 'Appui : ouvre la page (option)', f: 'page', show: function (t) { return t.rvStyle === 'accueil'; }, help: 'Ex. ta page Réveil. Vide = la page Tuiles nommée « Réveil » ou « Réveils » si elle existe, sinon un appui permet de changer l\'heure.' },
      { k: 'icon', l: 'Icône', f: 'icon', ph: 'svg:a-reveil', show: function (t) { return t.rvStyle === 'accueil'; }, help: 'Par défaut, le réveil animé : il sonne doucement quand le réveil est dans moins de 12 h.' }],
    puissance: [F.info, F.unit, F.decimals,
      { k: 'caption', l: 'Petit titre au-dessus', ph: 'ex. Compteur monophasé' },
      { k: 'sub', l: 'Texte sous la valeur', ph: 'ex. Consommation' },
      { k: 'icon', l: 'Icône', f: 'icon', ph: 'éclair' },
      { k: 'gMin', l: 'Anneau : mini', f: 'num', ph: '0', half: true },
      { k: 'gMax', l: 'Anneau : maxi', f: 'num', ph: 'ex. 6000', half: true, help: 'L\'anneau montre la valeur en % du maxi. Sans maxi, il affiche la valeur.' },
      { k: 'ringLabel', l: 'Texte sous l\'anneau', ph: 'auto' },
      { k: 'pwRing', l: 'Anneau', f: 'sel', o: { '': 'Afficher', non: 'Masquer' } },
      { k: 'pwChart', l: 'Courbe en fond', f: 'sel', o: { '': 'Afficher', non: 'Masquer' } },
      { k: 'pwHours', l: 'Durée de la courbe (h)', f: 'num', ph: '6', help: 'La commande doit être historisée.' },
      { k: 'color', l: 'Couleur', f: 'color', help: 'Vide = couleur du thème.' }, F.th, { k: 'details', l: 'Courbe et détails', f: 'sel', o: { '': 'Non', clic: 'Au clic', long: 'Appui long seulement' } }],
    separateur: [{ k: 'sepDir', l: 'Sens', f: 'sel', o: { '': 'Verticale', h: 'Horizontale' }, keep: true },
      { k: 'sepColor', l: 'Couleur', f: 'color', help: 'Vide = couleur du thème.' },
      { k: 'sepW', l: 'Épaisseur (px)', f: 'num', ph: '2', half: true },
      { k: 'sepLen', l: 'Longueur (%)', f: 'num', ph: '100', half: true },
      { k: 'sepStyle', l: 'Style', f: 'sel', o: { '': 'Dégradé (s\'estompe aux bouts)', plein: 'Plein', pointille: 'Pointillé' } },
      { k: 'sepGlow', l: 'Lumineuse', f: 'check' }],
    soleil: [{ k: 'cmdElev', l: 'Info hauteur du soleil (option)', f: 'cmd', filter: C_INFO, help: 'Sinon calculée avec la position de Jeedom (Réglages → Système → Configuration → Informations).' },
      { k: 'lat', l: 'Latitude (option)', f: 'num', ph: 'Jeedom', half: true },
      { k: 'lon', l: 'Longitude (option)', f: 'num', ph: 'Jeedom', half: true }],
    messages: [{ k: 'cmdMsg', l: 'Info texte des messages', f: 'cmd', filter: C_INFO, help: 'Ex. l\'info du plugin rapport qui décrit ce qui ne va pas. Une ligne = un bandeau.' },
      { k: 'cmdMsg2', l: '2e info (option)', f: 'cmd', filter: C_INFO, half: true },
      { k: 'cmdMsg3', l: '3e info (option)', f: 'cmd', filter: C_INFO, half: true },
      { k: 'sep', l: 'Séparer les messages par', f: 'sel', o: { '': 'Retour à la ligne, <br> ou |', semi: 'Retour à la ligne, <br> ou ;', nl: 'Retour à la ligne / <br> seulement', none: 'Ne pas séparer' } },
      { k: 'okVals', l: 'Valeurs « tout va bien »', ph: 'ok;0;aucun;rien;-', help: 'Ces valeurs (et une info vide) n\'affichent aucun message.' },
      { k: 'okText', l: 'Texte quand tout va bien', ph: 'Tout va bien', help: '« - » pour ne rien afficher.' },
      { k: 'msgColor', l: 'Couleur des messages', f: 'color', help: 'Vide = automatique selon les mots : erreur / défaut / alarme → rouge, attention / batterie / bas → orange, sinon bleu.' },
      { k: 'msgDismiss', l: 'Effacer un message d\'un appui', f: 'check', help: 'Le message revient s\'il change.' },
      { k: 'msgTime', l: 'Afficher depuis quand', f: 'check' },
      { k: 'lsSize', l: 'Taille du texte et des lignes (%)', f: 'num', ph: '100', help: 'Agrandit tout : texte, points, piles, espacements. Ex. 160.' },
      { k: 'lsFill', l: 'Lignes', f: 'sel', o: { '': 'Taille normale, en haut de la tuile', remplir: 'Remplir la hauteur de la tuile' } },
      { k: 'lsCols', l: 'Colonnes', f: 'sel', o: { '1': '1 colonne', '2': '2 colonnes', '3': '3 colonnes', '4': '4 colonnes', auto: 'Automatique selon la largeur' }, help: 'S\'il y a trop de lignes pour la hauteur, la liste défile.' }],
    chauffeeau: [{ k: 'cmdTop', l: 'Température haut du ballon', f: 'cmd', filter: C_INFO, help: 'Seule une température ? Mettez-la ici.' },
      { k: 'cmdBottom', l: 'Température bas du ballon (option)', f: 'cmd', filter: C_INFO, help: 'Le ballon est coloré du bas (froid, bleu) au haut (chaud, rouge).' },
      { k: 'cmdSet', l: 'Action consigne (slider)', f: 'cmd', filter: C_ACTION },
      { k: 'cmdSetInfo', l: 'Info consigne', f: 'cmd', filter: C_INFO, help: 'Vide = l\'info liée à l\'action consigne.' },
      { k: 'ceMin', l: 'Consigne mini', f: 'num', ph: 'auto (40)', half: true },
      { k: 'ceMax', l: 'Consigne maxi', f: 'num', ph: 'auto (65)', half: true },
      { k: 'ceStep', l: 'Pas', f: 'num', ph: '1', half: true },
      { k: 'ceKind', l: 'Type', f: 'sel', o: { '': 'Auto (PAC si ventilateur renseigné)', pac: 'Thermodynamique (PAC)', elec: 'Électrique' } },
      { k: 'cmdHeat', l: 'Info en chauffe', f: 'cmd', filter: C_INFO, help: 'Binaire, ou valeur > 0 (ex. courant compresseur). Le ballon s\'illumine.' },
      { k: 'heatOn', l: 'Valeur « en chauffe » (option)', ph: 'ex. 17', help: 'Si l\'info est un code d\'état : la valeur qui veut dire « chauffe ».' },
      { k: 'cmdFan', l: 'Info ventilateur (vitesse ou débit)', f: 'cmd', filter: C_INFO, help: 'Le ventilateur dessiné tourne quand la valeur > 0, plus vite si la vitesse est élevée.' },
      { k: 'cmdLevel', l: 'Info eau chaude disponible en % (option)', f: 'cmd', filter: C_INFO },
      { k: 'cmdStatus', l: 'Info état / mode (option)', f: 'cmd', filter: C_INFO },
      { k: 'statusMap', l: 'Traduction de l\'état', ph: '17=Chauffe PAC;3=Veille', help: 'valeur=texte, séparés par ;' },
      { k: 'cmdBoost', l: 'Action Boost', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdBoostInfo', l: 'Info Boost actif', f: 'cmd', filter: C_INFO, half: true },
      { k: 'options', l: 'Autres boutons (libellé + action)', f: 'options', help: 'ex. Auto, Vacances…' },
      { k: 'lab1', l: 'Info 1 : libellé', ph: 'auto', half: true }, { k: 'cmdX1', l: 'Info 1', f: 'cmd', filter: C_INFO, half: true },
      { k: 'lab2', l: 'Info 2 : libellé', ph: 'auto', half: true }, { k: 'cmdX2', l: 'Info 2', f: 'cmd', filter: C_INFO, half: true },
      { k: 'lab3', l: 'Info 3 : libellé', ph: 'auto', half: true }, { k: 'cmdX3', l: 'Info 3', f: 'cmd', filter: C_INFO, half: true },
      { k: 'lab4', l: 'Info 4 : libellé', ph: 'auto', half: true }, { k: 'cmdX4', l: 'Info 4', f: 'cmd', filter: C_INFO, half: true },
      { k: 'lab5', l: 'Info 5 : libellé', ph: 'auto', half: true }, { k: 'cmdX5', l: 'Info 5', f: 'cmd', filter: C_INFO, half: true },
      { k: 'lab6', l: 'Info 6 : libellé', ph: 'auto', half: true }, { k: 'cmdX6', l: 'Info 6', f: 'cmd', filter: C_INFO, half: true },
      { k: 'details', l: 'Courbe au clic sur le ballon', f: 'sel', o: { '': 'Non', clic: 'Oui' } }],
    camera: [{ k: 'frigateUrl', l: 'Adresse de Frigate', ph: 'http://192.168.1.x:5000', help: 'Port 5000 (API interne de Frigate, sans authentification).' },
      { k: 'frigateCam', l: 'Nom de la caméra', ph: 'ex. portail', help: 'Le nom tel que dans la configuration de Frigate.' },
      { k: 'frigateMode', l: 'Mode', f: 'sel', o: { rapide: 'Images rapides (le plus fiable, conseillé)', mjpeg: 'Flux vidéo MJPEG de Frigate', go2rtc: 'Flux go2rtc (MJPEG, port 1984)', snapshot: 'Capture lente (toutes les N s)' }, keep: true, help: 'Images rapides : captures enchaînées, rien ne reste ouvert, fonctionne avec plusieurs caméras sur la même page et à distance. Un navigateur ne garde que 6 flux ouverts vers une même adresse : au-delà, les flux MJPEG se figent.' },
      { k: 'camProxy', l: 'Via Jeedom (accès à distance)', f: 'check', help: 'Le serveur Jeedom récupère l\'image et la renvoie : la caméra est visible partout où Jeedom l\'est, sans ouvrir Frigate à l\'extérieur. Un flux vidéo se met en pause après 60 s (appui pour relancer). Le mode go2rtc passe alors en MJPEG. Enregistrez la page pour l\'activer (l\'éditeur affiche la caméra en direct).' },
      { k: 'frigateFps', l: 'Images par seconde', f: 'num', phFn: function (t) { return t.frigateMode === 'rapide' ? '3' : '5'; }, show: function (t) { return !t.frigateMode || t.frigateMode === 'mjpeg' || t.frigateMode === 'rapide' || (t.frigateMode === 'go2rtc' && t.camProxy); } },
      { k: 'frigateH', l: 'Hauteur de l\'image (px)', f: 'num', ph: '720', show: function (t) { return t.frigateMode !== 'go2rtc' || t.camProxy; } },
      { k: 'camRefresh', l: 'Rafraîchir toutes les (s)', f: 'num', ph: '5', show: function (t) { return t.frigateMode === 'snapshot'; } },
      { k: 'go2rtcUrl', l: 'Adresse go2rtc', ph: 'auto : même IP, port 1984', show: function (t) { return t.frigateMode === 'go2rtc' && !t.camProxy; }, help: 'Le port 1984 de go2rtc doit être accessible depuis le navigateur. Le nom de la caméra doit être celui du flux dans go2rtc.' },
      { k: 'cmdRec', l: 'Info enregistrement (binaire)', f: 'cmd', filter: C_INFO, help: 'Pastille REC rouge quand l\'enregistrement est actif.' },
      { k: 'cmdRecOn', l: 'Action activer l\'enregistrement (option)', f: 'cmd', filter: C_ACTION, help: 'Avec les actions, un appui sur la pastille bascule l\'état.' },
      { k: 'cmdRecOff', l: 'Action désactiver l\'enregistrement (option)', f: 'cmd', filter: C_ACTION },
      { k: 'cmdDet', l: 'Info détection de mouvement (binaire)', f: 'cmd', filter: C_INFO },
      { k: 'cmdDetOn', l: 'Action activer la détection (option)', f: 'cmd', filter: C_ACTION },
      { k: 'cmdDetOff', l: 'Action désactiver la détection (option)', f: 'cmd', filter: C_ACTION },
      { k: 'cmdPtzUp', l: 'PTZ : haut', f: 'cmd', filter: C_ACTION, half: true, help: 'Commandes affichées dans la vue agrandie (plein écran). Toutes optionnelles.' },
      { k: 'cmdPtzDown', l: 'PTZ : bas', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdPtzLeft', l: 'PTZ : gauche', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdPtzRight', l: 'PTZ : droite', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdPtzIn', l: 'PTZ : zoom +', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdPtzOut', l: 'PTZ : zoom −', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdPtzHome', l: 'PTZ : position d\'origine', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'cmdPtzStop', l: 'PTZ : stop', f: 'cmd', filter: C_ACTION, half: true },
      { k: 'ptzMode', l: 'Déplacement', f: 'sel', o: { '': 'Un appui = un pas', maintenir: 'Maintenir appuyé (envoie Stop au relâché)' }, help: '« Maintenir » nécessite la commande Stop (caméras qui bougent en continu).' },
      { k: 'options', l: 'Positions prédéfinies (libellé + action)', f: 'options', help: 'Boutons en bas de la vue agrandie. Clavier : 1 à 9.' },
      { k: 'camFit', l: 'Image', f: 'sel', o: { '': 'Remplir la tuile', contain: 'Entière' } },
      { k: 'camLive', l: 'Pastille LIVE', f: 'check' },
      { k: 'camZoom', l: 'Plein écran au clic', f: 'check', keepFalse: true }],
    web: [{ k: 'webUrl', l: 'Adresse de la page', ph: 'http://…', help: 'Certaines pages refusent d\'être affichées dans un cadre : elles resteront blanches.' },
      { k: 'webZoom', l: 'Zoom (%)', f: 'num', ph: '100' },
      { k: 'webInteractive', l: 'Utilisable dans la tuile (cliquer, défiler)', f: 'check', help: 'Sinon, un clic ouvre la page en plein écran.' },
      { k: 'webRefresh', l: 'Recharger toutes les (min)', f: 'num', ph: '0 = jamais' }]
  };

  function hasAnimIcon(t) {
    return ['icon', 'iconOff', 'iconActive', 'aIcon', 'bIcon'].some(function (k) { return /svg:a-/.test(t[k] || ''); }) || ['animOn', 'animOnA', 'animOnB'].some(function (k) { return t[k] === true; }) || !!(t.cmdAnim || t.cmdAnimA || t.cmdAnimB) ||
      (Array.isArray(t.lines) && t.lines.some(function (l) { return /svg:a-/.test(l.icon || ''); }));
  }
  var COMMON = [
    { k: 'title', l: 'Nom' },
    { k: 'type', l: 'Fonction', f: 'func' },
    { k: 'pin', l: '🔒 Code de confirmation', f: 'sel', o: { '': 'Non', on: 'Sur le On (allumer, ouvrir, monter, armer…)', off: 'Sur le Off (éteindre, fermer, descendre, désarmer…)', all: 'Sur toutes les actions' }, keep: true, help: 'Un clavier demande le code avant d\'envoyer l\'action. Le code se règle dans la configuration du plugin.' },
    { k: 'stack', l: 'Empiler sous la tuile précédente', f: 'check', help: 'La tuile se met sous la précédente, dans la même case. La pile fait au moins 1 case de haut (plus si la première tuile est plus haute) et ses tuiles se la partagent à parts égales : la rangée reste droite, qu\'il y en ait 2, 3 ou plus.' },
    { k: 'w', l: 'Largeur (cases)', f: 'sel', o: SIZES, half: true, show: function (t) { return !t.stack; } },
    { k: 'h', l: 'Hauteur (cases)', f: 'sel', o: SIZES, half: true, show: function (t) { return !t.stack; } },
    { k: 'x', l: 'Position : colonne', f: 'pos', show: function (t) { return !t.stack; }, help: 'Placement libre. 1 = première colonne, 1.5 = milieu de la première case, 2.25… Vide = automatique. Plus simple : glissez la tuile dans l\'aperçu.' },
    { k: 'y', l: 'Position : ligne', f: 'pos', show: function (t) { return !t.stack; }, help: '1 = première ligne, 1.5 = sous une tuile de ½ de haut… Vide = automatique.' }
  ];
  /** Texte d'aide des tailles d'une tuile : taille commune de la page, sinon automatique. */
  function pagePx(k) {
    var g = (E.layout && E.layout.grid) || {};
    return U.isNum(g[k]) && parseFloat(g[k]) > 0 ? 'page : ' + g[k] : 'auto';
  }
  var LOOK = [
    { k: 'hideTitle', l: 'Masquer le nom', f: 'check' },
    { k: 'titleIcon', l: 'Icône devant le nom', f: 'icon', help: 'Petite icône à gauche du nom (style des thèmes).' },
    { k: 'titlePx', l: 'Taille du nom (px)', f: 'num', phFn: function () { return pagePx('titlePx'); }, help: 'Taille fixe du nom, comme dans Word. Vide = automatique selon la tuile.' },
    { k: 'textPx', l: 'Taille du texte (px)', f: 'num', phFn: function () { return pagePx('textPx'); }, help: 'Taille fixe des valeurs et textes de la tuile. Le texte ne rétrécit que s\'il dépasse de la tuile.' },
    { k: 'iconPx', l: 'Taille de l\'icône (px)', f: 'num', phFn: function () { return pagePx('iconPx'); }, help: 'Taille fixe de l\'icône ou du bouton rond' },
    { k: 'titleColor', l: 'Couleur du nom', f: 'color', ph: 'title' },
    { k: 'bg', l: 'Fond de la tuile', f: 'color' },
    { k: 'radius', l: 'Arrondi (px)', f: 'num', ph: '14' }
  ];
  var ROW_SCHEMA = [
    { k: 'space', l: 'Espace au-dessus (px)', f: 'num', ph: '30' },
    { k: 'title', l: 'Libellé (option)', ph: 'ex. Groupes' },
    { k: 'titleColor', l: 'Couleur du libellé', f: 'color' },
    { k: 'mobile.hide', l: 'Ignorer sur mobile', f: 'check' }
  ];
  /** Plage que le slider utilisera en auto (pour l'afficher dans l'éditeur). */
  function autoRange(t) {
    var c = Object.assign({}, t); delete c.sMin; delete c.sMax; delete c.sStep;
    return T.sliderRange({ meta: function (id) { id = cleanId(id); return id ? E.cmds[id] || null : null; } }, c);
  }
  var ACTIVE_HELP = '« Actif » = info à 1 / marche, ouvrant ouvert, bouton en marche, ou valeur qui atteint une ligne de « Couleurs selon la valeur ».';
  var FRAME = [
    { k: 'frameOn', l: 'Activer la couleur du cadre', f: 'check', keepFalse: true },
    { k: 'frameTh', base: 'frameBase', l: 'Couleur du cadre selon la valeur', f: 'thresholds', show: function (t) { return t.frameOn === true; }, help: 'Indépendant de la couleur de la valeur. Jusqu\'à 10 lignes : un nombre = à partir de cette valeur, un texte = si égal.' },
    { k: 'frameW', l: 'Épaisseur du cadre (px)', f: 'num', ph: '3', show: function (t) { return t.frameOn === true; } },
    { k: 'frameGlow', l: 'Cadre lumineux (halo)', f: 'check', show: function (t) { return t.frameOn === true; } },
    { k: 'cmdFrame', l: 'Info du cadre (option)', f: 'cmd', filter: C_INFO, show: function (t) { return t.frameOn === true; }, help: 'Vide = l\'info de la tuile. Permet un cadre piloté par une autre info.' }
  ];
  function hasFrame(t) { return (Array.isArray(t.frameTh) && t.frameTh.length) || isSet(t.frameBase); }
  var EFFECTS = [
    { k: 'anim', l: 'Animation', f: 'sel', o: { '': 'Aucune', rotation: 'Rotation (pompe, ventilateur)', pulsation: 'Pulsation (goutte, cœur)', clignotement: 'Clignotement (alerte)', rebond: 'Rebond', secousse: 'Secousse (cloche, réveil)' } },
    { k: 'animWhen', l: 'Animer', f: 'sel', o: { '': 'Quand actif', toujours: 'Toujours' }, help: ACTIVE_HELP, show: function (t) { return !!t.anim; } },
    { k: 'glow', l: 'Halo néon', f: 'sel', o: { '': 'Aucun', tuile: 'Autour de la tuile', icone: 'Sur l\'icône / la valeur' }, help: 'Halo lumineux de la couleur actuelle (couleur de l\'état ou du seuil).' },
    { k: 'glowWhen', l: 'Allumer le halo', f: 'sel', o: { '': 'Quand actif', toujours: 'Toujours' }, help: ACTIVE_HELP, show: function (t) { return !!t.glow; } },
    { k: 'roll', l: 'Changement de valeur', f: 'sel', o: { '': 'Le chiffre défile + flash', non: 'Direct' }, show: function (t) { return t.type === 'valeur'; } },
    { k: 'spark', l: 'Mini-courbe en fond', f: 'check', help: 'Courbe de l\'historique Jeedom derrière la valeur. L\'info doit être historisée.', show: function (t) { return ['valeur', 'jauge', 'texte', 'lignes', 'icone'].indexOf(t.type) >= 0; } },
    { k: 'cmdSpark', l: 'Info de la courbe', f: 'cmd', filter: C_INFO, help: 'Vide = l\'info de la tuile', show: function (t) { return !!t.spark; } },
    { k: 'sparkHours', l: 'Durée de la courbe (h)', f: 'num', ph: '24', show: function (t) { return !!t.spark; } },
    { k: 'flip', l: 'Recto-verso (appui long)', f: 'check', help: 'Un appui long retourne la tuile : au dos, valeur actuelle, min / max / moyenne, dernière mise à jour et commandes secondaires. Remplace l\'action « appui long ».' },
    { k: 'cmdBack', l: 'Commandes au dos', f: 'cmdlist', filter: C_ACTION, noQuick: true, show: function (t) { return !!t.flip; } }
  ];
  var ADVANCED = [
    { k: 'maxAge', l: 'Alerte si info non mise à jour depuis (min)', f: 'num', ph: 'non' },
    { k: 'mobile.hide', l: 'Masquer sur mobile', f: 'check' },
    { k: 'mobile.split', l: 'Sur mobile, une tuile par ligne', f: 'check', show: function (t) { return t.type === 'lignes'; } },
    { k: 'mobile.order', l: 'Ordre sur mobile', f: 'num', ph: 'même ordre' }
  ];
  var VM_LINE_SCHEMA = [
    { k: 'label', l: 'Libellé', ph: 'ex. Disque' },
    { k: 'cmdInfo', l: 'Info', f: 'cmd', filter: C_INFO },
    { k: 'unit', l: 'Unité', ph: 'auto' },
    { k: 'decimals', l: 'Décimales', f: 'num' },
    { k: 'map', l: 'Libellés (option)', ph: '1=OK;0=Arrêté' },
    { k: 'dir', l: 'Problème quand la valeur est', f: 'sel', o: { '>': 'trop haute (disque, CPU, température…)', '<': 'trop basse (mémoire libre…)', ok: 'différente d\'un texte (ex. OK)', none: 'jamais (affichage seul)' }, keep: true, rebuild: true },
    { k: 'okVal', l: 'Texte attendu', ph: 'OK', show: function (l) { return l.dir === 'ok'; } },
    { k: 'warn', l: 'Seuil orange', f: 'num', show: function (l) { return l.dir !== 'ok' && l.dir !== 'none'; } },
    { k: 'err', l: 'Seuil rouge', f: 'num', show: function (l) { return l.dir !== 'ok' && l.dir !== 'none'; } },
    { k: 'max', l: 'Maximum de la barre (0 = pas de barre)', f: 'num', ph: '100', show: function (l) { return l.dir !== 'ok' && l.dir !== 'none'; } }
  ];
  var OUV_LINE_SCHEMA = [
    { k: 'kind', l: 'Type', f: 'sel', o: { fenetre: 'Fenêtre', fenetre2: 'Fenêtre 2 vantaux (2 contacts)', baie: 'Baie coulissante (1 ou 2 contacts)', porte: 'Porte', hublot: 'Hublot', portail: 'Portail', garage: 'Porte de garage', title: 'Titre de groupe (RDC, Étage…)' }, keep: true, rebuild: true },
    { k: 'label', l: 'Nom' },
    { k: 'cmdInfo', l: 'Contact (gauche si 2 contacts)', f: 'cmd', filter: C_INFO, show: function (l) { return l.kind !== 'title'; } },
    { k: 'cmdInfo2', l: 'Contact droit (option)', f: 'cmd', filter: C_INFO, show: function (l) { return l.kind === 'baie' || l.kind === 'fenetre2'; } },
    { k: 'openValue', l: 'Valeur « ouvert »', ph: '1', show: function (l) { return l.kind !== 'title'; } },
    { k: 'invert', l: 'Inverser (0 = ouvert)', f: 'check', show: function (l) { return l.kind !== 'title'; } },
    { k: 'genre', l: 'Accord', f: 'sel', o: { '': 'Auto', f: 'Ouverte / Fermée', m: 'Ouvert / Fermé' }, show: function (l) { return l.kind !== 'title'; } }
  ];
  var LINE_SCHEMA = [
    { k: 'kind', l: 'Type de ligne', f: 'sel', o: { value: 'Libellé : valeur', title: 'Sous-titre', button: 'Libellé : bouton', icon: 'Libellé : icône' }, rebuild: true },
    { k: 'label', l: 'Libellé' },
    { k: 'cmdInfo', l: 'Info', f: 'cmd', filter: C_INFO, show: function (l) { return l.kind !== 'title'; } },
    { k: 'unit', l: 'Unité', ph: 'auto', show: function (l) { return !l.kind || l.kind === 'value'; } },
    { k: 'decimals', l: 'Décimales', f: 'num', show: function (l) { return !l.kind || l.kind === 'value'; } },
    { k: 'map', l: 'Libellés', ph: '0=Arrêt;1=Marche', show: function (l) { return !l.kind || l.kind === 'value'; } },
    { k: 'cmdOn', l: 'Action', f: 'cmd', filter: C_ACTION, show: function (l) { return l.kind === 'button'; } },
    { k: 'cmdOff', l: 'Action Off (option)', f: 'cmd', filter: C_ACTION, show: function (l) { return l.kind === 'button'; } },
    { k: 'icon', l: 'Icône', f: 'icon', show: function (l) { return l.kind === 'button' || l.kind === 'icon'; } },
    { k: 'confirm', l: 'Confirmation (option)', ph: 'vide = aucune', help: 'Texte demandé avant d\'envoyer l\'action (ex. remise à zéro).', show: function (l) { return l.kind === 'button'; } },
    { k: 'thresholds', l: 'Couleurs selon la valeur', f: 'thresholds', show: function (l) { return l.kind !== 'title' && (l.kind !== 'button' || l.cmdInfo); } },
    { k: 'cmdAlert', l: 'Rouge si cette info est active (option)', f: 'cmd', filter: C_INFO, help: 'Ex. « Zone en alarme ». Prioritaire sur tout le reste.', show: function (l) { return l.kind === 'icon'; } },
    { k: 'cmdOk', l: 'Vert si cette info est active (option)', f: 'cmd', filter: C_INFO, help: 'Ex. « Zone armée ». Utilisé quand l\'info principale est au repos.', show: function (l) { return l.kind === 'icon'; } },
    { k: 'color', l: 'Couleur', f: 'color' }
  ];

  /* ================================================================== */
  /*  État                                                               */
  /* ================================================================== */

  var E = {
    eqId: null, layout: null, cmds: {}, sel: null, presets: {}, pages: [], objects: [],
    theme: {}, homeId: '', mobile: false, page: null, ready: null
  };

  function newId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function modified() {
    window.modifyWithoutSave = true;
    if (window.jeeFrontEnd) window.jeeFrontEnd.modifyWithoutSave = true;
  }
  function getPath(o, k) {
    var parts = k.split('.');
    for (var i = 0; i < parts.length; i++) { if (!o) return undefined; o = o[parts[i]]; }
    return o;
  }
  function setPath(o, k, v) {
    var parts = k.split('.');
    for (var i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
    var last = parts[parts.length - 1];
    if (v === '' || v === false || v === null || v === undefined || (Array.isArray(v) && !v.length)) delete o[last];
    else o[last] = v;
  }
  function tileById(id) { return (E.layout.tiles || []).filter(function (t) { return t.id === id; })[0] || null; }
  function selTile() { return E.sel ? tileById(E.sel) : null; }
  function toast(m, k) { if (E.quiet && k !== 'error') return; T.ui.toast(m, k); }
  function fail(e) { toast(e && e.message ? e.message : String(e), 'error'); }

  function ensureMetas(ids) {
    ids = (ids || []).map(cleanId).filter(function (id) { return id && !E.cmds[id]; });
    if (!ids.length) return Promise.resolve();
    return T.ajax('getCmds', { ids: ids }).then(function (metas) {
      Object.keys(metas || {}).forEach(function (id) { E.cmds[id] = metas[id]; });
    });
  }

  function editorInit() {
    if (!E.ready) {
      E.ready = T.ajax('editorInit', {}).then(function (d) {
        E.presets = d.presets || {};
        E.pages = d.pages || [];
        E.objects = d.objects || [];
        E.theme = d.theme || {};
        var map = { title: 'title', text: 'text', ok: 'ok', warn: 'warn', alert: 'alert', info: 'info', neutral: 'neutral', on: 'on', off: 'off' };
        var el = document.querySelector('.tl-ed');
        if (el) Object.keys(map).forEach(function (k) { if (isSet(E.theme[k])) el.style.setProperty('--tl-c-' + map[k], E.theme[k]); });
        E.homeId = d.homeId || '';
        E.lat = d.lat; E.lon = d.lon;
        E.nav = d.nav || { enabled: false, home: false, items: [] };
      });
    }
    return E.ready;
  }

  /* ================================================================== */
  /*  Hooks du template de plugin Jeedom                                 */
  /* ================================================================== */

  /** Anciennes règles, préréglages et couleur fixe → seuils (les préréglages n'existent plus). */
  function migrateColors(t, presets) {
    var rules = (t.rules && t.rules.length) ? t.rules : (t.preset && presets && presets[t.preset]) || null;
    var hasTh = Array.isArray(t.thresholds) && t.thresholds.length;
    if (rules && !hasTh) {
      var up = rules.filter(function (r) { return r.op === '<' || r.op === '<='; });
      var down = rules.filter(function (r) { return r.op === '>' || r.op === '>='; });
      var other = rules.filter(function (r) { return ['<', '<=', '>', '>=', 'else'].indexOf(r.op) < 0; });
      var els = rules.filter(function (r) { return r.op === 'else'; })[0];
      var th = [], base;
      if (!other.length && up.length && !down.length) {
        up = up.slice().sort(function (a, b) { return parseFloat(a.v) - parseFloat(b.v); });
        base = up[0].color;
        up.forEach(function (r, i) { th.push({ v: r.v, color: i + 1 < up.length ? up[i + 1].color : (els ? els.color : r.color) }); });
      } else if (!other.length && down.length && !up.length) {
        down.forEach(function (r) { th.push({ v: r.v, color: r.color }); });
        base = els ? els.color : undefined;
      }
      th = th.filter(function (x) { return U.isNum(x.v); }).slice(0, 10);
      if (th.length) { t.thresholds = th; if (isSet(base)) t.thBase = base; }
    }
    delete t.rules;
    delete t.preset;
    if (isSet(t.color) && ['valeur', 'jauge', 'texte', 'lien'].indexOf(t.type) >= 0 && !isSet(t.thBase)) t.thBase = t.color;
    if (['valeur', 'jauge', 'texte', 'lien'].indexOf(t.type) >= 0) delete t.color;
    if (t.colorTarget === 'border') {
      if (Array.isArray(t.thresholds) && t.thresholds.length && !(Array.isArray(t.frameTh) && t.frameTh.length)) t.frameTh = t.thresholds;
      if (isSet(t.thBase) && !isSet(t.frameBase)) t.frameBase = t.thBase;
      delete t.thresholds; delete t.thBase; delete t.colorTarget;
    }
    if (t.frameOn === undefined && hasFrame(t)) t.frameOn = true;
    (t.lines || []).forEach(function (l) { migrateColors(l, presets); });
  }
  function migrateSizes(t, g) {
    var base = Math.min(parseFloat(g.cellH) > 0 ? parseFloat(g.cellH) : 200, parseFloat(g.size) || 200);
    if (t.titleSize === 'grand' && !U.isNum(t.titlePx)) t.titlePx = Math.round(base * 0.25);
    delete t.titleSize;
    if ((t.size === 'grand' || t.size === 'petit') && !U.isNum(t.textPx)) {
      var k = { valeur: { grand: 0.4, petit: 0.17 }, texte: { grand: 0.22, petit: 0.1 }, horloge: { grand: 0.22, petit: 0.1 } }[t.type];
      if (k && k[t.size]) t.textPx = Math.round(base * k[t.size]);
    }
    delete t.size;
  }

  window.printEqLogic = function (_eqLogic) {
    E.eqId = _eqLogic.id;
    var raw = _eqLogic.configuration ? _eqLogic.configuration.layout : null;
    var layout = null;
    if (raw && typeof raw === 'object') layout = raw;
    else if (isSet(raw)) { try { layout = JSON.parse(raw); } catch (e) { layout = null; } }
    if (!layout || typeof layout !== 'object') layout = { version: 1, grid: {}, tiles: [] };
    layout.grid = Object.assign({ cols: 5, size: 200, gap: 12, mobileCols: 3, dense: true, icon: 'fas fa-th-large' }, layout.grid || {});
    layout.tiles = Array.isArray(layout.tiles) ? layout.tiles : [];
    layout.tiles.forEach(function (t) { if (!t.id) t.id = newId(); });
    E.layout = layout;
    E.sel = null;
    var base = location.pathname.replace(/[^/]*$/, '');
    var url = location.origin + base + 'index.php?v=d&m=tuiles&p=panel&page_id=' + E.eqId;
    $('#span_tlUrl').text(url);
    $('#span_tlUrlKiosk').text(url + '&kiosk=1');
    editorInit().then(function () {
      layout.tiles.forEach(function (t) { migrateColors(t, E.presets); migrateSizes(t, layout.grid); });
      // page libre : l'ancienne colonne de gauche rejoint la grille (le bouton Accueil automatique est retiré)
      var hadSide = false;
      layout.tiles = layout.tiles.filter(function (t) {
        if (t.zone !== 'side') return true;
        hadSide = true;
        if (t.type === 'lien' && (t.target || 'home') === 'home' && t.id === 'home') return false;
        delete t.zone; delete t.x; delete t.y;
        return true;
      });
      if (layout.grid) delete layout.grid.sideCols;
      if (hadSide) setTimeout(function () { toast('Colonne de gauche supprimée : ses tuiles sont dans la grille. Sauvegardez pour garder ce changement.'); modified(); }, 300);
      return ensureMetas(U.collectIds([layout.tiles, (layout.grid || {}).alerts || []]));
    }).then(function () {
      E.mobile = layout.grid.device === 'mobile' && !(parseFloat(layout.grid.width) > 0);
      $('#cb_tlMobile').prop('checked', E.mobile);
      renderGridConf();
      renderAll();
    }).catch(fail);
  };

  window.saveEqLogic = function (_eqLogic) {
    if (E.layout && String(_eqLogic.id) === String(E.eqId)) {
      _eqLogic.configuration = _eqLogic.configuration || {};
      _eqLogic.configuration.layout = JSON.stringify(E.layout);
    }
    // une page Tuiles n'a aucune commande
    _eqLogic.cmd = [];
    return _eqLogic;
  };

  window.addCmdToTable = function () {};

  /* ================================================================== */
  /*  Rendu de l'éditeur                                                 */
  /* ================================================================== */

  var previewTimer = null;
  function renderPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      var root = document.getElementById('div_tlPreview');
      if (!root || !E.layout) return;
      $('#div_tlPreviewWrap').toggleClass('tl-ed-mobile', E.mobile);
      E.page = T.mount(root, {
        id: E.eqId, layout: E.layout, cmds: E.cmds, theme: E.theme, presets: E.presets, pages: E.pages, homeId: E.homeId,
        device: (E.layout.grid || {}).device === 'mobile' ? 'mobile' : 'tablette', lat: E.lat, lon: E.lon, nav: E.nav
      }, {
        edit: true, noResync: true, mobile: E.mobile ? true : false, selected: E.sel,
        onSelect: function (id) { select(id); },
        onMove: function (src, target) { moveTile(src, target); },
        onPlace: function (src, x, y, zone) { placeTile(src, x, y, zone); },
        onSwap: function (a, b) { swapTiles(a, b); },
        lastMoved: E.lastMoved
      });
      // positions corrigées par l'anti-chevauchement : on les enregistre
      var fixed = E.page.resolved || {}, changedSel = false;
      Object.keys(fixed).forEach(function (id) {
        var tt = tileById(id);
        if (!tt) return;
        tt.x = fixed[id].x; tt.y = fixed[id].y;
        if (id === E.sel) changedSel = true;
        modified();
      });
      if (changedSel) renderProps();
      showCell();
    }, 60);
  }
  function renderAll() {
    renderPreview();
    renderProps();
    updateBar();
  }
  function select(id) {
    E.sel = id;
    if (E.page) {
      E.page.opts.selected = id;
      $('#div_tlPreview .tl-tile').removeClass('tl-selected');
      $('#div_tlPreview .tl-tile[data-id="' + id + '"]').addClass('tl-selected');
    }
    renderProps();
    updateBar();
  }
  function updateBar() {
    var has = !!selTile();
    $('#bt_tlMoveLeft,#bt_tlMoveRight,#bt_tlDuplicate,#bt_tlDelete').toggleClass('disabled', !has);
  }

  /* ---------- réglages de grille ---------- */
  function renderGridConf() {
    var g = E.layout.grid;
    var box = $('#div_tlGridConf').empty();
    var line1 = $('<div class="tl-ed-gridline"></div>'), line2 = $('<div class="tl-ed-gridline"></div>');
    var num = function (target, k, label, o) {
      o = o || {};
      var inp = $('<input type="number" class="form-control input-sm">').attr({ min: o.min, max: o.max, placeholder: o.ph || '' }).val(isSet(g[k]) && !(o.zeroEmpty && !parseFloat(g[k])) ? g[k] : '');
      if (o.w) inp.css('width', o.w);
      inp.on('change', function () {
        var v = parseFloat(inp.val());
        g[k] = isNaN(v) ? (o.def !== undefined ? o.def : 0) : v;
        if (k === 'width' && g.device === 'mobile') {
          E.mobile = !(parseFloat(g.width) > 0);
          $('#cb_tlMobile').prop('checked', E.mobile);
        }
        modified(); renderPreview(); renderGridConf();
      });
      var lab = $('<label class="tl-ed-inline"></label>').text(label + ' ').append(inp);
      if (o.title) lab.attr('title', o.title);
      target.append(lab);
      return lab;
    };
    line1.append('<b class="tl-ed-gl">Design</b>');
    var dev = $('<select class="form-control input-sm" style="width:auto"></select>');
    [['tablette', 'Tablette'], ['mobile', 'Mobile']].forEach(function (o) { dev.append($('<option></option>').val(o[0]).text(o[1])); });
    if (g.device !== 'mobile') g.device = 'tablette';
    dev.val(g.device);
    dev.on('change', function () {
      g.device = dev.val();
      if (g.device === 'mobile') {
        if (!(parseFloat(g.cols) <= 4)) g.cols = 3;
        // retire le bouton Accueil de la colonne de gauche
        E.layout.tiles = E.layout.tiles.filter(function (t) { return !(t.zone === 'side' && t.type === 'lien' && (t.target || 'home') === 'home'); });
        if (parseFloat(g.width) > 1000) { delete g.width; delete g.height; }
      }
      E.mobile = g.device === 'mobile' && !(parseFloat(g.width) > 0);
      $('#cb_tlMobile').prop('checked', E.mobile);
      modified(); renderGridConf(); renderPreview();
    });
    line1.append($('<label class="tl-ed-inline" title="Appareil pour lequel cette page est conçue (classement dans « Mes pages »)"></label>').text('Appareil ').append(dev));
    var FORMATS = {
      tablette: [['1280x800', 'Tablette 1280 × 800'], ['800x1280', 'Tablette portrait 800 × 1280'], ['1024x768', 'iPad 1024 × 768'], ['768x1024', 'iPad portrait 768 × 1024'], ['1920x1200', 'Tablette 1920 × 1200']],
      mobile: [['400x860', 'Mon téléphone 400 × 860'], ['370x595', 'Téléphone 370 × 595'], ['360x800', 'Android 360 × 800'], ['384x832', 'Galaxy S24 FE 384 × 832'], ['412x915', 'Android 412 × 915'], ['390x844', 'iPhone 390 × 844'], ['430x932', 'iPhone Max 430 × 932']] };
    var fmt = $('<select class="form-control input-sm" style="width:auto"></select>');
    fmt.append('<option value="">Libre</option>');
    (FORMATS[g.device === 'mobile' ? 'mobile' : 'tablette'] || []).forEach(function (f) { fmt.append($('<option></option>').val(f[0]).text(f[1])); });
    var curFmt = (parseFloat(g.width) > 0 && parseFloat(g.height) > 0) ? (parseInt(g.width, 10) + 'x' + parseInt(g.height, 10)) : '';
    fmt.val(fmt.find('option[value="' + curFmt + '"]').length ? curFmt : '');
    fmt.on('change', function () {
      if (!fmt.val()) return;
      var wh = fmt.val().split('x');
      g.width = parseInt(wh[0], 10); g.height = parseInt(wh[1], 10); g.fit = true;
      E.mobile = false;
      $('#cb_tlMobile').prop('checked', false);
      modified(); renderGridConf(); renderPreview();
    });
    line1.append($('<label class="tl-ed-inline" title="Formats courants : remplit la largeur et la hauteur et active « Adapter à l\'écran »"></label>').text('Format ').append(fmt));
    num(line1, 'width', 'Largeur (px)', { min: 0, ph: 'auto', zeroEmpty: true, w: 80, title: 'Largeur totale de la page en pixels. Vide = s\'adapte à l\'écran.' });
    num(line1, 'height', 'Hauteur (px)', { min: 0, ph: 'libre', zeroEmpty: true, w: 80, title: 'Hauteur totale de la page en pixels. Vide = selon le contenu.' });
    var fit = $('<input type="checkbox">').prop('checked', !!g.fit);
    fit.on('change', function () { g.fit = fit.is(':checked'); modified(); renderPreview(); });
    E.fitLabel = $('<label class="tl-ed-inline" title="Agrandit ou réduit le design pour remplir l\'écran (tablette murale)"></label>').append(fit).append(' Adapter à l\'écran');
    line1.append(E.fitLabel);
    num(line1, 'pad', 'Marge (px)', { min: 0, max: 200, ph: '12', def: 12, w: 70 });
    var bgLab = $('<label class="tl-ed-inline" title="Couleur de fond de toute la page (vide = fond Jeedom)"></label>').text('Fond de page ');
    bgLab.append(colorField(g.bg, 'auto', function (c) { if (isSet(c)) g.bg = c; else delete g.bg; modified(); renderPreview(); }));
    line1.append(bgLab);
    line1.append('<span class="tl-ed-cell" id="span_tlCell"></span>');

    line2.append('<b class="tl-ed-gl">Grille</b>');
    num(line2, 'cols', 'Colonnes', { min: 1, max: 20, def: 5, w: 60 });
    E.sizeLabel = num(line2, 'size', 'Case (px)', { min: 40, max: 600, def: 200, w: 70, title: 'Taille d\'une case quand la largeur du design est vide' });
    num(line2, 'cellH', 'Hauteur case (px)', { min: 0, max: 600, ph: '= largeur', zeroEmpty: true, w: 90, title: 'Vide = cases carrées' });
    num(line2, 'gap', 'Espace entre tuiles (px)', { min: 0, max: 100, def: 12, w: 60 });
    num(line2, 'mobileCols', 'Colonnes mobile', { min: 1, max: 6, def: 3, w: 60 }).addClass('tl-ed-onlydesk');
    var dense = $('<input type="checkbox">').prop('checked', g.dense !== false);
    dense.on('change', function () { g.dense = dense.is(':checked'); modified(); renderPreview(); });
    line2.append($('<label class="tl-ed-inline" title="Les petites tuiles comblent les trous automatiquement"></label>').append(dense).append(' Remplissage auto'));
    var autoH = $('<input type="checkbox">').prop('checked', g.autoH !== false);
    autoH.on('change', function () { if (autoH.is(':checked')) delete g.autoH; else g.autoH = false; modified(); renderPreview(); });
    line2.append($('<label class="tl-ed-inline tl-ed-onlydesk" title="Réduit la hauteur des cases pour que toutes les tuiles tiennent dans l\'écran (ou dans la hauteur du design), au lieu d\'être coupées en bas. Jamais plus haut que la case réglée. Sans effet sur mobile (la page défile)."></label>').append(autoH).append(' Hauteur auto (tout tient à l\'écran)'));
    var icon = $('<input type="text" class="form-control input-sm" style="width:130px">').val(g.icon || '');
    icon.on('change', function () { g.icon = icon.val(); modified(); });
    line2.append($('<label class="tl-ed-inline" title="Icône de la page dans la liste des pages"></label>').text('Icône ').append(icon));
    var line3 = $('<div class="tl-ed-gridline"></div>');
    line3.append('<b class="tl-ed-gl">Style</b>');
    var skin = $('<select class="form-control input-sm" style="width:auto"></select>');
    [['', 'Aucun (noir)'], ['neon-bleu', 'Néon bleu'], ['neon-vert', 'Néon vert'], ['neon-violet', 'Néon violet'], ['ambre', 'Ambre'], ['graphite', 'Graphite'], ['aurore', 'Aurore'], ['cockpit', 'Cockpit'], ['ardoise', 'Ardoise']].forEach(function (o) { skin.append($('<option></option>').val(o[0]).text(o[1])); });
    skin.val(g.skin || '').on('change', function () { if (skin.val()) g.skin = skin.val(); else delete g.skin; modified(); renderPreview(); });
    line3.append($('<label class="tl-ed-inline" title="Tuiles en verre avec contour lumineux, noms en petites capitales. Les couleurs de chaque tuile restent prioritaires."></label>').text('Thème ').append(skin));
    var nav = $('<select class="form-control input-sm" style="width:auto"></select>');
    [['', 'Barre commune'], ['none', 'Pas de barre sur cette page']].forEach(function (o) { nav.append($('<option></option>').val(o[0]).text(o[1])); });
    nav.val(g.nav === 'none' ? 'none' : '').on('change', function () { if (nav.val()) g.nav = nav.val(); else delete g.nav; delete g.navLabel; delete g.navOrder; delete g.navHide; delete g.navHome; modified(); renderPreview(); });
    line3.append($('<label class="tl-ed-inline" title="La barre d\'onglets est commune à toutes les pages ; elle peut être masquée sur une page."></label>').text('Onglets ').append(nav));
    line3.append($('<a class="btn btn-xs btn-primary"><i class="fas fa-grip-lines"></i> Régler la barre d\'onglets…</a>').on('click', function () { openNavEditor(); }));
    // tailles communes à toutes les tuiles de la page
    var line4 = $('<div class="tl-ed-gridline"></div>');
    line4.append('<b class="tl-ed-gl">Textes</b>');
    var pxNum = function (k, label, title) {
      var inp = $('<input type="number" class="form-control input-sm" style="width:70px" min="0" max="300" placeholder="auto">').val(U.isNum(g[k]) && parseFloat(g[k]) > 0 ? g[k] : '');
      inp.on('change', function () { var v = parseFloat(inp.val()); if (v > 0) g[k] = v; else delete g[k]; modified(); renderPreview(); if (selTile()) renderProps(); });
      line4.append($('<label class="tl-ed-inline"></label>').attr('title', title).text(label + ' ').append(inp));
    };
    pxNum('titlePx', 'Noms (px)', 'Même taille de nom pour toutes les tuiles de la page. Une tuile qui a sa propre taille la garde.');
    pxNum('textPx', 'Textes / valeurs (px)', 'Même taille de texte pour toutes les tuiles de la page.');
    pxNum('iconPx', 'Icônes / logos (px)', 'Même taille d\'icône pour toutes les tuiles de la page.');
    var nOwn = E.layout.tiles.filter(function (t) { return ['titlePx', 'textPx', 'iconPx'].some(function (k) { return U.isNum(t[k]) && U.isNum(g[k]); }); }).length;
    if (nOwn) {
      line4.append($('<a class="btn btn-xs btn-warning"></a>').html('<i class="fas fa-magic"></i> Appliquer à toutes les tuiles (' + nOwn + ' ont leur propre taille)').on('click', function () {
        T.ui.confirm('Retirer les tailles propres à chaque tuile pour utiliser celles de la page ?', function () {
          E.layout.tiles.forEach(function (t) { ['titlePx', 'textPx', 'iconPx'].forEach(function (k) { if (U.isNum(g[k])) delete t[k]; }); });
          modified(); renderPreview(); renderGridConf(); if (selTile()) renderProps();
        });
      }));
    }
    // Design, Style, Textes et Alertes sont repliés dans « Réglages de la page » pour laisser de la hauteur à l'aperçu
    $('#bt_tlPageConf').toggleClass('active btn-primary', !!E.confOpen).toggleClass('btn-default', !E.confOpen);
    if (E.confOpen) {
      box.append(line1).append(line2).append(line3).append(line4);
      box.append(alertsConf(g));
    } else {
      box.append(line2);
      // garde les libellés utilisés ailleurs (taille de case, adapter à l'écran)
    }
    syncGridConf();
  }

  /* ---------- barre d'onglets commune (toutes les pages) ---------- */
  function openNavEditor() {
    editorInit().then(function () {
      var nav = JSON.parse(JSON.stringify(E.nav || { enabled: false, home: false, items: [] }));
      var all = T.navItems({ nav: nav, pages: E.pages });
      var devOf = function (pg) { return pg.device === 'mobile' ? 'mobile' : 'tablette'; };
      // seulement les appareils qui ont des pages
      var DEVS = [['tablette', 'Tablette', '🖥'], ['mobile', 'Mobile', '📱']].filter(function (d) { return E.pages.some(function (pg) { return devOf(pg) === d[0]; }); });
      if (!DEVS.length) DEVS = [['tablette', 'Tablette', '🖥']];
      nav.devices = nav.devices || { tablette: !!nav.enabled, mobile: !!nav.enabled };
      delete nav.devices.pc;
      nav.homePages = nav.homePages || {};
      nav.dev = nav.dev || {};
      // réglages propres à chaque appareil (repris des réglages communs la première fois)
      var conf = {}, items = {};
      DEVS.forEach(function (d) {
        var c = nav.dev[d[0]] || {};
        conf[d[0]] = {
          size: c.size || nav.size || 100, home: c.home !== undefined ? !!c.home : !!nav.home,
          homeLabel: c.homeLabel !== undefined ? c.homeLabel : (nav.homeLabel || ''), homeIcon: c.homeIcon !== undefined ? c.homeIcon : (nav.homeIcon || ''),
          swipeHome: c.swipeHome !== undefined ? !!c.swipeHome : !!nav.swipeHome, swipeDist: c.swipeDist || nav.swipeDist || 100, idleHome: c.idleHome !== undefined ? c.idleHome : (nav.idleHome || 0),
          veille: c.veille !== undefined ? c.veille : (nav.veille || 0), veilleDate: c.veilleDate !== undefined ? !!c.veilleDate : !!nav.veilleDate, veilleLogo: c.veilleLogo !== undefined ? c.veilleLogo : (nav.veilleLogo || ''),
          veilleColor: c.veilleColor || nav.veilleColor || '#8a8a8a', veilleLum: c.veilleLum || nav.veilleLum || 100, veilleSize: c.veilleSize || nav.veilleSize || 100, veilleBg: c.veilleBg || nav.veilleBg || '#000000',
          alerts: Object.assign({ on: false, bat: true, stale: 72, net: true, dm: true, to: false, every: 300, page: '', ignore: '', onPage: 'home' }, c.alerts || {}),
          ring: Object.assign({ on: false, page: '', tile: '', size: 'grand', close: 4, mute: '', muteVal: '1', sound: 'dingdong', soundUrl: '', vol: 80, repeat: 0, cam: '', camPos: 'cote' }, c.ring || {}),
          homeZone: c.homeZone !== undefined ? c.homeZone : (nav.homeZone || ''), homeZoneSize: c.homeZoneSize || nav.homeZoneSize || 70, homeZoneShow: c.homeZoneShow !== undefined ? !!c.homeZoneShow : !!nav.homeZoneShow,
          full: c.full !== undefined ? !!c.full : d[0] === 'mobile'
        };
        items[d[0]] = all.filter(function (it) { return it.device === d[0]; });
      });
      var body = $('<div class="tl-ed-nav"></div>');
      var sw = $('<div class="tl-ed-navsw"></div>');
      body.append($('<div class="tl-ed-navopt"><b>Menu de l\'appareil :</b> </div>').append(sw));
      body.append('<div class="tl-ed-hint">Chaque appareil a son propre menu : ses onglets, leur ordre, la taille, le bouton accueil et le retour à l\'accueil.</div>');
      var panes = {};
      DEVS.forEach(function (d) {
        var dev = d[0], c = conf[dev], list = items[dev];
        var pane = panes[dev] = $('<div class="tl-ed-navpane"></div>');
        var on = $('<input type="checkbox">').prop('checked', !!nav.devices[dev]).on('change', function () { nav.devices[dev] = on.is(':checked'); });
        pane.append($('<label class="tl-ed-navopt"></label>').append(on).append(' <b>Afficher la barre d\'onglets sur les pages ' + d[1].toLowerCase() + '</b>'));
        var sz = $('<input type="range" min="60" max="300" step="10" style="width:220px;display:inline-block;vertical-align:middle">').val(c.size);
        var szv = $('<b style="display:inline-block;width:50px;text-align:right"></b>').text(c.size + ' %');
        var szPrev = $('<div class="tl-ed-navprev tl-root"></div>');
        var drawPrev = function () {
          var k = c.size / 100, shown = list.filter(function (it) { return it.show; }).slice(0, 4);
          var html = '<div class="tl-tabs' + (c.full ? ' tl-tabs-full' : '') + '" style="--tk:' + k + '"><div class="tl-tabs-in">';
          if (c.home) html += '<button type="button" class="tl-tab tl-tab-home' + (c.homeLabel ? ' tl-tab-homelab' : '') + '"><span class="tl-tab-ico">' + T.iconHtml(c.homeIcon || 'svg:home') + '</span>' + (c.homeLabel ? '<span class="tl-tab-txt">' + $('<i>').text(c.homeLabel).html() + '</span>' : '') + '</button>';
          (shown.length ? shown : [{ name: 'Page', icon: '', pageIcon: '' }]).forEach(function (it, i) {
            html += '<button type="button" class="tl-tab' + (i === 0 ? ' tl-on' : '') + '"><span class="tl-tab-ico">' + T.iconHtml(it.icon || it.pageIcon || 'fas fa-th-large') + '</span><span class="tl-tab-txt">' + $('<i>').text(it.label || it.name).html() + '</span></button>';
          });
          szPrev.html(html + '</div></div>');
        };
        sz.on('input', function () { c.size = parseInt(sz.val(), 10); szv.text(c.size + ' %'); drawPrev(); });
        pane.append($('<div class="tl-ed-navopt"></div>').append('<b>Taille des onglets :</b> ').append(sz).append(szv));
        pane.append(szPrev);
        var fu = $('<input type="checkbox">').prop('checked', c.full).on('change', function () { c.full = fu.is(':checked'); drawPrev(); });
        pane.append($('<label class="tl-ed-navopt"></label>').append(fu).append(' Onglets sur toute la largeur (même largeur pour chaque onglet)'));
        var hm = $('<input type="checkbox">').prop('checked', c.home).on('change', function () { c.home = hm.is(':checked'); syncHome(); drawPrev(); });
        pane.append($('<label class="tl-ed-navopt"></label>').append(hm).append(' Bouton accueil au début de la barre'));
        var homeBox = $('<div class="tl-ed-navhome"></div>');
        var sel = $('<select class="form-control input-sm" style="width:auto"></select>');
        sel.append('<option value="">Accueil du plugin</option>');
        E.pages.filter(function (pg) { return devOf(pg) === dev; }).forEach(function (pg) { sel.append($('<option></option>').val(String(pg.id)).text(pg.name)); });
        sel.val(String(nav.homePages[dev] || '')).on('change', function () { nav.homePages[dev] = sel.val(); });
        homeBox.append($('<label class="tl-ed-inline"></label>').text('Page d\'accueil ').append(sel));
        var hl = $('<input type="text" class="form-control input-sm" style="width:110px" placeholder="icône seule">').val(c.homeLabel).on('input', function () { c.homeLabel = $(this).val(); drawPrev(); });
        homeBox.append($('<label class="tl-ed-inline"></label>').text('Texte du bouton ').append(hl));
        homeBox.append($('<div class="tl-ed-navhicon"></div>').append('<span>Icône du bouton </span>').append(iconField(c.homeIcon, 'svg:home', function (v) { c.homeIcon = v; drawPrev(); })));
        homeBox.append('<div class="tl-ed-hint">La page d\'accueil sert aussi au geste et au retour automatique ci-dessous. Elle n\'est plus répétée dans les onglets quand le bouton accueil est affiché.</div>');
        pane.append(homeBox);
        var syncHome = function () { homeBox.find('.tl-ed-navhicon, .tl-ed-inline:nth-child(2)').toggle(c.home); };
        syncHome();
        var back = $('<div class="tl-ed-navhome"></div>');
        var swc = $('<input type="checkbox">').prop('checked', c.swipeHome).on('change', function () { c.swipeHome = swc.is(':checked'); });
        var swd = $('<input type="number" min="30" max="600" step="10" class="form-control input-sm" style="width:80px">').val(c.swipeDist || 100).on('input', function () { c.swipeDist = parseInt($(this).val(), 10) || 100; });
        back.append($('<label class="tl-ed-inline"></label>').append(swc).append(' Glisser le doigt vers la droite, n\'importe où sur la page → page d\'accueil'));
        back.append($('<label class="tl-ed-inline"></label>').text('Distance à parcourir avec le doigt : ').append(swd).append(' px minimum (100 par défaut, 30 à 600)'));
        var idl = $('<input type="number" min="0" max="240" step="1" class="form-control input-sm" style="width:70px" placeholder="0">').val(c.idleHome > 0 ? c.idleHome : '').on('input', function () { c.idleHome = parseFloat($(this).val()) || 0; });
        back.append($('<label class="tl-ed-inline"></label>').text('Retour automatique à l\'accueil après ').append(idl).append(' min sans toucher (vide = jamais)'));
        var hz = $('<select class="form-control input-sm" style="width:auto;display:inline-block"></select>');
        [['', 'aucun'], ['tl', 'en haut à gauche'], ['tr', 'en haut à droite'], ['bl', 'en bas à gauche'], ['br', 'en bas à droite']].forEach(function (o) { hz.append($('<option>').val(o[0]).text(o[1])); });
        hz.val(c.homeZone || '').on('change', function () { c.homeZone = hz.val(); });
        back.append($('<label class="tl-ed-inline"></label>').text('Bouton caché (appui → page d\'accueil) : ').append(hz));
        var hzs = $('<input type="number" min="30" max="200" step="5" class="form-control input-sm" style="width:70px">').val(c.homeZoneSize || 70).on('input', function () { c.homeZoneSize = parseInt($(this).val(), 10) || 70; });
        var hzv = $('<input type="checkbox">').prop('checked', !!c.homeZoneShow).on('change', function () { c.homeZoneShow = hzv.is(':checked'); });
        back.append($('<label class="tl-ed-inline"></label>').text('Taille de la zone : ').append(hzs).append(' px'));
        back.append($('<label class="tl-ed-inline"></label>').append(hzv).append(' Montrer une maison très discrète (sinon zone invisible)'));
        pane.append($('<div class="tl-ed-navopt"><b>Retour à l\'accueil sans bouton :</b></div>')).append(back);
        var vb = $('<div class="tl-ed-navhome"></div>');
        var vmin = $('<input type="number" min="0" max="240" step="1" class="form-control input-sm" style="width:70px" placeholder="0">').val(c.veille > 0 ? c.veille : '').on('input', function () { c.veille = parseFloat($(this).val()) || 0; });
        vb.append($('<label class="tl-ed-inline"></label>').text('Écran de veille après ').append(vmin).append(' min sans toucher (vide = jamais)'));
        var vdt = $('<input type="checkbox">').prop('checked', !!c.veilleDate).on('change', function () { c.veilleDate = vdt.is(':checked'); });
        vb.append($('<label class="tl-ed-inline"></label>').append(vdt).append(' Afficher la date sous l\'heure'));
        var vlg = $('<input type="text" class="form-control input-sm" style="width:340px" placeholder="vide = pas d\'image">').val(c.veilleLogo || '').on('input', function () { c.veilleLogo = $(this).val().trim(); });
        vb.append($('<label class="tl-ed-inline"></label>').text('Image en bas à droite (adresse) : ').append(vlg));
        var vcol = $('<input type="color" style="width:46px;height:28px;padding:0;border:0;vertical-align:middle">').val(c.veilleColor || '#8a8a8a').on('input', function () { c.veilleColor = $(this).val(); });
        var vbg = $('<input type="color" style="width:46px;height:28px;padding:0;border:0;vertical-align:middle">').val(c.veilleBg || '#000000').on('input', function () { c.veilleBg = $(this).val(); });
        vb.append($('<label class="tl-ed-inline"></label>').text('Couleur du texte : ').append(vcol).append('&nbsp;&nbsp; Fond : ').append(vbg));
        var vlumOut = $('<b style="min-width:44px;display:inline-block"></b>').text((c.veilleLum || 100) + ' %');
        var vlum = $('<input type="range" min="5" max="100" step="5" style="width:200px;display:inline-block;vertical-align:middle">').val(c.veilleLum || 100).on('input', function () { c.veilleLum = parseInt($(this).val(), 10) || 100; vlumOut.text(c.veilleLum + ' %'); });
        vb.append($('<label class="tl-ed-inline"></label>').text('Luminosité : ').append(vlum).append(' ').append(vlumOut));
        var vsz = $('<input type="number" min="40" max="200" step="10" class="form-control input-sm" style="width:70px">').val(c.veilleSize || 100).on('input', function () { c.veilleSize = parseInt($(this).val(), 10) || 100; });
        vb.append($('<label class="tl-ed-inline"></label>').text('Taille de l\'heure : ').append(vsz).append(' %'));
        var vprev = $('<a class="btn btn-default btn-sm"><i class="fas fa-eye"></i> Voir la veille</a>').on('click', function () { if (window.Tuiles && Tuiles.veillePreview) Tuiles.veillePreview(c); });
        vb.append($('<div style="margin-top:6px"></div>').append(vprev).append(' <span class="tl-ed-hint" style="display:inline">un appui la ferme</span>'));
        pane.append($('<div class="tl-ed-navopt"><b>Écran de veille :</b></div>')).append(vb);
        var al = c.alerts, ab = $('<div class="tl-ed-navhome"></div>');
        var ack = function (k, label) { var x = $('<input type="checkbox">').prop('checked', !!al[k]).on('change', function () { al[k] = x.is(':checked'); }); return $('<label class="tl-ed-inline"></label>').append(x).append(' ' + label); };
        ab.append(ack('on', '<b>Afficher un bandeau rouge en haut de l\'écran quand il y a un problème</b> (invisible sinon)'));
        var wh = $('<select class="form-control input-sm" style="width:auto;display:inline-block"></select>').append('<option value="home">La page d\'accueil seulement</option>').append('<option value="">Toutes les pages</option>');
        E.pages.filter(function (pg) { return devOf(pg) === dev; }).forEach(function (pg) { wh.append($('<option>').val(String(pg.id)).text('Seulement : ' + pg.name)); });
        wh.val(al.onPage === undefined ? 'home' : String(al.onPage)).on('change', function () { al.onPage = wh.val(); });
        ab.append($('<label class="tl-ed-inline"></label>').text('Afficher sur : ').append(wh));
        ab.append(ack('bat', '🔋 Piles faibles (seuils des équipements Jeedom)'));
        var stl = $('<input type="number" min="0" max="2000" step="12" class="form-control input-sm" style="width:80px">').val(al.stale).on('input', function () { al.stale = parseInt($(this).val(), 10) || 0; });
        ab.append($('<label class="tl-ed-inline" style="margin-left:22px"></label>').text('… et piles sans nouvelles depuis plus de ').append(stl).append(' h (0 = non)'));
        ab.append(ack('net', '📡 Équipements réseau hors ligne (plugin Network)'));
        ab.append(ack('dm', '⚙ Démons arrêtés et dépendances NOK'));
        ab.append(ack('to', '⏱ Équipements qui ne communiquent plus (délai Jeedom dépassé)'));
        var ev = $('<input type="number" min="60" max="3600" step="60" class="form-control input-sm" style="width:80px">').val(al.every).on('input', function () { al.every = parseInt($(this).val(), 10) || 300; });
        ab.append($('<label class="tl-ed-inline"></label>').text('Vérifier toutes les ').append(ev).append(' s'));
        var apg = $('<select class="form-control input-sm" style="width:auto;display:inline-block"></select>').append('<option value="">Aucune</option>');
        E.pages.filter(function (pg) { return devOf(pg) === dev; }).forEach(function (pg) { apg.append($('<option>').val(pg.id).text(pg.name)); });
        apg.val(al.page || '').on('change', function () { al.page = apg.val(); });
        ab.append($('<label class="tl-ed-inline"></label>').text('Bouton « Voir la page » : ').append(apg));
        var ig = $('<input type="text" class="form-control input-sm" style="width:340px" placeholder="ex. OMG Garage; HomeAssistant">').val(al.ignore || '').on('input', function () { al.ignore = $(this).val(); });
        ab.append($('<label class="tl-ed-inline"></label>').text('Ignorer (noms, séparés par ;) : ').append(ig));
        pane.append($('<div class="tl-ed-navopt"><b>Bandeau d\'alertes :</b></div>')).append(ab);
        // fenêtre portier : la tuile interphone choisie s'ouvre sur toutes les pages quand on sonne
        var rg = c.ring, rb = $('<div class="tl-ed-navhome"></div>');
        var ron = $('<input type="checkbox">').prop('checked', !!rg.on).on('change', function () { rg.on = ron.is(':checked'); });
        rb.append($('<label class="tl-ed-inline"></label>').append(ron).append(' <b>Ouvrir la fenêtre du portier sur toutes les pages quand ça sonne</b> (décoché = désactivée)'));
        var rsel = $('<select class="form-control input-sm" style="width:auto;display:inline-block"></select>').append('<option value="">Choisir…</option>');
        var rhint = $('<div class="tl-ed-hint"></div>');
        rb.append($('<label class="tl-ed-inline"></label>').text('Tuile affichée : ').append(rsel)).append(rhint);
        T.ajax('interphoneTiles', {}).then(function (list) {
          (list || []).filter(function (x) { return x.device === dev && x.tile; }).forEach(function (x) {
            rsel.append($('<option>').val(x.page + '|' + x.tile).text(x.pageName + ' › ' + (x.title || 'Interphone')));
          });
          if (rg.page && rg.tile) rsel.val(rg.page + '|' + rg.tile);
          if (rsel.find('option').length < 2) rhint.text('Aucune tuile interphone sur une page ' + dev + ' : ajoutez-en une (fonction Interphone).');
          else rhint.text('C\'est cette tuile qui s\'affiche : pour changer les boutons, la caméra, le nom… modifiez-la sur sa page.');
        });
        rsel.on('change', function () { var v = String(rsel.val() || '').split('|'); rg.page = v[0] || ''; rg.tile = v[1] || ''; });
        var rcam = $('<select class="form-control input-sm" style="width:auto;display:inline-block"></select>').append('<option value="">Aucune</option>');
        var rcpos = $('<select class="form-control input-sm" style="width:auto;display:inline-block"></select>').append('<option value="cote">à côté de l\'image du portier</option><option value="remplace">à la place de l\'image du portier</option>').val(rg.camPos || 'cote').on('change', function () { rg.camPos = rcpos.val(); });
        T.ajax('interphoneTiles', { type: 'camera' }).then(function (list) {
          (list || []).filter(function (x) { return x.tile; }).forEach(function (x) {
            rcam.append($('<option>').val(x.page + '|' + x.tile).text(x.pageName + ' › ' + (x.title || 'Caméra')));
          });
          rcam.val(rg.cam || '');
        });
        rcam.on('change', function () { rg.cam = rcam.val() || ''; });
        rb.append($('<label class="tl-ed-inline"></label>').text('Caméra dans la fenêtre : ').append(rcam).append(' ').append(rcpos));
        rb.append($('<div class="tl-ed-hint"></div>').text('Une tuile Caméra de vos pages (ex. Sécurité › Caméra Ouest), avec ses réglages : mode rapide / flux, relais Jeedom, pastilles. Arrêtée à la fermeture.'));
        var rsz = $('<select class="form-control input-sm" style="width:auto;display:inline-block"></select>').append('<option value="normal">Normale</option><option value="grand">Grande</option><option value="plein">Plein écran</option>').val(rg.size || 'grand').on('change', function () { rg.size = rsz.val(); });
        rb.append($('<label class="tl-ed-inline"></label>').text('Taille de la fenêtre : ').append(rsz));
        var rcl = $('<input type="number" min="0" max="120" step="1" class="form-control input-sm" style="width:70px">').val(rg.close).on('input', function () { var n = parseInt($(this).val(), 10); rg.close = isNaN(n) ? 4 : n; });
        rb.append($('<label class="tl-ed-inline"></label>').text('Fermer ').append(rcl).append(' s après la fin de l\'appel (0 = rester ouverte)'));
        var rmi = $('<input type="text" class="form-control input-sm" readonly style="width:200px;display:inline-block">').attr('placeholder', 'Aucune');
        var paintMute = function () { rmi.val(rg.mute ? cmdLabel(rg.mute) : ''); };
        if (rg.mute) ensureMetas([rg.mute]).then(paintMute, paintMute); else paintMute();
        var rmp = $('<a class="btn btn-default btn-sm"><i class="fas fa-list-alt"></i></a>').on('click', function () { pickCmd(C_INFO, function (cid) { rg.mute = cid; paintMute(); }); });
        var rmx = $('<a class="btn btn-default btn-sm"><i class="fas fa-times"></i></a>').on('click', function () { rg.mute = ''; paintMute(); });
        var rmv = $('<input type="text" class="form-control input-sm" style="width:60px;display:inline-block">').val(rg.muteVal || '1').on('input', function () { rg.muteVal = $(this).val(); });
        rb.append($('<label class="tl-ed-inline"></label>').text('Ne pas déranger : ').append(rmi).append(rmp).append(rmx).append(' → pas de fenêtre si = ').append(rmv));
        var rsd = $('<select class="form-control input-sm" style="width:auto;display:inline-block"></select>').append('<option value="">Aucune</option><option value="dingdong">Ding-dong</option><option value="carillon">Carillon (4 notes)</option><option value="triton">Triton (3 notes)</option><option value="bip">Bips</option><option value="url">Fichier audio (adresse)</option>').val(rg.sound || '');
        var rurl = $('<input type="text" class="form-control input-sm" style="width:300px;display:inline-block" placeholder="ex. /plugins/tuiles/data/sonnette.mp3">').val(rg.soundUrl || '').on('input', function () { rg.soundUrl = $(this).val().trim(); });
        var rurlL = $('<label class="tl-ed-inline"></label>').text('Adresse du son : ').append(rurl);
        var rvol = $('<input type="range" min="0" max="100" step="5" style="width:140px;display:inline-block;vertical-align:middle">').val(rg.vol);
        var rvolT = $('<span></span>').text(rg.vol + ' %');
        rvol.on('input', function () { rg.vol = parseInt(rvol.val(), 10); rvolT.text(rg.vol + ' %'); });
        var rrep = $('<input type="number" min="0" max="600" class="form-control input-sm" style="width:70px">').val(rg.repeat).on('input', function () { var n = parseInt($(this).val(), 10); rg.repeat = isNaN(n) ? 0 : n; });
        var rplay = $('<a class="btn btn-default btn-sm"><i class="fas fa-volume-up"></i> Écouter</a>'), rstop = null;
        rplay.on('click', function () {
          if (rstop) { rstop(); rstop = null; rplay.html('<i class="fas fa-volume-up"></i> Écouter'); return; }
          if (!window.Tuiles || !Tuiles.ringSound) { fail('Rechargez la page (Ctrl+F5)'); return; }
          rstop = Tuiles.ringSound({ sound: rg.sound, url: rg.soundUrl, vol: rg.vol, once: true });
          rplay.html('<i class="fas fa-stop"></i> Stop');
          setTimeout(function () { if (rstop) { rstop = null; rplay.html('<i class="fas fa-volume-up"></i> Écouter'); } }, 4000);
        });
        var paintSnd = function () { rurlL.toggle(rg.sound === 'url'); };
        rsd.on('change', function () { rg.sound = rsd.val(); paintSnd(); });
        rb.append($('<label class="tl-ed-inline"></label>').text('Sonnerie : ').append(rsd).append(' ').append(rplay));
        rb.append(rurlL);
        rb.append($('<label class="tl-ed-inline"></label>').text('Volume : ').append(rvol).append(' ').append(rvolT));
        rb.append($('<label class="tl-ed-inline"></label>').text('Sonne tant que l\'info dit « on sonne » (s\'arrête quand on décroche, ouvre la porte ou ferme la fenêtre ; sinon jusqu\'au retour au repos). Sécurité : arrêter au bout de ').append(rrep).append(' s (0 = jamais)'));
        rb.append($('<div class="tl-ed-hint"></div>').text('Fully Kiosk : activez « Autoplay audio » (Web Content Settings) et laissez le volume média de la tablette monté. Ailleurs, le son ne marche qu\'après un premier appui sur l\'écran depuis le chargement.'));
        paintSnd();
        var rtest = $('<a class="btn btn-default btn-sm"><i class="fas fa-bell"></i> Tester la fenêtre</a>').on('click', function () {
          if (!rg.page || !rg.tile) { fail('Choisissez d\'abord la tuile'); return; }
          if (window.Tuiles && Tuiles.ringPreview) Tuiles.ringPreview(rg); else fail('Rechargez la page (Ctrl+F5)');
        });
        rb.append($('<div style="margin-top:6px"></div>').append(rtest).append(' <span class="tl-ed-hint" style="display:inline">aperçu avec la sonnerie simulée (aucune commande envoyée)</span>'));
        pane.append($('<div class="tl-ed-navopt"><b>Fenêtre portier :</b></div>')).append(rb);
        pane.append('<div class="tl-ed-hint">Onglets : glissez les lignes pour changer l\'ordre, décochez pour masquer. Une page peut masquer la barre dans ses réglages (Style → Onglets).</div>');
        var listEl = $('<div class="tl-ed-navlist"></div>');
        pane.append(listEl);
        var drag = null;
        var draw = function () {
          listEl.empty();
          if (!list.length) listEl.append('<div class="tl-ed-hint">Aucune page ' + d[1].toLowerCase() + '.</div>');
          list.forEach(function (it, i) {
            var row = $('<div class="tl-ed-navrow" draggable="true"></div>').toggleClass('tl-ed-navoff', !it.show);
            row.append('<span class="tl-ed-navgrip" title="Glisser"><i class="fas fa-grip-vertical"></i></span>');
            var cb = $('<input type="checkbox" title="Afficher dans la barre">').prop('checked', !!it.show).on('change', function () { it.show = cb.is(':checked'); row.toggleClass('tl-ed-navoff', !it.show); drawPrev(); });
            row.append(cb);
            row.append($('<span class="tl-ed-navname"></span>').text(it.name));
            row.append($('<input type="text" class="form-control input-sm tl-ed-navlab" placeholder="Nom d\'onglet">').val(it.label || '').on('input', function () { it.label = $(this).val(); drawPrev(); }));
            row.append(iconField(it.icon, it.pageIcon || 'fas fa-th-large', function (v) { it.icon = v; drawPrev(); }));
            var up = $('<a class="btn btn-xs btn-default" title="Monter"><i class="fas fa-arrow-up"></i></a>').on('click', function () { if (i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); draw(); drawPrev(); } });
            var dn = $('<a class="btn btn-xs btn-default" title="Descendre"><i class="fas fa-arrow-down"></i></a>').on('click', function () { if (i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); draw(); drawPrev(); } });
            row.append($('<span class="tl-ed-navarrows"></span>').append(up).append(dn));
            row.on('dragstart', function (e) { drag = i; row.addClass('tl-ed-navdrag'); if (e.originalEvent.dataTransfer) e.originalEvent.dataTransfer.setData('text/plain', String(i)); });
            row.on('dragend', function () { row.removeClass('tl-ed-navdrag'); listEl.find('.tl-ed-navover').removeClass('tl-ed-navover'); });
            row.on('dragover', function (e) { e.preventDefault(); listEl.find('.tl-ed-navover').removeClass('tl-ed-navover'); row.addClass('tl-ed-navover'); });
            row.on('drop', function (e) {
              e.preventDefault();
              if (drag === null || drag === i) return;
              list.splice(i, 0, list.splice(drag, 1)[0]);
              drag = null;
              draw(); drawPrev();
            });
            row.find('input, a, .tl-ed-icon').on('mousedown', function () { row.attr('draggable', 'false'); }).on('mouseup blur', function () { row.attr('draggable', 'true'); });
            listEl.append(row);
          });
        };
        draw();
        drawPrev();
        body.append(pane);
      });
      var curDev = ((E.layout && E.layout.grid) || {}).device === 'mobile' && panes.mobile ? 'mobile' : DEVS[0][0];
      var showDev = function (dev) {
        curDev = dev;
        Object.keys(panes).forEach(function (k) { panes[k].toggle(k === dev); });
        sw.find('a').each(function () { $(this).toggleClass('btn-primary', $(this).data('dev') === dev).toggleClass('btn-default', $(this).data('dev') !== dev); });
      };
      DEVS.forEach(function (d) { sw.append($('<a class="btn btn-sm"></a>').data('dev', d[0]).text(d[2] + ' ' + d[1]).on('click', function () { showDev(d[0]); })).append(' '); });
      showDev(curDev);
      T.ui.modal({
        title: 'Barres d\'onglets (menu tablette / menu mobile)', body: body[0], wide: true,
        buttons: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, click: function (close) {
          var mapIt = function (it) { return { id: it.id, label: it.label || '', icon: it.icon || '', show: !!it.show }; };
          var dev = {}, flat = [];
          DEVS.forEach(function (d) {
            var c = conf[d[0]];
            dev[d[0]] = { size: c.size || 100, full: !!c.full, home: !!c.home, homeLabel: c.homeLabel || '', homeIcon: c.homeIcon || '', swipeHome: !!c.swipeHome, swipeDist: c.swipeDist || 100, idleHome: c.idleHome || 0, veille: c.veille || 0, veilleDate: !!c.veilleDate, veilleLogo: c.veilleLogo || '', veilleColor: c.veilleColor || '#8a8a8a', veilleLum: c.veilleLum || 100, veilleSize: c.veilleSize || 100, veilleBg: c.veilleBg || '#000000', alerts: c.alerts, ring: c.ring, homeZone: c.homeZone || '', homeZoneSize: c.homeZoneSize || 70, homeZoneShow: !!c.homeZoneShow, items: items[d[0]].map(mapIt) };
            flat = flat.concat(items[d[0]].map(mapIt));
          });
          var c0 = conf[DEVS[0][0]];
          var payload = { enabled: !!(nav.devices.tablette || nav.devices.mobile), devices: nav.devices, homePages: nav.homePages, dev: dev,
            // réglages communs (anciennes versions du moteur) : ceux du premier appareil
            home: !!c0.home, size: c0.size || 100, homeLabel: c0.homeLabel || '', homeIcon: c0.homeIcon || '', swipeHome: !!c0.swipeHome, swipeDist: c0.swipeDist || 100, idleHome: c0.idleHome || 0, items: flat };
          T.ajax('saveNav', { nav: payload }).then(function (saved) {
            E.nav = saved;
            if (!(saved && saved.dev)) {
              toast('Le serveur n\'a pas gardé les menus par appareil : remplacez core/class/tuiles.class.php par celui de la dernière mise à jour.', 'error');
            } else toast('Menus enregistrés');
            renderPreview();
            close();
          }).catch(fail);
          return false;
        } }]
      });
    }).catch(fail);
  }

  /* ---------- bandeau d'alertes de la page ---------- */
  var ALERT_OPS = [['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤'], ['=', '='], ['!=', '≠'], ['out', 'hors de'], ['in', 'entre'], ['text', 'texte de la commande']];
  function alertsConf(g) {
    var alerts = g.alerts = Array.isArray(g.alerts) ? g.alerts : [];
    var wrap = $('<div class="tl-ed-gridline tl-ed-alerts"></div>');
    var head = $('<b class="tl-ed-gl">Alertes</b>');
    var toggle = $('<a class="btn btn-xs btn-default"></a>').html('<i class="fas fa-exclamation-triangle"></i> ' + (alerts.length ? alerts.length + ' règle' + (alerts.length > 1 ? 's' : '') : 'Aucune') + ' <i class="fas fa-caret-' + (E.alertsOpen ? 'up' : 'down') + '"></i>');
    toggle.on('click', function () { E.alertsOpen = !E.alertsOpen; renderGridConf(); });
    wrap.append(head).append(toggle);
    wrap.append('<span class="tl-ed-hint">Bandeau en haut de la page quand une condition est vraie ; un appui le masque jusqu\'au prochain déclenchement.</span>');
    if (!E.alertsOpen) return wrap;
    var list = $('<div class="tl-ed-alertlist"></div>');
    var changed = function (rebuild) { modified(); if (rebuild) renderGridConf(); };
    alerts.forEach(function (a, i) {
      var row = $('<div class="tl-ed-alert"></div>');
      row.append(cmdField(a, { k: 'cmdA', filter: C_INFO }, function (v) { setPath(a, 'cmdA', v); changed(true); }));
      var op = $('<select class="form-control input-sm" style="width:auto"></select>');
      ALERT_OPS.forEach(function (o) { op.append($('<option></option>').val(o[0]).text(o[1])); });
      op.val(a.op || '>').on('change', function () { a.op = op.val(); changed(true); });
      row.append(op);
      var inp = function (k, ph, w, type) {
        return $('<input class="form-control input-sm">').attr({ placeholder: ph, type: type || 'text' }).css('width', w).val(isSet(a[k]) ? a[k] : '')
          .on('change', function () { var v = $(this).val(); if (v === '') delete a[k]; else a[k] = v; changed(false); });
      };
      if (a.op === 'text') {
        row.append('<span class="tl-ed-hint">une alerte par ligne (retour ligne, &lt;br&gt; ou |), rien si vide ou</span>').append(inp('okVals', 'ok;0;aucun;rien', 130));
      } else {
        row.append(inp('v', 'valeur', 70));
        if (a.op === 'out' || a.op === 'in') row.append('<span>et</span>').append(inp('v2', 'valeur', 70));
        row.append($('<label class="tl-ed-inline" title="La condition doit durer au moins ce temps avant d\'afficher l\'alerte"></label>').text('depuis ').append(inp('delay', '0', 55, 'number')).append(' min'));
        row.append(inp('text', 'Texte (#value#, #name#, #since#)', 230));
      }
      row.append(colorField(a.color, a.op === 'text' ? 'auto' : '#e5484d', function (c) { if (isSet(c)) a.color = c; else delete a.color; changed(false); }));
      var blink = $('<input type="checkbox">').prop('checked', !!a.blink).on('change', function () { a.blink = blink.is(':checked'); changed(false); });
      row.append($('<label class="tl-ed-inline"></label>').append(blink).append(' pulse'));
      row.append($('<a class="btn btn-xs btn-danger" title="Supprimer"><i class="fas fa-times"></i></a>').on('click', function () { alerts.splice(i, 1); changed(true); }));
      list.append(row);
    });
    list.append($('<a class="btn btn-xs btn-success"><i class="fas fa-plus"></i> Ajouter une alerte</a>').on('click', function () {
      pickCmd(C_INFO, function (cid) { alerts.push({ cmdA: cid, op: '>', v: '' }); changed(true); });
    }));
    list.append('<div class="tl-ed-hint">Exemples : pH <b>hors de</b> 7 et 7,6 · Porte <b>=</b> 1 depuis 10 min · Température piscine <b>&lt;</b> 10. Pour une info binaire, comparez à 1 (ou 0).</div>');
    wrap.append(list);
    return wrap;
  }

  function syncGridConf() {
    var g = E.layout.grid, fixed = parseFloat(g.width) > 0, isMob = g.device === 'mobile';
    $('#div_tlGridConf .tl-ed-onlydesk').toggle(!isMob);
    if (E.fitLabel) E.fitLabel.toggle(fixed);
    if (E.sizeLabel) E.sizeLabel.toggle(!fixed && !isMob);
  }

  function showCell() {
    var p = E.page;
    if (!p || !p.cellW) return;
    var txt = 'Case : ' + Math.round(p.cellW) + ' × ' + Math.round(p.cellH) + ' px';
    if (p.k && p.k < 0.999 && p.fixed) txt += ' · aperçu réduit à ' + Math.round(p.k * 100) + ' %';
    $('#span_tlCell').text(txt);
  }

  /* ---------- panneau de propriétés ---------- */
  function renderProps() {
    var box = $('#div_tlProps');
    var scroll = box.scrollTop();
    box.empty();
    var t = selTile();
    if (!t) {
      box.append('<div class="tl-ed-none"><i class="fas fa-hand-pointer"></i><br>Sélectionnez une tuile dans l\'aperçu,<br>ou cliquez sur « Ajouter une tuile ».</div>');
      return;
    }
    var section = function (title, fields) {
      var shown = fields.filter(function (f) { return !f.show || f.show(t); });
      if (!shown.length) return;
      box.append('<div class="tl-ed-sec">' + esc(title) + '</div>');
      shown.forEach(function (f) { box.append(field(t, f, onTileChange)); });
    };
    if (t.type === 'rangee') {
      section('Nouvelle rangée', ROW_SCHEMA);
      box.append('<div class="tl-ed-muted">Les tuiles placées après cette ligne commencent une nouvelle rangée, avec cet espace au-dessus.</div>');
      box.scrollTop(scroll);
      return;
    }
    if (t.type === 'bouton' && (!t.behavior || !BTN_KINDS[t.behavior])) t.behavior = btnKind(t);
    section('Tuile', COMMON);
    section(TYPES[t.type] || t.type, SCHEMA[t.type] || []);
    section('Apparence', LOOK);
    section('Cadre', FRAME);
    section('Effets', EFFECTS);
    section('Avancé', ADVANCED);
    box.scrollTop(scroll);
  }

  function onTileChange(f) {
    modified();
    renderPreview();
    if (f && (f.f === 'sel' || f.f === 'check' || f.f === 'cmd' || f.f === 'cmdlist' || f.rebuild)) renderProps();
  }

  /** Construit un champ de formulaire lié à obj[f.k]. */
  function field(obj, f, onChange) {
    var row = $('<div class="tl-ed-row"></div>');
    var label = $('<label class="tl-ed-label"></label>').text(f.l);
    if (f.help) label.append(' <i class="fas fa-question-circle tl-ed-q" title="' + esc(f.help) + '"></i>');
    var val = getPath(obj, f.k);
    var ctrl;
    var set = function (v) { setPath(obj, f.k, v); onChange(f); if (f.after) f.after(obj); if (f.f === 'cmd' && v) autoFill(obj, f); };
    switch (f.f) {
      case 'check':
        ctrl = $('<input type="checkbox">').prop('checked', (val === undefined || val === null) && f.defOn ? !!f.defOn(obj) : !!val).on('change', function () {
          if (f.keepFalse) { obj[f.k] = $(this).is(':checked'); onChange(f); return; }
          set($(this).is(':checked'));
        });
        row.addClass('tl-ed-row-check').append($('<label class="tl-ed-check"></label>').append(ctrl).append(' ' + esc(f.l)));
        return row;
      case 'sel':
        ctrl = $('<select class="form-control input-sm"></select>');
        if (f.half) SIZE_LIST.forEach(function (x) { ctrl.append($('<option></option>').val(x[0].toFixed(4)).text(x[1])); });
        else Object.keys(f.o).forEach(function (k) { ctrl.append($('<option></option>').val(k).text(f.o[k])); });
        if (f.half) {
          var cv = U.isNum(val) ? parseFloat(val) : 1, best = '1.0000', bd = 1e9;
          SIZE_LIST.forEach(function (x) { var d = Math.abs(x[0] - cv); if (d < bd) { bd = d; best = x[0].toFixed(4); } });
          ctrl.val(best);
        }
        else ctrl.val(isSet(val) ? String(val) : Object.keys(f.o)[0]);
        ctrl.on('change', function () {
          var v = ctrl.val();
          if (f.half) v = Math.round(parseFloat(v) * 10000) / 10000;
          if (f.k === 'type') { set(v); return; }
          set(v === Object.keys(f.o)[0] && !f.half && !f.keep && f.k !== 'target' && f.k !== 'kind' && f.k !== 'display' ? '' : v);
        });
        break;
      case 'func':
        ctrl = $('<select class="form-control input-sm"></select>');
        FUNCS.forEach(function (g) {
          var og = $('<optgroup></optgroup>').attr('label', g[0]);
          Object.keys(g[1]).forEach(function (k) { og.append($('<option></option>').val(k).text(g[1][k])); });
          ctrl.append(og);
        });
        ctrl.val(val || 'valeur');
        ctrl.on('change', function () {
          var v = ctrl.val(), d = defaultsFor(v);
          Object.keys(d).forEach(function (k) {
            if (['id', 'title', 'w', 'h', 'hideTitle', 'type'].indexOf(k) < 0 && obj[k] === undefined) obj[k] = d[k];
          });
          obj.type = v;
          onChange({ f: 'sel', rebuild: true });
        });
        break;
      case 'eq':
        ctrl = eqField(obj, f, set);
        break;
      case 'rvlist':
        ctrl = rvListField(obj, function (ff) { onTileChange(ff); });
        break;
      case 'pos':
        ctrl = $('<div class="tl-ed-pos"></div>');
        var pin = $('<input type="number" step="0.25" min="1" class="form-control input-sm">').val(U.isNum(val) ? Math.round(parseFloat(val) * 1000) / 1000 : '').attr('placeholder', 'auto');
        pin.on('change', function () { var v = pin.val(); E.lastMoved = obj.id; set(U.isNum(v) && parseFloat(v) >= 1 ? parseFloat(v) : ''); });
        var auto = $('<a class="btn btn-xs btn-default" title="Revenir au placement automatique">auto</a>').on('click', function () { setPath(obj, 'x', ''); setPath(obj, 'y', ''); onChange({ f: 'sel' }); });
        ctrl.append(pin);
        if (f.k === 'y' && (U.isNum(obj.x) || U.isNum(obj.y))) ctrl.append(auto);
        break;
      case 'num':
        ctrl = $('<input type="number" step="any" class="form-control input-sm">').val(isSet(val) ? val : '').attr('placeholder', f.phFn ? f.phFn(obj) : (f.ph || ''));
        ctrl.on('change', function () { var v = ctrl.val(); set(isSet(v) ? v : ''); });
        break;
      case 'area':
        ctrl = $('<textarea class="form-control input-sm" rows="2"></textarea>').val(isSet(val) ? val : '').attr('placeholder', f.ph || '');
        ctrl.on('input', function () { set(ctrl.val()); });
        break;
      case 'color':
        ctrl = colorField(val, f.ph, set);
        break;
      case 'icon':
        ctrl = iconField(val, f.ph, function (v) {
          var was = /svg:a-/.test(getPath(obj, f.k) || '');
          set(v);
          if (was !== /svg:a-/.test(v || '')) setTimeout(renderProps, 0); // icône animée : réglages de vitesse
        });
        break;
      case 'cmd':
        ctrl = cmdField(obj, f, set);
        break;
      case 'cmdlist':
        ctrl = cmdListField(obj, f, set);
        break;
      case 'thresholds':
        ctrl = thresholdsField(obj, onChange, f.k, f.base);
        break;
      case 'lines':
        ctrl = f.schema === 'vm' ? linesField(obj, onChange, { key: f.k, schema: VM_LINE_SCHEMA, add: { label: '', dir: '>' }, word: 'Valeur', title: function (l) { return l.label || ''; } }) : f.schema === 'ouv' ? linesField(obj, onChange, { key: f.k, schema: OUV_LINE_SCHEMA, add: { kind: 'fenetre', label: '', openValue: '1' }, word: 'Ouvrant', title: function (l) { return l.kind === 'title' ? 'Groupe : ' + (l.label || '') : (l.label || ''); } }) : linesField(obj, onChange);
        break;
      case 'options':
        ctrl = optionsField(obj, onChange);
        break;
      case 'page':
        ctrl = $('<select class="form-control input-sm"></select>').append('<option value="">—</option>');
        // pages classées par appareil : celles du même appareil que la page en cours d'abord
        var curDev = ((E.layout && E.layout.grid) || {}).device === 'mobile' ? 'mobile' : 'tablette';
        var devOf = function (pg) { return pg.device === 'mobile' ? 'mobile' : 'tablette'; };
        [curDev, curDev === 'mobile' ? 'tablette' : 'mobile'].forEach(function (d) {
          var list = E.pages.filter(function (pg) { return devOf(pg) === d; })
            .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr', { sensitivity: 'base' }); });
          if (!list.length) return;
          var grp = $('<optgroup></optgroup>').attr('label', (d === 'mobile' ? '📱 Mobile' : '🖥 Tablette') + (d === curDev ? ' (cette page)' : ''));
          list.forEach(function (pg) { grp.append($('<option></option>').val(pg.id).text((d === 'mobile' ? '📱 ' : '🖥 ') + pg.name)); });
          ctrl.append(grp);
        });
        ctrl.val(isSet(val) ? String(val) : '').on('change', function () { set(ctrl.val()); });
        break;
      default:
        ctrl = $('<input type="text" class="form-control input-sm">').val(isSet(val) ? val : '').attr('placeholder', f.ph || '');
        ctrl.on('input', function () { set(ctrl.val()); });
        if (f.blurRebuild) ctrl.on('change', function () { setTimeout(renderProps, 0); });
    }
    if (['thresholds', 'rules', 'lines', 'options', 'icon'].indexOf(f.f) >= 0) row.addClass('tl-ed-row-full');
    row.append(label).append($('<div class="tl-ed-ctrl"></div>').append(ctrl));
    return row;
  }

  var THEME_HEX = { title: '#ffffff', text: '#9a9a9a', ok: '#2ecc40', warn: '#ff9800', alert: '#ff1a1a', info: '#2f6bff', neutral: '#c8c8c8', on: '#1fbf3a', off: '#e00000' };
  /** Couleur en #rrggbb (les anciens noms ok, warn… sont convertis). */
  function toHex(v) {
    if (!isSet(v)) return '';
    v = String(v).trim();
    if (THEME_HEX[v]) return (E.theme && /^#[0-9a-f]{6}$/i.test(E.theme[v] || '')) ? E.theme[v] : THEME_HEX[v];
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(v)) return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toLowerCase();
    return v;
  }

  /** Sélecteur de couleur libre : pastille + code, croix = automatique. */
  function colorField(val, ph, set, noClear) {
    var wrap = $('<div class="tl-ed-color"></div>');
    var pick = $('<input type="color" class="tl-ed-picker" title="Choisir la couleur">');
    var code = $('<input type="text" class="form-control input-sm tl-ed-code" maxlength="7" spellcheck="false">');
    var clear = $('<a class="btn btn-xs btn-default tl-ed-cclear" title="Couleur automatique"><i class="fas fa-times"></i></a>');
    var cur = toHex(val);
    // couleur par défaut réellement utilisée quand le champ est vide (ex. ouvert = rouge)
    var defHex = isSet(ph) && ph !== 'auto' ? toHex(ph) : '';
    if (!/^#[0-9a-f]{6}$/i.test(defHex)) defHex = '';
    var DEF_NAME = { alert: 'rouge', off: 'rouge', ok: 'vert', on: 'vert', warn: 'orange', info: 'bleu', neutral: 'gris', title: 'blanc', text: 'gris' };
    var defTxt = defHex ? 'auto : ' + (DEF_NAME[ph] || defHex) : 'auto';
    var draw = function () {
      var hex = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '';
      pick.val(hex || defHex || '#000000');
      code.val(cur).attr('placeholder', defTxt);
      wrap.toggleClass('tl-ed-color-auto', !cur);
      clear.toggle(!!cur && !noClear);
    };
    pick.on('input change', function () { cur = pick.val(); draw(); set(cur); });
    code.on('change', function () {
      var v = toHex(code.val());
      if (v && !/^#[0-9a-f]{6}$/i.test(v)) { code.val(cur); return; }
      cur = v; draw(); set(cur);
    });
    clear.on('click', function () { cur = ''; draw(); set(''); });
    wrap.append(pick).append(code).append(clear);
    draw();
    return wrap;
  }

  /** Ouvre le sélecteur d'icônes du core Jeedom (4.4+ : jeedomUtils.chooseIcon, avant : chooseIcon). */
  function coreIconPicker() {
    if (window.jeedomUtils && typeof window.jeedomUtils.chooseIcon === 'function') return window.jeedomUtils.chooseIcon;
    if (typeof window.chooseIcon === 'function') return window.chooseIcon;
    return null;
  }
  function pickCoreIcon(current, cb) {
    var fn = coreIconPicker();
    if (!fn) { toast('Sélecteur d\'icônes Jeedom indisponible sur cette page', 'error'); return; }
    var params = { img: true };
    if (isSet(current) && current.indexOf('svg:') !== 0 && current.indexOf('img:') !== 0) params.icon = current;
    fn(function (html) {
      var spec = T.coreIconClass(html);
      if (spec) cb(spec);
    }, params);
  }
  function pickPluginIcon(cb) {
    var body = $('<div class="tl-ed-ipk"></div>');
    var m;
    ICON_GROUPS.concat(T.animIcons ? [['Animées (bougent quand la tuile est active)', T.animIcons]] : []).forEach(function (g) {
      body.append($('<div class="tl-ed-ipk-h"></div>').text(g[0]));
      var grid = $('<div class="tl-ed-ipk-grid"></div>');
      g[1].forEach(function (ic) {
        var it = $('<div class="tl-ed-ipk-it"></div>').attr('title', ic[0]);
        it.append($('<div class="tl-ed-ipk-ic"></div>').html(T.iconHtml(ic[0])));
        it.append($('<div class="tl-ed-ipk-lb"></div>').text(ic[1]));
        it.on('click', function () { cb(ic[0]); m.close(); });
        grid.append(it);
      });
      body.append(grid);
    });
    var buttons = [{ label: 'Fermer' }];
    if (coreIconPicker()) buttons.unshift({ label: 'Bibliothèque Jeedom…', click: function () { setTimeout(function () { pickCoreIcon('', cb); }, 0); } });
    m = T.ui.modal({ title: 'Icônes du plugin', body: body[0], wide: true, buttons: buttons });
  }

  function iconField(val, ph, set) {
    var wrap = $('<div class="tl-ed-icon"></div>');
    var prev = $('<span class="tl-ed-ipv" title="Aperçu"></span>');
    var inp = $('<input type="text" class="form-control input-sm">').val(isSet(val) ? val : '').attr('placeholder', ph || 'aucune');
    var refresh = function () {
      var v = inp.val() || ph || '';
      prev.html(T.iconHtml(v)).toggleClass('tl-ed-ipv-ph', !inp.val());
    };
    var apply = function (spec) { inp.val(spec); refresh(); set(spec); };
    inp.on('input', function () { refresh(); set(inp.val()); });
    var jee = $('<a class="btn btn-sm btn-primary tl-ed-ib" title="Bibliothèque d\'icônes Jeedom"><i class="fas fa-icons"></i> Jeedom</a>');
    var mine = $('<a class="btn btn-sm btn-default tl-ed-ib" title="Icônes du plugin Tuiles"><i class="fas fa-th-large"></i> Tuiles</a>');
    var clear = $('<a class="btn btn-sm btn-default tl-ed-ib" title="Retirer l\'icône"><i class="fas fa-times"></i></a>');
    jee.on('click', function () {
      // dans une fenêtre Tuiles, on la passe derrière le sélecteur d'icônes de Jeedom le temps du choix
      var ov = wrap.closest('.tl-modal-ov');
      if (ov.length) ov.css('z-index', 1000);
      pickCoreIcon(inp.val(), function (spec) { if (ov.length) ov.css('z-index', ''); apply(spec); });
      if (ov.length) setTimeout(function () { $(document).one('click', '.ui-dialog-titlebar-close, .bootbox .close, [data-dismiss=modal]', function () { ov.css('z-index', ''); }); }, 0);
    });
    mine.on('click', function () { pickPluginIcon(apply); });
    prev.on('click', function () { pickCoreIcon(inp.val(), apply); });
    clear.on('click', function () { apply(''); });
    if (!coreIconPicker()) jee.addClass('disabled').attr('title', 'Bibliothèque Jeedom indisponible ici');
    wrap.append($('<div class="tl-ed-icon-l1"></div>').append(prev).append(inp).append(clear));
    wrap.append($('<div class="tl-ed-icon-l2"></div>').append(jee).append(mine));
    refresh();
    return wrap;
  }

  /** Couleurs par seuils : jusqu'à 10 seuils, chacun sa couleur. */
  function thresholdsField(obj, onChange, kList, kBase) {
    kList = kList || 'thresholds'; kBase = kBase || 'thBase';
    var MAX = 10;
    var wrap = $('<div class="tl-ed-th"></div>');
    var th = obj[kList] = Array.isArray(obj[kList]) ? obj[kList] : [];
    var changed = function (rebuild) { onChange(rebuild ? { f: 'sel' } : { f: 'text' }); drawBar(); };
    var bar = $('<div class="tl-ed-th-bar" title="Aperçu des plages"></div>');
    var drawBar = function () {
      bar.empty();
      var list = th.filter(function (x) { return isSet(x.v); }).slice().sort(function (a, b) { return (U.isNum(a.v) ? parseFloat(a.v) : 1e18) - (U.isNum(b.v) ? parseFloat(b.v) : 1e18); });
      var seg = function (c, txt) { bar.append($('<span></span>').css('background', c ? toHex(c) : 'transparent').attr('data-l', txt)); };
      seg(obj[kBase] || '', 'autre');
      list.forEach(function (x) { seg(x.color, (U.isNum(x.v) ? '≥ ' : '= ') + x.v); });
    };
    var base = $('<div class="tl-ed-th-row tl-ed-th-base"></div>');
    base.append('<span class="tl-ed-th-lab">' + (th.length ? 'Autres valeurs' : 'Couleur') + '</span>');
    base.append(colorField(obj[kBase], 'couleur normale', function (c) { if (isSet(c)) obj[kBase] = c; else delete obj[kBase]; changed(false); }));
    wrap.append(base);
    th.forEach(function (x, i) {
      var row = $('<div class="tl-ed-th-row"></div>');
      var lab = $('<span class="tl-ed-th-lab"></span>');
      var setLab = function () { lab.text((U.isNum(x.v) || !isSet(x.v) ? 'à partir de' : 'si égal à')); };
      setLab();
      row.append(lab);
      var v = $('<input type="text" class="form-control input-sm tl-ed-th-v" placeholder="nombre ou texte">').val(isSet(x.v) ? x.v : '');
      v.on('input', setLab);
      v.on('input', function () { x.v = v.val(); changed(false); });
      v.on('change', function () {
        th.sort(function (a, b) { return (U.isNum(a.v) ? parseFloat(a.v) : 1e18) - (U.isNum(b.v) ? parseFloat(b.v) : 1e18); });
        th.forEach(function (y) { if (isSet(y.v)) y.v = String(y.v).trim(); });
        changed(true);
      });
      var del = $('<a class="btn btn-xs btn-danger" title="Supprimer ce seuil"><i class="fas fa-times"></i></a>').on('click', function () { th.splice(i, 1); changed(true); });
      row.append(v).append(colorField(x.color, 'couleur', function (c) { x.color = c; changed(false); }, true)).append(del);
      wrap.append(row);
    });
    var add = $('<a class="btn btn-xs btn-default"><i class="fas fa-plus"></i> Seuil</a>');
    if (th.length >= MAX) add.addClass('disabled');
    add.on('click', function () {
      if (th.length >= MAX) return;
      var last = th.length ? parseFloat(th[th.length - 1].v) : NaN;
      var palette = ['#2ecc40', '#ff9800', '#ff1a1a', '#2f6bff', '#4fc3f7', '#9c27b0', '#ffeb3b', '#795548', '#00bcd4', '#e91e63'];
      th.push({ v: isNaN(last) ? '' : String(last + 1), color: palette[th.length % palette.length] });
      changed(true);
    });
    var foot = $('<div class="tl-ed-listbar"></div>').append(add).append(' <span class="tl-ed-muted">' + th.length + ' / ' + MAX + '</span>');
    if (th.length) foot.append(' ').append($('<a class="btn btn-xs btn-default">Tout effacer</a>').on('click', function () { obj[kList] = []; delete obj[kBase]; changed(true); }));
    wrap.append(foot).append(bar);
    drawBar();
    return wrap;
  }

  /** Sélecteur d'équipement (liste des équipements Jeedom avec recherche). */
  function loadEqList() {
    if (!E.eqListP) E.eqListP = T.ajax('eqList', {}).then(function (l) { E.eqList = l || []; return E.eqList; });
    return E.eqListP;
  }
  function eqName(id) {
    var e = (E.eqList || []).filter(function (x) { return String(x.id) === String(id); })[0];
    return e ? (e.object ? '[' + e.object + '] ' : '') + e.name + ' (' + e.plugin + ')' : (id ? '#' + id : '');
  }
  function eqField(obj, f, set) {
    var id = cleanId(getPath(obj, f.k));
    var wrap = $('<div class="input-group input-group-sm"></div>');
    var inp = $('<input type="text" class="form-control" readonly>').attr('placeholder', 'Aucun');
    var btns = $('<span class="input-group-btn"></span>');
    var pick = $('<a class="btn btn-default" title="Choisir"><i class="fas fa-list-alt"></i></a>');
    var clear = $('<a class="btn btn-default" title="Retirer"><i class="fas fa-times"></i></a>');
    loadEqList().then(function () { inp.val(id ? eqName(id) : ''); });
    var open = function () {
      loadEqList().then(function (list) {
        var body = $('<div class="tl-ed-eqpick"></div>');
        var q = $('<input class="form-control" placeholder="Rechercher un équipement, un objet ou un plugin…">');
        var ul = $('<div class="tl-ed-eqlist"></div>');
        var m;
        var draw = function () {
          var s = q.val().toLowerCase().trim();
          ul.empty();
          list.filter(function (e) { return (!f.plugin || e.plugin === f.plugin) && (!f.pluginRe || f.pluginRe.test(e.plugin)) && (!s || (e.name + ' ' + e.object + ' ' + e.plugin).toLowerCase().indexOf(s) >= 0); }).slice(0, 300).forEach(function (e) {
            var it = $('<div class="tl-ed-eqit"></div>').toggleClass('tl-ed-eqoff', !e.enable);
            it.append($('<b></b>').text(e.name)).append($('<span></span>').text((e.object ? e.object + ' · ' : '') + e.plugin));
            it.on('click', function () { set(String(e.id)); m.close(); if (f.onPick) f.onPick(obj, e); });
            ul.append(it);
          });
        };
        q.on('input', draw);
        body.append(q).append(ul);
        draw();
        m = T.ui.modal({ title: 'Choisir un équipement', body: body[0], wide: true, buttons: [{ label: 'Fermer' }] });
        setTimeout(function () { q.trigger('focus'); }, 50);
      }, fail);
    };
    pick.on('click', open);
    inp.on('click', open);
    clear.on('click', function () { set(''); });
    btns.append(pick).append(clear);
    return wrap.append(inp).append(btns);
  }

  /* ---------- plugin Réveils : commandes retrouvées automatiquement ---------- */
  function normName(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
  var RV_MAP = [
    ['cmdNext', 'info', /prochain reveil|^prochain|next/],
    ['cmdStatus', 'info', /statut synchro|statut/],
    ['cmdSyncOk', 'info', /^synchro ok$/],
    ['cmdAlexaOk', 'info', /^alexa ok$/],
    ['cmdRemiOk', 'info', /^remi ok$/],
    ['cmdLastCheck', 'info', /derniere verification/],
    ['cmdResync', 'action', /resynchronis/],
    ['cmdVerify', 'action', /^verifier/],
    ['cmdSkip', 'action', /pas de (prochain )?reveil/],
    ['cmdException', 'action', /^exception/],
    ['cmdStatusAlexa', 'info', /statut alexa/],
    ['cmdStatusRemi', 'info', /statut remi/],
    ['cmdNextAlexa', 'info', /prochain.*alexa|alexa.*prochain/],
    ['cmdNextRemi', 'info', /prochain.*remi|remi.*prochain/]
  ];
  /** Tuile limitée à un appareil (Alexa ou Rémi) : son statut, sa pastille, son prochain réveil s'il existe. */
  function applyRvDevice(obj) {
    var dv = obj.rvDevice;
    obj.cmdNext = (dv === 'alexa' && obj.cmdNextAlexa) || (dv === 'remi' && obj.cmdNextRemi) || obj.cmdNextAll || obj.cmdNext;
    obj.cmdStatus = (dv === 'alexa' && obj.cmdStatusAlexa) || (dv === 'remi' && obj.cmdStatusRemi) || obj.cmdStatusAll || obj.cmdStatus;
    obj.cmdSyncOk = (dv === 'alexa' && obj.cmdAlexaOk) || (dv === 'remi' && obj.cmdRemiOk) || obj.cmdSyncAll || obj.cmdSyncOk;
  }
  /** Remplit une tuile (ou une ligne de liste) avec les commandes d'un équipement Réveils. */
  function fillReveil(obj, eqId) {
    return T.ajax('eqCmds', { id: eqId }).then(function (r) {
      var cmds = (r && r.cmds) || [], ids = [];
      RV_MAP.forEach(function (m) {
        var c = cmds.filter(function (c2) { return c2.type === m[1] && (m[2].test(normName(c2.name)) || m[2].test(normName(c2.logicalId))); })[0];
        if (c) { obj[m[0]] = String(c.id); ids.push(String(c.id)); } else delete obj[m[0]];
      });
      obj.cmdNextAll = obj.cmdNext; obj.cmdStatusAll = obj.cmdStatus; obj.cmdSyncAll = obj.cmdSyncOk;
      applyRvDevice(obj);
      if (!obj.cmdNext) toast('Commande « Prochain réveil » introuvable : choisissez-la à la main', 'error');
      return ensureMetas(ids);
    });
  }
  function rvListField(obj, onChange) {
    var wrap = $('<div class="tl-ed-lines"></div>');
    var items = obj.rvItems = Array.isArray(obj.rvItems) ? obj.rvItems : [];
    items.forEach(function (it, i) {
      var row = $('<div class="tl-ed-optrow"></div>');
      var lab = $('<input class="form-control input-sm" placeholder="Nom affiché">').val(it.name || '').on('input', function () { it.name = $(this).val(); onChange({ f: 'text' }); });
      var info = $('<span class="tl-ed-hint" style="white-space:nowrap"></span>').text(it.cmdNext ? '✓' : 'à compléter').attr('title', it.cmdNext ? 'Commandes trouvées' : 'Commandes à compléter');
      var kid = $('<label class="tl-ed-inline" title="Affiche le prochain réveil d\'un jour de garde (planning du plugin Réveils), au lieu du prochain réveil tout court."></label>').append($('<input type="checkbox">').prop('checked', !!it.child).on('change', function () { it.child = $(this).is(':checked'); onChange({ f: 'text' }); })).append(' enfant (jours de garde)');
      var up = $('<a class="btn btn-xs btn-default"><i class="fas fa-arrow-up"></i></a>').on('click', function () { if (i > 0) { items.splice(i - 1, 0, items.splice(i, 1)[0]); onChange({ f: 'sel' }); } });
      var del = $('<a class="btn btn-xs btn-danger"><i class="fas fa-times"></i></a>').on('click', function () { items.splice(i, 1); onChange({ f: 'sel' }); });
      row.append(lab).append(info).append(up).append(del);
      wrap.append(row);
      row = $('<div class="tl-ed-optrow" style="margin:-2px 0 8px 4px"></div>').append(kid);
      wrap.append(row);
    });
    var holder = {};
    var add = eqField(holder, { k: 'eqId', plugin: 'reveil', onPick: function (h, e) {
      var it = { eqId: String(e.id), name: e.name };
      fillReveil(it, e.id).then(function () { items.push(it); onChange({ f: 'sel' }); }).catch(fail);
    } }, function () {});
    wrap.append($('<div class="tl-ed-hint">Ajouter un équipement Réveils :</div>')).append(add);
    return wrap;
  }

  /* ---------- alarme Risco : partitions et zones retrouvées par leurs noms (P1 …, Z1 …) ---------- */
  function fillRisco(obj, eqId) {
    return T.ajax('eqCmds', { id: eqId }).then(function (r) {
      var cmds = (r && r.cmds) || [], ids = [], by = {};
      cmds.forEach(function (c) { by[c.type + ':' + normName(c.name)] = String(c.id); });
      var get = function (type, name) { var id = by[type + ':' + name]; if (id) ids.push(id); return id || ''; };
      var part = Math.max(1, Math.round(parseFloat(obj.rsPart) || 1)), P = 'p' + part + ' ';
      obj.cmdState = get('info', P + 'etat');
      obj.cmdArmed = get('info', P + 'arme');
      obj.cmdPartial = get('info', P + 'arme partiel');
      obj.cmdTriggered = get('info', P + 'declenche');
      obj.cmdAlarm = get('info', P + 'en alarme');
      obj.cmdReady = get('info', P + 'pret');
      obj.cmdPartName = get('info', P + 'nom');
      obj.cmdArmTotal = get('action', P + 'armer total');
      obj.cmdArmPartial = get('action', P + 'armer partiel');
      obj.cmdDisarm = get('action', P + 'desarmer');
      obj.cmdConn = get('info', 'connexion');
      obj.cmdLastName = get('info', 'dernier evenement nom');
      obj.cmdLastTime = get('info', 'dernier evenement heure');
      obj.cmdLastZone = get('info', 'dernier evenement zone');
      obj.cmdTroubles = cmds.filter(function (c) { return c.type === 'info' && /^(trouble |tamper)/.test(normName(c.name)); }).map(function (c) { ids.push(String(c.id)); return String(c.id); });
      // zones : Z1 … Zn
      var zones = {};
      cmds.forEach(function (c) { var m = /^z(\d+) /.exec(normName(c.name)); if (m) zones[m[1]] = true; });
      obj.rsZones = Object.keys(zones).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
        var Z = 'z' + n + ' ';
        return { n: n, cmdZName: get('info', Z + 'nom'), cmdZOpen: get('info', Z + 'ouvert'), cmdZAlarm: get('info', Z + 'alarme'), cmdZBypass: get('info', Z + 'bypasse'),
          cmdZArmed: get('info', Z + 'arme'), cmdZParts: get('info', Z + 'partitions'), cmdZType: get('info', Z + 'type'), cmdZByp: get('action', Z + 'bypasser'), cmdZUnbyp: get('action', Z + 'debypasser') };
      });
      if (obj.type === 'alarme' && !obj.cmdArmed && !obj.cmdState) toast('Partition ' + part + ' introuvable dans cet équipement', 'error');
      if (obj.type === 'zones' && !obj.rsZones.length) toast('Aucune zone (Z1 …) dans cet équipement', 'error');
      return ensureMetas(ids);
    });
  }

  /* ---------- VigiEau : commandes retrouvées par leur nom ---------- */
  var VG_MAP = [
    ['cmdLevel', [/^niveau$/, /niveau.*(restriction|alerte|gravite)/, /(restriction|alerte|gravite).*niveau/, /^gravite/, /^niveau/]],
    ['cmdLevelTxt', [/^restriction$/, /libelle/, /^(niveau|restriction).*(texte|nom|libelle)/, /^alerte$/]],
    ['cmdCommune', [/commune/, /ville/]],
    ['cmdZone', [/zone/]],
    ['cmdArrete', [/arrete.*restriction/, /numero.*arrete/, /^arrete$/]],
    ['cmdCadre', [/cadre/]],
    ['cmdStart', [/debut/]],
    ['cmdEnd', [/(^|\s)fin/]],
    ['cmdMesures', [/mesure/]],
    ['cmdUsage', [/usage|type d.eau|ressource|eau du robinet|^eau/]],
    ['cmdImport', [/import|mise a jour|maj|derniere/]]
  ];
  var HIK_MAP = [['cmdEtat', 'etat_appel'], ['cmdRing', 'sonnerie'], ['cmdTalk', 'en_communication'], ['cmdOnline', 'en_ligne'], ['cmdEvent', 'dernier_evenement'],
    ['cmdTalkUrl', 'lien_parler'], ['cmdAnswer', 'decrocher'], ['cmdHangup', 'raccrocher'], ['cmdReject', 'refuser'], ['cmdOpen', 'ouvrir_porte']];
  /* ---------- remplissage automatique des commandes d'un même équipement ----------
   * Dès qu'une commande est choisie sur un volet, un bouton ou un éclairage, les autres
   * commandes vides sont cherchées dans le même équipement (type générique Jeedom, sinon nom). */
  var NEVER = /(?!)/, RX_ON = /(^|[^a-z])(on|activ\w*|enable\w*|start\w*|demarr\w*)([^a-z]|$)/, RX_OFF = /desactiv|disable|(^|[^a-z])(off|stop\w*|arret\w*)([^a-z]|$)/;
  var RX_CAMX = /record|enregistr|detect|zoom|preset|snapshot|audio/;
  var AUTO = {
    volet: [
      ['cmdInfo', 'info', /^FLAP_STATE/, /position|etat|state|niveau|level/],
      ['cmdStop', 'action', /^FLAP_STOP/, /stop/],
      ['cmdSlider', 'slider', /^FLAP_SLIDER/, /position|slider|niveau|level|consigne/],
      ['cmdUp', 'action', /^FLAP_UP/, /(^|[^a-z])(up|monte\w*|haut|ouvr\w*|open\w*)([^a-z]|$)/],
      ['cmdDown', 'action', /^FLAP_DOWN/, /(^|[^a-z])(down|descen\w*|bas|ferm\w*|clos\w*)([^a-z]|$)/]],
    bouton: [
      ['cmdInfo', 'info', /_STATE$/, /etat|state|statut|status/],
      ['cmdOn', 'action', /_ON$/, /(^|[^a-z])(on|allum\w*|marche|ouvr\w*|start)([^a-z]|$)/],
      ['cmdOff', 'action', /_OFF$/, /(^|[^a-z])(off|etein\w*|arret\w*|ferm\w*|stop)([^a-z]|$)/]],
    lumiere: [
      ['cmdState', 'info', /^LIGHT_STATE|_STATE$/, /etat|state|statut|status/],
      ['cmdOn', 'action', /_ON$/, /(^|[^a-z])(on|allum\w*)([^a-z]|$)/],
      ['cmdOff', 'action', /_OFF$/, /(^|[^a-z])(off|etein\w*)([^a-z]|$)/]],
    variateur: [
      ['cmdState', 'info', /^LIGHT_STATE$|^ENERGY_STATE$/, /etat|state|statut|status/],
      ['cmdOn', 'action', /_ON$/, /(^|[^a-z])(on|allum\w*)([^a-z]|$)/],
      ['cmdOff', 'action', /_OFF$/, /(^|[^a-z])(off|etein\w*)([^a-z]|$)/],
      ['cmdSlider', 'slider', /SLIDER$/, /luminosit|intensit|brightness|niveau|level|dim/]],
    // caméra (plugin Frigate…) : [clé, type, générique, nom (toutes doivent correspondre), nom à exclure]
    camera: [
      ['cmdRec', 'info', NEVER, [/record|enregistr/], /(^|[^a-z])(on|off)([^a-z]|$)/],
      ['cmdDet', 'info', NEVER, [/detect/], /(^|[^a-z])(on|off)([^a-z]|$)/],
      ['cmdRecOn', 'action', NEVER, [/record|enregistr/, RX_ON], RX_OFF],
      ['cmdRecOff', 'action', NEVER, [/record|enregistr/, RX_OFF]],
      ['cmdDetOn', 'action', NEVER, [/detect/, RX_ON], RX_OFF],
      ['cmdDetOff', 'action', NEVER, [/detect/, RX_OFF]],
      ['cmdPtzIn', 'action', NEVER, [/zoom/, /(^|[^a-z])(in|avant|plus)([^a-z]|$)|\+/], /out|arriere|moins|-/],
      ['cmdPtzOut', 'action', NEVER, [/zoom/, /(^|[^a-z])(out|arriere|moins)([^a-z]|$)|-/]],
      ['cmdPtzUp', 'action', NEVER, [/(^|[^a-z])(up|haut|monte\w*)([^a-z]|$)/], RX_CAMX],
      ['cmdPtzDown', 'action', NEVER, [/(^|[^a-z])(down|bas|descen\w*)([^a-z]|$)/], RX_CAMX],
      ['cmdPtzLeft', 'action', NEVER, [/(^|[^a-z])(left|gauche)([^a-z]|$)/], RX_CAMX],
      ['cmdPtzRight', 'action', NEVER, [/(^|[^a-z])(right|droite)([^a-z]|$)/], RX_CAMX],
      ['cmdPtzHome', 'action', NEVER, [/home|origine|accueil/], /record|enregistr|detect/],
      ['cmdPtzStop', 'action', NEVER, [/stop/], /record|enregistr|detect|audio|snapshot/]]
  };
  function autoFill(obj, f, done) {
    done = done || function () {};
    var map = AUTO[obj && obj.type];
    var src = cleanIdE(getPath(obj, f.k));
    if (!map || !src || !map.some(function (m) { return m[0] === f.k; })) return done();
    var empty = map.filter(function (m) { return m[0] !== f.k && !cleanIdE(obj[m[0]]); });
    if (!empty.length) return done();
    ensureMetas([src]).then(function () {
      var meta = E.cmds[src];
      if (!meta || !meta.eqId) return null;
      return T.ajax('eqCmds', { id: meta.eqId });
    }).then(function (r) {
      if (!r || !r.cmds) return;
      var used = {}, got = [];
      map.forEach(function (m) { if (cleanIdE(obj[m[0]])) used[String(obj[m[0]])] = true; });
      var ok = function (c, kind) { return kind === 'info' ? c.type === 'info' : (c.type === 'action' && (kind === 'slider' ? c.subType === 'slider' : c.subType !== 'slider')); };
      empty.forEach(function (m) {
        var cands = r.cmds.filter(function (c) { return !used[String(c.id)] && ok(c, m[1]); });
        var res = Array.isArray(m[3]) ? m[3] : [m[3]];
        var c = cands.filter(function (x) { return x.generic && m[2].test(x.generic); })[0] ||
          cands.filter(function (x) {
            var n = normName(x.name + ' ' + (x.logicalId || '').replace(/_/g, ' '));
            return res.every(function (re) { return re.test(n); }) && !(m[4] && m[4].test(n));
          })[0];
        // info : celle liée aux actions (valeur de retour), sinon la seule info numérique / binaire
        if (!c && m[1] === 'info') {
          var linked = r.cmds.filter(function (x) { return x.type === 'action' && x.value; }).map(function (x) { return String(x.value).replace(/#/g, ''); })[0];
          c = cands.filter(function (x) { return String(x.id) === linked; })[0];
        }
        if (c) { obj[m[0]] = String(c.id); used[String(c.id)] = true; got.push(c.name); }
      });
      if (obj.type === 'camera') {
        if (!(obj.options || []).length) {
          var pre = r.cmds.filter(function (c) { return c.type === 'action' && !used[String(c.id)] && /preset|prepos/.test(normName(c.name + ' ' + (c.logicalId || ''))); });
          if (pre.length) { obj.options = pre.map(function (c) { return { label: c.name.replace(/^.*?(preset|prepos\w*)\s*[:\-]?\s*/i, '') || c.name, cmdAction: String(c.id) }; }); got.push(pre.length + ' position(s) prédéfinie(s)'); }
        }
        if (!obj.frigateCam && r.plugin === 'frigate' && r.logicalId && /^[\w-]+$/.test(r.logicalId)) { obj.frigateCam = r.logicalId; got.push('nom de caméra « ' + r.logicalId + ' »'); }
      }
      if (got.length) {
        toast('Commandes reprises de l\'équipement : ' + got.join(', '));
        modified();
        return ensureMetas(map.map(function (m) { return obj[m[0]]; })).then(function () { onTileChange({ f: 'sel' }); });
      }
    }).catch(function () { /* remplissage facultatif */ }).then(function () { done(); });
  }
  function cleanIdE(v) { return String(isSet(v) ? v : '').replace(/#/g, '').trim(); }

  function fillHik(obj, eqId) {
    return T.ajax('eqCmds', { id: eqId }).then(function (r) {
      var cmds = (r && r.cmds) || [], ids = [];
      HIK_MAP.forEach(function (m) {
        var c = cmds.filter(function (x) { return x.logicalId === m[1]; })[0];
        if (c) { obj[m[0]] = String(c.id); ids.push(String(c.id)); } else delete obj[m[0]];
      });
      // 2e sortie (relais 2) : logicalId ou nom contenant « 2 »
      var o2 = cmds.filter(function (x) { return /^(ouvrir_porte_?2|ouvrir_?2|porte_?2|relais_?2|relay_?2|sortie_?2|door_?2|unlock_?2)$/i.test(x.logicalId || ''); })[0] ||
        cmds.filter(function (x) { return x.type === 'action' && /(ouvr|porte|relais|sortie|door)/i.test(x.name || '') && /2/.test(x.name || '') && String(x.id) !== String(obj.cmdOpen); })[0];
      if (o2) { obj.cmdOpen2 = String(o2.id); ids.push(String(o2.id)); }
      if (!obj.cmdEtat) toast('Commandes hikinterphone introuvables : choisissez-les à la main', 'error');
      return ensureMetas(ids);
    });
  }

  /** bonsPoints : commandes par logicalId ; comportements = actions behav_* « Nom (+2) », paliers = infos palier_* « Palier Nom (10 pts) ». */
  function bpParse(name) {
    var m = String(name || '').match(/^(.*?)\s*\(\s*([+\-−]?\s*\d+(?:[.,]\d+)?)[^)]*\)\s*(\d+)?\s*$/);
    if (!m) return null;
    return { label: m[1].trim(), pts: parseFloat(m[2].replace('−', '-').replace(/\s/g, '').replace(',', '.')) };
  }
  function fillBonsPoints(obj, eqId) {
    return T.ajax('eqCmds', { id: eqId }).then(function (r) {
      var cmds = (r && r.cmds) || [], ids = [];
      var by = function (lid) { return cmds.filter(function (c) { return c.logicalId === lid; })[0]; };
      [['cmdScore', 'score_semaine'], ['cmdPrev', 'score_semaine_prec'], ['cmdTotal', 'score_total'], ['cmdLast', 'dernier'], ['cmdActif', 'actif'], ['cmdUndo', 'annuler']].forEach(function (m) {
        var c = by(m[1]);
        if (c) { obj[m[0]] = String(c.id); ids.push(String(c.id)); } else delete obj[m[0]];
      });
      var oldIcons = {};
      (obj.bpPal || []).forEach(function (x) { if (x.icon) oldIcons[x.name] = x.icon; });
      obj.bpBehav = cmds.filter(function (c) { return /^behav_/.test(c.logicalId || ''); }).map(function (c) {
        var b = bpParse(c.name) || { label: c.name, pts: 0 };
        return { cmdAct: String(c.id), label: b.label, pts: b.pts };
      });
      obj.bpPal = cmds.filter(function (c) {
        // paliers = infos palier_<id> ; « Palier atteint » / « Palier semaine précédente » ne sont pas des paliers
        return /^palier_/.test(c.logicalId || '') && ['palier_atteint', 'palier_prec'].indexOf(c.logicalId) < 0 && c.type === 'info' && bpParse(String(c.name).replace(/^Palier\s+/i, ''));
      }).map(function (c) {
        var b = bpParse(String(c.name).replace(/^Palier\s+/i, ''));
        var x = { cmdBin: String(c.id), name: b.label, pts: b.pts };
        if (oldIcons[b.label]) x.icon = oldIcons[b.label];
        return x;
      }).sort(function (a, b) { return a.pts - b.pts; });
      if (!obj.cmdScore) toast('Commandes bonsPoints introuvables : choisissez-les à la main', 'error');
      else toast(obj.bpBehav.length + ' comportements et ' + obj.bpPal.length + ' paliers repris');
      return ensureMetas(ids);
    });
  }

  function fillVigieau(obj, eqId) {
    return T.ajax('eqCmds', { id: eqId }).then(function (r) {
      var cmds = ((r && r.cmds) || []).filter(function (c) { return c.type === 'info'; }), ids = [], used = {};
      VG_MAP.forEach(function (m) {
        var found = null;
        m[1].some(function (re) {
          found = cmds.filter(function (c) { return !used[c.id] && (re.test(normName(c.name)) || re.test(normName(c.logicalId))); })[0];
          return !!found;
        });
        if (found) { obj[m[0]] = String(found.id); used[found.id] = true; ids.push(String(found.id)); } else delete obj[m[0]];
      });
      if (!obj.cmdLevel && !obj.cmdLevelTxt) toast('Niveau de restriction introuvable : choisissez la commande à la main', 'error');
      return ensureMetas(ids);
    });
  }

  function cmdLabel(id) {
    var m = E.cmds[id];
    if (!m) return '#' + id + '#';
    return m.human || ('#' + id + '#');
  }

  function pickCmd(filter, cb) {
    if (!window.jeedom || !jeedom.cmd || typeof jeedom.cmd.getSelectModal !== 'function') { fail('Sélecteur de commande indisponible'); return; }
    var opts = { cmd: {} };
    if (filter && filter.type) opts.cmd.type = filter.type;
    if (filter && filter.subType) opts.cmd.subType = filter.subType;
    jeedom.cmd.getSelectModal(opts, function (result) {
      var id = cleanId(result && result.cmd ? result.cmd.id : '');
      var done = function (cid) {
        if (!cid) { fail('Commande introuvable'); return; }
        ensureMetas([cid]).then(function () { cb(cid); }).catch(fail);
      };
      if (id) done(id);
      else if (result && result.human) T.ajax('resolveHuman', { human: result.human }).then(function (r) { done(cleanId(r)); }, fail);
    });
  }

  function cmdField(obj, f, set) {
    var id = cleanId(getPath(obj, f.k));
    var wrap = $('<div class="input-group input-group-sm"></div>');
    var inp = $('<input type="text" class="form-control" readonly>').val(id ? cmdLabel(id) : '').attr('placeholder', 'Aucune');
    if (id && E.cmds[id] && E.cmds[id].missing) inp.addClass('tl-ed-missing');
    var btns = $('<span class="input-group-btn"></span>');
    var pick = $('<a class="btn btn-default" title="Choisir"><i class="fas fa-list-alt"></i></a>');
    var clear = $('<a class="btn btn-default" title="Retirer"><i class="fas fa-times"></i></a>');
    pick.on('click', function () {
      pickCmd(f.filter, function (cid) {
        // le nom de la tuile n'est jamais modifié par le choix d'une commande
        set(cid);
      });
    });
    clear.on('click', function () { set(''); });
    inp.on('click', function () { pick.trigger('click'); });
    btns.append(pick).append(clear);
    wrap.append(inp).append(btns);
    return wrap;
  }

  function cmdListField(obj, f, set) {
    var list = (getPath(obj, f.k) || []).map(cleanId).filter(Boolean);
    var wrap = $('<div class="tl-ed-list"></div>');
    var chips = $('<div class="tl-ed-chips"></div>');
    list.forEach(function (id, i) {
      var chip = $('<span class="tl-ed-chip"></span>').text(E.cmds[id] ? (E.cmds[id].eqName + ' › ' + E.cmds[id].name) : '#' + id + '#');
      var x = $('<i class="fas fa-times"></i>').on('click', function () { list.splice(i, 1); set(list.slice()); });
      chips.append(chip.append(' ').append(x));
    });
    if (!list.length) chips.append('<span class="tl-ed-muted">Aucune commande</span>');
    var add = $('<a class="btn btn-xs btn-default"><i class="fas fa-plus"></i> Ajouter</a>').on('click', function () {
      pickCmd(f.filter || C_INFO, function (cid) { if (list.indexOf(cid) < 0) list.push(cid); set(list.slice()); });
    });
    var quick = $('<span class="tl-ed-quick">Remplir avec : </span>');
    if (f.noQuick) quick = '';
    if (quick) [['ouvrants', 'les ouvrants'], ['lumieres', 'les lumières'], ['prises', 'les prises'], ['volets', 'les volets']].forEach(function (q) {
      quick.append($('<a class="btn btn-xs btn-default"></a>').text(q[1]).on('click', function () {
        T.ajax('countList', { kind: q[0] }).then(function (r) {
          Object.keys(r.cmds || {}).forEach(function (id) { E.cmds[id] = r.cmds[id]; });
          if (!r.ids.length) { toast('Aucune commande avec ce type générique'); return; }
          toast(r.ids.length + ' commande(s) ajoutée(s)');
          set(r.ids.map(String));
        }, fail);
      }));
    });
    var clearAll = list.length ? $('<a class="btn btn-xs btn-default">Vider</a>').on('click', function () { set([]); }) : '';
    wrap.append(chips).append($('<div class="tl-ed-listbar"></div>').append(add).append(' ').append(clearAll)).append(quick);
    return wrap;
  }

  function linesField(obj, onChange, o) {
    o = o || { key: 'lines', schema: LINE_SCHEMA, add: { kind: 'value', label: '' }, word: 'Ligne' };
    var wrap = $('<div class="tl-ed-lines"></div>');
    var lines = obj[o.key] = Array.isArray(obj[o.key]) ? obj[o.key] : [];
    lines.forEach(function (l, i) {
      var card = $('<div class="tl-ed-card"></div>');
      var head = $('<div class="tl-ed-cardhead"></div>').text(o.word + ' ' + (i + 1) + (o.title && o.title(l) ? ' · ' + o.title(l) : ''));
      var up = $('<a class="btn btn-xs btn-default"><i class="fas fa-arrow-up"></i></a>').on('click', function () {
        if (i > 0) { lines.splice(i - 1, 0, lines.splice(i, 1)[0]); onChange({ f: 'sel' }); }
      });
      var del = $('<a class="btn btn-xs btn-danger"><i class="fas fa-times"></i></a>').on('click', function () { lines.splice(i, 1); onChange({ f: 'sel' }); });
      head.append($('<span class="pull-right"></span>').append(up).append(' ').append(del));
      card.append(head);
      o.schema.forEach(function (f) {
        if (f.show && !f.show(l)) return;
        card.append(field(l, f, function (ff) { onChange(ff && (ff.f === 'cmd' || ff.f === 'sel' || ff.rebuild) ? { f: 'sel' } : { f: 'text' }); }));
      });
      wrap.append(card);
    });
    wrap.append($('<a class="btn btn-xs btn-default"><i class="fas fa-plus"></i> ' + o.word + '</a>').on('click', function () {
      lines.push(JSON.parse(JSON.stringify(o.add)));
      onChange({ f: 'sel' });
    }));
    return wrap;
  }

  function optionsField(obj, onChange) {
    var wrap = $('<div class="tl-ed-lines"></div>');
    var options = obj.options = Array.isArray(obj.options) ? obj.options : [];
    options.forEach(function (o, i) {
      var row = $('<div class="tl-ed-optrow"></div>');
      var lab = $('<input class="form-control input-sm" placeholder="Libellé">').val(o.label || '').on('input', function () { o.label = $(this).val(); onChange({ f: 'text' }); });
      var c = cmdField(o, { k: 'cmdAction', filter: C_ACTION }, function (v) { setPath(o, 'cmdAction', v); onChange({ f: 'sel' }); });
      var del = $('<a class="btn btn-xs btn-danger"><i class="fas fa-times"></i></a>').on('click', function () { options.splice(i, 1); onChange({ f: 'sel' }); });
      row.append(lab).append(c).append(del);
      wrap.append(row);
    });
    wrap.append($('<a class="btn btn-xs btn-default"><i class="fas fa-plus"></i> Commande</a>').on('click', function () {
      pickCmd(C_ACTION, function (cid) {
        options.push({ label: (E.cmds[cid] && E.cmds[cid].name) || '', cmdAction: cid });
        onChange({ f: 'sel' });
      });
    }));
    return wrap;
  }

  /* ================================================================== */
  /*  Actions de la barre                                                */
  /* ================================================================== */

  function addTile(t) {
    var cur = selTile();
    var tiles = E.layout.tiles;
    // une tuile ajoutée depuis la colonne de gauche y reste
    if (cur) tiles.splice(tiles.indexOf(cur) + 1, 0, t); else tiles.push(t);
    E.sel = t.id;
    modified();
    renderAll();
  }

  function moveTile(src, target) {
    var tiles = E.layout.tiles, a = tileById(src), b = tileById(target);
    if (!a || !b) return;
    tiles.splice(tiles.indexOf(a), 1);
    tiles.splice(tiles.indexOf(b), 0, a);
    if ((a.zone || '') !== (b.zone || '')) { if (b.zone) a.zone = b.zone; else delete a.zone; }
    E.sel = src;
    modified();
    renderAll();
  }

  /** Échange deux tuiles : ordre, position, emplacement et pile. */
  function swapTiles(a, b) {
    var ta = tileById(a), tb = tileById(b), tiles = E.layout.tiles;
    if (!ta || !tb || ta === tb) return;
    var ia = tiles.indexOf(ta), ib = tiles.indexOf(tb);
    tiles[ia] = tb; tiles[ib] = ta;
    ['x', 'y', 'zone', 'stack'].forEach(function (k) {
      var va = ta[k], vb = tb[k];
      if (vb === undefined) delete ta[k]; else ta[k] = vb;
      if (va === undefined) delete tb[k]; else tb[k] = va;
    });
    E.lastMoved = null;
    E.sel = a;
    modified();
    renderAll();
  }

  function placeTile(src, x, y, zone) {
    var t = tileById(src);
    if (!t || t.type === 'rangee') return;
    delete t.stack;
    t.x = x; t.y = y;
    E.lastMoved = src;
    if (zone) t.zone = zone; else delete t.zone;
    E.sel = src;
    modified();
    renderAll();
  }

  function shift(d) {
    var t = selTile();
    if (!t) return;
    var tiles = E.layout.tiles, i = tiles.indexOf(t), j = i + d;
    if (j < 0 || j >= tiles.length) return;
    tiles.splice(i, 1);
    tiles.splice(j, 0, t);
    modified();
    renderPreview();
  }

  function defaultsFor(type) {
    var base = { id: newId(), type: type, w: 1, h: 1, title: '' };
    switch (type) {
      case 'rangee': return { id: newId(), type: 'rangee', space: 30 };
      case 'lumiere': return Object.assign(base, { title: 'Lumière', w: 1, h: 1 });
      case 'variateur': return Object.assign(base, { title: 'Lumière', w: 1, h: 1 });
      case 'interphone': return Object.assign(base, { title: 'Interphone', w: 2, h: 2 });
      case 'bonspoints': return Object.assign(base, { title: 'Bons points', bpStyle: 'grande', w: 3, h: 3.5 });
      case 'thermostat': return Object.assign(base, { thKind: 'chauffage', thStep: 0.5, w: 1.5, h: 2 });
      case 'chauffeeau': return Object.assign(base, { w: 1.5, h: 1.5 });
      case 'messages': return Object.assign(base, { w: 2, h: 1 });
      case 'puissance': return Object.assign(base, { w: 1.5, h: 1 });
      case 'batteries': return Object.assign(base, { title: 'Batteries', w: 2, h: 1.5 });
      case 'reseau': return Object.assign(base, { title: 'Réseau', w: 2, h: 1.5 });
      case 'demons': return Object.assign(base, { title: 'Démons', w: 2, h: 1.5 });
      case 'alarme': return Object.assign(base, { title: 'Alarme', rsPart: 1, w: 1.5, h: 2 });
      case 'zones': return Object.assign(base, { title: 'Zones', w: 2, h: 2 });
      case 'kpi': return Object.assign(base, { title: 'Production', w: 1, h: 0.75 });
      case 'batterie2': return Object.assign(base, { title: 'Batterie', w: 2, h: 2 });
      case 'bilanjour': return Object.assign(base, { title: 'Bilan d\'aujourd\'hui', w: 2, h: 1.5 });
      case 'prevsolaire': return Object.assign(base, { title: 'Prévision solaire', w: 2, h: 1.5 });
      case 'conseils': return Object.assign(base, { title: 'energIA · conseils', w: 2, h: 1.5 });
      case 'ouvrants': return Object.assign(base, { title: 'Ouvrants', hideTitle: true, w: 2, h: 3, items: [{ kind: 'title', label: 'RDC' }, { kind: 'fenetre', label: '', openValue: '1' }] });
      case 'vigieau': return Object.assign(base, { title: 'VigiEau', w: 2, h: 1.5 });
      case 'reveil': return Object.assign(base, { title: 'Réveil', w: 1.5, h: 1 });
      case 'reveils': return Object.assign(base, { title: 'Réveils', w: 2, h: 1 });
      case 'reveilplan': return Object.assign(base, { title: 'Planning', w: 2.5, h: 2 });
      case 'sante': return Object.assign(base, { title: 'Santé', w: 2, h: 2 });
      case 'soleil': return Object.assign(base, { w: 1.5, h: 1 });
      case 'separateur': return Object.assign(base, { title: '', hideTitle: true, w: 0.25, h: 2 });
      case 'camera': return Object.assign(base, { frigateMode: 'rapide', camLive: true, camZoom: true, w: 2, h: 1.5 });
      case 'widget': return Object.assign(base, { w: 2, h: 2 });
      case 'web': return Object.assign(base, { w: 2, h: 2 });
      case 'bouton': return Object.assign(base, { behavior: 'impulsion' });
      case 'ouvrant': return Object.assign(base, { kind: 'fenetre', openValue: '1' });
      case 'voletgroupe': return Object.assign(base, { title: 'Tous les volets' });
      case 'select': return Object.assign(base, { display: 'popup' });
      case 'lien2': return Object.assign(base, { title: '', hideTitle: true, aTarget: 'page', bTarget: 'page', w: 2, h: 1 });
      case 'lien': return Object.assign(base, { title: 'Accueil', target: 'home', icon: 'svg:home', titleColor: '#ffffff' });
      case 'horloge': return Object.assign(base, { title: '', hideTitle: true, w: 2, h: 0.5, format: 'date', align: 'gauche' });
      case 'texte': return Object.assign(base, { title: '', hideTitle: true, w: 2, h: 0.5, template: '{1}°C | {2}%' });
      case 'lignes': return Object.assign(base, { title: 'Pièce', w: 2.5, h: 1, titlePx: 50, lines: [{ kind: 'value', label: 'Température' }, { kind: 'value', label: 'Consigne' }] });
      case 'jauge': return Object.assign(base, { title: 'Cuve', w: 2, h: 2, style: 'cuve', unit: '%' });
      case 'image': return Object.assign(base, { title: '', hideTitle: true });
      case 'vide': return Object.assign(base, { title: 'Réserve' });
    }
    return base;
  }

  /* ---------- import JSON : noms lisibles et commandes complétées ----------
   * Dans le JSON, une commande peut s'écrire « #[Objet][Équipement][Commande]# » et un équipement
   * « #[Objet][Équipement]# » (eqId) : ils sont convertis en id. Ensuite, comme dans l'éditeur, les
   * commandes manquantes sont reprises de l'équipement (volets, lumières, caméras, alarme, interphone…). */
  var EQ_FILL = { alarme: function (t, id) { return fillRisco(t, id); }, zones: function (t, id) { return fillRisco(t, id); }, vigieau: function (t, id) { return fillVigieau(t, id); },
    interphone: function (t, id) { return fillHik(t, id); }, bonspoints: function (t, id) { return fillBonsPoints(t, id); }, reveil: function (t, id) { return fillReveil(t, id); } };
  function importRefs(data) {
    var refs = [], slots = [];
    E.quiet = true;
    var isRef = function (v) { return typeof v === 'string' && /^#?\[.+\]#?$/.test(v.trim()); };
    var walk = function (node) {
      if (!node || typeof node !== 'object') return;
      Object.keys(node).forEach(function (k) {
        var v = node[k];
        if (/^cmd[A-Z]/.test(k) || k === 'eqId') {
          if (Array.isArray(v)) v.forEach(function (x, i) { if (isRef(x)) { refs.push(x.trim()); slots.push([v, i, x.trim()]); } });
          else if (isRef(v)) { refs.push(v.trim()); slots.push([node, k, v.trim()]); }
        } else if (v && typeof v === 'object') walk(v);
      });
    };
    walk(data.tiles);
    walk((data.grid || {}).alerts || []);
    var step = refs.length ? T.ajax('resolveRefs', { refs: JSON.stringify(refs.filter(function (x, i) { return refs.indexOf(x) === i; })) }) : Promise.resolve({});
    return step.catch(function (e) { E.quiet = false; throw e; }).then(function (map) {
      var missing = [];
      slots.forEach(function (s) {
        var id = map && map[s[2]];
        if (id) s[0][s[1]] = String(id);
        else { if (missing.indexOf(s[2]) < 0) missing.push(s[2]); if (Array.isArray(s[0])) s[0][s[1]] = ''; else delete s[0][s[1]]; }
      });
      data.tiles.forEach(function (t) { if (Array.isArray(t.cmdList)) t.cmdList = t.cmdList.filter(Boolean); });
      // compléter les tuiles : équipement (alarme, interphone…) ou commandes sœurs (volet, lumière, caméra…)
      var jobs = data.tiles.map(function (t) {
        if (cleanIdE(t.eqId) && EQ_FILL[t.type]) return EQ_FILL[t.type](t, t.eqId).catch(function () {});
        var map2 = AUTO[t.type];
        if (!map2) return null;
        var known = map2.filter(function (m) { return cleanIdE(t[m[0]]); })[0];
        if (!known) return null;
        return new Promise(function (res) { autoFill(t, { k: known[0] }, res); });
      }).filter(Boolean);
      return Promise.all(jobs).then(function () {
        E.quiet = false;
        if (missing.length) {
          T.ui.modal({ title: 'Import : commandes introuvables', body: '<p>Ces noms ne correspondent à aucune commande ou aucun équipement de Jeedom (vérifiez l\'objet, l\'équipement et la commande, majuscules et accents compris). Les cases correspondantes sont restées vides : choisissez-les dans l\'éditeur.</p><ul>' + missing.map(function (m) { return '<li><code>' + esc(m) + '</code></li>'; }).join('') + '</ul>' });
        } else if (refs.length) toast(refs.length + ' commandes / équipements reconnus');
      });
    });
  }

  function openJson() {
    var area = $('<textarea class="form-control tl-ed-json" spellcheck="false"></textarea>').val(JSON.stringify(E.layout, null, 2));
    var body = $('<div><p>Copiez ce texte pour sauvegarder ou recopier la page ailleurs. Collez un autre JSON puis « Appliquer » pour l\'importer.</p></div>').append(area);
    T.ui.modal({
      title: 'Page en JSON', wide: true, body: body[0], buttons: [{ label: 'Fermer' }, {
        label: 'Appliquer', primary: true, click: function () {
          var data;
          try { data = JSON.parse(area.val()); } catch (e) { fail('JSON invalide : ' + e.message); return false; }
          if (!data || !Array.isArray(data.tiles)) { fail('Le JSON doit contenir une liste « tiles »'); return false; }
          data.grid = Object.assign({}, E.layout.grid, data.grid || {});
          data.tiles.forEach(function (t) { if (!t.id) t.id = newId(); });
          E.layout = data;
          E.sel = null;
          modified();
          importRefs(data).then(function () {
            return ensureMetas(U.collectIds([data.tiles, (data.grid || {}).alerts || []]));
          }).then(function () { renderGridConf(); renderAll(); }).catch(fail);
        }
      }]
    });
  }

  /* ================================================================== */
  /*  Branchements                                                       */
  /* ================================================================== */

  $('#span_tlVersion').text(T.version);
  $('#bt_tlAddTile').on('click', function () {
    if (!E.layout) return;
    var t = defaultsFor('valeur');
    t.title = 'Nouvelle tuile';
    addTile(t);
  });
  $('#bt_tlAddRow').on('click', function () {
    if (!E.layout) return;
    addTile(defaultsFor('rangee'));
  });
  $('#bt_tlMoveLeft').on('click', function () { shift(-1); });
  $('#bt_tlMoveRight').on('click', function () { shift(1); });
  $('#bt_tlDuplicate').on('click', function () {
    var t = selTile();
    if (!t) return;
    var c = JSON.parse(JSON.stringify(t));
    c.id = newId();
    addTile(c);
  });
  $('#bt_tlDelete').on('click', function () {
    var t = selTile();
    if (!t) return;
    E.layout.tiles.splice(E.layout.tiles.indexOf(t), 1);
    E.sel = null;
    modified();
    renderAll();
  });
  $('#cb_tlMobile').on('change', function () { E.mobile = $(this).is(':checked'); renderPreview(); });
  $('#bt_tlJson').on('click', function () { if (E.layout) openJson(); });
  $('#bt_tlPageConf').on('click', function () { if (!E.layout) return; E.confOpen = !E.confOpen; renderGridConf(); });
  $('#bt_tlOpenPage').on('click', function () {
    if (E.eqId) window.open('index.php?v=d&m=tuiles&p=panel&page_id=' + E.eqId, '_blank');
  });
  $('#bt_tlOpenPanel').on('click', function () { window.open('index.php?v=d&m=tuiles&p=panel', '_blank'); });
  $('#bt_tlNav').on('click', function () { openNavEditor(); });

  /* ---------- sauvegarde : tout exporter / tout importer ---------- */
  $('#bt_tlExportAll').on('click', function () {
    T.ajax('exportAll', {}).then(function (data) {
      var blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
      // lien hors de la page : Jeedom intercepte les clics sur les liens du document (navigation ajax)
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tuiles-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json';
      a.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true, view: window }));
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      toast((data.pages || []).length + ' page(s) exportée(s)');
    }).catch(fail);
  });
  $('#bt_tlImportAll').on('click', function () { $('#in_tlImportAll').val('').trigger('click'); });
  $('#in_tlImportAll').on('change', function () {
    var file = this.files && this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (e) { toast('Fichier illisible (JSON invalide)', 'error'); return; }
      if (!data || !data.tuilesBackup || !Array.isArray(data.pages)) { toast('Ce fichier n\'est pas une sauvegarde « Tout exporter »', 'error'); return; }
      var body = $('<div></div>');
      body.append($('<p></p>').text(data.pages.length + ' page(s) dans la sauvegarde du ' + (data.date || '?') + '.'));
      body.append('<p>Une page qui existe déjà (même nom, même appareil) est remplacée ; les autres sont créées. Les liens entre pages et la barre d\'onglets suivent les nouveaux numéros.</p>');
      var cb = $('<input type="checkbox" checked>');
      body.append($('<label style="font-weight:normal"></label>').append(cb).append(' Restaurer aussi la barre d\'onglets, les couleurs et les réglages du plugin'));
      T.ui.modal({
        title: 'Tout importer', body: body[0],
        buttons: [{ label: 'Annuler' }, { label: 'Importer', primary: true, click: function (close) {
          T.ajax('importAll', { data: JSON.stringify(data), withConfig: cb.is(':checked') ? 1 : 0 }).then(function (r) {
            close();
            toast(r.pages + ' page(s) importée(s) : ' + r.created + ' créée(s), ' + r.updated + ' remplacée(s)');
            setTimeout(function () { location.reload(); }, 1200);
          }).catch(fail);
          return false;
        } }]
      });
    };
    reader.readAsText(file);
  });
})();
