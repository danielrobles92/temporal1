@echo off
setlocal
title PERREQUE launcher

REM Carpeta donde esta este script (raiz del proyecto). Mantenlo en C:\TTS\PERREQUE
set "ROOT=%~dp0"
REM Misma ruta con / para el argumento de Java
set "ROOTF=%ROOT:\=/%"
REM JDK 21 (cambialo aqui si tu ruta es otra)
set "JDK21=C:\Users\Saibo\.jdks\ms-21.0.10"
REM Definir JAVA_HOME aqui (con comillas, sin espacio final). Las ventanas hijas lo heredan.
set "JAVA_HOME=%JDK21%"

echo ===========================================================
echo   Iniciando PERREQUE
echo   ml-service :8000   backend :8080   frontend :3000
echo ===========================================================
echo.

REM Asegurar PostgreSQL (silencioso si ya corre o no hay permisos)
net start postgresql-x64-18 >nul 2>&1

if not exist "%JDK21%\bin\java.exe" (
  echo [AVISO] No encuentro el JDK 21 en:
  echo         %JDK21%
  echo         Edita la variable JDK21 dentro de este .bat si tu ruta es otra.
  echo.
)

echo [1/3] ml-service (reconocimiento de imagenes)...
start "PERREQUE ml-service" cmd /k "cd /d %ROOT%ml-service && .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"

echo       esperando a que cargue el modelo...
timeout /t 6 /nobreak >nul

echo [2/3] backend (Spring Boot)...
start "PERREQUE backend" cmd /k "cd /d %ROOT%back\petproject && mvnw.cmd spring-boot:run -Dspring-boot.run.arguments=--app.upload-dir=%ROOTF%back/uploads"

echo [3/3] frontend (React)...
start "PERREQUE frontend" cmd /k "cd /d %ROOT%front && npm start"

echo.
echo Se abrieron 3 ventanas. Para detener un servicio, cierra su ventana.
echo El navegador abrira solo en http://localhost:3000 (la 1a vez tarda 1-2 min).
echo.
echo Puedes cerrar ESTA ventana.
pause >nul
endlocal
