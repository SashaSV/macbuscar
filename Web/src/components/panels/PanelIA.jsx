'use client';
import { useState } from 'react';

export default function PanelIA() {
  const [q,setQ]=useState('');
  const [loading,setLoading]=useState(false);
  const [ans,setAns]=useState('');
  const sugs=['¿Cuál iPhone tiene mejor cámara?','¿Vale la pena M4 vs M3?','¿Dónde comprar más barato?'];

  async function ask() {
    if(!q.trim()||loading) return;
    setLoading(true); setAns('');
    try {
      const r = await fetch('/api/ai', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:q}) });
      const d = await r.json();
      setAns(d.reply || 'Sin respuesta.');
    } catch { setAns('Error de conexión.'); }
    setLoading(false);
  }

  return (
    <div style={{ background:'linear-gradient(135deg,#0a0f1a,#0d1117)', border:'1px solid #1e3a5f', borderRadius:14, padding:'14px 18px', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:9 }}><span>🤖</span><span style={{ fontSize:11, fontWeight:800, color:'#60a5fa', letterSpacing:1.5 }}>ASISTENTE IA</span></div>
      <div style={{ display:'flex', gap:8, marginBottom:7 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ask()} placeholder="¿En qué te puedo ayudar?" style={{ flex:1, background:'#080d14', border:'1px solid #1e3a5f', borderRadius:9, padding:'8px 12px', color:'#f0f0f0', fontSize:12, outline:'none', fontFamily:'inherit' }} />
        <button onClick={ask} disabled={loading||!q.trim()} style={{ background:loading?'#1e3a5f':'#2563eb', border:'none', borderRadius:9, padding:'8px 13px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>{loading?'…':'Preguntar'}</button>
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{sugs.map(s=><button key={s} onClick={()=>setQ(s)} style={{ background:'#0d1a2e', border:'1px solid #1e3a5f', borderRadius:20, padding:'3px 9px', color:'#60a5fa', fontSize:10, cursor:'pointer' }}>{s}</button>)}</div>
      {ans&&<div style={{ marginTop:9, padding:'10px 12px', background:'#060a10', borderRadius:9, border:'1px solid #1e3a5f', fontSize:12, color:'#cbd5e1', lineHeight:1.6 }}>{ans}</div>}
    </div>
  );
}
