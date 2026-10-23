# Preparación fiscal multiempresa — República Dominicana

## Alcance implementado

`Pasarelas y Facturación` y el agente de Facturación abren un módulo por la empresa seleccionada. La actividad económica es texto libre; los documentos contienen bienes y servicios de cualquier sector. No dependen del catálogo académico ni heredan RNC, domicilio, exención o certificado de INTECA. El administrador real de la plataforma gestiona las empresas; no se incorporó un nuevo sistema de autenticación para usuarios delegados de clientes.

Cada empresa guarda razón social, nombre comercial, RNC/cédula, domicilio, actividad, correo, moneda predeterminada, ambiente y tipos de documento que necesita preparar. Se aceptan DOP, USD y EUR; la tasa a DOP debe declararse en cada documento en moneda extranjera. La jurisdicción implementada es DO; otros países requieren adaptadores normativos independientes.

El motor prepara documentos comerciales para los tipos 31, 32, 33, 34, 41, 43, 44, 45, 46 y 47, con controles básicos de datos, referencias e identificación. Esto **no** significa que estén implementadas todas las reglas condicionales ni el XML fiscal de esos tipos. Las empresas deben seleccionar el tratamiento aplicable: no se determina exención, retención, ISC u obligación tributaria automáticamente por sector.

## Cálculos

Los importes se reciben como cadenas decimales sin separadores de miles. BigInt realiza las operaciones; cantidad y precio admiten cuatro decimales y los resultados comerciales se redondean a centavos con mitad hacia arriba. La cantidad por precio se redondea por línea antes de descontar; el ITBIS se redondea por línea. Este es el algoritmo comercial de esta versión, pendiente de contrastar cada caso fiscal con las reglas oficiales y el adaptador seleccionado.

Se separan base 18%, 16%, 0% y exenta, descuentos, ITBIS, impuestos adicionales, cargos y retenciones declaradas. Las retenciones no reducen el total usado para decidir la ruta fiscal prevista: tipo 32 por debajo de RD$250,000 corresponde a RFCE; desde ese límite se prepara ruta ECF. El equivalente DOP se calcula con la tasa indicada. La tasa no se consulta automáticamente y no se presume inmutable. El saldo no acredita pago ni marca una matrícula.

## Persistencia y trazabilidad

- `crm_fiscal_companies`: perfil y huella de datos por `organization_id`.
- `crm_fiscal_documents`: solicitud, emisor capturado, totales, ambiente, huella, versión de reglas y revisión comercial.
- `crm_fiscal_events`: eventos persistentes de perfil, creación, revisión y descarte.

Las tres tablas tienen RLS y acceso directo revocado a anon/authenticated. Las rutas exigen la sesión firmada del administrador real y, para cambios, la cabecera `X-CRM-Action: fiscal`. Cada consulta de documento filtra empresa e ID. El administrador de plataforma está autorizado a administrar las empresas; un ID de empresa enviado por el navegador no constituye una credencial de usuario delegado.

La creación es atómica y serializada con bloqueo del perfil de empresa. El identificador de idempotencia es único por empresa y ambiente; repetir el mismo contenido devuelve el documento original, y repetir el identificador con otro contenido falla. No se consume una secuencia fiscal. Emisor, contenido, totales y hashes guardados son inmutables. Cambiar el RNC de una empresa con documentos requiere registrar una empresa nueva. Un perfil cambiado bloquea la revisión de un borrador anterior. Los borradores se conservan incluso al descartarlos; el descarte no es una anulación de e-NCF.

Se descargan una representación HTML comercial imprimible y un paquete JSON para revisión/integración. Ambos conservan el aviso de borrador sin validez fiscal. No incluyen e-NCF, XML firmado, firma ni QR inventados.

## Registro de referencia oficial

`fiscal/dgii-reference-registry.json` contiene las 15 copias oficiales XSD comprimidas, nombre, URL, versión, fecha de consulta y SHA-256 del contenido original. La API expone solo los metadatos. El registro es de referencia: ninguna copia se activa automáticamente como regla fiscal aprobada. `scripts/refresh-dgii-reference.py` vuelve a descargar las referencias y genera un cambio revisable en git; no programa actualizaciones ni activa emisión.

Fuente: https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/documentacionSobreE-CF.aspx

## Pendientes para emisión fiscal oficial

La implementación anterior pedía a Gemini inventariar una estructura e-CF. Ese endpoint se retiró (410 para el administrador; 401 sin sesión). Los cálculos actuales no dependen de IA. El webhook fiscal anterior que aceptaba cuerpos sin autenticar ahora devuelve 503 y no registra una aceptación fiscal falsa.

**La emisión oficial sigue deshabilitada.** Registrar referencias de autorización o certificado no implementa ni verifica un conector. Quedan por completar con cada empresa/proveedor:

1. Adaptador de proveedor autorizado o implementación DGII propia, con endpoints, autenticación de semilla, firma XMLDSig y expiración real de tokens.
2. Almacén seguro de certificados, autorización del firmante, comprobación de vencimiento/revocación y aislamiento de credenciales por emisor y ambiente.
3. Matriz completa de campos y reglas por tipo, construcción de XML, validación XSD y fiscal; RFCE con conservación del comprobante completo.
4. Gestión atómica de secuencias autorizadas, transmisión, TrackId y consulta ante resultados inciertos, sin reemitir ciegamente.
5. Estados y evidencias oficiales de aceptación/rechazo, entrega al receptor, acuses, aprobación comercial y anulaciones.
6. Contingencia con declaración autorizada, conciliación posterior y procedimiento de regularización.
7. Representación impresa fiscal, timbre/QR y certificación oficial antes de activar producción.

El cambio proporciona el módulo comercial y los controles previos que sirven a distintas empresas; no declara al CRM certificado por la DGII ni sustituye al proveedor fiscal o al contador.

## Verificación

`npm run typecheck && npm run build`

`node --experimental-strip-types --test fiscal/engine.test.ts`

`node --test fiscal/reference.test.mjs fiscal/api.test.mjs`

Pruebas SQL con ROLLBACK para idempotencia, separación de empresas, inmovilidad de totales, bloqueo de cambio de emisor y estados de revisión/descarte. Sin emisión, consumo de e-NCF ni documentos de prueba persistentes en producción.
