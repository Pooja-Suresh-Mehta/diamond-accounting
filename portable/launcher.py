"""
Poojan Gems — Desktop Launcher
Double-click this (or the .exe) to start the app.
- Starts the backend server
- Opens the browser
- Shows a system tray icon to quit
- Auto-backups the database on start/stop
"""
import os
import sys
import shutil
import signal
import subprocess
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path

# ── Paths ────────────────────────────────────────────────
if getattr(sys, 'frozen', False):
    # Running as PyInstaller .exe
    APP_DIR = Path(sys.executable).parent
else:
    # Running as .py script
    APP_DIR = Path(__file__).parent

BACKEND_DIR = APP_DIR / "backend"
DATA_DIR = APP_DIR / "data"
DB_FILE = DATA_DIR / "diamond_accounting.db"
ENV_FILE = BACKEND_DIR / ".env"

# Local backup folder
if sys.platform == "win32":
    LOCAL_BACKUP = Path("C:/PoojanGems_Backup")
else:
    LOCAL_BACKUP = Path.home() / "PoojanGems_Backup"

PORT = 8000
URL = f"http://localhost:{PORT}"

server_process = None


def backup_db(tag=""):
    """Copy database to local backup folder."""
    if not DB_FILE.exists():
        return
    LOCAL_BACKUP.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix = f"_{tag}" if tag else ""
    dest = LOCAL_BACKUP / f"backup_{ts}{suffix}.db"
    shutil.copy2(DB_FILE, dest)
    print(f"[Backup] Saved to {dest}")


def write_env():
    """Write .env file for the backend."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(ENV_FILE, "w") as f:
        f.write(f"SECRET_KEY=poojan-gems-portable-secret-2025\n")
        f.write(f"DATABASE_URL=sqlite+aiosqlite:///{DB_FILE}\n")


def find_python():
    """Find the best Python to use."""
    # 1. Embedded Python on pendrive
    embedded = APP_DIR / "python" / "python.exe"
    if embedded.exists():
        return str(embedded)

    # 2. Venv Python
    if sys.platform == "win32":
        venv_py = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    else:
        venv_py = BACKEND_DIR / "venv" / "bin" / "python"
    if venv_py.exists():
        return str(venv_py)

    # 3. Current Python (if running as .py, not .exe)
    if not getattr(sys, 'frozen', False):
        return sys.executable

    return None


def start_server():
    """Start uvicorn server as a subprocess."""
    global server_process

    python = find_python()
    if not python:
        show_error("Python not found!\nRun setup-windows.bat first.")
        return False

    env = os.environ.copy()
    env["SECRET_KEY"] = "poojan-gems-portable-secret-2025"
    env["DATABASE_URL"] = f"sqlite+aiosqlite:///{DB_FILE}"

    cmd = [
        python, "-m", "uvicorn",
        "app.main:app",
        "--host", "127.0.0.1",
        "--port", str(PORT),
        "--app-dir", str(BACKEND_DIR),
    ]

    # Hide the console window on Windows
    kwargs = {}
    if sys.platform == "win32":
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        si.wShowWindow = 0  # SW_HIDE
        kwargs["startupinfo"] = si

    server_process = subprocess.Popen(
        cmd, env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        **kwargs,
    )

    # Wait for server to be ready
    import urllib.request
    for i in range(30):
        try:
            urllib.request.urlopen(f"{URL}/api/health", timeout=1)
            return True
        except Exception:
            time.sleep(1)
            if server_process.poll() is not None:
                # Server crashed
                stderr = server_process.stderr.read().decode() if server_process.stderr else ""
                show_error(f"Server failed to start:\n{stderr[:500]}")
                return False

    show_error("Server took too long to start.")
    return False


def stop_server():
    """Stop the uvicorn server."""
    global server_process
    if server_process and server_process.poll() is None:
        if sys.platform == "win32":
            server_process.terminate()
        else:
            server_process.send_signal(signal.SIGINT)
        try:
            server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_process.kill()
    server_process = None


def show_error(msg):
    """Show error message box."""
    if sys.platform == "win32":
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, msg, "Poojan Gems - Error", 0x10)
    else:
        print(f"[ERROR] {msg}")


def run_with_tray():
    """Run with system tray icon (if pystray available)."""
    try:
        import pystray
        from PIL import Image, ImageDraw

        # Create a simple diamond icon
        def create_icon():
            img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            # Diamond shape
            points = [(32, 4), (60, 28), (32, 60), (4, 28)]
            draw.polygon(points, fill=(59, 130, 246), outline=(30, 64, 175))
            # Inner highlight
            points2 = [(32, 14), (50, 28), (32, 48), (14, 28)]
            draw.polygon(points2, fill=(96, 165, 250))
            return img

        def on_open(icon, item):
            webbrowser.open(URL)

        def on_quit(icon, item):
            icon.stop()

        icon = pystray.Icon(
            "poojan_gems",
            create_icon(),
            "Poojan Gems - Diamond Accounting",
            menu=pystray.Menu(
                pystray.MenuItem("Open in Browser", on_open, default=True),
                pystray.MenuItem(f"Running on {URL}", None, enabled=False),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Quit", on_quit),
            ),
        )
        icon.run()

    except ImportError:
        # No pystray/PIL — fall back to simple wait
        run_without_tray()


def run_without_tray():
    """Simple fallback: just keep running until Ctrl+C or window close."""
    print()
    print("==========================================")
    print("  Poojan Gems is running!")
    print(f"  Open: {URL}")
    print()
    print("  Company:  Diamond Accounting")
    print("  Username: admin")
    print("  Password: Poojan@2025")
    print()
    print("  Close this window to stop the app.")
    print("==========================================")
    print()
    try:
        while server_process and server_process.poll() is None:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


def main():
    print("Poojan Gems - Diamond Accounting")
    print("Starting up...")
    print()

    # Step 1: Backup
    backup_db("start")

    # Step 2: Write env
    write_env()

    # Step 3: Start server
    print("Starting server...")
    if not start_server():
        input("Press Enter to exit...")
        return

    print(f"Server running at {URL}")

    # Step 4: Open browser
    webbrowser.open(URL)

    # Step 5: Wait (tray icon or simple loop)
    try:
        run_with_tray()
    except Exception:
        run_without_tray()

    # Step 6: Cleanup
    print("Shutting down...")
    stop_server()
    backup_db("exit")
    print("Done. You can safely remove the pendrive.")


if __name__ == "__main__":
    main()
