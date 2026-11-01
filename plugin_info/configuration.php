<?php
require_once __DIR__ . '/../../../core/php/core.inc.php';
require_once __DIR__ . '/../core/class/tuiles.class.php';
include_file('core', 'authentification', 'php');
if (!isConnect()) {
	include_file('desktop', '404', 'php');
	die();
}
?>
<form class="form-horizontal">
	<fieldset>
		<legend><i class="fas fa-home"></i> {{Navigation}}</legend>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Page d'accueil}}
				<sup><i class="fas fa-question-circle tooltips" title="{{Page ouverte par le panel et par les tuiles Lien « Accueil ». Vide = liste de toutes les pages.}}"></i></sup>
			</label>
			<div class="col-md-4">
				<select class="configKey form-control" data-l1key="homePage">
					<option value="">{{Liste des pages}}</option>
					<?php
					foreach (eqLogic::byType('tuiles') as $eqLogic) {
						echo '<option value="' . $eqLogic->getId() . '">' . $eqLogic->getName() . '</option>';
					}
					?>
				</select>
			</div>
		</div>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Page d'accueil mobile}}
				<sup><i class="fas fa-question-circle tooltips" title="{{Page ouverte par le panel de l'interface mobile. Vide = même page d'accueil que sur tablette.}}"></i></sup>
			</label>
			<div class="col-md-4">
				<select class="configKey form-control" data-l1key="homePageMobile">
					<option value="">{{Comme sur tablette}}</option>
					<?php
					foreach (eqLogic::byType('tuiles') as $eqLogic) {
						echo '<option value="' . $eqLogic->getId() . '">' . $eqLogic->getName() . ' (' . tuiles::devices()[tuiles::deviceOf($eqLogic->getLayout())] . ')</option>';
					}
					?>
				</select>
			</div>
		</div>
		<div class="form-group">
			<label class="col-md-4 control-label">{{URL Accueil externe (optionnel)}}
				<sup><i class="fas fa-question-circle tooltips" title="{{Si renseignée, les tuiles Lien « Accueil » ouvrent cette URL (ex. index.php?v=d&p=plan&plan_id=1) au lieu de la page d'accueil du plugin.}}"></i></sup>
			</label>
			<div class="col-md-4">
				<input class="configKey form-control" data-l1key="homeUrl" placeholder="index.php?v=d&p=plan&plan_id=1"/>
			</div>
		</div>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Code de confirmation}}
				<sup><i class="fas fa-question-circle tooltips" title="{{Chiffres uniquement (4 à 8). Demandé par les tuiles réglées sur « Code de confirmation ». Vérifié par Jeedom : il n'apparaît pas dans les pages. 3 erreurs = blocage 30 s.}}"></i></sup>
			</label>
			<div class="col-md-2">
				<input type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]*" maxlength="8" class="configKey form-control" data-l1key="pinCode" placeholder="ex. 1234"/>
			</div>
		</div>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Rafraîchissement de secours (s)}}
				<sup><i class="fas fa-question-circle tooltips" title="{{0 = désactivé (recommandé). Les valeurs arrivent en direct par le core. À n'activer que si une interface ne reçoit pas les événements.}}"></i></sup>
			</label>
			<div class="col-md-2">
				<input type="number" min="0" class="configKey form-control" data-l1key="pollFallback" placeholder="0"/>
			</div>
		</div>

	</fieldset>
</form>
