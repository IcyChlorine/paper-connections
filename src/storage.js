var PaperConnectionsStorageMixin = {
	normalizeBundleSlopeMode(mode) {
		if (mode === "flat") return "flat";
		// Backward compatibility: previous "matched" mode now maps to unconstrained mode.
		if (mode === "matched") return "free";
		return "free";
	},

	createEmptyStore() {
		return {
			schemaVersion: this.storeSchemaVersion,
			topics: {},
			itemTopicIndex: {},
		};
	},

	isBundleNode(node) {
		return node?.nodeType === "bundle";
	},

	isPaperNode(node) {
		return !this.isBundleNode(node);
	},

	getTopicNodeByItemRef(topic, itemRef) {
		for (let node of Object.values(topic.nodes || {})) {
			if (!this.isPaperNode(node)) continue;
			if (this.getItemRef(node.libraryID, node.itemKey) === itemRef) {
				return node;
			}
		}
		return null;
	},

	normalizeTopicRecord(topicInput, topicIDHint, libraryIDHint = null) {
		if (!topicInput || typeof topicInput !== "object") return null;
		let now = this.now();
		let topicID = typeof topicInput.id === "string" && topicInput.id
			? topicInput.id
			: (typeof topicIDHint === "string" ? topicIDHint : this.generateID("topic"));
		let topic = {
			id: topicID,
			libraryID: Number.isFinite(topicInput.libraryID) ? topicInput.libraryID : libraryIDHint,
			name: (topicInput.name || "Untitled Topic").trim() || "Untitled Topic",
			createdAt: Number.isFinite(topicInput.createdAt) ? topicInput.createdAt : now,
			updatedAt: Number.isFinite(topicInput.updatedAt) ? topicInput.updatedAt : now,
			nodes: topicInput.nodes && typeof topicInput.nodes === "object" ? topicInput.nodes : {},
			edges: topicInput.edges && typeof topicInput.edges === "object" ? topicInput.edges : {},
		};

		let normalizedNodes = {};
		for (let [nodeKey, rawNode] of Object.entries(topic.nodes || {})) {
			if (!rawNode || typeof rawNode !== "object") continue;
			let nodeID = typeof rawNode.id === "string" && rawNode.id ? rawNode.id : nodeKey;
			if (!nodeID || normalizedNodes[nodeID]) continue;
			let rawType = String(rawNode.nodeType || "").toLowerCase();
			let inferredType = rawType === "bundle" || rawType === "paper"
				? rawType
				: (
					(rawNode.itemKey && Number.isFinite(rawNode.libraryID))
						? "paper"
						: "bundle"
				);
			if (inferredType === "bundle") {
				normalizedNodes[nodeID] = {
					id: nodeID,
					nodeType: "bundle",
					x: Number.isFinite(rawNode.x) ? rawNode.x : 0,
					y: Number.isFinite(rawNode.y) ? rawNode.y : 0,
					slopeMode: this.normalizeBundleSlopeMode(rawNode.slopeMode),
					createdAt: Number.isFinite(rawNode.createdAt) ? rawNode.createdAt : now,
					updatedAt: Number.isFinite(rawNode.updatedAt) ? rawNode.updatedAt : now,
				};
				continue;
			}
			let libraryID = Number.isFinite(rawNode.libraryID)
				? rawNode.libraryID
				: topic.libraryID;
			let itemKey = typeof rawNode.itemKey === "string" ? rawNode.itemKey : "";
			if (!Number.isFinite(libraryID) || !itemKey) continue;
			normalizedNodes[nodeID] = {
				id: nodeID,
				nodeType: "paper",
				libraryID,
				itemKey,
				title: rawNode.title || itemKey,
				shortLabel: rawNode.shortLabel || "",
				note: rawNode.note || "",
				x: Number.isFinite(rawNode.x) ? rawNode.x : 0,
				y: Number.isFinite(rawNode.y) ? rawNode.y : 0,
				createdAt: Number.isFinite(rawNode.createdAt) ? rawNode.createdAt : now,
				updatedAt: Number.isFinite(rawNode.updatedAt) ? rawNode.updatedAt : now,
			};
		}
		topic.nodes = normalizedNodes;

		let normalizedEdges = {};
		for (let [edgeKey, rawEdge] of Object.entries(topic.edges || {})) {
			if (!rawEdge || typeof rawEdge !== "object") continue;
			let edgeID = typeof rawEdge.id === "string" && rawEdge.id ? rawEdge.id : edgeKey;
			let fromNodeID = typeof rawEdge.fromNodeID === "string" ? rawEdge.fromNodeID : "";
			let toNodeID = typeof rawEdge.toNodeID === "string" ? rawEdge.toNodeID : "";
			if (!edgeID || normalizedEdges[edgeID]) continue;
			if (!fromNodeID || !toNodeID) continue;
			if (!topic.nodes[fromNodeID] || !topic.nodes[toNodeID]) continue;
			normalizedEdges[edgeID] = {
				id: edgeID,
				fromNodeID,
				toNodeID,
				type: rawEdge.type || "related",
				note: rawEdge.note || "",
				createdAt: Number.isFinite(rawEdge.createdAt) ? rawEdge.createdAt : now,
				updatedAt: Number.isFinite(rawEdge.updatedAt) ? rawEdge.updatedAt : now,
			};
		}
		topic.edges = normalizedEdges;

		return topic;
	},

	createBundleNodeRecord(topic, input = {}) {
		let now = this.now();
		let nodeID = typeof input.id === "string" && input.id ? input.id : this.generateID("bundle");
		while (topic.nodes[nodeID]) {
			nodeID = this.generateID("bundle");
		}
		return {
			id: nodeID,
			nodeType: "bundle",
			x: Number.isFinite(input.x) ? input.x : 0,
			y: Number.isFinite(input.y) ? input.y : 0,
			slopeMode: this.normalizeBundleSlopeMode(input.slopeMode),
			createdAt: Number.isFinite(input.createdAt) ? input.createdAt : now,
			updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : now,
		};
	},

	createEdgeRecord(topic, input = {}) {
		let now = this.now();
		let edgeID = typeof input.id === "string" && input.id ? input.id : this.generateID("edge");
		while (topic.edges[edgeID]) {
			edgeID = this.generateID("edge");
		}
		return {
			id: edgeID,
			fromNodeID: input.fromNodeID,
			toNodeID: input.toNodeID,
			type: input.type || "related",
			note: input.note || "",
			createdAt: Number.isFinite(input.createdAt) ? input.createdAt : now,
			updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : now,
		};
	},

	getTopicAdjacency(topic) {
		let inMap = new Map();
		let outMap = new Map();
		for (let nodeID of Object.keys(topic.nodes || {})) {
			inMap.set(nodeID, []);
			outMap.set(nodeID, []);
		}
		for (let edge of Object.values(topic.edges || {})) {
			if (!inMap.has(edge.toNodeID) || !outMap.has(edge.fromNodeID)) continue;
			inMap.get(edge.toNodeID).push(edge);
			outMap.get(edge.fromNodeID).push(edge);
		}
		return { inMap, outMap };
	},

	cleanupIsolatedBundleNodes(topic) {
		if (!topic || !topic.nodes || !topic.edges) return [];
		let { inMap, outMap } = this.getTopicAdjacency(topic);
		let removedNodeIDs = [];
		for (let node of Object.values(topic.nodes)) {
			if (!this.isBundleNode(node)) continue;
			let inDegree = (inMap.get(node.id) || []).length;
			let outDegree = (outMap.get(node.id) || []).length;
			if (inDegree === 0 && outDegree === 0) {
				delete topic.nodes[node.id];
				removedNodeIDs.push(node.id);
			}
		}
		return removedNodeIDs;
	},

	analyzeBundleTopology(topic) {
		if (!topic || typeof topic !== "object") {
			return { issues: [], warnings: [] };
		}
		let { inMap, outMap } = this.getTopicAdjacency(topic);
		let issues = [];
		let warnings = [];
		for (let node of Object.values(topic.nodes || {})) {
			if (!this.isBundleNode(node)) continue;
			let inDegree = (inMap.get(node.id) || []).length;
			let outDegree = (outMap.get(node.id) || []).length;
			let issue = {
				nodeID: node.id,
				inDegree,
				outDegree,
				multiInbound: inDegree > 1,
			};
			if (issue.multiInbound) {
				issue.message = `Bundle node ${node.id} has multiple incoming edges (${inDegree})`;
				warnings.push(issue.message);
			}
			issues.push(issue);
		}
		return { issues, warnings };
	},

	migrateLegacyBundlesIntoNodes(topic, rawBundlesInput = null) {
		if (!topic || typeof topic !== "object") return { migrated: 0 };
		let rawBundlesSource = rawBundlesInput && typeof rawBundlesInput === "object"
			? rawBundlesInput
			: (topic.bundles && typeof topic.bundles === "object" ? topic.bundles : null);
		let rawBundles = rawBundlesSource ? Object.values(rawBundlesSource) : [];
		if (!rawBundles.length) {
			return { migrated: 0 };
		}

		let migratedCount = 0;
		for (let rawBundle of rawBundles) {
			if (!rawBundle || typeof rawBundle !== "object") continue;
			let sourceNodeID = typeof rawBundle.sourceNodeID === "string" ? rawBundle.sourceNodeID : "";
			if (!sourceNodeID || !topic.nodes[sourceNodeID]) continue;
			let edgeIDs = Array.isArray(rawBundle.edgeIDs) ? rawBundle.edgeIDs : [];
			let validEdgeIDs = [];
			let localSet = new Set();
			for (let edgeID of edgeIDs) {
				if (typeof edgeID !== "string" || !edgeID || localSet.has(edgeID)) continue;
				let edge = topic.edges[edgeID];
				if (!edge || edge.fromNodeID !== sourceNodeID) continue;
				localSet.add(edgeID);
				validEdgeIDs.push(edgeID);
			}
			if (!validEdgeIDs.length) continue;

			let bundleNode = this.createBundleNodeRecord(topic, {
				id: rawBundle.id,
				x: rawBundle.x,
				y: rawBundle.y,
				slopeMode: rawBundle.slopeMode,
				createdAt: rawBundle.createdAt,
				updatedAt: rawBundle.updatedAt,
			});
			topic.nodes[bundleNode.id] = bundleNode;
			let now = this.now();
			for (let edgeID of validEdgeIDs) {
				let edge = topic.edges[edgeID];
				if (!edge) continue;
				edge.fromNodeID = bundleNode.id;
				edge.updatedAt = now;
			}
			let trunkEdge = this.createEdgeRecord(topic, {
				fromNodeID: sourceNodeID,
				toNodeID: bundleNode.id,
				type: "related",
				note: "",
				createdAt: now,
				updatedAt: now,
			});
			topic.edges[trunkEdge.id] = trunkEdge;
			migratedCount += 1;
		}
		return { migrated: migratedCount };
	},

	rebuildItemTopicIndex(store) {
		let index = {};
		for (let topic of Object.values(store.topics || {})) {
			for (let node of Object.values(topic.nodes || {})) {
				if (!this.isPaperNode(node)) continue;
				if (!Number.isFinite(node.libraryID) || !node.itemKey) continue;
				let itemRef = this.getItemRef(node.libraryID, node.itemKey);
				if (!index[itemRef]) index[itemRef] = [];
				if (!index[itemRef].includes(topic.id)) {
					index[itemRef].push(topic.id);
				}
			}
		}
		return index;
	},

	normalizeStoreWithMeta(rawStore) {
		let changed = false;
		let store = rawStore && typeof rawStore === "object"
			? this.cloneJSON(rawStore)
			: this.createEmptyStore();
		if (!store || typeof store !== "object") {
			return { store: this.createEmptyStore(), changed: true };
		}

		if (!store.topics || typeof store.topics !== "object") {
			store.topics = {};
			changed = true;
		}
		if (!store.itemTopicIndex || typeof store.itemTopicIndex !== "object") {
			store.itemTopicIndex = {};
			changed = true;
		}

		let normalizedTopics = {};
		for (let [topicID, rawTopic] of Object.entries(store.topics || {})) {
			let topic = this.normalizeTopicRecord(rawTopic, topicID);
			if (!topic) {
				changed = true;
				continue;
			}
			if (Object.prototype.hasOwnProperty.call(rawTopic || {}, "bundles")) {
				changed = true;
			}
			if (rawTopic?.bundles && Object.keys(rawTopic.bundles).length) {
				let result = this.migrateLegacyBundlesIntoNodes(topic, rawTopic.bundles);
				if (result.migrated > 0) {
					changed = true;
				}
			}
			let removedBundleIDs = this.cleanupIsolatedBundleNodes(topic);
			if (removedBundleIDs.length) changed = true;
			topic.updatedAt = Number.isFinite(topic.updatedAt) ? topic.updatedAt : this.now();
			normalizedTopics[topic.id] = topic;
		}
		store.topics = normalizedTopics;

		let rebuiltIndex = this.rebuildItemTopicIndex(store);
		let oldIndexText = JSON.stringify(store.itemTopicIndex || {});
		let newIndexText = JSON.stringify(rebuiltIndex);
		if (oldIndexText !== newIndexText) {
			changed = true;
		}
		store.itemTopicIndex = rebuiltIndex;

		if (store.schemaVersion !== this.storeSchemaVersion) {
			changed = true;
		}
		store.schemaVersion = this.storeSchemaVersion;

		return { store, changed };
	},

	normalizeStore(rawStore) {
		return this.normalizeStoreWithMeta(rawStore).store;
	},

	async ensureSyncedSettingsLoaded(libraryID) {
		if (!libraryID) {
			throw new Error("Invalid libraryID");
		}
		if (this.syncedSettingsLoadedLibraries.has(libraryID)) return;
		await Zotero.SyncedSettings.loadAll(libraryID);
		this.syncedSettingsLoadedLibraries.add(libraryID);
	},

	getStoreSettingKeysForLoad() {
		let keys = [this.storeSettingKey];
		for (let key of this.legacyStoreSettingKeys || []) {
			if (typeof key !== "string" || !key || keys.includes(key)) continue;
			keys.push(key);
		}
		return keys;
	},

	async loadStore(libraryID) {
		await this.ensureSyncedSettingsLoaded(libraryID);
		let raw = null;
		let sourceKey = this.storeSettingKey;
		for (let settingKey of this.getStoreSettingKeysForLoad()) {
			let candidate = Zotero.SyncedSettings.get(libraryID, settingKey);
			if (candidate === undefined || candidate === null) continue;
			raw = candidate;
			sourceKey = settingKey;
			break;
		}
		let { store, changed } = this.normalizeStoreWithMeta(raw);
		if (changed || sourceKey !== this.storeSettingKey) {
			await Zotero.SyncedSettings.set(libraryID, this.storeSettingKey, store);
		}
		return store;
	},

	async saveStore(libraryID, store) {
		let normalized = this.normalizeStore(store);
		await Zotero.SyncedSettings.set(libraryID, this.storeSettingKey, normalized);
		return normalized;
	},

	getTopicsSorted(store) {
		return Object.values(store.topics).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
	},

	updateItemTopicIndexForTopic(store, topic) {
		for (let itemRef of Object.keys(store.itemTopicIndex)) {
			store.itemTopicIndex[itemRef] = store.itemTopicIndex[itemRef].filter((id) => id !== topic.id);
			if (!store.itemTopicIndex[itemRef].length) delete store.itemTopicIndex[itemRef];
		}
		for (let node of Object.values(topic.nodes || {})) {
			if (!this.isPaperNode(node)) continue;
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
				nodeType: "paper",
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
		let paperCount = Object.values(topic.nodes || {}).filter((node) => this.isPaperNode(node)).length;
		let baseX = this.nodeSnapGridSize * 3;
		let baseY = this.nodeSnapGridSize * 5;
		if (!paperCount) {
			return {
				x: baseX,
				y: baseY,
			};
		}
		let cols = 3;
		let col = paperCount % cols;
		let row = Math.floor(paperCount / cols);
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

		let now = this.now();
		let nodeType = String(nodeInput?.nodeType || "paper").toLowerCase() === "bundle" ? "bundle" : "paper";
		let node = null;

		if (nodeType === "paper") {
			let itemKey = typeof nodeInput?.itemKey === "string" ? nodeInput.itemKey : "";
			if (!itemKey) return null;
			let itemRef = this.getItemRef(libraryID, itemKey);
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
			while (topic.nodes[nodeID]) nodeID = this.generateID("node");
			node = {
				id: nodeID,
				nodeType: "paper",
				libraryID,
				itemKey,
				title: nodeInput.title || itemKey,
				shortLabel: nodeInput.shortLabel || "",
				note: nodeInput.note || "",
				x: snappedPos.x,
				y: snappedPos.y,
				createdAt: now,
				updatedAt: now,
			};
		}
		else {
			node = this.createBundleNodeRecord(topic, {
				id: nodeInput.id,
				x: nodeInput.x,
				y: nodeInput.y,
				slopeMode: nodeInput.slopeMode,
				createdAt: now,
				updatedAt: now,
			});
		}

		topic.nodes[node.id] = node;
		topic.updatedAt = now;
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

		if (this.isBundleNode(node)) {
			if (patch?.x !== undefined && Number.isFinite(patch.x)) {
				node.x = patch.x;
			}
			if (patch?.y !== undefined && Number.isFinite(patch.y)) {
				node.y = patch.y;
			}
			if (patch?.slopeMode !== undefined) {
				node.slopeMode = this.normalizeBundleSlopeMode(patch.slopeMode);
			}
			node.updatedAt = this.now();
			topic.updatedAt = this.now();
			await this.saveStore(libraryID, store);
			return this.cloneJSON(node);
		}

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
		this.cleanupIsolatedBundleNodes(topic);
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

		let edge = this.createEdgeRecord(topic, {
			fromNodeID: edgeInput.fromNodeID,
			toNodeID: edgeInput.toNodeID,
			type: edgeInput.type || "related",
			note: edgeInput.note || "",
		});
		topic.edges[edge.id] = edge;
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
		this.cleanupIsolatedBundleNodes(topic);
		topic.updatedAt = this.now();
		await this.saveStore(libraryID, store);
		return true;
	},

	async listEdges(libraryID, topicID) {
		let topic = await this.getTopic(libraryID, topicID);
		if (!topic) return [];
		return Object.values(topic.edges);
	},

	filterBundleGroupEdgeIDs(topic, sourceNodeID, edgeIDsInput) {
		if (!topic || !sourceNodeID || !Array.isArray(edgeIDsInput)) return [];
		let localSet = new Set();
		let out = [];
		for (let edgeID of edgeIDsInput) {
			if (typeof edgeID !== "string" || !edgeID || localSet.has(edgeID)) continue;
			let edge = topic.edges[edgeID];
			if (!edge || edge.fromNodeID !== sourceNodeID) continue;
			localSet.add(edgeID);
			out.push(edgeID);
		}
		return out;
	},

	async applyBundleGroups(libraryID, topicID, groups, options = {}) {
		let store = await this.loadStore(libraryID);
		let topic = store.topics[topicID];
		if (!topic) return { created: 0, bundleNodeIDs: [], warnings: [] };
		let groupList = Array.isArray(groups) ? groups : [];
		let bundleNodeIDs = [];
		let warnings = [];
		let now = this.now();

		for (let group of groupList) {
			if (!group || typeof group !== "object") continue;
			let sourceNodeID = typeof group.sourceNodeID === "string" ? group.sourceNodeID : "";
			if (!sourceNodeID || !topic.nodes[sourceNodeID]) continue;
			let edgeIDs = this.filterBundleGroupEdgeIDs(topic, sourceNodeID, group.edgeIDs || []);
			if (!edgeIDs.length) continue;

			let bundleNode = this.createBundleNodeRecord(topic, {
				x: group.x,
				y: group.y,
				slopeMode: group.slopeMode || options.defaultSlopeMode || "flat",
				createdAt: now,
				updatedAt: now,
			});
			topic.nodes[bundleNode.id] = bundleNode;
			bundleNodeIDs.push(bundleNode.id);

			let trunkEdge = this.createEdgeRecord(topic, {
				fromNodeID: sourceNodeID,
				toNodeID: bundleNode.id,
				type: "related",
				note: "",
				createdAt: now,
				updatedAt: now,
			});
			topic.edges[trunkEdge.id] = trunkEdge;

			for (let edgeID of edgeIDs) {
				let edge = topic.edges[edgeID];
				if (!edge) continue;
				edge.fromNodeID = bundleNode.id;
				edge.updatedAt = now;
			}
		}

		this.cleanupIsolatedBundleNodes(topic);
		let topology = this.analyzeBundleTopology(topic);
		warnings.push(...(topology.warnings || []));
		topic.updatedAt = this.now();
		this.updateItemTopicIndexForTopic(store, topic);
		await this.saveStore(libraryID, store);
		return {
			created: bundleNodeIDs.length,
			bundleNodeIDs,
			warnings,
		};
	},

	async dissolveBundleNode(libraryID, topicID, bundleNodeID) {
		let store = await this.loadStore(libraryID);
		let topic = store.topics[topicID];
		let node = topic?.nodes?.[bundleNodeID];
		if (!topic || !node || !this.isBundleNode(node)) {
			return { ok: false, warning: "Bundle node not found" };
		}

		let incoming = [];
		let outgoing = [];
		for (let edge of Object.values(topic.edges || {})) {
			if (edge.toNodeID === bundleNodeID) incoming.push(edge);
			if (edge.fromNodeID === bundleNodeID) outgoing.push(edge);
		}
		if (incoming.length !== 1) {
			return {
				ok: false,
				warning: `Bundle node ${bundleNodeID} must have exactly 1 incoming edge to dissolve (actual ${incoming.length})`,
			};
		}

		let predecessorNodeID = incoming[0].fromNodeID;
		let removeEdgeIDSet = new Set([
			...incoming.map((edge) => edge.id),
			...outgoing.map((edge) => edge.id),
		]);
		let signatureSet = new Set();
		for (let edge of Object.values(topic.edges || {})) {
			if (removeEdgeIDSet.has(edge.id)) continue;
			signatureSet.add(`${edge.fromNodeID}|${edge.toNodeID}|${edge.type || "related"}|${edge.note || ""}`);
		}

		let createdEdgeIDs = [];
		let now = this.now();
		for (let edge of outgoing) {
			let signature = `${predecessorNodeID}|${edge.toNodeID}|${edge.type || "related"}|${edge.note || ""}`;
			if (signatureSet.has(signature)) continue;
			signatureSet.add(signature);
			let newEdge = this.createEdgeRecord(topic, {
				fromNodeID: predecessorNodeID,
				toNodeID: edge.toNodeID,
				type: edge.type || "related",
				note: edge.note || "",
				createdAt: now,
				updatedAt: now,
			});
			topic.edges[newEdge.id] = newEdge;
			createdEdgeIDs.push(newEdge.id);
		}

		for (let edgeID of removeEdgeIDSet) {
			delete topic.edges[edgeID];
		}
		delete topic.nodes[bundleNodeID];
		this.cleanupIsolatedBundleNodes(topic);
		let topology = this.analyzeBundleTopology(topic);
		topic.updatedAt = this.now();
		this.updateItemTopicIndexForTopic(store, topic);
		await this.saveStore(libraryID, store);
		return {
			ok: true,
			createdEdgeIDs,
			warnings: topology.warnings || [],
		};
	},

	// Deprecated metadata bundle API compatibility wrappers.
	async listBundles(libraryID, topicID) {
		let topic = await this.getTopic(libraryID, topicID);
		if (!topic) return [];
		return Object.values(topic.nodes || {})
			.filter((node) => this.isBundleNode(node))
			.map((node) => ({
				id: node.id,
				sourceNodeID: null,
				edgeIDs: [],
				x: node.x,
				y: node.y,
				slopeMode: this.normalizeBundleSlopeMode(node.slopeMode),
				createdAt: node.createdAt,
				updatedAt: node.updatedAt,
			}));
	},

	async createBundle(libraryID, topicID, input) {
		let sourceNodeID = typeof input?.sourceNodeID === "string" ? input.sourceNodeID : "";
		let edgeIDs = Array.isArray(input?.edgeIDs) ? input.edgeIDs : [];
		let result = await this.applyBundleGroups(libraryID, topicID, [{
			sourceNodeID,
			edgeIDs,
			x: input?.x,
			y: input?.y,
			slopeMode: input?.slopeMode,
		}]);
		if (!result.bundleNodeIDs?.length) return null;
		let topic = await this.getTopic(libraryID, topicID);
		let node = topic?.nodes?.[result.bundleNodeIDs[0]];
		if (!node) return null;
		return {
			id: node.id,
			x: node.x,
			y: node.y,
			slopeMode: node.slopeMode,
		};
	},

	async updateBundle(libraryID, topicID, bundleID, patch) {
		let updated = await this.updateNode(libraryID, topicID, bundleID, {
			x: patch?.x,
			y: patch?.y,
			slopeMode: patch?.slopeMode,
		});
		if (!updated) return null;
		return {
			id: updated.id,
			x: updated.x,
			y: updated.y,
			slopeMode: updated.slopeMode,
			updatedAt: updated.updatedAt,
		};
	},

	async deleteBundle(libraryID, topicID, bundleID) {
		let result = await this.dissolveBundleNode(libraryID, topicID, bundleID);
		return !!result?.ok;
	},

	async replaceBundles() {
		return [];
	},
};
