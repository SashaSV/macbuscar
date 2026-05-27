import LegalLayout from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Aviso Legal | macbuscar.es',
  description: 'Información legal de macbuscar.es según la Ley 34/2002 LSSI-CE.',
};

export default function AvisoLegalPage() {
  return (
    <LegalLayout title="Aviso Legal" lastUpdated="26 de mayo de 2026">
      <div className="legal-content">
        <p>
          En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad
          de la Información y de Comercio Electrónico (LSSI-CE), se informa de los siguientes datos del
          titular del sitio web <strong>macbuscar.es</strong>:
        </p>

        <h2>1. Datos identificativos</h2>
        <table>
          <tbody>
            <tr><th>Titular</th><td>[TU_NOMBRE_COMPLETO]</td></tr>
            <tr><th>NIE/NIF</th><td>[TU_NIE]</td></tr>
            <tr><th>Domicilio</th><td>[TU_DIRECCION_COMPLETA], [TU_CP] [TU_CIUDAD], España</td></tr>
            <tr><th>Actividad</th><td>Trabajador autónomo · CNAE [CNAE]</td></tr>
            <tr><th>Email de contacto</th><td><a href="mailto:[TU_EMAIL]">[TU_EMAIL]</a></td></tr>
            <tr><th>Sitio web</th><td>https://macbuscar.es</td></tr>
          </tbody>
        </table>

        <h2>2. Objeto del sitio web</h2>
        <p>
          macbuscar.es es un <strong>comparador de precios independiente</strong> de productos de la marca
          Apple en tiendas online españolas. El sitio no vende productos directamente, no procesa pagos
          y no actúa como intermediario en las compras realizadas por el usuario.
        </p>
        <p>
          Cuando el usuario hace clic en un enlace de oferta, es redirigido a la página web del vendedor
          correspondiente, donde se realiza la transacción comercial bajo los términos y condiciones de
          dicho vendedor. macbuscar.es no es parte de la relación contractual entre el usuario y el vendedor.
        </p>

        <h2>3. Condiciones de uso</h2>
        <p>
          El acceso y uso del sitio web atribuye la condición de usuario, e implica la aceptación plena
          y sin reservas de todas las disposiciones incluidas en este Aviso Legal, en la
          {' '}<a href="/politica-privacidad">Política de Privacidad</a>, en la
          {' '}<a href="/politica-cookies">Política de Cookies</a> y en las
          {' '}<a href="/condiciones-uso">Condiciones de Uso</a> publicadas.
        </p>

        <h2>4. Propiedad intelectual e industrial</h2>
        <p>
          Todos los contenidos del sitio web (textos, código fuente, diseño gráfico, estructura de navegación,
          bases de datos) son propiedad del titular o cuentan con la correspondiente autorización para su
          uso. Queda prohibida la reproducción total o parcial sin autorización expresa.
        </p>
        <p>
          <strong>Marcas de terceros:</strong> Apple, iPhone, iPad, Mac, MacBook, Apple Watch, AirPods, AirTag,
          Apple TV, HomePod y todos los logotipos y nombres de productos relacionados son marcas comerciales
          de Apple Inc., registradas en EE. UU. y otros países y regiones. macbuscar.es no está afiliado,
          asociado, autorizado, patrocinado ni respaldado por Apple Inc.
        </p>
        <p>
          Las marcas de las tiendas mencionadas (Amazon, MediaMarkt, El Corte Inglés, FNAC, Worten, PcComponentes,
          K-tuin, entre otras) pertenecen a sus respectivos titulares y se utilizan únicamente con fines
          informativos y comparativos.
        </p>

        <h2>5. Limitación de responsabilidad</h2>
        <p>
          Los precios, disponibilidad y características de los productos mostrados son <strong>orientativos</strong>
          {' '}y se obtienen automáticamente de fuentes públicas de los respectivos vendedores. macbuscar.es no
          garantiza la exactitud, integridad o actualidad de la información en todo momento. El usuario debe
          verificar siempre los datos en la web del vendedor antes de realizar cualquier compra.
        </p>
        <p>
          macbuscar.es no se hace responsable de:
        </p>
        <ul>
          <li>Errores u omisiones en los precios, descripciones o imágenes de los productos.</li>
          <li>Variaciones de precio, stock, gastos de envío o promociones aplicadas por los vendedores.</li>
          <li>El contenido, condiciones de venta, servicio postventa o garantías ofrecidas por las tiendas
              de destino.</li>
          <li>Cualquier daño o perjuicio derivado de la utilización de la información publicada.</li>
        </ul>

        <h2>6. Enlaces de afiliación</h2>
        <p>
          macbuscar.es puede participar en programas de afiliación de terceros (incluyendo Amazon EU Associates,
          Apple Services Performance Partner Program y otros). Cuando el usuario realiza una compra a través
          de un enlace marcado o no, macbuscar.es puede recibir una comisión sin coste adicional para el comprador.
          Estas comisiones <strong>no influyen</strong> en los precios mostrados ni en la clasificación de las ofertas.
        </p>

        <h2>7. Legislación aplicable y jurisdicción</h2>
        <p>
          Este Aviso Legal se rige por la legislación española. Para cualquier controversia derivada del
          uso del sitio web, las partes se someten a los Juzgados y Tribunales competentes del domicilio del
          titular, salvo que la normativa de consumidores y usuarios disponga otro fuero.
        </p>

        <h2>8. Resolución de conflictos en línea</h2>
        <p>
          Conforme al Reglamento (UE) 524/2013, los consumidores residentes en la Unión Europea pueden
          acceder a la plataforma de resolución de litigios en línea de la Comisión Europea en:
          {' '}<a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
            https://ec.europa.eu/consumers/odr
          </a>.
        </p>

        <h2>9. Modificaciones</h2>
        <p>
          El titular se reserva el derecho a modificar el presente Aviso Legal en cualquier momento, siendo
          la versión publicada en esta página la actualmente vigente.
        </p>
      </div>
    </LegalLayout>
  );
}
