from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
p = ChromeDriverManager().install()

steps = [
    ('base headless', lambda o: None),
    ('+no-sandbox/gpu/shm', lambda o: [o.add_argument(a) for a in ('--no-sandbox','--disable-gpu','--disable-dev-shm-usage')]),
    ('+lang', lambda o: o.add_argument('--lang=es-ES')),
    ('+user-agent', lambda o: o.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36')),
    ('+blink-features', lambda o: o.add_argument('--disable-blink-features=AutomationControlled')),
    ('+excludeSwitches', lambda o: o.add_experimental_option('excludeSwitches', ['enable-automation'])),
    ('+useAutomationExtension', lambda o: o.add_experimental_option('useAutomationExtension', False)),
]

applied = []
for name, fn in steps:
    applied.append(fn)
    o = webdriver.ChromeOptions()
    o.add_argument('--headless=new'); o.add_argument('--window-size=1920,1080')
    for f in applied: f(o)
    try:
        d = webdriver.Chrome(service=Service(p), options=o); d.quit()
        print('OK   ', name)
    except Exception as e:
        print('FAIL ', name, '->', str(e).splitlines()[0]); break
