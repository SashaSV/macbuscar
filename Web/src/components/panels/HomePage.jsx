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
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 24px rgba(0,0,0,0.10)',
        minHeight: 300,
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
              minHeight: 300,
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              height: '100%',
              minHeight: 300,
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
  const populares = [...products].sort((a,b) => b.rating - a.rating).slice(0, 12);
  const mejorOferta = [...products].sort((a,b) => {
    const drop = h => (h && h.length >= 2) ? h[0].price - h[h.length-1].price : 0;
    return drop(b.priceHistory) - drop(a.priceHistory);
  }).slice(0, 12);

  return (
    <div>
      {/* BANNER CAROUSEL — sponsored slots */}
      <BannerCarousel />

      {/* Categories */}
      <div style={{ display:'flex', gap:8, marginBottom:28, flexWrap:'wrap' }}>
        {CATS.filter(c => c.id !== 'all').map(c => {
          const iconClass = CATEGORY_ICON[c.id] || 'ti-apps';
          return (
            <div
              key={c.id}
              onClick={() => onCategoryClick?.(c.id)}
              style={{
                display:'flex', alignItems:'center', gap:8,
                background:'rgba(255,255,255,0.55)',
                backdropFilter:'blur(20px) saturate(180%)',
                WebkitBackdropFilter:'blur(20px) saturate(180%)',
                border:'0.5px solid rgba(255,255,255,0.8)',
                borderRadius:980,
                padding:'8px 14px',
                cursor:'pointer',
                boxShadow:'inset 0 1px 0 rgba(255,255,255,0.9)',
                transition:'transform .2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
            >
              <i className={`ti ${iconClass}`} aria-hidden="true" style={{ fontSize:16, color:'#1d1d1f' }} />
              <span style={{ fontSize:12, fontWeight:500, color:'#1d1d1f' }}>{c.label}</span>
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
    </div>
  );
}
