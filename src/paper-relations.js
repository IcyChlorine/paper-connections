PaperRelations = {
	id: null,
	version: null,
	rootURI: null,
	initialized: false,
	addedElementIDs: [],

	topicContextSectionID: "paper-relations-topic-context-section",
	selectionDebugSectionID: "paper-relations-selection-debug-section",
	sectionRegistered: false,
	remarkColumnDataKey: "remark",
	remarkInfoRowID: "paper-relations-remark-row",
	remarkColumnRegisteredKey: null,
	remarkInfoRowRegisteredID: null,
	remarkIntegrationRegistered: false,

	graphStates: null,
	selectionDebugSectionListeners: null,
	topicContextSectionListeners: null,
	selectionItemsByWindow: null,
	syncedSettingsLoadedLibraries: null,
	remarkMigrationBusyByWindow: null,

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
		this.selectionDebugSectionListeners = new WeakMap();
		this.topicContextSectionListeners = new WeakMap();
		this.selectionItemsByWindow = new WeakMap();
		this.syncedSettingsLoadedLibraries = new Set();
		this.remarkMigrationBusyByWindow = new WeakMap();
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
		return this.getCurrentLocaleTag().startsWith("zh") ? "简记(PR)" : "Remark(PR)";
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

	extractLegacyRemarkFromNoteHTML(noteHTML) {
		let html = String(noteHTML || "");
		if (!html.trim()) return "";
		let text = html
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/p>/gi, "\n")
			.replace(/<[^>]*>/g, " ")
			.replace(/&nbsp;/g, " ");
		if (Zotero.Utilities?.unescapeHTML) {
			text = Zotero.Utilities.unescapeHTML(text);
		}
		return this.normalizeRemarkValue(text);
	},

	async getLegacyRemarkFromItemNotes(item) {
		if (!item || typeof item.getNotes !== "function") return "";
		let noteIDs = item.getNotes() || [];
		for (let noteID of noteIDs) {
			let noteItem = await Zotero.Items.getAsync(noteID);
			if (!noteItem || !noteItem.isNote?.()) continue;
			let hasRemarkTag = (noteItem.getTags?.() || []).some((tag) => String(tag?.tag || "").trim().toLowerCase() === "remark");
			if (!hasRemarkTag) continue;
			let candidate = this.extractLegacyRemarkFromNoteHTML(noteItem.getNote?.() || "");
			if (candidate) return candidate;
		}
		return "";
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
					l10nID: "paper-relations-remark-label",
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

				let nextLabel = this.getNodeLabelForDisplay(node);
				let nextWidth = this.getNodeWidthForLabel(nextLabel);
				let nextTitle = this.getItemTitle(item);
				let nextMetrics = this.getNodeRenderMetrics({
					...node,
					label: nextLabel,
					width: nextWidth,
				});
				let nextX = oldCenterX - nextMetrics.width / 2;
				let nextY = oldCenterY - nextMetrics.height / 2;

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
				}
				if (node.y !== nextY) {
					node.y = nextY;
					changed = true;
				}
				if (node.title !== nextTitle) {
					node.title = nextTitle;
					changed = true;
				}
			}

			if (changed) {
				this.renderGraph(win);
				this.notifyGraphSelectionChanged(win);
			}
		}
	},

	getTargetLibraryID(window, explicitItem = null) {
		return explicitItem?.libraryID
			|| this.selectionItemsByWindow.get(window)?.libraryID
			|| window?.ZoteroPane?.getSelectedLibraryID?.()
			|| Zotero.Libraries.userLibraryID;
	},

	isRemarkMigrationBusy(window) {
		return !!this.remarkMigrationBusyByWindow.get(window);
	},

	setRemarkMigrationBusy(window, busy) {
		this.remarkMigrationBusyByWindow.set(window, !!busy);
		this.notifyGraphContextChanged(window);
	},

	async migrateLegacyESRemarksForLibrary(libraryID) {
		let scanned = 0;
		let alreadyCompatible = 0;
		let migrated = 0;
		let errors = 0;

		let search = new Zotero.Search();
		search.libraryID = libraryID;
		let itemIDs = await search.search();
		let items = await Zotero.Items.getAsync(itemIDs);

		for (let item of items) {
			if (!item || !item.isRegularItem?.()) continue;
			scanned += 1;

			let existingRemark = this.getItemRemark(item);
			if (existingRemark) {
				alreadyCompatible += 1;
				continue;
			}

			let legacyRemark = await this.getLegacyRemarkFromItemNotes(item);
			if (!legacyRemark) continue;

			try {
				await this.setItemRemark(item, legacyRemark);
				migrated += 1;
			}
			catch (error) {
				errors += 1;
				Zotero.logError(error);
			}
		}

		this.refreshRemarkPresentation();
		return { scanned, alreadyCompatible, migrated, errors };
	},

	async promptMigrateESRemarks(window, explicitItem = null) {
		let libraryID = this.getTargetLibraryID(window, explicitItem);
		if (!libraryID) return;

		let proceed = Services.prompt.confirm(
			window,
			"Migrate ES Remarks",
			"Import legacy Ethereal Style remarks into Paper Relations Remark now?\n\n" +
				"Note: existing remark values in Extra (remark: ...) are already compatible and will be kept as-is."
		);
		if (!proceed) return;

		this.setRemarkMigrationBusy(window, true);
		try {
			let result = await this.migrateLegacyESRemarksForLibrary(libraryID);
			Services.prompt.alert(
				window,
				"Migrate ES Remarks",
				`Library: ${libraryID}\n` +
					`Scanned regular items: ${result.scanned}\n` +
					`Already compatible: ${result.alreadyCompatible}\n` +
					`Migrated from legacy notes: ${result.migrated}\n` +
					`Errors: ${result.errors}`
			);
		}
		catch (error) {
			Zotero.logError(error);
			Services.prompt.alert(window, "Migrate ES Remarks Failed", String(error?.message || error));
		}
		finally {
			this.setRemarkMigrationBusy(window, false);
		}
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
				l10nID: "paper-relations-topic-context-header",
				icon: "chrome://zotero/skin/itempane/16/related.svg",
			},
			sidenav: {
				l10nID: "paper-relations-topic-context-sidenav",
				icon: "chrome://zotero/skin/itempane/20/related.svg",
			},
			onInit: ({ doc, body, refresh }) => {
				let win = doc.defaultView;
				let listener = () => refresh();
				win.addEventListener("paper-relations:graph-context-changed", listener);
				this.topicContextSectionListeners.set(body, { win, listener });
			},
			onDestroy: ({ body }) => {
				let data = this.topicContextSectionListeners.get(body);
				if (!data) return;
				data.win.removeEventListener("paper-relations:graph-context-changed", data.listener);
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
				buttonWrap.className = "paper-relations-pane-actions";
				let isMigrationBusy = this.isRemarkMigrationBusy(win);
				const createTopicBtn = doc.createElementNS(XHTML_NS, "button");
				createTopicBtn.type = "button";
				createTopicBtn.className = "paper-relations-create-topic-btn";
				createTopicBtn.textContent = "Create topic from selected paper";
				createTopicBtn.disabled = !item || isMigrationBusy;
				createTopicBtn.addEventListener("click", () => {
					this.promptCreateTopicFromItem(win, item).catch((error) => Zotero.logError(error));
				});
				const removeTopicBtn = doc.createElementNS(XHTML_NS, "button");
				removeTopicBtn.type = "button";
				removeTopicBtn.className = "paper-relations-remove-topic-btn";
				removeTopicBtn.textContent = "Remove topic";
				removeTopicBtn.disabled = !this.canRemoveActiveTopic(win) || isMigrationBusy;
				removeTopicBtn.addEventListener("click", () => {
					this.promptRemoveActiveTopic(win, item).catch((error) => Zotero.logError(error));
				});
				const migrateRemarkBtn = doc.createElementNS(XHTML_NS, "button");
				migrateRemarkBtn.type = "button";
				migrateRemarkBtn.className = "paper-relations-remove-topic-btn";
				migrateRemarkBtn.textContent = isMigrationBusy
					? "Migrating ES Remarks..."
					: "Migrate ES Remarks (one-time)";
				migrateRemarkBtn.disabled = isMigrationBusy;
				migrateRemarkBtn.addEventListener("click", () => {
					this.promptMigrateESRemarks(win, item).catch((error) => Zotero.logError(error));
				});
				buttonWrap.append(createTopicBtn, removeTopicBtn, migrateRemarkBtn);

				body.append(title, desc, list, buttonWrap);
			},
		});

		Zotero.ItemPaneManager.registerSection({
			paneID: this.selectionDebugSectionID,
			pluginID: this.id,
			header: {
				l10nID: "paper-relations-selection-debug-header",
				icon: "chrome://zotero/skin/itempane/16/info.svg",
			},
			sidenav: {
				l10nID: "paper-relations-selection-debug-sidenav",
				icon: "chrome://zotero/skin/itempane/20/info.svg",
			},
			onInit: ({ doc, body, refresh }) => {
				let win = doc.defaultView;
				let listener = () => refresh();
				win.addEventListener("paper-relations:graph-selection-changed", listener);
				this.selectionDebugSectionListeners.set(body, { win, listener });
			},
			onDestroy: ({ body }) => {
				let data = this.selectionDebugSectionListeners.get(body);
				if (!data) return;
				data.win.removeEventListener("paper-relations:graph-selection-changed", data.listener);
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
			state.svg?.removeEventListener("wheel", state.handlers.wheel);
			state.svg?.removeEventListener("mousedown", state.handlers.mousedown);
			state.svg?.removeEventListener("contextmenu", state.handlers.contextmenu);
			window.removeEventListener("mousemove", state.handlers.mousemove);
			window.removeEventListener("mouseup", state.handlers.mouseup);
			window.removeEventListener("keydown", state.handlers.keydown);
			window.removeEventListener("keyup", state.handlers.keyup);
			window.removeEventListener("blur", state.handlers.blur);
			state.canvas?.removeEventListener("dragover", state.handlers.dragover);
			state.canvas?.removeEventListener("drop", state.handlers.drop);
			state.canvas?.removeEventListener("dragleave", state.handlers.dragleave);
			state.pinButton?.removeEventListener("mousedown", state.handlers.controlmousedown);
			state.snapButton?.removeEventListener("mousedown", state.handlers.controlmousedown);
			state.pinButton?.removeEventListener("click", state.handlers.pinbtnclick);
			state.snapButton?.removeEventListener("click", state.handlers.snapbtnclick);
			window.removeEventListener("resize", state.handlers.resize);
			state.pinCheckbox?.removeEventListener("change", state.handlers.pinchange);
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
		this.unregisterRemarkIntegration();
	},

	async main() {
		this.registerRemarkIntegration();
		this.registerItemPaneSections();

		let host = new URL("https://foo.com/path").host;
		this.log(`Host is ${host}`);
	},
};


Object.assign(PaperRelations, PaperRelationsStorageMixin, PaperRelationsGraphWorkspaceMixin);

