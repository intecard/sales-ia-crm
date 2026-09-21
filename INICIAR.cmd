@echo off
setlocal
cd /d "%~dp0"
if not exist .env (
  echo Ejecute primero INSTALAR.cmd
  pause
  exit /b 1
)
docker compose up -d --wait --wait-timeout 300
if errorlevel 1 (
  echo No se pudo iniciar. Abra Docker Desktop y revise sus mensajes.
  pause
  exit /b 1
)
start "" http://localhost:3000
