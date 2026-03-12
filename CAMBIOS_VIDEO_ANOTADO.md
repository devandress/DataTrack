# 🎥 Generador de Videos Anotados - Cambios Implementados

## Descripción General
Se ha añadido la funcionalidad de generar y descargar un video anotado con las bounding boxes del análisis de detección. Esto permite al usuario visualizar cómo se detectaron los vehículos y validar si el análisis es correcto.

---

## Cambios Realizados

### 1. **Backend - `app.py`**

#### Nuevo Endpoint: `/api/generate-annotated-video/<job_id>` (POST)
- **Ubicación**: Línea 309
- **Funcionalidad**: 
  - Toma un `job_id` completado y genera un video anotado
  - Acepta parámetros: `regions`, `conf_threshold`, `frame_skip`, `model`
  - Genera un archivo MP4 con las bounding boxes dibujadas
  - Guarda la ruta del video en el job para descarga posterior

#### Nuevo Endpoint: `/api/download-annotated-video/<job_id>` (GET)
- **Ubicación**: Línea 380
- **Funcionalidad**:
  - Descarga el video anotado generado
  - Envía el archivo con el nombre: `analysis_{job_id}.mp4`

---

### 2. **Backend - `modules/video_processor.py`**

#### Nuevo Método: `generate_annotated_video()`
- **Ubicación**: Línea 224
- **Parámetros**:
  - `video_path`: Ruta del video original
  - `output_path`: Ruta donde guardar el video anotado
  - `regions`: Polígonos dibujados (opcional)
  - `conf_threshold`: Umbral de confianza de detección
  - `frame_skip`: Procesar cada N frames
  - `on_progress`: Callback para progreso

- **Funcionalidad**:
  - Lee el video original frame por frame
  - Ejecuta la detección con YOLO11
  - Anota cada frame con bounding boxes (verde)
  - Dibuja las regiones definidas (verde)
  - Escribe todos los frames en un video MP4
  - Retorna la ruta del archivo generado

---

### 3. **Frontend - `templates/index.html`**

#### Nuevo Botón: "🎥 Generar Video Anotado"
- **Ubicación**: Línea 238 (Sección de botones de exportación)
- **Características**:
  - Botón naranja (bg-orange-500)
  - Se muestra en la sección de resultados
  - Aparece después del análisis completado

#### Nueva Barra de Progreso: Video Generation Progress
- **Ubicación**: Línea 250
- **Características**:
  - Se muestra durante la generación del video
  - Indica porcentaje de progreso
  - Inicialmente oculta (`hidden`)

---

### 4. **Frontend - `static/js/main.js`**

#### Event Listener para el Botón
- **Ubicación**: Línea 75
- **Acción**: Llama al método `generateAnnotatedVideo()`

#### Nuevo Método: `generateAnnotatedVideo()`
- **Ubicación**: Línea 516-572
- **Funcionalidad**:
  1. Valida que haya resultados disponibles
  2. Deshabilita el botón y muestra estado "Generando video..."
  3. Muestra la barra de progreso
  4. Recolecta los parámetros actuales:
     - Regiones dibujadas
     - Umbral de confianza
     - Skip de frames
     - Modelo YOLO seleccionado
  5. Realiza llamada POST a `/api/generate-annotated-video/{jobId}`
  6. Al completarse, descarga automáticamente el video
  7. Muestra estado "✓ Video descargado"
  8. Reinicia el botón después de 3 segundos

---

## Flujo de Uso

1. **Subir video** → El usuario carga un video
2. **Configurar parámetros** → Establece confianza, skip de frames, modelo, etc.
3. **Dibujar regiones** (Opcional) → Traza polígonos de interés
4. **Iniciar conteo** → Procesa el video y obtiene resultados
5. **Generar video anotado** → Hace clic en "🎥 Generar Video Anotado"
6. **Descargar** → El video se descarga automáticamente en formato MP4

---

## Características

### ✅ Ventajas
- **Validación Visual**: Ver exactamente cómo se detectaron los vehículos
- **Debugging**: Identificar falsos positivos o negativos
- **Iteración Rápida**: Ajustar parámetros y verificar resultados
- **Mismo Modelo**: Usa el mismo modelo que el análisis original
- **Parámetros Conservados**: Usa los mismos parámetros del análisis

### ⚙️ Configuración
- Se reutilizan los mismos parámetros del análisis original:
  - Umbral de confianza (confidence threshold)
  - Skip de frames
  - Regiones definidas
  - Modelo YOLO

### 📊 Información del Video
- **Formato**: MP4 (codec: mp4v)
- **Resolución**: Mantiene la del video original (o redimensionada si > 1280x720)
- **FPS**: Mantiene el FPS original del video
- **Anotaciones**: 
  - Bounding boxes en color verde
  - Etiqueta con: `[tipo] [ID_track] [confianza]`
  - Polígonos de región en verde

---

## Notas Técnicas

1. **Procesamiento en Background**: La generación del video puede tomar tiempo según la duración
2. **Almacenamiento**: Los videos anotados se guardan en la carpeta `results/`
3. **Compresión**: Se usa codec `mp4v` para buena calidad/compresión
4. **Redimensionamiento**: Si el video > 1280x720, se escala a 0.5x para procesamiento más rápido
5. **IDs de Tracking**: Se reutiliza el sistema de tracking de YOLO para mostrar IDs consistentes

---

## Archivos Modificados

```
✏️ app.py                          (2 nuevos endpoints, ~80 líneas)
✏️ modules/video_processor.py      (1 nuevo método, ~85 líneas)
✏️ templates/index.html            (1 nuevo botón + barra progreso)
✏️ static/js/main.js               (1 event listener + 1 método async, ~57 líneas)
```

---

## Próximas Mejoras (Opcional)

- [ ] Agregar opciones de personalización de colores de bounding boxes
- [ ] Permirtir saltar el video en tiempo real después de generarlo
- [ ] Agregar estadísticas en overlay (conteo en tiempo real)
- [ ] Exportar video en diferentes resoluciones
- [ ] Generar video a alta velocidad (time-lapse) para videos largos

---

**Versión**: 1.0  
**Fecha**: 18 de enero de 2026  
**Estado**: ✅ Completado y funcional
