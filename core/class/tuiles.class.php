<?php
/* Plugin Tuiles — pages de tuiles génériques pour Jeedom.
 * Aucun démon, aucun cron, aucune commande créée : chaque équipement est une page,
 * dont la mise en page est un JSON stocké dans configuration.layout.
 */

require_once __DIR__ . '/../../../../core/php/core.inc.php';

class tuiles extends eqLogic {

	/**
	 * Anciens préréglages de couleurs (supprimés de l'éditeur) : relus seulement pour convertir
	 * les tuiles qui en utilisent encore un en seuils libres à l'ouverture dans l'éditeur.
	 */
	public static function presets() {
		$raw = config::byKey('presets', 'tuiles', '');
		$presets = is_array($raw) ? $raw : json_decode((string) $raw, true);
		return is_array($presets) ? $presets : array();
	}

	/* ------------------------------------------------------------------ */
	/*  Mise en page                                                       */
	/* ------------------------------------------------------------------ */

	public static function defaultLayout() {
		return array(
			'version' => 1,
			'grid' => array(
				'cols' => 5,
				'size' => 200,
				'gap' => 12,
				'mobileCols' => 3,
				'dense' => true,
				'icon' => 'fas fa-th-large',
			),
			// page vierge : ni bouton Accueil ni colonne de gauche (à ajouter à la main si besoin)
			'tiles' => array(),
		);
	}

	public function getLayout() {
		$raw = $this->getConfiguration('layout', '');
		$layout = is_array($raw) ? $raw : json_decode((string) $raw, true);
		if (!is_array($layout)) {
			$layout = self::defaultLayout();
		}
		if (!isset($layout['grid']) || !is_array($layout['grid'])) {
			$layout['grid'] = array();
		}
		$layout['grid'] = array_merge(self::defaultLayout()['grid'], $layout['grid']);
		if (!isset($layout['tiles']) || !is_array($layout['tiles'])) {
			$layout['tiles'] = array();
		}
		return $layout;
	}

	/** Récupère récursivement tous les identifiants de commandes (clés cmdXxx). */
	public static function collectCmdIds($node, &$ids = array()) {
		if (!is_array($node)) {
			return $ids;
		}
		foreach ($node as $key => $value) {
			if (is_string($key) && preg_match('/^cmd[A-Z]/', $key)) {
				foreach ((is_array($value) ? $value : array($value)) as $id) {
					$id = self::cleanId($id);
					if ($id !== '') {
						$ids[$id] = $id;
					}
				}
			} elseif (is_array($value)) {
				self::collectCmdIds($value, $ids);
			}
		}
		return $ids;
	}

	public static function cleanId($id) {
		if (is_array($id) || is_object($id) || $id === null) {
			return '';
		}
		$id = trim(str_replace('#', '', (string) $id));
		return ctype_digit($id) ? $id : '';
	}

	/* ------------------------------------------------------------------ */
	/*  Commandes                                                          */
	/* ------------------------------------------------------------------ */

	public static function cmdMeta($cmd) {
		if (!is_object($cmd)) {
			return null;
		}
		$eqLogic = $cmd->getEqLogic();
		$meta = array(
			'id'       => $cmd->getId(),
			'name'     => $cmd->getName(),
			'human'    => $cmd->getHumanName(),
			'eqName'   => is_object($eqLogic) ? $eqLogic->getName() : '',
			'eqId'     => $cmd->getEqLogic_id(),
			'type'     => $cmd->getType(),
			'subType'  => $cmd->getSubType(),
			'unite'    => $cmd->getUnite(),
			'generic'  => $cmd->getGeneric_type(),
			'minValue' => $cmd->getConfiguration('minValue', ''),
			'maxValue' => $cmd->getConfiguration('maxValue', ''),
			'step'     => self::cmdStep($cmd),
		);
		if ($cmd->getType() == 'info') {
			try {
				$meta['value'] = $cmd->execCmd();
			} catch (Exception $e) {
				$meta['value'] = null;
			} catch (Error $e) {
				$meta['value'] = null;
			}
			$meta['collectDate'] = $cmd->getCollectDate();
			$meta['valueDate'] = $cmd->getValueDate();
		} else {
			$meta['listValue'] = $cmd->getConfiguration('listValue', '');
			$meta['linked'] = self::cleanId($cmd->getValue());
			// slider / select : infos du même équipement, pour relire la plage ou la liste quand elles changent (ex. programme hOn)
			if (in_array($cmd->getSubType(), array('slider', 'select'))) {
				$siblings = array();
				foreach (cmd::byEqLogicId($cmd->getEqLogic_id(), 'info') as $info) {
					$siblings[] = $info->getId();
				}
				$meta['siblings'] = $siblings;
			}
		}
		return $meta;
	}

	/** Pas d'un slider : configuration « step », sinon paramètre d'affichage « step » du widget. */
	private static function cmdStep($cmd) {
		$step = $cmd->getConfiguration('step', '');
		if ($step === '' || $step === null) {
			$params = $cmd->getDisplay('parameters', array());
			if (is_array($params) && isset($params['step'])) {
				$step = $params['step'];
			}
		}
		return $step;
	}

	public static function cmdMetas($ids) {
		$result = array();
		foreach ((array) $ids as $id) {
			$id = self::cleanId($id);
			if ($id === '') {
				continue;
			}
			$meta = self::cmdMeta(cmd::byId($id));
			$result[$id] = ($meta === null) ? array('id' => $id, 'missing' => true, 'human' => '#' . $id . '# (supprimée)') : $meta;
		}
		return $result;
	}

	public static function cmdValues($ids) {
		$result = array();
		foreach ((array) $ids as $id) {
			$id = self::cleanId($id);
			if ($id === '') {
				continue;
			}
			$cmd = cmd::byId($id);
			if (!is_object($cmd) || $cmd->getType() != 'info') {
				continue;
			}
			try {
				$value = $cmd->execCmd();
			} catch (Exception $e) {
				$value = null;
			}
			$result[] = array('cmd_id' => $id, 'value' => $value, 'collectDate' => $cmd->getCollectDate(), 'valueDate' => $cmd->getValueDate());
		}
		return $result;
	}

	/* ------------------------------------------------------------------ */
	/*  Données d'une page                                                 */
	/* ------------------------------------------------------------------ */

	public static function pagesList() {
		$pages = array();
		foreach (eqLogic::byType('tuiles') as $eqLogic) {
			if ($eqLogic->getIsEnable() != 1) {
				continue;
			}
			$layout = $eqLogic->getLayout();
			$pages[] = array(
				'id' => $eqLogic->getId(),
				'name' => $eqLogic->getName(),
				'icon' => isset($layout['grid']['icon']) ? $layout['grid']['icon'] : 'fas fa-th-large',
				'device' => self::deviceOf($layout),
				'navOrder' => isset($layout['grid']['navOrder']) && is_numeric($layout['grid']['navOrder']) ? floatval($layout['grid']['navOrder']) : 100,
				'navHide' => !empty($layout['grid']['navHide']),
				'navLabel' => isset($layout['grid']['navLabel']) ? (string) $layout['grid']['navLabel'] : '',
			);
		}
		usort($pages, function ($a, $b) {
			return strcasecmp($a['name'], $b['name']);
		});
		return $pages;
	}

