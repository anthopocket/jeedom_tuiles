<?php
if (!isConnect()) {
	throw new Exception('{{401 - Accès non autorisé}}');
}
sendVarToJS('tuilesPanel', array(
	'pageId' => init('page_id', ''),
	'kiosk'  => init('kiosk', 0) == 1,
));
?>
<div id="tl-panel-root" class="tl-root"></div>
<?php
include_file('desktop', 'tuiles', 'css', 'tuiles');
include_file('desktop', 'tuiles.engine', 'js', 'tuiles');
include_file('desktop', 'panel', 'js', 'tuiles');
?>
