from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import AccountMaster, JournalEntry, User
from app.schemas import JournalEntryCreate, JournalEntryOut, JournalEntryUpdate
from app.utils import CURRENCIES, CURRENCY_RATES, get_actor_name, post_ledger_entries, reverse_ledger_entries

router = APIRouter(prefix="/api/journal-entries", tags=["journal-entries"])

JOURNAL_TYPES = ["Journal", "Contra", "Opening"]


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
        "journal_types": JOURNAL_TYPES,
        "currencies": CURRENCIES,
        "currency_rates": CURRENCY_RATES,
        "accounts": list(accounts),
    }


@router.get("", response_model=list[JournalEntryOut])
async def list_rows(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(JournalEntry).where(JournalEntry.company_id == current_user.company_id)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(
            JournalEntry.credit_account.ilike(like) |
            JournalEntry.debit_account.ilike(like) |
            JournalEntry.narration.ilike(like)
        )
    q = q.order_by(JournalEntry.date.desc(), JournalEntry.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return [JournalEntryOut.model_validate(r) for r in rows]


@router.get("/{row_id}", response_model=JournalEntryOut)
async def get_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(JournalEntry).where(JournalEntry.id == str(row_id), JournalEntry.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal Entry not found")
    return JournalEntryOut.model_validate(row)


@router.post("", response_model=JournalEntryOut, status_code=status.HTTP_201_CREATED)
async def create_row(
    payload: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = JournalEntry(company_id=current_user.company_id, **payload.model_dump())
    row.created_by_name = get_actor_name(current_user)
    db.add(row)
    await db.flush()

    amount = float(row.amount or 0)
    if amount > 0:
        narration = row.narration or f"Journal - Dr {row.debit_account} Cr {row.credit_account}"
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type="journal",
            transaction_id=row.id, transaction_date=row.date, created_by=get_actor_name(current_user),
            entries=[
                {"account_name": row.debit_account or "Unknown", "debit": amount, "credit": 0, "narration": narration},
                {"account_name": row.credit_account or "Unknown", "debit": 0, "credit": amount, "narration": narration},
            ])

    await db.commit()
    await db.refresh(row)
    return JournalEntryOut.model_validate(row)


@router.put("/{row_id}", response_model=JournalEntryOut)
async def update_row(
    row_id: UUID,
    payload: JournalEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(JournalEntry).where(JournalEntry.id == str(row_id), JournalEntry.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal Entry not found")

    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))
    for k, v in payload.model_dump().items():
        setattr(row, k, v)

    amount = float(row.amount or 0)
    if amount > 0:
        narration = row.narration or f"Journal - Dr {row.debit_account} Cr {row.credit_account}"
        await post_ledger_entries(db, company_id=current_user.company_id, transaction_type="journal",
            transaction_id=str(row_id), transaction_date=row.date, created_by=get_actor_name(current_user),
            entries=[
                {"account_name": row.debit_account or "Unknown", "debit": amount, "credit": 0, "narration": narration},
                {"account_name": row.credit_account or "Unknown", "debit": 0, "credit": amount, "narration": narration},
            ])

    await db.commit()
    await db.refresh(row)
    return JournalEntryOut.model_validate(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_row(
    row_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(JournalEntry).where(JournalEntry.id == str(row_id), JournalEntry.company_id == current_user.company_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal Entry not found")

    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))
    await db.delete(row)
    await db.commit()
