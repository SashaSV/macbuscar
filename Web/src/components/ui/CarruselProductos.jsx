'use client';
import { useRef, useState, useEffect } from 'react';
import TarjetaProducto from '../ui/TarjetaProducto';

/**
 * Horizontal-scrolling product carousel with left/right arrow buttons.
 *
 * Usage in HomePage.jsx:
 *   <CarruselProductos
 *     titulo="Novedades"
 *     productos={novedades}
 *     precios={precios}
 *     onAbrir={setSelProd}
 *   />
 */
export default function CarruselProductos({ titulo, productos, precios, scrapeStatus, onAbrir }) {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 5);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [productos]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll roughly one card width per click
    const cardWidth = 340;
    el.scrollBy({ left: dir * cardWidth * 2, behavior: 'smooth' });
  };

  if (!productos?.length) return null;

  return (
    <section style={{ position: 'relative', margin: '0 auto 40px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        padding: '0 4px',
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: '#1d1d1f', letterSpacing: '-0.3px' }}>
          {titulo}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => scroll(-1)}
            disabled={!canLeft}
            aria-label="Anterior"
            style={arrowStyle(canLeft)}
          >
            ‹
          </button>
          <button
            onClick={() => scroll(1)}
            disabled={!canRight}
            aria-label="Siguiente"
            style={arrowStyle(canRight)}
          >
            ›
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: 16,
          overflowX: 'auto',
          overflowY: 'visible',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          paddingTop: 12,
          paddingBottom: 16,
          paddingLeft: 4,
          paddingRight: 4,
          marginLeft: -4,
          marginRight: -4,
          // Hide scrollbar on most browsers
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        className="hide-scrollbar"
      >
        {productos.map(p => (
          <div
            key={p.id}
            style={{
              flex: '0 0 320px',
              scrollSnapAlign: 'start',
            }}
          >
            <TarjetaProducto
              prod={p}
              precios={precios}
              scrapeStatus={scrapeStatus}
              onClick={() => onAbrir && onAbrir(p)}
            />
          </div>
        ))}
      </div>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}

const arrowStyle = (enabled) => ({
  width: 36, height: 36,
  borderRadius: '50%',
  background: enabled ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
  border: '1px solid rgba(0,0,0,0.08)',
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontSize: 18,
  color: enabled ? '#1d1d1f' : 'rgba(29,29,31,0.3)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all .2s',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: enabled ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
});
