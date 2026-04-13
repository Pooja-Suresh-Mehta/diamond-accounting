"""
Parcel Reports (01-10) - Read-only query endpoints.
Each report filters and returns data from transaction tables.
"""
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.models import (
    Consignment, ConsignmentItem, ConsignmentReturn, ConsignmentReturnItem,
    LedgerEntry, MemoOut, MemoOutItem, MemoOutReturn, MemoOutReturnItem,
    ParcelMaster, ParcelPurchase, ParcelPurchaseItem, ParcelPurchaseReturn, ParcelPurchaseReturnItem,
    Sale, SaleItem, SaleReturn, SaleReturnItem, User,
)
from app.utils import CURRENCIES

router = APIRouter(prefix="/api/parcel-reports", tags=["parcel-reports"])


def _row_to_dict(row, *extra_attrs):
    d = {c.name: getattr(row, c.name) for c in row.__table__.columns}
    for attr in extra_attrs:
        d[attr] = getattr(row, attr, None)
    return d


# ── 01: Parcel Stock Report ──────────────────────────────

@router.get("/stock")
async def parcel_stock_report(
    shape: Optional[str] = Query(default=None),
    color: Optional[str] = Query(default=None),
    color_group: Optional[str] = Query(default=None),
    clarity: Optional[str] = Query(default=None),
    size: Optional[str] = Query(default=None),
    lot_no: Optional[str] = Query(default=None),
    cut: Optional[str] = Query(default=None),
    show: Optional[str] = Query(default=None),
    hold_status: Optional[str] = Query(default=None),
    single_parcel: Optional[str] = Query(default=None),
    lab: Optional[str] = Query(default=None),
    zone: Optional[str] = Query(default=None),
    grading: Optional[str] = Query(default=None),
    carat_from: Optional[float] = Query(default=None),
    carat_to: Optional[float] = Query(default=None),
    price_from: Optional[float] = Query(default=None),
    price_to: Optional[float] = Query(default=None),
    # Numeric filters
    table_depth_from: Optional[float] = Query(default=None),
    table_depth_to: Optional[float] = Query(default=None),
    table_pct_from: Optional[float] = Query(default=None),
    table_pct_to: Optional[float] = Query(default=None),
    ca_from: Optional[float] = Query(default=None),
    ca_to: Optional[float] = Query(default=None),
    ch_from: Optional[float] = Query(default=None),
    ch_to: Optional[float] = Query(default=None),
    ph_from: Optional[float] = Query(default=None),
    ph_to: Optional[float] = Query(default=None),
    pa_from: Optional[float] = Query(default=None),
    pa_to: Optional[float] = Query(default=None),
    # Date filters
    purchase_date_from: Optional[date_type] = Query(default=None),
    purchase_date_to: Optional[date_type] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(ParcelMaster).where(ParcelMaster.company_id == current_user.company_id)
    if shape:
        shapes = [s.strip() for s in shape.split(',')]
        q = q.where(or_(*[ParcelMaster.shape.ilike(f"%{s}%") for s in shapes]))
    if color:
        colors = [c.strip() for c in color.split(',')]
        q = q.where(or_(*[ParcelMaster.color.ilike(f"%{c}%") for c in colors]))
    if clarity:
        clarities = [c.strip() for c in clarity.split(',')]
        q = q.where(or_(*[ParcelMaster.clarity.ilike(f"%{c}%") for c in clarities]))
    if size:
        q = q.where(ParcelMaster.size.ilike(f"%{size}%"))
    if lot_no:
        like = f"%{lot_no}%"
        q = q.where(ParcelMaster.lot_no.ilike(like) | ParcelMaster.item_name.ilike(like))
    if cut:
        q = q.where(ParcelMaster.cut.ilike(f"%{cut}%"))
    if lab:
        labs = [l.strip() for l in lab.split(',')]
        q = q.where(or_(*[ParcelMaster.lab.ilike(f"%{l}%") for l in labs]))
    if carat_from is not None:
        on_hand_expr = (
            func.coalesce(ParcelMaster.opening_weight_carats, 0)
            + func.coalesce(ParcelMaster.purchased_weight, 0)
            - func.coalesce(ParcelMaster.sold_weight, 0)
            - func.coalesce(ParcelMaster.on_memo_weight, 0)
        )
        q = q.where(on_hand_expr >= carat_from)
    if carat_to is not None:
        on_hand_expr = (
            func.coalesce(ParcelMaster.opening_weight_carats, 0)
            + func.coalesce(ParcelMaster.purchased_weight, 0)
            - func.coalesce(ParcelMaster.sold_weight, 0)
            - func.coalesce(ParcelMaster.on_memo_weight, 0)
        )
        q = q.where(on_hand_expr <= carat_to)
    if price_from is not None:
        q = q.where(ParcelMaster.asking_price_usd_carats >= price_from)
    if price_to is not None:
        q = q.where(ParcelMaster.asking_price_usd_carats <= price_to)
    if purchase_date_from:
        q = q.where(ParcelMaster.created_at >= purchase_date_from)
    if purchase_date_to:
        q = q.where(ParcelMaster.created_at <= purchase_date_to)
    q = q.order_by(ParcelMaster.lot_no)
    rows = (await db.execute(q)).scalars().all()

    result = []
    for r in rows:
        on_hand = (
            float(r.opening_weight_carats or 0)
            + float(r.purchased_weight or 0)
            - float(r.sold_weight or 0)
            - float(r.on_memo_weight or 0)
        )
        carats = float(r.opening_weight_carats or 0) + float(r.purchased_weight or 0)
        on_memo = float(r.on_memo_weight or 0)
        sold = float(r.sold_weight or 0)
        if on_memo > 0:
            cur_status = "Memo"
        elif sold >= carats and carats > 0:
            cur_status = "Sold"
        elif on_hand > 0:
            cur_status = "Available"
        else:
            cur_status = "Nil"
        result.append({
            "id": r.id,
            "created_date": str(r.created_at.date()) if r.created_at else None,
            "lot_no": r.lot_no,
            "item_name": r.item_name,
            "shape": r.shape,
            "color": r.color,
            "clarity": r.clarity,
            "size": r.size,
            "sieve_mm": r.sieve_mm,
            "stock_group_id": r.stock_group_id or "",
            "carats": round(carats, 3),
            "purchased_weight": round(float(r.purchased_weight or 0), 2),
            "purchased_pcs": r.purchased_pcs or 0,
            "sold_weight": round(sold, 2),
            "sold_pcs": r.sold_pcs or 0,
            "on_memo_weight": round(on_memo, 3),
            "on_memo_pcs": r.on_memo_pcs or 0,
            "on_hand_weight": round(on_hand, 3),
            "cur_status": cur_status,
            "asking_price_usd_carats": round(float(r.asking_price_usd_carats or 0), 2),
            "asking_usd_amount": round(float(r.asking_usd_amount or 0), 2),
            "purchase_cost_price_usd_carats": round(float(r.purchase_cost_usd_carat or 0), 2),
        })
    return {
        "results": result,
        "totals": {
            "purchased_weight": round(sum(r["purchased_weight"] for r in result), 2),
            "sold_weight": round(sum(r["sold_weight"] for r in result), 2),
            "on_memo_weight": round(sum(r["on_memo_weight"] for r in result), 2),
            "on_hand_weight": round(sum(r["on_hand_weight"] for r in result), 2),
        }
    }


# ── Update Location ──────────────────────────────────────

from pydantic import BaseModel as _BM
from typing import List as _List

class UpdateLocationBody(_BM):
    ids: _List[str]
    city: str = ""
    state: str = ""
    country: str = ""

class UpdateBoxGroupBody(_BM):
    ids: _List[str]
    box_name: str = ""
    group_name: str = ""

@router.post("/update-location")
async def update_location(body: UpdateLocationBody, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import update as sa_update
    await db.execute(
        sa_update(ParcelMaster)
        .where(ParcelMaster.id.in_(body.ids), ParcelMaster.company_id == current_user.company_id)
        .values(description=f"City:{body.city} State:{body.state} Country:{body.country}")
    )
    await db.commit()
    return {"ok": True}

@router.post("/update-box-group")
async def update_box_group(body: UpdateBoxGroupBody, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import update as sa_update
    await db.execute(
        sa_update(ParcelMaster)
        .where(ParcelMaster.id.in_(body.ids), ParcelMaster.company_id == current_user.company_id)
        .values(stock_group_id=body.group_name or None)
    )
    await db.commit()
    return {"ok": True}


# ── 02: Parcel Purchase Report ───────────────────────────

@router.get("/purchases")
async def parcel_purchase_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    broker: Optional[str] = Query(default=None),
    currency: Optional[str] = Query(default=None),
    inv_no: Optional[str] = Query(default=None),
    shape: Optional[str] = Query(default=None),
    size: Optional[str] = Query(default=None),
    color: Optional[str] = Query(default=None),
    clarity: Optional[str] = Query(default=None),
    sieve: Optional[str] = Query(default=None),
    lot_no: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(ParcelPurchase, ParcelPurchaseItem)
        .join(ParcelPurchaseItem, ParcelPurchaseItem.purchase_id == ParcelPurchase.id)
        .where(ParcelPurchase.company_id == current_user.company_id)
    )
    if from_date:
        q = q.where(ParcelPurchase.date >= from_date)
    if to_date:
        q = q.where(ParcelPurchase.date <= to_date)
    if party:
        q = q.where(ParcelPurchase.party.ilike(f"%{party}%"))
    if broker:
        q = q.where(ParcelPurchase.broker.ilike(f"%{broker}%"))
    if currency:
        q = q.where(ParcelPurchase.currency == currency)
    if inv_no:
        q = q.where(ParcelPurchase.invoice_number.ilike(f"%{inv_no}%"))
    if shape:
        q = q.where(ParcelPurchaseItem.shape.ilike(f"%{shape}%"))
    if color:
        q = q.where(ParcelPurchaseItem.color.ilike(f"%{color}%"))
    if clarity:
        q = q.where(ParcelPurchaseItem.clarity.ilike(f"%{clarity}%"))
    if size:
        q = q.where(ParcelPurchaseItem.size.ilike(f"%{size}%"))
    if sieve:
        q = q.where(ParcelPurchaseItem.sieve.ilike(f"%{sieve}%"))
    if lot_no:
        q = q.where(ParcelPurchaseItem.lot_number.ilike(f"%{lot_no}%"))
    q = q.order_by(ParcelPurchase.date.desc(), ParcelPurchase.invoice_number)

    rows = (await db.execute(q)).all()
    result = []
    for purchase, item in rows:
        result.append({
            "purchase_id": purchase.id,
            "date": purchase.date,
            "invoice_number": purchase.invoice_number,
            "bill_no": purchase.bill_no,
            "party": purchase.party,
            "broker": purchase.broker,
            "currency": purchase.currency,
            "lot_number": item.lot_number,
            "item_name": item.item_name,
            "shape": item.shape,
            "color": item.color,
            "clarity": item.clarity,
            "size": item.size,
            "sieve": item.sieve,
            "issue_carats": item.issue_carats,
            "reje_pct": item.reje_pct,
            "rejection": item.rejection,
            "selected_carat": item.selected_carat,
            "pcs": item.pcs,
            "rate": item.rate,
            "amount": item.amount,
            "inr_amt": purchase.inr_amt,
            "usd_amt": purchase.usd_amt,
            "less1": item.less1,
            "less2": item.less2,
            "less3": item.less3,
            "payment_status": purchase.payment_status,
        })

    return {
        "results": result,
        "totals": {
            "selected_carat": round(sum(r["selected_carat"] or 0 for r in result), 2),
            "amount": round(sum(r["amount"] or 0 for r in result), 2),
        }
    }


# ── 03: Parcel Memo Out Report ───────────────────────────

@router.get("/memo-out")
async def parcel_memo_out_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    broker: Optional[str] = Query(default=None),
    currency: Optional[str] = Query(default=None),
    inv_no: Optional[str] = Query(default=None),
    shape: Optional[str] = Query(default=None),
    size: Optional[str] = Query(default=None),
    color: Optional[str] = Query(default=None),
    clarity: Optional[str] = Query(default=None),
    sieve: Optional[str] = Query(default=None),
    lot_no: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(MemoOut, MemoOutItem)
        .join(MemoOutItem, MemoOutItem.memo_out_id == MemoOut.id)
        .where(MemoOut.company_id == current_user.company_id)
    )
    if from_date:
        q = q.where(MemoOut.date >= from_date)
    if to_date:
        q = q.where(MemoOut.date <= to_date)
    if party:
        q = q.where(MemoOut.party.ilike(f"%{party}%"))
    if currency:
        q = q.where(MemoOut.currency == currency)
    if inv_no:
        q = q.where(MemoOut.invoice_number.ilike(f"%{inv_no}%"))
    if lot_no:
        q = q.where(MemoOutItem.lot_number.ilike(f"%{lot_no}%"))
    q = q.order_by(MemoOut.date.desc())

    rows = (await db.execute(q)).all()
    result = []
    for memo, item in rows:
        result.append({
            "memo_id": memo.id,
            "date": memo.date,
            "invoice_number": memo.invoice_number,
            "party": memo.party,
            "currency": memo.currency,
            "lot_number": item.lot_number,
            "item_name": item.item_name,
            "weight": item.weight,
            "pcs": item.pcs,
            "rate": item.rate,
            "amount": item.amount,
            "inr_amt": memo.inr_amt,
            "usd_amt": memo.usd_amt,
            "payment_status": memo.payment_status,
        })

    return {
        "results": result,
        "totals": {
            "weight": round(sum(r["weight"] or 0 for r in result), 2),
            "amount": round(sum(r["amount"] or 0 for r in result), 2),
        }
    }


# ── 04: Parcel Sale Report ───────────────────────────────

@router.get("/sales")
async def parcel_sale_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    broker: Optional[str] = Query(default=None),
    currency: Optional[str] = Query(default=None),
    inv_no: Optional[str] = Query(default=None),
    shape: Optional[str] = Query(default=None),
    size: Optional[str] = Query(default=None),
    color: Optional[str] = Query(default=None),
    clarity: Optional[str] = Query(default=None),
    sieve: Optional[str] = Query(default=None),
    lot_no: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Sale, SaleItem)
        .join(SaleItem, SaleItem.sale_id == Sale.id)
        .where(Sale.company_id == current_user.company_id)
    )
    if from_date:
        q = q.where(Sale.date >= from_date)
    if to_date:
        q = q.where(Sale.date <= to_date)
    if party:
        q = q.where(Sale.party.ilike(f"%{party}%"))
    if broker:
        q = q.where(Sale.broker.ilike(f"%{broker}%"))
    if currency:
        q = q.where(Sale.currency == currency)
    if inv_no:
        q = q.where(Sale.invoice_number.ilike(f"%{inv_no}%"))
    if shape:
        q = q.where(SaleItem.shape.ilike(f"%{shape}%"))
    if color:
        q = q.where(SaleItem.color.ilike(f"%{color}%"))
    if clarity:
        q = q.where(SaleItem.clarity.ilike(f"%{clarity}%"))
    if size:
        q = q.where(SaleItem.size.ilike(f"%{size}%"))
    if lot_no:
        q = q.where(SaleItem.lot_number.ilike(f"%{lot_no}%"))
    q = q.order_by(Sale.date.desc())

    rows = (await db.execute(q)).all()
    result = []
    for sale, item in rows:
        result.append({
            "sale_id": sale.id,
            "date": sale.date,
            "invoice_number": sale.invoice_number,
            "party": sale.party,
            "broker": sale.broker,
            "currency": sale.currency,
            "lot_number": item.lot_number,
            "item_name": item.item_name,
            "shape": item.shape,
            "color": item.color,
            "clarity": item.clarity,
            "size": item.size,
            "selected_carat": item.selected_carat,
            "pcs": item.pcs,
            "rate": item.rate,
            "amount": item.amount,
            "cogs": item.cogs,
            "inr_amt": sale.inr_amt,
            "usd_amt": sale.usd_amt,
            "payment_status": sale.payment_status,
        })

    return {
        "results": result,
        "totals": {
            "selected_carat": round(sum(r["selected_carat"] or 0 for r in result), 2),
            "amount": round(sum(r["amount"] or 0 for r in result), 2),
        }
    }


