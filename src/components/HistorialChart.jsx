export default function HistorialChart({ historial }) {
  const min = Math.min(...historial.map(h => h.p));
  const max = Math.max(...historial.map(h => h.p));
  const range = max - min || 1;
  const W = 100, H = 52;
  const pts = historial.map((h, i) => ({
    x: (i / (historial.length - 1)) * W,
    y: H - ((h.p - min) / range) * H * 0.78 - H * 0.1,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${path} L${pts[pts.length - 1].x},${H} L0,${H} Z`;
  const drop = historial[historial.length - 1].p - historial[0].p;
  const isDown = drop < 0;
  const color = isDown ? '#34c759' : '#ff6b6b';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#555' }}>Histórico de precios (6 meses)</div>
          <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 2 }}>
            {isDown ? '▼' : '▲'} {Math.abs(drop)}€ desde enero
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#555', textAlign: 'right' }}>
          <div>Mín: <span style={{ color: '#34c759', fontWeight: 700 }}>{min}€</span></div>
          <div>Máx: <span style={{ color: '#ff6b6b', fontWeight: 700 }}>{max}€</span></div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80, overflow: 'visible' }}>
        <defs>
          <linearGradient id={`g${min}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g${min})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill={color} />
            <text x={p.x} y={H + 10} textAnchor="middle" fontSize="5" fill="#555">{historial[i].m}</text>
            <text x={p.x} y={p.y - 5} textAnchor="middle" fontSize="4.5" fill="#999">{historial[i].p}€</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
