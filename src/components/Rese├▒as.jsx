export default function Reseñas({ reseñas }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#555', letterSpacing: 1, marginBottom: 12 }}>RESEÑAS DE MEDIOS</div>
      {reseñas.map((r, i) => (
        <div key={i} style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 12, padding: '13px 15px', marginBottom: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#666' }}>
                {r.fuente[0]}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ddd' }}>{r.fuente}</div>
                <div style={{ fontSize: 10, color: '#444' }}>{r.fecha}</div>
              </div>
            </div>
            <div style={{ background: '#1e1e1e', borderRadius: 8, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#f5a623', fontSize: 13 }}>★</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#f0f0f0' }}>{r.nota}</span>
              <span style={{ fontSize: 10, color: '#555' }}>/10</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#777', lineHeight: 1.6, fontStyle: 'italic' }}>"{r.texto}"</div>
        </div>
      ))}
    </div>
  );
}
