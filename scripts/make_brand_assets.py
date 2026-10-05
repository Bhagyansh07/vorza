"""Generate Vorza's raster brand assets from the app's own design tokens.

Why this exists
---------------
The product is dark-only and its accent was retuned from stock shadcn violet
(`258 90% 70%`) to cyan `190 72% 52%` so that focus rings and selection states
would not fight the health-score palette. That retune did not reach the icons,
which left `favicon.svg` advertising a violet brand while the running app was
cyan. Hardcoding colours in three places is what caused the drift, so this
script owns them: edit the token constants below and every raster asset follows.

It also produces `og-image.png`, which was previously referenced by nothing.
Pointing `og:image` at a file that does not exist is worse than omitting the
tag, and a placeholder graphic would have been dishonest about the product, so
the card is drawn from the real `d3-force` layout style the graph view uses.

Everything is rendered with Pillow only. No network, no font files, no ImageMagick.

Run:  backend/.venv/Scripts/python.exe scripts/make_brand_assets.py
"""

from __future__ import annotations

import colorsys
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public"

# ---------------------------------------------------------------------------
# Tokens, mirrored from frontend/src/index.css and frontend/tailwind.config.ts.
# --panel was removed from the Tailwind colour theme because it shadowed the
# `panel` box shadow, so these are the resolved RGB values rather than HSL.
# ---------------------------------------------------------------------------
BACKGROUND = (11, 13, 20)  # --background  224 32% 6%
SURFACE = (22, 26, 38)  # --surface     224 26% 10%
RAISED = (45, 48, 62)  # --raised      224 22% 18%
LINE = (56, 60, 76)  # --line        220 16% 22%
INK = (245, 247, 250)  # --ink         210 40% 96%
INK_DIM = (168, 176, 190)  # --ink-muted
PRIMARY = (49, 199, 220)  # --primary     190 72% 52%
SIGNAL_GOOD = (52, 199, 123)
SIGNAL_WARN = (240, 170, 50)
SIGNAL_BAD = (235, 84, 104)

OG_SIZE = (1200, 630)
WORDMARK_FONT_SIZE = 104
TAGLINE_FONT_SIZE = 30
FEATURE_FONT_SIZE = 24
DETAIL_FONT_SIZE = 21


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """DejaVuSans ships inside Pillow, so there is no font file to vendor."""
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    try:
        return ImageFont.truetype(name, size)
    except OSError:
        return ImageFont.load_default(size)


def hsl(h: float, s: float, lightness: float) -> tuple[int, int, int]:
    r, g, b = colorsys.hls_to_rgb(h / 360.0, lightness / 100.0, s / 100.0)
    return (int(r * 255), int(g * 255), int(b * 255))


# ---------------------------------------------------------------------------
# Shared graph motif
# ---------------------------------------------------------------------------


def force_layout(
    seed: int = 20260914,
    count: int = 34,
    steps: int = 260,
) -> tuple[list[dict[str, float]], list[tuple[int, int]]]:
    """A small force-directed layout in the unit square.

    Same simulation the graph view runs (repulsion, link springs, centring,
    velocity damping), so the picture is an honest sample of the product's own
    output rather than decoration.
    """
    rnd = random.Random(seed)
    nodes: list[dict[str, float]] = [
        {
            "x": rnd.uniform(0, 1),
            "y": rnd.uniform(0, 1),
            "vx": 0.0,
            "vy": 0.0,
            # Health picks the colour, size picks the radius -- the same mapping
            # the graph view uses, so red here really means "red there".
            "health": rnd.uniform(0.35, 1.0),
            "weight": rnd.uniform(0.2, 1.0),
        }
        for _ in range(count)
    ]

    edges: set[tuple[int, int]] = set()
    for index in range(count):
        for _ in range(rnd.randint(1, 3)):
            edges.add(tuple(sorted((index, rnd.randrange(count)))))  # type: ignore[arg-type]
    edges.discard(tuple(sorted((index, index))))  # type: ignore[arg-type]

    for _ in range(steps):
        for i, a in enumerate(nodes):
            for j in range(i + 1, len(nodes)):
                b = nodes[j]
                dx = a["x"] - b["x"]
                dy = a["y"] - b["y"]
                distance2 = dx * dx + dy * dy + 0.004
                force = (0.00016 / distance2) * 60
                a["vx"] += dx * force
                a["vy"] += dy * force
                b["vx"] -= dx * force
                b["vy"] -= dy * force
        for a_id, b_id in edges:
            a, b = nodes[a_id], nodes[b_id]
            dx = a["x"] - b["x"]
            dy = a["y"] - b["y"]
            a["vx"] -= dx * 0.006
            a["vy"] -= dy * 0.006
            b["vx"] += dx * 0.006
            b["vy"] += dy * 0.006
        for node in nodes:
            node["vx"] += (0.5 - node["x"]) * 0.004
            node["vy"] += (0.5 - node["y"]) * 0.004
            node["vx"] *= 0.82
            node["vy"] *= 0.82
            node["x"] = min(1.0, max(0.0, node["x"] + node["vx"]))
            node["y"] = min(1.0, max(0.0, node["y"] + node["vy"]))

    return nodes, sorted(edges)


def health_color(health: float) -> tuple[int, int, int]:
    if health >= 0.7:
        return SIGNAL_GOOD
    if health >= 0.45:
        return SIGNAL_WARN
    return SIGNAL_BAD


