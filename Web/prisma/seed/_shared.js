// prisma/seed/_shared.js
// Shared helpers for all seed modules

// Common Apple color → hex map (universal across product lines)
const COLOR_HEX = {
  // Titanium (iPhone Pro)
  'Negro Titanio': '#2a2a2a',
  'Titanio Negro': '#2a2a2a',
  'Titanio Blanco': '#f4f4f1',
  'Titanio Natural': '#c9c0b0',
  'Titanio Desierto': '#bca582',
  'Titanio Azul': '#3a4a5e',
  
  // iPhone 17 Pro / Pro Max (aluminium unibody)
  'Naranja Cósmico': '#e87f3c',
  'Azul Intenso': '#1f3a5f',
  'Azul Oscuro': '#1f3a5f',
  'Plata': '#e8e8e8',
  
  // iPhone Air / 17
  'Negro Espacial': '#1d1d1f',
  'Cielo': '#a8c0e0',
  'Oro Claro': '#e8d4a8',
  'Blanco Nube': '#f5f5f0',
  
  // iPhone 17 (standard)
  'Lavanda': '#b9a7d4',
  'Verde Salvia': '#a8c0a0',
  'Niebla': '#b8c1c8',
  'Blanco': '#ffffff',
  'Negro': '#1d1d1f',
  
  // iPhone 16/16 Plus
  'Ultramar': '#5a6f9c',
  'Verde Azulado': '#5a8a8a',
  'Rosa': '#f5c9c0',
  
  // iPhone 17e (and SE/16e)
  'Blanco Estrella': '#f7f6f1',
  'Medianoche': '#1d1d1f',
  
  // Mac (silver/space gray etc)
  'Gris Espacial': '#5b5b5d',
  'Plateado': '#e8e8e8',
  'Oro': '#e8c5a0',
  'Medianoche Mac': '#1d2535',
  'Azul Mac': '#404870',
  'Verde': '#a8c4a0',
  'Púrpura': '#c8a8d8',
  
  // iPad
  'Amarillo': '#f5e35a',
  
  // Watch bands and cases
  'Negro Espacial Watch': '#1d1d1f',
  'Aluminio Plata': '#e8e8e8',
  'Aluminio Medianoche': '#1d2535',
  'Aluminio Oro': '#e8c5a0',
  'Aluminio Rosa': '#f5c9c0',
  'Aluminio Yema': '#f5e6b8',
  'Titanio Natural Watch': '#c9c0b0',
  'Titanio Oro Watch': '#c8a47c',
  'Titanio Negro Watch': '#2a2a2a',
};

// Slugify (URL-friendly)
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Generate matchKeys array (words that scraper will match against)
// Example: matchKeysFor("iPhone 17 Pro Max") → ["iphone", "17", "pro", "max"]
function matchKeysFor(text) {
  const stop = new Set(['de', 'la', 'el', 'gb', 'tb', 'mm', 'pulgadas', 'con', 'y']);
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[\s\-,\.]+/)
    .filter(w => w.length >= 2 && !stop.has(w));
}

// Get colorHex (returns '#cccccc' fallback if unknown)
function colorHex(colorName) {
  return COLOR_HEX[colorName] || '#cccccc';
}

// Calculate basePrice (min variant.msrp) for a Product
function basePriceFrom(variants) {
  const prices = variants.map(v => v.msrp).filter(p => p != null);
  return prices.length ? Math.min(...prices) : null;
}

// Build full variant matchKeys (includes product + memory + color)
function variantMatchKeys(productName, memory, color) {
  const parts = [productName, memory, color].filter(Boolean).join(' ');
  return matchKeysFor(parts);
}

module.exports = {
  slugify,
  matchKeysFor,
  colorHex,
  basePriceFrom,
  variantMatchKeys,
  COLOR_HEX,
};
