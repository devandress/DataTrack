# DataTrack - Sistema de Conteo de Vehículos con YOLO11

## Descripción

DataTrack es una aplicación web para contar vehículos en videos usando YOLO11 con:
- Detección inteligente de hardware (CPU/GPU)
- Procesamiento multihilo adaptativo
- Interfaz interactiva con dibujo de polígonos
- Exportación de resultados en CSV y JSON

## Instalación Rápida

### Windows
```bash
# 1. Clonar repositorio
git clone <repo>
cd DataTrack

# 2. Ejecutar script de inicio
run.bat
```

### Linux/Mac
```bash
# 1. Clonar repositorio
git clone <repo>
cd DataTrack

# 2. Ejecutar script de inicio
chmod +x run.sh
./run.sh
```

### Manual
```bash
# Crear entorno virtual
python -m venv venv

# Activar (Windows)
venv\Scripts\activate
# Activar (Linux/Mac)
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar
python app.py
```

## Uso

1. **Abrir en navegador**: http://localhost:5000
2. **Cargar video**: Arrastrar o seleccionar archivo MP4/AVI/MOV/MKV
3. **Dibujar regiones**: Usar herramienta de polígonos
4. **Configurar**: Ajustar confianza y frame skip
5. **Procesar**: Iniciar conteo
6. **Exportar**: Descargar resultados CSV/JSON

## Características

✅ Detección automática de GPU/CPU  
✅ Conteo en múltiples regiones  
✅ Soporte para 4 tipos de vehículos  
✅ Visualización en tiempo real  
✅ Exportación de datos  
✅ Interfaz responsive  

## Requisitos

- Python 3.9+
- 8GB RAM (mínimo)
- GPU NVIDIA (opcional pero recomendado)
- 2GB espacio en disco

## Stack

- Backend: Flask, YOLO11, OpenCV
- Frontend: HTML5, Vanilla JS, Tailwind CSS
- Hardware: PyTorch, CUDA (opcional)

## Hecho por

Fernando Andrés Alemán Escobedo
