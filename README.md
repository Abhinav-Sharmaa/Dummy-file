#!/usr/bin/env python3
"""
image_tools.py — High-quality image creation, resizing & content-type banners.

Quality features:
  * LANCZOS resampling + 2x supersampled banner rendering (crisp edges)
  * Auto EXIF rotation fix, unsharp mask after downscaling
  * Max-quality saves (JPEG q95 no chroma subsampling, optimized PNG)

Install:  pip install Pillow

Usage:
  python image_tools.py create out.png -W 1280 -H 720 --color1 "#0f2027" --color2 "#2c5364" --text "Hello"
  python image_tools.py resize photo.jpg small.jpg -W 800
  python image_tools.py banner loans out.png --title "Home Loans from 5.9%" --subtitle "Pre-approved in minutes"
  python image_tools.py banner promo out.png --title "Festive Cashback Week" --badge "LIMITED TIME"
  python image_tools.py banner alert out.png --title "Scheduled Maintenance" --subtitle "Sun 2-4 AM"
  python image_tools.py banner loans out.png --title "..." --bg-image photo.jpg
  python image_tools.py banner promo out.png --title "..." --bg-search "festive shopping"
"""

import argparse
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

LANCZOS = getattr(Image, "Resampling", Image).LANCZOS

_FONTS_BOLD = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
               "DejaVuSans-Bold.ttf", "arialbd.ttf", "arial.ttf"]
_FONTS_REG = ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "DejaVuSans.ttf", "arial.ttf"]


def _font(size, bold=False):
    for cand in (_FONTS_BOLD if bold else _FONTS_REG):
        try:
            return ImageFont.truetype(cand, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _rgb(color):
    return Image.new("RGB", (1, 1), color).getpixel((0, 0))

# ──────────────────────────── CREATION ────────────────────────────

def create_solid(width, height, color="white"):
    return Image.new("RGB", (width, height), color)


def create_gradient(width, height, color1, color2, vertical=True):
    """Smooth linear gradient with no banding (1px strip, LANCZOS-scaled)."""
    c1, c2 = _rgb(color1), _rgb(color2)
    steps = height if vertical else width
    strip = Image.new("RGB", (1, steps) if vertical else (steps, 1))
    px = strip.load()
    for i in range(steps):
        t = i / max(steps - 1, 1)
        col = tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))
        px[(0, i) if vertical else (i, 0)] = col
    return strip.resize((width, height), LANCZOS)


