<h1 align="center">
  <img src="assets/paper-connections-svgrepo-com.svg" alt="Paper Connections icon" width="48" />
  Paper Connections
</h1>

<p align="center">A Zotero 7 plugin for building and browsing hand-crafted paper relation graphs.</p>

Paper Connections adds a relation graph workspace to Zotero so you can organize papers as nodes and edges, keep short paper remarks visible on nodes, and export the current topic as SVG or JSON.

## Highlights

- Build topic-centered paper relation graphs inside Zotero 7.
- Edit node labels from paper remarks and keep them synced in the graph.
- Create, bundle, cut, and export relations directly from the workspace.

## Documentation

- [Current feature baseline](doc/current-features.md)
- [Graph render / refresh API](doc/graph-render-refresh.md)
- [Storage model and CRUD API](doc/storage-crud.md)

## Development

For day-to-day development, load the plugin directly from source instead of reinstalling the XPI after every change.

One-time setup for a Zotero profile:

```powershell
.\tools\setup-dev-plugin.ps1 -ProfileName default -WhatIf
.\tools\setup-dev-plugin.ps1 -ProfileName default
```

Daily restart after code changes:

```powershell
.\tools\restart-zotero-dev.ps1 -ProfileName default
.\tools\restart-zotero-dev.ps1 -ProfileName develop -JsDebugger
```

`setup-dev-plugin.ps1` removes this plugin's installed XPI from the selected profile, writes an extension proxy file that points at the repo `src` directory, and clears the two `extensions.lastApp*` cache markers in that profile's `prefs.js`. `restart-zotero-dev.ps1` asks before closing any running Zotero instance and relaunches Zotero with `-p <ProfileName>` and `-purgecaches` by default so source changes are picked up reliably.

Keep packaged XPI builds for packaging and release verification:

```powershell
.\make-zips.ps1
```

Git Bash remains available as a fallback:

```bash
./make-zips.sh
```

Reference: [Setting Up a Plugin Development Environment](https://www.zotero.org/support/dev/client_coding/plugin_development#setting_up_a_plugin_development_environment).
