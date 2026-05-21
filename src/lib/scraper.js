/**
 * REAL SCRAPER
 * Uses ScraperAPI + Claude to extract price AND product URL.
 */

const STORE_SEARCH_URLS = {
  apple:      (q) => `https://www.apple.com/es/shop/buscar/${encodeURIComponent(q)}`,
  mediamarkt: (q) => `https://www.mediamarkt.es/es/search.html?query=${encodeURIComponent(q)}`,
  pccomp:     (q) => `https://www.pccomponentes.com/buscar/?query=${encodeURIComponent(q)}`,
  fnac:       (q) => `https://www.fnac.es/SearchResult/ResultList.aspx?Search=${encodeURIComponent(q)}`,
  elcorte:    (q) => `https://www.elcorteingles.es/electronica/buscar/?s=${encodeURIComponent(q)}`,
  amazon:     (q) => `https://www.amazon.es/s?k=${encodeURIComponent(q)}&i=electronics`,
  worten:     (q) => `https://www.worten.es/search?query=${encodeURIComponent(q)}`,
  istore:     (q) => `https://www.istore.es/buscar?type=product&q=${encodeURIComponent(q)}`,
};

const STORE_DOMAINS = {
  apple:      'apple.com',
  mediamarkt: 'mediamarkt.es',
  pccomp:     'pccomponentes.com',
  fnac:       'fnac.es',
  elcorte:    'elcorteingles.es',
  amazon:     'amazon.es',
  worten:     'worten.es',
  istore:     'istore.es',
};

async function fetchWithScraper(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error('SCRAPER_API_KEY not set');
  const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&country_code=es&render=true`;
  const res = await fetch(scraperUrl, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`ScraperAPI ${res.status}`);
  return res.text();
}

function normalizeUrl(rawUrl, storeId) {
  if (!rawUrl) return null;
  try {
    if (rawUrl.startsWith('/')) {
      return `https://www.${STORE_DOMAINS[storeId]}${rawUrl}`;
    }
    new URL(rawUrl);
    return rawUrl;
  } catch { return null; }
}

async function extractDataWithAI(html, storeId, productName) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `You analyze e-commerce search results. Find the BEST MATCH for the requested product on ${storeId} (${STORE_DOMAINS[storeId]}).
Return ONLY valid JSON in this exact format:
{"price": <number or null>, "url": "<full product URL or relative path or null>"}
The price must be in EUR (lowest visible price for the matching product). The URL must point to the product page (NOT search results). If product not found, return {"price": null, "url": null}. NO markdown, NO explanation, JUST JSON.`,
      messages: [{
        role: 'user',
        content: `Find: "${productName}"\n\nHTML (first 6000 chars):\n${html.slice(0, 6000)}`,
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() || '';
  console.log(`[${storeId}] AI raw response:`, text);
  try {
    const clean = text.replace(/^```json\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(clean);
    console.log(`[${storeId}] Parsed:`, parsed);  // ← і цей
    return {
      price: typeof parsed.price === 'number' ? parsed.price : null,
      url: normalizeUrl(parsed.url, storeId),
    };
  } catch (err) {
    console.error(`[${storeId}] Parse error:`, err.message, 'text:', text.slice(0, 200));
    return { price: null, url: null };
  }
}

export async function scrapePrice(storeId, productName) {
  const start = Date.now();
  const buildUrl = STORE_SEARCH_URLS[storeId];
  if (!buildUrl) return { price: null, url: null, status: 'unknown_store', duration: 0 };

  if (!process.env.SCRAPER_API_KEY) {
    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
    if (Math.random() < 0.07) return { price: null, url: null, status: 'error', duration: Date.now() - start, error: 'timeout (mock)' };
    return { price: null, url: null, status: 'mock_no_key', duration: Date.now() - start };
  }

  try {
    const searchUrl = buildUrl(productName);
    const html = await fetchWithScraper(searchUrl);
    const { price, url } = await extractDataWithAI(html, storeId, productName);
    return {
      price,
      url: url || searchUrl, // якщо AI не знайшов URL — даємо посилання на пошук
      status: price ? 'success' : 'not_found',
      duration: Date.now() - start
    };
  } catch (err) {
    return { price: null, url: null, status: 'error', error: err.message, duration: Date.now() - start };
  }
}