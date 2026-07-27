@echo off
REM ────────────────────────────────────────────────────────────────────────
REM  worten-discovery.bat — full discovery (search + matching + writes).
REM  Run manually to pick up new SKUs; worten-refresh.bat handles the
REM  nightly direct-URL price check.
REM ────────────────────────────────────────────────────────────────────────

cd /d E:\AllProjects\manzana-es-project\macbuscar\Scraper
call venv\Scripts\activate.bat

python -B -m stores.worten >> "E:\AllProjects\manzana-es-project\macbuscar\Scraper\logs\worten-discovery-%date:~-4%%date:~3,2%%date:~0,2%.log" 2>&1
