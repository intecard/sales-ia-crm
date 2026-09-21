@echo off
setlocal
cd /d "%~dp0"
if not exist respaldos mkdir respaldos
set "backupfile=respaldos\crm-%RANDOM%-%RANDOM%.sql"
docker compose exec -T postgres pg_dump -U sales_ai -d sales_ai --no-owner --no-acl > "%backupfile%"
if errorlevel 1 (
  del "%backupfile%"
  echo No se pudo crear el respaldo. Inicie el CRM primero.
  pause
  exit /b 1
)
echo Respaldo creado en %backupfile%. Guardelo tambien en su disco externo.
pause
