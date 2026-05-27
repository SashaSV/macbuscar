'use client';

export default function FooterLegal() {
  return (
    <footer style={{
      maxWidth: 1140,
      margin: '60px auto 0',
      padding: '32px 24px 40px',
      borderTop: '1px solid rgba(0,0,0,0.06)',
      color: 'rgba(29,29,31,0.55)',
      fontSize: 12,
      lineHeight: 1.6,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 24 }}>
        <div>
          <div style={{ fontWeight: 600, color: '#1d1d1f', marginBottom: 10, fontSize: 13 }}>macbuscar</div>
          <div>
            Comparador de precios independiente de productos Apple en España.
            No somos vendedores ni distribuidores oficiales de Apple Inc.
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 600, color: '#1d1d1f', marginBottom: 10, fontSize: 13 }}>Legal</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li><a href="/aviso-legal" style={linkStyle}>Aviso legal</a></li>
            <li><a href="/politica-privacidad" style={linkStyle}>Política de privacidad</a></li>
            <li><a href="/politica-cookies" style={linkStyle}>Política de cookies</a></li>
            <li><a href="/condiciones-uso" style={linkStyle}>Condiciones de uso</a></li>
            <li>
              <button
                onClick={() => typeof window !== 'undefined' && window.dispatchEvent(new Event('openCookieSettings'))}
                style={{
                  ...linkStyle,
                  background: 'none',
                  border: 'none',
                  padding: '3px 0',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                Gestionar cookies
              </button>
            </li>
          </ul>
        </div>

        <div>
          <div style={{ fontWeight: 600, color: '#1d1d1f', marginBottom: 10, fontSize: 13 }}>Información</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li><a href="/sobre-nosotros" style={linkStyle}>Sobre nosotros</a></li>
            <li><a href="/contacto" style={linkStyle}>Contacto</a></li>
            <li><a href="/como-funciona" style={linkStyle}>Cómo funciona</a></li>
          </ul>
        </div>
      </div>

      <div style={{
        paddingTop: 20,
        borderTop: '1px solid rgba(0,0,0,0.06)',
        fontSize: 11,
        color: 'rgba(29,29,31,0.45)',
      }}>
        <p style={{ margin: '0 0 8px' }}>
          <strong>Aviso de afiliación:</strong> macbuscar.es participa en programas de afiliación de Amazon EU,
          Apple, MediaMarkt, El Corte Inglés, FNAC y otros minoristas. Cuando compras a través de nuestros enlaces
          podemos recibir una pequeña comisión sin coste adicional para ti. Las comisiones no influyen
          en los precios mostrados ni en la clasificación de las ofertas.
        </p>
        <p style={{ margin: '0 0 8px' }}>
          Los precios mostrados son orientativos y pueden variar. macbuscar.es no se hace responsable de las
          condiciones, gastos de envío, disponibilidad o cambios de precio aplicados por las tiendas.
          Confirma siempre el precio final en la web del vendedor antes de finalizar tu compra.
        </p>
        <p style={{ margin: '0 0 8px' }}>
          Apple, iPhone, iPad, Mac, Apple Watch, AirPods, AirTag, Apple TV, HomePod y todos los logotipos
          relacionados son marcas comerciales de Apple Inc., registradas en EE. UU. y otros países y regiones.
          macbuscar.es no está afiliado, asociado, autorizado, respaldado por ni de ninguna forma oficialmente
          conectado con Apple Inc.
        </p>
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} macbuscar.es. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}

const linkStyle = {
  color: 'rgba(29,29,31,0.55)',
  textDecoration: 'none',
  display: 'inline-block',
  padding: '3px 0',
  transition: 'color .15s',
};
