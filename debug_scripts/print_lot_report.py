#!/usr/bin/env python3
"""
prints a detailed stock-report-style calculation for a given lot number.

Usage:
  python scripts/print_lot_report.py LOT_NO

Notes:
- This script expects to run from the repository root. It will add the `backend`
  package to `sys.path` so it can import `app` modules.
"""
from __future__ import annotations

import asyncio
import datetime
import sys
from pathlib import Path
from typing import List


def prepare_path():
    # Add backend/ to sys.path so `import app` works when running from repo root
    repo_root = Path(__file__).resolve().parents[1]
    backend_dir = repo_root / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))


prepare_path()

import os
from pathlib import Path as _Path

# Set required env vars before importing app modules.
# SECRET_KEY is required by pydantic-settings; a placeholder is fine for a read-only script.
# DATABASE_URL defaults to the SQLite file in backend/, so it usually doesn't need overriding.
if "SECRET_KEY" not in os.environ:
    os.environ.setdefault("SECRET_KEY", "print-lot-report-script-placeholder")
# Load .env from backend/ if it exists (picks up DATABASE_URL overrides etc.)
_dotenv_path = _Path(__file__).resolve().parents[1] / "backend" / ".env"
if _dotenv_path.exists():
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(_dotenv_path, override=False)

from sqlalchemy import select

from app.database import async_session
from app.models.models import (
    ParcelMaster, ParcelMergeLog,
    ParcelPurchase, ParcelPurchaseItem, ParcelPurchaseReturn, ParcelPurchaseReturnItem,
    Sale, SaleItem,
)


def fmt(n, prec=2):
    try:
        return f"{n:,.{prec}f}"
    except Exception:
        return str(n)


async def gather_entries(db, company_id: str, all_lots: List[str]):
    # Purchases and items
    q = (
        select(ParcelPurchase, ParcelPurchaseItem)
        .join(ParcelPurchaseItem, ParcelPurchaseItem.purchase_id == ParcelPurchase.id)
        .where(ParcelPurchase.company_id == company_id, ParcelPurchaseItem.lot_number.in_(all_lots))
        .order_by(ParcelPurchase.date)
    )
    rows = (await db.execute(q)).all()

    purchases = []
    for purchase, item in rows:
        purchases.append((purchase, item))

    # Purchase returns
    q2 = (
        select(ParcelPurchaseReturn, ParcelPurchaseReturnItem)
        .join(ParcelPurchaseReturnItem, ParcelPurchaseReturnItem.purchase_return_id == ParcelPurchaseReturn.id)
        .where(ParcelPurchaseReturn.company_id == company_id, ParcelPurchaseReturnItem.lot_number.in_(all_lots))
        .order_by(ParcelPurchaseReturn.date)
    )
    ret_rows = (await db.execute(q2)).all()
    returns = []
    for ret, item in ret_rows:
        returns.append((ret, item))

    # Sales and sale items
    q3 = (
        select(Sale, SaleItem)
        .join(SaleItem, SaleItem.sale_id == Sale.id)
        .where(Sale.company_id == company_id, SaleItem.lot_number.in_(all_lots))
        .order_by(Sale.date)
    )
    sale_rows = (await db.execute(q3)).all()
    sales = [(sale, item) for sale, item in sale_rows]

    return purchases, returns, sales


# ── Detailed Stock Report helpers ────────────────────────────────────────────

def _det_rate_amt(item_rate, item_usd_rate, carats, tx_inr_rate, currency):
    """
    Return (rate, amount) in the requested currency using the same logic as the
    /parcel-reports/detailed-stock endpoint.

    item_rate     : per-carat rate in the transaction's own currency
    item_usd_rate : per-carat rate in USD (pre-computed at save time)
    carats        : selected_carat
    tx_inr_rate   : header.inr_rate = "INR per 1 unit of transaction currency"
                    USD txn → 85  |  INR txn → 1  |  AED txn → 25
    currency      : "USD" or "INR"
    """
    ct = float(carats or 0)
    if currency == "USD":
        rate = float(item_usd_rate or 0)
    else:  # INR
        rate = float(item_rate or 0) * float(tx_inr_rate or 1)
    return round(rate, 2), round(rate * ct, 2)


