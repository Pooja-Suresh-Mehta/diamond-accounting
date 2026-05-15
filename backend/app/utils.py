"""Shared utilities used across all routers."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import User

# ── Constants ────────────────────────────────────────────

PURCHASE_TYPES = ["LOCAL", "External", "Internal", "Pend Sale", "HOLD", "LAB"]
SUB_TYPES = ["Bank", "Cash"]
CATEGORIES = ["Natural Diamond", "Lab Grown Diamond", "Gem Stone"]
PAYMENT_STATUSES = ["Pending", "Partial", "Paid"]
CURRENCIES = ["USD", "INR", "AED"]
CURRENCY_RATES = {
    "USD": {"inr_rate": 85, "usd_rate": 1},
    "INR": {"inr_rate": 1, "usd_rate": 85},
    "AED": {"inr_rate": 25, "usd_rate": 3.67},
}


# ── Helpers ──────────────────────────────────────────────

def get_actor_name(user: User) -> str:
    return (
        (user.full_name or "").strip()
        or (user.username or "").strip()
        or "User"
    )


async def next_number(
    db: AsyncSession, model_class: Any, field: Any, company_id: str
) -> str:
    rows = (
        await db.execute(select(field).where(model_class.company_id == company_id))
    ).scalars().all()
    max_val = 0
    for v in rows:
        s = str(v or "").strip()
        if s.isdigit():
            max_val = max(max_val, int(s))
    return str(max_val + 1)


async def ensure_unique(
    db: AsyncSession,
    model_class: Any,
    field: Any,
    company_id: str,
    value: str,
    exclude_id: str | None = None,
    label: str = "Value",
):
    q = select(model_class.id).where(
        model_class.company_id == company_id,
        func.lower(field) == value.strip().lower(),
    )
    if exclude_id:
        q = q.where(model_class.id != exclude_id)
    if (await db.execute(q)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} must be unique",
        )


def parse_date_value(v: Any) -> date | None:
    if v in (None, ""):
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v).strip())
    except Exception:
        return None


def parse_float_value(v: Any) -> float:
    if v in (None, ""):
        return 0.0
    return float(v)


def normalize_lot_no(lot_no: str | None) -> str:
    """Normalize lot number to 4-digit zero-padded format (e.g., '59' -> '0059')."""
    if not lot_no:
        return ""
    s = str(lot_no).strip()
    if not s:
        return ""
    # Try to extract the numeric part if it contains text
    import re
    m = re.search(r'(\d+)$', s)
    if m:
        num_str = m.group(1)
    else:
        num_str = s
    try:
        return f"{int(num_str):04d}"
    except ValueError:
        # If not a valid number, return as-is
        return s



async def post_ledger_entries(
    db: AsyncSession,
    *,
    company_id: str,
    transaction_type: str,
    transaction_id: str,
    transaction_date: date | None,
    entries: list[dict],
    created_by: str = "System",
):
    """
    Post double-entry ledger records.
    Each entry dict: {"account_name": str, "debit": float, "credit": float, "narration": str}
    """
    from app.models.models import LedgerEntry

    for entry in entries:
        db.add(LedgerEntry(
            company_id=company_id,
            transaction_type=transaction_type,
            transaction_id=transaction_id,
            date=transaction_date or date.today(),
            account_name=entry["account_name"],
            debit=entry.get("debit", 0),
            credit=entry.get("credit", 0),
            narration=entry.get("narration", ""),
            created_by=created_by,
        ))


async def reverse_ledger_entries(
    db: AsyncSession,
    *,
    company_id: str,
    transaction_id: str,
):
    """Mark all ledger entries for a transaction as reversed."""
    from app.models.models import LedgerEntry

    rows = (
        await db.execute(
            select(LedgerEntry).where(
                LedgerEntry.company_id == company_id,
                LedgerEntry.transaction_id == transaction_id,
                LedgerEntry.is_reversed == False,
            )
        )
    ).scalars().all()
    for row in rows:
        row.is_reversed = True
