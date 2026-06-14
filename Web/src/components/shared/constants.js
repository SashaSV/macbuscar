export const TIENDAS = [
  { id:'apple',      nombre:'Apple Store',    logo:'🍎', url:'https://www.apple.com/es/shop/', badge:'OFICIAL' },
  { id:'mediamarkt', nombre:'MediaMarkt',      logo:'📺', url:'https://www.mediamarkt.es/',    badge:'TOP'     },
  { id:'pccomp',     nombre:'PcComponentes',   logo:'💻', url:'https://www.pccomponentes.com/',badge:'TECH'    },
  { id:'fnac',       nombre:'Fnac',            logo:'📦', url:'https://www.fnac.es/',           badge:''        },
  { id:'elcorte',    nombre:'El Corte Inglés', logo:'🏬', url:'https://www.elcorteingles.es/', badge:''        },
  { id:'amazon',     nombre:'Amazon.es',       logo:'🛒', url:'https://www.amazon.es/',         badge:'OFERTA'  },
  { id:'worten',     nombre:'Worten',          logo:'🔌', url:'https://www.worten.es/',         badge:''        },
  { id:'istore',     nombre:'iStore',          logo:'🍏', url:'https://www.istore.es/',         badge:'PREMIUM' },
];

export const CATS = [
  { id:'all',        label:'Todo',        icon:'◈' },
  { id:'iphone',     label:'iPhone',      icon:'📱' },
  { id:'mac',        label:'Mac',         icon:'💻' },
  { id:'ipad',       label:'iPad',        icon:'⬛' },
  { id:'watch',      label:'Apple Watch', icon:'⌚' },
  { id:'airpods',    label:'AirPods',     icon:'🎧' },
  { id:'accesorios', label:'Accesorios',  icon:'🔌' },
];

export const ESTADOS = ['Excelente','Muy bueno','Bueno','Aceptable'];
export const TAG_COLORS = { Novedad:'#34aadc','Más vendido':'#ff6a00',Pro:'#bf5af2',Ultra:'#f5a623',Exclusivo:'#34c759',Oferta:'#ff4444' };

// Tag badges: brand colour + emoji per tag. Drives the small pill stack
// on product cards (TarjetaProducto). 'A plazos' is a virtual tag derived
// at render time from the product's financing availability — not stored
// in the DB — so the UI auto-shows it whenever any store offers
// installments for the product. Adding a new tag here is enough; cards
// pick it up automatically as long as Product.tag matches the key.
export const TAG_BADGES = {
  'Novedad':     { color: '#34aadc', emoji: '✨' },
  'Más vendido': { color: '#ff6a00', emoji: '🔥' },
  'Pro':         { color: '#bf5af2', emoji: '💎' },
  'Ultra':       { color: '#f5a623', emoji: '⚡' },
  'Exclusivo':   { color: '#34c759', emoji: '⭐' },
  'Oferta':      { color: '#ff4444', emoji: '🏷️' },
  // Virtual tag — outline style (transparent fill + brand-blue text and
  // border) so it reads as a secondary informational chip rather than a
  // promotional badge. Sits beneath the solid editorial tag in the stack.
  'A plazos':    { color: '#0a84ff', emoji: '💳', outline: true },
};

export const TABS = ['Galería','Características','Precios','Reseñas','Historial','2ª mano'];
