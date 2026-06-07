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

// Filter dimensions to expose in UI (in order).
// Note: 'cores' is a composite pseudo-field that bundles cpuCores+gpuCores
// (since they are tied together — you can't pick 18-core CPU with 10-core GPU).
const FILTER_FIELDS = ['memory', 'ram', 'color', 'display', 'connectivity', 'cpu', 'cores', 'screen', 'bandSize'];
const FILTER_LABELS = {
  memory: 'Almacenamiento',
  ram:    'Memoria RAM',
  color: 'Color',
  display: 'Pantalla',
  connectivity: 'Conectividad',
  cpu: 'Chip',
  cores:  'Núcleos',
  screen: 'Acabado pantalla',
  bandSize: 'Tamaño',
};

// Filter icons — inline SVG in Apple compare-page style (solid, monochrome).
// Same stroke/fill language as the icons on the Características tab so the
// two tabs feel like the same visual system.
function FilterIcon({ name, size = 16 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true };
  switch (name) {
    case 'memory':   // SSD / storage drive
      return (
        <svg {...props}>
          <rect x="3" y="7" width="18" height="10" rx="1.5" />
          <circle cx="17" cy="12" r="1.2" fill="white" />
        </svg>
      );
    case 'ram':      // memory chip
      return (
        <svg {...props}>
          <rect x="4" y="5" width="16" height="14" rx="1.5" />
          <rect x="9" y="9" width="6" height="6" rx="0.5" fill="white" />
        </svg>
      );
    case 'color':    // paint palette
      return (
        <svg {...props}>
          <circle cx="6" cy="11" r="2" />
          <circle cx="11" cy="7" r="2" />
          <circle cx="16" cy="11" r="2" />
          <path d="M12 22c-5.5 0-10-4.5-10-10S6.5 2 12 2s10 4.5 10 10c0 2.8-2.2 5-5 5h-2c-0.9 0-1.3 0.8-1 1.5 0.5 1 0 2-1 2z"
                fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'display':  // phone / display
      return (
        <svg {...props}>
          <rect x="6" y="2" width="12" height="20" rx="2" />
          <rect x="8" y="5" width="8" height="13" rx="1" fill="white" />
          <circle cx="12" cy="20" r="0.6" fill="white" />
        </svg>
      );
    case 'connectivity':  // antenna / radio waves
      return (
        <svg {...props}>
          <path d="M12 14a2 2 0 100-4 2 2 0 000 4z" />
          <path d="M5 8c-1.5 2-1.5 6 0 8M19 8c1.5 2 1.5 6 0 8M8 11c-0.5 1-0.5 1 0 2M16 11c0.5 1 0.5 1 0 2"
                stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'cpu':      // chip with legs
      return (
        <svg {...props}>
          <rect x="6" y="6" width="12" height="12" rx="0.5" />
          <rect x="9" y="9" width="6" height="6" rx="0.5" fill="white" />
          <line x1="9"  y1="3"  x2="9"  y2="6"  stroke="currentColor" strokeWidth="1.5" />
          <line x1="15" y1="3"  x2="15" y2="6"  stroke="currentColor" strokeWidth="1.5" />
          <line x1="9"  y1="18" x2="9"  y2="21" stroke="currentColor" strokeWidth="1.5" />
          <line x1="15" y1="18" x2="15" y2="21" stroke="currentColor" strokeWidth="1.5" />
          <line x1="3"  y1="9"  x2="6"  y2="9"  stroke="currentColor" strokeWidth="1.5" />
          <line x1="3"  y1="15" x2="6"  y2="15" stroke="currentColor" strokeWidth="1.5" />
          <line x1="18" y1="9"  x2="21" y2="9"  stroke="currentColor" strokeWidth="1.5" />
          <line x1="18" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'cores':    // stacked bars
      return (
        <svg {...props}>
          <rect x="4" y="6"  width="16" height="3" />
          <rect x="4" y="11" width="16" height="3" />
          <rect x="4" y="16" width="16" height="3" />
        </svg>
      );
    case 'screen':   // sparkle / finish quality
      return (
        <svg {...props}>
          <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        </svg>
      );
    case 'bandSize': // resize / size
      return (
        <svg {...props}>
          <rect x="8" y="6" width="8" height="12" rx="1" />
          <path d="M3 4l3 0 0 3M21 4l-3 0 0 3M3 20l3 0 0-3M21 20l-3 0 0-3"
                stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
  }
}

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
  // Build best price map per variant: variantId → { storeId: {price, url, updatedAt, storeLogo, storeName} }
  // We keep storeLogo/storeName from the API so the modal renders the real
  // logo files (Web/public/logo/*.png) instead of falling back to broken
  // emoji from constants.js.
  const variantPriceMaps = useMemo(() => {
    const map = {};
    for (const v of variants) {
      const m = {};
      for (const pr of (v.prices || [])) {
        if (!pr.price || pr.price <= 0) continue;
        if (!m[pr.storeId] || pr.price < m[pr.storeId].price) {
          m[pr.storeId] = {
            price:     pr.price,
            url:       pr.url,
            updatedAt: pr.updatedAt,
            storeLogo: pr.storeLogo,
            storeName: pr.storeName,
          };
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

  // Sort helpers for filter option values.
  //   - memory / ram: by byte size (256GB < 512GB < 1TB < 2TB)
  //   - display:      by numeric inches (11" < 13" < 14" < 16" < 24")
  //   - everything else (color, cpu, connectivity, bandSize): by the price
  //     of the cheapest variant offering that value → cheapest first.
  function sizeToBytes(s) {
    if (!s) return Infinity;
    const m = String(s).match(/(\d+(?:[.,]\d+)?)\s*(GB|TB|MB)/i);
    if (!m) return Infinity;
    const n = parseFloat(m[1].replace(',', '.'));
    const unit = m[2].toUpperCase();
    const mult = unit === 'TB' ? 1024 ** 4 : unit === 'GB' ? 1024 ** 3 : 1024 ** 2;
    return n * mult;
  }
  function inchesOf(s) {
    if (!s) return Infinity;
    const m = String(s).match(/(\d+(?:[.,]\d+)?)/);
    return m ? parseFloat(m[1].replace(',', '.')) : Infinity;
  }
  function minPriceForValue(field, value, pool) {
    let best = Infinity;
    for (const v of pool) {
      if (v[field] !== value) continue;
      for (const pr of (v.prices || [])) {
        if (pr.price > 0 && pr.price < best) best = pr.price;
      }
    }
    return best;
  }

  // Helper: does variant v match selected filters, IGNORING `excludeField`?
  // Used to compute available options per dimension: we want the set of
  // values for `field` among variants that pass all OTHER current filters.
  // 'cores' is a composite pseudo-field stored as `${cpuCores}|${gpuCores}`.
  function variantMatchesExcept(v, selectedObj, excludeField) {
    for (const [k, val] of Object.entries(selectedObj || {})) {
      if (!val || k === excludeField) continue;
      if (k === 'cores') {
        if (`${v.cpuCores}|${v.gpuCores}` !== val) return false;
      } else {
        if (v[k] !== val) return false;
      }
    }
    return true;
  }

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

  // Initial filters = traits of the cheapest variant (one value per dimension).
  // We pick from FILTER_FIELDS that exist on the variant object — actual
  // filter availability per-dimension is computed below in filterOptions and
  // tolerates extra keys here. Note: `cores` is NEVER seeded into selected;
  // it's purely an info chip derived from the resolved variant.
  const [selected, setSelected] = useState(() => {
    const cheapestVariant = variants.find(v => v.id === cheapestVariantId);
    const init = {};
    if (cheapestVariant) {
      for (const f of FILTER_FIELDS) {
        if (f === 'cores') continue;                    // info-only, no seeding
        if (cheapestVariant[f]) init[f] = cheapestVariant[f];
      }
    }
    return init;
  });
  const [tab, setTab] = useState('Precios');

  // Build available options per filter dimension. We ALWAYS show the full
  // global value set for each dimension (so positions don't shift as the
  // user picks filters) — incompatible values are rendered disabled by the
  // button's `valueIsCompatible` check at render time.
  //
  // Sorting is also fixed (based purely on the value itself or its cheapest
  // global price) so buttons stay in the same place across selections.
  //
  // 'cores' is a composite pseudo-field: each value is "cpuCores|gpuCores".
  const filterOptions = useMemo(() => {
    const opts = {};
    const pool = variantsWithPrice.length ? variantsWithPrice : variants;

    for (const field of FILTER_FIELDS) {
      let values;
      if (field === 'cores') {
        values = [...new Set(
          pool.map(v => (v.cpuCores && v.gpuCores) ? `${v.cpuCores}|${v.gpuCores}` : null)
              .filter(Boolean)
        )];
      } else {
        values = [...new Set(pool.map(v => v[field]).filter(Boolean))];
      }
      if (values.length <= 1) continue;   // not worth a filter row

      let sorted;
      if (field === 'memory' || field === 'ram') {
        sorted = values.sort((a, b) => sizeToBytes(a) - sizeToBytes(b));
      } else if (field === 'display' || field === 'bandSize') {
        sorted = values.sort((a, b) => inchesOf(a) - inchesOf(b));
      } else if (field === 'cores') {
        sorted = values.sort((a, b) => {
          const [ca, ga] = a.split('|').map(Number);
          const [cb, gb] = b.split('|').map(Number);
          return (ca + ga) - (cb + gb);
        });
      } else {
        sorted = values.sort((a, b) =>
          minPriceForValue(field, a, pool) - minPriceForValue(field, b, pool)
        );
      }
      opts[field] = sorted;
    }
    return opts;
  }, [variantsWithPrice, variants]);

  // Find variant matching ALL selected filters. 'cores' is composite:
  // we match it against `${v.cpuCores}|${v.gpuCores}`.
  const selectedVariant = useMemo(() => {
    return variants.find(v =>
      Object.entries(selected).every(([k, val]) => {
        if (!val) return true;
        if (k === 'cores') return `${v.cpuCores}|${v.gpuCores}` === val;
        return v[k] === val;
      })
    ) || variants[0];
  }, [variants, selected]);

  // Smart filter pick: set `field` to `val`, but if that leaves zero matching
  // variants we DROP sibling filters one by one (lowest-priority first) until
  // at least one variant matches. This lets the user freely switch e.g.
  // display 14" -> 16" or chip M5 -> M5 Max without getting stuck.
  //
  // Priority order = the field the user just clicked is most important, then
  // the broad dimensions (display, cpu), then narrower ones (memory, ram,
  // color, screen). Cores is dropped before memory because cores depend on
  // chip choice — when chip changes, cores must usually change too.
  const SIBLING_DROP_ORDER = [
    'screen',     // first thing we'll let go
    'color',
    'cores',
    'ram',
    'memory',
    'cpu',
    'display',
    'connectivity',
    'bandSize',
  ];

  // When the user picks a "structural" filter we eagerly drop technical
  // sub-fields that almost always become invalid. RAM/memory ARE listed
  // here for display/cpu because moving between chip generations or screen
  // sizes typically invalidates RAM offerings (e.g. 16" Pro has no 16GB).
  // For chip/cpu we still keep memory as a preference if possible — the
  // sibling-drop fallback will release it only if no match exists.
  const STRUCTURAL_RESETS = {
    display: ['cores', 'screen', 'cpu', 'ram', 'memory'],
    cpu:     ['cores', 'screen', 'ram'],
    memory:  ['ram'],
    cores:   [],
  };

  function variantMatchesFull(v, sel) {
    return Object.entries(sel).every(([k, val]) => {
      if (!val) return true;
      if (k === 'cores') return `${v.cpuCores}|${v.gpuCores}` === val;
      return v[k] === val;
    });
  }

  function pickFilter(field, val) {
    setSelected(prev => {
      let next = { ...prev, [field]: val };

      // STRUCTURAL_RESETS lists fields that often go invalid when `field`
      // changes. But we don't blindly delete them: we only drop a value if
      // it's actually incompatible with the new selection. So switching
      // display 14"→16" while you had memory=1TB keeps 1TB if 16" also
      // offers 1TB. This stops options from "scattering" on every pick.
      const droppedFields = [];
      for (const k of (STRUCTURAL_RESETS[field] || [])) {
        if (next[k] == null) continue;
        if (!variants.some(v => variantMatchesFull(v, next))) {
          delete next[k];
          droppedFields.push(k);
        }
      }

      // If full selection still has no match, drop more siblings in priority
      // order until we get at least one matching variant.
      if (!variants.some(v => variantMatchesFull(v, next))) {
        for (const drop of SIBLING_DROP_ORDER) {
          if (drop === field) continue;
          if (next[drop] == null) continue;
          delete next[drop];
          droppedFields.push(drop);
          if (variants.some(v => variantMatchesFull(v, next))) break;
        }
      }

      // For each field we dropped, auto-pick the minimum compatible value
      // (cheapest / smallest). This way the modal lands on a real variant
      // with sensible defaults instead of leaving the row empty.
      const minPick = (k) => {
        const candidates = variants
          .filter(v => variantMatchesFull(v, next))
          .map(v => {
            if (k === 'cores') {
              return (v.cpuCores && v.gpuCores) ? `${v.cpuCores}|${v.gpuCores}` : null;
            }
            return v[k];
          })
          .filter(Boolean);
        if (!candidates.length) return null;
        const unique = [...new Set(candidates)];
        if (k === 'memory' || k === 'ram') {
          unique.sort((a, b) => sizeToBytes(a) - sizeToBytes(b));
        } else if (k === 'display' || k === 'bandSize') {
          unique.sort((a, b) => inchesOf(a) - inchesOf(b));
        } else if (k === 'cores') {
          unique.sort((a, b) => {
            const [ca, ga] = a.split('|').map(Number);
            const [cb, gb] = b.split('|').map(Number);
            return (ca + ga) - (cb + gb);
          });
        } else {
          // sort by cheapest variant price
          unique.sort((a, b) => minPriceForValue(k, a, variants) - minPriceForValue(k, b, variants));
        }
        return unique[0];
      };

      for (const k of droppedFields) {
        if (k === 'cores') continue;            // cores is info-only, never seeded
        const v = minPick(k);
        if (v != null) next[k] = v;
      }

      return next;
    });
  }

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
                  {(() => {
                    // PRIMARY filters per category. These render as big chips
                    // up top and are always clickable (sibling-drop in
                    // pickFilter resolves any cross-incompatibilities). The
                    // intent is "pick your model first, customize details
                    // after" — so we surface whichever fields define the
                    // model variant for this category.
                    //
                    //   Mac     → screen size + chip + storage
                    //   iPhone  → display + storage
                    //   iPad    → display + storage
                    //   Watch   → band size + connectivity
                    //   AirPods → (no primary — too few variants)
                    const PRIMARY_BY_CAT = {
                      mac:     ['display', 'cpu', 'memory'],
                      iphone:  ['display', 'memory'],
                      ipad:    ['display', 'memory'],
                      watch:   ['bandSize', 'connectivity'],
                      airpods: [],
                    };
                    const PRIMARY = PRIMARY_BY_CAT[prod.cat] || ['display', 'memory'];

                    const allFields = FILTER_FIELDS.filter(f => filterOptions[f]);
                    const primaryFields = allFields.filter(f => PRIMARY.includes(f));
                    const secondaryFields = allFields.filter(f => !PRIMARY.includes(f));

                    function valueIsCompatible(field, val) {
                      const trial = { ...selected, [field]: val };
                      return variants.some(v =>
                        Object.entries(trial).every(([k, v_]) => {
                          if (!v_) return true;
                          if (k === 'cores') return `${v.cpuCores}|${v.gpuCores}` === v_;
                          return v[k] === v_;
                        })
                      );
                    }

                    const selectedVariantCoreKey = (selectedVariant?.cpuCores && selectedVariant?.gpuCores)
                      ? `${selectedVariant.cpuCores}|${selectedVariant.gpuCores}`
                      : null;

                    // Renderer for one filter row. `primary` controls chip size
                    // AND clickability: primary fields are always clickable —
                    // if the new pick collides with sibling filters, pickFilter
                    // resolves it by dropping incompatible siblings. This is
                    // critical for products with few variants (e.g. Mac Studio
                    // has 2 variants with no overlap, so every cross-pick
                    // would otherwise be "disabled").
                    function renderFilterRow(field, primary) {
                      const isInfoOnly = field === 'cores';
                      const chipPadding = primary ? '10px 18px' : '6px 12px';
                      const chipFontSize = primary ? 13 : 11;
                      const chipFontWeight = primary ? 600 : 500;
                      return (
                        <div key={field}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 11, fontWeight: 500, color: 'rgba(29,29,31,0.6)',
                            marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4,
                          }}>
                            <FilterIcon name={field} size={14} />
                            {FILTER_LABELS[field] || field}
                          </div>
                          <div style={{ display: 'flex', gap: primary ? 8 : 6, flexWrap: 'wrap' }}>
                            {filterOptions[field].map(val => {
                              const active = isInfoOnly
                                ? (val === selectedVariantCoreKey)
                                : (selected[field] === val);
                              // Incompatible-with-current-siblings values are
                              // visually dimmed in both primary and secondary
                              // blocks. The difference: primary remains
                              // CLICKABLE — clicking a dim primary triggers
                              // pickFilter, which drops sibling filters to
                              // resolve the conflict. Secondary stays
                              // non-clickable so the user is nudged to
                              // change the primary first.
                              const incompatible = !isInfoOnly && !active && !valueIsCompatible(field, val);
                              const disabled = incompatible && !primary;
                              const dim = incompatible;

                              if (field === 'color') {
                                const swatchVariant = variants.find(v => v.color === val);
                                const hex = swatchVariant?.colorHex || '#cccccc';
                                return (
                                  <button
                                    key={val}
                                    onClick={() => !disabled && pickFilter(field, val)}
                                    title={val}
                                    disabled={disabled}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 7,
                                      padding: '5px 11px 5px 5px',
                                      background: active ? 'rgba(29,29,31,0.85)' : 'rgba(255,255,255,0.6)',
                                      color: active ? '#fff' : '#1d1d1f',
                                      border: `1px solid ${active ? 'rgba(29,29,31,0.85)' : 'rgba(0,0,0,0.1)'}`,
                                      borderRadius: 980,
                                      cursor: disabled ? 'not-allowed' : 'pointer',
                                      fontSize: 11, fontWeight: 500,
                                      transition: 'all .15s',
                                      opacity: dim ? 0.35 : 1,
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

                              const DISPLAY_SUFFIX = {
                                'iPhone 17 Pro': { '6.3"': 'Pro', '6.9"': 'Pro Max' },
                                'iPhone 16':     { '6.1"': '',    '6.7"': 'Plus' },
                              };
                              let label;
                              if (field === 'cores' && typeof val === 'string') {
                                const [cpu, gpu] = val.split('|');
                                label = `${cpu}c CPU · ${gpu}c GPU`;
                              } else if (field === 'display' && DISPLAY_SUFFIX[prod.nombre]) {
                                const suffix = DISPLAY_SUFFIX[prod.nombre][val];
                                label = suffix ? `${val} ${suffix}` : val;
                              } else {
                                label = val;
                              }

                              return (
                                <button
                                  key={val}
                                  onClick={isInfoOnly ? undefined : (() => !disabled && pickFilter(field, val))}
                                  disabled={disabled || isInfoOnly}
                                  style={{
                                    padding: chipPadding,
                                    background: active ? 'rgba(29,29,31,0.85)' : 'rgba(255,255,255,0.6)',
                                    color: active ? '#fff' : '#1d1d1f',
                                    border: `1px solid ${active ? 'rgba(29,29,31,0.85)' : 'rgba(0,0,0,0.1)'}`,
                                    borderRadius: 980,
                                    cursor: isInfoOnly ? 'default' : (disabled ? 'not-allowed' : 'pointer'),
                                    fontSize: chipFontSize, fontWeight: chipFontWeight,
                                    transition: 'all .15s',
                                    opacity: dim ? 0.35 : 1,
                                  }}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Primary filters (display, memory) — big chips */}
                        {primaryFields.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {primaryFields.map(f => renderFilterRow(f, true))}
                          </div>
                        )}
                        {/* Divider when we have both blocks */}
                        {primaryFields.length > 0 && secondaryFields.length > 0 && (
                          <div style={{
                            height: 1,
                            background: 'rgba(0,0,0,0.08)',
                            margin: '2px 0',
                          }} />
                        )}
                        {/* Secondary filters (cpu, ram, cores, color, ...) — small chips */}
                        {secondaryFields.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {secondaryFields.map(f => renderFilterRow(f, false))}
                          </div>
                        )}
                      </>
                    );
                  })()}
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
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#34a853' }}>{(maxP - minP).toFixed(0)}€</div>
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
                    // Prefer the logo path coming from the API (Web/public/logo/*.png).
                    // Falls back to the constants emoji if the API didn't provide one
                    // (older data, missing Store row, etc.).
                    const logoSrc  = pP[t.id].storeLogo;
                    const storeNom = pP[t.id].storeName || t.nombre;
                    const isImg    = typeof logoSrc === 'string' && (logoSrc.startsWith('/') || logoSrc.startsWith('http'));
                    return (
                      <a key={t.id} href={productUrl} target="_blank" rel="noreferrer" style={{
                        display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px',
                        background: es ? 'rgba(52,168,83,0.08)' : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${es ? 'rgba(52,168,83,0.4)' : 'rgba(0,0,0,0.06)'}`,
                        borderRadius: 12, textDecoration: 'none',
                      }}>
                        {isImg ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 36, height: 24,
                            flexShrink: 0,
                            overflow: 'hidden',
                          }}>
                            <img
                              src={logoSrc}
                              alt={storeNom}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                width: 'auto',
                                height: 'auto',
                                objectFit: 'contain',
                                display: 'block',
                              }}
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          </span>
                        ) : (
                          <span style={{ fontSize: 20 }}>{logoSrc || t.logo}</span>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'rgba(29,29,31,0.5)' }}>{storeNom}</div>
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
