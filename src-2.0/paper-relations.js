PaperRelations = {
	id: null,
	version: null,
	rootURI: null,
	initialized: false,
	addedElementIDs: [],

	customSectionID: "paper-relations-relations",
	selectionSectionID: "paper-relations-relations-selection",
	sectionRegistered: false,

	graphStates: null,
	selectionSectionListeners: null,

	init({ id, version, rootURI }) {
		if (this.initialized) return;
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
		this.graphStates = new WeakMap();
		this.selectionSectionListeners = new WeakMap();
		this.initialized = true;
	},

	log(msg) {
		Zotero.debug("Paper Relations: " + msg);
	},

	registerItemPaneSections() {
		if (this.sectionRegistered) return;
		if (!Zotero.ItemPaneManager?.registerSection) {
			this.log("ItemPaneManager API is not available");
			return;
		}

		const XHTML_NS = "http://www.w3.org/1999/xhtml";

		Zotero.ItemPaneManager.registerSection({
			paneID: this.customSectionID,
			pluginID: this.id,
			header: {
				l10nID: "paper-relations-relations-header",
				icon: "chrome://zotero/skin/itempane/16/related.svg",
			},
			sidenav: {
				l10nID: "paper-relations-relations-sidenav",
				icon: "chrome://zotero/skin/itempane/20/related.svg",
			},
			onItemChange: ({ item, setEnabled, setSectionSummary }) => {
				setEnabled(!!item);
				setSectionSummary(item ? `Item: ${item.key}` : "");
			},
			onRender: ({ doc, body, item }) => {
				body.replaceChildren();

				const title = doc.createElementNS(XHTML_NS, "div");
				title.textContent = "Paper Relations";
				title.style.fontWeight = "700";
				title.style.marginBottom = "8px";

				const desc = doc.createElementNS(XHTML_NS, "div");
				desc.textContent = "This pane is the control/summary area for relation editing and graph operations.";
				desc.style.marginBottom = "8px";

				const list = doc.createElementNS(XHTML_NS, "ul");
				list.style.margin = "0";
				list.style.paddingInlineStart = "18px";

				const row1 = doc.createElementNS(XHTML_NS, "li");
				row1.textContent = `Current Zotero item key: ${item?.key || "-"}`;
				const row2 = doc.createElementNS(XHTML_NS, "li");
				row2.textContent = "Relation types: cites / extends / contradicts / related";
				const row3 = doc.createElementNS(XHTML_NS, "li");
				row3.textContent = "Graph interactions: wheel zoom, drag canvas, drag selected node";

				list.append(row1, row2, row3);
				body.append(title, desc, list);
			},
		});

		Zotero.ItemPaneManager.registerSection({
			paneID: this.selectionSectionID,
			pluginID: this.id,
			header: {
				l10nID: "paper-relations-selection-header",
				icon: "chrome://zotero/skin/itempane/16/info.svg",
			},
			sidenav: {
				l10nID: "paper-relations-selection-sidenav",
				icon: "chrome://zotero/skin/itempane/20/info.svg",
			},
			onInit: ({ doc, body, refresh }) => {
				let win = doc.defaultView;
				let listener = () => refresh();
				win.addEventListener("paper-relations:graph-selection-changed", listener);
				this.selectionSectionListeners.set(body, { win, listener });
			},
			onDestroy: ({ body }) => {
				let data = this.selectionSectionListeners.get(body);
				if (!data) return;
				data.win.removeEventListener("paper-relations:graph-selection-changed", data.listener);
				this.selectionSectionListeners.delete(body);
			},
			onItemChange: ({ item, setEnabled, setSectionSummary }) => {
				setEnabled(!!item);
				setSectionSummary("Graph Selection");
			},
			onRender: ({ doc, body }) => {
				body.replaceChildren();
				let info = this.getGraphSelectionInfo(doc.defaultView);

				const title = doc.createElementNS(XHTML_NS, "div");
				title.textContent = "Graph Selection Debug";
				title.style.fontWeight = "700";
				title.style.marginBottom = "8px";
				body.appendChild(title);

				if (!info) {
					const empty = doc.createElementNS(XHTML_NS, "div");
					empty.textContent = "No graph node selected. Click a node in the lower graph panel.";
					body.appendChild(empty);
					return;
				}

				const meta = doc.createElementNS(XHTML_NS, "div");
				meta.textContent = `Selected: ${info.label} (${info.id})`;
				meta.style.marginBottom = "8px";
				body.appendChild(meta);

				const makeListBlock = (label, values) => {
					const wrap = doc.createElementNS(XHTML_NS, "div");
					wrap.style.marginBottom = "8px";
					const head = doc.createElementNS(XHTML_NS, "div");
					head.textContent = label;
					head.style.fontWeight = "600";
					head.style.marginBottom = "4px";
					wrap.appendChild(head);
					const list = doc.createElementNS(XHTML_NS, "ul");
					list.style.margin = "0";
					list.style.paddingInlineStart = "18px";
					if (!values.length) {
						const li = doc.createElementNS(XHTML_NS, "li");
						li.textContent = "(none)";
						list.appendChild(li);
					}
					else {
						for (let value of values) {
							const li = doc.createElementNS(XHTML_NS, "li");
							li.textContent = value;
							list.appendChild(li);
						}
					}
					wrap.appendChild(list);
					return wrap;
				};

				body.append(
					makeListBlock("Outgoing links", info.outgoing),
					makeListBlock("Incoming links", info.incoming),
				);
			},
		});

		this.sectionRegistered = true;
	},

	unregisterItemPaneSections() {
		if (!this.sectionRegistered) return;
		if (!Zotero.ItemPaneManager?.unregisterSection) return;
		Zotero.ItemPaneManager.unregisterSection(this.customSectionID);
		Zotero.ItemPaneManager.unregisterSection(this.selectionSectionID);
		this.sectionRegistered = false;
	},

	addToWindow(window) {
		let doc = window.document;

		if (!doc.getElementById("paper-relations-stylesheet")) {
			let link = doc.createElement("link");
			link.id = "paper-relations-stylesheet";
			link.type = "text/css";
			link.rel = "stylesheet";
			link.href = this.rootURI + "style.css";
			doc.documentElement.appendChild(link);
			this.storeAddedElement(link);
		}

		window.MozXULElement.insertFTLIfNeeded("paper-relations.ftl");
		this.addGraphPane(window);
	},

	addGraphPane(window) {
		let doc = window.document;
		if (doc.getElementById("paper-relations-graph-pane")) return;

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

		let header = doc.createElementNS(XHTML_NS, "div");
		header.id = "paper-relations-graph-header";
		header.textContent = "Paper Relation Graph (Placeholder)";

		let subheader = doc.createElementNS(XHTML_NS, "div");
		subheader.id = "paper-relations-graph-subheader";
		subheader.textContent = "Wheel: zoom | Drag blank space: pan | Click/select node, then drag node";

		let canvas = doc.createElementNS(XHTML_NS, "div");
		canvas.id = "paper-relations-graph-canvas";

		let svg = doc.createElementNS(SVG_NS, "svg");
		svg.setAttribute("viewBox", "0 0 1000 420");

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
		svg.appendChild(defs);

		let viewport = doc.createElementNS(SVG_NS, "g");
		viewport.setAttribute("id", "paper-relations-graph-viewport");
		let edgesGroup = doc.createElementNS(SVG_NS, "g");
		edgesGroup.setAttribute("class", "paper-relations-edges");
		let nodesGroup = doc.createElementNS(SVG_NS, "g");
		nodesGroup.setAttribute("class", "paper-relations-nodes");
		viewport.append(edgesGroup, nodesGroup);
		svg.appendChild(viewport);
		canvas.appendChild(svg);

		pane.append(header, subheader, canvas);
		itemsContainer.append(splitter, pane);

		this.storeAddedElement(splitter);
		this.storeAddedElement(pane);

		let model = this.createInitialGraphModel();
		let state = {
			window,
			svg,
			viewport,
			edgesGroup,
			nodesGroup,
			nodes: model.nodes,
			edges: model.edges,
			selectedNodeID: null,
			scale: 1,
			panX: 40,
			panY: 26,
			dragMode: null,
			dragNodeID: null,
			lastClientX: 0,
			lastClientY: 0,
			handlers: null,
		};

		state.handlers = {
			wheel: (event) => this.onGraphWheel(window, event),
			mousedown: (event) => this.onGraphMouseDown(window, event),
			mousemove: (event) => this.onGraphMouseMove(window, event),
			mouseup: (event) => this.onGraphMouseUp(window, event),
		};

		svg.addEventListener("wheel", state.handlers.wheel, { passive: false });
		svg.addEventListener("mousedown", state.handlers.mousedown);
		window.addEventListener("mousemove", state.handlers.mousemove);
		window.addEventListener("mouseup", state.handlers.mouseup);

		this.graphStates.set(window, state);
		this.renderGraph(window);
		this.notifyGraphSelectionChanged(window);
	},

	createInitialGraphModel() {
		return {
			nodes: [
				{ id: "n0", label: "Central Paper", x: 20, y: 150, width: 220, height: 60, kind: "root" },
				{ id: "n1", label: "Method Line A", x: 360, y: 60, width: 220, height: 60, kind: "leaf" },
				{ id: "n2", label: "Method Line B", x: 360, y: 240, width: 220, height: 60, kind: "leaf" },
				{ id: "n3", label: "Follow-up A1", x: 700, y: 30, width: 220, height: 60, kind: "leaf" },
				{ id: "n4", label: "Follow-up A2", x: 700, y: 140, width: 220, height: 60, kind: "leaf" },
				{ id: "n5", label: "Follow-up B1", x: 700, y: 255, width: 220, height: 60, kind: "leaf" },
			],
			edges: [
				{ from: "n0", to: "n1" },
				{ from: "n0", to: "n2" },
				{ from: "n1", to: "n3" },
				{ from: "n1", to: "n4" },
				{ from: "n2", to: "n5" },
			],
		};
	},

	renderGraph(window) {
		let state = this.graphStates.get(window);
		if (!state) return;

		let { nodes, edges, edgesGroup, nodesGroup } = state;
		let doc = window.document;
		const SVG_NS = "http://www.w3.org/2000/svg";

		edgesGroup.replaceChildren();
		nodesGroup.replaceChildren();

		for (let edge of edges) {
			let fromNode = nodes.find((n) => n.id === edge.from);
			let toNode = nodes.find((n) => n.id === edge.to);
			if (!fromNode || !toNode) continue;
			let path = doc.createElementNS(SVG_NS, "path");
			path.setAttribute("class", "paper-relations-edge");
			path.setAttribute("d", this.buildBezierPath(fromNode, toNode));
			edgesGroup.appendChild(path);
		}

		for (let node of nodes) {
			let group = doc.createElementNS(SVG_NS, "g");
			let selectedClass = state.selectedNodeID === node.id ? " selected" : "";
			group.setAttribute("class", `paper-relations-node ${node.kind}${selectedClass}`);
			group.setAttribute("data-node-id", node.id);
			group.setAttribute("transform", `translate(${node.x},${node.y})`);

			let rect = doc.createElementNS(SVG_NS, "rect");
			rect.setAttribute("width", String(node.width));
			rect.setAttribute("height", String(node.height));
			rect.setAttribute("rx", "14");
			rect.setAttribute("ry", "14");

			let text = doc.createElementNS(SVG_NS, "text");
			text.setAttribute("x", String(node.width / 2));
			text.setAttribute("y", String(node.height / 2));
			text.setAttribute("text-anchor", "middle");
			text.setAttribute("dominant-baseline", "middle");
			text.textContent = node.label;

			group.append(rect, text);
			nodesGroup.appendChild(group);
		}

		this.updateGraphTransform(state);
	},

	buildBezierPath(fromNode, toNode) {
		let startX = fromNode.x + fromNode.width;
		let startY = fromNode.y + fromNode.height / 2;
		let endX = toNode.x;
		let endY = toNode.y + toNode.height / 2;

		let dx = endX - startX;
		let direction = dx === 0 ? 1 : Math.sign(dx);
		let curve = Math.max(72, Math.abs(dx) * 0.45);
		let c1x = startX + curve * direction;
		let c2x = endX - curve * direction;

		return `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`;
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

	onGraphMouseDown(window, event) {
		if (event.button !== 0) return;
		let state = this.graphStates.get(window);
		if (!state) return;

		let nodeElem = event.target.closest("[data-node-id]");
		state.dragMode = nodeElem ? "node" : "pan";
		state.dragNodeID = nodeElem ? nodeElem.getAttribute("data-node-id") : null;
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;

		if (state.dragNodeID) {
			this.selectGraphNode(window, state.dragNodeID);
		}
		else {
			this.selectGraphNode(window, null);
		}
		event.preventDefault();
	},

	onGraphMouseMove(window, event) {
		let state = this.graphStates.get(window);
		if (!state || !state.dragMode) return;

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
				node.x += dx / state.scale;
				node.y += dy / state.scale;
				this.renderGraph(window);
				this.notifyGraphSelectionChanged(window);
			}
		}

		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;
		event.preventDefault();
	},

	onGraphMouseUp(window) {
		let state = this.graphStates.get(window);
		if (!state) return;
		state.dragMode = null;
		state.dragNodeID = null;
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

	addToAllWindows() {
		let windows = Zotero.getMainWindows();
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.addToWindow(win);
		}
	},

	storeAddedElement(elem) {
		if (!elem.id) {
			throw new Error("Element must have an id");
		}
		if (!this.addedElementIDs.includes(elem.id)) {
			this.addedElementIDs.push(elem.id);
		}
	},

	removeFromWindow(window) {
		let state = this.graphStates.get(window);
		if (state?.handlers) {
			state.svg.removeEventListener("wheel", state.handlers.wheel);
			state.svg.removeEventListener("mousedown", state.handlers.mousedown);
			window.removeEventListener("mousemove", state.handlers.mousemove);
			window.removeEventListener("mouseup", state.handlers.mouseup);
		}
		this.graphStates.delete(window);

		let doc = window.document;
		for (let id of this.addedElementIDs) {
			doc.getElementById(id)?.remove();
		}
		doc.querySelector('[href="paper-relations.ftl"]')?.remove();
	},

	removeFromAllWindows() {
		let windows = Zotero.getMainWindows();
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.removeFromWindow(win);
		}
		this.unregisterItemPaneSections();
	},

	async main() {
		this.registerItemPaneSections();

		let host = new URL("https://foo.com/path").host;
		this.log(`Host is ${host}`);
	},
};

