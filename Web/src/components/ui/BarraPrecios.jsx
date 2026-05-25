import Dot from './Dot';
import { TIENDAS } from '../shared/constants';
import { getMejor, getPriceValue } from '../shared/utils';

export default function BarraPrecios({ precios, statuses }) {
  const v = Object.values(precios || {}).map(getPriceValue).filter(Boolean);
  const maxP = v.length ? Math.max(...v) : 1;
  const [mejId] = getMejor(precios);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {TIENDAS.filter(t => getPriceValue(precios[t.id]) != null || statuses?.[t.id] === 'loading').map(t => {
        const p = getPriceValue(precios[t.id]);
        const st = statuses?.[t.id];
        const pct = p ? Math.round((p / maxP) * 100) : 0;
        const es = t.id === mejId;
        return (
          <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Dot status={st} />
            <span style={{ width:100, fontSize:11, color:'rgba(29,29,31,0.6)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {t.nombre}
            </span>
            <div style={{ flex:1, background:'rgba(0,0,0,0.06)', borderRadius:980, height:6 }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: es ? 'linear-gradient(90deg,#10b981,#34d399)' : 'rgba(29,29,31,0.25)',
                borderRadius: 980,
                transition: 'width .5s ease',
              }} />
            </div>
            <span style={{
              width: 64,
              fontSize: 12,
              fontWeight: es ? 500 : 400,
              color: es ? '#047857' : 'rgba(29,29,31,0.7)',
              textAlign: 'right',
              letterSpacing: -0.2,
            }}>
              {st === 'loading' ? '—' : st === 'error' ? 'Err' : p ? `${p.toLocaleString('es-ES')} €` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
