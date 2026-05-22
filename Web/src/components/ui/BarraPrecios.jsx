import Dot from './Dot';
import { TIENDAS } from '../shared/constants';
import { getMejor, getPriceValue } from '../shared/utils';

export default function BarraPrecios({ precios, statuses }) {
  const v = Object.values(precios||{}).map(getPriceValue).filter(Boolean);
  const maxP = v.length ? Math.max(...v) : 1;
  const [mejId] = getMejor(precios);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      {TIENDAS.filter(t => getPriceValue(precios[t.id]) != null || statuses?.[t.id]==='loading').map(t => {
        const p = getPriceValue(precios[t.id]); const st = statuses?.[t.id];
        const pct = p ? Math.round((p/maxP)*100) : 0;
        const es = t.id === mejId;
        return (
          <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Dot status={st} />
            <span style={{ width:90, fontSize:11, color:'#555', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.nombre}</span>
            <div style={{ flex:1, background:'#1c1c1e', borderRadius:3, height:7 }}>
              <div style={{ width:`${pct}%`, height:'100%', background:es?'#34c759':'#2c2c2e', borderRadius:3, transition:'width .5s ease' }} />
            </div>
            <span style={{ width:58, fontSize:12, fontWeight:es?800:400, color:es?'#34c759':'#666', textAlign:'right', fontFamily:'ui-monospace,monospace' }}>
              {st==='loading'?'—':st==='error'?'Err':p?`${p}€`:'—'}{es?' ✓':''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
