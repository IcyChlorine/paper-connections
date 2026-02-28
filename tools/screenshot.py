#!/usr/bin/env python3
"""
Screenshot tool for Claude Code.
Usage examples:
  python screenshot.py
  python screenshot.py --window-query Zotero
  python screenshot.py --full-screen
  python screenshot.py --list-windows
  python screenshot.py output.png
"""

import sys
import os
import argparse
import tempfile
from datetime import datetime

from windows_capture import pick_best_window, capture_window_image, find_windows


def _resolve_default_output_path():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    local_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
    fallback_dir = os.path.join(tempfile.gettempdir(), "paper-relations-screenshots")
    for directory in (local_dir, fallback_dir):
        try:
            os.makedirs(directory, exist_ok=True)
            probe = os.path.join(directory, ".write_probe")
            with open(probe, "wb"):
                pass
            os.remove(probe)
            return os.path.join(directory, f"screenshot_{timestamp}.png")
        except Exception:
            continue
    raise RuntimeError("No writable output directory available for screenshot.")


def _capture_full_screen():
    screenshot = None
    method = None

    # Method 1: PIL ImageGrab (Windows native, supports multi-monitor via all_screens=True)
    try:
        from PIL import ImageGrab

        screenshot = ImageGrab.grab(all_screens=True)
        method = "PIL.ImageGrab(full-screen)"
    except Exception as e:
        sys.stderr.write(f"PIL.ImageGrab failed: {e}\n")

    # Method 2: mss
    if screenshot is None:
        try:
            import mss
            from PIL import Image

            with mss.mss() as sct:
                mon = sct.monitors[0]
                raw = sct.grab(mon)
                screenshot = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
            method = "mss(full-screen)"
        except Exception as e:
            sys.stderr.write(f"mss failed: {e}\n")

    # Method 3: pyautogui
    if screenshot is None:
        try:
            import pyautogui

            screenshot = pyautogui.screenshot()
            method = "pyautogui(full-screen)"
        except Exception as e:
            sys.stderr.write(f"pyautogui failed: {e}\n")

    return screenshot, method


def _capture_prefer_window(window_query="Zotero"):
    if os.name == "nt":
        try:
            win = pick_best_window(window_query)
            if win:
                img = capture_window_image(win.hwnd)
                method = f"PrintWindow(hwnd={win.hwnd}, title={win.title})"
                return img, method
            sys.stderr.write(f"[screenshot] window not found by query: {window_query}\n")
        except Exception as e:
            sys.stderr.write(f"[screenshot] window capture failed: {e}\n")
    return _capture_full_screen()


def take_screenshot(output_path=None, window_query="Zotero", prefer_window=True):
    if output_path is None:
        output_path = _resolve_default_output_path()

    if prefer_window:
        screenshot, method = _capture_prefer_window(window_query=window_query)
    else:
        screenshot, method = _capture_full_screen()

    if screenshot is None:
        sys.stderr.write(
            "Error: no screenshot library worked. Install Pillow, mss, or pyautogui.\n"
        )
        sys.exit(1)

    screenshot.save(output_path, format="PNG")
    print(output_path)
    sys.stderr.write(f"[screenshot] saved via {method}: {output_path}\n")
    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Capture screenshot (prefer Zotero window).")
    parser.add_argument("output_path", nargs="?", default=None, help="Output PNG path")
    parser.add_argument(
        "--window-query",
        default="Zotero",
        help="Capture matching top-level window title/class first (default: Zotero)",
    )
    parser.add_argument(
        "--full-screen",
        action="store_true",
        help="Disable window targeting and force full-screen capture",
    )
    parser.add_argument(
        "--list-windows",
        action="store_true",
        help="List matched windows for --window-query and exit",
    )
    args = parser.parse_args()

    if args.list_windows:
        matches = find_windows(args.window_query)
        if not matches:
            print(f"No windows matched query: {args.window_query}")
            sys.exit(0)
        for win in matches:
            print(
                f"hwnd={win.hwnd} rect=({win.left},{win.top},{win.right},{win.bottom}) "
                f"class={win.class_name} title={win.title}"
            )
        sys.exit(0)

    take_screenshot(
        output_path=args.output_path,
        window_query=args.window_query,
        prefer_window=not args.full_screen,
    )
