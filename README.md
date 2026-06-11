#!/usr/bin/env python3
"""
image_tools.py — High-quality image creation & resizing (Pillow).

Quality features:
  * LANCZOS resampling (sharpest, cleanest scaling filter)
  * Auto EXIF rotation fix (phone photos come out the right way up)
  * Gentle unsharp-mask after downscaling to restore crispness
  * Max-quality save settings per format (JPEG q95 / no chroma subsampling,
    optimized PNG, WebP method 6)
  * Band-free smooth gradients and anti-aliased TrueType text

Install:  pip install Pillow

Usage:
  python image_tools.py create out.png -W 1280 -H 720 --color1 "#0f2027" --color2 "#2c5364" --text "Hello"
  python image_tools.py resize photo.jpg small.jpg -W 800                 # keep aspect ratio
  python image_tools.py resize photo.jpg square.jpg -W 500 -H 500 --mode fill
"""

import argparse
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

LANCZOS = getattr(Image, "Resampling", Image).LANCZOS

# ──────────────────────────── CREATION ────────────────────────────

def create_solid(width, height, color="white"):
    """Plain canvas in any color name or hex value."""
    return Image.new("RGB", (width, height), color)


def create_gradient(width, height, color1, color2, vertical=True):
    """Smooth linear gradient with no banding (built 1px wide, LANCZOS-scaled)."""
    c1 = Image.new("RGB", (1, 1), color1).getpixel((0, 0))
    c2 = Image.new("RGB", (1, 1), color2).getpixel((0, 0))
    steps = height if vertical else width
    strip = Image.new("RGB", (1, steps) if vertical else (steps, 1))
    px = strip.load()
    for i in range(steps):
        t = i / max(steps - 1, 1)
        col = tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))
        px[(0, i) if vertical else (i, 0)] = col
    return strip.resize((width, height), LANCZOS)


def add_text(img, text, size=48, color="white", position="center", font_path=None):
    """Anti-aliased text; tries real TrueType fonts before the bitmap fallback."""
    draw = ImageDraw.Draw(img)
    font = None
    candidates = ([font_path] if font_path else []) + [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "DejaVuSans-Bold.ttf",
        "arialbd.ttf",
        "arial.ttf",
    ]
    for cand in candidates:
        try:
            font = ImageFont.truetype(cand, size)
            break
        except (OSError, TypeError):
            continue
    if font is None:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    if position == "center":
        xy = ((img.width - tw) // 2 - bbox[0], (img.height - th) // 2 - bbox[1])
    else:
        xy = position
    draw.text(xy, text, font=font, fill=color)
    return img

# ──────────────────────────── RESIZING ────────────────────────────

def load(path):
    """Open an image and apply EXIF orientation so it isn't sideways."""
    return ImageOps.exif_transpose(Image.open(path))


def resize_fit(img, width, height=None):
    """Fit inside the box — aspect ratio preserved, never cropped or distorted."""
    if height is None:
        height = round(img.height * width / img.width)
        out = img.resize((width, height), LANCZOS)
    else:
        out = ImageOps.contain(img, (width, height), LANCZOS)
    return _crispen(img, out)


def resize_fill(img, width, height):
    """Fill the box exactly — aspect preserved, overflow center-cropped (CSS 'cover')."""
    out = ImageOps.fit(img, (width, height), LANCZOS, centering=(0.5, 0.5))
    return _crispen(img, out)


def resize_exact(img, width, height):
    """Force exact dimensions (may stretch/squash)."""
    return _crispen(img, img.resize((width, height), LANCZOS))


def resize_pad(img, width, height, bg="white"):
    """Fit inside the box, then pad with a background color to the exact size."""
    return ImageOps.pad(img, (width, height), LANCZOS, color=bg)


def _crispen(original, out):
    """Subtle unsharp mask only when downscaling — restores fine detail."""
    if out.width < original.width or out.height < original.height:
        return out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=2))
    return out


def smart_save(img, path, quality=95):
    """Save with the best-quality settings for the target format."""
    ext = path.lower().rsplit(".", 1)[-1]
    if ext in ("jpg", "jpeg"):
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")
        img.save(path, quality=quality, optimize=True, subsampling=0, progressive=True)
    elif ext == "png":
        img.save(path, optimize=True)
    elif ext == "webp":
        img.save(path, quality=quality, method=6)
    else:
        img.save(path)

# ──────────────────────────────── CLI ────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="High-quality image creation & resizing")
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("create", help="create a new image")
    c.add_argument("output")
    c.add_argument("-W", "--width", type=int, default=1280)
    c.add_argument("-H", "--height", type=int, default=720)
    c.add_argument("--color1", default="#1e3c72", help="fill / gradient start")
    c.add_argument("--color2", help="gradient end (omit for solid color)")
    c.add_argument("--horizontal", action="store_true", help="horizontal gradient")
    c.add_argument("--text", help="optional centered caption")
    c.add_argument("--text-size", type=int)
    c.add_argument("--text-color", default="white")

    r = sub.add_parser("resize", help="resize an existing image")
    r.add_argument("input")
    r.add_argument("output")
    r.add_argument("-W", "--width", type=int, required=True)
    r.add_argument("-H", "--height", type=int, help="omit to keep aspect from width")
    r.add_argument("--mode", choices=["fit", "fill", "exact", "pad"], default="fit")
    r.add_argument("--bg", default="white", help="padding color for --mode pad")
    r.add_argument("--quality", type=int, default=95, help="JPEG/WebP quality")

    a = p.parse_args()

    if a.cmd == "create":
        if a.color2:
            img = create_gradient(a.width, a.height, a.color1, a.color2,
                                  vertical=not a.horizontal)
        else:
            img = create_solid(a.width, a.height, a.color1)
        if a.text:
            add_text(img, a.text, a.text_size or max(24, a.width // 12), a.text_color)
        smart_save(img, a.output)
        print(f"Created {a.output} ({img.width}x{img.height})")
    else:
        img = load(a.input)
        h = a.height or round(img.height * a.width / img.width)
        if a.mode == "fit":
            out = resize_fit(img, a.width, a.height)
        elif a.mode == "fill":
            out = resize_fill(img, a.width, h)
        elif a.mode == "exact":
            out = resize_exact(img, a.width, h)
        else:
            out = resize_pad(img, a.width, h, a.bg)
        smart_save(out, a.output, a.quality)
        print(f"Saved {a.output} ({out.width}x{out.height}, mode={a.mode})")


if __name__ == "__main__":
    main()



python image_tools.py create test.png -W 1280 -H 720 --color1 "#0f2027" --color2 "#2c5364" --text "Hello"


python image_tools.py resize test.png small.jpg -W 800
