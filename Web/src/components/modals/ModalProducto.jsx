'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  IconDeviceMobile, IconShieldCheck, IconCpu, IconSparkles,
  IconBattery3, IconMagnet, IconUsb, IconCamera, IconCameraSelfie,
  IconZoom, IconAlertHexagon, IconScreenShare, IconDeviceImac,
  IconCameraPlus, IconRotate360, IconWifi, IconNfc, IconBluetooth,
  IconShield, IconFingerprint, IconRuler2, IconDatabase, IconPalette,
  IconBroadcast, IconSimCard, IconMicrophone, IconBrandApple, IconWeight,
  IconCompass, IconLock, IconAccessPoint, IconDots,
} from '@tabler/icons-react';
import Galeria from '../ui/Galeria';
import BarraPrecios from '../ui/BarraPrecios';
import HistorialChart from '../ui/HistorialChart';
import Resenas from '../ui/Resenas';
import BankBadge from '../ui/BankBadge';
import AppleAuthBadge from '../ui/AppleAuthBadge';
import ListingCard from '../ui/ListingCard';
import Dot from '../ui/Dot';
import { TIENDAS } from '../shared/constants';
import { getStoreBrand } from '../shared/storeBrand';
import { colorEstado } from '../shared/utils';
import { isStaleListing, listingAgeDays } from '../shared/listingLifecycle';
import { useIsMobile } from '../shared/useIsMobile';

const TABS = ['Precios', 'Galería', 'Características', 'Reseñas', 'Historial', '2ª mano'];

// Filter dimensions to expose in UI (in order).
// Note: 'cores' is a composite pseudo-field that bundles cpuCores+gpuCores
// (since they are tied together — you can't pick 18-core CPU with 10-core GPU).
// 'band' + 'soporte' were added to surface Apple Watch band choice
// (Alpine Loop / Trail Loop / Ocean Band / Titanium Milanese Loop) and
// iMac stand type (Inclinable / VESA). Both fields are already populated
// on ProductVariant by matcher_apple.py; the filter row just needs to
// know they exist. bandSize covers the Watch S/M/L strap length.
const FILTER_FIELDS = ['memory', 'ram', 'color', 'display', 'connectivity', 'cpu', 'cores', 'screen', 'soporte', 'band', 'bandSize'];
const FILTER_LABELS = {
  memory: 'Almacenamiento',
  ram:    'Memoria RAM',
  color: 'Color',
  display: 'Pantalla',
  connectivity: 'Conectividad',
  cpu: 'Chip',
  cores:  'Núcleos',
  screen: 'Acabado pantalla',
  soporte: 'Soporte',
  band: 'Correa',
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
    case 'band':     // Watch strap loop — abstract braided band
      return (
        <svg {...props}>
          <rect x="7" y="9" width="10" height="6" rx="2" />
          <path d="M4 12h3M17 12h3" stroke="currentColor" strokeWidth="1.8" fill="none" />
          <path d="M9 12h6" stroke="white" strokeWidth="1.2" fill="none" />
        </svg>
      );
    case 'soporte':  // iMac stand — screen on a base
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="11" rx="1.5" />
          <path d="M12 15v3M8 20h8" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
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
  sim:            IconSimCard,
  resistance:     IconShield,
  safety:         IconAlertHexagon,
  sensors:        IconCompass,
  authentication: IconFingerprint,
  siri:           IconMicrophone,
  tech:           IconAccessPoint,
  apple:          IconBrandApple,
};

