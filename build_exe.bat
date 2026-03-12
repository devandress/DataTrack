@echo off
REM Script para compilar DataTrack a EXE directamente en Windows
REM Ejecutar como: build_exe.bat

setlocal enabledelayedexpansion

echo.
echo ================== DataTrack - Compilador EXE ==================
echo Sistema de Conteo de Vehiculos con YOLO11
echo ================================================================
echo.

REM 1. Verificar Python
echo [*] Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no encontrado. Instálalo desde https://python.org
    pause
    exit /b 1
)
for /f "tokens=*" %%A in ('python --version 2^>^&1') do (
    echo [OK] %%A encontrado
)

REM 2. Instalar PyInstaller si no existe
echo.
echo [*] Verificando PyInstaller...
python -c "import pyinstaller" >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Instalando PyInstaller...
    python -m pip install pyinstaller -q
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo instalar PyInstaller
        pause
        exit /b 1
    )
)
echo [OK] PyInstaller disponible

REM 3. Limpiar compilaciones anteriores
echo.
echo [*] Limpiando compilaciones anteriores...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist DataTrack.spec del DataTrack.spec
echo [OK] Limpieza completada

REM 4. Compilar con PyInstaller
echo.
echo [*] COMPILANDO CON PYINSTALLER (esto puede tomar 10-15 minutos)
echo [*] Por favor espera...
echo.

python -m PyInstaller ^
    --name=DataTrack ^
    --onefile ^
    --console ^
    --add-data="templates;templates" ^
    --add-data="static;static" ^
    --add-data="config;config" ^
    --add-data="modules;modules" ^
    --hidden-import=flask ^
    --hidden-import=flask_cors ^
    --hidden-import=ultralytics ^
    --hidden-import=cv2 ^
    --hidden-import=numpy ^
    --hidden-import=torch ^
    --hidden-import=torchvision ^
    --hidden-import=webbrowser ^
    --hidden-import=threading ^
    --hidden-import=time ^
    --distpath=dist ^
    app.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Fallo la compilacion con PyInstaller
    pause
    exit /b 1
)

echo.
echo ================================================================
echo [OK] ¡COMPILACION EXITOSA!
echo ================================================================
echo.
echo Archivo generado: dist\DataTrack.exe
echo.
echo OPCIONES:
echo.
echo OPCION 1: Ejecutable directo
echo   Compartir: dist\DataTrack.exe
echo   Tu amigo simplemente ejecuta el .exe
echo   Peso: ~1-2 GB (incluye Python, librerías, modelos)
echo.
echo OPCION 2: Carpeta portable
echo   1. Copia dist\DataTrack.exe a una carpeta nueva
echo   2. Copia tambien: yolo11*.pt, config/, templates/, static/
echo   3. Comprime la carpeta en ZIP
echo   4. Compartir el ZIP (~2-3 GB)
echo.
echo OPCION 3: Crear instalador (opcional)
echo   powershell -ExecutionPolicy Bypass -File build_msi.ps1
echo.

REM Preguntar qué hacer
echo ¿Qué deseas hacer ahora?
echo.
echo 1 - Nada (solo crear el EXE)
echo 2 - Crear carpeta portable (RECOMENDADO)
echo 3 - Crear instalador MSI
echo.
set /p choice="Elige (1/2/3): "

if "%choice%"=="1" (
    echo.
    echo Tu archivo esta listo: dist\DataTrack.exe
    echo Puedes compartirlo directamente con tu amigo
    pause
    exit /b 0
)

if "%choice%"=="2" (
    echo.
    echo [*] Creando carpeta portable...
    if not exist "DataTrack-Portable" mkdir "DataTrack-Portable"
    
    echo [*] Copiando ejecutable...
    copy "dist\DataTrack.exe" "DataTrack-Portable\" >nul
    
    echo [*] Copiando modelos YOLO...
    if exist "yolo11n.pt" copy "yolo11n.pt" "DataTrack-Portable\" >nul
    if exist "yolo11s.pt" copy "yolo11s.pt" "DataTrack-Portable\" >nul
    if exist "yolo11m.pt" copy "yolo11m.pt" "DataTrack-Portable\" >nul
    if exist "yolo11l.pt" copy "yolo11l.pt" "DataTrack-Portable\" >nul
    
    echo [*] Copiando configuracion...
    xcopy "config" "DataTrack-Portable\config" /E /I /Y >nul
    xcopy "templates" "DataTrack-Portable\templates" /E /I /Y >nul
    xcopy "static" "DataTrack-Portable\static" /E /I /Y >nul
    
    echo [*] Creando archivo README...
    (
        echo.
        echo ========== DataTrack - Instrucciones ==========
        echo.
        echo 1. Extrae esta carpeta en la ubicacion deseada
        echo 2. Haz doble-click en DataTrack.exe
        echo 3. Se abrira automaticamente en tu navegador
        echo 4. ¡Listo para usar!
        echo.
        echo Requisitos: Windows 10/11 64-bit
        echo Navegador: Chrome, Edge o Firefox
        echo Puerto: http://localhost:5000
        echo.
    ) > "DataTrack-Portable\LEEME.txt"
    
    echo [OK] Carpeta portable creada!
    echo.
    echo Ubicacion: DataTrack-Portable\
    echo.
    echo Ahora puedes:
    echo 1. Comprimir DataTrack-Portable en ZIP
    echo 2. Compartir el ZIP con tu amigo
    echo 3. Tu amigo extrae el ZIP y ejecuta DataTrack.exe
    echo.
    pause
    exit /b 0
)

if "%choice%"=="3" (
    echo.
    echo [*] Compilando instalador MSI...
    powershell -ExecutionPolicy Bypass -File build_msi.ps1
    pause
    exit /b 0
)

echo Opcion invalida
pause
exit /b 1
