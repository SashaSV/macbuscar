const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STORES = [
  { id: 'apple',      nombre: 'Apple Store',    logo: '🍎', url: 'https://www.apple.com/es/shop/', badge: 'OFICIAL', delay: 900  },
  { id: 'mediamarkt', nombre: 'MediaMarkt',      logo: '📺', url: 'https://www.mediamarkt.es/',    badge: 'TOP',     delay: 1400 },
  { id: 'pccomp',     nombre: 'PcComponentes',   logo: '💻', url: 'https://www.pccomponentes.com/',badge: 'TECH',    delay: 1100 },
  { id: 'fnac',       nombre: 'Fnac',            logo: '📦', url: 'https://www.fnac.es/',           badge: '',        delay: 1600 },
  { id: 'elcorte',    nombre: 'El Corte Inglés', logo: '🏬', url: 'https://www.elcorteingles.es/', badge: '',        delay: 2000 },
  { id: 'amazon',     nombre: 'Amazon.es',       logo: '🛒', url: 'https://www.amazon.es/',         badge: 'OFERTA',  delay: 800  },
  { id: 'worten',     nombre: 'Worten',          logo: '🔌', url: 'https://www.worten.es/',         badge: '',        delay: 1300 },
  { id: 'istore',     nombre: 'iStore',          logo: '🍏', url: 'https://www.istore.es/',         badge: 'PREMIUM', delay: 1000 },
];

