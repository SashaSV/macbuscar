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
- [ ] Extract to `Scraper/stores/matching.py`:
      `score_result`, `find_best_match`, `subfamily_info`,
      `group_variants_by_subfamily`, `_extract_chips`,
      `_memory_norm`, `_display_norm`, `_band_norm`,
      `_color_search_terms`, `APPLE_COLOR_SYNONYMS`, `COLOR_TRANSLATIONS`,
      all the `*_RE` regexes
- [ ] Currently ~400 lines duplicated across 4 stores → 1600 lines saved
- [ ] After refactor, store files should be ~200-300 lines each (just store-specific URL/DOM logic)

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

- [ ] **Deploy to Vercel** (macbuscar.es domain ready)
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
