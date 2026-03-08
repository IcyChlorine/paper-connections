#!/usr/bin/env python3
"""
CLI entry point for robust Zotero screenshots.
"""

from __future__ import annotations

import argparse
import sys

from zotero_window_capture import (
    DEFAULT_PROCESS_QUERY,
    find_zotero_windows,
    format_window_line,
    take_all_window_screenshots,
    take_screenshot,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Capture Zotero screenshots by process-aware window targeting."
    )
    parser.add_argument("output_path", nargs="?", default=None, help="Output PNG path")
    parser.add_argument(
        "--window-query",
        default=DEFAULT_PROCESS_QUERY,
        help="Filter within Zotero windows by title/class (default: all Zotero windows)",
    )
    parser.add_argument(
        "--full-screen",
        action="store_true",
        help="Disable window targeting and force full-screen capture",
    )
    parser.add_argument(
        "--list-windows",
        action="store_true",
        help="List matched Zotero top-level windows and exit",
    )
    parser.add_argument(
        "--all-windows",
        action="store_true",
        help="Capture every matched Zotero top-level window into separate PNG files",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.list_windows:
        matches = find_zotero_windows(window_query=args.window_query)
        if not matches:
            print(f"No Zotero windows matched query: {args.window_query}")
            return 0
        for window in matches:
            print(format_window_line(window))
        return 0

    try:
        if args.all_windows:
            results = take_all_window_screenshots(
                output_path=args.output_path,
                window_query=args.window_query,
            )
            for output_path, method, window in results:
                print(output_path)
                sys.stderr.write(f"[screenshot] saved via {method}: {output_path}\n")
                sys.stderr.write(f"[screenshot] matched {format_window_line(window)}\n")
            return 0

        output_path, method = take_screenshot(
            output_path=args.output_path,
            window_query=args.window_query,
            prefer_window=not args.full_screen,
        )
    except Exception as error:
        sys.stderr.write(f"Error: {error}\n")
        return 1

    print(output_path)
    sys.stderr.write(f"[screenshot] saved via {method}: {output_path}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
