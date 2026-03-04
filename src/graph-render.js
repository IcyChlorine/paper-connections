var PaperRelationsGraphRenderMixin = {
	renderGraph(window) {
		let state = this.graphStates.get(window);
		if (!state) return;

		let { nodes, edges, edgesGroup, nodesGroup, overlayGroup } = state;
		let doc = window.document;
		const SVG_NS = "http://www.w3.org/2000/svg";

		edgesGroup.replaceChildren();
		nodesGroup.replaceChildren();
		overlayGroup.replaceChildren();

		for (let node of nodes) {
			let metrics = this.getNodeRenderMetrics(node);
			let width = metrics.width;
			let height = metrics.height;
			let labelLines = metrics.labelLines;
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

		if (state.edgeDraft?.startAnchor && state.edgeDraft?.pointer) {
			let draftEnd = state.edgeDraft.targetAnchor || state.edgeDraft.pointer;
			let draftPath = this.buildBezierPathByAnchors(
				state.edgeDraft.startAnchor,
				draftEnd,
			);
			if (draftPath) {
				let path = doc.createElementNS(SVG_NS, "path");
				path.setAttribute("class", "paper-relations-edge paper-relations-edge-draft");
				path.setAttribute("d", draftPath);
				if (state.edgeDraft.startAnchor.side === "right") {
					path.setAttribute("marker-end", "url(#paper-relations-arrow)");
				}
				else if (state.edgeDraft.startAnchor.side === "left") {
					path.setAttribute("marker-start", "url(#paper-relations-arrow)");
				}
				overlayGroup.appendChild(path);
			}
		}

		if (state.edgeCutDraft?.start && state.edgeCutDraft?.end) {
			let cutLine = doc.createElementNS(SVG_NS, "line");
			cutLine.setAttribute("class", "paper-relations-edge-cut-preview");
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
			scissorsGroup.setAttribute("class", "paper-relations-edge-cut-scissors");
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

		for (let node of nodes) {
			let group = doc.createElementNS(SVG_NS, "g");
			let selectedClass = state.selectedNodeID === node.id ? " selected" : "";
			let isRenamingNode = state.renamingNodeID === node.id;
			let renamingClass = isRenamingNode ? " renaming" : "";
			group.setAttribute("class", `paper-relations-node ${node.kind}${selectedClass}${renamingClass}`);
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

			let titleElem = null;
			let text = null;
			if (!isRenamingNode) {
				titleElem = doc.createElementNS(SVG_NS, "title");
				titleElem.textContent = node.label || "";

				text = doc.createElementNS(SVG_NS, "text");
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
			}

			let leftAnchor = doc.createElementNS(SVG_NS, "circle");
			leftAnchor.setAttribute("class", "paper-relations-node-anchor");
			leftAnchor.setAttribute("data-anchor-side", "left");
			leftAnchor.setAttribute("cx", "0");
			leftAnchor.setAttribute("cy", String(height / 2));
			leftAnchor.setAttribute("r", "4");
			if (this.isAnchorVisibleInState(state, node.id, "left")) {
				leftAnchor.classList.add("active");
			}

			let rightAnchor = doc.createElementNS(SVG_NS, "circle");
			rightAnchor.setAttribute("class", "paper-relations-node-anchor");
			rightAnchor.setAttribute("data-anchor-side", "right");
			rightAnchor.setAttribute("cx", String(width));
			rightAnchor.setAttribute("cy", String(height / 2));
			rightAnchor.setAttribute("r", "4");
			if (this.isAnchorVisibleInState(state, node.id, "right")) {
				rightAnchor.classList.add("active");
			}

			group.append(rect);
			if (titleElem) group.append(titleElem);
			if (text) group.append(text);
			group.append(leftAnchor, rightAnchor);
			nodesGroup.appendChild(group);
		}

		this.applyAnchorVisibilityToDOM(state);
		this.updateGraphTransform(state);
		this.updateCanvasControlsLayout(window);
		this.syncNodeRenameInputLayout(window);
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
		let curve = this.getBezierCurveByEndpoints(startX, startY, endX, endY);
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
		let fromWidth = Number.isFinite(fromNode.renderWidth) ? fromNode.renderWidth :
			(Number.isFinite(fromNode.width) ? fromNode.width : this.nodeDefaultWidth);
		let fromHeight = Number.isFinite(fromNode.renderHeight) ? fromNode.renderHeight :
			(Number.isFinite(fromNode.height) ? fromNode.height : this.nodeDefaultHeight);
		let toHeight = Number.isFinite(toNode.renderHeight) ? toNode.renderHeight :
			(Number.isFinite(toNode.height) ? toNode.height : this.nodeDefaultHeight);
		return this.getBezierCurveByEndpoints(
			fromNode.x + fromWidth,
			fromNode.y + fromHeight / 2,
			toNode.x,
			toNode.y + toHeight / 2,
		);
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

	doCutSegmentIntersectCurve(cutStart, cutEnd, curve, steps = 28) {
		if (!cutStart || !cutEnd || !curve) return false;
		let prev = curve.start;
		for (let i = 1; i <= steps; i++) {
			let t = i / steps;
			let curr = this.getPointOnCubicBezier(curve, t);
			if (this.doSegmentsIntersect(cutStart, cutEnd, prev, curr)) {
				return true;
			}
			prev = curr;
		}
		return false;
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
		let nodeElems = state.nodesGroup.querySelectorAll(".paper-relations-node[data-node-id]");
		for (let elem of nodeElems) {
			let nodeID = elem.getAttribute("data-node-id");
			for (let side of ["left", "right"]) {
				let anchor = elem.querySelector(`.paper-relations-node-anchor[data-anchor-side="${side}"]`);
				if (!anchor) continue;
				anchor.classList.toggle("active", this.isAnchorVisibleInState(state, nodeID, side));
			}
		}
	},

	getNodeAnchorPoint(node, side) {
		if (!node || (side !== "left" && side !== "right")) return null;
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
