@echo off
setlocal enabledelayedexpansion
title PERREQUE stop

echo ===========================================================
echo   Deteniendo PERREQUE (ml-service 8000, backend 8080, front 3000)
echo ===========================================================
echo.

REM 1) Detener por PUERTO (lo mas fiable: mata el proceso que escucha)
for %%P in (8000 8080 3000) do (
  set "found="
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr :%%P ^| findstr LISTENING') do (
    set "found=1"
    taskkill /F /PID %%I >nul 2>&1
  )
  if defined found (echo   puerto %%P: detenido) else (echo   puerto %%P: nada escuchando)
)

REM 2) Cerrar las ventanas del lanzador y sus procesos hijos (por si quedan)
taskkill /FI "WINDOWTITLE eq PERREQUE ml-service*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq PERREQUE backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq PERREQUE frontend*" /T /F >nul 2>&1

echo.
echo Listo. Puedes cerrar esta ventana.
timeout /t 3 /nobreak >nul
endlocal
