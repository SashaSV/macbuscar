@echo off
cd /d E:\AllProjects\manzana-es-project\macbuscar\Scraper
python -m stores.apple >> E:\AllProjects\manzana-es-project\macbuscar\apple.log 2>&1
python -m stores.matcher_apple >> E:\AllProjects\manzana-es-project\macbuscar\apple.log 2>&1
