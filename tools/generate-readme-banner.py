#!/usr/bin/env python3
"""
Generate the README banner title SVG.

Visual reference:
- Taichi README hero image usage in the official repo README:
  https://github.com/taichi-dev/taichi
- Raw README source showing the top banner image:
  https://raw.githubusercontent.com/taichi-dev/taichi/master/README.md

This script keeps the output self-contained by embedding the local icon SVG
as a data URI inside the generated banner.
"""

from __future__ import annotations

import argparse
import base64
from pathlib import Path
from xml.sax.saxutils import escape


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ICON = REPO_ROOT / "assets" / "paper-connections-svgrepo-com.svg"
DEFAULT_OUTPUT = REPO_ROOT / "assets" / "readme-banner-title.svg"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the README banner SVG.")
    parser.add_argument(
        "--title",
        default="Paper Connections",
        help="Banner title text.",
    )
    parser.add_argument(
        "--icon",
        type=Path,
        default=DEFAULT_ICON,
        help="Path to the source icon SVG.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Path to the generated banner SVG.",
    )
    return parser.parse_args()


def svg_to_data_uri(svg_path: Path) -> str:
    payload = svg_path.read_bytes()
    encoded = base64.b64encode(payload).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def build_svg(title: str, icon_uri: str) -> str:
    safe_title = escape(title)
    title_width = max(420, len(title) * 42)
    width = 280 + title_width
    height = 220
    icon_size = 124
    icon_x = 60
    icon_y = 48
    title_x = 220
    title_y = 118

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="banner-title">
  <title id="banner-title">{safe_title}</title>
  <defs>
    <linearGradient id="banner-accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00ACBA" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
    <linearGradient id="underline-accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00ACBA" />
      <stop offset="100%" stop-color="#7DD3FC" />
    </linearGradient>
    <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#0F172A" flood-opacity="0.10" />
    </filter>
  </defs>

  <rect width="{width}" height="{height}" fill="#FFFFFF" rx="24" ry="24" />

  <g filter="url(#soft-shadow)">
    <rect x="24" y="24" width="{width - 48}" height="{height - 48}" rx="22" ry="22" fill="#F8FAFC" />
  </g>

  <rect x="24" y="24" width="10" height="{height - 48}" rx="5" ry="5" fill="url(#banner-accent)" opacity="0.95" />

  <circle cx="{icon_x + icon_size / 2}" cy="{icon_y + icon_size / 2}" r="72" fill="#EAF8FA" />
  <circle cx="{icon_x + icon_size / 2}" cy="{icon_y + icon_size / 2}" r="58" fill="#FFFFFF" opacity="0.96" />
  <image href="{icon_uri}" x="{icon_x}" y="{icon_y}" width="{icon_size}" height="{icon_size}" />

  <text
    x="{title_x}"
    y="{title_y}"
    fill="#0F172A"
    font-family="'Avenir Next', 'Segoe UI', Helvetica, Arial, sans-serif"
    font-size="72"
    font-weight="800"
    letter-spacing="-1.4"
  >{safe_title}</text>

  <rect x="{title_x}" y="136" width="{min(title_width - 40, 420)}" height="8" rx="4" ry="4" fill="url(#underline-accent)" />

  <g fill="#94A3B8" opacity="0.55">
    <circle cx="{title_x + 8}" cy="166" r="4" />
    <circle cx="{title_x + 30}" cy="166" r="4" />
    <circle cx="{title_x + 52}" cy="166" r="4" />
  </g>
</svg>
"""


def main() -> int:
    args = parse_args()
    icon_path = args.icon.resolve()
    output_path = args.output.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    icon_uri = svg_to_data_uri(icon_path)
    svg = build_svg(args.title, icon_uri)
    output_path.write_text(svg, encoding="utf-8", newline="\n")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