	/**
	 * Barre d'onglets commune à toutes les pages : array('enabled', 'home', 'items' => [{id, label, icon, show}]).
	 * Première lecture : reprend l'ancien réglage par page (ordre, nom d'onglet, caché).
	 */
	public static function nav() {
		$raw = config::byKey('nav', 'tuiles', '');
		$nav = is_array($raw) ? $raw : json_decode((string) $raw, true);
		if (!is_array($nav)) {
			$pages = self::pagesList();
			$enabled = false;
			$home = false;
			foreach (eqLogic::byType('tuiles') as $eqLogic) {
				$g = $eqLogic->getLayout()['grid'];
				if (isset($g['nav']) && $g['nav'] == 'tabs') {
					$enabled = true;
				}
				if (!empty($g['navHome'])) {
					$home = true;
				}
			}
			usort($pages, function ($a, $b) {
				if ($a['navOrder'] != $b['navOrder']) {
					return $a['navOrder'] < $b['navOrder'] ? -1 : 1;
				}
				return strcasecmp($a['name'], $b['name']);
			});
			$items = array();
			foreach ($pages as $p) {
				$items[] = array('id' => (string) $p['id'], 'label' => $p['navLabel'], 'icon' => '', 'show' => !$p['navHide']);
			}
			$nav = array('enabled' => $enabled, 'home' => $home, 'items' => $items);
		}
		$nav['enabled'] = !empty($nav['enabled']);
		$nav['home'] = !empty($nav['home']);
		// appareils où la barre s'affiche (ancien réglage : tous)
		$dv = isset($nav['devices']) && is_array($nav['devices']) ? $nav['devices'] : null;
		$nav['devices'] = array();
		foreach (array('tablette', 'mobile') as $d) {
			$nav['devices'][$d] = $dv === null ? $nav['enabled'] : (!empty($dv[$d]) && $dv[$d] !== 'false');
		}
		$nav['enabled'] = in_array(true, $nav['devices'], true);
		$hp = isset($nav['homePages']) && is_array($nav['homePages']) ? $nav['homePages'] : array();
		$nav['homePages'] = array();
		foreach (array('tablette', 'mobile') as $d) {
			$nav['homePages'][$d] = isset($hp[$d]) ? self::cleanId($hp[$d]) : '';
		}
		$nav['size'] = isset($nav['size']) && is_numeric($nav['size']) ? max(50, min(400, intval($nav['size']))) : 100;
		$nav['homeLabel'] = isset($nav['homeLabel']) ? (string) $nav['homeLabel'] : '';
		$nav['homeIcon'] = isset($nav['homeIcon']) ? (string) $nav['homeIcon'] : '';
		$nav['items'] = isset($nav['items']) && is_array($nav['items']) ? array_values($nav['items']) : array();
		if (isset($nav['dev']) && !is_array($nav['dev'])) {
			unset($nav['dev']);
		}
		return $nav;
	}

	public static function saveNav($nav) {
		if (!is_array($nav)) {
			throw new Exception(__('Barre d\'onglets invalide', __FILE__));
		}
		$items = array();
		foreach ((isset($nav['items']) && is_array($nav['items']) ? $nav['items'] : array()) as $it) {
			$id = self::cleanId(isset($it['id']) ? $it['id'] : '');
			if ($id === '') {
				continue;
			}
			$items[] = array(
				'id' => $id,
				'label' => isset($it['label']) ? substr(trim((string) $it['label']), 0, 60) : '',
				'icon' => isset($it['icon']) ? substr(trim((string) $it['icon']), 0, 200) : '',
				'show' => !isset($it['show']) || ($it['show'] !== false && $it['show'] !== 'false' && $it['show'] !== '0' && $it['show'] !== 0),
			);
		}
		$clean = array(
			'enabled' => !empty($nav['enabled']) && $nav['enabled'] !== 'false',
			'home' => !empty($nav['home']) && $nav['home'] !== 'false',
			'items' => $items,
			'devices' => isset($nav['devices']) && is_array($nav['devices']) ? $nav['devices'] : array(),
			'homePages' => isset($nav['homePages']) && is_array($nav['homePages']) ? $nav['homePages'] : array(),
			'size' => isset($nav['size']) && is_numeric($nav['size']) ? max(50, min(400, intval($nav['size']))) : 100,
			'homeLabel' => isset($nav['homeLabel']) ? substr(trim((string) $nav['homeLabel']), 0, 40) : '',
			'homeIcon' => isset($nav['homeIcon']) ? substr(trim((string) $nav['homeIcon']), 0, 200) : '',
			'swipeHome' => !empty($nav['swipeHome']) && $nav['swipeHome'] !== 'false',
			'swipeDist' => isset($nav['swipeDist']) && is_numeric($nav['swipeDist']) ? max(30, min(600, intval($nav['swipeDist']))) : 100,
			'idleHome' => isset($nav['idleHome']) && is_numeric($nav['idleHome']) ? max(0, min(240, floatval($nav['idleHome']))) : 0,
			'dev' => array(),
		);
		// menu propre à chaque appareil (tablette / mobile)
		foreach (array('tablette', 'mobile') as $d) {
			if (!isset($nav['dev'][$d]) || !is_array($nav['dev'][$d])) {
				continue;
			}
			$c = $nav['dev'][$d];
			$dItems = array();
			foreach ((isset($c['items']) && is_array($c['items']) ? $c['items'] : array()) as $it) {
				$id = self::cleanId(isset($it['id']) ? $it['id'] : '');
				if ($id === '') {
					continue;
				}
				$dItems[] = array(
					'id' => $id,
					'label' => isset($it['label']) ? substr(trim((string) $it['label']), 0, 60) : '',
					'icon' => isset($it['icon']) ? substr(trim((string) $it['icon']), 0, 200) : '',
					'show' => !isset($it['show']) || ($it['show'] !== false && $it['show'] !== 'false' && $it['show'] !== '0' && $it['show'] !== 0),
				);
			}
			$clean['dev'][$d] = array(
				'size' => isset($c['size']) && is_numeric($c['size']) ? max(50, min(400, intval($c['size']))) : 100,
				'full' => !empty($c['full']) && $c['full'] !== 'false',
				'home' => !empty($c['home']) && $c['home'] !== 'false',
				'homeLabel' => isset($c['homeLabel']) ? substr(trim((string) $c['homeLabel']), 0, 40) : '',
				'homeIcon' => isset($c['homeIcon']) ? substr(trim((string) $c['homeIcon']), 0, 200) : '',
				'swipeHome' => !empty($c['swipeHome']) && $c['swipeHome'] !== 'false',
				'swipeDist' => isset($c['swipeDist']) && is_numeric($c['swipeDist']) ? max(30, min(600, intval($c['swipeDist']))) : 100,
				'idleHome' => isset($c['idleHome']) && is_numeric($c['idleHome']) ? max(0, min(240, floatval($c['idleHome']))) : 0,
				'veille' => isset($c['veille']) && is_numeric($c['veille']) ? max(0, min(240, floatval($c['veille']))) : 0,
				'veilleDate' => !empty($c['veilleDate']) && $c['veilleDate'] !== 'false',
				'veilleLogo' => isset($c['veilleLogo']) ? substr(trim((string) $c['veilleLogo']), 0, 300) : '',
				'veilleColor' => isset($c['veilleColor']) && preg_match('/^#[0-9a-fA-F]{3,8}$/', $c['veilleColor']) ? $c['veilleColor'] : '#8a8a8a',
				'veilleBg' => isset($c['veilleBg']) && preg_match('/^#[0-9a-fA-F]{3,8}$/', $c['veilleBg']) ? $c['veilleBg'] : '#000000',
				'veilleLum' => isset($c['veilleLum']) && is_numeric($c['veilleLum']) ? max(5, min(100, intval($c['veilleLum']))) : 100,
				'veilleSize' => isset($c['veilleSize']) && is_numeric($c['veilleSize']) ? max(40, min(200, intval($c['veilleSize']))) : 100,
				'homeZone' => isset($c['homeZone']) && in_array($c['homeZone'], array('tl', 'tr', 'bl', 'br'), true) ? $c['homeZone'] : '',
				'homeZoneSize' => isset($c['homeZoneSize']) && is_numeric($c['homeZoneSize']) ? max(30, min(200, intval($c['homeZoneSize']))) : 70,
				'homeZoneShow' => !empty($c['homeZoneShow']) && $c['homeZoneShow'] !== 'false',
				'items' => $dItems,
			);
		}
		if (!count($clean['dev'])) {
			unset($clean['dev']);
		}
		config::save('nav', json_encode($clean), 'tuiles');
		return self::nav();
	}

