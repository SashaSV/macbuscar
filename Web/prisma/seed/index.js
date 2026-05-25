// prisma/seed/index.js
// Main entry point for seeding the database
// Usage: node prisma/seed/index.js
// Or via Prisma: npx prisma db seed (needs package.json setup)

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STORES = require('./stores');
const IPHONES = require('./iphones');
const MACS = require('./macs');
const IPADS = require('./ipads');
const WATCHES = require('./watches');
const AIRPODS = require('./airpods');
const ACCESSORIES = require('./accessories');

const ALL_PRODUCTS = [
  ...IPHONES,
  ...MACS,
  ...IPADS,
  ...WATCHES,
  ...AIRPODS,
  ...ACCESSORIES,
];

async function seedStores() {
  console.log(`\n🏬 Seeding ${STORES.length} stores...`);
  for (const s of STORES) {
    await prisma.store.upsert({
      where: { id: s.id },
      update: {
        nombre: s.nombre,
        logo: s.logo,
        url: s.url,
        badge: s.badge,
        country: s.country,
        language: s.language,
        currency: s.currency,
        shippingToES: s.shippingToES,
        shippingDays: s.shippingDays,
        freeShippingFrom: s.freeShippingFrom,
        affiliateProvider: s.affiliateProvider,
        affiliateId: s.affiliateId,
        affiliateTemplate: s.affiliateTemplate,
        commissionPct: s.commissionPct,
        delay: s.delay,
        enabled: s.enabled,
        scraperType: s.scraperType,
      },
      create: s,
    });
    console.log(`  ✓ ${s.id} (${s.nombre})`);
  }
}

async function seedProducts() {
  console.log(`\n📦 Seeding ${ALL_PRODUCTS.length} products...`);
  let totalVariants = 0;

  for (const p of ALL_PRODUCTS) {
    const { variants, ...productData } = p;

    // Upsert Product by slug
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: productData,
      create: productData,
    });

    // Delete existing variants for this product (clean re-seed)
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });

    // Create variants
    for (const v of variants) {
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          nombre: v.nombre,
          sku: v.sku || null,
          ean: v.ean || null,
          memory: v.memory || null,
          color: v.color || null,
          colorHex: v.colorHex || null,
          display: v.display || null,
          cpu: v.cpu || null,
          gpu: v.gpu || null,
          connectivity: v.connectivity || null,
          bandSize: v.bandSize || null,
          msrp: v.msrp || null,
          matchKeys: v.matchKeys || '[]',
        },
      });
    }
    totalVariants += variants.length;
    console.log(`  ✓ ${p.nombre} (${variants.length} variants, basePrice=${p.basePrice}€)`);
  }
  console.log(`\n  Total: ${ALL_PRODUCTS.length} products, ${totalVariants} variants`);
}

async function main() {
  console.log('🌱 Starting macbuscar seed...');
  
  await seedStores();
  await seedProducts();
  
  // Summary
  const counts = {
    stores: await prisma.store.count(),
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    prices: await prisma.price.count(),
  };
  
  console.log('\n📊 Final DB status:');
  console.log(`  Stores:   ${counts.stores}`);
  console.log(`  Products: ${counts.products}`);
  console.log(`  Variants: ${counts.variants}`);
  console.log(`  Prices:   ${counts.prices}`);
  console.log('\n✅ Seed complete!');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
