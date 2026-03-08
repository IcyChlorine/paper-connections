#!/usr/bin/env python3
"""
Compatibility wrapper for the Paper Connections Zotero screenshot MCP server.
"""

from __future__ import annotations

import os
import sys


SKILL_SCRIPTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ".codex",
    "skills",
    "paper-connections-zotero-screenshot",
    "scripts",
)

if SKILL_SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SKILL_SCRIPTS_DIR)

from zotero_screenshot_server import list_windows, mcp, take_screenshot, take_screenshot_base64


if __name__ == "__main__":
    mcp.run()
