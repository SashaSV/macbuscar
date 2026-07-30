import re, io
p = r"E:\AllProjects\manzana-es-project\macbuscar\Scraper\stores\runner.py"
src = io.open(p, encoding="utf-8").read()
io.open(p + ".bak", "w", encoding="utf-8").write(src)

old = "            price, method = extract_price(html)\n"
new = (
    "            price, method = extract_price(html)\n"
    "            # Sanity guard: a cross-sell/accessory JSON-LD node on the page\n"
    "            # (Worten embeds one for the USB-C adapter) can yield a price that\n"
    "            # has nothing to do with this product. Reject wild deviations from\n"
    "            # the known previous price rather than writing garbage to Price.\n"
    "            if price and old_price and float(old_price) > 0:\n"
    "                ratio = price / float(old_price)\n"
    "                if ratio < 0.5 or ratio > 2.0:\n"
    "                    print(f'   \\u26d4 [{i}/{len(rows)}] [{variant_id:4}] implausible '\n"
    "                          f'{price:.2f}\\u20ac vs was {old_price}\\u20ac (via {method}) \\u2014 rejected')\n"
    "                    price, method = None, None\n"
)
assert src.count(old) == 1, f"anchor found {src.count(old)} times"
io.open(p, "w", encoding="utf-8").write(src.replace(old, new))
print("patched runner.py (backup: runner.py.bak)")
