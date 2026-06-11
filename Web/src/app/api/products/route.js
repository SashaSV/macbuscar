export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCustomCover } from '@/lib/customCover';

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
        // Show only products that have at least one variant with at least one price
        variants: {
          some: {
            prices: {
              some: {
                price: { gt: 0 },
              },
            },
          },
        },
      },
      include: {
        reviews: true,
        variants: {
          include: {
            prices: { include: { store: true } },
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
            listings: { where: { active: true }, orderBy: { createdAt: 'desc' } },
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
        prices: v.prices.map(pr => ({
          id: pr.id,
          storeId: pr.storeId,
          storeName: pr.store?.nombre,
          storeLogo: pr.store?.logo,
          price: pr.price,
          oldPrice: pr.oldPrice,
          url: pr.url || pr.store?.url || null,
          stock: pr.stock,
          discountPct: pr.discountPct,
          condition: pr.condition,
          updatedAt: pr.updatedAt,
          // Financing (Spain market — monthly installments). Any/all may
          // be null if the store doesn't expose financing for this SKU.
          monthlyPrice:      pr.monthlyPrice,
          monthlyMonths:     pr.monthlyMonths,
          financingProvider: pr.financingProvider,
          monthlyApr:        pr.monthlyApr,
        })),
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
      // Takes the MINIMUM price per store across all variants
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
            };
          }
        }
      }
      
      const custom = resolveCustomCover(p.slug);
      
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