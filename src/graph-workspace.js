var PaperRelationsGraphWorkspaceMixin = {
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
		return window?.document?.getElementById("paper-relations-graph-toggle-btn") || null;
	},

	ensureGraphWorkspaceToggleButton(window) {
		let doc = window?.document;
		if (!doc) return null;
		let toolbar = doc.getElementById("zotero-items-toolbar");
		if (!toolbar) return null;

		let button = this.getGraphWorkspaceToggleButton(window);
		if (!button) {
			button = doc.createXULElement("toolbarbutton");
			button.id = "paper-relations-graph-toggle-btn";
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

	applyGraphWorkspaceVisibilityToDOM(state) {
		if (!state) return;
		let graphVisible = state.graphVisible !== false;
		let applyElemVisibility = (elem, displayWhenVisible = "") => {
			if (!elem) return;
			elem.hidden = !graphVisible;
			if (graphVisible) {
				elem.removeAttribute("hidden");
				elem.removeAttribute("collapsed");
				if (displayWhenVisible) {
					elem.style.display = displayWhenVisible;
				}
				else {
					elem.style.removeProperty("display");
				}
			}
			else {
				elem.setAttribute("hidden", "true");
				elem.setAttribute("collapsed", "true");
				elem.style.display = "none";
			}
		};
		applyElemVisibility(state.pane, "flex");
		applyElemVisibility(state.splitter);
	},

	setGraphWorkspaceVisibility(window, visible) {
		let state = this.graphStates.get(window);
		if (!state) return;
		let nextVisible = !!visible;
		state.graphVisible = nextVisible;
		this.applyGraphWorkspaceVisibilityToDOM(state);
		if (!nextVisible) {
			this.hideGraphContextMenus(window);
			this.cancelNodeRename(window);
		}
		else {
			window.requestAnimationFrame(() => this.updateCanvasControlsLayout(window));
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
		this.renderGraph(window);
		this.refreshGraphChrome(window);
		this.notifyGraphSelectionChanged(window);
		window.requestAnimationFrame(() => {
			this.updateCanvasControlsLayout(window);
			window.requestAnimationFrame(() => this.updateCanvasControlsLayout(window));
		});
		window.setTimeout(() => this.updateCanvasControlsLayout(window), 80);
		window.setTimeout(() => this.updateCanvasControlsLayout(window), 220);

		let selectedItem = this.getCurrentSelectedItem(window);
		if (selectedItem) {
			this.selectionItemsByWindow.set(window, selectedItem);
			this.handlePrimaryItemChanged(window, selectedItem).catch((error) => Zotero.logError(error));
		}
	},

	cleanupExistingGraphPane(window, doc) {
		let existingPane = doc.getElementById("paper-relations-graph-pane");
		if (!existingPane) return;
		let existingState = this.graphStates?.get(window);
		this.unbindGraphPaneEvents(window, doc, existingState);
		this.clearGraphWorkspaceTogglePlacementTimers(existingState);
		this.graphStates?.delete(window);
		doc.getElementById("paper-relations-graph-splitter")?.remove();
		existingPane.remove();
	},

	createGraphPaneState(window, refs, toolbarToggleButton, controlPanelWidth) {
		return {
			window,
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
			toolbarToggleButton,
			controlPanelWidth,
			graphVisible: true,
			nodes: [],
			edges: [],
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
			anchorHoverRadiusPx: 14,
			altModifierPressed: false,
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
			lastClientX: 0,
			lastClientY: 0,
			contextMenuNodeID: null,
			renamingNodeID: null,
			renameFallbackTitle: "",
			renameSnapshot: null,
			renameBusy: false,
			suppressRenameInputBlur: false,
			togglePlacementTimerIDs: [],
			handlers: null,
		};
	},

	buildGraphPaneElements(window, doc, itemsContainer) {
		const XHTML_NS = "http://www.w3.org/1999/xhtml";
		const SVG_NS = "http://www.w3.org/2000/svg";

		let splitter = doc.createXULElement("splitter");
		splitter.id = "paper-relations-graph-splitter";
		splitter.setAttribute("orient", "vertical");
		splitter.setAttribute("collapse", "after");
		splitter.setAttribute("resizebefore", "closest");
		splitter.setAttribute("resizeafter", "closest");
		splitter.setAttribute("onmousemove", "ZoteroPane.updateLayoutConstraints()");
		splitter.setAttribute("oncommand", "ZoteroPane.updateLayoutConstraints()");
		splitter.appendChild(doc.createXULElement("grippy"));

		let pane = doc.createXULElement("vbox");
		pane.id = "paper-relations-graph-pane";
		pane.setAttribute("height", "250");

		let toolbar = doc.createElementNS(XHTML_NS, "div");
		toolbar.id = "paper-relations-graph-toolbar";

		let titleWrap = doc.createElementNS(XHTML_NS, "div");
		titleWrap.id = "paper-relations-graph-title-wrap";

		let header = doc.createElementNS(XHTML_NS, "div");
		header.id = "paper-relations-graph-header";
		let headerMain = doc.createElementNS(XHTML_NS, "span");
		headerMain.className = "paper-relations-graph-header-main";
		headerMain.textContent = "Relation Graph Workspace";
		let headerTemporaryHint = doc.createElementNS(XHTML_NS, "span");
		headerTemporaryHint.className = "paper-relations-graph-header-temporary-hint";
		headerTemporaryHint.textContent = "temporary topic";
		headerTemporaryHint.hidden = true;
		header.append(headerMain, headerTemporaryHint);

		let subheader = doc.createElementNS(XHTML_NS, "div");
		subheader.id = "paper-relations-graph-subheader";
		subheader.textContent = "Select an item to load topic graph";

		titleWrap.append(header, subheader);
		toolbar.append(titleWrap);

		let canvas = doc.createElementNS(XHTML_NS, "div");
		canvas.id = "paper-relations-graph-canvas";
		canvas.style.position = "relative";

		let svg = doc.createElementNS(SVG_NS, "svg");

		let defs = doc.createElementNS(SVG_NS, "defs");
		let marker = doc.createElementNS(SVG_NS, "marker");
		marker.setAttribute("id", "paper-relations-arrow");
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
		boardFill.setAttribute("id", "paper-relations-board-fill");
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
		gridPattern.setAttribute("id", "paper-relations-grid-pattern");
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
		viewport.setAttribute("id", "paper-relations-graph-viewport");
		let boardGroup = doc.createElementNS(SVG_NS, "g");
		boardGroup.setAttribute("class", "paper-relations-board");
		let boardBase = doc.createElementNS(SVG_NS, "rect");
		boardBase.setAttribute("class", "paper-relations-board-base");
		boardBase.setAttribute("x", "-5000");
		boardBase.setAttribute("y", "-5000");
		boardBase.setAttribute("width", "10000");
		boardBase.setAttribute("height", "10000");
		let boardGrid = doc.createElementNS(SVG_NS, "rect");
		boardGrid.setAttribute("class", "paper-relations-board-grid");
		boardGrid.setAttribute("x", "-5000");
		boardGrid.setAttribute("y", "-5000");
		boardGrid.setAttribute("width", "10000");
		boardGrid.setAttribute("height", "10000");
		boardGroup.append(boardBase, boardGrid);
		let edgesGroup = doc.createElementNS(SVG_NS, "g");
		edgesGroup.setAttribute("class", "paper-relations-edges");
		let nodesGroup = doc.createElementNS(SVG_NS, "g");
		nodesGroup.setAttribute("class", "paper-relations-nodes");
		let overlayGroup = doc.createElementNS(SVG_NS, "g");
		overlayGroup.setAttribute("class", "paper-relations-overlay");
		viewport.append(boardGroup, edgesGroup, nodesGroup, overlayGroup);
		svg.appendChild(viewport);

		let canvasControls = doc.createElementNS(SVG_NS, "g");
		canvasControls.setAttribute("class", "paper-relations-canvas-controls");
		canvasControls.setAttribute("aria-label", "graph workspace controls");
		const controlButtonSize = 28;
		const controlGap = 8;
		const controlPanelWidth = controlButtonSize * 2 + controlGap;
		const iconInset = 2;
		let appendIconImage = (button, fileName) => {
			let hitbox = doc.createElementNS(SVG_NS, "rect");
			hitbox.setAttribute("class", "paper-relations-canvas-btn-hitbox");
			hitbox.setAttribute("x", "0");
			hitbox.setAttribute("y", "0");
			hitbox.setAttribute("width", String(controlButtonSize));
			hitbox.setAttribute("height", String(controlButtonSize));
			hitbox.setAttribute("rx", "6");
			hitbox.setAttribute("ry", "6");
			let iconImage = doc.createElementNS(SVG_NS, "image");
			let href = `${this.rootURI}assets/${fileName}`;
			iconImage.setAttribute("class", "paper-relations-canvas-btn-icon-image");
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
		snapButton.setAttribute("class", "paper-relations-canvas-btn paper-relations-snap-btn");
		snapButton.setAttribute("data-control", "snap");
		snapButton.setAttribute("role", "button");
		snapButton.setAttribute("aria-label", "Toggle magnetic grid snapping");
		snapButton.setAttribute("transform", "translate(0 0)");
		appendIconImage(snapButton, "magnet-wave-svgrepo-com.svg");

		let pinButton = doc.createElementNS(SVG_NS, "g");
		pinButton.setAttribute("class", "paper-relations-canvas-btn paper-relations-pin-btn");
		pinButton.setAttribute("data-control", "pin");
		pinButton.setAttribute("role", "button");
		pinButton.setAttribute("aria-label", "Toggle pinned graph context");
		pinButton.setAttribute("transform", `translate(${controlButtonSize + controlGap} 0)`);
		appendIconImage(pinButton, "pin-svgrepo-com.svg");

		canvasControls.append(snapButton, pinButton);
		svg.appendChild(canvasControls);
		canvas.appendChild(svg);

		let nodeContextMenu = doc.createElementNS(XHTML_NS, "div");
		nodeContextMenu.className = "paper-relations-node-context-menu";
		nodeContextMenu.hidden = true;
		nodeContextMenu.style.position = "absolute";
		nodeContextMenu.style.zIndex = "8";
		nodeContextMenu.style.display = "none";
		let removeNodeBtn = doc.createElementNS(XHTML_NS, "button");
		removeNodeBtn.type = "button";
		removeNodeBtn.className = "paper-relations-node-context-item";
		removeNodeBtn.setAttribute("data-action", "remove");
		removeNodeBtn.textContent = this.getGraphWorkspaceText("nodeMenuRemove");
		let renameNodeBtn = doc.createElementNS(XHTML_NS, "button");
		renameNodeBtn.type = "button";
		renameNodeBtn.className = "paper-relations-node-context-item";
		renameNodeBtn.setAttribute("data-action", "rename");
		renameNodeBtn.textContent = this.getGraphWorkspaceText("nodeMenuRename");
		nodeContextMenu.append(removeNodeBtn, renameNodeBtn);
		canvas.appendChild(nodeContextMenu);

		let renameInput = doc.createElementNS(XHTML_NS, "input");
		renameInput.type = "text";
		renameInput.className = "paper-relations-node-rename-input";
		renameInput.hidden = true;
		renameInput.setAttribute("spellcheck", "false");
		renameInput.style.position = "absolute";
		renameInput.style.zIndex = "7";
		renameInput.style.textAlign = "center";
		canvas.appendChild(renameInput);

		let workspaceContextMenu = doc.createElementNS(XHTML_NS, "div");
		workspaceContextMenu.className = "paper-relations-node-context-menu paper-relations-workspace-context-menu";
		workspaceContextMenu.hidden = true;
		workspaceContextMenu.style.position = "absolute";
		workspaceContextMenu.style.zIndex = "8";
		workspaceContextMenu.style.display = "none";

		let workspaceCreateTopicFromSelectedBtn = doc.createElementNS(XHTML_NS, "button");
		workspaceCreateTopicFromSelectedBtn.type = "button";
		workspaceCreateTopicFromSelectedBtn.className = "paper-relations-node-context-item";
		workspaceCreateTopicFromSelectedBtn.setAttribute("data-action", "create-topic-from-selected");
		workspaceCreateTopicFromSelectedBtn.textContent = this.getGraphWorkspaceText("workspaceMenuCreateTopicFromSelected");

		let workspaceExportSVGBtn = doc.createElementNS(XHTML_NS, "button");
		workspaceExportSVGBtn.type = "button";
		workspaceExportSVGBtn.className = "paper-relations-node-context-item";
		workspaceExportSVGBtn.setAttribute("data-action", "export-svg");
		workspaceExportSVGBtn.textContent = this.getGraphWorkspaceText("workspaceMenuExportSVG");

		let workspaceExportJSONBtn = doc.createElementNS(XHTML_NS, "button");
		workspaceExportJSONBtn.type = "button";
		workspaceExportJSONBtn.className = "paper-relations-node-context-item";
		workspaceExportJSONBtn.setAttribute("data-action", "export-json");
		workspaceExportJSONBtn.textContent = this.getGraphWorkspaceText("workspaceMenuExportJSON");

		let workspaceSeparator = doc.createElementNS(XHTML_NS, "div");
		workspaceSeparator.className = "paper-relations-context-menu-separator";

		let workspaceRenameTopicBtn = doc.createElementNS(XHTML_NS, "button");
		workspaceRenameTopicBtn.type = "button";
		workspaceRenameTopicBtn.className = "paper-relations-node-context-item";
		workspaceRenameTopicBtn.setAttribute("data-action", "rename-topic");
		workspaceRenameTopicBtn.textContent = this.getGraphWorkspaceText("workspaceMenuRename");

		let workspaceDeleteTopicBtn = doc.createElementNS(XHTML_NS, "button");
		workspaceDeleteTopicBtn.type = "button";
		workspaceDeleteTopicBtn.className = "paper-relations-node-context-item";
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

		pane.append(toolbar, canvas);
		itemsContainer.append(splitter, pane);

		return {
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

	getCurrentSelectedItem(window) {
		let selected = window.ZoteroPane?.getSelectedItems?.();
		if (!selected || !selected.length) return null;
		return selected[0] || null;
	},

	getGraphContextSummary(window) {
		let state = this.graphStates.get(window);
		if (!state) {
			return {
				topicLabel: "Topic: (graph pane not ready)",
				topicStatus: "Pin: off | Snap: on",
			};
		}

		let label = "Topic: -";
		if (state.activeTopicName) {
			label = `Topic: ${state.activeTopicName}`;
			if (state.isTemporaryTopic) {
				label += " (temporary)";
			}
		}

		let status = state.isTemporaryTopic
			? "Temporary topic is not saved. Use the context menu to create a real topic."
			: (state.activeTopicID ? `Topic ID: ${state.activeTopicID}` : "No topic loaded");
		status += state.pinSelection ? " | Pin: on" : " | Pin: off";
		status += state.snapToGrid ? " | Snap: on" : " | Snap: off";
		return { topicLabel: label, topicStatus: status };
	},

	notifyGraphContextChanged(window) {
		window.dispatchEvent(new window.CustomEvent("paper-relations:graph-context-changed"));
	},

	canRemoveActiveTopic(window) {
		let state = this.graphStates.get(window);
		if (!state) return false;
		return !!(state.activeTopicID && state.activeLibraryID && !state.isTemporaryTopic);
	},

	refreshGraphChrome(window) {
		let state = this.graphStates.get(window);
		if (!state) return;

		let summary = this.getGraphContextSummary(window);
		let headerTitle = state.activeTopicName || "-";
		if (state.headerMain) {
			state.headerMain.textContent = headerTitle;
		}
		else {
			let fallbackTitle = summary.topicLabel.replace(/^Topic:\s*/, "").replace(/\s+\(temporary\)\s*$/, "");
			state.header.textContent = fallbackTitle;
		}
		if (state.headerTemporaryHint) {
			state.headerTemporaryHint.hidden = !state.isTemporaryTopic;
		}
		state.subheader.textContent = summary.topicStatus;
		this.setCanvasButtonVisual(state.pinButton, !!state.pinSelection);
		this.setCanvasButtonVisual(state.snapButton, !!state.snapToGrid);
		state.boardGrid.classList.remove("paper-relations-board-grid-disabled");
		this.updateCanvasControlsLayout(window);
		this.updateGraphWorkspaceToggleButton(window);
		this.placeGraphWorkspaceToggleButton(window, state.toolbarToggleButton);
		if (state.isTemporaryTopic) {
			state.canvas.classList.add("paper-relations-temporary-topic");
		}
		else {
			state.canvas.classList.remove("paper-relations-temporary-topic");
		}
	},

	setCanvasButtonVisual(button, active) {
		if (!button) return;
		let isActive = !!active;
		button.classList.toggle("active", isActive);
		button.style.opacity = isActive ? "1" : "0.3";
		let iconImage = button.querySelector(".paper-relations-canvas-btn-icon-image");
		if (iconImage) {
			iconImage.style.filter = isActive
				? "grayscale(1) brightness(0.48) contrast(0.95)"
				: "grayscale(1) brightness(1.04)";
		}
		let fillColor = isActive ? "#313a43" : "#9aa6b2";
		for (let elem of button.querySelectorAll(".paper-relations-canvas-btn-icon-fill")) {
			elem.style.fill = fillColor;
		}

		let strokeColor = isActive ? "#313a43" : "#9aa6b2";
		for (let elem of button.querySelectorAll(".paper-relations-canvas-btn-icon-stroke")) {
			elem.style.fill = "none";
			elem.style.stroke = strokeColor;
			elem.style.strokeWidth = "1.8";
			elem.style.strokeLinecap = "round";
			elem.style.strokeLinejoin = "round";
		}
	},

	updateCanvasControlsLayout(window) {
		let state = this.graphStates.get(window);
		if (!state) return;
		let rect = state.svg.getBoundingClientRect();
		let width = Number.isFinite(rect.width) ? rect.width : 0;
		let x = Math.max(10, width - 10 - state.controlPanelWidth);
		state.canvasControls.setAttribute("transform", `translate(${x} 10)`);
	},

	onCanvasControlMouseDown(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		event.preventDefault();
		event.stopPropagation();
	},

	onPinButtonToggle(window) {
		let state = this.graphStates.get(window);
		if (!state) return;
		state.pinSelection = !state.pinSelection;
		this.refreshGraphChrome(window);
		this.notifyGraphContextChanged(window);
	},

	onSnapButtonToggle(window) {
		let state = this.graphStates.get(window);
		if (!state) return;
		state.snapToGrid = !state.snapToGrid;
		this.refreshGraphChrome(window);
		this.notifyGraphContextChanged(window);
	},

	isSavedTopicMutableState(state) {
		return !!(state?.activeTopicID && state?.activeLibraryID && !state?.isTemporaryTopic);
	},

	getNodeByID(state, nodeID) {
		if (!state?.nodes?.length || !nodeID) return null;
		return state.nodes.find((node) => node.id === nodeID) || null;
	},

	getNodeIDFromEventTarget(target) {
		let current = target;
		while (current) {
			if (typeof current.getAttribute === "function") {
				let nodeID = current.getAttribute("data-node-id");
				if (nodeID) {
					return nodeID;
				}
			}
			current = current.parentNode;
		}
		return null;
	},

	getNodeAtClient(window, clientX, clientY) {
		let state = this.graphStates.get(window);
		if (!state?.nodes?.length) return null;
		let point = this.clientToGraphPoint(state, clientX, clientY);
		for (let i = state.nodes.length - 1; i >= 0; i--) {
			let node = state.nodes[i];
			let width = Number.isFinite(node.renderWidth) ? node.renderWidth : this.getNodeRenderMetrics(node).width;
			let height = Number.isFinite(node.renderHeight) ? node.renderHeight : this.getNodeRenderMetrics(node).height;
			if (
				point.x >= node.x &&
				point.x <= node.x + width &&
				point.y >= node.y &&
				point.y <= node.y + height
			) {
				return node;
			}
		}
		return null;
	},

	isTargetInsideElement(target, rootElem) {
		if (!target || !rootElem) return false;
		let current = target;
		while (current) {
			if (current === rootElem) return true;
			current = current.parentNode;
		}
		return false;
	},

	isClientPointInsideElementRect(elem, clientX, clientY) {
		if (!elem || elem.hidden || elem.style?.display === "none") return false;
		if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
		let rect = elem.getBoundingClientRect();
		if (!(rect.width > 0 && rect.height > 0)) return false;
		return (
			clientX >= rect.left &&
			clientX <= rect.right &&
			clientY >= rect.top &&
			clientY <= rect.bottom
		);
	},

	async removeNodeFromActiveTopic(window, nodeID) {
		let state = this.graphStates.get(window);
		if (!state || !nodeID || !this.isSavedTopicMutableState(state)) return;
		let topicID = state.activeTopicID;
		let libraryID = state.activeLibraryID;
		if (!topicID || !libraryID) return;
		if (state.renamingNodeID === nodeID) {
			this.cancelNodeRename(window);
		}

		try {
			let removed = await this.removeNode(libraryID, topicID, nodeID);
			if (!removed) return;
			let updatedTopic = await this.getTopic(libraryID, topicID);
			let selectedItem = this.selectionItemsByWindow.get(window) || this.getCurrentSelectedItem(window);
			if (updatedTopic) {
				this.applyTopicToGraphState(window, updatedTopic, selectedItem);
				this.refreshGraphChrome(window);
				this.notifyGraphSelectionChanged(window);
				this.notifyGraphContextChanged(window);
			}
			else {
				await this.handlePrimaryItemChanged(window, selectedItem, { force: true });
			}
		}
		catch (error) {
			Zotero.logError(error);
			Services.prompt.alert(
				window,
				this.getGraphWorkspaceText("removeNodeFailedTitle"),
				String(error?.message || error),
			);
		}
	},

	async handlePrimaryItemChanged(window, item, options = {}) {
		let state = this.graphStates.get(window);
		if (!state) return;

		let force = !!options.force;
		if (!item) {
			this.hideGraphContextMenus(window);
			this.finishNodeRename(window, { restoreNode: false, render: false });
			if (!state.pinSelection || force) {
				state.activeTopicID = null;
				state.activeLibraryID = null;
				state.activeTopicName = "";
				state.activeItemKey = null;
				state.activeItemLibraryID = null;
				state.isTemporaryTopic = false;
				state.nodes = [];
				state.edges = [];
				state.selectedNodeID = null;
				state.hoverAnchor = null;
				state.edgeDraft = null;
				state.edgeCutDraft = null;
				this.renderGraph(window);
			}
			this.refreshGraphChrome(window);
			this.notifyGraphSelectionChanged(window);
			this.notifyGraphContextChanged(window);
			return;
		}

		let itemLibraryID = item.libraryID || Zotero.Libraries.userLibraryID;
		state.activeItemKey = item.key;
		state.activeItemLibraryID = itemLibraryID;

		if (state.pinSelection && !force) {
			this.refreshGraphChrome(window);
			this.notifyGraphContextChanged(window);
			return;
		}

		let topics = await this.getTopicsForItem(itemLibraryID, item.key);
		if (topics.length) {
			this.applyTopicToGraphState(window, topics[0], item);
		}
		else {
			this.applyTemporaryTopicForItem(window, item);
		}
		this.refreshGraphChrome(window);
		this.notifyGraphSelectionChanged(window);
		this.notifyGraphContextChanged(window);
	},

	applyTopicToGraphState(window, topic, selectedItem = null) {
		let state = this.graphStates.get(window);
		if (!state || !topic) return;
		this.hideGraphContextMenus(window);
		this.finishNodeRename(window, { restoreNode: false, render: false });

		let selectedItemRef = selectedItem ? this.getItemRef(selectedItem.libraryID, selectedItem.key) : null;
		let nodes = Object.values(topic.nodes).map((node) => {
			let itemRef = this.getItemRef(node.libraryID, node.itemKey);
			let displayLabel = this.getNodeLabelForDisplay(node);
			return {
				id: node.id,
				itemKey: node.itemKey,
				libraryID: node.libraryID,
				title: node.title || node.itemKey,
				label: displayLabel,
				x: Number.isFinite(node.x) ? node.x : 80,
				y: Number.isFinite(node.y) ? node.y : 120,
				width: this.getNodeWidthForLabel(displayLabel),
				height: this.nodeDefaultHeight,
				kind: selectedItemRef && selectedItemRef === itemRef ? "root" : "leaf",
			};
		});

		let edges = Object.values(topic.edges)
			.filter((edge) => topic.nodes[edge.fromNodeID] && topic.nodes[edge.toNodeID])
			.map((edge) => ({
				id: edge.id,
				from: edge.fromNodeID,
				to: edge.toNodeID,
				type: edge.type || "related",
			}));

		state.nodes = nodes;
		state.edges = edges;
		state.activeTopicID = topic.id;
		state.activeLibraryID = topic.libraryID;
		state.activeTopicName = topic.name || "Untitled Topic";
		state.isTemporaryTopic = false;
		state.selectedNodeID = null;
		state.hoverAnchor = null;
		state.edgeDraft = null;
		state.edgeCutDraft = null;
		if (selectedItemRef) {
			let selectedNode = nodes.find((node) => this.getItemRef(node.libraryID, node.itemKey) === selectedItemRef);
			if (selectedNode) {
				state.selectedNodeID = selectedNode.id;
			}
		}
		this.renderGraph(window);
	},

	applyTemporaryTopicForItem(window, item) {
		let state = this.graphStates.get(window);
		if (!state || !item) return;
		this.hideGraphContextMenus(window);
		this.finishNodeRename(window, { restoreNode: false, render: false });
		let title = this.getItemTitle(item);
		let label = this.getNodeLabelForDisplay({
			libraryID: item.libraryID,
			itemKey: item.key,
			title,
		});
		let nodeID = `temp_${item.libraryID}_${item.key}`;
		state.nodes = [{
			id: nodeID,
			itemKey: item.key,
			libraryID: item.libraryID,
			title,
			label,
			x: 120,
			y: 100,
			width: this.getNodeWidthForLabel(label),
			height: this.nodeDefaultHeight,
			kind: "root",
		}];
		state.edges = [];
		state.activeTopicID = null;
		state.activeLibraryID = item.libraryID;
		state.activeTopicName = title;
		state.isTemporaryTopic = true;
		state.selectedNodeID = nodeID;
		state.hoverAnchor = null;
		state.edgeDraft = null;
		state.edgeCutDraft = null;
		this.renderGraph(window);
	},

	promptTopicNameInput(window, dialogTitle, defaultName) {
		let input = {
			value: String(defaultName || ""),
		};
		let accepted = Services.prompt.prompt(
			window,
			dialogTitle,
			"Topic name:",
			input,
			null,
			{},
		);
		if (!accepted) return null;
		return input.value;
	},

	async promptCreateTopicFromItem(window, explicitItem = null) {
		let state = this.graphStates.get(window);
		if (!state) return;
		let item = explicitItem || this.selectionItemsByWindow.get(window) || this.getCurrentSelectedItem(window);
		if (!item) return;

		try {
			let defaultName = this.getItemTitle(item);
			let inputName = this.promptTopicNameInput(window, "Create Topic", defaultName);
			if (inputName === null) return;
			let topic = await this.createTopic(item.libraryID, {
				name: inputName || defaultName,
				centerItem: item,
			});
			let savedTopic = await this.getTopic(item.libraryID, topic.id);
			if (!savedTopic) {
				throw new Error("Topic created but not found in storage");
			}
			this.applyTopicToGraphState(window, savedTopic, item);
			this.refreshGraphChrome(window);
			this.notifyGraphSelectionChanged(window);
			this.notifyGraphContextChanged(window);
		}
		catch (error) {
			Zotero.logError(error);
			Services.prompt.alert(window, "Create Topic Failed", String(error?.message || error));
		}
	},

	async promptRenameActiveTopic(window) {
		let state = this.graphStates.get(window);
		if (!state || !this.canRemoveActiveTopic(window)) return;
		let defaultName = state.activeTopicName || "Untitled Topic";
		let inputName = this.promptTopicNameInput(window, "Rename Topic", defaultName);
		if (inputName === null) return;
		let nextName = String(inputName || "").trim();
		if (!nextName) return;

		try {
			let updated = await this.updateTopic(state.activeLibraryID, state.activeTopicID, {
				name: nextName,
			});
			if (!updated) {
				throw new Error("Topic not found");
			}
			state.activeTopicName = updated.name || nextName;
			this.refreshGraphChrome(window);
			this.notifyGraphContextChanged(window);
		}
		catch (error) {
			Zotero.logError(error);
			Services.prompt.alert(window, "Rename Topic Failed", String(error?.message || error));
		}
	},

	async promptRemoveActiveTopic(window, explicitItem = null) {
		let state = this.graphStates.get(window);
		if (!state || !this.canRemoveActiveTopic(window)) return;

		let topicName = state.activeTopicName || "this topic";
		let confirmed = Services.prompt.confirm(
			window,
			"Remove Topic",
			`Remove topic \"${topicName}\"? This operation cannot be undone.`,
		);
		if (!confirmed) return;

		try {
			await this.deleteTopic(state.activeLibraryID, state.activeTopicID);
			let item = explicitItem || this.selectionItemsByWindow.get(window) || this.getCurrentSelectedItem(window);
			await this.handlePrimaryItemChanged(window, item, { force: true });
		}
		catch (error) {
			Zotero.logError(error);
			Services.prompt.alert(window, "Remove Topic Failed", String(error?.message || error));
		}
	},

	canDataTransferContainZoteroItems(dataTransfer) {
		if (!dataTransfer) return false;
		let types = dataTransfer.types;
		if (!types) return false;
		if (typeof types.contains === "function") {
			return types.contains("zotero/item");
		}
		return Array.from(types).includes("zotero/item");
	},

	parseDraggedItemIDs(dataTransfer) {
		if (!dataTransfer) return [];
		let raw = dataTransfer.getData("zotero/item");
		if (!raw) return [];
		return String(raw)
			.split(",")
			.map((value) => parseInt(value, 10))
			.filter((value) => Number.isInteger(value) && value > 0);
	},

	onGraphDragOver(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		if (!this.canDataTransferContainZoteroItems(event.dataTransfer)) return;
		if (!state.activeTopicID || state.isTemporaryTopic || !state.activeLibraryID) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
		state.canvas.classList.add("paper-relations-drop-active");
	},

	onGraphDragLeave(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		if (!event.currentTarget?.contains(event.relatedTarget)) {
			state.canvas.classList.remove("paper-relations-drop-active");
		}
	},

	async onGraphDrop(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		state.canvas.classList.remove("paper-relations-drop-active");
		if (!this.canDataTransferContainZoteroItems(event.dataTransfer)) return;
		if (!state.activeTopicID || state.isTemporaryTopic || !state.activeLibraryID) return;

		event.preventDefault();
		let itemIDs = this.parseDraggedItemIDs(event.dataTransfer);
		if (!itemIDs.length) return;

		let added = false;
		for (let itemID of itemIDs) {
			let item = await Zotero.Items.getAsync(itemID);
			if (!item || !item.isRegularItem?.()) continue;
			if (item.libraryID !== state.activeLibraryID) continue;
			let exists = state.nodes.some((node) => node.itemKey === item.key && node.libraryID === item.libraryID);
			if (exists) continue;
			let node = await this.addNode(state.activeLibraryID, state.activeTopicID, {
				itemKey: item.key,
				title: this.getItemTitle(item),
			});
			if (node) added = true;
		}

		if (!added) return;
		let updatedTopic = await this.getTopic(state.activeLibraryID, state.activeTopicID);
		if (!updatedTopic) return;
		let selectedItem = this.selectionItemsByWindow.get(window) || this.getCurrentSelectedItem(window);
		this.applyTopicToGraphState(window, updatedTopic, selectedItem);
		this.refreshGraphChrome(window);
		this.notifyGraphSelectionChanged(window);
		this.notifyGraphContextChanged(window);
	},

};

