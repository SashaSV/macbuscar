# macbuscar.es — Scrapers Reference

Status snapshot of every store scraper, where it runs, how often, and
what protects the source from us. Companion to `TODO.md`. Update when
something moves between environments or changes anti-bot status.

Last verified: **2026-06-24**.

---

## At a glance

| Store          | Coverage     | Runner       | Cron        | Anti-bot CDN | Status |
|----------------|--------------|--------------|-------------|--------------|--------|
| K-tuin         | 287 / 347    | VPS          | 02:00 UTC   | None         | 🟢 |
| PcComponentes  | ~20 / 21*    | VPS          | 02:00 UTC   | Akamai       | 🟢 |
| Worten         | n/a          | Local Win    | 03:30 local | Cloudflare   | 🟢 |
| MediaMarkt     | 171 / 347    | VPS          | 02:00 UTC   | Akamai       | 🟢 |
| Amazon         | ~108-252/347 | VPS          | 02:00 UTC   | DataDome     | 🟡 ranker variance |
| El Corte Inglés| 84 / 347     | Local Win    | 04:00 local | Akamai       | 🟢 (VPS-blocked) |
| Fnac           | —            | —            | —           | DataDome     | ⛔ todo |
| Lollypop (2ª mano) | —        | —            | —           | unknown      | ⛔ todo |

*PcC: smoke test 20/21; full-catalog coverage not separately measured.*

`Coverage` = matched variants out of 347 total in DB. K-tuin is the
ceiling because subfamily landing pages give deterministic results;
Amazon is the floor because its ranker shuffles between runs.

---

## Runner environments

**VPS** — `scraper@217.160.22.101` (IONOS Ubuntu).
- SSH login (PowerShell): `ssh -i $env:USERPROFILE\.ssh\macbuscar scraper@217.160.22.101`
- Crontab: `0 2 * * *  ~/macbuscar/run-refresh.sh  >>  ~/macbuscar-refresh.log 2>&1`
- Runs `Scraper/refresh_all.py` which iterates `STORES` list and
  swallows per-store failures.
- Headless Chrome via `runner.make_driver()` when `CI=true` env is set
  (run-refresh.sh exports it).
- Why VPS not GHA: GHA runners have shared IP pools that get burned
  on Akamai sites faster than a dedicated VPS.

**Local Windows** — your home PC.
- Windows Task Scheduler, two tasks: `macbuscar-worten` (03:30) and
  `macbuscar-elcorte` (04:00).
- Wrapper `.bat` files in repo root: `worten-refresh.bat`,
  `elcorte-refresh.bat` (both gitignored — environment-specific).
- Why local: home IP is residential, bypasses Akamai's datacenter
  blocklist that bites ECI on the VPS, and bypasses Cloudflare's
  Worten policy that triggered on the VPS too.
- Both write to the same Neon Postgres DB the VPS uses, so the
  frontend doesn't care which runner produced a given price.

---

## Per-store notes

### K-tuin — `stores/ktuin.py`
- **Apple authorization**: Premium Reseller.
- **CDN**: none, plain nginx + Magento.
- **URL strategy**: subfamily landing pages (e.g. `/iphone-17-pro/`),
  NOT search. Deterministic — 287/287 regressions hit exactly.
- **SKU**: Magento `data-product-id`.
- **Quirks**: Watch Oro vs Oro Rosa collision on SKU 32676; tracked
  in TODO.md → Data cleanup.

### PcComponentes — `stores/pccomponentes.py`
- **Apple authorization**: Premium Reseller.
- **CDN**: Akamai. PAGE_DELAY tuned to be polite (~15s).
- **URL strategy**: `/buscar/?query=...+Apple`. Clean ranker for
  Apple-branded queries.
- **SKU**: PcC item-id from URL.
- **Quirks**: Akamai-fronted but VPS-friendly so far. If it starts
  getting 403s like ECI did, move it to local cron next to Worten/ECI.

### Worten — `stores/worten.py`
- **Apple authorization**: none formally (sells genuine product).
- **CDN**: Cloudflare. Blocks datacenter IPs aggressively →
  permanent local-cron runner.
- **URL strategy**: search by query.
- **SKU**: EAN (13-digit). Worten data layer exposes it as
  `data-cnstrc-*` attributes (Constructor.io tagging).
- **Quirks**: needs residential IP — verified failure mode on VPS.

### MediaMarkt — `stores/mediamarkt.py`
- **Apple authorization**: Authorized Reseller.
- **CDN**: Akamai. Same polite pacing as PcComponentes.
- **URL strategy**: search with `searchProfile=` param.
- **SKU**: MediaMarkt item-id.
- **Quirks**: JSON-LD primary on PLP, DOM fallback when missing.
  Coverage 171/347 typical; Mac titles often miss RAM/SSD so iMac /
  MacBook Pro variants score lower.

### Amazon — `stores/amazon.py`
- **Apple authorization**: mixed (Vendido por Amazon vs marketplace).
- **CDN**: DataDome. Strictest of the bunch — runs last in `STORES`
  list so a captcha can't poison the earlier scrapers.
- **URL strategy**: search by query, multiple page iteration.
- **SKU**: ASIN.
- **Quirks**: ranker shuffles between runs → coverage fluctuates
  108-252/347. Pre/post-refactor regression of ~144 matches is an
  open investigation (TODO.md → Amazon Mac coverage regression).
  Terse titles forced per-store `strict_chip=False` toggle.
- **Future**: PA-API would replace search-scraping when Amazon
  Associates is approved.

### El Corte Inglés — `stores/elcorte.py`
- **Apple authorization**: Authorized Reseller. Awin MID 13075,
  approved 2026-06-24.
