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
	relationSectionListeners: null,
	selectionItemsByWindow: null,
	syncedSettingsLoadedLibraries: null,

	storeSettingKey: "paper-relations.graph.v1",
	storeSchemaVersion: 1,
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
		this.selectionSectionListeners = new WeakMap();
		this.relationSectionListeners = new WeakMap();
		this.selectionItemsByWindow = new WeakMap();
		this.syncedSettingsLoadedLibraries = new Set();
		this.initialized = true;
	},

	log(msg) {
		Zotero.debug("Paper Relations: " + msg);
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

	snapPointToGrid(point) {
		let x = Number.isFinite(point?.x) ? point.x : 0;
		let y = Number.isFinite(point?.y) ? point.y : 0;
		return {
			x: this.snapValueToGrid(x),
			y: this.snapValueToGrid(y),
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

	createEmptyStore() {
		return {
			schemaVersion: this.storeSchemaVersion,
			topics: {},
			itemTopicIndex: {},
		};
	},

	normalizeStore(rawStore) {
		let store = rawStore && typeof rawStore === "object" ? this.cloneJSON(rawStore) : this.createEmptyStore();
		if (!store || typeof store !== "object") {
			return this.createEmptyStore();
		}
		if (!store.schemaVersion) store.schemaVersion = this.storeSchemaVersion;
		if (!store.topics || typeof store.topics !== "object") store.topics = {};
		if (!store.itemTopicIndex || typeof store.itemTopicIndex !== "object") store.itemTopicIndex = {};

		for (let topicID of Object.keys(store.topics)) {
			let topic = store.topics[topicID];
			if (!topic || typeof topic !== "object") {
				delete store.topics[topicID];
				continue;
			}
			topic.id = topic.id || topicID;
			topic.nodes = topic.nodes && typeof topic.nodes === "object" ? topic.nodes : {};
			topic.edges = topic.edges && typeof topic.edges === "object" ? topic.edges : {};
		}

		for (let itemRef of Object.keys(store.itemTopicIndex)) {
			let topicIDs = store.itemTopicIndex[itemRef];
			if (!Array.isArray(topicIDs)) {
				delete store.itemTopicIndex[itemRef];
				continue;
			}
			store.itemTopicIndex[itemRef] = topicIDs.filter((id) => !!store.topics[id]);
			if (!store.itemTopicIndex[itemRef].length) {
				delete store.itemTopicIndex[itemRef];
			}
		}

		return store;
	},

	async ensureSyncedSettingsLoaded(libraryID) {
		if (!libraryID) {
			throw new Error("Invalid libraryID");
		}
		if (this.syncedSettingsLoadedLibraries.has(libraryID)) return;
		await Zotero.SyncedSettings.loadAll(libraryID);
		this.syncedSettingsLoadedLibraries.add(libraryID);
	},

	async loadStore(libraryID) {
		await this.ensureSyncedSettingsLoaded(libraryID);
		let raw = Zotero.SyncedSettings.get(libraryID, this.storeSettingKey);
		return this.normalizeStore(raw);
	},

	async saveStore(libraryID, store) {
		let normalized = this.normalizeStore(store);
		await Zotero.SyncedSettings.set(libraryID, this.storeSettingKey, normalized);
		return normalized;
	},

	getTopicsSorted(store) {
		return Object.values(store.topics).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
	},

	getTopicNodeByItemRef(topic, itemRef) {
		for (let node of Object.values(topic.nodes)) {
			if (this.getItemRef(node.libraryID, node.itemKey) === itemRef) {
				return node;
			}
		}
		return null;
	},

	updateItemTopicIndexForTopic(store, topic) {
		for (let itemRef of Object.keys(store.itemTopicIndex)) {
			store.itemTopicIndex[itemRef] = store.itemTopicIndex[itemRef].filter((id) => id !== topic.id);
			if (!store.itemTopicIndex[itemRef].length) delete store.itemTopicIndex[itemRef];
		}

		for (let node of Object.values(topic.nodes)) {
			let itemRef = this.getItemRef(node.libraryID, node.itemKey);
			if (!store.itemTopicIndex[itemRef]) store.itemTopicIndex[itemRef] = [];
			if (!store.itemTopicIndex[itemRef].includes(topic.id)) {
				store.itemTopicIndex[itemRef].push(topic.id);
			}
		}
	},

	async listTopics(libraryID) {
		let store = await this.loadStore(libraryID);
		return this.getTopicsSorted(store);
	},

	async getTopic(libraryID, topicID) {
		let store = await this.loadStore(libraryID);
		return store.topics[topicID] ? this.cloneJSON(store.topics[topicID]) : null;
	},

	async getTopicsForItem(libraryID, itemKey) {
		let store = await this.loadStore(libraryID);
		let itemRef = this.getItemRef(libraryID, itemKey);
		let topicIDs = store.itemTopicIndex[itemRef] || [];
		return topicIDs.map((id) => store.topics[id]).filter(Boolean).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
	},

	async createTopic(libraryID, { name, centerItem }) {
		let store = await this.loadStore(libraryID);
		let topicID = this.generateID("topic");
		let now = this.now();
		let topic = {
			id: topicID,
			libraryID,
			name: (name || "Untitled Topic").trim() || "Untitled Topic",
			createdAt: now,
			updatedAt: now,
			nodes: {},
			edges: {},
		};

		store.topics[topicID] = topic;

		if (centerItem) {
			await this.addNode(libraryID, topicID, {
				itemKey: centerItem.key,
				title: this.getItemTitle(centerItem),
				shortLabel: "",
				x: 80,
				y: 120,
			}, { store, skipSave: true });
		}

		topic.updatedAt = this.now();
		this.updateItemTopicIndexForTopic(store, topic);
		await this.saveStore(libraryID, store);
		return this.cloneJSON(topic);
	},

	async updateTopic(libraryID, topicID, patch) {
		let store = await this.loadStore(libraryID);
		let topic = store.topics[topicID];
		if (!topic) return null;
		if (patch?.name !== undefined) {
			topic.name = (patch.name || "").trim() || topic.name;
		}
		topic.updatedAt = this.now();
		await this.saveStore(libraryID, store);
		return this.cloneJSON(topic);
	},

	async deleteTopic(libraryID, topicID) {
		let store = await this.loadStore(libraryID);
		let topic = store.topics[topicID];
		if (!topic) return false;
		delete store.topics[topicID];
		for (let itemRef of Object.keys(store.itemTopicIndex)) {
			store.itemTopicIndex[itemRef] = store.itemTopicIndex[itemRef].filter((id) => id !== topicID);
			if (!store.itemTopicIndex[itemRef].length) delete store.itemTopicIndex[itemRef];
		}
		await this.saveStore(libraryID, store);
		return true;
	},

	computeAutoNodePosition(topic) {
		let count = Object.keys(topic.nodes).length;
		let baseX = this.nodeSnapGridSize * 3;
		let baseY = this.nodeSnapGridSize * 5;
		if (!count) {
			return {
				x: baseX,
				y: baseY,
			};
		}
		let cols = 3;
		let col = count % cols;
		let row = Math.floor(count / cols);
		return this.snapPointToGrid({
			x: baseX + col * this.nodeGapX,
			y: baseY + row * this.nodeGapY,
		});
	},

	async addNode(libraryID, topicID, nodeInput, options = {}) {
		let { store = null, skipSave = false } = options;
		let localStore = store || await this.loadStore(libraryID);
		let topic = localStore.topics[topicID];
		if (!topic) return null;
		let itemRef = this.getItemRef(libraryID, nodeInput.itemKey);
		let existing = this.getTopicNodeByItemRef(topic, itemRef);
		if (existing) return this.cloneJSON(existing);

		let pos = Number.isFinite(nodeInput.x) && Number.isFinite(nodeInput.y)
			? { x: nodeInput.x, y: nodeInput.y }
			: this.computeAutoNodePosition(topic);
		let snappedPos = this.snapPointToGrid(pos);

		let nodeID = this.generateID("node");
		let node = {
			id: nodeID,
			libraryID,
			itemKey: nodeInput.itemKey,
			title: nodeInput.title || nodeInput.itemKey,
			shortLabel: nodeInput.shortLabel || "",
			note: nodeInput.note || "",
			x: snappedPos.x,
			y: snappedPos.y,
			createdAt: this.now(),
			updatedAt: this.now(),
		};
		topic.nodes[nodeID] = node;
		topic.updatedAt = this.now();
		this.updateItemTopicIndexForTopic(localStore, topic);
		if (!skipSave) {
			await this.saveStore(libraryID, localStore);
		}
		return this.cloneJSON(node);
	},

	async updateNode(libraryID, topicID, nodeID, patch) {
		let store = await this.loadStore(libraryID);
		let topic = store.topics[topicID];
		if (!topic || !topic.nodes[nodeID]) return null;
		let node = topic.nodes[nodeID];
		let keys = ["shortLabel", "note", "title"];
		for (let key of keys) {
			if (patch?.[key] !== undefined) {
				node[key] = patch[key];
			}
		}
		if (patch?.x !== undefined || patch?.y !== undefined) {
			let snapped = this.snapPointToGrid({
				x: patch?.x !== undefined ? patch.x : node.x,
				y: patch?.y !== undefined ? patch.y : node.y,
			});
			node.x = snapped.x;
			node.y = snapped.y;
		}
		node.updatedAt = this.now();
		topic.updatedAt = this.now();
		this.updateItemTopicIndexForTopic(store, topic);
		await this.saveStore(libraryID, store);
		return this.cloneJSON(node);
	},

	async removeNode(libraryID, topicID, nodeID) {
		let store = await this.loadStore(libraryID);
		let topic = store.topics[topicID];
		if (!topic || !topic.nodes[nodeID]) return false;
		delete topic.nodes[nodeID];
		for (let edgeID of Object.keys(topic.edges)) {
			let edge = topic.edges[edgeID];
			if (edge.fromNodeID === nodeID || edge.toNodeID === nodeID) {
				delete topic.edges[edgeID];
			}
		}
		topic.updatedAt = this.now();
		this.updateItemTopicIndexForTopic(store, topic);
		await this.saveStore(libraryID, store);
		return true;
	},

	async listNodes(libraryID, topicID) {
		let topic = await this.getTopic(libraryID, topicID);
		if (!topic) return [];
		return Object.values(topic.nodes);
	},

	async addEdge(libraryID, topicID, edgeInput) {
		let store = await this.loadStore(libraryID);
		let topic = store.topics[topicID];
		if (!topic) return null;
		if (!topic.nodes[edgeInput.fromNodeID] || !topic.nodes[edgeInput.toNodeID]) return null;

		for (let edge of Object.values(topic.edges)) {
			if (
				edge.fromNodeID === edgeInput.fromNodeID &&
				edge.toNodeID === edgeInput.toNodeID &&
				(edge.type || "related") === (edgeInput.type || "related")
			) {
				return this.cloneJSON(edge);
			}
		}

		let edgeID = this.generateID("edge");
		let edge = {
			id: edgeID,
			fromNodeID: edgeInput.fromNodeID,
			toNodeID: edgeInput.toNodeID,
			type: edgeInput.type || "related",
			note: edgeInput.note || "",
			createdAt: this.now(),
			updatedAt: this.now(),
		};
		topic.edges[edgeID] = edge;
		topic.updatedAt = this.now();
		await this.saveStore(libraryID, store);
		return this.cloneJSON(edge);
	},

	async updateEdge(libraryID, topicID, edgeID, patch) {
		let store = await this.loadStore(libraryID);
		let topic = store.topics[topicID];
		if (!topic || !topic.edges[edgeID]) return null;
		let edge = topic.edges[edgeID];
		let keys = ["type", "note"];
		for (let key of keys) {
			if (patch?.[key] !== undefined) {
				edge[key] = patch[key];
			}
		}
		edge.updatedAt = this.now();
		topic.updatedAt = this.now();
		await this.saveStore(libraryID, store);
		return this.cloneJSON(edge);
	},

	async removeEdge(libraryID, topicID, edgeID) {
		let store = await this.loadStore(libraryID);
		let topic = store.topics[topicID];
		if (!topic || !topic.edges[edgeID]) return false;
		delete topic.edges[edgeID];
		topic.updatedAt = this.now();
		await this.saveStore(libraryID, store);
		return true;
	},

	async listEdges(libraryID, topicID) {
		let topic = await this.getTopic(libraryID, topicID);
		if (!topic) return [];
		return Object.values(topic.edges);
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
			onInit: ({ doc, body, refresh }) => {
				let win = doc.defaultView;
				let listener = () => refresh();
				win.addEventListener("paper-relations:graph-context-changed", listener);
				this.relationSectionListeners.set(body, { win, listener });
			},
			onDestroy: ({ body }) => {
				let data = this.relationSectionListeners.get(body);
				if (!data) return;
				data.win.removeEventListener("paper-relations:graph-context-changed", data.listener);
				this.relationSectionListeners.delete(body);
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
				title.textContent = "Paper Relations";
				title.style.fontWeight = "700";
				title.style.marginBottom = "8px";

				const desc = doc.createElementNS(XHTML_NS, "div");
				desc.textContent = "Topic graph data and operations";
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
				buttonWrap.className = "paper-relations-pane-actions";
				const createTopicBtn = doc.createElementNS(XHTML_NS, "button");
				createTopicBtn.type = "button";
				createTopicBtn.className = "paper-relations-create-topic-btn";
				createTopicBtn.textContent = "Create topic from selected paper";
				createTopicBtn.disabled = !item;
				createTopicBtn.addEventListener("click", () => {
					this.promptCreateTopicFromItem(win, item).catch((error) => Zotero.logError(error));
				});
				const removeTopicBtn = doc.createElementNS(XHTML_NS, "button");
				removeTopicBtn.type = "button";
				removeTopicBtn.className = "paper-relations-remove-topic-btn";
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

		let toolbar = doc.createElementNS(XHTML_NS, "div");
		toolbar.id = "paper-relations-graph-toolbar";

		let titleWrap = doc.createElementNS(XHTML_NS, "div");
		titleWrap.id = "paper-relations-graph-title-wrap";

		let header = doc.createElementNS(XHTML_NS, "div");
		header.id = "paper-relations-graph-header";
		header.textContent = "Paper Relation Graph";

		let subheader = doc.createElementNS(XHTML_NS, "div");
		subheader.id = "paper-relations-graph-subheader";
		subheader.textContent = "Select an item to load topic graph";

		titleWrap.append(header, subheader);

		let controls = doc.createElementNS(XHTML_NS, "div");
		controls.id = "paper-relations-graph-controls";
		let pinLabel = doc.createElementNS(XHTML_NS, "label");
		pinLabel.id = "paper-relations-pin-label";
		let pinCheckbox = doc.createElementNS(XHTML_NS, "input");
		pinCheckbox.type = "checkbox";
		pinCheckbox.id = "paper-relations-pin-checkbox";
		let pinText = doc.createElementNS(XHTML_NS, "span");
		pinText.textContent = "Pinned";
		pinLabel.append(pinCheckbox, pinText);
		controls.appendChild(pinLabel);

		toolbar.append(titleWrap, controls);

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
		viewport.append(boardGroup, edgesGroup, nodesGroup);
		svg.appendChild(viewport);
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
			pinCheckbox,
			svg,
			viewport,
			edgesGroup,
			nodesGroup,
			nodes: [],
			edges: [],
			activeTopicID: null,
			activeLibraryID: null,
			activeTopicName: "",
			isTemporaryTopic: false,
			pinSelection: false,
			activeItemKey: null,
			activeItemLibraryID: null,
			selectedNodeID: null,
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
			mousemove: (event) => this.onGraphMouseMove(window, event),
			mouseup: (event) => this.onGraphMouseUp(window, event),
			dragover: (event) => this.onGraphDragOver(window, event),
			drop: (event) => this.onGraphDrop(window, event),
			dragleave: (event) => this.onGraphDragLeave(window, event),
			pinchange: () => this.onPinCheckboxChange(window),
		};

		svg.addEventListener("wheel", state.handlers.wheel, { passive: false });
		svg.addEventListener("mousedown", state.handlers.mousedown);
		window.addEventListener("mousemove", state.handlers.mousemove);
		window.addEventListener("mouseup", state.handlers.mouseup);
		canvas.addEventListener("dragover", state.handlers.dragover);
		canvas.addEventListener("drop", state.handlers.drop);
		canvas.addEventListener("dragleave", state.handlers.dragleave);
		pinCheckbox.addEventListener("change", state.handlers.pinchange);

		this.graphStates.set(window, state);
		this.renderGraph(window);
		this.refreshGraphChrome(window);
		this.notifyGraphSelectionChanged(window);

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
				topicStatus: "Pin: off",
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
		state.pinCheckbox.checked = !!state.pinSelection;
		if (state.isTemporaryTopic) {
			state.canvas.classList.add("paper-relations-temporary-topic");
		}
		else {
			state.canvas.classList.remove("paper-relations-temporary-topic");
		}
	},

	onPinCheckboxChange(window) {
		let state = this.graphStates.get(window);
		if (!state) return;
		state.pinSelection = !!state.pinCheckbox.checked;
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

		let { nodes, edges, edgesGroup, nodesGroup } = state;
		let doc = window.document;
		const SVG_NS = "http://www.w3.org/2000/svg";

		edgesGroup.replaceChildren();
		nodesGroup.replaceChildren();

		for (let node of nodes) {
			let width = Number.isFinite(node.width) ? this.clampNodeWidth(node.width) : this.getNodeWidthForLabel(node.label);
			let minHeight = Number.isFinite(node.height) ? node.height : this.nodeDefaultHeight;
			let labelLines = this.wrapNodeLabel(node.label, width);
			let textBlockHeight = labelLines.length * this.nodeLineHeight;
			let height = Math.max(minHeight, textBlockHeight + 16);
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

			group.append(rect, titleElem, text);
			nodesGroup.appendChild(group);
		}

		this.updateGraphTransform(state);
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
		state.dragNodeRawX = null;
		state.dragNodeRawY = null;
		state.lastClientX = event.clientX;
		state.lastClientY = event.clientY;

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
				if (!Number.isFinite(state.dragNodeRawX) || !Number.isFinite(state.dragNodeRawY)) {
					state.dragNodeRawX = Number.isFinite(node.x) ? node.x : 0;
					state.dragNodeRawY = Number.isFinite(node.y) ? node.y : 0;
				}
				state.dragNodeRawX += dx / state.scale;
				state.dragNodeRawY += dy / state.scale;
				let snapped = this.snapPointToGrid({
					x: state.dragNodeRawX,
					y: state.dragNodeRawY,
				});
				node.x = snapped.x;
				node.y = snapped.y;
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
		let dragMode = state.dragMode;
		let dragNodeID = state.dragNodeID;
		state.dragMode = null;
		state.dragNodeID = null;
		state.dragNodeRawX = null;
		state.dragNodeRawY = null;
		if (
			dragMode === "node" &&
			dragNodeID &&
			state.activeTopicID &&
			state.activeLibraryID &&
			!state.isTemporaryTopic
		) {
			let node = state.nodes.find((n) => n.id === dragNodeID);
			if (node) {
				let snapped = this.snapPointToGrid({
					x: node.x,
					y: node.y,
				});
				node.x = snapped.x;
				node.y = snapped.y;
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
			state.canvas.removeEventListener("dragover", state.handlers.dragover);
			state.canvas.removeEventListener("drop", state.handlers.drop);
			state.canvas.removeEventListener("dragleave", state.handlers.dragleave);
			state.pinCheckbox.removeEventListener("change", state.handlers.pinchange);
		}
		this.graphStates.delete(window);
		this.selectionItemsByWindow.delete(window);

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

