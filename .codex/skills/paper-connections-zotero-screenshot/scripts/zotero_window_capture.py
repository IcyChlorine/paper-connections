#!/usr/bin/env python3
"""
Windows window discovery and capture helpers for robust Zotero screenshots.
"""

from __future__ import annotations

import ctypes
import os
import re
from ctypes import wintypes
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from typing import Dict, Iterable, List, Sequence


DEFAULT_PROCESS_QUERY = "zotero"
SCREENSHOT_DIRNAME = "screenshots"
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
TH32CS_SNAPPROCESS = 0x00000002
GA_ROOTOWNER = 3
GW_OWNER = 4
BI_RGB = 0
DIB_RGB_COLORS = 0
SRCCOPY = 0x00CC0020
PW_RENDERFULLCONTENT = 0x00000002
DWMWA_CLOAKED = 14
MAX_PATH = 260
INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value


def _dpi_awareness_context(value: int) -> ctypes.c_void_p:
    mask = (1 << (ctypes.sizeof(ctypes.c_void_p) * 8)) - 1
    return ctypes.c_void_p(value & mask)


def _enable_per_monitor_dpi_awareness() -> None:
    if os.name != "nt":
        return

    user32 = ctypes.windll.user32

    try:
        set_context = user32.SetProcessDpiAwarenessContext
        set_context.argtypes = [ctypes.c_void_p]
        set_context.restype = wintypes.BOOL
        if set_context(_dpi_awareness_context(-4)):
            return
    except Exception:
        pass

    try:
        shcore = ctypes.windll.shcore
        set_awareness = shcore.SetProcessDpiAwareness
        set_awareness.argtypes = [ctypes.c_int]
        set_awareness.restype = ctypes.c_long
        result = int(set_awareness(2))
        if result in (0, 0x80070005):
            return
    except Exception:
        pass

    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass


_enable_per_monitor_dpi_awareness()


@dataclass
class ProcessInfo:
    pid: int
    parent_pid: int
    name: str
    path: str = ""

    @property
    def name_lower(self) -> str:
        return (self.name or "").lower()


@dataclass
class WindowInfo:
    hwnd: int
    pid: int
    process_name: str
    process_path: str
    owner_hwnd: int
    root_owner_hwnd: int
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

    @property
    def label(self) -> str:
        if self.title:
            return self.title
        if self.class_name:
            return self.class_name
        return f"hwnd-{self.hwnd}"


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


class _PROCESSENTRY32W(ctypes.Structure):
    _fields_ = [
        ("dwSize", wintypes.DWORD),
        ("cntUsage", wintypes.DWORD),
        ("th32ProcessID", wintypes.DWORD),
        ("th32DefaultHeapID", ctypes.c_size_t),
        ("th32ModuleID", wintypes.DWORD),
        ("cntThreads", wintypes.DWORD),
        ("th32ParentProcessID", wintypes.DWORD),
        ("pcPriClassBase", wintypes.LONG),
        ("dwFlags", wintypes.DWORD),
        ("szExeFile", wintypes.WCHAR * MAX_PATH),
    ]


def _repo_root() -> str:
    path = os.path.abspath(__file__)
    for _ in range(5):
        path = os.path.dirname(path)
    return path


def _screenshots_dir() -> str:
    return os.path.join(_repo_root(), "tools", SCREENSHOT_DIRNAME)


def _to_text(buf) -> str:
    return str(buf.value or "").strip()


def _normalize_query(value: str | None) -> str:
    return (value or "").strip().lower()


def _normalized_process_aliases(process_query: str | None) -> set[str]:
    query = _normalize_query(process_query)
    if not query:
        return set()
    aliases = {query}
    if query.endswith(".exe"):
        aliases.add(query[:-4])
    else:
        aliases.add(f"{query}.exe")
    return aliases


def _window_filter_text(window_query: str | None, process_query: str | None) -> str:
    query = _normalize_query(window_query)
    if not query:
        return ""
    if query in _normalized_process_aliases(process_query):
        return ""
    return query


