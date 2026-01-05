@echo off
REM DataTrack - Sistema de Conteo de Vehículos con YOLO11
REM Script de inicio para Windows

echo.
echo =====================================
echo   DataTrack - Iniciando...
echo =====================================
echo.

REM Crear entorno virtual si no existe
if not exist venv (
    echo Creando entorno virtual...
    python -m venv venv
)

REM Activar entorno virtual
call venv\Scripts\activate.bat

REM Instalar dependencias si es necesario
pip install -q -r requirements.txt

REM Descargar modelo YOLO11 si es necesario
python -c "from ultralytics import YOLO; YOLO('yolo11n.pt')"

REM Iniciar servidor Flask
echo.
echo ✓ Iniciando servidor Flask en http://localhost:5000
echo.
python app.py

pause