# ── 05: Parcel Consignment Report ────────────────────────

@router.get("/consignments")
async def parcel_consignment_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    currency: Optional[str] = Query(default=None),
    inv_no: Optional[str] = Query(default=None),
    shape: Optional[str] = Query(default=None),
    size: Optional[str] = Query(default=None),
    color: Optional[str] = Query(default=None),
    clarity: Optional[str] = Query(default=None),
    sieve: Optional[str] = Query(default=None),
    lot_no: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Consignment, ConsignmentItem)
        .join(ConsignmentItem, ConsignmentItem.consignment_id == Consignment.id)
        .where(Consignment.company_id == current_user.company_id)
    )
    if from_date:
        q = q.where(Consignment.date >= from_date)
    if to_date:
        q = q.where(Consignment.date <= to_date)
    if party:
        q = q.where(Consignment.party.ilike(f"%{party}%"))
    if currency:
        q = q.where(Consignment.currency == currency)
    if inv_no:
        q = q.where(Consignment.invoice_number.ilike(f"%{inv_no}%"))
    if shape:
        q = q.where(ConsignmentItem.shape.ilike(f"%{shape}%"))
    if color:
        q = q.where(ConsignmentItem.color.ilike(f"%{color}%"))
    if clarity:
        q = q.where(ConsignmentItem.clarity.ilike(f"%{clarity}%"))
    if lot_no:
        q = q.where(ConsignmentItem.lot_number.ilike(f"%{lot_no}%"))
    q = q.order_by(Consignment.date.desc())

    rows = (await db.execute(q)).all()
    result = []
    for con, item in rows:
        result.append({
            "consignment_id": con.id,
            "date": con.date,
            "invoice_number": con.invoice_number,
            "party": con.party,
            "currency": con.currency,
            "lot_number": item.lot_number,
            "item_name": item.item_name,
            "shape": item.shape,
            "color": item.color,
            "clarity": item.clarity,
            "selected_carat": item.selected_carat,
            "pcs": item.pcs,
            "rate": item.rate,
            "amount": item.amount,
            "inr_amt": con.inr_amt,
            "usd_amt": con.usd_amt,
            "payment_status": con.payment_status,
        })

    return {
        "results": result,
        "totals": {
            "selected_carat": round(sum(r["selected_carat"] or 0 for r in result), 2),
            "amount": round(sum(r["amount"] or 0 for r in result), 2),
        }
    }


