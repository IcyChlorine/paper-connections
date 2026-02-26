#!/usr/bin/env python3
"""
Screenshot tool for Claude Code.
Usage: python screenshot.py [output_path]
"""

import sys
import os
from datetime import datetime


def take_screenshot(output_path=None):
    screenshots_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
    os.makedirs(screenshots_dir, exist_ok=True)

    if output_path is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(screenshots_dir, f"screenshot_{timestamp}.png")

    screenshot = None
    method = None

    # Method 1: PIL ImageGrab (Windows native, supports multi-monitor via all_screens=True)
    try:
        from PIL import ImageGrab
        screenshot = ImageGrab.grab(all_screens=True)
        method = "PIL.ImageGrab"
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
            method = "mss"
        except Exception as e:
            sys.stderr.write(f"mss failed: {e}\n")

    # Method 3: pyautogui
    if screenshot is None:
        try:
            import pyautogui
            screenshot = pyautogui.screenshot()
            method = "pyautogui"
        except Exception as e:
            sys.stderr.write(f"pyautogui failed: {e}\n")

    if screenshot is None:
        sys.stderr.write("Error: no screenshot library worked. Install Pillow, mss, or pyautogui.\n")
        sys.exit(1)

    screenshot.save(output_path, format="PNG")
    print(output_path)
    sys.stderr.write(f"[screenshot] saved via {method}: {output_path}\n")
    return output_path


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else None
    take_screenshot(out)
