var PaperRelationsGraphTopicMixin = {
	async removeNodeFromActiveTopic(window, nodeID) {
		let state = this.graphStates.get(window);
		if (!state || !nodeID || !this.isSavedTopicMutableState(state)) return;
		let topicID = state.activeTopicID;
		let libraryID = state.activeLibraryID;
		if (!topicID || !libraryID) return;
		if (state.renamingNodeID === nodeID) {
			this.cancelNodeRename(window);
		}

		try {
			let removed = await this.removeNode(libraryID, topicID, nodeID);
			if (!removed) return;
			let updatedTopic = await this.getTopic(libraryID, topicID);
			let selectedItem = this.selectionItemsByWindow.get(window) || this.getCurrentSelectedItem(window);
			if (updatedTopic) {
				this.applyTopicToGraphState(window, updatedTopic, selectedItem);
				this.refreshGraphChrome(window);
				this.notifyGraphSelectionChanged(window);
				this.notifyGraphContextChanged(window);
			}
			else {
				await this.handlePrimaryItemChanged(window, selectedItem, { force: true });
			}
		}
		catch (error) {
			Zotero.logError(error);
			Services.prompt.alert(
				window,
				this.getGraphWorkspaceText("removeNodeFailedTitle"),
				String(error?.message || error),
			);
		}
	},

	async handlePrimaryItemChanged(window, item, options = {}) {
		let state = this.graphStates.get(window);
		if (!state) return;

		let force = !!options.force;
		if (!item) {
			this.hideGraphContextMenus(window);
			this.finishNodeRename(window, { restoreNode: false, render: false });
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
				state.hoverBundleID = null;
				state.edgeDraft = null;
				state.edgeCutDraft = null;
				state.edgeBundleDraft = null;
				state.dragBundleID = null;
				state.contextMenuBundleID = null;
				state.suppressNextContextMenu = false;
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
		this.hideGraphContextMenus(window);
		this.finishNodeRename(window, { restoreNode: false, render: false });

		let selectedItemRef = selectedItem ? this.getItemRef(selectedItem.libraryID, selectedItem.key) : null;
		let nodes = Object.values(topic.nodes).map((node) => {
			let nodeType = String(node.nodeType || "paper").toLowerCase() === "bundle" ? "bundle" : "paper";
			if (nodeType === "bundle") {
				return {
					id: node.id,
					nodeType: "bundle",
					itemKey: "",
					libraryID: null,
					title: "(bundle)",
					label: "(bundle)",
					x: Number.isFinite(node.x) ? node.x : 0,
					y: Number.isFinite(node.y) ? node.y : 0,
					width: 0,
					height: 0,
					kind: "bundle",
					slopeMode: this.normalizeBundleSlopeMode(node.slopeMode),
					createdAt: node.createdAt,
					updatedAt: node.updatedAt,
				};
			}
			let itemRef = this.getItemRef(node.libraryID, node.itemKey);
			let displayLabel = this.getNodeLabelForDisplay(node);
			return {
				id: node.id,
				nodeType: "paper",
				itemKey: node.itemKey,
				libraryID: node.libraryID,
				title: node.title || node.itemKey,
				label: displayLabel,
				x: Number.isFinite(node.x) ? node.x : 80,
				y: Number.isFinite(node.y) ? node.y : 120,
				width: this.getNodeWidthForLabel(displayLabel),
				height: this.nodeDefaultHeight,
				kind: selectedItemRef && selectedItemRef === itemRef ? "root" : "leaf",
				shortLabel: node.shortLabel || "",
				note: node.note || "",
				createdAt: node.createdAt,
				updatedAt: node.updatedAt,
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
		state.hoverBundleID = null;
		state.edgeDraft = null;
		state.edgeCutDraft = null;
		state.edgeBundleDraft = null;
		state.dragBundleID = null;
		state.contextMenuBundleID = null;
		state.suppressNextContextMenu = false;
		if (selectedItemRef) {
			let selectedNode = nodes.find((node) =>
				node.nodeType !== "bundle" &&
				this.getItemRef(node.libraryID, node.itemKey) === selectedItemRef,
			);
			if (selectedNode) {
				state.selectedNodeID = selectedNode.id;
			}
		}
		this.renderGraph(window);
		if (typeof this.getBundleTopologyWarningsFromState === "function") {
			let warnings = this.getBundleTopologyWarningsFromState(state);
			if (typeof this.showBundleTopologyWarnings === "function") {
				this.showBundleTopologyWarnings(window, warnings);
			}
		}
	},

	applyTemporaryTopicForItem(window, item) {
		let state = this.graphStates.get(window);
		if (!state || !item) return;
		this.hideGraphContextMenus(window);
		this.finishNodeRename(window, { restoreNode: false, render: false });
		let title = this.getItemTitle(item);
		let label = this.getNodeLabelForDisplay({
			libraryID: item.libraryID,
			itemKey: item.key,
			title,
		});
		let nodeID = `temp_${item.libraryID}_${item.key}`;
		state.nodes = [{
			id: nodeID,
			nodeType: "paper",
			itemKey: item.key,
			libraryID: item.libraryID,
			title,
			label,
			x: 120,
			y: 100,
			width: this.getNodeWidthForLabel(label),
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
		state.hoverBundleID = null;
		state.edgeDraft = null;
		state.edgeCutDraft = null;
		state.edgeBundleDraft = null;
		state.dragBundleID = null;
		state.contextMenuBundleID = null;
		state.suppressNextContextMenu = false;
		this.renderGraph(window);
	},

	promptTopicNameInput(window, dialogTitle, defaultName) {
		let input = {
			value: String(defaultName || ""),
		};
		let accepted = Services.prompt.prompt(
			window,
			dialogTitle,
			"Topic name:",
			input,
			null,
			{},
		);
		if (!accepted) return null;
		return input.value;
	},

	async promptCreateTopicFromItem(window, explicitItem = null) {
		let state = this.graphStates.get(window);
		if (!state) return;
		let item = explicitItem || this.selectionItemsByWindow.get(window) || this.getCurrentSelectedItem(window);
		if (!item) return;

		try {
			let defaultName = this.getItemTitle(item);
			let inputName = this.promptTopicNameInput(window, "Create Topic", defaultName);
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

	async promptRenameActiveTopic(window) {
		let state = this.graphStates.get(window);
		if (!state || !this.canRemoveActiveTopic(window)) return;
		let defaultName = state.activeTopicName || "Untitled Topic";
		let inputName = this.promptTopicNameInput(window, "Rename Topic", defaultName);
		if (inputName === null) return;
		let nextName = String(inputName || "").trim();
		if (!nextName) return;

		try {
			let updated = await this.updateTopic(state.activeLibraryID, state.activeTopicID, {
				name: nextName,
			});
			if (!updated) {
				throw new Error("Topic not found");
			}
			state.activeTopicName = updated.name || nextName;
			this.refreshGraphChrome(window);
			this.notifyGraphContextChanged(window);
		}
		catch (error) {
			Zotero.logError(error);
			Services.prompt.alert(window, "Rename Topic Failed", String(error?.message || error));
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
};