	/** Appareil d'une page : tablette ou mobile. */
	public static function deviceOf($layout) {
		$d = isset($layout['grid']['device']) ? $layout['grid']['device'] : 'tablette';
		return $d === 'mobile' ? 'mobile' : 'tablette';
	}

	/** Code de confirmation : vérifié ici, jamais envoyé aux pages. 3 erreurs = 30 s de blocage. */
	public static function checkPin($pin) {
		$code = preg_replace('/[^0-9]/', '', (string) config::byKey('pinCode', 'tuiles', ''));
		if ($code === '') {
			return array('ok' => false, 'nocode' => true);
		}
		$raw = cache::byKey('tuiles::pinFail')->getValue('');
		$st = is_array($raw) ? $raw : json_decode((string) $raw, true);
		if (!is_array($st)) {
			$st = array('n' => 0, 'until' => 0);
		}
		if ($st['until'] > time()) {
			return array('ok' => false, 'locked' => $st['until'] - time());
		}
		if (hash_equals($code, preg_replace('/[^0-9]/', '', (string) $pin))) {
			cache::set('tuiles::pinFail', json_encode(array('n' => 0, 'until' => 0)));
			return array('ok' => true);
		}
		$st['n'] = intval($st['n']) + 1;
		if ($st['n'] >= 3) {
			$st = array('n' => 0, 'until' => time() + 30);
			log::add('tuiles', 'warning', 'Code de confirmation : 3 erreurs, blocage 30 s');
		}
		cache::set('tuiles::pinFail', json_encode($st));
		return array('ok' => false, 'left' => $st['until'] > time() ? 0 : 3 - $st['n'], 'locked' => $st['until'] > time() ? $st['until'] - time() : 0);
	}

	public static function devices() {
		return array('tablette' => 'Tablette', 'mobile' => 'Mobile');
	}

	public static function homeId($mobile = false) {
		$homeId = '';
		if ($mobile) {
			$homeId = self::cleanId(config::byKey('homePageMobile', 'tuiles', ''));
		}
		if ($homeId === '') {
			$homeId = self::cleanId(config::byKey('homePage', 'tuiles', ''));
		}
		if ($homeId !== '') {
			$eqLogic = eqLogic::byId($homeId);
			if (!is_object($eqLogic) || $eqLogic->getEqType_name() != 'tuiles' || $eqLogic->getIsEnable() != 1) {
				$homeId = '';
			}
		}
		return $homeId;
	}

	public static function common($mobile = false) {
		return array(
			'presets' => self::presets(),
			'pages'   => self::pagesList(),
			'homeId'  => self::homeId($mobile),
			'homeUrl' => config::byKey('homeUrl', 'tuiles', ''),
			'pinLen'  => strlen(preg_replace('/[^0-9]/', '', (string) config::byKey('pinCode', 'tuiles', ''))),
			'poll'    => intval(config::byKey('pollFallback', 'tuiles', 0)),
			'nav'     => self::nav(),
			// position de la maison (configuration Jeedom) : tuile soleil
			'lat'     => config::byKey('info::latitude', 'core', ''),
			'lon'     => config::byKey('info::longitude', 'core', ''),
		);
	}

	public static function pageData($id, $forceIndex = false, $mobile = false) {
		$id = self::cleanId($id);
		if ($id === '' && !$forceIndex) {
			$id = self::homeId($mobile);
		}
		$data = self::common($mobile);
		if ($id === '' || $forceIndex) {
			$data['index'] = true;
			return $data;
		}
		$eqLogic = eqLogic::byId($id);
		if (!is_object($eqLogic) || $eqLogic->getEqType_name() != 'tuiles') {
			throw new Exception(__('Page introuvable : ', __FILE__) . $id);
		}
		if ($eqLogic->getIsEnable() != 1) {
			throw new Exception(__('Cette page est désactivée', __FILE__));
		}
		$layout = $eqLogic->getLayout();
		$data['id'] = $eqLogic->getId();
		$data['name'] = $eqLogic->getName();
		$data['device'] = self::deviceOf($layout);
		$data['layout'] = $layout;
		$cmds = self::cmdMetas(self::collectCmdIds(array($layout['tiles'], isset($layout['grid']['alerts']) ? $layout['grid']['alerts'] : array())));
		// infos liées aux actions (valeur de retour d'état), pour les sliders et selects
		$linked = array();
		foreach ($cmds as $meta) {
			if (!empty($meta['linked']) && !isset($cmds[$meta['linked']])) {
				$linked[] = $meta['linked'];
			}
		}
		if (count($linked) > 0) {
			$cmds = $cmds + self::cmdMetas($linked);
		}
		$data['cmds'] = $cmds;
		return $data;
	}

