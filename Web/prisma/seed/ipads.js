// prisma/seed/ipads.js
// All iPad families on apple.es

const { slugify, matchKeysFor, colorHex, basePriceFrom, variantMatchKeys } = require('./_shared');

function buildIpad({ name, family, tag, rating, desc, releasedAt, display, cpu, sizes, colors }) {
  // sizes: [{ memory: '256GB', connectivity: 'Wi-Fi', price: 1199 }, ...]
  const variants = [];
  for (const c of colors) {
    for (const s of sizes) {
      const nombre = [s.memory, s.connectivity, c].filter(Boolean).join(' · ');
      variants.push({
        nombre,
        memory: s.memory,
        color: c,
        colorHex: colorHex(c),
        connectivity: s.connectivity,
        cpu,
        display,
        msrp: s.price,
        matchKeys: JSON.stringify(variantMatchKeys(name, s.memory, c)),
      });
    }
  }
  return {
    slug: slugify(name),
    nombre: name,
    cat: 'ipad',
    family,
    emoji: '📱',
    rating,
    tag: tag || '',
    desc,
    fotos: JSON.stringify([]),
    fotoLabels: JSON.stringify([]),
    specs: JSON.stringify({ cpu, display }),
    basePrice: basePriceFrom(variants),
    releasedAt,
    matchKeys: JSON.stringify(matchKeysFor(name)),
    variants,
  };
}

