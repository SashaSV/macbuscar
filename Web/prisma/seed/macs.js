// prisma/seed/macs.js
// All Mac families currently sold on apple.es (2025-2026)

const { slugify, matchKeysFor, colorHex, basePriceFrom, variantMatchKeys } = require('./_shared');

// Build a Mac Product (Macs have more dimensions: memory, storage, CPU/GPU)
// For seed we keep it simple: 1 variant per (memory + storage + color)
function buildMac({ name, family, cat, tag, rating, desc, releasedAt, configs, colors, cpu, display }) {
  // configs: [{ memory: '16GB', storage: '256GB', price: 1199 }, ...]
  // colors: ['Plateado', 'Medianoche', ...]
  const variants = [];
  for (const c of (colors || [null])) {
    for (const cfg of configs) {
      const memDisplay = cfg.memory ? `${cfg.memory} RAM` : '';
      const storDisplay = cfg.storage;
      const nombre = [memDisplay, storDisplay, c].filter(Boolean).join(' · ');
      variants.push({
        nombre,
        memory: cfg.storage,           // we use "memory" for storage in Mac context
        color: c,
        colorHex: c ? colorHex(c) : null,
        cpu: cfg.cpu || cpu || null,
        gpu: cfg.gpu || null,
        display: display || null,
        msrp: cfg.price,
        matchKeys: JSON.stringify(variantMatchKeys(name, cfg.storage, c)),
      });
    }
  }
  return {
    slug: slugify(name),
    nombre: name,
    cat,
    family,
    emoji: cat === 'mac' ? '💻' : '🖥️',
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

const MACS = [
  // ── MacBook Pro 16" M5 Max ──
  buildMac({
    name: 'MacBook Pro 16" M5 Max',
    family: 'MacBook Pro 16',
    cat: 'mac',
    tag: 'Pro',
    rating: 4.9,
    releasedAt: '2025-10',
    display: '16,2 pulgadas',
    cpu: 'M5 Max',
    desc: 'La máxima potencia portátil. Chip M5 Max, hasta 64 GB de memoria unificada y pantalla Liquid Retina XDR de 16,2".',
    configs: [
      { memory: '36GB', storage: '512GB', cpu: 'M5 Pro', price: 2929 },
      { memory: '36GB', storage: '1TB',   cpu: 'M5 Pro', price: 3179 },
      { memory: '48GB', storage: '1TB',   cpu: 'M5 Max', price: 4129 },
      { memory: '64GB', storage: '1TB',   cpu: 'M5 Max', price: 4629 },
      { memory: '64GB', storage: '2TB',   cpu: 'M5 Max', price: 5129 },
    ],
    colors: ['Negro Espacial', 'Plateado'],
  }),

  // ── MacBook Pro 14" M5 Pro ──
  buildMac({
    name: 'MacBook Pro 14" M5 Pro',
    family: 'MacBook Pro 14',
    cat: 'mac',
    tag: 'Pro',
    rating: 4.9,
    releasedAt: '2025-10',
    display: '14,2 pulgadas',
    cpu: 'M5 Pro',
    desc: 'Potencia profesional en un formato portátil. Chip M5 o M5 Pro, hasta 36 GB de RAM y pantalla Liquid Retina XDR de 14,2".',
    configs: [
      { memory: '16GB', storage: '512GB', cpu: 'M5',     price: 1929 },
      { memory: '24GB', storage: '512GB', cpu: 'M5 Pro', price: 2429 },
      { memory: '24GB', storage: '1TB',   cpu: 'M5 Pro', price: 2679 },
      { memory: '36GB', storage: '1TB',   cpu: 'M5 Pro', price: 3179 },
    ],
    colors: ['Negro Espacial', 'Plateado'],
  }),

  // ── MacBook Air 15" M5 ──
  buildMac({
    name: 'MacBook Air 15" M5',
    family: 'MacBook Air 15',
    cat: 'mac',
    tag: '',
    rating: 4.8,
    releasedAt: '2025-03',
    display: '15,3 pulgadas',
    cpu: 'M5',
    desc: 'Más pantalla, mismo diseño ultraligero. Chip M5, hasta 24 GB de memoria unificada y batería de 18 horas.',
    configs: [
      { memory: '16GB', storage: '256GB', price: 1399 },
      { memory: '16GB', storage: '512GB', price: 1629 },
      { memory: '24GB', storage: '512GB', price: 1879 },
      { memory: '24GB', storage: '1TB',   price: 2129 },
    ],
    colors: ['Medianoche', 'Plateado', 'Cielo', 'Oro'],
  }),

  // ── MacBook Air 13" M5 ──
  buildMac({
    name: 'MacBook Air 13" M5',
    family: 'MacBook Air 13',
    cat: 'mac',
    tag: 'Novedad',
    rating: 4.8,
    releasedAt: '2025-03',
    display: '13,6 pulgadas',
    cpu: 'M5',
    desc: 'El portátil más popular del mundo. Chip M5, diseño ultraligero de 1,24 kg y batería de 18 horas.',
    configs: [
      { memory: '16GB', storage: '256GB', price: 1199 },
      { memory: '16GB', storage: '512GB', price: 1429 },
      { memory: '24GB', storage: '512GB', price: 1679 },
      { memory: '24GB', storage: '1TB',   price: 1929 },
    ],
    colors: ['Medianoche', 'Plateado', 'Cielo', 'Oro'],
  }),

  // ── MacBook Neo — ultra-affordable laptop ──
  buildMac({
    name: 'MacBook Neo',
    family: 'MacBook Neo',
    cat: 'mac',
    tag: 'Novedad',
    rating: 4.6,
    releasedAt: '2026-01',
    display: '12 pulgadas',
    cpu: 'A18 Pro',
    desc: 'El portátil más accesible de Apple. Chip A18 Pro, pantalla de 12" y batería de día completo. Ideal para estudiantes.',
    configs: [
      { memory: '8GB',  storage: '128GB', price: 699 },
      { memory: '8GB',  storage: '256GB', price: 829 },
      { memory: '16GB', storage: '256GB', price: 979 },
      { memory: '16GB', storage: '512GB', price: 1129 },
    ],
    colors: ['Plateado', 'Rosa', 'Cielo', 'Amarillo'],
  }),

  // ── iMac M4 (24") ──
  buildMac({
    name: 'iMac M4',
    family: 'iMac',
    cat: 'mac',
    tag: '',
    rating: 4.7,
    releasedAt: '2024-10',
    display: '24 pulgadas Retina 4.5K',
    cpu: 'M4',
    desc: 'Todo en uno. Chip M4, pantalla Retina 4.5K de 24" y diseño icónico en 7 colores vibrantes.',
    configs: [
      { memory: '16GB', storage: '256GB', price: 1549 },
      { memory: '16GB', storage: '512GB', price: 1779 },
      { memory: '24GB', storage: '512GB', price: 2029 },
      { memory: '24GB', storage: '1TB',   price: 2279 },
    ],
    colors: ['Plateado', 'Azul Mac', 'Verde', 'Rosa', 'Naranja Cósmico', 'Amarillo', 'Púrpura'],
  }),

  // ── Mac mini M4 ──
  buildMac({
    name: 'Mac mini M4',
    family: 'Mac mini',
    cat: 'mac',
    tag: '',
    rating: 4.8,
    releasedAt: '2024-11',
    display: null,
    cpu: 'M4',
    desc: 'El Mac más compacto y potente. Chip M4 o M4 Pro en un diseño de solo 12,7 cm. Necesita monitor y teclado por separado.',
    configs: [
      { memory: '16GB', storage: '256GB', cpu: 'M4',     price: 729 },
      { memory: '16GB', storage: '512GB', cpu: 'M4',     price: 959 },
      { memory: '24GB', storage: '512GB', cpu: 'M4 Pro', price: 1559 },
      { memory: '24GB', storage: '1TB',   cpu: 'M4 Pro', price: 1809 },
      { memory: '48GB', storage: '1TB',   cpu: 'M4 Pro', price: 2459 },
    ],
    colors: null,  // single color
  }),

  // ── Mac Studio ──
  buildMac({
    name: 'Mac Studio',
    family: 'Mac Studio',
    cat: 'mac',
    tag: 'Pro',
    rating: 4.9,
    releasedAt: '2025-03',
    display: null,
    cpu: 'M5 Max / M5 Ultra',
    desc: 'Potencia de estudio profesional. Chip M5 Max o M5 Ultra. Para edición de vídeo, 3D, IA y desarrollo.',
    configs: [
      { memory: '36GB',  storage: '512GB', cpu: 'M5 Max',   price: 2429 },
      { memory: '48GB',  storage: '1TB',   cpu: 'M5 Max',   price: 2929 },
      { memory: '64GB',  storage: '1TB',   cpu: 'M5 Max',   price: 3429 },
      { memory: '64GB',  storage: '1TB',   cpu: 'M5 Ultra', price: 4929 },
      { memory: '128GB', storage: '2TB',   cpu: 'M5 Ultra', price: 6429 },
    ],
    colors: null,
  }),

  // ── Studio Display ──
  buildMac({
    name: 'Studio Display',
    family: 'Studio Display',
    cat: 'mac',
    tag: '',
    rating: 4.6,
    releasedAt: '2022-03',
    display: '27 pulgadas Retina 5K',
    cpu: null,
    desc: 'Pantalla Retina 5K de 27" con cámara, micrófonos y altavoces de seis controladores. Acabado estándar o nano-textura.',
    configs: [
      { memory: null, storage: 'Estándar',          price: 1699 },
      { memory: null, storage: 'Estándar + ajustable', price: 2099 },
      { memory: null, storage: 'Nano-textura',      price: 2099 },
      { memory: null, storage: 'Nano + ajustable',  price: 2499 },
    ],
    colors: null,
  }),
];

module.exports = MACS;
