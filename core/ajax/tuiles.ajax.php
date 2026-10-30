<?php
try {
	require_once __DIR__ . '/../../../../core/php/core.inc.php';
	require_once __DIR__ . '/../class/tuiles.class.php';
	include_file('core', 'authentification', 'php');

	if (!isConnect()) {
		throw new Exception(__('401 - Accès non autorisé', __FILE__));
	}

	ajax::init();

	$action = init('action');
	$needAdmin = array('logTail', 'daemonAction', 'eqCmds', 'saveNav', 'resolveHuman', 'countList', 'eqList', 'editorInit', 'getCmds');
	if (in_array($action, $needAdmin) && !isConnect('admin')) {
		throw new Exception(__('401 - Accès non autorisé', __FILE__));
	}

	$jsonArg = function ($name) {
		$value = init($name, '[]');
		$decoded = is_array($value) ? $value : json_decode($value, true);
		return is_array($decoded) ? $decoded : array();
	};

	switch ($action) {
		case 'getPage':
			ajax::success(tuiles::pageData(init('id'), init('index', 0) == 1, init('mobile', 0) == 1));
			break;

		case 'getHistory':
			ajax::success(tuiles::historyData(init('id'), init('hours', 24), init('points', 120)));
			break;

		case 'widgetHtml':
			ajax::success(tuiles::widgetHtml(init('id')));
			break;

		case 'saveNav':
			ajax::success(tuiles::saveNav($jsonArg('nav')));
			break;

		case 'getDaemons':
			ajax::success(tuiles::daemons());
			break;

		case 'daemonAction':
			ajax::success(tuiles::daemonAction(init('plugin'), init('do')));
			break;

		case 'logTail':
			ajax::success(tuiles::logTail(init('log'), init('lines', 200)));
			break;

		case 'camStatus':
			ajax::success(tuiles::camStatus(init('page'), init('tile')));
			break;

		case 'getNetworks':
			ajax::success(tuiles::networks());
			break;

		case 'getBatteries':
			ajax::success(tuiles::batteries());
			break;

		case 'reveilPlanning':
			ajax::success(tuiles::reveilPlanning(init('id'), init('weeks', 4)));
			break;

		case 'reveilToggle':
			ajax::success(tuiles::reveilToggle(init('id'), init('mode'), init('date'), init('profile')));
			break;

		case 'reveilAction':
			ajax::success(tuiles::reveilAction(init('id'), init('do'), init('date'), init('value')));
			break;

		case 'eqCmds':
			ajax::success(tuiles::eqCmds(init('id')));
			break;

		case 'eqList':
			ajax::success(tuiles::eqList());
			break;

		case 'refreshMetas':
			// relecture des métadonnées (plage des sliders, liste des selects) : pour tout utilisateur connecté
			ajax::success(tuiles::cmdMetas($jsonArg('ids')));
			break;

		case 'getValues':
			ajax::success(tuiles::cmdValues($jsonArg('ids')));
			break;

		case 'getCmds':
			ajax::success(tuiles::cmdMetas($jsonArg('ids')));
			break;

		case 'editorInit':
			$objects = array();
			foreach (jeeObject::all() as $object) {
				$objects[] = array('id' => $object->getId(), 'name' => $object->getName());
			}
			$data = tuiles::common();
			$data['objects'] = $objects;
			ajax::success($data);
			break;

		case 'resolveHuman':
			$cmd = cmd::byId(str_replace('#', '', cmd::humanReadableToCmd(init('human'))));
			ajax::success(is_object($cmd) ? $cmd->getId() : '');
			break;

		case 'countList':
			ajax::success(tuiles::countList(init('kind')));
			break;
	}

	throw new Exception(__('Aucune méthode correspondante à : ', __FILE__) . $action);
} catch (Exception $e) {
	ajax::error(displayException($e), $e->getCode());
}