	/** Historique d'une info sur N heures (nombre de points réduit), avec min / max / moyenne : mini-courbe, carte puissance, fenêtre de détails. */
	/**
	 * Valeur de compteurs cumulés à minuit (début de journée), pour en déduire la consommation du jour.
	 * 1) dernière valeur historisée avant minuit (6 h avant) ; 2) sinon plus petite valeur depuis minuit ;
	 * 3) sinon première valeur vue aujourd'hui par le plugin (gardée en configuration).
	 */
	public static function dayStart($ids) {
		$midnight = strtotime('today');
		$day = date('Y-m-d', $midnight);
		$raw = config::byKey('dayBase', 'tuiles', '');
		$store = is_array($raw) ? $raw : json_decode((string) $raw, true);
		if (!is_array($store) || !isset($store['day']) || $store['day'] !== $day) {
			$store = array('day' => $day, 'v' => array());
		}
		$changed = false;
		$out = array();
		foreach ((array) $ids as $id) {
			$id = self::cleanId($id);
			if ($id === '') {
				continue;
			}
			$cmd = cmd::byId($id);
			if (!is_object($cmd) || $cmd->getType() != 'info') {
				continue;
			}
			$base = null;
			$src = '';
			try {
				$before = history::all($id, date('Y-m-d H:i:s', $midnight - 6 * 3600), date('Y-m-d H:i:s', $midnight));
				foreach ((array) $before as $h) {
					if (is_object($h) && is_numeric($h->getValue())) {
						$base = floatval($h->getValue());
						$src = 'historique';
					}
				}
				if ($base === null) {
					$after = history::all($id, date('Y-m-d H:i:s', $midnight), date('Y-m-d H:i:s'));
					foreach ((array) $after as $h) {
						if (is_object($h) && is_numeric($h->getValue())) {
							$v = floatval($h->getValue());
							$base = $base === null ? $v : min($base, $v);
							$src = 'historique';
						}
					}
				}
			} catch (Throwable $e) {
				$base = null;
			}
			if ($base === null) {
				if (!isset($store['v'][$id])) {
					$cur = $cmd->execCmd();
					if (is_numeric($cur)) {
						$store['v'][$id] = floatval($cur);
						$changed = true;
					}
				}
				if (isset($store['v'][$id])) {
					$base = floatval($store['v'][$id]);
					$src = 'premier relevé';
				}
			}
			$out[$id] = array('base' => $base, 'src' => $src);
		}
		if ($changed) {
			config::save('dayBase', json_encode($store), 'tuiles');
		}
		return array('day' => $day, 'cmds' => $out);
	}

	public static function historyData($id, $hours, $points = 120) {
		$id = self::cleanId($id);
		$hours = max(1, min(744, intval($hours)));
		$points = max(20, min(400, intval($points)));
		$out = array('id' => $id, 'hours' => $hours, 'points' => array(), 'min' => null, 'max' => null, 'avg' => null, 'historized' => false);
		$cmd = cmd::byId($id);
		if (!is_object($cmd) || $cmd->getType() != 'info') {
			return $out;
		}
		$out['historized'] = ($cmd->getIsHistorized() == 1);
		$end = time();
		$start = $end - $hours * 3600;
		$raw = array();
		try {
			$list = history::all($id, date('Y-m-d H:i:s', $start), date('Y-m-d H:i:s', $end));
		} catch (Exception $e) {
			$list = array();
		}
		foreach ((array) $list as $h) {
			if (!is_object($h)) {
				continue;
			}
			$v = $h->getValue();
			if (!is_numeric($v)) {
				continue;
			}
			$raw[] = array(strtotime($h->getDatetime()) * 1000, floatval($v));
		}
		if (count($raw) == 0) {
			return $out;
		}
		$sum = 0;
		$out['min'] = $raw[0][1];
		$out['max'] = $raw[0][1];
		foreach ($raw as $p) {
			$sum += $p[1];
			$out['min'] = min($out['min'], $p[1]);
			$out['max'] = max($out['max'], $p[1]);
		}
		$out['avg'] = round($sum / count($raw), 3);
		// réduction du nombre de points (moyenne par tranche)
		$n = $points;
		if (count($raw) > $n) {
			$step = ($end - $start) * 1000 / $n;
			$buckets = array();
			foreach ($raw as $p) {
				$b = min($n - 1, intval(($p[0] - $start * 1000) / $step));
				if (!isset($buckets[$b])) {
					$buckets[$b] = array(0, 0, 0);
				}
				$buckets[$b][0] += $p[0];
				$buckets[$b][1] += $p[1];
				$buckets[$b][2]++;
			}
			ksort($buckets);
			$raw = array();
			foreach ($buckets as $b) {
				$raw[] = array(round($b[0] / $b[2]), round($b[1] / $b[2], 3));
			}
		}
		$out['points'] = $raw;
		return $out;
	}

	/* ---------- Caméras Frigate ---------- */

	/**
	 * Adresse réelle d'une caméra, lue dans la configuration enregistrée de la page
	 * (jamais fournie par le navigateur : le proxy ne peut joindre que ce qu'un admin a configuré).
	 * Retourne array('url' => ..., 'stream' => bool) ou null.
	 */
	public static function camTarget($pageId, $tileId, $wantSnap = false) {
		$pageId = self::cleanId($pageId);
		$eqLogic = $pageId === '' ? null : eqLogic::byId($pageId);
		if (!is_object($eqLogic) || $eqLogic->getEqType_name() != 'tuiles') {
			return null;
		}
		$tile = null;
		foreach ($eqLogic->getLayout()['tiles'] as $t) {
			if (is_array($t) && isset($t['id']) && (string) $t['id'] === (string) $tileId) {
				$tile = $t;
				break;
			}
		}
		if ($tile === null || !isset($tile['type']) || !in_array($tile['type'], array('camera', 'interphone')) || empty($tile['camProxy'])) {
			return null;
		}
		$base = rtrim(isset($tile['frigateUrl']) ? trim($tile['frigateUrl']) : '', '/');
		$cam = rawurlencode(isset($tile['frigateCam']) ? trim($tile['frigateCam']) : '');
		if ($base === '' || $cam === '') {
			return null;
		}
		$h = isset($tile['frigateH']) && is_numeric($tile['frigateH']) ? intval($tile['frigateH']) : 720;
		$fps = isset($tile['frigateFps']) && is_numeric($tile['frigateFps']) ? intval($tile['frigateFps']) : 5;
		$mode = isset($tile['frigateMode']) ? $tile['frigateMode'] : 'mjpeg';
		$stream = false;
		if ($wantSnap || $mode == 'snapshot' || $mode == 'rapide' || $tile['type'] == 'interphone') {
			$url = $base . '/api/' . $cam . '/latest.jpg?h=' . $h;
		} else {
			$url = $base . '/api/' . $cam . '?fps=' . $fps . '&h=' . $h; // MJPEG (go2rtc relayé en MJPEG)
			$stream = true;
		}
		if (!preg_match('#^https?://#i', $url)) {
			return null;
		}
		return array('url' => $url, 'stream' => $stream);
	}

