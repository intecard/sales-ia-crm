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

## Pendientes para cubrir íntegramente la guía

- Catálogo contable personalizable, subcuentas bancarias, auxiliares de clientes/proveedores, antigüedad por factura y conciliación bancaria por movimiento.
- Inventario valorizado y costo de ventas integrado, depreciación, nómina, moneda extranjera, flujo de efectivo clasificado y automatización del enlace factura/cobro/asiento.
- Exportadores oficiales versionados 606/607/608/609 y especializados con todos los campos, catálogos de retenciones, validadores oficiales y manejo de rectificativas.
- Liquidación y anexos IT-1, IR-17, IR-3, IR-1, IR-2 y ACT. Este módulo registra el seguimiento de estas obligaciones; no calcula ni presenta dichas declaraciones.
- Adaptador directo DGII: secuencias autorizadas, generación XML, reglas/XSD, firma, autenticación, envío, TrackId/estados, RFCE, anulaciones electrónicas, contingencia, entrega y archivo de evidencias. Requiere certificación y autorización por empresa.
- No existe garantía de operación autónoma 24/7 en Render Free.

## Referencias consultadas

- https://dgii.gov.do/herramientas/formularios/formatoEnvioDatos/Paginas/default.aspx
- https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/remisionInformacion/Paginas/formatoEnvioDatos.aspx
- https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/formatoEnvioDatos/Documents/4-LlenadoyEnvioFormato606.pdf

Las fechas generales de la guía aportada no se convierten automáticamente en vencimientos de cada RNC. Verificar el calendario vigente y las obligaciones habilitadas antes de presentar.
