import requests
from bs4 import BeautifulSoup
from selenium import webdriver
import time
import os
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException
import json

def driver_init():
    # gethtml.py is used by the older Apple scraper (apple.py), which
    # doesn't go through stores/runner.py's newer make_driver(). On the
    # VPS there's no display, so plain webdriver.Chrome() crashes with
    # "Chrome instance exited" the moment the session starts.
    #
    # Apple.es doesn't fingerprint bots the way the retail stores do,
    # so we DON'T need undetected-chromedriver here — just the same
    # headless bundle every other scraper uses when CI=true is set.
    # Local runs (no CI env) keep the visible browser so we can watch
    # the JS variant links get pulled out of React state.
    opts = webdriver.ChromeOptions()
    if os.environ.get('CI') == 'true':
        opts.add_argument('--headless=new')
        opts.add_argument('--no-sandbox')
        opts.add_argument('--disable-gpu')
        opts.add_argument('--disable-dev-shm-usage')
        opts.add_argument('--window-size=1920,1080')
    s = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=s, options=opts)
    return driver

def get_html(driver, url, ftm) -> None:
    html_text = None
    file_name = get_file_name(url[url.rfind('/')+1:], ftm)
    
    if os.path.exists(file_name):
        with open(file_name, encoding='utf-8') as thtml_file:
            html_text = thtml_file.read()  # if you only wanted to read 512 bytes, do .read(512)
            thtml_file.close()
    
    if html_text is None:

        driver.maximize_window()
        driver.get(url)
        time.sleep(3)
        html_text = driver.page_source
        with open(file_name, "w", encoding="utf-8") as file:
            file.write(driver.page_source)
    
    soup = BeautifulSoup(html_text, features='html.parser')
    images = []
    
    try:   
        a=1
    except Exception as _ex:
        print(_ex)
 
    return soup

def close_driver(driver):
    driver.close()
    driver.quit()

def get_file_name(url, ftm) -> str:
    CURR_DIR = os.path.join(os.path.dirname(__file__), '..', 'cache', 'html')
    path = os.path.join(CURR_DIR, ftm['category'])
    os.makedirs(path, exist_ok=True)
    if not os.path.exists(path):
        os.mkdir(path)
    
    return '{0}\\{1}.html'.format(path,get_sename(url))


def get_sename(sename):
        okChars = "abcdefghijklmnopqrstuvwxyz1234567890 _-"
        sename = sename.lower().strip()
        sename_new = ''
        
        for s in sename:
            if okChars.__contains__(s):
                sename_new = sename_new + s

        sename_new = sename_new.replace(' ', '-')
        sename_new = sename_new.replace('--', '-')
        sename_new = sename_new.replace('__', '_')

        return sename_new