#!/usr/bin/env python3

from io import BytesIO
from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont


REPO_ROOT = Path(__file__).resolve().parent.parent
ICON_PATH = REPO_ROOT / "assets" / "paper-connections-svgrepo-com.svg"
OUTPUT_PATH = REPO_ROOT / "assets" / "readme-banner-title.png"
TITLE = "Paper Connections"
FONT_PATH = Path("C:/Windows/Fonts/candara.ttf")

# Layout params to tweak later.
BANNER_SIZE = (760, 190)
SVG_BOX = (44, 33, 124)   # x, y, size
TEXT_POS = (210, 98)      # x, baseline-y
FONT_SIZE = 56


def render_svg(svg_path: Path, size: int) -> Image.Image:
    svg_bytes = svg_path.read_bytes()
    doc = fitz.open("svg", svg_bytes)
    page = doc[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(4, 4), alpha=True)
    image = Image.open(BytesIO(pix.tobytes("png"))).convert("RGBA")
    return image.resize((size, size), Image.LANCZOS)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    if FONT_PATH.exists():
        return ImageFont.truetype(str(FONT_PATH), size=size)
    return ImageFont.load_default()


def main() -> None:
    width, height = BANNER_SIZE
    icon_x, icon_y, icon_size = SVG_BOX
    text_x, text_baseline = TEXT_POS

    banner = Image.new("RGBA", (width, height), "#FFFFFF")
    logo = render_svg(ICON_PATH, icon_size)
    banner.alpha_composite(logo, (icon_x, icon_y))

    draw = ImageDraw.Draw(banner)
    font = load_font(FONT_SIZE)
    ascent = font.getmetrics()[0] if hasattr(font, "getmetrics") else FONT_SIZE
    draw.text((text_x, text_baseline - ascent), TITLE, fill="#1F2937", font=font)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    banner.save(OUTPUT_PATH, format="PNG")
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
