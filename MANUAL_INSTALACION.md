# 📊 DataTrack - Sistema de Conteo de Vehículos

## 🚀 Para Tu Amigo (Usuario Final)

### Instalación Rápida:

1. **Descargar el instalador**
   - Obtén `DataTrack-Installer.exe` 

2. **Instalar**
   - Haz doble clic en `DataTrack-Installer.exe`
   - Sigue los pasos del instalador
   - ¡Listo! Se creará un acceso directo en tu escritorio

3. **Usar DataTrack**
   - Haz clic en el icono de DataTrack en tu escritorio
   - Se abrirá automáticamente en tu navegador
   - Abre en: `http://localhost:5000`

### Requisitos Mínimos:
- Windows 10 o superior
- 4GB RAM mínimo
- 2GB espacio en disco para modelos YOLO
- Navegador actualizado (Chrome, Firefox, Edge)

### Características:
✅ Dibuja áreas de detección (rectángulos y polígonos)  
✅ Detección automática de vehículos con IA  
✅ Conteo de vehiculos por región  
✅ Generación de video anotado  
✅ Exportar datos (CSV/JSON)  

---

## 💻 Para Desarrolladores (Crear el Instalador)

### En Windows:

#### Paso 1: Descargar Inno Setup
- Ir a: https://www.innosetup.com/isdl.php
- Descargar e instalar

#### Paso 2: Ejecutar el compilador
```powershell
# Abrir PowerShell como Administrador en la carpeta del proyecto
powershell -ExecutionPolicy Bypass -File build_msi.ps1
```

O manualmente:
1. Abrir `DataTrack.iss` con Inno Setup
2. Click en `Build` → `Compile`
3. Se genera el instalador en `Output/`

#### Paso 3: Distribuir
- Encuentra: `Output/DataTrack-Installer.exe`
- Comparte con tu amigo
- ¡Listo!

### Estructura de Carpetas Esperada:
```
DataTrack/
├── app.py
├── requirements.txt
├── build_msi.ps1          ← Script compilador
├── DataTrack.iss          ← Configuración del instalador
├── LICENSE.txt
├── yolo11n.pt             ← Modelos YOLO (descargar)
├── yolo11s.pt
├── yolo11m.pt
├── yolo11l.pt
├── config/
├── static/
├── templates/
├── modules/
└── dist/                  ← Se genera aquí el EXE
    └── DataTrack.exe
```

### Solución de Problemas:

**Error: "Inno Setup no encontrado"**
- Instala Inno Setup desde: https://www.innosetup.com

**Error: "Python no encontrado"**
- Instala Python desde: https://python.org
- Asegúrate de marcar "Add Python to PATH"

**El instalador es muy grande (>3GB)**
- Normal debido a modelos YOLO + librerías ML
- Puedes comprimir con 7-Zip si es necesario

---

## 📝 Datos Técnicos

**Tecnologías Usadas:**
- Backend: Flask + Python
- Frontend: HTML5 + JavaScript + TailwindCSS
- Detección: YOLO11 (Ultralytics)
- Video: OpenCV
- Visualización: Chart.js

**Modelos YOLO Incluidos:**
- yolo11n (Nano - Rápido)
- yolo11s (Small - Balanceado)
- yolo11m (Medium - Preciso)
- yolo11l (Large - Muy preciso)

**Clases Detectadas:**
- 🚗 Carros
- 🏍️ Motocicletas  
- 🚌 Buses
- 🚚 Camiones

---

## 🎯 Uso Básico

1. **Cargar video**: Arrastra un video MP4/AVI/MOV a la zona indicada
2. **Dibujar áreas**: Usa el botón "Rectángulo" o "Polígono"
3. **Configurar**: Selecciona modelo YOLO y ajusta confianza
4. **Procesar**: Click en "Iniciar Conteo"
5. **Ver resultados**: Resultados se muestran en tiempo real
6. **Descargar**: Exporta como CSV o JSON

---

## 📧 Soporte

Para reportar bugs o sugerencias:
- Fernando Andrés Alemán Escobedo
- Tecnológico Nacional de México - Instituto Tecnológico de Tijuana

---

**Versión:** 1.0.0  
**Última actualización:** Enero 2026  
**Licencia:** MIT
