var PaperRelationsGraphWorkspaceMixin = {
	addGraphPane(window) {
		let doc = window.document;
		let existingPane = doc.getElementById("paper-relations-graph-pane");
		if (existingPane) {
			let existingState = this.graphStates?.get(window);
			if (existingState?.handlers) {
				existingState.svg?.removeEventListener("wheel", existingState.handlers.wheel);
				existingState.svg?.removeEventListener("mousedown", existingState.handlers.mousedown);
				existingState.svg?.removeEventListener("contextmenu", existingState.handlers.contextmenu);
				window.removeEventListener("mousemove", existingState.handlers.mousemove);
				window.removeEventListener("mouseup", existingState.handlers.mouseup);
				window.removeEventListener("keydown", existingState.handlers.keydown);
				window.removeEventListener("keyup", existingState.handlers.keyup);
				window.removeEventListener("blur", existingState.handlers.blur);
				existingState.canvas?.removeEventListener("dragover", existingState.handlers.dragover);
				existingState.canvas?.removeEventListener("drop", existingState.handlers.drop);
				existingState.canvas?.removeEventListener("dragleave", existingState.handlers.dragleave);
				existingState.pinButton?.removeEventListener("mousedown", existingState.handlers.controlmousedown);
				existingState.snapButton?.removeEventListener("mousedown", existingState.handlers.controlmousedown);
				existingState.pinButton?.removeEventListener("click", existingState.handlers.pinbtnclick);
				existingState.snapButton?.removeEventListener("click", existingState.handlers.snapbtnclick);
				window.removeEventListener("resize", existingState.handlers.resize);
			}
			this.graphStates?.delete(window);
			doc.getElementById("paper-relations-graph-splitter")?.remove();
			existingPane.remove();
		}

		let itemsContainer = doc.getElementById("zotero-items-pane-container");
		if (!itemsContainer) return;

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
		header.textContent = "Relation Graph Workspace";

		let subheader = doc.createElementNS(XHTML_NS, "div");
		subheader.id = "paper-relations-graph-subheader";
		subheader.textContent = "Select an item to load topic graph";

		titleWrap.append(header, subheader);
		toolbar.append(titleWrap);

		let canvas = doc.createElementNS(XHTML_NS, "div");
		canvas.id = "paper-relations-graph-canvas";

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

		pane.append(toolbar, canvas);
		itemsContainer.append(splitter, pane);

		this.storeAddedElement(splitter);
		this.storeAddedElement(pane);

		let state = {
			window,
			canvas,
			header,
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
			controlPanelWidth,
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
			handlers: null,
		};

		state.handlers = {
			wheel: (event) => this.onGraphWheel(window, event),
			mousedown: (event) => this.onGraphMouseDown(window, event),
			contextmenu: (event) => this.onGraphContextMenu(window, event),
			mousemove: (event) => this.onGraphMouseMove(window, event),
			mouseup: (event) => this.onGraphMouseUp(window, event),
			keydown: (event) => this.onWindowKeyStateChange(window, event),
			keyup: (event) => this.onWindowKeyStateChange(window, event),
			blur: () => this.onWindowBlur(window),
			dragover: (event) => this.onGraphDragOver(window, event),
			drop: (event) => this.onGraphDrop(window, event),
			dragleave: (event) => this.onGraphDragLeave(window, event),
			controlmousedown: (event) => this.onCanvasControlMouseDown(window, event),
			pinbtnclick: () => this.onPinButtonToggle(window),
			snapbtnclick: () => this.onSnapButtonToggle(window),
			resize: () => this.updateCanvasControlsLayout(window),
		};

		svg.addEventListener("wheel", state.handlers.wheel, { passive: false });
		svg.addEventListener("mousedown", state.handlers.mousedown);
		svg.addEventListener("contextmenu", state.handlers.contextmenu);
		window.addEventListener("mousemove", state.handlers.mousemove);
		window.addEventListener("mouseup", state.handlers.mouseup);
		window.addEventListener("keydown", state.handlers.keydown);
		window.addEventListener("keyup", state.handlers.keyup);
		window.addEventListener("blur", state.handlers.blur);
		canvas.addEventListener("dragover", state.handlers.dragover);
		canvas.addEventListener("drop", state.handlers.drop);
		canvas.addEventListener("dragleave", state.handlers.dragleave);
		pinButton.addEventListener("mousedown", state.handlers.controlmousedown);
		snapButton.addEventListener("mousedown", state.handlers.controlmousedown);
		pinButton.addEventListener("click", state.handlers.pinbtnclick);
		snapButton.addEventListener("click", state.handlers.snapbtnclick);
		window.addEventListener("resize", state.handlers.resize);

		this.graphStates.set(window, state);
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
			? "Temporary topic is not saved. Use the button to create a real topic."
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
		state.header.textContent = summary.topicLabel.replace(/^Topic:\s*/, "");
		state.subheader.textContent = summary.topicStatus;
		this.setCanvasButtonVisual(state.pinButton, !!state.pinSelection);
		this.setCanvasButtonVisual(state.snapButton, !!state.snapToGrid);
		state.boardGrid.classList.remove("paper-relations-board-grid-disabled");
		this.updateCanvasControlsLayout(window);
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

	async handlePrimaryItemChanged(window, item, options = {}) {
		let state = this.graphStates.get(window);
		if (!state) return;

		let force = !!options.force;
		if (!item) {
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

		let selectedItemRef = selectedItem ? this.getItemRef(selectedItem.libraryID, selectedItem.key) : null;
		let nodes = Object.values(topic.nodes).map((node) => {
			let itemRef = this.getItemRef(node.libraryID, node.itemKey);
			return {
				id: node.id,
				itemKey: node.itemKey,
				libraryID: node.libraryID,
				title: node.title || node.itemKey,
				label: node.shortLabel || node.title || node.itemKey,
				x: Number.isFinite(node.x) ? node.x : 80,
				y: Number.isFinite(node.y) ? node.y : 120,
				width: this.getNodeWidthForLabel(node.shortLabel || node.title || node.itemKey),
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
		let title = this.getItemTitle(item);
		let nodeID = `temp_${item.libraryID}_${item.key}`;
		state.nodes = [{
			id: nodeID,
			itemKey: item.key,
			libraryID: item.libraryID,
			title,
			label: title,
			x: 120,
			y: 100,
			width: this.getNodeWidthForLabel(title),
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

	async promptCreateTopicFromItem(window, explicitItem = null) {
		let state = this.graphStates.get(window);
		if (!state) return;
		let item = explicitItem || this.selectionItemsByWindow.get(window) || this.getCurrentSelectedItem(window);
		if (!item) return;

		try {
			let defaultName = this.getItemTitle(item);
			let inputName = window.prompt("Topic name:", defaultName);
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

	renderGraph(window) {
		let state = this.graphStates.get(window);
		if (!state) return;

		let { nodes, edges, edgesGroup, nodesGroup, overlayGroup } = state;
		let doc = window.document;
		const SVG_NS = "http://www.w3.org/2000/svg";

		edgesGroup.replaceChildren();
		nodesGroup.replaceChildren();
		overlayGroup.replaceChildren();

		for (let node of nodes) {
			let metrics = this.getNodeRenderMetrics(node);
			let width = metrics.width;
			let height = metrics.height;
			let labelLines = metrics.labelLines;
			node.renderWidth = width;
			node.renderHeight = height;
			node.renderLabelLines = labelLines;
		}

		for (let edge of edges) {
			let fromNode = nodes.find((n) => n.id === edge.from);
			let toNode = nodes.find((n) => n.id === edge.to);
			if (!fromNode || !toNode) continue;
			let path = doc.createElementNS(SVG_NS, "path");
			path.setAttribute("class", "paper-relations-edge");
			path.setAttribute("d", this.buildBezierPath(fromNode, toNode));
			edgesGroup.appendChild(path);
		}

		if (state.edgeDraft?.startAnchor && state.edgeDraft?.pointer) {
			let draftEnd = state.edgeDraft.targetAnchor || state.edgeDraft.pointer;
			let draftPath = this.buildBezierPathByAnchors(
				state.edgeDraft.startAnchor,
				draftEnd,
			);
			if (draftPath) {
				let path = doc.createElementNS(SVG_NS, "path");
				path.setAttribute("class", "paper-relations-edge paper-relations-edge-draft");
				path.setAttribute("d", draftPath);
				if (state.edgeDraft.startAnchor.side === "right") {
					path.setAttribute("marker-end", "url(#paper-relations-arrow)");
				}
				else if (state.edgeDraft.startAnchor.side === "left") {
					path.setAttribute("marker-start", "url(#paper-relations-arrow)");
				}
				overlayGroup.appendChild(path);
			}
		}

		if (state.edgeCutDraft?.start && state.edgeCutDraft?.end) {
			let cutLine = doc.createElementNS(SVG_NS, "line");
			cutLine.setAttribute("class", "paper-relations-edge-cut-preview");
			cutLine.setAttribute("x1", String(state.edgeCutDraft.start.x));
			cutLine.setAttribute("y1", String(state.edgeCutDraft.start.y));
			cutLine.setAttribute("x2", String(state.edgeCutDraft.end.x));
			cutLine.setAttribute("y2", String(state.edgeCutDraft.end.y));
			cutLine.setAttribute("stroke", "#1a1a1a");
			cutLine.setAttribute("stroke-width", "2");
			cutLine.setAttribute("stroke-linecap", "round");
			cutLine.setAttribute("stroke-dasharray", "6 5");
			cutLine.setAttribute("opacity", "0.82");
			cutLine.setAttribute("fill", "none");
			overlayGroup.appendChild(cutLine);

			let scissorsPathD = "M 8.7834 25.4035 C 12.8692 25.4035 13.5247 23.7211 15.3382 23.7211 C 15.7533 23.7211 16.0592 23.8085 16.6055 24.0707 L 20.3199 26.0371 C 20.7569 26.2775 21.1283 26.4960 21.4342 26.6926 L 21.5653 26.6926 C 22.0678 24.8573 22.8762 23.6774 24.2746 22.8034 L 24.2746 22.6723 L 19.2930 20.0286 C 17.7416 19.1983 17.6105 18.5209 17.6105 16.5763 C 17.6105 11.6384 13.6777 7.7055 8.7834 7.7055 C 3.9110 7.7055 0 11.6603 0 16.5763 C 0 21.4706 3.9110 25.4035 8.7834 25.4035 Z M 8.7834 21.8420 C 5.9212 21.8420 3.5833 19.4604 3.5833 16.5763 C 3.5833 13.6267 5.9212 11.2888 8.7834 11.2888 C 11.7331 11.2888 14.0491 13.6267 14.0491 16.5763 C 14.0491 19.4604 11.7331 21.8420 8.7834 21.8420 Z M 8.7834 50.2680 C 13.6777 50.2680 17.6105 46.3352 17.6105 41.3972 C 17.6105 39.5837 17.6980 38.8627 19.0308 38.1417 L 56.0000 18.4991 C 55.1042 15.2217 51.5427 14.6536 46.1023 16.5982 L 27.4428 23.3060 C 24.8208 24.2455 23.7065 25.5346 22.9855 27.9599 L 22.5485 29.5548 C 22.2208 30.6910 21.7182 31.2591 20.0140 32.1331 L 16.6055 33.9247 C 16.0592 34.2088 15.7533 34.2962 15.3382 34.2962 C 13.5247 34.2962 12.8692 32.5919 8.7834 32.5919 C 3.9110 32.5919 0 36.5248 0 41.3972 C 0 46.3133 3.9110 50.2680 8.7834 50.2680 Z M 27.9453 29.6423 C 26.9621 29.6423 26.1100 28.8338 26.1100 27.8288 C 26.1100 26.7800 26.9621 25.9934 27.9453 25.9934 C 28.9503 25.9934 29.8025 26.7800 29.8025 27.8288 C 29.8025 28.8338 28.9503 29.6423 27.9453 29.6423 Z M 46.1023 41.4409 C 51.5861 43.4729 55.1042 42.8174 56.0000 39.4526 L 38.2145 30.0574 L 29.1907 34.7987 L 29.1907 35.0609 Z M 8.7834 46.6847 C 5.9212 46.6847 3.5833 44.3469 3.5833 41.3972 C 3.5833 38.5131 5.9212 36.1534 8.7834 36.1534 C 11.7331 36.1534 14.0491 38.5131 14.0491 41.3972 C 14.0491 44.3469 11.7331 46.6847 8.7834 46.6847 Z";
			let scissorsSize = 18;
			let scissorsOffsetX = 8;
			let scissorsOffsetY = -18;
			let scissorsGroup = doc.createElementNS(SVG_NS, "g");
			scissorsGroup.setAttribute("class", "paper-relations-edge-cut-scissors");
			scissorsGroup.setAttribute(
				"transform",
				`translate(${state.edgeCutDraft.start.x + scissorsOffsetX} ${state.edgeCutDraft.start.y + scissorsOffsetY}) scale(${scissorsSize / 56})`,
			);
			let scissorsPath = doc.createElementNS(SVG_NS, "path");
			scissorsPath.setAttribute("d", scissorsPathD);
			scissorsPath.setAttribute("fill", "#101214");
			scissorsGroup.appendChild(scissorsPath);
			overlayGroup.appendChild(scissorsGroup);
		}

		for (let node of nodes) {
			let group = doc.createElementNS(SVG_NS, "g");
			let selectedClass = state.selectedNodeID === node.id ? " selected" : "";
			group.setAttribute("class", `paper-relations-node ${node.kind}${selectedClass}`);
			group.setAttribute("data-node-id", node.id);
			group.setAttribute("transform", `translate(${node.x},${node.y})`);
			let width = node.renderWidth;
			let height = node.renderHeight;
			let labelLines = node.renderLabelLines || this.wrapNodeLabel(node.label, width);
			let textBlockHeight = labelLines.length * this.nodeLineHeight;

			let rect = doc.createElementNS(SVG_NS, "rect");
			rect.setAttribute("width", String(width));
			rect.setAttribute("height", String(height));
			rect.setAttribute("rx", "10");
			rect.setAttribute("ry", "10");

			let titleElem = doc.createElementNS(SVG_NS, "title");
			titleElem.textContent = node.label || "";

			let text = doc.createElementNS(SVG_NS, "text");
			text.setAttribute("x", String(width / 2));
			let firstLineY = (height - textBlockHeight) / 2 + this.nodeLineHeight * 0.78;
			text.setAttribute("y", String(firstLineY));
			text.setAttribute("text-anchor", "middle");
			for (let i = 0; i < labelLines.length; i++) {
				let tspan = doc.createElementNS(SVG_NS, "tspan");
				tspan.setAttribute("x", String(width / 2));
				if (i > 0) {
					tspan.setAttribute("dy", String(this.nodeLineHeight));
				}
				tspan.textContent = labelLines[i];
				text.appendChild(tspan);
			}

			let leftAnchor = doc.createElementNS(SVG_NS, "circle");
			leftAnchor.setAttribute("class", "paper-relations-node-anchor");
			leftAnchor.setAttribute("data-anchor-side", "left");
			leftAnchor.setAttribute("cx", "0");
			leftAnchor.setAttribute("cy", String(height / 2));
			leftAnchor.setAttribute("r", "4");
			if (this.isAnchorVisibleInState(state, node.id, "left")) {
				leftAnchor.classList.add("active");
			}

			let rightAnchor = doc.createElementNS(SVG_NS, "circle");
			rightAnchor.setAttribute("class", "paper-relations-node-anchor");
			rightAnchor.setAttribute("data-anchor-side", "right");
			rightAnchor.setAttribute("cx", String(width));
			rightAnchor.setAttribute("cy", String(height / 2));
			rightAnchor.setAttribute("r", "4");
			if (this.isAnchorVisibleInState(state, node.id, "right")) {
				rightAnchor.classList.add("active");
			}

			group.append(rect, titleElem, text, leftAnchor, rightAnchor);
			nodesGroup.appendChild(group);
		}

		this.applyAnchorVisibilityToDOM(state);
		this.updateGraphTransform(state);
		this.updateCanvasControlsLayout(window);
	},

	buildBezierPath(fromNode, toNode) {
		let fromWidth = Number.isFinite(fromNode.renderWidth) ? fromNode.renderWidth :
			(Number.isFinite(fromNode.width) ? fromNode.width : this.nodeDefaultWidth);
		let fromHeight = Number.isFinite(fromNode.renderHeight) ? fromNode.renderHeight :
			(Number.isFinite(fromNode.height) ? fromNode.height : this.nodeDefaultHeight);
		let toHeight = Number.isFinite(toNode.renderHeight) ? toNode.renderHeight :
			(Number.isFinite(toNode.height) ? toNode.height : this.nodeDefaultHeight);
		let startX = fromNode.x + fromWidth;
		let startY = fromNode.y + fromHeight / 2;
		let endX = toNode.x;
		let endY = toNode.y + toHeight / 2;
		let curve = this.getBezierCurveByEndpoints(startX, startY, endX, endY);
		return this.buildBezierPathFromCurve(curve);
	},

	buildBezierPathFromCurve(curve) {
		if (!curve) return "";
		return `M ${curve.start.x} ${curve.start.y} C ${curve.c1.x} ${curve.c1.y}, ${curve.c2.x} ${curve.c2.y}, ${curve.end.x} ${curve.end.y}`;
	},

	getBezierCurveByEndpoints(startX, startY, endX, endY) {
		let dx = endX - startX;
		let absDx = Math.abs(dx);
		let outCurve = Math.max(72, absDx * 0.45);
		let inCurve = Math.max(72, absDx * 0.45);
		if (dx < 0) {
			// For backward links, keep both endpoint tangents rightward and route with a wrap-around arc.
			outCurve = Math.max(outCurve, 92 + absDx * 0.36);
			inCurve = Math.max(inCurve, 82 + absDx * 0.24);
		}
		let c1x = startX + outCurve;
		let c2x = endX - inCurve;
		return {
			start: { x: startX, y: startY },
			c1: { x: c1x, y: startY },
			c2: { x: c2x, y: endY },
			end: { x: endX, y: endY },
		};
	},

	buildBezierPathByAnchors(startAnchor, endPoint) {
		if (!startAnchor || !endPoint) return "";
		let startX = startAnchor.x;
		let startY = startAnchor.y;
		let endX = endPoint.x;
		let endY = endPoint.y;
		return this.buildBezierPathFromCurve(this.getBezierCurveByEndpoints(startX, startY, endX, endY));
	},

	getBezierCurveForEdgeNodes(fromNode, toNode) {
		if (!fromNode || !toNode) return null;
		let fromWidth = Number.isFinite(fromNode.renderWidth) ? fromNode.renderWidth :
			(Number.isFinite(fromNode.width) ? fromNode.width : this.nodeDefaultWidth);
		let fromHeight = Number.isFinite(fromNode.renderHeight) ? fromNode.renderHeight :
			(Number.isFinite(fromNode.height) ? fromNode.height : this.nodeDefaultHeight);
		let toHeight = Number.isFinite(toNode.renderHeight) ? toNode.renderHeight :
			(Number.isFinite(toNode.height) ? toNode.height : this.nodeDefaultHeight);
		return this.getBezierCurveByEndpoints(
			fromNode.x + fromWidth,
			fromNode.y + fromHeight / 2,
			toNode.x,
			toNode.y + toHeight / 2,
		);
	},

	getPointOnCubicBezier(curve, t) {
		let inv = 1 - t;
		let x = inv * inv * inv * curve.start.x
			+ 3 * inv * inv * t * curve.c1.x
			+ 3 * inv * t * t * curve.c2.x
			+ t * t * t * curve.end.x;
		let y = inv * inv * inv * curve.start.y
			+ 3 * inv * inv * t * curve.c1.y
			+ 3 * inv * t * t * curve.c2.y
			+ t * t * t * curve.end.y;
		return { x, y };
	},

	isPointOnSegment(point, a, b, epsilon = 1e-6) {
		return (
			point.x <= Math.max(a.x, b.x) + epsilon &&
			point.x + epsilon >= Math.min(a.x, b.x) &&
			point.y <= Math.max(a.y, b.y) + epsilon &&
			point.y + epsilon >= Math.min(a.y, b.y)
		);
	},

	getOrientation(a, b, c, epsilon = 1e-6) {
		let value = (b.y - a.y) * (c.x - a.x) - (b.x - a.x) * (c.y - a.y);
		if (Math.abs(value) <= epsilon) return 0;
		return value > 0 ? 1 : -1;
	},

	doSegmentsIntersect(a1, a2, b1, b2, epsilon = 1e-6) {
		let o1 = this.getOrientation(a1, a2, b1, epsilon);
		let o2 = this.getOrientation(a1, a2, b2, epsilon);
		let o3 = this.getOrientation(b1, b2, a1, epsilon);
		let o4 = this.getOrientation(b1, b2, a2, epsilon);

		if (o1 !== o2 && o3 !== o4) return true;
		if (o1 === 0 && this.isPointOnSegment(b1, a1, a2, epsilon)) return true;
		if (o2 === 0 && this.isPointOnSegment(b2, a1, a2, epsilon)) return true;
		if (o3 === 0 && this.isPointOnSegment(a1, b1, b2, epsilon)) return true;
		if (o4 === 0 && this.isPointOnSegment(a2, b1, b2, epsilon)) return true;
		return false;
	},

	doCutSegmentIntersectCurve(cutStart, cutEnd, curve, steps = 28) {
		if (!cutStart || !cutEnd || !curve) return false;
		let prev = curve.start;
		for (let i = 1; i <= steps; i++) {
			let t = i / steps;
			let curr = this.getPointOnCubicBezier(curve, t);
			if (this.doSegmentsIntersect(cutStart, cutEnd, prev, curr)) {
				return true;
			}
			prev = curr;
		}
		return false;
	},

	async cutEdgesByLine(window, cutStart, cutEnd) {
		let state = this.graphStates.get(window);
		if (!state || !cutStart || !cutEnd) return 0;
		let toRemoveIDs = [];
		for (let edge of state.edges) {
			let fromNode = state.nodes.find((n) => n.id === edge.from);
			let toNode = state.nodes.find((n) => n.id === edge.to);
			if (!fromNode || !toNode) continue;
			let curve = this.getBezierCurveForEdgeNodes(fromNode, toNode);
			if (this.doCutSegmentIntersectCurve(cutStart, cutEnd, curve)) {
				toRemoveIDs.push(edge.id);
			}
		}
		if (!toRemoveIDs.length) return 0;

		let removeSet = new Set(toRemoveIDs);
		state.edges = state.edges.filter((edge) => !removeSet.has(edge.id));

		if (state.activeTopicID && state.activeLibraryID && !state.isTemporaryTopic) {
			await Promise.all(toRemoveIDs.map((edgeID) =>
				this.removeEdge(state.activeLibraryID, state.activeTopicID, edgeID)
					.catch((error) => {
						Zotero.logError(error);
						return false;
					}),
			));
		}
		return toRemoveIDs.length;
	},

	isAnchorVisibleInState(state, nodeID, side) {
		if (!state) return false;
		if (state.hoverAnchor?.nodeID === nodeID && state.hoverAnchor?.side === side) {
			return true;
		}
		if (state.edgeDraft?.startAnchor?.nodeID === nodeID && state.edgeDraft?.startAnchor?.side === side) {
			return true;
		}
		if (state.edgeDraft?.targetAnchor?.nodeID === nodeID && state.edgeDraft?.targetAnchor?.side === side) {
			return true;
		}
		return false;
	},

	applyAnchorVisibilityToDOM(state) {
		if (!state?.nodesGroup) return;
		let nodeElems = state.nodesGroup.querySelectorAll(".paper-relations-node[data-node-id]");
		for (let elem of nodeElems) {
			let nodeID = elem.getAttribute("data-node-id");
			for (let side of ["left", "right"]) {
				let anchor = elem.querySelector(`.paper-relations-node-anchor[data-anchor-side="${side}"]`);
				if (!anchor) continue;
				anchor.classList.toggle("active", this.isAnchorVisibleInState(state, nodeID, side));
			}
		}
	},

	getNodeAnchorPoint(node, side) {
		if (!node || (side !== "left" && side !== "right")) return null;
		let width = Number.isFinite(node.renderWidth) ? node.renderWidth :
			this.getNodeRenderMetrics(node).width;
		let height = Number.isFinite(node.renderHeight) ? node.renderHeight :
			this.getNodeRenderMetrics(node).height;
		return {
			nodeID: node.id,
			side,
			x: side === "left" ? node.x : node.x + width,
			y: node.y + height / 2,
		};
	},

	sameAnchor(a, b) {
		if (!a && !b) return true;
		if (!a || !b) return false;
		return a.nodeID === b.nodeID && a.side === b.side;
	},

	getAnchorPairEndpoints(startAnchor, targetAnchor) {
		if (!startAnchor || !targetAnchor) return null;
		if (startAnchor.nodeID === targetAnchor.nodeID) return null;
		if (startAnchor.side === targetAnchor.side) return null;
		if (startAnchor.side === "right" && targetAnchor.side === "left") {
			return {
				fromNodeID: startAnchor.nodeID,
				toNodeID: targetAnchor.nodeID,
			};
		}
		if (startAnchor.side === "left" && targetAnchor.side === "right") {
			return {
				fromNodeID: targetAnchor.nodeID,
				toNodeID: startAnchor.nodeID,
			};
		}
		return null;
	},

	clientToGraphPoint(state, clientX, clientY) {
		let point = this.clientToSVGPoint(state, clientX, clientY);
		return {
			x: (point.x - state.panX) / state.scale,
			y: (point.y - state.panY) / state.scale,
		};
	},

	isClientInsideSVG(state, clientX, clientY) {
		let rect = state.svg.getBoundingClientRect();
		return (
			clientX >= rect.left &&
			clientX <= rect.right &&
			clientY >= rect.top &&
			clientY <= rect.bottom
		);
	},

	getNearestAnchorAtClient(state, clientX, clientY) {
		if (!state?.nodes?.length) return null;
		let point = this.clientToGraphPoint(state, clientX, clientY);
		let maxDistance = Math.max(6, state.anchorHoverRadiusPx / Math.max(0.3, state.scale));
		let maxDistanceSq = maxDistance * maxDistance;
		let nearest = null;

		for (let node of state.nodes) {
			let leftAnchor = this.getNodeAnchorPoint(node, "left");
			let rightAnchor = this.getNodeAnchorPoint(node, "right");
			for (let anchor of [leftAnchor, rightAnchor]) {
				if (!anchor) continue;
				let dx = point.x - anchor.x;
				let dy = point.y - anchor.y;
				let distSq = dx * dx + dy * dy;
				if (distSq > maxDistanceSq) continue;
				if (!nearest || distSq < nearest.distSq) {
					nearest = {
						nodeID: anchor.nodeID,
						side: anchor.side,
						x: anchor.x,
						y: anchor.y,
						distSq,
					};
				}
			}
		}

		if (!nearest) return null;
		return {
			nodeID: nearest.nodeID,
			side: nearest.side,
			x: nearest.x,
			y: nearest.y,
		};
	},

	updateHoverAnchorByClient(window, clientX, clientY, options = {}) {
		let state = this.graphStates.get(window);
		if (!state) return null;
		let nextHover = this.isClientInsideSVG(state, clientX, clientY)
			? this.getNearestAnchorAtClient(state, clientX, clientY)
			: null;
		if (!this.sameAnchor(state.hoverAnchor, nextHover)) {
			state.hoverAnchor = nextHover;
			if (options.render) {
				this.renderGraph(window);
			}
			else {
				this.applyAnchorVisibilityToDOM(state);
			}
		}
		return nextHover;
	},

	updateGraphTransform(state) {
		state.viewport.setAttribute("transform", `translate(${state.panX} ${state.panY}) scale(${state.scale})`);
	},

	clampScale(scale) {
		return Math.min(2.8, Math.max(0.45, scale));
	},

	clientToSVGPoint(state, clientX, clientY) {
		let point = state.svg.createSVGPoint();
		point.x = clientX;
		point.y = clientY;
		let ctm = state.svg.getScreenCTM();
		if (!ctm) {
			return { x: 0, y: 0 };
		}
		return point.matrixTransform(ctm.inverse());
	},

	onGraphWheel(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		event.preventDefault();

		let oldScale = state.scale;
		let zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
		let newScale = this.clampScale(oldScale * zoomFactor);
		if (newScale === oldScale) return;

		let point = this.clientToSVGPoint(state, event.clientX, event.clientY);
		let worldX = (point.x - state.panX) / oldScale;
		let worldY = (point.y - state.panY) / oldScale;

		state.scale = newScale;
		state.panX = point.x - worldX * newScale;
		state.panY = point.y - worldY * newScale;
		this.updateGraphTransform(state);
	},

	updateCanvasCursorState(window) {
		let state = this.graphStates.get(window);
		if (!state?.canvas) return;
		let panReady = !!(
			state.pointerInCanvas &&
			!state.altModifierPressed &&
			!state.dragMode &&
			!state.pointerOverNode &&
			!state.pointerOverControl
		);
		let cutReady = !!(
			state.pointerInCanvas &&
			(state.altModifierPressed || state.dragMode === "edge-cut")
		);
		state.canvas.classList.toggle("paper-relations-pan-ready", panReady);
		state.canvas.classList.toggle("paper-relations-panning", state.dragMode === "pan");
		state.canvas.classList.toggle("paper-relations-cut-ready", cutReady);
	},

	updatePointerContextFromEvent(window, event) {
		let state = this.graphStates.get(window);
		if (!state || !event) return;
		state.pointerInCanvas = this.isClientInsideSVG(state, event.clientX, event.clientY);
		let target = event.target;
		state.pointerOverNode = !!target?.closest?.("[data-node-id]");
		state.pointerOverControl = !!target?.closest?.(".paper-relations-canvas-btn");
		this.updateCanvasCursorState(window);
	},

	syncAltModifierByEvent(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		let next = !!event?.altKey;
		if (state.altModifierPressed === next) return;
		state.altModifierPressed = next;
		this.updateCanvasCursorState(window);
	},

	onWindowKeyStateChange(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		if (event?.key && event.key !== "Alt") return;
		this.syncAltModifierByEvent(window, event);
	},

	onWindowBlur(window) {
		let state = this.graphStates.get(window);
		if (!state) return;
		state.altModifierPressed = false;
		state.pointerInCanvas = false;
		state.pointerOverNode = false;
		state.pointerOverControl = false;
		this.updateCanvasCursorState(window);
	},

	onGraphContextMenu(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		if (state.dragMode === "edge-cut" || (event.altKey && event.button === 2)) {
			event.preventDefault();
		}
	},

	onGraphMouseDown(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.syncAltModifierByEvent(window, event);
		this.updatePointerContextFromEvent(window, event);
		if (event.button === 2 && event.altKey) {
			let start = this.clientToGraphPoint(state, event.clientX, event.clientY);
			state.dragMode = "edge-cut";
			state.dragNodeID = null;
			state.dragNodeRawX = null;
			state.dragNodeRawY = null;
			state.lastClientX = event.clientX;
			state.lastClientY = event.clientY;
			state.hoverAnchor = null;
			state.edgeDraft = null;
			state.edgeCutDraft = {
				start,
				end: start,
			};
			this.applyAnchorVisibilityToDOM(state);
			this.updateCanvasCursorState(window);
			this.renderGraph(window);
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (event.button !== 0) return;
		let hoverAnchor = this.getNearestAnchorAtClient(state, event.clientX, event.clientY);
		if (hoverAnchor) {
			state.dragMode = "edge-draft";
			state.dragNodeID = null;
			state.dragNodeRawX = null;
			state.dragNodeRawY = null;
			state.lastClientX = event.clientX;
			state.lastClientY = event.clientY;
			state.hoverAnchor = hoverAnchor;
			state.edgeDraft = {
				startAnchor: hoverAnchor,
				targetAnchor: null,
				pointer: { x: hoverAnchor.x, y: hoverAnchor.y },
			};
			this.renderGraph(window);
			event.preventDefault();
			return;
		}

		let nodeElem = event.target.closest("[data-node-id]");
		state.dragMode = nodeElem ? "node" : "pan";
		state.dragNodeID = nodeElem ? nodeElem.getAttribute("data-node-id") : null;
		state.dragNodeRawX = null;
		state.dragNodeRawY = null;
		state.hoverAnchor = null;
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
		this.updateCanvasCursorState(window);

		if (state.dragNodeID) {
			let node = state.nodes.find((n) => n.id === state.dragNodeID);
			if (node) {
				state.dragNodeRawX = Number.isFinite(node.x) ? node.x : 0;
				state.dragNodeRawY = Number.isFinite(node.y) ? node.y : 0;
			}
			this.selectGraphNode(window, state.dragNodeID);
		}
		else {
			this.selectGraphNode(window, null);
		}
		event.preventDefault();
	},

	onGraphMouseMove(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.syncAltModifierByEvent(window, event);
		this.updatePointerContextFromEvent(window, event);

		if (!state.dragMode) {
			this.updateHoverAnchorByClient(window, event.clientX, event.clientY);
			return;
		}

		if (state.dragMode === "edge-draft" && state.edgeDraft?.startAnchor) {
			let pointer = this.clientToGraphPoint(state, event.clientX, event.clientY);
			state.edgeDraft.pointer = pointer;
			let hoverAnchor = this.updateHoverAnchorByClient(window, event.clientX, event.clientY, { render: false });
			let candidate = this.getAnchorPairEndpoints(state.edgeDraft.startAnchor, hoverAnchor) ? hoverAnchor : null;
			if (!this.sameAnchor(state.edgeDraft.targetAnchor, candidate)) {
				state.edgeDraft.targetAnchor = candidate;
			}
			this.renderGraph(window);
			event.preventDefault();
			return;
		}

		if (state.dragMode === "edge-cut" && state.edgeCutDraft?.start) {
			state.edgeCutDraft.end = this.clientToGraphPoint(state, event.clientX, event.clientY);
			this.renderGraph(window);
			event.preventDefault();
			return;
		}

		let dx = event.clientX - state.lastClientX;
		let dy = event.clientY - state.lastClientY;
		if (!dx && !dy) return;

		if (state.dragMode === "pan") {
			state.panX += dx;
			state.panY += dy;
			this.updateGraphTransform(state);
		}
		else if (state.dragMode === "node" && state.dragNodeID) {
			let node = state.nodes.find((n) => n.id === state.dragNodeID);
			if (node) {
				if (!Number.isFinite(state.dragNodeRawX) || !Number.isFinite(state.dragNodeRawY)) {
					state.dragNodeRawX = Number.isFinite(node.x) ? node.x : 0;
					state.dragNodeRawY = Number.isFinite(node.y) ? node.y : 0;
				}
				state.dragNodeRawX += dx / state.scale;
				state.dragNodeRawY += dy / state.scale;
				if (state.snapToGrid) {
					let snapped = this.snapNodePositionToGrid({
						x: state.dragNodeRawX,
						y: state.dragNodeRawY,
					}, node);
					node.x = snapped.x;
					node.y = snapped.y;
				}
				else {
					node.x = state.dragNodeRawX;
					node.y = state.dragNodeRawY;
				}
				this.renderGraph(window);
				this.notifyGraphSelectionChanged(window);
			}
		}

		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
		event.preventDefault();
	},

	async onGraphMouseUp(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.syncAltModifierByEvent(window, event);
		this.updatePointerContextFromEvent(window, event);
		let dragMode = state.dragMode;
		let dragNodeID = state.dragNodeID;
		let edgeDraft = state.edgeDraft;
		let edgeCutDraft = state.edgeCutDraft;
		state.dragMode = null;
		state.dragNodeID = null;
		state.dragNodeRawX = null;
		state.dragNodeRawY = null;
		state.edgeDraft = null;
		state.edgeCutDraft = null;
		this.updateCanvasCursorState(window);
		if (dragMode === "edge-cut") {
			if (edgeCutDraft?.start && edgeCutDraft?.end) {
				await this.cutEdgesByLine(window, edgeCutDraft.start, edgeCutDraft.end);
			}
			this.renderGraph(window);
			this.notifyGraphSelectionChanged(window);
			this.notifyGraphContextChanged(window);
			if (event) {
				event.preventDefault();
			}
			return;
		}
		if (dragMode === "edge-draft") {
			if (edgeDraft?.startAnchor && edgeDraft?.targetAnchor) {
				let endpoints = this.getAnchorPairEndpoints(edgeDraft.startAnchor, edgeDraft.targetAnchor);
				if (
					endpoints &&
					state.activeTopicID &&
					state.activeLibraryID &&
					!state.isTemporaryTopic
				) {
					try {
						let edge = await this.addEdge(state.activeLibraryID, state.activeTopicID, {
							fromNodeID: endpoints.fromNodeID,
							toNodeID: endpoints.toNodeID,
							type: "related",
						});
						if (edge && !state.edges.some((e) => e.id === edge.id)) {
							state.edges.push({
								id: edge.id,
								from: edge.fromNodeID,
								to: edge.toNodeID,
								type: edge.type || "related",
							});
						}
					}
					catch (error) {
						Zotero.logError(error);
					}
				}
			}
			this.renderGraph(window);
			this.notifyGraphSelectionChanged(window);
			this.notifyGraphContextChanged(window);
			return;
		}
		if (
			dragMode === "node" &&
			dragNodeID &&
			state.activeTopicID &&
			state.activeLibraryID &&
			!state.isTemporaryTopic
		) {
			let node = state.nodes.find((n) => n.id === dragNodeID);
			if (node) {
				if (state.snapToGrid) {
					let snapped = this.snapNodePositionToGrid({
						x: node.x,
						y: node.y,
					}, node);
					node.x = snapped.x;
					node.y = snapped.y;
				}
				this.renderGraph(window);
				this.updateNode(state.activeLibraryID, state.activeTopicID, dragNodeID, {
					x: node.x,
					y: node.y,
				}).catch((error) => Zotero.logError(error));
			}
		}
	},

	selectGraphNode(window, nodeID) {
		let state = this.graphStates.get(window);
		if (!state) return;
		if (state.selectedNodeID === nodeID) return;
		state.selectedNodeID = nodeID;
		this.renderGraph(window);
		this.notifyGraphSelectionChanged(window);
	},

	notifyGraphSelectionChanged(window) {
		window.dispatchEvent(new window.CustomEvent("paper-relations:graph-selection-changed"));
	},

	getGraphSelectionInfo(window) {
		let state = this.graphStates.get(window);
		if (!state || !state.selectedNodeID) return null;

		let node = state.nodes.find((n) => n.id === state.selectedNodeID);
		if (!node) return null;

		let incoming = state.edges
			.filter((edge) => edge.to === node.id)
			.map((edge) => state.nodes.find((n) => n.id === edge.from))
			.filter(Boolean)
			.map((n) => n.label);

		let outgoing = state.edges
			.filter((edge) => edge.from === node.id)
			.map((edge) => state.nodes.find((n) => n.id === edge.to))
			.filter(Boolean)
			.map((n) => n.label);

		return {
			id: node.id,
			label: node.label,
			incoming,
			outgoing,
		};
	},
};

