export function getMejor(prices) {
  const entries = Object.entries(prices || {}).filter(([,v]) => v != null);
  return entries.length ? entries.reduce((a,b) => a[1] < b[1] ? a : b) : [null, null];
}

export function colorEstado(e) {
  return { Excelente:'#34c759','Muy bueno':'#30d158',Bueno:'#f5a623',Aceptable:'#ff6b6b' }[e] || '#888';
}

export function fmtDate() {
  const d = new Date();
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}

export function getPrecioMap(product) {
  const map = {};
  (product.prices || []).forEach(p => { map[p.storeId] = p.price; });
  return map;
}

export const safeParse = (s, fallback) => {
  if (Array.isArray(s) || (typeof s === 'object' && s !== null)) return s;
  try { return JSON.parse(s); } catch { return fallback; }
};