def add_text(img, text, size=48, color="white", position="center"):
    """Anti-aliased centered (or positioned) text."""
    draw = ImageDraw.Draw(img)
    font = _font(size, bold=True)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    if position == "center":
        xy = ((img.width - tw) // 2 - bbox[0], (img.height - th) // 2 - bbox[1])
    else:
        xy = position
    draw.text(xy, text, font=font, fill=color)
    return img

# ──────────────────────────── BANNERS ────────────────────────────
# Each content type gets its own purpose-matched look.
# Edit this dict (or add new entries) to customise styles.

BANNER_STYLES = {
    "loans": {                                   # trust & stability
        "gradient": ("#0a2342", "#2c7da0"),      # deep navy -> steel blue
        "pattern": "rings",
        "accent": "#9bd8ff",
        "keywords": "home loan mortgage finance family house keys",
        "badge": "LOANS", "badge_bg": "#38bdf8", "badge_fg": "#06283d",
        "title_color": "white", "subtitle_color": "#cfe8f7",
        "scrim": 80,
    },
    "promo": {                                   # energetic & celebratory
        "gradient": ("#7b2ff7", "#f107a3"),      # vivid purple -> pink
        "pattern": "confetti",
        "confetti_colors": ["#ffffff", "#ffd166", "#ffa3d7"],
        "keywords": "festive shopping celebration sale gifts",
        "badge": "PROMO", "badge_bg": "#ffd166", "badge_fg": "#4a0d3a",
        "title_color": "white", "subtitle_color": "#ffe3f5",
        "scrim": 70,
    },
    "alert": {                                   # attention & caution
        "gradient": ("#d97706", "#fbbf24"),      # amber, hazard stripes
        "pattern": "stripes",
        "keywords": "abstract warning caution maintenance background",
        "badge": "NOTICE", "badge_bg": "#451a03", "badge_fg": "#fde68a",
        "title_color": "#451a03", "subtitle_color": "#6b3a10",
        "scrim": 0,
    },
}


def _pattern_rings(d, W, H, accent):
    c, lw = _rgb(accent), max(3, H // 70)
    for cx, cy, r, a in [(W * 0.86, H * 0.18, H * 0.62, 34),
                         (W * 0.97, H * 0.88, H * 0.50, 26),
                         (W * 0.70, H * 1.08, H * 0.38, 20)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c + (a,), width=lw)
    r, cx, cy = H * 0.85, W * 1.04, H * 0.5
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c + (16,))


def _pattern_confetti(d, W, H, colors):
    rng = random.Random(42)                      # deterministic layout
    for _ in range(110):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        s = rng.uniform(H * 0.006, H * 0.026)
        c = _rgb(rng.choice(colors)) + (rng.randint(28, 80),)
        if rng.random() < 0.6:
            d.ellipse([x - s, y - s, x + s, y + s], fill=c)
        else:
            d.rectangle([x - s, y - s, x + s, y + s], fill=c)


def _pattern_stripes(d, W, H):
    sw = int(H * 0.30)                           # subtle diagonal hazard stripes
    for x in range(-H, W + H, sw * 2):
        d.polygon([(x, 0), (x + sw, 0), (x + sw + H, H), (x + H, H)],
                  fill=(0, 0, 0, 14))


def _fit_title(d, title, max_w, H):
    """Return [(line, font), ...]: shrink to fit one line, else wrap to two
    balanced lines at the largest size that fits."""
    size = int(H * 0.175)
    while size >= int(H * 0.10):
        f = _font(size, bold=True)
        if d.textlength(title, font=f) <= max_w:
            return [(title, f)]
        size = int(size * 0.93)

    words = title.split()
    if len(words) > 1:
        best = None
        for i in range(1, len(words)):
            l1, l2 = " ".join(words[:i]), " ".join(words[i:])
            size = int(H * 0.14)
            while size >= int(H * 0.075):
                f = _font(size, bold=True)
                if max(d.textlength(l1, font=f), d.textlength(l2, font=f)) <= max_w:
                    if best is None or size > best[0]:
                        best = (size, l1, l2, f)
                    break
                size = int(size * 0.93)
        if best:
            return [(best[1], best[3]), (best[2], best[3])]
    return [(title, _font(int(H * 0.10), bold=True))]


def make_banner(btype, title, subtitle=None, width=1500, height=500, badge=None,
                bg=None, tint=0.55):
    """Render a styled banner at 2x then downscale for crisp anti-aliasing.

    bg:   optional PIL image used as a photo background (cover-cropped).
    tint: 0-1 strength of the style-colored wash over a photo background.
    """
    style = BANNER_STYLES[btype]
    S = 2
    W, H = width * S, height * S

    if bg is not None:
        base = resize_fill(bg, W, H).convert("RGBA")     # cover-crop the photo
        wash = create_gradient(W, H, *style["gradient"], vertical=False).convert("RGBA")
        wash.putalpha(int(255 * max(0.0, min(tint, 1.0))))
        img = Image.alpha_composite(base, wash)          # keep the type's identity
        scrim_strength = max(style["scrim"], 110)        # extra shade over photos
    else:
        img = create_gradient(W, H, *style["gradient"], vertical=False).convert("RGBA")
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        if style["pattern"] == "rings":
            _pattern_rings(od, W, H, style["accent"])
        elif style["pattern"] == "confetti":
            _pattern_confetti(od, W, H, style["confetti_colors"])
        elif style["pattern"] == "stripes":
            _pattern_stripes(od, W, H)
        img = Image.alpha_composite(img, overlay)
        scrim_strength = style["scrim"]

    if scrim_strength:                           # soft left shade for legibility
        alpha = Image.new("L", (W, 1))
        ap = alpha.load()
        for x in range(W):
            ap[x, 0] = int(scrim_strength * max(0.0, 1 - x / (W * 0.6)))
        shade = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        shade.putalpha(alpha.resize((W, H)))
        img = Image.alpha_composite(img, shade)

    d = ImageDraw.Draw(img)
    x = int(H * 0.18)
    gap = int(H * 0.045)
    lgap = int(H * 0.02)

    title_lines = _fit_title(d, title, W - 2 * x, H)
    sub_font = _font(int(H * 0.085))
    badge_font = _font(int(H * 0.055), bold=True)

    badge_text = (badge or style["badge"]).upper()
    bb = d.textbbox((0, 0), badge_text, font=badge_font)
    btw, bth = bb[2] - bb[0], bb[3] - bb[1]
    ppx, ppy = int(H * 0.032), int(H * 0.018)
    pill_h = bth + 2 * ppy

    metrics = []
    for line, f in title_lines:
        tb = d.textbbox((0, 0), line, font=f)
        metrics.append((line, f, tb, tb[3] - tb[1]))
    title_h = sum(m[3] for m in metrics) + lgap * (len(metrics) - 1)

    block = pill_h + gap + title_h
    if subtitle:
        sb = d.textbbox((0, 0), subtitle, font=sub_font)
        sth = sb[3] - sb[1]
        block += gap + sth

    y = (H - block) // 2
    d.rounded_rectangle([x, y, x + btw + 2 * ppx, y + pill_h],
                        radius=pill_h // 2, fill=style["badge_bg"])
    d.text((x + ppx - bb[0], y + ppy - bb[1]), badge_text,
           font=badge_font, fill=style["badge_fg"])
    y += pill_h + gap
    for line, f, tb, th_ in metrics:
        d.text((x - tb[0], y - tb[1]), line, font=f, fill=style["title_color"])
        y += th_ + lgap
    y += gap - lgap
    if subtitle:
        d.text((x - sb[0], y - sb[1]), subtitle, font=sub_font,
               fill=style["subtitle_color"])

    return img.convert("RGB").resize((width, height), LANCZOS)

# ───────────────────── STOCK BACKGROUND SEARCH ─────────────────────
# Uses the official Adobe Stock Search API. Get a free API key:
#   https://developer.adobe.com/console -> Create project -> Add API -> Adobe Stock
# then set it as the ADOBE_STOCK_API_KEY environment variable.
# Search previews can be watermarked: pick one to preview the layout, then
# download the licensed file from the printed URL (your Stock subscription)
# and re-run with --bg-image for the final banner.

ADOBE_ENDPOINT = "https://stock.adobe.io/Rest/Media/1/Search/Files"


def adobe_stock_search(query, limit=5):
    key = os.environ.get("ADOBE_STOCK_API_KEY")
    if not key:
        sys.exit(
            "ADOBE_STOCK_API_KEY is not set.\n"
            "1) Sign in at https://developer.adobe.com/console with your Adobe ID\n"
            "2) Create project -> Add API -> Adobe Stock -> copy the API key\n"
            "3) Set it:   export ADOBE_STOCK_API_KEY=yourkey   (Mac/Linux)\n"
            "             setx ADOBE_STOCK_API_KEY yourkey     (Windows, reopen terminal)"
        )
    params = {
        "locale": "en_US",
        "search_parameters[words]": query,
        "search_parameters[limit]": str(limit),
        "search_parameters[orientation]": "horizontal",
        "search_parameters[filters][content_type:photo]": "1",
    }
    cols = ["id", "title", "thumbnail_url", "thumbnail_1000_url", "details_url"]
    qs = urllib.parse.urlencode(params) + "".join(f"&result_columns[]={c}" for c in cols)
    req = urllib.request.Request(
        f"{ADOBE_ENDPOINT}?{qs}",
        headers={"x-api-key": key, "x-product": "BannerTool/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"Adobe Stock search failed: HTTP {e.code} {e.reason}")
    except urllib.error.URLError as e:
        sys.exit(f"Adobe Stock search failed: {e.reason}")
    files = data.get("files", [])
    if not files:
        sys.exit(f"No Adobe Stock results for: {query}")
    return files


def _download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "BannerTool/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
        f.write(r.read())


def _options_grid(paths, out_path, thumb_w=360):
    """Numbered side-by-side contact sheet of the candidate backgrounds."""
    tiles = []
    for i, p in enumerate(paths, 1):
        im = resize_fit(load(p), thumb_w)
        tile = Image.new("RGB", (thumb_w, im.height + 46), "#111111")
        tile.paste(im, (0, 0))
        add_text(tile, str(i), size=30, position=(12, im.height + 8))
        tiles.append(tile)
    h = max(t.height for t in tiles)
    grid = Image.new("RGB", (thumb_w * len(tiles) + 10 * (len(tiles) - 1), h), "#111111")
    x = 0
    for t in tiles:
        grid.paste(t, (x, 0))
        x += t.width + 10
    grid.save(out_path)


def pick_stock_background(query, pick=None, limit=5):
    """Search Adobe Stock, cache previews, show options, return the chosen image."""
    results = adobe_stock_search(query, limit)
    cache = os.path.join("stock_cache", re.sub(r"[^a-z0-9]+", "-", query.lower()).strip("-"))
    os.makedirs(cache, exist_ok=True)
    paths, lines = [], []
    for i, f in enumerate(results, 1):
        url = f.get("thumbnail_1000_url") or f.get("thumbnail_url")
        p = os.path.join(cache, f"option_{i}.jpg")
        if not os.path.exists(p):
            _download(url, p)
        paths.append(p)
        lines.append(f"  {i}. {f.get('title', '(untitled)')}\n     {f.get('details_url', '')}")
    grid_path = os.path.join(cache, "options.png")
    _options_grid(paths, grid_path)

    print(f'\nTop {len(paths)} Adobe Stock results for "{query}":')
    print("\n".join(lines))
    print(f"\nPreview grid saved to: {grid_path}  (open it to compare)")

    if pick is None:
        if not sys.stdin.isatty():
            sys.exit("Non-interactive shell: re-run with --bg-pick N to choose.")
        choice = input(f"Pick 1-{len(paths)} (Enter = 1): ").strip() or "1"
        pick = int(choice)
    if not 1 <= pick <= len(paths):
        sys.exit(f"--bg-pick must be between 1 and {len(paths)}")

    chosen = results[pick - 1]
    print("\nNote: previews may be watermarked. For final quality, download the")
    print(f"licensed image from {chosen.get('details_url', 'its Adobe Stock page')}")
    print("with your subscription and re-run with --bg-image <file>.")
    return load(paths[pick - 1])


# ─────────────────── BROWSER HANDOFF (no API key) ───────────────────
# Opens the Adobe Stock search in the user's own signed-in browser, then
# watches the Downloads folder. The user clicks Download once (their plan,
# full quality, no watermark); the script picks up the file automatically.

PRESETS = {"web": (1500, 500), "social": (1200, 628),
           "square": (1080, 1080), "hero": (1920, 600)}


def _file_stable(p, wait=1.0):
    """True once a file has finished downloading (size stops changing)."""
    try:
        s1 = p.stat().st_size
        time.sleep(wait)
        return s1 > 0 and p.stat().st_size == s1
    except OSError:
        return False


def fetch_via_browser(query, timeout=300):
    """Open the Stock search in the browser; return the image the user downloads."""
    downloads = Path.home() / "Downloads"
    if not downloads.is_dir():
        sys.exit(f"Couldn't find your Downloads folder at {downloads}.\n"
                 "Download an image manually and re-run with --bg-image <file>.")

    url = "https://stock.adobe.com/search?" + urllib.parse.urlencode(
        {"k": query, "orientation": "horizontal"})
    start = time.time()
    opened = webbrowser.open(url)
    print(f'\nSearching Adobe Stock for: "{query}"')
    if not opened:
        print(f"Couldn't auto-open a browser - open this link yourself:\n  {url}")
    print("Click Download on the image you like (free on your unlimited plan).")
    print("Watching your Downloads folder... (Ctrl+C to cancel)")

    exts = {".jpg", ".jpeg", ".png", ".webp"}
    while time.time() - start < timeout:
        time.sleep(1)
        fresh = [p for p in downloads.iterdir()
                 if p.suffix.lower() in exts and p.stat().st_mtime >= start - 1]
        for p in sorted(fresh, key=lambda q: q.stat().st_mtime, reverse=True):
            if _file_stable(p):
                print(f"Got it: {p.name} - building your banner...")
                return load(p)
    sys.exit("Timed out after 5 minutes. Download the image, then re-run with "
             "--bg-image <path-to-file>.")


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
    """Fill the box exactly — aspect preserved, overflow center-cropped."""
    return _crispen(img, ImageOps.fit(img, (width, height), LANCZOS,
                                      centering=(0.5, 0.5)))


def resize_exact(img, width, height):
    """Force exact dimensions (may stretch/squash)."""
    return _crispen(img, img.resize((width, height), LANCZOS))


def resize_pad(img, width, height, bg="white"):
    """Fit inside the box, pad with a background color to the exact size."""
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
    p = argparse.ArgumentParser(description="High-quality image creation, resizing & banners")
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

    b = sub.add_parser("banner", help="generate a styled banner by content type")
    b.add_argument("type", choices=sorted(BANNER_STYLES))
    b.add_argument("output")
    b.add_argument("--title", "--text", dest="title", required=True,
                   help="the headline text on the banner")
    b.add_argument("--subtitle")
    b.add_argument("--badge", help="override the small tag text (e.g. LIMITED TIME)")
    b.add_argument("-W", "--width", type=int, default=1500)
    b.add_argument("-H", "--height", type=int, default=500)
    b.add_argument("--preset", choices=sorted(PRESETS),
                   help="size preset: web 1500x500, social 1200x628, "
                        "square 1080x1080, hero 1920x600")
    b.add_argument("--auto-bg", action="store_true",
                   help="fetch an Adobe Stock background for this topic "
                        "(API if key set, else opens your browser)")
    b.add_argument("--bg-image", help="local photo to use as the background")
    b.add_argument("--bg-search", help="Adobe Stock keywords for a background photo")
    b.add_argument("--bg-pick", type=int,
                   help="choose result N from --bg-search non-interactively")
    b.add_argument("--tint", type=int, default=55,
                   help="style-color tint over a photo background, 0-100 (default 55)")

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
    elif a.cmd == "banner":
        if a.bg_image and (a.bg_search or a.auto_bg):
            sys.exit("Use --bg-image alone, or --auto-bg / --bg-search.")
        if a.preset:
            a.width, a.height = PRESETS[a.preset]
        bg = None
        if a.auto_bg:
            query = a.bg_search or BANNER_STYLES[a.type].get("keywords", a.type)
            if os.environ.get("ADOBE_STOCK_API_KEY"):
                bg = pick_stock_background(query, a.bg_pick or 1)
            else:
                bg = fetch_via_browser(query)
        elif a.bg_image:
            bg = load(a.bg_image)
        elif a.bg_search:
            bg = pick_stock_background(a.bg_search, a.bg_pick)
        img = make_banner(a.type, a.title, a.subtitle, a.width, a.height, a.badge,
                          bg=bg, tint=a.tint / 100)
        smart_save(img, a.output)
        print(f"Created {a.type} banner {a.output} ({img.width}x{img.height})")
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
r