def _print_detailed_stock(pm, purchases, sales, currency):
    """Print the detailed-stock-report ledger table for one currency."""
    COL = {
        'date': 12, 'lot': 8, 'state': 14,
        'p_ct': 9, 'p_rate': 13, 'p_amt': 15,
        's_ct': 9, 's_rate': 13, 's_amt': 15,
        'c_ct': 9, 'c_rate': 13, 'c_amt': 15,
    }
    hdr = (
        f"{'Date':<{COL['date']}} {'Lot':<{COL['lot']}} {'State':<{COL['state']}}"
        f" {'P Ct':>{COL['p_ct']}} {'P Rate':>{COL['p_rate']}} {f'P Amt ({currency})':>{COL['p_amt']}}"
        f" {'S Ct':>{COL['s_ct']}} {'S Rate':>{COL['s_rate']}} {f'S Amt ({currency})':>{COL['s_amt']}}"
        f" {'Curr Ct':>{COL['c_ct']}} {'Curr Rate':>{COL['c_rate']}} {f'Curr Amt ({currency})':>{COL['c_amt']}}"
    )
    sep = '─' * len(hdr)

    def _r(val, prec=2):
        return fmt(val, prec) if val is not None else ''

    def _row(date, lot, state, p_ct, p_rate, p_amt, s_ct, s_rate, s_amt, c_ct, c_rate, c_amt, bold=False):
        line = (
            f"{str(date) if date else '':<{COL['date']}} {str(lot) if lot else '':<{COL['lot']}} {state:<{COL['state']}}"
            f" {_r(p_ct,3):>{COL['p_ct']}} {_r(p_rate):>{COL['p_rate']}} {_r(p_amt):>{COL['p_amt']}}"
            f" {_r(s_ct,3):>{COL['s_ct']}} {_r(s_rate):>{COL['s_rate']}} {_r(s_amt):>{COL['s_amt']}}"
            f" {_r(c_ct,3):>{COL['c_ct']}} {_r(c_rate):>{COL['c_rate']}} {_r(c_amt):>{COL['c_amt']}}"
        )
        return ('** ' + line.rstrip() + ' **') if bold else line

    # Opening stock row
    running_ct = float(pm.opening_weight_carats or 0)
    running_amt = float(pm.purchase_cost_usd_amount or 0) if currency == 'USD' else float(pm.purchase_cost_inr_amount or 0)
    running_rate = round(running_amt / running_ct, 2) if running_ct > 0 else 0.0

    rows_out = [_row(None, pm.lot_no, 'Opening Stock',
                     None, None, None, None, None, None,
                     round(running_ct, 3), running_rate, round(running_amt, 2))]

    # Build events list
    events = []
    for purchase, item in purchases:
        p_ct = float(item.selected_carat or 0)
        p_rate, p_amt = _det_rate_amt(item.rate, item.usd_rate, p_ct, purchase.inr_rate, currency)
        events.append({
            'date': purchase.date, 'lot': item.lot_number, 'state': 'Purchase',
            'p_ct': p_ct, 'p_rate': p_rate, 'p_amt': p_amt,
            's_ct': None, 's_rate': None, 's_amt': None,
            '_delta': p_ct, '_amt_delta': p_amt, '_type': 'P',
        })
    for sale, item in sales:
        s_ct = float(item.selected_carat or 0)
        s_rate, s_amt = _det_rate_amt(item.rate, item.usd_rate, s_ct, sale.inr_rate, currency)
        events.append({
            'date': sale.date, 'lot': item.lot_number, 'state': 'Sale',
            'p_ct': None, 'p_rate': None, 'p_amt': None,
            's_ct': s_ct, 's_rate': s_rate, 's_amt': s_amt,
            '_delta': s_ct, '_amt_delta': s_amt, '_type': 'S',
        })

    events.sort(key=lambda x: (x['date'] or datetime.date.min, 0 if x['_type'] == 'P' else 1))

    total_p_ct = total_p_amt = total_s_ct = total_s_amt = 0.0
    for e in events:
        if e['_type'] == 'P':
            running_ct  += e['_delta']
            running_amt += e['_amt_delta']
            total_p_ct  += e['p_ct']
            total_p_amt += e['p_amt']
        else:
            running_ct  -= e['_delta']
            running_amt -= e['_amt_delta']
            total_s_ct  += e['s_ct']
            total_s_amt += e['s_amt']
        c_ct   = round(running_ct, 3)
        c_rate = round(running_amt / running_ct, 2) if running_ct > 0 else 0.0
        c_amt  = round(running_amt, 2)
        rows_out.append(_row(
            e['date'], e['lot'], e['state'],
            e['p_ct'], e['p_rate'], e['p_amt'],
            e['s_ct'], e['s_rate'], e['s_amt'],
            c_ct, c_rate, c_amt,
        ))

    # Total row
    tot_p_rate = round(total_p_amt / total_p_ct, 2) if total_p_ct > 0 else 0.0
    tot_s_rate = round(total_s_amt / total_s_ct, 2) if total_s_ct > 0 else 0.0
    rows_out.append(_row(
        None, None, 'Total',
        round(total_p_ct, 3), tot_p_rate, round(total_p_amt, 2),
        round(total_s_ct, 3), tot_s_rate, round(total_s_amt, 2),
        None, None, None,
        bold=True,
    ))

    print(f'\n{"="*len(hdr)}')
    print(f'  Detailed Stock Report  [{currency}]')
    print(sep)
    print(hdr)
    print(sep)
    for line in rows_out:
        print(line)
    print(sep)


