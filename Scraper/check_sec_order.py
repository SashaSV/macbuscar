import os, re, glob

CACHE_DIR = r"E:\AllProjects\manzana-es-project\macbuscar\Scraper\cache"
files = glob.glob(os.path.join(CACHE_DIR, "apple_cmp_*.html"))
files.sort(key=os.path.getsize, reverse=True)
with open(files[0], "r", encoding="utf-8", errors="replace") as f:
    html = f.read()
ts = html.find("compare-table")
table_html = html[ts:]

# How sections appear (in DOM order)
print("Section order in DOM (first 30):")
section_order = re.findall(r"compare-section\s+section-(\w+)", table_html)
for i, s in enumerate(section_order[:30]):
    print(f"  [{i+1:2}] {s}")

# Distance between section-summary and section-display
sum_idx = table_html.find("section-summary")
disp_idx = table_html.find("section-display")
print(f"\nOffsets:")
print(f"  section-summary: {sum_idx}")
print(f"  section-display: {disp_idx}")
print(f"  Difference: {disp_idx - sum_idx} chars")

# Show what's between them (last 800 chars before section-display starts)
print("\n--- HTML transition from summary to display (1200 chars around section-display) ---")
print(table_html[disp_idx-600:disp_idx+600])
