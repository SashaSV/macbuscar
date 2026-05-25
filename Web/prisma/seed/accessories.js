// prisma/seed/accessories.js
// Apple TV, HomePod, AirTag, Apple Pencil and other accessories

const { slugify, matchKeysFor, colorHex, basePriceFrom, variantMatchKeys } = require('./_shared');

function buildSimple({ name, family, cat, emoji, tag, rating, desc, releasedAt, variants }) {
  const variantsWithKeys = variants.map(v => ({
    nombre: v.nombre,
    memory: v.memory || null,
    color: v.color || null,
    colorHex: v.color ? colorHex(v.color) : null,
    msrp: v.price,
    matchKeys: JSON.stringify(variantMatchKeys(name, v.memory || '', v.color || '')),
  }));
  return {
    slug: slugify(name),
    nombre: name,
    cat,
    family,
    emoji,
    rating,
    tag: tag || '',
    desc,
    fotos: JSON.stringify([]),
    fotoLabels: JSON.stringify([]),
    specs: JSON.stringify({}),
    basePrice: basePriceFrom(variantsWithKeys),
    releasedAt,
    matchKeys: JSON.stringify(matchKeysFor(name)),
    variants: variantsWithKeys,
  };
}

const ACCESSORIES = [
  // ── Apple TV 4K ──
  buildSimple({
    name: 'Apple TV 4K',
    family: 'Apple TV',
    cat: 'tv',
    emoji: '📺',
    tag: '',
    rating: 4.7,
    releasedAt: '2024-10',
    desc: 'Entretenimiento 4K HDR con Dolby Vision. Chip A15 Bionic y mando Siri Remote.',
    variants: [
      { nombre: '64GB · Wi-Fi',         memory: '64GB',  price: 169 },
      { nombre: '128GB · Wi-Fi + Ethernet', memory: '128GB', price: 189 },
    ],
  }),

  // ── HomePod ──
  buildSimple({
    name: 'HomePod (2.ª generación)',
    family: 'HomePod',
    cat: 'tv',
    emoji: '🔊',
    tag: '',
    rating: 4.6,
    releasedAt: '2023-02',
    desc: 'Sonido envolvente con Audio Espacial. Compatible con Siri y HomeKit. Tweeters y micrófonos avanzados.',
    variants: [
      { nombre: 'Blanco',     color: 'Blanco',         price: 349 },
      { nombre: 'Medianoche', color: 'Medianoche',     price: 349 },
    ],
  }),

  // ── HomePod mini ──
  buildSimple({
    name: 'HomePod mini',
    family: 'HomePod',
    cat: 'tv',
    emoji: '🔊',
    tag: 'Oferta',
    rating: 4.5,
    releasedAt: '2020-11',
    desc: 'Altavoz inteligente compacto. Audio 360° y compatible con HomeKit.',
    variants: [
      { nombre: 'Blanco',     color: 'Blanco',         price: 109 },
      { nombre: 'Medianoche', color: 'Medianoche',     price: 109 },
      { nombre: 'Azul Mac',   color: 'Azul Mac',       price: 109 },
      { nombre: 'Amarillo',   color: 'Amarillo',       price: 109 },
      { nombre: 'Naranja',    color: 'Naranja Cósmico', price: 109 },
    ],
  }),

  // ── AirTag ──
  buildSimple({
    name: 'AirTag',
    family: 'AirTag',
    cat: 'accesorios',
    emoji: '🏷️',
    tag: '',
    rating: 4.7,
    releasedAt: '2021-04',
    desc: 'Localiza tus objetos con la red Buscar de Apple. Compatible con miles de millones de dispositivos.',
    variants: [
      { nombre: '1 unidad',  memory: '1 pack',  price: 35 },
      { nombre: 'Pack 4',    memory: '4 pack',  price: 119 },
    ],
  }),

  // ── Apple Pencil Pro ──
  buildSimple({
    name: 'Apple Pencil Pro',
    family: 'Apple Pencil',
    cat: 'accesorios',
    emoji: '✏️',
    tag: 'Pro',
    rating: 4.8,
    releasedAt: '2024-05',
    desc: 'El Apple Pencil más avanzado. Squeeze, barrel roll, háptica y Buscar. Para iPad Pro M4 y iPad Air M4.',
    variants: [
      { nombre: 'Estándar', price: 139 },
    ],
  }),

  // ── Apple Pencil (USB-C) — entry level ──
  buildSimple({
    name: 'Apple Pencil (USB-C)',
    family: 'Apple Pencil',
    cat: 'accesorios',
    emoji: '✏️',
    tag: '',
    rating: 4.6,
    releasedAt: '2023-11',
    desc: 'El Apple Pencil más accesible. Inclinación, baja latencia y carga por USB-C.',
    variants: [
      { nombre: 'Estándar', price: 89 },
    ],
  }),

  // ── MagSafe Charger ──
  buildSimple({
    name: 'Cargador MagSafe',
    family: 'MagSafe',
    cat: 'accesorios',
    emoji: '⚡',
    tag: '',
    rating: 4.5,
    releasedAt: '2024-09',
    desc: 'Carga inalámbrica rápida para iPhone y AirPods con estuche compatible con MagSafe.',
    variants: [
      { nombre: '1 metro', memory: '1m', price: 45 },
      { nombre: '2 metros', memory: '2m', price: 55 },
    ],
  }),
];

module.exports = ACCESSORIES;
