from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func

from app.auth import get_current_user
from app.database import get_db
from app.models.models import AccountMaster, Loan, User
from app.schemas import LoanCreate, LoanOut, LoanUpdate
from app.utils import CURRENCIES, CURRENCY_RATES, get_actor_name, next_number, post_ledger_entries, reverse_ledger_entries

router = APIRouter(prefix="/api/loans", tags=["loans"])

LOAN_TYPES = ["Given", "Taken"]


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
    brokers = (await db.execute(
        select(AccountMaster.account_group_name)
        .where(AccountMaster.company_id == current_user.company_id, func.lower(AccountMaster.account_type) == "broker")
        .order_by(AccountMaster.account_group_name)
    )).scalars().all()
    next_inv = await next_number(db, Loan, Loan.inv_no, current_user.company_id)
    return {
        "loan_types": LOAN_TYPES,
        "currencies": CURRENCIES,
        "currency_rates": CURRENCY_RATES,
        "parties": list(parties),
        "brokers": list(brokers),
        "accounts": list(parties),
        "next_inv_no": next_inv,
    }


@router.get("", response_model=list[LoanOut])
async def list_rows(
    loan_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Loan).where(Loan.company_id == current_user.company_id)
    if loan_type:
        q = q.where(Loan.loan_type == loan_type)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(Loan.party.ilike(like) | Loan.narration.ilike(like))
    q = q.order_by(Loan.date.desc(), Loan.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return [LoanOut.model_validate(r) for r in rows]


@router.get("/{row_id}", response_model=LoanOut)
async def get_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(Loan).where(Loan.id == str(row_id), Loan.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")
    return LoanOut.model_validate(row)


@router.post("", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
async def create_row(
    payload: LoanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = Loan(company_id=current_user.company_id, **payload.model_dump())
    row.created_by_name = get_actor_name(current_user)
    db.add(row)
    await db.flush()

    amount = float(row.amount or 0)
    if amount > 0:
        if row.loan_type == "Given":
            entries = [
                {"account_name": row.party or "Loan Party", "debit": amount, "credit": 0, "narration": f"Loan Given to {row.party}"},
                {"account_name": row.from_account or "Cash", "debit": 0, "credit": amount, "narration": f"Loan Given - {row.narration or ''}"},
            ]
        else:
            entries = [
                {"account_name": row.to_account or "Cash", "debit": amount, "credit": 0, "narration": f"Loan Taken - {row.narration or ''}"},
                {"account_name": row.party or "Loan Party", "debit": 0, "credit": amount, "narration": f"Loan Taken from {row.party}"},
            ]
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type=f"loan_{row.loan_type.lower()}",
            transaction_id=row.id, transaction_date=row.date, created_by=get_actor_name(current_user), entries=entries)

    await db.commit()
    await db.refresh(row)
    return LoanOut.model_validate(row)


@router.put("/{row_id}", response_model=LoanOut)
async def update_row(
    row_id: UUID,
    payload: LoanUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(Loan).where(Loan.id == str(row_id), Loan.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))

    for k, v in payload.model_dump().items():
        setattr(row, k, v)

    amount = float(row.amount or 0)
    if amount > 0:
        if row.loan_type == "Given":
            entries = [
                {"account_name": row.party or "Loan Party", "debit": amount, "credit": 0, "narration": f"Loan Given to {row.party}"},
                {"account_name": row.from_account or "Cash", "debit": 0, "credit": amount, "narration": f"Loan Given - {row.narration or ''}"},
            ]
        else:
            entries = [
                {"account_name": row.to_account or "Cash", "debit": amount, "credit": 0, "narration": f"Loan Taken - {row.narration or ''}"},
                {"account_name": row.party or "Loan Party", "debit": 0, "credit": amount, "narration": f"Loan Taken from {row.party}"},
            ]
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type=f"loan_{row.loan_type.lower()}",
            transaction_id=str(row_id), transaction_date=row.date, created_by=get_actor_name(current_user), entries=entries)

    await db.commit()
    await db.refresh(row)
    return LoanOut.model_validate(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(Loan).where(Loan.id == str(row_id), Loan.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))
    await db.delete(row)
    await db.commit()
