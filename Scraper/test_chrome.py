from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
o = webdriver.ChromeOptions()
o.add_argument('--headless=new')
o.add_argument('--window-size=1920,1080')
s = Service(ChromeDriverManager().install(), log_output='E:/AllProjects/manzana-es-project/macbuscar/Scraper/cd.log', service_args=['--verbose'])
d = webdriver.Chrome(service=s, options=o)
print('OK', d.title)
d.quit()
