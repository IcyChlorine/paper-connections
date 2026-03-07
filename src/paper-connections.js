PaperConnections = {
	id: null,
	version: null,
	rootURI: null,
	initialized: false,
	addedElementIDs: [],

	topicContextSectionID: "paper-connections-topic-context-section",
	selectionDebugSectionID: "paper-connections-selection-debug-section",
	sectionRegistered: false,
	remarkColumnDataKey: "remark",
	remarkInfoRowID: "paper-connections-remark-row",
	remarkColumnRegisteredKey: null,
	remarkInfoRowRegisteredID: null,
	remarkIntegrationRegistered: false,
	notifierObserverID: null,

	graphStates: null,
	selectionDebugSectionListeners: null,
	topicContextSectionListeners: null,
	selectionItemsByWindow: null,
	syncedSettingsLoadedLibraries: null,

	storeSettingKey: "paper-connections.graph.v1",
	nodeDefaultWidth: 208,
	nodeMaxWidth: 320,
	nodeDefaultHeight: 50,
	nodeGapX: 288,
	nodeGapY: 96,
	nodeLineHeight: 17.6,
	nodeLabelMaxLines: 3,
	nodeWidthTargetLines: 2,
	nodeTextPaddingX: 18,
	nodeSnapGridSize: 24,

	init({ id, version, rootURI }) {
		if (this.initialized) return;
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
		this.graphStates = new WeakMap();
		this.selectionDebugSectionListeners = new WeakMap();
		this.topicContextSectionListeners = new WeakMap();
		this.selectionItemsByWindow = new WeakMap();
		this.syncedSettingsLoadedLibraries = new Set();
		this.notifierObserverID = null;
		this.initialized = true;
	},

	log(msg) {
		Zotero.debug("Paper Connections: " + msg);
	},

	cloneJSON(value) {
		return JSON.parse(JSON.stringify(value));
	},

	now() {
		return Date.now();
	},

	generateID(prefix) {
		let randomPart = Math.random().toString(36).slice(2, 8);
		return `${prefix}_${this.now()}_${randomPart}`;
	},

	getItemRef(libraryID, itemKey) {
		return `${libraryID}/${itemKey}`;
	},

	getItemTitle(item) {
		if (!item) return "";
		let displayTitle = typeof item.getDisplayTitle === "function" ? item.getDisplayTitle() : "";
		return item.getField("title") || displayTitle || item.key || "(untitled)";
	},

	getRawItemForNode(node) {
		if (!node?.libraryID || !node?.itemKey) return null;
		if (typeof Zotero.Items?.getByLibraryAndKey !== "function") return null;
		try {
			return Zotero.Items.getByLibraryAndKey(node.libraryID, node.itemKey) || null;
		}
		catch (error) {
			Zotero.logError(error);
			return null;
		}
	},

	resolveNodeItemStatus(node) {
		if (!node || this.isBundleNodeState?.(node)) {
			return {
				item: null,
				isMissing: false,
				reason: "",
			};
		}

		let item = this.getRawItemForNode(node);
		if (!item) {
			return {
				item: null,
				isMissing: true,
				reason: "not-found",
			};
		}
		if (item.deleted) {
			return {
				item,
				isMissing: true,
				reason: "trashed",
			};
		}
		return {
			item,
			isMissing: false,
			reason: "",
		};
	},

	getUsableItemForNode(node) {
		let status = this.resolveNodeItemStatus(node);
		return status.isMissing ? null : status.item;
	},

	getCurrentLocaleTag() {
		let raw = String(
			Zotero.locale
			|| Services.locale?.appLocaleAsBCP47
			|| Services.locale?.lastFallbackLocale
			|| "en-US"
		);
		return raw.toLowerCase();
	},

	getRemarkDisplayLabel() {
		return this.getCurrentLocaleTag().startsWith("zh") ? "简记(PC)" : "Remark(PC)";
	},

	normalizeRemarkValue(value) {
		return String(value || "")
			.replace(/\r?\n+/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	},

	extractRemarkFromExtra(extraText) {
		let raw = String(extraText || "");
		if (!raw.trim()) return "";
		for (let line of raw.split(/\r?\n/)) {
			let match = line.match(/^\s*remark\s*:\s*(.*)$/i);
			if (match) {
				return this.normalizeRemarkValue(match[1]);
			}
		}
		return "";
	},

	removeRemarkLinesFromExtra(extraText) {
		let raw = String(extraText || "");
		if (!raw.trim()) return "";
		let filtered = raw
			.split(/\r?\n/)
			.filter((line) => !/^\s*remark\s*:/i.test(line));
		return filtered.join("\n").trim();
	},

	buildExtraWithRemark(extraText, remarkValue) {
		let remark = this.normalizeRemarkValue(remarkValue);
		let body = this.removeRemarkLinesFromExtra(extraText);
		if (!remark) return body;
		let remarkLine = `remark: ${remark}`;
		return body ? `${remarkLine}\n${body}` : remarkLine;
	},

	getItemRemark(item) {
		if (!item || typeof item.getField !== "function") return "";
		return this.extractRemarkFromExtra(item.getField("extra") || "");
	},

	async setItemRemark(item, value) {
		if (!item || typeof item.getField !== "function" || typeof item.setField !== "function") return false;
		let oldExtra = item.getField("extra") || "";
		let newExtra = this.buildExtraWithRemark(oldExtra, value);
		if (newExtra === oldExtra) return false;
		item.setField("extra", newExtra);
		await item.saveTx();
		return true;
	},

	registerRemarkIntegration() {
		if (this.remarkIntegrationRegistered) return;

		if (Zotero.ItemTreeManager?.registerColumn) {
			let registered = Zotero.ItemTreeManager.registerColumn({
				dataKey: this.remarkColumnDataKey,
				label: this.getRemarkDisplayLabel(),
				pluginID: this.id,
				enabledTreeIDs: ["main"],
				dataProvider: (item) => this.getItemRemark(item),
				showInColumnPicker: true,
				flex: 1,
				minWidth: 80,
				zoteroPersist: ["width", "hidden", "sortDirection"],
			});
			this.remarkColumnRegisteredKey = registered || null;
		}

		if (Zotero.ItemPaneManager?.registerInfoRow) {
			let registeredRowID = Zotero.ItemPaneManager.registerInfoRow({
				rowID: this.remarkInfoRowID,
				pluginID: this.id,
				label: {
					l10nID: "paper-connections-remark-label",
				},
				position: "afterCreators",
				multiline: false,
				nowrap: false,
				editable: true,
				onGetData: ({ item }) => this.getItemRemark(item),
				onSetData: ({ item, value }) => {
					this.setItemRemark(item, value)
						.then((changed) => {
							this.refreshRemarkPresentation();
							if (changed) {
								this.refreshGraphNodeLabelsForItem(item);
							}
						})
						.catch((error) => Zotero.logError(error));
				},
				onItemChange: ({ item, setEnabled }) => {
					setEnabled(!!item && item.isRegularItem?.());
				},
			});
			this.remarkInfoRowRegisteredID = registeredRowID || this.remarkInfoRowID;
		}

		this.remarkIntegrationRegistered = true;
	},

	unregisterRemarkIntegration() {
		if (this.remarkColumnRegisteredKey && Zotero.ItemTreeManager?.unregisterColumn) {
			try {
				Zotero.ItemTreeManager.unregisterColumn(this.remarkColumnRegisteredKey);
			}
			catch (error) {
				Zotero.logError(error);
			}
		}
		if (this.remarkInfoRowRegisteredID && Zotero.ItemPaneManager?.unregisterInfoRow) {
			try {
				Zotero.ItemPaneManager.unregisterInfoRow(this.remarkInfoRowRegisteredID);
			}
			catch (error) {
				Zotero.logError(error);
			}
		}
		this.remarkColumnRegisteredKey = null;
		this.remarkInfoRowRegisteredID = null;
		this.remarkIntegrationRegistered = false;
	},

	syncPaperNodeRuntimeState(node) {
		if (!node || this.isBundleNodeState?.(node)) {
			return {
				changed: false,
				geometryChanged: false,
				statusChanged: false,
				labelChanged: false,
			};
		}

		let status = this.resolveNodeItemStatus(node);
		let nextMissing = !!status.isMissing;
		let nextReason = status.reason || "";
		let nextTitle = status.item ? this.getItemTitle(status.item) : (node.title || node.itemKey || "(untitled)");
		let nextLabel = this.getNodeLabelForDisplay(node, status);
		let oldMetrics = this.getNodeRenderMetrics(node);
		let oldCenterX = node.x + oldMetrics.width / 2;
		let oldCenterY = node.y + oldMetrics.height / 2;
		let nextWidth = this.getNodeWidthForLabel(nextLabel);
		let nextMetrics = this.getNodeRenderMetrics({
			...node,
			label: nextLabel,
			width: nextWidth,
		});
		let nextX = oldCenterX - nextMetrics.width / 2;
		let nextY = oldCenterY - nextMetrics.height / 2;
		let changed = false;
		let geometryChanged = false;
		let statusChanged = false;
		let labelChanged = false;

		if (!!node.itemMissing !== nextMissing) {
			node.itemMissing = nextMissing;
			changed = true;
			statusChanged = true;
		}
		if ((node.itemMissingReason || "") !== nextReason) {
			node.itemMissingReason = nextReason;
			changed = true;
			statusChanged = true;
		}
		if (node.label !== nextLabel) {
			node.label = nextLabel;
			changed = true;
			labelChanged = true;
		}
		if (node.width !== nextWidth) {
			node.width = nextWidth;
			changed = true;
			geometryChanged = true;
		}
		if (node.x !== nextX) {
			node.x = nextX;
			changed = true;
			geometryChanged = true;
		}
		if (node.y !== nextY) {
			node.y = nextY;
			changed = true;
			geometryChanged = true;
		}
		if (!nextMissing && node.title !== nextTitle) {
			node.title = nextTitle;
			changed = true;
		}

		return {
			changed,
			geometryChanged,
			statusChanged,
			labelChanged,
		};
	},

	refreshRemarkPresentation() {
		if (this.remarkInfoRowRegisteredID && Zotero.ItemPaneManager?.refreshInfoRow) {
			Zotero.ItemPaneManager.refreshInfoRow(this.remarkInfoRowRegisteredID);
		}
		if (Zotero.ItemTreeManager?.refreshColumns) {
			Zotero.ItemTreeManager.refreshColumns();
		}
	},

	refreshGraphNodeLabelsForItem(item) {
		if (!item) return;
		let itemLibraryID = item.libraryID || Zotero.Libraries.userLibraryID;
		let itemKey = item.key;
		if (!itemLibraryID || !itemKey) return;
		let pendingPersistByNode = new Map();

		for (let win of Zotero.getMainWindows()) {
			if (!win?.ZoteroPane) continue;
			let state = this.graphStates.get(win);
			if (!state?.nodes?.length) continue;

			let changed = false;
			for (let node of state.nodes) {
				if (node.libraryID !== itemLibraryID || node.itemKey !== itemKey) continue;
				let oldMetrics = this.getNodeRenderMetrics(node);
				let oldCenterX = node.x + oldMetrics.width / 2;
				let oldCenterY = node.y + oldMetrics.height / 2;

				let status = this.resolveNodeItemStatus(node);
				let nextLabel = this.getNodeLabelForDisplay(node, status);
				let nextWidth = this.getNodeWidthForLabel(nextLabel);
				let nextTitle = status.item ? this.getItemTitle(status.item) : node.title || node.itemKey || "(untitled)";
				let nextMetrics = this.getNodeRenderMetrics({
					...node,
					label: nextLabel,
					width: nextWidth,
				});
				let nextX = oldCenterX - nextMetrics.width / 2;
				let nextY = oldCenterY - nextMetrics.height / 2;
				let nodePositionChanged = false;

				if (node.label !== nextLabel) {
					node.label = nextLabel;
					changed = true;
				}
				if (node.width !== nextWidth) {
					node.width = nextWidth;
					changed = true;
				}
				if (node.x !== nextX) {
					node.x = nextX;
					changed = true;
					nodePositionChanged = true;
				}
				if (node.y !== nextY) {
					node.y = nextY;
					changed = true;
					nodePositionChanged = true;
				}
				if (node.itemMissing) {
					node.itemMissing = false;
					changed = true;
				}
				if (node.itemMissingReason) {
					node.itemMissingReason = "";
					changed = true;
				}
				if (node.title !== nextTitle) {
					node.title = nextTitle;
					changed = true;
				}
				if (
					nodePositionChanged &&
					state.activeTopicID &&
					state.activeLibraryID &&
					!state.isTemporaryTopic &&
					node.id
				) {
					let persistKey = `${state.activeLibraryID}/${state.activeTopicID}/${node.id}`;
					pendingPersistByNode.set(persistKey, {
						libraryID: state.activeLibraryID,
						topicID: state.activeTopicID,
						nodeID: node.id,
						x: node.x,
						y: node.y,
						snapLabel: nextLabel,
					});
				}
			}

			if (changed) {
				for (let node of state.nodes) {
					if (node.libraryID !== itemLibraryID || node.itemKey !== itemKey) continue;
					this.updateNodeDOM(win, node.id, { propagate: "bundle" });
				}
				this.notifyGraphSelectionChanged(win);
			}
		}

		for (let persist of pendingPersistByNode.values()) {
			this.updateNode(
				persist.libraryID,
				persist.topicID,
				persist.nodeID,
				{
					x: persist.x,
					y: persist.y,
					snapLabel: persist.snapLabel,
				},
			).catch((error) => Zotero.logError(error));
		}
	},

	isNodeConnectedToSelected(state, nodeID) {
		if (!state?.selectedNodeID || !nodeID) return false;
		if (state.selectedNodeID === nodeID) return true;
		return (state.edges || []).some((edge) =>
			(edge.from === state.selectedNodeID && edge.to === nodeID)
			|| (edge.to === state.selectedNodeID && edge.from === nodeID),
		);
	},

	refreshGraphNodeAvailability(window, itemRefs = null) {
		let state = this.graphStates.get(window);
		if (!state?.nodes?.length) {
			this.refreshSelectedMissingNodeHint?.(window);
			return 0;
		}

		let itemRefSet = itemRefs?.length
			? new Set(itemRefs.map((ref) => this.getItemRef(ref.libraryID, ref.itemKey)))
			: null;
		let changedNodeIDs = [];
		let selectionAffected = false;

		for (let node of state.nodes) {
			if (this.isBundleNodeState?.(node)) continue;
			if (itemRefSet && !itemRefSet.has(this.getItemRef(node.libraryID, node.itemKey))) {
				continue;
			}
			let result = this.syncPaperNodeRuntimeState(node);
			if (!result.changed) continue;
			changedNodeIDs.push(node.id);
			if (this.isNodeConnectedToSelected(state, node.id)) {
				selectionAffected = true;
			}
		}

		if (changedNodeIDs.length) {
			for (let nodeID of changedNodeIDs) {
				this.updateNodeDOM(window, nodeID, { propagate: "bundle" });
			}
			if (selectionAffected) {
				this.notifyGraphSelectionChanged(window);
			}
		}
		this.refreshSelectedMissingNodeHint?.(window);
		return changedNodeIDs.length;
	},

	refreshAllGraphNodeAvailability(itemRefs = null) {
		for (let win of Zotero.getMainWindows()) {
			if (!win?.ZoteroPane) continue;
			this.refreshGraphNodeAvailability(win, itemRefs);
		}
	},

	async getItemRefsFromNotifierData(ids = [], extraData = null) {
		let refs = new Map();
		let addRef = (libraryID, itemKey) => {
			let numericLibraryID = Number(libraryID);
			let normalizedItemKey = String(itemKey || "");
			if (!Number.isFinite(numericLibraryID) || !normalizedItemKey) return;
			refs.set(
				this.getItemRef(numericLibraryID, normalizedItemKey),
				{ libraryID: numericLibraryID, itemKey: normalizedItemKey },
			);
		};
		let addRefFromObject = (value) => {
			if (!value || typeof value !== "object") return;
			addRef(value.libraryID, value.itemKey || value.key);
		};

		for (let id of ids || []) {
			let item = null;
			try {
				item = await Zotero.Items.getAsync(id);
			}
			catch (error) {
				Zotero.logError(error);
			}
			if (item) {
				addRef(item.libraryID, item.key);
			}
			if (extraData && typeof extraData === "object") {
				addRefFromObject(extraData[id]);
			}
		}

		addRefFromObject(extraData);
		return Array.from(refs.values());
	},

	registerNotifierObserver() {
		if (this.notifierObserverID || !Zotero.Notifier?.registerObserver) return;
		let observer = {
			notify: (event, type, ids, extraData) => {
				this.handleNotifierEvent(event, type, ids, extraData).catch((error) => Zotero.logError(error));
			},
		};
		this.notifierObserverID = Zotero.Notifier.registerObserver(
			observer,
			["item", "trash"],
			"paperConnectionsItemStatus",
		);
	},

	unregisterNotifierObserver() {
		if (!this.notifierObserverID || !Zotero.Notifier?.unregisterObserver) return;
		try {
			Zotero.Notifier.unregisterObserver(this.notifierObserverID);
		}
		catch (error) {
			Zotero.logError(error);
		}
		this.notifierObserverID = null;
	},

	async handleNotifierEvent(event, type, ids, extraData) {
		if (type === "item") {
			if (!["modify", "trash", "delete"].includes(event)) return;
			let itemRefs = await this.getItemRefsFromNotifierData(ids, extraData);
			if (itemRefs.length) {
				this.refreshAllGraphNodeAvailability(itemRefs);
			}
			else {
				this.refreshAllGraphNodeAvailability();
			}
			return;
		}
		if (type === "trash") {
			this.refreshAllGraphNodeAvailability();
		}
	},

	getTargetLibraryID(window, explicitItem = null) {
		return explicitItem?.libraryID
			|| this.selectionItemsByWindow.get(window)?.libraryID
			|| window?.ZoteroPane?.getSelectedLibraryID?.()
			|| Zotero.Libraries.userLibraryID;
	},

	getLabelCharUnits(char) {
		if (!char) return 0;
		return char.charCodeAt(0) > 255 ? 2 : 1;
	},

	cropLineToUnits(text, maxUnits) {
		let units = 0;
		let out = "";
		for (let ch of text) {
			let u = this.getLabelCharUnits(ch);
			if (units + u > maxUnits) break;
			out += ch;
			units += u;
		}
		return out;
	},

	getTextUnits(text) {
		let units = 0;
		for (let ch of String(text || "")) {
			units += this.getLabelCharUnits(ch);
		}
		return units;
	},

	clampNodeWidth(width) {
		if (!Number.isFinite(width)) return this.nodeDefaultWidth;
		return Math.max(this.nodeDefaultWidth, Math.min(this.nodeMaxWidth, Math.round(width)));
	},

	getNodeWidthForLabel(label) {
		let text = String(label || "").trim();
		if (!text) return this.nodeDefaultWidth;
		let totalUnits = Math.max(8, this.getTextUnits(text));
		let targetUnitsPerLine = Math.max(14, Math.ceil(totalUnits / this.nodeWidthTargetLines));
		let suggested = targetUnitsPerLine * 8 + this.nodeTextPaddingX * 2;
		return this.clampNodeWidth(suggested);
	},

	splitWordWithHyphen(word, maxUnits) {
		let token = String(word || "");
		if (!token) return { head: "", tail: "" };
		let totalUnits = this.getTextUnits(token);
		if (totalUnits <= maxUnits) {
			return { head: token, tail: "" };
		}
		let isWordLike = /^[A-Za-z0-9][A-Za-z0-9'._-]*$/.test(token);
		let headUnits = isWordLike ? Math.max(1, maxUnits - 1) : maxUnits;
		let head = this.cropLineToUnits(token, headUnits);
		if (!head) {
			head = token[0];
		}
		let tail = token.slice(head.length);
		if (isWordLike && tail) {
			head += "-";
		}
		return { head, tail };
	},

	snapValueToGrid(value) {
		if (!Number.isFinite(value)) return value;
		let step = this.nodeSnapGridSize;
		if (!Number.isFinite(step) || step <= 1) return value;
		return Math.round(value / step) * step;
	},

	getNodeRenderMetrics(nodeInput = {}) {
		let label = String(nodeInput?.label || "").trim();
		let width = Number.isFinite(nodeInput?.width)
			? this.clampNodeWidth(nodeInput.width)
			: this.getNodeWidthForLabel(label);
		let minHeight = Number.isFinite(nodeInput?.height) ? nodeInput.height : this.nodeDefaultHeight;
		let labelLines = this.wrapNodeLabel(label, width);
		let textBlockHeight = labelLines.length * this.nodeLineHeight;
		let height = Math.max(minHeight, textBlockHeight + 16);
		return {
			width,
			height,
			labelLines,
		};
	},

	snapNodePositionToGrid(point, nodeInput = {}) {
		let x = Number.isFinite(point?.x) ? point.x : 0;
		let y = Number.isFinite(point?.y) ? point.y : 0;
		let metrics = this.getNodeRenderMetrics(nodeInput);
		let centerX = x + metrics.width / 2;
		let centerY = y + metrics.height / 2;
		return {
			x: this.snapValueToGrid(centerX) - metrics.width / 2,
			y: this.snapValueToGrid(centerY) - metrics.height / 2,
		};
	},

	wrapNodeLabel(label, width) {
		let text = String(label || "").trim();
		if (!text) return ["(untitled)"];
		let usableWidth = Math.max(48, width - this.nodeTextPaddingX * 2);
		let maxUnitsPerLine = Math.max(6, Math.floor(usableWidth / 8));
		let words = text.replace(/\r/g, "").split(/\s+/).filter(Boolean);
		if (!words.length) return ["(untitled)"];
		let lines = [];
		let current = "";
		let currentUnits = 0;
		let overflow = false;

		while (words.length) {
			if (lines.length >= this.nodeLabelMaxLines) {
				overflow = true;
				break;
			}

			let word = words[0];
			let wordUnits = this.getTextUnits(word);

			if (!current) {
				if (wordUnits <= maxUnitsPerLine) {
					current = word;
					currentUnits = wordUnits;
					words.shift();
					continue;
				}
				let split = this.splitWordWithHyphen(word, maxUnitsPerLine);
				lines.push(split.head);
				if (split.tail) {
					words[0] = split.tail;
				}
				else {
					words.shift();
				}
				continue;
			}

			let nextUnits = currentUnits + 1 + wordUnits;
			if (nextUnits <= maxUnitsPerLine) {
				current += ` ${word}`;
				currentUnits = nextUnits;
				words.shift();
			}
			else {
				lines.push(current);
				current = "";
				currentUnits = 0;
			}
		}

		if (current) {
			if (lines.length < this.nodeLabelMaxLines) {
				lines.push(current);
			}
			else {
				overflow = true;
			}
		}
		if (words.length) {
			overflow = true;
		}
		if (!lines.length) {
			lines.push(current);
		}

		if (overflow && lines.length) {
			let lastIndex = Math.min(lines.length, this.nodeLabelMaxLines) - 1;
			let maxLastUnits = Math.max(2, maxUnitsPerLine - 3);
			let lastLine = lines[lastIndex].replace(/[-\s]+$/, "");
			let cropped = this.cropLineToUnits(lastLine, maxLastUnits);
			lines[lastIndex] = `${cropped}...`;
		}

		if (!lines.length) return ["(untitled)"];
		return lines.slice(0, this.nodeLabelMaxLines);
	},


	registerItemPaneSections() {
		if (this.sectionRegistered) return;
		if (!Zotero.ItemPaneManager?.registerSection) {
			this.log("ItemPaneManager API is not available");
			return;
		}

		const XHTML_NS = "http://www.w3.org/1999/xhtml";

		Zotero.ItemPaneManager.registerSection({
			paneID: this.topicContextSectionID,
			pluginID: this.id,
			header: {
				l10nID: "paper-connections-topic-context-header",
				icon: "chrome://zotero/skin/itempane/16/related.svg",
			},
			sidenav: {
				l10nID: "paper-connections-topic-context-sidenav",
				icon: "chrome://zotero/skin/itempane/20/related.svg",
			},
			onInit: ({ doc, body, refresh }) => {
				let win = doc.defaultView;
				let listener = () => refresh();
				win.addEventListener("paper-connections:graph-context-changed", listener);
				this.topicContextSectionListeners.set(body, { win, listener });
			},
			onDestroy: ({ body }) => {
				let data = this.topicContextSectionListeners.get(body);
				if (!data) return;
				data.win.removeEventListener("paper-connections:graph-context-changed", data.listener);
				this.topicContextSectionListeners.delete(body);
			},
			onItemChange: ({ doc, item, setEnabled, setSectionSummary }) => {
				setEnabled(!!item);
				setSectionSummary(item ? `Item: ${item.key}` : "");
				if (doc?.defaultView) {
					this.selectionItemsByWindow.set(doc.defaultView, item || null);
					this.handlePrimaryItemChanged(doc.defaultView, item).catch((error) => Zotero.logError(error));
				}
			},
			onRender: ({ doc, body, item }) => {
				body.replaceChildren();
				let win = doc.defaultView;
				this.selectionItemsByWindow.set(win, item || null);

				const title = doc.createElementNS(XHTML_NS, "div");
				title.textContent = "Topic Context";
				title.style.fontWeight = "700";
				title.style.marginBottom = "8px";

				const desc = doc.createElementNS(XHTML_NS, "div");
				desc.textContent = "Topic context and actions";
				desc.style.marginBottom = "8px";

				const list = doc.createElementNS(XHTML_NS, "ul");
				list.style.margin = "0";
				list.style.paddingInlineStart = "18px";

				const row1 = doc.createElementNS(XHTML_NS, "li");
				row1.textContent = `Current Zotero item key: ${item?.key || "-"}`;
				const row2 = doc.createElementNS(XHTML_NS, "li");
				let summary = this.getGraphContextSummary(win);
				row2.textContent = summary.topicLabel;
				const row3 = doc.createElementNS(XHTML_NS, "li");
				row3.textContent = summary.topicStatus;

				list.append(row1, row2, row3);

				const buttonWrap = doc.createElementNS(XHTML_NS, "div");
				buttonWrap.className = "paper-connections-pane-actions";
				const createTopicBtn = doc.createElementNS(XHTML_NS, "button");
				createTopicBtn.type = "button";
				createTopicBtn.className = "paper-connections-create-topic-btn";
				createTopicBtn.textContent = "Create topic from selected paper";
				createTopicBtn.disabled = !item;
				createTopicBtn.addEventListener("click", () => {
					this.promptCreateTopicFromItem(win, item).catch((error) => Zotero.logError(error));
				});
				const removeTopicBtn = doc.createElementNS(XHTML_NS, "button");
				removeTopicBtn.type = "button";
				removeTopicBtn.className = "paper-connections-remove-topic-btn";
				removeTopicBtn.textContent = "Remove topic";
				removeTopicBtn.disabled = !this.canRemoveActiveTopic(win);
				removeTopicBtn.addEventListener("click", () => {
					this.promptRemoveActiveTopic(win, item).catch((error) => Zotero.logError(error));
				});
				buttonWrap.append(createTopicBtn, removeTopicBtn);

				body.append(title, desc, list, buttonWrap);
			},
		});

		Zotero.ItemPaneManager.registerSection({
			paneID: this.selectionDebugSectionID,
			pluginID: this.id,
			header: {
				l10nID: "paper-connections-selection-debug-header",
				icon: "chrome://zotero/skin/itempane/16/info.svg",
			},
			sidenav: {
				l10nID: "paper-connections-selection-debug-sidenav",
				icon: "chrome://zotero/skin/itempane/20/info.svg",
			},
			onInit: ({ doc, body, refresh }) => {
				let win = doc.defaultView;
				let listener = () => refresh();
				win.addEventListener("paper-connections:graph-selection-changed", listener);
				this.selectionDebugSectionListeners.set(body, { win, listener });
			},
			onDestroy: ({ body }) => {
				let data = this.selectionDebugSectionListeners.get(body);
				if (!data) return;
				data.win.removeEventListener("paper-connections:graph-selection-changed", data.listener);
				this.selectionDebugSectionListeners.delete(body);
			},
			onItemChange: ({ item, setEnabled, setSectionSummary }) => {
				setEnabled(!!item);
				setSectionSummary("Selection Debug");
			},
			onRender: ({ doc, body }) => {
				body.replaceChildren();
				let info = this.getGraphSelectionInfo(doc.defaultView);

				const title = doc.createElementNS(XHTML_NS, "div");
				title.textContent = "Selection Debug";
				title.style.fontWeight = "700";
				title.style.marginBottom = "8px";
				body.appendChild(title);

				if (!info) {
					const empty = doc.createElementNS(XHTML_NS, "div");
					empty.textContent = "No graph node selected. Click a node in the Relation Graph Workspace.";
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
		Zotero.ItemPaneManager.unregisterSection(this.topicContextSectionID);
		Zotero.ItemPaneManager.unregisterSection(this.selectionDebugSectionID);
		this.sectionRegistered = false;
	},

	addToWindow(window) {
		let doc = window.document;

		if (!doc.getElementById("paper-connections-stylesheet")) {
			let link = doc.createElement("link");
			link.id = "paper-connections-stylesheet";
			link.type = "text/css";
			link.rel = "stylesheet";
			link.href = this.rootURI + "style.css";
			doc.documentElement.appendChild(link);
			this.storeAddedElement(link);
		}

		window.MozXULElement.insertFTLIfNeeded("paper-connections.ftl");
		this.addGraphPane(window);
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
			this.unbindGraphPaneEvents(window, window.document, state);
			this.clearGraphWorkspaceTogglePlacementTimers(state);
		}
		this.graphStates.delete(window);
		this.selectionItemsByWindow.delete(window);

		let doc = window.document;
		for (let id of this.addedElementIDs) {
			doc.getElementById(id)?.remove();
		}
		doc.querySelector('[href="paper-connections.ftl"]')?.remove();
	},

	removeFromAllWindows() {
		let windows = Zotero.getMainWindows();
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.removeFromWindow(win);
		}
		this.unregisterNotifierObserver();
		this.unregisterItemPaneSections();
		this.unregisterRemarkIntegration();
	},

	async main() {
		this.registerRemarkIntegration();
		this.registerItemPaneSections();
		this.registerNotifierObserver();

		let host = new URL("https://foo.com/path").host;
		this.log(`Host is ${host}`);
	},
};


Object.assign(
	PaperConnections,
	PaperConnectionsStorageMixin,
	PaperConnectionsGraphWorkspaceMixin,
	PaperConnectionsGraphRenderMixin,
	PaperConnectionsGraphInteractionMixin,
	PaperConnectionsGraphTopicMixin,
	PaperConnectionsGraphExportMixin,
);