const PRODUCTS = [
  {
    slug: 'iphone-16-pro-256gb',
    nombre: 'iPhone 16 Pro 256 GB', cat: 'iphone', emoji: '📱', rating: 4.9, tag: 'Novedad',
    fotos: ['#1a1a2e','#16213e','#0f3460','#533483'],
    fotoLabels: ['Titanio Negro','Titanio Blanco','Titanio Natural','Titanio Desierto'],
    specs: { Pantalla:'6.3″ Super Retina XDR OLED', Chip:'A18 Pro', Cámara:'48MP + 48MP + 12MP', Batería:'Hasta 27h', Almacenamiento:'256 GB', '5G':'Sí', 'Face ID':'Sí', Peso:'199 g' },
    desc: 'El iPhone más avanzado con chip A18 Pro, cámara de 48MP con zoom óptico 5x y pantalla Always-On ProMotion de 120Hz.',
    prices: { apple:1229, mediamarkt:1219, pccomp:1199, amazon:1185, elcorte:1229, fnac:1215, worten:1209, istore:1229 },
    reviews: [
      { fuente:'Xataka',   nota:9.2, texto:'La mejor cámara en un iPhone. El A18 Pro marca diferencia en rendimiento.', fecha:'Oct 2024' },
      { fuente:'El Mundo', nota:8.9, texto:'Diseño en titanio elegante y duradera. La batería ha mejorado notablemente.', fecha:'Oct 2024' },
    ],
    history: [{m:'Ene',p:1289},{m:'Feb',p:1260},{m:'Mar',p:1245},{m:'Abr',p:1229},{m:'May',p:1199},{m:'Jun',p:1185}],
  },
  {
    slug: 'macbook-air-m3-13',
    nombre: 'MacBook Air M3 13″', cat: 'mac', emoji: '💻', rating: 4.8, tag: 'Más vendido',
    fotos: ['#1c1c1e','#2c2c2e','#3a3a3c','#48484a'],
    fotoLabels: ['Medianoche','Gris Espacial','Plata','Luz Estelar'],
    specs: { Chip:'Apple M3', RAM:'8 GB', Almacenamiento:'256 GB SSD', Pantalla:'13.6″ Liquid Retina', Batería:'Hasta 18h', Puertos:'2x USB-C, MagSafe', Peso:'1.24 kg', Teclado:'Touch ID' },
    desc: 'El portátil más popular de Apple. Chip M3 con potencia silenciosa y hasta 18 horas de batería.',
    prices: { apple:1299, mediamarkt:1279, pccomp:1259, amazon:1249, elcorte:1299, fnac:1289, worten:1275, istore:1299 },
    reviews: [
      { fuente:'Applesfera', nota:9.5, texto:'El portátil perfecto para la mayoría. Potente, silencioso y con batería para todo el día.', fecha:'Mar 2024' },
      { fuente:'Xataka',     nota:9.1, texto:'El M3 supera al M2 en multitarea. La pantalla Liquid Retina sigue siendo excelente.', fecha:'Mar 2024' },
    ],
    history: [{m:'Ene',p:1399},{m:'Feb',p:1360},{m:'Mar',p:1320},{m:'Abr',p:1299},{m:'May',p:1275},{m:'Jun',p:1249}],
  },
  {
    slug: 'ipad-pro-11-m4',
    nombre: 'iPad Pro 11″ M4', cat: 'ipad', emoji: '⬛', rating: 4.9, tag: 'Pro',
    fotos: ['#1a1a1a','#2d2d2d','#404040','#555555'],
    fotoLabels: ['Negro Espacial','Plata','Gris','Titanio'],
    specs: { Chip:'Apple M4', Pantalla:'11″ Ultra Retina XDR OLED', Batería:'Hasta 10h', Almacenamiento:'256 GB', Conectividad:'Wi-Fi 6E + 5G', Peso:'444 g' },
    desc: 'El iPad más delgado jamás creado. Con chip M4 y pantalla OLED Ultra Retina XDR.',
    prices: { apple:1099, mediamarkt:1089, pccomp:1069, amazon:1059, elcorte:1099, fnac:1079, worten:1089, istore:1099 },
    reviews: [
      { fuente:'Applesfera', nota:9.4, texto:'Pantalla OLED increíble. Si necesitas el iPad más potente, este es sin duda.', fecha:'May 2024' },
    ],
    history: [{m:'Ene',p:1149},{m:'Feb',p:1129},{m:'Mar',p:1099},{m:'Abr',p:1099},{m:'May',p:1079},{m:'Jun',p:1059}],
  },
  {
    slug: 'apple-watch-series-10',
    nombre: 'Apple Watch Series 10', cat: 'watch', emoji: '⌚', rating: 4.7, tag: 'Novedad',
    fotos: ['#1c1c1e','#2c1a1a','#1a2c1a','#1a1a2c'],
    fotoLabels: ['Aluminio Negro','Rojo','Verde','Azul'],
    specs: { Pantalla:'46mm Always-On OLED', Sensor:'ECG, SpO2', GPS:'Sí', Resistencia:'50m', Batería:'Hasta 18h' },
    desc: 'El Apple Watch más avanzado con pantalla un 30% más grande y detección de apnea del sueño.',
    prices: { apple:449, mediamarkt:439, pccomp:429, amazon:419, elcorte:449, fnac:435, worten:439, istore:449 },
    reviews: [
      { fuente:'Xataka', nota:8.5, texto:'Pantalla más grande y brillante. El mejor smartwatch del mercado.', fecha:'Sep 2024' },
    ],
    history: [{m:'Ene',p:499},{m:'Feb',p:489},{m:'Mar',p:469},{m:'Abr',p:449},{m:'May',p:439},{m:'Jun',p:419}],
  },
  {
    slug: 'airpods-pro-2',
    nombre: 'AirPods Pro 2', cat: 'airpods', emoji: '🎧', rating: 4.8, tag: 'Más vendido',
    fotos: ['#e8e8e8','#d0d0d0','#b8b8b8','#a0a0a0'],
    fotoLabels: ['Blanco Estelar','Blanco','Plata','Estuche USB-C'],
    specs: { ANC:'Cancelación activa H2', Chip:'H2', Batería:'6h + 24h estuche', Resistencia:'IPX4', Audio:'Dolby Atmos' },
    desc: 'Los mejores auriculares inalámbricos de Apple con cancelación de ruido de siguiente nivel.',
    prices: { apple:279, mediamarkt:269, pccomp:259, amazon:249, elcorte:279, fnac:265, worten:269, istore:279 },
    reviews: [
      { fuente:'Xataka',     nota:9.3, texto:'Los mejores ANC del mercado. El audio espacial personalizado es impresionante.', fecha:'Ago 2023' },
      { fuente:'Applesfera', nota:9.1, texto:'Si tienes iPhone, son los auriculares a comprar. Sin discusión.', fecha:'Sep 2023' },
    ],
    history: [{m:'Ene',p:299},{m:'Feb',p:289},{m:'Mar',p:279},{m:'Abr',p:269},{m:'May',p:259},{m:'Jun',p:249}],
  },
  {
    slug: 'iphone-15-128gb',
    nombre: 'iPhone 15 128 GB', cat: 'iphone', emoji: '📱', rating: 4.7, tag: 'Oferta',
    fotos: ['#2d4a22','#1a3a5c','#5c1a3a','#4a3a1a'],
    fotoLabels: ['Verde','Azul','Rosa','Amarillo'],
    specs: { Pantalla:'6.1″ Super Retina XDR', Chip:'A16 Bionic', Cámara:'48MP + 12MP', Batería:'Hasta 20h', USB:'USB-C', Peso:'171 g' },
    desc: 'iPhone 15 con chip A16 Bionic y primer iPhone con USB-C.',
    prices: { apple:879, mediamarkt:849, pccomp:839, amazon:829, elcorte:879, fnac:859, worten:849, istore:879 },
    reviews: [
      { fuente:'Xataka', nota:8.7, texto:'La transición a USB-C es bienvenida. El A16 sigue siendo muy potente en 2024.', fecha:'Sep 2023' },
    ],
    history: [{m:'Ene',p:979},{m:'Feb',p:949},{m:'Mar',p:929},{m:'Abr',p:899},{m:'May',p:869},{m:'Jun',p:829}],
  },
];

