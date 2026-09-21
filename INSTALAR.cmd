@echo off
setlocal
cd /d "%~dp0"
title Sales AI CRM - Instalacion Windows
echo SALES AI CRM 0.8.0 INTECA - Instalacion local
where docker >nul 2>&1
if errorlevel 1 (
  echo Instale Docker Desktop desde https://www.docker.com/products/docker-desktop/ y vuelva a ejecutar este archivo.
  pause
  exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
  echo Abra Docker Desktop, espere a que termine de iniciar y vuelva a ejecutar este archivo.
  pause
  exit /b 1
)
docker compose version >nul 2>&1
if errorlevel 1 (
  echo Necesita Docker Desktop con Docker Compose v2 actualizado.
  pause
  exit /b 1
)
if not exist .env (
  powershell -NoProfile -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $a = New-Object byte[] 32; $b = New-Object byte[] 32; $rng.GetBytes($a); $rng.GetBytes($b); $pw = [BitConverter]::ToString($a).Replace('-', '').ToLower(); $secret = [BitConverter]::ToString($b).Replace('-', '').ToLower(); [IO.File]::WriteAllLines((Join-Path (Get-Location) '.env'), @(('POSTGRES_PASSWORD=' + $pw), ('APP_SECRET=' + $secret)), (New-Object Text.UTF8Encoding($false))); $rng.Dispose()"
  if errorlevel 1 goto failed
)
echo Descargando dependencias, preparando base de datos y compilando. Puede tardar varios minutos.
docker compose up -d --build --wait --wait-timeout 300
if errorlevel 1 goto failed
echo Instalacion lista. Cree su empresa y su usuario en la pantalla inicial.
start "" http://localhost:3000
pause
exit /b 0
:failed
echo No se completo la instalacion. No borre .env ni el volumen de datos.
echo Revise su conexion a Internet, espacio libre y Docker Desktop.
echo Para diagnosticar: docker compose logs --tail 80 app
pause
exit /b 1
