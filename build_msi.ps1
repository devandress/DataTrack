# Script para compilar DataTrack a MSI/EXE instalador en Windows
# Ejecutar con: powershell -ExecutionPolicy Bypass -File build_msi.ps1

Write-Host "================== DataTrack MSI Builder ==================" -ForegroundColor Cyan
Write-Host "Sistema de Conteo de Vehículos con YOLO11" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# Variables
$PYTHON_CMD = "python"
$INNO_SETUP = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
$PROJECT_PATH = Get-Location
$DIST_PATH = "$PROJECT_PATH\dist"
$OUTPUT_PATH = "$PROJECT_PATH\Output"

# Función para mostrar errores
function Show-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

# Función para mostrar éxito
function Show-Success {
    param([string]$Message)
    Write-Host "[✓] $Message" -ForegroundColor Green
}

# Función para mostrar info
function Show-Info {
    param([string]$Message)
    Write-Host "[*] $Message" -ForegroundColor Yellow
}

# 1. Verificar Python
Write-Host ""
Show-Info "Verificando Python..."
try {
    $pythonVersion = & $PYTHON_CMD --version 2>&1
    Show-Success "Python encontrado: $pythonVersion"
} catch {
    Show-Error "Python no encontrado. Instálalo desde https://python.org"
}

# 2. Verificar dependencias
Show-Info "Verificando dependencias..."
try {
    & $PYTHON_CMD -c "import pyinstaller" 2>&1 | Out-Null
} catch {
    Show-Info "Instalando PyInstaller..."
    & $PYTHON_CMD -m pip install pyinstaller -q
}

# 3. Compilar a EXE con PyInstaller
Write-Host ""
Show-Info "Compilando aplicación con PyInstaller..."
Show-Info "Esto puede tomar 5-10 minutos..."

$buildScript = @"
import subprocess
import shutil
import os

print("[*] Limpiando compilaciones anteriores...")
for folder in ['build', 'dist']:
    if os.path.exists(folder):
        shutil.rmtree(folder)
if os.path.exists('DataTrack.spec'):
    os.remove('DataTrack.spec')

print("[*] Compilando con PyInstaller...")
cmd = [
    'pyinstaller',
    '--name=DataTrack',
    '--onefile',
    '--console',
    '--add-data=templates;templates',
    '--add-data=static;static',
    '--add-data=config;config',
    '--add-data=modules;modules',
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
    '--distpath=dist',
    'app.py'
]

result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode == 0:
    print("[✓] Compilación completada")
else:
    print("[ERROR] " + result.stderr)
    exit(1)
"@

$buildScript | & $PYTHON_CMD
if ($LASTEXITCODE -ne 0) {
    Show-Error "Error durante compilación con PyInstaller"
}
Show-Success "Aplicación compilada a EXE"

# 4. Verificar Inno Setup
Write-Host ""
Show-Info "Verificando Inno Setup..."
if (-not (Test-Path $INNO_SETUP)) {
    Show-Error "Inno Setup no encontrado en: $INNO_SETUP"
    Write-Host "Descárgalo desde: https://www.innosetup.com/isdl.php" -ForegroundColor Yellow
    exit 1
}
Show-Success "Inno Setup encontrado"

# 5. Crear carpeta Output
if (-not (Test-Path $OUTPUT_PATH)) {
    New-Item -ItemType Directory -Path $OUTPUT_PATH -Force | Out-Null
    Show-Success "Carpeta Output creada"
}

# 6. Compilar MSI con Inno Setup
Write-Host ""
Show-Info "Compilando instalador con Inno Setup..."
& $INNO_SETUP "$PROJECT_PATH\DataTrack.iss"

if ($LASTEXITCODE -eq 0) {
    Show-Success "¡Instalador creado exitosamente!"
    Write-Host ""
    Write-Host "Archivo: $OUTPUT_PATH\DataTrack-Installer.exe" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Para generar MSI desde el instalador EXE:" -ForegroundColor Yellow
    Write-Host "  1. Ejecuta: DataTrack-Installer.exe" -ForegroundColor Gray
    Write-Host "  2. Sigue los pasos del instalador" -ForegroundColor Gray
    Write-Host ""
} else {
    Show-Error "Error compilando con Inno Setup"
}

Write-Host "=========================================================" -ForegroundColor Cyan
