import { prisma } from '@/lib/prisma';
 
const SITE_URL = 'https://macbuscar.es';
 
export default async function sitemap() {
  const products = await prisma.product.findMany({
    select: { slug: true, updatedAt: true },
  });
 
  const productUrls = products.map(p => ({
    url: `${SITE_URL}/producto/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'daily',
    priority: 0.8,
  }));
 
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/?cat=iphone`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/?cat=mac`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/?cat=ipad`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/?cat=watch`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/?cat=airpods`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...productUrls,
  ];
}