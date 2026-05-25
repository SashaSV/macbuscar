// prisma/seed/airpods.js
// All AirPods families on apple.es

const { slugify, matchKeysFor, colorHex, basePriceFrom, variantMatchKeys } = require('./_shared');

function buildAirpods({ name, family, tag, rating, desc, releasedAt, sizes, colors }) {
  const variants = [];
  for (const c of (colors || [null])) {
    for (const s of sizes) {
      const nombre = [s.label, c].filter(Boolean).join(' · ');
      variants.push({
        nombre,
        memory: s.label,   // store config label in memory for now
        color: c,
        colorHex: c ? colorHex(c) : null,
        msrp: s.price,
        matchKeys: JSON.stringify(variantMatchKeys(name, s.label, c)),
      });
    }
  }
  return {
    slug: slugify(name),
    nombre: name,
    cat: 'airpods',
    family,
    emoji: '🎧',
    rating,
    tag: tag || '',
    desc,
    fotos: JSON.stringify([]),
    fotoLabels: JSON.stringify([]),
    specs: JSON.stringify({}),
    basePrice: basePriceFrom(variants),
    releasedAt,
    matchKeys: JSON.stringify(matchKeysFor(name)),
    variants,
  };
}

const AIRPODS = [
  // ── AirPods Max 2 — premium over-ear ──
  buildAirpods({
    name: 'AirPods Max 2',
    family: 'AirPods Max',
    tag: 'Pro',
    rating: 4.7,
    releasedAt: '2025-09',
    desc: 'Audio premium con cancelación de ruido activa. Diseño de aluminio anodizado, chip H2 y Audio Espacial Personalizado.',
    sizes: [
      { label: 'Único', price: 579 },
    ],
    colors: ['Negro Espacial', 'Azul Mac', 'Naranja Cósmico', 'Lavanda', 'Plata'],
  }),

  // ── AirPods Pro 3 ──
  buildAirpods({
    name: 'AirPods Pro 3',
    family: 'AirPods Pro',
    tag: 'Novedad',
    rating: 4.8,
    releasedAt: '2025-09',
    desc: 'Cancelación de ruido activa de última generación, monitor de frecuencia cardíaca y Audio Espacial. Hasta 8 horas de batería.',
    sizes: [
      { label: 'Estuche USB-C', price: 279 },
    ],
    colors: ['Blanco'],
  }),

  // ── AirPods 4 ──
  buildAirpods({
    name: 'AirPods 4',
    family: 'AirPods',
    tag: '',
    rating: 4.6,
    releasedAt: '2024-09',
    desc: 'El nuevo diseño abierto más cómodo. Chip H2 y compatible con Audio Espacial Personalizado.',
    sizes: [
      { label: 'Estuche USB-C',                            price: 149 },
      { label: 'Estuche USB-C con Cancelación Activa',     price: 199 },
    ],
    colors: ['Blanco'],
  }),
];

module.exports = AIRPODS;
