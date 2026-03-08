---
name: paper-connections-zotero-screenshot
description: Capture and inspect Zotero UI state on Windows, including independent dialogs and configuration windows such as Plugins Manager and Preferences. Use when Codex needs a reliable Zotero screenshot, needs to enumerate all live Zotero windows, or needs to debug window-targeted capture without brittle title-only matching.
---

# Paper Connections Zotero Screenshot

Use this skill when Zotero UI validation depends on real screenshots or on a reliable list of live Zotero windows.

## Workflow

1. Run `scripts/zotero_screenshot.py --list-windows` first when the target UI is unclear.
2. Use the default capture with no extra flags when the currently focused Zotero window is the one to inspect.
3. Use `--window-query <text>` to narrow within Zotero windows by title or class, for example `Plugins` or `Preferences`.
4. Use `--all-windows` when Zotero may have multiple relevant top-level windows open.
5. Use `--full-screen` only when window capture itself is the thing being debugged.

## Commands

- List current Zotero windows:
  `python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py --list-windows`
- Capture the active or best Zotero window:
  `python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py`
- Capture a specific dialog:
  `python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py --window-query Plugins`
- Capture every matched Zotero top-level window:
  `python .codex/skills/paper-connections-zotero-screenshot/scripts/zotero_screenshot.py --all-windows`

## Notes

- The matcher scopes to `zotero.exe` processes and their descendants before applying any optional title or class filter.
- Window selection prefers the foreground Zotero root window, then owned or dialog windows, then larger visible candidates.
- Compatibility wrappers still exist at `tools/screenshot.py`, `tools/screenshot_server.py`, and `tools/windows_capture.py`, but keep the skill scripts as the source of truth.
- Read [references/cli-usage.md](references/cli-usage.md) only when exact flag behavior or output naming details matter.
