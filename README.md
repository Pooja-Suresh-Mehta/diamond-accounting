# Poojan Gems - Diamond Inventory Management

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+

### 1. Database Setup
```bash
# Create the database
createdb poojan_gems
```

### 2. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt

# Copy env file and edit
cp .env.example .env

# Seed the database with demo data
python -m seed

# Start the server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Open
Visit http://localhost:5173

**Demo Login:**
- Company: `Poojan Gems`
- Username: `admin`
- Password: `admin123`

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
