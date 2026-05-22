export default function Resenas({ reviews }) {
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
