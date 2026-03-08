#!/usr/bin/env python3
"""
MCP screenshot server backed by the Paper Connections Zotero screenshot skill.
"""

from __future__ import annotations

import base64

from mcp.server.fastmcp import FastMCP

from zotero_window_capture import (
    DEFAULT_PROCESS_QUERY,
    find_zotero_windows,
    format_window_line,
    take_all_window_screenshots,
    take_screenshot as take_screenshot_path,
)


mcp = FastMCP("paper-connections-zotero-screenshot")


def _read_base64(path: str) -> str:
    with open(path, "rb") as handle:
        return base64.b64encode(handle.read()).decode()


@mcp.tool()
def take_screenshot(window_query: str = DEFAULT_PROCESS_QUERY, prefer_window: bool = False) -> str:
    """
    Capture Zotero screenshots and return the saved PNG path or paths.
    """
    if prefer_window:
        path, method = take_screenshot_path(window_query=window_query, prefer_window=True)
        return f"Screenshot saved: {path}\n(captured via {method})"

    results = take_all_window_screenshots(window_query=window_query)
    lines = []
    for path, method, window in results:
        lines.append(f"Screenshot saved: {path}\n(captured via {method})\n(matched {format_window_line(window)})")
    return "\n\n".join(lines)


@mcp.tool()
def take_screenshot_base64(window_query: str = DEFAULT_PROCESS_QUERY, prefer_window: bool = True) -> str:
    """
    Capture a Zotero screenshot and return an inline base64 PNG payload.
    """
    if not prefer_window:
        raise RuntimeError("take_screenshot_base64 only supports single-window capture; use take_screenshot for all Zotero windows.")
    path, _method = take_screenshot_path(window_query=window_query, prefer_window=prefer_window)
    return f"data:image/png;base64,{_read_base64(path)}"


@mcp.tool()
def list_windows(window_query: str = DEFAULT_PROCESS_QUERY) -> str:
    """
    List matched Zotero top-level windows.
    """
    matches = find_zotero_windows(window_query=window_query)
    if not matches:
        return f"No Zotero windows matched query: {window_query}"
    return "\n".join(format_window_line(window) for window in matches)


if __name__ == "__main__":
    mcp.run()
