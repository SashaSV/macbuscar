import Dot from './Dot';
import { TIENDAS, TAG_COLORS } from '../shared/constants';
import { getMejor, getPrecioMap, getPriceValue } from '../shared/utils';

export default function TarjetaProducto({ prod, precios, scrapeStatus, onClick }) {
  const pP = precios[prod.id] || getPrecioMap(prod);
  const pS = scrapeStatus[prod.id] || {};
  const v = Object.values(pP).map(getPriceValue).filter(Boolean);
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

      {prod.fotos && prod.fotos.length > 0 && prod.fotos[0].startsWith('http') ? (
        <div style={{ height:80, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>
          <img src={prod.fotos[0]} alt={prod.nombre} style={{ maxHeight:80, maxWidth:'100%', objectFit:'contain' }} onError={e=>{e.target.style.display='none';e.target.parentElement.innerHTML=prod.emoji;e.target.parentElement.style.fontSize='34px';}} />
        </div>
      ) : (
        <div style={{ fontSize:34, textAlign:'center', marginBottom:8 }}>{prod.emoji}</div>
      )}
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
