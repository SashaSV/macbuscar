const SITE_URL = 'https://macbuscar.es';
const SITE_NAME = 'macbuscar';
const TITLE = 'macbuscar — Comparador de precios Apple en España';
const DESCRIPTION = 'Encuentra el mejor precio en iPhone, MacBook, iPad, Apple Watch y AirPods. Comparamos 8 tiendas españolas: Apple Store, MediaMarkt, PcComponentes, Fnac, Amazon, El Corte Inglés, Worten y iStore. Actualizado en tiempo real.';

import CookieConsent from '@/components/legal/CookieConsent';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | macbuscar' },
  description: DESCRIPTION,
  keywords: ['comparador precios apple', 'iPhone barato España', 'MacBook oferta', 'iPad precio', 'Apple Watch comparador', 'AirPods barato', 'mejor precio Apple', 'descuento iPhone', 'segunda mano Apple'],
  authors: [{ name: 'macbuscar' }],
  creator: 'macbuscar',
  publisher: 'macbuscar',
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: SITE_URL, languages: { 'es-ES': SITE_URL } },
  openGraph: {
    title: TITLE, description: DESCRIPTION, url: SITE_URL, siteName: SITE_NAME,
    locale: 'es_ES', type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'macbuscar - Comparador Apple España' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og-image.png'] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍎</text></svg>",
    apple: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍎</text></svg>",
  },
};

export const viewport = {
  themeColor: '#f0f4ff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

const jsonLd = {
  '@context': 'https://schema.org', '@type': 'WebSite',
  name: SITE_NAME, url: SITE_URL, description: DESCRIPTION, inLanguage: 'es-ES',
  potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html {
            font-size: 16px;
            min-height: 100%;
            background: linear-gradient(135deg, #f0f4ff 0%, #fce8f3 50%, #fef3c7 100%);
            background-attachment: fixed;
          }
          body {
            background: transparent;
            color: #1d1d1f;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: rgba(255,255,255,0.3); }
          ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.4); }
          button { font-family: inherit; }
          input, textarea, select { font-family: inherit; }
          a { color: inherit; }
          .ti { display: inline-block; }
          @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.3} }
          @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
          @keyframes appleBounce { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-14px) scale(1.05)} }
          @keyframes loadingBar { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }
        `}</style>
      </head>
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}