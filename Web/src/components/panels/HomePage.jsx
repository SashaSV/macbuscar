'use client';
import TarjetaProducto from '../ui/TarjetaProducto';
import { CATS } from '../shared/constants';
import { getPrecioMap, getPriceValue } from '../shared/utils';
import { CATEGORY_ICON, getProductIcon } from '../shared/categoryIcons';

export default function HomePage({ products, precios, scrapeStatus, onSelect, onCategoryClick }) {
  const novedades = products.filter(p => ['Novedad','Pro','Ultra','Exclusivo'].includes(p.tag));
  const populares = [...products].sort((a,b) => b.rating - a.rating).slice(0, 4);
  const mejorOferta = [...products].sort((a,b) => {
    const drop = h => (h && h.length >= 2) ? h[0].price - h[h.length-1].price : 0;
    return drop(b.priceHistory) - drop(a.priceHistory);
  }).slice(0, 4);

  // Hero: the highest-rated product with a real price
  const hero = [...products].sort((a,b) => b.rating - a.rating).find(p => {
    const map = precios[p.id] || getPrecioMap(p);
    return Object.values(map).some(v => getPriceValue(v));
  }) || products[0];

  const heroPrecios = hero ? (precios[hero.id] || getPrecioMap(hero)) : {};
  const heroV = Object.values(heroPrecios).map(getPriceValue).filter(Boolean);
  const heroMin = heroV.length ? Math.min(...heroV) : null;
  const heroIcon = hero ? getProductIcon(hero) : 'ti-package';

  const Section = ({ title, items }) => {
    if (!items.length) return null;
    return (
      <div style={{ marginBottom: 34 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ fontSize:18, fontWeight:500, color:'#1d1d1f', letterSpacing:-0.3 }}>{title}</div>
          <div style={{ flex:1, height:1, background:'linear-gradient(90deg,rgba(0,0,0,0.1),transparent)' }} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:20 }}>
          {items.map(p => (
            <TarjetaProducto key={p.id} prod={p} precios={precios} scrapeStatus={scrapeStatus} onClick={() => onSelect(p)} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* HERO */}
      {hero && (
        <div style={{
          background: 'rgba(255,255,255,0.45)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: '0.5px solid rgba(255,255,255,0.7)',
          borderRadius: 24,
          padding: '28px 26px',
          marginBottom: 28,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 8px 24px rgba(168,85,247,0.08)',
        }}>
          {/* purple glow inside hero */}
          <div style={{
            position: 'absolute',
            top: -60, right: -60,
            width: 200, height: 200,
            background: 'rgba(168,85,247,0.3)',
            borderRadius: '50%',
            filter: 'blur(50px)',
            pointerEvents: 'none',
          }} />

          <div style={{ position:'relative', display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:220 }}>
              <div style={{
                display:'inline-block',
                background:'rgba(168,85,247,0.15)',
                border:'0.5px solid rgba(168,85,247,0.3)',
                padding:'3px 12px',
                borderRadius:980,
                fontSize:10,
                fontWeight:500,
                letterSpacing:1.2,
                color:'#7c3aed',
                marginBottom:12,
              }}>DESTACADO DEL MES</div>

              <h1 style={{
                fontSize:'clamp(22px, 4vw, 30px)',
                fontWeight:500,
                letterSpacing:-0.6,
                color:'#1d1d1f',
                lineHeight:1.15,
                margin:'0 0 8px',
              }}>
                {hero.nombre}
              </h1>

              {hero.desc && (
                <p style={{ fontSize:13, color:'rgba(29,29,31,0.6)', maxWidth:380, lineHeight:1.5, margin:'0 0 16px' }}>
                  {hero.desc}
                </p>
              )}

              {heroMin != null && (
                <>
                  <div style={{ fontSize:11, color:'rgba(29,29,31,0.5)', marginBottom:2 }}>Desde</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:14 }}>
                    <span style={{ fontSize:32, fontWeight:500, color:'#1d1d1f', letterSpacing:-0.7 }}>
                      {heroMin.toLocaleString('es-ES')} €
                    </span>
                  </div>
                </>
              )}

              <button
                onClick={() => onSelect(hero)}
                style={{
                  background:'#1d1d1f',
                  color:'#fff',
                  border:'none',
                  borderRadius:980,
                  padding:'10px 22px',
                  fontSize:13,
                  fontWeight:500,
                  cursor:'pointer',
                  display:'inline-flex',
                  alignItems:'center',
                  gap:6,
                  transition:'transform .2s',
                }}
                onMouseDown={e => e.currentTarget.style.transform='scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
              >
                Ver oferta <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize:14 }} />
              </button>
            </div>

            <div style={{
              width: 160, height: 160,
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink: 0,
            }}>
              <i className={`ti ${heroIcon}`} aria-hidden="true" style={{
                fontSize: 140,
                color: '#1d1d1f',
                filter: 'drop-shadow(0 12px 24px rgba(168,85,247,0.2))',
              }} />
            </div>
          </div>
        </div>
      )}

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

      <Section title="Novedades" items={novedades} />
      <Section title="Más populares" items={populares} />
      <Section title="Mejor bajada de precio" items={mejorOferta} />
    </div>
  );
}
