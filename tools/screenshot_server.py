#!/usr/bin/env python3
"""
Screenshot MCP Server
Provides a 'take_screenshot' tool that captures the screen/window and returns
the image as base64, allowing Claude to see it directly via Read tool.
"""

import os
import base64
import tempfile
from datetime import datetime
from mcp.server.fastmcp import FastMCP

from windows_capture import pick_best_window, capture_window_image, find_windows

SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")

mcp = FastMCP("screenshot")


def _resolve_default_output_path() -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    fallback_dir = os.path.join(tempfile.gettempdir(), "paper-relations-screenshots")
    for directory in (SCREENSHOTS_DIR, fallback_dir):
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

    try:
        from PIL import ImageGrab

        screenshot = ImageGrab.grab(all_screens=True)
        method = "PIL.ImageGrab(full-screen)"
    except Exception:
        pass

    if screenshot is None:
        try:
            import mss as mss_lib
            from PIL import Image

            with mss_lib.mss() as sct:
                raw = sct.grab(sct.monitors[0])
                screenshot = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
            method = "mss(full-screen)"
        except Exception:
            pass

    if screenshot is None:
        try:
            import pyautogui

            screenshot = pyautogui.screenshot()
            method = "pyautogui(full-screen)"
        except Exception:
            pass

    return screenshot, method


def _capture_prefer_window(window_query: str = "Zotero"):
    if os.name == "nt":
        try:
            win = pick_best_window(window_query)
            if win:
                return capture_window_image(win.hwnd), f"PrintWindow(hwnd={win.hwnd}, title={win.title})"
        except Exception:
            pass
    return _capture_full_screen()


def _capture(window_query: str = "Zotero", prefer_window: bool = True) -> tuple[str, str, str]:
    """Take a screenshot, save it, return (file_path, base64_png, method)."""
    output_path = _resolve_default_output_path()

    if prefer_window:
        screenshot, method = _capture_prefer_window(window_query=window_query)
    else:
        screenshot, method = _capture_full_screen()

    if screenshot is None:
        raise RuntimeError("No screenshot library available (Pillow / mss / pyautogui).")

    screenshot.save(output_path, format="PNG")

    with open(output_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    return output_path, b64, method


@mcp.tool()
def take_screenshot(window_query: str = "Zotero", prefer_window: bool = True) -> str:
    """
    Capture a screenshot.
    On Windows, it prefers matching window capture (default query: Zotero),
    then falls back to full-screen.
    Returns the absolute path of the saved PNG file.
    Use the Read tool on that path to view the image.
    """
    path, _b64, method = _capture(window_query=window_query, prefer_window=prefer_window)
    return f"Screenshot saved: {path}\n(captured via {method})"


@mcp.tool()
def take_screenshot_base64(window_query: str = "Zotero", prefer_window: bool = True) -> str:
    """
    Capture the current screen and return the image as a base64-encoded PNG string.
    Useful when you want the image data inline rather than reading a file.
    """
    _path, b64, method = _capture(window_query=window_query, prefer_window=prefer_window)
    return f"data:image/png;base64,{b64}"


@mcp.tool()
def list_windows(window_query: str = "Zotero") -> str:
    """
    List visible top-level windows matching title/class query.
    Useful for debugging window-targeted capture.
    """
    if os.name != "nt":
        return "Window listing is only available on Windows."
    matches = find_windows(window_query)
    if not matches:
        return f"No windows matched query: {window_query}"
    lines = []
    for win in matches:
        lines.append(
            f"hwnd={win.hwnd} rect=({win.left},{win.top},{win.right},{win.bottom}) "
            f"class={win.class_name} title={win.title}"
        )
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run()
