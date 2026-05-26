'use client';
import { useState, useEffect } from 'react';
import HomePage from './panels/HomePage';
import FooterLegal from './panels/FooterLegal';
import TarjetaProducto from './ui/TarjetaProducto';
import ModalProducto from './modals/ModalProducto';
import ModalAnuncio from './modals/ModalAnuncio';
import { TIENDAS, CATS } from './shared/constants';
import { CATEGORY_ICON } from './shared/categoryIcons';
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
  const [selProd, setSelProd] = useState(null);
  const [modalAnuncio, setModalAnuncio] = useState(null);

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
    setScrapeStatus(p => ({ ...p, [prod.id]: Object.fromEntries(storeIds.map(id => [id, 'loading'])) }));
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
      setScrapeStatus(p => ({ ...p, [prod.id]: Object.fromEntries(storeIds.map(id => [id, 'done'])) }));
    } catch {
      setScrapeStatus(p => ({ ...p, [prod.id]: Object.fromEntries(storeIds.map(id => [id, 'error'])) }));
    }
  }

  function handleNewListing(listing) {
    setProducts(ps => ps.map(p =>
      p.id === listing.productId
        ? { ...p, listings: [listing, ...(p.listings || [])] }
        : p
    ));
    setModalAnuncio(null);
    const prod = products.find(p => p.id === listing.productId);
    if (prod) setSelProd({ ...prod, listings: [listing, ...(prod.listings || [])] });
  }

  const filtrados = products.filter(p =>
    (cat === 'all' || p.cat === cat) && p.nombre.toLowerCase().includes(busq.toLowerCase())
  ).sort((a, b) => {
    const aVals = Object.values(precios[a.id] || {}).map(getPriceValue).filter(Boolean);
    const bVals = Object.values(precios[b.id] || {}).map(getPriceValue).filter(Boolean);
    const aMin = aVals.length ? Math.min(...aVals) : Infinity;
    const bMin = bVals.length ? Math.min(...bVals) : Infinity;
    if (orden === 'precio-asc') return aMin - bMin;
    if (orden === 'precio-desc') return bMin - aMin;
    if (orden === 'valoracion') return b.rating - a.rating;
    return 0;
  });

  if (loadingProducts) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:18 }}>
      <div style={{ fontSize:64, animation:'appleBounce 1.2s ease-in-out infinite', display:'inline-block' }}>🍎</div>
      <div style={{ fontSize:14, fontWeight:500, color:'rgba(29,29,31,0.6)' }}>Manzana.es</div>
      <div style={{ width:140, height:2, background:'rgba(0,0,0,0.1)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:'40%', height:'100%', background:'linear-gradient(90deg,#a855f7,#ec4899)', animation:'loadingBar 1.5s ease-in-out infinite' }} />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', position:'relative', overflow:'hidden' }}>
      {/* Background glow orbs */}
      <div aria-hidden="true" style={{ position:'fixed', width:500, height:500, background:'rgba(168,85,247,0.18)', top:-120, right:-120, borderRadius:'50%', filter:'blur(80px)', pointerEvents:'none', zIndex:0 }} />
      <div aria-hidden="true" style={{ position:'fixed', width:600, height:600, background:'rgba(34,211,238,0.15)', bottom:-200, left:-200, borderRadius:'50%', filter:'blur(100px)', pointerEvents:'none', zIndex:0 }} />
      <div aria-hidden="true" style={{ position:'fixed', width:400, height:400, background:'rgba(236,72,153,0.12)', top:'40%', left:'30%', borderRadius:'50%', filter:'blur(100px)', pointerEvents:'none', zIndex:0 }} />

      <div style={{ position:'relative', zIndex:1 }}>

        {/* ── Single max-width container for BOTH nav and content ── */}
        <div style={{ maxWidth:1600, margin:'0 auto', padding:'0 32px' }}>

          {/* Sticky nav */}
          <div style={{ position:'sticky', top:0, zIndex:50, paddingTop:14, paddingBottom:4 }}>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
              padding:'10px 18px',
              background:'rgba(255,255,255,0.55)',
              backdropFilter:'blur(30px) saturate(180%)',
              WebkitBackdropFilter:'blur(30px) saturate(180%)',
              border:'0.5px solid rgba(255,255,255,0.8)',
              borderRadius:980,
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 16px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }} onClick={() => setPage('home')}>
                  <span style={{ fontSize:22 }}>🍎</span>
                  <div>
                    <div style={{ fontSize:14, fontWeight:500, color:'#1d1d1f', letterSpacing:-0.2 }}>macbuscar</div>
                    <div style={{ fontSize:9, color:'rgba(29,29,31,0.4)', letterSpacing:1 }}>COMPARADOR · {TIENDAS.length} TIENDAS</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  {['home', 'catalogo'].map(p => (
                    <button key={p} onClick={() => setPage(p)} style={{
                      background: page === p ? 'rgba(29,29,31,0.85)' : 'transparent',
                      color: page === p ? '#fff' : 'rgba(29,29,31,0.7)',
                      border:'none', borderRadius:980, padding:'5px 14px',
                      fontSize:12, fontWeight:500, cursor:'pointer', transition:'all .2s',
                    }}>
                      {p === 'home' ? 'Inicio' : 'Catálogo'}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setModalAnuncio(true)} style={{
                display:'flex', alignItems:'center', gap:6,
                background:'rgba(245,158,11,0.18)', border:'0.5px solid rgba(245,158,11,0.4)',
                borderRadius:980, padding:'6px 14px', color:'#b45309', fontSize:12, fontWeight:500, cursor:'pointer',
              }}>
                <i className="ti ti-plus" aria-hidden="true" style={{ fontSize:14 }} /> Vender
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ paddingTop:18, paddingBottom:32 }}>
            {page === 'home' ? (
              <HomePage
                products={products}
                precios={precios}
                scrapeStatus={scrapeStatus}
                onSelect={setSelProd}
                onCategoryClick={(c) => { setCat(c); setPage('catalogo'); }}
              />
            ) : (
              <>
                <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                  <input
                    value={busq}
                    onChange={e => setBusq(e.target.value)}
                    placeholder="🔍  Buscar modelo…"
                    style={{
                      flex:'1 1 200px', background:'rgba(255,255,255,0.55)',
                      backdropFilter:'blur(20px) saturate(180%)',
                      border:'0.5px solid rgba(255,255,255,0.8)', borderRadius:980,
                      padding:'10px 18px', color:'#1d1d1f', fontSize:13, outline:'none', fontFamily:'inherit',
                    }}
                  />
                  <select value={orden} onChange={e => setOrden(e.target.value)} style={{
                    background:'rgba(255,255,255,0.55)', backdropFilter:'blur(20px) saturate(180%)',
                    border:'0.5px solid rgba(255,255,255,0.8)', borderRadius:980,
                    padding:'10px 18px', color:'#1d1d1f', fontSize:13, outline:'none', cursor:'pointer',
                  }}>
                    <option value="default">Orden por defecto</option>
                    <option value="precio-asc">Precio ↑</option>
                    <option value="precio-desc">Precio ↓</option>
                    <option value="valoracion">Valoración</option>
                  </select>
                </div>

                <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
                  {CATS.map(c => {
                    const iconClass = CATEGORY_ICON[c.id] || 'ti-apps';
                    const active = cat === c.id;
                    return (
                      <button key={c.id} onClick={() => setCat(c.id)} style={{
                        display:'flex', alignItems:'center', gap:6,
                        background: active ? 'rgba(29,29,31,0.85)' : 'rgba(255,255,255,0.55)',
                        backdropFilter:'blur(20px) saturate(180%)',
                        color: active ? '#fff' : '#1d1d1f',
                        border:`0.5px solid ${active ? 'rgba(29,29,31,0.3)' : 'rgba(255,255,255,0.8)'}`,
                        borderRadius:980, padding:'7px 14px', fontSize:12, fontWeight:500, cursor:'pointer', transition:'all .2s',
                      }}>
                        <i className={`ti ${iconClass}`} aria-hidden="true" style={{ fontSize:14 }} />
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize:11, color:'rgba(29,29,31,0.4)', marginBottom:12, fontWeight:500 }}>
                  {filtrados.length} productos
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:20 }}>
                  {filtrados.map(p => (
                    <TarjetaProducto key={p.id} prod={p} precios={precios} scrapeStatus={scrapeStatus} onClick={() => setSelProd(p)} />
                  ))}
                </div>
              </>
            )}
          </div>
      
        </div>

        {selProd && (
          <ModalProducto
            prod={selProd} precios={precios} scrapeStatus={scrapeStatus}
            onCerrar={() => setSelProd(null)}
            onAnuncio={() => { setSelProd(null); setModalAnuncio(selProd.id); }}
            onScrapeOne={triggerScrape}
          />
        )}

        {modalAnuncio !== null && (
          <ModalAnuncio
            productoId={modalAnuncio !== true ? modalAnuncio : ''}
            productos={products}
            onGuardar={handleNewListing}
            onCerrar={() => setModalAnuncio(null)}
          />
        )}
        <FooterLegal />  
      </div>
    
    </div>
  );
}