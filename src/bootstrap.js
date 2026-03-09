var PaperConnections;

function log(msg) {
	Zotero.debug("Paper Connections: " + msg);
}

function install() {
	log("Installed");
}

async function startup({ id, version, rootURI }) {
	log(`Starting ${version}`);
	
	Zotero.PreferencePanes.register({
		id: 'paper-connections-prefpane',
		pluginID: 'paper-connections@example.com',
		src: rootURI + 'preferences.xhtml',
		label: 'Paper Connections'
	});
	
	Services.scriptloader.loadSubScript(rootURI + 'storage.js');
	Services.scriptloader.loadSubScript(rootURI + 'graph-workspace.js');
	Services.scriptloader.loadSubScript(rootURI + 'graph-render.js');
	Services.scriptloader.loadSubScript(rootURI + 'graph-interaction.js');
	Services.scriptloader.loadSubScript(rootURI + 'graph-topic.js');
	Services.scriptloader.loadSubScript(rootURI + 'graph-export.js');
	Services.scriptloader.loadSubScript(rootURI + 'paper-connections.js');
	PaperConnections.init({ id, version, rootURI });
	PaperConnections.addToAllWindows();
	await PaperConnections.main();
}

function onMainWindowLoad({ window }) {
	PaperConnections.addToWindow(window);
}

function onMainWindowUnload({ window }) {
	PaperConnections.removeFromWindow(window);
}

function shutdown() {
	log("Shutting down");
	PaperConnections.removeFromAllWindows();
	PaperConnections = undefined;
}

function uninstall() {
	log("Uninstalled");
}