# ── 06: Parcel Stock History Report ──────────────────────

@router.get("/stock-history")
async def parcel_stock_history_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    lot_no: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(LedgerEntry).where(
        LedgerEntry.company_id == current_user.company_id,
        LedgerEntry.transaction_type.in_(["purchase", "sale", "memo_out", "consignment",
                                           "purchase_return", "sale_return", "memo_out_return", "consignment_return"]),
    )
    if from_date:
        q = q.where(LedgerEntry.date >= from_date)
    if to_date:
        q = q.where(LedgerEntry.date <= to_date)
    q = q.order_by(LedgerEntry.date.desc(), LedgerEntry.created_at.desc())

    rows = (await db.execute(q)).scalars().all()
    result = [
        {
            "id": r.id,
            "date": r.date,
            "transaction_type": r.transaction_type,
            "transaction_id": r.transaction_id,
            "account_name": r.account_name,
            "debit": r.debit,
            "credit": r.credit,
            "narration": r.narration,
            "is_reversed": r.is_reversed,
        }
        for r in rows
    ]
    return {"results": result}


# ── 07: Purchase Return Report ───────────────────────────

@router.get("/purchase-returns")
async def parcel_purchase_return_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    broker: Optional[str] = Query(default=None),
    currency: Optional[str] = Query(default=None),
    memo_no: Optional[str] = Query(default=None),
    inv_no: Optional[str] = Query(default=None),
    shape: Optional[str] = Query(default=None),
    size: Optional[str] = Query(default=None),
    color: Optional[str] = Query(default=None),
    clarity: Optional[str] = Query(default=None),
    sieve: Optional[str] = Query(default=None),
    lot_no: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(ParcelPurchaseReturn, ParcelPurchaseReturnItem)
        .join(ParcelPurchaseReturnItem, ParcelPurchaseReturnItem.purchase_return_id == ParcelPurchaseReturn.id)
        .where(ParcelPurchaseReturn.company_id == current_user.company_id)
    )
    if from_date:
        q = q.where(ParcelPurchaseReturn.date >= from_date)
    if to_date:
        q = q.where(ParcelPurchaseReturn.date <= to_date)
    if party:
        q = q.where(ParcelPurchaseReturn.party.ilike(f"%{party}%"))
    if currency:
        q = q.where(ParcelPurchaseReturn.currency == currency)
    if memo_no or inv_no:
        term = memo_no or inv_no
        q = q.where(ParcelPurchaseReturn.memo_number.ilike(f"%{term}%"))
    if lot_no:
        q = q.where(ParcelPurchaseReturnItem.lot_number.ilike(f"%{lot_no}%"))
    q = q.order_by(ParcelPurchaseReturn.date.desc())

    rows = (await db.execute(q)).all()
    result = []
    for ret, item in rows:
        result.append({
            "return_id": ret.id,
            "date": ret.date,
            "memo_number": ret.memo_number,
            "party": ret.party,
            "currency": ret.currency,
            "lot_number": item.lot_number,
            "item_name": item.item_name,
            "selected_carat": item.selected_carat,
            "pcs": item.pcs,
            "rate": item.rate,
            "amount": item.amount,
            "inr_amt": ret.inr_amt,
            "usd_amt": ret.usd_amt,
        })

    return {
        "results": result,
        "totals": {
            "selected_carat": round(sum(r["selected_carat"] or 0 for r in result), 2),
            "amount": round(sum(r["amount"] or 0 for r in result), 2),
        }
    }


