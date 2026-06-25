'use client';
import { useState, useRef, useMemo, useEffect } from 'react';
import { ESTADOS } from '../shared/constants';

// Variant dimensions exposed as filter chips in the form. Mirrors
// ModalProducto's FILTER_FIELDS so the seller picks the SAME shape
// of configuration the buyer searches against — otherwise a Listing
// matched on (color, memory) could resolve to either 6.1" or 6.7"
// Plus on iPhone 16 and surface under the wrong product detail.
// 'cores' is intentionally omitted: it's a derived read-only display
// in ModalProducto, never a user-input dimension.
const FILTER_FIELDS = ['display', 'memory', 'ram', 'cpu', 'screen', 'bandSize', 'connectivity', 'color'];
const FILTER_LABELS = {
  display:      'Pantalla',
  memory:       'Almacenamiento',
  ram:          'Memoria RAM',
  cpu:          'Chip',
  screen:       'Acabado pantalla',
  bandSize:     'Tamaño',
  connectivity: 'Conectividad',
  color:        'Color',
};

// PRIMARY dimensions per category. Render order in the form follows
// ModalProducto's chip order — primary fields (the ones that define
// the model variant for that category) come first, secondary fields
// (color, finer specs) come after. Keeps the seller's flow identical
// to the buyer's: pick the model first, customise details after.
const PRIMARY_BY_CAT = {
  mac:     ['display', 'cpu', 'memory'],
  iphone:  ['display', 'memory'],
  ipad:    ['display', 'memory'],
  watch:   ['bandSize', 'connectivity'],
  airpods: [],
};

// Sort helpers used to put chip values in the same order ModalProducto
// uses, so the buyer never sees "512GB, 256GB, 128GB" next to "128GB,
// 256GB, 512GB" between the listing and the price modal.
function sizeToBytes(s) {
  if (!s) return Infinity;
  const m = String(s).match(/(\d+(?:[.,]\d+)?)\s*(GB|TB|MB)/i);
  if (!m) return Infinity;
  const n = parseFloat(m[1].replace(',', '.'));
  const unit = m[2].toUpperCase();
  const mult = unit === 'TB' ? 1024 ** 4 : unit === 'GB' ? 1024 ** 3 : 1024 ** 2;
  return n * mult;
}
function inchesOf(s) {
  if (!s) return Infinity;
  const m = String(s).match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : Infinity;
}

