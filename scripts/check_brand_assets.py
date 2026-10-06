"""Pixel-level sanity checks for the regenerated brand assets."""
from pathlib import Path

from PIL import Image

PUBLIC = Path("frontend/public")


def sample(img: Image.Image, fx: float, fy: float):
    w, h = img.size
    return img.getpixel((int(w * fx), int(h * fy)))


def near(a, b, tol=28):
    return all(abs(x - y) <= tol for x, y in zip(a[:3], b[:3]))


def check(name, fn):
    try:
        fn()
        print(f"OK   {name}")
    except AssertionError as e:
        print(f"FAIL {name}: {e}")


BLUE = (14, 106, 210)
WHITE = (255, 255, 255)
BG = (249, 250, 251)


def check_icon():
    for size in (192, 512):
        img = Image.open(PUBLIC / f"icon-{size}.png").convert("RGB")
        assert img.size == (size, size), img.size
        # plate is brand blue at centre-left and centre-right edges
        assert near(sample(img, 0.05, 0.5), BLUE), sample(img, 0.05, 0.5)
        assert near(sample(img, 0.95, 0.5), BLUE), sample(img, 0.95, 0.5)
        # a white-ish node sits up-and-left inside the mark
        px = sample(img, 0.42, 0.42)
        assert max(px) > 150, px
    # maskable: art confined to inner zone -> corners are blue plate
    img = Image.open(PUBLIC / "icon-maskable-512.png").convert("RGB")
    assert near(sample(img, 0.5, 0.03), BLUE), sample(img, 0.5, 0.03)


def check_apple():
    img = Image.open(PUBLIC / "apple-touch-icon.png").convert("RGB")
    assert near(sample(img, 0.5, 0.12), BLUE, tol=35), sample(img, 0.5, 0.12)
    px = sample(img, 0.42, 0.42)
    assert max(px) > 150, px


def check_og():
    img = Image.open(PUBLIC / "og-image.png").convert("RGB")
    assert img.size == (1200, 630), img.size
    assert near(sample(img, 0.5, 0.003), BLUE), sample(img, 0.5, 0.003)  # top bar
    assert near(sample(img, 0.5, 0.5), BG, tol=12), sample(img, 0.5, 0.5)  # light card
    # wordmark "Vorza" ink sits at roughly (214,156)-(520,245); sample inside a glyph
    px = sample(img, 0.19, 0.3)
    assert max(px[:3]) < 120, px
    # graph side: some non-background colours present (nodes)
    colors = img.crop((690, 96, 1140, 552)).getcolors(maxcolors=200000)
    assert colors is not None and len(colors) > 10, len(colors)


check("app icons", check_icon)
check("apple touch icon", check_apple)
check("og image", check_og)
print("done")