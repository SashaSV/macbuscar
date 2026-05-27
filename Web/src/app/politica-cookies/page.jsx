import LegalLayout from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Política de Cookies | macbuscar.es',
  description: 'Información sobre las cookies utilizadas en macbuscar.es.',
};

export default function PoliticaCookiesPage() {
  return (
    <LegalLayout title="Política de Cookies" lastUpdated="26 de mayo de 2026">
      <div className="legal-content">
        <p>
          Esta Política de Cookies explica qué son las cookies, qué tipos utilizamos en macbuscar.es,
          con qué finalidad y cómo puedes gestionarlas. Cumple con el artículo 22.2 de la Ley 34/2002
          (LSSI-CE), modificada por el Real Decreto-Ley 13/2012, y con la Guía de Cookies de la AEPD.
        </p>

        <h2>1. ¿Qué son las cookies?</h2>
        <p>
          Las cookies son pequeños archivos de texto que los sitios web colocan en tu dispositivo (ordenador,
          móvil o tablet) cuando los visitas. Sirven para que el sitio funcione correctamente, recordar
          preferencias, analizar el uso y, en su caso, mostrar publicidad personalizada.
        </p>

        <h2>2. Tipos de cookies según su titularidad</h2>
        <ul>
          <li><strong>Cookies propias:</strong> gestionadas por macbuscar.es desde nuestros propios servidores.</li>
          <li><strong>Cookies de terceros:</strong> gestionadas por entidades externas (Google, Amazon, Apple, etc.).</li>
        </ul>

        <h2>3. Tipos de cookies según su finalidad</h2>
        <ul>
          <li><strong>Técnicas (necesarias):</strong> imprescindibles para que el sitio funcione. No requieren consentimiento.</li>
          <li><strong>Analíticas:</strong> miden el uso del sitio (visitas, páginas, tiempo) para mejorarlo. Requieren consentimiento.</li>
          <li><strong>De afiliación:</strong> identifican que el usuario llegó a una tienda desde macbuscar.es. Requieren consentimiento.</li>
        </ul>
        <p>
          <strong>macbuscar.es no utiliza cookies publicitarias ni de perfilado de comportamiento</strong>
          {' '}para mostrar anuncios personalizados.
        </p>

        <h2>4. Cookies utilizadas en macbuscar.es</h2>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Proveedor</th>
              <th>Finalidad</th>
              <th>Tipo</th>
              <th>Duración</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>cookieConsent</td>
              <td>macbuscar.es</td>
              <td>Guarda tu elección sobre cookies</td>
              <td>Técnica</td>
              <td>1 año</td>
            </tr>
            <tr>
              <td>_ga, _ga_*</td>
              <td>Google Analytics 4</td>
              <td>Estadísticas anónimas de uso</td>
              <td>Analítica</td>
              <td>2 años</td>
            </tr>
            <tr>
              <td>tag, ref</td>
              <td>Amazon, Apple, otros</td>
              <td>Atribución de clics afiliados</td>
              <td>Afiliación</td>
              <td>24 horas — 30 días</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: 'rgba(29,29,31,0.5)' }}>
          Esta lista se actualiza periódicamente. Las cookies de afiliación se establecen únicamente cuando
          haces clic en un enlace a una tienda externa y siempre desde el dominio de dicha tienda.
        </p>

        <h2>5. Consentimiento</h2>
        <p>
          Al acceder por primera vez a macbuscar.es se muestra un banner informativo en el que puedes:
        </p>
        <ul>
          <li><strong>Aceptar todas</strong> las cookies.</li>
          <li><strong>Rechazar todas</strong> las cookies no necesarias.</li>
          <li><strong>Personalizar</strong> tu elección por categoría.</li>
        </ul>
        <p>
          Tu elección queda registrada y puedes modificarla en cualquier momento desde el enlace
          "Gestionar cookies" del pie de página.
        </p>

        <h2>6. Cómo gestionar o eliminar cookies desde tu navegador</h2>
        <p>Puedes configurar o eliminar las cookies desde las preferencias de tu navegador:</p>
        <ul>
          <li>
            <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
              Google Chrome
            </a>
          </li>
          <li>
            <a href="https://support.mozilla.org/es/kb/Borrar%20cookies" target="_blank" rel="noopener noreferrer">
              Mozilla Firefox
            </a>
          </li>
          <li>
            <a href="https://support.apple.com/es-es/HT201265" target="_blank" rel="noopener noreferrer">
              Safari (iOS y macOS)
            </a>
          </li>
          <li>
            <a href="https://support.microsoft.com/es-es/microsoft-edge" target="_blank" rel="noopener noreferrer">
              Microsoft Edge
            </a>
          </li>
        </ul>
        <p>
          Ten en cuenta que rechazar todas las cookies puede limitar algunas funcionalidades del sitio
          (preferencias de visualización, recordatorios, atribución de comisiones de afiliados).
        </p>

        <h2>7. Transferencias internacionales</h2>
        <p>
          Las cookies de Google Analytics y de los programas de afiliación pueden implicar transferencias
          de datos a servidores fuera del Espacio Económico Europeo. Estas transferencias se realizan bajo
          las garantías previstas en el Capítulo V del RGPD.
        </p>

        <h2>8. Más información</h2>
        <p>
          Para consultas relacionadas con esta Política de Cookies o para ejercer tus derechos en materia
          de protección de datos, contacta con
          {' '}<a href="mailto:[TU_EMAIL]">[TU_EMAIL]</a>.
        </p>
        <p>
          Puedes consultar más información sobre cookies en la página de la AEPD:
          {' '}<a href="https://www.aepd.es/guias/guia-cookies.pdf" target="_blank" rel="noopener noreferrer">
            Guía sobre el uso de las cookies
          </a>.
        </p>
      </div>
    </LegalLayout>
  );
}
