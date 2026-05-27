import os, re, glob

CACHE_DIR = r"E:\AllProjects\manzana-es-project\macbuscar\Scraper\cache"
files = glob.glob(os.path.join(CACHE_DIR, "apple_cmp_*.html"))
files.sort(key=os.path.getsize, reverse=True)
with open(files[0], "r", encoding="utf-8", errors="replace") as f:
    html = f.read()
ts = html.find("compare-table")
table_html = html[ts:]

# Find section-summary
sec_m = re.search(
    r'<div[^>]+role=["\']rowgroup["\'][^>]+class=["\'][^"\']*compare-section\s+section-summary[^"\']*["\'][^>]*>(.*?)(?=<div[^>]+role=["\']rowgroup["\'][^>]+class=["\'][^"\']*compare-section)',
    table_html, re.DOTALL
)
if not sec_m:
    print("no summary section"); exit()

sec_html = sec_m.group(1)
print(f"section-summary HTML: {len(sec_html)} chars")

row_pattern = re.compile(
    r'<div[^>]+role=["\']row["\'][^>]+class=["\'][^"\']*compare-row[^"\']*["\'][^>]*>(.*?)(?=<div[^>]+role=["\']row["\']|</div>\s*</div>\s*$)',
    re.DOTALL
)
rows = list(row_pattern.finditer(sec_html))
print(f"Rows in section-summary: {len(rows)}")

# For each row, count compare-column cells
for i, r in enumerate(rows[:20]):
    cells = len(re.findall(
        r'<div[^>]+role=["\']cell[^"\']*["\'][^>]+class=["\'][^"\']*compare-column[^"\']*["\']',
        r.group(1)
    ))
    has_badge = "template-badge" in r.group(1)
    has_icon = "image-icon-" in r.group(1)
    header_m = re.search(r'<div[^>]+role=["\']rowheader["\'][^>]*>(.*?)</div>', r.group(1), re.DOTALL)
    header = ""
    if header_m:
        header = re.sub(r"<[^>]+>", "", header_m.group(1)).replace("\xa0", " ").strip()[:40]
    print(f"  [{i:2}] cells={cells} badge={has_badge} icon={has_icon} header='{header}'")
