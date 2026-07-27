@echo off
REM ────────────────────────────────────────────────────────────────────────
REM  rossellimac-discovery.bat — full discovery (search + matching + writes).
REM  Run manually to pick up new SKUs; rossellimac-refresh.bat handles the
REM  nightly direct-URL price check.
REM ────────────────────────────────────────────────────────────────────────

cd /d E:\AllProjects\manzana-es-project\macbuscar\Scraper
call venv\Scripts\activate.bat
set CI=true

python -B -m stores.rossellimac >> "E:\AllProjects\manzana-es-project\macbuscar\Scraper\logs\rossellimac-discovery-%date:~-4%%date:~3,2%%date:~0,2%.log" 2>&1