async def compute_and_print(lot_no: str):
    async with async_session() as db:
        # Fetch parcel master (surviving)
        pm = (await db.execute(select(ParcelMaster).where(ParcelMaster.lot_no == lot_no, ParcelMaster.merged_into_lot_no.is_(None)))).scalar_one_or_none()
        if not pm:
            print(f"Parcel master not found for lot '{lot_no}'.")
            return

        print("\n--- Parcel Master Entry ---")
        print(f"Lot No : {pm.lot_no}")
        print(f"Item   : {pm.item_name}")
        print(f"Opening weight (ct): {fmt(pm.opening_weight_carats,3)}")
        print(f"USD->INR rate     : {fmt(pm.usd_to_inr_rate,2)}")
        print(f"PM purchase INR amt: {fmt(pm.purchase_cost_inr_amount)}")
        print(f"PM purchase USD amt: {fmt(pm.purchase_cost_usd_amount)}")
        print(f"PM asking INR amt  : {fmt(pm.asking_inr_amount)}")
        print(f"PM asking USD amt  : {fmt(pm.asking_usd_amount)}")

        # Merge logs
        ml_rows = (await db.execute(select(ParcelMergeLog).where(ParcelMergeLog.company_id == pm.company_id, ParcelMergeLog.surviving_lot_no == pm.lot_no, ParcelMergeLog.reversed == False))).scalars().all()
        if ml_rows:
            print('\nMerged lots:')
            for ml in ml_rows:
                print(f" - {ml.merged_lot_no}: merged_weight={fmt(ml.merged_weight,3)}, merged_inr={fmt(ml.merged_purchase_cost_inr)}, merged_usd={fmt(ml.merged_purchase_cost_usd)}")
        else:
            print('\nNo merged lots.')

        all_lots = [pm.lot_no] + [ml.merged_lot_no for ml in ml_rows]

        purchases, returns, sales = await gather_entries(db, pm.company_id, all_lots)

        print('\n--- Purchases (including items) ---')
        if not purchases:
            print('No purchase items found for these lots.')
        else:
            cur_inv = None
            for purchase, item in purchases:
                if cur_inv != purchase.id:
                    cur_inv = purchase.id
                    print(f"\nPurchase: invoice={purchase.invoice_number} date={purchase.date} currency={purchase.currency} inr_rate={fmt(purchase.inr_rate)} inr_amt={fmt(purchase.inr_amt)} usd_amt={fmt(purchase.usd_amt)}")
                print(f"  Item: lot={item.lot_number} selected_carat={fmt(item.selected_carat,3)} rate={fmt(item.rate)} usd_rate={fmt(item.usd_rate)} amount={fmt(item.amount)}")

        print('\n--- Purchase Returns ---')
        if not returns:
            print('No purchase returns for these lots.')
        else:
            cur_r = None
            for ret, item in returns:
                if cur_r != ret.id:
                    cur_r = ret.id
                    print(f"\nReturn: memo={ret.memo_number} date={ret.date} currency={ret.currency} inr_rate={fmt(ret.inr_rate)} inr_amt={fmt(ret.inr_amt)} usd_amt={fmt(ret.usd_amt)}")
                print(f"  Item: lot={item.lot_number} selected_carat={fmt(item.selected_carat,3)} rate={fmt(item.rate)} usd_rate={fmt(item.usd_rate)} amount={fmt(item.amount)}")

        print('\n--- Sales (including items) ---')
        if not sales:
            print('No sale items found for these lots.')
        else:
            cur_s = None
            for sale, item in sales:
                if cur_s != sale.id:
                    cur_s = sale.id
                    print(f"\nSale: invoice={sale.invoice_number} date={sale.date} currency={sale.currency} inr_rate={fmt(sale.inr_rate)} inr_amt={fmt(sale.inr_amt)} usd_amt={fmt(sale.usd_amt)}")
                print(f"  Item: lot={item.lot_number} selected_carat={fmt(item.selected_carat,3)} rate={fmt(item.rate)} usd_rate={fmt(item.usd_rate)} amount={fmt(item.amount)}")

        # --- Calculations similar to parcel_reports ---
        print('\n--- Calculation Trace ---')
        opening = float(pm.opening_weight_carats or 0)
        merge_opening = sum(ml.merged_weight or 0 for ml in ml_rows)
        opening_total = opening + merge_opening
        print(f"Opening = PM opening ({fmt(opening,3)}) + merged opening ({fmt(merge_opening,3)}) = {fmt(opening_total,3)}")

        # purchased weight and amounts — also build per-item breakdown strings
        purch_w = 0.0
        purch_inr = 0.0
        purch_usd = 0.0
        purch_inr_terms: list[str] = []
        purch_usd_terms: list[str] = []
        purch_w_terms: list[str] = []
        for purchase, item in purchases:
            sc = float(item.selected_carat or 0)
            rate = float(item.rate or 0)
            inr_rate = float(getattr(purchase, 'inr_rate', 1) or 1)
            is_usd = purchase.currency and purchase.currency.upper() == 'USD'
            usd_rate_val = float(item.usd_rate or 0) or (rate / (inr_rate or 1))

            inr_val = sc * rate * (inr_rate if is_usd else 1)
            usd_val = sc * usd_rate_val

            purch_w   += sc
            purch_inr += inr_val
            purch_usd += usd_val

            purch_w_terms.append(f"{fmt(sc,3)}")
            if is_usd:
                purch_inr_terms.append(f"({fmt(sc,3)}×{fmt(rate)}×{fmt(inr_rate)})")
            else:
                purch_inr_terms.append(f"({fmt(sc,3)}×{fmt(rate)})")
            purch_usd_terms.append(f"({fmt(sc,3)}×{fmt(usd_rate_val)})")

        ret_w = 0.0
        ret_inr = 0.0
        ret_usd = 0.0
        ret_inr_terms: list[str] = []
        ret_usd_terms: list[str] = []
        for ret, item in returns:
            sc = float(item.selected_carat or 0)
            rate = float(item.rate or 0)
            inr_rate = float(getattr(ret, 'inr_rate', 1) or 1)
            is_usd = ret.currency and ret.currency.upper() == 'USD'
            usd_rate_val = float(item.usd_rate or 0) or (rate / (inr_rate or 1))

            inr_val = sc * rate * (inr_rate if is_usd else 1)
            usd_val = sc * usd_rate_val

            ret_w   += sc
            ret_inr += inr_val
            ret_usd += usd_val

            if is_usd:
                ret_inr_terms.append(f"({fmt(sc,3)}×{fmt(rate)}×{fmt(inr_rate)})")
            else:
                ret_inr_terms.append(f"({fmt(sc,3)}×{fmt(rate)})")
            ret_usd_terms.append(f"({fmt(sc,3)}×{fmt(usd_rate_val)})")

        purchased_w   = round(purch_w - ret_w, 4)
        purch_inr_raw = purch_inr - ret_inr
        purch_usd_raw = purch_usd - ret_usd

        print(f"Purchased weight = sum(items) {fmt(purch_w,3)} - returns {fmt(ret_w,3)} = {fmt(purchased_w,3)}")

        purch_inr_breakdown = " + ".join(purch_inr_terms) if purch_inr_terms else "0"
        ret_inr_breakdown   = " + ".join(ret_inr_terms)   if ret_inr_terms   else "0"
        print(f"Purchased INR (raw) = {fmt(purch_inr)} - returns {fmt(ret_inr)} = {fmt(purch_inr_raw)}")
        print(f"  purchases : {purch_inr_breakdown} = {fmt(purch_inr)}")
        if ret_inr_terms:
            print(f"  returns   : {ret_inr_breakdown} = {fmt(ret_inr)}")

        purch_usd_breakdown = " + ".join(purch_usd_terms) if purch_usd_terms else "0"
        ret_usd_breakdown   = " + ".join(ret_usd_terms)   if ret_usd_terms   else "0"
        print(f"Purchased USD (raw) = {fmt(purch_usd)} - returns {fmt(ret_usd)} = {fmt(purch_usd_raw)}")
        print(f"  purchases : {purch_usd_breakdown} = {fmt(purch_usd)}")
        if ret_usd_terms:
            print(f"  returns   : {ret_usd_breakdown} = {fmt(ret_usd)}")

        sold_w = sum(float(item.issue_carats or 0) for _, item in sales)

        on_memo_w = 0.0
        consignment_w = 0.0

        on_hand = round(opening_total + purchased_w - sold_w - on_memo_w - consignment_w, 4)
        total_cost_weight = opening_total + purchased_w
        print(f"On hand = opening_total ({fmt(opening_total,3)}) + purchased ({fmt(purchased_w,3)}) - sold ({fmt(sold_w,3)}) - memo ({fmt(on_memo_w,3)}) - consign ({fmt(consignment_w,3)}) = {fmt(on_hand,3)}")

        # Cost calculations
        cost_inr_base = float(pm.purchase_cost_inr_amount or 0)
        cost_usd_base = float(pm.purchase_cost_usd_amount or 0)
        cost_inr_merges = sum(ml.merged_purchase_cost_inr or 0 for ml in ml_rows)
        cost_usd_merges = sum(ml.merged_purchase_cost_usd or 0 for ml in ml_rows)

        total_cost_inr = cost_inr_base + cost_inr_merges + purch_inr_raw
        total_cost_usd = cost_usd_base + cost_usd_merges + purch_usd_raw

        print('\nCost sources:')
        print(f" PM INR base = {fmt(cost_inr_base)}")
        print(f" Merge INR  = {fmt(cost_inr_merges)}")
        print(f" Purch INR  = {fmt(purch_inr_raw)}")
        print(f" Total Cost INR = {fmt(total_cost_inr)}")

        print(f" PM USD base = {fmt(cost_usd_base)}")
        print(f" Merge USD  = {fmt(cost_usd_merges)}")
        print(f" Purch USD  = {fmt(purch_usd_raw)}")
        print(f" Total Cost USD = {fmt(total_cost_usd)}")

        if total_cost_weight > 0:
            cost_inr_carat = round(total_cost_inr / total_cost_weight, 2)
            cost_usd_carat = round(total_cost_usd / total_cost_weight, 2)
        else:
            cost_inr_carat = 0.0
            cost_usd_carat = 0.0

        print('\nPer-carat costs:')
        print(f" Cost INR/ct = {fmt(cost_inr_carat)}  (Total INR {fmt(total_cost_inr)} / Weight {fmt(total_cost_weight,3)})")
        print(f" Cost USD/ct = {fmt(cost_usd_carat)}  (Total USD {fmt(total_cost_usd)} / Weight {fmt(total_cost_weight,3)})")

        # Asking price calculations (6% markup on purchased portion)
        ask_inr_amt = round(float(pm.asking_inr_amount or 0) + sum(ml.merged_asking_inr or 0 for ml in ml_rows) + purch_inr_raw * 1.06, 2)
        ask_usd_amt = round(float(pm.asking_usd_amount or 0) + sum(ml.merged_asking_usd or 0 for ml in ml_rows) + purch_usd_raw * 1.06, 2)

        if total_cost_weight > 0:
            ask_inr_carat = round(ask_inr_amt / total_cost_weight, 2)
            ask_usd_carat = round(ask_usd_amt / total_cost_weight, 2)
        else:
            ask_inr_carat = 0.0
            ask_usd_carat = 0.0

        print('\nAsking price calculations:')
        print(f" Ask INR amt = PM_ask ({fmt(pm.asking_inr_amount)}) + merges ({fmt(sum(ml.merged_asking_inr or 0 for ml in ml_rows))}) + purch*1.06 ({fmt(purch_inr_raw)}*1.06) = {fmt(ask_inr_amt)}")
        print(f" Ask USD amt = PM_ask ({fmt(pm.asking_usd_amount)}) + merges ({fmt(sum(ml.merged_asking_usd or 0 for ml in ml_rows))}) + purch*1.06 ({fmt(purch_usd_raw)}*1.06) = {fmt(ask_usd_amt)}")
        print(f" Ask INR/ct = {fmt(ask_inr_carat)}  Ask USD/ct = {fmt(ask_usd_carat)}")

        # ── Detailed Stock Report table ──────────────────────────────────
        _print_detailed_stock(pm, purchases, sales, 'USD')
        _print_detailed_stock(pm, purchases, sales, 'INR')


def main():
    if len(sys.argv) >= 2:
        lot_no = sys.argv[1]
    else:
        lot_no = input("Enter Lot No: ").strip()
        if not lot_no:
            print("Usage: python scripts/print_lot_report.py LOT_NO")
            sys.exit(1)
    asyncio.run(compute_and_print(lot_no))


if __name__ == '__main__':
    main()
