var PaperRelationsStorageMixin = {
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
		return {
			x: baseX + col * this.nodeGapX,
			y: baseY + row * this.nodeGapY,
		};
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
		let nodeLabel = nodeInput.shortLabel || nodeInput.title || nodeInput.itemKey;
		let snappedPos = this.snapNodePositionToGrid(pos, {
			label: nodeLabel,
		});

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
			let snapLabel = typeof patch?.snapLabel === "string"
				? patch.snapLabel.trim()
				: "";
			let nodeLabel = snapLabel || node.shortLabel || node.title || node.itemKey;
			let snapped = this.snapNodePositionToGrid({
				x: patch?.x !== undefined ? patch.x : node.x,
				y: patch?.y !== undefined ? patch.y : node.y,
			}, {
				label: nodeLabel,
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
};

