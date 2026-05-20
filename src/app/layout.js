export const metadata = {
  title: 'Manzana.es — Comparador Apple España',
  description: 'Encuentra el mejor precio en iPhone, Mac, iPad, Apple Watch y más en las mejores tiendas de España.',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍎</text></svg>" },
};

export const viewport = { themeColor: '#090909' };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html { font-size: 16px; }
          body { background: #090909; color: #f0f0f0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; min-height: 100vh; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: #111; }
          ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #555; }
          button { font-family: inherit; }
          input, textarea, select { font-family: inherit; color-scheme: dark; }
          a { color: inherit; }
          @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.3} }
          @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
