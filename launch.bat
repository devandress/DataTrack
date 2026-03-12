@echo off
title DataTrack
cd /d "%~dp0"

REM Check if venv exists, create if not
if not exist "venv\Scripts\python.exe" (
    echo Creando entorno virtual...
    python -m venv venv
    echo Instalando dependencias...
    venv\Scripts\pip install -r requirements.txt
)

echo.
echo ========================================
echo   DataTrack v2.0
echo   Iniciando servidor...
echo ========================================
echo.

venv\Scripts\python app.py
pause
