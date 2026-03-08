---
name: paper-connections-zotero-screenshot
description: Capture and inspect Zotero UI state on Windows, including independent dialogs and configuration windows such as Plugins Manager and Preferences. Use when Codex needs a reliable Zotero screenshot, needs to enumerate all live Zotero windows, or needs to debug window-targeted capture without brittle title-only matching.
---

# Paper Connections Zotero Screenshot

Use this skill when Zotero UI validation depends on real screenshots or on a reliable list of live Zotero windows.

## Workflow

1. Run `scripts/zotero_screenshot.py --list-windows` first when the target UI is unclear.
2. Use the default capture with no extra flags to save every visible Zotero top-level window into `tools/screenshots/`.
3. Use `--window-query <text>` to narrow within Zotero windows by title or class, for example `Plugins` or `Preferences`.
4. Use `--single-window` only when one best-match window is enough.
5. Use `--full-screen` only when window capture itself is the thing being debugged.

## Commands

- List current Zotero windows:
  `python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py --list-windows`
- Capture every current Zotero window:
  `python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py`
- Capture a specific dialog:
  `python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py --window-query Plugins`
- Capture only one best-match window:
  `python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py --single-window`

## Notes

- The matcher scopes to `zotero.exe` processes and their descendants before applying any optional title or class filter.
- The default output location is the repo-local `tools/screenshots/` folder.
- The default capture saves every visible Zotero top-level window, which is better for debugging multi-window UI state.
- Single-window selection prefers the foreground Zotero root window, then owned or dialog windows, then larger visible candidates.
- Compatibility wrappers still exist at `tools/screenshot.py`, `tools/screenshot_server.py`, and `tools/windows_capture.py`, but keep the skill scripts as the source of truth.
- Read [references/cli-usage.md](references/cli-usage.md) only when exact flag behavior or output naming details matter.
