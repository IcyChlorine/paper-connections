var PaperConnectionsGraphWorkspaceMixin = {
	getNodeLabelForDisplay(nodeInput = {}) {
		let item = null;
		let libraryID = nodeInput.libraryID;
		let itemKey = nodeInput.itemKey;
		if (libraryID && itemKey && typeof Zotero.Items?.getByLibraryAndKey === "function") {
			try {
				item = Zotero.Items.getByLibraryAndKey(libraryID, itemKey);
			}
			catch (error) {
				Zotero.logError(error);
			}
		}

		let remark = this.getItemRemark(item);
		if (remark) return remark;

		let liveTitle = item ? this.getItemTitle(item) : "";
		if (liveTitle) return liveTitle;

		if (nodeInput.shortLabel) return nodeInput.shortLabel;
		return nodeInput.title || nodeInput.itemKey || "(untitled)";
	},

	getGraphWorkspaceText(key) {
		let isZh = this.getCurrentLocaleTag().startsWith("zh");
		let table = isZh
			? {
				nodeMenuRemove: "移除",
				nodeMenuRename: "重命名",
				renameFailedTitle: "重命名失败",
				removeNodeFailedTitle: "移除节点失败",
			}
			: {
				nodeMenuRemove: "Remove",
				nodeMenuRename: "Rename",
				renameFailedTitle: "Rename Failed",
				removeNodeFailedTitle: "Remove Node Failed",
			};
		table.workspaceMenuExportSVG = isZh ? "\u5bfc\u51fa\u4e3a SVG" : "Export as SVG";
		table.workspaceMenuExportJSON = isZh ? "\u5bfc\u51fa\u4e3a JSON" : "Export as JSON";
		table.workspaceMenuCreateTopicFromSelected = isZh ? "\u7531\u6b64\u8bba\u6587\u65b0\u5efa topic" : "Create Topic From This Paper";
		table.workspaceMenuRename = isZh ? "\u91cd\u547d\u540d" : "Rename";
		table.workspaceMenuDelete = isZh ? "\u5220\u9664" : "Delete";
		table.svgExportSettingsIntro = isZh ? "SVG\u5bfc\u51fa\u8bbe\u7f6e" : "SVG export settings";
		table.svgExportIncludeGrid = isZh ? "\u5305\u542b\u80cc\u666f\u7f51\u683c" : "Include background grid";
		table.svgExportMargin = isZh ? "\u8fb9\u8ddd\uff08\u50cf\u7d20\uff09" : "Margin (pixels)";
		table.dialogConfirm = isZh ? "\u786e\u5b9a" : "Confirm";
		table.dialogCancel = isZh ? "\u53d6\u6d88" : "Cancel";
		table.bundleMenuDissolve = isZh ? "\u6eb6\u89e3" : "Dissolve";
		table.bundleDissolveFailedTitle = isZh ? "\u6eb6\u89e3\u5931\u8d25" : "Dissolve Bundle Failed";
		table.bundleModeFlat = isZh ? "\u659c\u7387\u62c9\u5e73" : "Flat Tangent";
		return table[key] || "";
	},

	getGraphWorkspaceToggleTooltip(graphVisible) {
		let isZh = this.getCurrentLocaleTag().startsWith("zh");
		if (isZh) {
			return graphVisible
				? "\u9690\u85cf\u5173\u7cfb\u56fe\u5de5\u4f5c\u533a (Ctrl+`)"
				: "\u663e\u793a\u5173\u7cfb\u56fe\u5de5\u4f5c\u533a (Ctrl+`)";
		}
		return graphVisible
			? "Hide Relation Graph Workspace (Ctrl+`)"
			: "Show Relation Graph Workspace (Ctrl+`)";
	},

	getGraphWorkspaceToggleButton(window) {
		return window?.document?.getElementById("paper-connections-graph-toggle-btn") || null;
	},

	ensureGraphWorkspaceToggleButton(window) {
		let doc = window?.document;
		if (!doc) return null;
		let toolbar = doc.getElementById("zotero-items-toolbar");
		if (!toolbar) return null;

		let button = this.getGraphWorkspaceToggleButton(window);
		if (!button) {
			button = doc.createXULElement("toolbarbutton");
			button.id = "paper-connections-graph-toggle-btn";
			button.className = "zotero-tb-button";
			button.setAttribute("type", "button");
			button.setAttribute("tabindex", "-1");
			this.storeAddedElement(button);
		}

		this.placeGraphWorkspaceToggleButton(window, button);
		return button;
	},

	placeGraphWorkspaceToggleButton(window, toggleButton = null) {
		let doc = window?.document;
		if (!doc) return false;
		let toolbar = doc.getElementById("zotero-items-toolbar");
		if (!toolbar) return false;
		let button = toggleButton || this.getGraphWorkspaceToggleButton(window);
		if (!button) return false;

		let children = Array.from(toolbar.children || []);
		let spacer = children.find((child) =>
			child?.localName === "spacer" && child.getAttribute?.("flex") === "1",
		) || null;
		let spacerIndex = spacer ? children.indexOf(spacer) : -1;
		let beforeSpacer = spacerIndex >= 0 ? children.slice(0, spacerIndex) : children;
		let anchor = null;
		for (let child of beforeSpacer) {
			if (child === button) continue;
			if (child?.localName === "toolbarbutton" || child?.classList?.contains("zotero-tb-button")) {
				anchor = child;
			}
		}
		let insertBeforeNode = anchor ? anchor.nextSibling : spacer;
		if (insertBeforeNode === button) {
			return true;
		}
		if (button.parentNode !== toolbar || button.nextSibling !== insertBeforeNode) {
			toolbar.insertBefore(button, insertBeforeNode);
		}
		return true;
	},

	clearGraphWorkspaceTogglePlacementTimers(state) {
		if (!state?.window) return;
		if (!Array.isArray(state.togglePlacementTimerIDs)) {
			state.togglePlacementTimerIDs = [];
			return;
		}
		for (let timerID of state.togglePlacementTimerIDs) {
			state.window.clearTimeout(timerID);
		}
		state.togglePlacementTimerIDs = [];
	},

	scheduleGraphWorkspaceTogglePlacement(window) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.clearGraphWorkspaceTogglePlacementTimers(state);
		for (let delay of [0, 80, 220, 520]) {
			let timerID = window.setTimeout(() => {
				let nextState = this.graphStates.get(window);
				if (!nextState) return;
				this.placeGraphWorkspaceToggleButton(window, nextState.toolbarToggleButton);
			}, delay);
			state.togglePlacementTimerIDs.push(timerID);
		}
	},

	updateGraphWorkspaceToggleButton(window) {
		let state = this.graphStates.get(window);
		let button = state?.toolbarToggleButton || this.getGraphWorkspaceToggleButton(window);
		if (!button) return;
		let graphVisible = state ? state.graphVisible !== false : true;
		let tooltip = this.getGraphWorkspaceToggleTooltip(graphVisible);
		button.setAttribute("tooltiptext", tooltip);
		button.setAttribute("aria-label", tooltip);
		button.setAttribute("data-graph-visible", graphVisible ? "true" : "false");
		button.classList.toggle("active", graphVisible);
	},

	setWorkspaceElementHidden(elem, hidden, displayWhenVisible = "") {
		if (!elem) return;
		let nextHidden = !!hidden;
		elem.hidden = nextHidden;
		if (nextHidden) {
			elem.setAttribute("hidden", "true");
			elem.setAttribute("collapsed", "true");
			elem.style.display = "none";
			elem.style.visibility = "collapse";
			return;
		}
		elem.removeAttribute("hidden");
		elem.removeAttribute("collapsed");
		if (displayWhenVisible) {
			elem.style.display = displayWhenVisible;
		}
		else {
			elem.style.removeProperty("display");
		}
		elem.style.removeProperty("visibility");
	},

	getGraphWorkspaceHostRefs(window, state = null) {
		let doc = window?.document;
		if (!doc) return null;
		let graphState = state || this.graphStates.get(window) || null;
		return {
			titleBar: doc.getElementById("zotero-title-bar"),
			itemsContainer: graphState?.itemsContainer || doc.getElementById("zotero-items-pane-container"),
			graphPane: graphState?.pane || doc.getElementById("paper-connections-graph-pane"),
			graphCanvas: graphState?.canvas || doc.getElementById("paper-connections-graph-canvas"),
			graphSplitter: graphState?.splitter || doc.getElementById("paper-connections-graph-splitter"),
			collectionsPane: doc.getElementById("zotero-collections-pane"),
			collectionsSplitter: doc.getElementById("zotero-collections-splitter"),
			itemPane: doc.getElementById("zotero-item-pane"),
			itemSplitter: doc.getElementById("zotero-items-splitter"),
			tagSelectorContainer: doc.getElementById("zotero-tag-selector-container"),
			contextPane: doc.getElementById("zotero-context-pane"),
			librarySidenav: doc.getElementById("zotero-view-item-sidenav"),
			contextPaneSidenav: doc.getElementById("zotero-context-pane-sidenav"),
			itemToolbar: doc.getElementById("zotero-toolbar-item-tree"),
			itemsPane: doc.getElementById("zotero-items-pane"),
		};
	},

	scheduleGraphWorkspaceLayoutSync(window) {
		let run = () => {
			let state = this.graphStates.get(window);
			if (!state) return;
			this.updateCanvasControlsLayout(window);
			this.syncNodeRenameInputLayout(window);
		};
		run();
		window.requestAnimationFrame(() => {
			run();
			window.requestAnimationFrame(run);
		});
		for (let delay of [80, 220]) {
			window.setTimeout(run, delay);
		}
	},

	captureWorkspaceFullscreenSnapshot(window) {
		let state = this.graphStates.get(window);
		if (!state) return null;
		let refs = this.getGraphWorkspaceHostRefs(window, state);
		let snapshot = {
			collectionsPaneCollapsed: refs?.collectionsPane?.getAttribute("collapsed") === "true",
			collectionsSplitterState: refs?.collectionsSplitter?.getAttribute("state") || "",
			itemPaneCollapsed: refs?.itemPane?.getAttribute("collapsed") === "true",
			itemSplitterState: refs?.itemSplitter?.getAttribute("state") || "",
			tagSelectorCollapsed: refs?.tagSelectorContainer?.getAttribute("collapsed") === "true",
			contextPaneCollapsed: refs?.contextPane?.getAttribute("collapsed") === "true",
			titleBarHidden: !!refs?.titleBar?.hidden,
			librarySidenavHidden: !!refs?.librarySidenav?.hidden,
			contextPaneSidenavHidden: !!refs?.contextPaneSidenav?.hidden,
			itemToolbarHidden: !!refs?.itemToolbar?.hidden,
			itemsPaneHidden: !!refs?.itemsPane?.hidden,
			graphPaneHeightAttr: state.pane?.getAttribute("height"),
			graphPaneFlex: state.pane?.getAttribute("flex"),
			graphVisibleBeforeExit: state.graphVisible !== false,
		};
		state.fullscreenSnapshot = snapshot;
		return snapshot;
	},

	applyWorkspaceFullscreen(window) {
		let state = this.graphStates.get(window);
		if (!state || state.workspaceFullscreen) return;
		if (state.graphVisible === false) {
			this.setGraphWorkspaceVisibility(window, true);
		}
		let refs = this.getGraphWorkspaceHostRefs(window, state);
		let snapshot = state.fullscreenSnapshot || this.captureWorkspaceFullscreenSnapshot(window);
		if (!refs || !snapshot) return;

		this.hideGraphContextMenus(window);
		this.cancelNodeRename(window);

		refs.collectionsSplitter?.setAttribute("state", "collapsed");
		refs.collectionsPane?.setAttribute("collapsed", true);
		refs.itemSplitter?.setAttribute("state", "open");
		refs.itemPane?.setAttribute("collapsed", false);
		refs.tagSelectorContainer?.setAttribute("collapsed", true);
		if (window.ZoteroContextPane) {
			window.ZoteroContextPane.collapsed = true;
		}
		else {
			refs.contextPane?.setAttribute("collapsed", true);
		}
		this.setWorkspaceElementHidden(refs.titleBar, true);
		this.setWorkspaceElementHidden(refs.librarySidenav, true);
		this.setWorkspaceElementHidden(refs.contextPaneSidenav, true);
		this.setWorkspaceElementHidden(refs.itemToolbar, true);
		this.setWorkspaceElementHidden(refs.itemsPane, true);
		window.document?.documentElement?.classList.add("paper-connections-window-fullscreen");
		refs.itemsContainer?.classList.add("paper-connections-graph-host-fullscreen");
		state.pane?.classList.add("paper-connections-fullscreen");
		state.canvas?.classList.add("paper-connections-fullscreen");
		state.pane?.removeAttribute("height");
		state.pane?.setAttribute("flex", "1");
		state.workspaceFullscreen = true;
		this.applyGraphWorkspaceVisibilityToDOM(state);
		this.refreshGraphChrome(window);
		if (typeof window.ZoteroPane?.updateLayoutConstraints === "function") {
			window.ZoteroPane.updateLayoutConstraints();
		}
		this.scheduleGraphWorkspaceLayoutSync(window);
	},

	restoreWorkspaceFullscreen(window) {
		let state = this.graphStates.get(window);
		if (!state?.workspaceFullscreen) return;
		let refs = this.getGraphWorkspaceHostRefs(window, state);
		let snapshot = state.fullscreenSnapshot;
		if (!refs || !snapshot) {
			state.workspaceFullscreen = false;
			state.fullscreenSnapshot = null;
			return;
		}

		this.hideGraphContextMenus(window);
		this.cancelNodeRename(window);

		refs.collectionsPane?.setAttribute("collapsed", !!snapshot.collectionsPaneCollapsed);
		if (refs.collectionsSplitter) {
			if (snapshot.collectionsSplitterState) {
				refs.collectionsSplitter.setAttribute("state", snapshot.collectionsSplitterState);
			}
			else {
				refs.collectionsSplitter.removeAttribute("state");
			}
		}
		refs.itemPane?.setAttribute("collapsed", !!snapshot.itemPaneCollapsed);
		if (refs.itemSplitter) {
			if (snapshot.itemSplitterState) {
				refs.itemSplitter.setAttribute("state", snapshot.itemSplitterState);
			}
			else {
				refs.itemSplitter.removeAttribute("state");
			}
		}
		refs.tagSelectorContainer?.setAttribute("collapsed", !!snapshot.tagSelectorCollapsed);
		if (window.ZoteroContextPane) {
			window.ZoteroContextPane.collapsed = !!snapshot.contextPaneCollapsed;
		}
		else {
			refs.contextPane?.setAttribute("collapsed", !!snapshot.contextPaneCollapsed);
		}
		this.setWorkspaceElementHidden(refs.titleBar, !!snapshot.titleBarHidden);
		this.setWorkspaceElementHidden(refs.librarySidenav, !!snapshot.librarySidenavHidden);
		this.setWorkspaceElementHidden(refs.contextPaneSidenav, !!snapshot.contextPaneSidenavHidden);
		this.setWorkspaceElementHidden(refs.itemToolbar, !!snapshot.itemToolbarHidden);
		this.setWorkspaceElementHidden(refs.itemsPane, !!snapshot.itemsPaneHidden);
		window.document?.documentElement?.classList.remove("paper-connections-window-fullscreen");
		refs.itemsContainer?.classList.remove("paper-connections-graph-host-fullscreen");
		state.pane?.classList.remove("paper-connections-fullscreen");
		state.canvas?.classList.remove("paper-connections-fullscreen");
		state.pane?.removeAttribute("flex");
		if (snapshot.graphPaneFlex != null) {
			state.pane?.setAttribute("flex", snapshot.graphPaneFlex);
		}
		if (snapshot.graphPaneHeightAttr != null) {
			state.pane?.setAttribute("height", snapshot.graphPaneHeightAttr);
		}
		else {
			state.pane?.removeAttribute("height");
		}
		state.workspaceFullscreen = false;
		state.fullscreenSnapshot = null;
		this.applyGraphWorkspaceVisibilityToDOM(state);
		this.refreshGraphChrome(window);
		if (typeof window.ZoteroPane?.updateLayoutConstraints === "function") {
			window.ZoteroPane.updateLayoutConstraints();
		}
		this.scheduleGraphWorkspaceLayoutSync(window);
	},

	setWorkspaceFullscreen(window, fullscreen) {
		if (fullscreen) {
			this.applyWorkspaceFullscreen(window);
		}
		else {
			this.restoreWorkspaceFullscreen(window);
		}
	},

	toggleWorkspaceFullscreen(window) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.setWorkspaceFullscreen(window, !state.workspaceFullscreen);
	},

	applyGraphWorkspaceVisibilityToDOM(state) {
		if (!state) return;
		let graphVisible = state.graphVisible !== false;
		this.setWorkspaceElementHidden(state.pane, !graphVisible, "flex");
		if (graphVisible) {
			state.pane?.removeAttribute("collapsed");
		}
		else {
			state.pane?.setAttribute("collapsed", "true");
		}
		let splitterVisible = graphVisible && !state.workspaceFullscreen;
		this.setWorkspaceElementHidden(state.splitter, !splitterVisible);
		if (splitterVisible) {
			state.splitter?.removeAttribute("collapsed");
		}
		else {
			state.splitter?.setAttribute("collapsed", "true");
		}
	},

	setGraphWorkspaceVisibility(window, visible) {
		let state = this.graphStates.get(window);
		if (!state) return;
		let nextVisible = !!visible;
		if (!nextVisible && state.workspaceFullscreen) {
			this.setWorkspaceFullscreen(window, false);
		}
		state.graphVisible = nextVisible;
		this.applyGraphWorkspaceVisibilityToDOM(state);
		if (!nextVisible) {
			this.hideGraphContextMenus(window);
			this.cancelNodeRename(window);
		}
		else {
			this.scheduleGraphWorkspaceLayoutSync(window);
		}
		this.updateGraphWorkspaceToggleButton(window);
		this.notifyGraphContextChanged(window);
		if (typeof window.ZoteroPane?.updateLayoutConstraints === "function") {
			window.ZoteroPane.updateLayoutConstraints();
		}
	},

	toggleGraphWorkspaceVisibility(window) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.setGraphWorkspaceVisibility(window, !state.graphVisible);
	},

	onGraphWorkspaceToggleButtonCommand(window, event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		this.toggleGraphWorkspaceVisibility(window);
	},

	createGraphPaneHandlers(window) {
		return {
			wheel: (event) => this.onGraphWheel(window, event),
			mousedown: (event) => this.onGraphMouseDown(window, event),
			click: (event) => this.onGraphClick(window, event),
			svgdblclick: (event) => this.onGraphSVGDoubleClick(window, event),
			contextmenu: (event) => this.onGraphContextMenu(window, event),
			mousemove: (event) => this.onGraphMouseMove(window, event),
			mouseup: (event) => this.onGraphMouseUp(window, event),
			windowmousedown: (event) => this.onWindowMouseDown(window, event),
			windowclick: (event) => this.onWindowMouseDown(window, event),
			documentmousedown: (event) => this.onWindowMouseDown(window, event),
			documentclick: (event) => this.onWindowMouseDown(window, event),
			keydown: (event) => this.onWindowKeyDown(window, event),
			keypress: (event) => this.onWindowKeyDown(window, event),
			keyup: (event) => this.onWindowKeyUp(window, event),
			blur: () => this.onWindowBlur(window),
			dragover: (event) => this.onGraphDragOver(window, event),
			drop: (event) => this.onGraphDrop(window, event),
			dragleave: (event) => this.onGraphDragLeave(window, event),
			controlmousedown: (event) => this.onCanvasControlMouseDown(window, event),
			pinbtnclick: () => this.onPinButtonToggle(window),
			snapbtnclick: () => this.onSnapButtonToggle(window),
			nodemenumousedown: (event) => this.onNodeContextMenuMouseDown(window, event),
			menuremoveclick: (event) => this.onNodeMenuRemoveClick(window, event),
			menurenameclick: (event) => this.onNodeMenuRenameClick(window, event),
			workspacemenumousedown: (event) => this.onWorkspaceContextMenuMouseDown(window, event),
			workspacemenuitemclick: (event) => this.onWorkspaceMenuItemClick(window, event),
			bundlemenumousedown: (event) => this.onBundleContextMenuMouseDown(window, event),
			bundlemenudissolveclick: (event) => this.onBundleMenuDissolveClick(window, event),
			bundlemenumodeclick: (event) => this.onBundleMenuModeClick(window, event),
			renameinputmousedown: (event) => this.onNodeRenameInputMouseDown(window, event),
			renameinput: (event) => this.onNodeRenameInput(window, event),
			renameinputkeydown: (event) => this.onNodeRenameInputKeyDown(window, event),
			renameinputblur: (event) => this.onNodeRenameInputBlur(window, event),
			togglebtnclick: (event) => this.onGraphWorkspaceToggleButtonCommand(window, event),
			togglebtncommand: (event) => this.onGraphWorkspaceToggleButtonCommand(window, event),
			resize: () => this.updateCanvasControlsLayout(window),
		};
	},

	bindGraphPaneEvents(window, doc, state) {
		if (!state?.handlers) return;
		state.svg.addEventListener("wheel", state.handlers.wheel, { passive: false });
		state.svg.addEventListener("mousedown", state.handlers.mousedown);
		state.svg.addEventListener("click", state.handlers.click);
		state.svg.addEventListener("dblclick", state.handlers.svgdblclick);
		state.svg.addEventListener("contextmenu", state.handlers.contextmenu);
		window.addEventListener("mousemove", state.handlers.mousemove);
		window.addEventListener("mouseup", state.handlers.mouseup);
		window.addEventListener("mousedown", state.handlers.windowmousedown, true);
		window.addEventListener("click", state.handlers.windowclick, true);
		doc.addEventListener("mousedown", state.handlers.documentmousedown, true);
		doc.addEventListener("click", state.handlers.documentclick, true);
		window.addEventListener("keydown", state.handlers.keydown, true);
		window.addEventListener("keypress", state.handlers.keypress, true);
		window.addEventListener("keyup", state.handlers.keyup, true);
		window.addEventListener("blur", state.handlers.blur);
		state.canvas.addEventListener("dragover", state.handlers.dragover);
		state.canvas.addEventListener("drop", state.handlers.drop);
		state.canvas.addEventListener("dragleave", state.handlers.dragleave);
		state.pinButton.addEventListener("mousedown", state.handlers.controlmousedown);
		state.snapButton.addEventListener("mousedown", state.handlers.controlmousedown);
		state.pinButton.addEventListener("click", state.handlers.pinbtnclick);
		state.snapButton.addEventListener("click", state.handlers.snapbtnclick);
		state.nodeContextMenu.addEventListener("mousedown", state.handlers.nodemenumousedown);
		state.removeNodeBtn.addEventListener("click", state.handlers.menuremoveclick);
		state.renameNodeBtn.addEventListener("click", state.handlers.menurenameclick);
		state.workspaceContextMenu.addEventListener("mousedown", state.handlers.workspacemenumousedown);
		state.workspaceCreateTopicFromSelectedBtn.addEventListener("click", state.handlers.workspacemenuitemclick);
		state.workspaceExportSVGBtn.addEventListener("click", state.handlers.workspacemenuitemclick);
		state.workspaceExportJSONBtn.addEventListener("click", state.handlers.workspacemenuitemclick);
		state.workspaceRenameTopicBtn.addEventListener("click", state.handlers.workspacemenuitemclick);
		state.workspaceDeleteTopicBtn.addEventListener("click", state.handlers.workspacemenuitemclick);
		state.bundleContextMenu.addEventListener("mousedown", state.handlers.bundlemenumousedown);
		state.dissolveBundleBtn.addEventListener("click", state.handlers.bundlemenudissolveclick);
		state.bundleModeFlatBtn.addEventListener("click", state.handlers.bundlemenumodeclick);
		state.renameInput.addEventListener("mousedown", state.handlers.renameinputmousedown);
		state.renameInput.addEventListener("input", state.handlers.renameinput);
		state.renameInput.addEventListener("keydown", state.handlers.renameinputkeydown);
		state.renameInput.addEventListener("blur", state.handlers.renameinputblur);
		state.toolbarToggleButton?.addEventListener("click", state.handlers.togglebtnclick);
		state.toolbarToggleButton?.addEventListener("command", state.handlers.togglebtncommand);
		window.addEventListener("resize", state.handlers.resize);
	},

	unbindGraphPaneEvents(window, doc, state) {
		if (!state?.handlers) return;
		state.svg?.removeEventListener("wheel", state.handlers.wheel);
		state.svg?.removeEventListener("mousedown", state.handlers.mousedown);
		state.svg?.removeEventListener("click", state.handlers.click);
		state.svg?.removeEventListener("dblclick", state.handlers.svgdblclick);
		state.svg?.removeEventListener("contextmenu", state.handlers.contextmenu);
		window.removeEventListener("mousemove", state.handlers.mousemove);
		window.removeEventListener("mouseup", state.handlers.mouseup);
		window.removeEventListener("mousedown", state.handlers.windowmousedown, true);
		window.removeEventListener("click", state.handlers.windowclick, true);
		doc.removeEventListener("mousedown", state.handlers.documentmousedown, true);
		doc.removeEventListener("click", state.handlers.documentclick, true);
		window.removeEventListener("keydown", state.handlers.keydown, true);
		window.removeEventListener("keydown", state.handlers.keydown);
		window.removeEventListener("keypress", state.handlers.keypress, true);
		window.removeEventListener("keypress", state.handlers.keypress);
		window.removeEventListener("keyup", state.handlers.keyup, true);
		window.removeEventListener("keyup", state.handlers.keyup);
		window.removeEventListener("blur", state.handlers.blur);
		state.canvas?.removeEventListener("dragover", state.handlers.dragover);
		state.canvas?.removeEventListener("drop", state.handlers.drop);
		state.canvas?.removeEventListener("dragleave", state.handlers.dragleave);
		state.pinButton?.removeEventListener("mousedown", state.handlers.controlmousedown);
		state.snapButton?.removeEventListener("mousedown", state.handlers.controlmousedown);
		state.pinButton?.removeEventListener("click", state.handlers.pinbtnclick);
		state.snapButton?.removeEventListener("click", state.handlers.snapbtnclick);
		state.nodeContextMenu?.removeEventListener("mousedown", state.handlers.nodemenumousedown);
		state.removeNodeBtn?.removeEventListener("click", state.handlers.menuremoveclick);
		state.renameNodeBtn?.removeEventListener("click", state.handlers.menurenameclick);
		state.workspaceContextMenu?.removeEventListener("mousedown", state.handlers.workspacemenumousedown);
		state.workspaceCreateTopicFromSelectedBtn?.removeEventListener("click", state.handlers.workspacemenuitemclick);
		state.workspaceExportSVGBtn?.removeEventListener("click", state.handlers.workspacemenuitemclick);
		state.workspaceExportJSONBtn?.removeEventListener("click", state.handlers.workspacemenuitemclick);
		state.workspaceRenameTopicBtn?.removeEventListener("click", state.handlers.workspacemenuitemclick);
		state.workspaceDeleteTopicBtn?.removeEventListener("click", state.handlers.workspacemenuitemclick);
		state.bundleContextMenu?.removeEventListener("mousedown", state.handlers.bundlemenumousedown);
		state.dissolveBundleBtn?.removeEventListener("click", state.handlers.bundlemenudissolveclick);
		state.bundleModeFlatBtn?.removeEventListener("click", state.handlers.bundlemenumodeclick);
		state.renameInput?.removeEventListener("mousedown", state.handlers.renameinputmousedown);
		state.renameInput?.removeEventListener("input", state.handlers.renameinput);
		state.renameInput?.removeEventListener("keydown", state.handlers.renameinputkeydown);
		state.renameInput?.removeEventListener("blur", state.handlers.renameinputblur);
		state.toolbarToggleButton?.removeEventListener("click", state.handlers.togglebtnclick);
		state.toolbarToggleButton?.removeEventListener("command", state.handlers.togglebtncommand);
		window.removeEventListener("resize", state.handlers.resize);
	},

	finalizeGraphPaneMount(window, state) {
		this.graphStates.set(window, state);
		this.applyGraphWorkspaceVisibilityToDOM(state);
		this.updateGraphWorkspaceToggleButton(window);
		this.scheduleGraphWorkspaceTogglePlacement(window);
		this.updateCanvasCursorState(window);
		this.refreshGraph(window);
		this.refreshGraphChrome(window);
		this.notifyGraphSelectionChanged(window);
		this.scheduleGraphWorkspaceLayoutSync(window);

		let selectedItem = this.getCurrentSelectedItem(window);
		if (selectedItem) {
			this.selectionItemsByWindow.set(window, selectedItem);
			this.handlePrimaryItemChanged(window, selectedItem).catch((error) => Zotero.logError(error));
		}
	},

	cleanupExistingGraphPane(window, doc) {
		let existingPane = doc.getElementById("paper-connections-graph-pane");
		if (!existingPane) return;
		let existingState = this.graphStates?.get(window);
		if (existingState?.workspaceFullscreen) {
			this.restoreWorkspaceFullscreen(window);
		}
		this.unbindGraphPaneEvents(window, doc, existingState);
		this.clearGraphWorkspaceTogglePlacementTimers(existingState);
		this.graphStates?.delete(window);
		doc.getElementById("paper-connections-graph-splitter")?.remove();
		existingPane.remove();
	},

	createGraphPaneState(window, refs, toolbarToggleButton, controlPanelWidth) {
		return {
			window,
			itemsContainer: refs.itemsContainer,
			pane: refs.pane,
			splitter: refs.splitter,
			canvas: refs.canvas,
			header: refs.header,
			headerMain: refs.headerMain,
			headerTemporaryHint: refs.headerTemporaryHint,
			subheader: refs.subheader,
			boardGrid: refs.boardGrid,
			svg: refs.svg,
			viewport: refs.viewport,
			edgesGroup: refs.edgesGroup,
			nodesGroup: refs.nodesGroup,
			overlayGroup: refs.overlayGroup,
			canvasControls: refs.canvasControls,
			pinButton: refs.pinButton,
			snapButton: refs.snapButton,
			nodeContextMenu: refs.nodeContextMenu,
			removeNodeBtn: refs.removeNodeBtn,
			renameNodeBtn: refs.renameNodeBtn,
			renameInput: refs.renameInput,
			workspaceContextMenu: refs.workspaceContextMenu,
			workspaceCreateTopicFromSelectedBtn: refs.workspaceCreateTopicFromSelectedBtn,
			workspaceExportSVGBtn: refs.workspaceExportSVGBtn,
			workspaceExportJSONBtn: refs.workspaceExportJSONBtn,
			workspaceSeparator: refs.workspaceSeparator,
			workspaceRenameTopicBtn: refs.workspaceRenameTopicBtn,
			workspaceDeleteTopicBtn: refs.workspaceDeleteTopicBtn,
			bundleContextMenu: refs.bundleContextMenu,
			dissolveBundleBtn: refs.dissolveBundleBtn,
			bundleModeFlatBtn: refs.bundleModeFlatBtn,
			toolbarToggleButton,
			controlPanelWidth,
			graphVisible: true,
			nodes: [],
			edges: [],
			nodeElemsByID: new Map(),
			edgeElemsByID: new Map(),
			bundleHubElemsByID: new Map(),
			activeTopicID: null,
			activeLibraryID: null,
			activeTopicName: "",
			isTemporaryTopic: false,
			pinSelection: false,
			snapToGrid: true,
			activeItemKey: null,
			activeItemLibraryID: null,
			selectedNodeID: null,
			hoverAnchor: null,
			edgeDraft: null,
			edgeCutDraft: null,
			edgeBundleDraft: null,
			anchorHoverRadiusPx: 14,
			bundleHoverRadiusPx: 14,
			altModifierPressed: false,
			shiftModifierPressed: false,
			pointerInCanvas: false,
			pointerOverNode: false,
			pointerOverControl: false,
			scale: 1,
			panX: 40,
			panY: 26,
			dragMode: null,
			dragNodeID: null,
			dragNodeRawX: null,
			dragNodeRawY: null,
			dragNodeMoved: false,
			dragBundleID: null,
			dragBundleRawX: null,
			dragBundleRawY: null,
			lastClientX: 0,
			lastClientY: 0,
			contextMenuNodeID: null,
			hoverBundleID: null,
			contextMenuBundleID: null,
			suppressNextContextMenu: false,
			renamingNodeID: null,
			renameFallbackTitle: "",
			renameSnapshot: null,
			renameBusy: false,
			suppressRenameInputBlur: false,
			workspaceFullscreen: false,
			fullscreenSnapshot: null,
			togglePlacementTimerIDs: [],
			handlers: null,
		};
	},

	buildGraphPaneElements(window, doc, itemsContainer) {
		const XHTML_NS = "http://www.w3.org/1999/xhtml";
		const SVG_NS = "http://www.w3.org/2000/svg";

		let splitter = doc.createXULElement("splitter");
		splitter.id = "paper-connections-graph-splitter";
		splitter.setAttribute("orient", "vertical");
		splitter.setAttribute("collapse", "after");
		splitter.setAttribute("resizebefore", "closest");
		splitter.setAttribute("resizeafter", "closest");
		splitter.setAttribute("onmousemove", "ZoteroPane.updateLayoutConstraints()");
		splitter.setAttribute("oncommand", "ZoteroPane.updateLayoutConstraints()");
		splitter.appendChild(doc.createXULElement("grippy"));

		let pane = doc.createXULElement("vbox");
		pane.id = "paper-connections-graph-pane";
		pane.setAttribute("height", "250");

		let toolbar = doc.createElementNS(XHTML_NS, "div");
		toolbar.id = "paper-connections-graph-toolbar";

		let titleWrap = doc.createElementNS(XHTML_NS, "div");
		titleWrap.id = "paper-connections-graph-title-wrap";

		let header = doc.createElementNS(XHTML_NS, "div");
		header.id = "paper-connections-graph-header";
		let headerMain = doc.createElementNS(XHTML_NS, "span");
		headerMain.className = "paper-connections-graph-header-main";
		headerMain.textContent = "Relation Graph Workspace";
		let headerTemporaryHint = doc.createElementNS(XHTML_NS, "span");
		headerTemporaryHint.className = "paper-connections-graph-header-temporary-hint";
		headerTemporaryHint.textContent = "temporary topic";
		headerTemporaryHint.hidden = true;
		header.append(headerMain, headerTemporaryHint);

		let subheader = doc.createElementNS(XHTML_NS, "div");
		subheader.id = "paper-connections-graph-subheader";
		subheader.textContent = "Select an item to load topic graph";

		titleWrap.append(header, subheader);
		toolbar.append(titleWrap);

		let canvas = doc.createElementNS(XHTML_NS, "div");
		canvas.id = "paper-connections-graph-canvas";
		canvas.style.position = "relative";

		let svg = doc.createElementNS(SVG_NS, "svg");

		let defs = doc.createElementNS(SVG_NS, "defs");
		let marker = doc.createElementNS(SVG_NS, "marker");
		marker.setAttribute("id", "paper-connections-arrow");
		marker.setAttribute("markerWidth", "11");
		marker.setAttribute("markerHeight", "8");
		marker.setAttribute("refX", "10");
		marker.setAttribute("refY", "4");
		marker.setAttribute("orient", "auto");
		let arrowPath = doc.createElementNS(SVG_NS, "path");
		arrowPath.setAttribute("d", "M0,0 L11,4 L0,8 Z");
		arrowPath.setAttribute("fill", "#4b6073");
		marker.appendChild(arrowPath);
		defs.appendChild(marker);

		let boardFill = doc.createElementNS(SVG_NS, "linearGradient");
		boardFill.setAttribute("id", "paper-connections-board-fill");
		boardFill.setAttribute("x1", "0");
		boardFill.setAttribute("y1", "0");
		boardFill.setAttribute("x2", "0");
		boardFill.setAttribute("y2", "1");
		let boardFillStart = doc.createElementNS(SVG_NS, "stop");
		boardFillStart.setAttribute("offset", "0%");
		boardFillStart.setAttribute("stop-color", "#ffffff");
		let boardFillEnd = doc.createElementNS(SVG_NS, "stop");
		boardFillEnd.setAttribute("offset", "100%");
		boardFillEnd.setAttribute("stop-color", "#f5f8fb");
		boardFill.append(boardFillStart, boardFillEnd);
		defs.appendChild(boardFill);

		let gridPattern = doc.createElementNS(SVG_NS, "pattern");
		let gridSize = this.nodeSnapGridSize;
		gridPattern.setAttribute("id", "paper-connections-grid-pattern");
		gridPattern.setAttribute("patternUnits", "userSpaceOnUse");
		gridPattern.setAttribute("x", "0");
		gridPattern.setAttribute("y", "0");
		gridPattern.setAttribute("width", String(gridSize));
		gridPattern.setAttribute("height", String(gridSize));
		let gridPath = doc.createElementNS(SVG_NS, "path");
		gridPath.setAttribute("d", `M${gridSize} 0 H0 V${gridSize}`);
		gridPath.setAttribute("fill", "none");
		gridPath.setAttribute("stroke", "rgba(120, 140, 160, 0.18)");
		gridPath.setAttribute("stroke-width", "1");
		gridPattern.appendChild(gridPath);
		defs.appendChild(gridPattern);
		svg.appendChild(defs);

		let viewport = doc.createElementNS(SVG_NS, "g");
		viewport.setAttribute("id", "paper-connections-graph-viewport");
		let boardGroup = doc.createElementNS(SVG_NS, "g");
		boardGroup.setAttribute("class", "paper-connections-board");
		let boardBase = doc.createElementNS(SVG_NS, "rect");
		boardBase.setAttribute("class", "paper-connections-board-base");
		boardBase.setAttribute("x", "-5000");
		boardBase.setAttribute("y", "-5000");
		boardBase.setAttribute("width", "10000");
		boardBase.setAttribute("height", "10000");
		let boardGrid = doc.createElementNS(SVG_NS, "rect");
		boardGrid.setAttribute("class", "paper-connections-board-grid");
		boardGrid.setAttribute("x", "-5000");
		boardGrid.setAttribute("y", "-5000");
		boardGrid.setAttribute("width", "10000");
		boardGrid.setAttribute("height", "10000");
		boardGroup.append(boardBase, boardGrid);
		let edgesGroup = doc.createElementNS(SVG_NS, "g");
		edgesGroup.setAttribute("class", "paper-connections-edges");
		let nodesGroup = doc.createElementNS(SVG_NS, "g");
		nodesGroup.setAttribute("class", "paper-connections-nodes");
		let overlayGroup = doc.createElementNS(SVG_NS, "g");
		overlayGroup.setAttribute("class", "paper-connections-overlay");
		viewport.append(boardGroup, edgesGroup, nodesGroup, overlayGroup);
		svg.appendChild(viewport);

		let canvasControls = doc.createElementNS(SVG_NS, "g");
		canvasControls.setAttribute("class", "paper-connections-canvas-controls");
		canvasControls.setAttribute("aria-label", "graph workspace controls");
		const controlButtonSize = 28;
		const controlGap = 8;
		const controlPanelWidth = controlButtonSize * 2 + controlGap;
		const iconInset = 2;
		let appendIconImage = (button, fileName) => {
			let hitbox = doc.createElementNS(SVG_NS, "rect");
			hitbox.setAttribute("class", "paper-connections-canvas-btn-hitbox");
			hitbox.setAttribute("x", "0");
			hitbox.setAttribute("y", "0");
			hitbox.setAttribute("width", String(controlButtonSize));
			hitbox.setAttribute("height", String(controlButtonSize));
			hitbox.setAttribute("rx", "6");
			hitbox.setAttribute("ry", "6");
			let iconImage = doc.createElementNS(SVG_NS, "image");
			let href = `${this.rootURI}assets/${fileName}`;
			iconImage.setAttribute("class", "paper-connections-canvas-btn-icon-image");
			iconImage.setAttribute("x", String(iconInset));
			iconImage.setAttribute("y", String(iconInset));
			iconImage.setAttribute("width", String(controlButtonSize - iconInset * 2));
			iconImage.setAttribute("height", String(controlButtonSize - iconInset * 2));
			iconImage.setAttribute("preserveAspectRatio", "xMidYMid meet");
			iconImage.setAttribute("href", href);
			iconImage.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", href);
			button.append(hitbox, iconImage);
		};

		let snapButton = doc.createElementNS(SVG_NS, "g");
		snapButton.setAttribute("class", "paper-connections-canvas-btn paper-connections-snap-btn");
		snapButton.setAttribute("data-control", "snap");
		snapButton.setAttribute("role", "button");
		snapButton.setAttribute("aria-label", "Toggle magnetic grid snapping");
		snapButton.setAttribute("transform", "translate(0 0)");
		appendIconImage(snapButton, "magnet-wave-svgrepo-com.svg");

		let pinButton = doc.createElementNS(SVG_NS, "g");
		pinButton.setAttribute("class", "paper-connections-canvas-btn paper-connections-pin-btn");
		pinButton.setAttribute("data-control", "pin");
		pinButton.setAttribute("role", "button");
		pinButton.setAttribute("aria-label", "Toggle pinned graph context");
		pinButton.setAttribute("transform", `translate(${controlButtonSize + controlGap} 0)`);
		appendIconImage(pinButton, "pin-svgrepo-com.svg");

		canvasControls.append(snapButton, pinButton);
		svg.appendChild(canvasControls);
		canvas.appendChild(svg);

		let nodeContextMenu = doc.createElementNS(XHTML_NS, "div");
		nodeContextMenu.className = "paper-connections-node-context-menu";
		nodeContextMenu.hidden = true;
		nodeContextMenu.style.position = "absolute";
		nodeContextMenu.style.zIndex = "8";
		nodeContextMenu.style.display = "none";
		let removeNodeBtn = doc.createElementNS(XHTML_NS, "button");
		removeNodeBtn.type = "button";
		removeNodeBtn.className = "paper-connections-node-context-item";
		removeNodeBtn.setAttribute("data-action", "remove");
		removeNodeBtn.textContent = this.getGraphWorkspaceText("nodeMenuRemove");
		let renameNodeBtn = doc.createElementNS(XHTML_NS, "button");
		renameNodeBtn.type = "button";
		renameNodeBtn.className = "paper-connections-node-context-item";
		renameNodeBtn.setAttribute("data-action", "rename");
		renameNodeBtn.textContent = this.getGraphWorkspaceText("nodeMenuRename");
		nodeContextMenu.append(removeNodeBtn, renameNodeBtn);
		canvas.appendChild(nodeContextMenu);

		let renameInput = doc.createElementNS(XHTML_NS, "input");
		renameInput.type = "text";
		renameInput.className = "paper-connections-node-rename-input";
		renameInput.hidden = true;
		renameInput.setAttribute("spellcheck", "false");
		renameInput.style.position = "absolute";
		renameInput.style.zIndex = "7";
		renameInput.style.textAlign = "center";
		canvas.appendChild(renameInput);

		let workspaceContextMenu = doc.createElementNS(XHTML_NS, "div");
		workspaceContextMenu.className = "paper-connections-node-context-menu paper-connections-workspace-context-menu";
		workspaceContextMenu.hidden = true;
		workspaceContextMenu.style.position = "absolute";
		workspaceContextMenu.style.zIndex = "8";
		workspaceContextMenu.style.display = "none";

		let workspaceCreateTopicFromSelectedBtn = doc.createElementNS(XHTML_NS, "button");
		workspaceCreateTopicFromSelectedBtn.type = "button";
		workspaceCreateTopicFromSelectedBtn.className = "paper-connections-node-context-item";
		workspaceCreateTopicFromSelectedBtn.setAttribute("data-action", "create-topic-from-selected");
		workspaceCreateTopicFromSelectedBtn.textContent = this.getGraphWorkspaceText("workspaceMenuCreateTopicFromSelected");

		let workspaceExportSVGBtn = doc.createElementNS(XHTML_NS, "button");
		workspaceExportSVGBtn.type = "button";
		workspaceExportSVGBtn.className = "paper-connections-node-context-item";
		workspaceExportSVGBtn.setAttribute("data-action", "export-svg");
		workspaceExportSVGBtn.textContent = this.getGraphWorkspaceText("workspaceMenuExportSVG");

		let workspaceExportJSONBtn = doc.createElementNS(XHTML_NS, "button");
		workspaceExportJSONBtn.type = "button";
		workspaceExportJSONBtn.className = "paper-connections-node-context-item";
		workspaceExportJSONBtn.setAttribute("data-action", "export-json");
		workspaceExportJSONBtn.textContent = this.getGraphWorkspaceText("workspaceMenuExportJSON");

		let workspaceSeparator = doc.createElementNS(XHTML_NS, "div");
		workspaceSeparator.className = "paper-connections-context-menu-separator";

		let workspaceRenameTopicBtn = doc.createElementNS(XHTML_NS, "button");
		workspaceRenameTopicBtn.type = "button";
		workspaceRenameTopicBtn.className = "paper-connections-node-context-item";
		workspaceRenameTopicBtn.setAttribute("data-action", "rename-topic");
		workspaceRenameTopicBtn.textContent = this.getGraphWorkspaceText("workspaceMenuRename");

		let workspaceDeleteTopicBtn = doc.createElementNS(XHTML_NS, "button");
		workspaceDeleteTopicBtn.type = "button";
		workspaceDeleteTopicBtn.className = "paper-connections-node-context-item";
		workspaceDeleteTopicBtn.setAttribute("data-action", "delete-topic");
		workspaceDeleteTopicBtn.textContent = this.getGraphWorkspaceText("workspaceMenuDelete");

		workspaceContextMenu.append(
			workspaceCreateTopicFromSelectedBtn,
			workspaceRenameTopicBtn,
			workspaceDeleteTopicBtn,
			workspaceSeparator,
			workspaceExportSVGBtn,
			workspaceExportJSONBtn,
		);
		canvas.appendChild(workspaceContextMenu);

		let bundleContextMenu = doc.createElementNS(XHTML_NS, "div");
		bundleContextMenu.className = "paper-connections-node-context-menu paper-connections-bundle-context-menu";
		bundleContextMenu.hidden = true;
		bundleContextMenu.style.position = "absolute";
		bundleContextMenu.style.zIndex = "9";
		bundleContextMenu.style.display = "none";
		let dissolveBundleBtn = doc.createElementNS(XHTML_NS, "button");
		dissolveBundleBtn.type = "button";
		dissolveBundleBtn.className = "paper-connections-node-context-item";
		dissolveBundleBtn.setAttribute("data-action", "dissolve");
		dissolveBundleBtn.textContent = this.getGraphWorkspaceText("bundleMenuDissolve");
		let bundleModeSeparator = doc.createElementNS(XHTML_NS, "div");
		bundleModeSeparator.className = "paper-connections-context-menu-separator";
		let makeBundleModeBtn = (action, labelText) => {
			let btn = doc.createElementNS(XHTML_NS, "button");
			btn.type = "button";
			btn.className = "paper-connections-node-context-item";
			btn.setAttribute("data-action", action);
			btn.setAttribute("data-checked", "false");
			let label = doc.createElementNS(XHTML_NS, "span");
			label.className = "paper-connections-node-context-label";
			label.textContent = labelText;
			let check = doc.createElementNS(XHTML_NS, "span");
			check.className = "paper-connections-node-context-check";
			check.textContent = "\u2713";
			btn.append(label, check);
			return btn;
		};
		let bundleModeFlatBtn = makeBundleModeBtn("mode-flat-toggle", this.getGraphWorkspaceText("bundleModeFlat"));
		bundleContextMenu.append(
			dissolveBundleBtn,
			bundleModeSeparator,
			bundleModeFlatBtn,
		);
		canvas.appendChild(bundleContextMenu);

		pane.append(toolbar, canvas);
		itemsContainer.append(splitter, pane);

		return {
			itemsContainer,
			pane,
			splitter,
			canvas,
			header,
			headerMain,
			headerTemporaryHint,
			subheader,
			boardGrid,
			svg,
			viewport,
			edgesGroup,
			nodesGroup,
			overlayGroup,
			canvasControls,
			pinButton,
			snapButton,
			nodeContextMenu,
			removeNodeBtn,
			renameNodeBtn,
			renameInput,
			workspaceContextMenu,
			workspaceCreateTopicFromSelectedBtn,
			workspaceExportSVGBtn,
			workspaceExportJSONBtn,
			workspaceSeparator,
			workspaceRenameTopicBtn,
			workspaceDeleteTopicBtn,
			bundleContextMenu,
			dissolveBundleBtn,
			bundleModeFlatBtn,
			controlPanelWidth,
		};
	},

	addGraphPane(window) {
		let doc = window.document;
		this.cleanupExistingGraphPane(window, doc);

		let itemsContainer = doc.getElementById("zotero-items-pane-container");
		if (!itemsContainer) return;
		let refs = this.buildGraphPaneElements(window, doc, itemsContainer);
		this.storeAddedElement(refs.splitter);
		this.storeAddedElement(refs.pane);
		let toolbarToggleButton = this.ensureGraphWorkspaceToggleButton(window);
		let state = this.createGraphPaneState(window, refs, toolbarToggleButton, refs.controlPanelWidth);

		state.handlers = this.createGraphPaneHandlers(window);
		this.bindGraphPaneEvents(window, doc, state);
		this.finalizeGraphPaneMount(window, state);
	},

};