	/**
	 * État réel d'une caméra Frigate (interrogé par Jeedom, donc sans souci d'accès ni de CORS) :
	 * images par seconde reçues par Frigate pour cette caméra.
	 */
	public static function camStatus($pageId, $tileId) {
		$pageId = self::cleanId($pageId);
		$eqLogic = $pageId === '' ? null : eqLogic::byId($pageId);
		if (!is_object($eqLogic) || $eqLogic->getEqType_name() != 'tuiles') {
			return array('online' => null, 'reason' => 'page');
		}
		$tile = null;
		foreach ($eqLogic->getLayout()['tiles'] as $t) {
			if (is_array($t) && isset($t['id']) && (string) $t['id'] === (string) $tileId && isset($t['type']) && $t['type'] == 'camera') {
				$tile = $t;
				break;
			}
		}
		$base = rtrim(isset($tile['frigateUrl']) ? trim($tile['frigateUrl']) : '', '/');
		$cam = isset($tile['frigateCam']) ? trim($tile['frigateCam']) : '';
		if ($tile === null || $base === '' || $cam === '' || !preg_match('#^https?://#i', $base)) {
			return array('online' => null, 'reason' => 'config');
		}
		$ch = curl_init($base . '/api/stats');
		curl_setopt_array($ch, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 5, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0));
		$raw = curl_exec($ch);
		$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);
		if ($raw === false || $code != 200) {
			return array('online' => false, 'reason' => 'frigate', 'detail' => 'Frigate injoignable');
		}
		$stats = json_decode($raw, true);
		$cams = isset($stats['cameras']) && is_array($stats['cameras']) ? $stats['cameras'] : $stats;
		if (!is_array($cams) || !isset($cams[$cam]) || !is_array($cams[$cam])) {
			return array('online' => false, 'reason' => 'camera', 'detail' => 'Caméra inconnue de Frigate');
		}
		$fps = isset($cams[$cam]['camera_fps']) ? floatval($cams[$cam]['camera_fps']) : 0;
		return array('online' => $fps > 0.1, 'fps' => round($fps, 1), 'reason' => $fps > 0.1 ? '' : 'nofps', 'detail' => $fps > 0.1 ? '' : 'Aucune image reçue par Frigate');
	}

	/* ---------- Listes automatiques : batteries, réseau ---------- */

	/**
	 * Équipements à pile : niveau (statut « battery » remonté par les plugins), seuils Jeedom, date de remontée.
	 */
	public static function batteries() {
		$danger = intval(config::byKey('battery::danger', 'core', 20));
		$warning = intval(config::byKey('battery::warning', 'core', 30));
		$out = array();
		foreach (eqLogic::all() as $eq) {
			if (!is_object($eq) || $eq->getIsEnable() != 1) {
				continue;
			}
			$b = $eq->getStatus('battery', -2);
			if ($b === -2 || $b === '' || $b === null || !is_numeric($b)) {
				continue;
			}
			$obj = $eq->getObject();
			$out[] = array(
				'id' => $eq->getId(),
				'name' => $eq->getName(),
				'object' => is_object($obj) ? $obj->getName() : '',
				'level' => max(0, min(100, intval($b))),
				'date' => $eq->getStatus('batteryDatetime', ''),
				'type' => $eq->getConfiguration('battery_type', ''),
				'danger' => intval($eq->getConfiguration('battery_danger_threshold', $danger)),
				'warning' => intval($eq->getConfiguration('battery_warning_threshold', $warning)),
			);
		}
		usort($out, function ($a, $b) {
			return $a['level'] - $b['level'];
		});
		return $out;
	}

	/** Équipements du plugin Network (ping) : en ligne / hors ligne, depuis quand, latence, commandes ping et réveil (WOL). */
	public static function networks() {
		$out = array();
		if (!class_exists('networks')) {
			return array('installed' => false, 'items' => $out);
		}
		foreach (eqLogic::byType('networks') as $eq) {
			if ($eq->getIsEnable() != 1) {
				continue;
			}
			$st = $lat = $ref = $wol = null;
			foreach ($eq->getCmd() as $c) {
				$lid = strtolower($c->getLogicalId());
				$n = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $c->getName()));
				if ($c->getType() == 'info' && $st === null && ($lid == 'ping' || $n == 'statut' || $n == 'status' || $n == 'etat')) {
					$st = $c;
				} elseif ($c->getType() == 'info' && $lat === null && ($lid == 'latency' || strpos($n, 'latence') !== false)) {
					$lat = $c;
				} elseif ($c->getType() == 'action' && $lid == 'refresh') {
					$ref = $c;
				} elseif ($c->getType() == 'action' && ($lid == 'wol' || strpos($n, 'wake') !== false || strpos($n, 'reveil') !== false)) {
					$wol = $c;
				}
			}
			if (!is_object($st)) {
				continue;
			}
			$obj = $eq->getObject();
			$out[] = array(
				'id' => $eq->getId(),
				'name' => $eq->getName(),
				'object' => is_object($obj) ? $obj->getName() : '',
				'ip' => $eq->getConfiguration('ip', ''),
				'statusId' => $st->getId(),
				'status' => $st->execCmd(),
				'since' => $st->getValueDate(),
				'latencyId' => is_object($lat) ? $lat->getId() : '',
				'latency' => is_object($lat) ? $lat->execCmd() : '',
				'refreshId' => is_object($ref) ? $ref->getId() : '',
				'wolId' => is_object($wol) ? $wol->getId() : '',
			);
		}
		return array('installed' => true, 'items' => $out);
	}

	/* ---------- Démons et dépendances des plugins (fonctions du core) ---------- */

	public static function daemons() {
		$out = array();
		foreach (plugin::listPlugin(true) as $plugin) {
			$hasD = $plugin->getHasOwnDeamon() == 1;
			$hasDep = $plugin->getHasDependency() == 1;
			if (!$hasD && !$hasDep) {
				continue;
			}
			$row = array('id' => $plugin->getId(), 'name' => $plugin->getName(), 'icon' => $plugin->getPathImgIcon(),
				'hasDaemon' => $hasD, 'hasDep' => $hasDep, 'daemon' => '', 'auto' => null, 'launchable' => '', 'launchMsg' => '', 'dep' => '', 'depProgress' => '');
			if ($hasD) {
				try {
					$i = $plugin->deamon_info();
					$row['daemon'] = isset($i['state']) ? $i['state'] : '';
					$row['auto'] = isset($i['auto']) ? intval($i['auto']) : 1;
					$row['launchable'] = isset($i['launchable']) ? $i['launchable'] : '';
					$row['launchMsg'] = isset($i['launchable_message']) ? $i['launchable_message'] : '';
				} catch (Exception $e) {
					$row['daemon'] = 'error';
					$row['launchMsg'] = $e->getMessage();
				} catch (Error $e) {
					$row['daemon'] = 'error';
					$row['launchMsg'] = $e->getMessage();
				}
			}
			if ($hasDep) {
				try {
					$d = $plugin->dependancy_info();
					$row['dep'] = isset($d['state']) ? $d['state'] : '';
					if (!empty($d['progress_file']) && file_exists($d['progress_file'])) {
						$row['depProgress'] = trim(@file_get_contents($d['progress_file']));
					}
				} catch (Exception $e) {
					$row['dep'] = 'error';
				} catch (Error $e) {
					$row['dep'] = 'error';
				}
			}
			$out[] = $row;
		}
		return $out;
	}

	public static function daemonAction($id, $action) {
		$plugin = plugin::byId($id);
		if (!is_object($plugin)) {
			throw new Exception(__('Plugin introuvable', __FILE__));
		}
		switch ($action) {
			case 'start':
				$plugin->deamon_start(false);
				break;
			case 'restart':
				$plugin->deamon_start(true);
				break;
			case 'stop':
				$plugin->deamon_stop();
				break;
			case 'autoOn':
				$plugin->deamon_changeAutoMode(1);
				break;
			case 'autoOff':
				$plugin->deamon_changeAutoMode(0);
				break;
			case 'dep':
				$plugin->dependancy_install();
				break;
			default:
				throw new Exception(__('Action inconnue', __FILE__));
		}
		log::add('tuiles', 'info', 'Démons : ' . $action . ' sur ' . $id);
		return true;
	}

	/* ---------- Intégrations ---------- */

	/** HTML du widget dashboard d'un équipement (tuile « Widget Jeedom » / caméra). */
	/** Fin d'un log Jeedom (affiché dans la tuile Démons, sans quitter la page). */
	public static function logTail($name, $lines = 200) {
		$name = preg_replace('/[^A-Za-z0-9_.\-]/', '', (string) $name);
		$lines = max(20, min(1000, intval($lines)));
		if ($name === '' || $name[0] === '.' || strpos($name, '..') !== false) {
			throw new Exception(__('Log invalide', __FILE__));
		}
		$path = log::getPathToLog($name);
		if (!is_file($path)) {
			return array('name' => $name, 'exists' => false, 'lines' => array());
		}
		$out = array();
		$fp = @fopen($path, 'r');
		if ($fp) {
			// lecture de la fin du fichier seulement (les logs peuvent être gros)
			$size = filesize($path);
			$chunk = min($size, 256 * 1024);
			fseek($fp, -$chunk, SEEK_END);
			$data = fread($fp, $chunk);
			fclose($fp);
			$all = preg_split('/\r?\n/', rtrim((string) $data));
			if ($chunk < $size) {
				array_shift($all); // première ligne tronquée
			}
			$out = array_slice($all, -$lines);
		}
		return array('name' => $name, 'exists' => true, 'size' => filesize($path), 'lines' => $out);
	}

	public static function widgetHtml($id) {
		$eqLogic = eqLogic::byId(self::cleanId($id));
		if (!is_object($eqLogic)) {
			throw new Exception(__('Équipement introuvable : ', __FILE__) . $id);
		}
		if ($eqLogic->getIsEnable() != 1) {
			return array('id' => $eqLogic->getId(), 'name' => $eqLogic->getName(), 'html' => '', 'disabled' => true);
		}
		$html = '';
		try {
			$html = $eqLogic->toHtml('dashboard');
		} catch (Exception $e) {
			$html = '<div class="tl-err">' . $e->getMessage() . '</div>';
		}
		return array('id' => $eqLogic->getId(), 'name' => $eqLogic->getName(), 'plugin' => $eqLogic->getEqType_name(), 'html' => is_string($html) ? $html : '');
	}

	/* ---------- Plugin Réveils : planning sur plusieurs semaines ---------- */

	private static function reveilEq($id) {
		if (!class_exists('reveil')) {
			throw new Exception(__('Plugin Réveils non installé', __FILE__));
		}
		$eq = eqLogic::byId(self::cleanId($id));
		if (!is_object($eq) || $eq->getEqType_name() != 'reveil') {
			// id d'une commande du réveil (ex. « Prochain réveil ») : on remonte à son équipement
			$cmd = cmd::byId(self::cleanId($id));
			$eq = is_object($cmd) ? $cmd->getEqLogic() : null;
		}
		if (!is_object($eq) || $eq->getEqType_name() != 'reveil') {
			throw new Exception(__('Réveil introuvable', __FILE__));
		}
		return $eq;
	}

	/** Jours du planning (semaine en cours + suivantes) calculés par le plugin Réveils. */
	public static function reveilPlanning($id, $weeks = 4) {
		$eq = self::reveilEq($id);
		$weeks = max(1, min(8, intval($weeks)));
		$planning = method_exists($eq, 'getPlanning') ? $eq->getPlanning() : $eq->getConfiguration('planning', array());
		$monday = new DateTime('monday this week');
		$today = date('Y-m-d');
		$days = array();
		for ($i = 0; $i < $weeks * 7; $i++) {
			$d = clone $monday;
			$d->modify('+' . $i . ' day');
			$date = $d->format('Y-m-d');
			$r = method_exists('reveil', 'computeDay') ? reveil::computeDay($planning, $date) : array('time' => null, 'source' => '');
			$src = isset($r['source']) ? (string) $r['source'] : '';
			$child = (class_exists('reveilCalendar') && method_exists('reveilCalendar', 'custodyDay')) ? reveilCalendar::custodyDay($date) : null;
			$prof = '';
			if (preg_match('/jour\s*:\s*(.+)$/iu', $src, $m)) {
				$prof = trim($m[1]);
			}
			$days[] = array(
				'date' => $date,
				'week' => intval($d->format('W')),
				'dow' => intval($d->format('N')),
				'time' => isset($r['time']) ? $r['time'] : null,
				'source' => $src,
				'past' => $date < $today,
				'today' => $date == $today,
				'leave' => (bool) preg_match('/cong/iu', $src),
				'holiday' => (bool) preg_match('/f[ée]ri/iu', $src),
				'exception' => (bool) preg_match('/exception|absence/iu', $src),
				'child' => $child,
				'dayProfile' => $prof,
			);
		}
		$profiles = array();
		if (isset($planning['dayProfiles']) && is_array($planning['dayProfiles'])) {
			foreach ($planning['dayProfiles'] as $name => $time) {
				$profiles[] = array('name' => (string) $name, 'time' => is_array($time) ? '' : (string) $time);
			}
		}
		$next = self::reveilCmd($eq, array('next_wake', 'next'), '/prochain reveil/');
		$status = self::reveilCmd($eq, array('sync_status', 'status'), '/statut synchro/');
		$okc = self::reveilCmd($eq, array('sync_ok'), '/^synchro ok$/');
		return array(
			'id' => $eq->getId(), 'name' => $eq->getName(), 'days' => $days, 'dayProfiles' => $profiles,
			'next' => is_object($next) ? $next->execCmd() : '',
			'status' => is_object($status) ? $status->execCmd() : '',
			'syncOk' => is_object($okc) ? $okc->execCmd() : '',
			'custody' => class_exists('reveilCalendar') && method_exists('reveilCalendar', 'toggleCustodyDay'),
		);
	}

	/** Commande d'un réveil retrouvée par logicalId ou par nom. */
	private static function reveilCmd($eq, $logicalIds, $nameRe) {
		foreach ((array) $logicalIds as $lid) {
			$c = $eq->getCmd(null, $lid);
			if (is_object($c)) {
				return $c;
			}
		}
		foreach ($eq->getCmd() as $c) {
			$n = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $c->getName()));
			if (preg_match($nameRe, $n)) {
				return $c;
			}
		}
		return null;
	}

	/** Vérifier, resynchroniser, ou heure manuelle d'un jour (exception : HH:MM, off, vide = planning). */
	public static function reveilAction($id, $action, $date = '', $value = '') {
		$eq = self::reveilEq($id);
		if (!isConnect('admin') && !$eq->hasRight('w')) {
			throw new Exception(__('Vous n\'avez pas le droit de modifier ce réveil', __FILE__));
		}
		if ($action == 'verify') {
			$c = self::reveilCmd($eq, array('verify', 'verifier', 'check'), '/verifier/');
			if (!is_object($c)) {
				throw new Exception(__('Commande Vérifier introuvable (sauvegardez l\'équipement Réveils)', __FILE__));
			}
			$c->execCmd();
		} elseif ($action == 'resync') {
			$c = self::reveilCmd($eq, array('refresh', 'resync'), '/resynchronis/');
			if (!is_object($c)) {
				throw new Exception(__('Commande Resynchroniser introuvable', __FILE__));
			}
			$c->execCmd();
		} elseif ($action == 'exception') {
			if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date < date('Y-m-d')) {
				throw new Exception(__('Date invalide', __FILE__));
			}
			$value = trim((string) $value);
			if ($value !== '' && $value !== 'off' && !preg_match('/^\d{1,2}:\d{2}$/', $value)) {
				throw new Exception(__('Heure invalide', __FILE__));
			}
			if (method_exists($eq, 'setException')) {
				$eq->setException($date, $value);
				if (method_exists($eq, 'syncTargets')) {
					$eq->syncTargets();
				}
				$eq->refreshWidget();
			} else {
				$c = self::reveilCmd($eq, array('exception'), '/^exception/');
				if (!is_object($c)) {
					throw new Exception(__('Commande Exception introuvable', __FILE__));
				}
				$c->execCmd(array('title' => $date, 'message' => $value));
			}
		} else {
			throw new Exception(__('Action inconnue', __FILE__));
		}
		return self::reveilPlanning($id);
	}

	/** Bascule d'un jour : congé (global), garde (global) ou profil du jour (propre au réveil). */
	public static function reveilToggle($id, $mode, $date, $profile = '') {
		$eq = self::reveilEq($id);
		if (!isConnect('admin') && !$eq->hasRight('w')) {
			throw new Exception(__('Vous n\'avez pas le droit de modifier ce réveil', __FILE__));
		}
		if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date < date('Y-m-d')) {
			throw new Exception(__('Date invalide', __FILE__));
		}
		if ($mode == 'leave') {
			reveilCalendar::togglePersonalLeave($date);
		} elseif ($mode == 'child') {
			reveilCalendar::toggleCustodyDay($date);
		} elseif ($mode == 'profile') {
			$eq->toggleDayProfile($date, $profile);
		} else {
			throw new Exception(__('Mode inconnu', __FILE__));
		}
		// congés et garde concernent tous les réveils
		if ($mode != 'profile' && method_exists('reveil', 'resyncAll')) {
			reveil::resyncAll();
		} else {
			if (method_exists($eq, 'syncTargets')) {
				$eq->syncTargets();
			}
			$eq->refreshWidget();
		}
		return self::reveilPlanning($id);
	}

	/* ---------- Éditeur ---------- */

	/** Commandes d'un équipement (pour remplir une tuile automatiquement, ex. plugin Réveils). */
	public static function eqCmds($id) {
		$eq = eqLogic::byId(self::cleanId($id));
		if (!is_object($eq)) {
			return array();
		}
		$out = array();
		foreach ($eq->getCmd() as $cmd) {
			$out[] = array('id' => $cmd->getId(), 'name' => $cmd->getName(), 'logicalId' => $cmd->getLogicalId(), 'type' => $cmd->getType(), 'subType' => $cmd->getSubType(), 'generic' => $cmd->getGeneric_type(), 'value' => $cmd->getValue());
		}
		return array('id' => $eq->getId(), 'name' => $eq->getName(), 'logicalId' => $eq->getLogicalId(), 'plugin' => $eq->getEqType_name(), 'cmds' => $out);
	}

	/**
	 * Import JSON : noms lisibles -> id.
	 * « #[Objet][Équipement][Commande]# » -> id de commande, « #[Objet][Équipement]# » -> id d'équipement.
	 */
	public static function resolveRefs($refs) {
		$out = array();
		foreach ((array) $refs as $ref) {
			$ref = trim((string) $ref);
			if (!preg_match_all('/\[([^\]]*)\]/', $ref, $m) || count($m[1]) < 2) {
				$out[$ref] = '';
				continue;
			}
			$parts = $m[1];
			$id = '';
			try {
				if (count($parts) >= 3) {
					$cmd = cmd::byId(str_replace('#', '', cmd::humanReadableToCmd('#[' . $parts[0] . '][' . $parts[1] . '][' . $parts[2] . ']#')));
					if (is_object($cmd)) {
						$id = (string) $cmd->getId();
					}
				} else {
					$objName = $parts[0] === '' || strtolower($parts[0]) === 'aucun' ? __('Aucun', __FILE__) : $parts[0];
					$eqs = eqLogic::byObjectNameEqLogicName($objName, $parts[1]);
					if (is_object($eqs)) {
						$id = (string) $eqs->getId();
					} elseif (is_array($eqs)) {
						$eq = reset($eqs);
						if (is_object($eq)) {
							$id = (string) $eq->getId();
						}
					}
				}
			} catch (Throwable $e) {
				$id = '';
			}
			$out[$ref] = $id;
		}
		return $out;
	}

	/** Liste des équipements (sélecteur de l'éditeur). */
	public static function eqList() {
		$list = array();
		foreach (eqLogic::all() as $eqLogic) {
			if ($eqLogic->getEqType_name() == 'tuiles') {
				continue;
			}
			$object = $eqLogic->getObject();
			$list[] = array(
				'id' => $eqLogic->getId(),
				'name' => $eqLogic->getName(),
				'object' => is_object($object) ? $object->getName() : '',
				'plugin' => $eqLogic->getEqType_name(),
				'enable' => $eqLogic->getIsEnable() == 1,
			);
		}
		usort($list, function ($a, $b) {
			return strcasecmp($a['object'] . ' ' . $a['name'], $b['object'] . ' ' . $b['name']);
		});
		return $list;
	}

	/** Liste de commandes info pour un compteur (badge d'une tuile Lien). */
	public static function countList($kind) {
		$types = array(
			'ouvrants' => array('OPENING', 'OPENING_WINDOW'),
			'lumieres' => array('LIGHT_STATE', 'LIGHT_STATE_BOOL'),
			'prises'   => array('ENERGY_STATE'),
			'volets'   => array('FLAP_STATE', 'FLAP_BSO_STATE'),
		);
		if (!isset($types[$kind])) {
			throw new Exception(__('Type inconnu : ', __FILE__) . $kind);
		}
		$ids = array();
		foreach (eqLogic::all() as $eqLogic) {
			if ($eqLogic->getIsEnable() != 1) {
				continue;
			}
			foreach ($eqLogic->getCmd('info') as $cmd) {
				if (in_array((string) $cmd->getGeneric_type(), $types[$kind])) {
					$ids[] = $cmd->getId();
				}
			}
		}
		return array('ids' => $ids, 'cmds' => self::cmdMetas($ids));
	}

	/* ------------------------------------------------------------------ */
	/*  Cycle de vie de l'équipement                                       */
	/* ------------------------------------------------------------------ */

	/* ------------------------------------------------------------------ */
	/*  Sauvegarde : tout exporter / tout importer                         */
	/* ------------------------------------------------------------------ */

	/** Réglages du plugin repris dans la sauvegarde.
	 *  (méthode et non propriété : Jeedom enregistre toutes les propriétés de la classe comme colonnes de la table eqLogic) */
	public static function backupKeys() {
		return array('nav', 'presets', 'homePage', 'homePageMobile', 'homeUrl', 'pollFallback');
	}

	/** Toutes les pages (nom, objet, actif, mise en page) + barre d'onglets, couleurs et réglages. */
	public static function exportAll() {
		$pages = array();
		foreach (eqLogic::byType('tuiles') as $eq) {
			$objName = '';
			try {
				$obj = $eq->getObject();
				if (is_object($obj)) {
					$objName = $obj->getName();
				}
			} catch (Throwable $e) {
				$objName = '';
			}
			$pages[] = array(
				'id' => (string) $eq->getId(),
				'name' => $eq->getName(),
				'object' => $objName,
				'isEnable' => intval($eq->getIsEnable()),
				'layout' => $eq->getLayout(),
			);
		}
		$config = array();
		foreach (self::backupKeys() as $k) {
			$v = config::byKey($k, 'tuiles', '');
			if (is_string($v) && $v !== '' && ($v[0] === '{' || $v[0] === '[')) {
				$d = json_decode($v, true);
				if (is_array($d)) {
					$v = $d;
				}
			}
			$config[$k] = $v;
		}
		return array(
			'tuilesBackup' => 1,
			'date' => date('Y-m-d H:i:s'),
			'pages' => $pages,
			'config' => $config,
		);
	}

	/** Remplace les numéros de pages (anciens → nouveaux) partout où une page est désignée. */
	public static function remapPages($node, $map) {
		if (!is_array($node)) {
			return $node;
		}
		foreach ($node as $k => $v) {
			if (is_array($v)) {
				$node[$k] = self::remapPages($v, $map);
			} elseif (in_array((string) $k, array('page', 'aPage', 'bPage', 'homePage', 'homePageMobile'), true) && isset($map[(string) $v])) {
				$node[$k] = $map[(string) $v];
			}
		}
		return $node;
	}

	/**
	 * Recrée les pages d'une sauvegarde. Une page qui existe déjà (même nom, même appareil) est mise à jour,
	 * sinon elle est créée. Les liens entre pages et la barre d'onglets suivent les nouveaux numéros.
	 */
	public static function importAll($data, $withConfig = true) {
		if (!is_array($data) || empty($data['tuilesBackup']) || !isset($data['pages']) || !is_array($data['pages'])) {
			throw new Exception(__('Ce fichier n\'est pas une sauvegarde Tuiles', __FILE__));
		}
		$existing = array();
		foreach (eqLogic::byType('tuiles') as $eq) {
			$existing[mb_strtolower($eq->getName()) . '|' . self::deviceOf($eq->getLayout())] = $eq;
		}
		$map = array();
		$todo = array();
		$created = 0;
		$updated = 0;
		// 1) créer / retrouver chaque page pour connaître son nouveau numéro
		foreach ($data['pages'] as $pg) {
			if (!is_array($pg) || !isset($pg['name']) || trim((string) $pg['name']) === '') {
				continue;
			}
			$layout = isset($pg['layout']) && is_array($pg['layout']) ? $pg['layout'] : self::defaultLayout();
			$key = mb_strtolower(trim((string) $pg['name'])) . '|' . self::deviceOf($layout);
			if (isset($existing[$key])) {
				$eq = $existing[$key];
				$updated++;
			} else {
				$eq = new tuiles();
				$eq->setEqType_name('tuiles');
				$eq->setName(trim((string) $pg['name']));
				$eq->setIsEnable(isset($pg['isEnable']) ? intval($pg['isEnable']) : 1);
				if (!empty($pg['object'])) {
					foreach (jeeObject::all() as $o) {
						if ($o->getName() == $pg['object']) {
							$eq->setObject_id($o->getId());
							break;
						}
					}
				}
				$eq->setConfiguration('layout', json_encode(self::defaultLayout(), JSON_UNESCAPED_UNICODE));
				$eq->save();
				$existing[$key] = $eq;
				$created++;
			}
			if (isset($pg['id'])) {
				$map[(string) $pg['id']] = (string) $eq->getId();
			}
			$todo[] = array($eq, $layout);
		}
		// 2) enregistrer les mises en page avec les liens corrigés
		foreach ($todo as $t) {
			$t[0]->setConfiguration('layout', json_encode(self::remapPages($t[1], $map), JSON_UNESCAPED_UNICODE));
			$t[0]->save();
		}
		// 3) barre d'onglets, couleurs, réglages
		if ($withConfig && isset($data['config']) && is_array($data['config'])) {
			foreach (self::backupKeys() as $k) {
				if (!array_key_exists($k, $data['config'])) {
					continue;
				}
				$v = $data['config'][$k];
				if ($k === 'nav' && is_array($v)) {
					foreach (array('items') as $ik) {
						if (isset($v[$ik]) && is_array($v[$ik])) {
							foreach ($v[$ik] as $i => $it) {
								if (isset($it['id']) && isset($map[(string) $it['id']])) {
									$v[$ik][$i]['id'] = $map[(string) $it['id']];
								}
							}
						}
					}
					if (isset($v['dev']) && is_array($v['dev'])) {
						foreach ($v['dev'] as $d => $c) {
							if (isset($c['items']) && is_array($c['items'])) {
								foreach ($c['items'] as $i => $it) {
									if (isset($it['id']) && isset($map[(string) $it['id']])) {
										$v['dev'][$d]['items'][$i]['id'] = $map[(string) $it['id']];
									}
								}
							}
						}
					}
					if (isset($v['homePages']) && is_array($v['homePages'])) {
						foreach ($v['homePages'] as $d => $id) {
							if (isset($map[(string) $id])) {
								$v['homePages'][$d] = $map[(string) $id];
							}
						}
					}
				}
				if (($k === 'homePage' || $k === 'homePageMobile') && isset($map[(string) $v])) {
					$v = $map[(string) $v];
				}
				config::save($k, is_array($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : $v, 'tuiles');
			}
		}
		return array('created' => $created, 'updated' => $updated, 'pages' => count($todo));
	}

	public function preInsert() {
		$this->setIsVisible(0);
		$this->setIsEnable(1);
		if ($this->getConfiguration('layout', '') == '') {
			$this->setConfiguration('layout', json_encode(self::defaultLayout(), JSON_UNESCAPED_UNICODE));
		}
	}

	public function preSave() {
		// Une page n'apparaît jamais sur le dashboard
		$this->setIsVisible(0);
		$layout = $this->getConfiguration('layout', '');
		if (is_array($layout)) {
			$this->setConfiguration('layout', json_encode($layout, JSON_UNESCAPED_UNICODE));
		}
	}

	public function toHtml($_version = 'dashboard') {
		return '';
	}
}

class tuilesCmd extends cmd {
	public function execute($_options = array()) {
	}
}
