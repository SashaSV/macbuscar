import os, re, glob

CACHE_DIR = os.path.join("E:\\AllProjects\\manzana-es-project\\macbuscar\\Scraper", "cache")
files = glob.glob(os.path.join(CACHE_DIR, "apple_cmp_*.html"))
files.sort(key=os.path.getsize, reverse=True)
print(f"Found {len(files)} cache files")
if not files:
    print("No cache!"); exit()

with open(files[0], "r", encoding="utf-8", errors="replace") as f:
    html = f.read()
print(f"HTML: {len(html)} chars from {os.path.basename(files[0])}")

ts = html.find("compare-table")
table_html = html[ts:]

# Count template-badge occurrences (raw)
raw_count = len(re.findall(r"template-badge", table_html))
icon_count = len(re.findall(r"image-icon-", table_html))
print(f"\nRaw counts in table_html:")
print(f"  template-badge: {raw_count}")
print(f"  image-icon-: {icon_count}")

# Match rows with current parser pattern
row_pattern = re.compile(
    r"<div[^>]+role=[\"']row[\"'][^>]+class=[\"'][^\"']*compare-row[^\"']*[\"'][^>]*>(.*?)(?=<div[^>]+role=[\"']row[\"']|</div>\s*</div>\s*$)",
    re.DOTALL
)
all_rows = list(row_pattern.finditer(table_html))
with_badge = sum(1 for r in all_rows if "template-badge" in r.group(1))
print(f"\nParser matches:")
print(f"  Total compare-rows: {len(all_rows)}")
print(f"  Rows with template-badge: {with_badge}")

# Show one badge row
for r in all_rows[:300]:
    if "template-badge" in r.group(1):
        print("\nFirst badge row (first 800 chars):")
        print(r.group(1)[:800])
        break
