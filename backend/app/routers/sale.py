from datetime import date as date_t
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.models import (
    AccountMaster, ParcelMaster, ParcelMergeLog,
    ParcelPurchase, ParcelPurchaseItem, ParcelPurchaseReturn, ParcelPurchaseReturnItem,
    Sale, SaleItem, SaleReturn, SaleReturnItem,
    MemoOut, MemoOutItem, MemoOutReturn, MemoOutReturnItem,
    Consignment, ConsignmentItem, ConsignmentReturn, ConsignmentReturnItem,
    User,
)
from app.schemas import SaleCreate, SaleOut, SaleUpdate
from app.utils import (
    CATEGORIES, CURRENCIES, CURRENCY_RATES, PAYMENT_STATUSES, PURCHASE_TYPES, SUB_TYPES, ensure_unique, get_actor_name, next_number,
    post_ledger_entries, reverse_ledger_entries,
)

router = APIRouter(prefix="/api/sale", tags=["sale"])

CUSTOMER_TYPES = ["customer", "overseas customer", "individual", "supplier", "overseas supplier"]


def _calc_totals(row: Sale):
    total_carats = sum((i.selected_carat or i.issue_carats or 0) for i in row.items)
    total_amount = sum((i.amount or 0) for i in row.items)
    row.total_carats = float(total_carats)
    row.total_amount = float(total_amount)
    row.inr_amt = float(row.inr_final_amount or row.transaction_final_amount or total_amount)
    row.usd_amt = float(row.usd_final_amount or total_amount)


