from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.models import AccountMaster, ParcelMaster, Sale, SaleItem, User
from app.schemas import SaleCreate, SaleOut, SaleUpdate
from app.utils import (
    CATEGORIES, CURRENCIES, CURRENCY_RATES, PAYMENT_STATUSES, PURCHASE_TYPES, SUB_TYPES,
    adjust_parcel_stock, ensure_unique, get_actor_name, next_number,
    post_ledger_entries, reverse_ledger_entries,
)

router = APIRouter(prefix="/api/sale", tags=["sale"])


def _calc_totals(row: Sale):
    total_carats = sum((i.selected_carat or i.issue_carats or 0) for i in row.items)
    total_amount = sum((i.amount or 0) for i in row.items)
    row.total_carats = float(total_carats)
    row.total_amount = float(total_amount)
    row.inr_amt = float(row.inr_final_amount or row.transaction_final_amount or total_amount)
    row.usd_amt = float(row.usd_final_amount or total_amount)


@router.get("/options")
async def get_options(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    parties = (await db.execute(
        select(AccountMaster.account_group_name)
        .where(AccountMaster.company_id == current_user.company_id)
        .order_by(AccountMaster.account_group_name)
    )).scalars().all()
    parcel_rows = (await db.execute(
        select(ParcelMaster).where(ParcelMaster.company_id == current_user.company_id).order_by(ParcelMaster.lot_no)
    )).scalars().all()
    return {
        "types": PURCHASE_TYPES, "sub_types": SUB_TYPES, "categories": CATEGORIES,
        "currencies": CURRENCIES, "currency_rates": CURRENCY_RATES,
        "parties": parties,
        "lot_numbers": [r.lot_no for r in parcel_rows if r.lot_no],
        "lot_items": [{
            "lot_no": r.lot_no, "item_name": r.item_name, "shape": r.shape,
            "color": r.color, "clarity": r.clarity, "size": r.size, "sieve_mm": r.sieve_mm,
            "opening_weight_carats": r.opening_weight_carats, "opening_pcs": r.opening_pcs,
            "purchase_cost_usd_amount": r.purchase_cost_usd_amount,
            "purchase_cost_price_usd_carats": r.purchase_cost_price_usd_carats,
        } for r in parcel_rows if r.lot_no],
        "payment_statuses": PAYMENT_STATUSES,
        "next_invoice_number": await next_number(db, Sale, Sale.invoice_number, current_user.company_id),
    }


@router.get("", response_model=list[SaleOut])
async def list_rows(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Sale).options(selectinload(Sale.items)).where(Sale.company_id == current_user.company_id)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(Sale.invoice_number.ilike(like) | Sale.party.ilike(like))
    q = q.order_by(Sale.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return [SaleOut.model_validate(r) for r in rows]


@router.get("/{row_id}", response_model=SaleOut)
async def get_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(Sale).options(selectinload(Sale.items))
        .where(Sale.id == str(row_id), Sale.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    return SaleOut.model_validate(row)


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
async def create_row(
    payload: SaleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_unique(db, Sale, Sale.invoice_number, current_user.company_id, payload.invoice_number, label="Invoice Number")
    data = payload.model_dump(exclude={"items"})
    row = Sale(company_id=current_user.company_id, **data)
    row.created_by_name = get_actor_name(current_user)
    row.items = [SaleItem(**item.model_dump()) for item in payload.items]
    _calc_totals(row)
    db.add(row)

    # Sale reduces stock
    await adjust_parcel_stock(db, company_id=current_user.company_id, items=payload.items, operation="sale")

    await db.flush()
    amount = float(row.transaction_final_amount or row.total_amount or 0)
    party = row.party or "Unknown Customer"
    if amount > 0:
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type="sale", transaction_id=row.id, transaction_date=row.date, created_by=get_actor_name(current_user), entries=[
            {"account_name": party, "debit": amount, "credit": 0, "narration": f"Sale {row.invoice_number} to {party}"},
            {"account_name": "Sale", "debit": 0, "credit": amount, "narration": f"Sale {row.invoice_number}"},
        ])

    await db.commit()
    await db.refresh(row)
    row = (await db.execute(select(Sale).options(selectinload(Sale.items)).where(Sale.id == row.id))).scalar_one()
    return SaleOut.model_validate(row)


@router.put("/{row_id}", response_model=SaleOut)
async def update_row(
    row_id: UUID,
    payload: SaleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(Sale).options(selectinload(Sale.items))
        .where(Sale.id == str(row_id), Sale.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    await ensure_unique(db, Sale, Sale.invoice_number, current_user.company_id, payload.invoice_number, exclude_id=str(row_id), label="Invoice Number")

    # Reverse old stock & ledger
    await adjust_parcel_stock(db, company_id=current_user.company_id, items=row.items, operation="sale_reverse")
    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))

    for k, v in payload.model_dump(exclude={"items"}).items():
        setattr(row, k, v)
    row.items.clear()
    row.items.extend([SaleItem(**item.model_dump()) for item in payload.items])
    _calc_totals(row)

    await adjust_parcel_stock(db, company_id=current_user.company_id, items=payload.items, operation="sale")

    amount = float(row.transaction_final_amount or row.total_amount or 0)
    party = row.party or "Unknown Customer"
    if amount > 0:
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type="sale", transaction_id=str(row_id), transaction_date=row.date, created_by=get_actor_name(current_user), entries=[
            {"account_name": party, "debit": amount, "credit": 0, "narration": f"Sale {row.invoice_number} to {party}"},
            {"account_name": "Sale", "debit": 0, "credit": amount, "narration": f"Sale {row.invoice_number}"},
        ])

    await db.commit()
    await db.refresh(row)
    row = (await db.execute(select(Sale).options(selectinload(Sale.items)).where(Sale.id == str(row_id)))).scalar_one()
    return SaleOut.model_validate(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(Sale).options(selectinload(Sale.items))
        .where(Sale.id == str(row_id), Sale.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")

    await adjust_parcel_stock(db, company_id=current_user.company_id, items=row.items, operation="sale_reverse")
    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))

    await db.delete(row)
    await db.commit()
