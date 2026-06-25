'use client';
// ListingCard — 2ª mano ad detail card used in the modal's 2ª mano
// tab. Renders price, condition, photos, description, and a phone
// reveal button that lazy-fetches the number from
// POST /api/listings/[id]/phone-view (which also bumps phoneViews,
// the conversion metric we surface as "X interesados").
//
// Two design points worth flagging because they're easy to break:
//
// 1. The phone is NEVER in the product payload — the page can't
//    reveal it just by reading state. Clicking "Mostrar teléfono"
//    is what fetches it. That's also what makes phoneViews a real
//    intent signal instead of an impressions counter.
//
// 2. Relative-time labels ("hace 3 horas") are computed at render
//    time off createdAt — no useEffect, no setInterval. The card
//    re-renders whenever the modal does (filter pick, tab switch),
//    which is frequent enough that nobody sees a stale "hace 1 min"
//    that should already be "hace 5 min". A live ticker would cost
//    a re-render every minute on a tab the user may not be looking
//    at — not worth the wakeups.

import { useState } from 'react';
import { colorEstado } from '../shared/utils';
import { isStaleListing, listingAgeDays, HIDE_AFTER_DAYS } from '../shared/listingLifecycle';

// Spanish relative-time formatter. Uses Intl.RelativeTimeFormat so
// pluralisation ("hace 1 minuto" vs "hace 5 minutos") comes from the
// platform's CLDR data instead of hand-rolled logic. Picks the
// largest unit that has a non-zero count — "hace 2 horas" not
// "hace 7400 segundos".
function formatRelativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((then - Date.now()) / 1000);  // negative for past
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });
  if (abs < 60)       return rtf.format(Math.round(diffSec),         'second');
  if (abs < 3600)     return rtf.format(Math.round(diffSec / 60),    'minute');
  if (abs < 86400)    return rtf.format(Math.round(diffSec / 3600),  'hour');
  if (abs < 2592000)  return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month');
  return rtf.format(Math.round(diffSec / 31536000), 'year');
}

