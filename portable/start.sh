#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Poojan Gems — Portable Launcher (Mac / Linux)
# Double-click or run:  ./start.sh
# ─────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[poojan]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }

echo "============================================"
echo "  Poojan Gems - Diamond Accounting"
echo "  Portable Edition"
echo "============================================"
echo ""

# ── Local backup folder ─────────────────────────────────
LOCAL_BACKUP="$HOME/PoojanGems_Backup"
mkdir -p "$LOCAL_BACKUP"
mkdir -p "$APP_DIR/data"

# ── Pre-start backup ────────────────────────────────────
if [ -f "$APP_DIR/data/diamond_accounting.db" ]; then
    TS=$(date +%Y%m%d_%H%M%S)
    cp "$APP_DIR/data/diamond_accounting.db" "$LOCAL_BACKUP/backup_${TS}.db"
    ok "Backup saved to $LOCAL_BACKUP/backup_${TS}.db"
fi

# ── Find Python ──────────────────────────────────────────
PYTHON=""
if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    err "Python 3 is not installed!"
    echo "  Mac: brew install python3"
    echo "  Linux: sudo apt install python3 python3-venv python3-pip"
    exit 1
fi

ok "Using $($PYTHON --version)"

# ── Setup venv if needed ────────────────────────────────
if [ ! -d "$APP_DIR/backend/venv" ]; then
    info "First-time setup: creating virtual environment..."
    $PYTHON -m venv "$APP_DIR/backend/venv"
    info "Installing dependencies (1-2 minutes)..."
    "$APP_DIR/backend/venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"
    ok "Dependencies installed."
    echo ""
fi

# ── Environment ──────────────────────────────────────────
export SECRET_KEY="poojan-gems-portable-secret-2025"
export DATABASE_URL="sqlite+aiosqlite:///$APP_DIR/data/diamond_accounting.db"

# Write .env so pydantic-settings picks it up too
cat > "$APP_DIR/backend/.env" << ENVEOF
SECRET_KEY=poojan-gems-portable-secret-2025
DATABASE_URL=sqlite+aiosqlite:///$APP_DIR/data/diamond_accounting.db
ENVEOF

# ── Cleanup on exit ──────────────────────────────────────
cleanup() {
    echo ""
    info "Shutting down..."
    if [ -f "$APP_DIR/data/diamond_accounting.db" ]; then
        TS=$(date +%Y%m%d_%H%M%S)
        cp "$APP_DIR/data/diamond_accounting.db" "$LOCAL_BACKUP/backup_${TS}_exit.db"
        ok "Exit backup saved to $LOCAL_BACKUP/"
    fi
    ok "Application stopped. You can safely remove the pendrive."
}
trap cleanup EXIT INT TERM

# ── Start ────────────────────────────────────────────────
info "Launching Poojan Gems on http://localhost:8000"
echo ""

# Open browser after delay
(sleep 3 && {
    if command -v open &>/dev/null; then open http://localhost:8000
    elif command -v xdg-open &>/dev/null; then xdg-open http://localhost:8000
    fi
}) &

echo "============================================"
echo "  App running at: http://localhost:8000"
echo "  Login: admin / admin123"
echo ""
echo "  Press Ctrl+C to stop"
echo "============================================"
echo ""

# Run server (blocks until Ctrl+C)
"$APP_DIR/backend/venv/bin/python" -m uvicorn app.main:app \
    --host 127.0.0.1 --port 8000 --app-dir "$APP_DIR/backend"
