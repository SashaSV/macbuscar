import LegalLayout from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Condiciones de Uso | macbuscar.es',
  description: 'Términos y condiciones de uso del sitio macbuscar.es.',
};

export default function CondicionesUsoPage() {
  return (
    <LegalLayout title="Condiciones de Uso" lastUpdated="26 de mayo de 2026">
      <div className="legal-content">
        <p>
          Las presentes Condiciones de Uso regulan el acceso y la utilización del sitio web
          {' '}<strong>macbuscar.es</strong> (en adelante, "el Sitio"), titularidad de [TU_NOMBRE_COMPLETO],
          con NIE [TU_NIE], y domicilio en [TU_DIRECCION_COMPLETA], [TU_CP] [TU_CIUDAD], España.
        </p>
        <p>
          El acceso al Sitio implica la aceptación íntegra de las presentes Condiciones, así como del
          {' '}<a href="/aviso-legal">Aviso Legal</a>,
          {' '}<a href="/politica-privacidad">Política de Privacidad</a> y
          {' '}<a href="/politica-cookies">Política de Cookies</a>.
        </p>

        <h2>1. Objeto del servicio</h2>
        <p>
          macbuscar.es es un <strong>comparador de precios independiente</strong> que recopila y muestra
          ofertas de productos Apple disponibles en tiendas online españolas. El Sitio no vende productos
          directamente, no procesa pagos y no actúa como intermediario en las compras.
        </p>
        <p>
          El servicio se presta de forma gratuita para el usuario. macbuscar.es puede recibir comisiones
          de afiliación por las compras realizadas en las tiendas de destino, sin coste adicional para
          el comprador.
        </p>

        <h2>2. Usuarios</h2>
        <p>
          El acceso al Sitio es libre y no requiere registro previo. La utilización del Sitio atribuye
          al visitante la condición de Usuario.
        </p>
        <p>
          El uso del Sitio por menores de 14 años requiere autorización de sus padres o tutores legales.
        </p>

        <h2>3. Información sobre precios y disponibilidad</h2>
        <p>
          Los precios, características y disponibilidad de los productos mostrados se obtienen
          automáticamente de fuentes públicas de los respectivos vendedores. Esta información es
          <strong> orientativa</strong> y puede no estar permanentemente actualizada.
        </p>
        <p>
          macbuscar.es no garantiza:
        </p>
        <ul>
          <li>La exactitud, integridad o vigencia de los precios mostrados.</li>
          <li>La disponibilidad real de los productos en stock.</li>
          <li>Los gastos de envío, plazos de entrega o condiciones de cada vendedor.</li>
          <li>La aplicabilidad de promociones, descuentos o códigos.</li>
        </ul>
        <p>
          <strong>El Usuario debe verificar siempre el precio final y las condiciones en la web del
          vendedor antes de realizar la compra.</strong> Cualquier compra se rige por las condiciones
          generales de la tienda donde se realiza, ajenas a macbuscar.es.
        </p>

        <h2>4. Enlaces externos y afiliación</h2>
        <p>
          El Sitio contiene enlaces a tiendas online de terceros. Cuando el Usuario hace clic en un enlace
          puede ser redirigido a la web del vendedor, donde se realiza la transacción comercial.
          macbuscar.es no es responsable del contenido, condiciones de venta, ni servicio postventa de
          dichas tiendas.
        </p>
        <p>
          Algunos enlaces son <strong>enlaces de afiliación</strong> que generan una comisión para
          macbuscar.es cuando el usuario completa una compra. Esta circunstancia no incrementa el precio
          ni afecta a la objetividad de las comparativas mostradas.
        </p>

        <h2>5. Uso correcto del Sitio</h2>
        <p>El Usuario se compromete a utilizar el Sitio de conformidad con la ley y con las presentes Condiciones, y a no:</p>
        <ul>
          <li>Realizar actividades que puedan dañar o sobrecargar el funcionamiento del Sitio
              (scraping masivo automatizado, ataques DDoS, etc.).</li>
          <li>Introducir virus, código malicioso o cualquier elemento que pueda perjudicar al Sitio
              o a sus usuarios.</li>
          <li>Reproducir, distribuir o explotar comercialmente los contenidos del Sitio sin autorización
              expresa por escrito.</li>
          <li>Utilizar el Sitio para fines fraudulentos, ilícitos o contrarios a la buena fe.</li>
        </ul>
        <p>
          El incumplimiento de estas obligaciones puede dar lugar a la limitación o bloqueo del acceso
          al Sitio, sin perjuicio de las acciones legales que correspondan.
        </p>

        <h2>6. Propiedad intelectual</h2>
        <p>
          Todos los contenidos del Sitio (textos, gráficos, código fuente, diseño, marcas, logotipos, base
          de datos) son propiedad del titular o cuentan con la correspondiente autorización para su uso.
          Queda prohibida su reproducción, distribución, transformación o cualquier otra forma de
          explotación sin autorización expresa.
        </p>
        <p>
          Las marcas y nombres comerciales de Apple Inc. y de las tiendas mencionadas en el Sitio pertenecen
          a sus respectivos titulares y se utilizan exclusivamente con fines informativos y comparativos.
        </p>

        <h2>7. Exclusión de garantías y responsabilidad</h2>
        <p>
          macbuscar.es no será responsable, en la medida permitida por la ley aplicable, de los daños y
          perjuicios de cualquier naturaleza que pudieran derivarse de:
        </p>
        <ul>
          <li>Errores u omisiones en los contenidos publicados.</li>
          <li>La falta de disponibilidad temporal del Sitio por mantenimiento, fallos técnicos o causas ajenas.</li>
          <li>Decisiones de compra adoptadas por el Usuario en base a la información del Sitio.</li>
          <li>Productos defectuosos, garantías o devoluciones de las tiendas de destino.</li>
          <li>La conducta de terceros, incluidos otros usuarios, vendedores o proveedores de servicios.</li>
        </ul>

        <h2>8. Modificaciones</h2>
        <p>
          macbuscar.es se reserva el derecho a modificar el diseño, configuración, contenidos y servicios
          del Sitio en cualquier momento, así como las presentes Condiciones. La versión publicada en
          esta página es la actualmente vigente.
        </p>

        <h2>9. Legislación aplicable y jurisdicción</h2>
        <p>
          Las presentes Condiciones se rigen por la legislación española. Para cualquier controversia
          derivada del uso del Sitio, las partes se someten a los Juzgados y Tribunales competentes del
          domicilio del titular, salvo que la normativa de consumidores y usuarios disponga otro fuero.
        </p>
        <p>
          Conforme al Reglamento (UE) 524/2013, los consumidores residentes en la UE pueden acceder a la
          plataforma de resolución de litigios en línea de la Comisión Europea en
          {' '}<a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
            https://ec.europa.eu/consumers/odr
          </a>.
        </p>

        <h2>10. Contacto</h2>
        <p>
          Para cualquier consulta sobre estas Condiciones de Uso puede contactar con nosotros en
          {' '}<a href="mailto:[TU_EMAIL]">[TU_EMAIL]</a>.
        </p>
      </div>
    </LegalLayout>
  );
}
