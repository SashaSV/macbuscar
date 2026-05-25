'use client';
import { useState } from 'react';

export default function Galeria({ fotos, labels, emoji }) {
  const [idx, setIdx] = useState(0);
  if (!fotos || !fotos.length) return null;

  const current = fotos[idx];
  // Real image URL or colored placeholder
  const isUrl = typeof current === 'string' && current.startsWith('http');

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        height: 200,
        borderRadius: 18,
        background: isUrl ? '#fff' : (current || '#f5f5f7'),
        transition: 'background .4s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        border: '0.5px solid rgba(255,255,255,0.7)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
      }}>
        {isUrl ? (
          <img src={current} alt={labels?.[idx] || ''} style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: 80, filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.1))' }}>{emoji || '📦'}</span>
        )}

        {fotos.length > 1 && (
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
            {fotos.map((_, i) => (
              <div
                key={i}
                onClick={e => { e.stopPropagation(); setIdx(i); }}
                style={{
                  width: i === idx ? 22 : 6,
                  height: 6,
                  borderRadius: 980,
                  background: i === idx ? '#1d1d1f' : 'rgba(29,29,31,0.3)',
                  transition: 'all .3s',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {fotos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {fotos.map((c, i) => {
            const thumbIsUrl = typeof c === 'string' && c.startsWith('http');
            return (
              <div
                key={i}
                onClick={e => { e.stopPropagation(); setIdx(i); }}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  background: thumbIsUrl ? '#fff' : (c || '#f5f5f7'),
                  border: `2px solid ${i === idx ? '#1d1d1f' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all .25s',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {thumbIsUrl && <img src={c} alt="" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />}
              </div>
            );
          })}
        </div>
      )}

      {labels && labels[idx] && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(29,29,31,0.5)', marginTop: 6 }}>{labels[idx]}</div>
      )}
    </div>
  );
}
