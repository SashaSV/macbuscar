@echo off
cd /d E:\AllProjects\manzana-es-project\macbuscar\Scraper
rem Full discovery (search + matching + PriceAnomalyRejected verification).
rem Run this weekly (or manually) to catch new SKUs -- rossellimac-refresh.bat
rem now does the nightly direct-URL price check instead.
python -m stores.rossellimac >> E:\AllProjects\manzana-es-project\macbuscar\rossellimac-discovery.log 2>&1
