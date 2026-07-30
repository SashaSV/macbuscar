import io
p = r"E:\AllProjects\manzana-es-project\macbuscar\Scraper\stores\worten.py"
src = io.open(p, encoding="utf-8").read()
io.open(p + ".bak2", "w", encoding="utf-8").write(src)

func = '''
def extract_price_pdp(html):
    """Worten-specific PDP price extractor. The generic JSON-LD strategy in
    matching.extract_price_from_html() misfires here: Worten embeds a
    cross-sell Product node for the USB-C power adapter (21.41 EUR) and no
    JSON-LD node for the page's own product, so the generic walker returns
    the accessory's price for every item. The real price lives in a
    microdata meta tag instead. Returns (price_float, method_str) or
    (None, None).
    """
    m = re.search(
        r\'<meta[^>]+itemprop=["\\\']price["\\\'][^>]*content=["\\\']([\\d.,]+)["\\\']\',
        html, re.I)
    if not m:
        m = re.search(
            r\'<meta[^>]+content=["\\\']([\\d.,]+)["\\\'][^>]*itemprop=["\\\']price["\\\']\',
            html, re.I)
    if m:
        try:
            return float(m.group(1).replace(",", ".")), "meta itemprop=price"
        except ValueError:
            pass
    return None, None


'''

anchor = "def refresh_direct(*, dry_run=False):"
assert src.count(anchor) == 1
src = src.replace(anchor, func.lstrip("\n") + anchor)

a2 = "        driver_factory=make_driver,"
assert src.count(a2) == 1, f"driver_factory anchor: {src.count(a2)}"
src = src.replace(a2, a2 + "\n        extract_price=extract_price_pdp,")

io.open(p, "w", encoding="utf-8").write(src)
print("patched worten.py (backup: worten.py.bak2)")
