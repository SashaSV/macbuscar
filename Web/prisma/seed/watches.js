// prisma/seed/watches.js
// All Apple Watch families on apple.es

const { slugify, matchKeysFor, colorHex, basePriceFrom, variantMatchKeys } = require('./_shared');

function buildWatch({ name, family, tag, rating, desc, releasedAt, sizes, connectivity, cases }) {
  // cases: [{ material, color, sizes: [...], priceFactor: { '41mm': 0, '45mm': 30 } }]
  // sizes: [{ size: '45mm', basePrice: 449, connectivities: { 'GPS': 0, 'GPS + Cellular': 110 } }]
  const variants = [];
  for (const cs of cases) {
    for (const sz of sizes.filter(s => !cs.sizes || cs.sizes.includes(s.size))) {
      for (const [conn, connDelta] of Object.entries(sz.connectivities)) {
        const baseP = sz.basePrice + (cs.materialDelta || 0) + (cs.colorDelta || 0) + connDelta;
        const nombre = `${sz.size} · ${cs.material} ${cs.color} · ${conn}`;
        variants.push({
          nombre,
          bandSize: sz.size,
          color: `${cs.material} ${cs.color}`,
          colorHex: colorHex(cs.color),
          connectivity: conn,
          msrp: baseP,
          matchKeys: JSON.stringify(variantMatchKeys(name, sz.size, cs.color)),
        });
      }
    }
  }
  return {
    slug: slugify(name),
    nombre: name,
    cat: 'watch',
    family,
    emoji: '⌚',
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

const WATCHES = [
  // ── Apple Watch Ultra 3 ──
  buildWatch({
    name: 'Apple Watch Ultra 3',
    family: 'Apple Watch Ultra',
    tag: 'Ultra',
    rating: 4.9,
    releasedAt: '2025-09',
    desc: 'El reloj más resistente y avanzado. Caja de titanio de 49mm, batería de 36 horas y diseño para aventureros extremos.',
    sizes: [
      { size: '49mm', basePrice: 909, connectivities: { 'GPS + Cellular': 0 } },
    ],
    cases: [
      { material: 'Titanio', color: 'Plata', materialDelta: 0, colorDelta: 0 },
      { material: 'Titanio', color: 'Negro', materialDelta: 0, colorDelta: 0 },
    ],
  }),

  // ── Apple Watch Series 11 ──
  buildWatch({
    name: 'Apple Watch Series 11',
    family: 'Apple Watch Series',
    tag: 'Novedad',
    rating: 4.8,
    releasedAt: '2025-09',
    desc: 'El Apple Watch esencial. Pantalla siempre activa más brillante, chip S11, detección de hipertensión y batería de 24 horas.',
    sizes: [
      { size: '42mm', basePrice: 449, connectivities: { 'GPS': 0, 'GPS + Cellular': 110 } },
      { size: '46mm', basePrice: 479, connectivities: { 'GPS': 0, 'GPS + Cellular': 110 } },
    ],
    cases: [
      { material: 'Aluminio', color: 'Plata',      materialDelta: 0,   colorDelta: 0 },
      { material: 'Aluminio', color: 'Medianoche', materialDelta: 0,   colorDelta: 0 },
      { material: 'Aluminio', color: 'Oro',        materialDelta: 0,   colorDelta: 0 },
      { material: 'Aluminio', color: 'Rosa',       materialDelta: 0,   colorDelta: 0 },
      { material: 'Titanio',  color: 'Natural',    materialDelta: 300, colorDelta: 0, sizes: ['42mm', '46mm'] },
      { material: 'Titanio',  color: 'Oro',        materialDelta: 300, colorDelta: 0, sizes: ['42mm', '46mm'] },
      { material: 'Titanio',  color: 'Negro',      materialDelta: 300, colorDelta: 0, sizes: ['42mm', '46mm'] },
    ],
  }),

  // ── Apple Watch SE 3 ──
  buildWatch({
    name: 'Apple Watch SE 3',
    family: 'Apple Watch SE',
    tag: 'Oferta',
    rating: 4.6,
    releasedAt: '2025-09',
    desc: 'El Apple Watch más accesible. Funciones esenciales de fitness y salud, llamadas y notificaciones. Disponible en dos tamaños.',
    sizes: [
      { size: '40mm', basePrice: 269, connectivities: { 'GPS': 0, 'GPS + Cellular': 70 } },
      { size: '44mm', basePrice: 299, connectivities: { 'GPS': 0, 'GPS + Cellular': 70 } },
    ],
    cases: [
      { material: 'Aluminio', color: 'Medianoche', materialDelta: 0, colorDelta: 0 },
      { material: 'Aluminio', color: 'Plata',      materialDelta: 0, colorDelta: 0 },
      { material: 'Aluminio', color: 'Yema',       materialDelta: 0, colorDelta: 0 },
    ],
  }),
];

module.exports = WATCHES;
