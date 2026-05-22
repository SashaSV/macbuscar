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
    #paswd = "/chromedriver"
    #s = Service(paswd)
    #driver = webdriver.Chrome(
    #    executable_path=paswd
    #)
    #driver.get("https://www.google.com")
    #driver = webdriver.Chrome(service=ser, options=op)
    s = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=s)
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
    CURR_DIR = os.getcwd()
    if CURR_DIR.find("Python.Script") < 0 :
        CURR_DIR = '{0}\\Python.Script'.format(CURR_DIR)
    path = '{0}\\html\\{1}'.format(CURR_DIR,ftm['category']) 
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