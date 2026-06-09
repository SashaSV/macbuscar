# macbuscar.es — TODO / Backlog

Persistent backlog. Sorted roughly by priority within each section.
Update when items are completed (`[ ]` → `[x]`) and add new items as
they come up.

---

## 🚀 Next up (high-value, well-scoped)

### Financiación / monthly installments
*From session 2026-06-07.* All Spanish stores show monthly-installment
pricing + financing provider, and this is a real comparison axis for
Spanish buyers (Apple gear is €1000+).

- [ ] Prisma migration: add to `Price` table
      - `monthlyPrice DECIMAL(10,2)` — e.g. 40.58
      - `monthlyMonths INT` — typical term, e.g. 24 / 29 / 36
      - `financingProvider VARCHAR(80)` — "CaixaBank", "Cetelem", "Younited", "Smart Plan"
      - `monthlyApr DECIMAL(5,2)` *(optional)* — TAE %
- [ ] Update 4 scrapers (amazon, worten, mediamarkt, ktuin) to extract financing
      - K-tuin: visible on product detail pages — "29 cuotas de 40,58€" + "CaixaBank / Smart Plan / Younited"
      - MediaMarkt: typically Cetelem, "Sin Intereses" 24mo
      - Worten: Worten Crédito / Cetelem
      - Amazon: Amazon Financing via CaixaBank
- [ ] Decide approach (open question):
      - **A.** Visit each matched product's detail URL (1 extra HTTP per variant, +250-300 req per full run, risk of rate-limit on Akamai/DataDome)
      - **B.** Compute monthly = total ÷ 24 locally, no provider name
      - **C.** Hybrid: extract from listing where present (K-tuin probably has it), detail-page fetch only for stores that don't
- [ ] UI: show in `ModalProducto.jsx` under each store's price
      - Format: *"desde 40€/mes con CaixaBank"* (Spanish)
      - Could be subtle 2nd line under main price

### Refactor — shared matching logic
*Status: ✅ done in session 2026-06-08.* `matching.py` + `runner.py`
created; all 4 stores refactored. Total scraper code: 3130 → 935 lines (-70%).
Future stores (PcComp, El Corte) will be ~150-250 lines each instead of ~800.

- [x] Extract to `matching.py`: regex, color dicts, helpers,
      subfamily_info, scoring, find_best_match, JSON-LD parsing, DB upsert
- [x] Create `runner.py`: generic `run_store()`, `make_driver()`,
      `inspect_page()`, `parse_standard_args()`
- [x] Refactor ktuin/mediamarkt/worten/amazon
- [x] K-tuin regression: 287/347 identical — proves matching.py is
      functionally equivalent on deterministic inputs
- [x] Per-store strict_chip / strict_anc toggles for Amazon (which has
      terse titles and needs softer M-chip handling)

### Amazon Mac coverage regression
*Detected during refactor regression testing 2026-06-08.* K-tuin
regression passed exactly (287/347), but Amazon dropped from ~252/347
baseline to ~108/347 — mostly Mac and iPhone losses (Mac alone went from
~50 to ~21). Per-store strict_chip / strict_anc toggles recovered only
a handful of matches.

Must be a subtle scoring or dedup divergence between old amazon.py and
the new shared matching.py. Possibilities:
- Old code had implicit tie-breaking that new explicit sort changes
- Some scoring edge case (display? memory? color first-word fallback?)
  shifted in a way that affects Amazon's varied titles
- Or just Amazon ranker variability — baseline 252 was a peak, not steady

**Investigation plan** (1-2 focused hours, no rush):
- [ ] `git show <last-pre-refactor-commit>:Scraper/stores/amazon.py >
      amazon_old.py` to restore the original code
- [ ] Save 5-10 Amazon search-page HTMLs (one per sub-family) for
      offline analysis — eliminates ranker variability
- [ ] Run old vs new scorer against the same HTMLs; diff matches
- [ ] Identify specific scoring decisions that flip; targeted fix
      (likely another per-store flag in `matching.score_result`)
- [ ] If irrecoverable, accept the new baseline and let PA-API
      cover the gap when Amazon Associates is approved

### Scheduled nightly price refresh
*From session 2026-06-08.* Once full scrapers are validated, set up a
daily-at-night job that refreshes prices for already-matched variants only.
Keeps the site's prices fresh without re-running the full match logic.