# ── 08: Sale Return Report ───────────────────────────────

@router.get("/sale-returns")
async def parcel_sale_return_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    broker: Optional[str] = Query(default=None),
    currency: Optional[str] = Query(default=None),
    inv_no: Optional[str] = Query(default=None),
    shape: Optional[str] = Query(default=None),
    size: Optional[str] = Query(default=None),
    color: Optional[str] = Query(default=None),
    clarity: Optional[str] = Query(default=None),
    sieve: Optional[str] = Query(default=None),
    lot_no: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(SaleReturn, SaleReturnItem)
        .join(SaleReturnItem, SaleReturnItem.sale_return_id == SaleReturn.id)
        .where(SaleReturn.company_id == current_user.company_id)
    )
    if from_date:
        q = q.where(SaleReturn.date >= from_date)
    if to_date:
        q = q.where(SaleReturn.date <= to_date)
    if party:
        q = q.where(SaleReturn.party.ilike(f"%{party}%"))
    if currency:
        q = q.where(SaleReturn.currency == currency)
    if inv_no:
        q = q.where(SaleReturn.invoice_number.ilike(f"%{inv_no}%"))
    if lot_no:
        q = q.where(SaleReturnItem.lot_number.ilike(f"%{lot_no}%"))
    q = q.order_by(SaleReturn.date.desc())

    rows = (await db.execute(q)).all()
    result = []
    for ret, item in rows:
        result.append({
            "return_id": ret.id,
            "date": ret.date,
            "invoice_number": ret.invoice_number,
            "party": ret.party,
            "currency": ret.currency,
            "lot_number": item.lot_number,
            "item_name": item.item_name,
            "selected_carat": item.selected_carat,
            "pcs": item.pcs,
            "rate": item.rate,
            "amount": item.amount,
            "inr_amt": ret.inr_amt,
            "usd_amt": ret.usd_amt,
        })

    return {
        "results": result,
        "totals": {
            "selected_carat": round(sum(r["selected_carat"] or 0 for r in result), 2),
            "amount": round(sum(r["amount"] or 0 for r in result), 2),
        }
    }