def draw_graph(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    *,
    seed: int = 20260914,
    line_color: tuple[int, int, int] = LINE,
    glow: bool = False,
) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    nodes, edges = force_layout(seed=seed)

    for a_id, b_id in edges:
        a, b = nodes[a_id], nodes[b_id]
        draw.line(
            (
                left + a["x"] * width,
                top + a["y"] * height,
                left + b["x"] * width,
                top + b["y"] * height,
            ),
            fill=line_color,
            width=2,
        )

    for node in nodes:
        cx = left + node["x"] * width
        cy = top + node["y"] * height
        radius = 6 + node["weight"] * 12
        color = health_color(node["health"])
        if glow:
            # A soft halo so the nodes read as lit rather than pasted on.
            for step in range(3, 0, -1):
                halo = radius * (1 + step * 0.28)
                draw.ellipse(
                    (cx - halo, cy - halo, cx + halo, cy + halo),
                    fill=blend(BACKGROUND, color, 0.06),
                )
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=color)


def blend(base: tuple[int, int, int], over: tuple[int, int, int], alpha: float):
    return tuple(int(base[i] + (over[i] - base[i]) * alpha) for i in range(3))


# ---------------------------------------------------------------------------
# Open Graph card
# ---------------------------------------------------------------------------


def build_og_image() -> Path:
    img = Image.new("RGB", OG_SIZE, BACKGROUND)
    draw = ImageDraw.Draw(img)

    # A vertical ramp, so the card is not a flat rectangle when a client renders
    # it against a white page.
    for y in range(OG_SIZE[1]):
        t = y / OG_SIZE[1]
        draw.line(
            (0, y, OG_SIZE[0], y),
            fill=blend(BACKGROUND, SURFACE, t * 0.6),
        )

    draw.rectangle((0, 0, OG_SIZE[0], 6), fill=PRIMARY)
    draw_graph(draw, (690, 96, 1140, 552), glow=True)

    draw.text((90, 150), "Vorza", font=_font(WORDMARK_FONT_SIZE, bold=True), fill=INK)
    draw.rectangle((90, 274, 168, 280), fill=PRIMARY)

    draw.text(
        (90, 306),
        "The living, AI-reviewed map of your codebase.",
        font=_font(TAGLINE_FONT_SIZE),
        fill=INK_DIM,
    )

    # Feature strip, using the product's own vocabulary.
    y = 402
    for label, detail in (
        ("Force-directed", "every file is a node"),
        ("Health scored", "complexity + churn"),
        ("PR reviewed", "flags, not vibes"),
    ):
        draw.ellipse((92, y + 9, 102, y + 19), fill=PRIMARY)
        draw.text((120, y), label, font=_font(FEATURE_FONT_SIZE, bold=True), fill=INK)
        label_width = draw.textlength(label, font=_font(FEATURE_FONT_SIZE, bold=True))
        draw.text(
            (120 + label_width + 24, y + 3), detail, font=_font(DETAIL_FONT_SIZE), fill=INK_DIM
        )
        y += 46

    out = PUBLIC / "og-image.png"
    img.save(out, format="PNG", optimize=True)
    return out


# ---------------------------------------------------------------------------
# App icons
# ---------------------------------------------------------------------------


def build_icon(size: int, *, maskable: bool = False) -> Path:
    """The mark: a node cluster on a rounded, near-black plate.

    Maskable icons get their art scaled into the inner 80% safe zone, because
    Android will crop a full-bleed square to whatever shape the launcher uses
    and anything outside that circle can be cut away.
    """
    scale = 4  # supersample, then downscale, so the circles have no jaggies
    side = size * scale
    img = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(side * (0.5 if maskable else 0.22))
    plate = BACKGROUND + (255,)
    draw.rounded_rectangle((0, 0, side - 1, side - 1), radius=radius, fill=plate)

    # Accent hairline along the top edge, the same cue as the OG card.
    draw.rounded_rectangle(
        (0, 0, side - 1, int(side * 0.035)),
        radius=radius,
        fill=PRIMARY + (255,),
    )

    inset = side * (0.30 if maskable else 0.20)
    draw_graph(
        draw,
        (int(inset), int(inset), int(side - inset), int(side - inset)),
        seed=7,
        line_color=RAISED,
        glow=not maskable,
    )

    out = img.resize((size, size), Image.LANCZOS)
    name = f"icon-maskable-{size}.png" if maskable else f"icon-{size}.png"
    path = PUBLIC / name
    out.save(path, format="PNG", optimize=True)
    return path


def build_apple_touch_icon() -> Path:
    """iOS does not apply transparency, so this one is filled solid."""
    side = 180 * 4
    img = Image.new("RGB", (side, side), BACKGROUND)
    draw = ImageDraw.Draw(img)
    inset = side * 0.22
    draw_graph(
        draw,
        (int(inset), int(inset), int(side - inset), int(side - inset)),
        seed=7,
        line_color=RAISED,
        glow=True,
    )
    out = img.resize((180, 180), Image.LANCZOS)
    path = PUBLIC / "apple-touch-icon.png"
    out.save(path, format="PNG", optimize=True)
    return path


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    written = [build_og_image(), build_icon(192), build_icon(512), build_icon(512, maskable=True), build_apple_touch_icon()]
    for path in written:
        print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} kB)")


if __name__ == "__main__":
    main()