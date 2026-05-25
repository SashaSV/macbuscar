'use client';
import { useState } from 'react';

export default function PanelIA() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [ans, setAns] = useState('');
  const sugs = [
    '¿Cuál iPhone tiene mejor cámara?',
    '¿Vale la pena M4 vs M3?',
    '¿Dónde comprar más barato?'
  ];

  async function ask() {
    if (!q.trim() || loading) return;
    setLoading(true); setAns('');
    try {
      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const d = await r.json();
      setAns(d.reply || 'Sin respuesta.');
    } catch {
      setAns('Error de conexión.');
    }
    setLoading(false);
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(30px) saturate(180%)',
      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      border: '0.5px solid rgba(255,255,255,0.8)',
      borderRadius: 18,
      padding: '14px 18px',
      marginBottom: 18,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <i className="ti ti-sparkles" aria-hidden="true" style={{ fontSize: 16, color: '#7c3aed' }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: '#7c3aed', letterSpacing: 1.2 }}>ASISTENTE IA</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="¿En qué te puedo ayudar?"
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.6)',
            border: '0.5px solid rgba(255,255,255,0.9)',
            borderRadius: 980,
            padding: '8px 14px',
            color: '#1d1d1f',
            fontSize: 12,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={ask}
          disabled={loading || !q.trim()}
          style={{
            background: loading ? 'rgba(168,85,247,0.4)' : 'rgba(168,85,247,0.9)',
            border: 'none',
            borderRadius: 980,
            padding: '8px 16px',
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            cursor: loading || !q.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {loading ? <i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} /> : 'Preguntar'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {sugs.map(s => (
          <button
            key={s}
            onClick={() => setQ(s)}
            style={{
              background: 'rgba(168,85,247,0.1)',
              border: '0.5px solid rgba(168,85,247,0.25)',
              borderRadius: 980,
              padding: '4px 11px',
              color: '#7c3aed',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>
      {ans && (
        <div style={{
          marginTop: 10,
          padding: '11px 14px',
          background: 'rgba(255,255,255,0.55)',
          border: '0.5px solid rgba(255,255,255,0.9)',
          borderRadius: 12,
          fontSize: 12,
          color: '#1d1d1f',
          lineHeight: 1.6,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
        }}>
          {ans}
        </div>
      )}
    </div>
  );
}
