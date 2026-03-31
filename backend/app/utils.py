"""Shared utilities used across all routers."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ParcelMaster, User

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


# ── Stock adjustment on ParcelMaster ─────────────────────

async def adjust_parcel_stock(
    db: AsyncSession,
    *,
    company_id: str,
    items: list,
    operation: str,
):
    """
    Adjust ParcelMaster running balances based on transaction type.

    operation is one of:
      "purchase"             → increase purchased_weight/pcs
      "purchase_reverse"     → decrease purchased_weight/pcs (delete/return)
      "sale"                 → increase sold_weight/pcs
      "sale_reverse"         → decrease sold_weight/pcs (delete/return)
      "memo_out"             → increase on_memo_weight/pcs
      "memo_out_reverse"     → decrease on_memo_weight/pcs (delete/return)
      "consignment"          → increase consignment_weight/pcs
      "consignment_reverse"  → decrease consignment_weight/pcs (delete/return)
    """
    lot_numbers = []
    for item in items:
        lot_no = getattr(item, "lot_number", None) or getattr(item, "lot_no", None) or ""
        lot_no = str(lot_no).strip()
        if lot_no:
            lot_numbers.append(lot_no)
    if not lot_numbers:
        return

    existing_rows = (
        await db.execute(
            select(ParcelMaster).where(
                ParcelMaster.company_id == company_id,
                func.lower(ParcelMaster.lot_no).in_([ln.lower() for ln in lot_numbers]),
            )
        )
    ).scalars().all()
    lookup = {r.lot_no.strip().lower(): r for r in existing_rows}

    for item in items:
        lot_no = getattr(item, "lot_number", None) or getattr(item, "lot_no", None) or ""
        lot_no = str(lot_no).strip()
        if not lot_no:
            continue
        row = lookup.get(lot_no.lower())
        if not row:
            continue

        weight = float(
            getattr(item, "selected_carat", 0)
            or getattr(item, "issue_carats", 0)
            or getattr(item, "weight", 0)
            or 0
        )
        pcs = int(getattr(item, "pcs", 0) or 0)

        if operation == "purchase":
            row.purchased_weight = float(row.purchased_weight or 0) + weight
            row.purchased_pcs = int(row.purchased_pcs or 0) + pcs
        elif operation == "purchase_reverse":
            row.purchased_weight = max(0, float(row.purchased_weight or 0) - weight)
            row.purchased_pcs = max(0, int(row.purchased_pcs or 0) - pcs)
        elif operation == "sale":
            row.sold_weight = float(row.sold_weight or 0) + weight
            row.sold_pcs = int(row.sold_pcs or 0) + pcs
        elif operation == "sale_reverse":
            row.sold_weight = max(0, float(row.sold_weight or 0) - weight)
            row.sold_pcs = max(0, int(row.sold_pcs or 0) - pcs)
        elif operation == "memo_out":
            row.on_memo_weight = float(row.on_memo_weight or 0) + weight
            row.on_memo_pcs = int(row.on_memo_pcs or 0) + pcs
        elif operation == "memo_out_reverse":
            row.on_memo_weight = max(0, float(row.on_memo_weight or 0) - weight)
            row.on_memo_pcs = max(0, int(row.on_memo_pcs or 0) - pcs)
        elif operation == "consignment":
            row.consignment_weight = float(getattr(row, "consignment_weight", 0) or 0) + weight
            row.consignment_pcs = int(getattr(row, "consignment_pcs", 0) or 0) + pcs
        elif operation == "consignment_reverse":
            row.consignment_weight = max(0, float(getattr(row, "consignment_weight", 0) or 0) - weight)
            row.consignment_pcs = max(0, int(getattr(row, "consignment_pcs", 0) or 0) - pcs)


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
