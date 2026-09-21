# Despliegue híbrido: Windows, macOS y web

## Resultado

Una sola instalación central sirve la página web y la API. Las aplicaciones de Windows y macOS muestran esa interfaz dentro de una ventana segura y trabajan con la misma base de datos.

## 1. Preparar el dominio

1. Contrate un servidor Linux con Docker y una dirección IPv4 pública.
2. Cree un registro DNS `A`, por ejemplo `crm.inteca.com.do`, que apunte a esa IP.
3. Abra los puertos TCP 80 y 443; permita también UDP 443 si desea HTTP/3.
4. No publique el puerto 5432 de PostgreSQL.

## 2. Configurar secretos

Copie `.env.cloud.example` como `.env.cloud`. Cambie `CRM_DOMAIN`, `POSTGRES_PASSWORD` y `APP_SECRET`. Use valores aleatorios largos y conserve una copia cifrada. No envíe este archivo por correo o mensajería.

En Linux puede generar secretos con:

```bash
openssl rand -hex 32
```

## 3. Iniciar el servicio

```bash
chmod +x INSTALAR_SERVIDOR.sh
./INSTALAR_SERVIDOR.sh
```

Compruebe `https://SU_DOMINIO/api/ready`. Caddy solicitará el certificado HTTPS cuando el DNS y los puertos sean correctos.

## 4. Aplicación Windows

En una PC Windows con Node.js 22 LTS, abra `desktop` y ejecute `COMPILAR_WINDOWS.cmd`. El instalador se genera en `desktop/release`. Al abrirlo por primera vez, introduzca la dirección HTTPS central y pulse **Probar conexión**.

## 5. Aplicación macOS

La aplicación de macOS debe compilarse en una Mac:

```bash
cd desktop
chmod +x COMPILAR_MAC.command
./COMPILAR_MAC.command
```

Para distribuirla públicamente sin advertencias de Gatekeeper necesitará una cuenta Apple Developer, firma de código y notarización. Para uso interno puede instalarse manualmente aceptando la aplicación en Privacidad y seguridad.

## 6. Uso web

Abra la misma dirección HTTPS en Chrome, Edge, Safari o Firefox. No se necesita una instalación adicional. Los usuarios y permisos son los mismos que en las aplicaciones instaladas.

## 7. Copias y actualizaciones

- Respaldar PostgreSQL antes de actualizar.
- Mantener `.env.cloud` fuera de los ZIP compartidos.
- Actualizar el servicio central primero; los clientes instalados cargan inmediatamente la interfaz nueva.
- Actualizar los instaladores solo cuando cambie el contenedor de escritorio o la seguridad de Electron.

## Límites actuales

- El modo local independiente no sincroniza automáticamente con la nube.
- La aplicación necesita Internet para usar el servicio central.
- Meta Ads y Google Ads requieren todavía sus credenciales, aprobación y conectores de publicación.
- La compilación macOS no puede producirse ni firmarse correctamente desde Windows o Linux.
