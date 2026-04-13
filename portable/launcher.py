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

IS_FROZEN = getattr(sys, 'frozen', False)

# ── Paths ────────────────────────────────────────────────
if IS_FROZEN:
    APP_DIR = Path(sys.executable).parent
else:
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
    """Copy database to local backup folder, keeping only the last 5 backups."""
    try:
        if not DB_FILE.exists():
            return
        LOCAL_BACKUP.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        suffix = f"_{tag}" if tag else ""
        dest = LOCAL_BACKUP / f"backup_{ts}{suffix}.db"
        shutil.copy2(DB_FILE, dest)
        # Prune: keep only the 5 most recent backups
        backups = sorted(LOCAL_BACKUP.glob("backup_*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in backups[5:]:
            old.unlink(missing_ok=True)
    except Exception:
        pass


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
    if not IS_FROZEN:
        return sys.executable

    return None


def is_port_busy():
    """Check if the port is already in use."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", PORT)) == 0


def kill_existing_server():
    """Kill any leftover process on the port."""
    if not is_port_busy():
        return

    try:
        if sys.platform == "win32":
            # findstr is more reliable than parsing full netstat output
            result = subprocess.run(
                f"netstat -ano | findstr :{PORT} | findstr LISTENING",
                capture_output=True, text=True, timeout=5, shell=True,
            )
            for line in result.stdout.strip().splitlines():
                parts = line.split()
                if parts:
                    pid = parts[-1]
                    try:
                        int(pid)
                        subprocess.run(["taskkill", "/F", "/PID", pid],
                                       capture_output=True, timeout=5)
                    except (ValueError, Exception):
                        pass
        else:
            result = subprocess.run(
                ["lsof", "-ti", f":{PORT}"],
                capture_output=True, text=True, timeout=5,
            )
            for pid in result.stdout.strip().splitlines():
                subprocess.run(["kill", "-9", pid], capture_output=True, timeout=5)
    except Exception:
        pass

    # Wait for port to be released (up to 5 seconds)
    for _ in range(10):
        if not is_port_busy():
            return
        time.sleep(0.5)



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
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONPYCACHEPREFIX"] = str(Path(os.environ.get("TEMP", "/tmp")) / "poojan_pycache")
    env["PIP_NO_CACHE_DIR"] = "1"

    cmd = [
        python, "-m", "uvicorn",
        "app.main:app",
        "--host", "127.0.0.1",
        "--port", str(PORT),
        "--app-dir", str(BACKEND_DIR),
        "--log-level", "warning",
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
    """Show error as a popup (Windows) or print (Mac/Linux)."""
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, msg, "Poojan Gems - Error", 0x10)
        except Exception:
            pass
    else:
        print(f"[ERROR] {msg}")


def show_info(msg):
    """Show info as a popup (Windows) or print (Mac/Linux)."""
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, msg, "Poojan Gems", 0x40)
        except Exception:
            pass
    else:
        print(msg)


def run_with_tray():
    """Run with system tray icon (if pystray available)."""
    import pystray
    from PIL import Image, ImageDraw

    def create_icon():
        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        points = [(32, 4), (60, 28), (32, 60), (4, 28)]
        draw.polygon(points, fill=(59, 130, 246), outline=(30, 64, 175))
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


def run_without_tray():
    """Fallback: keep running until server exits."""
    if IS_FROZEN:
        # No console available — just wait silently for server to exit
        while server_process and server_process.poll() is None:
            time.sleep(1)
    else:
        # Running as .py script — print to console
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
    # Step 1: Backup
    backup_db("start")

    # Step 2: Write env
    write_env()

    # Step 3: Kill leftover server if any
    kill_existing_server()
    if is_port_busy():
        show_error(f"Port {PORT} is still in use by another program.\n\nClose that program and try again.")
        return

    # Step 4: Start server
    if not start_server():
        return

    # Step 4: Open browser
    webbrowser.open(URL)

    # Step 5: Wait (tray icon or simple loop)
    try:
        run_with_tray()
    except Exception:
        run_without_tray()

    # Step 6: Cleanup
    stop_server()
    backup_db("exit")


if __name__ == "__main__":
    main()
