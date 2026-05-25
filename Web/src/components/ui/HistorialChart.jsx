export default function HistorialChart({ historial }) {
  if (!historial?.length) return null;
  const prices = historial.map(h => h.price || h.p);
  const months = historial.map(h => h.month || h.m);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const W = 100, H = 52;
  const pts = prices.map((p, i) => ({
    x: (i / (prices.length - 1)) * W,
    y: H - ((p - min) / range) * H * 0.78 - H * 0.1,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${path} L${pts[pts.length-1].x},${H} L0,${H} Z`;
  const drop = prices[prices.length - 1] - prices[0];
  const isDown = drop < 0;
  const color = isDown ? '#10b981' : '#ef4444';

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:11, color:'rgba(29,29,31,0.5)' }}>Histórico 6 meses</div>
          <div style={{ fontSize:13, fontWeight:500, color, marginTop:2 }}>
            {isDown ? '▼' : '▲'} {Math.abs(drop).toLocaleString('es-ES')} € desde {months[0]}
          </div>
        </div>
        <div style={{ fontSize:11, color:'rgba(29,29,31,0.5)', textAlign:'right' }}>
          <div>Mín: <span style={{ color:'#047857', fontWeight:500 }}>{min.toLocaleString('es-ES')} €</span></div>
          <div>Máx: <span style={{ color:'#b91c1c', fontWeight:500 }}>{max.toLocaleString('es-ES')} €</span></div>
        </div>
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.55)',
        border: '0.5px solid rgba(255,255,255,0.8)',
        borderRadius: 14,
        padding: '12px 12px 18px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:78, overflow:'visible' }}>
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#cg)" />
          <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="2.5" fill={color} />
              <text x={p.x} y={H + 10} textAnchor="middle" fontSize="5" fill="rgba(29,29,31,0.5)">{months[i]}</text>
              <text x={p.x} y={p.y - 5} textAnchor="middle" fontSize="4.5" fill="rgba(29,29,31,0.6)">{prices[i]}€</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
