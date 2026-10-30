<?php
if (!isConnect('admin')) {
	throw new Exception('{{401 - Accès non autorisé}}');
}
$plugin = plugin::byId('tuiles');
sendVarToJS('eqType', $plugin->getId());
$eqLogics = eqLogic::byType($plugin->getId());
?>

<div class="row row-overflow">
	<!-- Liste des pages -->
	<div class="col-xs-12 eqLogicThumbnailDisplay">
		<legend><i class="fas fa-cog"></i> {{Gestion}}</legend>
		<div class="eqLogicThumbnailContainer">
			<div class="cursor eqLogicAction logoPrimary" data-action="add">
				<i class="fas fa-plus-circle"></i>
				<br>
				<span>{{Ajouter une page}}</span>
			</div>
			<div class="cursor eqLogicAction logoSecondary" data-action="gotoPluginConf">
				<i class="fas fa-wrench"></i>
				<br>
				<span>{{Configuration}}</span>
			</div>
			<div class="cursor logoSecondary" id="bt_tlNav">
				<i class="fas fa-grip-lines"></i>
				<br>
				<span>{{Barre d'onglets}}</span>
			</div>
			<div class="cursor logoSecondary" id="bt_tlOpenPanel">
				<i class="fas fa-th-large"></i>
				<br>
				<span>{{Ouvrir le panel}}</span>
			</div>
		</div>
		<legend><i class="fas fa-th"></i> {{Mes pages}}</legend>
		<?php if (count($eqLogics) == 0) { ?>
			<div class="text-center" style="font-size:1.2em;font-weight:bold;">{{Aucune page. Cliquez sur « Ajouter une page » pour commencer.}}</div>
		<?php } else { ?>
			<div class="input-group" style="margin:5px;">
				<input class="form-control roundedLeft" placeholder="{{Rechercher}}" id="in_searchEqlogic">
				<div class="input-group-btn">
					<a id="bt_resetSearch" class="btn roundedRight" style="width:30px"><i class="fas fa-times"></i></a>
				</div>
			</div>
			<?php
			$groups = array('tablette' => array(), 'mobile' => array());
			foreach ($eqLogics as $eqLogic) {
				$groups[tuiles::deviceOf($eqLogic->getLayout())][] = $eqLogic;
			}
			$groupIcons = array('tablette' => 'fas fa-tablet-alt', 'mobile' => 'fas fa-mobile-alt');
			foreach (tuiles::devices() as $device => $label) {
				if (count($groups[$device]) == 0) {
					continue; // appareil sans page : pas de ligne vide
				}
				echo '<div class="tl-devgroup" data-device="' . $device . '">';
				echo '<legend class="tl-devlegend"><i class="' . $groupIcons[$device] . '"></i> ' . $label . ' <span class="tl-devcount">(' . count($groups[$device]) . ')</span></legend>';
				if (count($groups[$device]) == 0) {
					echo '<div class="tl-devempty">{{Aucune page pour cet appareil. Choisissez l\'appareil dans la ligne Design de l\'éditeur.}}</div>';
				} else {
					echo '<div class="eqLogicThumbnailContainer">';
					foreach ($groups[$device] as $eqLogic) {
						$opacity = ($eqLogic->getIsEnable()) ? '' : 'disableCard';
						echo '<div class="eqLogicDisplayCard cursor ' . $opacity . '" data-eqLogic_id="' . $eqLogic->getId() . '">';
						echo '<img src="' . $plugin->getPathImgIcon() . '">';
						echo '<br>';
						echo '<span class="name">' . $eqLogic->getHumanName(true, true) . '</span>';
						echo '</div>';
					}
					echo '</div>';
				}
				echo '</div>';
			}
			?>
		<?php } ?>
	</div>

	<!-- Édition d'une page -->
	<div class="col-xs-12 eqLogic" style="display:none;">
		<div class="input-group pull-right" style="display:inline-flex;">
			<span class="input-group-btn">
				<a class="btn btn-sm btn-default roundedLeft" id="bt_tlOpenPage"><i class="fas fa-external-link-alt"></i><span class="hidden-xs"> {{Ouvrir la page}}</span></a>
				<a class="btn btn-sm btn-default eqLogicAction" data-action="copy"><i class="fas fa-copy"></i><span class="hidden-xs"> {{Dupliquer}}</span></a>
				<a class="btn btn-sm btn-success eqLogicAction" data-action="save"><i class="fas fa-check-circle"></i> {{Sauvegarder}}</a>
				<a class="btn btn-sm btn-danger eqLogicAction roundedRight" data-action="remove"><i class="fas fa-minus-circle"></i> {{Supprimer}}</a>
			</span>
		</div>
		<ul class="nav nav-tabs" role="tablist">
			<li role="presentation"><a href="#" class="eqLogicAction" aria-controls="home" role="tab" data-toggle="tab" data-action="returnToThumbnailDisplay"><i class="fas fa-arrow-circle-left"></i></a></li>
			<li role="presentation" class="active"><a href="#tl_tabPage" aria-controls="home" role="tab" data-toggle="tab"><i class="fas fa-th"></i> {{Page}}</a></li>
			<li role="presentation"><a href="#eqlogictab" aria-controls="home" role="tab" data-toggle="tab"><i class="fas fa-tachometer-alt"></i> {{Réglages}}</a></li>
		</ul>
		<div class="tab-content">
			<!-- Éditeur -->
			<div role="tabpanel" class="tab-pane active" id="tl_tabPage">
				<div class="tl-ed">
					<div class="tl-ed-bar">
						<div class="tl-ed-group">
							<a class="btn btn-sm btn-success" id="bt_tlAddTile" title="{{Ajoute une tuile : choisissez ensuite son nom, sa fonction et sa taille}}"><i class="fas fa-plus"></i> {{Ajouter une tuile}}</a>
							<a class="btn btn-sm btn-default" id="bt_tlAddRow" title="{{Commence une nouvelle rangée, avec un espace réglable au-dessus}}"><i class="fas fa-grip-lines"></i> {{Nouvelle rangée}}</a>
						</div>
						<div class="tl-ed-group">
							<a class="btn btn-sm btn-default" id="bt_tlMoveLeft" title="{{Déplacer avant}}"><i class="fas fa-arrow-left"></i></a>
							<a class="btn btn-sm btn-default" id="bt_tlMoveRight" title="{{Déplacer après}}"><i class="fas fa-arrow-right"></i></a>
							<a class="btn btn-sm btn-default" id="bt_tlDuplicate" title="{{Dupliquer la tuile}}"><i class="fas fa-clone"></i></a>
							<a class="btn btn-sm btn-danger" id="bt_tlDelete" title="{{Supprimer la tuile}}"><i class="fas fa-trash"></i></a>
						</div>
						<div class="tl-ed-group">
							<a class="btn btn-sm btn-default" id="bt_tlPageConf" title="{{Design, style, tailles des textes et alertes de la page}}"><i class="fas fa-sliders-h"></i> {{Réglages de la page}}</a>
							<label class="tl-ed-inline"><input type="checkbox" id="cb_tlMobile"> {{Aperçu mobile}}</label>
							<a class="btn btn-sm btn-default" id="bt_tlJson" title="{{Exporter / importer la page en JSON}}"><i class="fas fa-code"></i> JSON</a>
						</div>
					</div>
					<div class="tl-ed-grid" id="div_tlGridConf"></div>
					<div class="tl-ed-main">
						<div class="tl-ed-preview" id="div_tlPreviewWrap">
							<div id="div_tlPreview" class="tl-root"></div>
						</div>
						<div class="tl-ed-props" id="div_tlProps"></div>
					</div>
					<div class="tl-ed-help">
						<i class="fas fa-info-circle"></i>
						{{Cliquez sur une tuile pour la régler, glissez-la où vous voulez pour la placer librement (bouton « auto » pour revenir au placement automatique). L'aperçu est en direct, les actions n'y sont pas envoyées. Pensez à sauvegarder.}}
						<span class="pull-right">Tuiles v<span id="span_tlVersion"></span></span>
					</div>
				</div>
			</div>

			<!-- Réglages de l'équipement -->
			<div role="tabpanel" class="tab-pane" id="eqlogictab">
				<br>
				<form class="form-horizontal">
					<fieldset>
						<div class="form-group">
							<label class="col-sm-3 control-label">{{Nom de la page}}</label>
							<div class="col-sm-4">
								<input type="text" class="eqLogicAttr form-control" data-l1key="id" style="display:none;">
								<input type="text" class="eqLogicAttr form-control" data-l1key="name" placeholder="{{Nom de la page}}">
							</div>
						</div>
						<div class="form-group">
							<label class="col-sm-3 control-label">{{Objet parent}}</label>
							<div class="col-sm-4">
								<select id="sel_object" class="eqLogicAttr form-control" data-l1key="object_id">
									<option value="">{{Aucun}}</option>
									<?php
									$options = '';
									foreach ((jeeObject::buildTree(null, false)) as $object) {
										$options .= '<option value="' . $object->getId() . '">' . str_repeat('&nbsp;&nbsp;', $object->getConfiguration('parentNumber')) . $object->getName() . '</option>';
									}
									echo $options;
									?>
								</select>
							</div>
						</div>
						<div class="form-group">
							<label class="col-sm-3 control-label">{{Options}}</label>
							<div class="col-sm-4">
								<label class="checkbox-inline"><input type="checkbox" class="eqLogicAttr" data-l1key="isEnable" checked>{{Activer}}</label>
							</div>
						</div>
						<div class="form-group">
							<label class="col-sm-3 control-label">{{Adresses}}</label>
							<div class="col-sm-7">
								<span class="help-block">{{Page : }}<code id="span_tlUrl"></code></span>
								<span class="help-block">{{Tablette murale (sans barre Jeedom) : }}<code id="span_tlUrlKiosk"></code></span>
								<span class="help-block">{{Cette page n'apparaît jamais sur le dashboard. Pour l'avoir dans le menu Accueil et sur mobile, activez « Afficher le panneau desktop / mobile » dans la page du plugin.}}</span>
							</div>
						</div>
					</fieldset>
				</form>
			</div>
		</div>
	</div>
</div>

<?php
include_file('desktop', 'tuiles', 'css', 'tuiles');
include_file('desktop', 'tuiles.editor', 'css', 'tuiles');
include_file('desktop', 'tuiles.engine', 'js', 'tuiles');
include_file('desktop', 'tuiles', 'js', 'tuiles');
include_file('core', 'plugin.template', 'js');
?>