def _slugify(text: str) -> str:
    lowered = (text or "").strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered)
    slug = slug.strip("-")
    return slug or "window"


@lru_cache(maxsize=1)
def _build_process_table() -> Dict[int, ProcessInfo]:
    if os.name != "nt":
        return {}

    kernel32 = ctypes.windll.kernel32
    snapshot = kernel32.CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
    if snapshot == INVALID_HANDLE_VALUE:
        raise ctypes.WinError()

    table: Dict[int, ProcessInfo] = {}
    entry = _PROCESSENTRY32W()
    entry.dwSize = ctypes.sizeof(_PROCESSENTRY32W)
    try:
        has_entry = kernel32.Process32FirstW(snapshot, ctypes.byref(entry))
        while has_entry:
            pid = int(entry.th32ProcessID)
            table[pid] = ProcessInfo(
                pid=pid,
                parent_pid=int(entry.th32ParentProcessID),
                name=str(entry.szExeFile or ""),
            )
            has_entry = kernel32.Process32NextW(snapshot, ctypes.byref(entry))
    finally:
        kernel32.CloseHandle(snapshot)
    return table


@lru_cache(maxsize=512)
def _query_process_path(pid: int) -> str:
    if os.name != "nt":
        return ""

    kernel32 = ctypes.windll.kernel32
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        return ""

    try:
        size = wintypes.DWORD(32768)
        buffer = ctypes.create_unicode_buffer(size.value)
        success = kernel32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size))
        if not success:
            return ""
        return buffer.value
    finally:
        kernel32.CloseHandle(handle)


def _is_window_cloaked(hwnd: int) -> bool:
    if os.name != "nt":
        return False
    try:
        cloaked = wintypes.DWORD(0)
        result = ctypes.windll.dwmapi.DwmGetWindowAttribute(
            wintypes.HWND(hwnd),
            DWMWA_CLOAKED,
            ctypes.byref(cloaked),
            ctypes.sizeof(cloaked),
        )
        return result == 0 and bool(cloaked.value)
    except Exception:
        return False


def _expand_descendant_pids(process_table: Dict[int, ProcessInfo], seed_pids: Iterable[int]) -> set[int]:
    expanded = {int(pid) for pid in seed_pids}
    changed = True
    while changed:
        changed = False
        for proc in process_table.values():
            if proc.parent_pid in expanded and proc.pid not in expanded:
                expanded.add(proc.pid)
                changed = True
    return expanded


def _matching_process_pids(process_query: str = DEFAULT_PROCESS_QUERY) -> set[int]:
    process_table = _build_process_table()
    if not process_query:
        return set(process_table.keys())

    query = _normalize_query(process_query)
    aliases = _normalized_process_aliases(process_query)
    seed_pids = set()
    for proc in process_table.values():
        name = proc.name_lower
        if name in aliases or query in name:
            seed_pids.add(proc.pid)
    return _expand_descendant_pids(process_table, seed_pids)


