'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

/* ─── CONSTANTS ─── */
const TIENDAS = [
  { id:'apple',      nombre:'Apple Store',    logo:'🍎', url:'https://www.apple.com/es/shop/', badge:'OFICIAL' },
  { id:'mediamarkt', nombre:'MediaMarkt',      logo:'📺', url:'https://www.mediamarkt.es/',    badge:'TOP'     },
  { id:'pccomp',     nombre:'PcComponentes',   logo:'💻', url:'https://www.pccomponentes.com/',badge:'TECH'    },
  { id:'fnac',       nombre:'Fnac',            logo:'📦', url:'https://www.fnac.es/',           badge:''        },
  { id:'elcorte',    nombre:'El Corte Inglés', logo:'🏬', url:'https://www.elcorteingles.es/', badge:''        },
  { id:'amazon',     nombre:'Amazon.es',       logo:'🛒', url:'https://www.amazon.es/',         badge:'OFERTA'  },
  { id:'worten',     nombre:'Worten',          logo:'🔌', url:'https://www.worten.es/',         badge:''        },
  { id:'istore',     nombre:'iStore',          logo:'🍏', url:'https://www.istore.es/',         badge:'PREMIUM' },
];

const CATS = [
  { id:'all',        label:'Todo',        icon:'◈' },
  { id:'iphone',     label:'iPhone',      icon:'📱' },
  { id:'mac',        label:'Mac',         icon:'💻' },
  { id:'ipad',       label:'iPad',        icon:'⬛' },
  { id:'watch',      label:'Apple Watch', icon:'⌚' },
  { id:'airpods',    label:'AirPods',     icon:'🎧' },
  { id:'accesorios', label:'Accesorios',  icon:'🔌' },
];

const ESTADOS = ['Excelente','Muy bueno','Bueno','Aceptable'];
const TAG_COLORS = { Novedad:'#34aadc','Más vendido':'#ff6a00',Pro:'#bf5af2',Ultra:'#f5a623',Exclusivo:'#34c759',Oferta:'#ff4444' };

/* ─── HELPERS ─── */
function getMejor(prices) {
  const entries = Object.entries(prices || {}).filter(([,v]) => v != null);
  return entries.length ? entries.reduce((a,b) => a[1] < b[1] ? a : b) : [null, null];
}
function colorEstado(e) {
  return { Excelente:'#34c759','Muy bueno':'#30d158',Bueno:'#f5a623',Aceptable:'#ff6b6b' }[e] || '#888';
}
function fmtDate() {
  const d = new Date();
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}
// Convert DB product to flat price map
function getPrecioMap(product) {
  const map = {};
  (product.prices || []).forEach(p => { map[p.storeId] = p.price; });
  return map;
}

/* ─── SMALL COMPONENTS ─── */
function Dot({ status }) {
  const c = { loading:'#f5a623', done:'#34c759', error:'#ff6b6b' }[status];
  if (!c) return null;
  return <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:c, animation:status==='loading'?'pulse 1s infinite':'none', flexShrink:0 }} />;
}

function Galeria({ fotos, labels, emoji }) {
  const [idx, setIdx] = useState(0);
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ height:190, borderRadius:14, background:fotos[idx], transition:'background .4s', display:'flex', alignItems:'center', justifyContent:'center', fontSize:68, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,.05),transparent 60%)' }} />
        <span style={{ filter:'drop-shadow(0 6px 24px rgba(0,0,0,.6))' }}>{emoji}</span>
        <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
          {fotos.map((_,i) => <div key={i} onClick={e=>{e.stopPropagation();setIdx(i);}} style={{ width:i===idx?18:6, height:6, borderRadius:3, background:i===idx?'#fff':'rgba(255,255,255,.3)', transition:'all .3s', cursor:'pointer' }} />)}
        </div>
      </div>
      <div style={{ display:'flex', gap:7, marginTop:8 }}>
        {fotos.map((c,i) => <div key={i} onClick={e=>{e.stopPropagation();setIdx(i);}} style={{ flex:1, height:32, borderRadius:8, background:c, border:`2px solid ${i===idx?'#fff':'transparent'}`, cursor:'pointer', transition:'all .25s' }} />)}
      </div>
      {labels && <div style={{ textAlign:'center', fontSize:11, color:'#555', marginTop:4 }}>{labels[idx]}</div>}
    </div>
  );
}

