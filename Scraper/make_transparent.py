# -*- coding: utf-8 -*-
"""
Make white backgrounds transparent in PNG images (chroma-key).

Optimised for large folders (~1000+ images): uses NumPy vector operations
instead of per-pixel Python loops -> 50-100x faster than naive Pillow.

USAGE
    python make_transparent.py                                  # default: ../Web/public/logo
    python make_transparent.py PATH                             # custom folder
    python make_transparent.py PATH THRESHOLD                   # custom threshold (default 240)
    python make_transparent.py PATH THRESHOLD --dry-run         # report only, no writes
    python make_transparent.py PATH THRESHOLD --force           # re-process even already-done files

By default the script:
  - SKIPS files that already look transparent (saves a lot of time on re-runs)
  - SKIPS files that have <0.1%% near-white pixels (already clean)
  - Writes a sidecar marker file <name>.png.cleaned to track processed files
  - Operates in-place

Tunables (CLI):
  THRESHOLD (default 240) - pixels with min(R,G,B) >= this are transparent
                            Lower (215-225) if some greys remain
                            Higher (245-250) for stricter pure-white only

Common runs:
    python make_transparent.py ..\\Web\\public\\logo
    python make_transparent.py ..\\Web\\public\\categories
    python make_transparent.py ..\\Web\\public\\products
    python make_transparent.py ..\\Web\\public\\products 245 --dry-run
"""
import os, sys, glob, time

try:
    from PIL import Image
except ImportError:
    print('Pillow not installed. Run: pip install pillow --break-system-packages')
    sys.exit(1)

try:
    import numpy as np
    HAVE_NUMPY = True
except ImportError:
    HAVE_NUMPY = False
    print('NumPy not installed (slower fallback). For speed: pip install numpy --break-system-packages\n')


def has_transparency(arr) -> bool:
    """True if image already has any transparent pixels."""
    return (arr[..., 3] < 255).any()


def process_numpy(arr, threshold: int, softness: int):
    """
    NumPy-based chroma key. arr is H x W x 4 uint8.
    Returns modified arr + (removed_count, total).
    """
    h, w = arr.shape[:2]
    # min channel per pixel
    rgb = arr[..., :3].astype(np.int16)
    m = rgb.min(axis=2)

    # Fully transparent zone
    fully = m >= threshold
    # Edge ramp zone
    edge_mask = (m >= threshold - softness) & ~fully

    # Apply fully transparent
    arr[..., 3] = np.where(fully, 0, arr[..., 3])

    # Apply ramp on edge
    if edge_mask.any():
        ramp_k = (threshold - m[edge_mask]) / softness   # 0..1
        cur_alpha = arr[..., 3][edge_mask].astype(np.float32)
        arr[..., 3][edge_mask] = (cur_alpha * ramp_k).astype(np.uint8)

    removed = int(fully.sum())
    total = h * w
    return arr, removed, total


def process_python(img, threshold: int, softness: int):
    """Slow fallback if NumPy isn't available."""
    pixels = img.load()
    w, h = img.size
    removed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            m = min(r, g, b)
            if m >= threshold:
                pixels[x, y] = (r, g, b, 0)
                removed += 1
            elif m >= threshold - softness:
                k = (threshold - m) / softness
                pixels[x, y] = (r, g, b, int(a * k))
    return img, removed, w * h


def process_file(path: str, threshold: int, softness: int, dry_run: bool):
    img = Image.open(path).convert('RGBA')

    if HAVE_NUMPY:
        arr = np.array(img)
        # Skip if image already has substantial transparency
        if has_transparency(arr):
            already_transparent = float((arr[..., 3] == 0).sum()) / arr.size * 4
            if already_transparent > 0.05:
                return ('skipped_already_transparent', 0, arr.shape[0] * arr.shape[1])

        arr, removed, total = process_numpy(arr, threshold, softness)
        pct = 100 * removed / total
        if pct < 0.1:
            return ('skipped_no_white', removed, total)

        if not dry_run:
            Image.fromarray(arr, 'RGBA').save(path, 'PNG', optimize=True)
        return ('processed', removed, total)
    else:
        if has_transparency_py(img):
            return ('skipped_already_transparent', 0, img.size[0] * img.size[1])
        img, removed, total = process_python(img, threshold, softness)
        pct = 100 * removed / total
        if pct < 0.1:
            return ('skipped_no_white', removed, total)
        if not dry_run:
            img.save(path, 'PNG', optimize=True)
        return ('processed', removed, total)


def has_transparency_py(img) -> bool:
    """Python fallback for has_transparency."""
    return any(p[3] < 255 for p in img.getdata())


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    dry_run = '--dry-run' in flags
    force = '--force' in flags

    target_dir = args[0] if len(args) > 0 else os.path.normpath(os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        '..', 'Web', 'public', 'logo'
    ))
    threshold = int(args[1]) if len(args) > 1 else 240
    softness  = 15

    if not os.path.isdir(target_dir):
        print(f'ERROR: directory not found: {target_dir}')
        sys.exit(1)

    files = sorted(glob.glob(os.path.join(target_dir, '*.png')))
    if not files:
        print(f'No .png files found in: {target_dir}')
        return

    marker = '.cleaned'
    if not force:
        files = [f for f in files if not os.path.exists(f + marker)]

    print(f'Folder:    {target_dir}')
    print(f'Files:     {len(files)} PNG' + ('  (DRY RUN)' if dry_run else ''))
    print(f'Threshold: {threshold} (softness {softness})')
    print(f'Engine:    {"NumPy (fast)" if HAVE_NUMPY else "Python loops (slow)"}')
    print()

    if not files:
        print('Nothing to do — all files already cleaned. Use --force to redo.')
        return

    stats = {'processed': 0, 'skipped_no_white': 0, 'skipped_already_transparent': 0, 'errors': 0}
    t0 = time.time()
    for i, f in enumerate(files, 1):
        name = os.path.basename(f)
        try:
            status, removed, total = process_file(f, threshold, softness, dry_run)
            stats[status] += 1
            if status == 'processed':
                pct = 100 * removed / total
                tag = 'WOULD' if dry_run else 'DONE '
                print(f'  [{i:>5}/{len(files)}] {tag} {name[:50]:50} {pct:5.1f}%% transparent')
                if not dry_run:
                    open(f + marker, 'w').close()
            elif status == 'skipped_no_white':
                if i % 50 == 0:
                    print(f'  [{i:>5}/{len(files)}] (no white, skipped)')
            elif status == 'skipped_already_transparent':
                if i % 50 == 0:
                    print(f'  [{i:>5}/{len(files)}] (already transparent, skipped)')
        except Exception as e:
            stats['errors'] += 1
            print(f'  [{i:>5}/{len(files)}] ERROR {name}: {e}')

    dt = time.time() - t0
    print(f'\nDone in {dt:.1f}s:')
    print(f'  processed:                   {stats["processed"]}')
    print(f'  skipped (already transparent):{stats["skipped_already_transparent"]}')
    print(f'  skipped (no white pixels):    {stats["skipped_no_white"]}')
    print(f'  errors:                       {stats["errors"]}')


if __name__ == '__main__':
    main()
