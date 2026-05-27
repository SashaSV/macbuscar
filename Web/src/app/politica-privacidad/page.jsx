import LegalLayout from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Política de Privacidad | macbuscar.es',
  description: 'Cómo macbuscar.es trata tus datos personales conforme al RGPD y la LOPDGDD.',
};

export default function PoliticaPrivacidadPage() {
  return (
    <LegalLayout title="Política de Privacidad" lastUpdated="26 de mayo de 2026">
      <div className="legal-content">
        <p>
          Esta Política de Privacidad describe cómo macbuscar.es trata los datos personales de los usuarios
          conforme al <strong>Reglamento (UE) 2016/679 (RGPD)</strong> y la
          {' '}<strong>Ley Orgánica 3/2018, de Protección de Datos Personales y Garantía de los Derechos Digitales (LOPDGDD)</strong>.
        </p>

        <h2>1. Responsable del tratamiento</h2>
        <table>
          <tbody>
            <tr><th>Responsable</th><td>[TU_NOMBRE_COMPLETO]</td></tr>
            <tr><th>NIE/NIF</th><td>[TU_NIE]</td></tr>
            <tr><th>Domicilio</th><td>[TU_DIRECCION_COMPLETA], [TU_CP] [TU_CIUDAD], España</td></tr>
            <tr><th>Email</th><td><a href="mailto:[TU_EMAIL]">[TU_EMAIL]</a></td></tr>
          </tbody>
        </table>

        <h2>2. Datos que tratamos</h2>
        <p>
          macbuscar.es es una plataforma <strong>no registrada</strong>: no requerimos crear cuenta de usuario,
          no almacenamos contraseñas y no solicitamos datos personales identificativos para acceder al contenido.
        </p>
        <p>Tratamos únicamente los siguientes datos:</p>
        <ul>
          <li>
            <strong>Datos de navegación:</strong> dirección IP, tipo de navegador, sistema operativo, páginas
            visitadas, tiempo en el sitio, referrer, idioma. Recogidos mediante cookies analíticas (ver
            {' '}<a href="/politica-cookies">Política de Cookies</a>).
          </li>
          <li>
            <strong>Datos de contacto voluntarios:</strong> cuando el usuario nos escribe a través del email
            de contacto, recopilamos su dirección de email y el contenido de su consulta.
          </li>
          <li>
            <strong>Datos de afiliación:</strong> cuando el usuario hace clic en un enlace a una tienda
            afiliada, se transmiten identificadores anónimos del programa (no contienen datos personales).
          </li>
        </ul>

        <h2>3. Finalidades y base jurídica</h2>
        <table>
          <thead>
            <tr><th>Finalidad</th><th>Base jurídica (RGPD)</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Prestación del servicio de comparación de precios</td>
              <td>Interés legítimo (art. 6.1.f RGPD)</td>
            </tr>
            <tr>
              <td>Cookies analíticas para mejorar el sitio</td>
              <td>Consentimiento (art. 6.1.a RGPD)</td>
            </tr>
            <tr>
              <td>Cookies de afiliación para atribución de comisiones</td>
              <td>Consentimiento (art. 6.1.a RGPD)</td>
            </tr>
            <tr>
              <td>Atención a consultas recibidas por email</td>
              <td>Consentimiento implícito al contactarnos</td>
            </tr>
            <tr>
              <td>Cumplimiento de obligaciones legales (fiscales, mercantiles)</td>
              <td>Obligación legal (art. 6.1.c RGPD)</td>
            </tr>
          </tbody>
        </table>

        <h2>4. Plazos de conservación</h2>
        <ul>
          <li><strong>Datos de navegación:</strong> hasta 14 meses (configuración estándar de Google Analytics).</li>
          <li><strong>Cookies:</strong> según se detalla en la <a href="/politica-cookies">Política de Cookies</a>.</li>
          <li><strong>Emails de contacto:</strong> hasta 1 año desde la última comunicación, salvo obligación
              legal de conservación superior.</li>
        </ul>

        <h2>5. Destinatarios de los datos</h2>
        <p>No vendemos ni cedemos datos personales a terceros. Pueden tener acceso a datos los siguientes
           encargados del tratamiento, todos ellos con garantías RGPD:</p>
        <ul>
          <li><strong>Proveedor de hosting:</strong> Vercel Inc. (servidores en UE, certificación SOC 2).</li>
          <li><strong>Base de datos:</strong> Neon Inc. (PostgreSQL serverless, servidores en UE).</li>
          <li><strong>Google Analytics 4:</strong> Google Ireland Limited (Irlanda, UE), únicamente con consentimiento previo.</li>
          <li><strong>Programas de afiliación:</strong> Amazon EU (Luxemburgo), Apple Distribution International (Irlanda),
              y otros minoristas, únicamente con consentimiento previo.</li>
        </ul>

        <h2>6. Transferencias internacionales</h2>
        <p>
          Determinados proveedores (Google, Apple, Amazon) pueden tratar datos en servidores fuera del
          Espacio Económico Europeo. En todos los casos se aplican garantías adecuadas según los artículos
          45 y 46 del RGPD (Cláusulas Contractuales Tipo aprobadas por la Comisión Europea, Data Privacy Framework).
        </p>

        <h2>7. Derechos del usuario</h2>
        <p>El usuario puede ejercer en cualquier momento los siguientes derechos:</p>
        <ul>
          <li><strong>Acceso</strong> a sus datos personales.</li>
          <li><strong>Rectificación</strong> de datos inexactos.</li>
          <li><strong>Supresión</strong> ("derecho al olvido").</li>
          <li><strong>Limitación</strong> del tratamiento.</li>
          <li><strong>Oposición</strong> al tratamiento.</li>
          <li><strong>Portabilidad</strong> de sus datos.</li>
          <li><strong>Retirada del consentimiento</strong> en cualquier momento.</li>
        </ul>
        <p>
          Para ejercer estos derechos, basta con enviar un email a
          {' '}<a href="mailto:[TU_EMAIL]">[TU_EMAIL]</a> indicando el derecho que se desea ejercer y
          adjuntando copia de un documento identificativo.
        </p>
        <p>
          Si considera que sus derechos no han sido atendidos correctamente, puede presentar una reclamación
          ante la <strong>Agencia Española de Protección de Datos (AEPD)</strong> en
          {' '}<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>.
        </p>

        <h2>8. Seguridad</h2>
        <p>
          Aplicamos medidas técnicas y organizativas apropiadas para garantizar la seguridad de los datos:
          cifrado HTTPS en todas las comunicaciones, base de datos cifrada en reposo, acceso restringido,
          y revisiones periódicas de seguridad.
        </p>

        <h2>9. Menores de edad</h2>
        <p>
          macbuscar.es no está dirigido a menores de 14 años. Si detectamos que hemos recibido datos de
          un menor sin el consentimiento parental correspondiente, los eliminaremos inmediatamente.
        </p>

        <h2>10. Modificaciones</h2>
        <p>
          Esta Política de Privacidad puede ser actualizada para adaptarse a cambios legislativos o de
          funcionalidad. Recomendamos revisarla periódicamente. La fecha de última actualización se
          muestra al inicio del documento.
        </p>
      </div>
    </LegalLayout>
  );
}
