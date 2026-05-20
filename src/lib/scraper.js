/**
 * REAL SCRAPER
 * Uses ScraperAPI to fetch store pages, then Claude AI to extract prices.
 *
 * To activate:
 *   1. Add SCRAPER_API_KEY and ANTHROPIC_API_KEY to .env.local
 *   2. The scrapePrice() function is called by /api/prices/scrape
 */

const STORE_SEARCH_URLS = {
  apple:      (q) => `https://www.apple.com/es/shop/go/product/${encodeURIComponent(q)}`,
  mediamarkt: (q) => `https://www.mediamarkt.es/es/search.html?query=${encodeURIComponent(q)}`,
  pccomp:     (q) => `https://www.pccomponentes.com/buscar/?query=${encodeURIComponent(q)}`,
  fnac:       (q) => `https://www.fnac.es/SearchResult/ResultList.aspx?Search=${encodeURIComponent(q)}`,
  elcorte:    (q) => `https://www.elcorteingles.es/electronica/buscar/?s=${encodeURIComponent(q)}`,
  amazon:     (q) => `https://www.amazon.es/s?k=${encodeURIComponent(q)}&i=electronics`,
  worten:     (q) => `https://www.worten.es/search?query=${encodeURIComponent(q)}`,
  istore:     (q) => `https://www.istore.es/buscar?type=product&q=${encodeURIComponent(q)}`,
};

async function fetchWithScraper(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error('SCRAPER_API_KEY not set');

  const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&country_code=es&render=true`;
  const res = await fetch(scraperUrl, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`ScraperAPI error: ${res.status}`);
  return res.text();
}

async function extractPriceWithAI(html, storeId, productName) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      system: 'Extract ONLY the lowest numeric price in euros from this HTML. Respond with JUST the number (e.g. 1199 or 1199.99). If the product is not found or no price exists, respond with null.',
      messages: [{
        role: 'user',
        content: `Store: ${storeId}\nProduct: ${productName}\n\nHTML (first 4000 chars):\n${html.slice(0, 4000)}`,
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text?.trim();
  if (!text || text === 'null') return null;
  const price = parseFloat(text.replace(',', '.'));
  return isNaN(price) ? null : price;
}

/**
 * Scrape a single store for a product price.
 * Returns { price, duration, status }
 */
export async function scrapePrice(storeId, productName) {
  const start = Date.now();
  const buildUrl = STORE_SEARCH_URLS[storeId];
  if (!buildUrl) return { price: null, status: 'unknown_store', duration: 0 };

  // Mock mode when no API key
  if (!process.env.SCRAPER_API_KEY) {
    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
    if (Math.random() < 0.07) return { price: null, status: 'error', duration: Date.now() - start, error: 'timeout (mock)' };
    return { price: null, status: 'mock_no_key', duration: Date.now() - start };
  }

  try {
    const url = buildUrl(productName);
    const html = await fetchWithScraper(url);
    const price = await extractPriceWithAI(html, storeId, productName);
    return { price, status: price ? 'success' : 'not_found', duration: Date.now() - start };
  } catch (err) {
    return { price: null, status: 'error', error: err.message, duration: Date.now() - start };
  }
}
