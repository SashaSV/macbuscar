// Maps category slug to Tabler icon class name.
// Also picks an icon based on product name when category is generic.

export const CATEGORY_ICON = {
  iphone: 'ti-device-mobile',
  mac: 'ti-device-laptop',
  ipad: 'ti-device-tablet',
  watch: 'ti-clock',
  airpods: 'ti-headphones',
  accesorios: 'ti-plug',
  all: 'ti-apps',
};

export function getProductIcon(prod) {
  if (!prod) return 'ti-package';
  const name = (prod.nombre || '').toLowerCase();
  if (name.includes('iphone')) return 'ti-device-mobile';
  if (name.includes('macbook') || name.includes('imac') || name.includes('mac mini')) return 'ti-device-laptop';
  if (name.includes('ipad')) return 'ti-device-tablet';
  if (name.includes('watch')) return 'ti-clock';
  if (name.includes('airpods') || name.includes('earpods') || name.includes('auriculares')) return 'ti-headphones';
  if (name.includes('airtag')) return 'ti-tag';
  if (name.includes('pencil')) return 'ti-pencil';
  if (name.includes('magsafe') || name.includes('charger') || name.includes('cargador')) return 'ti-bolt';
  if (name.includes('cable')) return 'ti-plug-connected';
  if (name.includes('funda') || name.includes('case')) return 'ti-shield';
  if (name.includes('adaptador') || name.includes('adapter')) return 'ti-refresh';
  return CATEGORY_ICON[prod.cat] || 'ti-package';
}

// Tag-color mapping for the sticker badges
export const TAG_BADGE = {
  'Novedad':      { bg: 'rgba(59,130,246,0.9)',  border: 'rgba(59,130,246,1)',  shadow: 'rgba(59,130,246,0.3)' },
  'Más vendido':  { bg: 'rgba(245,158,11,0.95)', border: 'rgba(245,158,11,1)',  shadow: 'rgba(245,158,11,0.3)' },
  'Pro':          { bg: 'rgba(168,85,247,0.9)',  border: 'rgba(168,85,247,1)',  shadow: 'rgba(168,85,247,0.3)' },
  'Ultra':        { bg: 'rgba(236,72,153,0.9)',  border: 'rgba(236,72,153,1)',  shadow: 'rgba(236,72,153,0.3)' },
  'Exclusivo':    { bg: 'rgba(20,184,166,0.9)',  border: 'rgba(20,184,166,1)',  shadow: 'rgba(20,184,166,0.3)' },
  'Oferta':       { bg: 'rgba(16,185,129,0.9)',  border: 'rgba(16,185,129,1)',  shadow: 'rgba(16,185,129,0.3)' },
  'Top':          { bg: 'rgba(245,158,11,0.95)', border: 'rgba(245,158,11,1)',  shadow: 'rgba(245,158,11,0.3)' },
};
