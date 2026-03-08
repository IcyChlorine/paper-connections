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
    take_screenshot as take_screenshot_path,
)


mcp = FastMCP("paper-connections-zotero-screenshot")


def _read_base64(path: str) -> str:
    with open(path, "rb") as handle:
        return base64.b64encode(handle.read()).decode()


@mcp.tool()
def take_screenshot(window_query: str = DEFAULT_PROCESS_QUERY, prefer_window: bool = True) -> str:
    """
    Capture a Zotero screenshot and return the saved PNG path.
    """
    path, method = take_screenshot_path(window_query=window_query, prefer_window=prefer_window)
    return f"Screenshot saved: {path}\n(captured via {method})"


@mcp.tool()
def take_screenshot_base64(window_query: str = DEFAULT_PROCESS_QUERY, prefer_window: bool = True) -> str:
    """
    Capture a Zotero screenshot and return an inline base64 PNG payload.
    """
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
