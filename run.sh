#!/bin/bash
# DataTrack - Sistema de Conteo de Vehículos con YOLO11
# Script de inicio para Linux/Mac

echo ""
echo "====================================="
echo "  DataTrack - Iniciando..."
echo "====================================="
echo ""

# Crear entorno virtual si no existe
if [ ! -d "venv" ]; then
    echo "Creando entorno virtual..."
    python3 -m venv venv
fi

# Activar entorno virtual
source venv/bin/activate

# Instalar dependencias
pip install -q -r requirements.txt

# Descargar modelo YOLO11
python -c "from ultralytics import YOLO; YOLO('yolo11n.pt')"

# Iniciar servidor Flask
echo ""
echo "✓ Iniciando servidor Flask en http://localhost:5000"
echo ""
python app.py
