# Contabilidad y preparación fiscal multiempresa

## Operación implementada

- `/api/accounting/:org`: diario del período, balance de comprobación, acumulados de activos/pasivos/patrimonio y resultado.
- Asientos de doble partida en DOP con importes decimales exactos. Cuentas base para caja/bancos, cuentas por cobrar/pagar, inventario, activos, impuestos, retenciones, capital, ingresos, costos y gastos.
- Registro de compras, ventas documentadas, cobros/abonos y pagos mediante asientos revisados por el administrador. No realiza transferencias bancarias ni acredita un pago por OCR.
- Idempotencia, rechazo de comprobantes duplicados por tercero/tipo, rechazo de períodos cerrados, reversiones completas sin borrar el original y auditoría transaccional.
- Comparación manual del saldo bancario con caja/bancos y registro de partidas pendientes; no es conciliación automática transacción por transacción ni contabilidad bancaria por subcuenta.
- Obligaciones y constancias para 606/607/608/609, formatos especializados y declaraciones. Aplicabilidad y vencimiento se confirman por RNC. `submitted` es un registro manual con referencia obligatoria, no una verificación en DGII.
- Exportación CSV del diario y papel de trabajo JSON. Revisión contable/fiscal determinista a partir de Supabase, sin escritura autónoma ni transmisión oficial.
- Sesión de administrador, control de acción, datos por empresa, RLS y acceso de servidor exclusivamente. No concede acceso de otras empresas mediante JWT públicos.

## Facturación existente

Se conservan los diez tipos e-CF de preparación comercial, cálculos deterministas, perfil fiscal por empresa, estados y trazabilidad de borradores. La emisión sigue bloqueada. Registrar un asiento no convierte un borrador comercial en factura fiscal y no contabiliza automáticamente los borradores como ventas.

## Agente fiscal: 606, 607, 608, 609, IT-1, IR-2, ACT

- En el panel Contabilidad Autónoma se muestran siete formularios con nombre, periodicidad, aplicabilidad, enlace al instructivo oficial y su borrador más reciente.
- Botón «Preparar los 7 formularios con datos disponibles» llama al backend bajo sesión admin; prepara hojas de trabajo deterministas, no ficheros oficiales DGII.
- El emisor procede del perfil fiscal real `crm_fiscal_companies`; RNC, razón social y domicilio nunca se inventan. Si no existe perfil, se señala el pendiente.
- Las compras/ventas se relacionan con asientos reales de `crm_accounting_journals`, conservando `sourceJournalId`, fechas, NCF, RNC, montos indicativos y campos DGII faltantes.
- 608/609 no se infieren del libro actual; no se confunde ausencia de registro con cero. IT-1 no presume ITBIS desde cuentas de mayor; IR-2 requiere anexos y conciliación anual; ACT requiere clasificación de activos y exenciones verificadas.
- Declaración en cero: solo posible **candidata de revisión humana**, cuando el operador certifica bancos, ventas, compras, NCF anulados, exterior y demás fuentes; además período cerrado, obligación confirmada y perfil válido. Para IR-2/ACT no hay automatismo de cero.
- Los borradores son instantáneas inmutables en `crm_tax_workpapers`, por empresa, formulario y período, con resumen de origen hash SHA-256, estado `draft_incomplete` o `zero_candidate_requires_human_review`. No son declaración enviada, ni archivo TXT para OFV ni e-CF emitido. No hay automatización de acceso a Oficina Virtual.
- La tabla aplica RLS y únicamente `service_role` servidor puede consultar/agregar; no existe permiso público de escritura. Repetir la preparación sin cambios no altera la instantánea; los cambios generan una nueva.
- Referencias DGII 2026: formatos 606–609 `https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/remisionInformacion/Paginas/formatoEnvioDatos.aspx`; obligaciones personas jurídicas `https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/declaracionPagoImpuestos/Paginas/declaracionesJuradasPJ.aspx`.
- Las fechas de vencimiento se registran manualmente después de comprobar obligaciones y fecha de cierre en DGII, no se inventan. Normalmente formatos 606–609 en primeros 15 días del mes siguiente, IT-1 el día 20, IR-2 y ACT 120 días después del cierre, sujetos a régimen/calendario vigente.
- En INTECA actual, se comprobó que todavía no hay perfil fiscal validado ni registros de asientos en la base conectada; **no se ha completado ni declarado ningún formulario real**.

## Pendientes para cubrir íntegramente la guía

- Catálogo contable personalizable, subcuentas bancarias, auxiliares de clientes/proveedores, antigüedad por factura y conciliación bancaria por movimiento.
- Inventario valorizado y costo de ventas integrado, depreciación, nómina, moneda extranjera, flujo de efectivo clasificado y automatización del enlace factura/cobro/asiento.
- Exportadores oficiales versionados 606/607/608/609 y especializados con todos los campos, catálogos de retenciones, validadores oficiales y manejo de rectificativas.
- Liquidación y anexos definitivos IT-1, IR-17, IR-3, IR-1, IR-2 y ACT. El módulo ahora prepara papeles de trabajo internos para IT-1, IR-2 y ACT, pero no calcula los impuestos finales ni presenta declaraciones.
- Adaptador directo DGII: secuencias autorizadas, generación XML, reglas/XSD, firma, autenticación, envío, TrackId/estados, RFCE, anulaciones electrónicas, contingencia, entrega y archivo de evidencias. Requiere certificación y autorización por empresa.
- No existe garantía de operación autónoma 24/7 en Render Free.

## Referencias consultadas

- https://dgii.gov.do/herramientas/formularios/formatoEnvioDatos/Paginas/default.aspx
- https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/remisionInformacion/Paginas/formatoEnvioDatos.aspx
- https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/formatoEnvioDatos/Documents/4-LlenadoyEnvioFormato606.pdf

Las fechas generales de la guía aportada no se convierten automáticamente en vencimientos de cada RNC. Verificar el calendario vigente y las obligaciones habilitadas antes de presentar.
