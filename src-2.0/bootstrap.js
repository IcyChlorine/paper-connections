var PaperRelations;

function log(msg) {
	Zotero.debug("Paper Relations: " + msg);
}

function install() {
	log("Installed 2.0");
}

async function startup({ id, version, rootURI }) {
	log("Starting 2.0");
	
	Zotero.PreferencePanes.register({
		pluginID: 'paper-relations@example.com',
		src: rootURI + 'preferences.xhtml',
		scripts: [rootURI + 'preferences.js']
	});
	
	Services.scriptloader.loadSubScript(rootURI + 'paper-relations.js');
	PaperRelations.init({ id, version, rootURI });
	PaperRelations.addToAllWindows();
	await PaperRelations.main();
}

function onMainWindowLoad({ window }) {
	PaperRelations.addToWindow(window);
}

function onMainWindowUnload({ window }) {
	PaperRelations.removeFromWindow(window);
}

function shutdown() {
	log("Shutting down 2.0");
	PaperRelations.removeFromAllWindows();
	PaperRelations = undefined;
}

function uninstall() {
	log("Uninstalled 2.0");
}

