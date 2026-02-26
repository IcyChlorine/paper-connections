MakeItRed = {
	id: null,
	version: null,
	rootURI: null,
	initialized: false,
	addedElementIDs: [],
	customSectionID: "make-it-red-relations",
	sectionRegistered: false,

	init({ id, version, rootURI }) {
		if (this.initialized) return;
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
		this.initialized = true;
	},

	log(msg) {
		Zotero.debug("Make It Red: " + msg);
	},

	registerItemPaneSection() {
		if (this.sectionRegistered) return;
		if (!Zotero.ItemPaneManager?.registerSection) {
			this.log("ItemPaneManager API is not available");
			return;
		}

		const XHTML_NS = "http://www.w3.org/1999/xhtml";
		const paneID = this.customSectionID;

		Zotero.ItemPaneManager.registerSection({
			paneID,
			pluginID: this.id,
			header: {
				l10nID: "make-it-red-relations-header",
				icon: "chrome://zotero/skin/itempane/16/related.svg",
			},
			sidenav: {
				l10nID: "make-it-red-relations-sidenav",
				icon: "chrome://zotero/skin/itempane/20/related.svg",
			},
			onItemChange: ({ item, setEnabled, setSectionSummary }) => {
				setEnabled(!!item);
				setSectionSummary(item ? `Item: ${item.key}` : "");
			},
			onRender: ({ doc, body, item }) => {
				body.replaceChildren();

				const title = doc.createElementNS(XHTML_NS, "div");
				title.textContent = "Paper Relations (Placeholder)";
				title.style.fontWeight = "600";
				title.style.marginBottom = "8px";

				const desc = doc.createElementNS(XHTML_NS, "div");
				desc.textContent = "MVP scaffold for relation recording and graph visualization.";
				desc.style.marginBottom = "8px";

				const list = doc.createElementNS(XHTML_NS, "ul");
				list.style.margin = "0";
				list.style.paddingInlineStart = "18px";

				const row1 = doc.createElementNS(XHTML_NS, "li");
				row1.textContent = `Selected item key: ${item?.key || "-"}`;
				const row2 = doc.createElementNS(XHTML_NS, "li");
				row2.textContent = `Selected item id: ${item?.id ?? "-"}`;
				const row3 = doc.createElementNS(XHTML_NS, "li");
				row3.textContent = "TODO: add/edit relation edges (cites, extends, contradicts, related)";

				list.append(row1, row2, row3);
				body.append(title, desc, list);
			},
		});

		this.sectionRegistered = true;
	},

	unregisterItemPaneSection() {
		if (!this.sectionRegistered) return;
		if (!Zotero.ItemPaneManager?.unregisterSection) return;
		Zotero.ItemPaneManager.unregisterSection(this.customSectionID);
		this.sectionRegistered = false;
	},

	addToWindow(window) {
		let doc = window.document;

		if (!doc.getElementById("make-it-red-stylesheet")) {
			let link1 = doc.createElement("link");
			link1.id = "make-it-red-stylesheet";
			link1.type = "text/css";
			link1.rel = "stylesheet";
			link1.href = this.rootURI + "style.css";
			doc.documentElement.appendChild(link1);
			this.storeAddedElement(link1);
		}

		window.MozXULElement.insertFTLIfNeeded("make-it-red.ftl");
	},

	addToAllWindows() {
		var windows = Zotero.getMainWindows();
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.addToWindow(win);
		}
	},

	storeAddedElement(elem) {
		if (!elem.id) {
			throw new Error("Element must have an id");
		}
		this.addedElementIDs.push(elem.id);
	},

	removeFromWindow(window) {
		var doc = window.document;
		for (let id of this.addedElementIDs) {
			doc.getElementById(id)?.remove();
		}
		doc.querySelector('[href="make-it-red.ftl"]')?.remove();
	},

	removeFromAllWindows() {
		var windows = Zotero.getMainWindows();
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.removeFromWindow(win);
		}
		this.unregisterItemPaneSection();
	},

	async main() {
		this.registerItemPaneSection();

		// Global properties are included automatically in Zotero 7
		var host = new URL('https://foo.com/path').host;
		this.log(`Host is ${host}`);
	},
};
