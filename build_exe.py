#!/usr/bin/env python3
"""
Script para compilar DataTrack a un ejecutable (.exe) usando PyInstaller
"""
import os
import shutil
import subprocess
import sys

def build_exe():
    """Compila la aplicación a .exe"""
    
    print("=" * 60)
    print("DataTrack - Compilador a EXE")
    print("=" * 60)
    
    # Eliminar builds anteriores
    if os.path.exists('build'):
        print("[*] Eliminando compilación anterior...")
        shutil.rmtree('build')
    if os.path.exists('dist'):
        print("[*] Eliminando distribución anterior...")
        shutil.rmtree('dist')
    if os.path.exists('DataTrack.spec'):
        os.remove('DataTrack.spec')
    
    print("[*] Compilando con PyInstaller...")
    
    # Comando PyInstaller
    cmd = [
        'pyinstaller',
        '--name=DataTrack',
        '--onefile',
        '--console',  # Mostrar consola (mejor para debugeo en Windows)
        '--icon=ICON.ico',  # Cambiar a tu icon si existe
        '--add-data=templates:templates',
        '--add-data=static:static',
        '--add-data=config:config',
        '--add-data=modules:modules',
        '--hidden-import=flask',
        '--hidden-import=flask_cors',
        '--hidden-import=ultralytics',
        '--hidden-import=cv2',
        '--hidden-import=numpy',
        '--hidden-import=torch',
        '--hidden-import=torchvision',
        '--hidden-import=webbrowser',
        '--hidden-import=threading',
        '--hidden-import=time',
        'app.py'
    ]
    
    try:
        result = subprocess.run(cmd, check=True)
        print("\n[✓] Compilación completada exitosamente!")
        print("[✓] Ejecutable generado en: dist/DataTrack.exe")
        print("\n¡INSTRUCCIONES PARA TU AMIGO:")
        print("1. Descargar DataTrack.exe")
        print("2. Ejecutar el archivo")
        print("3. Se abrirá automáticamente en el navegador http://localhost:5000")
        print("4. ¡Listo para usar!")
        
    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] Error durante la compilación: {e}")
        sys.exit(1)

if __name__ == '__main__':
    build_exe()
