'use client';
import { useState, useEffect } from 'react';
import Galeria from '../ui/Galeria';
import BarraPrecios from '../ui/BarraPrecios';
import HistorialChart from '../ui/HistorialChart';
import Resenas from '../ui/Resenas';
import Dot from '../ui/Dot';
import { TIENDAS, TABS } from '../shared/constants';
import { getMejor, getPrecioMap, colorEstado, getPriceValue, getPriceUrl } from '../shared/utils';
import { getProductIcon } from '../shared/categoryIcons';

export default function ModalProducto({ prod, precios, scrapeStatus, onCerrar, onAnuncio, onScrapeOne }) {
  const [tab, setTab] = useState('Galería');
  const pP = precios[prod.id] || getPrecioMap(prod);
  const pS = scrapeStatus?.[prod.id] || {};
  const v = Object.values(pP).map(getPriceValue).filter(Boolean);
  const minP = v.length ? Math.min(...v) : null;
  const maxP = v.length ? Math.max(...v) : null;
  const [mejId] = getMejor(pP);
  const mejT = TIENDAS.find(t => t.id === mejId);
  const isLoading = Object.values(pS).some(s => s === 'loading');
  const iconClass = getProductIcon(prod);

  useEffect(() => {
    const fn = e => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onCerrar]);

  const tabStyle = active => ({
    flex: 'none',
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: active ? '#1d1d1f' : 'rgba(29,29,31,0.5)',
    borderBottom: `2px solid ${active ? '#1d1d1f' : 'transparent'}`,
    transition: 'all .2s',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn .2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '0.5px solid rgba(255,255,255,0.9)',
          borderRadius: 28,
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 30px 80px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 14 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 500, color: '#1d1d1f', letterSpacing: -0.3, lineHeight: 1.25 }}>
                {prod.nombre}
              </div>
              {prod.rating > 0 && (
                <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>
                  {'★'.repeat(Math.round(prod.rating))}
                  <span style={{ color: 'rgba(29,29,31,0.4)', marginLeft: 4 }}>{prod.rating}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {minP != null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: 'rgba(29,29,31,0.4)', letterSpacing: 0.4 }}>MEJOR PRECIO</div>
                  <div style={{ fontSize: 19, fontWeight: 500, color: '#047857', letterSpacing: -0.4 }}>
                    {minP.toLocaleString('es-ES')} €
                  </div>
                </div>
              )}
              <button
                onClick={() => onScrapeOne(prod)}
                disabled={isLoading}
                title="Actualizar precios"
                style={{
                  background: 'rgba(59,130,246,0.15)',
                  border: '0.5px solid rgba(59,130,246,0.4)',
                  borderRadius: 980,
                  width: 32, height: 32,
                  color: '#1d4ed8',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <i
                  className={`ti ${isLoading ? 'ti-loader-2' : 'ti-refresh'}`}
                  aria-hidden="true"
                  style={{ fontSize: 14, animation: isLoading ? 'spin 1s linear infinite' : 'none' }}
                />
              </button>
              <button
                onClick={onCerrar}
                title="Cerrar"
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  border: '0.5px solid rgba(0,0,0,0.08)',
                  borderRadius: 980,
                  width: 32, height: 32,
                  color: '#1d1d1f',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <i className="ti ti-x" aria-hidden="true" style={{ fontSize: 16 }} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', overflowX: 'auto', gap: 2, scrollbarWidth: 'none' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>
                {t}{t === '2ª mano' && prod.listings?.length > 0 ? ` (${prod.listings.length})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px 24px' }}>
          {tab === 'Galería' && (
            <>
              {/* Big icon header */}
              <div style={{
                background: 'rgba(255,255,255,0.6)',
                border: '0.5px solid rgba(255,255,255,0.85)',
                borderRadius: 20,
                padding: 28,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
              }}>
                <i className={`ti ${iconClass}`} aria-hidden="true" style={{ fontSize: 140, color: '#1d1d1f' }} />
              </div>
              <Galeria fotos={prod.fotos} labels={prod.fotoLabels} emoji={prod.emoji} />
              {prod.desc && (
                <div style={{ fontSize: 13, color: 'rgba(29,29,31,0.7)', lineHeight: 1.6, marginTop: 12 }}>{prod.desc}</div>
              )}
            </>
          )}

          {tab === 'Características' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(prod.specs || {}).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    border: '0.5px solid rgba(255,255,255,0.8)',
                    borderRadius: 14,
                    padding: '10px 13px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
                  }}
                >
                  <div style={{ fontSize: 10, color: 'rgba(29,29,31,0.5)', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1d1d1f' }}>{v}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'Precios' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(29,29,31,0.5)' }}>{mejT?.nombre}</div>
                  <div style={{ fontSize: 28, fontWeight: 500, color: '#047857', letterSpacing: -0.6 }}>
                    {minP != null ? `${minP.toLocaleString('es-ES')} €` : '—'}
                  </div>
                </div>
                {maxP && minP && maxP - minP > 0 && (
                  <div style={{
                    background: 'rgba(16,185,129,0.15)',
                    border: '0.5px solid rgba(16,185,129,0.35)',
                    borderRadius: 16,
                    padding: '6px 16px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 10, color: '#047857', letterSpacing: 0.5 }}>AHORRO</div>
                    <div style={{ fontSize: 20, fontWeight: 500, color: '#047857' }}>−{Math.round(maxP - minP)} €</div>
                  </div>
                )}
              </div>

              <BarraPrecios precios={pP} statuses={pS} />

              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {TIENDAS.filter(t => getPriceValue(pP[t.id]) != null).map(t => {
                  const es = t.id === mejId;
                  const st = pS[t.id];
                  const price = getPriceValue(pP[t.id]);
                  const productUrl = getPriceUrl(pP[t.id]) || t.url;
                  return (
                    <a
                      key={t.id}
                      href={productUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 14px',
                        background: es ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.5)',
                        border: `0.5px solid ${es ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.8)'}`,
                        borderRadius: 16,
                        textDecoration: 'none',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{t.logo}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: 'rgba(29,29,31,0.5)' }}>{t.nombre}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Dot status={st} />
                          <span style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: es ? '#047857' : '#1d1d1f',
                            letterSpacing: -0.2,
                          }}>
                            {st === 'loading' ? '—' : st === 'error' ? 'Error' : `${price?.toLocaleString('es-ES')} €`}
                          </span>
                        </div>
                      </div>
                      {es && <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: 16, color: '#f59e0b' }} />}
                    </a>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'Reseñas' && <Resenas reviews={prod.reviews || []} />}
          {tab === 'Historial' && <HistorialChart historial={prod.priceHistory || []} />}

          {tab === '2ª mano' && (
            <>
              <button
                onClick={onAnuncio}
                style={{
                  width: '100%',
                  marginBottom: 14,
                  padding: '11px',
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px dashed rgba(245,158,11,0.5)',
                  borderRadius: 14,
                  color: '#b45309',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <i className="ti ti-plus" aria-hidden="true" /> Publicar anuncio de segunda mano
              </button>
              {!prod.listings?.length ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'rgba(29,29,31,0.4)' }}>
                  <i className="ti ti-inbox" aria-hidden="true" style={{ fontSize: 32 }} />
                  <div style={{ marginTop: 8 }}>Sin anuncios</div>
                </div>
              ) : prod.listings.map(a => (
                <div
                  key={a.id}
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    border: '0.5px solid rgba(255,255,255,0.8)',
                    borderRadius: 14,
                    padding: '13px 15px',
                    marginBottom: 10,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 500, color: '#b45309', letterSpacing: -0.3 }}>{a.precio} €</span>
                    <span style={{
                      background: colorEstado(a.estado) + '22',
                      color: colorEstado(a.estado),
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '3px 10px',
                      borderRadius: 980,
                    }}>{a.estado}</span>
                  </div>
                  {a.fotos?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto' }}>
                      {a.fotos.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt=""
                          style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}
                          onError={e => e.target.style.display = 'none'}
                        />
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'rgba(29,29,31,0.65)', lineHeight: 1.5, marginBottom: 7 }}>{a.descripcion}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'rgba(29,29,31,0.4)' }}>
                    <span><i className="ti ti-map-pin" aria-hidden="true" /> {a.ciudad}</span>
                    <span><i className="ti ti-user" aria-hidden="true" /> {a.vendedor}</span>
                    <span><i className="ti ti-calendar" aria-hidden="true" /> {new Date(a.createdAt).toLocaleDateString('es-ES')}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
