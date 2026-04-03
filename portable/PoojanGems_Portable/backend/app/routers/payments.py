from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import AccountMaster, Payment, User
from app.schemas import PaymentCreate, PaymentOut, PaymentUpdate
from app.utils import CURRENCIES, CURRENCY_RATES, get_actor_name, post_ledger_entries, reverse_ledger_entries

router = APIRouter(prefix="/api/payments", tags=["payments"])

VOUCHER_TYPES = ["Payment", "Receipt"]


@router.get("/options")
async def get_options(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    accounts = (await db.execute(
        select(AccountMaster.account_group_name)
        .where(AccountMaster.company_id == current_user.company_id)
        .order_by(AccountMaster.account_group_name)
    )).scalars().all()
    return {
        "voucher_types": VOUCHER_TYPES,
        "currencies": CURRENCIES,
        "currency_rates": CURRENCY_RATES,
        "accounts": list(accounts),
    }


@router.get("", response_model=list[PaymentOut])
async def list_rows(
    vtype: str | None = Query(default=None),
    pay_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Payment).where(Payment.company_id == current_user.company_id)
    if vtype:
        q = q.where(Payment.vtype == vtype)
    if pay_type:
        q = q.where(Payment.pay_type == pay_type)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(
            Payment.main_account.ilike(like) |
            Payment.party_account.ilike(like) |
            Payment.narration.ilike(like)
        )
    q = q.order_by(Payment.date.desc(), Payment.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return [PaymentOut.model_validate(r) for r in rows]


@router.get("/{row_id}", response_model=PaymentOut)
async def get_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(Payment).where(Payment.id == str(row_id), Payment.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return PaymentOut.model_validate(row)


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def create_row(
    payload: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = Payment(company_id=current_user.company_id, **payload.model_dump())
    row.created_by_name = get_actor_name(current_user)
    db.add(row)
    await db.flush()

    amount = float(row.amount or 0)
    if amount > 0:
        narration = row.narration or f"{row.vtype} - {row.party_account or ''}"
        if row.vtype == "Receipt":
            entries = [
                {"account_name": row.main_account or "Cash", "debit": amount, "credit": 0, "narration": narration},
                {"account_name": row.party_account or "Customer", "debit": 0, "credit": amount, "narration": narration},
            ]
        else:
            entries = [
                {"account_name": row.party_account or "Supplier", "debit": amount, "credit": 0, "narration": narration},
                {"account_name": row.main_account or "Cash", "debit": 0, "credit": amount, "narration": narration},
            ]
        if row.has_exchange_diff and row.exchange_diff:
            entries.append({
                "account_name": "Exchange Difference",
                "debit": row.exchange_diff if row.exchange_diff > 0 else 0,
                "credit": abs(row.exchange_diff) if row.exchange_diff < 0 else 0,
                "narration": f"Exchange difference on {row.vtype}",
            })
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type=f"payment_{row.vtype.lower()}",
            transaction_id=row.id, transaction_date=row.date, created_by=get_actor_name(current_user), entries=entries)

    await db.commit()
    await db.refresh(row)
    return PaymentOut.model_validate(row)


@router.put("/{row_id}", response_model=PaymentOut)
async def update_row(
    row_id: UUID,
    payload: PaymentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(Payment).where(Payment.id == str(row_id), Payment.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))
    for k, v in payload.model_dump().items():
        setattr(row, k, v)

    amount = float(row.amount or 0)
    if amount > 0:
        narration = row.narration or f"{row.vtype} - {row.party_account or ''}"
        if row.vtype == "Receipt":
            entries = [
                {"account_name": row.main_account or "Cash", "debit": amount, "credit": 0, "narration": narration},
                {"account_name": row.party_account or "Customer", "debit": 0, "credit": amount, "narration": narration},
            ]
        else:
            entries = [
                {"account_name": row.party_account or "Supplier", "debit": amount, "credit": 0, "narration": narration},
                {"account_name": row.main_account or "Cash", "debit": 0, "credit": amount, "narration": narration},
            ]
        if row.has_exchange_diff and row.exchange_diff:
            entries.append({
                "account_name": "Exchange Difference",
                "debit": row.exchange_diff if row.exchange_diff > 0 else 0,
                "credit": abs(row.exchange_diff) if row.exchange_diff < 0 else 0,
                "narration": f"Exchange difference on {row.vtype}",
            })
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type=f"payment_{row.vtype.lower()}",
            transaction_id=str(row_id), transaction_date=row.date, created_by=get_actor_name(current_user), entries=entries)

    await db.commit()
    await db.refresh(row)
    return PaymentOut.model_validate(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(Payment).where(Payment.id == str(row_id), Payment.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))
    await db.delete(row)
    await db.commit()
