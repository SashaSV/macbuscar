'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  IconDeviceMobile, IconShieldCheck, IconCpu, IconSparkles,
  IconBattery3, IconMagnet, IconUsb, IconCamera, IconCameraSelfie,
  IconZoom, IconAlertHexagon, IconScreenShare, IconDeviceImac,
  IconCameraPlus, IconRotate360, IconWifi, IconNfc, IconBluetooth,
  IconShield, IconFingerprint, IconRuler2, IconDatabase, IconPalette,
  IconBroadcast, IconSim, IconMicrophone, IconBrandApple, IconWeight,
  IconCompass, IconLock, IconAccessPoint, IconDots,
} from '@tabler/icons-react';
import Galeria from '../ui/Galeria';
import BarraPrecios from '../ui/BarraPrecios';
import HistorialChart from '../ui/HistorialChart';
import Resenas from '../ui/Resenas';
import Dot from '../ui/Dot';
import { TIENDAS } from '../shared/constants';
import { colorEstado } from '../shared/utils';

const TABS = ['Precios', 'Galería', 'Características', 'Reseñas', 'Historial', '2ª mano'];

// Filter dimensions to expose in UI (in order)
const FILTER_FIELDS = ['memory', 'color', 'display', 'connectivity', 'cpu', 'bandSize'];
const FILTER_LABELS = {
  memory: 'Almacenamiento',
  color: 'Color',
  display: 'Pantalla',
  connectivity: 'Conectividad',
  cpu: 'Chip',
  bandSize: 'Tamaño',
};

// Apple compare badge icons → Tabler React components
const ICON_MAP = {
  'design':                  IconDeviceMobile,
  'ceramic':                 IconShieldCheck,
  'chip-a19pro':             IconCpu,
  'chip-a19':                IconCpu,
  'chip-a18pro':             IconCpu,
  'chip-a18':                IconCpu,
  'chip-a16':                IconCpu,
  'apple-intelligence':      IconSparkles,
  'battery':                 IconBattery3,
  'magsafe':                 IconMagnet,
  'usbc':                    IconUsb,
  'camera-triple4-alt':      IconCamera,
  'camera-triple3-alt':      IconCamera,
  'camera-double-alt':       IconCamera,
  'camera-single-alt':       IconCamera,
  'camera-single-air-alt':   IconCamera,
  'camera-center-stage':     IconCameraSelfie,
  'optical-zoom2':           IconZoom,
  'optical-zoom5':           IconZoom,
  'optical-zoom8':           IconZoom,
  'optical-zoom9':           IconZoom,
  'sos':                     IconAlertHexagon,
};

// Default section → Tabler icon
const SECTION_ICONS = {
  summary:        IconDots,
  display:        IconScreenShare,
  chip:           IconCpu,
  camera:         IconCamera,
  front:          IconCameraSelfie,
  video:          IconCameraPlus,
  power:          IconBattery3,
  measurements:   IconRuler2,
  capacity:       IconDatabase,
  colors:         IconPalette,
  connector:      IconUsb,
  cellular:       IconBroadcast,
  sim:            IconSim,
  resistance:     IconShield,
  safety:         IconAlertHexagon,
  sensors:        IconCompass,
  authentication: IconFingerprint,
  siri:           IconMicrophone,
  tech:           IconAccessPoint,
  apple:          IconBrandApple,
};

// Apple compare section keys → Spanish labels
const SECTION_LABELS = {
  summary:        'Resumen',
  display:        'Pantalla',
  chip:           'Chip y procesador',
  camera:         'Cámara trasera',
  front:          'Cámara frontal',
  video:          'Vídeo',
  power:          'Batería y carga',
  measurements:   'Tamaño y peso',
  capacity:       'Capacidad',
  colors:         'Acabados',
  connector:      'Conectividad',
  cellular:       'Red móvil',
  sim:            'SIM',
  resistance:     'Resistencia',
  safety:         'Funciones de seguridad',
  sensors:        'Sensores',
  authentication: 'Autenticación',
  siri:           'Siri',
  tech:           'Tecnologías',
  apple:          'Servicios Apple',
};