def list_visible_windows(
    process_ids: Sequence[int] | None = None,
    include_titleless: bool = False,
) -> List[WindowInfo]:
    if os.name != "nt":
        return []

    user32 = ctypes.windll.user32
    process_table = _build_process_table()
    process_id_filter = {int(pid) for pid in process_ids} if process_ids else None
    windows: List[WindowInfo] = []

    enum_proc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

    def _callback(hwnd, _lparam):
        hwnd = int(hwnd)
        if not user32.IsWindowVisible(hwnd):
            return True
        if user32.IsIconic(hwnd):
            return True
        if _is_window_cloaked(hwnd):
            return True

        rect = _RECT()
        if not user32.GetWindowRect(wintypes.HWND(hwnd), ctypes.byref(rect)):
            return True
        left = int(rect.left)
        top = int(rect.top)
        right = int(rect.right)
        bottom = int(rect.bottom)
        if right <= left or bottom <= top:
            return True

        pid = wintypes.DWORD(0)
        user32.GetWindowThreadProcessId(wintypes.HWND(hwnd), ctypes.byref(pid))
        pid_value = int(pid.value)
        if process_id_filter is not None and pid_value not in process_id_filter:
            return True

        title_len = int(user32.GetWindowTextLengthW(wintypes.HWND(hwnd)))
        title_buf = ctypes.create_unicode_buffer(title_len + 1 if title_len > 0 else 1)
        user32.GetWindowTextW(wintypes.HWND(hwnd), title_buf, len(title_buf))
        title = _to_text(title_buf)
        if not title and not include_titleless:
            return True

        class_buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(wintypes.HWND(hwnd), class_buf, 256)
        class_name = _to_text(class_buf)

        process_info = process_table.get(pid_value)
        process_name = process_info.name if process_info else ""
        process_path = _query_process_path(pid_value)
        if process_info and not process_info.path and process_path:
            process_info.path = process_path

        owner_hwnd = int(user32.GetWindow(wintypes.HWND(hwnd), GW_OWNER) or 0)
        root_owner_hwnd = int(user32.GetAncestor(wintypes.HWND(hwnd), GA_ROOTOWNER) or hwnd)

        windows.append(
            WindowInfo(
                hwnd=hwnd,
                pid=pid_value,
                process_name=process_name,
                process_path=process_path,
                owner_hwnd=owner_hwnd,
                root_owner_hwnd=root_owner_hwnd,
                title=title,
                class_name=class_name,
                left=left,
                top=top,
                right=right,
                bottom=bottom,
            )
        )
        return True

    user32.EnumWindows(enum_proc(_callback), 0)
    return sorted(windows, key=lambda window: (window.area, bool(window.title)), reverse=True)


def _window_matches_query(window: WindowInfo, query: str) -> bool:
    if not query:
        return True
    haystack = f"{window.title} {window.class_name}".lower()
    return query in haystack


def _foreground_root_owner() -> int:
    if os.name != "nt":
        return 0
    user32 = ctypes.windll.user32
    foreground = int(user32.GetForegroundWindow() or 0)
    if not foreground:
        return 0
    return int(user32.GetAncestor(wintypes.HWND(foreground), GA_ROOTOWNER) or foreground)


def _window_priority(window: WindowInfo, foreground_root: int) -> tuple[int, int, int, int]:
    is_foreground = int(window.hwnd == foreground_root or window.root_owner_hwnd == foreground_root)
    is_dialog = int(bool(window.owner_hwnd) or "dialog" in window.class_name.lower())
    has_title = int(bool(window.title))
    return (is_foreground, is_dialog, has_title, window.area)


def format_window_line(window: WindowInfo) -> str:
    title = window.title or "<untitled>"
    return (
        f"hwnd={window.hwnd} pid={window.pid} owner={window.owner_hwnd} "
        f"rect=({window.left},{window.top},{window.right},{window.bottom}) "
        f"class={window.class_name or '<no-class>'} process={window.process_name or '<unknown>'} "
        f"title={title}"
    )


def find_zotero_windows(
    window_query: str = DEFAULT_PROCESS_QUERY,
    process_query: str = DEFAULT_PROCESS_QUERY,
    include_titleless: bool = False,
) -> List[WindowInfo]:
    process_ids = _matching_process_pids(process_query=process_query)
    matches = list_visible_windows(process_ids=sorted(process_ids), include_titleless=include_titleless)
    filter_text = _window_filter_text(window_query, process_query)
    if filter_text:
        matches = [window for window in matches if _window_matches_query(window, filter_text)]
    foreground_root = _foreground_root_owner()
    return sorted(matches, key=lambda window: _window_priority(window, foreground_root), reverse=True)


def find_windows(query: str = DEFAULT_PROCESS_QUERY) -> List[WindowInfo]:
    return find_zotero_windows(window_query=query, process_query=DEFAULT_PROCESS_QUERY)


