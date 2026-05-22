'use client';
import { useState, useRef } from 'react';
import { ESTADOS } from '../shared/constants';

export default function ModalAnuncio({ productoId, productos, onGuardar, onCerrar }) {
  const [form, setForm] = useState({ productoId: productoId||'', precio:'', estado:'Excelente', ciudad:'', vendedor:'', descripcion:'' });
  const [fotos, setFotos] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  function addFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/') || fotos.length >= 5) return;
      const src = URL.createObjectURL(file);
      setFotos(f => f.length < 5 ? [...f, { src, file }] : f);
    });
  }

  function addUrl() {
    const url = urlInput.trim();
    if (!url || fotos.length >= 5) return;
    setFotos(f => [...f, { src: url, file: null }]);
    setUrlInput('');
  }

  async function submit() {
    if (!form.productoId || !form.precio || !form.ciudad || !form.vendedor) { setError('Rellena todos los campos obligatorios.'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('productoId', form.productoId);
      fd.append('precio', form.precio);
      fd.append('estado', form.estado);
      fd.append('ciudad', form.ciudad);
      fd.append('vendedor', form.vendedor);
      fd.append('descripcion', form.descripcion);

      let urlIdx = 0;
      fotos.forEach(f => {
        if (f.file) fd.append('fotos', f.file);
        else { fd.append(`fotos_url_${urlIdx}`, f.src); urlIdx++; }
      });

      const res = await fetch('/api/listings', { method:'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al publicar');
      onGuardar(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  const inp = { background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:9, padding:'9px 12px', color:'#f0f0f0', fontSize:13, outline:'none', fontFamily:'inherit' };

  return (
    <div onClick={onCerrar} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.93)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#111', border:'1px solid #2a2a2a', borderRadius:20, padding:26, width:'100%', maxWidth:500, maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <div><div style={{ fontSize:16, fontWeight:800 }}>Publicar anuncio</div><div style={{ fontSize:11, color:'#555', marginTop:2 }}>Segunda mano · Manzana.es</div></div>
          <button onClick={onCerrar} style={{ background:'#1e1e1e', border:'none', color:'#666', fontSize:17, width:32, height:32, borderRadius:'50%', cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <select value={form.productoId} onChange={e=>set('productoId',e.target.value)} style={{ ...inp, color: form.productoId?'#f0f0f0':'#555' }}>
            <option value="" disabled>Selecciona el producto…</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
          </select>

          <div style={{ display:'flex', gap:9 }}>
            <input type="number" placeholder="Precio (€)" value={form.precio} onChange={e=>set('precio',e.target.value)} style={{ ...inp, flex:1 }} />
            <select value={form.estado} onChange={e=>set('estado',e.target.value)} style={{ ...inp, flex:1 }}>
              {ESTADOS.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>

          <div style={{ display:'flex', gap:9 }}>
            <input placeholder="Ciudad *" value={form.ciudad} onChange={e=>set('ciudad',e.target.value)} style={{ ...inp, flex:1 }} />
            <input placeholder="Tu nombre *" value={form.vendedor} onChange={e=>set('vendedor',e.target.value)} style={{ ...inp, flex:1 }} />
          </div>

          <textarea placeholder="Descripción (estado, accesorios…)" value={form.descripcion} onChange={e=>set('descripcion',e.target.value)} rows={3} style={{ ...inp, resize:'none' }} />

          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#777', marginBottom:7 }}>Fotos <span style={{ color:'#444', fontWeight:400 }}>({fotos.length}/5)</span></div>

            {fotos.length < 5 && (
              <div onClick={() => fileRef.current.click()}
                onDragOver={e=>{e.preventDefault();setDragOver(true);}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);addFiles(e.dataTransfer.files);}}
                style={{ border:`2px dashed ${dragOver?'#2563eb':'#2a2a2a'}`, borderRadius:12, padding:'18px 14px', textAlign:'center', cursor:'pointer', background:dragOver?'#0d1a2e':'#0d0d0d', transition:'all .2s', marginBottom:8 }}>
                <div style={{ fontSize:26, marginBottom:5 }}>📷</div>
                <div style={{ fontSize:12, fontWeight:700, color:dragOver?'#60a5fa':'#555' }}>Arrastra fotos o pulsa para subir</div>
                <div style={{ fontSize:11, color:'#333', marginTop:2 }}>JPG · PNG · WEBP · máx 5 fotos · 5 MB c/u</div>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e=>addFiles(e.target.files)} />
              </div>
            )}

            {fotos.length < 5 && (
              <div style={{ display:'flex', gap:8, marginBottom:9 }}>
                <input value={urlInput} onChange={e=>setUrlInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addUrl()} placeholder="O pega una URL de imagen…" style={{ ...inp, flex:1, fontSize:12 }} />
                <button onClick={addUrl} disabled={!urlInput.trim()} style={{ background:'#1e3a5f', border:'1px solid #2563eb', borderRadius:9, padding:'0 13px', color:'#60a5fa', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>+ URL</button>
              </div>
            )}

            {fotos.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:4 }}>
                {fotos.map((f,i) => (
                  <div key={i} style={{ position:'relative', aspectRatio:'1', borderRadius:8, overflow:'hidden', border:'1px solid #2a2a2a' }}>
                    <img src={f.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.background='#1e1e1e'} />
                    <button onClick={()=>setFotos(fs=>fs.filter((_,j)=>j!==i))} style={{ position:'absolute', top:3, right:3, width:17, height:17, borderRadius:'50%', background:'rgba(0,0,0,.8)', border:'none', color:'#fff', fontSize:9, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                    {i===0 && <div style={{ position:'absolute', bottom:3, left:3, background:'rgba(0,0,0,.7)', borderRadius:4, fontSize:8, color:'#aaa', padding:'1px 5px' }}>Principal</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div style={{ fontSize:12, color:'#ff6b6b', background:'#1a0a0a', border:'1px solid #3a1a1a', borderRadius:8, padding:'8px 12px' }}>{error}</div>}

          <button onClick={submit} disabled={loading || !form.productoId || !form.precio || !form.ciudad || !form.vendedor}
            style={{ padding:'13px', background:loading?'#1a1a1a':'linear-gradient(90deg,#2563eb,#1d4ed8)', border:'none', borderRadius:11, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', transition:'all .2s' }}>
            {loading ? '⟳ Publicando…' : 'Publicar anuncio'}
          </button>
        </div>
      </div>
    </div>
  );
}
