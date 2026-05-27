'use client';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cookieConsent';
const VERSION = '1'; // bump to force re-prompt after policy changes

/**
 * Cookie Consent Banner (RGPD + LSSI compliant)
 *
 * Categories:
 *  - necessary: always on (cookieConsent itself)
 *  - analytics: GA4 etc — opt-in
 *  - affiliate: Amazon/Apple/etc affiliate tracking — opt-in
 *
 * Reads/writes localStorage.cookieConsent = { v, ts, necessary, analytics, affiliate }
 *
 * Usage in layout.js:
 *   import CookieConsent from '@/components/legal/CookieConsent';
 *   <CookieConsent />
 *
 * Reopen from footer:
 *   <button onClick={() => window.dispatchEvent(new Event('openCookieSettings'))}>
 *     Gestionar cookies
 *   </button>
 */
export default function CookieConsent() {
  const [visible, setVisible]   = useState(false);
  const [showPanel, setPanel]   = useState(false);
  const [prefs, setPrefs]       = useState({
    necessary: true,
    analytics: false,
    affiliate: false,
  });

  // Read stored consent on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored.v === VERSION) {
          setPrefs(stored);
          applyConsent(stored);
          return; // already consented
        }
      }
    } catch {}
    // first visit or version bump
    setVisible(true);
  }, []);

  // Listen for "open settings" event from footer
  useEffect(() => {
    const open = () => { setPanel(true); setVisible(true); };
    window.addEventListener('openCookieSettings', open);
    return () => window.removeEventListener('openCookieSettings', open);
  }, []);

  const save = (next) => {
    const payload = { v: VERSION, ts: Date.now(), ...next };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
    applyConsent(payload);
    setVisible(false);
    setPanel(false);
  };

  const acceptAll = () => save({ necessary: true, analytics: true, affiliate: true });
  const rejectAll = () => save({ necessary: true, analytics: false, affiliate: false });
  const saveCustom = () => save(prefs);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop only when settings panel is open */}
      {showPanel && (
        <div
          onClick={() => setPanel(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 9998,
          }}
        />
      )}

      <div style={{
        position: 'fixed',
        left: 16, right: 16, bottom: 16,
        maxWidth: 540,
        margin: '0 auto',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        border: '0.5px solid rgba(255,255,255,0.8)',
        borderRadius: 18,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 16px 50px rgba(0,0,0,0.18)',
        padding: 20,
        color: '#1d1d1f',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        fontSize: 13,
        lineHeight: 1.55,
        zIndex: 9999,
      }}>
        {!showPanel ? (
          /* ── Main banner ── */
          <>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>
              🍪 Cookies en macbuscar.es
            </div>
            <p style={{ margin: '0 0 14px', color: 'rgba(29,29,31,0.75)' }}>
              Usamos cookies propias y de terceros para analizar el uso del sitio y atribuir
              comisiones de afiliación. Puedes aceptar, rechazar o personalizar tu elección.
              Consulta nuestra <a href="/politica-cookies" style={linkStyle}>Política de Cookies</a>.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={acceptAll}  style={btnPrimary}>Aceptar todo</button>
              <button onClick={rejectAll}  style={btnSecondary}>Rechazar todo</button>
              <button onClick={() => setPanel(true)} style={btnGhost}>Personalizar</button>
            </div>
          </>
        ) : (
          /* ── Settings panel ── */
          <>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
              Preferencias de cookies
            </div>

            <CookieRow
              title="Necesarias"
              desc="Imprescindibles para el funcionamiento del sitio. Siempre activas."
              checked={true}
              disabled={true}
            />

            <CookieRow
              title="Analíticas"
              desc="Google Analytics 4 para medir visitas de forma agregada y anónima."
              checked={prefs.analytics}
              onChange={v => setPrefs(p => ({ ...p, analytics: v }))}
            />

            <CookieRow
              title="Afiliación"
              desc="Identifican que llegaste a una tienda desde macbuscar.es. No nos identifican personalmente."
              checked={prefs.affiliate}
              onChange={v => setPrefs(p => ({ ...p, affiliate: v }))}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={saveCustom} style={btnPrimary}>Guardar elección</button>
              <button onClick={acceptAll}  style={btnSecondary}>Aceptar todo</button>
              <button onClick={() => setPanel(false)} style={btnGhost}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Row ──────────────────────────────────────────
function CookieRow({ title, desc, checked, onChange, disabled }) {
  return (
    <label style={{
      display: 'flex', gap: 12, padding: '10px 0',
      borderTop: '1px solid rgba(0,0,0,0.06)',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.7 : 1,
    }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange && onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: '#1d1d1f' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'rgba(29,29,31,0.6)', lineHeight: 1.45 }}>{desc}</div>
      </div>
    </label>
  );
}

// ── Apply consent to GA/affiliate scripts ────────
function applyConsent(c) {
  if (typeof window === 'undefined') return;

  // Expose to global so analytics/affiliate scripts can check
  window.__consent = c;

  // Google Analytics consent mode v2
  if (window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage:  c.analytics ? 'granted' : 'denied',
      ad_storage:         'denied',
      ad_user_data:       'denied',
      ad_personalization: 'denied',
    });
  }

  // Dispatch event so other components can react
  window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: c }));
}

// ── Styles ───────────────────────────────────────
const btnBase = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 980,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all .15s',
  fontFamily: 'inherit',
};

const btnPrimary = {
  ...btnBase,
  background: '#1d1d1f',
  color: '#fff',
};

const btnSecondary = {
  ...btnBase,
  background: 'rgba(0,0,0,0.06)',
  color: '#1d1d1f',
};

const btnGhost = {
  ...btnBase,
  background: 'transparent',
  color: 'rgba(29,29,31,0.7)',
};

const linkStyle = {
  color: '#1d1d1f',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
};