# ── 09: Memo Out Return Report ───────────────────────────

@router.get("/memo-out-returns")
async def parcel_memo_out_return_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    inv_no: Optional[str] = Query(default=None),
    lot_no: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(MemoOutReturn, MemoOutReturnItem)
        .join(MemoOutReturnItem, MemoOutReturnItem.memo_out_return_id == MemoOutReturn.id)
        .where(MemoOutReturn.company_id == current_user.company_id)
    )
    if from_date:
        q = q.where(MemoOutReturn.date >= from_date)
    if to_date:
        q = q.where(MemoOutReturn.date <= to_date)
    if party:
        q = q.where(MemoOutReturn.party.ilike(f"%{party}%"))
    if inv_no:
        q = q.where(MemoOutReturn.invoice_number.ilike(f"%{inv_no}%"))
    if lot_no:
        q = q.where(MemoOutReturnItem.lot_number.ilike(f"%{lot_no}%"))
    q = q.order_by(MemoOutReturn.date.desc())

    rows = (await db.execute(q)).all()
    result = []
    for ret, item in rows:
        result.append({
            "return_id": ret.id,
            "date": ret.date,
            "invoice_number": ret.invoice_number,
            "source_memo_number": ret.source_memo_number,
            "party": ret.party,
            "lot_number": item.lot_number,
            "item_name": item.item_name,
            "weight": item.weight,
            "pcs": item.pcs,
            "rate": item.rate,
            "amount": item.amount,
            "inr_amt": ret.inr_amt,
            "usd_amt": ret.usd_amt,
        })

    return {
        "results": result,
        "totals": {
            "weight": round(sum(r["weight"] or 0 for r in result), 2),
            "amount": round(sum(r["amount"] or 0 for r in result), 2),
        }
    }


