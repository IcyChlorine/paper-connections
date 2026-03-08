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

For day-to-day development on this machine, build the XPI, copy it straight into the target Zotero profile, and restart Zotero in one step.

Recommended daily workflow:

```powershell
.\tools\build-install-restart.ps1 -ProfileName default
.\tools\build-install-restart.ps1 -ProfileName develop -JsDebugger
```

`build-install-restart.ps1` asks for confirmation first, runs `.\make-zips.ps1`, closes any running Zotero instance, removes any leftover source-proxy file for this plugin, copies `build/paper-connections.xpi` into the selected profile's `extensions` directory as `paper-connections@example.com.xpi`, clears the two `extensions.lastApp*` cache markers in that profile's `prefs.js`, and relaunches Zotero with `-p <ProfileName>` and `-purgecaches` by default.

`restart-zotero-dev.ps1` remains available when you only want to relaunch Zotero without rebuilding or reinstalling the plugin:

```powershell
.\tools\restart-zotero-dev.ps1 -ProfileName default
```

Keep packaged XPI builds for packaging and release verification:

```powershell
.\make-zips.ps1
```

Git Bash remains available as a fallback:

```bash
./make-zips.sh
```

Reference: [Setting Up a Plugin Development Environment](https://www.zotero.org/support/dev/client_coding/plugin_development#setting_up_a_plugin_development_environment).
