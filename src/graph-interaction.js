var PaperConnectionsGraphInteractionMixin = {
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
		this.hideGraphContextMenus(window);
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
		let hoverBundleActive = !!(
			state.hoverBundleID &&
			!state.dragMode
		);
		let panReady = !!(
			state.pointerInCanvas &&
			!state.altModifierPressed &&
			!state.shiftModifierPressed &&
			!state.dragMode &&
			!state.pointerOverNode &&
			!state.pointerOverControl &&
			!hoverBundleActive
		);
		let cutReady = !!(
			state.pointerInCanvas &&
			(state.altModifierPressed || state.dragMode === "edge-cut")
		);
		let bundleReady = !!(
			state.pointerInCanvas &&
			!state.altModifierPressed &&
			(state.shiftModifierPressed || hoverBundleActive || state.dragMode === "edge-bundle" || state.dragMode === "bundle-node")
		);
		state.canvas.classList.toggle("paper-connections-pan-ready", panReady);
		state.canvas.classList.toggle("paper-connections-panning", state.dragMode === "pan");
		state.canvas.classList.toggle("paper-connections-cut-ready", cutReady);
		state.canvas.classList.toggle("paper-connections-bundle-ready", bundleReady);
	},

	updatePointerContextFromEvent(window, event) {
		let state = this.graphStates.get(window);
		if (!state || !event) return;
		state.pointerInCanvas = this.isClientInsideSVG(state, event.clientX, event.clientY);
		let target = event.target;
		state.pointerOverNode = !!target?.closest?.("[data-node-id]");
		state.pointerOverControl = !!target?.closest?.(".paper-connections-canvas-btn");
		this.updateCanvasCursorState(window);
	},

	syncModifierStateByEvent(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		let nextAlt = !!event?.altKey;
		let nextShift = !!event?.shiftKey;
		if (state.altModifierPressed === nextAlt && state.shiftModifierPressed === nextShift) return;
		state.altModifierPressed = nextAlt;
		state.shiftModifierPressed = nextShift;
		this.updateCanvasCursorState(window);
	},

	syncAltModifierByEvent(window, event) {
		this.syncModifierStateByEvent(window, event);
	},

	onWindowKeyDown(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.syncModifierStateByEvent(window, event);
		let isBackquoteLike = !!(
			event?.code === "Backquote" ||
			event?.key === "`" ||
			event?.key === "~" ||
			event?.keyCode === 192 ||
			event?.which === 192
		);
		let isToggleShortcut = !!(
			(event?.ctrlKey || event?.getModifierState?.("Control")) &&
			!event?.altKey &&
			!event?.metaKey &&
			isBackquoteLike
		);
		if (isToggleShortcut) {
			event.preventDefault();
			event.stopPropagation();
			this.toggleGraphWorkspaceVisibility(window);
			return;
		}
		if (!event?.key) return;
		if (event.key === "F2") {
			if (state.selectedNodeID && !state.dragMode && !state.renameBusy) {
				this.startNodeRename(window, state.selectedNodeID);
				event.preventDefault();
				event.stopPropagation();
			}
			return;
		}
		if (!state.renamingNodeID || state.renameBusy) return;
		if (event.key === "Enter") {
			event.preventDefault();
			event.stopPropagation();
			this.confirmNodeRename(window).catch((error) => Zotero.logError(error));
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			this.cancelNodeRename(window);
		}
	},

	onWindowKeyUp(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.syncModifierStateByEvent(window, event);
	},

	onWindowBlur(window) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.hideGraphContextMenus(window);
		this.cancelNodeRename(window);
		state.altModifierPressed = false;
		state.shiftModifierPressed = false;
		state.pointerInCanvas = false;
		state.pointerOverNode = false;
		state.pointerOverControl = false;
		state.hoverBundleID = null;
		state.dragBundleID = null;
		state.dragBundleRawX = null;
		state.dragBundleRawY = null;
		state.edgeBundleDraft = null;
		state.suppressNextContextMenu = false;
		this.updateCanvasCursorState(window);
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
		window.dispatchEvent(new window.CustomEvent("paper-connections:graph-context-changed"));
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
		state.boardGrid.classList.remove("paper-connections-board-grid-disabled");
		this.updateCanvasControlsLayout(window);
		this.updateGraphWorkspaceToggleButton(window);
		this.placeGraphWorkspaceToggleButton(window, state.toolbarToggleButton);
		if (state.isTemporaryTopic) {
			state.canvas.classList.add("paper-connections-temporary-topic");
		}
		else {
			state.canvas.classList.remove("paper-connections-temporary-topic");
		}
	},

	setCanvasButtonVisual(button, active) {
		if (!button) return;
		let isActive = !!active;
		button.classList.toggle("active", isActive);
		button.style.opacity = isActive ? "1" : "0.3";
		let iconImage = button.querySelector(".paper-connections-canvas-btn-icon-image");
		if (iconImage) {
			iconImage.style.filter = isActive
				? "grayscale(1) brightness(0.48) contrast(0.95)"
				: "grayscale(1) brightness(1.04)";
		}
		let fillColor = isActive ? "#313a43" : "#9aa6b2";
		for (let elem of button.querySelectorAll(".paper-connections-canvas-btn-icon-fill")) {
			elem.style.fill = fillColor;
		}

		let strokeColor = isActive ? "#313a43" : "#9aa6b2";
		for (let elem of button.querySelectorAll(".paper-connections-canvas-btn-icon-stroke")) {
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

	getBundleByID(state, bundleID) {
		if (!state?.nodes?.length || !bundleID) return null;
		let node = state.nodes.find((candidate) => candidate.id === bundleID) || null;
		if (!node || !this.isBundleNodeState(node)) return null;
		return node;
	},

	cleanupIsolatedBundleNodesInState(state) {
		if (!state?.nodes?.length) return [];
		let inDegree = new Map();
		let outDegree = new Map();
		for (let node of state.nodes || []) {
			if (!this.isBundleNodeState(node)) continue;
			inDegree.set(node.id, 0);
			outDegree.set(node.id, 0);
		}
		for (let edge of state.edges || []) {
			if (inDegree.has(edge.to)) {
				inDegree.set(edge.to, inDegree.get(edge.to) + 1);
			}
			if (outDegree.has(edge.from)) {
				outDegree.set(edge.from, outDegree.get(edge.from) + 1);
			}
		}
		let removedIDs = [];
		state.nodes = (state.nodes || []).filter((node) => {
			if (!this.isBundleNodeState(node)) return true;
			let inCount = inDegree.get(node.id) || 0;
			let outCount = outDegree.get(node.id) || 0;
			if (inCount === 0 && outCount === 0) {
				removedIDs.push(node.id);
				return false;
			}
			return true;
		});
		let nextNodeByID = new Map((state.nodes || []).map((node) => [node.id, node]));
		if (state.selectedNodeID && !nextNodeByID.has(state.selectedNodeID)) {
			state.selectedNodeID = null;
		}
		return removedIDs;
	},

	getBundleTopologyWarningsFromState(state) {
		if (!state?.nodes?.length) return [];
		let inDegree = new Map();
		for (let node of state.nodes || []) {
			if (!this.isBundleNodeState(node)) continue;
			inDegree.set(node.id, 0);
		}
		for (let edge of state.edges || []) {
			if (inDegree.has(edge.to)) {
				inDegree.set(edge.to, inDegree.get(edge.to) + 1);
			}
		}
		let warnings = [];
		for (let [nodeID, count] of inDegree.entries()) {
			if (count > 1) {
				warnings.push(`Bundle node ${nodeID} has multiple incoming edges (${count})`);
			}
		}
		return warnings;
	},

	showBundleTopologyWarnings(window, warnings) {
		if (!Array.isArray(warnings) || !warnings.length) return;
		Services.prompt.alert(
			window,
			"Bundle Topology Warning",
			warnings.slice(0, 5).join("\n"),
		);
	},

	getBundleHitRadiusInGraph(state) {
		let radiusPx = Number.isFinite(state?.bundleHoverRadiusPx) ? state.bundleHoverRadiusPx : 12;
		let scale = Number.isFinite(state?.scale) ? state.scale : 1;
		return Math.max(4, radiusPx / Math.max(0.3, scale));
	},

	getBundleAtClient(window, clientX, clientY) {
		let state = this.graphStates.get(window);
		if (!state?.nodes?.length) return null;
		let point = this.clientToGraphPoint(state, clientX, clientY);
		let maxDistance = this.getBundleHitRadiusInGraph(state);
		let maxDistanceSq = maxDistance * maxDistance;
		let nearest = null;
		for (let bundle of state.nodes || []) {
			if (!this.isBundleNodeState(bundle)) continue;
			if (!bundle || !Number.isFinite(bundle.x) || !Number.isFinite(bundle.y)) continue;
			let dx = point.x - bundle.x;
			let dy = point.y - bundle.y;
			let distSq = dx * dx + dy * dy;
			if (distSq > maxDistanceSq) continue;
			if (!nearest || distSq < nearest.distSq) {
				nearest = {
					id: bundle.id,
					bundle,
					x: bundle.x,
					y: bundle.y,
					distSq,
				};
			}
		}
		return nearest;
	},

	updateHoverBundleByClient(window, clientX, clientY, options = {}) {
		let state = this.graphStates.get(window);
		if (!state) return null;
		let nextHover = this.isClientInsideSVG(state, clientX, clientY)
			? this.getBundleAtClient(window, clientX, clientY)
			: null;
		let nextID = nextHover?.id || null;
		if (state.hoverBundleID === nextID) return nextHover;
		state.hoverBundleID = nextID;
		this.applyBundleVisibilityToDOM(state);
		return nextHover;
	},

	getBundleIntersectionGroupsByLine(state, start, end) {
		if (!state || !start || !end) return [];
		let grouped = new Map();
		for (let edge of state.edges || []) {
			let point = this.getEdgeIntersectionPointForLine(state, edge, start, end);
			if (!point) continue;
			let sourceNodeID = edge.from;
			if (!grouped.has(sourceNodeID)) {
				grouped.set(sourceNodeID, []);
			}
			grouped.get(sourceNodeID).push({
				edgeID: edge.id,
				point,
			});
		}
		let groups = [];
		for (let [sourceNodeID, hits] of grouped.entries()) {
			if (!hits || !hits.length) continue;
			let sx = 0;
			let sy = 0;
			for (let hit of hits) {
				sx += hit.point.x;
				sy += hit.point.y;
			}
			let count = hits.length;
			groups.push({
				sourceNodeID,
				edgeIDs: hits.map((hit) => hit.edgeID),
				x: sx / count,
				y: sy / count,
			});
		}
		return groups;
	},

	async bundleEdgesByLine(window, start, end) {
		let state = this.graphStates.get(window);
		if (!state || !this.isSavedTopicMutableState(state)) return 0;
		let groups = this.getBundleIntersectionGroupsByLine(state, start, end);
		if (!groups.length) return 0;
		let result = await this.applyBundleGroups(
			state.activeLibraryID,
			state.activeTopicID,
			groups,
			{ defaultSlopeMode: "flat" },
		);
		let updatedTopic = await this.getTopic(state.activeLibraryID, state.activeTopicID);
		if (updatedTopic) {
			let selectedItem = this.selectionItemsByWindow.get(window) || this.getCurrentSelectedItem(window);
			this.applyTopicToGraphState(window, updatedTopic, selectedItem);
			this.refreshGraphChrome(window);
			let warnings = [
				...(result?.warnings || []),
				...this.getBundleTopologyWarningsFromState(this.graphStates.get(window)),
			];
			this.showBundleTopologyWarnings(window, warnings);
		}
		return Number(result?.created || 0);
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
			if (this.isBundleNodeState(node)) continue;
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

	getItemForNode(node) {
		if (!node?.libraryID || !node?.itemKey) return null;
		if (typeof Zotero.Items?.getByLibraryAndKey !== "function") return null;
		try {
			return Zotero.Items.getByLibraryAndKey(node.libraryID, node.itemKey);
		}
		catch (error) {
			Zotero.logError(error);
			return null;
		}
	},

	async openGraphNodeItem(window, node, event = null) {
		if (!node || this.isBundleNodeState(node)) return false;
		let item = this.getItemForNode(node);
		if (!item) return false;
		if (typeof window.ZoteroPane?.viewItems !== "function") return false;
		try {
			await window.ZoteroPane.viewItems([item], event || undefined);
			return true;
		}
		catch (error) {
			Zotero.logError(error);
			return false;
		}
	},

	onWindowMouseDown(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		let target = event?.target;
		let clickInNodeMenu = this.isTargetInsideElement(target, state.nodeContextMenu)
			|| this.isClientPointInsideElementRect(state.nodeContextMenu, event?.clientX, event?.clientY);
		if (!clickInNodeMenu) {
			this.hideNodeContextMenu(window);
		}
		let clickInWorkspaceMenu = this.isTargetInsideElement(target, state.workspaceContextMenu)
			|| this.isClientPointInsideElementRect(state.workspaceContextMenu, event?.clientX, event?.clientY);
		if (!clickInWorkspaceMenu) {
			this.hideWorkspaceContextMenu(window);
		}
		let clickInBundleMenu = this.isTargetInsideElement(target, state.bundleContextMenu)
			|| this.isClientPointInsideElementRect(state.bundleContextMenu, event?.clientX, event?.clientY);
		if (!clickInBundleMenu) {
			this.hideBundleContextMenu(window);
		}
		if (!state.dragMode) {
			let nearbyBundle = this.getBundleAtClient(window, event?.clientX, event?.clientY);
			if (!nearbyBundle && state.hoverBundleID) {
				state.hoverBundleID = null;
				this.applyBundleVisibilityToDOM(state);
			}
		}
		if (state.renamingNodeID && !state.renameBusy) {
			let clickInRenameInput = this.isTargetInsideElement(target, state.renameInput)
				|| this.isClientPointInsideElementRect(state.renameInput, event?.clientX, event?.clientY);
			if (!clickInRenameInput) {
				this.cancelNodeRename(window);
			}
		}
	},

	onNodeRenameInputMouseDown(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		event.stopPropagation();
	},

	onNodeRenameInput(window, event) {
		let state = this.graphStates.get(window);
		if (!state?.renamingNodeID || state.renameBusy) return;
		this.updateNodeRenamePreview(window, event?.target?.value || "");
	},

	onNodeRenameInputKeyDown(window, event) {
		let state = this.graphStates.get(window);
		if (!state?.renamingNodeID || state.renameBusy) return;
		if (event.key === "Enter") {
			event.preventDefault();
			event.stopPropagation();
			this.confirmNodeRename(window).catch((error) => Zotero.logError(error));
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			this.cancelNodeRename(window);
		}
	},

	onNodeRenameInputBlur(window) {
		let state = this.graphStates.get(window);
		if (!state?.renamingNodeID || state.renameBusy || state.suppressRenameInputBlur) return;
		this.cancelNodeRename(window);
	},

	setRenameInputHidden(window, hidden) {
		let state = this.graphStates.get(window);
		if (!state?.renameInput) return;
		state.suppressRenameInputBlur = true;
		if (hidden && state.renameInput === window.document.activeElement) {
			state.renameInput.blur();
		}
		state.renameInput.hidden = !!hidden;
		state.renameInput.disabled = !!state.renameBusy;
		if (hidden) {
			state.renameInput.value = "";
		}
		window.setTimeout(() => {
			let nextState = this.graphStates.get(window);
			if (!nextState) return;
			nextState.suppressRenameInputBlur = false;
		}, 0);
	},

	startNodeRename(window, nodeID) {
		let state = this.graphStates.get(window);
		if (!state || !nodeID || state.renameBusy) return;
		let node = this.getNodeByID(state, nodeID);
		if (!node) return;
		let item = this.getItemForNode(node);
		if (!item) return;

		this.hideGraphContextMenus(window);
		if (state.renamingNodeID && state.renamingNodeID !== nodeID) {
			this.finishNodeRename(window, { restoreNode: true, render: true });
			state = this.graphStates.get(window);
			if (!state) return;
			node = this.getNodeByID(state, nodeID);
			if (!node) return;
		}

		this.selectGraphNode(window, nodeID);
		let fallbackTitle = this.getItemTitle(item) || node.title || node.itemKey || "(untitled)";
		let currentRemark = this.getItemRemark(item) || "";
		let initialValue = currentRemark || node.label || fallbackTitle;
		state.renamingNodeID = nodeID;
		state.renameFallbackTitle = fallbackTitle;
		state.renameSnapshot = {
			label: node.label,
			width: node.width,
			title: node.title,
			x: node.x,
			y: node.y,
		};
		state.renameBusy = false;
		state.renameInput.value = initialValue;
		this.updateNodeDOM(window, nodeID, { propagate: false });
		this.syncNodeRenameInputLayout(window);
		this.setRenameInputHidden(window, false);
		this.syncNodeRenameInputLayout(window);
		if (!state.renameInput.hidden) {
			state.renameInput.focus();
			state.renameInput.select();
		}
	},

	updateNodeRenamePreview(window, inputValue) {
		let state = this.graphStates.get(window);
		if (!state?.renamingNodeID) return;
		let node = this.getNodeByID(state, state.renamingNodeID);
		if (!node) return;
		let oldMetrics = this.getNodeRenderMetrics(node);
		let centerX = node.x + oldMetrics.width / 2;
		let centerY = node.y + oldMetrics.height / 2;

		let text = String(inputValue || "");
		let fallbackTitle = state.renameFallbackTitle || node.title || node.itemKey || "(untitled)";
		let nextLabel = text.trim() ? text : fallbackTitle;
		let nextWidth = this.getNodeWidthForLabel(nextLabel);
		let nextMetrics = this.getNodeRenderMetrics({
			...node,
			label: nextLabel,
			width: nextWidth,
		});
		node.label = nextLabel;
		node.width = nextWidth;
		node.x = centerX - nextMetrics.width / 2;
		node.y = centerY - nextMetrics.height / 2;
		this.updateNodeDOM(window, node.id, { propagate: "bundle" });
		this.notifyGraphSelectionChanged(window);
	},

	finishNodeRename(window, options = {}) {
		let { restoreNode = false, render = true } = options;
		let state = this.graphStates.get(window);
		if (!state) return;
		let snapshot = state.renameSnapshot;
		let nodeID = state.renamingNodeID;
		if (restoreNode && snapshot && nodeID) {
			let node = this.getNodeByID(state, nodeID);
			if (node) {
				node.label = snapshot.label;
				node.width = snapshot.width;
				node.title = snapshot.title;
				node.x = snapshot.x;
				node.y = snapshot.y;
			}
		}

		state.renamingNodeID = null;
		state.renameFallbackTitle = "";
		state.renameSnapshot = null;
		state.renameBusy = false;
		this.setRenameInputHidden(window, true);
		if (render && nodeID) {
			this.updateNodeDOM(window, nodeID, { propagate: "bundle" });
			this.notifyGraphSelectionChanged(window);
		}
	},

	cancelNodeRename(window) {
		let state = this.graphStates.get(window);
		if (!state?.renamingNodeID) return;
		this.finishNodeRename(window, { restoreNode: true, render: true });
	},

	async confirmNodeRename(window) {
		let state = this.graphStates.get(window);
		if (!state?.renamingNodeID || state.renameBusy) return;
		let node = this.getNodeByID(state, state.renamingNodeID);
		if (!node) return;
		let item = this.getItemForNode(node);
		if (!item) {
			this.finishNodeRename(window, { restoreNode: true, render: true });
			return;
		}

		state.renameBusy = true;
		if (state.renameInput) {
			state.renameInput.disabled = true;
		}
		let nextRemark = state.renameInput?.value || "";
		try {
			await this.setItemRemark(item, nextRemark);
			this.finishNodeRename(window, { restoreNode: false, render: true });
			this.refreshRemarkPresentation();
			this.refreshGraphNodeLabelsForItem(item);
		}
		catch (error) {
			Zotero.logError(error);
			this.finishNodeRename(window, { restoreNode: true, render: true });
			Services.prompt.alert(
				window,
				this.getGraphWorkspaceText("renameFailedTitle"),
				String(error?.message || error),
			);
		}
	},

	syncNodeRenameInputLayout(window) {
		let state = this.graphStates.get(window);
		if (!state?.renameInput) return;
		let input = state.renameInput;
		if (!state.renamingNodeID) {
			if (!input.hidden) {
				this.setRenameInputHidden(window, true);
			}
			return;
		}
		let node = this.getNodeByID(state, state.renamingNodeID);
		if (!node) {
			this.finishNodeRename(window, { restoreNode: false, render: false });
			return;
		}
		let canvasRect = state.canvas.getBoundingClientRect();
		let pxWidth = 0;
		let pxHeight = 0;
		let left = 0;
		let top = 0;
		let nodeElem = state.nodesGroup?.querySelector?.(`[data-node-id="${state.renamingNodeID}"]`);
		if (nodeElem) {
			let nodeRect = nodeElem.getBoundingClientRect();
			if (nodeRect.width > 1 && nodeRect.height > 1) {
				left = nodeRect.left - canvasRect.left;
				top = nodeRect.top - canvasRect.top;
				pxWidth = nodeRect.width;
				pxHeight = nodeRect.height;
			}
		}
		if (!(pxWidth > 1 && pxHeight > 1)) {
			let width = Number.isFinite(node.renderWidth) ? node.renderWidth : this.getNodeRenderMetrics(node).width;
			let height = Number.isFinite(node.renderHeight) ? node.renderHeight : this.getNodeRenderMetrics(node).height;
			left = state.panX + node.x * state.scale;
			top = state.panY + node.y * state.scale;
			pxWidth = width * state.scale;
			pxHeight = height * state.scale;
		}
		pxWidth = Math.max(40, Math.round(pxWidth));
		pxHeight = Math.max(22, Math.round(pxHeight));
		let fontSize = Math.max(11, Math.round(15 * Math.max(0.7, state.scale)));
		input.style.left = `${Math.round(left)}px`;
		input.style.top = `${Math.round(top)}px`;
		input.style.width = `${pxWidth}px`;
		input.style.height = `${pxHeight}px`;
		input.style.fontSize = `${fontSize}px`;
		input.style.lineHeight = `${Math.max(14, Math.round(this.nodeLineHeight * Math.max(0.7, state.scale)))}px`;
	},

	onGraphContextMenu(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		if (state.suppressNextContextMenu) {
			state.suppressNextContextMenu = false;
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (
			state.dragMode === "edge-cut" ||
			state.dragMode === "edge-bundle" ||
			(event.altKey && event.button === 2) ||
			((event.shiftKey || state.shiftModifierPressed) && event.button === 2) ||
			(event.shiftKey && state.edgeBundleDraft)
		) {
			event.preventDefault();
			return;
		}
		let bundleHit = this.getBundleAtClient(window, event.clientX, event.clientY);
		if (bundleHit) {
			event.preventDefault();
			event.stopPropagation();
			this.hideGraphContextMenus(window);
			state.hoverBundleID = bundleHit.id;
			this.showBundleContextMenu(window, bundleHit.id, event.clientX, event.clientY);
			this.applyBundleVisibilityToDOM(state);
			return;
		}
		let nodeID = this.getNodeIDFromEventTarget(event.target);
		if (!nodeID) {
			let hitNode = this.getNodeAtClient(window, event.clientX, event.clientY);
			nodeID = hitNode?.id || null;
		}
		event.preventDefault();
		event.stopPropagation();
		if (!nodeID) {
			this.hideGraphContextMenus(window);
			this.showWorkspaceContextMenu(window, event.clientX, event.clientY);
			return;
		}
		this.hideWorkspaceContextMenu(window);
		this.hideBundleContextMenu(window);
		this.selectGraphNode(window, nodeID);
		this.showNodeContextMenu(window, nodeID, event.clientX, event.clientY);
	},

	onGraphMouseDown(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.hideGraphContextMenus(window);
		this.syncModifierStateByEvent(window, event);
		this.updatePointerContextFromEvent(window, event);
		if (event.button === 2 && event.altKey) {
			let start = this.clientToGraphPoint(state, event.clientX, event.clientY);
			state.dragMode = "edge-cut";
			state.dragNodeID = null;
			state.dragNodeRawX = null;
			state.dragNodeRawY = null;
			state.dragNodeMoved = false;
			state.dragBundleID = null;
			state.dragBundleRawX = null;
			state.dragBundleRawY = null;
			state.lastClientX = event.clientX;
			state.lastClientY = event.clientY;
			state.hoverAnchor = null;
			state.hoverBundleID = null;
			state.edgeDraft = null;
			state.edgeBundleDraft = null;
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

		if (
			event.button === 2 &&
			(event.shiftKey || state.shiftModifierPressed) &&
			this.isSavedTopicMutableState(state)
		) {
			let start = this.clientToGraphPoint(state, event.clientX, event.clientY);
			state.suppressNextContextMenu = true;
			window.setTimeout(() => {
				let nextState = this.graphStates.get(window);
				if (!nextState) return;
				if (nextState.suppressNextContextMenu) {
					nextState.suppressNextContextMenu = false;
				}
			}, 450);
			state.dragMode = "edge-bundle";
			state.dragNodeID = null;
			state.dragNodeRawX = null;
			state.dragNodeRawY = null;
			state.dragNodeMoved = false;
			state.dragBundleID = null;
			state.dragBundleRawX = null;
			state.dragBundleRawY = null;
			state.lastClientX = event.clientX;
			state.lastClientY = event.clientY;
			state.hoverAnchor = null;
			state.edgeDraft = null;
			state.edgeCutDraft = null;
			state.edgeBundleDraft = {
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
		let bundleHit = this.getBundleAtClient(window, event.clientX, event.clientY);
		if (bundleHit) {
			state.dragMode = "bundle-node";
			state.dragNodeID = null;
			state.dragNodeRawX = null;
			state.dragNodeRawY = null;
			state.dragBundleID = bundleHit.id;
			state.dragBundleRawX = bundleHit.x;
			state.dragBundleRawY = bundleHit.y;
			state.hoverBundleID = bundleHit.id;
			state.edgeDraft = null;
			state.edgeCutDraft = null;
			state.edgeBundleDraft = null;
			state.lastClientX = event.clientX;
			state.lastClientY = event.clientY;
			this.updateCanvasCursorState(window);
			this.renderGraph(window);
			event.preventDefault();
			return;
		}
		let hoverAnchor = this.getNearestAnchorAtClient(state, event.clientX, event.clientY);
		if (hoverAnchor) {
			state.dragMode = "edge-draft";
			state.dragNodeID = null;
			state.dragNodeRawX = null;
			state.dragNodeRawY = null;
			state.dragNodeMoved = false;
			state.dragBundleID = null;
			state.dragBundleRawX = null;
			state.dragBundleRawY = null;
			state.lastClientX = event.clientX;
			state.lastClientY = event.clientY;
			state.hoverAnchor = hoverAnchor;
			state.hoverBundleID = null;
			state.edgeDraft = {
				startAnchor: hoverAnchor,
				targetAnchor: null,
				pointer: { x: hoverAnchor.x, y: hoverAnchor.y },
			};
			state.edgeCutDraft = null;
			state.edgeBundleDraft = null;
			this.renderGraph(window);
			event.preventDefault();
			return;
		}

		let nodeElem = event.target.closest("[data-node-id]");
		state.dragMode = nodeElem ? "node" : "pan";
		state.dragNodeID = nodeElem ? nodeElem.getAttribute("data-node-id") : null;
		state.dragNodeRawX = null;
		state.dragNodeRawY = null;
		state.dragNodeMoved = false;
		state.dragBundleID = null;
		state.dragBundleRawX = null;
		state.dragBundleRawY = null;
		state.hoverAnchor = null;
		state.hoverBundleID = null;
		state.edgeDraft = null;
		state.edgeCutDraft = null;
		state.edgeBundleDraft = null;
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

	onGraphClick(window, event) {
		let state = this.graphStates.get(window);
		if (!state || event?.button !== 0) return;
		if (state.renamingNodeID || state.renameBusy) return;

		let nodeID = this.getNodeIDFromEventTarget(event.target);
		if (!nodeID) {
			let hitNode = this.getNodeAtClient(window, event.clientX, event.clientY);
			nodeID = hitNode?.id || null;
		}
		if (!nodeID) {
			if (event?.detail === 1) {
				this.selectGraphNode(window, null);
			}
			return;
		}

		let node = this.getNodeByID(state, nodeID);
		if (!node || this.isBundleNodeState(node)) return;

		this.hideGraphContextMenus(window);
		this.selectGraphNode(window, nodeID);
	},

	onGraphSVGDoubleClick(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		let nodeID = this.getNodeIDFromEventTarget(event?.target);
		if (!nodeID) {
			let hitNode = this.getNodeAtClient(window, event?.clientX, event?.clientY);
			nodeID = hitNode?.id || null;
		}
		if (!nodeID) return;

		let node = this.getNodeByID(state, nodeID);
		if (!node || this.isBundleNodeState(node)) return;

		this.hideGraphContextMenus(window);
		this.selectGraphNode(window, nodeID);
		this.openGraphNodeItem(window, node, event).catch((error) => Zotero.logError(error));
		event?.preventDefault?.();
		event?.stopPropagation?.();
	},

	onGraphMouseMove(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.syncModifierStateByEvent(window, event);
		this.updatePointerContextFromEvent(window, event);

		if (!state.dragMode) {
			this.updateHoverAnchorByClient(window, event.clientX, event.clientY, { render: false });
			this.updateHoverBundleByClient(window, event.clientX, event.clientY, { render: false });
			this.applyAnchorVisibilityToDOM(state);
			this.applyBundleVisibilityToDOM(state);
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

		if (state.dragMode === "edge-bundle" && state.edgeBundleDraft?.start) {
			state.edgeBundleDraft.end = this.clientToGraphPoint(state, event.clientX, event.clientY);
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
				state.dragNodeMoved = true;
				this.updateNodeDOM(window, node.id, { propagate: "bundle" });
				this.notifyGraphSelectionChanged(window);
			}
		}
		else if (state.dragMode === "bundle-node" && state.dragBundleID) {
			let bundle = this.getBundleByID(state, state.dragBundleID);
			if (bundle) {
				if (!Number.isFinite(state.dragBundleRawX) || !Number.isFinite(state.dragBundleRawY)) {
					state.dragBundleRawX = Number.isFinite(bundle.x) ? bundle.x : 0;
					state.dragBundleRawY = Number.isFinite(bundle.y) ? bundle.y : 0;
				}
				state.dragBundleRawX += dx / state.scale;
				state.dragBundleRawY += dy / state.scale;
				if (state.snapToGrid) {
					bundle.x = this.snapValueToGrid(state.dragBundleRawX);
					bundle.y = this.snapValueToGrid(state.dragBundleRawY);
				}
				else {
					bundle.x = state.dragBundleRawX;
					bundle.y = state.dragBundleRawY;
				}
				bundle.updatedAt = this.now();
				state.hoverBundleID = bundle.id;
				this.updateNodeDOM(window, bundle.id, { propagate: "bundle" });
			}
		}

		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
	},

	async onGraphMouseUp(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.syncModifierStateByEvent(window, event);
		this.updatePointerContextFromEvent(window, event);
		let dragMode = state.dragMode;
		let dragNodeID = state.dragNodeID;
		let dragBundleID = state.dragBundleID;
		let edgeDraft = state.edgeDraft;
		let edgeCutDraft = state.edgeCutDraft;
		let edgeBundleDraft = state.edgeBundleDraft;
		state.dragMode = null;
		state.dragNodeID = null;
		state.dragNodeRawX = null;
		state.dragNodeRawY = null;
		let dragNodeMoved = !!state.dragNodeMoved;
		state.dragNodeMoved = false;
		state.dragBundleID = null;
		state.dragBundleRawX = null;
		state.dragBundleRawY = null;
		state.edgeDraft = null;
		state.edgeCutDraft = null;
		state.edgeBundleDraft = null;
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
		if (dragMode === "edge-bundle") {
			if (edgeBundleDraft?.start && edgeBundleDraft?.end) {
				try {
					await this.bundleEdgesByLine(window, edgeBundleDraft.start, edgeBundleDraft.end);
				}
				catch (error) {
					Zotero.logError(error);
				}
			}
			this.renderGraph(window);
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
			dragMode === "bundle-node" &&
			dragBundleID &&
			this.isSavedTopicMutableState(state)
		) {
			let bundle = this.getBundleByID(state, dragBundleID);
			if (bundle) {
				try {
					let updated = await this.updateNode(state.activeLibraryID, state.activeTopicID, dragBundleID, {
						x: bundle.x,
						y: bundle.y,
					});
					if (updated) {
						bundle.x = Number.isFinite(updated.x) ? updated.x : bundle.x;
						bundle.y = Number.isFinite(updated.y) ? updated.y : bundle.y;
					}
				}
				catch (error) {
					Zotero.logError(error);
				}
			}
			state.hoverBundleID = dragBundleID;
			this.updateNodeDOM(window, dragBundleID, { propagate: "bundle" });
			this.notifyGraphContextChanged(window);
			return;
		}
		if (
			dragMode === "node" &&
			dragNodeID &&
			dragNodeMoved &&
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
				this.updateNodeDOM(window, dragNodeID, { propagate: "bundle" });
				this.updateNode(state.activeLibraryID, state.activeTopicID, dragNodeID, {
					x: node.x,
					y: node.y,
					snapLabel: node.label,
				}).catch((error) => Zotero.logError(error));
			}
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
		state.canvas.classList.add("paper-connections-drop-active");
	},

	onGraphDragLeave(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		if (!event.currentTarget?.contains(event.relatedTarget)) {
			state.canvas.classList.remove("paper-connections-drop-active");
		}
	},

	async onGraphDrop(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		state.canvas.classList.remove("paper-connections-drop-active");
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

	selectGraphNode(window, nodeID) {
		let state = this.graphStates.get(window);
		if (!state) return;
		if (state.selectedNodeID === nodeID) return;
		let previousNodeID = state.selectedNodeID;
		state.selectedNodeID = nodeID;
		if (previousNodeID) {
			this.updateNodeDOM(window, previousNodeID, { propagate: false });
		}
		if (nodeID) {
			this.updateNodeDOM(window, nodeID, { propagate: false });
			this.syncSelectedGraphNodeToItemList(window, nodeID);
		}
		if (!previousNodeID && !nodeID) {
			this.applySelectedNodeStateToDOM(state);
		}
		this.notifyGraphSelectionChanged(window);
	},

	syncSelectedGraphNodeToItemList(window, nodeID) {
		if (!nodeID) return;
		let state = this.graphStates.get(window);
		if (!state) return;
		let node = state.nodes.find((n) => n.id === nodeID);
		if (!node?.libraryID || !node?.itemKey) return;

		let item = null;
		if (typeof Zotero.Items?.getByLibraryAndKey === "function") {
			try {
				item = Zotero.Items.getByLibraryAndKey(node.libraryID, node.itemKey);
			}
			catch (error) {
				Zotero.logError(error);
			}
		}
		if (!item?.id) return;

		let currentSelected = window.ZoteroPane?.getSelectedItems?.() || [];
		if (currentSelected.some((it) => it?.id === item.id)) return;

		if (typeof window.ZoteroPane?.selectItems !== "function") return;
		try {
			let maybePromise = window.ZoteroPane.selectItems([item.id]);
			if (maybePromise && typeof maybePromise.then === "function") {
				maybePromise.catch((error) => Zotero.logError(error));
			}
		}
		catch (error) {
			Zotero.logError(error);
		}
	},

	notifyGraphSelectionChanged(window) {
		window.dispatchEvent(new window.CustomEvent("paper-connections:graph-selection-changed"));
	},

	applySelectedNodeStateToDOM(state) {
		if (!state?.nodesGroup) return;
		let nodeElems = state.nodesGroup.querySelectorAll(".paper-connections-node[data-node-id]");
		for (let elem of nodeElems) {
			let nodeID = elem.getAttribute("data-node-id");
			elem.classList.toggle("selected", state.selectedNodeID === nodeID);
		}
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
