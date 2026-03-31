#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Poojan Gems — one-command launcher
# Usage:  ./start.sh
# Starts: backend (port 8001) + frontend (port 5173) + ngrok tunnel on 5173
# Press Ctrl+C once to stop everything cleanly.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
LOG_DIR="$ROOT/.logs"
mkdir -p "$LOG_DIR"

# ── Colours ──────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'

info()    { echo -e "${CYAN}[poojan]${NC} $*"; }
success() { echo -e "${GREEN}[poojan]${NC} $*"; }
warn()    { echo -e "${YELLOW}[poojan]${NC} $*"; }
error()   { echo -e "${RED}[poojan]${NC} $*"; }

# ── Cleanup on exit ───────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  warn "Shutting down..."
  for pid in "${PIDS[@]+"${PIDS[@]}"}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  success "All services stopped."
}
trap cleanup EXIT INT TERM

# ── Sanity checks ─────────────────────────────────────────
if ! command -v ngrok &>/dev/null; then
  error "ngrok not found. Run:  brew install ngrok"
  exit 1
fi

# Check for ngrok auth token (needed for tunnels)
NGROK_CONFIG="$HOME/Library/Application Support/ngrok/ngrok.yml"
if [ ! -f "$NGROK_CONFIG" ] || ! grep -q "authtoken" "$NGROK_CONFIG" 2>/dev/null; then
  echo ""
  echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  warn "ngrok needs a FREE account token (one-time setup):"
  echo ""
  echo "  1. Go to https://dashboard.ngrok.com/signup  (free)"
  echo "  2. After signup, go to https://dashboard.ngrok.com/get-started/your-authtoken"
  echo "  3. Copy your token and run:"
  echo ""
  echo -e "     ${GREEN}ngrok config add-authtoken YOUR_TOKEN_HERE${NC}"
  echo ""
  echo "  Then run ./start.sh again."
  echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

if [ ! -f "$BACKEND/venv/bin/python3" ]; then
  error "Backend venv missing. Run:  cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt"
  exit 1
fi

if [ ! -d "$FRONTEND/node_modules" ]; then
  warn "Frontend node_modules missing — running npm install..."
  cd "$FRONTEND" && npm install
fi

# ── 1. Start Backend ──────────────────────────────────────
info "Starting backend on port 8001..."
cd "$BACKEND"
CORS_ORIGINS="http://localhost:5173" \
  venv/bin/uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8001 \
    --reload \
    > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)

# Wait for backend to be ready (up to 15s)
for i in $(seq 1 15); do
  if curl -sf http://localhost:8001/api/health &>/dev/null; then
    success "Backend ready  →  http://localhost:8001"
    break
  fi
  sleep 1
  if [ "$i" -eq 15 ]; then
    error "Backend didn't start in 15s. Check .logs/backend.log"
    exit 1
  fi
done

# ── 2. Start Frontend ─────────────────────────────────────
info "Starting frontend on port 5173..."
cd "$FRONTEND"
npm run dev -- --host 0.0.0.0 \
  > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
PIDS+=($FRONTEND_PID)

# Wait for frontend (up to 20s)
for i in $(seq 1 20); do
  if curl -sf http://localhost:5173 &>/dev/null; then
    success "Frontend ready →  http://localhost:5173"
    break
  fi
  sleep 1
  if [ "$i" -eq 20 ]; then
    error "Frontend didn't start in 20s. Check .logs/frontend.log"
    exit 1
  fi
done

# ── 3. Start ngrok ────────────────────────────────────────
info "Starting ngrok tunnel on port 5173..."
ngrok http 5173 \
  --log=stdout \
  --log-format=json \
  > "$LOG_DIR/ngrok.log" 2>&1 &
NGROK_PID=$!
PIDS+=($NGROK_PID)

# Wait for ngrok API to be ready and extract public URL
PUBLIC_URL=""
for i in $(seq 1 15); do
  sleep 1
  PUBLIC_URL=$(curl -sf http://localhost:4040/api/tunnels 2>/dev/null \
    | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    tunnels = d.get('tunnels', [])
    for t in tunnels:
        if t.get('proto') == 'https':
            print(t['public_url'])
            break
except: pass
" 2>/dev/null)
  if [ -n "$PUBLIC_URL" ]; then break; fi
done

echo ""
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -n "$PUBLIC_URL" ]; then
  success "🌐  PUBLIC URL  →  ${PUBLIC_URL}"
  echo -e "     Share this link — works from any browser, anywhere"
  echo -e "     Login: admin / PoojanGems@2025!"
else
  warn "ngrok URL not detected yet — check http://localhost:4040 in browser"
fi
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Backend   →  http://localhost:8001"
echo -e "  Frontend  →  http://localhost:5173"
echo -e "  ngrok UI  →  http://localhost:4040"
echo -e "  Logs      →  $LOG_DIR/"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# ── Keep alive & tail logs ────────────────────────────────
wait
