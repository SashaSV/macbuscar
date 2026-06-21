'use client';
import { useState } from 'react';
import { TAG_COLORS, TAG_BADGES, TIENDAS } from '../shared/constants';
import { getPrecioMap, getMejor } from '../shared/utils';

export default function TarjetaProducto({ prod, tiendas, abrir, precios, scrapeStatus, onClick, ahorroMode }) {
  const [hovered, setHovered] = useState(false);
  // Support BOTH old (tiendas, abrir) and new (precios, onClick) prop styles
  const handleClick = onClick || abrir;
  const tiendaList = tiendas || TIENDAS || [];

  const precioMap = precios?.[prod.id] || getPrecioMap(prod);
  const mejor = getMejor(prod);

  // Find best store safely
  const mejorTienda = mejor && tiendaList.length
    ? tiendaList.find(t => t.id === mejor.tiendaId || t.id === mejor.storeId)
    : null;

  // Parse photos
  let fotos = [];
  try { fotos = typeof prod.fotos === 'string' ? JSON.parse(prod.fotos) : (prod.fotos || []); }
  catch { fotos = []; }

  // Resolve cover/hover with fallbacks
  // matcher writes Product.cover/hover directly; if older rows still have only
  // Product.fotos, fall back to that.
  const coverSrc = prod.cover || fotos[0] || null;
  const hoverSrc = prod.hover || fotos[1] || coverSrc;

  const isValidUrl = (u) => typeof u === 'string' && (u.startsWith('/') || u.startsWith('http'));
  const hasRealPhoto = isValidUrl(coverSrc);

  const tagColor = TAG_COLORS?.[prod.tag] || '#86868b';

  // Badge stack: editorial Product.tag ("Novedad" / "Pro" / ...), then
  // virtual derived chips. Order matters — solid promotional badges first,
  // then the outline 'A plazos' chip, then the green savings pill last so
  // the eye reads tag → financing → "how much you save" top-to-bottom.
  const badges = [];
  if (prod.tag && TAG_BADGES[prod.tag]) {
    badges.push({ kind: 'tag', name: prod.tag });
  }
  if (prod.hasFinancing) {
    badges.push({ kind: 'tag', name: 'A plazos' });
  }

  // Pretty-print large counts: 999 → "999", 1234 → "1.2k", 12000 → "12k".
  // Mirrors how Spotify / TikTok / GitHub all render social-style counters.
  const formatViews = (n) => {
    if (!Number.isFinite(n) || n <= 0) return null;
    if (n < 1000) return String(n);
    if (n < 10000) return `${(n / 1000).toFixed(1).replace('.', ',')}k`;
    if (n < 1000000) return `${Math.round(n / 1000)}k`;
    return `${(n / 1000000).toFixed(1).replace('.', ',')}M`;
  };
  const viewsLabel = formatViews(prod.views);

  // Best price: from precios map OR product.minPrice OR product.basePrice
  let bestPrice = null;
  let bestStoreId = null;
  if (precioMap && typeof precioMap === 'object') {
    for (const [storeId, val] of Object.entries(precioMap)) {
      const p = typeof val === 'object' ? val.price : val;
      if (typeof p === 'number' && p > 0 && (bestPrice == null || p < bestPrice)) {
        bestPrice = p;
        bestStoreId = storeId;
      }
    }
  }
  if (bestPrice == null && mejor?.precio) bestPrice = mejor.precio;
  if (bestPrice == null && prod.minPrice) bestPrice = prod.minPrice;
  if (bestPrice == null && prod.basePrice) bestPrice = prod.basePrice;

  const storeName = bestStoreId
    ? tiendaList.find(t => t.id === bestStoreId)?.nombre
    : mejorTienda?.nombre;

  // Savings vs Apple's official price (MSRP). Per-variant.
  //
  // We base every ahorro chip on the Apple MSRP of the bestVariant
  // because that's the comparison shoppers actually run in their head:
  // "what would I pay direct from Apple?". 100% of catalog variants
  // currently have variant.msrp populated, so this is the primary path.
  //
  // Cross-store spread (max-min across stores for the same variant) is
  // a legacy fallback for any future variant added without an MSRP —
  // we still want SOMETHING on the card if it lacks Apple-base data.
  // It also caps inflation: spread is computed on ONE variant (the one
  // achieving bestPrice), not across variants, so storage-tier upsell
  // never pretends to be a discount.

  // Find the variant achieving bestPrice. API hands us prod.bestVariantId,
  // but fall back to scanning variants just in case the API output is stale.
  const bestVariant = prod.bestVariantId
    ? prod.variants?.find(v => v.id === prod.bestVariantId)
    : prod.variants?.find(v => (v.prices || []).some(pr => pr.price === bestPrice));

  // Primary metric: vs Apple MSRP for THIS variant.
  const variantMsrp = bestVariant?.msrp;
  const msrpAhorro = (variantMsrp && bestPrice && variantMsrp > bestPrice)
    ? {
        amount: Math.round(variantMsrp - bestPrice),
        base: variantMsrp,
        pct: Math.round(((variantMsrp - bestPrice) / variantMsrp) * 100),
      }
    : null;

  // Safety fallback: cross-store spread on the bestVariant — used only
  // when MSRP path didn't apply (no msrp, or bestPrice >= msrp).
  const variantStorePrices = (bestVariant?.prices || [])
    .map(pr => pr.price)
    .filter(p => typeof p === 'number' && p > 0);
  const variantMax = variantStorePrices.length ? Math.max(...variantStorePrices) : null;
  const variantMin = variantStorePrices.length ? Math.min(...variantStorePrices) : null;
  const spreadFallback = (!msrpAhorro && variantMax && variantMin && variantMax > variantMin)
    ? {
        amount: Math.round(variantMax - variantMin),
        base: variantMax,
        pct: Math.round(((variantMax - variantMin) / variantMax) * 100),
      }
    : null;

  const spreadAhorro = msrpAhorro || spreadFallback;

  // "Bajada del mes" override — windowed temporal version of the same
  // MSRP comparison. Question answered: "what % off Apple price did this
  // variant reach IN THE LAST 30 DAYS?". We scan priceHistory + today's
  // per-store snapshot for the variant's LOWEST observed price in the
  // window, then compare that minimum to MSRP. This way a price that
  // dipped 35% mid-month but is now back to 10% off still shows up as
  // "−35% този місяць" — which is the more honest signal for a buyer
  // looking at "recent biggest drops".
  const monthAhorro = (() => {
    if (!bestVariant) return null;
    const msrp = bestVariant.msrp;
    if (!msrp || msrp <= 0) return null;
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentHistory = (bestVariant.priceHistory || [])
      .filter(ph => ph?.date && new Date(ph.date).getTime() >= monthAgo)
      .map(ph => ph.price);
    const currentPrices = (bestVariant.prices || []).map(pr => pr.price);
    const all = [...recentHistory, ...currentPrices].filter(p => typeof p === 'number' && p > 0);
    if (all.length === 0) return null;
    const minMonth = Math.min(...all);
    if (minMonth >= msrp) return null;
    const drop = Math.round(msrp - minMonth);
    if (drop <= 0) return null;
    return { amount: drop, base: msrp, pct: Math.round((drop / msrp) * 100) };
  })();

  // Pick which metric to display. In 'month' mode (Bajada del mes carousel)
  // we show the windowed drop — even if it's smaller than today's cross-
  // store spread — because that's what the section's title promises.
  // Default mode falls back to the cross-store spread.
  const displayAhorro = ahorroMode === 'month' ? monthAhorro : spreadAhorro;
  const ahorroPct = displayAhorro?.pct ?? null;
  const ahorroAmount = displayAhorro?.amount ?? null;

  // Solid green savings chip lives at the bottom of the badge stack —
  // last because it's the punch-line of the card. Skipped when there's
  // no measurable discount to claim.
  if (ahorroAmount && ahorroAmount > 0 && ahorroPct && ahorroPct > 0) {
    badges.push({ kind: 'discount', amount: ahorroAmount, pct: ahorroPct });
  }

  return (
    <div
      onClick={() => handleClick && handleClick(prod)}
      style={{
        borderRadius: 22,
        // overflow:visible (NOT hidden) lets the savings/tag badges in the
        // top-left corner poke past the card's rounded edge. Photo clipping
        // is handled deeper inside by the dedicated photo wrapper, so the
        // image still respects the inner rounded square.
        overflow: 'visible',
        cursor: 'pointer',
        position: 'relative',
        // Transition is on the outer wrapper because we still animate the
        // hover lift here; the bg + shadow live on the inner backdrop
        // layer so they don't clip the overhanging badges.
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={e => {
        setHovered(true);
        e.currentTarget.style.transform = 'translateY(-6px)';
      }}
      onMouseLeave={e => {
        setHovered(false);
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Backdrop-glass layer. backdrop-filter is intentionally NOT on the
          outer card div: Chrome's compositor clips absolute descendants to
          the rounded backdrop-filter region even with overflow:visible,
          which would slice the badges we want to overhang. Hosting it on a
          separate absolutely-positioned layer isolates the clip to this
          rectangle and leaves the content layer free to escape the corner. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 22,
          background: hovered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: '0.5px solid rgba(255,255,255,0.8)',
          boxShadow: hovered
            ? 'inset 0 1px 0 rgba(255,255,255,0.95), 0 18px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(168,85,247,0.08)'
            : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 14px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
          transition: 'background 0.3s, box-shadow 0.35s ease',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Content layer — sits ABOVE the backdrop-glass layer so the
          badge stack inside image-area can still overhang the card's
          rounded edge without being clipped. */}
      <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{
        aspectRatio: '1',
        background: 'transparent',
        borderRadius: 16,
        margin: '12px 12px 0 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        // overflow visible so the badge stack can hang slightly past the
        // card's left edge. The inner .photo-frame below restores the
        // rounded clip for the actual product image.
        overflow: 'visible',
      }}>
        {badges.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 10,
            left: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 5,
            zIndex: 2,
            pointerEvents: 'none',
          }}>
            {badges.map((b, i) => {
              // Unified chip style: every badge — tag, financing, savings —
              // uses a tinted-glass look in its own brand hue. Saturated
              // brand colour for the text + emoji, ~15% opacity of the same
              // colour for the background, low-opacity border in the same
              // colour, plus a backdrop blur so it stays legible over any
              // product photo underneath. Shadow is the same across the
              // stack for visual consistency.
              let color, label, emoji, useTabular = false;
              if (b.kind === 'discount') {
                // Discount severity gradient — green / amber / red bands.
                color = b.pct > 25 ? '#dc2626'
                       : b.pct > 10 ? '#f5a623'
                       : '#34a853';
                // Heat indicator: more fire = bigger drop. >20% earns a
                // double flame, >15% a single one, smaller drops stay
                // clean. Threshold ladder per spec; appended after the
                // numeric so the eye still lands on the % first.
                const flames = b.pct > 20 ? ' 🔥🔥'
                             : b.pct > 15 ? ' 🔥'
                             : '';
                emoji = null;                                  // no money-bag icon
                label = `−${b.amount.toLocaleString('es-ES')} € (${b.pct}%)${flames}`;
                useTabular = true;
              } else {
                const def = TAG_BADGES[b.name] || { color: '#86868b', emoji: '' };
                color = def.color;
                emoji = def.emoji;
                label = b.name;
              }
              // 'A plazos' and discount share the same rounded-rectangle
              // shape (radius 8) per spec so the two derived chips read as
              // a matched pair, while editorial Product.tag badges keep
              // their pill silhouette to stay visually distinct from the
              // derived stack underneath.
              const isDerivedPair = b.kind === 'discount' || b.name === 'A plazos';
              return (
                <div
                  key={b.kind === 'discount' ? `discount-${i}` : b.name}
                  style={{
                    background: `${color}26`,                     // ≈15% opacity of the brand hue
                    color,
                    border: `1px solid ${color}55`,               // ≈33% opacity outline
                    backdropFilter: 'blur(10px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(10px) saturate(160%)',
                    fontSize: 10,
                    fontWeight: 600,
                    // Roomier padding so '−337 € (28%) 🔥🔥' breathes
                    // and isn't squeezed against the rounded edge.
                    padding: isDerivedPair ? '5px 10px' : '3.5px 9px 3.5px 7px',
                    borderRadius: isDerivedPair ? 8 : 980,
                    letterSpacing: '0.2px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    whiteSpace: 'nowrap',
                    ...(useTabular ? { fontVariantNumeric: 'tabular-nums' } : null),
                  }}
                >
                  {emoji && <span style={{ fontSize: 11, lineHeight: 1 }}>{emoji}</span>}
                  {label}
                </div>
              );
            })}
          </div>
        )}

        {/* (view counter moved to card footer next to the store name —
            keeps the photo area clean and pairs the metric with the
            other small metadata row visually) */}

        {/* Photo frame — restores rounded clipping for the product image
            that the parent had to give up so the badges can overhang. */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {hasRealPhoto ? (
          <>
            <img
              src={coverSrc}
              alt={prod.nombre}
              style={{
                position: 'absolute',
                maxWidth: '170%',
                maxHeight: '170%',
                objectFit: 'contain',
                transform: 'scale(1.05)',
                //opacity: hovered && hoverSrc && hoverSrc !== coverSrc ? 0 : 1,
                //transition: 'opacity 0.35s ease',
              }}
              onError={e => {
                e.target.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.style.fontSize = '70px';
                fallback.textContent = prod.emoji || '📦';
                e.target.parentElement.appendChild(fallback);
              }}
            />
            {hoverSrc && hoverSrc !== coverSrc && (
              <img
                //hoverSrc
                src={coverSrc}
                alt={prod.nombre}
                style={{
                  position: 'absolute',
                  maxWidth: '170%',
                  maxHeight: '170%',
                  objectFit: 'contain',
                  //transform: hovered ? 'scale(1.08)' : 'scale(1.05)',
                  transform: 'scale(1.05)',
                  //opacity: hovered ? 1 : 0,
                  //transition: 'opacity 0.35s ease, transform 0.35s ease',
                  }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}
          </>
        ) : (
            <div style={{ fontSize: 70 }}>{prod.emoji || '📦'}</div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 16px 18px' }}>
        <div style={{
          fontSize: 11,
          color: '#6e6e73',
          marginBottom: 4,
          letterSpacing: '0.1px',
          textTransform: 'capitalize',
        }}>
          {prod.cat}
        </div>

        <div style={{
          fontSize: 15,
          fontWeight: 500,
          lineHeight: 1.3,
          marginBottom: 8,
          color: '#1d1d1f',
          letterSpacing: '-0.2px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: 38,
        }}>
          {prod.nombre}
        </div>

        {prod.rating > 0 && (
          <div style={{ fontSize: 11, color: '#6e6e73', marginBottom: 6 }}>
            ★ {prod.rating}
          </div>
        )}

        <div style={{ fontSize: 11, color: '#6e6e73', marginBottom: 2 }}>
          {bestPrice ? 'Desde' : 'Sin precio'}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.3px',
            color: '#1d1d1f',
          }}>
            {bestPrice ? `${bestPrice.toLocaleString('es-ES')} €` : '—'}
          </span>
          {/* Savings line moved to badge stack on the image — here we just
              show the headline price so the price/store row stays clean. */}
        </div>

        {(storeName || viewsLabel) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 4,
            fontSize: 10,
            color: '#86868b',
          }}>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}>
              {storeName ? `en ${storeName}` : ''}
            </span>
            {viewsLabel && (
              <span
                title={`${prod.views} visualizaciones`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 500,
                  color: 'rgba(29,29,31,0.55)',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round"
                     style={{ opacity: 0.7 }}>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {viewsLabel}
              </span>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
