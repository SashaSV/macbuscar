'use client';
import { useState } from 'react';

export default function Galeria({ fotos, labels, emoji }) {
  const [idx, setIdx] = useState(0);
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ height:190, borderRadius:14, background:fotos[idx], transition:'background .4s', display:'flex', alignItems:'center', justifyContent:'center', fontSize:68, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,.05),transparent 60%)' }} />
        <span style={{ filter:'drop-shadow(0 6px 24px rgba(0,0,0,.6))' }}>{emoji}</span>
        <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
          {fotos.map((_,i) => <div key={i} onClick={e=>{e.stopPropagation();setIdx(i);}} style={{ width:i===idx?18:6, height:6, borderRadius:3, background:i===idx?'#fff':'rgba(255,255,255,.3)', transition:'all .3s', cursor:'pointer' }} />)}
        </div>
      </div>
      <div style={{ display:'flex', gap:7, marginTop:8 }}>
        {fotos.map((c,i) => <div key={i} onClick={e=>{e.stopPropagation();setIdx(i);}} style={{ flex:1, height:32, borderRadius:8, background:c, border:`2px solid ${i===idx?'#fff':'transparent'}`, cursor:'pointer', transition:'all .25s' }} />)}
      </div>
      {labels && <div style={{ textAlign:'center', fontSize:11, color:'#555', marginTop:4 }}>{labels[idx]}</div>}
    </div>
  );
}
