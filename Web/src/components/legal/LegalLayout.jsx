'use client';

export default function LegalLayout({ title, lastUpdated, children }) {
  return (
    <div style={{
      maxWidth: 820,
      margin: '60px auto',
      padding: '0 24px 80px',
      color: '#1d1d1f',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      <a href="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'rgba(29,29,31,0.55)',
        textDecoration: 'none', marginBottom: 24,
      }}>
        ‹ Volver al inicio
      </a>

      <h1 style={{
        fontSize: 'clamp(28px, 4vw, 38px)',
        fontWeight: 600, letterSpacing: -0.6,
        margin: '0 0 8px',
      }}>{title}</h1>

      {lastUpdated && (
        <p style={{ fontSize: 12, color: 'rgba(29,29,31,0.5)', margin: '0 0 32px' }}>
          Última actualización: {lastUpdated}
        </p>
      )}

      <div style={{
        fontSize: 14, lineHeight: 1.7,
        color: 'rgba(29,29,31,0.85)',
      }}>
        {children}
      </div>

      <style jsx global>{`
        .legal-content h2 {
          font-size: 20px;
          font-weight: 600;
          letterSpacing: -0.3px;
          margin: 36px 0 12px;
          color: #1d1d1f;
        }
        .legal-content h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 24px 0 8px;
          color: #1d1d1f;
        }
        .legal-content p { margin: 0 0 14px; }
        .legal-content ul, .legal-content ol {
          margin: 0 0 14px;
          padding-left: 24px;
        }
        .legal-content li { margin-bottom: 6px; }
        .legal-content a {
          color: #1d1d1f;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .legal-content strong { font-weight: 600; color: #1d1d1f; }
        .legal-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0 20px;
          font-size: 13px;
        }
        .legal-content th, .legal-content td {
          padding: 8px 12px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          text-align: left;
          vertical-align: top;
        }
        .legal-content th {
          font-weight: 600;
          background: rgba(0,0,0,0.02);
        }
      `}</style>
    </div>
  );
}
