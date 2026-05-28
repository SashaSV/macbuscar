'use client';
import { useRef, useState, useEffect } from 'react';
import { colorEstado } from '../shared/utils';

/**
 * Horizontal carousel of second-hand listings (Segunda mano) for the home page.
 *
 * Each item is the product's listing enriched with product info:
 *   { ...listing, _prod: { id, nombre, emoji } }
 *
 * Clicking a card calls onAbrir(prod) — the parent opens the product modal
 * (ideally on the "2ª mano" tab).
 */
export default function CarruselAnuncios({ titulo = 'Segunda mano', anuncios, onAbrir }) {
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
  }, [anuncios]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 260 * 2, behavior: 'smooth' });
  };

  if (!anuncios?.length) return null;

  return (
    <section style={{ position: 'relative', margin: '0 auto 40px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, padding: '0 4px',
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: '#1d1d1f', letterSpacing: '-0.3px' }}>
          {titulo}
          <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(29,29,31,0.4)', marginLeft: 10 }}>
            de segunda mano
          </span>
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => scroll(-1)} disabled={!canLeft} aria-label="Anterior" style={arrowStyle(canLeft)}>‹</button>
          <button onClick={() => scroll(1)} disabled={!canRight} aria-label="Siguiente" style={arrowStyle(canRight)}>›</button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="hide-scrollbar"
        style={{
          display: 'flex', gap: 14,
          overflowX: 'auto', overflowY: 'visible',
          scrollSnapType: 'x mandatory', scrollBehavior: 'smooth',
          paddingTop: 12, paddingBottom: 16, paddingLeft: 4, paddingRight: 4,
          marginLeft: -4, marginRight: -4,
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}
      >
        {anuncios.map(a => {
          const foto = Array.isArray(a.fotos) ? a.fotos[0] : null;
          const prod = a._prod || {};
          const estadoColor = colorEstado(a.estado);
          return (
            <div
              key={a.id}
              onClick={() => onAbrir && onAbrir(prod)}
              style={{
                flex: '0 0 240px',
                scrollSnapAlign: 'start',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '0.5px solid rgba(255,255,255,0.8)',
                borderRadius: 18,
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
                transition: 'transform .2s, box-shadow .2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 26px rgba(0,0,0,0.10)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.9)';
              }}
            >
              {/* Photo */}
              <div style={{
                position: 'relative',
                height: 170,
                background: 'rgba(0,0,0,0.03)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {foto ? (
                  <img
                    src={foto}
                    alt={prod.nombre || 'Anuncio'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div style={{ fontSize: 52 }}>{prod.emoji || '📦'}</div>
                )}
                {/* Estado badge */}
                <div style={{
                  position: 'absolute', top: 10, left: 10,
                  background: estadoColor + '22',
                  color: estadoColor,
                  fontSize: 10, fontWeight: 600,
                  padding: '3px 10px', borderRadius: 980,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: `0.5px solid ${estadoColor}55`,
                }}>{a.estado}</div>
                {/* 2ª mano tag */}
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  fontSize: 9, fontWeight: 600,
                  padding: '3px 9px', borderRadius: 980,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}>2ª mano</div>
              </div>

              {/* Info */}
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: '#1d1d1f',
                  letterSpacing: '-0.2px', marginBottom: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {prod.nombre || 'Producto'}
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 700, color: '#f5a623',
                  fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.5px',
                  marginBottom: 6,
                }}>
                  {a.precio}€
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: 'rgba(29,29,31,0.5)',
                }}>
                  <i className="ti ti-map-pin" aria-hidden="true" style={{ fontSize: 13 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.ciudad}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
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