export default function ModalAnuncio({ productoId, productos, onGuardar, onCerrar }) {
  const [form, setForm] = useState({ productoId: productoId || '', precio:'', estado:'Excelente', ciudad:'', vendedor:'', descripcion:'', telefono:'' });
  // Generic per-field selection map. Populated lazily as we learn which
  // dimensions the current product actually varies on.
  const [selected, setSelected] = useState({});
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

  // For each filter dimension, collect the distinct values the product
  // ACTUALLY varies on, sorted the same way ModalProducto sorts them:
  //   memory / ram   → by storage size (128GB < 256GB < 1TB < 2TB)
  //   display        → by screen inches (6.1" < 6.7")
  //   bandSize       → by mm (42mm < 45mm < 49mm)
  //   everything else → by cheapest-variant price (so the entry-level
  //     colour/chip lands first, matching the modal)
  // Dimensions with ≤1 value are skipped — if every variant of an
  // iPhone has the same RAM, showing a RAM picker would just clutter
  // the form.
  const variantOptions = useMemo(() => {
    const minPriceForValue = (field, value) => {
      let best = Infinity;
      for (const v of variants) {
        if (v[field] !== value) continue;
        for (const pr of (v.prices || [])) {
          if (pr.price > 0 && pr.price < best) best = pr.price;
        }
      }
      return best;
    };
    const opts = {};
    for (const field of FILTER_FIELDS) {
      const values = [...new Set(variants.map(v => v[field]).filter(Boolean))];
      if (values.length <= 1) continue;
      let sorted;
      if (field === 'memory' || field === 'ram') {
        sorted = values.sort((a, b) => sizeToBytes(a) - sizeToBytes(b));
      } else if (field === 'display' || field === 'bandSize') {
        sorted = values.sort((a, b) => inchesOf(a) - inchesOf(b));
      } else {
        sorted = values.sort((a, b) => minPriceForValue(field, a) - minPriceForValue(field, b));
      }
      opts[field] = sorted;
    }
    return opts;
  }, [variants]);

  // Render order for chip rows: primary dimensions for this category
  // first, then any remaining secondary dimensions in FILTER_FIELDS
  // order. Mirrors ModalProducto's primary/secondary split so the
  // seller's flow matches the buyer's. We fall back to ['display',
  // 'memory'] for unknown categories — a safe default that covers
  // anything phone-like.
  const orderedFields = useMemo(() => {
    const primary = PRIMARY_BY_CAT[producto?.cat] || ['display', 'memory'];
    const present = Object.keys(variantOptions);
    const primarySet = new Set(primary);
    const primaryPresent = primary.filter(f => present.includes(f));
    const secondaryPresent = FILTER_FIELDS.filter(f =>
      present.includes(f) && !primarySet.has(f)
    );
    return [...primaryPresent, ...secondaryPresent];
  }, [variantOptions, producto?.cat]);

  // Resolve the variant matching ALL active selections. Skips any
  // dimension the user hasn't selected yet so an in-progress form
  // doesn't return null mid-pick.
  const selectedVariant = useMemo(() => {
    if (!variants.length) return null;
    if (variants.length === 1) return variants[0];
    return variants.find(v =>
      Object.entries(selected).every(([k, val]) => !val || v[k] === val)
    ) || null;
  }, [variants, selected]);

  // When the product changes, seed selectors with the first variant's
  // traits across every dimension this product varies on. Lands the
  // form on a real, sellable configuration instead of an empty state.
  useEffect(() => {
    if (!variants.length) { setSelected({}); return; }
    const first = variants[0];
    const init = {};
    for (const field of Object.keys(variantOptions)) {
      if (first[field]) init[field] = first[field];
    }
    setSelected(init);
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
      if (form.telefono.trim()) fd.append('telefono', form.telefono.trim());

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

          {/* VARIANT SELECTORS — every dimension this product varies on,
              in PRIMARY_BY_CAT order (primary first, secondary after).
              Mirrors the chip layout in ModalProducto so the seller's
              mental model matches the buyer's. Hidden when the product
              has only one variant (or no variants at all). */}
          {producto && orderedFields.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orderedFields.map(field => {
                const options = variantOptions[field];
                const label = FILTER_LABELS[field] || field;
                return (
                  <div key={field}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(29,29,31,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {label}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {options.map(val => {
                        const active = selected[field] === val;
                        // Color gets a swatch dot; everything else is a
                        // plain text chip. We resolve colorHex from a
                        // variant that has this value (any of them will
                        // do — hex is determined by the color name).
                        if (field === 'color') {
                          const hex = variants.find(v => v.color === val)?.colorHex || '#cccccc';
                          return (
                            <button
                              key={val}
                              onClick={() => setSelected(s => ({ ...s, [field]: val }))}
                              title={val}
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
                              {val}
                            </button>
                          );
                        }
                        return (
                          <button
                            key={val}
                            onClick={() => setSelected(s => ({ ...s, [field]: val }))}
                            style={{
                              padding: '6px 12px',
                              background: active ? 'rgba(29,29,31,0.85)' : 'rgba(255,255,255,0.6)',
                              color: active ? '#fff' : '#1d1d1f',
                              border: `1px solid ${active ? 'rgba(29,29,31,0.85)' : 'rgba(0,0,0,0.1)'}`,
                              borderRadius: 980, cursor: 'pointer',
                              fontSize: 11, fontWeight: 500, transition: 'all .15s',
                            }}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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

          {/* Phone is optional but strongly recommended — listings without
              one fall back to a generic "contacta por el formulario" line
              in the buyer's UI, which converts much worse. Stored
              encrypted at rest, only revealed via the phone-view
              endpoint so scrapers can't sweep numbers from public JSON. */}
          <input
            type="tel"
            placeholder="Teléfono de contacto (opcional)"
            value={form.telefono}
            onChange={e => set('telefono', e.target.value)}
            style={{ ...inp }}
            autoComplete="tel"
          />

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
