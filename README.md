# Diamond Accounting - Diamond Inventory Management

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ (optional; SQLite used by default for local dev)

### 1. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt

# Copy env file and configure
cp .env.example .env
# Edit .env — set SECRET_KEY at minimum

# Seed the database (creates tables + default admin user)
python -m seed

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

---

## First Login & User Setup

After seeding, log in with the default admin credentials printed in the terminal.
**Change the admin password immediately after first login.**

### Creating Users (Admin only)

1. Log in as admin
2. Go to **Users** in the sidebar
3. Click **Add User** and fill in:
   - Username
   - Password (min 6 characters)
   - Full Name
   - Role (see below)

### Roles

| Role   | Permissions |
|--------|-------------|
| Admin  | Full access including user management |
| User   | Create and edit all transactions and masters |
| Viewer | Read-only access to all data |

Admins can also **deactivate** users (they lose login access) or **reset passwords** from the Users page.

---

## Deployment (Render.com - Free Tier)

1. Push code to GitHub
2. Create a **PostgreSQL** database on Render (free tier)
3. Create a **Web Service** for backend:
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Set env vars: `DATABASE_URL`, `SECRET_KEY`
4. Create a **Static Site** for frontend:
   - Build: `npm install && npm run build`
   - Publish dir: `dist`
