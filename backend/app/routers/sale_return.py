from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.models import AccountMaster, ParcelMaster, SaleReturn, SaleReturnItem, User
from app.schemas import SaleReturnCreate, SaleReturnOut, SaleReturnUpdate
from app.utils import (
    CATEGORIES, CURRENCIES, CURRENCY_RATES, PAYMENT_STATUSES, PURCHASE_TYPES, SUB_TYPES,
    adjust_parcel_stock, ensure_unique, get_actor_name, next_number,
    post_ledger_entries, reverse_ledger_entries,
)

router = APIRouter(prefix="/api/sale-return", tags=["sale-return"])


def _calc_totals(row: SaleReturn):
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
        } for r in parcel_rows if r.lot_no],
        "payment_statuses": PAYMENT_STATUSES,
        "next_invoice_number": await next_number(db, SaleReturn, SaleReturn.invoice_number, current_user.company_id),
    }


@router.get("", response_model=list[SaleReturnOut])
async def list_rows(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(SaleReturn).options(selectinload(SaleReturn.items)).where(SaleReturn.company_id == current_user.company_id)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(SaleReturn.invoice_number.ilike(like) | SaleReturn.party.ilike(like))
    q = q.order_by(SaleReturn.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return [SaleReturnOut.model_validate(r) for r in rows]


@router.get("/{row_id}", response_model=SaleReturnOut)
async def get_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(SaleReturn).options(selectinload(SaleReturn.items))
        .where(SaleReturn.id == str(row_id), SaleReturn.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale Return not found")
    return SaleReturnOut.model_validate(row)


@router.post("", response_model=SaleReturnOut, status_code=status.HTTP_201_CREATED)
async def create_row(
    payload: SaleReturnCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_unique(db, SaleReturn, SaleReturn.invoice_number, current_user.company_id, payload.invoice_number, label="Invoice Number")
    data = payload.model_dump(exclude={"items"})
    row = SaleReturn(company_id=current_user.company_id, **data)
    row.created_by_name = get_actor_name(current_user)
    row.items = [SaleReturnItem(**item.model_dump()) for item in payload.items]
    _calc_totals(row)
    db.add(row)

    # Sale return = stock comes back to us
    await adjust_parcel_stock(db, company_id=current_user.company_id, items=payload.items, operation="sale_reverse")

    await db.flush()
    amount = float(row.transaction_final_amount or row.total_amount or 0)
    party = row.party or "Unknown Customer"
    if amount > 0:
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type="sale_return", transaction_id=row.id, transaction_date=row.date, created_by=get_actor_name(current_user), entries=[
            {"account_name": "Sale", "debit": amount, "credit": 0, "narration": f"Sale Return {row.invoice_number} from {party}"},
            {"account_name": party, "debit": 0, "credit": amount, "narration": f"Sale Return {row.invoice_number}"},
        ])

    await db.commit()
    await db.refresh(row)
    row = (await db.execute(select(SaleReturn).options(selectinload(SaleReturn.items)).where(SaleReturn.id == row.id))).scalar_one()
    return SaleReturnOut.model_validate(row)


@router.put("/{row_id}", response_model=SaleReturnOut)
async def update_row(
    row_id: UUID,
    payload: SaleReturnUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(SaleReturn).options(selectinload(SaleReturn.items))
        .where(SaleReturn.id == str(row_id), SaleReturn.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale Return not found")
    await ensure_unique(db, SaleReturn, SaleReturn.invoice_number, current_user.company_id, payload.invoice_number, exclude_id=str(row_id), label="Invoice Number")

    # Reverse old adjustments (the old return had reduced sold_weight, undo that)
    await adjust_parcel_stock(db, company_id=current_user.company_id, items=row.items, operation="sale")
    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))

    for k, v in payload.model_dump(exclude={"items"}).items():
        setattr(row, k, v)
    row.items.clear()
    row.items.extend([SaleReturnItem(**item.model_dump()) for item in payload.items])
    _calc_totals(row)

    await adjust_parcel_stock(db, company_id=current_user.company_id, items=payload.items, operation="sale_reverse")

    amount = float(row.transaction_final_amount or row.total_amount or 0)
    party = row.party or "Unknown Customer"
    if amount > 0:
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type="sale_return", transaction_id=str(row_id), transaction_date=row.date, created_by=get_actor_name(current_user), entries=[
            {"account_name": "Sale", "debit": amount, "credit": 0, "narration": f"Sale Return {row.invoice_number} from {party}"},
            {"account_name": party, "debit": 0, "credit": amount, "narration": f"Sale Return {row.invoice_number}"},
        ])

    await db.commit()
    await db.refresh(row)
    row = (await db.execute(select(SaleReturn).options(selectinload(SaleReturn.items)).where(SaleReturn.id == str(row_id)))).scalar_one()
    return SaleReturnOut.model_validate(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(SaleReturn).options(selectinload(SaleReturn.items))
        .where(SaleReturn.id == str(row_id), SaleReturn.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale Return not found")

    # Deleting a sale return means the sold stock goes back to "sold"
    await adjust_parcel_stock(db, company_id=current_user.company_id, items=row.items, operation="sale")
    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))

    await db.delete(row)
    await db.commit()
