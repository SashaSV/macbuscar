import os, re, glob

CACHE_DIR = r"E:\AllProjects\manzana-es-project\macbuscar\Scraper\cache"
files = glob.glob(os.path.join(CACHE_DIR, "apple_cmp_*.html"))
files.sort(key=os.path.getsize, reverse=True)
with open(files[0], "r", encoding="utf-8", errors="replace") as f:
    html = f.read()
ts = html.find("compare-table")
table_html = html[ts:]

# Apply parser's section pattern
section_pattern = re.compile(
    r"<div[^>]+role=[\"']rowgroup[\"'][^>]+class=[\"'][^\"']*compare-section\s+section-(\w+)[^\"']*[\"'][^>]*>(.*?)(?=<div[^>]+role=[\"']rowgroup[\"'][^>]+class=[\"'][^\"']*compare-section|$)",
    re.DOTALL | re.IGNORECASE
)

row_pattern = re.compile(
    r"<div[^>]+role=[\"']row[\"'][^>]+class=[\"'][^\"']*compare-row[^\"']*[\"'][^>]*>(.*?)(?=<div[^>]+role=[\"']row[\"']|</div>\s*</div>\s*$)",
    re.DOTALL
)

print("Per-section breakdown of icon rows:")
for sec_m in section_pattern.finditer(table_html):
    sec_name = sec_m.group(1)
    sec_html = sec_m.group(2)
    rows = list(row_pattern.finditer(sec_html))
    icon_rows = sum(1 for r in rows if "template-badge" in r.group(1) and "image-icon-" in r.group(1))
    badge_rows = sum(1 for r in rows if "template-badge" in r.group(1))
    if badge_rows or icon_rows:
        print(f"  section-{sec_name:20} {len(rows):3} rows, {badge_rows:2} template-badge, {icon_rows:2} with image-icon-")
