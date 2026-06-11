/**
 * HistorialChart — price history for a single variant, across all stores.
 *
 * Input: a `variant` object with `priceHistory` and `prices`. The chart
 * shows, for each day, the MINIMUM price that was active across all stores
 * carrying this variant.
 *
 * Why a snapshot, not a raw list of PriceHistory rows?
 * ──────────────────────────────────────────────────────────────────────
 * PriceHistory only records *changes* — a row exists only when a price
 * moved. So "today's row" only shows stores that changed price today.
 * If a store's price has been steady for a week, there's no row today
 * for that store, even though its price is still active and possibly
 * the cheapest. A naive min over today's PriceHistory rows would miss it.
 *
 * Fix: build a per-store timeline from PriceHistory rows PLUS the current
 * Price (carrying the live value at Price.updatedAt). For each unique day
 * across all timelines, compute "what was each store's effective price at
 * end of that day" (latest entry with date ≤ that day) and take the min.
 * This is a proper "as-of date" snapshot — the same value a user would
 * have seen on the site if they had loaded the page on that day.
 */
export default function HistorialChart({ variant }) {
  if (!variant) return null;

  // ── 1. Build per-store timelines ──────────────────────────────────────
  // timelines: Map<storeId, Array<{ dateMs, price, storeName? }>> sorted asc
  const timelines = new Map();

  const pushPoint = (storeId, dateMs, price, storeName) => {
    if (!price || price <= 0) return;
    if (!timelines.has(storeId)) timelines.set(storeId, { points: [], storeName });
    timelines.get(storeId).points.push({ dateMs, price });
    if (storeName && !timelines.get(storeId).storeName) {
      timelines.get(storeId).storeName = storeName;
    }
  };

  for (const ph of (variant.priceHistory || [])) {
    pushPoint(ph.storeId, new Date(ph.date).getTime(), ph.price);
  }
  // Always include the current Price as a "now" sample — covers stores
  // whose latest change is older than the 90-day PriceHistory window AND
  // anchors the rightmost end of the chart at today's actual displayed
  // price (which is what the user is comparing the historical numbers to).
  for (const pr of (variant.prices || [])) {
    pushPoint(
      pr.storeId,
      new Date(pr.updatedAt || pr.scrapedAt || Date.now()).getTime(),
      pr.price,
      pr.storeName,
    );
  }

  for (const tl of timelines.values()) {
    tl.points.sort((a, b) => a.dateMs - b.dateMs);
  }

  if (timelines.size === 0) {
    return (
      <div style={{ padding: '36px 0', textAlign: 'center', color: 'rgba(29,29,31,0.4)' }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>📉</div>
        <div style={{ fontSize: 13 }}>Sin historial de precios para esta configuración</div>
      </div>
    );
  }

  // ── 2. Collect unique calendar days across all timelines ─────────────
  const dayKeys = new Set();
  for (const tl of timelines.values()) {
    for (const p of tl.points) {
      dayKeys.add(new Date(p.dateMs).toISOString().slice(0, 10));
    }
  }
  const sortedDays = [...dayKeys].sort();

  // ── 3. For each day, compute snapshot min across stores ──────────────
  // "Snapshot min on day D" = MIN over each store of the store's price
  // EFFECTIVE at end of day D (i.e. the most recent timeline entry with
  // date ≤ D). Stores that don't yet exist on day D contribute nothing.
  const points = [];
  for (const day of sortedDays) {
    const dayEnd = new Date(day + 'T23:59:59.999Z').getTime();
    let minPrice = Infinity;
    for (const { points: tl } of timelines.values()) {
      let effective = null;
      for (const p of tl) {
        if (p.dateMs <= dayEnd) effective = p.price;
        else break;
      }
      if (effective != null && effective < minPrice) minPrice = effective;
    }
    if (minPrice < Infinity) {
      const dateObj = new Date(day + 'T12:00:00Z');
      points.push({
        price: minPrice,
        dateObj,
        label: dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      });
    }
  }

  if (!points.length) return null;

  // Collapse runs of identical consecutive prices — the chart shows MOVEMENTS,
  // and a long flat line with 40 identical labels is noise. Keep first/last
  // of each run so the visual flat segment is preserved.
  const compressed = [];
  for (let i = 0; i < points.length; i++) {
    const prev = compressed[compressed.length - 1];
    const next = points[i + 1];
    const cur = points[i];
    const isRunMiddle = prev && next && prev.price === cur.price && next.price === cur.price;
    if (!isRunMiddle) compressed.push(cur);
  }
  const display = compressed;

  // ── 4. Chart geometry & styling ──────────────────────────────────────
  const prices = display.map(p => p.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const W = 100, H = 52;
  const pts = display.map((pt, i) => ({
    x: display.length === 1 ? W / 2 : (i / (display.length - 1)) * W,
    y: H - ((pt.price - min) / range) * H * 0.62 - H * 0.2,
    label: pt.label,
    price: pt.price,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${path} L${pts[pts.length-1].x},${H} L0,${H} Z`;
  const drop = prices[prices.length - 1] - prices[0];
  const isDown = drop < 0;
  const color = isDown ? '#10b981' : (drop > 0 ? '#ef4444' : '#6b7280');

  // Subsample date labels so we never draw more than ~7 on the x-axis.
  const MAX_LABELS = 7;
  const step = Math.max(1, Math.ceil(pts.length / MAX_LABELS));
  const showLabel = i => i === 0 || i === pts.length - 1 || i % step === 0;

  const firstDate = display[0]?.dateObj;
  const lastDate  = display[display.length - 1]?.dateObj;
  const fmt = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const rangeLabel = (firstDate && lastDate)
    ? (display.length === 1 ? fmt(firstDate) : `${fmt(firstDate)} – ${fmt(lastDate)}`)
    : '';

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:11, color:'rgba(29,29,31,0.5)', textTransform:'uppercase', letterSpacing:0.4 }}>
            Histórico de precios
          </div>
          <div style={{ fontSize:12, color:'rgba(29,29,31,0.55)', marginTop:3 }}>
            {variant.nombre ? `${variant.nombre} · ` : ''}{rangeLabel}
          </div>
          {drop !== 0 && (
            <div style={{ fontSize:14, fontWeight:600, color, marginTop:4 }}>
              {isDown ? '▼' : '▲'} {Math.abs(drop).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
              <span style={{ fontSize:11, fontWeight:400, color:'rgba(29,29,31,0.5)', marginLeft:6 }}>
                desde el inicio del período
              </span>
            </div>
          )}
        </div>
        <div style={{ fontSize:11, color:'rgba(29,29,31,0.55)', textAlign:'right', display:'flex', flexDirection:'column', gap:4 }}>
          <div>
            Mín: <span style={{ color:'#047857', fontWeight:700, fontSize:13, fontFamily:'ui-monospace,monospace' }}>
              {min.toLocaleString('es-ES')} €
            </span>
          </div>
          <div>
            Máx: <span style={{ color:'#b91c1c', fontWeight:700, fontSize:13, fontFamily:'ui-monospace,monospace' }}>
              {max.toLocaleString('es-ES')} €
            </span>
          </div>
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.55)',
        border: '0.5px solid rgba(255,255,255,0.8)',
        borderRadius: 14,
        padding: '20px 14px 26px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:160, overflow:'visible' }}>
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1={H/2} x2={W} y2={H/2}
                stroke="rgba(29,29,31,0.08)" strokeWidth="0.3" strokeDasharray="0.6 0.6" />

          {pts.length > 1 && <path d={area} fill="url(#cg)" />}
          {pts.length > 1 && (
            <path d={path} fill="none" stroke={color} strokeWidth="1.4"
                  strokeLinecap="round" strokeLinejoin="round" />
          )}

          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="1.6" fill="#ffffff" stroke={color} strokeWidth="0.8" />
              <text
                x={p.x}
                y={p.y - 3.2}
                textAnchor="middle"
                fontSize="3.8"
                fontWeight="700"
                fill="#1d1d1f"
                style={{ fontFamily: 'ui-monospace,monospace' }}
              >
                {p.price.toLocaleString('es-ES')}€
              </text>
              {showLabel(i) && (
                <text
                  x={p.x}
                  y={H + 4.5}
                  textAnchor="middle"
                  fontSize="3.2"
                  fill="rgba(29,29,31,0.55)"
                  style={{ fontWeight: 500 }}
                >
                  {p.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
