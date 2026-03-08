#!/usr/bin/env python3
"""
Compatibility wrapper for the Paper Connections Zotero screenshot window helpers.
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

from zotero_window_capture import (
    WindowInfo,
    capture_window_image,
    find_windows,
    find_zotero_windows,
    format_window_line,
    list_visible_windows,
    pick_best_window,
)
