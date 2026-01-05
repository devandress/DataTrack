#!/bin/bash
# Resumen de la nueva versión DataTrack YOLO11
# Cambios principales realizados

cat << 'EOF'

╔════════════════════════════════════════════════════════════════════════╗
║                   DataTrack YOLO11 - Completamente Reescrito          ║
║                         Sistema de Conteo de Vehículos                 ║
╚════════════════════════════════════════════════════════════════════════╝

✅ ARQUITECTURA COMPLETAMENTE NUEVA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 ESTRUCTURA DE DIRECTORIOS:
  DataTrack/
  ├── app.py                         (Servidor Flask principal)
  ├── requirements.txt               (Dependencias Python)
  ├── run.bat / run.sh              (Scripts de inicio)
  ├── README.md                     (Documentación)
  │
  ├── modules/
  │   ├── __init__.py
  │   ├── hardware_optimizer.py     (Auto-detección GPU/CPU)
  │   ├── video_processor.py        (Procesamiento con YOLO11)
  │   └── multiprocessing_manager.py (Paralelización)
  │
  ├── templates/
  │   └── index.html                (UI moderna con Tailwind CSS)
  │
  ├── static/js/
  │   └── main.js                   (Lógica frontend JavaScript)
  │
  ├── config/
  │   └── hardware_profiles.yaml    (Perfiles de optimización)
  │
  ├── uploads/                      (Videos temporales)
  ├── results/                      (Resultados procesados)
  └── .gitignore                    (Ignora modelos y uploads)


🎯 CARACTERÍSTICAS PRINCIPALES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Hardware Optimizer:
  • Detección automática GPU NVIDIA vs CPU
  • Información en tiempo real: GPU VRAM, RAM total, núcleos CPU
  • 4 perfiles adaptativos:
    - GPU_HIGH:  VRAM >= 8GB (batch 32, workers 8, skip 1, conf 0.5)
    - GPU_LOW:   VRAM  < 8GB (batch 16, workers 4, skip 2, conf 0.6)
    - CPU_HIGH:  Núcleos >= 8 (batch 8, workers 6, skip 3, conf 0.65)
    - CPU_LOW:   Núcleos  < 8 (batch 4, workers 2, skip 5, conf 0.7)

🎬 Video Processor:
  • Modelo YOLO11 nano (ligero y rápido)
  • Detección de 4 clases de vehículos:
    - 🚗 Carros
    - 🏍️ Motocicletas
    - 🚌 Buses
    - 🚚 Camiones
  • Conteo por tipo de vehículo
  • Soporte para múltiples regiones (polígonos)
  • Tracking persistente con Ultralytics

🌐 Frontend Moderno:
  • Interfaz con Tailwind CSS (responsive)
  • Drag & drop para subida de videos
  • Dibujo interactivo de polígonos
  • Controles deslizantes para:
    - Confianza de detección
    - Skip de frames
  • Selección de tipos de vehículos
  • Gráficos en tiempo real con Chart.js
  • Exportación CSV/JSON

📊 API Endpoints:
  GET  /                           (Página principal)
  GET  /api/hardware-info          (Info del hardware)
  POST /api/upload                 (Subir video)
  POST /api/process                (Procesar video)
  GET  /api/status/<job_id>        (Estado del job)
  GET  /api/results/<job_id>       (Obtener resultados)
  GET  /api/export-csv/<job_id>    (Exportar CSV)
  GET  /api/jobs                   (Listar todos los jobs)
  DELETE /api/cleanup/<job_id>     (Limpiar recursos)


🚀 CÓMO USAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Windows:
  1. run.bat (Ejecuta automáticamente todo)
  2. Navega a http://localhost:5000

Linux/Mac:
  1. chmod +x run.sh
  2. ./run.sh
  3. Navega a http://localhost:5000

Manual:
  1. source venv/bin/activate
  2. pip install -r requirements.txt
  3. python app.py
  4. Abre http://localhost:5000


🔧 FLUJO DE PROCESAMIENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Usuario sube video
   └─> Validación de formato (MP4, AVI, MOV, MKV)
   └─> Almacenamiento temporal en uploads/

