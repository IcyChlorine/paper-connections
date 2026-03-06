#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

command -v zip >/dev/null 2>&1 || { echo "zip is required"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq is required"; exit 1; }
command -v shasum >/dev/null 2>&1 || { echo "shasum is required"; exit 1; }

rm -rf build
mkdir build

cd src
zip -r ../build/paper-connections.xpi \
	bootstrap.js \
	locale \
	assets \
	storage.js \
	graph-workspace.js \
	graph-render.js \
	graph-interaction.js \
	graph-topic.js \
	graph-export.js \
	paper-connections.js \
	manifest.json \
	prefs.js \
	style.css
cd ../build

jq ".addons[\"paper-connections@example.com\"].updates[0].update_hash = \"sha256:`shasum -a 256 paper-connections.xpi | cut -d' ' -f1`\"" ../updates.json.tmpl > updates.json