async function main() {
  console.log('🌱 Seeding Manzana.es database...');

  // Upsert stores
  for (const store of STORES) {
    await prisma.store.upsert({ where: { id: store.id }, update: store, create: store });
  }
  console.log(`✓ ${STORES.length} stores seeded`);

  // Upsert products + prices + reviews + history
  for (const p of PRODUCTS) {
    const { prices, reviews, history, ...productData } = p;
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: { ...productData, specs: JSON.stringify(productData.specs), fotos: JSON.stringify(productData.fotos), fotoLabels: JSON.stringify(productData.fotoLabels) },
      create: { ...productData, specs: JSON.stringify(productData.specs), fotos: JSON.stringify(productData.fotos), fotoLabels: JSON.stringify(productData.fotoLabels) },
    });

    // Prices
    for (const [storeId, price] of Object.entries(prices)) {
      await prisma.price.upsert({
        where: { productId_storeId: { productId: product.id, storeId } },
        update: { price },
        create: { productId: product.id, storeId, price },
      });
    }

    // Reviews
    await prisma.review.deleteMany({ where: { productId: product.id } });
    await prisma.review.createMany({ data: reviews.map(r => ({ ...r, productId: product.id })) });

    // Price history
    await prisma.priceHistory.deleteMany({ where: { productId: product.id } });
    const year = new Date().getFullYear();
    await prisma.priceHistory.createMany({
      data: history.map(h => ({ productId: product.id, storeId: 'amazon', price: h.p, month: h.m, year })),
    });
  }
  console.log(`✓ ${PRODUCTS.length} products seeded`);

  // Sample listings
  const firstProduct = await prisma.product.findFirst({ where: { slug: 'iphone-16-pro-256gb' } });
  if (firstProduct) {
    const count = await prisma.listing.count();
    if (count === 0) {
      await prisma.listing.createMany({
        data: [
          { productId: firstProduct.id, precio: 820, estado: 'Excelente', ciudad: 'Madrid',    vendedor: 'Carlos M.', descripcion: 'Comprado hace 6 meses, sin rayones. Con caja original.', fotos: '[]' },
          { productId: firstProduct.id, precio: 760, estado: 'Muy bueno', ciudad: 'Barcelona', vendedor: 'Ana G.',    descripcion: 'Pequeño arañazo en el lateral. Batería 91%.', fotos: '[]' },
        ],
      });
      console.log('✓ Sample listings seeded');
    }
  }

  console.log('✅ Seed complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
