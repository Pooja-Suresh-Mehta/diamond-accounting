===================================================
  POOJAN GEMS - Diamond Accounting (Portable)
===================================================

FIRST TIME SETUP (Windows):
  1. Double-click "setup-windows.bat"
     - Downloads portable Python (~25 MB, one-time)
     - Installs all dependencies automatically
     - Terminal will close when done - that is normal
  2. Double-click "start.bat"
     - App opens in browser at http://localhost:8000

  NOTE: If you move to a new computer, copy the
  "python" folder from your old setup into the new
  extracted folder to skip setup-windows.bat again.

FIRST TIME SETUP (Mac / Linux):
  Mac:    Python 3 is pre-installed. Run: ./start.sh
          If missing: brew install python3
  Linux:  sudo apt install python3 python3-venv python3-pip
          Then run: ./start.sh

EVERYDAY USE:
  Windows:    Double-click "start.bat"
  Mac/Linux:  Double-click "start.sh"
  To stop:    Close the terminal window, or press Ctrl+C

LOGIN:
  Company:   Diamond Accounting
  Username:  admin
  Password:  Poojan@2025

RESOURCE USAGE:
  RAM:  ~60-100 MB (very lightweight)
  CPU:  < 1% when idle
  Disk: ~200 MB (Python + dependencies)
  No risk to other data or programs on the computer.

DATA & BACKUPS:
  On pendrive:    data\diamond_accounting.db
  Local backup:   C:\PoojanGems_Backup  (Windows)
                  ~/PoojanGems_Backup   (Mac/Linux)
  Auto-backed up every time you start and stop the app.

  From inside the app (Sidebar > "Backup & Restore"):
  - Download as Excel (.xlsx) - human-readable backup
  - Download raw SQLite DB - exact database copy
  - Restore from Excel - upload a .xlsx backup file

FILES IN THIS FOLDER:
  start.bat          - Launch app (Windows)
  run.bat            - Internal launcher (used by start.bat)
  setup-windows.bat  - First-time Python setup (Windows)
  start.sh           - Launch app (Mac/Linux)
  backend/           - Application code
  data/              - Database (your data lives here)
  python/            - Portable Python (created by setup)

===================================================
