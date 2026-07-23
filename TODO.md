# macbuscar.es — TODO / Backlog

Persistent backlog. Sorted roughly by priority within each section.
Update when items are completed (`[ ]` → `[x]`) and add new items as
they come up.

---

## 🚀 Next up (high-value, well-scoped)

### Apple Store price refresh — no schedule at all (found 2026-07-23)
*Root cause of stale "PRECIO OFICIAL APPLE STORE" prices on the site
(e.g. iPad mini stuck at 13 jul while every retailer refreshed 22 jul).*

`apple.py` is NOT in `refresh_all.py`'s `STORES` list, has no
`apple-refresh.bat`/Task Scheduler entry, and isn't referenced in any
VPS crontab — it only ever ran manually. Everything else (K-tuin,
PcC, MediaMarkt, Amazon nightly on VPS; Worten/ECI/Fnac/Rossellimac
local cron) has a runner; Apple never did.

- [x] `apple-refresh.bat` added to project root (mirrors
      worten-refresh.bat pattern: `python -m stores.apple >> apple.log`)
- [x] `apple-refresh.bat` now also runs `python -m stores.matcher_apple`
      after the scrape (2026-07-23 fix) — previously it only scraped;
      fresh prices landed in `ScrapedProduct` but never reached
      `Price`/`msrp` because nobody ran the matcher afterward.
- [ ] Register Windows Task Scheduler job `macbuscar-apple`, weekly
      (Apple prices change rarely — daily is overkill). Suggest
      Sunday 02:00, ahead of Worten (03:30) / ECI (04:00).
- [ ] Run once manually now to clear the current staleness:
      `apple-refresh.bat` (scrape + matcher)

### Re-enable El Corte Inglés on VPS nightly
*Currently runs on local Windows Task Scheduler because VPS IP is
in ECI's Akamai datacenter blocklist (HTTP/2 403 from bare curl).
Not blocking anything — ECI prices land in shared Neon DB from
local cron, frontend doesn't care which runner produced them.
Unpark after first affiliate revenue.*

**Decision: defer until first revenue.** Domain not earning yet,
so even $5 is premature optimization. Local cron is free and works.

**Plan when re-enabling** (researched 2026-06-24, ~30 min total):

Our traffic budget for ECI from VPS:
- 27 search pages × ~550KB HTML ≈ 15 MB per run
- × 30 nightly runs = ~450 MB / month
- + retries buffer ≈ **~550 MB / month** (well under 1 GB)

Top 3 residential-proxy options for our tiny volume:
- [ ] **Webshare** — free tier 1 GB / month residential. £0 risk,
      try first. Caveat: free pools often more burned on Akamai.
      webshare.io
- [ ] **DataImpulse** — $1/GB PAYG, traffic doesn't expire. $5 min
      purchase = 5 GB = ~9 months. 90M IPs, 195 countries, geo to
      city level. 99.5% success rate. Most likely final pick.
      dataimpulse.com
- [ ] **IPRoyal** — $7/GB at entry, $1.75/GB only at bulk. Solid
      reputation but pricier for our volume. iproyal.com

**Selenium integration** (15-20 min when we do it):
- [ ] Patch `runner.make_driver()` to accept `PROXY_URL` env var
- [ ] Auth (user:pass) needs Chrome extension manifest — Chrome
      CLI `--proxy-server` only accepts IP:PORT, not user:pass.
      Boilerplate snippet is well-documented; ~20 lines.
- [ ] Set `PROXY_URL` env in `run-refresh.sh` on VPS only —
      local runs stay direct (no point paying proxy bandwidth
      from a residential IP that already works).
- [ ] Put `('elcorte', elcorte)` back into `STORES` in
      `refresh_all.py` and remove the comment block about ECI
      being excluded.
- [ ] Decommission Windows Task Scheduler `macbuscar-elcorte`
      task once VPS verified stable for a week.

