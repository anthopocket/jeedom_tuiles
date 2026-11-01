# Plugin Tuiles

Pages de tuiles simples et génériques, dans l'esprit des Designs : un fond sombre, des cases noires arrondies, un titre, une valeur ou une icône, une couleur selon l'état, et éventuellement une action.

- Vous choisissez vos commandes info et action, le plugin s'occupe de l'affichage.
- Grille automatique : pas de positions à régler, tout est centré, le texte s'adapte à la case.
- Mise à jour en direct par les événements du core (`jeedom.cmd.addUpdateFunction` / `cmd::update`), actions par `jeedom.cmd.execute`.
- Pas de démon, pas de cron, pas de dépendance, aucune commande créée.
- Ne touche pas au dashboard : chaque page est un équipement masqué.
- Pages pour tablette et pour mobile.

## Installation

1. Copier le dossier `tuiles` dans `plugins/` de Jeedom, puis activer le plugin.
2. Dans la page du plugin (Plugins › Gestion des plugins › Tuiles), cocher **Afficher le panneau desktop** et **Afficher le panneau mobile** pour avoir les pages dans le menu Accueil et dans l'interface mobile.
3. Dans **Configuration**, choisir éventuellement la **page d'accueil** et la **page d'accueil mobile** (ouverte par l'interface mobile). Il n'y a pas de thème global : chaque tuile se personnalise (nom, fond, arrondi, couleurs).

## Créer une page

Plugins › Organisation › Tuiles › **Ajouter une page**. L'onglet **Page** contient l'éditeur avec l'aperçu en direct.

### Plusieurs infos (lignes) : présentation

Par défaut en **tableau** : libellés alignés à gauche, valeurs et boutons alignés à droite, un fin trait entre les lignes, sous-titres en petites capitales. Le réglage « Présentation : centrée » remet l'ancienne présentation « libellé : valeur » centrée.

## Réglages de la page

**Hauteur auto (tout tient à l'écran)** (ligne Grille, activée par défaut) : avec un format en px (ex. tablette 1920 × 1200), les rangées **remplissent exactement la hauteur du design**, plus hautes s'il y a peu de rangées, plus basses s'il y en a beaucoup, sans jamais être coupées ; « Adapter à l'écran » met ensuite le tout à la taille de la tablette. Sans format en px, la hauteur des cases est seulement réduite pour que tout tienne dans l'écran. Elle se recalcule à chaque changement de taille d'écran ou d'orientation, quel que soit le nombre de colonnes ; les textes suivent. Sans format en px, les cases ne deviennent jamais plus hautes que la hauteur réglée. Sans effet sur mobile (la page défile).

- **Design** :
  - **Appareil** : Tablette ou Mobile. La liste « Mes pages » classe les pages par appareil.
  - **Format** : tailles courantes selon l'appareil (Galaxy S24 FE 384 × 832, iPhone 390 × 844, tablette 1280 × 800…). Remplit largeur et hauteur et active « Adapter à l'écran ». Une page Mobile sans taille s'adapte toute seule à la largeur du téléphone avec le nombre de colonnes choisi.
  - **Largeur** et **Hauteur** en pixels : par exemple 1280 × 800 pour une tablette. Vide = la page s'adapte à l'écran.
  - **Adapter à l'écran** : agrandit ou réduit le design pour remplir l'écran (tablette murale).
  - **Marge** : espace intérieur autour du design.
  - **Fond de page** : couleur de fond de toute la page (vide = fond Jeedom). Le fond de chaque tuile se règle dans la tuile, rubrique Apparence.
  - La taille d'une case, calculée à partir de la largeur et du nombre de colonnes, s'affiche à côté.
- **Grille** : nombre de colonnes, hauteur d'une case (vide = carrée), espace entre les tuiles, colonnes sur mobile.

### Page libre et barre de séparation

La page est une seule grille libre : pas de zone gauche ou droite. Chaque tuile se place où vous voulez (glisser-déposer dans l'aperçu, ou position colonne / ligne).

Pour séparer visuellement, ajoutez une tuile **Page → Barre de séparation** : verticale ou horizontale, couleur (ou celle du thème), épaisseur, longueur, style dégradé / plein / pointillé, option lumineuse. Elle se place et se dimensionne comme une tuile (par défaut ¼ de large × 2 de haut), sans fond ni cadre.

Les anciennes pages avec une colonne de gauche sont converties à l'ouverture dans l'éditeur : le bouton Accueil automatique est retiré et les autres tuiles de la colonne rejoignent la grille (pensez à sauvegarder).

### Ajouter des tuiles

- **Ajouter une tuile** : une tuile multifonction apparaît. Dans le panneau de droite, choisissez :
  - son **Nom**,
  - sa **Fonction** (info numérique, info binaire, ouvrant, bouton, slider, select, volet, jauge…),
  - sa **Taille** en cases : ¼, ⅓, ½, ⅔, ¾, 1, 1¼, 1⅓, 1½… jusqu'à 12, en largeur comme en hauteur,
  - puis les commandes de cette fonction.

  Rien n'est deviné : seul le nom est repris de la commande s'il est vide.
- **Nouvelle rangée** : les tuiles suivantes commencent une nouvelle rangée, avec un **espace au-dessus réglable en pixels** et un libellé optionnel (ex. « Extérieur », « Groupes »).

Cliquez sur une tuile pour la régler, glissez-déposez pour la déplacer, puis **Sauvegarder**.

### Taille et place

La grille fonctionne en douzièmes de case : une tuile peut faire ¼, ⅓, ½, ⅔, ¾, 1, 1¼… cases de large ou de haut. Deux tuiles ¼ plus l'espace font exactement une tuile ½. Avec **Remplissage auto**, les petites tuiles comblent les trous.

### Piles : plusieurs tuiles dans une case

Cochez **Empiler sous la tuile précédente** : la tuile se met sous la précédente, dans la même case. La pile fait au moins 1 case de haut (plus si une de ses tuiles est plus haute, par exemple 2) et ses tuiles se partagent cette hauteur à parts égales : qu'il y en ait 1, 2, 3 ou plus, la rangée reste parfaitement droite. La largeur de la pile est celle de la première tuile. Une tuile devenue très basse passe automatiquement sur une seule ligne : nom à gauche, valeur à droite.

### Placement libre

Glissez une tuile dans l'aperçu et déposez-la où vous voulez : elle reste à cet endroit (punaise bleue), au douzième de case près. Les tuiles sans position se rangent automatiquement autour. Exemple : deux tuiles de ½ hauteur empilées l'une sous l'autre dans une seule case.

**Échanger deux tuiles** : lâchez une tuile **sur** une autre (elle s'entoure d'orange) : les deux échangent leur place, leur ordre, leur emplacement et leur pile. Lâchée dans un **espace vide**, la tuile est placée à cet endroit.

**Anti-chevauchement** : deux tuiles placées ne peuvent pas se superposer. Si une position saisie tombe sur une autre tuile, elle se cale à la place libre la plus proche. Au dépôt, la position s'aimante sur les quarts et les tiers de case pour garder des tuiles alignées.

On peut aussi saisir la **Position : colonne / ligne** dans la tuile (1 = première, 1.5 = milieu de la première case…). Le bouton **auto** remet la tuile en placement automatique. Sur mobile (sans taille en px), les positions sont ignorées et les tuiles se rangent dans l'ordre.

### Tailles du texte en pixels

Dans **Apparence**, comme dans Word : **Taille du nom (px)**, **Taille du texte (px)** (valeurs, textes, listes) et **Taille de l'icône (px)** (icône ou bouton rond). Vide = taille automatique selon la tuile. Un texte trop long pour la tuile rétrécit quand même pour ne pas déborder.

## Réglages de la page

Le bouton **Réglages de la page** (barre de l'éditeur) déplie les lignes Design, Style, Textes et Alertes ; replié, seule la ligne Grille reste, pour laisser la place à l'aperçu.

**Textes** : une taille commune pour toute la page — **Noms**, **Textes / valeurs** et **Icônes / logos** (en px). Elle s'applique à toutes les tuiles qui n'ont pas leur propre taille (dans une tuile, le champ affiche « page : 22 »). Le bouton **Appliquer à toutes les tuiles** retire les tailles propres des tuiles pour que la page décide partout.

## Remplissage automatique des commandes

Sur les tuiles **Volet**, **Bouton**, **Éclairage**, **Éclairage variateur** et **Caméra**, dès qu'une commande est choisie (par exemple l'info position d'un volet), les autres commandes vides sont cherchées dans le **même équipement** : monter, descendre, stop, position pour un volet ; on / off pour un bouton ou un éclairage ; variation pour un variateur ; pour une caméra (plugin Frigate) : infos et actions enregistrement / détection, commandes PTZ (haut, bas, gauche, droite, zoom, origine, stop), positions prédéfinies (presets) et nom de la caméra. La recherche utilise le type générique Jeedom, sinon le nom de la commande (monter / descendre / stop, on / off…). Les commandes déjà choisies ne sont jamais remplacées ; un message liste celles qui ont été reprises.

## Retour à l'accueil sans bouton

Dans « Régler la barre d'onglets… » (commun à toutes les pages) :

- **Glisser le doigt vers la droite** : n'importe où sur la page, un balayage vers la droite ramène à la page d'accueil. La distance minimum à parcourir se règle (100 px par défaut, de 30 à 600) : tout glissé au moins aussi long déclenche le retour. Une petite maison suit le doigt et devient bleue quand la distance est atteinte. Le geste est ignoré sur les curseurs, les volets, les barres qui défilent de côté et dans les fenêtres ouvertes.
- **Bouton caché** : choisissez un coin de l'écran et une taille (70 px par défaut). Un appui dans ce coin ramène à la page d'accueil, sur toutes les pages sauf l'accueil. La zone est invisible, ou montre une maison très discrète si la case est cochée. Évitez de mettre une tuile importante sous ce coin.
- **Écran de veille** : dans « Régler la barre d'onglets… », pour chaque appareil, indiquez au bout de combien de minutes sans toucher l'écran passe en veille : fond noir, grande horloge grise, date en option et une image de votre choix en bas à droite (adresse d'une image, par exemple `/data/img/logo.png`). Vous pouvez régler la couleur du texte, la couleur du fond, la luminosité (5 à 100 %, pour un écran moins lumineux la nuit) et la taille de l'heure ; le bouton « Voir la veille » montre le résultat tout de suite. L'horloge bouge légèrement chaque minute pour ne pas marquer l'écran. Un appui n'importe où ouvre la page d'accueil de l'appareil (ou ferme simplement la veille si l'on y est déjà). La veille attend tant qu'une fenêtre ou une caméra est ouverte.
- **Retour automatique à l'accueil après N minutes** sans toucher l'écran (vide = jamais). Pas de retour tant qu'une fenêtre ou une caméra en plein écran est ouverte.

La page d'accueil est celle choisie pour l'appareil (sinon l'accueil du plugin). Rien n'apparaît à l'écran et rien ne se passe sur la page d'accueil elle-même ni dans l'éditeur.

## Sauvegarder toutes les pages (Tout exporter / Tout importer)

Sur la page du plugin, **Tout exporter** télécharge un fichier `tuiles-sauvegarde-AAAA-MM-JJ.json` avec toutes les pages (nom, objet, mise en page), la barre d'onglets (menus tablette et mobile), les couleurs prédéfinies et les réglages du plugin.

**Tout importer** recrée tout depuis ce fichier, par exemple après une réinstallation du plugin :
- une page qui existe déjà (même nom, même appareil) est remplacée, les autres sont créées ;
- les liens entre pages (tuiles Lien, Double lien, Résumé d'ouvrants), la barre d'onglets et les pages d'accueil suivent automatiquement les nouveaux numéros de pages ;
- une case permet de ne pas restaurer la barre d'onglets, les couleurs et les réglages.

Les commandes Jeedom gardent leurs numéros tant que c'est le même Jeedom : les tuiles retrouvent leurs infos et actions.

## Importer une page en JSON

Bouton **JSON** de l'éditeur : collez une page puis « Appliquer ». Les commandes peuvent s'écrire avec leur nom Jeedom, `#[Objet][Équipement][Commande]#`, et les équipements (alarme, interphone, VigiEau, réveil, bons points) `#[Objet][Équipement]#` : ils sont convertis en id, puis les commandes manquantes sont complétées depuis l'équipement (comme dans l'éditeur). Les noms introuvables sont listés ; leurs cases restent vides.

## Types de tuiles

| Type | Usage |
|---|---|
| Valeur | nombre ou texte, unité, décimales, libellés, plage plausible, format de date |
| Icône d'état | icône qui change de couleur ou d'image selon l'info |
| Ouvrant | porte, fenêtre, fenêtre 2 vantaux, hublot (fenêtre ronde), baie, portail, garage, volet ; dessin ouvert/fermé, action ouvrir/fermer intégrée. Baie et fenêtre 2 vantaux : 2 contacts possibles (vantail gauche + droit) → fermé, ouvert à gauche, à droite ou les deux |
| Bouton | les 6 cas : impulsion, On seul, toggle, On/Off selon l'état, 2 boutons, avec ou sans retour |
| Slider | min / max / pas en auto : lus sur la commande action, sinon sur l'info liée (l'éditeur affiche la plage trouvée), **suivie en direct** si le plugin la change (ex. hOn selon le programme) ; envoi au relâchement, boutons + / −, vertical |
| Liste / select | par défaut la tuile est fermée et affiche le choix actuel ; au clic, la liste s'ouvre par-dessus la page avec une hauteur maxi réglable (px) et une recherche au-delà de 10 choix. Autres affichages : liste dans la tuile, menu déroulant, boutons |
| Volet | fenêtre dessinée dont le tablier suit la position, pourcentage + état coloré, boutons ▲ ■ ▼ en capsule ; avec une commande de position, on glisse le doigt sur la fenêtre pour régler le % |
| Jauge | cuve, barre, anneau |
| Lignes | plusieurs « libellé : valeur », sous-titres, mini-boutons ou icônes |
| Texte avec valeurs | modèle libre `{1}°C \| {2}%` |
| Date / heure du jour | « jeudi 22 octobre », heure, etc. |
| Lien | navigation vers une page, l'accueil, un Design ; compteur (ex. nombre d'ouvrants ouverts) |
| Double lien | deux moitiés cliquables dans une même tuile (côte à côte ou l'une au-dessus de l'autre), chacune avec son texte, un sous-texte (fixe, ou avec la valeur d'une info : « # ouverts »), son image ou son icône, sa couleur et sa destination (page, accueil, adresse) |

**Animer un lien** (Lien et chaque moitié du Double lien) : case **Animer l'icône / l'image** — sans condition, cochée = animée en permanence, décochée = fixe. Option **Animer seulement si l'info…** (une info, une comparaison et une valeur, ex. Mouvement = 1) : animée quand la condition est vraie, sinon fixe ; la case est alors ignorée. Une icône animée bouge ; une image ou une icône simple pulse doucement.

| Envoi de date, Saisie | envoie une date ou une valeur à une commande message ou slider |
| Image, Vide | logo, réserve |

## Liste d'ouvrants

La tuile **Liste d'ouvrants** regroupe toutes les portes et fenêtres dans une seule tuile, pratique sur mobile :

- un **bandeau** « Tout est fermé » (vert) ou « 2 ouverts » (orange) avec le nom des ouvrants ouverts (« Baie ouest (gauche), Chambre Armand ») ;
- des **groupes** (RDC, Étage, Garage…) : un ouvrant de type « Titre de groupe » commence une nouvelle carte ;
- pour chaque ouvrant : le nom, l'état en toutes lettres (« Fermée », « Ouverte à gauche ») et le dessin.

Chaque ouvrant a son propre réglage : contact, **Inverser (0 = ouvert)**, valeur « ouvert ». Une baie coulissante ou une fenêtre 2 vantaux accepte 2 contacts (gauche, droite). L'accord (Ouverte / Ouvert) est automatique selon le type et peut être forcé.

Option « Ouvrants ouverts en tête de leur groupe ».

Affichage **Résumé** : la même liste dans une petite tuile (icône + « Tout fermé » / « Chambre Armand » / « 2 ouverts »), qui ouvre la page choisie au toucher. Idéal sur la page d'accueil : copiez la tuile (JSON) et passez-la en Résumé.

## Groupe de volets

La tuile **Groupe de volets** commande plusieurs volets d'un coup (Tous, RDC, Étage…) sans scénario Jeedom : elle reprend les listes d'actions monter / stop / descendre (et position, en glissant sur la fenêtre) et les envoie à tous les volets du groupe. Elle affiche la position moyenne, dessinée comme un volet, et « 3 / 7 ouverts ». Une confirmation peut être demandée avant de monter ou descendre (pas pour Stop).

## Boutons

Le **type de bouton** se choisit explicitement :

| Type | Commandes | Clic | Couleur |
|---|---|---|---|
| Sans retour (impulsion) | Action | exécute | fixe, flash vert/rouge |
| On seul, avec retour | Action On + info | exécute toujours On | selon l'info, option « grisé si déjà actif » |
| Toggle, avec retour | Action toggle + info | exécute le toggle | selon l'info |
| On / Off, avec retour | On + Off + info | On si inactif, Off si actif | selon l'info |
| 2 boutons On et Off | On + Off | deux boutons | fixe |

Options : confirmation, appui long (seconde action), attente du retour (la tuile clignote jusqu'au changement de l'info, puis passe en rouge si rien n'arrive).

## Info binaire

Une info 0/1 affichée en icône : icône et couleur pour l'état 1, icône et couleur pour l'état 0, texte optionnel pour chaque état (« Marche », « Arrêt »), valeur de l'état 1 réglable, inversion possible. Une action au clic est optionnelle.

## Icônes

Chaque champ icône a deux boutons :

- **Jeedom** : ouvre le sélecteur d'icônes du core (icônes Jeedom, Font Awesome, images). Les classes de couleur du sélecteur (icon_green…) sont ignorées : c'est la tuile qui colore l'icône selon l'état. Un clic sur l'aperçu ouvre aussi ce sélecteur.
- **Tuiles** : les icônes dessinées du plugin (boutons, états, ouvrants fermé/ouvert), qui prennent la couleur de l'état.

## Couleurs selon la valeur

Toutes les tuiles qui lisent une info (valeur, info binaire, ouvrant, bouton avec retour, volet, jauge, slider, saisie, date, lignes, texte, compteur des liens) : jusqu'à **10 lignes**, chacune avec sa couleur, choisie librement au sélecteur de couleur (ou en `#rrggbb`).

- Une valeur **nombre** veut dire « à partir de » : c'est le plus haut seuil atteint qui gagne.
- Une valeur **texte** veut dire « si égal à » (sans tenir compte des majuscules). Les textes passent avant les nombres.
- **Autres valeurs** : la couleur quand aucune ligne ne correspond. Sans aucune ligne, c'est simplement la couleur fixe.

La couleur s'applique à la valeur ou à l'icône (ou, au choix, au fond ou au nom de la tuile). Le cadre a sa propre liste, voir plus bas.

## Effets

Rubrique **Effets** de chaque tuile :

- **Animation** : rotation (pompe, ventilateur), pulsation, clignotement (alerte), rebond, secousse (cloche, réveil). Sur l'icône, le bouton ou la valeur, **quand la tuile est active** ou toujours.
- **Halo néon** : halo lumineux de la couleur actuelle (état ou seuil), autour de la tuile ou sur l'icône / la valeur, quand actif ou toujours.
- **Changement de valeur** : le chiffre défile de l'ancienne à la nouvelle valeur, avec un petit flash de sa couleur (désactivable).
- **Mini-courbe en fond** : courbe de l'historique Jeedom (24 h par défaut, réglable) en bas de la tuile, mise à jour en direct. L'info doit être historisée.
- **Recto-verso** : un appui long retourne la tuile. Au dos : valeur actuelle, dernière mise à jour, min / max / moyenne sur la période, et des **commandes secondaires** au choix. Un toucher la remet à l'endroit (retour automatique après 15 s).

« Actif » = info à 1 / en marche, ouvrant ouvert, bouton en marche, ou valeur qui atteint une ligne de « Couleurs selon la valeur ».

## Cadre selon la valeur

Rubrique **Cadre** de chaque tuile, **indépendante** de la couleur de la valeur : les deux s'utilisent en même temps (ex. valeur jaune et cadre rouge).

- **Activer la couleur du cadre** : coche pour allumer / éteindre le cadre (les réglages sont gardés quand on le désactive).
- **Couleur du cadre selon la valeur** : jusqu'à 10 lignes (nombre = à partir de, texte = si égal) + couleur des autres valeurs.
- **Épaisseur** en px (3 par défaut) et **cadre lumineux** (halo).
- **Info du cadre** : par défaut l'info de la tuile, mais on peut piloter le cadre par une autre info (ex. icône drapeau dont le cadre suit le pH).

## Intégrer : widget, caméra, page web

Fonction **Intégrer** dans le choix de la tuile :

- **Widget Jeedom** : affiche le widget d'un équipement existant (ex. le flux d'énergie animé d'un autre plugin). Choisissez l'équipement ; le widget est mis à l'échelle (Ajuster / Remplir / Taille réelle) et se recharge quand l'équipement change. Option « agrandir » pour l'ouvrir en grand.
- **Caméra Frigate** : flux direct d'une caméra Frigate (MJPEG, capture rafraîchie ou go2rtc), badge LIVE, clic = plein écran, pastilles **REC** et **Détection**.
- **Page web** : iframe (Grafana, interface de box…), zoom, rafraîchissement, interactive ou non.

### Frigate

Renseignez l'**adresse Frigate** (ex. `http://192.168.1.50:5000`) et le **nom de la caméra** tel qu'il est dans Frigate :

| Mode | Adresse utilisée | Remarque |
|---|---|---|
| **Images rapides** (conseillé) | `/api/<cam>/latest.jpg?h=720`, 3 images/s par défaut | Le plus fiable : rien ne reste ouvert, plusieurs caméras sur la même page, fonctionne via Jeedom |
| MJPEG Frigate | `/api/<cam>?fps=5&h=720` | Flux continu ; un navigateur ne garde que 6 flux ouverts vers une même adresse, au-delà les images se figent |
| Flux go2rtc | `:1984/api/stream.mjpeg?src=<cam>` | Flux MJPEG de go2rtc dans une image (la page WebRTC de go2rtc en cadre est bloquée par la sécurité de Jeedom) |
| Capture lente | `/api/<cam>/latest.jpg?h=720` toutes les N s | Très léger |

À savoir : si Jeedom est ouvert en **https**, le navigateur bloque un flux en **http** (contenu mixte) — passez Frigate en https ou par le même proxy. Le port 5000 (API sans authentification) ou 1984 (go2rtc) doit être joignable depuis l'appareil qui affiche la page (attention depuis l'extérieur / l'appli mobile hors du réseau local). Le nom de flux go2rtc doit être celui déclaré dans `go2rtc: streams:` (souvent le même que la caméra), sinon remplissez « Adresse go2rtc ».

### Pastilles enregistrement et détection

Dans la tuile caméra, choisissez une **info binaire** pour l'enregistrement et/ou pour la détection de mouvement (ex. commandes du plugin Frigate ou MQTT). Les pastilles s'affichent en bas à gauche : **REC** rouge clignotant quand l'enregistrement est actif, **Détection** orange quand la détection est activée, barrées quand c'est coupé. Si vous ajoutez les actions activer / désactiver, un appui sur la pastille bascule l'état (sans ouvrir le plein écran).

### Pastille LIVE

La pastille suit l'**état réel** de la caméra : toutes les 30 s, Jeedom interroge Frigate (`/api/stats`, images par seconde de la caméra). **LIVE** (point rouge qui clignote) quand Frigate reçoit des images, **HORS LIGNE** (gris, image grisée) quand la caméra ne fournit plus d'images, que Frigate est injoignable ou que l'image ne se charge pas, **PAUSE** quand le flux relayé est en pause. Il faut que la page soit enregistrée.

### PTZ et positions prédéfinies

Dans la tuile caméra, renseignez les commandes action PTZ (haut, bas, gauche, droite, zoom +/−, origine, stop) et des **positions prédéfinies** (libellé + action), par exemple celles du plugin Frigate ou MQTT (`frigate/<caméra>/ptz` : `MOVE_UP`, `ZOOM_IN`, `STOP`, `preset_<nom>`).

- Elles apparaissent dans la **vue agrandie** : croix directionnelle avec bouton origine au centre, zoom à côté, positions en bas.
- **Déplacement** : « un appui = un pas » (une commande par appui) ou « maintenir appuyé » (mouvement tant qu'on appuie, Stop envoyé au relâché).
- Clavier (navigateur) : flèches, + / −, 1 à 9 pour les positions, H pour l'origine.

### Voir les caméras à distance : « Via Jeedom »

Cochez **Via Jeedom (accès à distance)** dans la tuile caméra. C'est alors le serveur Jeedom qui récupère l'image chez Frigate (ou la caméra) sur le réseau local et la renvoie : la caméra est visible partout où Jeedom l'est (DNS Jeedom, votre domaine…), **sans ouvrir Frigate ni la caméra vers l'extérieur**.

- Le navigateur ne transmet que « page + tuile » ; l'adresse est lue dans la configuration enregistrée. Seules les caméras configurées par un administrateur sont joignables, et il faut être connecté à Jeedom.
- Capture : rafraîchie normalement. Flux vidéo (MJPEG ou go2rtc, qui passe alors en MJPEG) : mis en pause après 60 s pour ne pas occuper le serveur, un appui le relance.
- Prenez une hauteur d'image raisonnable (480–720 px) et 2 à 5 images/s : tout transite par la connexion de la maison.
- Enregistrez la page pour activer le relais ; dans l'éditeur la caméra s'affiche en direct.

## Thème et onglets

**Un menu par appareil.** Dans « Régler la barre d'onglets… », choisissez 🖥 Tablette ou 📱 Mobile en haut de la fenêtre : chaque appareil a sa propre barre (affichée ou non), ses onglets et leur ordre, la taille des onglets, le bouton accueil (page, texte, icône), le geste « bord gauche → accueil », le retour automatique et « Onglets sur toute la largeur » (par défaut sur mobile : la barre prend la largeur des tuiles, onglets de même largeur). Exemple : sur mobile, deux onglets « Maison » et « Sécurité » en grand ; sur la tablette, toutes les pièces.

Dans les réglages de la page, ligne **Style** :

- **Thème** :
  - Néon bleu, Néon vert, Néon violet, Ambre, Graphite : tuiles en verre avec contour lumineux, noms en petites capitales avec un point lumineux.
  - **Aurore** : halos de couleur qui dérivent lentement derrière des tuiles givrées, noms en dégradé turquoise → violet.
  - **Cockpit** : tableau de bord d'avion, tuiles en relief avec vis aux coins, chiffres ambre façon instrument.
  - **Ardoise** : mat et sobre, une barre corail en haut de chaque tuile, onglet actif plein. Les couleurs réglées sur une tuile (fond, nom…) restent prioritaires. Option de tuile **Icône devant le nom**.
- **Barre d'onglets commune** : elle se règle une seule fois pour toutes les pages, avec le bouton **Barre d'onglets** de la liste des pages (ou « Régler la barre d'onglets… » dans la ligne Style d'une page). On y coche sur quels appareils la barre s'affiche (**Tablette / Mobile**) la **taille des onglets** (60 à 300 %, avec aperçu) et « Bouton accueil », puis pour chaque page : visible ou non, nom d'onglet court, icône (sinon celle de la page), et l'ordre en **glissant les lignes** (ou flèches). Chaque page n'affiche que les onglets de son appareil (tablette, mobile). Une page peut masquer la barre (Style → Onglets → Pas de barre sur cette page). Une nouvelle page apparaît automatiquement à la fin. **Bouton accueil** : choisissez la page qu'il ouvre pour chaque appareil (Accueil Tablette / Mobile, sinon l'accueil du plugin), son texte (vide = icône seule) et son icône. Cette page d'accueil n'est alors plus répétée dans les onglets, et le bouton est en surbrillance quand on est dessus.

## Énergie : chiffre clé, batterie, bilan, prévision, conseils

Famille **Énergie** du catalogue, pour un tableau de bord sans courbe en direct : **toucher une valeur** ouvre sa courbe 24 h / 7 j / 30 j (l'info doit être historisée ; « Courbe au toucher » = Non pour désactiver). Les infos en Wh sont converties en kWh.

- **Chiffre clé** : grosse valeur (W passe en kW au-delà de 1000) + petite ligne (« {1} kWh aujourd'hui » avec une 2ᵉ info), liseré de couleur en haut. Peut aussi calculer **Autonomie %** (conso et achat du jour) ou **Autoconsommation %** (production et revente).
- **Batterie** : anneau de charge (rouge / orange / vert), en charge / en décharge avec la puissance, énergie stockée, « pleine vers » et « tiendra jusqu'à » (avec la capacité en kWh et la charge mini utilisable), boutons **Marche / Arrêt** avec confirmation et état allumé.
- **Bilan énergie du jour** : produit (et prévu), consommé, acheté, revendu, une barre « où est partie la production » (maison / batterie / revendu), l'autonomie et l'autoconsommation du jour.
  - Chaque info peut être un **compteur cumulé** (total depuis l'installation, ex. compteur réseau Victron) : cochez « compteur cumulé » et la tuile affiche la différence depuis minuit. La valeur de minuit est lue dans l'historique Jeedom (commande historisée conseillée) ; sans historique, le plugin garde le premier relevé de la journée.
  - La **consommation** peut être **calculée** : production + achat − revente − énergie entrée batterie + énergie sortie batterie.
- **Prévision solaire** : aujourd'hui (et prévu), encore à venir, demain, après-demain (Solcast ou autre).
- **Conseils** : texte d'une info (une ligne par conseil : retour à la ligne, « | » ou « ; ») et boutons de mode (ex. Conseil / Auto, le bouton du mode actif est allumé).

Le schéma de flux existant s'intègre avec la tuile **Widget Jeedom** (équipement, ajustement « remplir », fond transparent).

## Carte puissance

Fonction **Afficher une info → Carte puissance** : petit titre, icône éclair et valeur en grand, texte dessous, **anneau** en % d'un maxi (ex. 6000 W) et **courbe des dernières heures en fond** (commande historisée). Couleur fixe, du thème, ou selon des seuils. Clic : courbe et détails.

## Soleil

Fonction **Page → Soleil** : arc du lever au coucher avec le soleil à sa place, partie parcourue en jaune, **hauteur du soleil** au centre, heures de lever / coucher et durée du jour. La nuit, la lune (avec sa phase) parcourt l'arc. Calcul local à partir de la position de Jeedom (Réglages → Système → Configuration), ou latitude / longitude de la tuile, ou une info de hauteur du soleil.

## Bandeau d'alertes

Dans les réglages de la page (ligne **Alertes**), ajoutez des règles : une info, une condition (`>`, `≥`, `<`, `≤`, `=`, `≠`, **hors de** / **entre** deux valeurs), une durée minimale (« depuis N min »), un texte, une couleur et l'option *pulse*.

- Exemples : pH **hors de** 7 et 7,6 · Porte du garage **=** 1 depuis 10 min · Température piscine **<** 10.
- Dans le texte : `#value#` (valeur + unité), `#name#` (nom de la commande), `#since#` (« depuis 12 min »).
- La durée est calculée à partir de la date de changement de la valeur connue par Jeedom : elle reste juste après un rechargement de la page.
- Un appui sur l'alerte la masque jusqu'à son prochain déclenchement (la condition doit redevenir fausse puis vraie).
- Le bandeau se superpose en haut de la page, sans décaler les tuiles.

## Messages / alertes (plugin rapport…)

Fonction **Afficher une info → Messages / alertes** : affiche le texte d'une info (jusqu'à 3), par exemple celle d'un plugin de rapport qui décrit ce qui ne va pas.

- **Une ligne = un bandeau** : le texte est découpé sur les retours à la ligne, `<br>` et `|` (ou `;` au choix).
- Info vide, ou égale à une valeur « tout va bien » (`ok`, `0`, `aucun`, `rien`, `-`, modifiable) → coche verte « Tout va bien » (texte modifiable, `-` pour rien).
- **Couleur automatique** selon les mots : erreur / défaut / panne / alarme / fuite → rouge (icône qui s'agite), attention / batterie / faible / bas / ouvert → orange, le reste → bleu. Ou une couleur fixe.
- Compteur de messages en haut à droite, cadre rouge quand il y a une erreur.
- Options : effacer un message d'un appui (il revient s'il change), afficher « il y a … ».

Les mêmes messages peuvent aussi s'afficher **en haut de la page** : dans les alertes de la page, choisissez la condition **« texte de la commande »** (une alerte par ligne, couleurs automatiques).

## Batteries

Fonction **Afficher une info → Batteries** : la liste des équipements à pile est lue **automatiquement** dans Jeedom (niveau remonté par chaque plugin), triée de la plus faible à la plus forte. Rien à configurer.

- Afficher seulement les **piles faibles** (par défaut) ou **toutes les piles**.
- Couleurs selon les seuils de Jeedom (Réglages → Système → Configuration → Équipements) ou ceux de chaque équipement : rouge = danger (la pile clignote), orange = attention, vert = bon.
- Sous le nom : la pièce, le type de pile s'il est renseigné, et « sans nouvelles depuis … » si le niveau n'a pas été remonté depuis 48 h (réglable).
- Compteur des piles faibles en haut à droite, « Toutes les piles sont bonnes » sinon. Rafraîchie toutes les 15 min.

## Alarme (Risco) : partitions et zones

Options de la tuile partition : **Nom de la partition** (afficher / masquer) et **Prête / pas prête** (tout afficher, seulement « pas prête » et pourquoi, ou masquer).

Dans une tuile **Plusieurs infos (lignes)**, une ligne « Libellé : icône » peut aussi prendre la couleur d'autres infos : **Rouge si cette info est active** (ex. Z3 Alarme, prioritaire) et **Vert si cette info est active** (ex. Z3 Armé, quand l'info principale est au repos). Ex. détecteur PIR : gris au repos, vert armé, orange détection, rouge alarme.

Deux tuiles, sans les groupes. Choisissez l'équipement alarme : les commandes sont retrouvées automatiquement d'après leurs noms (`P1 Armé`, `P1 Armer total`, `Z1 Ouvert`, `Z1 Bypasser`…).

- **Commander → Alarme : partition** (une tuile par partition, numéro réglable) : bouclier coloré (vert désarmée, orange armée partiel, rouge armée, rouge clignotant **ALARME** avec la zone en cause), nom de la partition, « ✓ Prête à armer » ou « Pas prête : Pir Cuisine ouvert », défauts de la centrale (déconnexion, batterie, tamper, télésurveillance…), dernier événement. Boutons **Total / Partiel / Désarmer** (le mode actif est allumé), avec confirmation (désactivable).
- **Afficher une info → Zones d'alarme** : zones en alarme puis ouvertes puis bypassées (ou toutes), filtre par partition, pastilles Ouvert / ALARME / Bypassé / Armé / Fermé. Un appui : **Bypasser / Débypasser**. Mêmes réglages de liste (taille, remplir, colonnes).

## VigiEau

Fonction **Afficher une info → VigiEau** : choisissez l'équipement du plugin VigiEau, ses commandes (niveau, libellé, commune, zone, type d'eau, arrêtés, dates, mesures, date d'import) sont retrouvées par leur nom et restent modifiables.

- Niveau en pastille colorée et **barre à 5 cases** : ⚪ aucune restriction (tout va bien), puis les 4 niveaux officiels 🟢 Vigilance, 🟡 Alerte, 🟠 Alerte renforcée, 🔴 Crise (clignote). Le niveau est lu en chiffre (0 à 4) ou en texte.
- **Rappel du niveau** (mode complet, masquable) : l'objectif du niveau et des exemples de règles nationales ; l'arrêté préfectoral fait foi, ses mesures restent affichées au-dessus.
- Affichage **complet** (zone, période « du 17/10 au 31/10 · encore 7 j », numéros d'arrêtés, mesures, ancienneté des données) ou **compact** (niveau et barre) pour une page d'arrosage.

## Démons et dépendances

Fonction **Afficher une info → Démons et dépendances des plugins** : tous les plugins actifs qui ont un démon ou des dépendances, lus avec les fonctions du core Jeedom.

- **Problème** (rouge, en premier, compté dans le badge) : démon arrêté alors que sa gestion automatique est activée, ou dépendances non installées / en erreur. Un démon arrêté avec la gestion automatique coupée n'est pas un problème (« arrêté (manuel) »). Installation en cours : pastille bleue avec le pourcentage.
- Afficher seulement les problèmes (par défaut) ou tous les plugins ; vérification toutes les 60 s (réglable), suivi rapproché pendant une installation de dépendances.
- Un appui sur une ligne : **Démarrer / Redémarrer**, **Arrêter**, **Relancer les dépendances**, **Gestion auto : activer / couper**, **Logs** : fenêtre dans la page (sans aller dans Jeedom) avec le log du plugin et celui du démon, rafraîchie toutes les 3 s, erreurs en rouge et avertissements en orange, filtre « erreurs seulement ». Les actions demandent les droits administrateur et sont tracées dans le log `tuiles`.
- Mêmes réglages d'affichage que les autres listes : taille en %, remplir, colonnes.

## Réseau (plugin Network)

Fonction **Afficher une info → Réseau** : les équipements du plugin **Network** (ping) sont lus automatiquement, comme pour les batteries.

- Afficher seulement les équipements **hors ligne** (par défaut) ou **tous** (hors ligne en premier).
- Point vert / rouge, « hors ligne depuis 2 h », latence en ms (orange au-delà de 100 ms, réglable), adresse IP (masquable).
- Mise à jour **en direct** quand un ping change d'état ; compteur des équipements hors ligne, « Tout est en ligne » sinon.
- Réglages d'affichage (aussi sur Batteries et Messages) : **taille du texte et des lignes en %** et **lignes qui remplissent la hauteur de la tuile**, **colonnes** (1 à 4 ou automatique selon la largeur). Trop de lignes : la liste défile ; avec un nombre maximum de lignes, « + N autres » s'affiche.
- Un appui sur une ligne : **Ping maintenant** et, si l'équipement a une adresse MAC, **Réveiller (WOL)**.

## Réveil (plugin Réveils)

Deux tuiles pour le plugin **Réveils** (Alexa + Rémi) :

- **Commander → Réveil (plugin Réveils)** : choisissez l'équipement Réveils, ses commandes sont **retrouvées automatiquement** (Prochain réveil, Statut synchro, Synchro OK, Alexa OK, Rémi OK, Dernière vérification, Exception, Pas de prochain réveil, Resynchroniser) et restent modifiables. La tuile affiche l'heure du prochain réveil en grand, « Demain / Lun. … », le compte à rebours, « vérifié il y a … », une pastille de synchro (vert OK, orange en attente, violet dérogation manuelle, rouge écart) et les pastilles Alexa / Rémi. En cas de souci, le détail du statut s'affiche sous l'heure. Option **compact**. **Appareil** : Alexa et Rémi, Alexa seulement ou Rémi seulement — pour faire une tuile « Moi » (Alexa) et une tuile « Armand » (Rémi) avec le même équipement Réveils : chaque tuile ne montre que le statut, la pastille et le détail de son appareil.
- **Commander → Liste des réveils** : une ligne par équipement (toi, Armand…) avec la pastille de synchro, le jour et l'heure.

- **Commander → Planning d'un réveil** : le planning calculé par le plugin (semaine en cours + 3 suivantes, numéros de semaine), avec l'heure de chaque jour : rouge = congé, trait bleu = avec enfant, contour violet = profil du jour (nom affiché), orange = exception. En haut : prochain réveil avec la pastille de synchro et le statut Alexa / Rémi. Boutons **✎ Heure** (toucher un jour pour lui mettre un réveil à la main, « pas de réveil » ou revenir au planning), **✎ Congé**, **✎ Enfant**, **✎ <profil du jour>** : choisissez-en un puis touchez les jours à basculer (congé et garde sont communs à tous les réveils). **✔✔ Vérifier** (relit l'Alexa et le Rémi sans reprogrammer) et **🔄 Resynchroniser** (réapplique le planning, annule les dérogations). Légende en bas. Un appui sans mode affiche l'origine de l'heure. Bouton **Paramètres** : ouvre la fenêtre de réglage du planning du plugin Réveils. Option lecture seule.

Un appui sur la tuile Réveil (ou sur une ligne de la liste) ouvre une fenêtre : **changer l'heure** de ce réveil seulement (exception), **pas de réveil**, **revenir au planning**, **vérifier**, **resynchroniser**.

## Courbe et détails

Sur une tuile **Valeur**, **Jauge** ou **Carte puissance**, si vous l'activez (réglage « Courbe et détails » : au clic ou appui long, désactivé par défaut), un appui ouvre une fenêtre : valeur actuelle, **min / moyenne / max**, courbe **24 h / 7 j / 30 j** avec lecture au doigt ou à la souris, date de dernière mise à jour. La commande doit être **historisée**. 

## Éclairage

Deux tuiles : **Éclairage on / off** et **Éclairage variateur**. L'ampoule s'allume selon le **retour d'état** réel, pas selon le dernier appui.

- **Info état** : binaire 0/1 (ou une autre valeur « allumé » au choix). Sur un variateur, si elle est vide, la lampe est allumée dès que la luminosité dépasse 0.
- **Actions** : allumer et éteindre, ou une seule action basculer. Un appui sur la tuile allume ou éteint.
- **Variateur** : action slider, plus l'info luminosité (vide = l'info liée au slider). Mini, maxi et pas sont repris de la commande ; on peut les forcer. Le halo de l'ampoule suit le niveau.
- Variateur sans actions allumer / éteindre : un appui passe le slider à 0, puis le remet au dernier niveau connu.
- Pas de texte allumé / éteint : l'ampoule suffit. Le variateur affiche seulement le pourcentage quand il est allumé.
- **Couleur de la lumière** (blanc chaud par défaut).

## Icônes animées

Le sélecteur « Tuiles » propose un groupe **Animées** : pompe piscine, pompe d'arrosage, arroseurs rotatif et oscillant, goutte-à-goutte, électrovanne, robot de piscine, cuve, ventilateur / VMI, radiateur, flamme, prise, panneau solaire, batterie, voiture en charge, lave-linge, sèche-linge, lave-vaisselle, robot aspirateur, portail, ampoule, sirène, sonnette, mangeoire, piège à moustiques, pompe à chaleur (unité extérieure et piscine), recharge et décharge batterie, caméra dôme, monitoring (baie serveur + batterie + cœur).

- Elles s'utilisent comme n'importe quelle icône (info binaire, bouton, lien…).
- Juste sous le choix de l'icône : **Icône animée : bouge** (quand la tuile est active, toujours, ou jamais) et **Icône animée : vitesse** (lente, normale, rapide).
- Par défaut elles bougent quand la tuile est **active** (info à 1, en marche…) et restent figées à l'arrêt. Dans l'éditeur, elles bougent toujours pour l'aperçu.
- **Info à plusieurs états** (ex. lave-linge Prêt / En cours / Terminé) : dans la tuile « Info icône », remplir « Valeurs en marche » (`En cours`) et « Valeurs terminé » (`Terminé`), séparées par `;` — un mot contenu dans la valeur suffit (`En cours - Essorage` = en marche). En marche : l'icône bouge ; terminé : couleur, icône et texte dédiés, avec une coche sur l'icône ; sinon : au repos.

## Interphone (plugin hikinterphone)

- Choisir l'**équipement interphone** : les commandes du plugin hikinterphone (état d'appel, sonnerie, en communication, en ligne, décrocher, raccrocher, refuser, ouvrir porte) sont reprises automatiquement.
- États : **Au repos**, **On sonne !** (cadre orange qui clignote, cloche animée), **En communication** (avec la durée), **Hors ligne**.
- Les boutons changent selon l'état : Décrocher + Refuser quand ça sonne, Raccrocher pendant l'appel, Ouvrir toujours (avec confirmation, désactivable).
- **Fenêtre automatique quand ça sonne** : sur la tablette, une grande fenêtre s'ouvre avec l'image et les boutons, puis se ferme 4 s après la fin de l'appel.
- **Caméra (option)** : adresse de Frigate + nom de la caméra du portier, en images rafraîchies (chaque seconde pendant un appel). « Via Jeedom » pour la voir à distance sans ouvrir Frigate.
- **Parler** (micro de la tablette) : renseigner l'info « Lien Parler » du plugin hikinterphone (reprise automatiquement). Un bouton Parler apparaît quand ça sonne et pendant l'appel (option : aussi au repos) ; il ouvre la page Parler du plugin dans une fenêtre (appuyer pour parler ou mains libres). Option « Décrocher ouvre aussi Parler ».
- Conditions du navigateur pour le micro : accepter une fois le certificat de la page Parler (lien dans la fenêtre), et ouvrir Jeedom en https ou le déclarer comme origine sûre (Chrome : chrome://flags ; Fully Kiosk : accès micro). La fenêtre l'indique en rouge si ce n'est pas le cas. L'appli mobile Jeedom ne transmet en général pas le micro.

## Bons Points (plugin bonsPoints)

- Choisir l'**enfant** (équipement bonsPoints) : scores, « annuler », comportements (un bouton chacun, avec ses points) et paliers sont repris automatiquement. Après avoir changé les comportements ou les paliers dans le plugin, choisir à nouveau l'équipement pour les relire.
- **Formats** :
  - **Grande** (parents) : score dans une étoile, chemin des paliers avec les récompenses qui s'allument, boutons + / −, semaine dernière, total, Annuler, dernier événement.
  - **Compacte** (vue enfant) : anneau avec le score ; boutons au choix (aucun, seulement les « + », tous).
  - **Mini** : score de la semaine et icônes des récompenses gagnées.
- **Score négatif** : zone rouge à gauche du 0 (jusqu'à −10 par défaut, réglable), étoile et anneau en rouge, « encore X points pour revenir à 0 ».
- **Animations** : « +2 » qui s'envole au toucher, étoile qui rebondit, confettis quand un palier est atteint.
- **Hors garde** (info « Suivi actif » à 0) : tuile grisée, boutons bloqués.
- **Sanctions** : un palier à points négatifs (ex. −10) est une sanction, déclenchée quand le score descend jusqu'à lui : icône rouge (⛔ par défaut), « Sanction : … », la tuile tremble. Elle n'est jamais affichée comme « gagnée ».
- **Colonnes de boutons** : 3 par défaut (2 sur la compacte), réglable ; au-delà de la hauteur, la liste défile.
- **Icônes des paliers** : un emoji par palier, dans l'ordre (🍨 🎳 🏉 🎁 ⭐ 🏆 par défaut).

## Thermostat

Fonction **Commander → Thermostat** : anneau avec la consigne au centre et la température mesurée (point blanc sur l'anneau).

- **Température mesurée** (info), **Action consigne** (action slider), **Info consigne** (vide = info liée à l'action).
- Consigne avec les boutons **− / +** (pas réglable, 0,5 par défaut) ou en glissant sur l'anneau ; l'envoi part 0,9 s après le dernier appui, une seule commande.
- Plage : mini / maxi de la tuile, sinon ceux de la commande, sinon 5–30.
- **Type** : chauffage (orange), climatisation (bleu), PAC / auto (vert). **Info en chauffe** (binaire) : l'anneau s'illumine et affiche « Chauffe » / « Refroidit ».
- **Boutons de mode** (libellé + action) : celui dont le libellé correspond à l'**info mode** est mis en avant.
- Marche / arrêt optionnel (info + actions) : bouton en haut à droite.
- Appui long sur la température mesurée : courbe et détails.

## Chauffe-eau

Fonction **Commander → Chauffe-eau** : ballon dessiné, coloré du bas (froid, bleu) vers le haut (chaud, rouge) selon les températures haut / bas.

- **Températures** haut et bas (une seule suffit), **consigne** réglable par − / + (action slider + info consigne, envoi 0,9 s après le dernier appui).
- **Info en chauffe** : binaire ou valeur > 0 (ex. courant compresseur) ; pour un code d'état, indiquez la valeur qui signifie « chauffe ». Le ballon s'illumine.
- **Ventilateur** (thermodynamique) : il tourne quand la vitesse ou le débit est > 0, plus vite si la vitesse est élevée.
- **État / mode** avec traduction (`17=Chauffe PAC;3=Veille`), **% d'eau chaude** si votre appareil le donne.
- Bouton **Boost** (avec son info d'état, rouge quand actif) et jusqu'à 4 autres boutons (Auto, Vacances…).
- Taille conseillée 1½ × 1½. Animations : vagues à la surface, bulles et résistance rougeoyante en chauffe, ventilateur et souffle d'air (PAC), vapeur (électrique, eau chaude), éclair Boost.
- Jusqu'à 6 infos complémentaires (conso d'eau, T évaporateur…). Clic sur le ballon : courbe de la température haute.
- Les réglages continus (Confort, durée Vacances…) se mettent dans des tuiles **Slider** à côté.

## Mobile

Sans rien régler, la page passe en 3 colonnes (réglable) sur un écran étroit et le texte s'adapte. Options par tuile :

- **Masquer sur mobile**
- **Une tuile par ligne** (tuiles Lignes) : par exemple, la tuile Salon « Température / Consigne » devient deux tuiles.
- **Ordre sur mobile**

L'aperçu de l'éditeur a un bouton **Aperçu mobile**.

## Adresses utiles

- Panel : `index.php?v=d&m=tuiles&p=panel` (page d'accueil ou liste des pages)
- Une page : `index.php?v=d&m=tuiles&p=panel&page_id=ID`
- Tablette murale sans barre Jeedom : ajouter `&kiosk=1`

## Styles de slider

Option **Style** de la tuile slider : **Classique**, **Néon** (piste fine lumineuse, curseur anneau), **Pilule** (grosse barre remplie, valeur dedans), **Segments** (barres qui s'allument, nombre réglable) et **Molette** (arc de 270° qu'on tourne au doigt, envoi au relâchement). La **couleur du slider** est libre ; si des « Couleurs selon la valeur » sont réglées, elles colorent le slider selon la valeur (ex. consigne bleue / verte / orange / rouge).

## Plages et listes dynamiques

Certains plugins changent la plage d'un slider ou la liste d'un select selon un autre réglage (ex. hOn : la durée possible dépend du programme). Le plugin relit alors la plage / la liste :

- quand Jeedom signale la mise à jour de l'équipement (`eqLogic::update`),
- et 1 s après le changement de n'importe quelle info du même équipement (même si elle n'est pas affichée sur la page).

La tuile n'est redessinée que si quelque chose a vraiment changé. Un réglage Min / Max / Pas saisi dans la tuile reste prioritaire.

## Dépannage

- **Les valeurs ne bougent pas en direct** : elles arrivent par les événements du core. Si une interface ne les reçoit pas, activez **Rafraîchissement de secours** dans la configuration du plugin (en secondes). Les valeurs sont aussi relues quand l'onglet ou l'appli revient au premier plan.
- **Une commande apparaît barrée dans l'éditeur** : elle a été supprimée, choisissez-en une autre.

## Code de confirmation

Dans la configuration du plugin, réglez un **Code de confirmation** (4 à 8 chiffres). Puis, dans une tuile (partie « Tuile »), choisissez **Code de confirmation** :

- **Sur le On** : allumer, ouvrir, monter, armer… demandent le code ;
- **Sur le Off** : éteindre, fermer, descendre, désarmer… demandent le code ;
- **Sur toutes les actions**.

Un clavier à gros chiffres s'ouvre ; il valide tout seul quand tous les chiffres sont tapés. Le code est vérifié par Jeedom : il n'apparaît jamais dans les pages ni dans la sauvegarde « Tout exporter ». Après 3 codes faux, le clavier est bloqué 30 secondes. Un bouton « toggle » (une seule action pour allumer et éteindre) suit son info d'état : s'il est éteint, l'appui compte comme un On ; s'il est allumé, comme un Off. Sans info d'état, le code est demandé dans les deux cas.
