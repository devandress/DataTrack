# ✅ Checklist Antes de Compilar para Windows

Ejecuta estos pasos en Linux antes de pasar a Windows:

## 1. Verificar que app.py inicia sin errores

```bash
python3 app.py
```

Deberías ver:
- `[HARDWARE] {...}` (información de hardware)
- `🚀 DataTrack iniciado`
- `📱 Accediendo a: http://localhost:5000`
- Se abre navegador automáticamente

✅ **PASÓ**: Continúa
❌ **FALLÓ**: Revisa errores en la terminal, asegúrate que no hay otro proceso en puerto 5000

---

## 2. Verificar interfaz web

En el navegador que se abre, deberías ver:
- Header con logo TEC y colores Tecnm (azul marino)
- Botón "Seleccionar Video"
- Herramientas de dibujo (Rectángulo, Polígono)
- Panel de configuración
- Tabla de resultados (vacía inicialmente)

✅ **PASÓ**: Todo está listo
❌ **FALLÓ**: Revisa console del navegador (F12)

---

## 3. Verificar que se abre navegador automáticamente

- Cierra el navegador
- Mata el proceso: `pkill -f "python3 app.py"`
- Ejecuta de nuevo: `python3 app.py`
- Verifica que se abre automáticamente

✅ **PASÓ**: La función webbrowser funciona
❌ **FALLÓ**: Puede que webbrowser no esté disponible en tu entorno

---

## 4. Compilar EXE en Windows

Una vez que todo funciona en Linux, en una PC Windows:

```powershell
powershell -ExecutionPolicy Bypass -File build_msi.ps1
```

Esto generará:
- `dist\DataTrack.exe` (aplicación compilada)
- `Output\DataTrack-Installer.exe` (instalador listo)

---

## 5. Distribuir a tu amigo

Envía solo este archivo:
- `Output\DataTrack-Installer.exe` (≈800MB - 1.5GB)

Tu amigo:
1. Ejecuta el instalador
2. Sigue pasos (siguiente, siguiente, siguiente, terminar)
3. Se crea acceso directo en escritorio
4. ¡Listo para usar!

---

## 🔍 Verificación Final

```bash
# 1. Matar cualquier proceso anterior
pkill -f "python3 app.py" || true

# 2. Iniciar app
python3 app.py

# 3. Dejar ejecutando y abrir http://localhost:5000 en navegador
# 4. Cargar un video pequeño y probar funcionalidad básica
# 5. Presionar Ctrl+C para terminar

echo "✅ Listo para compilar en Windows"
```

---

**Cuando todo funcione aquí, el ejecutable de Windows funcionará idénticamente.**
