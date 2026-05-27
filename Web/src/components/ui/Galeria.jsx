'use client';
import { useState, useEffect } from 'react';

/**
 * Galería de fotos del producto en estilo Apple.
 *
 * Props:
 *   - fotos: array de URLs (string[]) o JSON string
 *   - labels: array de etiquetas (Frontal, Trasera, Lateral...) opcional
 *   - emoji: emoji fallback si no hay fotos
 */
export default function Galeria({ fotos, labels, emoji }) {
  // Normalize input - might be JSON string from DB or array
  let imgs = [];
  try {
    imgs = typeof fotos === 'string' ? JSON.parse(fotos) : (fotos || []);
  } catch { imgs = []; }

  let lbls = [];
  try {
    lbls = typeof labels === 'string' ? JSON.parse(labels) : (labels || []);
  } catch { lbls = []; }

  const [active, setActive] = useState(0);

  // Reset to 0 when fotos change (e.g. product switch)
  useEffect(() => { setActive(0); }, [fotos]);

  if (!imgs.length) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 420,
        background: 'rgba(0,0,0,0.02)',
        borderRadius: 16,
        fontSize: 90,
      }}>
        {emoji || '📦'}
      </div>
    );
  }

  const goPrev = () => setActive((active - 1 + imgs.length) % imgs.length);
  const goNext = () => setActive((active + 1) % imgs.length);

  // Keyboard nav
  useEffect(() => {
    const fn = e => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [active, imgs.length]);

  return (
    <div style={{ width: '100%' }}>
      {/* Main image with arrows */}
      <div style={{
        position: 'relative',
        background: 'rgba(0,0,0,0.02)',
        borderRadius: 18,
        height: 460,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <img
          key={active}
          src={imgs[active]}
          alt={lbls[active] || `Foto ${active + 1}`}
          style={{
            width: '170%',
            height: '170%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.08))',
            animation: 'fadeImg .25s ease',
          }}
          onError={e => { e.target.style.display = 'none'; }}
        />

        {/* Label badge */}
        {lbls[active] && (
          <div style={{
            position: 'absolute',
            top: 16, left: 16,
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: '6px 14px',
            borderRadius: 980,
            fontSize: 11,
            fontWeight: 500,
            color: '#1d1d1f',
            border: '0.5px solid rgba(0,0,0,0.06)',
          }}>
            {lbls[active]}
          </div>
        )}

        {/* Counter */}
        <div style={{
          position: 'absolute',
          top: 16, right: 16,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(20px)',
          padding: '5px 12px',
          borderRadius: 980,
          fontSize: 11,
          fontWeight: 500,
          color: '#fff',
          fontFamily: 'ui-monospace,monospace',
        }}>
          {active + 1} / {imgs.length}
        </div>

        {/* Arrow buttons */}
        {imgs.length > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Anterior"
              style={arrowStyle('left')}
            >‹</button>
            <button
              onClick={goNext}
              aria-label="Siguiente"
              style={arrowStyle('right')}
            >›</button>
          </>
        )}

        {/* Dots indicator */}
        {imgs.length > 1 && (
          <div style={{
            position: 'absolute',
            bottom: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 6,
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 980,
            border: '0.5px solid rgba(0,0,0,0.06)',
          }}>
            {imgs.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                style={{
                  width: i === active ? 22 : 6,
                  height: 6,
                  borderRadius: 980,
                  background: i === active ? '#1d1d1f' : 'rgba(29,29,31,0.3)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all .25s',
                }}
                aria-label={`Ir a foto ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {imgs.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 14,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'thin',
        }}>
          {imgs.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                flexShrink: 0,
                width: 72,
                height: 72,
                background: 'rgba(0,0,0,0.02)',
                border: `2px solid ${i === active ? '#1d1d1f' : 'transparent'}`,
                borderRadius: 12,
                cursor: 'pointer',
                padding: 4,
                transition: 'all .15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
              aria-label={`Ver foto ${i + 1}`}
            >
              <img
                src={src}
                alt=""
                style={{
                  width: '140%',
                  height: '140%',
                  objectFit: 'contain',
                  opacity: i === active ? 1 : 0.6,
                }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeImg {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function arrowStyle(side) {
  return {
    position: 'absolute',
    [side]: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '0.5px solid rgba(0,0,0,0.08)',
    cursor: 'pointer',
    fontSize: 22,
    color: '#1d1d1f',
    fontWeight: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    paddingBottom: 3,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    transition: 'all .15s',
  };
}
