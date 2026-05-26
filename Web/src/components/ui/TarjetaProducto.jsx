'use client';
import { useState } from 'react';
import { TAG_COLORS, TIENDAS } from '../shared/constants';
import { getPrecioMap, getMejor } from '../shared/utils';

export default function TarjetaProducto({ prod, tiendas, abrir, precios, scrapeStatus, onClick }) {
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
  const hasRealPhoto = fotos.length > 0 && typeof fotos[0] === 'string' && fotos[0].startsWith('http');

  const tagColor = TAG_COLORS?.[prod.tag] || '#86868b';

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

  const ahorro = (bestPrice && prod.specs?.precioReferencia)
    ? Math.round(prod.specs.precioReferencia - bestPrice)
    : null;

  return (
    <div
      onClick={() => handleClick && handleClick(prod)}
      style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        borderRadius: 22,
        overflow: 'hidden',
        cursor: 'pointer',
        border: '0.5px solid rgba(255,255,255,0.8)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 14px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1), box-shadow 0.35s ease, background 0.3s',
        position: 'relative',
      }}
      onMouseEnter={e => {
        setHovered(true);
        e.currentTarget.style.transform = 'translateY(-6px)';
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.95), 0 18px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(168,85,247,0.08)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.7)';
      }}
      onMouseLeave={e => {
        setHovered(false);
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 14px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.55)';
      }}
    >
      <div style={{
aspectRatio: '1',
        background: 'rgba(255, 255, 255, 0.65)', // М'яке світле підклад-тло від Apple
        borderRadius: 16,                        // Закруглення внутрішньої вітрини
        margin: '12px 12px 0 12px',              // Елегантні відступи від країв картки
        border: '1px solid rgba(255, 255, 255, 0.7)', // Тонка преміальна рамка вітрини
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {prod.tag && (
          <div style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: tagColor,
            color: '#fff',
            fontSize: 10,
            fontWeight: 500,
            padding: '4px 9px',
            borderRadius: 980,
            letterSpacing: '0.2px',
            zIndex: 1,
          }}>
            {prod.tag}
          </div>
        )}

        {hasRealPhoto ? (
          <>
            <img
              src={fotos[0]}
              alt={prod.nombre}
              style={{
                position: 'absolute',
                maxWidth: '180%',
                maxHeight: '180%',
                objectFit: 'contain',
                transform: 'scale(1.05)',
                opacity: hovered && fotos.length > 1 ? 0 : 1,
                transition: 'opacity 0.35s ease',
                mixBlendMode: 'multiply', // Повністю розчиняє білий фон у підкладці Bento
              }}
              onError={e => {
                e.target.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.style.fontSize = '70px';
                fallback.textContent = prod.emoji || '📦';
                e.target.parentElement.appendChild(fallback);
              }}
            />
            {fotos.length > 1 && (
              <img
                src={fotos[1]}
                alt={prod.nombre}
                style={{
                  position: 'absolute',
                  maxWidth: '180%',
                  maxHeight: '180%',
                  objectFit: 'contain',
                  transform: hovered ? 'scale(1.08)' : 'scale(1.05)',
                  opacity: hovered ? 1 : 0,
                  transition: 'opacity 0.35s ease, transform 0.35s ease',
                  mixBlendMode: 'multiply', // Повністю розчиняє білий фон у підкладці Bento
                }}
              />
            )}
          </>
        ) : (
          <div style={{ fontSize: 70 }}>{prod.emoji || '📦'}</div>
        )}
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
          {ahorro > 0 && (
            <span style={{
              fontSize: 11,
              color: '#34a853',
              fontWeight: 500,
            }}>
              −{ahorro} €
            </span>
          )}
        </div>

        {storeName && (
          <div style={{
            fontSize: 10,
            color: '#86868b',
            marginTop: 4,
          }}>
            en {storeName}
          </div>
        )}
      </div>
    </div>
  );
}
