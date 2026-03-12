@echo off
REM Archivo por lotes rápido para generar ZIP portable
REM Ejecutar DESPUÉS de build_exe.bat (opción 2)

setlocal enabledelayedexpansion

echo.
echo ============== Comprimiendo Carpeta Portable ==============
echo.

if not exist "DataTrack-Portable" (
    echo [ERROR] Carpeta DataTrack-Portable no encontrada
    echo Primero ejecuta: build_exe.bat
    echo Y elige opcion 2
    pause
    exit /b 1
)

REM Crear ZIP
echo [*] Comprimiendo DataTrack-Portable...
REM Usando PowerShell para comprimir (disponible en Windows 10+)
powershell -Command "Compress-Archive -Path 'DataTrack-Portable' -DestinationPath 'DataTrack-Portable.zip' -Force"

if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compresion
    pause
    exit /b 1
)

echo.
echo ============================================================
echo [OK] ¡Archivo ZIP generado!
echo ============================================================
echo.
echo Archivo: DataTrack-Portable.zip
echo.
echo Puedes compartir este archivo con tu amigo
echo Tu amigo solo necesita:
echo   1. Descargar DataTrack-Portable.zip
echo   2. Extraer la carpeta
echo   3. Ejecutar DataTrack.exe
echo.
pause
