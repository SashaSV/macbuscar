'use client';
import { useState, useEffect } from 'react';
import TarjetaProducto from '../ui/TarjetaProducto';
import { CATS } from '../shared/constants';
import CarruselProductos from '../ui/CarruselProductos';
import { getPrecioMap, getPriceValue } from '../shared/utils';
import { CATEGORY_ICON, getProductIcon } from '../shared/categoryIcons';

/**
 * Banner Carousel — sponsored ad slots with full-bleed background images.
 * Place images in /public/banners/ and reference as "/banners/name.jpg".
 *
 * Each banner:
 *   - title, subtitle, cta, link, sponsor, accent
 *   - image: full-bleed background image (in /public/banners/)
 *   - imagePos: object-position for the bg image (default 'center right')
 *   - dark: true if image is dark → white text + scrim from left
 *   - scrim: custom overlay gradient (optional, overrides default)
 */
const BANNERS = [
  {
    id: 'iphone17-pro',
    title: 'iPhone 17 Pro',
    subtitle: 'Cámara Pro de 48 MP, zoom óptico 8x y chip A19 Pro. Diseño unibody de aluminio.',
    cta: 'Ver ofertas',
    link: '#',
    sponsor: 'Apple',
    accent: '#ff7a1a',
    image: '/banners/iphone17-pro-orange.jpg',
    imagePos: 'center 40%',
    dark: true,
  },
  {
    id: 'iphone16-colors',
    title: 'iPhone, en 5 colores',
    subtitle: 'Negro, Blanco, Lavanda, Verde Salvia y Azul. Encuentra el mejor precio en 8 tiendas.',
    cta: 'Comparar precios',
    link: '#',
    sponsor: 'macbuscar',
    accent: '#7c3aed',
    image: '/banners/iphone16-colors.jpg',
    imagePos: 'center right',
    dark: false,
  },
  {
    id: 'macbook-pro',
    title: 'MacBook Pro',
    subtitle: 'Potencia profesional con chip Apple Silicon. Hasta 200 € de descuento en MediaMarkt.',
    cta: 'Ver ofertas',
    link: 'https://www.mediamarkt.es',
    sponsor: 'MediaMarkt',
    accent: '#0a84ff',
    image: '/banners/macbook-pro.jpg',
    imagePos: 'center 30%',
    dark: true,
  },
  {
    id: 'iphone17e-colors',
    title: 'iPhone 17e, en 4 colores',
    subtitle: 'Negro, Blanco, Rosa y más. Compara el mejor precio en 8 tiendas españolas.',
    cta: 'Comparar precios',
    link: '#',
    sponsor: 'macbuscar',
    accent: '#ff375f',
    image: '/banners/iphone17e-colors.jpg',
    imagePos: 'center right',
    dark: false,
  },
  {
    id: 'airpods-pro',
    title: 'AirPods Pro',
    subtitle: 'Cancelación de ruido y audio espacial. Encuentra el precio más bajo hoy.',
    cta: 'Ver ofertas',
    link: '#',
    sponsor: 'macbuscar',
    accent: '#0a84ff',
    image: '/banners/airpods-pro.jpg',
    imagePos: 'center right',
    dark: false,
  },
];

const AUTO_ROTATE_MS = 5000;

/**
 * Category card images (Apple Tienda style). Place PNGs in /public/categories/.
 * Keyed by CATS id. If an id has no entry here, the chip falls back to its
 * Tabler icon automatically — so this never breaks onCategoryClick.
 * NOTE: verify these keys match your real CATS ids in shared/constants.js.
 */
const CATEGORY_IMG = {
  iphone: '/categories/iphone.png',
  mac: '/categories/mac.png',
  ipad: '/categories/ipad.png',
  watch: '/categories/watch.png',
  airpods: '/categories/airpods.png',
  accesorios: '/categories/accesorios.png',
};


function BannerCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || BANNERS.length <= 1) return;
    const id = setInterval(() => {
      setActive(a => (a + 1) % BANNERS.length);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        position: 'relative',
        borderRadius: 24,
        marginBottom: 28,
        // Breakout: banner extends slightly wider than the content grid on
        // larger screens, while staying inside the viewport (no h-scroll).
        marginLeft: 'calc(-1 * clamp(0px, 4vw, 56px))',
        marginRight: 'calc(-1 * clamp(0px, 4vw, 56px))',
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 24px rgba(0,0,0,0.10)',
        minHeight: 320,
      }}
    >
      {BANNERS.map((b, i) => {
        const isDark = b.dark;
        const textColor = isDark ? '#fff' : '#1d1d1f';
        const subColor = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(29,29,31,0.7)';
        // Scrim makes text readable over the image
        const scrim = b.scrim || (isDark
          ? 'linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 38%, rgba(0,0,0,0.15) 65%, rgba(0,0,0,0) 100%)'
          : 'linear-gradient(90deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.7) 40%, rgba(255,255,255,0.2) 70%, rgba(255,255,255,0) 100%)');

        return (
          <a
            key={b.id}
            href={b.link}
            target={b.link.startsWith('http') ? '_blank' : undefined}
            rel={b.link.startsWith('http') ? 'noopener sponsored' : undefined}
            style={{
              position: i === active ? 'relative' : 'absolute',
              inset: 0,
              opacity: i === active ? 1 : 0,
              transition: 'opacity .6s ease',
              display: 'block',
              textDecoration: 'none',
              cursor: 'pointer',
              pointerEvents: i === active ? 'auto' : 'none',
              backgroundColor: isDark ? '#000' : '#fff',
              backgroundImage: `${scrim}, url('${b.image}')`,
              backgroundSize: 'auto, cover',
              backgroundPosition: `left, ${b.imagePos || 'center right'}`,
              backgroundRepeat: 'no-repeat, no-repeat',
              minHeight: 320,
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              height: '100%',
              minHeight: 320,
              padding: '40px 44px',
            }}>
              <div style={{ flex: 1, maxWidth: 480, zIndex: 1 }}>
                {b.sponsor && (
                  <div style={{
                    display: 'inline-block',
                    background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.55)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)'}`,
                    padding: '4px 12px',
                    borderRadius: 980,
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: 1.2,
                    color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(29,29,31,0.6)',
                    marginBottom: 16,
                    textTransform: 'uppercase',
                  }}>
                    Patrocinado · {b.sponsor}
                  </div>
                )}

                <h2 style={{
                  fontSize: 'clamp(26px, 4vw, 40px)',
                  fontWeight: 600,
                  letterSpacing: -0.8,
                  color: textColor,
                  lineHeight: 1.08,
                  margin: '0 0 12px',
                }}>
                  {b.title}
                </h2>

                <p style={{
                  fontSize: 14,
                  color: subColor,
                  lineHeight: 1.5,
                  margin: '0 0 22px',
                  maxWidth: 380,
                }}>
                  {b.subtitle}
                </p>

                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: b.accent || '#1d1d1f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 980,
                  padding: '11px 24px',
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: `0 8px 22px ${b.accent ? b.accent + '50' : 'rgba(0,0,0,0.2)'}`,
                }}>
                  {b.cta}
                  <span style={{ fontSize: 15 }}>→</span>
                </span>
              </div>
            </div>
          </a>
        );
      })}

      {/* Dots indicator */}
      {BANNERS.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: 18,
          right: 28,
          display: 'flex',
          gap: 7,
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 980,
          border: '0.5px solid rgba(255,255,255,0.3)',
          zIndex: 2,
        }}>
          {BANNERS.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); setActive(i); }}
              aria-label={`Banner ${i + 1}`}
              style={{
                width: i === active ? 22 : 6,
                height: 6,
                borderRadius: 980,
                background: i === active ? '#fff' : 'rgba(255,255,255,0.45)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all .25s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}


export default function HomePage({ products, precios, scrapeStatus, onSelect, onCategoryClick }) {
  const novedades = products.filter(p => ['Novedad','Pro','Ultra','Exclusivo'].includes(p.tag));
  // "Más populares" is now driven by Product.views (modal-open counter
  // incremented via POST /api/products/[id]/view). We tiebreak by rating
  // so the list stays meaningful at cold start: until users start clicking
  // around, every product has views = 0 and the ordering falls back to the
  // editorial rating value. Once organic traffic kicks in, views dominates.
  const populares = [...products].sort((a, b) => {
    const va = a.views || 0;
    const vb = b.views || 0;
    if (va !== vb) return vb - va;                     // primary: views DESC
    return (b.rating || 0) - (a.rating || 0);          // tiebreak: rating DESC
  }).slice(0, 12);
  // "Mejor bajada de precio" — sort by the SAME metric we display on
  // each card's discount chip, so the visual order matches the percentages
  // the user can read. Mirrors TarjetaProducto's logic 1-to-1:
  //   1. Primary: % off Apple MSRP for the bestVariant
  //   2. Fallback (no MSRP): cross-store spread on the bestVariant only
  // 100% of catalog variants currently have variant.msrp populated, so the
  // primary path is what's in play for every product today.
  const calcSavingsPct = (p) => {
    // bestPrice: precios-map first, fallback to minPrice/basePrice —
    // identical to TarjetaProducto.
    const precioMap = precios?.[p.id] || getPrecioMap(p);
    let bestPrice = null;
    if (precioMap && typeof precioMap === 'object') {
      for (const val of Object.values(precioMap)) {
        const pv = getPriceValue(val);
        if (typeof pv === 'number' && pv > 0 && (bestPrice == null || pv < bestPrice)) {
          bestPrice = pv;
        }
      }
    }
    if (bestPrice == null) bestPrice = p.minPrice;
    if (bestPrice == null) bestPrice = p.basePrice;
    if (!bestPrice || bestPrice <= 0) return 0;

    const bestVar = p.bestVariantId
      ? p.variants?.find(v => v.id === p.bestVariantId)
      : p.variants?.find(v => (v.prices || []).some(pr => pr.price === bestPrice));
    if (!bestVar) return 0;

    // 1. Primary: vs Apple MSRP
    const msrp = bestVar.msrp;
    if (msrp && msrp > bestPrice) {
      return (msrp - bestPrice) / msrp;
    }

    // 2. Fallback: cross-store spread on this variant only
    const varPrices = (bestVar.prices || [])
      .map(pr => pr.price)
      .filter(pr => typeof pr === 'number' && pr > 0);
    if (varPrices.length < 2) return 0;
    const max = Math.max(...varPrices);
    const min = Math.min(...varPrices);
    if (max <= min) return 0;
    return (max - min) / max;
  };
  const mejorOferta = [...products]
    .map(p => ({ p, pct: calcSavingsPct(p) }))
    .filter(x => x.pct > 0)
    .sort((a, b) => b.pct - a.pct)         // descending by %
    .slice(0, 12)
    .map(x => x.p);

  // "Bajada del mes" — windowed version of the MSRP comparison: % off
  // Apple MSRP that this variant REACHED in the last 30 days. Surfaces
  // "recent biggest drops". Even if a variant is back at 10% off today,
  // a mid-month dip to 35% off makes it a "−35% този місяць" candidate —
  // because the user wants to be reminded that such a deal is possible.
  const calcMonthDropPct = (p) => {
    const bestVar = p.bestVariantId
      ? p.variants?.find(v => v.id === p.bestVariantId)
      : null;
    if (!bestVar) {
      // Resolve bestPrice for variant fallback search.
      const precioMap = precios?.[p.id] || getPrecioMap(p);
      let bestPrice = null;
      if (precioMap && typeof precioMap === 'object') {
        for (const val of Object.values(precioMap)) {
          const pv = getPriceValue(val);
          if (typeof pv === 'number' && pv > 0 && (bestPrice == null || pv < bestPrice)) {
            bestPrice = pv;
          }
        }
      }
      if (bestPrice == null) bestPrice = p.minPrice;
      if (bestPrice == null) bestPrice = p.basePrice;
      const found = p.variants?.find(v => (v.prices || []).some(pr => pr.price === bestPrice));
      if (!found) return 0;
      return calcWindowDrop(found);
    }
    return calcWindowDrop(bestVar);
  };
  const calcWindowDrop = (bestVar) => {
    const msrp = bestVar?.msrp;
    if (!msrp || msrp <= 0) return 0;
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentHistory = (bestVar.priceHistory || [])
      .filter(ph => ph?.date && new Date(ph.date).getTime() >= monthAgo)
      .map(ph => ph.price);
    const currentPrices = (bestVar.prices || []).map(pr => pr.price);
    const all = [...recentHistory, ...currentPrices]
      .filter(pr => typeof pr === 'number' && pr > 0);
    if (all.length === 0) return 0;
    const minMonth = Math.min(...all);
    if (minMonth >= msrp) return 0;
    return (msrp - minMonth) / msrp;
  };
  const bajadaMes = [...products]
    .map(p => ({ p, drop: calcMonthDropPct(p) }))
    .filter(x => x.drop > 0)
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 12)
    .map(x => x.p);

  return (
    <div>
      {/* BANNER CAROUSEL — sponsored slots */}
      <BannerCarousel />

      {/* Categories — Apple Tienda style: product image on top, label below */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))',
        gap:12,
        marginBottom:32,
      }}>
        {CATS.filter(c => c.id !== 'all').map(c => {
          const imgSrc = CATEGORY_IMG[c.id];
          const iconClass = CATEGORY_ICON[c.id] || 'ti-apps';
          return (
            <div
              key={c.id}
              onClick={() => onCategoryClick?.(c.id)}
              style={{
                display:'flex',
                flexDirection:'column',
                alignItems:'center',
                gap:6,
                background:'rgba(255,255,255,0.55)',
                backdropFilter:'blur(20px) saturate(180%)',
                WebkitBackdropFilter:'blur(20px) saturate(180%)',
                border:'0.5px solid rgba(255,255,255,0.8)',
                borderRadius:20,
                padding:'14px 12px 16px',
                cursor:'pointer',
                boxShadow:'inset 0 1px 0 rgba(255,255,255,0.9)',
                transition:'transform .2s, box-shadow .2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform='translateY(-3px)';
                e.currentTarget.style.boxShadow='inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 22px rgba(0,0,0,0.10)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform='translateY(0)';
                e.currentTarget.style.boxShadow='inset 0 1px 0 rgba(255,255,255,0.9)';
              }}
            >
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={c.label}
                  loading="lazy"
                  style={{
                    width:'100%',
                    maxWidth:110,
                    height:72,
                    objectFit:'contain',
                    mixBlendMode:'multiply', // blends the light grey card bg into the glass
                  }}
                />
              ) : (
                <div style={{ height:72, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className={`ti ${iconClass}`} aria-hidden="true" style={{ fontSize:34, color:'#1d1d1f' }} />
                </div>
              )}
              <span style={{ fontSize:13, fontWeight:500, color:'#1d1d1f', textAlign:'center' }}>{c.label}</span>
            </div>
          );
        })}
      </div>

      <CarruselProductos
        titulo="Novedades"
        productos={novedades}
        precios={precios}
        scrapeStatus={scrapeStatus}
        onAbrir={onSelect}
      />
      <CarruselProductos
        titulo="Más populares"
        productos={populares}
        precios={precios}
        scrapeStatus={scrapeStatus}
        onAbrir={onSelect}
      />
      <CarruselProductos
        titulo="Mejor bajada de precio"
        productos={mejorOferta}
        precios={precios}
        scrapeStatus={scrapeStatus}
        onAbrir={onSelect}
      />
      {bajadaMes.length > 0 && (
        <CarruselProductos
          titulo="Bajada del mes"
          productos={bajadaMes}
          precios={precios}
          scrapeStatus={scrapeStatus}
          ahorroMode="month"
          onAbrir={onSelect}
        />
      )}
    </div>
  );
}
