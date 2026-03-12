"""
DataTrack Launcher - Executable entry point
When compiled with PyInstaller, this opens the app in the browser automatically.
"""
import sys
import os

# Set working directory to the executable's location
if getattr(sys, 'frozen', False):
    os.chdir(os.path.dirname(sys.executable))

# Import and run the app
from app import app, hw_optimizer, find_free_port
import threading
import time
import webbrowser


def main():
    port = find_free_port()

    def open_browser():
        time.sleep(2)
        webbrowser.open(f'http://localhost:{port}')

    threading.Thread(target=open_browser, daemon=True).start()

    print(f"\n{'=' * 50}")
    print(f"  DataTrack v2.0")
    print(f"  http://localhost:{port}")
    print(f"  Hardware: {hw_optimizer.device.type.upper()} | {hw_optimizer.profile['name']}")
    print(f"{'=' * 50}\n")
    print("  No cierres esta ventana mientras uses DataTrack.")
    print()

    app.run(debug=False, port=port, threaded=True)


if __name__ == '__main__':
    main()
