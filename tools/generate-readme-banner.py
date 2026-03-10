#!/usr/bin/env python3
"""
Generate a minimal README banner image.

The visual structure is intentionally simple:
- logo on the left
- title text on the right

Unlike the previous generator, this script uses Pillow to compose the banner
on a raster canvas instead of hardcoding the full output SVG markup.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = REPO_ROOT / "assets" / "readme-banner-title.png"

FONT_REGULAR = Path("C:/Windows/Fonts/segoeui.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/segoeuib.ttf")

BG = "#FFFFFF"
TEXT = "#1F2937"
ACCENT = "#00ACBA"
ACCENT_DARK = "#0181B0"
DOT = "#F5D803"
RING = "#EAF8FA"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the README banner PNG.")
    parser.add_argument("--title", default="Paper Connections", help="Banner title text.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output PNG path.",
    )
    return parser.parse_args()


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    preferred = FONT_BOLD if bold else FONT_REGULAR
    if preferred.exists():
        return ImageFont.truetype(str(preferred), size=size)
    return ImageFont.load_default()


def draw_logo(draw: ImageDraw.ImageDraw, origin_x: int, origin_y: int, scale: float) -> None:
    cx = origin_x + 72 * scale
    cy = origin_y + 72 * scale

    # soft base ring
    draw.ellipse((cx - 66 * scale, cy - 66 * scale, cx + 66 * scale, cy + 66 * scale), fill=RING)
    draw.ellipse((cx - 52 * scale, cy - 52 * scale, cx + 52 * scale, cy + 52 * scale), fill=BG)

    # connectors
    draw.line((cx + 10 * scale, cy - 22 * scale, cx + 82 * scale, cy - 84 * scale), fill=ACCENT, width=max(2, int(7 * scale)))
    draw.line((cx + 12 * scale, cy + 22 * scale, cx + 82 * scale, cy + 82 * scale), fill=ACCENT, width=max(2, int(7 * scale)))
    draw.line((cx - 22 * scale, cy - 22 * scale, cx - 52 * scale, cy - 52 * scale), fill=ACCENT, width=max(2, int(6 * scale)))
    draw.line((cx - 22 * scale, cy + 22 * scale, cx - 52 * scale, cy + 52 * scale), fill=ACCENT, width=max(2, int(6 * scale)))
    draw.line((cx + 28 * scale, cy, cx + 70 * scale, cy), fill=ACCENT, width=max(2, int(6 * scale)))

    # center node
    draw.ellipse((cx - 24 * scale, cy - 24 * scale, cx + 24 * scale, cy + 24 * scale), fill=BG, outline=ACCENT_DARK, width=max(2, int(5 * scale)))

    # side nodes
    for px, py, radius in [
        (cx - 78 * scale, cy - 78 * scale, 18 * scale),
        (cx - 78 * scale, cy + 78 * scale, 18 * scale),
        (cx + 92 * scale, cy - 92 * scale, 14 * scale),
        (cx + 82 * scale, cy, 14 * scale),
        (cx + 92 * scale, cy + 92 * scale, 14 * scale),
    ]:
        draw.ellipse((px - radius, py - radius, px + radius, py + radius), fill=DOT)
        inner = radius * 0.45
        draw.ellipse((px - inner, py - inner, px + inner, py + inner), fill=BG)


def measure_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    return right - left, bottom - top


def build_banner(title: str) -> Image.Image:
    text_font = load_font(62, bold=False)
    label_font = load_font(20, bold=False)

    probe = Image.new("RGB", (1, 1), BG)
    probe_draw = ImageDraw.Draw(probe)
    title_w, title_h = measure_text(probe_draw, title, text_font)
    subtitle = "Zotero 7 plugin"
    sub_w, sub_h = measure_text(probe_draw, subtitle, label_font)

    width = max(760, 260 + title_w + 80)
    height = 210
    image = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(image)

    draw_logo(draw, origin_x=44, origin_y=33, scale=0.95)

    text_x = 220
    title_y = 72
    subtitle_y = title_y + title_h + 10
    draw.text((text_x, title_y), title, font=text_font, fill=TEXT)
    draw.text((text_x + 2, subtitle_y), subtitle, font=label_font, fill=ACCENT_DARK)

    underline_y = subtitle_y + sub_h + 16
    draw.rounded_rectangle((text_x, underline_y, text_x + max(160, sub_w + 20), underline_y + 6), radius=3, fill=ACCENT)
    return image


def main() -> int:
    args = parse_args()
    output_path = args.output
    if not output_path.is_absolute():
        output_path = REPO_ROOT / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    image = build_banner(args.title)
    image.save(output_path, format="PNG")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