# ── 10: Consignment Return Report ────────────────────────

@router.get("/consignment-returns")
async def parcel_consignment_return_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    inv_no: Optional[str] = Query(default=None),
    lot_no: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(ConsignmentReturn, ConsignmentReturnItem)
        .join(ConsignmentReturnItem, ConsignmentReturnItem.consignment_return_id == ConsignmentReturn.id)
        .where(ConsignmentReturn.company_id == current_user.company_id)
    )
    if from_date:
        q = q.where(ConsignmentReturn.date >= from_date)
    if to_date:
        q = q.where(ConsignmentReturn.date <= to_date)
    if party:
        q = q.where(ConsignmentReturn.party.ilike(f"%{party}%"))
    if inv_no:
        q = q.where(ConsignmentReturn.invoice_number.ilike(f"%{inv_no}%"))
    if lot_no:
        q = q.where(ConsignmentReturnItem.lot_number.ilike(f"%{lot_no}%"))
    q = q.order_by(ConsignmentReturn.date.desc())

    rows = (await db.execute(q)).all()
    result = []
    for ret, item in rows:
        result.append({
            "return_id": ret.id,
            "date": ret.date,
            "invoice_number": ret.invoice_number,
            "source_consignment_number": ret.source_consignment_number,
            "party": ret.party,
            "lot_number": item.lot_number,
            "item_name": item.item_name,
            "selected_carat": item.selected_carat,
            "pcs": item.pcs,
            "rate": item.rate,
            "amount": item.amount,
            "inr_amt": ret.inr_amt,
            "usd_amt": ret.usd_amt,
        })

    return {
        "results": result,
        "totals": {
            "selected_carat": round(sum(r["selected_carat"] or 0 for r in result), 2),
            "amount": round(sum(r["amount"] or 0 for r in result), 2),
        }
    }


