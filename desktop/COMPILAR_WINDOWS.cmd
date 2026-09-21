@echo off
setlocal
cd /d "%~dp0"
title Sales AI CRM - Crear instalador Windows
where node >nul 2>&1
if errorlevel 1 (
 echo Instale Node.js 22 LTS desde https://nodejs.org/ y vuelva a intentarlo.
 pause
 exit /b 1
)
call npm install
if errorlevel 1 goto failed
call npm run dist:windows
if errorlevel 1 goto failed
echo Instalador creado dentro de desktop\release.
pause
exit /b 0
:failed
echo No se pudo crear el instalador. Revise la conexion y el espacio disponible.
pause
exit /b 1