@router.get("/options")
async def get_options(
    as_of: date_t | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    parties = (await db.execute(
        select(AccountMaster.account_group_name)
        .where(
            AccountMaster.company_id == current_user.company_id,
            func.lower(AccountMaster.account_type).in_(CUSTOMER_TYPES),
        )
        .order_by(AccountMaster.account_group_name)
    )).scalars().all()
    parcel_rows = (await db.execute(
        select(ParcelMaster).where(ParcelMaster.company_id == current_user.company_id).order_by(ParcelMaster.lot_no)
    )).scalars().all()
    parcel_rows = sorted(parcel_rows, key=lambda r: int(str(r.lot_no)) if r.lot_no and str(r.lot_no).isdigit() else 0)

    # Compute actual on-hand weight per lot (opening + purchased - returns - sold - memo - consignment)
    cid = current_user.company_id
    lot_nos = [r.lot_no for r in parcel_rows if r.lot_no]

    # Fetch merge logs to include absorbed lots in all queries
    merge_logs = (await db.execute(
        select(ParcelMergeLog).where(
            ParcelMergeLog.company_id == cid,
            ParcelMergeLog.surviving_lot_no.in_(lot_nos),
            ParcelMergeLog.reversed == False,  # noqa: E712
        )
    )).scalars().all()
    merged_lot_numbers = [ml.merged_lot_no for ml in merge_logs]
    all_lot_numbers = lot_nos + merged_lot_numbers

    def _wdict(rows): return {r.lot_number: float(r.w) for r in rows}

    if all_lot_numbers:
        def _date_filter(header_cls):
            return [header_cls.date <= as_of] if as_of else []

        purch_w      = _wdict((await db.execute(
            select(ParcelPurchaseItem.lot_number, func.coalesce(func.sum(ParcelPurchaseItem.selected_carat), 0).label("w"))
            .join(ParcelPurchase, ParcelPurchaseItem.purchase_id == ParcelPurchase.id)
            .where(ParcelPurchase.company_id == cid, ParcelPurchaseItem.lot_number.in_(all_lot_numbers), *_date_filter(ParcelPurchase))
            .group_by(ParcelPurchaseItem.lot_number)
        )).all())
        purch_ret_w  = _wdict((await db.execute(
            select(ParcelPurchaseReturnItem.lot_number, func.coalesce(func.sum(ParcelPurchaseReturnItem.selected_carat), 0).label("w"))
            .join(ParcelPurchaseReturn, ParcelPurchaseReturnItem.purchase_return_id == ParcelPurchaseReturn.id)
            .where(ParcelPurchaseReturn.company_id == cid, ParcelPurchaseReturnItem.lot_number.in_(all_lot_numbers), *_date_filter(ParcelPurchaseReturn))
            .group_by(ParcelPurchaseReturnItem.lot_number)
        )).all())
        sale_w       = _wdict((await db.execute(
            select(SaleItem.lot_number, func.coalesce(func.sum(SaleItem.issue_carats), 0).label("w"))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.company_id == cid, SaleItem.lot_number.in_(all_lot_numbers), *_date_filter(Sale))
            .group_by(SaleItem.lot_number)
        )).all())
        sale_ret_w   = _wdict((await db.execute(
            select(SaleReturnItem.lot_number, func.coalesce(func.sum(SaleReturnItem.issue_carats), 0).label("w"))
            .join(SaleReturn, SaleReturnItem.sale_return_id == SaleReturn.id)
            .where(SaleReturn.company_id == cid, SaleReturnItem.lot_number.in_(all_lot_numbers), *_date_filter(SaleReturn))
            .group_by(SaleReturnItem.lot_number)
        )).all())
        memo_w       = _wdict((await db.execute(
            select(MemoOutItem.lot_number, func.coalesce(func.sum(MemoOutItem.weight), 0).label("w"))
            .join(MemoOut, MemoOutItem.memo_out_id == MemoOut.id)
            .where(MemoOut.company_id == cid, MemoOutItem.lot_number.in_(all_lot_numbers), *_date_filter(MemoOut))
            .group_by(MemoOutItem.lot_number)
        )).all())
        memo_ret_w   = _wdict((await db.execute(
            select(MemoOutReturnItem.lot_number, func.coalesce(func.sum(MemoOutReturnItem.weight), 0).label("w"))
            .join(MemoOutReturn, MemoOutReturnItem.memo_out_return_id == MemoOutReturn.id)
            .where(MemoOutReturn.company_id == cid, MemoOutReturnItem.lot_number.in_(all_lot_numbers), *_date_filter(MemoOutReturn))
            .group_by(MemoOutReturnItem.lot_number)
        )).all())
        consign_w    = _wdict((await db.execute(
            select(ConsignmentItem.lot_number, func.coalesce(func.sum(ConsignmentItem.issue_carats), 0).label("w"))
            .join(Consignment, ConsignmentItem.consignment_id == Consignment.id)
            .where(Consignment.company_id == cid, ConsignmentItem.lot_number.in_(all_lot_numbers), *_date_filter(Consignment))
            .group_by(ConsignmentItem.lot_number)
        )).all())
        consign_ret_w = _wdict((await db.execute(
            select(ConsignmentReturnItem.lot_number, func.coalesce(func.sum(ConsignmentReturnItem.issue_carats), 0).label("w"))
            .join(ConsignmentReturn, ConsignmentReturnItem.consignment_return_id == ConsignmentReturn.id)
            .where(ConsignmentReturn.company_id == cid, ConsignmentReturnItem.lot_number.in_(all_lot_numbers), *_date_filter(ConsignmentReturn))
            .group_by(ConsignmentReturnItem.lot_number)
        )).all())
    else:
        purch_w = purch_ret_w = sale_w = sale_ret_w = {}
        memo_w = memo_ret_w = consign_w = consign_ret_w = {}

    def _available_carats(r):
        ln = r.lot_no
        opening   = float(r.opening_weight_carats or 0)
        purchased = purch_w.get(ln, 0) - purch_ret_w.get(ln, 0)
        sold      = sale_w.get(ln, 0) - sale_ret_w.get(ln, 0)
        on_memo   = memo_w.get(ln, 0) - memo_ret_w.get(ln, 0)
        on_cons   = consign_w.get(ln, 0) - consign_ret_w.get(ln, 0)
        return round(opening + purchased - sold - on_memo - on_cons, 4)

    return {
        "types": PURCHASE_TYPES, "sub_types": SUB_TYPES, "categories": CATEGORIES,
        "currencies": CURRENCIES, "currency_rates": CURRENCY_RATES,
        "parties": parties,
        "lot_numbers": [r.lot_no for r in parcel_rows if r.lot_no],
        "lot_items": [{
            "lot_no": r.lot_no, "item_name": r.item_name, "shape": r.shape,
            "color": r.color, "clarity": r.clarity, "size": r.size, "sieve_mm": r.sieve_mm,
            "opening_weight_carats": r.opening_weight_carats,
            "available_carats": _available_carats(r),
            "purchase_cost_usd_amount": r.purchase_cost_usd_amount,
            "purchase_cost_price_usd_carats": r.purchase_cost_usd_carat,
        } for r in parcel_rows if r.lot_no],
        "payment_statuses": PAYMENT_STATUSES,
    }


@router.get("/next-invoice-number")
async def get_next_invoice_number(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate next invoice number with database-level locking to prevent duplicates."""
    next_num = await next_number(db, Sale, Sale.invoice_number, current_user.company_id)
    return {"next_invoice_number": next_num}


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
    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))

    for k, v in payload.model_dump(exclude={"items"}).items():
        setattr(row, k, v)
    row.items.clear()
    row.items.extend([SaleItem(**item.model_dump()) for item in payload.items])
    _calc_totals(row)


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

    await reverse_ledger_entries(db, company_id=current_user.company_id, transaction_id=str(row_id))

    await db.delete(row)
    await db.commit()
