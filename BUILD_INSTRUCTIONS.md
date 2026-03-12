# DataTrack - Sistema de Conteo de Vehículos

## Para Usuarios (Tu amigo)

Solo necesita:
1. **Descargar DataTrack.exe**
2. **Ejecutar el archivo**
3. Se abrirá automáticamente en el navegador
4. ¡Listo para usar!

No necesita instalar nada más, Python, ni librerías.

---

## Para Desarrolladores (Compilar el EXE)

### Requisitos:
- Python 3.8+
- Todas las dependencias del proyecto (`pip install -r requirements.txt`)
- PyInstaller: `pip install pyinstaller`

### Compilar:

```bash
python build_exe.py
```

Esto generará el archivo `DataTrack.exe` en la carpeta `dist/`

### Compilación Manual (Si quieres hacerlo):

```bash
pyinstaller --name=DataTrack --onefile --windowed \
  --add-data=templates:templates \
  --add-data=static:static \
  --add-data=config:config \
  --add-data=modules:modules \
  --hidden-import=flask \
  --hidden-import=ultralytics \
  --hidden-import=cv2 \
  --hidden-import=torch \
  app.py
```

### Notas importantes:

1. **Tamaño del EXE**: Será bastante grande (~2-4 GB) debido a los modelos YOLO y librerías de ML
2. **Primera ejecución**: Puede ser lenta, espera a que inicie
3. **Puerto**: La aplicación usa `localhost:5000`
4. **Videos**: Soporta MP4, AVI, MOV, MKV (hasta 2GB)
5. **Modelos YOLO**: Asegúrate de que `yolo11n.pt` y otros modelos estén en la misma carpeta

### Estructura esperada en dist/:

```
DataTrack.exe
yolo11n.pt
yolo11s.pt
(modelos YOLO)
config/
templates/
static/
```

### Alternativa: Exe portable mejorada

Si quieres un instalador profesional, usa **NSIS** o **Inno Setup** (requiere config adicional).
