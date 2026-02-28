#!/usr/bin/env python3
"""
Windows window discovery and capture helpers for screenshot tools.
"""

from __future__ import annotations

from dataclasses import dataclass
import ctypes
from ctypes import wintypes
from typing import List


@dataclass
class WindowInfo:
    hwnd: int
    title: str
    class_name: str
    left: int
    top: int
    right: int
    bottom: int

    @property
    def width(self) -> int:
        return max(0, self.right - self.left)

    @property
    def height(self) -> int:
        return max(0, self.bottom - self.top)

    @property
    def area(self) -> int:
        return self.width * self.height


class _RECT(ctypes.Structure):
    _fields_ = [
        ("left", wintypes.LONG),
        ("top", wintypes.LONG),
        ("right", wintypes.LONG),
        ("bottom", wintypes.LONG),
    ]


class _BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", wintypes.LONG),
        ("biHeight", wintypes.LONG),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", wintypes.LONG),
        ("biYPelsPerMeter", wintypes.LONG),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


class _RGBQUAD(ctypes.Structure):
    _fields_ = [
        ("rgbBlue", wintypes.BYTE),
        ("rgbGreen", wintypes.BYTE),
        ("rgbRed", wintypes.BYTE),
        ("rgbReserved", wintypes.BYTE),
    ]


class _BITMAPINFO(ctypes.Structure):
    _fields_ = [("bmiHeader", _BITMAPINFOHEADER), ("bmiColors", _RGBQUAD * 1)]


BI_RGB = 0
DIB_RGB_COLORS = 0
SRCCOPY = 0x00CC0020
PW_RENDERFULLCONTENT = 0x00000002


def _to_text(buf) -> str:
    return str(buf.value or "").strip()


def list_visible_windows() -> List[WindowInfo]:
    user32 = ctypes.windll.user32
    windows: List[WindowInfo] = []

    enum_proc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

    def _callback(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        text_len = user32.GetWindowTextLengthW(hwnd)
        if text_len <= 0:
            return True
        title_buf = ctypes.create_unicode_buffer(text_len + 1)
        user32.GetWindowTextW(hwnd, title_buf, text_len + 1)
        title = _to_text(title_buf)
        if not title:
            return True
        class_buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, class_buf, 256)
        class_name = _to_text(class_buf)
        rect = _RECT()
        if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            return True
        info = WindowInfo(
            hwnd=int(hwnd),
            title=title,
            class_name=class_name,
            left=int(rect.left),
            top=int(rect.top),
            right=int(rect.right),
            bottom=int(rect.bottom),
        )
        if info.area > 0:
            windows.append(info)
        return True

    user32.EnumWindows(enum_proc(_callback), 0)
    windows.sort(key=lambda w: w.area, reverse=True)
    return windows


def find_windows(query: str) -> List[WindowInfo]:
    q = (query or "").strip().lower()
    if not q:
        return list_visible_windows()
    matches = []
    for win in list_visible_windows():
        haystack = f"{win.title} {win.class_name}".lower()
        if q in haystack:
            matches.append(win)
    return matches


def pick_best_window(query: str = "zotero") -> WindowInfo | None:
    user32 = ctypes.windll.user32
    matches = find_windows(query)
    if not matches:
        return None
    foreground = int(user32.GetForegroundWindow() or 0)
    for win in matches:
        if win.hwnd == foreground:
            return win
    return matches[0]


def capture_window_image(hwnd: int):
    """
    Capture a specific top-level window by HWND.
    Returns a PIL.Image.
    """
    from PIL import Image

    user32 = ctypes.windll.user32
    gdi32 = ctypes.windll.gdi32

    rect = _RECT()
    if not user32.GetWindowRect(wintypes.HWND(hwnd), ctypes.byref(rect)):
        raise RuntimeError(f"GetWindowRect failed for hwnd={hwnd}")

    width = int(rect.right - rect.left)
    height = int(rect.bottom - rect.top)
    if width <= 0 or height <= 0:
        raise RuntimeError(f"Invalid window size for hwnd={hwnd}: {width}x{height}")

    hwnd_dc = user32.GetWindowDC(wintypes.HWND(hwnd))
    if not hwnd_dc:
        raise RuntimeError(f"GetWindowDC failed for hwnd={hwnd}")

    mfc_dc = gdi32.CreateCompatibleDC(hwnd_dc)
    if not mfc_dc:
        user32.ReleaseDC(wintypes.HWND(hwnd), hwnd_dc)
        raise RuntimeError(f"CreateCompatibleDC failed for hwnd={hwnd}")

    bmp = gdi32.CreateCompatibleBitmap(hwnd_dc, width, height)
    if not bmp:
        gdi32.DeleteDC(mfc_dc)
        user32.ReleaseDC(wintypes.HWND(hwnd), hwnd_dc)
        raise RuntimeError(f"CreateCompatibleBitmap failed for hwnd={hwnd}")

    old_obj = gdi32.SelectObject(mfc_dc, bmp)
    try:
        rendered = user32.PrintWindow(wintypes.HWND(hwnd), mfc_dc, PW_RENDERFULLCONTENT)
        if not rendered:
            gdi32.BitBlt(mfc_dc, 0, 0, width, height, hwnd_dc, 0, 0, SRCCOPY)

        bmp_info = _BITMAPINFO()
        bmp_info.bmiHeader.biSize = ctypes.sizeof(_BITMAPINFOHEADER)
        bmp_info.bmiHeader.biWidth = width
        # Negative height asks GDI for top-down pixels so PIL does not need flip.
        bmp_info.bmiHeader.biHeight = -height
        bmp_info.bmiHeader.biPlanes = 1
        bmp_info.bmiHeader.biBitCount = 32
        bmp_info.bmiHeader.biCompression = BI_RGB

        buf_len = width * height * 4
        pixel_buf = ctypes.create_string_buffer(buf_len)
        lines = gdi32.GetDIBits(
            mfc_dc,
            bmp,
            0,
            height,
            pixel_buf,
            ctypes.byref(bmp_info),
            DIB_RGB_COLORS,
        )
        if lines != height:
            raise RuntimeError(f"GetDIBits failed for hwnd={hwnd}, got {lines}/{height} lines")

        image = Image.frombuffer(
            "RGB",
            (width, height),
            pixel_buf,
            "raw",
            "BGRX",
            0,
            1,
        )
        # Detach from the temporary ctypes buffer before returning.
        return image.copy()
    finally:
        gdi32.SelectObject(mfc_dc, old_obj)
        gdi32.DeleteObject(bmp)
        gdi32.DeleteDC(mfc_dc)
        user32.ReleaseDC(wintypes.HWND(hwnd), hwnd_dc)
