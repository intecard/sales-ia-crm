> Documento histórico de una versión anterior. Para el estado actual consulte README.md y docs/VALIDACION_V040.md.

# Cambios de la versión 0.3.0

Se reemplazó la vista de trabajo conectada por una interfaz comercial que guarda y recupera registros reales. La demostración quedó separada.

## Errores corregidos

- Mezcla de registros ficticios en una sesión real y cambios que desaparecían al recargar.
- Uso de IDs locales después de crear un contacto en PostgreSQL.
- Borrado involuntario de etiquetas/metadata al editar parcialmente un contacto.
- Relaciones de oportunidades y pagos que aceptaban IDs pertenecientes a otra empresa.
- Códigos SKU vacíos tratados como un mismo código único.
- Configuración de Gemini vacía que impedía iniciar el servidor.
- Sesiones locales y uso del atributo Secure condicionado a la URL HTTPS.
- Ruta de sesión sin propagación de errores asíncronos.
- Docker sin herramientas de migración disponibles en runtime y sin inicialización de roles/planes.

## Mejoras

Contactos, empresas cliente, catálogo comercial, oportunidades, seguimientos, resumen por moneda, exportación CSV, roles, gestión de equipo, cambio de contraseña, auditoría, creación de embudos, disponibilidad real de base de datos y protección RLS sin acceso público.

Se incluyen instalador y accesos CMD para Windows, generación de credenciales aleatorias, persistencia de PostgreSQL, backup SQL y configuración opcional Supabase.

## Estado

Vea docs/VALIDACION.md: pruebas de código/API/navegador aprobadas; instalación real en Windows/Docker y Supabase pendientes. README.md detalla módulos externos y licenciamiento todavía no implementados de extremo a extremo.