### AirPods coverage on El Corte Inglés
*ECI matched only 4 AirPods variants (vs 29 iphone, 18 ipad).
Investigated 2026-06-24: this is the **real ECI ceiling**, not a
scraper bug. Verified via search inspect and EAN cross-reference:*
- AirPods 4 no-ANC — matched (149 €)
- AirPods 4 con ANC — matched (199 €)
- AirPods Pro 3 — matched (249 €)
- AirPods Max 2 Blanco Estrella — matched (579 €, EAN-verified
  via Fnac FR/ES + ECI product page)
- AirPods Max 2 Azul/Púpura/Medianoche/Naranja — ECI just doesn't
  stock these colors, same pattern as iPad 2TB variants.

One minor risk: ECI's Vue template uses a default-color aria-label
on some Max 2 cards (saw Medianoche in aria-label, Blanco Estrella
in URL slug). Next refresh might mark our Blanco Estrella row as
miss until aria-label sync catches up. Not blocking; the
`nextCheckAt` lifecycle gives a grace period.
- [ ] If we ever want full AirPods Max coverage: switch ECI parser
      to derive color from URL slug instead of aria-label, OR add
      slug-based override (riskier — might double-count tokens in
      stores where aria-label and slug are consistent).

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

### ~~Scheduled nightly price refresh~~ ✅ DONE (session 2026-06-09)
*Shipped.* GitHub Actions cron `'0 2 * * *'` (03:00 Madrid winter / 04:00
summer) runs `Scraper/refresh_all.py`. Local test: 645/953 refreshed in
14.8 min across all 4 stores. K-tuin perfectly deterministic (287/287);
others vary with store-side ranker noise (Amazon worst, ~38%).

- [x] `matching.load_matched_variants_for_store()` + `upsert_price_only()`
- [x] `runner.refresh_store()` + headless mode via `CI` env var
- [x] `refresh()` entry point on all 4 stores
- [x] `Scraper/refresh_all.py` orchestrator (per-store exception isolation)
- [x] `.github/workflows/refresh-prices.yml` with `DATABASE_URL` secret
- [x] Verified locally; nightly cron + manual trigger via Actions UI

Follow-ups (not blocking):
- [ ] Add per-variant detail-page fallback for variants that go un-matched
      multiple nights in a row — catches Amazon ranker drift
- [ ] Email/Slack notification on cron failure (GHA emails on workflow
      failure by default to repo admin; might be enough)

### _Original task description (kept for reference)_
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

- [x] **PcComponentes** scraper — in production, runs in nightly
      refresh on the VPS. ~20/21 on smoke test. See `SCRAPERS.md`.
- [x] **El Corte Inglés** scraper — in production, 84/347 baseline
      with 51 strikethrough discounts. **Runs on local Windows Task
      Scheduler 04:00**, not VPS — ECI Akamai blocks all datacenter
      IPs at the network layer. Awin MID 13075 approved 2026-06-24.
      See `SCRAPERS.md` → El Corte Inglés for slug-injection +
      labelled-price quirks.
