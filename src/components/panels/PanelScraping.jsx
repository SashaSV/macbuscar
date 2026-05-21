export default function PanelScraping({ scrapeStatus, onScrapeAll, isScraping, lastUpdated }) {
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