const IPADS = [
  // ── iPad Pro 13" M4 ──
  buildIpad({
    name: 'iPad Pro 13" M4',
    family: 'iPad Pro',
    tag: 'Pro',
    rating: 4.9,
    releasedAt: '2024-05',
    display: '13 pulgadas Ultra Retina XDR',
    cpu: 'M4',
    desc: 'El iPad más avanzado. Chip M4, pantalla Ultra Retina XDR OLED y diseño ultra delgado. Para profesionales creativos.',
    sizes: [
      { memory: '256GB', connectivity: 'Wi-Fi',           price: 1499 },
      { memory: '512GB', connectivity: 'Wi-Fi',           price: 1739 },
      { memory: '1TB',   connectivity: 'Wi-Fi',           price: 2219 },
      { memory: '2TB',   connectivity: 'Wi-Fi',           price: 2699 },
      { memory: '256GB', connectivity: 'Wi-Fi + Cellular', price: 1729 },
      { memory: '512GB', connectivity: 'Wi-Fi + Cellular', price: 1969 },
      { memory: '1TB',   connectivity: 'Wi-Fi + Cellular', price: 2449 },
      { memory: '2TB',   connectivity: 'Wi-Fi + Cellular', price: 2929 },
    ],
    colors: ['Plateado', 'Negro Espacial'],
  }),

  // ── iPad Pro 11" M4 ──
  buildIpad({
    name: 'iPad Pro 11" M4',
    family: 'iPad Pro',
    tag: 'Pro',
    rating: 4.8,
    releasedAt: '2024-05',
    display: '11 pulgadas Ultra Retina XDR',
    cpu: 'M4',
    desc: 'Toda la potencia del M4 en el formato más portátil. Pantalla Ultra Retina XDR OLED y diseño ultra delgado.',
    sizes: [
      { memory: '256GB', connectivity: 'Wi-Fi',           price: 1199 },
      { memory: '512GB', connectivity: 'Wi-Fi',           price: 1439 },
      { memory: '1TB',   connectivity: 'Wi-Fi',           price: 1919 },
      { memory: '2TB',   connectivity: 'Wi-Fi',           price: 2399 },
      { memory: '256GB', connectivity: 'Wi-Fi + Cellular', price: 1429 },
      { memory: '512GB', connectivity: 'Wi-Fi + Cellular', price: 1669 },
      { memory: '1TB',   connectivity: 'Wi-Fi + Cellular', price: 2149 },
      { memory: '2TB',   connectivity: 'Wi-Fi + Cellular', price: 2629 },
    ],
    colors: ['Plateado', 'Negro Espacial'],
  }),

  // ── iPad Air 13" M4 ──
  buildIpad({
    name: 'iPad Air 13" M4',
    family: 'iPad Air',
    tag: 'Novedad',
    rating: 4.7,
    releasedAt: '2025-03',
    display: '13 pulgadas Liquid Retina',
    cpu: 'M4',
    desc: 'Más pantalla, más potencia. Chip M4 y pantalla Liquid Retina de 13". Ideal para multitarea y creatividad.',
    sizes: [
      { memory: '128GB', connectivity: 'Wi-Fi',           price: 849 },
      { memory: '256GB', connectivity: 'Wi-Fi',           price: 999 },
      { memory: '512GB', connectivity: 'Wi-Fi',           price: 1239 },
      { memory: '1TB',   connectivity: 'Wi-Fi',           price: 1479 },
      { memory: '128GB', connectivity: 'Wi-Fi + Cellular', price: 999 },
      { memory: '256GB', connectivity: 'Wi-Fi + Cellular', price: 1149 },
      { memory: '512GB', connectivity: 'Wi-Fi + Cellular', price: 1389 },
      { memory: '1TB',   connectivity: 'Wi-Fi + Cellular', price: 1629 },
    ],
    colors: ['Plateado', 'Azul Mac', 'Púrpura', 'Gris Espacial'],
  }),

  // ── iPad Air 11" M4 ──
  buildIpad({
    name: 'iPad Air 11" M4',
    family: 'iPad Air',
    tag: 'Novedad',
    rating: 4.7,
    releasedAt: '2025-03',
    display: '11 pulgadas Liquid Retina',
    cpu: 'M4',
    desc: 'Chip M4 en el formato más portátil. Pantalla Liquid Retina de 11" y compatibilidad con Apple Pencil Pro.',
    sizes: [
      { memory: '128GB', connectivity: 'Wi-Fi',           price: 649 },
      { memory: '256GB', connectivity: 'Wi-Fi',           price: 799 },
      { memory: '512GB', connectivity: 'Wi-Fi',           price: 1039 },
      { memory: '1TB',   connectivity: 'Wi-Fi',           price: 1279 },
      { memory: '128GB', connectivity: 'Wi-Fi + Cellular', price: 799 },
      { memory: '256GB', connectivity: 'Wi-Fi + Cellular', price: 949 },
      { memory: '512GB', connectivity: 'Wi-Fi + Cellular', price: 1189 },
      { memory: '1TB',   connectivity: 'Wi-Fi + Cellular', price: 1429 },
    ],
    colors: ['Plateado', 'Azul Mac', 'Púrpura', 'Gris Espacial'],
  }),

  // ── iPad (standard, 11") ──
  buildIpad({
    name: 'iPad (A16)',
    family: 'iPad',
    tag: '',
    rating: 4.6,
    releasedAt: '2025-03',
    display: '11 pulgadas Liquid Retina',
    cpu: 'A16',
    desc: 'El iPad esencial. Chip A16, pantalla Liquid Retina de 11" y diseño all-screen. Perfecto para el día a día.',
    sizes: [
      { memory: '128GB', connectivity: 'Wi-Fi',           price: 409 },
      { memory: '256GB', connectivity: 'Wi-Fi',           price: 519 },
      { memory: '512GB', connectivity: 'Wi-Fi',           price: 739 },
      { memory: '128GB', connectivity: 'Wi-Fi + Cellular', price: 559 },
      { memory: '256GB', connectivity: 'Wi-Fi + Cellular', price: 669 },
      { memory: '512GB', connectivity: 'Wi-Fi + Cellular', price: 889 },
    ],
    colors: ['Plateado', 'Azul Mac', 'Rosa', 'Amarillo'],
  }),

  // ── iPad mini ──
  buildIpad({
    name: 'iPad mini A17 Pro',
    family: 'iPad mini',
    tag: '',
    rating: 4.7,
    releasedAt: '2024-10',
    display: '8,3 pulgadas Liquid Retina',
    cpu: 'A17 Pro',
    desc: 'El iPad más compacto. Chip A17 Pro, pantalla Liquid Retina de 8,3" y compatibilidad con Apple Pencil Pro.',
    sizes: [
      { memory: '128GB', connectivity: 'Wi-Fi',           price: 609 },
      { memory: '256GB', connectivity: 'Wi-Fi',           price: 739 },
      { memory: '512GB', connectivity: 'Wi-Fi',           price: 999 },
      { memory: '128GB', connectivity: 'Wi-Fi + Cellular', price: 769 },
      { memory: '256GB', connectivity: 'Wi-Fi + Cellular', price: 889 },
      { memory: '512GB', connectivity: 'Wi-Fi + Cellular', price: 1149 },
    ],
    colors: ['Plateado', 'Azul Mac', 'Púrpura', 'Gris Espacial'],
  }),
];

module.exports = IPADS;