export default function ModalProducto({ prod, precios, scrapeStatus, onCerrar, onAnuncio, onScrapeOne }) {
  const variants = prod.variants || [];

  // Build best price map per variant: variantId → { storeId: {price,url,updatedAt} }
  const variantPriceMaps = useMemo(() => {
    const map = {};
    for (const v of variants) {
      const m = {};
      for (const pr of (v.prices || [])) {
        if (!pr.price || pr.price <= 0) continue;
        if (!m[pr.storeId] || pr.price < m[pr.storeId].price) {
          m[pr.storeId] = { price: pr.price, url: pr.url, updatedAt: pr.updatedAt };
        }
      }
      map[v.id] = m;
    }
    return map;
  }, [variants]);

  // Variants that have at least one active price
  const variantsWithPrice = useMemo(
    () => variants.filter(v => Object.keys(variantPriceMaps[v.id] || {}).length > 0),
    [variants, variantPriceMaps]
  );

  // Build available options per filter dimension — only from priced variants
  const filterOptions = useMemo(() => {
    const opts = {};
    const pool = variantsWithPrice.length ? variantsWithPrice : variants;
    for (const field of FILTER_FIELDS) {
      const values = [...new Set(pool.map(v => v[field]).filter(Boolean))];
      if (values.length > 1) opts[field] = values;
    }
    return opts;
  }, [variantsWithPrice, variants]);

  // Find cheapest variant (default selection) — only consider priced variants
  const cheapestVariantId = useMemo(() => {
    let best = null, bestPrice = Infinity;
    const pool = variantsWithPrice.length ? variantsWithPrice : variants;
    for (const v of pool) {
      const priceMap = variantPriceMaps[v.id] || {};
      const prices = Object.values(priceMap).map(p => p.price);
      if (!prices.length) continue;
      const minP = Math.min(...prices);
      if (minP < bestPrice) { bestPrice = minP; best = v.id; }
    }
    return best || (pool[0]?.id);
  }, [variantsWithPrice, variants, variantPriceMaps]);

  // Initial selected filters = filters of cheapest variant
  const cheapestVariant = variants.find(v => v.id === cheapestVariantId);
  const initialSelected = {};
  if (cheapestVariant) {
    for (const f of FILTER_FIELDS) {
      if (filterOptions[f]) initialSelected[f] = cheapestVariant[f];
    }
  }
  const [selected, setSelected] = useState(initialSelected);
  const [tab, setTab] = useState('Precios');

  // Find variant matching ALL selected filters
  const selectedVariant = useMemo(() => {
    return variants.find(v =>
      Object.entries(selected).every(([k, val]) => !val || v[k] === val)
    ) || variants[0];
  }, [variants, selected]);

  // Active price map for selected variant
  const pP = selectedVariant ? (variantPriceMaps[selectedVariant.id] || {}) : {};
  const pS = scrapeStatus?.[prod.id] || {};
  const prices = Object.values(pP).map(p => p.price).filter(Boolean);
  const minP = prices.length ? Math.min(...prices) : null;
  const maxP = prices.length ? Math.max(...prices) : null;
  const bestStoreId = Object.entries(pP).find(([, p]) => p.price === minP)?.[0];
  const mejT = bestStoreId ? TIENDAS.find(t => t.id === bestStoreId) : null;

  useEffect(() => {
    const fn = e => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onCerrar]);

  const tabStyle = a => ({
    flex: 1,
    padding: '16px 0',
    fontSize: 15,
    fontWeight: a ? 600 : 400,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: a ? '#1d1d1f' : 'rgba(29,29,31,0.55)',
    borderBottom: `2px solid ${a ? '#1d1d1f' : 'transparent'}`,
    transition: 'all .2s',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.2px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
  });

  return (
    <div onClick={onCerrar} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.35)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, animation: 'fadeIn .2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '0.5px solid rgba(255,255,255,0.8)',
        borderRadius: 22,
        width: '100%', maxWidth: 1140, maxHeight: '94vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 28px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.4px' }}>{prod.nombre}</div>
              {prod.rating > 0 && (
                <div style={{ fontSize: 12, color: '#f5a623', marginTop: 4 }}>
                  {'★'.repeat(Math.round(prod.rating))} <span style={{ color: 'rgba(29,29,31,0.4)' }}>{prod.rating}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {minP && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: 'rgba(29,29,31,0.4)' }}>mejor precio</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#34a853', fontFamily: 'ui-monospace,monospace' }}>{minP}€</div>
                </div>
              )}
              <button onClick={onCerrar} style={{
                background: 'rgba(0,0,0,0.06)', border: 'none',
                width: 32, height: 32, borderRadius: '50%',
                cursor: 'pointer', fontSize: 16, color: '#1d1d1f',
              }}>×</button>
            </div>
          </div>
          <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>
                {t}{t === '2ª mano' && prod.listings?.length > 0 ? ` (${prod.listings.length})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '22px 28px 28px', color: '#1d1d1f' }}>

          {tab === 'Precios' && (
            <>
              {/* Top row: Photo (left) + Filters (right) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 24,
                marginBottom: 24,
                alignItems: 'start',
              }}>
                {/* LEFT: Variant photo */}
                {(() => {
                  let vFotos = [];
                  try {
                    vFotos = typeof selectedVariant?.fotos === 'string'
                      ? JSON.parse(selectedVariant.fotos)
                      : (selectedVariant?.fotos || []);
                  } catch { vFotos = []; }
                  if (!vFotos.length) {
                    try {
                      vFotos = typeof prod.fotos === 'string'
                        ? JSON.parse(prod.fotos)
                        : (prod.fotos || []);
                    } catch { vFotos = []; }
                  }
                  return (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.02)',
                      borderRadius: 16,
                      height: 320,
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      {vFotos.length ? (
                        <img
                          src={vFotos[0]}
                          alt={selectedVariant?.nombre}
                          style={{
                            width: '170%',
                            height: '170%',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.06))',
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: 70 }}>{prod.emoji || '📦'}</div>
                      )}
                    </div>
                  );
                })()}

                {/* RIGHT: Filters */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {FILTER_FIELDS.filter(f => filterOptions[f]).map(field => (
                    <div key={field}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(29,29,31,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        {FILTER_LABELS[field] || field}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {filterOptions[field].map(val => {
                          const active = selected[field] === val;
                          if (field === 'color') {
                            const swatchVariant = variants.find(v => v.color === val);
                            const hex = swatchVariant?.colorHex || '#cccccc';
                            return (
                              <button
                                key={val}
                                onClick={() => setSelected(s => ({ ...s, [field]: val }))}
                                title={val}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 7,
                                  padding: '5px 11px 5px 5px',
                                  background: active ? 'rgba(29,29,31,0.85)' : 'rgba(255,255,255,0.6)',
                                  color: active ? '#fff' : '#1d1d1f',
                                  border: `1px solid ${active ? 'rgba(29,29,31,0.85)' : 'rgba(0,0,0,0.1)'}`,
                                  borderRadius: 980, cursor: 'pointer',
                                  fontSize: 11, fontWeight: 500, transition: 'all .15s',
                                }}
                              >
                                <span style={{
                                  width: 16, height: 16, borderRadius: '50%',
                                  background: hex,
                                  border: '1px solid rgba(0,0,0,0.15)',
                                  display: 'inline-block',
                                }} />
                                {val}
                              </button>
                            );
                          }
                          return (
                            <button
                              key={val}
                              onClick={() => setSelected(s => ({ ...s, [field]: val }))}
                              style={{
                                padding: '6px 12px',
                                background: active ? 'rgba(29,29,31,0.85)' : 'rgba(255,255,255,0.6)',
                                color: active ? '#fff' : '#1d1d1f',
                                border: `1px solid ${active ? 'rgba(29,29,31,0.85)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: 980, cursor: 'pointer',
                                fontSize: 11, fontWeight: 500, transition: 'all .15s',
                              }}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Variant Header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: 16, paddingBottom: 16,
                borderBottom: '1px solid rgba(0,0,0,0.06)',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(29,29,31,0.5)', marginBottom: 2 }}>
                    {selectedVariant?.nombre || 'Configuración'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(29,29,31,0.4)' }}>{mejT?.nombre || (minP ? 'Mejor precio' : 'Sin precio activo')}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: minP ? '#34a853' : 'rgba(29,29,31,0.4)', fontFamily: 'ui-monospace,monospace', letterSpacing: '-0.5px' }}>
                    {minP ? `${minP}€` : (selectedVariant?.msrp ? `Desde ${selectedVariant.msrp}€` : '—')}
                  </div>
                  {(() => {
                    const dates = Object.values(pP).map(p => p.updatedAt).filter(Boolean).map(d => new Date(d));
                    if (!dates.length) return null;
                    const latest = new Date(Math.max(...dates));
                    return (
                      <div style={{ fontSize: 10, color: 'rgba(29,29,31,0.4)', marginTop: 4 }}>
                        actualizado {latest.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    );
                  })()}
                </div>
                {maxP && minP && maxP - minP > 0 && (
                  <div style={{ background: 'rgba(52,168,83,0.1)', border: '1px solid rgba(52,168,83,0.3)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#34a853', fontWeight: 500 }}>AHORRO</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#34a853' }}>-{(maxP - minP).toFixed(0)}€</div>
                  </div>
                )}
              </div>

              {/* Bar chart */}
              {minP && <BarraPrecios precios={pP} statuses={pS} />}

              {/* Store cards */}
              {minP ? (
                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TIENDAS.filter(t => pP[t.id]?.price > 0).map(t => {
                    const es = t.id === bestStoreId;
                    const st = pS[t.id];
                    const price = pP[t.id].price;
                    const productUrl = pP[t.id].url || t.url;
                    const upd = pP[t.id].updatedAt;
                    const updStr = upd ? new Date(upd).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
                    return (
                      <a key={t.id} href={productUrl} target="_blank" rel="noreferrer" style={{
                        display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px',
                        background: es ? 'rgba(52,168,83,0.08)' : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${es ? 'rgba(52,168,83,0.4)' : 'rgba(0,0,0,0.06)'}`,
                        borderRadius: 12, textDecoration: 'none',
                      }}>
                        <span style={{ fontSize: 20 }}>{t.logo}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'rgba(29,29,31,0.5)' }}>{t.nombre}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Dot status={st} />
                            <span style={{ fontSize: 15, fontWeight: 700, color: es ? '#34a853' : '#1d1d1f', fontFamily: 'ui-monospace,monospace' }}>
                              {price}€
                            </span>
                          </div>
                          {updStr && <div style={{ fontSize: 9, color: 'rgba(29,29,31,0.35)', marginTop: 2 }}>actualizado {updStr}</div>}
                        </div>
                        {es && <span>🏆</span>}
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div style={{ marginTop: 16, padding: '36px 0', textAlign: 'center', color: 'rgba(29,29,31,0.4)' }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13 }}>Sin precios para esta configuración</div>
                  {selectedVariant?.msrp && (
                    <div style={{ fontSize: 11, marginTop: 6 }}>PVP recomendado: {selectedVariant.msrp}€</div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'Galería' && (
            <>
              <Galeria fotos={prod.fotos} labels={prod.fotoLabels} emoji={prod.emoji} />
              <div style={{ fontSize: 13, color: 'rgba(29,29,31,0.7)', lineHeight: 1.7, marginTop: 16 }}>{prod.desc}</div>
            </>
          )}

          {tab === 'Características' && (
            <div>
              {(() => {
                const specs = prod.specs || {};
                const summary = specs.summary;

                // Other sections (non-summary)
                const orderedKeys = Object.keys(SECTION_LABELS).filter(k => k !== 'summary');
                const remaining = Object.keys(specs)
                  .filter(k => !orderedKeys.includes(k) && k !== 'summary' && !k.startsWith('_'));
                const otherSections = [...orderedKeys, ...remaining]
                  .map(k => [k, specs[k]])
                  .filter(([k, v]) => Array.isArray(v) && v.length > 0);

                if (!summary && otherSections.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '36px 0', color: 'rgba(29,29,31,0.4)' }}>
                      Sin características disponibles
                    </div>
                  );
                }

                return (
                  <>
                    {/* APPLE-STYLE RESUMEN — groups with icon and features */}
                    {Array.isArray(summary) && summary.length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0,
                        marginBottom: 32,
                      }}>
                        {summary.map((group, gi) => {
                          const IconComp = group.icon ? ICON_MAP[group.icon] : null;
                          const features = group.features || [];
                          if (features.length === 0) return null;

                          const lead = features[0];
                          const rest = features.slice(1);

                          return (
                            <div key={gi} style={{
                              padding: '28px 0',
                              borderBottom: gi < summary.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                              textAlign: 'center',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 6,
                            }}>
                              {IconComp && (
                                <div style={{
                                  marginBottom: 14,
                                  color: '#1d1d1f',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <IconComp size={42} stroke={1.5} />
                                </div>
                              )}
                              <div style={{
                                fontSize: 20,
                                fontWeight: 600,
                                color: '#1d1d1f',
                                letterSpacing: '-0.3px',
                                lineHeight: 1.25,
                              }}>{lead}</div>
                              {rest.map((f, i) => (
                                <div key={i} style={{
                                  fontSize: 13,
                                  color: 'rgba(29,29,31,0.75)',
                                  lineHeight: 1.5,
                                  maxWidth: 480,
                                }}>{f}</div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* OTHER SECTIONS - clean lists with icon header */}
                    {otherSections.map(([sectionKey, items]) => {
                      const IconComp = SECTION_ICONS[sectionKey] || IconDots;
                      const label = SECTION_LABELS[sectionKey] || sectionKey;
                      const firstWord = label.split(/\s+/)[0];

                      return (
                        <div key={sectionKey} style={{ marginBottom: 32 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            marginBottom: 14,
                            paddingBottom: 12,
                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                          }}>
                            <span style={{
                              color: '#1d1d1f',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <IconComp size={22} stroke={1.5} />
                            </span>
                            <span style={{
                              fontSize: 17,
                              fontWeight: 600,
                              color: '#1d1d1f',
                              letterSpacing: '-0.3px',
                            }}>{label}</span>
                          </div>
                          <ul style={{
                            listStyle: 'none',
                            padding: 0,
                            margin: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}>
                            {items.map((item, i) => {
                              const text = typeof item === 'object' && item !== null ? item.text : item;
                              const cleanText = String(text)
                                .replace(new RegExp(`^${firstWord}:\\s*`, 'i'), '')
                                .replace(new RegExp(`^${label}:\\s*`, 'i'), '');
                              return (
                                <li key={i} style={{
                                  fontSize: 13,
                                  lineHeight: 1.55,
                                  color: 'rgba(29,29,31,0.85)',
                                  padding: '2px 0',
                                }}>
                                  {cleanText}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          )}

          {tab === 'Reseñas' && <Resenas reviews={prod.reviews || []} />}
          {tab === 'Historial' && <HistorialChart historial={prod.priceHistory || []} />}

          {tab === '2ª mano' && (
            <>
              <button onClick={onAnuncio} style={{
                width: '100%', marginBottom: 14, padding: '12px',
                background: 'rgba(245,158,11,0.12)',
                border: '1px dashed rgba(245,158,11,0.5)',
                borderRadius: 12, color: '#b45309',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}>
                + Publicar anuncio de segunda mano
              </button>
              {!prod.listings?.length ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'rgba(29,29,31,0.3)' }}>
                  <div style={{ fontSize: 30 }}>📭</div>
                  <div style={{ marginTop: 8 }}>Sin anuncios</div>
                </div>
              ) : prod.listings.map(a => (
                <div key={a.id} style={{
                  background: 'rgba(0,0,0,0.02)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 12, padding: '13px 15px', marginBottom: 9,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#f5a623', fontFamily: 'ui-monospace,monospace' }}>{a.precio}€</span>
                    <span style={{ background: colorEstado(a.estado) + '22', color: colorEstado(a.estado), fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20 }}>{a.estado}</span>
                  </div>
                  {a.fotos?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto' }}>
                      {a.fotos.map((src, i) => (
                        <img key={i} src={src} alt="" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'rgba(29,29,31,0.7)', lineHeight: 1.5, marginBottom: 7 }}>{a.descripcion}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'rgba(29,29,31,0.4)' }}>
                    <span>📍 {a.ciudad}</span>
                    <span>👤 {a.vendedor}</span>
                    <span>📅 {new Date(a.createdAt).toLocaleDateString('es-ES')}</span>
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
