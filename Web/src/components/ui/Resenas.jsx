export default function Resenas({ reviews }) {
  if (!reviews?.length) return (
    <div style={{ textAlign: 'center', padding: '36px 0', color: 'rgba(29,29,31,0.4)' }}>
      <i className="ti ti-message-circle" aria-hidden="true" style={{ fontSize: 32 }} />
      <div style={{ marginTop: 8 }}>Sin reseñas</div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize:10, color:'rgba(29,29,31,0.4)', letterSpacing:1, marginBottom:12 }}>RESEÑAS DE MEDIOS</div>
      {reviews.map((r, i) => (
        <div
          key={i}
          style={{
            background: 'rgba(255,255,255,0.55)',
            border: '0.5px solid rgba(255,255,255,0.8)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 10,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <div style={{
                width: 30, height: 30,
                borderRadius: 10,
                background: 'rgba(168,85,247,0.15)',
                border: '0.5px solid rgba(168,85,247,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 500, color: '#7c3aed',
              }}>{r.fuente[0]}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:'#1d1d1f' }}>{r.fuente}</div>
                <div style={{ fontSize:10, color:'rgba(29,29,31,0.4)' }}>{r.fecha}</div>
              </div>
            </div>
            <div style={{
              background: 'rgba(245,158,11,0.15)',
              border: '0.5px solid rgba(245,158,11,0.3)',
              borderRadius: 10,
              padding: '4px 10px',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ color:'#f59e0b', fontSize:12 }}>★</span>
              <span style={{ fontSize:14, fontWeight:500, color:'#b45309' }}>{r.nota}</span>
              <span style={{ fontSize:10, color:'rgba(180,83,9,0.6)' }}>/10</span>
            </div>
          </div>
          <div style={{ fontSize:12, color:'rgba(29,29,31,0.7)', lineHeight:1.6, fontStyle:'italic' }}>"{r.texto}"</div>
        </div>
      ))}
    </div>
  );
}