function BarraPrecios({ precios, statuses }) {
  const v = Object.values(precios||{}).filter(Boolean);
  const maxP = v.length ? Math.max(...v) : 1;
  const [mejId] = getMejor(precios);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      {TIENDAS.filter(t => precios[t.id] != null || statuses?.[t.id]==='loading').map(t => {
        const p = precios[t.id]; const st = statuses?.[t.id];
        const pct = p ? Math.round((p/maxP)*100) : 0;
        const es = t.id === mejId;
        return (
          <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Dot status={st} />
            <span style={{ width:90, fontSize:11, color:'#555', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.nombre}</span>
            <div style={{ flex:1, background:'#1c1c1e', borderRadius:3, height:7 }}>
              <div style={{ width:`${pct}%`, height:'100%', background:es?'#34c759':'#2c2c2e', borderRadius:3, transition:'width .5s ease' }} />
            </div>
            <span style={{ width:58, fontSize:12, fontWeight:es?800:400, color:es?'#34c759':'#666', textAlign:'right', fontFamily:'ui-monospace,monospace' }}>
              {st==='loading'?'—':st==='error'?'Err':p?`${p}€`:'—'}{es?' ✓':''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HistorialChart({ historial }) {
  if (!historial?.length) return null;
  const prices = historial.map(h => h.price || h.p);
  const months = historial.map(h => h.month || h.m);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const W=100, H=52;
  const pts = prices.map((p,i) => ({ x:(i/(prices.length-1))*W, y:H-((p-min)/range)*H*.78-H*.1 }));
  const path = pts.map((p,i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ');
  const area = `${path} L${pts[pts.length-1].x},${H} L0,${H} Z`;
  const drop = prices[prices.length-1] - prices[0];
  const isDown = drop < 0;
  const color = isDown ? '#34c759' : '#ff6b6b';
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:8 }}>
        <div>
          <div style={{ fontSize:11, color:'#555' }}>Histórico 6 meses</div>
          <div style={{ fontSize:13, fontWeight:700, color, marginTop:2 }}>{isDown?'▼':'▲'} {Math.abs(drop)}€ desde {months[0]}</div>
        </div>
        <div style={{ fontSize:11, color:'#555', textAlign:'right' }}>
          <div>Mín: <span style={{ color:'#34c759', fontWeight:700 }}>{min}€</span></div>
          <div>Máx: <span style={{ color:'#ff6b6b', fontWeight:700 }}>{max}€</span></div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:78, overflow:'visible' }}>
        <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".28"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
        <path d={area} fill="url(#cg)" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p,i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill={color} />
            <text x={p.x} y={H+10} textAnchor="middle" fontSize="5" fill="#555">{months[i]}</text>
            <text x={p.x} y={p.y-5} textAnchor="middle" fontSize="4.5" fill="#999">{prices[i]}€</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function Reseñas({ reviews }) {
  return (
    <div>
      <div style={{ fontSize:11, color:'#555', letterSpacing:1, marginBottom:10 }}>RESEÑAS DE MEDIOS</div>
      {reviews.map((r,i) => (
        <div key={i} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:11, padding:'12px 14px', marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
            <div style={{ display:'flex', gap:9, alignItems:'center' }}>
              <div style={{ width:28, height:28, borderRadius:7, background:'#1e1e1e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#666' }}>{r.fuente[0]}</div>
              <div><div style={{ fontSize:12, fontWeight:700, color:'#ddd' }}>{r.fuente}</div><div style={{ fontSize:10, color:'#444' }}>{r.fecha}</div></div>
            </div>
            <div style={{ background:'#1e1e1e', borderRadius:8, padding:'4px 10px', display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ color:'#f5a623', fontSize:12 }}>★</span>
              <span style={{ fontSize:14, fontWeight:900 }}>{r.nota}</span>
              <span style={{ fontSize:10, color:'#555' }}>/10</span>
            </div>
          </div>
          <div style={{ fontSize:12, color:'#777', lineHeight:1.6, fontStyle:'italic' }}>"{r.texto}"</div>
        </div>
      ))}
    </div>
  );
}

/* ─── MODAL PRODUCTO ─── */
const TABS = ['Galería','Características','Precios','Reseñas','Historial','2ª mano'];

function ModalProducto({ prod, precios, scrapeStatus, onCerrar, onAnuncio, onScrapeOne }) {
  const [tab, setTab] = useState('Galería');
  const pP = precios[prod.id] || getPrecioMap(prod);
  const pS = scrapeStatus[prod.id] || {};
  const v = Object.values(pP).filter(Boolean);
  const minP = v.length ? Math.min(...v) : null;
  const maxP = v.length ? Math.max(...v) : null;
  const [mejId] = getMejor(pP);
  const mejT = TIENDAS.find(t => t.id === mejId);
  const isLoading = Object.values(pS).some(s => s==='loading');

  useEffect(() => {
    const fn = e => e.key==='Escape' && onCerrar();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const tabStyle = a => ({ flex:1, padding:'9px 0', fontSize:12, fontWeight:700, background:'none', border:'none', cursor:'pointer', color:a?'#f0f0f0':'#444', borderBottom:`2px solid ${a?'#f0f0f0':'transparent'}`, transition:'all .2s', whiteSpace:'nowrap' });

  return (
    <div onClick={onCerrar} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.92)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16, animation:'fadeIn .2s ease' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#111', border:'1px solid #2a2a2a', borderRadius:22, width:'100%', maxWidth:620, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 24px 0', borderBottom:'1px solid #1e1e1e', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:'#f0f0f0' }}>{prod.nombre}</div>
              <div style={{ fontSize:12, color:'#f5a623', marginTop:2 }}>{'★'.repeat(Math.round(prod.rating))} <span style={{ color:'#555' }}>{prod.rating}</span></div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {minP && <div style={{ textAlign:'right' }}><div style={{ fontSize:9, color:'#555' }}>mejor precio</div><div style={{ fontSize:18, fontWeight:900, color:'#34c759', fontFamily:'ui-monospace,monospace' }}>{minP}€</div></div>}
              <button onClick={() => onScrapeOne(prod)} disabled={isLoading} style={{ background:isLoading?'#1a1a1a':'#1e3a5f', border:'1px solid #2563eb', borderRadius:9, padding:'6px 11px', color:isLoading?'#444':'#60a5fa', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {isLoading?'⟳':'↻'}
              </button>
              <button onClick={onCerrar} style={{ background:'#1e1e1e', border:'none', color:'#666', fontSize:18, width:32, height:32, borderRadius:'50%', cursor:'pointer' }}>✕</button>
            </div>
          </div>
          <div style={{ display:'flex', overflowX:'auto', scrollbarWidth:'none' }}>
            {TABS.map(t => <button key={t} onClick={()=>setTab(t)} style={tabStyle(tab===t)}>{t}{t==='2ª mano'&&prod.listings?.length>0?` (${prod.listings.length})`:''}</button>)}
          </div>
        </div>

        <div style={{ overflowY:'auto', padding:'20px 24px 24px' }}>
          {tab==='Galería' && <><Galeria fotos={prod.fotos} labels={prod.fotoLabels} emoji={prod.emoji} /><div style={{ fontSize:13, color:'#888', lineHeight:1.7 }}>{prod.desc}</div></>}

          {tab==='Características' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {Object.entries(prod.specs||{}).map(([k,v]) => (
                <div key={k} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:10, padding:'10px 13px' }}>
                  <div style={{ fontSize:10, color:'#555', marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#e0e0e0' }}>{v}</div>
                </div>
              ))}
            </div>
          )}

          {tab==='Precios' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                <div><div style={{ fontSize:11, color:'#555' }}>{mejT?.nombre}</div><div style={{ fontSize:26, fontWeight:900, color:'#34c759', fontFamily:'ui-monospace,monospace' }}>{minP}€</div></div>
                {maxP&&minP&&maxP-minP>0&&<div style={{ background:'#0d1f0d', border:'1px solid #34c759', borderRadius:10, padding:'6px 14px', textAlign:'center' }}><div style={{ fontSize:10, color:'#34c759' }}>AHORRO</div><div style={{ fontSize:20, fontWeight:900, color:'#34c759' }}>-{maxP-minP}€</div></div>}
              </div>
              <BarraPrecios precios={pP} statuses={pS} />
              <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {TIENDAS.filter(t=>pP[t.id]!=null).map(t => {
                  const es=t.id===mejId; const st=pS[t.id];
                  return (
                    <a key={t.id} href={t.url} target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', background:es?'#0d1f0d':'#161616', border:`1px solid ${es?'#34c759':'#1e1e1e'}`, borderRadius:10, textDecoration:'none' }}>
                      <span style={{ fontSize:18 }}>{t.logo}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10, color:'#555' }}>{t.nombre}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <Dot status={st} />
                          <span style={{ fontSize:14, fontWeight:800, color:es?'#34c759':'#ddd', fontFamily:'ui-monospace,monospace' }}>{st==='loading'?'—':st==='error'?'Error':`${pP[t.id]}€`}</span>
                        </div>
                      </div>
                      {es&&<span>🏆</span>}
                    </a>
                  );
                })}
              </div>
            </>
          )}

          {tab==='Reseñas' && <Reseñas reviews={prod.reviews||[]} />}
          {tab==='Historial' && <HistorialChart historial={prod.priceHistory||[]} />}

          {tab==='2ª mano' && (
            <>
              <button onClick={onAnuncio} style={{ width:'100%', marginBottom:14, padding:'10px', background:'linear-gradient(90deg,#1e3a5f,#1a2a4f)', border:'1px dashed #2563eb', borderRadius:11, color:'#60a5fa', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                + Publicar anuncio de segunda mano
              </button>
              {!prod.listings?.length ? (
                <div style={{ textAlign:'center', padding:'36px 0', color:'#333' }}><div style={{ fontSize:30 }}>📭</div><div style={{ marginTop:8 }}>Sin anuncios</div></div>
              ) : prod.listings.map(a => (
                <div key={a.id} style={{ background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:11, padding:'13px 15px', marginBottom:9 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontSize:20, fontWeight:900, color:'#f5a623', fontFamily:'ui-monospace,monospace' }}>{a.precio}€</span>
                    <span style={{ background:colorEstado(a.estado)+'22', color:colorEstado(a.estado), fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20 }}>{a.estado}</span>
                  </div>
                  {/* Listing photos */}
                  {a.fotos?.length > 0 && (
                    <div style={{ display:'flex', gap:6, marginBottom:8, overflowX:'auto' }}>
                      {a.fotos.map((src,i) => (
                        <img key={i} src={src} alt="" style={{ width:70, height:70, objectFit:'cover', borderRadius:8, border:'1px solid #2a2a2a', flexShrink:0 }} onError={e=>e.target.style.display='none'} />
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize:12, color:'#888', lineHeight:1.5, marginBottom:7 }}>{a.descripcion}</div>
                  <div style={{ display:'flex', gap:12, fontSize:11, color:'#444' }}>
                    <span>📍 {a.ciudad}</span>
                    <span>👤 {a.vendedor}</span>
                    <span>📅 {new Date(a.createdAt).toLocaleDateString('es-ES')}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── MODAL ANUNCIO (with real file upload to /api/listings) ─── */
function ModalAnuncio({ productoId, productos, onGuardar, onCerrar }) {
  const [form, setForm] = useState({ productoId: productoId||'', precio:'', estado:'Excelente', ciudad:'', vendedor:'', descripcion:'' });
  const [fotos, setFotos] = useState([]);    // { src: preview URL or URL string, file: File|null }
  const [urlInput, setUrlInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  function addFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/') || fotos.length >= 5) return;
      const src = URL.createObjectURL(file);
      setFotos(f => f.length < 5 ? [...f, { src, file }] : f);
    });
  }

  function addUrl() {
    const url = urlInput.trim();
    if (!url || fotos.length >= 5) return;
    setFotos(f => [...f, { src: url, file: null }]);
    setUrlInput('');
  }

  async function submit() {
    if (!form.productoId || !form.precio || !form.ciudad || !form.vendedor) { setError('Rellena todos los campos obligatorios.'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('productoId', form.productoId);
      fd.append('precio', form.precio);
      fd.append('estado', form.estado);
      fd.append('ciudad', form.ciudad);
      fd.append('vendedor', form.vendedor);
      fd.append('descripcion', form.descripcion);

      let urlIdx = 0;
      fotos.forEach(f => {
        if (f.file) fd.append('fotos', f.file);
        else { fd.append(`fotos_url_${urlIdx}`, f.src); urlIdx++; }
      });

      const res = await fetch('/api/listings', { method:'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al publicar');
      onGuardar(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  const inp = { background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:9, padding:'9px 12px', color:'#f0f0f0', fontSize:13, outline:'none', fontFamily:'inherit' };

  return (
    <div onClick={onCerrar} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.93)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#111', border:'1px solid #2a2a2a', borderRadius:20, padding:26, width:'100%', maxWidth:500, maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <div><div style={{ fontSize:16, fontWeight:800 }}>Publicar anuncio</div><div style={{ fontSize:11, color:'#555', marginTop:2 }}>Segunda mano · Manzana.es</div></div>
          <button onClick={onCerrar} style={{ background:'#1e1e1e', border:'none', color:'#666', fontSize:17, width:32, height:32, borderRadius:'50%', cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <select value={form.productoId} onChange={e=>set('productoId',e.target.value)} style={{ ...inp, color: form.productoId?'#f0f0f0':'#555' }}>
            <option value="" disabled>Selecciona el producto…</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
          </select>

          <div style={{ display:'flex', gap:9 }}>
            <input type="number" placeholder="Precio (€)" value={form.precio} onChange={e=>set('precio',e.target.value)} style={{ ...inp, flex:1 }} />
            <select value={form.estado} onChange={e=>set('estado',e.target.value)} style={{ ...inp, flex:1 }}>
              {ESTADOS.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>

          <div style={{ display:'flex', gap:9 }}>
            <input placeholder="Ciudad *" value={form.ciudad} onChange={e=>set('ciudad',e.target.value)} style={{ ...inp, flex:1 }} />
            <input placeholder="Tu nombre *" value={form.vendedor} onChange={e=>set('vendedor',e.target.value)} style={{ ...inp, flex:1 }} />
          </div>

          <textarea placeholder="Descripción (estado, accesorios…)" value={form.descripcion} onChange={e=>set('descripcion',e.target.value)} rows={3} style={{ ...inp, resize:'none' }} />

          {/* FOTOS */}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#777', marginBottom:7 }}>Fotos <span style={{ color:'#444', fontWeight:400 }}>({fotos.length}/5)</span></div>

            {fotos.length < 5 && (
              <div onClick={() => fileRef.current.click()}
                onDragOver={e=>{e.preventDefault();setDragOver(true);}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);addFiles(e.dataTransfer.files);}}
                style={{ border:`2px dashed ${dragOver?'#2563eb':'#2a2a2a'}`, borderRadius:12, padding:'18px 14px', textAlign:'center', cursor:'pointer', background:dragOver?'#0d1a2e':'#0d0d0d', transition:'all .2s', marginBottom:8 }}>
                <div style={{ fontSize:26, marginBottom:5 }}>📷</div>
                <div style={{ fontSize:12, fontWeight:700, color:dragOver?'#60a5fa':'#555' }}>Arrastra fotos o pulsa para subir</div>
                <div style={{ fontSize:11, color:'#333', marginTop:2 }}>JPG · PNG · WEBP · máx 5 fotos · 5 MB c/u</div>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e=>addFiles(e.target.files)} />
              </div>
            )}

            {fotos.length < 5 && (
              <div style={{ display:'flex', gap:8, marginBottom:9 }}>
                <input value={urlInput} onChange={e=>setUrlInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addUrl()} placeholder="O pega una URL de imagen…" style={{ ...inp, flex:1, fontSize:12 }} />
                <button onClick={addUrl} disabled={!urlInput.trim()} style={{ background:'#1e3a5f', border:'1px solid #2563eb', borderRadius:9, padding:'0 13px', color:'#60a5fa', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>+ URL</button>
              </div>
            )}

            {fotos.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:4 }}>
                {fotos.map((f,i) => (
                  <div key={i} style={{ position:'relative', aspectRatio:'1', borderRadius:8, overflow:'hidden', border:'1px solid #2a2a2a' }}>
                    <img src={f.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.background='#1e1e1e'} />
                    <button onClick={()=>setFotos(fs=>fs.filter((_,j)=>j!==i))} style={{ position:'absolute', top:3, right:3, width:17, height:17, borderRadius:'50%', background:'rgba(0,0,0,.8)', border:'none', color:'#fff', fontSize:9, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                    {i===0 && <div style={{ position:'absolute', bottom:3, left:3, background:'rgba(0,0,0,.7)', borderRadius:4, fontSize:8, color:'#aaa', padding:'1px 5px' }}>Principal</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div style={{ fontSize:12, color:'#ff6b6b', background:'#1a0a0a', border:'1px solid #3a1a1a', borderRadius:8, padding:'8px 12px' }}>{error}</div>}

          <button onClick={submit} disabled={loading || !form.productoId || !form.precio || !form.ciudad || !form.vendedor}
            style={{ padding:'13px', background:loading?'#1a1a1a':'linear-gradient(90deg,#2563eb,#1d4ed8)', border:'none', borderRadius:11, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', transition:'all .2s' }}>
            {loading ? '⟳ Publicando…' : 'Publicar anuncio'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── PANEL SCRAPING ─── */
function PanelScraping({ scrapeStatus, onScrapeAll, isScraping, lastUpdated }) {
  const all = Object.values(scrapeStatus).flatMap(s=>Object.values(s));
  const total=all.length, done=all.filter(s=>s==='done').length, errors=all.filter(s=>s==='error').length;
  const pct = total ? Math.round((done+errors)/total*100) : 0;
  return (
    <div style={{ background:'linear-gradient(135deg,#0a0f1a,#0d1117)', border:'1px solid #1e3a5f', borderRadius:14, padding:'14px 18px', marginBottom:18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:isScraping?'#1e3a5f':'#0d1f0d', border:`2px solid ${isScraping?'#2563eb':'#34c759'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, animation:isScraping?'spin 2s linear infinite':'none' }}>{isScraping?'⟳':'✓'}</div>
          <div>
            <div style={{ fontSize:12, fontWeight:800 }}>{isScraping?`Actualizando precios… (${done+errors}/${total})`:'Precios listos'}</div>
            <div style={{ fontSize:10, color:'#444' }}>{lastUpdated?`Última actualización: ${lastUpdated}`:'Pulsa para obtener precios en tiempo real'}</div>
          </div>
        </div>
        <button onClick={onScrapeAll} disabled={isScraping} style={{ display:'flex', alignItems:'center', gap:6, background:isScraping?'#1a1a1a':'linear-gradient(90deg,#2563eb,#1d4ed8)', border:'none', borderRadius:9, padding:'8px 14px', color:isScraping?'#444':'#fff', fontSize:12, fontWeight:800, cursor:isScraping?'not-allowed':'pointer' }}>
          {isScraping?'⟳ Actualizando…':'↻ Actualizar precios'}
        </button>
      </div>
      {isScraping && <div style={{ marginTop:10, background:'#0d0d0d', borderRadius:5, height:5, overflow:'hidden' }}><div style={{ width:`${pct}%`, height:'100%', background:'linear-gradient(90deg,#2563eb,#34c759)', transition:'width .3s' }} /></div>}
    </div>
  );
}

/* ─── PANEL IA ─── */
function PanelIA() {
  const [q,setQ]=useState(''); const [loading,setLoading]=useState(false); const [ans,setAns]=useState('');
  const sugs=['¿Cuál iPhone tiene mejor cámara?','¿Vale la pena M4 vs M3?','¿Dónde comprar más barato?'];
  async function ask() {
    if(!q.trim()||loading) return;
    setLoading(true); setAns('');
    try {
      const r = await fetch('/api/ai', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:q}) });
      const d = await r.json();
      setAns(d.reply || 'Sin respuesta.');
    } catch { setAns('Error de conexión.'); }
    setLoading(false);
  }
  return (
    <div style={{ background:'linear-gradient(135deg,#0a0f1a,#0d1117)', border:'1px solid #1e3a5f', borderRadius:14, padding:'14px 18px', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:9 }}><span>🤖</span><span style={{ fontSize:11, fontWeight:800, color:'#60a5fa', letterSpacing:1.5 }}>ASISTENTE IA</span></div>
      <div style={{ display:'flex', gap:8, marginBottom:7 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ask()} placeholder="¿En qué te puedo ayudar?" style={{ flex:1, background:'#080d14', border:'1px solid #1e3a5f', borderRadius:9, padding:'8px 12px', color:'#f0f0f0', fontSize:12, outline:'none', fontFamily:'inherit' }} />
        <button onClick={ask} disabled={loading||!q.trim()} style={{ background:loading?'#1e3a5f':'#2563eb', border:'none', borderRadius:9, padding:'8px 13px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>{loading?'…':'Preguntar'}</button>
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{sugs.map(s=><button key={s} onClick={()=>setQ(s)} style={{ background:'#0d1a2e', border:'1px solid #1e3a5f', borderRadius:20, padding:'3px 9px', color:'#60a5fa', fontSize:10, cursor:'pointer' }}>{s}</button>)}</div>
      {ans&&<div style={{ marginTop:9, padding:'10px 12px', background:'#060a10', borderRadius:9, border:'1px solid #1e3a5f', fontSize:12, color:'#cbd5e1', lineHeight:1.6 }}>{ans}</div>}
    </div>
  );
}

/* ─── TARJETA PRODUCTO ─── */
function TarjetaProducto({ prod, precios, scrapeStatus, onClick }) {
  const pP = precios[prod.id] || getPrecioMap(prod);
  const pS = scrapeStatus[prod.id] || {};
  const v = Object.values(pP).filter(Boolean);
  const minP = v.length ? Math.min(...v) : null;
  const maxP = v.length ? Math.max(...v) : null;
  const [mejId] = getMejor(pP);
  const mejT = TIENDAS.find(t=>t.id===mejId);
  const listings = prod.listings || [];
  const mejBU = listings.length ? Math.min(...listings.map(l=>l.precio)) : null;
  const isLoading = Object.values(pS).some(s=>s==='loading');

  return (
    <div onClick={onClick}
      style={{ background:'linear-gradient(145deg,#161616,#111)', border:`1px solid ${isLoading?'#1e3a5f':'#1e1e1e'}`, borderRadius:18, padding:18, cursor:'pointer', transition:'all .25s', position:'relative', overflow:'hidden', animation:'slideUp .3s ease' }}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 16px 48px rgba(0,0,0,.7)';e.currentTarget.style.border=`1px solid ${isLoading?'#2563eb':'#333'}`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.border=`1px solid ${isLoading?'#1e3a5f':'#1e1e1e'}`;}}>

      {prod.tag && <div style={{ position:'absolute', top:12, right:12, background:TAG_COLORS[prod.tag]||'#555', color:'#fff', fontSize:9, fontWeight:900, padding:'3px 8px', borderRadius:20, letterSpacing:1 }}>{prod.tag}</div>}
      {isLoading && <div style={{ position:'absolute', top:12, left:12, display:'flex', alignItems:'center', gap:4 }}><Dot status="loading"/><span style={{ fontSize:9, color:'#2563eb' }}>Scraping</span></div>}

      <div style={{ display:'flex', gap:4, marginBottom:9, marginTop:isLoading?12:0 }}>
        {(prod.fotos||[]).slice(0,4).map((c,i)=><div key={i} style={{ flex:1, height:4, borderRadius:2, background:c }} />)}
      </div>

      <div style={{ fontSize:34, textAlign:'center', marginBottom:8 }}>{prod.emoji}</div>
      <div style={{ fontSize:12, fontWeight:700, color:'#eee', marginBottom:2, lineHeight:1.3 }}>{prod.nombre}</div>
      <div style={{ fontSize:10, color:'#f5a623', marginBottom:10 }}>{'★'.repeat(Math.round(prod.rating))} <span style={{ color:'#444' }}>{prod.rating}</span></div>

      <div style={{ borderTop:'1px solid #1e1e1e', paddingTop:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:mejBU!=null?8:0 }}>
          <div>
            <div style={{ fontSize:9, color:'#444', letterSpacing:1 }}>NUEVO · {isLoading?<span style={{ color:'#2563eb' }}>…</span>:mejT?.nombre}</div>
            <div style={{ fontSize:18, fontWeight:900, color:'#f0f0f0', fontFamily:'ui-monospace,monospace' }}>{isLoading?'—':minP?`${minP}€`:'—'}</div>
          </div>
          {!isLoading&&maxP&&minP&&maxP-minP>0&&<div style={{ fontSize:9, color:'#34c759', background:'#0d1f0d', border:'1px solid #1a3a1a', borderRadius:7, padding:'2px 7px' }}>-{maxP-minP}€</div>}
        </div>
        {mejBU!=null?(
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0d0d0d', borderRadius:9, padding:'7px 9px', border:'1px solid #1e1e1e' }}>
            <div><div style={{ fontSize:9, color:'#f5a623' }}>2ª MANO · {listings.length} anuncio{listings.length>1?'s':''}</div><div style={{ fontSize:16, fontWeight:800, color:'#f5a623', fontFamily:'ui-monospace,monospace' }}>{mejBU}€</div></div>
            {minP&&<div style={{ fontSize:9, color:'#f5a623' }}>-{minP-mejBU}€</div>}
          </div>
        ):(
          <div style={{ fontSize:10, color:'#252525', textAlign:'center', marginTop:4 }}>Sin 2ª mano</div>
        )}
      </div>
    </div>
  );
}

/* ─── HOME PAGE ─── */
function HomePage({ products, precios, scrapeStatus, onSelect, onCategoryClick }) {
  const novedades = products.filter(p=>['Novedad','Pro','Ultra','Exclusivo'].includes(p.tag));
  const populares = [...products].sort((a,b)=>b.rating-a.rating).slice(0,4);
  const mejorOferta = [...products].sort((a,b)=>{
    const aH=a.priceHistory||[], bH=b.priceHistory||[];
    const drop = h => h.length>=2 ? h[0].price-h[h.length-1].price : 0;
    return drop(bH)-drop(aH);
  }).slice(0,4);

  const hero = products[0];
  const heroPrecios = hero ? (precios[hero.id] || getPrecioMap(hero)) : {};
  const heroV = Object.values(heroPrecios).filter(Boolean);
  const heroMin = heroV.length ? Math.min(...heroV) : null;

  const Section = ({ title, icon, items }) => (
    <div style={{ marginBottom:34 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <span style={{ fontSize:20 }}>{icon}</span>
        <div style={{ fontSize:18, fontWeight:900 }}>{title}</div>
        <div style={{ flex:1, height:1, background:'linear-gradient(90deg,#2a2a2a,transparent)', marginLeft:8 }} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
        {items.map(p=><TarjetaProducto key={p.id} prod={p} precios={precios} scrapeStatus={scrapeStatus} onClick={()=>onSelect(p)} />)}
      </div>
    </div>
  );

  return (
    <div>
      {hero && (
        <div style={{ background:'linear-gradient(135deg,#0d1117 0%,#1a1a2e 50%,#16213e 100%)', borderRadius:20, padding:'30px 26px', marginBottom:30, border:'1px solid #1e3a5f', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(37,99,235,.15),transparent 70%)' }} />
          <div style={{ display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ fontSize:11, color:'#60a5fa', fontWeight:800, letterSpacing:2, marginBottom:8 }}>DESTACADO DEL MES</div>
              <div style={{ fontSize:24, fontWeight:900, lineHeight:1.2, marginBottom:8 }}>{hero.nombre}</div>
              <div style={{ fontSize:13, color:'#888', lineHeight:1.6, marginBottom:16, maxWidth:360 }}>{hero.desc}</div>
              <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                {heroMin&&<div><div style={{ fontSize:11, color:'#555' }}>Desde</div><div style={{ fontSize:26, fontWeight:900, color:'#34c759', fontFamily:'ui-monospace,monospace' }}>{heroMin}€</div></div>}
                <button onClick={()=>onSelect(hero)} style={{ background:'linear-gradient(90deg,#2563eb,#1d4ed8)', border:'none', borderRadius:11, padding:'10px 20px', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer' }}>Ver oferta →</button>
              </div>
            </div>
            <div style={{ fontSize:80, filter:'drop-shadow(0 0 40px rgba(37,99,235,.3))' }}>{hero.emoji}</div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:9, marginBottom:26, flexWrap:'wrap' }}>
        {CATS.filter(c=>c.id!=='all').map(c=>(
          <div key={c.id}
            onClick={()=>onCategoryClick?.(c.id)}
            style={{ display:'flex', alignItems:'center', gap:7, background:'#111', border:'1px solid #1e1e1e', borderRadius:12, padding:'9px 14px', cursor:'pointer', transition:'all .2s' }}
            onMouseEnter={e=>{e.currentTarget.style.background='#1a1a1a';e.currentTarget.style.borderColor='#2563eb';}}
            onMouseLeave={e=>{e.currentTarget.style.background='#111';e.currentTarget.style.borderColor='#1e1e1e';}}>
            <span style={{ fontSize:18 }}>{c.icon}</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#aaa' }}>{c.label}</span>
          </div>
        ))}
      </div>

      <Section title="Novedades" icon="✨" items={novedades} />
      <Section title="Más populares" icon="🔥" items={populares} />
      <Section title="Mejor bajada de precio" icon="📉" items={mejorOferta} />
    </div>
  );
}


/* ─── MAIN APP ─── */
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
        const safeParse = (s, f) => { try { return typeof s === 'string' ? JSON.parse(s) : (s ?? f); } catch { return f; } };
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

  // Mock scrape (calls /api/prices/scrape in real mode)
  async function triggerScrape(prod) {
    const storeIds = Object.keys(getPrecioMap(prod)).filter(id => getPrecioMap(prod)[id]);
    setScrapeStatus(p => ({ ...p, [prod.id]: Object.fromEntries(storeIds.map(id=>[id,'loading'])) }));

    try {
      const res = await fetch('/api/prices/scrape', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ productId: prod.id }) });
      const data = await res.json();

      if (data.results?.[0]) {
        const newPrices = {};
        Object.entries(data.results[0].stores || {}).forEach(([storeId, { price }]) => {
          if (price) newPrices[storeId] = price;
        });
        setPrecios(p => ({ ...p, [prod.id]: { ...p[prod.id], ...newPrices } }));
      }

      // Mark done (or fallback to mock done)
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
    const aMin = Math.min(...Object.values(precios[a.id]||{}).filter(Boolean));
    const bMin = Math.min(...Object.values(precios[b.id]||{}).filter(Boolean));
    if (orden==='precio-asc') return aMin-bMin;
    if (orden==='precio-desc') return bMin-aMin;
    if (orden==='valoracion') return b.rating-a.rating;
    return 0;
  });

  if (loadingProducts) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:48 }}>🍎</div>
      <div style={{ fontSize:14, color:'#555' }}>Cargando Manzana.es…</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#090909', color:'#f0f0f0', fontFamily:"-apple-system,'Helvetica Neue',sans-serif" }}>
      {/* NAV */}
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
        <PanelScraping scrapeStatus={scrapeStatus} onScrapeAll={scrapeAll} isScraping={isScraping} lastUpdated={lastUpdated} />

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
