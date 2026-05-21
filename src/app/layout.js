const SITE_URL = 'https://macbuscar.vercel.app'; // зміни на https://macbuscar.es коли підключиш домен
const SITE_NAME = 'Manzana.es';
const TITLE = 'Manzana.es — Comparador de precios Apple en España';
const DESCRIPTION = 'Encuentra el mejor precio en iPhone, MacBook, iPad, Apple Watch y AirPods. Comparamos 8 tiendas españolas: Apple Store, MediaMarkt, PcComponentes, Fnac, Amazon, El Corte Inglés, Worten y iStore. Actualizado en tiempo real.';
 
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | Manzana.es'
  },
  description: DESCRIPTION,
  keywords: ['comparador precios apple', 'iPhone barato España', 'MacBook oferta', 'iPad precio', 'Apple Watch comparador', 'AirPods barato', 'mejor precio Apple', 'descuento iPhone', 'segunda mano Apple'],
  authors: [{ name: 'Manzana.es' }],
  creator: 'Manzana.es',
  publisher: 'Manzana.es',
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: SITE_URL, languages: { 'es-ES': SITE_URL } },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'es_ES',
    type: 'website',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Manzana.es - Comparador Apple España',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍎</text></svg>",
    apple: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍎</text></svg>",
  },
  verification: {
    // google: 'код-з-search-console-додамо-пізніше',
  },
};
 
export const viewport = {
  themeColor: '#090909',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};
 
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  description: DESCRIPTION,
  inLanguage: 'es-ES',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};
 
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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