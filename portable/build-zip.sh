#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Build a single .zip file ready to upload to cloud storage.
# Output: PoojanGems_Portable.zip
# ─────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Step 1: Preparing portable package..."
"$SCRIPT_DIR/prepare-pendrive.sh" "$SCRIPT_DIR/PoojanGems_Portable"

echo ""
echo "Step 2: Creating zip file..."
cd "$SCRIPT_DIR"
rm -f PoojanGems_Portable.zip
zip -r PoojanGems_Portable.zip PoojanGems_Portable/

echo ""
echo "============================================"
echo "  DONE! Your file is ready:"
echo ""
echo "  $SCRIPT_DIR/PoojanGems_Portable.zip"
echo ""
ls -lh "$SCRIPT_DIR/PoojanGems_Portable.zip"
echo ""
echo "  NEXT STEPS:"
echo "  1. Upload to Google Drive and share the link (Gmail blocks .bat in attachments)"
echo "  2. On the other laptop, download and extract"
echo "  3. Copy extracted folder to pendrive"
echo "  4. On Windows: run setup-windows.bat (first time only)"
echo "  5. Then double-click start.bat to launch"
echo "============================================"
