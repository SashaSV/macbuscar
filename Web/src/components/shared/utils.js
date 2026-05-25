export function getMejor(prices) {
  const entries = Object.entries(prices || {})
    .filter(([, v]) => v && getPriceValue(v) != null);
  if (!entries.length) return [null, null];
  return entries.reduce((a, b) => {
    return getPriceValue(a[1]) < getPriceValue(b[1]) ? a : b;
  });
}

export function colorEstado(e) {
  return { Excelente:'#34c759','Muy bueno':'#30d158',Bueno:'#f5a623',Aceptable:'#ff6b6b' }[e] || '#888';
}

export function fmtDate() {
  const d = new Date();
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}

export function getPrecioMap(product) {
  // If API already provides precios map, use it directly
  if (product.precios && typeof product.precios === 'object' && !Array.isArray(product.precios)) {
    return product.precios;
  }
  // Otherwise build from prices array (legacy format)
  const map = {};
  const prices = product.prices;
  if (Array.isArray(prices)) {
    prices.forEach(p => {
      map[p.storeId] = { price: p.price, url: p.url || p.store?.url || null, updatedAt: p.updatedAt };
    });
  } else if (prices && typeof prices === 'object') {
    // Already an object map
    return prices;
  }
  return map;
}

// Extract number from either old format (number) or new format ({price, url})
export function getPriceValue(v) {
  if (v == null) return null;
  return typeof v === 'object' ? v.price : v;
}

// Extract URL from new format
export function getPriceUrl(v) {
  if (v == null || typeof v !== 'object') return null;
  return v.url || null;
}

export const safeParse = (s, fallback) => {
  if (Array.isArray(s) || (typeof s === 'object' && s !== null)) return s;
  try { return JSON.parse(s); } catch { return fallback; }
};