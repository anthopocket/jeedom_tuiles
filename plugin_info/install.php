<?php
require_once __DIR__ . '/../../../core/php/core.inc.php';

function tuiles_install() {
	tuiles_initConfig();
}

function tuiles_update() {
	tuiles_initConfig();
}

function tuiles_remove() {
}

function tuiles_initConfig() {
	require_once __DIR__ . '/../core/class/tuiles.class.php';

}
