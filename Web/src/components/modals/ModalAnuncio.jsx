'use client';
import { useState, useRef, useMemo, useEffect } from 'react';
import { ESTADOS } from '../shared/constants';

export default function ModalAnuncio({ productoId, productos, onGuardar, onCerrar }) {
  const [form, setForm] = useState({ productoId: productoId || '', precio:'', estado:'Excelente', ciudad:'', vendedor:'', descripcion:'' });
  const [selected, setSelected] = useState({ color: '', memory: '' }); // variant filters
  const [fotos, setFotos] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Currently chosen product object (must contain a `.variants` array)
  const producto = useMemo(
    () => productos.find(p => String(p.id) === String(form.productoId)),
    [productos, form.productoId]
  );
  const variants = producto?.variants || [];

  // Available color / storage options (only show a selector when >1 value)
  const colorOptions = useMemo(
    () => [...new Set(variants.map(v => v.color).filter(Boolean))],
    [variants]
  );
  const memoryOptions = useMemo(
    () => [...new Set(variants.map(v => v.memory).filter(Boolean))],
    [variants]
  );

  // Resolve the variant matching the selected color + memory
  const selectedVariant = useMemo(() => {
    if (!variants.length) return null;
    // If there's only one variant, just use it.
    if (variants.length === 1) return variants[0];
    return variants.find(v =>
      (!colorOptions.length  || !selected.color  || v.color  === selected.color) &&
      (!memoryOptions.length || !selected.memory || v.memory === selected.memory)
    ) || null;
  }, [variants, selected, colorOptions, memoryOptions]);

  // When product changes, default selectors to the first variant's values
  useEffect(() => {
    if (!variants.length) { setSelected({ color: '', memory: '' }); return; }
    const first = variants[0];
    setSelected({
      color: colorOptions.length ? (first.color || '') : '',
      memory: memoryOptions.length ? (first.memory || '') : '',
    });
  }, [form.productoId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!form.productoId || !form.precio || !form.ciudad || !form.vendedor) {
      setError('Rellena todos los campos obligatorios.');
      return;
    }
    if (variants.length && !selectedVariant) {
      setError('Selecciona la configuración (color y almacenamiento).');
      return;
    }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('productoId', form.productoId);
      if (selectedVariant) fd.append('variantId', selectedVariant.id);
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

      const res = await fetch('/api/listings', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al publicar');
      onGuardar(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  const inp = {
    background: 'rgba(255,255,255,0.6)',
    border: '0.5px solid rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: '10px 14px',
    color: '#1d1d1f',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
  };

  return (
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(8px)',
        zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '0.5px solid rgba(255,255,255,0.9)',
          borderRadius: 26,
          padding: 26,
          width: '100%',
          maxWidth: 500,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 30px 80px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 500, color: '#1d1d1f', letterSpacing: -0.3 }}>Publicar anuncio</div>
            <div style={{ fontSize: 11, color: 'rgba(29,29,31,0.5)', marginTop: 2 }}>Segunda mano · Manzana.es</div>
          </div>
          <button
            onClick={onCerrar}
            style={{
              background: 'rgba(0,0,0,0.06)',
              border: '0.5px solid rgba(0,0,0,0.08)',
              borderRadius: 980,
              width: 32, height: 32,
              color: '#1d1d1f',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <i className="ti ti-x" aria-hidden="true" style={{ fontSize: 16 }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select
            value={form.productoId}
            onChange={e => set('productoId', e.target.value)}
            style={{ ...inp, color: form.productoId ? '#1d1d1f' : 'rgba(29,29,31,0.5)' }}
          >
            <option value="" disabled>Selecciona el producto…</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
          </select>

          {/* VARIANT SELECTORS — color + storage (only when product chosen & options exist) */}
          {producto && (colorOptions.length > 0 || memoryOptions.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Color */}
              {colorOptions.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(29,29,31,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Color
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {colorOptions.map(c => {
                      const active = selected.color === c;
                      const hex = variants.find(v => v.color === c)?.colorHex || '#cccccc';
                      return (
                        <button
                          key={c}
                          onClick={() => setSelected(s => ({ ...s, color: c }))}
                          title={c}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '5px 11px 5px 5px',
                            background: active ? 'rgba(29,29,31,0.85)' : 'rgba(255,255,255,0.6)',
                            color: active ? '#fff' : '#1d1d1f',
                            border: `1px solid ${active ? 'rgba(29,29,31,0.85)' : 'rgba(0,0,0,0.1)'}`,
                            borderRadius: 980, cursor: 'pointer',
                            fontSize: 11, fontWeight: 500, transition: 'all .15s',
                          }}
                        >
                          <span style={{
                            width: 16, height: 16, borderRadius: '50%',
                            background: hex,
                            border: '1px solid rgba(0,0,0,0.15)',
                            display: 'inline-block',
                          }} />
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Storage */}
              {memoryOptions.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(29,29,31,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Almacenamiento
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {memoryOptions.map(m => {
                      const active = selected.memory === m;
                      return (
                        <button
                          key={m}
                          onClick={() => setSelected(s => ({ ...s, memory: m }))}
                          style={{
                            padding: '6px 12px',
                            background: active ? 'rgba(29,29,31,0.85)' : 'rgba(255,255,255,0.6)',
                            color: active ? '#fff' : '#1d1d1f',
                            border: `1px solid ${active ? 'rgba(29,29,31,0.85)' : 'rgba(0,0,0,0.1)'}`,
                            borderRadius: 980, cursor: 'pointer',
                            fontSize: 11, fontWeight: 500, transition: 'all .15s',
                          }}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <input type="number" placeholder="Precio (€)" value={form.precio} onChange={e => set('precio', e.target.value)} style={{ ...inp, flex: 1 }} />
            <select value={form.estado} onChange={e => set('estado', e.target.value)} style={{ ...inp, flex: 1 }}>
              {ESTADOS.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder="Ciudad *" value={form.ciudad} onChange={e => set('ciudad', e.target.value)} style={{ ...inp, flex: 1 }} />
            <input placeholder="Tu nombre *" value={form.vendedor} onChange={e => set('vendedor', e.target.value)} style={{ ...inp, flex: 1 }} />
          </div>

          <textarea placeholder="Descripción (estado, accesorios…)" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3} style={{ ...inp, resize: 'none' }} />

          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(29,29,31,0.7)', marginBottom: 8 }}>
              Fotos <span style={{ color: 'rgba(29,29,31,0.4)', fontWeight: 400 }}>({fotos.length}/5)</span>
            </div>

            {fotos.length < 5 && (
              <div
                onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                style={{
                  border: `2px dashed ${dragOver ? '#7c3aed' : 'rgba(0,0,0,0.15)'}`,
                  borderRadius: 14,
                  padding: '18px 14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.4)',
                  transition: 'all .2s',
                  marginBottom: 8,
                }}
              >
                <i className="ti ti-camera" aria-hidden="true" style={{ fontSize: 28, color: dragOver ? '#7c3aed' : 'rgba(29,29,31,0.5)' }} />
                <div style={{ fontSize: 12, fontWeight: 500, color: dragOver ? '#7c3aed' : 'rgba(29,29,31,0.6)', marginTop: 4 }}>
                  Arrastra fotos o pulsa para subir
                </div>
                <div style={{ fontSize: 11, color: 'rgba(29,29,31,0.4)', marginTop: 2 }}>
                  JPG · PNG · WEBP · máx 5 fotos · 5 MB c/u
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
              </div>
            )}

            {fotos.length < 5 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 9 }}>
                <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addUrl()} placeholder="O pega una URL de imagen…" style={{ ...inp, flex: 1, fontSize: 12 }} />
                <button
                  onClick={addUrl}
                  disabled={!urlInput.trim()}
                  style={{
                    background: 'rgba(168,85,247,0.18)',
                    border: '0.5px solid rgba(168,85,247,0.4)',
                    borderRadius: 980,
                    padding: '0 14px',
                    color: '#7c3aed',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: urlInput.trim() ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + URL
                </button>
              </div>
            )}

            {fotos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 4 }}>
                {fotos.map((f, i) => (
                  <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '0.5px solid rgba(0,0,0,0.08)' }}>
                    <img src={f.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.background = 'rgba(0,0,0,0.05)'} />
                    <button
                      onClick={() => setFotos(fs => fs.filter((_, j) => j !== i))}
                      style={{
                        position: 'absolute', top: 3, right: 3,
                        width: 18, height: 18,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.7)',
                        border: 'none', color: '#fff',
                        fontSize: 9, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >✕</button>
                    {i === 0 && (
                      <div style={{
                        position: 'absolute', bottom: 3, left: 3,
                        background: 'rgba(0,0,0,0.7)',
                        borderRadius: 4,
                        fontSize: 8, color: '#fff',
                        padding: '1px 5px',
                      }}>Principal</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: '#b91c1c',
              background: 'rgba(239,68,68,0.1)',
              border: '0.5px solid rgba(239,68,68,0.3)',
              borderRadius: 10, padding: '8px 12px',
            }}>{error}</div>
          )}

          <button
            onClick={submit}
            disabled={loading || !form.productoId || !form.precio || !form.ciudad || !form.vendedor || (variants.length > 0 && !selectedVariant)}
            style={{
              padding: '13px',
              background: loading ? 'rgba(168,85,247,0.4)' : '#1d1d1f',
              border: 'none',
              borderRadius: 980,
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all .2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {loading ? <><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} /> Publicando…</> : 'Publicar anuncio'}
          </button>
        </div>
      </div>
    </div>
  );
}
