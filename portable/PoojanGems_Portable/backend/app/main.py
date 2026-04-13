import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import engine, Base
from app.models import models  # noqa: F401
from app.routers import (
    auth, dashboard, diamonds, account_master, parcel_master,
    parcel_purchase, parcel_purchase_return, memo_out, memo_out_return,
    sale, sale_return,
)
from app.routers import (
    consignment, consignment_return,
    loans, payments, journal_entries, income_expense,
    parcel_reports, financial_reports, utilities, users, dropdown_options,
    backup,
)

app = FastAPI(title="Diamond Accounting - Diamond Inventory", version="1.0.0")

# CORS: allow configured origins or fall back to dev defaults
# Set CORS_ORIGINS env var to override; ngrok URLs are always allowed.
_origins_env = os.getenv("CORS_ORIGINS", "")
_origins = [o.strip() for o in _origins_env.split(",") if o.strip()] if _origins_env else [
    "http://localhost:5173",
    "http://localhost:3000",
]

import re as _re

class _NgrokCORSMiddleware(CORSMiddleware):
    """Extends standard CORS to also allow *.ngrok-free.app and *.ngrok.io origins."""
    _ngrok_re = _re.compile(r"^https://[a-zA-Z0-9\-]+\.(ngrok-free\.app|ngrok\.io)$")

    def is_allowed_origin(self, origin: str) -> bool:
        if super().is_allowed_origin(origin):
            return True
        return bool(self._ngrok_re.match(origin))