**Semantics** (different from full scrape):
- Only iterate variants that already have a `Price` row for the store
- Update `Price.price` to fresh value
- Move the previous `Price.price` into `Price.oldPrice`
  (not the search-page strikethrough — that's full-scrape behavior)
- Log `PriceHistory` on change
- Don't touch `ScrapedProduct` (audit trail stays)

**Implementation plan:**
- [ ] `matching.py` +
      - `load_matched_variants_for_store(store_id)` — returns Products
        with only matched-for-this-store variants included
      - `upsert_price_only(cur, store_id, variant_id, new_price)` —
        refresh-style update (previous Price.price → oldPrice)
- [ ] `runner.py` + `refresh_store(...)` — like `run_store()` but uses
      matched-only loader + price-only upsert. Skips sub-families with
      0 matched variants.
- [ ] Each scraper + small `refresh()` entrypoint calling `runner.refresh_store(...)`
- [ ] `Scraper/refresh_all.py` — orchestrator running all 4 stores in sequence
- [ ] Headless Chrome mode for CI: when `os.environ.get('CI') == 'true'`,
      add `--headless=new`, `--no-sandbox`, `--disable-gpu`,
      `--disable-dev-shm-usage` to `runner.make_driver()`

**Deployment — GitHub Actions cron (recommended):**
- [ ] `.github/workflows/refresh-prices.yml` with `cron: '0 2 * * *'`
      (02:00 UTC = 03:00 Madrid winter / 04:00 summer)
- [ ] `DATABASE_URL` as GitHub repo secret
- [ ] Budget: ~45 min/day × 30 = 1350 min/month (limit 2000 for private repos)
- [ ] Risk: GHA runners get fresh IPs; MediaMarkt (Akamai) might block.
      Fallback if blocked = move that one store to a small VPS, keep the
      rest on GHA.
- [ ] Alternative: Windows Task Scheduler on local PC (cheaper but PC must
      be on at night) or VPS cron (~€5/mo, full control)

---

## 🏬 More stores

- [ ] **PcComponentes** scraper (`pccomp` in seed) — large electronics, has Apple section
- [ ] **El Corte Inglés** scraper (`elcorte` in seed) — major Spanish department store
- [ ] **Fnac** retry with `undetected-chromedriver`
      - File `Scraper/stores/fnac.py` exists, blocked by DataDome
      - `pip install undetected-chromedriver`, rewrite `make_driver()`
      - All other logic is ready — only the driver layer changes

---

## 🧹 Data cleanup

- [ ] **Apple Watch Oro vs Oro Rosa** — K-tuin scraper showed these mapping to same SKU
      (32676 "Oro rosa" matched both variants). Verify in DB, likely
      duplicate variants for one real colour.
- [ ] **iMac colors English → Spanish** — DB has Blue/Silver, scrapers expect Azul/Plata
      (works because of COLOR_TRANSLATIONS but cleaner to normalize at source)
- [ ] **iPhone 16 Pro / Pro Max** — missing from `Web/prisma/seed/products.js`
      (only iPhone 16 / 16 Plus / 16e in seed; iPhone 17 family complete)

---

## 🎨 UI / web app

- [ ] **Compare-pages for Mac/iPad/Watch/AirPods** — extend `apple_compare.py` pattern
      (currently only iPhone has compare page)
- [ ] **Banners CMS** — move banners from hardcoded `HomePage.jsx` to DB + admin panel
- [ ] **4 legal pages** — Aviso legal, Política de privacidad, Política de cookies, Términos y condiciones
      Need real NIE/address/CNAE 6202 (already collected from registration)

---

## 🚢 Launch

- [x] **Deploy to Vercel** (macbuscar.es) — site live
- [ ] **PA-API** for Mac/Amazon coverage — when Amazon Associates is approved
      (Mac coverage limit: Amazon titles lack RAM/SSD info, structural)
- [ ] **Affiliate IDs** in `Web/prisma/seed/stores.js` — empty placeholders for Awin / Tradedoubler

---

## ✅ Recently completed

- [x] Apple catalog scraper (apple.es) — source of truth
- [x] Amazon.es scraper — 252/347 (73%), ASIN dedup, color translation
- [x] Worten scraper — Constructor.io data-cnstrc-* attributes, EAN-based SKU
- [x] MediaMarkt scraper — 171/347 (49%), JSON-LD primary, Akamai-friendly pacing
- [x] MediaMarkt quality fixes — display-size regex, M-chip required, iPad mini gen lookahead
- [x] K-tuin scraper — 287/347 (83%) **best coverage**, subfamily landing pages (no search), Magento SKU
- [x] productscover feature — custom card art at `Web/public/productscover/{slug}.png`
- [x] AHORRO label fix in `ModalProducto.jsx`
- [x] Image optimization — PNG → WebP (q90, max 1600px), ~1.73 GB → ~250 MB, originals archived in `Web/_originals-png/` (gitignored)
- [x] Vercel deploy via git push — site live at macbuscar.es
- [x] Store-logo case normalization — lowercase = `store.id`, fixes Vercel Linux case-sensitivity 404s for MediaMarkt/Worten/Fnac
- [x] **Refactor scraper shared logic** — `matching.py` + `runner.py`, 3130 → 935 lines (-70%). K-tuin regression preserved 287/347 exactly. Per-store strict_chip/strict_anc toggles for Amazon. Mac coverage regression noted as separate follow-up.
