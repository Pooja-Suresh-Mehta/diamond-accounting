from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import AccountMaster, IncomeExpense, User
from app.schemas import IncomeExpenseCreate, IncomeExpenseOut, IncomeExpenseUpdate
from app.utils import CURRENCIES, CURRENCY_RATES, get_actor_name, post_ledger_entries, reverse_ledger_entries

router = APIRouter(prefix="/api/income-expense", tags=["income-expense"])

IE_TYPES = ["Income", "Expense"]


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
        "ie_types": IE_TYPES,
        "currencies": CURRENCIES,
        "currency_rates": CURRENCY_RATES,
        "accounts": list(accounts),
    }


@router.get("", response_model=list[IncomeExpenseOut])
async def list_rows(
    ie_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(IncomeExpense).where(IncomeExpense.company_id == current_user.company_id)
    if ie_type:
        q = q.where(IncomeExpense.ie_type == ie_type)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(IncomeExpense.main_account.ilike(like) | IncomeExpense.trn_account.ilike(like) | IncomeExpense.description.ilike(like))
    q = q.order_by(IncomeExpense.date.desc(), IncomeExpense.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return [IncomeExpenseOut.model_validate(r) for r in rows]


@router.get("/{row_id}", response_model=IncomeExpenseOut)
async def get_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(IncomeExpense).where(IncomeExpense.id == str(row_id), IncomeExpense.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Income/Expense not found")
    return IncomeExpenseOut.model_validate(row)


@router.post("", response_model=IncomeExpenseOut, status_code=status.HTTP_201_CREATED)
async def create_row(
    payload: IncomeExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = IncomeExpense(company_id=current_user.company_id, **payload.model_dump())
    row.created_by_name = get_actor_name(current_user)
    db.add(row)
    await db.flush()

    amount = float(row.amount or 0)
    if amount > 0:
        narration = row.description or f"{row.ie_type} - {row.main_account}"
        if row.ie_type == "Income":
            entries = [
                {"account_name": row.main_account or "Cash", "debit": amount, "credit": 0, "narration": narration},
                {"account_name": row.trn_account or "Income", "debit": 0, "credit": amount, "narration": narration},
            ]
        else:
            entries = [
                {"account_name": row.trn_account or "Expense Account", "debit": amount, "credit": 0, "narration": narration},
                {"account_name": row.main_account or "Cash", "debit": 0, "credit": amount, "narration": narration},
            ]
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type=f"ie_{row.ie_type.lower()}",
            transaction_id=row.id, transaction_date=row.date, created_by=get_actor_name(current_user), entries=entries)

    await db.commit()
    await db.refresh(row)
    return IncomeExpenseOut.model_validate(row)


@router.put("/{row_id}", response_model=IncomeExpenseOut)
async def update_row(
    row_id: UUID,
    payload: IncomeExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(IncomeExpense).where(IncomeExpense.id == str(row_id), IncomeExpense.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Income/Expense not found")

    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))
    for k, v in payload.model_dump().items():
        setattr(row, k, v)

    amount = float(row.amount or 0)
    if amount > 0:
        narration = row.description or f"{row.ie_type} - {row.main_account}"
        if row.ie_type == "Income":
            entries = [
                {"account_name": row.main_account or "Cash", "debit": amount, "credit": 0, "narration": narration},
                {"account_name": row.trn_account or "Income", "debit": 0, "credit": amount, "narration": narration},
            ]
        else:
            entries = [
                {"account_name": row.trn_account or "Expense Account", "debit": amount, "credit": 0, "narration": narration},
                {"account_name": row.main_account or "Cash", "debit": 0, "credit": amount, "narration": narration},
            ]
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type=f"ie_{row.ie_type.lower()}",
            transaction_id=str(row_id), transaction_date=row.date, created_by=get_actor_name(current_user), entries=entries)

    await db.commit()
    await db.refresh(row)
    return IncomeExpenseOut.model_validate(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(IncomeExpense).where(IncomeExpense.id == str(row_id), IncomeExpense.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Income/Expense not found")

    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))
    await db.delete(row)
    await db.commit()
