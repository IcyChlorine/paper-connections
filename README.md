<p align="center">
  <img src="assets/paper-connection-svgrepo-com.svg" alt="Paper Connections icon" width="84" />
</p>

<h1 align="center">Paper Connections</h1>

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

Build with `./make-zips.sh` (Git Bash) or `./make-zips.ps1` (PowerShell), then install the generated XPI from Zotero's Add-ons window.

To run from source instead, see [Setting Up a Plugin Development Environment](https://www.zotero.org/support/dev/client_coding/plugin_development#setting_up_a_plugin_development_environment).