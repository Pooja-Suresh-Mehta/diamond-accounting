# Diamond Accounting - Diamond Inventory Management

## Local Development (Mac / Linux)

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env
cat > .env << 'EOF'
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite+aiosqlite:///./diamond_accounting.db
EOF

# Start the server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Open
Visit http://localhost:5173

**Login:**
| Field    | Value              |
|----------|--------------------|
| Company  | Diamond Accounting |
| Username | admin              |
| Password | Poojan@2025        |

---

## Windows Transfer & Execution (Portable / Pendrive)

### Step 1 — Build the portable package (on your Mac)
```bash
cd portable
./prepare-pendrive.sh
```
This creates `portable/PoojanGems_Portable/` with everything needed.

Then zip it:
```bash
./build-zip.sh
```
Upload `PoojanGems_Portable.zip` to Google Drive and share it.

---

### Step 2 — First-time setup on Windows

1. Download and extract `PoojanGems_Portable.zip` to a folder (e.g. `C:\PoojanGems\`)
2. Double-click **`setup-windows.bat`**
   - Downloads portable Python (~25 MB, one-time only)
   - Installs all dependencies automatically
   - Terminal closes when done — that is normal
3. Double-click **`start.bat`** — app opens at http://localhost:8000

> If you move to a new computer, copy the `python\` folder from your old setup into the new extracted folder — no need to run setup again.

---

### Step 3 — Build a professional `.exe` (optional, one-time)

If you want a double-click `.exe` instead of `.bat` scripts:

1. Make sure setup has been run at least once (the `python\` folder must exist)
2. Double-click **`build-exe.bat`** inside the portable folder
3. `PoojanGems.exe` will appear in the same folder
4. Delete `start.bat`, `run.bat`, `setup-windows.bat` — only keep:
   - `PoojanGems.exe`
   - `backend\`
   - `data\`

---

### Everyday Use (Windows)

| Option            | How to start                      |
|-------------------|-----------------------------------|
| `.bat` scripts    | Double-click `start.bat`          |
| `.exe` launcher   | Double-click `PoojanGems.exe`     |
| Stop the app      | Right-click tray icon → **Quit**  |

---

### Deploying App Updates to Windows

Whenever you make code changes:

1. On Mac — rebuild the portable package:
   ```bash
   cd portable
   ./build-zip.sh
   ```
2. Upload new zip to Google Drive
3. On Windows — extract the new zip to the **same folder**, overwriting `backend\` and `static\`
   - **Do not overwrite** the `data\` folder (your database lives there)
   - **Do not overwrite** the `python\` folder (no need to re-run setup)
4. If you had built a `.exe`:
   - Run `build-exe.bat` again to rebuild `PoojanGems.exe` with the new code

---

## Login Credentials

| Field    | Value              |
|----------|--------------------|
| Company  | Diamond Accounting |
| Username | admin              |
| Password | Poojan@2025        |

Change the admin password after first login via **Users** in the sidebar.

---

## Data & Backups

| Location        | Path                                           |
|-----------------|------------------------------------------------|
| Live database   | `data\diamond_accounting.db`                   |
| Auto-backup     | `C:\PoojanGems_Backup\` (Windows)              |
| Auto-backup     | `~/PoojanGems_Backup/` (Mac/Linux)             |

Auto-backup runs every time the app starts and stops.

From inside the app go to **Sidebar → Backup & Restore** to:
- Download Excel backup (human-readable)
- Download raw SQLite database
- Restore from an Excel backup

---

## User Roles

| Role   | Permissions                                    |
|--------|------------------------------------------------|
| Admin  | Full access including user management          |
| User   | Create and edit all transactions and masters   |
| Viewer | Read-only access to all data                   |