export default function ListingCard({ a }) {
  // Local reveal state. We hold the fetched number in state so a
  // second click instantly toggles back to masked without another
  // round-trip — the increment fires only on the first reveal.
  const [phone, setPhone]     = useState(null);    // string once revealed
  const [revealed, setRevealed] = useState(false); // toggles visibility
  const [loading, setLoading] = useState(false);
  const [phoneViews, setPhoneViews] = useState(a.phoneViews ?? 0);

  async function toggleReveal() {
    if (revealed) {
      setRevealed(false);
      return;
    }
    // Already fetched once in this session — just unhide it, don't
    // bump the counter again. Idempotent reveal for the same user.
    if (phone !== null) {
      setRevealed(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/listings/${a.id}/phone-view`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setPhone(data.telefono || '');
      setPhoneViews(data.phoneViews ?? phoneViews + 1);
      setRevealed(true);
    } catch (err) {
      // Fail silently into a generic state — telling the user
      // "couldn't fetch number" doesn't help them and a retry is
      // one click away.
      setPhone('');
      setRevealed(true);
    } finally {
      setLoading(false);
    }
  }

  const hasPhone = phone === null ? true : phone.length > 0;
  const buttonLabel = loading
    ? 'Cargando…'
    : revealed
      ? (hasPhone ? 'Ocultar teléfono' : 'Sin teléfono')
      : 'Mostrar teléfono';

  return (
    <div style={{
      background: 'rgba(0,0,0,0.02)',
      border: '1px solid rgba(0,0,0,0.06)',
      borderRadius: 12, padding: '13px 15px', marginBottom: 9,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#f5a623', fontFamily: 'ui-monospace,monospace' }}>{a.precio}€</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Stale-listing chip — surfaces between day 21 and the
              hide threshold (currently 30) so the buyer knows to
              double-check availability with the seller and the
              seller has a window to repost if the item is still on
              offer. Hidden once the API stops returning the listing.
              Tooltip explains the threshold in plain Spanish. */}
          {isStaleListing(a.createdAt) && (
            <span
              title={`Publicado hace ${listingAgeDays(a.createdAt)} días. Verifica disponibilidad con el vendedor antes de comprar.`}
              style={{
                background: 'rgba(245,158,11,0.18)',
                color: '#b45309',
                fontSize: 10, fontWeight: 700,
                padding: '2px 8px', borderRadius: 20,
                letterSpacing: 0.3, textTransform: 'uppercase',
                cursor: 'help',
              }}
            >
              ⚠ Antiguo
            </span>
          )}
          <span style={{ background: colorEstado(a.estado) + '22', color: colorEstado(a.estado), fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20 }}>{a.estado}</span>
        </div>
      </div>

      {/* SKU traits as chips — mirrors the filter chips on the Precios
          tab so the buyer reads the listing in the same language used
          to compare new prices above. Color gets its swatch dot;
          everything else is a plain text chip. Omitted entirely on
          variants that don't carry traits (e.g. base-model AirPods). */}
      {a.variant && (() => {
        const v = a.variant;
        const chips = [
          v.memory       && { label: v.memory },
          v.ram          && { label: v.ram },
          v.cpu          && { label: v.cpu },
          v.display      && { label: v.display },
          v.screen       && { label: v.screen },
          v.bandSize     && { label: v.bandSize },
          v.connectivity && { label: v.connectivity },
          v.color        && { label: v.color, swatch: v.colorHex || '#cccccc' },
        ].filter(Boolean);
        if (!chips.length) return null;
        return (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 5,
            marginBottom: a.fotos?.length > 0 || a.descripcion ? 9 : 0,
          }}>
            {chips.map((c, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: c.swatch ? 6 : 0,
                padding: c.swatch ? '3px 9px 3px 4px' : '3px 9px',
                background: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 980,
                fontSize: 10, fontWeight: 500, color: '#1d1d1f',
                whiteSpace: 'nowrap',
              }}>
                {c.swatch && (
                  <span style={{
                    width: 13, height: 13, borderRadius: '50%',
                    background: c.swatch,
                    border: '1px solid rgba(0,0,0,0.15)',
                    display: 'inline-block',
                  }} />
                )}
                {c.label}
              </span>
            ))}
          </div>
        );
      })()}
      {a.fotos?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto' }}>
          {a.fotos.map((src, i) => (
            <img key={i} src={src} alt="" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }} />
          ))}
        </div>
      )}
      {a.descripcion && (
        <div style={{ fontSize: 12, color: 'rgba(29,29,31,0.7)', lineHeight: 1.5, marginBottom: 7 }}>{a.descripcion}</div>
      )}

      {/* Phone reveal — full-width pill that flips between masked
          and unmasked. Sits above the meta row because contact
          conversion is the primary action on the card. */}
      <button
        onClick={toggleReveal}
        disabled={loading}
        style={{
          width: '100%',
          marginBottom: 9,
          padding: '9px 12px',
          background: revealed && hasPhone ? 'rgba(52,168,83,0.12)' : 'rgba(245,158,11,0.10)',
          border: `1px solid ${revealed && hasPhone ? 'rgba(52,168,83,0.30)' : 'rgba(245,158,11,0.30)'}`,
          borderRadius: 10,
          color: revealed && hasPhone ? '#15803d' : '#b45309',
          fontSize: 12,
          fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontFamily: 'ui-monospace,monospace',
          letterSpacing: 0.3,
          transition: 'all .15s',
        }}
      >
        <span aria-hidden="true">{revealed && hasPhone ? '☎' : '☏'}</span>
        {revealed && hasPhone ? phone : buttonLabel}
      </button>

      {/* Meta row — seller, city, when posted, reveal counter.
          Phone-view count is a soft social-proof cue: a listing
          with 23 interested buyers reads as more "active" than
          one with 1, even if both are equally available. */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'rgba(29,29,31,0.4)', flexWrap: 'wrap' }}>
        <span>👤 {a.vendedor}</span>
        <span>📍 {a.ciudad}</span>
        <span title={new Date(a.createdAt).toLocaleString('es-ES')}>
          🕒 {formatRelativeTime(a.createdAt)}
        </span>
        {phoneViews > 0 && (
          <span title="Personas que han visto el teléfono">
            👁 {phoneViews} {phoneViews === 1 ? 'interesado' : 'interesados'}
          </span>
        )}
      </div>
    </div>
  );
}
