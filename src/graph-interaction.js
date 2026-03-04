var PaperRelationsGraphInteractionMixin = {
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

	onWindowKeyDown(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.syncAltModifierByEvent(window, event);
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
		this.syncAltModifierByEvent(window, event);
	},

	onWindowBlur(window) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.hideGraphContextMenus(window);
		this.cancelNodeRename(window);
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
		this.selectGraphNode(window, nodeID);
		this.showNodeContextMenu(window, nodeID, event.clientX, event.clientY);
	},

	onGraphMouseDown(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		this.hideGraphContextMenus(window);
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
					snapLabel: node.label,
				}).catch((error) => Zotero.logError(error));
			}
		}
	},

	selectGraphNode(window, nodeID) {
		let state = this.graphStates.get(window);
		if (!state) return;
		if (state.selectedNodeID === nodeID) return;
		state.selectedNodeID = nodeID;
		this.syncSelectedGraphNodeToItemList(window, nodeID);
		this.renderGraph(window);
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
