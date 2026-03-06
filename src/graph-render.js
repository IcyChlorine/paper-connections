var PaperConnectionsGraphRenderMixin = {
	renderGraph(window) {
		this.refreshGraph(window);
	},

	refreshGraph(window) {
		let state = this.graphStates.get(window);
		if (!state) return;

		let { nodes, edges, edgesGroup, nodesGroup, overlayGroup } = state;
		let doc = window.document;
		const SVG_NS = "http://www.w3.org/2000/svg";

		this.resetGraphDOMCaches(state);
		edgesGroup.replaceChildren();
		nodesGroup.replaceChildren();
		overlayGroup.replaceChildren();

		for (let node of nodes) {
			this.syncNodeRenderMetrics(node);
		}

		let visibleEdges = this.getVisibleEdgeRenderData(state);
		for (let edgePath of visibleEdges.paths) {
			let path = this.createEdgePathElement(doc, edgePath);
			edgesGroup.appendChild(path);
			state.edgeElemsByID.set(edgePath.edgeID, path);
		}

		for (let bundle of visibleEdges.bundles) {
			let hub = this.createBundleHubElement(doc, state, bundle);
			overlayGroup.appendChild(hub);
			state.bundleHubElemsByID.set(bundle.id, hub);
		}

		if (state.edgeDraft?.startAnchor && state.edgeDraft?.pointer) {
			let draftEnd = state.edgeDraft.targetAnchor || state.edgeDraft.pointer;
			let draftPath = this.buildBezierPathByAnchors(
				state.edgeDraft.startAnchor,
				draftEnd,
			);
			if (draftPath) {
				let path = doc.createElementNS(SVG_NS, "path");
				path.setAttribute("class", "paper-connections-edge paper-connections-edge-draft");
				path.setAttribute("d", draftPath);
				if (state.edgeDraft.startAnchor.side === "right") {
					path.setAttribute("marker-end", "url(#paper-connections-arrow)");
				}
				else if (state.edgeDraft.startAnchor.side === "left") {
					path.setAttribute("marker-start", "url(#paper-connections-arrow)");
				}
				overlayGroup.appendChild(path);
			}
		}

		if (state.edgeCutDraft?.start && state.edgeCutDraft?.end) {
			let cutLine = doc.createElementNS(SVG_NS, "line");
			cutLine.setAttribute("class", "paper-connections-edge-cut-preview");
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
			scissorsGroup.setAttribute("class", "paper-connections-edge-cut-scissors");
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

		if (state.edgeBundleDraft?.start && state.edgeBundleDraft?.end) {
			let bundleLine = doc.createElementNS(SVG_NS, "line");
			bundleLine.setAttribute("class", "paper-connections-edge-bundle-preview");
			bundleLine.setAttribute("x1", String(state.edgeBundleDraft.start.x));
			bundleLine.setAttribute("y1", String(state.edgeBundleDraft.start.y));
			bundleLine.setAttribute("x2", String(state.edgeBundleDraft.end.x));
			bundleLine.setAttribute("y2", String(state.edgeBundleDraft.end.y));
			bundleLine.setAttribute("stroke", "#101214");
			bundleLine.setAttribute("stroke-width", "2");
			bundleLine.setAttribute("stroke-linecap", "round");
			bundleLine.setAttribute("stroke-dasharray", "5 4");
			bundleLine.setAttribute("opacity", "0.84");
			bundleLine.setAttribute("fill", "none");
			overlayGroup.appendChild(bundleLine);
		}

		for (let node of nodes) {
			if (this.isBundleNodeState(node)) continue;
			let group = this.createNodeGroupElement(doc, state, node);
			nodesGroup.appendChild(group);
			state.nodeElemsByID.set(node.id, group);
		}

		this.applyAnchorVisibilityToDOM(state);
		this.applyBundleVisibilityToDOM(state);
		this.updateGraphTransform(state);
		this.updateCanvasControlsLayout(window);
		this.syncNodeRenameInputLayout(window);
	},

	resetGraphDOMCaches(state) {
		if (!state) return;
		state.nodeElemsByID = new Map();
		state.edgeElemsByID = new Map();
		state.bundleHubElemsByID = new Map();
	},

	syncNodeRenderMetrics(node) {
		if (!node) return null;
		if (this.isBundleNodeState(node)) {
			node.renderWidth = 0;
			node.renderHeight = 0;
			node.renderLabelLines = [];
			return {
				width: 0,
				height: 0,
				labelLines: [],
			};
		}
		let metrics = this.getNodeRenderMetrics(node);
		node.renderWidth = metrics.width;
		node.renderHeight = metrics.height;
		node.renderLabelLines = metrics.labelLines;
		return metrics;
	},

	getNodeClassName(state, node) {
		let kind = node?.kind || "leaf";
		let selectedClass = state?.selectedNodeID === node?.id ? " selected" : "";
		let renamingClass = state?.renamingNodeID === node?.id ? " renaming" : "";
		return `paper-connections-node ${kind}${selectedClass}${renamingClass}`;
	},

	createEdgePathElement(doc, edgePath) {
		const SVG_NS = "http://www.w3.org/2000/svg";
		let path = doc.createElementNS(SVG_NS, "path");
		this.applyEdgePathDataToElement(path, edgePath);
		return path;
	},

	applyEdgePathDataToElement(path, edgePath) {
		if (!path || !edgePath) return;
		path.setAttribute("class", "paper-connections-edge");
		path.setAttribute("data-edge-id", edgePath.edgeID || "");
		path.setAttribute("d", edgePath.pathD || "");
		path.setAttribute("marker-end", edgePath.markerEnd ? "url(#paper-connections-arrow)" : "none");
		if (edgePath.markerStart) {
			path.setAttribute("marker-start", "url(#paper-connections-arrow)");
		}
		else {
			path.removeAttribute("marker-start");
		}
	},

	createBundleHubElement(doc, state, bundle) {
		const SVG_NS = "http://www.w3.org/2000/svg";
		let hub = doc.createElementNS(SVG_NS, "circle");
		this.updateBundleHubElementDOM(state, bundle, hub);
		return hub;
	},

	updateBundleHubElementDOM(state, bundle, hubElem) {
		if (!bundle || !hubElem) return;
		hubElem.setAttribute("class", "paper-connections-bundle-hub");
		hubElem.setAttribute("data-bundle-id", bundle.id);
		hubElem.setAttribute("cx", String(bundle.x));
		hubElem.setAttribute("cy", String(bundle.y));
		hubElem.setAttribute("r", "4.6");
		hubElem.classList.toggle("active", this.isBundleVisibleInState(state, bundle.id));
	},

	createNodeGroupElement(doc, state, node) {
		const SVG_NS = "http://www.w3.org/2000/svg";
		let group = doc.createElementNS(SVG_NS, "g");
		group.setAttribute("data-node-id", node.id);
		this.updateNodeGroupElementDOM(state, node, group, doc);
		return group;
	},

	createNodeTextElement(doc, width, height, labelLines) {
		const SVG_NS = "http://www.w3.org/2000/svg";
		let text = doc.createElementNS(SVG_NS, "text");
		let textBlockHeight = labelLines.length * this.nodeLineHeight;
		let firstLineY = (height - textBlockHeight) / 2 + this.nodeLineHeight * 0.78;
		text.setAttribute("x", String(width / 2));
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
		return text;
	},

	createNodeAnchorElement(doc, side, cx, cy) {
		const SVG_NS = "http://www.w3.org/2000/svg";
		let anchor = doc.createElementNS(SVG_NS, "circle");
		anchor.setAttribute("class", "paper-connections-node-anchor");
		anchor.setAttribute("data-anchor-side", side);
		anchor.setAttribute("cx", String(cx));
		anchor.setAttribute("cy", String(cy));
		anchor.setAttribute("r", "4");
		return anchor;
	},

	updateNodeGroupElementDOM(state, node, group, doc = state?.window?.document) {
		if (!state || !node || !group || this.isBundleNodeState(node)) return;
		this.syncNodeRenderMetrics(node);
		let width = node.renderWidth;
		let height = node.renderHeight;
		let labelLines = node.renderLabelLines || this.wrapNodeLabel(node.label, width);
		let isRenamingNode = state.renamingNodeID === node.id;

		group.setAttribute("class", this.getNodeClassName(state, node));
		group.setAttribute("data-node-id", node.id);
		group.setAttribute("transform", `translate(${node.x},${node.y})`);

		let rect = group.querySelector("rect");
		if (!rect && doc) {
			rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
			group.appendChild(rect);
		}
		if (rect) {
			rect.setAttribute("width", String(width));
			rect.setAttribute("height", String(height));
			rect.setAttribute("rx", "10");
			rect.setAttribute("ry", "10");
		}

		let titleElem = group.querySelector("title");
		let textElem = group.querySelector("text");
		if (isRenamingNode) {
			titleElem?.remove();
			textElem?.remove();
		}
		else if (doc) {
			if (!titleElem) {
				titleElem = doc.createElementNS("http://www.w3.org/2000/svg", "title");
				group.appendChild(titleElem);
			}
			titleElem.textContent = node.label || "";

			if (!textElem) {
				textElem = this.createNodeTextElement(doc, width, height, labelLines);
				group.appendChild(textElem);
			}
			else {
				let textBlockHeight = labelLines.length * this.nodeLineHeight;
				let firstLineY = (height - textBlockHeight) / 2 + this.nodeLineHeight * 0.78;
				textElem.setAttribute("x", String(width / 2));
				textElem.setAttribute("y", String(firstLineY));
				textElem.setAttribute("text-anchor", "middle");
				textElem.replaceChildren();
				for (let i = 0; i < labelLines.length; i++) {
					let tspan = doc.createElementNS("http://www.w3.org/2000/svg", "tspan");
					tspan.setAttribute("x", String(width / 2));
					if (i > 0) {
						tspan.setAttribute("dy", String(this.nodeLineHeight));
					}
					tspan.textContent = labelLines[i];
					textElem.appendChild(tspan);
				}
			}
		}

		let leftAnchor = group.querySelector(`.paper-connections-node-anchor[data-anchor-side="left"]`);
		if (!leftAnchor && doc) {
			leftAnchor = this.createNodeAnchorElement(doc, "left", 0, height / 2);
			group.appendChild(leftAnchor);
		}
		if (leftAnchor) {
			leftAnchor.setAttribute("cx", "0");
			leftAnchor.setAttribute("cy", String(height / 2));
			leftAnchor.setAttribute("r", "4");
			leftAnchor.classList.toggle("active", this.isAnchorVisibleInState(state, node.id, "left"));
		}

		let rightAnchor = group.querySelector(`.paper-connections-node-anchor[data-anchor-side="right"]`);
		if (!rightAnchor && doc) {
			rightAnchor = this.createNodeAnchorElement(doc, "right", width, height / 2);
			group.appendChild(rightAnchor);
		}
		if (rightAnchor) {
			rightAnchor.setAttribute("cx", String(width));
			rightAnchor.setAttribute("cy", String(height / 2));
			rightAnchor.setAttribute("r", "4");
			rightAnchor.classList.toggle("active", this.isAnchorVisibleInState(state, node.id, "right"));
		}
	},

	getNodeDOMGeometrySignature(state, nodeID) {
		if (!state || !nodeID) return "";
		let node = this.getNodeByID?.(state, nodeID) || null;
		if (this.isBundleNodeState(node)) {
			let hub = state.bundleHubElemsByID?.get(nodeID)
				|| state.overlayGroup?.querySelector?.(`.paper-connections-bundle-hub[data-bundle-id="${nodeID}"]`);
			if (!hub) return "";
			return `${hub.getAttribute("cx") || ""}|${hub.getAttribute("cy") || ""}`;
		}
		let group = state.nodeElemsByID?.get(nodeID)
			|| state.nodesGroup?.querySelector?.(`.paper-connections-node[data-node-id="${nodeID}"]`);
		if (!group) return "";
		let rect = group.querySelector("rect");
		return `${group.getAttribute("transform") || ""}|${rect?.getAttribute("width") || ""}|${rect?.getAttribute("height") || ""}`;
	},

	getNodeTargetGeometrySignature(node) {
		if (!node) return "";
		if (this.isBundleNodeState(node)) {
			return `${node.x}|${node.y}`;
		}
		this.syncNodeRenderMetrics(node);
		return `translate(${node.x},${node.y})|${node.renderWidth}|${node.renderHeight}`;
	},

	getEdgeByID(state, edgeID) {
		if (!state?.edges?.length || !edgeID) return null;
		return state.edges.find((edge) => edge.id === edgeID) || null;
	},

	getIncidentEdgeIDs(state, nodeID) {
		if (!state?.edges?.length || !nodeID) return [];
		return state.edges
			.filter((edge) => edge.from === nodeID || edge.to === nodeID)
			.map((edge) => edge.id);
	},

	getBundleSiblingEdgeIDs(state, bundleID) {
		if (!bundleID) return [];
		return this.getIncidentEdgeIDs(state, bundleID);
	},

	getRelatedEdgeIDsForNode(state, nodeID, propagate = false) {
		let related = new Set(this.getIncidentEdgeIDs(state, nodeID));
		if (propagate !== "bundle") {
			return Array.from(related);
		}
		let relatedBundleIDs = new Set();
		let node = this.getNodeByID?.(state, nodeID) || null;
		if (this.isBundleNodeState(node)) {
			relatedBundleIDs.add(nodeID);
		}
		for (let edgeID of related) {
			let edge = this.getEdgeByID(state, edgeID);
			if (!edge) continue;
			let fromNode = this.getNodeByID?.(state, edge.from) || null;
			let toNode = this.getNodeByID?.(state, edge.to) || null;
			if (this.isBundleNodeState(fromNode)) {
				relatedBundleIDs.add(fromNode.id);
			}
			if (this.isBundleNodeState(toNode)) {
				relatedBundleIDs.add(toNode.id);
			}
		}
		for (let bundleID of relatedBundleIDs) {
			for (let edgeID of this.getBundleSiblingEdgeIDs(state, bundleID)) {
				related.add(edgeID);
			}
		}
		return Array.from(related);
	},

	getRelatedEdgeIDsForEdge(state, edgeID, propagate = false) {
		let related = new Set([edgeID]);
		if (propagate !== "bundle") {
			return Array.from(related);
		}
		let edge = this.getEdgeByID(state, edgeID);
		if (!edge) return Array.from(related);
		let fromNode = this.getNodeByID?.(state, edge.from) || null;
		let toNode = this.getNodeByID?.(state, edge.to) || null;
		if (this.isBundleNodeState(fromNode)) {
			for (let siblingEdgeID of this.getBundleSiblingEdgeIDs(state, fromNode.id)) {
				related.add(siblingEdgeID);
			}
		}
		if (this.isBundleNodeState(toNode)) {
			for (let siblingEdgeID of this.getBundleSiblingEdgeIDs(state, toNode.id)) {
				related.add(siblingEdgeID);
			}
		}
		return Array.from(related);
	},

	getEdgeRenderData(state, edge) {
		if (!state || !edge) return null;
		let fromNode = this.getNodeByID?.(state, edge.from) || null;
		let toNode = this.getNodeByID?.(state, edge.to) || null;
		if (!fromNode || !toNode) return null;
		let curve = this.getBezierCurveForEdgeNodes(fromNode, toNode);
		if (!curve) return null;
		return {
			kind: "direct",
			edgeID: edge.id,
			pathD: this.buildBezierPathFromCurve(curve),
			curve,
			markerEnd: !this.isBundleNodeState(toNode),
			markerStart: false,
		};
	},

	updateEdgeDOM(window, edgeID, options = {}) {
		let state = this.graphStates.get(window);
		if (!state || !edgeID) return false;
		let edge = this.getEdgeByID(state, edgeID);
		if (!edge) return false;
		let path = state.edgeElemsByID?.get(edgeID)
			|| state.edgesGroup?.querySelector?.(`.paper-connections-edge[data-edge-id="${edgeID}"]`);
		if (!path) return false;
		state.edgeElemsByID?.set(edgeID, path);
		let oldSignature = `${path.getAttribute("d") || ""}|${path.getAttribute("marker-end") || ""}|${path.getAttribute("marker-start") || ""}`;
		let edgePath = this.getEdgeRenderData(state, edge);
		if (!edgePath) return false;
		this.applyEdgePathDataToElement(path, edgePath);
		let nextSignature = `${path.getAttribute("d") || ""}|${path.getAttribute("marker-end") || ""}|${path.getAttribute("marker-start") || ""}`;
		if (options.propagate === "bundle") {
			for (let relatedEdgeID of this.getRelatedEdgeIDsForEdge(state, edgeID, "bundle")) {
				if (relatedEdgeID === edgeID) continue;
				this.updateEdgeDOM(window, relatedEdgeID, { propagate: false });
			}
		}
		return oldSignature !== nextSignature;
	},

	updateNodeDOM(window, nodeID, options = {}) {
		let state = this.graphStates.get(window);
		if (!state || !nodeID) return false;
		let node = this.getNodeByID?.(state, nodeID) || null;
		if (!node) return false;
		let oldSignature = this.getNodeDOMGeometrySignature(state, nodeID);
		if (this.isBundleNodeState(node)) {
			let hubElem = state.bundleHubElemsByID?.get(nodeID)
				|| state.overlayGroup?.querySelector?.(`.paper-connections-bundle-hub[data-bundle-id="${nodeID}"]`);
			if (!hubElem) return false;
			state.bundleHubElemsByID?.set(nodeID, hubElem);
			this.updateBundleHubElementDOM(state, node, hubElem);
		}
		else {
			let group = state.nodeElemsByID?.get(nodeID)
				|| state.nodesGroup?.querySelector?.(`.paper-connections-node[data-node-id="${nodeID}"]`);
			if (!group) return false;
			state.nodeElemsByID?.set(nodeID, group);
			this.updateNodeGroupElementDOM(state, node, group, window.document);
		}
		let geometryChanged = oldSignature !== this.getNodeTargetGeometrySignature(node);
		if (options.propagate) {
			for (let edgeID of this.getRelatedEdgeIDsForNode(state, nodeID, options.propagate)) {
				this.updateEdgeDOM(window, edgeID, { propagate: false });
			}
		}
		if (this.isBundleNodeState(node)) {
			this.updateBundleVisibilityForHubElement(state, nodeID);
		}
		else {
			this.updateAnchorVisibilityForNodeElement(state, nodeID);
		}
		if (state.renamingNodeID === nodeID || state.selectedNodeID === nodeID) {
			this.syncNodeRenameInputLayout(window);
		}
		return geometryChanged;
	},

	updateAnchorVisibilityForNodeElement(state, nodeID) {
		if (!state || !nodeID) return;
		let elem = state.nodeElemsByID?.get(nodeID)
			|| state.nodesGroup?.querySelector?.(`.paper-connections-node[data-node-id="${nodeID}"]`);
		if (!elem) return;
		for (let side of ["left", "right"]) {
			let anchor = elem.querySelector(`.paper-connections-node-anchor[data-anchor-side="${side}"]`);
			if (!anchor) continue;
			anchor.classList.toggle("active", this.isAnchorVisibleInState(state, nodeID, side));
		}
	},

	updateBundleVisibilityForHubElement(state, bundleID) {
		if (!state || !bundleID) return;
		let hubElem = state.bundleHubElemsByID?.get(bundleID)
			|| state.overlayGroup?.querySelector?.(`.paper-connections-bundle-hub[data-bundle-id="${bundleID}"]`);
		if (!hubElem) return;
		hubElem.classList.toggle("active", this.isBundleVisibleInState(state, bundleID));
	},

	getVisibleBundleNodes(state) {
		if (!state) return [];
		return (state.nodes || [])
			.filter((node) => this.isBundleNodeState(node))
			.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y))
			.map((node) => ({
				id: node.id,
				x: node.x,
				y: node.y,
			}));
	},

	getVisibleEdgeRenderData(state) {
		let nodeMap = new Map((state?.nodes || []).map((node) => [node.id, node]));
		let bundles = this.getVisibleBundleNodes(state);
		let paths = [];
		for (let edge of state?.edges || []) {
			let fromNode = nodeMap.get(edge.from);
			let toNode = nodeMap.get(edge.to);
			if (!fromNode || !toNode) continue;
			let curve = this.getBezierCurveForEdgeNodes(fromNode, toNode);
			if (!curve) continue;
			paths.push({
				kind: "direct",
				edgeID: edge.id,
				pathD: this.buildBezierPathFromCurve(curve),
				curve,
				markerEnd: !this.isBundleNodeState(toNode),
			});
		}
		return {
			paths,
			bundles,
			edgeToBundleID: {},
		};
	},

	buildBezierPath(fromNode, toNode) {
		let curve = this.getBezierCurveForEdgeNodes(fromNode, toNode);
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

	clampBundleSlope(value) {
		if (!Number.isFinite(value)) return 0;
		return Math.max(-2.2, Math.min(2.2, value));
	},

	getBezierCurveByEndpointsWithSlopes(startX, startY, endX, endY, options = {}) {
		let curve = this.getBezierCurveByEndpoints(startX, startY, endX, endY);
		let startSlope = Number.isFinite(options.startSlope) ? this.clampBundleSlope(options.startSlope) : null;
		let endSlope = Number.isFinite(options.endSlope) ? this.clampBundleSlope(options.endSlope) : null;
		if (Number.isFinite(startSlope)) {
			curve.c1.y = startY + startSlope * (curve.c1.x - startX);
		}
		if (Number.isFinite(endSlope)) {
			curve.c2.y = endY - endSlope * (endX - curve.c2.x);
		}
		return curve;
	},

	normalizeBezierHandleScale(value) {
		let scale = Number(value);
		if (!Number.isFinite(scale)) return 1;
		return Math.max(0, Math.min(1, scale));
	},

	getBezierCurveByEndpointsWithEndpointHandleScale(startX, startY, endX, endY, options = {}) {
		let curve = this.getBezierCurveByEndpoints(startX, startY, endX, endY);
		let startHandleScale = this.normalizeBezierHandleScale(options.startHandleScale);
		let endHandleScale = this.normalizeBezierHandleScale(options.endHandleScale);
		curve.c1.x = curve.start.x + (curve.c1.x - curve.start.x) * startHandleScale;
		curve.c1.y = curve.start.y + (curve.c1.y - curve.start.y) * startHandleScale;
		curve.c2.x = curve.end.x + (curve.c2.x - curve.end.x) * endHandleScale;
		curve.c2.y = curve.end.y + (curve.c2.y - curve.end.y) * endHandleScale;
		return curve;
	},

	applyBezierHandleScaleToCurve(curve, options = {}) {
		if (!curve) return curve;
		if (Number.isFinite(options.startHandleScale)) {
			let startHandleScale = this.normalizeBezierHandleScale(options.startHandleScale);
			curve.c1.x = curve.start.x + (curve.c1.x - curve.start.x) * startHandleScale;
			curve.c1.y = curve.start.y + (curve.c1.y - curve.start.y) * startHandleScale;
		}
		if (Number.isFinite(options.endHandleScale)) {
			let endHandleScale = this.normalizeBezierHandleScale(options.endHandleScale);
			curve.c2.x = curve.end.x + (curve.c2.x - curve.end.x) * endHandleScale;
			curve.c2.y = curve.end.y + (curve.c2.y - curve.end.y) * endHandleScale;
		}
		return curve;
	},

	applyBezierSlopeToCurve(curve, options = {}) {
		if (!curve) return curve;
		if (Number.isFinite(options.startSlope)) {
			let slope = this.clampBundleSlope(options.startSlope);
			curve.c1.y = curve.start.y + slope * (curve.c1.x - curve.start.x);
		}
		if (Number.isFinite(options.endSlope)) {
			let slope = this.clampBundleSlope(options.endSlope);
			curve.c2.y = curve.end.y - slope * (curve.end.x - curve.c2.x);
		}
		return curve;
	},

	isBundleNodeState(node) {
		return String(node?.nodeType || "").toLowerCase() === "bundle";
	},

	getEdgeEndpointForNode(node, role) {
		if (!node || (role !== "from" && role !== "to")) return null;
		if (this.isBundleNodeState(node)) {
			return {
				x: node.x,
				y: node.y,
			};
		}
		let width = Number.isFinite(node.renderWidth) ? node.renderWidth :
			(Number.isFinite(node.width) ? node.width : this.nodeDefaultWidth);
		let height = Number.isFinite(node.renderHeight) ? node.renderHeight :
			(Number.isFinite(node.height) ? node.height : this.nodeDefaultHeight);
		return role === "from"
			? { x: node.x + width, y: node.y + height / 2 }
			: { x: node.x, y: node.y + height / 2 };
	},

	getEdgeCurveConstraintsForNodes(fromNode, toNode) {
		let constraints = {};
		if (this.isBundleNodeState(fromNode)) {
			let mode = this.normalizeBundleSlopeMode(fromNode.slopeMode);
			if (mode === "flat") {
				constraints.startSlope = 0;
			}
			else {
				constraints.startHandleScale = 0;
			}
		}
		if (this.isBundleNodeState(toNode)) {
			let mode = this.normalizeBundleSlopeMode(toNode.slopeMode);
			if (mode === "flat") {
				constraints.endSlope = 0;
			}
			else {
				constraints.endHandleScale = 0;
			}
		}
		return constraints;
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
		let start = this.getEdgeEndpointForNode(fromNode, "from");
		let end = this.getEdgeEndpointForNode(toNode, "to");
		if (!start || !end) return null;
		let curve = this.getBezierCurveByEndpoints(start.x, start.y, end.x, end.y);
		let constraints = this.getEdgeCurveConstraintsForNodes(fromNode, toNode);
		this.applyBezierHandleScaleToCurve(curve, constraints);
		this.applyBezierSlopeToCurve(curve, constraints);
		return curve;
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

	getSegmentIntersectionPoint(a1, a2, b1, b2, epsilon = 1e-6) {
		if (!a1 || !a2 || !b1 || !b2) return null;
		let dx1 = a2.x - a1.x;
		let dy1 = a2.y - a1.y;
		let dx2 = b2.x - b1.x;
		let dy2 = b2.y - b1.y;
		let denominator = dx1 * dy2 - dy1 * dx2;
		if (Math.abs(denominator) <= epsilon) {
			if (!this.doSegmentsIntersect(a1, a2, b1, b2, epsilon)) return null;
			if (this.isPointOnSegment(b1, a1, a2, epsilon)) return { x: b1.x, y: b1.y };
			if (this.isPointOnSegment(b2, a1, a2, epsilon)) return { x: b2.x, y: b2.y };
			if (this.isPointOnSegment(a1, b1, b2, epsilon)) return { x: a1.x, y: a1.y };
			if (this.isPointOnSegment(a2, b1, b2, epsilon)) return { x: a2.x, y: a2.y };
			return null;
		}
		let t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denominator;
		let u = ((b1.x - a1.x) * dy1 - (b1.y - a1.y) * dx1) / denominator;
		if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) return null;
		return {
			x: a1.x + t * dx1,
			y: a1.y + t * dy1,
		};
	},

	getCurveIntersectionPointWithSegment(cutStart, cutEnd, curve, steps = 28) {
		if (!cutStart || !cutEnd || !curve) return null;
		let prev = curve.start;
		for (let i = 1; i <= steps; i++) {
			let t = i / steps;
			let curr = this.getPointOnCubicBezier(curve, t);
			let intersection = this.getSegmentIntersectionPoint(cutStart, cutEnd, prev, curr);
			if (intersection) {
				return intersection;
			}
			prev = curr;
		}
		return null;
	},

	getEdgeIntersectionPointForLine(state, edge, cutStart, cutEnd, steps = 28) {
		if (!state || !edge || !cutStart || !cutEnd) return null;
		let nodeMap = new Map((state.nodes || []).map((node) => [node.id, node]));
		let fromNode = nodeMap.get(edge.from);
		let toNode = nodeMap.get(edge.to);
		if (!fromNode || !toNode) return null;
		let curve = this.getBezierCurveForEdgeNodes(fromNode, toNode);
		return this.getCurveIntersectionPointWithSegment(cutStart, cutEnd, curve, steps);
	},

	doCutSegmentIntersectCurve(cutStart, cutEnd, curve, steps = 28) {
		return !!this.getCurveIntersectionPointWithSegment(cutStart, cutEnd, curve, steps);
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
		if (typeof this.cleanupIsolatedBundleNodesInState === "function") {
			this.cleanupIsolatedBundleNodesInState(state);
		}

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
		let nodeElems = state.nodesGroup.querySelectorAll(".paper-connections-node[data-node-id]");
		for (let elem of nodeElems) {
			let nodeID = elem.getAttribute("data-node-id");
			for (let side of ["left", "right"]) {
				let anchor = elem.querySelector(`.paper-connections-node-anchor[data-anchor-side="${side}"]`);
				if (!anchor) continue;
				anchor.classList.toggle("active", this.isAnchorVisibleInState(state, nodeID, side));
			}
		}
	},

	isBundleVisibleInState(state, bundleID) {
		if (!state || !bundleID) return false;
		if (state.dragBundleID === bundleID) return true;
		if (state.hoverBundleID === bundleID) return true;
		return false;
	},

	applyBundleVisibilityToDOM(state) {
		if (!state?.overlayGroup) return;
		let hubElems = state.overlayGroup.querySelectorAll(".paper-connections-bundle-hub[data-bundle-id]");
		for (let hubElem of hubElems) {
			let bundleID = hubElem.getAttribute("data-bundle-id");
			hubElem.classList.toggle("active", this.isBundleVisibleInState(state, bundleID));
		}
	},

	getNodeAnchorPoint(node, side) {
		if (!node || (side !== "left" && side !== "right")) return null;
		if (this.isBundleNodeState(node)) return null;
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
			if (this.isBundleNodeState(node)) continue;
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
		if (state?.window) {
			this.syncNodeRenameInputLayout(state.window);
		}
	},

};
