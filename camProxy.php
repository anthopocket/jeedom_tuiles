<?php
/*
 * Relais caméra : le serveur Jeedom va chercher l'image (ou le flux MJPEG) sur le réseau local
 * et la renvoie au navigateur. Permet de voir les caméras à distance sans rien ouvrir d'autre
 * que l'accès à Jeedom. L'adresse n'est jamais transmise par le navigateur : elle est lue
 * dans la configuration de la tuile (page + tuile), donc seules les caméras configurées
 * par un administrateur sont joignables.
 */
require_once __DIR__ . '/../../../../core/php/core.inc.php';
require_once __DIR__ . '/../class/tuiles.class.php';
include_file('core', 'authentification', 'php');

if (!isConnect()) {
	http_response_code(401);
	exit('401');
}
$target = tuiles::camTarget(init('page'), init('tile'), init('snap', 0) == 1);
// libère la session : sinon le flux bloque toutes les autres requêtes Jeedom de l'utilisateur
if (session_status() == PHP_SESSION_ACTIVE) {
	session_write_close();
}
if (!is_array($target)) {
	http_response_code(404);
	exit('Caméra non configurée pour le relais');
}

$stream = $target['stream'];
$maxTime = $stream ? 60 : 10; // un flux est coupé au bout de 60 s (relancé d'un appui) pour ne pas occuper PHP
@set_time_limit($maxTime + 10);
@ignore_user_abort(false);
while (ob_get_level() > 0) {
	ob_end_clean();
}
// pas de compression ni de tampon : sinon un flux MJPEG reste figé sur la première image
@ini_set('zlib.output_compression', '0');
@ini_set('output_buffering', '0');
@ini_set('implicit_flush', '1');
if (function_exists('apache_setenv')) {
	@apache_setenv('no-gzip', '1');
	@apache_setenv('dont-vary', '1');
}

$ch = curl_init($target['url']);
$sentHeaders = false;
$status = 0;
curl_setopt_array($ch, array(
	CURLOPT_CONNECTTIMEOUT => 5,
	CURLOPT_TIMEOUT => $maxTime,
	CURLOPT_FOLLOWLOCATION => true,
	CURLOPT_MAXREDIRS => 3,
	CURLOPT_SSL_VERIFYPEER => false, // caméras locales souvent en certificat auto-signé
	CURLOPT_SSL_VERIFYHOST => 0,
	CURLOPT_HTTPAUTH => CURLAUTH_ANY, // http://user:mdp@ip/... (basic ou digest)
	CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$status) {
		if (preg_match('#^HTTP/\S+\s+(\d+)#', $line, $m)) {
			$status = intval($m[1]);
		} elseif ($status >= 200 && $status < 300 && preg_match('#^Content-Type:\s*(.+)$#i', trim($line), $m)) {
			$type = trim($m[1]);
			if (preg_match('#^(image/|multipart/x-mixed-replace)#i', $type)) {
				header('Content-Type: ' . $type);
			}
		}
		return strlen($line);
	},
	CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$sentHeaders, &$status) {
		if ($status < 200 || $status >= 300) {
			return -1;
		}
		if (!$sentHeaders) {
			header('Cache-Control: no-store, no-cache, must-revalidate');
			header('X-Accel-Buffering: no'); // nginx : ne pas mettre le flux en tampon
			$sentHeaders = true;
		}
		echo $data;
		flush();
		return connection_aborted() ? -1 : strlen($data);
	},
));
curl_exec($ch);
curl_close($ch);
if (!$sentHeaders) {
	http_response_code(502);
	echo 'Caméra injoignable depuis Jeedom';
}
