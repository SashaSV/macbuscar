'use client';
import { useState, useEffect } from 'react';
import Galeria from '../ui/Galeria';
import BarraPrecios from '../ui/BarraPrecios';
import HistorialChart from '../ui/HistorialChart';
import Resenas from '../ui/Resenas';
import Dot from '../ui/Dot';
import { TIENDAS, TABS } from '../shared/constants';
import { getMejor, getPrecioMap, colorEstado } from '../shared/utils';

export default function ModalProducto({ prod, precios, scrapeStatus, onCerrar, onAnuncio, onScrapeOne }) {
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
  }, [onCerrar]);

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

          {tab==='Reseñas' && <Resenas reviews={prod.reviews||[]} />}
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