- [x] **Fnac** retry with `undetected-chromedriver` (session 2026-06-26)
      — 114/345 baseline; **AirPods 8/8** (best coverage of any store,
      includes all 5 Max 2 colours where ECI only stocks 1).
      `_detect_chrome_major()` reads the Chrome major off the
      Windows registry / `--version` to pin uc's chromedriver and
      survive mid-channel upgrades. DOM selectors `.Article-item /
      .Article-title / .Article-price`; JSON-LD absent on search
      results. airpods-pro regex relaxed to handle Fnac's
      `'AirPods Pro (3.ª generación)'` parenthesised form.
      Parked off VPS rotation — DataDome still serves short-stub
      interstitial to IONOS datacenter IP even with uc on. Local
      Task Scheduler `macbuscar-fnac` runs at 04:30 (30 min after
      ECI's 04:00) and feeds the same Neon DB.
- [ ] **Rossellimac** (Apple Premium Reseller) — **fastest win** of the
      bunch. Store row already in the DB with `appleAuthLevel='premium'`
      and the logo file ships in `Web/public/logo/rossellimac.png`. Only
      the scraper is missing.
      - `rossellimac.es`, Akamai-fronted but in the same tier that
        PcComponentes happens to flip on, so VPS should run it cleanly
      - 1-2 h: clone the PcC pattern (also Premium Reseller, similar
        Apple-focused PDP shape with `[itemprop="price"]` exposed)
      - Coverage projection: ~K-tuin level (~80%) since both are pure
        Apple specialists with full catalog

- [ ] **Backmarket** (Refurbished) — **new pricing axis**, highest
      conversion impact of any new store because refurbished pricing
      typically lands -30..-40% from MSRP and Spanish buyers actively
      search for it.
      - `backmarket.es`, Awin affiliate programme (apply alongside the
        existing Awin MIDs)
      - Different data shape from new-only stores: condition matters
        (Excelente / Muy bueno / Correcto), warranty length 12-24 mo,
        per-seller pricing variability
      - Schema impact: existing `Price.condition` field covers grade,
        may want `Price.warrantyMonths` or fold into JSON techs
      - 3-4 h scraper + ~1 h UI work to surface refurbished prices
        alongside (not mixed with) new — dashed amber border like the
        2ª-mano zone keeps the comparison honest

- [ ] **Goldenmac** (Apple Premium Reseller) — large physical-store
      chain across Spain with online catalogue.
      - `goldenmac.es`, Premium Reseller status (verify via Apple's
        reseller-locator API before assigning the badge)
      - 2-3 h: standard reseller PDP pattern, expect Apple-focused
        coverage similar to K-tuin / Rossellimac
      - Brand differentiator: physical stores in major cities, so
        "recoger en tienda" cue could surface in the card later

- [ ] **MacNificos** (Apple Authorized Reseller) — smaller than
      Goldenmac but still nationally relevant; rounds out the
      authorised-reseller tier.
      - `macnificos.com`, Authorized (not Premium) per Apple's locator
      - 2-3 h, same template as Goldenmac
      - Lower priority than the three above; tackle once the others
        are in nightly rotation and stable

- [ ] **Carrefour ES** (Mixed marketplace) — large supermarket chain
      with an electronics catalogue, sells Apple gear largely through
      third-party marketplace sellers rather than as a direct Apple
      reseller. Tag with `appleAuthLevel='mixed'` like Amazon and
      surface the `Verifica vendedor` chip so buyers know to check
      the seller on each listing.
      - `carrefour.es`, expect Akamai (Spanish CDN default) —
        run on VPS first, fall back to local cron only if blocked
      - 2-3 h: standard PDP pattern, watch for marketplace badges
        on each card so we know which listings are direct-Carrefour
        vs third-party (those are noisier on price + stock)
      - Awin status unknown; check before wiring up affiliate links
      - Schema notes: Carrefour mixes own-stock and 3P like Amazon
        does, so the existing `Price` shape already covers it — the
        only nuance is the marketplace flag which we can fold into
        `Price.condition` or a small `seller` JSON if it adds value

- [ ] **Lollypop (used / refurbished items)** — populates the "2ª mano" tab
      that already exists in `ModalProducto.jsx`. Different data shape than
      new-only stores:
      - Condition matters (`condition` column already in `Price`: "new" →
        also "refurbished", "open_box", "used_good", "used_acceptable")
      - Listings include grade + warranty length (typically 12-24 mo)
      - Stock is per-unit (each refurbished iPhone is unique) — may need
        different unique-key strategy than the SKU-based one we use now
      - URL: lollypop.com or similar Spanish refurb marketplace; verify
        which one before starting

---

## 📊 Content / data expansion

- [ ] **Product reviews scraping** — reviews are a strong comparison axis
      alongside price, and Spanish buyers lean heavily on them. Open
      questions before starting:
      - **Source per store** — Amazon has rich reviews (rating + count +
        text), K-tuin shows aggregate score only, MediaMarkt/Worten have
        their own scoring widgets. Need to inspect each.
      - **Schema** — new `Review` table or aggregate into `Price`?
        Aggregate (avg_rating + review_count + review_url) is enough for
        comparison UI. Full review texts = much heavier, probably defer.
      - **Per-product, not per-variant** — reviews attach to the Product
        page on the store side, not individual colour/storage SKUs.
      - **Refresh cadence** — ratings barely move day-to-day. Pull during
        full scrape only, never during nightly refresh.
      - **UI** — add a small rating widget to each store card in
        `ModalProducto.jsx` (⭐⭐⭐⭐½ 4.6 / 1,247 reseñas), link to source.

---

## 🧹 Data cleanup

- [x] **iPad mini Azul Wi-Fi = base-iPad price (SKU collision redux, FIXED 2026-07-23)**
      iPad mini Azul Wi-Fi 128/256/512 (variants 263/264/265) show the
      BASE iPad Apple price (499/629/879 €) instead of their own
      (679/809/1059 € = their msrp). Azul is the ONLY colour shared by
      base iPad and mini Wi-Fi, so exactly those 3 configs collide.
      **Root cause:** `ScrapedProduct` is `@@unique([sku, storeId])` and
      `apple.py` derives `sku` from the URL slug TAIL, which is identical
      for `.../ipad/128gb-azul-wifi` and `.../ipad-mini/128gb-azul-wifi`.
      The two families overwrite each other's ScrapedProduct row; the
      matcher then propagates the surviving family's price onto whichever
      variant holds the bare `128gb-azul-wifi` sku (the mini). The
      previous fix only prefixed base-iPad *variant* SKUs in the DB
      (`ipad-128gb-azul-wifi`, variants 358-360) — it left apple.py
      deriving bare tails and left ScrapedProduct's collision intact, so
      it regressed on the very next scrape.
      - [x] Data-correction one-shot written: `Web/fix-ipadmini-azul-price.mjs`
            (sets Apple Price.price = variant.msrp for any ipad-mini row
            that disagrees; dry-run by default, `--apply` to write).
      - [x] **Permanent source fix in `apple.py`** (line ~991, `_scrape_family`):
            iPad SKUs now derived as `f"{family_slug}-{tail}"` so
            `ipad-128gb-azul-wifi` ≠ `ipad-mini-128gb-azul-wifi`. Only
            `category == 'iPad'` is prefixed; iPhone/Mac/AirPods tails stay
            bare (already unique per family) to avoid a catalog-wide churn.
      - [x] DB migration written: `Web/migrate-apple-ipad-sku.mjs`
            (renames existing cat='ipad' variant SKUs to the family-qualified
            form, idempotent, dry-run by default, flags any unique conflicts).
      - [x] Ran: migrate SKUs → re-scrape iPad families → matcher. Prices
            now correct and fresh (Apple cut prices: mini 549/679/929,
            base iPad 379/509/759), each config appears once with a
            family-prefixed sku, collision check clean.
      - [x] **Dedup fallout cleaned** (`Web/dedup-apple-ipad-variants.mjs`):
            the re-scrape created 157 bare-sku DUPLICATE iPad variants
            because `matcher_apple.py` reprocesses EVERY ScrapedProduct
            row (see matcher bug below), so the leftover pre-migration
            bare rows re-inserted variants alongside the migrated ones.
            Script deleted the 157 bare dupes (only where a prefixed twin
            existed — 0 orphans) + the 157 stale bare ScrapedProduct rows.

- [x] **matcher_apple.py reprocesses ALL ScrapedProduct rows every run**
      (root cause of the 2026-07-23 duplicate-variant mess), FIXED
      2026-07-23. Two-part fix:
      - `matcher_apple.py`: SELECT now filters `AND "matchStatus" =
        'pending'` (matches what the docstring always claimed it did).
      - `dbservice_postgres.py` `save_scraped_products()`: the
        `ON CONFLICT DO UPDATE` now also resets `"matchStatus" =
        'pending'` on every rescrape (previously it left matchStatus
        untouched, so a matched row stayed 'matched' forever — without
        this half of the fix, filtering the matcher alone would have
        silently stopped ALL future price updates for already-matched
        SKUs). Together: fresh scrapes get reprocessed, stale/orphaned
        rows (e.g. pre-migration bare SKUs) quietly stop being touched
        instead of re-creating duplicate variants.
      - Confirmed isolated to the Apple pipeline only — amazon/worten/
        mediamarkt/ktuin/fnac go through `matching.py`'s
        `upsert_scraped_and_price()`, which has its own ON CONFLICT and
        sets `matchStatus='matched'` immediately (live matching during
        scrape, no separate batch matcher).
      - Not needed after this fix: the sku-based prune/cleanup pass —
        stale rows just stop being reprocessed instead.

- [x] **Apple images: download as WebP, not PNG** (done 2026-07-24).
      `apple.py` fetched variant images with `fmt=png-alpha` + saved
      `.png`, needing a separate sharp conversion pass. Now fetches WebP
      directly:
      - `to_png_alpha()` renamed to `to_webp_alpha()`, regex now emits
        `fmt=webp-alpha` (keeps the alpha channel — plain `fmt=webp`
        would drop transparency and put the product on a solid bg).
        Updated at all 3 call sites: `extract_variant_images` (main +
        synthesized `_AV1..4` urls) and `_extract_watch_variant_image`.
      - `download_image()` now writes `.webp` filenames instead of `.png`.
      - Hero images were already `fmt=webp` from the page HTML —
        untouched.
      - Content-Type / size-sanity checks are format-agnostic, no change
        needed there.
      - [ ] **Not yet done:** run a scrape and visually verify a
            transparent variant image still renders correctly (no black/
            white matte where the transparent background should be)
            before this rides along on the next full Apple scrape.
      - [ ] Existing `/Web/public/products/*.png` files are untouched by
            this change (only NEW downloads get `.webp`) — decide later
            whether to bulk re-pull old ones or leave the PNG→WebP sharp
            step in place as a one-time backfill for the old files.

- [ ] **Apple Watch Oro vs Oro Rosa** — K-tuin scraper showed these mapping to same SKU
      (32676 "Oro rosa" matched both variants). Verify in DB, likely
      duplicate variants for one real colour.
- [ ] **iMac colors English → Spanish** — DB has Blue/Silver, scrapers expect Azul/Plata
      (works because of COLOR_TRANSLATIONS but cleaner to normalize at source)
- [ ] **iPhone 16 Pro / Pro Max** — missing from `Web/prisma/seed/products.js`
      (only iPhone 16 / 16 Plus / 16e in seed; iPhone 17 family complete)

---

## 🧪 Testing / monitoring (data-integrity guardrails)

*Motivation: the iPad-mini Azul collision (2026-07-23) and the 10-day
Apple-price staleness both went unnoticed until spotted by eye on the
live site. We need automated checks that would have caught either one
the night it happened. Build these as standalone Node scripts under
`Web/tests/` (Prisma, no framework needed) plus a thin `npm test` /
CI wrapper, so they can run post-scrape and fail loudly.*

- [ ] **Price-vs-MSRP anomaly check** — for every Apple Store Price row,
      flag where `|price - variant.msrp| / msrp` exceeds a threshold
      (e.g. >5%). Apple sells at list price, so any Apple row that
      disagrees with its own msrp is almost certainly a mis-linked SKU
      (exactly the mini/base collision signature). Would have caught
      263/264/265 immediately. Generalize the one-off
      `check-ipadmini-collision.mjs` into this.
- [ ] **Cross-family SKU / URL collision check** — assert no two variants
      in DIFFERENT product families share a `sku`, and no two share an
      Apple `Price.url`. Catches the ScrapedProduct `(sku, storeId)`
      collision class at the source, for ALL families (not just iPad).
- [ ] **Staleness check** — flag any Price row whose `updatedAt` is older
      than its store's expected cadence (Apple weekly, retailers daily).
      Would have caught the whole Apple catalog frozen at 10-11 days.
      Emit a per-store "oldest price age" summary. Generalize
      `check-apple.mjs`.
- [ ] **Outlier / sanity bounds** — flag prices that are implausible:
      below a floor (e.g. iPhone < 300 €, MacBook < 800 €), a retailer
      priced *below* Apple MSRP by an improbable margin (>40%), or a
      variant whose price moved >30% vs its last `PriceHistory` point
      overnight (fat-finger / parse error like the ECI trade-in-vs-price
      mixups).
- [ ] **Duplicate-variant check** — assert one variant per
      (productId, memory, color, connectivity, cpu, bandSize) tuple.
      Catches the Watch Oro/Oro-Rosa and iMac EN/ES duplication classes
      already noted under Data cleanup.
- [ ] **Coverage regression check** — per store, compare matched-variant
      count against a stored baseline; fail if it drops >15% (the Amazon
      Mac regression signature). Persist baselines in a small JSON.
- [ ] **Wiring** — run these after `refresh_all.py` / the Apple matcher
      (a step in the VPS `run-refresh.sh` and/or a GH Action), and print
      a compact report. Non-zero exit on any hard failure so the nightly
      log makes the breakage obvious instead of it surfacing on the live
      site days later.

---

## 🎨 UI / web app

- [ ] **Mobile UI adaptation** — site is desktop-first; needs responsive pass
      for iPhone Safari + Android Chrome. Likely problem areas:
      - HomePage product grid (cards may be too wide on 375px viewport)
      - `ModalProducto.jsx` — store cards stack OK but font/padding tight,
        the "desde X €/mes con Cetelem" line may wrap awkwardly
      - Comparison rows (Apple Store / MediaMarkt / Amazon / Worten / iStore)
        with horizontal price bar — needs touch-friendly scroll or stack
      - Category nav / filters / search bar
      - Touch target sizes (Apple HIG: ≥44px, Material: ≥48px)
      - Image loading on slow mobile networks (already WebP'd but check
        `loading="lazy"` is set everywhere)
      Approach: Chrome DevTools mobile emulation first, then real device.
      Tailwind breakpoints already exist; check what's actually used.
- [ ] **Image gallery polish** — the existing "Galería" tab in `ModalProducto.jsx`
      shows variant images but needs work:
      - Lightbox / full-screen zoom on click (currently inline only)
      - Thumbnail strip with smooth horizontal scroll
      - Keyboard navigation (arrow keys, Esc)
      - Lazy-loading offscreen images (Apple PR shots are 1-3 MB each)
      - Fallback when a variant has no own photos — reuse the Product
        cover so empty galleries don't look broken
      - Mobile: pinch-zoom, swipe between images
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

- [x] **El Corte Inglés scraper** (session 2026-06-24) — 84/347 baseline,
      51 with strikethrough discount. Three core fixes: parse_price
      Spanish-thousands heuristic, labelled `Precio de venta` patterns
      to skip trade-in offers, memory back-fill from URL slug for
      iPad/base-iPhone families. Runs on local Windows Task Scheduler
      (ECI Akamai blocks datacenter IPs). Awin MID 13075 approved.
- [x] **PcComponentes scraper** — Apple Premium Reseller, Akamai-fronted
      but VPS-friendly so far. Slots between K-tuin and Worten in nightly.
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
