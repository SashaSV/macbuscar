from scanner.gethtml import driver_init, close_driver
import time

URL = "https://www.worten.es/productos/iphone-16-pro-256gb-negro-titanio-apple-negro-mrkean-mp10460-nj6wcp56ugj41ff"


driver = driver_init()
driver.get(URL)
time.sleep(5)  # дай Cloudflare пройти + JS відрендеритись

html = driver.page_source
print(f"HTML length: {len(html)}")
print(f"Title: {driver.title}")

# Збережемо для аналізу
with open('worten_test.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Saved to worten_test.html")

# Шукаємо JSON-LD
import re
ld_blocks = re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
print(f"\nJSON-LD blocks: {len(ld_blocks)}")
import json
for i, block in enumerate(ld_blocks[:3]):
    print(f"--- Block {i} ---")
    try:
        data = json.loads(block)
        print(json.dumps(data, indent=2, ensure_ascii=False)[:2000])
    except:
        print(block[:1000])

close_driver(driver)