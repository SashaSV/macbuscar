from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
o = webdriver.ChromeOptions()
for a in ('--headless=new','--window-size=1920,1080','--no-sandbox','--disable-gpu','--lang=es-ES'): o.add_argument(a)
d = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=o)
d.get('https://www.worten.es/productos/iphone-17-apple-6-3-256-gb-negro-mrkea')
time.sleep(8)
html = d.page_source
open('page_dump.html','w',encoding='utf-8').write(html)
print('len', len(html))
print('title', d.title)
for kw in ('cloudflare','datadome','perimeterx','_px','akamai','ak-bmsc','incapsula','imperva','geetest','challenge'):
    if kw in html.lower():
        print('MATCH:', kw)
d.quit()
