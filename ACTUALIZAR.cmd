@echo off
setlocal
cd /d "%~dp0"
title Sales AI CRM - Actualizacion con respaldo
if not exist .env (
 echo Falta .env. Copie esta actualizacion en la carpeta instalada conservando el .env original.
 pause
 exit /b 1
)
if not exist respaldos mkdir respaldos
set "backupfile=respaldos\antes-v040-%RANDOM%-%RANDOM%.sql"
docker compose exec -T postgres pg_dump -U sales_ai -d sales_ai --no-owner --no-acl > "%backupfile%"
if errorlevel 1 (
 del "%backupfile%"
 echo No se pudo respaldar. Abra Docker e inicie la instalacion anterior antes de actualizar.
 pause
 exit /b 1
)
echo Respaldo guardado en %backupfile%.
call INSTALAR.cmd
