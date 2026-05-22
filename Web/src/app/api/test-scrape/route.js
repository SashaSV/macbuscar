export const dynamic = 'force-dynamic';
import { scrapePrice } from '@/lib/scraper';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const store = searchParams.get('store') || 'amazon';
  const product = searchParams.get('product') || 'iPhone 16 Pro';
  
  const result = await scrapePrice(store, product);
  return Response.json(result);
}