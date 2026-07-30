import json, sys
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
o = webdriver.ChromeOptions()
for a in ('--headless=new','--window-size=1920,1080','--no-sandbox','--disable-gpu','--lang=es-ES'): o.add_argument(a)
d = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=o)
d.get('https://www.worten.es/productos/iphone-17-apple-6-3-256-gb-negro-mrkea')
import time; time.sleep(4)
els = d.find_elements('css selector', 'script[type=\"application/ld+json\"]')
print('LD blocks:', len(els))
for i, e in enumerate(els):
    t = e.get_attribute('innerHTML')
    print('---', i, t[:600])
print('TITLE:', d.title)
d.quit()