def pick_best_window(
    window_query: str = DEFAULT_PROCESS_QUERY,
    process_query: str = DEFAULT_PROCESS_QUERY,
) -> WindowInfo | None:
    matches = find_zotero_windows(window_query=window_query, process_query=process_query)
    if not matches:
        return None
    return matches[0]


def capture_window_image(hwnd: int):
    """
    Capture a specific top-level window by HWND.
    Returns a PIL.Image.
    """
    from PIL import Image

    if os.name != "nt":
        raise RuntimeError("Window capture is only available on Windows.")

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
        return image.copy()
    finally:
        gdi32.SelectObject(mfc_dc, old_obj)
        gdi32.DeleteObject(bmp)
        gdi32.DeleteDC(mfc_dc)
        user32.ReleaseDC(wintypes.HWND(hwnd), hwnd_dc)


def resolve_default_output_path(prefix: str = "screenshot") -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    directory = _screenshots_dir()
    os.makedirs(directory, exist_ok=True)
    probe = os.path.join(directory, ".write_probe")
    with open(probe, "wb"):
        pass
    os.remove(probe)
    return os.path.join(directory, f"{prefix}_{timestamp}.png")


def capture_full_screen():
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
            import mss
            from PIL import Image

            with mss.mss() as sct:
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


def capture_prefer_window(
    window_query: str = DEFAULT_PROCESS_QUERY,
    process_query: str = DEFAULT_PROCESS_QUERY,
):
    matches = find_zotero_windows(window_query=window_query, process_query=process_query)
    for window in matches:
        try:
            image = capture_window_image(window.hwnd)
            method = (
                f"PrintWindow(hwnd={window.hwnd}, pid={window.pid}, title={window.title or '<untitled>'})"
            )
            return image, method, window
        except Exception:
            continue
    image, method = capture_full_screen()
    return image, method, None


def save_image(image, output_path: str) -> str:
    directory = os.path.dirname(output_path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    image.save(output_path, format="PNG")
    return output_path


def take_screenshot(
    output_path: str | None = None,
    window_query: str = DEFAULT_PROCESS_QUERY,
    prefer_window: bool = True,
    process_query: str = DEFAULT_PROCESS_QUERY,
) -> tuple[str, str]:
    target_path = output_path or resolve_default_output_path()
    if prefer_window:
        screenshot, method, _window = capture_prefer_window(
            window_query=window_query,
            process_query=process_query,
        )
    else:
        screenshot, method = capture_full_screen()

    if screenshot is None:
        raise RuntimeError("No screenshot library available (Pillow / mss / pyautogui).")

    save_image(screenshot, target_path)
    return target_path, method or "unknown"


def _multi_capture_path(base_output_path: str, index: int, window: WindowInfo) -> str:
    root, ext = os.path.splitext(base_output_path)
    if not ext:
        ext = ".png"
    slug = _slugify(window.label)
    return f"{root}__{index:02d}_{slug}{ext}"


def take_all_window_screenshots(
    output_path: str | None = None,
    window_query: str = DEFAULT_PROCESS_QUERY,
    process_query: str = DEFAULT_PROCESS_QUERY,
) -> List[tuple[str, str, WindowInfo]]:
    matches = find_zotero_windows(window_query=window_query, process_query=process_query)
    if not matches:
        raise RuntimeError(f"No Zotero windows matched query: {window_query}")

    base_output_path = output_path or resolve_default_output_path()
    results: List[tuple[str, str, WindowInfo]] = []
    for index, window in enumerate(matches, start=1):
        try:
            image = capture_window_image(window.hwnd)
        except Exception:
            continue
        target_path = _multi_capture_path(base_output_path, index, window)
        save_image(image, target_path)
        method = f"PrintWindow(hwnd={window.hwnd}, pid={window.pid}, title={window.title or '<untitled>'})"
        results.append((target_path, method, window))
    if not results:
        raise RuntimeError(f"Matched Zotero windows but failed to capture them for query: {window_query}")
    return results
