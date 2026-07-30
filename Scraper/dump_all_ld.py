from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
url = "https://www.worten.es/productos/iphone-17-pro-apple-6-3-256-gb-azul-oscuro-8600342"
o = webdriver.ChromeOptions()
d = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=o)
d.get(url)
time.sleep(6)
els = d.find_elements("css selector", "script[type=\"application/ld+json\"]")
for i, e in enumerate(els):
    print("=== BLOCK", i, "===")
    print(e.get_attribute("innerHTML"))
    print()
d.quit()
