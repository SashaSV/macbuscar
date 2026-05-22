export function getMejor(precios) {
  const v = Object.entries(precios || {}).filter(([, x]) => x != null);
  return v.length ? v.reduce((a, b) => (a[1] < b[1] ? a : b)) : [null, null];
}

export function colorEstado(e) {
  return { Excelente: '#34c759', 'Muy bueno': '#30d158', Bueno: '#f5a623', Aceptable: '#ff6b6b' }[e] || '#888';
}

export function starStr(r) {
  const f = Math.round(r);
  return '★'.repeat(f) + '☆'.repeat(5 - f);
}

export const TAG_COLORS = {
  Novedad: '#34aadc',
  'Más vendido': '#ff6a00',
  Pro: '#bf5af2',
  Ultra: '#f5a623',
  Exclusivo: '#34c759',
  Oferta: '#ff4444',
};

export const CSS_ANIMATIONS = `
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
`;