# ── Options (filter dropdowns shared by all parcel reports) ──

@router.get("/options")
async def parcel_report_options(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.models import AccountMaster, DropdownOption
    from app.routers.parcel_master import SHAPES, COLORS, CLARITIES, SIZES, SIEVES, _merge

    parties = (await db.execute(
        select(AccountMaster.account_group_name)
        .where(AccountMaster.company_id == current_user.company_id)
        .order_by(AccountMaster.account_group_name)
    )).scalars().all()

    brokers = (await db.execute(
        select(AccountMaster.account_group_name)
        .where(
            AccountMaster.company_id == current_user.company_id,
            func.lower(AccountMaster.account_type) == "broker",
        )
        .order_by(AccountMaster.account_group_name)
    )).scalars().all()

    lot_nos = (await db.execute(
        select(ParcelMaster.lot_no)
        .where(ParcelMaster.company_id == current_user.company_id, ParcelMaster.lot_no.isnot(None))
        .distinct()
        .order_by(ParcelMaster.lot_no)
    )).scalars().all()

    all_opt_rows = (await db.execute(
        select(DropdownOption.field_name, DropdownOption.value, DropdownOption.is_suppressed)
        .where(DropdownOption.company_id == current_user.company_id)
        .order_by(DropdownOption.value)
    )).all()
    custom: dict[str, list[str]] = {}
    suppressed: dict[str, set[str]] = {}
    for field_name, value, is_sup in all_opt_rows:
        if is_sup:
            suppressed.setdefault(field_name, set()).add(value)
        else:
            custom.setdefault(field_name, []).append(value)

    def _active(defaults, field):
        sup = suppressed.get(field, set())
        return _merge([v for v in defaults if v not in sup], custom.get(field, []))

    return {
        "parties": list(parties),
        "brokers": list(brokers),
        "currencies": CURRENCIES,
        "shapes": _active(SHAPES, "shape"),
        "colors": _active(COLORS, "color"),
        "clarities": _active(CLARITIES, "clarity"),
        "sizes": _active(SIZES, "size"),
        "sieves": _active(SIEVES, "sieve"),
        "lot_nos": list(lot_nos),
    }
