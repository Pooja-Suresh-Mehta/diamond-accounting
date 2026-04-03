#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Prepare a folder ready to copy to a pendrive.
# Usage:  ./prepare-pendrive.sh [output_dir]
# ─────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT="${1:-$SCRIPT_DIR/PoojanGems_Portable}"

echo "============================================"
echo "  Preparing Poojan Gems Portable Package"
echo "============================================"
echo ""

rm -rf "$OUTPUT"
mkdir -p "$OUTPUT/data"

# ── 1. Build frontend ───────────────────────────────────
echo "[1/4] Building frontend..."
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    npm ci
fi
npm run build
echo ""

# ── 2. Copy backend ─────────────────────────────────────
echo "[2/4] Copying backend..."
rsync -a \
    --exclude='venv' \
    --exclude='__pycache__' \
    --exclude='*.db' \
    --exclude='.env' \
    --exclude='*.xlsx' \
    --exclude='seed.py' \
    --exclude='scripts/' \
    --exclude='alembic/' \
    --exclude='alembic.ini' \
    "$PROJECT_ROOT/backend/" "$OUTPUT/backend/"

# Copy built frontend into backend/static (for serving)
cp -r "$PROJECT_ROOT/frontend/dist" "$OUTPUT/backend/static"

# .env will be written dynamically by start.sh / start.bat at runtime
# so the DATABASE_URL path matches wherever the pendrive is mounted
echo 'SECRET_KEY=poojan-gems-portable-secret-2025' > "$OUTPUT/backend/.env"

echo ""

# ── 3. Copy launcher scripts ────────────────────────────
echo "[3/4] Copying launcher scripts..."
cp "$SCRIPT_DIR/start.bat" "$OUTPUT/"
cp "$SCRIPT_DIR/run.bat" "$OUTPUT/"
cp "$SCRIPT_DIR/start.sh" "$OUTPUT/"
cp "$SCRIPT_DIR/setup-windows.bat" "$OUTPUT/"
chmod +x "$OUTPUT/start.sh"

# ── 4. Copy existing database ───────────────────────────
echo "[4/4] Packaging data..."
for db in "$PROJECT_ROOT/backend/diamond_accounting.db"; do
    if [ -f "$db" ]; then
        cp "$db" "$OUTPUT/data/diamond_accounting.db"
        echo "  Included existing database with all your data."
        break
    fi
done

# ── README ───────────────────────────────────────────────
cat > "$OUTPUT/README.txt" << 'ENDREADME'
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
ENDREADME

echo ""
echo "============================================"
echo "  Done! Package ready at:"
echo "  $OUTPUT"
echo ""
du -sh "$OUTPUT"
echo ""
echo "  Copy this entire folder to your pendrive."
echo "============================================"