// Apple compare section keys → Spanish labels
// Dedupe set for view-count POSTs. Lives at module scope so it survives
// React's Strict-Mode unmount-then-remount in dev (otherwise the effect
// fires twice per modal open and we double-count). In production Strict
// Mode is off, but the set also doubles as session-level dedupe — the
// same user reopening the same modal in the same tab counts only once,
// which matches how every other view-counter on the web works.
const _recordedViews = new Set();

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
  const isMobile = useIsMobile();
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
            // Apple authorization tier for the trust badge in store cards.
            // Comes from Store.appleAuthLevel via the API. Carrying it here
            // (instead of falling back to the top-level precios map) keeps
            // the badge in sync with the currently-selected variant when
            // a user picks a different storage/color — some variants might
            // have prices at stores others don't.
            storeAppleAuthLevel: pr.storeAppleAuthLevel,
            // Financing (may be null — only shown when monthlyPrice is set)
            monthlyPrice:      pr.monthlyPrice,
            monthlyMonths:     pr.monthlyMonths,
            // Array of bank chips to render in the financing line.
            // Falls back to wrapping the single-provider field for any
            // legacy code paths that haven't started populating the
            // array form yet (scraper rows in particular).
            financingProviders: pr.financingProviders
              || (pr.financingProvider ? [pr.financingProvider] : null),
            // True when monthlyPrice was synthesized from STORE_FINANCING_
            // DEFAULTS instead of scraped per-SKU.
            financingComputed: pr.financingComputed,
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

  // Which store card the pointer is currently over. Drives the hover-lift /
  // shadow / reveal-arrow effect on the Precios-tab store cards. We track
  // a single string (storeId) at the parent level rather than wiring each
  // card to its own useState so the hover state isn't lost when the IIFE
  // that renders the cards re-runs on variant change.
  const [hoveredStoreId, setHoveredStoreId] = useState(null);

  // 2ª-mano zone filter on the Precios tab. Default false → only
  // listings whose variant matches what the user is currently pricing
  // are shown. Flip to true with the inline toggle in the zone heading
  // to see every active listing for this product family.
  const [showAllListings, setShowAllListings] = useState(false);

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
    'soporte',    // iMac stand — narrow dimension, safe to release
    'color',
    'cores',
    'ram',
    'memory',
    'cpu',
    'display',
    'connectivity',
    'band',       // Watch band style — release before case size
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

  // Bump Product.views by one when the modal mounts. Fire-and-forget:
  // we ignore the response — the in-memory `prod` object will refresh
  // next time the homepage refetches anyway, and any error here
  // (network, 404, etc) is a tracking miss, not a UX failure.
  //
  // The dedupe set guards against React Strict Mode's intentional
  // double-mount-in-dev (would otherwise produce +2 per open) AND
  // against a single user padding the count by re-opening the same
  // modal in the same tab.
  useEffect(() => {
    if (!prod?.id) return;
    if (_recordedViews.has(prod.id)) return;
    _recordedViews.add(prod.id);
    fetch(`/api/products/${prod.id}/view`, { method: 'POST' }).catch(() => {});
  }, [prod?.id]);

  const tabStyle = a => ({
    // On mobile the tabs scroll horizontally and shouldn't stretch —
    // each tab gets its natural width so the active underline matches
    // the label, and the whole row becomes a snap-scroll strip rather
    // than a cramped equal-width grid that crops every label.
    flex: isMobile ? '0 0 auto' : 1,
    padding: isMobile ? '12px 14px' : '16px 0',
    fontSize: isMobile ? 13 : 15,
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
      zIndex: 200, display: 'flex',
      // Full-screen modal on every viewport. Mobile keeps the bottom-
      // aligned sheet feel via top-rounded corners; desktop is flush
      // edge-to-edge so the split layout has maximum real estate.
      alignItems: isMobile ? 'flex-end' : 'stretch',
      justifyContent: 'center',
      padding: 0,
      animation: 'fadeIn .2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '0.5px solid rgba(255,255,255,0.8)',
        // Mobile keeps top-rounded sheet; desktop edge-to-edge.
        borderRadius: isMobile ? '18px 18px 0 0' : 0,
        width: '100%',
        maxWidth: '100%',
        // dvh on both so the sheet hugs the dynamic viewport (no jumping
        // when iOS Safari toolbars or desktop browser chrome resizes).
        height: '100dvh',
        maxHeight: '100dvh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? '14px 16px 0' : '22px 28px 0',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isMobile ? 10 : 16, gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: isMobile ? 17 : 20,
                fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.4px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{prod.nombre}</div>
              {prod.rating > 0 && (
                <div style={{ fontSize: 12, color: '#f5a623', marginTop: 4 }}>
                  {'★'.repeat(Math.round(prod.rating))} <span style={{ color: 'rgba(29,29,31,0.4)' }}>{prod.rating}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: isMobile ? 6 : 8, alignItems: 'center', flexShrink: 0 }}>
              {minP && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: 'rgba(29,29,31,0.4)' }}>mejor precio</div>
                  <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#34a853', fontFamily: 'ui-monospace,monospace', fontVariantNumeric: 'tabular-nums' }}>{Math.round(minP).toLocaleString('es-ES')} €</div>
                </div>
              )}
              <button
                onClick={onCerrar}
                aria-label="Cerrar"
                style={{
                  background: 'rgba(0,0,0,0.06)', border: 'none',
                  // Bump to Apple-HIG min tap target (44px) on phones so the
                  // close button is actually thumbable without zooming.
                  width: isMobile ? 38 : 32,
                  height: isMobile ? 38 : 32,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: isMobile ? 20 : 16,
                  color: '#1d1d1f',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>×</button>
            </div>
          </div>
          <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', gap: isMobile ? 0 : 0 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>
                {t}{t === '2ª mano' && prod.listings?.length > 0 ? ` (${prod.listings.length})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{
          // Precios on desktop runs its own 2-column split (filters
          // left, retailers right) with independent scroll panels —
          // body has to be overflow:hidden so children own the scroll
          // and the layout doesn't double-scroll. Every other tab is
          // a single long document and uses the body's own scroll
          // with the original padding. Mobile is single-flow on
          // every tab so it always uses the body scroll.
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: isMobile ? 'auto' : (tab === 'Precios' ? 'hidden' : 'auto'),
          overflowX: 'hidden',
          padding: isMobile
            ? '16px 16px 24px'
            : (tab === 'Precios' ? 0 : '22px 28px 28px'),
          minHeight: 0,
          color: '#1d1d1f',
          WebkitOverflowScrolling: 'touch',
        }}>

          {tab === 'Precios' && (
            <div style={{
              // Desktop: 2-column split (filters left, retailers right)
              // so the user can scroll retailers without losing track of
              // which configuration they're pricing. Mobile keeps the
              // simple vertical flow — not enough horizontal room for a
              // split, and the natural thumb-scroll feel matters more.
              flex: 1,
              display: isMobile ? 'block' : 'grid',
              gridTemplateColumns: isMobile ? undefined : 'minmax(420px, 480px) 1fr',
              overflow: isMobile ? 'visible' : 'hidden',
              minHeight: 0,
              margin: isMobile ? 0 : '-22px -28px 0',
            }}>
              {/* LEFT column on desktop (filters panel) / top block on
                  mobile. Photo, filter chips, selected-variant header,
                  ahorro badge, comparison bar — everything the user
                  needs to KEEP in sight while comparing retailers. */}
              <div style={{
                overflowY: isMobile ? 'visible' : 'auto',
                padding: isMobile ? 0 : '24px 28px 24px 44px',
                minHeight: 0,
                borderRight: isMobile ? 'none' : '1px solid rgba(0,0,0,0.06)',
                WebkitOverflowScrolling: 'touch',
              }}>
              {/* Photo + filters block. Stack vertically both viewports
                  now that filters live inside the fixed left panel —
                  side-by-side would crush the filter chip rows. */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 16,
                marginBottom: isMobile ? 18 : 20,
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
                      height: isMobile ? 200 : 320,
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
                      // Watch: band style is the biggest price lever (Milanese
                      // Loop bumps Ultra 3 by 100 EUR), so it earns primary
                      // billing alongside case size and connectivity.
                      watch:   ['bandSize', 'band', 'connectivity'],
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
                  <div style={{ fontSize: 28, fontWeight: 700, color: minP ? '#34a853' : 'rgba(29,29,31,0.4)', fontFamily: 'ui-monospace,monospace', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                    {minP ? `${Math.round(minP).toLocaleString('es-ES')} €` : (selectedVariant?.msrp ? `Desde ${Math.round(selectedVariant.msrp).toLocaleString('es-ES')} €` : '—')}
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
                {(() => {
                  // AHORRO badge — mirror TarjetaProducto's chip logic so the
                  // modal and the homepage card always agree.
                  //
                  // Primary metric: % off Apple MSRP for THIS specific variant
                  // (selectedVariant.msrp). 100% of catalog variants currently
                  // carry msrp, so this is always the path used.
                  //
                  // Fallback: cross-store spread (maxP − minP). Kept for any
                  // future variant added without msrp, but never reached today.
                  //
                  // Previously the badge used (maxP − minP) which inflated %
                  // whenever any reseller priced above Apple — e.g. Apple Watch
                  // Ultra 3 49mm Natural showed 204 € (21%) against K-tuin's
                  // 955 € instead of the correct 148 € (16%) vs Apple's 899 €.
                  const msrp = selectedVariant?.msrp;
                  let ahorroAmount = null, ahorroPct = null;
                  if (msrp && minP && msrp > minP) {
                    ahorroAmount = Math.round(msrp - minP);
                    ahorroPct = Math.round(((msrp - minP) / msrp) * 100);
                  } else if (maxP && minP && maxP > minP) {
                    ahorroAmount = Math.round(maxP - minP);
                    ahorroPct = Math.round(((maxP - minP) / maxP) * 100);
                  }
                  if (!ahorroAmount || ahorroAmount <= 0) return null;
                  return (
                    <div style={{ background: 'rgba(52,168,83,0.1)', border: '1px solid rgba(52,168,83,0.3)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#34a853', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                        <span style={{ fontSize: 10 }}>💰</span>AHORRO
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#34a853', fontVariantNumeric: 'tabular-nums' }}>
                        {ahorroAmount.toLocaleString('es-ES')} €
                      </div>
                      <div style={{ fontSize: 11, color: '#34a853', fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                        {ahorroPct}%
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Bar chart — functional ladder: each bar is a clickable
                  link to the same product page as the store card below,
                  hover state is shared with the cards via hoveredStoreId
                  so pointing at a bar lifts the matching card (and vice
                  versa), and on hover each row shows '−NN%' vs Apple's
                  MSRP — the user's real reference number for value. */}
              {minP && (
                <BarraPrecios
                  precios={pP}
                  statuses={pS}
                  hoveredStoreId={hoveredStoreId}
                  onHover={setHoveredStoreId}
                  appleMsrp={selectedVariant?.msrp}
                />
              )}
              </div>{/* /LEFT column */}

              {/* RIGHT column (desktop) / bottom block (mobile):
                  retailer cards. Independently scrollable on desktop
                  so a long retailer list never pushes the filters
                  off-screen. */}
              <div style={{
                overflowY: isMobile ? 'visible' : 'auto',
                padding: isMobile ? '18px 0 0' : '24px 44px 24px 28px',
                minHeight: 0,
                WebkitOverflowScrolling: 'touch',
              }}>

              {/* Store cards — split into TWO zones for anchor-price
                  psychology. Zone 1 = Apple Store as the "Precio Oficial"
                  anchor, surfaced in a small mini-block above the list so
                  the user normalizes it as the baseline (their mental
                  "MSRP"). Zone 2 = "Dónde comprar más barato", every other
                  retailer sorted cheapest-first — comparing against the
                  anchor above produces the "I'm saving X € vs Apple"
                  dopamine hit. If Apple has no price for this variant,
                  Zone 1 is dropped and Zone 2 stands on its own without
                  the semantic split. Mobile keeps single-column so names
                  + financing line + price all fit without truncating. */}
              {minP ? (() => {
                const renderStoreCard = (t) => {
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
                    // Per-retailer brand palette. Drives card tint + border
                    // when this store is NOT the cheapest; the best-price
                    // card still wears green (the universal "winner" cue).
                    // Store name colour is brand even on the winner card,
                    // so the retailer's identity is never fully hidden.
                    const brand = getStoreBrand(t.id);
                    const isHovered = hoveredStoreId === t.id;
                    return (
                      <a key={t.id} href={productUrl} target="_blank" rel="noreferrer"
                        onMouseEnter={() => setHoveredStoreId(t.id)}
                        onMouseLeave={() => setHoveredStoreId(null)}
                        style={{
                        // Three-zone layout: [logo] [info stack] [price]
                        // align-items:center vertically centres each zone, so cards
                        // with and without financing share the same vertical rhythm.
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        background: es ? 'rgba(52,168,83,0.08)' : brand.tint,
                        border: `1px solid ${es ? 'rgba(52,168,83,0.4)' : brand.border}`,
                        borderRadius: 12, textDecoration: 'none',
                        // Hover treatment — subtle lift + drop shadow + a
                        // reveal-arrow next to the price (see Zone 3 below).
                        // We intentionally DON'T retint the background or
                        // change borderColor on hover anymore: mixing the
                        // `border` shorthand and a separate `borderColor`
                        // override in the same inline-style object lets the
                        // browser fall back to the default (black) border
                        // when the override resolves before the shorthand.
                        // Keeping the static brand border + adding shadow
                        // gives the lift its weight without that risk.
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                        boxShadow: isHovered
                          ? (es ? '0 8px 24px rgba(52,168,83,0.18)' : '0 8px 24px rgba(0,0,0,0.10)')
                          : 'none',
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
                          <span style={{ fontSize: 20, flexShrink: 0 }}>{logoSrc || t.logo}</span>
                        )}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {/* Zone 2 row 1: store name + Apple-auth trust badge + status dot */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{
                              fontSize: 12,
                              color: brand.text,
                              fontWeight: 600,
                              letterSpacing: '-0.1px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>{storeNom}</span>
                            {/* Trust signal: Apple Premium / Authorized /
                                Verifica chip. Component returns null for
                                'official' (Apple == Apple) and for stores
                                not on Apple's authorized list. */}
                            <AppleAuthBadge level={pP[t.id].storeAppleAuthLevel} />
                            <Dot status={st} />
                          </div>
                          {pP[t.id].monthlyPrice > 0 && (() => {
                            // "desde 54,13 €/mes con Cetelem" — Spanish decimal
                            // formatting (comma). Months suffix omitted when the
                            // store didn't expose it. Provider suffix dropped
                            // when null (rare).
                            const m = pP[t.id].monthlyPrice;
                            const months    = pP[t.id].monthlyMonths;
                            const providers = pP[t.id].financingProviders || [];
                            const fmt    = m.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            let label = `desde ${fmt} €/mes`;
                            if (months) label += ` ×${months}`;
                            // provider rendered as a colored BankBadge in the return block below
                            return (
                              <div style={{
                                fontSize: 10,
                                color: 'rgba(29,29,31,0.55)',
                                marginTop: 3,
                                fontVariantNumeric: 'tabular-nums',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                flexWrap: 'wrap',
                              }}>
                                <span>{label}</span>
                                {providers.map(prov => <BankBadge key={prov} provider={prov} />)}
                              </div>
                            );
                          })()}
                          {updStr && <div style={{ fontSize: 9, color: 'rgba(29,29,31,0.35)', marginTop: 1 }}>actualizado {updStr}</div>}
                        </div>

                        {/* ZONE 3 — price (with trophy inline on best card) +
                            a hover-reveal arrow that slides in from the right
                            to telegraph the link behaviour. We render the arrow
                            unconditionally and animate its width/opacity so the
                            mount doesn't jump the layout when the user enters
                            the card. */}
                        <span style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: es ? '#34a853' : '#1d1d1f',
                          fontFamily: 'ui-monospace,monospace',
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.5px',
                          flexShrink: 0,
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: isHovered ? 6 : 0,
                          transition: 'gap 0.2s ease',
                        }}>
                          {es && <span style={{ fontSize: 14, marginRight: 4 }}>🏆</span>}
                          {Math.round(price).toLocaleString('es-ES')} €
                          <span
                            aria-hidden="true"
                            style={{
                              fontSize: 16,
                              color: es ? '#34a853' : 'rgba(29,29,31,0.55)',
                              opacity: isHovered ? 1 : 0,
                              maxWidth: isHovered ? 18 : 0,
                              overflow: 'hidden',
                              transform: isHovered ? 'translateX(0)' : 'translateX(-6px)',
                              transition: 'opacity 0.2s ease, max-width 0.2s ease, transform 0.2s ease',
                              display: 'inline-block',
                            }}
                          >→</span>
                        </span>
                      </a>
                    );
                };
                // Compact card for a 2ª-mano listing. Same three-zone
                // layout as the retailer card (logo, info stack, price)
                // but tinted in the amber palette the 2ª mano tab uses,
                // and clicking the card jumps to that tab so the user
                // can see the full ad (photos, full description, etc).
                const renderListingCard = (a) => (
                  <a
                    key={`listing-${a.id}`}
                    href="#2da-mano"
                    onClick={(e) => { e.preventDefault(); setTab('2ª mano'); }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(245,158,11,0.18)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      background: 'rgba(245,158,11,0.06)',
                      border: '1px dashed rgba(245,158,11,0.35)',
                      borderRadius: 12,
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                  >
                    {/* Thumbnail of the first listing photo when
                        available. Falls back to a small camera
                        emoji on tinted square so cards with and
                        without photos stay the same height. */}
                    {a.fotos?.[0] ? (
                      <img
                        src={a.fotos[0]}
                        alt=""
                        style={{
                          width: 40, height: 40, objectFit: 'cover',
                          borderRadius: 8,
                          border: '1px solid rgba(245,158,11,0.25)',
                          flexShrink: 0,
                        }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 40, height: 40, flexShrink: 0, fontSize: 18,
                        background: 'rgba(245,158,11,0.08)', borderRadius: 8,
                        color: '#b45309',
                      }}>📷</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{
                          fontSize: 12, color: '#b45309', fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{a.vendedor || 'Particular'}</span>
                        {/* SKU traits from the listing's variant —
                            "256GB · Negro · 6.1\""—  so the buyer sees
                            at a glance whether the ad matches their
                            current Precios selection. We only show
                            dimensions the variant actually has; an
                            AirPods listing won't print "undefined". */}
                        {a.variant && (() => {
                          const v = a.variant;
                          const parts = [v.memory, v.ram, v.cpu, v.display, v.screen, v.bandSize, v.connectivity, v.color].filter(Boolean);
                          if (!parts.length) return null;
                          return (
                            <span style={{
                              fontSize: 10, color: 'rgba(29,29,31,0.50)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              flexShrink: 1, minWidth: 0,
                            }}>· {parts.join(' · ')}</span>
                          );
                        })()}
                        {/* Stale-listing warning (21+ days old). Same
                            threshold as the full 2ª-mano card, so the
                            buyer gets a consistent cue whether they
                            spotted the ad on Precios or in the dedicated
                            tab. */}
                        {isStaleListing(a.createdAt) && (
                          <span
                            title={`Publicado hace ${listingAgeDays(a.createdAt)} días. Verifica disponibilidad con el vendedor.`}
                            style={{
                              background: 'rgba(245,158,11,0.20)',
                              color: '#b45309',
                              fontSize: 9, fontWeight: 700,
                              padding: '1px 7px', borderRadius: 12,
                              textTransform: 'uppercase', letterSpacing: 0.3,
                              flexShrink: 0, cursor: 'help',
                            }}
                          >⚠ Antiguo</span>
                        )}
                        {a.estado && (
                          <span style={{
                            background: colorEstado(a.estado) + '22',
                            color: colorEstado(a.estado),
                            fontSize: 9, fontWeight: 700,
                            padding: '1px 7px', borderRadius: 12,
                            textTransform: 'uppercase', letterSpacing: 0.3,
                            flexShrink: 0,
                          }}>{a.estado}</span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 10, color: 'rgba(29,29,31,0.45)',
                        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                      }}>
                        {a.ciudad && <span>📍 {a.ciudad}</span>}
                        <span>{new Date(a.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 20, fontWeight: 700, color: '#f5a623',
                      fontFamily: 'ui-monospace,monospace', fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.5px', flexShrink: 0,
                    }}>{Math.round(a.precio).toLocaleString('es-ES')} €</span>
                  </a>
                );
                // Apple = the anchor; everyone else sorts cheapest-first.
                // Pre-filter to "has a price" so the visual position is
                // dictated by actual price, not by the order TIENDAS
                // declares stores in constants.
                const appleT = TIENDAS.find(t => t.id === 'apple');
                const hasApple = appleT && pP['apple']?.price > 0;
                const others = TIENDAS
                  .filter(t => t.id !== 'apple' && pP[t.id]?.price > 0)
                  .sort((a, b) => pP[a.id].price - pP[b.id].price);
                // Shared uppercase mini-label so both zone headers read
                // as the same visual system rather than ad-hoc text.
                const zoneLabelStyle = {
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'rgba(29,29,31,0.55)',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                };
                return (
                  <>
                    {hasApple && (
                      <div style={{ marginTop: 14 }}>
                        <div style={zoneLabelStyle}>Precio Oficial Apple Store</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                          {renderStoreCard(appleT)}
                        </div>
                      </div>
                    )}
                    {others.length > 0 && (
                      <div style={{ marginTop: hasApple ? 18 : 14 }}>
                        {/* Heading only when there's an anchor to compare
                            against — without Apple this list stands alone. */}
                        {hasApple && <div style={zoneLabelStyle}>Dónde comprar más barato</div>}
                        {/* Stale-pricing disclaimer. Scraper-sourced retailer
                            prices may diverge from the live store page when
                            stock changes or the seller adjusts mid-day; this
                            sets the user's expectation in advance so an
                            occasional mismatch reads as honest, not buggy.
                            Apple Store zone above doesn't get the same line
                            — it's the MSRP anchor and only re-prices when
                            Apple itself does, which is rare. */}
                        <div style={{
                          fontSize: 10,
                          color: 'rgba(29,29,31,0.45)',
                          lineHeight: 1.5,
                          marginTop: hasApple ? -2 : 0,
                          marginBottom: 10,
                          maxWidth: 640,
                        }}>
                          Los precios se actualizan una vez al día. Pueden variar si el producto se agota o si el vendedor ajusta el precio en su tienda.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                          {others.map(renderStoreCard)}
                        </div>
                      </div>
                    )}
                    {/* ZONE 3 — "De segunda mano". Compact cards for any
                        Listing rows attached to this Product. Click jumps
                        to the 2ª mano tab for the full ad detail. Dashed
                        amber border separates this peer-to-peer zone from
                        the retailer zones above so the user reads it as a
                        different kind of offer (not a store, not under
                        warranty), without losing the side-by-side context
                        that lets them compare against new prices. */}
                    {prod.listings?.length > 0 && (() => {
                      // Listings whose variant matches what the user is
                      // currently pricing. We compare on variantId — set
                      // at sale time by ModalAnuncio and never null on
                      // active listings, so this is a clean match.
                      const matching = selectedVariant
                        ? prod.listings.filter(l => l.variantId === selectedVariant.id)
                        : [];
                      const visible = showAllListings ? prod.listings : matching;
                      const otherCount = prod.listings.length - matching.length;
                      // Suppress the whole zone when the variant has no
                      // matching listings AND the user hasn't opted in to
                      // seeing every config — the alternative is an empty
                      // zone label with nothing under it, which reads as
                      // a broken UI.
                      if (!visible.length && !otherCount) return null;
                      const headingCount = visible.length;
                      return (
                        <div style={{ marginTop: 18 }}>
                          <div style={{ ...zoneLabelStyle, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span>
                              De segunda mano · {headingCount} {headingCount === 1 ? 'anuncio' : 'anuncios'}
                            </span>
                            {/* Toggle visible only when there ARE listings
                                for other configurations of this product —
                                otherwise there's nothing to "expand to" and
                                the chip would just look broken. */}
                            {otherCount > 0 && (
                              <button
                                onClick={() => setShowAllListings(s => !s)}
                                style={{
                                  background: showAllListings ? 'rgba(245,158,11,0.20)' : 'rgba(255,255,255,0.6)',
                                  border: `1px solid ${showAllListings ? 'rgba(245,158,11,0.5)' : 'rgba(0,0,0,0.1)'}`,
                                  borderRadius: 980,
                                  padding: '3px 10px',
                                  fontSize: 9.5,
                                  fontWeight: 600,
                                  color: showAllListings ? '#b45309' : 'rgba(29,29,31,0.65)',
                                  letterSpacing: 0.4,
                                  textTransform: 'uppercase',
                                  cursor: 'pointer',
                                  transition: 'all .15s',
                                }}
                              >
                                {showAllListings
                                  ? `Solo mi configuración (${matching.length})`
                                  : `Ver todos (+${otherCount})`}
                              </button>
                            )}
                          </div>
                          {visible.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                              {visible.map(renderListingCard)}
                            </div>
                          ) : (
                            <div style={{
                              fontSize: 11, color: 'rgba(29,29,31,0.45)',
                              padding: '10px 14px',
                              background: 'rgba(245,158,11,0.05)',
                              border: '1px dashed rgba(245,158,11,0.25)',
                              borderRadius: 12,
                            }}>
                              Sin anuncios para esta configuración. Hay {otherCount} en otras configuraciones.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                );
              })() : (
                <div style={{ marginTop: 16, padding: '36px 0', textAlign: 'center', color: 'rgba(29,29,31,0.4)' }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13 }}>Sin precios para esta configuración</div>
                  {selectedVariant?.msrp && (
                    <div style={{ fontSize: 11, marginTop: 6 }}>PVP recomendado: {selectedVariant.msrp}€</div>
                  )}
                </div>
              )}
              </div>{/* /RIGHT column */}
            </div>
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
          {tab === 'Historial' && <HistorialChart variant={selectedVariant} />}

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
              ) : prod.listings.map(a => <ListingCard key={a.id} a={a} />)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
