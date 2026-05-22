'use client';
import { useState, useEffect } from 'react';
import HomePage from './panels/HomePage';
import PanelIA from './panels/PanelIA';
import PanelScraping from './panels/PanelScraping';
import TarjetaProducto from './ui/TarjetaProducto';
import ModalProducto from './modals/ModalProducto';
import ModalAnuncio from './modals/ModalAnuncio';
import { TIENDAS, CATS } from './shared/constants';
import { getPrecioMap, safeParse, getPriceValue } from './shared/utils';

export default function ManzanaApp() {
  const [page, setPage] = useState('home');
  const [cat, setCat] = useState('all');
  const [busq, setBusq] = useState('');
  const [orden, setOrden] = useState('default');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [precios, setPrecios] = useState({});
  const [scrapeStatus, setScrapeStatus] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selProd, setSelProd] = useState(null);
  const [modalAnuncio, setModalAnuncio] = useState(null);

  const isScraping = Object.values(scrapeStatus).some(s=>Object.values(s).some(v=>v==='loading'));

  // Load products from API
  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => {
        const normalized = (Array.isArray(data) ? data : []).map(p => ({
          ...p,
          fotos: safeParse(p.fotos, []),
          fotoLabels: safeParse(p.fotoLabels, []),
          specs: safeParse(p.specs, {}),
          listings: (p.listings || []).map(l => ({ ...l, fotos: safeParse(l.fotos, []) })),
        }));
        setProducts(normalized);
        const initPrecios = {};
        normalized.forEach(p => { initPrecios[p.id] = getPrecioMap(p); });
        setPrecios(initPrecios);
      })
      .catch(console.error)
      .finally(() => setLoadingProducts(false));
  }, []);

  async function triggerScrape(prod) {
    const storeIds = Object.keys(getPrecioMap(prod));
    setScrapeStatus(p => ({ ...p, [prod.id]: Object.fromEntries(storeIds.map(id=>[id,'loading'])) }));

    try {
      const res = await fetch('/api/prices/scrape', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ productId: prod.id }) });
      const data = await res.json();

      if (data.results?.[0]) {
        const newPrices = {};
        Object.entries(data.results[0].stores || {}).forEach(([storeId, { price, url }]) => {
          if (price) newPrices[storeId] = { price, url };
        });
        setPrecios(p => ({ ...p, [prod.id]: { ...p[prod.id], ...newPrices } }));
      }

      setScrapeStatus(p => ({ ...p, [prod.id]: Object.fromEntries(storeIds.map(id=>[id,'done'])) }));
    } catch {
      setScrapeStatus(p => ({ ...p, [prod.id]: Object.fromEntries(storeIds.map(id=>[id,'error'])) }));
    }
  }

  async function scrapeAll() {
    await Promise.all(products.map(p => triggerScrape(p)));
    const n = new Date();
    setLastUpdated(`${n.getHours().toString().padStart(2,'0')}:${n.getMinutes().toString().padStart(2,'0')}`);
  }

  function handleNewListing(listing) {
    setProducts(ps => ps.map(p =>
      p.id === listing.productId
        ? { ...p, listings: [listing, ...(p.listings||[])] }
        : p
    ));
    setModalAnuncio(null);
    const prod = products.find(p => p.id === listing.productId);
    if (prod) setSelProd({ ...prod, listings: [listing, ...(prod.listings||[])] });
  }

  const filtrados = products.filter(p =>
    (cat==='all' || p.cat===cat) && p.nombre.toLowerCase().includes(busq.toLowerCase())
  ).sort((a,b) => {
    const aVals = Object.values(precios[a.id]||{}).map(getPriceValue).filter(Boolean);
    const bVals = Object.values(precios[b.id]||{}).map(getPriceValue).filter(Boolean);
    const aMin = aVals.length ? Math.min(...aVals) : Infinity;
    const bMin = bVals.length ? Math.min(...bVals) : Infinity;
    if (orden==='precio-asc') return aMin-bMin;
    if (orden==='precio-desc') return bMin-aMin;
    if (orden==='valoracion') return b.rating-a.rating;
    return 0;
  });

  if (loadingProducts) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:18, background:'#090909' }}>
      <div style={{ fontSize:64, animation:'appleBounce 1.2s ease-in-out infinite', display:'inline-block' }}>🍎</div>
      <div style={{ fontSize:14, fontWeight:800, color:'#888' }}>Manzana.es</div>
      <div style={{ width:140, height:2, background:'#1a1a1a', borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:'40%', height:'100%', background:'linear-gradient(90deg,#2563eb,#60a5fa)', animation:'loadingBar 1.5s ease-in-out infinite' }} />
      </div>
      <style>{`
        @keyframes appleBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-14px) scale(1.05); }
        }
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#090909', color:'#f0f0f0', fontFamily:"-apple-system,'Helvetica Neue',sans-serif" }}>
      <nav style={{ background:'rgba(9,9,9,.95)', borderBottom:'1px solid #1a1a1a', padding:'14px 24px', position:'sticky', top:0, zIndex:100, backdropFilter:'blur(20px)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer' }} onClick={()=>setPage('home')}>
              <span style={{ fontSize:22 }}>🍎</span>
              <div>
                <div style={{ fontSize:17, fontWeight:900, letterSpacing:-.5 }}>Manzana.es</div>
                <div style={{ fontSize:9, color:'#444', letterSpacing:1.5 }}>COMPARADOR · {TIENDAS.length} TIENDAS</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:3 }}>
              {['home','catalogo'].map(p => (
                <button key={p} onClick={()=>setPage(p)} style={{ background:page===p?'#f0f0f0':'none', color:page===p?'#000':'#555', border:'none', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .2s', textTransform:'capitalize' }}>
                  {p==='home'?'Inicio':'Catálogo'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={()=>setModalAnuncio(true)} style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(90deg,#f5a623,#e09010)', border:'none', borderRadius:9, padding:'8px 14px', color:'#000', fontSize:12, fontWeight:800, cursor:'pointer' }}>
            + Vender 2ª mano
          </button>
        </div>
      </nav>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'22px 24px' }}>
        <PanelIA />

        {page==='home' ? (
          <HomePage products={products} precios={precios} scrapeStatus={scrapeStatus} onSelect={setSelProd} onCategoryClick={(c)=>{setCat(c);setPage('catalogo');}} />
        ) : (
          <>
            <div style={{ display:'flex', gap:9, marginBottom:13, flexWrap:'wrap' }}>
              <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="🔍  Buscar modelo…" style={{ flex:'1 1 200px', background:'#111', border:'1px solid #1e1e1e', borderRadius:10, padding:'9px 14px', color:'#f0f0f0', fontSize:13, outline:'none', fontFamily:'inherit' }} />
              <select value={orden} onChange={e=>setOrden(e.target.value)} style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:10, padding:'9px 14px', color:'#666', fontSize:13, outline:'none' }}>
                <option value="default">Orden por defecto</option>
                <option value="precio-asc">Precio ↑</option>
                <option value="precio-desc">Precio ↓</option>
                <option value="valoracion">Valoración</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
              {CATS.map(c=>(
                <button key={c.id} onClick={()=>setCat(c.id)} style={{ display:'flex', alignItems:'center', gap:5, background:cat===c.id?'#f0f0f0':'#111', color:cat===c.id?'#000':'#555', border:`1px solid ${cat===c.id?'transparent':'#1e1e1e'}`, borderRadius:20, padding:'6px 13px', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .2s' }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize:11, color:'#2a2a2a', marginBottom:12 }}>{filtrados.length} productos</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:13 }}>
              {filtrados.map(p=><TarjetaProducto key={p.id} prod={p} precios={precios} scrapeStatus={scrapeStatus} onClick={()=>setSelProd(p)} />)}
            </div>
          </>
        )}
      </div>

      {selProd && (
        <ModalProducto
          prod={selProd}
          precios={precios}
          scrapeStatus={scrapeStatus}
          onCerrar={()=>setSelProd(null)}
          onAnuncio={()=>{ setSelProd(null); setModalAnuncio(selProd.id); }}
          onScrapeOne={triggerScrape}
        />
      )}

      {modalAnuncio !== null && (
        <ModalAnuncio
          productoId={modalAnuncio !== true ? modalAnuncio : ''}
          productos={products}
          onGuardar={handleNewListing}
          onCerrar={()=>setModalAnuncio(null)}
        />
      )}
    </div>
  );
}
