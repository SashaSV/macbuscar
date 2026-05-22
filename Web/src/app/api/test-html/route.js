export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url') || 'https://www.pccomponentes.com/buscar/?query=iPhone+16+Pro';
  
  const apiKey = process.env.SCRAPER_API_KEY;
  const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&country_code=es&render=true`;
  
  const res = await fetch(scraperUrl);
  const html = await res.text();
  
  // Шукаємо ціну в HTML простим regex
  const priceMatches = [...html.matchAll(/(\d{3,4})[\s,.]?(\d{0,2})\s*€/g)].slice(0, 10);
  const linkMatches = [...html.matchAll(/href="([^"]*iphone[^"]*)"/gi)].slice(0, 5);
  
  return Response.json({
    htmlLength: html.length,
    title: html.match(/<title>([^<]+)/)?.[1] || 'No title',
    prices: priceMatches.map(m => m[0]),
    links: linkMatches.map(m => m[1]),
    htmlPreview: html.slice(0, 500),
  });
}