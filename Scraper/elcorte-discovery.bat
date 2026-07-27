@echo off
REM ────────────────────────────────────────────────────────────────────────
REM  elcorte-discovery.bat — full discovery (search + matching + writes).
REM  Run manually to pick up new SKUs; elcorte-refresh.bat handles the
REM  nightly direct-URL price check.
REM ────────────────────────────────────────────────────────────────────────

cd /d E:\AllProjects\manzana-es-project\macbuscar\Scraper
call venv\Scripts\activate.bat

python -B -m stores.elcorte >> "E:\AllProjects\manzana-es-project\macbuscar\Scraper\logs\elcorte-discovery-%date:~-4%%date:~3,2%%date:~0,2%.log" 2>&1
