"""
Parcel Reports (01-10) - Read-only query endpoints.
Each report filters and returns data from transaction tables.
"""
from collections import defaultdict
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case as sa_case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.models import (
    Consignment, ConsignmentItem, ConsignmentReturn, ConsignmentReturnItem,
    LedgerEntry, MemoOut, MemoOutItem, MemoOutReturn, MemoOutReturnItem,
    ParcelMaster, ParcelMergeLog, ParcelPurchase, ParcelPurchaseItem, ParcelPurchaseReturn, ParcelPurchaseReturnItem,
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
    lot_no: Optional[int] = Query(default=None),
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
    purchase_date_from: Optional[date_type] = Query(default=None),
    purchase_date_to: Optional[date_type] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Stock report generated on-the-fly from transaction tables.
    purchased_weight = SUM(purchase_items.issue_carats) - SUM(return_items.issue_carats)
    sold_weight      = SUM(sale_items.issue_carats) - SUM(sale_return_items.issue_carats)
    on_memo_weight   = SUM(memo_items.issue_carats) - SUM(memo_return_items.issue_carats)
    consignment_wt   = SUM(consign_items.issue_carats) - SUM(consign_return_items.issue_carats)
    on_hand          = opening_weight_carats + purchased - sold - on_memo - consignment
    """
    cid = current_user.company_id

    # --- Base parcel query (manual entries only, non-absorbed) ---
    q = select(ParcelMaster).where(
        ParcelMaster.company_id == cid,
        ParcelMaster.merged_into_lot_no.is_(None),
    )
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
        q = q.where((ParcelMaster.lot_no == lot_no) | ParcelMaster.item_name.ilike(f"%{lot_no}%"))
    if cut:
        q = q.where(ParcelMaster.cut.ilike(f"%{cut}%"))
    if lab:
        labs = [l.strip() for l in lab.split(',')]
        q = q.where(or_(*[ParcelMaster.lab.ilike(f"%{l}%") for l in labs]))
    if price_from is not None:
        q = q.where(ParcelMaster.asking_price_usd_carats >= price_from)
    if price_to is not None:
        q = q.where(ParcelMaster.asking_price_usd_carats <= price_to)
    if purchase_date_from:
        q = q.where(ParcelMaster.created_at >= purchase_date_from)
    if purchase_date_to:
        q = q.where(ParcelMaster.created_at <= purchase_date_to)
    q = q.order_by(ParcelMaster.lot_no)
    parcels = (await db.execute(q)).scalars().all()

    lot_numbers = [p.lot_no for p in parcels]
    if not lot_numbers:
        return {"results": [], "totals": {"purchased_weight": 0, "sold_weight": 0, "on_memo_weight": 0, "consignment_weight": 0, "on_hand_weight": 0}}

    # --- Fetch active merge logs to include absorbed lots in all queries ---
    _merge_q = select(ParcelMergeLog).where(
        ParcelMergeLog.company_id == cid,
        ParcelMergeLog.surviving_lot_no.in_(lot_numbers),
        ParcelMergeLog.reversed == False,  # noqa: E712
    )
    merge_log_rows = (await db.execute(_merge_q)).scalars().all()
    merges_by_surviving: dict = defaultdict(list)
    for ml in merge_log_rows:
        merges_by_surviving[ml.surviving_lot_no].append(ml)
    merged_lot_numbers = [ml.merged_lot_no for ml in merge_log_rows]
    all_lot_numbers = lot_numbers + merged_lot_numbers

    # --- Aggregate purchases per lot (weight + INR cost + USD cost) ---
    # Formula handles both INR and USD automatically via inr_rate:
    # INR purchases: inr_rate=1 → rate*1, USD purchases: inr_rate=90/92/etc → rate*exchange_rate
    purch_q = (
        select(
            ParcelPurchaseItem.lot_number,
            func.coalesce(func.sum(ParcelPurchaseItem.selected_carat), 0).label("w"),
            # Cost INR: selected_carat * rate * inr_rate (auto-converts: rate*1 for INR, rate*90+ for USD)
            func.coalesce(func.sum(
                ParcelPurchaseItem.selected_carat * ParcelPurchaseItem.rate * func.coalesce(ParcelPurchase.inr_rate, 1)
            ), 0).label("amt_inr"),
            # Cost USD: selected_carat * usd_rate (or rate/inr_rate if usd_rate is NULL)
            func.coalesce(func.sum(
                ParcelPurchaseItem.selected_carat * func.coalesce(
                    ParcelPurchaseItem.usd_rate,
                    ParcelPurchaseItem.rate / func.coalesce(ParcelPurchase.inr_rate, 1)
                )
            ), 0).label("amt_usd"),
        )
        .join(ParcelPurchase, ParcelPurchaseItem.purchase_id == ParcelPurchase.id)
        .where(ParcelPurchase.company_id == cid, ParcelPurchaseItem.lot_number.in_(all_lot_numbers))
        .group_by(ParcelPurchaseItem.lot_number)
    )
    purch_ret_q = (
        select(
            ParcelPurchaseReturnItem.lot_number,
            func.coalesce(func.sum(ParcelPurchaseReturnItem.selected_carat), 0).label("w"),
            # Cost INR: selected_carat * rate * inr_rate (auto-converts: rate*1 for INR, rate*90+ for USD)
            func.coalesce(func.sum(
                ParcelPurchaseReturnItem.selected_carat * ParcelPurchaseReturnItem.rate * func.coalesce(ParcelPurchaseReturn.inr_rate, 1)
            ), 0).label("amt_inr"),
            # Cost USD: selected_carat * usd_rate (or rate/inr_rate if usd_rate is NULL)
            func.coalesce(func.sum(
                ParcelPurchaseReturnItem.selected_carat * func.coalesce(
                    ParcelPurchaseReturnItem.usd_rate,
                    ParcelPurchaseReturnItem.rate / func.coalesce(ParcelPurchaseReturn.inr_rate, 1)
                )
            ), 0).label("amt_usd"),
        )
        .join(ParcelPurchaseReturn, ParcelPurchaseReturnItem.purchase_return_id == ParcelPurchaseReturn.id)
        .where(ParcelPurchaseReturn.company_id == cid, ParcelPurchaseReturnItem.lot_number.in_(all_lot_numbers))
        .group_by(ParcelPurchaseReturnItem.lot_number)
    )

    # --- Aggregate sales per lot ---
    sale_q = (
        select(SaleItem.lot_number, func.coalesce(func.sum(SaleItem.issue_carats), 0).label("w"))
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(Sale.company_id == cid, SaleItem.lot_number.in_(all_lot_numbers))
        .group_by(SaleItem.lot_number)
    )
    sale_ret_q = (
        select(SaleReturnItem.lot_number, func.coalesce(func.sum(SaleReturnItem.issue_carats), 0).label("w"))
        .join(SaleReturn, SaleReturnItem.sale_return_id == SaleReturn.id)
        .where(SaleReturn.company_id == cid, SaleReturnItem.lot_number.in_(all_lot_numbers))
        .group_by(SaleReturnItem.lot_number)
    )

    # --- Aggregate memo per lot (memo items use 'weight', not 'issue_carats') ---
    memo_q = (
        select(MemoOutItem.lot_number, func.coalesce(func.sum(MemoOutItem.weight), 0).label("w"))
        .join(MemoOut, MemoOutItem.memo_out_id == MemoOut.id)
        .where(MemoOut.company_id == cid, MemoOutItem.lot_number.in_(all_lot_numbers))
        .group_by(MemoOutItem.lot_number)
    )
    memo_ret_q = (
        select(MemoOutReturnItem.lot_number, func.coalesce(func.sum(MemoOutReturnItem.weight), 0).label("w"))
        .join(MemoOutReturn, MemoOutReturnItem.memo_out_return_id == MemoOutReturn.id)
        .where(MemoOutReturn.company_id == cid, MemoOutReturnItem.lot_number.in_(all_lot_numbers))
        .group_by(MemoOutReturnItem.lot_number)
    )

    # --- Aggregate consignment per lot ---
    consign_q = (
        select(ConsignmentItem.lot_number, func.coalesce(func.sum(ConsignmentItem.issue_carats), 0).label("w"))
        .join(Consignment, ConsignmentItem.consignment_id == Consignment.id)
        .where(Consignment.company_id == cid, ConsignmentItem.lot_number.in_(all_lot_numbers))
        .group_by(ConsignmentItem.lot_number)
    )
    consign_ret_q = (
        select(ConsignmentReturnItem.lot_number, func.coalesce(func.sum(ConsignmentReturnItem.issue_carats), 0).label("w"))
        .join(ConsignmentReturn, ConsignmentReturnItem.consignment_return_id == ConsignmentReturn.id)
        .where(ConsignmentReturn.company_id == cid, ConsignmentReturnItem.lot_number.in_(all_lot_numbers))
        .group_by(ConsignmentReturnItem.lot_number)
    )

    # Run all aggregations
    (
        purch_rows, purch_ret_rows,
        sale_rows, sale_ret_rows,
        memo_rows, memo_ret_rows,
        consign_rows, consign_ret_rows,
    ) = [
        (await db.execute(q_)).all()
        for q_ in [purch_q, purch_ret_q, sale_q, sale_ret_q, memo_q, memo_ret_q, consign_q, consign_ret_q]
    ]

    def _windex(rows): return {r.lot_number: float(r.w) for r in rows}
    def _get_sum(d, lots): return sum(d.get(ln, 0) for ln in lots)

    # Weight indices
    purchased_w_idx  = _windex(purch_rows)
    purch_ret_w_idx  = _windex(purch_ret_rows)
    sold_w_idx       = _windex(sale_rows)
    sale_ret_w_idx   = _windex(sale_ret_rows)
    memo_out_idx     = _windex(memo_rows)
    memo_ret_idx     = _windex(memo_ret_rows)
    consignment_idx  = _windex(consign_rows)
    consign_ret_idx  = _windex(consign_ret_rows)

    # Cost amount indices (from purchase items)
    purch_inr_idx = {r.lot_number: float(r.amt_inr) for r in purch_rows}
    purch_usd_idx = {r.lot_number: float(r.amt_usd) for r in purch_rows}
    pret_inr_idx = {r.lot_number: float(r.amt_inr) for r in purch_ret_rows}
    pret_usd_idx = {r.lot_number: float(r.amt_usd) for r in purch_ret_rows}

    result = []
    for r in parcels:
        ln = r.lot_no
        pm_rate  = float(r.usd_to_inr_rate or 90)
        ml_list  = merges_by_surviving.get(ln, [])
        all_lots = [ln] + [ml.merged_lot_no for ml in ml_list]

        # ── Weights ──────────────────────────────────────────────────────────
        # Opening = PM manual entry + absorbed parcels' opening snapshots from merge logs
        merge_opening = sum(ml.merged_weight or 0 for ml in ml_list)
        opening       = float(r.opening_weight_carats or 0) + merge_opening

        purchased_w   = round(_get_sum(purchased_w_idx, all_lots) - _get_sum(purch_ret_w_idx, all_lots), 4)
        sold_w        = round(_get_sum(sold_w_idx,      all_lots) - _get_sum(sale_ret_w_idx,   all_lots), 4)
        on_memo_w     = round(_get_sum(memo_out_idx,    all_lots) - _get_sum(memo_ret_idx,      all_lots), 4)
        consignment_w = round(_get_sum(consignment_idx, all_lots) - _get_sum(consign_ret_idx,   all_lots), 4)
        on_hand       = round(opening + purchased_w - sold_w - on_memo_w - consignment_w, 4)
        total_cost_weight = opening + purchased_w

        # Apply carat filters post-aggregation (on_hand is computed, not stored)
        if carat_from is not None and on_hand < carat_from:
            continue
        if carat_to is not None and on_hand > carat_to:
            continue

        # ── Cost calculations ─────────────────────────────────────────────────
        # Source 1: PM manual opening entry
        cost_inr_base = float(r.purchase_cost_inr_amount or 0)
        cost_usd_base = float(r.purchase_cost_usd_amount or 0)

        # Source 2: Merge log snapshots (absorbed parcels' PM opening costs)
        cost_inr_merges = sum(ml.merged_purchase_cost_inr or 0 for ml in ml_list)
        cost_usd_merges = sum(ml.merged_purchase_cost_usd or 0 for ml in ml_list)

        # Source 3: Purchase table entries for this lot + all merged lots
        #   INR: selected_carat × rate × inr_rate (if USD currency) or selected_carat × rate (if INR)
        #   USD: selected_carat × usd_rate
        purch_inr_raw     = _get_sum(purch_inr_idx, all_lots) - _get_sum(pret_inr_idx, all_lots)
        purch_usd_raw     = _get_sum(purch_usd_idx, all_lots) - _get_sum(pret_usd_idx, all_lots)

        total_cost_inr = cost_inr_base + cost_inr_merges + purch_inr_raw
        total_cost_usd = cost_usd_base + cost_usd_merges + purch_usd_raw

        if total_cost_weight > 0:
            cost_inr_carat = round(total_cost_inr / total_cost_weight, 2)
            cost_usd_carat = round(total_cost_usd / total_cost_weight, 2)
        else:
            cost_inr_carat = 0.0
            cost_usd_carat = 0.0

        # ── Asking price calculations ─────────────────────────────────────────
        # Ask amount = PM asking amount + merge log asking snapshots
        #            + purchase item amounts × 1.06 (6% markup on purchased goods)
        # Per-carat ask = total ask amount / total cost weight
        ask_inr_amt = round(
            float(r.asking_inr_amount or 0)
            + sum(ml.merged_asking_inr or 0 for ml in ml_list)
            + purch_inr_raw * 1.06,
            2,
        )
        ask_usd_amt = round(
            float(r.asking_usd_amount or 0)
            + sum(ml.merged_asking_usd or 0 for ml in ml_list)
            + purch_usd_raw * 1.06,
            2,
        )

        if total_cost_weight > 0:
            ask_inr_carat = round(ask_inr_amt / total_cost_weight, 2)
            ask_usd_carat = round(ask_usd_amt / total_cost_weight, 2)
        else:
            ask_inr_carat = 0.0
            ask_usd_carat = 0.0

        # ── Status ────────────────────────────────────────────────────────────
        if on_memo_w > 0:
            cur_status = "Memo"
        elif consignment_w > 0:
            cur_status = "Consignment"
        elif sold_w >= (opening + purchased_w) and (opening + purchased_w) > 0:
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
            "stock_type": r.stock_type or "",
            "stock_subtype": r.stock_subtype or "",
            "grown_process_type": r.grown_process_type or "",
            "opening_weight_carats": round(opening, 3),
            "purchased_weight": round(purchased_w, 3),
            "sold_weight": round(sold_w, 3),
            "on_memo_weight": round(on_memo_w, 3),
            "consignment_weight": round(consignment_w, 3),
            "on_hand_weight": round(on_hand, 3),
            "carats": round(total_cost_weight, 3),
            "cur_status": cur_status,
            "purchase_price_currency": r.purchase_price_currency or "",
            "usd_to_inr_rate": round(pm_rate, 2),
            "purchase_cost_usd_carat": cost_usd_carat,
            "purchase_cost_inr_carat": cost_inr_carat,
            "purchase_cost_usd_amount": round(total_cost_usd, 2),
            "purchase_cost_inr_amount": round(total_cost_inr, 2),
            "asking_price_usd_carats": ask_usd_carat,
            "asking_price_inr_carats": ask_inr_carat,
            "asking_usd_amount": ask_usd_amt,
            "asking_inr_amount": ask_inr_amt,
        })

    return {
        "results": result,
        "totals": {
            "purchased_weight": round(sum(r["purchased_weight"] for r in result), 2),
            "sold_weight": round(sum(r["sold_weight"] for r in result), 2),
            "on_memo_weight": round(sum(r["on_memo_weight"] for r in result), 2),
            "consignment_weight": round(sum(r["consignment_weight"] for r in result), 2),
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
    lot_no: Optional[int] = Query(default=None),
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
        q = q.where(ParcelPurchaseItem.lot_number == lot_no)
    q = q.order_by(ParcelPurchase.date.desc(), ParcelPurchase.invoice_number)

    rows = (await db.execute(q)).all()
    result = []
    for purchase, item in rows:
        # Compute per-item INR and USD amounts on-the-fly from the stored item amount
        # item.amount is always in the purchase currency (INR for INR purchases, USD for USD purchases)
        _inr_rate = float(purchase.inr_rate or 85)
        _amt = float(item.amount or 0)
        _currency = (purchase.currency or "USD").upper()
        if _currency == "INR":
            _item_inr_amt = round(_amt, 2)
            _item_usd_amt = round(_amt / _inr_rate, 2) if _inr_rate > 0 else 0.0
        else:  # USD (or any other foreign currency)
            _item_usd_amt = round(_amt, 2)
            _item_inr_amt = round(_amt * _inr_rate, 2)

        result.append({
            "purchase_id": purchase.id,
            "date": purchase.date,
            "invoice_number": purchase.invoice_number,
            "bill_no": purchase.bill_no,
            "party": purchase.party,
            "broker": purchase.broker,
            "currency": purchase.currency,
            "inr_rate": purchase.inr_rate,
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
            "usd_rate": item.usd_rate,
            "amount": item.amount,
            "inr_amt": _item_inr_amt,
            "usd_amt": _item_usd_amt,
            "less1": item.less1,
            "less2": item.less2,
            "less3": item.less3,
            "payment_status": purchase.payment_status,
        })

    return {
        "results": result,
        "totals": {
            "selected_carat": round(sum(r["selected_carat"] or 0 for r in result), 2),
            "inr_amt": round(sum(r["inr_amt"] or 0 for r in result), 2),
            "usd_amt": round(sum(r["usd_amt"] or 0 for r in result), 2),
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
    lot_no: Optional[int] = Query(default=None),
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
        q = q.where(MemoOutItem.lot_number == lot_no)
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
    lot_no: Optional[int] = Query(default=None),
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
        q = q.where(SaleItem.lot_number == lot_no)
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
    lot_no: Optional[int] = Query(default=None),
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
        q = q.where(ConsignmentItem.lot_number == lot_no)
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
    lot_no: Optional[int] = Query(default=None),
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
        q = q.where(ParcelPurchaseReturnItem.lot_number == lot_no)
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
    lot_no: Optional[int] = Query(default=None),
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
        q = q.where(SaleReturnItem.lot_number == lot_no)
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
    lot_no: Optional[int] = Query(default=None),
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
        q = q.where(MemoOutReturnItem.lot_number == lot_no)
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
    lot_no: Optional[int] = Query(default=None),
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
        q = q.where(ConsignmentReturnItem.lot_number == lot_no)
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


# ── Detailed Stock Report ────────────────────────────────

@router.get("/detailed-stock")
async def parcel_detailed_stock_report(
    lot_no: str = Query(...),
    currency: str = Query(default="USD"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as _date
    currency = currency.upper()

    def _item_rate_amt(item_rate, item_usd_rate, carats, tx_inr_rate):
        """
        Return (rate_in_target_currency, amount_in_target_currency).

        item_rate     : per-carat rate in the transaction's own currency
        item_usd_rate : per-carat rate in USD (pre-computed and stored at save time)
        carats        : selected_carat
        tx_inr_rate   : header.inr_rate = "INR per 1 unit of transaction currency"
                        USD txn  → 85   (1 USD = 85 INR)
                        INR txn  → 1    (1 INR = 1 INR)
                        AED txn  → 25   (1 AED = 25 INR)
        """
        ct = float(carats or 0)
        if currency == "USD":
            rate = float(item_usd_rate or 0)
        else:  # INR
            # item_rate is in transaction currency; multiply by tx_inr_rate → INR
            rate = float(item_rate or 0) * float(tx_inr_rate or 1)
        return round(rate, 2), round(rate * ct, 2)

    # 1. Opening stock from ParcelMaster
    pm = (await db.execute(
        select(ParcelMaster).where(
            ParcelMaster.company_id == current_user.company_id,
            ParcelMaster.lot_no == lot_no,
        )
    )).scalar_one_or_none()

    rows = []
    running_ct = 0.0
    running_amt = 0.0

    if pm:
        running_ct = float(pm.opening_weight_carats or 0)
        if currency == "INR":
            running_amt = float(pm.purchase_cost_inr_amount or 0)
        else:
            running_amt = float(pm.purchase_cost_usd_amount or 0)
        running_rate = round(running_amt / running_ct, 2) if running_ct > 0 else 0.0
        rows.append({
            "date": None,
            "lot_no": lot_no,
            "state": "Opening Stock",
            "purchase_id": None,
            "sale_id": None,
            "invoice_number": None,
            "p_ct": None, "p_rate": None, "p_amt": None,
            "s_ct": None, "s_rate": None, "s_amt": None,
            "curr_ct": round(running_ct, 3),
            "curr_rate": running_rate,
            "curr_amt": round(running_amt, 2),
        })

    # 2. Purchase items
    purchase_rows = (await db.execute(
        select(ParcelPurchase, ParcelPurchaseItem)
        .join(ParcelPurchaseItem, ParcelPurchaseItem.purchase_id == ParcelPurchase.id)
        .where(
            ParcelPurchase.company_id == current_user.company_id,
            ParcelPurchaseItem.lot_number == lot_no,
        )
        .order_by(ParcelPurchase.date, ParcelPurchase.created_at)
    )).all()

    # 3. Sale items
    sale_rows = (await db.execute(
        select(Sale, SaleItem)
        .join(SaleItem, SaleItem.sale_id == Sale.id)
        .where(
            Sale.company_id == current_user.company_id,
            SaleItem.lot_number == lot_no,
        )
        .order_by(Sale.date, Sale.created_at)
    )).all()

    # Build transactions list
    transactions = []
    for purchase, item in purchase_rows:
        p_ct = float(item.selected_carat or 0)
        p_rate, p_amt = _item_rate_amt(item.rate, item.usd_rate, p_ct, purchase.inr_rate)
        _p_usd_rate = float(item.usd_rate or 0)
        _p_inr_rate = float(item.rate or 0) * float(purchase.inr_rate or 1)
        transactions.append({
            "date": purchase.date,
            "lot_no": lot_no,
            "state": "Purchase",
            "purchase_id": purchase.id,
            "sale_id": None,
            "invoice_number": purchase.invoice_number,
            "p_ct": round(p_ct, 3), "p_rate": p_rate, "p_amt": p_amt,
            "p_amt_usd": round(_p_usd_rate * p_ct, 2),
            "p_amt_inr": round(_p_inr_rate * p_ct, 2),
            "s_ct": None, "s_rate": None, "s_amt": None,
            "s_amt_usd": None, "s_amt_inr": None,
            "_delta_ct": p_ct, "_delta_amt": p_amt, "_type": "purchase",
        })

    for sale, item in sale_rows:
        s_ct = float(item.selected_carat or 0)
        s_rate, s_amt = _item_rate_amt(item.rate, item.usd_rate, s_ct, sale.inr_rate)
        _s_usd_rate = float(item.usd_rate or 0)
        _s_inr_rate = float(item.rate or 0) * float(sale.inr_rate or 1)
        transactions.append({
            "date": sale.date,
            "lot_no": lot_no,
            "state": "Sale",
            "purchase_id": None,
            "sale_id": sale.id,
            "invoice_number": sale.invoice_number,
            "p_ct": None, "p_rate": None, "p_amt": None,
            "p_amt_usd": None, "p_amt_inr": None,
            "s_ct": round(s_ct, 3), "s_rate": s_rate, "s_amt": s_amt,
            "s_amt_usd": round(_s_usd_rate * s_ct, 2),
            "s_amt_inr": round(_s_inr_rate * s_ct, 2),
            "_delta_ct": s_ct, "_delta_amt": s_amt, "_type": "sale",
        })

    # Sort by date, with purchases before sales on the same day
    transactions.sort(key=lambda x: (x["date"] or _date.min, 0 if x["_type"] == "purchase" else 1))

    # Compute running curr columns
    for txn in transactions:
        if txn["_type"] == "purchase":
            running_ct += txn["_delta_ct"]
            running_amt += txn["_delta_amt"]
        else:
            running_ct -= txn["_delta_ct"]
            running_amt -= txn["_delta_amt"]
        txn["curr_ct"] = round(running_ct, 3)
        txn["curr_rate"] = round(running_amt / running_ct, 2) if running_ct > 0 else 0.0
        txn["curr_amt"] = round(running_amt, 2)
        del txn["_delta_ct"]
        del txn["_delta_amt"]
        del txn["_type"]

    rows.extend(transactions)

    # Total row
    total_p_ct = sum(r["p_ct"] for r in rows if r["p_ct"] is not None)
    total_p_amt = sum(r["p_amt"] for r in rows if r["p_amt"] is not None)
    total_s_ct = sum(r["s_ct"] for r in rows if r["s_ct"] is not None)
    total_s_amt = sum(r["s_amt"] for r in rows if r["s_amt"] is not None)

    total_row = {
        "date": None, "lot_no": None, "state": "Total",
        "p_ct": round(total_p_ct, 3),
        "p_rate": round(total_p_amt / total_p_ct, 2) if total_p_ct > 0 else 0.0,
        "p_amt": round(total_p_amt, 2),
        "s_ct": round(total_s_ct, 3),
        "s_rate": round(total_s_amt / total_s_ct, 2) if total_s_ct > 0 else 0.0,
        "s_amt": round(total_s_amt, 2),
        "curr_ct": None, "curr_rate": None, "curr_amt": None,
    }

    return {"rows": rows, "total": total_row, "lot_no": lot_no, "currency": currency}


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

    lot_nos_raw = (await db.execute(
        select(ParcelMaster.lot_no)
        .where(ParcelMaster.company_id == current_user.company_id, ParcelMaster.lot_no.isnot(None))
        .distinct()
    )).scalars().all()
    lot_nos = sorted((str(v) for v in lot_nos_raw if v is not None), key=lambda x: int(x) if x.isdigit() else 0)

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
        "lot_nos": lot_nos,
    }
