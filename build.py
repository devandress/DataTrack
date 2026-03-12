"""
Build script - Creates the Windows executable for DataTrack
Usage: python build.py
"""
import PyInstaller.__main__
import os
import sys
import shutil

APP_NAME = 'DataTrack'
ICON = None  # Set path to .ico file if available

# Separator for --add-data: ';' on Windows, ':' on Linux/Mac
SEP = ';' if sys.platform == 'win32' else ':'


def build():
    # Clean previous builds
    for folder in ['build', 'dist']:
        if os.path.exists(folder):
            shutil.rmtree(folder)

    args = [
        'launcher.py',
        f'--name={APP_NAME}',
        '--onedir',
        '--console',
        f'--add-data=templates{SEP}templates',
        f'--add-data=static{SEP}static',
        f'--add-data=config{SEP}config',
        f'--add-data=modules{SEP}modules',
        '--hidden-import=flask',
        '--hidden-import=cv2',
        '--hidden-import=ultralytics',
        '--hidden-import=torch',
        '--hidden-import=psutil',
        '--hidden-import=PIL',
        '--hidden-import=yaml',
        '--hidden-import=numpy',
        '--hidden-import=sqlite3',
        '--collect-all=ultralytics',
        '--noconfirm',
    ]

    if ICON and os.path.exists(ICON):
        args.append(f'--icon={ICON}')

    PyInstaller.__main__.run(args)

    # Copy YOLO models to dist if they exist
    dist_dir = os.path.join('dist', APP_NAME)
    for model_file in ['yolo11n.pt', 'yolo11s.pt', 'yolo11m.pt', 'yolo11l.pt']:
        if os.path.exists(model_file):
            shutil.copy2(model_file, dist_dir)
            print(f'  Copied {model_file}')

    # Create data directory
    os.makedirs(os.path.join(dist_dir, 'data'), exist_ok=True)
    os.makedirs(os.path.join(dist_dir, 'uploads'), exist_ok=True)
    os.makedirs(os.path.join(dist_dir, 'results'), exist_ok=True)

    print(f'\nBuild complete! Executable at: dist/{APP_NAME}/{APP_NAME}.exe')
    print('Double-click the .exe to start DataTrack.')


if __name__ == '__main__':
    build()