- **CDN**: Akamai with strict datacenter-IP blocklist. **HTTP/2 403
  from bare curl before Selenium starts** — verified from VPS IP
  217.160.22.101 on 2026-06-24.
- **URL strategy**: `/search/?s=...+Apple`. Vue/Nuxt SPA so we hook
  driver.get to wait for hydration (20s timeout for at least one
  `/electronica/` link to appear).
- **SKU**: ECI item-id from URL (e.g. `A56790862`), falls back to EAN.
- **Coverage breakdown** (84 / 347 baseline, 51 with strikethrough discount):
  - iphone: 29
  - ipad: 18
  - watch: 17
  - mac: 16
  - airpods: 4
- **Quirks**:
  - PLP titles omit memory for several families (iPad Air/Pro/mini,
    base iPhone). Memory back-filled from URL slug — two slug
    conventions handled: `-256gb-color-` (iPhone) vs `-color-128-gb/`
    (iPad, hyphenated). Lifted ipad coverage from 0 → 18.
  - PLP cards advertise three numbers: "Precio de venta" (current),
    "Precio original" (strikethrough), "Hasta X € entregando..."
    (trade-in offer, NOT a price). Backup regex now uses Spanish
    labels to pick the right one — naive smallest-€ picked trade-in.
  - Spanish thousands format without cents (`1.439 €` = 1439, not
    1.439) needed a heuristic in `matching.parse_price`: only dots,
    every group after first is 3 digits → thousands separator.
- **Removed from VPS nightly** — runs on local Windows Task
  Scheduler at 04:00. To re-enable on VPS: add residential proxy or
  move runner to residential host, then put `('elcorte', elcorte)`
  back into `STORES` in `refresh_all.py`.

### Fnac — TODO
- File exists: `Scraper/stores/fnac.py`. Blocked by DataDome.
- Plan: install `undetected-chromedriver`, swap in `runner.make_driver()`.
- All other scraper logic ready, only driver layer needs change.

### Lollypop (refurbished) — TODO
- 2nd-hand store, populates `Listing` table not `Price`.
- Different unique-key strategy needed (per-unit stock, not per-SKU).
- URL not finalized.

---

## Anti-bot CDN cheat sheet

| CDN          | Friendly to VPS | Friendly to home IP | Selenium needs |
|--------------|-----------------|----------------------|----------------|
| None         | yes             | yes                  | nothing special |
| Akamai (PcC) | usually         | yes                  | polite delay (15s+) |
| Akamai (ECI) | **no, 403**     | yes                  | residential IP required |
| Akamai (MediaMarkt) | yes      | yes                  | polite delay |
| Cloudflare (Worten) | **no**   | yes                  | residential IP required |
| DataDome (Amazon) | mostly     | yes                  | works but ranker varies |
| DataDome (Fnac) | **no, blocks** | not yet tested   | undetected-chromedriver |

When in doubt: `curl -sI -A 'Mozilla/5.0' 'https://example.es/'`
**before** writing scraper code. If `HTTP/2 403` + `server: AkamaiGHost`
on a bare curl, the IP is on a blocklist and Selenium won't save you —
move to residential or add a proxy.

---

## Diagnostic recipes

**Per-store smoke test (single product, ~30s):**
```powershell
cd E:\AllProjects\manzana-es-project\macbuscar\Scraper
python -B -m stores.elcorte --dry-run --product 'iPhone 17 Pro'
```

**Full dry-run (all 347 variants, ~8 min for ECI / similar for others):**
```powershell
python -B -m stores.elcorte --dry-run 2>&1 | Tee-Object elcorte-full-dryrun.log
Get-Content elcorte-full-dryrun.log -Tail 15
```

**DB sanity per store** (from `Web/`):
```powershell
node check-eci.mjs       # adapt storeId field for the store you want
```

**Check if a CDN is blocking the runner IP:**
```bash
curl -sI -A 'Mozilla/5.0' 'https://STORE.es/search/?s=iPhone' | head -8
# HTTP/2 200 → IP fine, problem is in your code / Selenium
# HTTP/2 403 + AkamaiGHost / cloudflare → IP blocked at network layer
```

**Inspect Task Scheduler state on Windows:**
```powershell
Get-ScheduledTask -TaskName "macbuscar-*" |
  Select TaskName, State,
    @{N='NextRun';E={(Get-ScheduledTaskInfo $_.TaskName).NextRunTime}}
```

**Inspect VPS cron:**
```powershell
ssh -i $env:USERPROFILE\.ssh\macbuscar scraper@217.160.22.101 "crontab -l"
ssh -i $env:USERPROFILE\.ssh\macbuscar scraper@217.160.22.101 "tail -50 ~/macbuscar-refresh.log"
```

---

## When adding a new store

1. **Check the CDN first.** Bare-curl from VPS + home. If VPS gets 403,
   plan for local cron (Worten/ECI pattern), don't fight Selenium.
2. **Pick SKU strategy.** Stable item-id > EAN > slug. Avoid hashing
   anything that can change layout-side.
3. **Inspect one PLP card.** Check which spec tokens are in the title
   vs the URL slug. If memory/connectivity are slug-only, plan to
   back-fill them into `name` before scoring (ECI pattern).
4. **Apple-signal filter.** Search results mix in competing brands;
   keep a whitelist + competitor blacklist (`is_non_apple_listing`).
5. **JSON-LD first, DOM fallback.** Same `matching.parse_jsonld()`
   helper works everywhere; only ~5% of Spanish stores actually ship
   useful JSON-LD on PLP, so DOM walk is the main path.
6. **Wire into `refresh_all.py`** between similar-CDN siblings (Akamai
   group together, etc.) so warmed sessions stay warm.
7. **Smoke test with `--dry-run --product "..."`** before any real
   seed. ECI took 5 iterations to stabilize this way; cheap.
