@echo off
cd /d E:\AllProjects\manzana-es-project\macbuscar\Scraper
rem Direct-URL price check (no search, no matching risk) -- discovery moved
rem to rossellimac-discovery.bat, run that separately/less often to pick up new SKUs.
python -c "from stores import rossellimac; rossellimac.refresh_direct()" >> E:\AllProjects\manzana-es-project\macbuscar\rossellimac.log 2>&1
