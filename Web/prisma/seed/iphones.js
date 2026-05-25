// prisma/seed/iphones.js
// All iPhone families currently sold on apple.es (2025-2026)
// Source: apple.es/shop/buy-iphone — official Spanish pricing

const { slugify, matchKeysFor, colorHex, basePriceFrom, variantMatchKeys } = require('./_shared');

// Build a Product+Variants block from a config
function buildIphone({ name, family, tag, rating, desc, releasedAt, sizes, colors, basePrice, display }) {
  // sizes: [{ memory: '256GB', price: 1319 }, ...]
  // colors: ['Naranja Cósmico', 'Azul Intenso', 'Plata']
  const variants = [];
  for (const c of colors) {
    for (const s of sizes) {
      variants.push({
        nombre: `${s.memory} · ${c}`,
        memory: s.memory,
        color: c,
        colorHex: colorHex(c),
        display,
        msrp: s.price,
        matchKeys: JSON.stringify(variantMatchKeys(name, s.memory, c)),
      });
    }
  }
  return {
    slug: slugify(name),
    nombre: name,
    cat: 'iphone',
    family,
    emoji: '📱',
    rating,
    tag: tag || '',
    desc,
    fotos: JSON.stringify([]),
    fotoLabels: JSON.stringify([]),
    specs: JSON.stringify({}),
    basePrice: basePrice || basePriceFrom(variants),
    releasedAt,
    matchKeys: JSON.stringify(matchKeysFor(name)),
    variants,
  };
}

const IPHONES = [
  // ── iPhone 17 Pro Max — top-of-the-line, 6.9" ──
  buildIphone({
    name: 'iPhone 17 Pro Max',
    display: '6.9"',
    family: 'iPhone 17 Pro',
    tag: 'Pro',
    rating: 4.9,
    releasedAt: '2025-09',
    desc: 'El iPhone más potente con cámara de zoom 8x, chip A19 Pro y pantalla Super Retina XDR de 6,9". Diseño unibody de aluminio forjado en caliente.',
    sizes: [
      { memory: '256GB', price: 1469 },
      { memory: '512GB', price: 1719 },
      { memory: '1TB',   price: 1969 },
      { memory: '2TB',   price: 2469 },
    ],
    colors: ['Naranja Cósmico', 'Azul Intenso', 'Plata'],
  }),

  // ── iPhone 17 Pro — 6.3" ──
  buildIphone({
    name: 'iPhone 17 Pro',
    display: '6.3"',
    family: 'iPhone 17 Pro',
    tag: 'Pro',
    rating: 4.9,
    releasedAt: '2025-09',
    desc: 'Cámara Pro de 48 MP, zoom óptico 8x, chip A19 Pro y diseño unibody de aluminio. Pantalla Super Retina XDR de 6,3".',
    sizes: [
      { memory: '256GB', price: 1319 },
      { memory: '512GB', price: 1569 },
      { memory: '1TB',   price: 1819 },
      { memory: '2TB',   price: 2319 },
    ],
    colors: ['Naranja Cósmico', 'Azul Intenso', 'Plata'],
  }),

  // ── iPhone Air — ultra-thin, 6.5" ──
  buildIphone({
    name: 'iPhone Air',
    display: '6.5"',
    family: 'iPhone Air',
    tag: 'Novedad',
    rating: 4.8,
    releasedAt: '2025-09',
    desc: 'El iPhone más fino. Titanio aeroespacial, chip A19 Pro y diseño ultra delgado de solo 5,6 mm. Pantalla de 6,5".',
    sizes: [
      { memory: '256GB', price: 1219 },
      { memory: '512GB', price: 1469 },
      { memory: '1TB',   price: 1719 },
    ],
    colors: ['Negro Espacial', 'Cielo', 'Oro Claro', 'Blanco Nube'],
  }),

  // ── iPhone 17 — 6.3" standard ──
  buildIphone({
    name: 'iPhone 17',
    display: '6.3"',
    family: 'iPhone 17',
    tag: 'Novedad',
    rating: 4.7,
    releasedAt: '2025-09',
    desc: 'Pantalla Super Retina XDR de 6,3", chip A19 y sistema de doble cámara avanzado. El iPhone esencial para todos.',
    sizes: [
      { memory: '256GB', price: 959 },
      { memory: '512GB', price: 1209 },
    ],
    colors: ['Lavanda', 'Verde Salvia', 'Niebla', 'Blanco', 'Negro'],
  }),

  // ── iPhone 17e — affordable A19 phone ──
  buildIphone({
    name: 'iPhone 17e',
    display: '6.1"',
    family: 'iPhone 17e',
    tag: '',
    rating: 4.5,
    releasedAt: '2026-02',
    desc: 'Chip A19, cámara avanzada y diseño compacto a un precio más accesible. Pantalla de 6,1".',
    sizes: [
      { memory: '128GB', price: 709 },
      { memory: '256GB', price: 839 },
      { memory: '512GB', price: 1089 },
    ],
    colors: ['Blanco Estrella', 'Medianoche'],
  }),

  // ── iPhone 16 Plus — previous gen, kept in lineup ──
  buildIphone({
    name: 'iPhone 16 Plus',
    display: '6.7"',
    family: 'iPhone 16',
    tag: '',
    rating: 4.7,
    releasedAt: '2024-09',
    desc: 'Pantalla Super Retina XDR de 6,7", chip A18 y batería de toda la vida. Disponible mientras hay stock.',
    sizes: [
      { memory: '128GB', price: 959 },
      { memory: '256GB', price: 1089 },
      { memory: '512GB', price: 1339 },
    ],
    colors: ['Ultramar', 'Verde Azulado', 'Rosa', 'Blanco', 'Negro'],
  }),

  // ── iPhone 16 — previous gen ──
  buildIphone({
    name: 'iPhone 16',
    display: '6.1"',
    family: 'iPhone 16',
    tag: 'Oferta',
    rating: 4.6,
    releasedAt: '2024-09',
    desc: 'Chip A18, pantalla de 6,1" y sistema de cámaras avanzado. Excelente relación calidad-precio.',
    sizes: [
      { memory: '128GB', price: 859 },
      { memory: '256GB', price: 989 },
      { memory: '512GB', price: 1239 },
    ],
    colors: ['Ultramar', 'Verde Azulado', 'Rosa', 'Blanco', 'Negro'],
  }),

  // ── iPhone 16e — budget option ──
  buildIphone({
    name: 'iPhone 16e',
    display: '6.1"',
    family: 'iPhone 16e',
    tag: 'Oferta',
    rating: 4.4,
    releasedAt: '2025-02',
    desc: 'Chip A18 y cámara Fusion. La opción más accesible para entrar al ecosistema Apple.',
    sizes: [
      { memory: '128GB', price: 599 },
      { memory: '256GB', price: 729 },
      { memory: '512GB', price: 979 },
    ],
    colors: ['Blanco', 'Negro'],
  }),
];

module.exports = IPHONES;
