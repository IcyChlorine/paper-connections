var PaperRelationsGraphWorkspaceContextExportMixin = {
	positionContextMenuInCanvas(state, menuElem, clientX, clientY) {
		if (!state?.canvas || !menuElem) return;
		let canvasRect = state.canvas.getBoundingClientRect();
		let left = clientX - canvasRect.left;
		let top = clientY - canvasRect.top;
		menuElem.style.left = `${Math.max(6, Math.round(left))}px`;
		menuElem.style.top = `${Math.max(6, Math.round(top))}px`;

		let menuRect = menuElem.getBoundingClientRect();
		let maxLeft = Math.max(6, Math.floor(canvasRect.width - menuRect.width - 6));
		let maxTop = Math.max(6, Math.floor(canvasRect.height - menuRect.height - 6));
		let clampedLeft = Math.min(maxLeft, Math.max(6, Math.round(left)));
		let clampedTop = Math.min(maxTop, Math.max(6, Math.round(top)));
		menuElem.style.left = `${clampedLeft}px`;
		menuElem.style.top = `${clampedTop}px`;
	},

	hideNodeContextMenu(window) {
		let state = this.graphStates.get(window);
		if (!state?.nodeContextMenu) return;
		state.nodeContextMenu.hidden = true;
		state.nodeContextMenu.style.display = "none";
		state.contextMenuNodeID = null;
	},

	hideWorkspaceContextMenu(window) {
		let state = this.graphStates.get(window);
		if (!state?.workspaceContextMenu) return;
		state.workspaceContextMenu.hidden = true;
		state.workspaceContextMenu.style.display = "none";
	},

	hideGraphContextMenus(window) {
		this.hideNodeContextMenu(window);
		this.hideWorkspaceContextMenu(window);
	},

	showNodeContextMenu(window, nodeID, clientX, clientY) {
		let state = this.graphStates.get(window);
		if (!state?.nodeContextMenu || !nodeID) return;
		let node = this.getNodeByID(state, nodeID);
		if (!node) {
			this.hideNodeContextMenu(window);
			return;
		}

		state.contextMenuNodeID = nodeID;
		state.removeNodeBtn.disabled = !this.isSavedTopicMutableState(state);
		state.renameNodeBtn.disabled = !this.getItemForNode(node);
		state.nodeContextMenu.hidden = false;
		state.nodeContextMenu.style.display = "flex";
		this.positionContextMenuInCanvas(state, state.nodeContextMenu, clientX, clientY);
	},

	setContextMenuItemVisible(item, visible) {
		if (!item) return;
		let show = !!visible;
		item.hidden = !show;
		item.style.display = show ? "" : "none";
	},

	getSelectedRegularItem(window) {
		let item = this.selectionItemsByWindow.get(window) || this.getCurrentSelectedItem(window);
		if (!item) return null;
		if (typeof item.isRegularItem === "function" && !item.isRegularItem()) return null;
		return item;
	},

	updateWorkspaceContextMenuItems(window) {
		let state = this.graphStates.get(window);
		if (!state) return { canOpen: false };
		let hasSavedTopic = this.isSavedTopicMutableState(state);
		let hasTemporaryTopic = !!state.isTemporaryTopic;
		let selectedItem = this.getSelectedRegularItem(window);
		let canCreateFromSelected = hasTemporaryTopic && !!selectedItem;

		let showRename = hasSavedTopic;
		let showDelete = hasSavedTopic;
		let showExportSVG = hasSavedTopic || hasTemporaryTopic;
		let showExportJSON = hasSavedTopic;
		let showCreateFromSelected = canCreateFromSelected;
		let showSeparator = false;
		if (hasSavedTopic) {
			showSeparator = (showRename || showDelete) && (showExportSVG || showExportJSON);
		}
		else if (hasTemporaryTopic) {
			showSeparator = showCreateFromSelected && showExportSVG;
		}

		this.setContextMenuItemVisible(state.workspaceCreateTopicFromSelectedBtn, showCreateFromSelected);
		this.setContextMenuItemVisible(state.workspaceRenameTopicBtn, showRename);
		this.setContextMenuItemVisible(state.workspaceDeleteTopicBtn, showDelete);
		this.setContextMenuItemVisible(state.workspaceSeparator, showSeparator);
		this.setContextMenuItemVisible(state.workspaceExportSVGBtn, showExportSVG);
		this.setContextMenuItemVisible(state.workspaceExportJSONBtn, showExportJSON);

		return {
			canOpen: !!(showCreateFromSelected || showRename || showDelete || showExportSVG || showExportJSON),
		};
	},

	showWorkspaceContextMenu(window, clientX, clientY) {
		let state = this.graphStates.get(window);
		if (!state?.workspaceContextMenu) return false;
		let menuState = this.updateWorkspaceContextMenuItems(window);
		if (!menuState.canOpen) {
			this.hideWorkspaceContextMenu(window);
			return false;
		}
		state.workspaceContextMenu.hidden = false;
		state.workspaceContextMenu.style.display = "flex";
		this.positionContextMenuInCanvas(state, state.workspaceContextMenu, clientX, clientY);
		return true;
	},

	onNodeContextMenuMouseDown(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		event.stopPropagation();
	},

	onWorkspaceContextMenuMouseDown(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		event.stopPropagation();
	},

	onNodeMenuRemoveClick(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		event.preventDefault();
		event.stopPropagation();
		this.handleNodeContextMenuAction(window, "remove", state.contextMenuNodeID).catch((error) => Zotero.logError(error));
	},

	onNodeMenuRenameClick(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		event.preventDefault();
		event.stopPropagation();
		this.handleNodeContextMenuAction(window, "rename", state.contextMenuNodeID).catch((error) => Zotero.logError(error));
	},

	onWorkspaceMenuItemClick(window, event) {
		let state = this.graphStates.get(window);
		if (!state) return;
		event.preventDefault();
		event.stopPropagation();
		this.hideWorkspaceContextMenu(window);
		let action = event?.currentTarget?.getAttribute?.("data-action")
			|| event?.target?.closest?.("[data-action]")?.getAttribute?.("data-action")
			|| "";
		window.requestAnimationFrame(() => {
			window.setTimeout(() => {
				this.handleWorkspaceContextMenuAction(window, action).catch((error) => Zotero.logError(error));
			}, 0);
		});
	},

	async handleWorkspaceContextMenuAction(window, action) {
		switch (action) {
			case "create-topic-from-selected": {
				let selectedItem = this.getSelectedRegularItem(window);
				if (!selectedItem) return;
				await this.promptCreateTopicFromItem(window, selectedItem);
				return;
			}
			case "rename-topic":
				await this.promptRenameActiveTopic(window);
				return;
			case "delete-topic":
				await this.promptRemoveActiveTopic(window);
				return;
			case "export-svg":
				await this.exportActiveTopicAsSVG(window);
				return;
			case "export-json":
				await this.exportActiveTopicAsJSON(window);
				return;
			default:
				return;
		}
	},

	async handleNodeContextMenuAction(window, action, nodeID) {
		if (!nodeID || !action) return;
		this.hideNodeContextMenu(window);
		if (action === "remove") {
			await this.removeNodeFromActiveTopic(window, nodeID);
			return;
		}
		if (action === "rename") {
			this.startNodeRename(window, nodeID);
		}
	},

	sanitizeFileNameSegment(name) {
		return String(name || "")
			.trim()
			.replace(/[\\/:*?"<>|]+/g, "_")
			.replace(/\s+/g, " ");
	},

	escapeXML(value) {
		return String(value || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	},

	formatSVGNumber(value) {
		let n = Number(value);
		if (!Number.isFinite(n)) return "0";
		return String(Math.round(n * 1000) / 1000);
	},

	getTopicExportBaseName(state) {
		let name = this.sanitizeFileNameSegment(state?.activeTopicName || "");
		if (!name) return "topic";
		return name;
	},

	getGraphExportBounds(state) {
		if (!state) return null;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		let includePoint = (x, y) => {
			if (!Number.isFinite(x) || !Number.isFinite(y)) return;
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		};

		for (let node of state.nodes || []) {
			let metrics = this.getNodeRenderMetrics(node);
			let width = Number.isFinite(node.renderWidth) ? node.renderWidth : metrics.width;
			let height = Number.isFinite(node.renderHeight) ? node.renderHeight : metrics.height;
			includePoint(node.x, node.y);
			includePoint(node.x + width, node.y + height);
		}

		let nodeMap = new Map((state.nodes || []).map((node) => [node.id, node]));
		for (let edge of state.edges || []) {
			let fromNode = nodeMap.get(edge.from);
			let toNode = nodeMap.get(edge.to);
			if (!fromNode || !toNode) continue;
			let curve = this.getBezierCurveForEdgeNodes(fromNode, toNode);
			if (!curve) continue;
			for (let point of [curve.start, curve.c1, curve.c2, curve.end]) {
				includePoint(point.x, point.y);
			}
		}

		if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
			return null;
		}
		return { minX, minY, maxX, maxY };
	},

	getExportTopicDataFromState(state) {
		if (!state) return null;
		let now = this.now();
		let topicID = state.activeTopicID || "temporary";
		let topic = {
			id: topicID,
			libraryID: state.activeLibraryID || null,
			name: state.activeTopicName || "Untitled Topic",
			createdAt: now,
			updatedAt: now,
			nodes: {},
			edges: {},
		};
		for (let node of state.nodes || []) {
			topic.nodes[node.id] = {
				id: node.id,
				libraryID: node.libraryID || state.activeLibraryID || null,
				itemKey: node.itemKey || "",
				title: node.title || node.label || node.itemKey || "",
				shortLabel: node.shortLabel || "",
				note: node.note || "",
				x: Number.isFinite(node.x) ? node.x : 0,
				y: Number.isFinite(node.y) ? node.y : 0,
				createdAt: now,
				updatedAt: now,
			};
		}
		for (let edge of state.edges || []) {
			topic.edges[edge.id] = {
				id: edge.id,
				fromNodeID: edge.from,
				toNodeID: edge.to,
				type: edge.type || "related",
				note: edge.note || "",
				createdAt: now,
				updatedAt: now,
			};
		}
		return topic;
	},

	async getExportTopicData(window) {
		let state = this.graphStates.get(window);
		if (!state) return null;
		if (state.activeTopicID && state.activeLibraryID && !state.isTemporaryTopic) {
			let topic = await this.getTopic(state.activeLibraryID, state.activeTopicID);
			if (topic) return topic;
		}
		return this.getExportTopicDataFromState(state);
	},

	async promptSVGExportOptions(window) {
		let state = this.graphStates.get(window);
		let canvas = state?.canvas;
		let doc = window?.document;
		if (!canvas || !doc) return null;
		const XHTML_NS = "http://www.w3.org/1999/xhtml";

		let backdrop = doc.createElementNS(XHTML_NS, "div");
		backdrop.className = "paper-relations-export-settings-backdrop";
		let dialog = doc.createElementNS(XHTML_NS, "div");
		dialog.className = "paper-relations-export-settings-dialog";
		dialog.setAttribute("role", "dialog");
		dialog.setAttribute("aria-modal", "true");

		let intro = doc.createElementNS(XHTML_NS, "div");
		intro.className = "paper-relations-export-settings-intro";
		intro.textContent = this.getGraphWorkspaceText("svgExportSettingsIntro");

		let includeGridRow = doc.createElementNS(XHTML_NS, "div");
		includeGridRow.className = "paper-relations-export-settings-row";
		let includeGridLabel = doc.createElementNS(XHTML_NS, "label");
		includeGridLabel.className = "paper-relations-export-settings-label";
		includeGridLabel.textContent = this.getGraphWorkspaceText("svgExportIncludeGrid");
		let includeGridControl = doc.createElementNS(XHTML_NS, "span");
		includeGridControl.className = "paper-relations-export-settings-control";
		let includeGridInput = doc.createElementNS(XHTML_NS, "input");
		includeGridInput.type = "checkbox";
		includeGridInput.checked = false;
		includeGridInput.className = "paper-relations-export-settings-checkbox";
		includeGridInput.id = "paper-relations-export-include-grid-input";
		includeGridLabel.htmlFor = "paper-relations-export-include-grid-input";
		includeGridControl.append(includeGridInput);
		includeGridRow.append(includeGridLabel, includeGridControl);

		let marginRow = doc.createElementNS(XHTML_NS, "div");
		marginRow.className = "paper-relations-export-settings-row";
		let marginLabel = doc.createElementNS(XHTML_NS, "label");
		marginLabel.className = "paper-relations-export-settings-label";
		marginLabel.textContent = this.getGraphWorkspaceText("svgExportMargin");
		let marginControl = doc.createElementNS(XHTML_NS, "span");
		marginControl.className = "paper-relations-export-settings-control";
		let marginInput = doc.createElementNS(XHTML_NS, "input");
		marginInput.type = "text";
		marginInput.inputMode = "decimal";
		marginInput.setAttribute("spellcheck", "false");
		marginInput.value = "24";
		marginInput.className = "paper-relations-export-settings-input";
		marginLabel.htmlFor = "paper-relations-export-margin-input";
		marginInput.id = "paper-relations-export-margin-input";
		marginControl.append(marginInput);
		marginRow.append(marginLabel, marginControl);

		let actions = doc.createElementNS(XHTML_NS, "div");
		actions.className = "paper-relations-export-settings-actions";
		let cancelBtn = doc.createElementNS(XHTML_NS, "button");
		cancelBtn.type = "button";
		cancelBtn.className = "paper-relations-export-settings-btn";
		cancelBtn.textContent = this.getGraphWorkspaceText("dialogCancel");
		let confirmBtn = doc.createElementNS(XHTML_NS, "button");
		confirmBtn.type = "button";
		confirmBtn.className = "paper-relations-export-settings-btn paper-relations-export-settings-btn-primary";
		confirmBtn.textContent = this.getGraphWorkspaceText("dialogConfirm");
		actions.append(confirmBtn, cancelBtn);

		dialog.append(intro, includeGridRow, marginRow, actions);
		backdrop.appendChild(dialog);
		canvas.appendChild(backdrop);
		window.setTimeout(() => {
			if (!backdrop.isConnected || !marginInput || typeof marginInput.focus !== "function") return;
			marginInput.focus();
			if (typeof marginInput.select === "function") {
				marginInput.select();
			}
		}, 0);

		let previousActiveElement = doc.activeElement;
		let options = await new Promise((resolve) => {
			let completed = false;
			let finish = (value) => {
				if (completed) return;
				completed = true;
				window.removeEventListener("keydown", onWindowKeyDown, true);
				backdrop.removeEventListener("mousedown", onBackdropMouseDown, true);
				if (backdrop.parentNode) {
					backdrop.parentNode.removeChild(backdrop);
				}
				if (previousActiveElement && typeof previousActiveElement.focus === "function") {
					try {
						previousActiveElement.focus();
					}
					catch (_error) {
						// Ignore focus restore failures in stale windows.
					}
				}
				resolve(value);
			};
			let parseResult = () => {
				let parsedMargin = Number.parseFloat(String(marginInput.value || "").trim());
				let margin = Number.isFinite(parsedMargin) && parsedMargin >= 0 ? parsedMargin : 24;
				margin = Math.min(1000, margin);
				return {
					margin,
					includeGrid: !!includeGridInput.checked,
				};
			};
			let onConfirm = (event) => {
				event?.preventDefault?.();
				event?.stopPropagation?.();
				finish(parseResult());
			};
			let onCancel = (event) => {
				event?.preventDefault?.();
				event?.stopPropagation?.();
				finish(null);
			};
			let onWindowKeyDown = (event) => {
				if (event.key === "Escape") {
					onCancel(event);
					return;
				}
				if (event.key === "Enter") {
					onConfirm(event);
				}
			};
			let onBackdropMouseDown = (event) => {
				event.stopPropagation();
				if (event.target === backdrop) {
					onCancel(event);
				}
			};

			cancelBtn.addEventListener("click", onCancel);
			confirmBtn.addEventListener("click", onConfirm);
			backdrop.addEventListener("mousedown", onBackdropMouseDown, true);
			dialog.addEventListener("mousedown", (event) => event.stopPropagation(), true);
			window.addEventListener("keydown", onWindowKeyDown, true);
		});

		if (backdrop.isConnected) {
			backdrop.remove();
		}
		return options;
	},

	buildSVGExportContent(state, options = {}) {
		let bounds = this.getGraphExportBounds(state);
		if (!bounds) return null;
		let margin = Number.isFinite(options.margin) ? Math.max(0, options.margin) : 24;
		let includeGrid = !!options.includeGrid;
		let minX = bounds.minX - margin;
		let minY = bounds.minY - margin;
		let width = Math.max(1, bounds.maxX - bounds.minX + margin * 2);
		let height = Math.max(1, bounds.maxY - bounds.minY + margin * 2);
		let gridSize = Math.max(4, this.nodeSnapGridSize || 24);

		let parts = [];
		parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
		parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${this.formatSVGNumber(minX)} ${this.formatSVGNumber(minY)} ${this.formatSVGNumber(width)} ${this.formatSVGNumber(height)}" width="${this.formatSVGNumber(width)}" height="${this.formatSVGNumber(height)}">`);
		parts.push(`<defs>`);
		parts.push(`<marker id="paper-relations-export-arrow" markerWidth="11" markerHeight="8" refX="10" refY="4" orient="auto">`);
		parts.push(`<path d="M0,0 L11,4 L0,8 Z" fill="#4b6073"/>`);
		parts.push(`</marker>`);
		if (includeGrid) {
			parts.push(`<pattern id="paper-relations-export-grid" patternUnits="userSpaceOnUse" width="${this.formatSVGNumber(gridSize)}" height="${this.formatSVGNumber(gridSize)}">`);
			parts.push(`<path d="M${this.formatSVGNumber(gridSize)} 0 H0 V${this.formatSVGNumber(gridSize)}" fill="none" stroke="rgba(120,140,160,0.18)" stroke-width="1"/>`);
			parts.push(`</pattern>`);
		}
		parts.push(`</defs>`);
		parts.push(`<rect x="${this.formatSVGNumber(minX)}" y="${this.formatSVGNumber(minY)}" width="${this.formatSVGNumber(width)}" height="${this.formatSVGNumber(height)}" fill="#ffffff"/>`);
		if (includeGrid) {
			parts.push(`<rect x="${this.formatSVGNumber(minX)}" y="${this.formatSVGNumber(minY)}" width="${this.formatSVGNumber(width)}" height="${this.formatSVGNumber(height)}" fill="url(#paper-relations-export-grid)"/>`);
		}

		let nodeMap = new Map((state.nodes || []).map((node) => [node.id, node]));
		for (let edge of state.edges || []) {
			let fromNode = nodeMap.get(edge.from);
			let toNode = nodeMap.get(edge.to);
			if (!fromNode || !toNode) continue;
			let curve = this.getBezierCurveForEdgeNodes(fromNode, toNode);
			if (!curve) continue;
			let pathData = this.buildBezierPathFromCurve(curve);
			parts.push(`<path d="${this.escapeXML(pathData)}" fill="none" stroke="#5a6b7a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#paper-relations-export-arrow)" opacity="0.9"/>`);
		}

		for (let node of state.nodes || []) {
			let metrics = this.getNodeRenderMetrics(node);
			let widthPx = Number.isFinite(node.renderWidth) ? node.renderWidth : metrics.width;
			let heightPx = Number.isFinite(node.renderHeight) ? node.renderHeight : metrics.height;
			let labelLines = node.renderLabelLines || metrics.labelLines || this.wrapNodeLabel(node.label, widthPx);
			let fill = node.kind === "root" ? "#ffe7b8" : "#e8f2ff";
			parts.push(`<g>`);
			parts.push(`<rect x="${this.formatSVGNumber(node.x)}" y="${this.formatSVGNumber(node.y)}" width="${this.formatSVGNumber(widthPx)}" height="${this.formatSVGNumber(heightPx)}" rx="10" ry="10" fill="${fill}" stroke="#657a8f" stroke-width="1.4"/>`);
			let textBlockHeight = labelLines.length * this.nodeLineHeight;
			let firstLineY = node.y + (heightPx - textBlockHeight) / 2 + this.nodeLineHeight * 0.78;
			parts.push(`<text x="${this.formatSVGNumber(node.x + widthPx / 2)}" y="${this.formatSVGNumber(firstLineY)}" text-anchor="middle" font-size="15" font-weight="500" fill="#243444" font-family="sans-serif">`);
			for (let i = 0; i < labelLines.length; i++) {
				let dy = i > 0 ? ` dy="${this.formatSVGNumber(this.nodeLineHeight)}"` : "";
				parts.push(`<tspan x="${this.formatSVGNumber(node.x + widthPx / 2)}"${dy}>${this.escapeXML(labelLines[i])}</tspan>`);
			}
			parts.push(`</text>`);
			parts.push(`</g>`);
		}

		parts.push(`</svg>`);
		return parts.join("\n");
	},

	writeTextFileUTF8(filePath, content) {
		let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
		file.initWithPath(filePath);
		let output = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
		output.init(file, 0x02 | 0x08 | 0x20, 0o644, 0);
		let converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
		converter.init(output, "UTF-8", 0, 0);
		converter.writeString(String(content || ""));
		converter.close();
	},

	async exportActiveTopicAsJSON(window) {
		try {
			let topic = await this.getExportTopicData(window);
			if (!topic) return;
			let filePath = await this.promptSelectExportFile(window, "json");
			if (!filePath) return;
			let payload = {
				schemaVersion: this.storeSchemaVersion,
				topic,
			};
			this.writeTextFileUTF8(filePath, `${JSON.stringify(payload, null, 2)}\n`);
		}
		catch (error) {
			Zotero.logError(error);
			Services.prompt.alert(window, "Export as JSON Failed", String(error?.message || error));
		}
	},

	async exportActiveTopicAsSVG(window) {
		try {
			let state = this.graphStates.get(window);
			if (!state) return;
			let options = await this.promptSVGExportOptions(window);
			if (!options) return;
			let filePath = await this.promptSelectExportFile(window, "svg");
			if (!filePath) return;
			let content = this.buildSVGExportContent(state, options);
			if (!content) return;
			this.writeTextFileUTF8(filePath, `${content}\n`);
		}
		catch (error) {
			Zotero.logError(error);
			Services.prompt.alert(window, "Export as SVG Failed", String(error?.message || error));
		}
	},

	async promptSelectExportFile(window, format) {
		let state = this.graphStates.get(window);
		if (!state) return null;
		let ext = format === "svg" ? "svg" : "json";
		let title = format === "svg" ? this.getGraphWorkspaceText("workspaceMenuExportSVG") : this.getGraphWorkspaceText("workspaceMenuExportJSON");
		let baseName = this.getTopicExportBaseName(state);
		let nsIFilePicker = Ci.nsIFilePicker;
		let picker = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		picker.init(window, title, nsIFilePicker.modeSave);
		if (ext === "svg") {
			picker.appendFilter("SVG (*.svg)", "*.svg");
		}
		else {
			picker.appendFilter("JSON (*.json)", "*.json");
		}
		picker.defaultExtension = ext;
		picker.defaultString = `${baseName}.${ext}`;
		let result;
		if (typeof picker.open === "function") {
			result = await new Promise((resolve) => picker.open(resolve));
		}
		else if (typeof picker.show === "function") {
			result = picker.show();
		}
		else {
			return null;
		}
		if (result !== nsIFilePicker.returnOK && result !== nsIFilePicker.returnReplace) {
			return null;
		}
		return picker.file?.path || null;
	},
};
