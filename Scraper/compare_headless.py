from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time, re
url = "https://www.worten.es/productos/iphone-17-pro-apple-6-3-256-gb-azul-oscuro-8600342"

for label, headless in (("HEADLESS", True), ("HEADFUL", False)):
    o = webdriver.ChromeOptions()
    if headless:
        for a in ("--headless=new","--window-size=1920,1080","--no-sandbox","--disable-gpu"): o.add_argument(a)
    d = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=o)
    d.get(url)
    time.sleep(6)
    els = d.find_elements("css selector", 'script[type="application/ld+json"]')
    print(label, "| title:", d.title, "| ld blocks:", len(els))
    for e in els:
        t = e.get_attribute("innerHTML")
        if "price" in t.lower():
            m = re.search(r'"price"\s*:\s*"?([\d.]+)"?', t)
            if m:
                print("   price found:", m.group(1))
    d.quit()