2. Hardware Optimizer detecta disponibilidad
   └─> Selecciona perfil automático
   └─> Ajusta parámetros

3. Video Processor inicia
   └─> Carga modelo YOLO11
   └─> Procesa frames (según frame_skip)
   └─> Detecta vehículos (según confidence threshold)

4. Conteo y Análisis
   └─> Agrupa por tipo
   └─> Cuenta por región (si hay polígonos)
   └─> Genera estadísticas

5. Exportación
   └─> CSV con resumen
   └─> JSON con detalles completos
   └─> Limpieza automática de temporales


💾 TECNOLOGÍAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Backend:
  • Flask 3.1.2 - Framework web
  • Ultralytics 8.3.247 - YOLO11 detection
  • OpenCV 4.12 - Procesamiento de video
  • PyTorch 2.9.1 - Deep learning
  • NumPy 2.2.6 - Computación numérica
  • PSUtil 7.2.1 - Información de hardware

Frontend:
  • HTML5 + Vanilla JavaScript (sin frameworks pesados)
  • Tailwind CSS 4 - Diseño responsive
  • Chart.js - Gráficos interactivos
  • Canvas API - Dibujo de polígonos

Optimización:
  • CUDA 12.8 - Aceleración GPU NVIDIA
  • Multiprocessing - Paralelización
  • Batch processing dinámico
  • Gestión eficiente de memoria


📈 VENTAJAS VS VERSIÓN ANTERIOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Antes:
  ✗ Arquitectura simple
  ✗ Sin optimización de hardware
  ✗ Parámetros fijos
  ✗ CSV básico

Ahora:
  ✅ Arquitectura modular profesional
  ✅ Optimización automática GPU/CPU
  ✅ Parámetros adaptativos
  ✅ CSV/JSON detallados
  ✅ UI moderna con Tailwind
  ✅ Gráficos en tiempo real
  ✅ Soporte múltiples regiones
  ✅ Exportación flexible


🎓 EJEMPLO DE USO COMPLETO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Abres http://localhost:5000
   └─> Ves info: GPU CUDA, 3.68GB VRAM, 12 núcleos

2. Cargas un video de 5 minutos
   └─> Sistema detecta automáticamente

3. Dibujas 3 polígonos en regiones de interés
   └─> Visualización en tiempo real

4. Ajustas Confianza a 0.65 y Frame Skip a 2
   └─> Para más velocidad

5. Clickeas "Iniciar Conteo"
   └─> Progreso en tiempo real
   └─> Detecta: 127 carros, 34 motos, 8 buses, 12 camiones

6. Resultados mostrados en gráficos
   └─> Distribución por tipo
   └─> Resumen por región
   └─> Total de vehículos

7. Exportas como CSV
   └─> Descarga "results_<id>.csv"
   └─> Tabla formateada para Excel


⚙️ CONFIGURACIÓN AUTOMÁTICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

El sistema detecta automáticamente:

GPU NVIDIA disponible?
  ↓
  SI → ¿VRAM >= 8GB?
  │    ├─ SÍ → GPU_HIGH (batch 32, workers 8, conf 0.5)
  │    └─ NO → GPU_LOW (batch 16, workers 4, conf 0.6)
  │
  NO → ¿CPU >= 8 núcleos?
       ├─ SÍ → CPU_HIGH (batch 8, workers 6, conf 0.65)
       └─ NO → CPU_LOW (batch 4, workers 2, conf 0.7)


✅ PRÓXIMOS PASOS OPCIONALES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• PyInstaller para crear .exe
• Dashboard persistente con SQLite
• Procesamiento de múltiples videos en cola
• Webhook para integración con sistemas externos
• Soporte para streams en vivo
• Exportación a PDF con gráficos

╔════════════════════════════════════════════════════════════════════════╗
║              🎉 DataTrack YOLO11 Listo para Usar 🎉                   ║
║          Hecho por Fernando Andrés Alemán Escobedo - 2026             ║
╚════════════════════════════════════════════════════════════════════════╝

EOF
