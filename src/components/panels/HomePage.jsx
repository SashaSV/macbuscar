import TarjetaProducto from '../ui/TarjetaProducto';
import { CATS } from '../shared/constants';
import { getPrecioMap } from '../shared/utils';

export default function HomePage({ products, precios, scrapeStatus, onSelect, onCategoryClick }) {
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