app.add_middleware(
    _NgrokCORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Existing routers
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(diamonds.router)
app.include_router(account_master.router)
app.include_router(parcel_master.router)
app.include_router(parcel_purchase.router)
app.include_router(parcel_purchase_return.router)
app.include_router(memo_out.router)
app.include_router(memo_out_return.router)
app.include_router(sale.router)
app.include_router(sale_return.router)

# New routers
app.include_router(consignment.router)
app.include_router(consignment_return.router)
app.include_router(loans.router)
app.include_router(payments.router)
app.include_router(journal_entries.router)
app.include_router(income_expense.router)
app.include_router(parcel_reports.router)
app.include_router(financial_reports.router)
app.include_router(utilities.router)
app.include_router(users.router)
app.include_router(dropdown_options.router)
app.include_router(backup.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


_NEW_PARCEL_COLUMNS = {
    "purchased_weight": "FLOAT DEFAULT 0",
    "purchased_pcs": "INTEGER DEFAULT 0",
    "sold_weight": "FLOAT DEFAULT 0",
    "sold_pcs": "INTEGER DEFAULT 0",
    "on_memo_weight": "FLOAT DEFAULT 0",
    "on_memo_pcs": "INTEGER DEFAULT 0",
    "consignment_weight": "FLOAT DEFAULT 0",
    "consignment_pcs": "INTEGER DEFAULT 0",
    "purchase_price": "FLOAT DEFAULT 0",
    "purchase_price_currency": "VARCHAR(3) DEFAULT 'USD'",
}

_NEW_PURCHASE_COLUMNS = {
    "vat_pct": "FLOAT DEFAULT 0",
    "vat_amount": "FLOAT DEFAULT 0",
}


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if conn.dialect.name == "sqlite":
            # Backfill created_by_name on old tables
            for table_name in ("account_masters", "parcel_masters", "parcel_purchases", "parcel_purchase_returns"):
                cols = (await conn.execute(text(f"PRAGMA table_info({table_name})"))).fetchall()
                names = {c[1] for c in cols}
                if "created_by_name" not in names:
                    await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN created_by_name VARCHAR(100)"))
                await conn.execute(text(
                    f"UPDATE {table_name} SET created_by_name='System' WHERE created_by_name IS NULL OR TRIM(created_by_name)=''"
                ))
            # Add new running-balance columns to parcel_masters
            pm_cols = (await conn.execute(text("PRAGMA table_info(parcel_masters)"))).fetchall()
            pm_names = {c[1] for c in pm_cols}
            for col_name, col_type in _NEW_PARCEL_COLUMNS.items():
                if col_name not in pm_names:
                    await conn.execute(text(f"ALTER TABLE parcel_masters ADD COLUMN {col_name} {col_type}"))

            # Add vat columns to parcel_purchases if missing
            pp_cols = (await conn.execute(text("PRAGMA table_info(parcel_purchases)"))).fetchall()
            pp_names = {c[1] for c in pp_cols}
            for col_name, col_type in _NEW_PURCHASE_COLUMNS.items():
                if col_name not in pp_names:
                    await conn.execute(text(f"ALTER TABLE parcel_purchases ADD COLUMN {col_name} {col_type}"))

            # Add new loan columns if missing
            _NEW_LOAN_COLUMNS = {
                "inv_no": "VARCHAR(50)",
                "renew_date": "DATE",
                "outstanding": "BOOLEAN DEFAULT 0",
                "due_date": "DATE",
                "broker": "VARCHAR(200)",
                "broker_pct": "FLOAT DEFAULT 0",
                "interest_pct": "FLOAT DEFAULT 0",
                "interest": "FLOAT DEFAULT 0",
                "divide_days": "INTEGER DEFAULT 365",
                "rec_from_party": "VARCHAR(200)",
                "due_days": "INTEGER DEFAULT 0",
                "description": "TEXT",
            }
            loan_cols = (await conn.execute(text("PRAGMA table_info(loans)"))).fetchall()
            loan_names = {c[1] for c in loan_cols}
            for col_name, col_type in _NEW_LOAN_COLUMNS.items():
                if col_name not in loan_names:
                    await conn.execute(text(f"ALTER TABLE loans ADD COLUMN {col_name} {col_type}"))

            # Add new payment columns if missing
            _NEW_PAYMENT_COLUMNS = {
                "received_dr": "FLOAT DEFAULT 0",
                "paid_cr": "FLOAT DEFAULT 0",
                "auto_adjust": "BOOLEAN DEFAULT 0",
                "description": "TEXT",
                "pay_type": "VARCHAR(20) DEFAULT 'Regular'",
            }
            pay_cols = (await conn.execute(text("PRAGMA table_info(payments)"))).fetchall()
            pay_names = {c[1] for c in pay_cols}
            for col_name, col_type in _NEW_PAYMENT_COLUMNS.items():
                if col_name not in pay_names:
                    await conn.execute(text(f"ALTER TABLE payments ADD COLUMN {col_name} {col_type}"))

            # Add description column to journal_entries if missing
            je_cols = (await conn.execute(text("PRAGMA table_info(journal_entries)"))).fetchall()
            je_names = {c[1] for c in je_cols}
            if "description" not in je_names:
                await conn.execute(text("ALTER TABLE journal_entries ADD COLUMN description TEXT"))

            # Add new income_expense columns if missing
            _NEW_IE_COLUMNS = {
                "main_account": "VARCHAR(200)",
                "trn_account": "VARCHAR(200)",
                "received_dr": "FLOAT DEFAULT 0",
                "paid_cr": "FLOAT DEFAULT 0",
                "description": "TEXT",
            }
            ie_cols = (await conn.execute(text("PRAGMA table_info(income_expenses)"))).fetchall()
            ie_names = {c[1] for c in ie_cols}
            for col_name, col_type in _NEW_IE_COLUMNS.items():
                if col_name not in ie_names:
                    await conn.execute(text(f"ALTER TABLE income_expenses ADD COLUMN {col_name} {col_type}"))


# ── Serve built frontend (for Docker / portable mode) ─────────────────────
_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if _STATIC_DIR.is_dir():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=_STATIC_DIR / "assets"), name="static-assets")

    # Catch-all: serve index.html for any non-API route (SPA routing)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API routes
        if full_path.startswith("api/"):
            return
        file_path = _STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_STATIC_DIR / "index.html")
