export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCustomCover } from '@/lib/customCover';
import { computeMonthlyFallback, STORE_FINANCING_DEFAULTS } from '@/components/shared/storeFinancing';
import { listingHideThreshold } from '@/components/shared/listingLifecycle';

const safeParse = (s, fallback) => {
  if (Array.isArray(s) || (typeof s === 'object' && s !== null)) return s;
  try { return JSON.parse(s); } catch { return fallback; }
};

/**
 * GET /api/products
 * Returns Products with embedded Variants and aggregated price info.
 *
 * Response shape (per Product):
 * {
 *   id, slug, nombre, cat, family, emoji, rating, tag, desc, basePrice,
 *   fotos, fotoLabels, specs,
 *   minPrice,      // lowest current scraped price across all variants/stores
 *   maxPrice,      // highest
 *   bestStore,     // store id offering minPrice
 *   variantsCount, // total variants
 *   variants: [    // each variant with its prices
 *     { id, nombre, memory, color, colorHex, connectivity, cpu, msrp, prices: [{...}] }
 *   ],
 *   reviews: [...],
 *   priceHistory: [...],  // aggregated across variants for the cheapest variant
 *   listings: [...]       // 2nd-hand for any variant
 * }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cat = searchParams.get('cat');
    const q = searchParams.get('q');

    const products = await prisma.product.findMany({
      where: {
        ...(cat && cat !== 'all' ? { cat } : {}),
        ...(q ? { nombre: { contains: q, mode: 'insensitive' } } : {}),
        // Show only products that have at least one variant with at least one
        // ACTIVE price. discontinued=true rows are SKUs the scraper couldn't
        // find on the store in its last attempt — hiding them prevents stale
        // "too good to be true" prices from sticking around in the UI after
        // the actual deal expired (e.g. MediaMarkt iPad Pro 592€ from 5 jun).
        variants: {
          some: {
            prices: {
              some: {
                price: { gt: 0 },
                discontinued: false,
              },
            },
          },
        },
      },
      include: {
        reviews: true,
        variants: {
          include: {
            // Only load ACTIVE Price rows. Discontinued ones stay in the
            // DB (the scraper might flip them back when the SKU returns),
            // but they're invisible to every UI consumer: minPrice/maxPrice
            // aggregation, precios map, AHORRO calculation, store cards.
            // PriceHistory below is NOT filtered — the chart keeps the
            // full timeline so users can see how prices moved historically.
            prices: {
              where: { discontinued: false },
              include: { store: true },
            },
            // PriceHistory rows from the last 90 days. We DROP the
            // `take: 30, orderBy: asc` pair the seed code had — that
            // returned the OLDEST 30 rows, which meant any variant with
            // a long change history (frequent price moves) hid its most
            // recent values from the trend chart. 90 days of real change
            // points across all variants is a small data set anyway.
            priceHistory: {
              where: { date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
              orderBy: { date: 'asc' },
            },
            listings: {
              where: {
                active: true,
                // TTL filter: 30 days. See listingLifecycle.js for the
                // reasoning — we don't have a personal area where the
                // seller can mark sold / renew, so the feed auto-prunes
                // ads older than a month rather than leaving the page
                // cluttered with offers that are probably no longer
                // available at the original price.
                createdAt: { gte: listingHideThreshold() },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: [
        { cat: 'asc' },
        { basePrice: 'asc' },
      ],
    });

    // Filter: keep only Products that have at least one Variant with at least one Price (any store)
    const activeProducts = products.filter(p =>
      p.variants.some(v => v.prices.some(pr => pr.price > 0))
    );

    const serialized = activeProducts.map(p => {
      const fotos = safeParse(p.fotos, []);
      const fotoLabels = safeParse(p.fotoLabels, []);
      const specs = safeParse(p.specs, {});

      // Aggregate variant data
      const variantsOut = p.variants.map(v => ({
        id: v.id,
        nombre: v.nombre,
        sku: v.sku,
        ean: v.ean,
        memory: v.memory,
        color: v.color,
        colorHex: v.colorHex,
        display: v.display,
        cpu: v.cpu,
        gpu: v.gpu,
        ram: v.ram,
        cpuCores: v.cpuCores,
        gpuCores: v.gpuCores,
        connectivity: v.connectivity,
        bandSize: v.bandSize,
        fotos: v.fotos,
        cover: v.cover,
        hover: v.hover,
        msrp: v.msrp,
        prices: v.prices.map(pr => {
          // Computed financing fallback when the scraper didn't extract
          // monthly-installment data for this Price row. Most stores
          // publish a standing "sin intereses" plan for Apple gear (see
          // STORE_FINANCING_DEFAULTS) but the per-SKU monthly only
          // surfaces in our DB if the scraper looked for it explicitly.
          // computeMonthlyFallback returns null when the price is below
          // the store's financing minimum or the store has no default
          // registered, so we never inject phantom terms.
          let monthlyPrice       = pr.monthlyPrice;
          let monthlyMonths      = pr.monthlyMonths;
          // financingProviders is the new shape: an ARRAY of bank chips
          // to render. Most ES retailers offer the same installment
          // terms through several partners (Amazon: Openbank + Cofidis,
          // K-tuin: Cetelem + Aplazame, PcC: 4 providers …) and the UI
          // shows them all. When a scraper parsed a single provider
          // off a product page we wrap it in a length-1 array so the
          // renderer can map without branching.
          let financingProviders = pr.financingProvider
            ? [pr.financingProvider]
            : null;
          let monthlyApr         = pr.monthlyApr;
          let financingComputed  = false;
          if (monthlyPrice == null) {
            const fb = computeMonthlyFallback(pr.price, pr.storeId);
            if (fb) {
              monthlyPrice       = fb.monthlyPrice;
              monthlyMonths      = fb.monthlyMonths;
              financingProviders = fb.financingProviders;
              monthlyApr         = fb.monthlyApr;
              financingComputed  = true;
            }
          } else {
            // Scraper parsed the monthly directly (point-in-time correct)
            // but only saw the one provider that the store's widget
            // happened to display. Enrich the providers list from
            // STORE_FINANCING_DEFAULTS when the same store advertises
            // multiple partners at checkout for that term — the UI then
            // shows every chip the user will actually see at the store.
            // We match by term (months) so a 24mo scrape gets the 24mo
            // providers list and not, say, the 3mo Klarna entry.
            const defaults = STORE_FINANCING_DEFAULTS[pr.storeId];
            if (defaults && monthlyMonths) {
              const plan = defaults.find(p => p.months === monthlyMonths);
              if (plan && plan.providers.length > (financingProviders?.length || 0)) {
                financingProviders = plan.providers;
              }
            }
          }
          return {
            id: pr.id,
            storeId: pr.storeId,
            storeName: pr.store?.nombre,
            storeLogo: pr.store?.logo,
            // Apple authorization tier for the trust badge in the modal.
            // null when the store isn't on Apple's authorized list; the
            // UI just omits the badge in that case.
            storeAppleAuthLevel: pr.store?.appleAuthLevel || null,
            price: pr.price,
            oldPrice: pr.oldPrice,
            url: pr.url || pr.store?.url || null,
            stock: pr.stock,
            discountPct: pr.discountPct,
            condition: pr.condition,
            updatedAt: pr.updatedAt,
            // Financing (Spain market — monthly installments). Any/all
            // may be null if the store doesn't expose financing AND no
            // STORE_FINANCING_DEFAULTS entry applies.
            monthlyPrice,
            monthlyMonths,
            financingProviders,
            // Single-provider field kept for any callers that haven't
            // been migrated to the array yet — holds the first chip.
            financingProvider: financingProviders?.[0] || null,
            monthlyApr,
            financingComputed,
          };
        }),
        // Per-store price-change log. Powers the Historial tab: the chart
        // builds a per-store timeline from these rows (plus current Price
        // as the "now" snapshot) and reports the daily min across stores
        // for THIS variant only. Sparse by design — a row exists only on
        // an actual price change — so the chart carries the last known
        // value forward when computing the daily snapshot.
        priceHistory: (v.priceHistory || []).map(ph => ({
          storeId: ph.storeId,
          price:   ph.price,
          date:    ph.date,
        })),
        listings: v.listings.map(l => ({
          id: l.id,
          variantId: l.variantId,
          source: l.source,
          precio: l.precio,
          estado: l.estado,
          ciudad: l.ciudad,
          vendedor: l.vendedor,
          descripcion: l.descripcion,
          fotos: safeParse(l.fotos, []),
          createdAt: l.createdAt,
          // Embed the variant's SKU traits so the 2ª-mano cards (both
          // the compact Precios mini-card and the full 2ª mano card)
          // can render the same chip set the buyer filters on, and so
          // the Precios tab can match listings to the currently-selected
          // variant on variantId. We pull from `v` directly because
          // Prisma already loaded the variant as the listing's parent
          // in this query — no extra round-trip needed.
          variant: {
            id: v.id, nombre: v.nombre,
            memory: v.memory, ram: v.ram, cpu: v.cpu,
            color: v.color, colorHex: v.colorHex,
            display: v.display, screen: v.screen,
            bandSize: v.bandSize, connectivity: v.connectivity,
          },
        })),
      }));

      // Compute aggregated prices across all variants
      const allPrices = variantsOut.flatMap(v => v.prices.map(pr => pr.price)).filter(p => p > 0);
      const minPrice = allPrices.length ? Math.min(...allPrices) : null;
      const maxPrice = allPrices.length ? Math.max(...allPrices) : null;

      // Find best store (offering minPrice)
      let bestStore = null;
      let bestVariantId = null;
      if (minPrice != null) {
        for (const v of variantsOut) {
          const found = v.prices.find(pr => pr.price === minPrice);
          if (found) { bestStore = found.storeId; bestVariantId = v.id; break; }
        }
      }

      // Build price-history trend line.
      //
      // We aggregate PriceHistory across ALL variants (not just the cheapest)
      // and take the MIN price per calendar day. The result is a daily
      // "floor price" trend the user can use as a buying-decision signal:
      // "the lowest you could pay for any configuration on day X was Y€".
      //
      // PriceHistory rows are written by the scrapers only on actual price
      // changes (Scraper/stores/matching.py upsert_scraped_and_price /
      // upsert_price_only), so the series is naturally sparse — each point
      // marks a real movement somewhere in the product line.
      const allHistoryRows = p.variants.flatMap(v => v.priceHistory || []);
      const dayMap = new Map();    // 'YYYY-MM-DD' → { date, price }
      for (const ph of allHistoryRows) {
        if (!ph?.price || ph.price <= 0) continue;
        const dayKey = new Date(ph.date).toISOString().slice(0, 10);
        const existing = dayMap.get(dayKey);
        if (!existing || ph.price < existing.price) {
          dayMap.set(dayKey, { date: ph.date, price: ph.price });
        }
      }
      const priceHistory = [...dayMap.values()]
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // Collect all listings across variants
      const allListings = variantsOut.flatMap(v => v.listings);

      // Build backward-compatible precios map: { storeId: { price, url, updatedAt } }
      // Takes the MINIMUM price per store across all variants.
      // We also carry storeAppleAuthLevel forward so the modal can render
      // the trust badge from the precios object without an extra lookup.
      const precios = {};
      for (const v of variantsOut) {
        for (const pr of v.prices) {
          if (!pr.price || pr.price <= 0) continue;
          const cur = precios[pr.storeId];
          if (!cur || pr.price < cur.price) {
            precios[pr.storeId] = {
              price: pr.price,
              url: pr.url,
              updatedAt: pr.updatedAt,
              variantId: v.id,
              storeAppleAuthLevel: pr.storeAppleAuthLevel,
            };
          }
        }
      }
      
      const custom = resolveCustomCover(p.slug);

      // Virtual 'A plazos' tag fuel — true if any (variant, store) pair on
      // this product carries an installment offer (monthlyPrice > 0). The
      // TarjetaProducto component appends a 'A plazos' pill when this is
      // true, on top of whatever Product.tag is stored in the DB.
      const hasFinancing = p.variants.some(v =>
        (v.prices || []).some(pr => pr.monthlyPrice && pr.monthlyPrice > 0)
      );

      return {
        id: p.id,
        slug: p.slug,
        nombre: p.nombre,
        cat: p.cat,
        family: p.family,
        emoji: p.emoji,
        rating: p.rating,
        tag: p.tag,
        desc: p.desc,
        basePrice: p.basePrice,
        releasedAt: p.releasedAt,
        views: p.views ?? 0,
        hasFinancing,
        cover: custom.cover || p.cover,
        hover: custom.hover || p.hover,
        fotos,
        fotoLabels,
        specs,
        // Computed fields
        minPrice,
        maxPrice,
        bestStore,
        bestVariantId,
        variantsCount: variantsOut.length,
        // Backward-compatible price map for UI
        precios,
        prices: precios,    // alias
        // Full data
        variants: variantsOut,
        reviews: p.reviews,
        priceHistory: priceHistory.map(ph => ({
          date: ph.date,
          price: ph.price,
        })),
        listings: allListings,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    return NextResponse.json(serialized, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[GET /api/products]', err);
    return NextResponse.json({ error: 'Error al obtener productos', message: err.message }, { status: 500 });
  }
}