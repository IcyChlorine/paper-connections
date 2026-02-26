#!/usr/bin/env python3
"""
Screenshot MCP Server
Provides a 'take_screenshot' tool that captures the screen and returns
the image as base64, allowing Claude to see it directly via Read tool.
"""

import os
import base64
from datetime import datetime
from mcp.server.fastmcp import FastMCP

SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")

mcp = FastMCP("screenshot")


def _capture() -> tuple[str, str]:
    """Take a screenshot, save it, return (file_path, base64_png)."""
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(SCREENSHOTS_DIR, f"screenshot_{timestamp}.png")

    screenshot = None
    method = None

    try:
        from PIL import ImageGrab
        screenshot = ImageGrab.grab(all_screens=True)
        method = "PIL.ImageGrab"
    except Exception:
        pass

    if screenshot is None:
        try:
            import mss as mss_lib
            from PIL import Image
            with mss_lib.mss() as sct:
                raw = sct.grab(sct.monitors[0])
                screenshot = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
            method = "mss"
        except Exception:
            pass

    if screenshot is None:
        try:
            import pyautogui
            screenshot = pyautogui.screenshot()
            method = "pyautogui"
        except Exception:
            pass

    if screenshot is None:
        raise RuntimeError("No screenshot library available (Pillow / mss / pyautogui).")

    screenshot.save(output_path, format="PNG")

    with open(output_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    return output_path, b64, method


@mcp.tool()
def take_screenshot() -> str:
    """
    Capture the current screen (all monitors).
    Returns the absolute path of the saved PNG file.
    Use the Read tool on that path to view the image.
    """
    path, _b64, method = _capture()
    return f"Screenshot saved: {path}\n(captured via {method})"


@mcp.tool()
def take_screenshot_base64() -> str:
    """
    Capture the current screen and return the image as a base64-encoded PNG string.
    Useful when you want the image data inline rather than reading a file.
    """
    _path, b64, method = _capture()
    return f"data:image/png;base64,{b64}"


if __name__ == "__main__":
    mcp.run()
