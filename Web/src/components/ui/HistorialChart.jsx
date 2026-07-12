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

  // Collapse runs of identical consecutive prices — the chart shows MOVEMENTS.
  const compressed = [];
  for (let i = 0; i < points.length; i++) {
    const prev = compressed[compressed.length - 1];
    const next = points[i + 1];
    const cur = points[i];
    const isRunMiddle = prev && next && prev.price === cur.price && next.price === cur.price;
    if (!isRunMiddle) compressed.push(cur);
  }
  const display = compressed;

  // ── 4. Chart geometry ────────────────────────────────────────────────
  // Larger viewBox coords so SVG-unit fontSizes (10-13) render at a
  // readable px size at 260px chart height. Padding leaves room for Y-axis
  // ticks on the left, X-axis dates below, and price labels above the line
  // without clipping.
  const prices = display.map(p => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  // Y-axis: pad range 8% top and bottom so line never touches edges and
  // even a small variation is visually meaningful (a 3% drop shouldn't
  // read as "flat line", which was the old bug).
  const rawRange = maxP - minP || 1;
  const yPadFrac = 0.15;
  const yLo = minP - rawRange * yPadFrac;
  const yHi = maxP + rawRange * yPadFrac;
  const yRange = yHi - yLo;

  const W = 800, H = 300;
  const PAD_L = 62, PAD_R = 22, PAD_T = 28, PAD_B = 34;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xOf = (i) => display.length === 1
    ? PAD_L + innerW / 2
    : PAD_L + (i / (display.length - 1)) * innerW;
  const yOf = (price) => PAD_T + (1 - (price - yLo) / yRange) * innerH;

  const pts = display.map((pt, i) => ({
    x: xOf(i),
    y: yOf(pt.price),
    label: pt.label,
    price: pt.price,
    dateObj: pt.dateObj,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length-1].x.toFixed(1)},${PAD_T + innerH} L${pts[0].x.toFixed(1)},${PAD_T + innerH} Z`;

  const drop = prices[prices.length - 1] - prices[0];
  const isDown = drop < 0;
  const color = isDown ? '#10b981' : (drop > 0 ? '#ef4444' : '#6b7280');

  // ── Y-axis: compute 4 gridline values at nice round steps ─────────────
  // Pick a step that gives ~4 intervals; snap to 5/10/25/50/100 for readability.
  function pickStep(range, targetSteps = 4) {
    const raw = range / targetSteps;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / magnitude;
    let nice;
    if (norm < 1.5) nice = 1;
    else if (norm < 3.5) nice = 2;
    else if (norm < 7.5) nice = 5;
    else nice = 10;
    return nice * magnitude;
  }
  const yStep = pickStep(yRange);
  const yTicks = [];
  const firstTick = Math.ceil(yLo / yStep) * yStep;
  for (let v = firstTick; v <= yHi; v += yStep) {
    yTicks.push(v);
  }

  // ── X-axis: subsample date labels so we never draw more than ~7 ──────
  const MAX_X_LABELS = 7;
  const step = Math.max(1, Math.ceil(pts.length / MAX_X_LABELS));
  const showXLabel = i => i === 0 || i === pts.length - 1 || i % step === 0;

  // ── Price labels above the line: only on KEY points (first, last,
  // absolute min, absolute max, plus any point that starts a new run
  // of a different price). Skips clutter of a label on every dot.
  const minIdx = prices.indexOf(minP);
  const maxIdx = prices.indexOf(maxP);
  const keyIdxs = new Set([0, prices.length - 1, minIdx, maxIdx]);
  // Also flag "price changed vs previous" points — that's the informative
  // moment. Filter later to avoid crowding by minimum-distance gate.
  const changeIdxs = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] !== prices[i - 1]) changeIdxs.push(i);
  }
  // Add change points until we've got ~6 labels total.
  for (const idx of changeIdxs) {
    if (keyIdxs.size >= 6) break;
    keyIdxs.add(idx);
  }
  // Anti-overlap gate: if two label indexes are visually within 60 SVG-units
  // on the X axis (roughly one label width), drop the later one.
  const sortedKeys = [...keyIdxs].sort((a, b) => a - b);
  const finalLabelIdxs = new Set();
  let lastX = -Infinity;
  for (const i of sortedKeys) {
    const x = pts[i]?.x ?? 0;
    if (x - lastX >= 60) {
      finalLabelIdxs.add(i);
      lastX = x;
    }
  }
  // Always guarantee first + last are labelled even if they collide with a
  // key point — the range endpoints anchor the reader.
  finalLabelIdxs.add(0);
  finalLabelIdxs.add(pts.length - 1);

  const firstDate = display[0]?.dateObj;
  const lastDate  = display[display.length - 1]?.dateObj;
  const fmt = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const rangeLabel = (firstDate && lastDate)
    ? (display.length === 1 ? fmt(firstDate) : `${fmt(firstDate)} – ${fmt(lastDate)}`)
    : '';

  return (
    <div>
      {/* HEADER: title + range on the left, min/max stats on the right */}
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
              {minP.toLocaleString('es-ES')} €
            </span>
          </div>
          <div>
            Máx: <span style={{ color:'#b91c1c', fontWeight:700, fontSize:13, fontFamily:'ui-monospace,monospace' }}>
              {maxP.toLocaleString('es-ES')} €
            </span>
          </div>
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.55)',
        border: '0.5px solid rgba(255,255,255,0.8)',
        borderRadius: 14,
        padding: '8px 4px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:260, overflow:'visible', display:'block' }}
             preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="hcg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines + labels */}
          {yTicks.map((v) => {
            const y = yOf(v);
            return (
              <g key={`y-${v}`}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={W - PAD_R}
                  y2={y}
                  stroke="rgba(29,29,31,0.07)"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
                <text
                  x={PAD_L - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="rgba(29,29,31,0.5)"
                  style={{ fontFamily: 'ui-monospace,monospace' }}
                >
                  {v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                </text>
              </g>
            );
          })}

          {/* Area fill + line */}
          {pts.length > 1 && <path d={area} fill="url(#hcg)" />}
          {pts.length > 1 && (
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points + labels */}
          {pts.map((p, i) => {
            const isKey = finalLabelIdxs.has(i);
            return (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isKey ? 4.5 : 3}
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth={isKey ? 2 : 1.5}
                />
                {isKey && (
                  <text
                    x={p.x}
                    y={p.y - 12}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="#1d1d1f"
                    style={{ fontFamily: 'ui-monospace,monospace' }}
                  >
                    {p.price.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €
                  </text>
                )}
                {showXLabel(i) && (
                  <text
                    x={p.x}
                    y={H - PAD_B + 18}
                    textAnchor="middle"
                    fontSize="11"
                    fill="rgba(29,29,31,0.55)"
                    style={{ fontWeight: 500 }}
                  >
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
