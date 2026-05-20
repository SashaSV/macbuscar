import { useState, useRef } from 'react';
import { PRODUCTOS, ESTADOS_BU } from '../data';

export default function ModalAnuncio({ productoId, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    productoId: productoId || '',
    precio: '',
    estado: 'Excelente',
    ciudad: '',
    vendedor: '',
    descripcion: '',
    fotos: [],       // base64 strings o URLs
  });
  const [urlInput, setUrlInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* ── FOTO: subir desde disco ── */
  function handleFiles(files) {
    Array.from(files).slice(0, 5).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => {
        setForm(f => ({
          ...f,
          fotos: f.fotos.length < 5 ? [...f.fotos, e.target.result] : f.fotos,
        }));
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── FOTO: agregar URL ── */
  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    if (form.fotos.length >= 5) return;
    setForm(f => ({ ...f, fotos: [...f.fotos, url] }));
    setUrlInput('');
  }

  function removePhoto(i) {
    setForm(f => ({ ...f, fotos: f.fotos.filter((_, idx) => idx !== i) }));
  }

  function guardar() {
    if (!form.productoId || !form.precio || !form.ciudad || !form.vendedor) return;
    const hoy = new Date();
    onGuardar({
      id: 'bu' + Date.now(),
      productoId: Number(form.productoId),
      precio: Number(form.precio),
      estado: form.estado,
      ciudad: form.ciudad,
      vendedor: form.vendedor,
      descripcion: form.descripcion,
      fotos: form.fotos,
      fecha: `${hoy.getDate().toString().padStart(2, '0')}/${(hoy.getMonth() + 1).toString().padStart(2, '0')}/${hoy.getFullYear()}`,
    });
  }

  const inpStyle = {
    flex: 1, background: '#0d0d0d', border: '1px solid #2a2a2a',
    borderRadius: 9, padding: '9px 12px', color: '#f0f0f0',
    fontSize: 13, outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.93)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 20, padding: 26, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Publicar anuncio</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Segunda mano · Manzana.es</div>
          </div>
          <button onClick={onCerrar} style={{ background: '#1e1e1e', border: 'none', color: '#666', fontSize: 17, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Producto */}
          <select value={form.productoId} onChange={e => set('productoId', e.target.value)}
            style={{ ...inpStyle, color: form.productoId ? '#f0f0f0' : '#555' }}>
            <option value="" disabled>Selecciona el producto…</option>
            {PRODUCTOS.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
          </select>

          {/* Precio + Estado */}
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="number" placeholder="Precio (€)" value={form.precio} onChange={e => set('precio', e.target.value)} style={inpStyle} />
            <select value={form.estado} onChange={e => set('estado', e.target.value)} style={{ ...inpStyle, flex: 1 }}>
              {ESTADOS_BU.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>

          {/* Ciudad + Vendedor */}
          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder="Ciudad" value={form.ciudad} onChange={e => set('ciudad', e.target.value)} style={inpStyle} />
            <input placeholder="Tu nombre" value={form.vendedor} onChange={e => set('vendedor', e.target.value)} style={inpStyle} />
          </div>

          {/* Descripción */}
          <textarea placeholder="Descripción (estado, accesorios incluidos…)" value={form.descripcion}
            onChange={e => set('descripcion', e.target.value)} rows={3}
            style={{ ...inpStyle, resize: 'none' }} />

          {/* ── FOTOS ── */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8 }}>
              Fotos <span style={{ color: '#444', fontWeight: 400 }}>({form.fotos.length}/5)</span>
            </div>

            {/* Drag & drop zone */}
            {form.fotos.length < 5 && (
              <div
                onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                style={{
                  border: `2px dashed ${dragOver ? '#2563eb' : '#2a2a2a'}`,
                  borderRadius: 12,
                  padding: '20px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? '#0d1a2e' : '#0d0d0d',
                  transition: 'all .2s',
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: dragOver ? '#60a5fa' : '#555' }}>
                  Arrastra fotos aquí o pulsa para seleccionar
                </div>
                <div style={{ fontSize: 11, color: '#333', marginTop: 3 }}>JPG, PNG, WEBP · Máx 5 fotos</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => handleFiles(e.target.files)}
                />
              </div>
            )}

            {/* URL input */}
            {form.fotos.length < 5 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addUrl()}
                  placeholder="O pega una URL de imagen…"
                  style={{ ...inpStyle, fontSize: 12 }}
                />
                <button onClick={addUrl} disabled={!urlInput.trim() || form.fotos.length >= 5}
                  style={{ background: '#1e3a5f', border: '1px solid #2563eb', borderRadius: 9, padding: '0 14px', color: '#60a5fa', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  + Añadir
                </button>
              </div>
            )}

            {/* Previews */}
            {form.fotos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {form.fotos.map((src, i) => (
                  <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2a2a' }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; e.target.parentNode.style.background = '#1e1e1e'; }} />
                    <button
                      onClick={() => removePhoto(i)}
                      style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,.8)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                      ✕
                    </button>
                    {i === 0 && (
                      <div style={{ position: 'absolute', bottom: 3, left: 3, background: 'rgba(0,0,0,.7)', borderRadius: 4, fontSize: 8, color: '#fff', padding: '1px 5px' }}>Principal</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <button onClick={guardar}
            disabled={!form.productoId || !form.precio || !form.ciudad || !form.vendedor}
            style={{
              marginTop: 4, padding: '13px',
              background: (!form.productoId || !form.precio || !form.ciudad || !form.vendedor)
                ? '#1a1a1a' : 'linear-gradient(90deg,#2563eb,#1d4ed8)',
              border: 'none', borderRadius: 11,
              color: (!form.productoId || !form.precio || !form.ciudad || !form.vendedor) ? '#444' : '#fff',
              fontSize: 14, fontWeight: 800,
              cursor: (!form.productoId || !form.precio || !form.ciudad || !form.vendedor) ? 'not-allowed' : 'pointer',
              transition: 'all .2s',
            }}>
            Publicar anuncio
          </button>
        </div>
      </div>
    </div>
  );
}
