(function() {
	const PREF_KEY = "extensions.paper-connections.showSelectionDebugSection";

	function getStrings() {
		let locale = String(
			Zotero.locale
			|| Services.locale?.appLocaleAsBCP47
			|| Services.locale?.lastFallbackLocale
			|| "en-US"
		).toLowerCase();
		if (locale.startsWith("zh")) {
			return {
				title: "Paper Connections",
				label: "Show Selection Debug section in the right item panes",
				help: "Enable this to show the graph Selection Debug section in the right-side item panes.",
			};
		}
		return {
			title: "Paper Connections",
			label: "Show Selection Debug section in the right item panes",
			help: "Enable this to show the graph Selection Debug section in the right-side item panes.",
		};
	}

	function initPreferencesPane() {
		let checkbox = document.getElementById("show-selection-debug-section");
		if (!checkbox) return;

		let strings = getStrings();
		document.getElementById("paper-connections-pref-title").textContent = strings.title;
		document.getElementById("show-selection-debug-section-label").textContent = strings.label;
		document.getElementById("show-selection-debug-section-help").textContent = strings.help;

		checkbox.checked = Services.prefs.getBoolPref(PREF_KEY, false);
		checkbox.addEventListener("change", () => {
			Services.prefs.setBoolPref(PREF_KEY, checkbox.checked);
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initPreferencesPane, { once: true });
	}
	else {
		initPreferencesPane();
	}
})();
