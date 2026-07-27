@echo off
REM ────────────────────────────────────────────────────────────────────────
REM  fnac-discovery.bat — full discovery (search + matching + writes).
REM
REM  This is what fnac-refresh.bat used to do before it switched to the
REM  direct-URL price check. Run manually when you want to pick up new
REM  SKUs or re-verify existing matches. NOTE: Fnac's discovery write path
REM  predates matching.py's PriceAnomalyRejected/mark_price_missed safety
REM  nets — it has its own hand-rolled upsert (see fnac.py's
REM  refresh_direct() docstring for details).
REM
REM  Not on any schedule by default — invoke by hand:
REM    E:\AllProjects\manzana-es-project\macbuscar\Scraper\fnac-discovery.bat
REM ────────────────────────────────────────────────────────────────────────

cd /d E:\AllProjects\manzana-es-project\macbuscar\Scraper

REM Activate the venv that has undetected-chromedriver + psycopg2 installed.
call venv\Scripts\activate.bat

python -B -m stores.fnac >> "E:\AllProjects\manzana-es-project\macbuscar\Scraper\logs\fnac-discovery-%date:~-4%%date:~3,2%%date:~0,2%.log" 2>&1
