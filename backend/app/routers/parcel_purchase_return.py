from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.models import (
    AccountMaster, ParcelMaster, ParcelPurchaseReturn, ParcelPurchaseReturnItem, User,
)
from app.schemas import ParcelPurchaseReturnCreate, ParcelPurchaseReturnOut, ParcelPurchaseReturnUpdate
from app.utils import (
    CATEGORIES, CURRENCIES, CURRENCY_RATES, PAYMENT_STATUSES, PURCHASE_TYPES, SUB_TYPES,
    adjust_parcel_stock, ensure_unique, get_actor_name, next_number,
    post_ledger_entries, reverse_ledger_entries,
)

router = APIRouter(prefix="/api/parcel/purchase-return", tags=["parcel-purchase-return"])


def _calc_totals(p: ParcelPurchaseReturn):
    total_carats = sum((i.selected_carat or i.issue_carats or 0) for i in p.items)
    total_amount = sum((i.amount or 0) for i in p.items)
    p.total_carats = float(total_carats or 0)
    p.total_amount = float(total_amount or 0)
    p.inr_amt = float(p.inr_final_amount or p.transaction_final_amount or total_amount or 0)
    p.usd_amt = float(p.usd_final_amount or total_amount or 0)


@router.get("/options")
async def get_options(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    CUSTOMER_TYPES = ["customer", "overseas customer", "individual", "supplier", "overseas supplier"]
    parties = (await db.execute(
        select(AccountMaster.account_group_name)
        .where(
            AccountMaster.company_id == current_user.company_id,
            func.lower(AccountMaster.account_type).in_(CUSTOMER_TYPES),
        )
        .order_by(AccountMaster.account_group_name)
    )).scalars().all()
    brokers = (await db.execute(
        select(AccountMaster.account_group_name)
        .where(AccountMaster.company_id == current_user.company_id, func.lower(AccountMaster.account_type) == "broker")
        .order_by(AccountMaster.account_group_name)
    )).scalars().all()
    parcel_rows = (await db.execute(
        select(ParcelMaster).where(ParcelMaster.company_id == current_user.company_id).order_by(ParcelMaster.lot_no)
    )).scalars().all()
    return {
        "types": PURCHASE_TYPES, "sub_types": SUB_TYPES, "categories": CATEGORIES,
        "currencies": CURRENCIES, "currency_rates": CURRENCY_RATES,
        "parties": parties, "brokers": brokers,
        "lot_numbers": [r.lot_no for r in parcel_rows if r.lot_no],
        "lot_items": [{
            "lot_no": r.lot_no, "item_name": r.item_name, "shape": r.shape,
            "color": r.color, "clarity": r.clarity, "size": r.size, "sieve": r.sieve_mm,
            "opening_weight_carats": r.opening_weight_carats, "opening_pcs": r.opening_pcs,
            "amount": r.asking_inr_amount,
        } for r in parcel_rows if r.lot_no],
        "payment_statuses": PAYMENT_STATUSES,
        "next_memo_number": await next_number(db, ParcelPurchaseReturn, ParcelPurchaseReturn.memo_number, current_user.company_id),
    }


@router.get("", response_model=list[ParcelPurchaseReturnOut])
async def list_rows(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(ParcelPurchaseReturn).options(selectinload(ParcelPurchaseReturn.items)).where(ParcelPurchaseReturn.company_id == current_user.company_id)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(
            ParcelPurchaseReturn.memo_number.ilike(like) |
            ParcelPurchaseReturn.inv_bill_no.ilike(like) |
            ParcelPurchaseReturn.party.ilike(like)
        )
    q = q.order_by(ParcelPurchaseReturn.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return [ParcelPurchaseReturnOut.model_validate(r) for r in rows]


@router.get("/{row_id}", response_model=ParcelPurchaseReturnOut)
async def get_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(ParcelPurchaseReturn).options(selectinload(ParcelPurchaseReturn.items))
        .where(ParcelPurchaseReturn.id == str(row_id), ParcelPurchaseReturn.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase Return not found")
    return ParcelPurchaseReturnOut.model_validate(row)


@router.post("", response_model=ParcelPurchaseReturnOut, status_code=status.HTTP_201_CREATED)
async def create_row(
    payload: ParcelPurchaseReturnCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_unique(db, ParcelPurchaseReturn, ParcelPurchaseReturn.memo_number, current_user.company_id, payload.memo_number, label="Memo Number")
    data = payload.model_dump(exclude={"items"})
    row = ParcelPurchaseReturn(company_id=current_user.company_id, **data)
    row.created_by_name = get_actor_name(current_user)
    row.items = [ParcelPurchaseReturnItem(**item.model_dump()) for item in payload.items]
    _calc_totals(row)
    db.add(row)

    # Purchase return = returning stock to supplier → reduce our stock
    await adjust_parcel_stock(db, company_id=current_user.company_id, items=payload.items, operation="purchase_reverse")

    await db.flush()
    amount = float(row.transaction_final_amount or row.total_amount or 0)
    party = row.party or "Unknown Supplier"
    if amount > 0:
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type="purchase_return", transaction_id=row.id, transaction_date=row.date, created_by=get_actor_name(current_user), entries=[
            {"account_name": party, "debit": amount, "credit": 0, "narration": f"Purchase Return {row.memo_number}"},
            {"account_name": "Purchase", "debit": 0, "credit": amount, "narration": f"Purchase Return {row.memo_number} to {party}"},
        ])

    await db.commit()
    await db.refresh(row)
    row = (await db.execute(select(ParcelPurchaseReturn).options(selectinload(ParcelPurchaseReturn.items)).where(ParcelPurchaseReturn.id == row.id))).scalar_one()
    return ParcelPurchaseReturnOut.model_validate(row)


@router.put("/{row_id}", response_model=ParcelPurchaseReturnOut)
async def update_row(
    row_id: UUID,
    payload: ParcelPurchaseReturnUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(ParcelPurchaseReturn).options(selectinload(ParcelPurchaseReturn.items))
        .where(ParcelPurchaseReturn.id == str(row_id), ParcelPurchaseReturn.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase Return not found")
    await ensure_unique(db, ParcelPurchaseReturn, ParcelPurchaseReturn.memo_number, current_user.company_id, payload.memo_number, exclude_id=str(row_id), label="Memo Number")

    # Reverse old adjustments
    await adjust_parcel_stock(db, company_id=current_user.company_id, items=row.items, operation="purchase")
    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))

    for k, v in payload.model_dump(exclude={"items"}).items():
        setattr(row, k, v)
    row.items.clear()
    row.items.extend([ParcelPurchaseReturnItem(**item.model_dump()) for item in payload.items])
    _calc_totals(row)

    await adjust_parcel_stock(db, company_id=current_user.company_id, items=payload.items, operation="purchase_reverse")

    amount = float(row.transaction_final_amount or row.total_amount or 0)
    party = row.party or "Unknown Supplier"
    if amount > 0:
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type="purchase_return", transaction_id=str(row_id), transaction_date=row.date, created_by=get_actor_name(current_user), entries=[
            {"account_name": party, "debit": amount, "credit": 0, "narration": f"Purchase Return {row.memo_number}"},
            {"account_name": "Purchase", "debit": 0, "credit": amount, "narration": f"Purchase Return {row.memo_number} to {party}"},
        ])

    await db.commit()
    await db.refresh(row)
    row = (await db.execute(select(ParcelPurchaseReturn).options(selectinload(ParcelPurchaseReturn.items)).where(ParcelPurchaseReturn.id == str(row_id)))).scalar_one()
    return ParcelPurchaseReturnOut.model_validate(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(ParcelPurchaseReturn).options(selectinload(ParcelPurchaseReturn.items))
        .where(ParcelPurchaseReturn.id == str(row_id), ParcelPurchaseReturn.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase Return not found")

    # Reverse: deleting a purchase return means the stock comes back
    await adjust_parcel_stock(db, company_id=current_user.company_id, items=row.items, operation="purchase")
    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))

    await db.delete(row)
    await db.commit()
