# CLI Usage

## Defaults

- Default scope: all visible top-level windows owned by the `zotero.exe` process tree.
- Default capture mode: save every matched Zotero top-level window.
- Recommended first step: run the default capture first; use `--list-windows` only for query/debug investigation.
- Single-window choice: the foreground Zotero root window if available; otherwise the best remaining Zotero candidate.
- Default output directory: `tools/screenshots/` in the repo root.

## Common Commands

```powershell
python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py
python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py --window-query Plugins
python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py --single-window
python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py --list-windows
python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py --full-screen
```

## Flags

- `--window-query TEXT`: filter within Zotero windows by title or class. The default `Zotero` means "all Zotero windows" rather than a literal title filter.
- `--list-windows`: print the matched Zotero windows and exit; useful when target matching is unclear.
- default mode: capture every matched Zotero top-level window into separate PNG files.
- `--single-window`: capture only the best matched Zotero top-level window.
- `--full-screen`: bypass window targeting and capture the whole desktop.
- `OUTPUT_PATH`: optional base PNG path. In the default multi-window mode, the command appends `__NN_<slug>.png` per matched window.
