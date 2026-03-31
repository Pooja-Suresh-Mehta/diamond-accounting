from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.models import AccountMaster, MemoOut, MemoOutReturn, MemoOutReturnItem, User
from app.schemas import MemoOutReturnCreate, MemoOutReturnOut, MemoOutReturnUpdate
from app.utils import (
    CATEGORIES, CURRENCIES, CURRENCY_RATES, PAYMENT_STATUSES, PURCHASE_TYPES, SUB_TYPES,
    adjust_parcel_stock, ensure_unique, get_actor_name, next_number,
    post_ledger_entries, reverse_ledger_entries,
)

router = APIRouter(prefix="/api/memo-out-return", tags=["memo-out-return"])


def _calc_totals(row: MemoOutReturn):
    total_carats = sum((i.weight or 0) for i in row.items)
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
    memo_rows = (await db.execute(
        select(MemoOut).options(selectinload(MemoOut.items))
        .where(MemoOut.company_id == current_user.company_id)
        .order_by(MemoOut.created_at.desc())
    )).scalars().all()
    return {
        "types": PURCHASE_TYPES, "sub_types": SUB_TYPES, "categories": CATEGORIES,
        "currencies": CURRENCIES, "currency_rates": CURRENCY_RATES,
        "parties": parties, "payment_statuses": PAYMENT_STATUSES,
        "next_invoice_number": await next_number(db, MemoOutReturn, MemoOutReturn.invoice_number, current_user.company_id),
        "memo_numbers": [r.invoice_number for r in memo_rows if r.invoice_number],
        "memo_items": [{
            "invoice_number": r.invoice_number, "party": r.party,
            "currency": r.currency, "inr_rate": r.inr_rate, "usd_rate": r.usd_rate,
            "items": [{"lot_number": i.lot_number, "item_name": i.item_name, "weight": i.weight, "pcs": i.pcs, "rate": i.rate, "usd_rate": i.usd_rate} for i in r.items],
        } for r in memo_rows],
    }


@router.get("", response_model=list[MemoOutReturnOut])
async def list_rows(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(MemoOutReturn).options(selectinload(MemoOutReturn.items)).where(MemoOutReturn.company_id == current_user.company_id)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(MemoOutReturn.invoice_number.ilike(like) | MemoOutReturn.party.ilike(like))
    q = q.order_by(MemoOutReturn.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return [MemoOutReturnOut.model_validate(r) for r in rows]


@router.get("/{row_id}", response_model=MemoOutReturnOut)
async def get_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(MemoOutReturn).options(selectinload(MemoOutReturn.items))
        .where(MemoOutReturn.id == str(row_id), MemoOutReturn.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memo Out Return not found")
    return MemoOutReturnOut.model_validate(row)


@router.post("", response_model=MemoOutReturnOut, status_code=status.HTTP_201_CREATED)
async def create_row(
    payload: MemoOutReturnCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_unique(db, MemoOutReturn, MemoOutReturn.invoice_number, current_user.company_id, payload.invoice_number, label="Invoice Number")
    data = payload.model_dump(exclude={"items"})
    row = MemoOutReturn(company_id=current_user.company_id, **data)
    row.created_by_name = get_actor_name(current_user)
    row.items = [MemoOutReturnItem(**item.model_dump()) for item in payload.items]
    _calc_totals(row)
    db.add(row)

    # Memo return = stock comes back from party
    await adjust_parcel_stock(db, company_id=current_user.company_id, items=payload.items, operation="memo_out_reverse")

    await db.flush()
    amount = float(row.transaction_final_amount or row.total_amount or 0)
    party = row.party or "Unknown Party"
    if amount > 0:
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type="memo_out_return", transaction_id=row.id, transaction_date=row.date, created_by=get_actor_name(current_user), entries=[
            {"account_name": "Stock", "debit": amount, "credit": 0, "narration": f"Memo Return {row.invoice_number} from {party}"},
            {"account_name": party, "debit": 0, "credit": amount, "narration": f"Memo Return {row.invoice_number}"},
        ])

    await db.commit()
    await db.refresh(row)
    row = (await db.execute(select(MemoOutReturn).options(selectinload(MemoOutReturn.items)).where(MemoOutReturn.id == row.id))).scalar_one()
    return MemoOutReturnOut.model_validate(row)


@router.put("/{row_id}", response_model=MemoOutReturnOut)
async def update_row(
    row_id: UUID,
    payload: MemoOutReturnUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(MemoOutReturn).options(selectinload(MemoOutReturn.items))
        .where(MemoOutReturn.id == str(row_id), MemoOutReturn.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memo Out Return not found")
    await ensure_unique(db, MemoOutReturn, MemoOutReturn.invoice_number, current_user.company_id, payload.invoice_number, exclude_id=str(row_id), label="Invoice Number")

    # Reverse old: the old return had reduced on_memo, so undo that
    await adjust_parcel_stock(db, company_id=current_user.company_id, items=row.items, operation="memo_out")
    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))

    for k, v in payload.model_dump(exclude={"items"}).items():
        setattr(row, k, v)
    row.items.clear()
    row.items.extend([MemoOutReturnItem(**item.model_dump()) for item in payload.items])
    _calc_totals(row)

    await adjust_parcel_stock(db, company_id=current_user.company_id, items=payload.items, operation="memo_out_reverse")

    amount = float(row.transaction_final_amount or row.total_amount or 0)
    party = row.party or "Unknown Party"
    if amount > 0:
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type="memo_out_return", transaction_id=str(row_id), transaction_date=row.date, created_by=get_actor_name(current_user), entries=[
            {"account_name": "Stock", "debit": amount, "credit": 0, "narration": f"Memo Return {row.invoice_number} from {party}"},
            {"account_name": party, "debit": 0, "credit": amount, "narration": f"Memo Return {row.invoice_number}"},
        ])

    await db.commit()
    await db.refresh(row)
    row = (await db.execute(select(MemoOutReturn).options(selectinload(MemoOutReturn.items)).where(MemoOutReturn.id == str(row_id)))).scalar_one()
    return MemoOutReturnOut.model_validate(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(MemoOutReturn).options(selectinload(MemoOutReturn.items))
        .where(MemoOutReturn.id == str(row_id), MemoOutReturn.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memo Out Return not found")

    # Deleting a memo return = the stock goes back to "on memo"
    await adjust_parcel_stock(db, company_id=current_user.company_id, items=row.items, operation="memo_out")
    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))

    await db.delete(row)
    await db.commit()
