"""
Financial Reports (17-28) — Read-only query endpoints.
Builds reports from LedgerEntry, Sale, Purchase, Loan, Payment, JournalEntry, IncomeExpense tables.
"""
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import (
    AccountMaster, IncomeExpense, JournalEntry, LedgerEntry,
    Loan, MemoOut, Payment, ParcelPurchase, Sale, User,
)
from app.utils import CURRENCIES

router = APIRouter(prefix="/api/financial-reports", tags=["financial-reports"])


# ── 17: Outstanding Report ───────────────────────────────

@router.get("/outstanding")
async def outstanding_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    currency: Optional[str] = Query(default=None),
    payable_or_receivable: str = Query(default="Receivable"),  # Receivable | Payable
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Receivable = Sales not fully paid; Payable = Purchases not fully paid
    if payable_or_receivable == "Receivable":
        q = select(Sale).where(
            Sale.company_id == current_user.company_id,
            Sale.payment_status.in_(["Pending", "Partial"]),
        )
        if from_date:
            q = q.where(Sale.date >= from_date)
        if to_date:
            q = q.where(Sale.date <= to_date)
        if party:
            q = q.where(Sale.party.ilike(f"%{party}%"))
        if currency:
            q = q.where(Sale.currency == currency)
        q = q.order_by(Sale.date.desc())
        rows = (await db.execute(q)).scalars().all()
        result = [
            {
                "id": r.id,
                "date": r.date,
                "due_date": r.due_date,
                "invoice_number": r.invoice_number,
                "trn_type": "Sale",
                "party": r.party,
                "currency": r.currency,
                "total_amount": r.usd_amt,
                "paid_amount": 0,
                "remaining_amount": r.usd_amt,
                "inr_amt": r.inr_amt,
                "payment_status": r.payment_status,
                "broker": r.broker,
            }
            for r in rows
        ]
    else:
        q = select(ParcelPurchase).where(
            ParcelPurchase.company_id == current_user.company_id,
            ParcelPurchase.payment_status.in_(["Pending", "Partial"]),
        )
        if from_date:
            q = q.where(ParcelPurchase.date >= from_date)
        if to_date:
            q = q.where(ParcelPurchase.date <= to_date)
        if party:
            q = q.where(ParcelPurchase.party.ilike(f"%{party}%"))
        if currency:
            q = q.where(ParcelPurchase.currency == currency)
        q = q.order_by(ParcelPurchase.date.desc())
        rows = (await db.execute(q)).scalars().all()
        result = [
            {
                "id": r.id,
                "date": r.date,
                "due_date": r.due_date,
                "invoice_number": r.invoice_number,
                "trn_type": "Purchase",
                "party": r.party,
                "currency": r.currency,
                "total_amount": r.usd_amt,
                "paid_amount": 0,
                "remaining_amount": r.usd_amt,
                "inr_amt": r.inr_amt,
                "payment_status": r.payment_status,
                "broker": r.broker,
            }
            for r in rows
        ]

    return {
        "results": result,
        "totals": {
            "total_amount": round(sum(r["total_amount"] or 0 for r in result), 2),
            "remaining_amount": round(sum(r["remaining_amount"] or 0 for r in result), 2),
        }
    }


# ── 18: Loan Outstanding Report ──────────────────────────

@router.get("/loan-outstanding")
async def loan_outstanding_report(
    loan_type: Optional[str] = Query(default=None),
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Loan).where(Loan.company_id == current_user.company_id)
    if loan_type:
        q = q.where(Loan.loan_type == loan_type)
    if from_date:
        q = q.where(Loan.date >= from_date)
    if to_date:
        q = q.where(Loan.date <= to_date)
    if party:
        q = q.where(Loan.party.ilike(f"%{party}%"))
    q = q.order_by(Loan.date.desc())
    rows = (await db.execute(q)).scalars().all()
    result = [
        {
            "id": r.id,
            "date": r.date,
            "loan_type": r.loan_type,
            "party": r.party,
            "from_account": r.from_account,
            "to_account": r.to_account,
            "currency": r.currency,
            "amount": r.amount,
            "inr_amt": r.inr_amt,
            "usd_amt": r.usd_amt,
            "aed_amt": r.aed_amt,
            "narration": r.narration,
        }
        for r in rows
    ]
    return {
        "results": result,
        "totals": {
            "amount": round(sum(r["amount"] or 0 for r in result), 2),
        }
    }


# ── 19: Brokerage Outstanding Report ─────────────────────

@router.get("/brokerage-outstanding")
async def brokerage_outstanding_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sales_q = select(Sale).where(
        Sale.company_id == current_user.company_id,
        Sale.bro_amount > 0,
    )
    purchases_q = select(ParcelPurchase).where(
        ParcelPurchase.company_id == current_user.company_id,
        ParcelPurchase.bro_amount > 0,
    )
    if from_date:
        sales_q = sales_q.where(Sale.date >= from_date)
        purchases_q = purchases_q.where(ParcelPurchase.date >= from_date)
    if to_date:
        sales_q = sales_q.where(Sale.date <= to_date)
        purchases_q = purchases_q.where(ParcelPurchase.date <= to_date)
    if party:
        sales_q = sales_q.where(Sale.broker.ilike(f"%{party}%"))
        purchases_q = purchases_q.where(ParcelPurchase.broker.ilike(f"%{party}%"))

    sales = (await db.execute(sales_q.order_by(Sale.date.desc()))).scalars().all()
    purchases = (await db.execute(purchases_q.order_by(ParcelPurchase.date.desc()))).scalars().all()

    result = []
    for r in sales:
        result.append({
            "date": r.date, "invoice_number": r.invoice_number,
            "trn_type": "Sale", "broker": r.broker,
            "bro_pct": r.bro_pct, "bro_amount": r.bro_amount,
            "currency": r.currency,
        })
    for r in purchases:
        result.append({
            "date": r.date, "invoice_number": r.invoice_number,
            "trn_type": "Purchase", "broker": r.broker,
            "bro_pct": r.bro_pct, "bro_amount": r.bro_amount,
            "currency": r.currency,
        })
    result.sort(key=lambda x: x["date"] or date_type.today(), reverse=True)

    return {
        "results": result,
        "totals": {"bro_amount": round(sum(r["bro_amount"] or 0 for r in result), 2)}
    }


# ── 20: Commission Outstanding Report ────────────────────

@router.get("/commission-outstanding")
async def commission_outstanding_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sales_q = select(Sale).where(Sale.company_id == current_user.company_id, Sale.com_amount > 0)
    purchases_q = select(ParcelPurchase).where(ParcelPurchase.company_id == current_user.company_id, ParcelPurchase.com_amount > 0)
    if from_date:
        sales_q = sales_q.where(Sale.date >= from_date)
        purchases_q = purchases_q.where(ParcelPurchase.date >= from_date)
    if to_date:
        sales_q = sales_q.where(Sale.date <= to_date)
        purchases_q = purchases_q.where(ParcelPurchase.date <= to_date)
    if party:
        sales_q = sales_q.where(Sale.comm_agent.ilike(f"%{party}%"))
        purchases_q = purchases_q.where(ParcelPurchase.comm_agent.ilike(f"%{party}%"))

    sales = (await db.execute(sales_q.order_by(Sale.date.desc()))).scalars().all()
    purchases = (await db.execute(purchases_q.order_by(ParcelPurchase.date.desc()))).scalars().all()

    result = []
    for r in sales:
        result.append({"date": r.date, "invoice_number": r.invoice_number,
            "trn_type": "Sale", "agent": r.comm_agent, "com_pct": r.com_pct, "com_amount": r.com_amount, "currency": r.currency})
    for r in purchases:
        result.append({"date": r.date, "invoice_number": r.invoice_number,
            "trn_type": "Purchase", "agent": r.comm_agent, "com_pct": r.com_pct, "com_amount": r.com_amount, "currency": r.currency})
    result.sort(key=lambda x: x["date"] or date_type.today(), reverse=True)

    return {
        "results": result,
        "totals": {"com_amount": round(sum(r["com_amount"] or 0 for r in result), 2)}
    }


# ── 21: Sale/Purchase Summary Report ─────────────────────

@router.get("/sale-purchase-summary")
async def sale_purchase_summary_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    currency: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sales_q = select(Sale).where(Sale.company_id == current_user.company_id)
    purchases_q = select(ParcelPurchase).where(ParcelPurchase.company_id == current_user.company_id)
    if from_date:
        sales_q = sales_q.where(Sale.date >= from_date)
        purchases_q = purchases_q.where(ParcelPurchase.date >= from_date)
    if to_date:
        sales_q = sales_q.where(Sale.date <= to_date)
        purchases_q = purchases_q.where(ParcelPurchase.date <= to_date)
    if currency:
        sales_q = sales_q.where(Sale.currency == currency)
        purchases_q = purchases_q.where(ParcelPurchase.currency == currency)

    sales = (await db.execute(sales_q)).scalars().all()
    purchases = (await db.execute(purchases_q)).scalars().all()

    total_sales_usd = sum(float(s.usd_amt or 0) for s in sales)
    total_sales_inr = sum(float(s.inr_amt or 0) for s in sales)
    total_purchases_usd = sum(float(p.usd_amt or 0) for p in purchases)
    total_purchases_inr = sum(float(p.inr_amt or 0) for p in purchases)

    return {
        "sales_count": len(sales),
        "purchases_count": len(purchases),
        "total_sales_usd": round(total_sales_usd, 2),
        "total_sales_inr": round(total_sales_inr, 2),
        "total_purchases_usd": round(total_purchases_usd, 2),
        "total_purchases_inr": round(total_purchases_inr, 2),
        "gross_profit_usd": round(total_sales_usd - total_purchases_usd, 2),
        "gross_profit_inr": round(total_sales_inr - total_purchases_inr, 2),
        "sales": [
            {"date": s.date, "invoice_number": s.invoice_number, "party": s.party,
             "total_carats": s.total_carats, "usd_amt": s.usd_amt, "inr_amt": s.inr_amt, "payment_status": s.payment_status}
            for s in sorted(sales, key=lambda x: x.date or date_type.today(), reverse=True)
        ],
        "purchases": [
            {"date": p.date, "invoice_number": p.invoice_number, "party": p.party,
             "total_carats": p.total_carats, "usd_amt": p.usd_amt, "inr_amt": p.inr_amt, "payment_status": p.payment_status}
            for p in sorted(purchases, key=lambda x: x.date or date_type.today(), reverse=True)
        ],
    }


# ── 22: Account Ledger ───────────────────────────────────

@router.get("/account-ledger")
async def account_ledger_report(
    party: str = Query(..., description="Account/party name"),
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(LedgerEntry).where(
        LedgerEntry.company_id == current_user.company_id,
        LedgerEntry.account_name.ilike(f"%{party}%"),
        LedgerEntry.is_reversed == False,
    )
    if from_date:
        q = q.where(LedgerEntry.date >= from_date)
    if to_date:
        q = q.where(LedgerEntry.date <= to_date)
    q = q.order_by(LedgerEntry.date, LedgerEntry.created_at)
    rows = (await db.execute(q)).scalars().all()

    entries = [
        {
            "id": r.id,
            "date": r.date,
            "transaction_type": r.transaction_type,
            "transaction_id": r.transaction_id,
            "account_name": r.account_name,
            "debit": r.debit,
            "credit": r.credit,
            "narration": r.narration,
        }
        for r in rows
    ]
    total_debit = round(sum(e["debit"] or 0 for e in entries), 2)
    total_credit = round(sum(e["credit"] or 0 for e in entries), 2)

    return {
        "party": party,
        "entries": entries,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "closing_balance": round(total_debit - total_credit, 2),
    }


# ── 23: Monthly Expense Report ───────────────────────────

@router.get("/monthly-expense")
async def monthly_expense_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(IncomeExpense).where(
        IncomeExpense.company_id == current_user.company_id,
        IncomeExpense.ie_type == "Expense",
    )
    if from_date:
        q = q.where(IncomeExpense.date >= from_date)
    if to_date:
        q = q.where(IncomeExpense.date <= to_date)
    q = q.order_by(IncomeExpense.date)
    rows = (await db.execute(q)).scalars().all()

    # Group by month
    monthly = {}
    for r in rows:
        key = r.date.strftime("%Y-%m") if r.date else "Unknown"
        if key not in monthly:
            monthly[key] = {"month": key, "account_breakdown": {}, "total_inr": 0, "total_usd": 0}
        acc = r.account or "Other"
        monthly[key]["account_breakdown"][acc] = monthly[key]["account_breakdown"].get(acc, 0) + float(r.inr_amt or r.amount or 0)
        monthly[key]["total_inr"] += float(r.inr_amt or r.amount or 0)
        monthly[key]["total_usd"] += float(r.usd_amt or 0)

    result = sorted(monthly.values(), key=lambda x: x["month"])
    return {
        "results": result,
        "grand_total_inr": round(sum(r["total_inr"] for r in result), 2),
        "grand_total_usd": round(sum(r["total_usd"] for r in result), 2),
    }


# ── 24: Cash Flow Report ─────────────────────────────────

@router.get("/cash-flow")
async def cash_flow_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Receipts = Payment rows with vtype=Receipt
    # Payments = Payment rows with vtype=Payment
    q = select(Payment).where(Payment.company_id == current_user.company_id)
    if from_date:
        q = q.where(Payment.date >= from_date)
    if to_date:
        q = q.where(Payment.date <= to_date)
    q = q.order_by(Payment.date)
    payments = (await db.execute(q)).scalars().all()

    inflows = [p for p in payments if p.vtype == "Receipt"]
    outflows = [p for p in payments if p.vtype == "Payment"]
    total_inflow_inr = sum(float(p.inr_amt or p.amount or 0) for p in inflows)
    total_outflow_inr = sum(float(p.inr_amt or p.amount or 0) for p in outflows)

    return {
        "inflows": [
            {"date": p.date, "main_account": p.main_account, "party_account": p.party_account,
             "amount": p.amount, "inr_amt": p.inr_amt, "usd_amt": p.usd_amt, "currency": p.currency, "narration": p.narration}
            for p in inflows
        ],
        "outflows": [
            {"date": p.date, "main_account": p.main_account, "party_account": p.party_account,
             "amount": p.amount, "inr_amt": p.inr_amt, "usd_amt": p.usd_amt, "currency": p.currency, "narration": p.narration}
            for p in outflows
        ],
        "total_inflow_inr": round(total_inflow_inr, 2),
        "total_outflow_inr": round(total_outflow_inr, 2),
        "net_cash_flow_inr": round(total_inflow_inr - total_outflow_inr, 2),
    }


# ── 25: Profit & Loss Report ─────────────────────────────

@router.get("/profit-loss")
async def profit_loss_report(
    to_date: Optional[date_type] = Query(default=None),
    from_date: Optional[date_type] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Income from Sales
    sq = select(Sale).where(Sale.company_id == current_user.company_id)
    pq = select(ParcelPurchase).where(ParcelPurchase.company_id == current_user.company_id)
    iq = select(IncomeExpense).where(IncomeExpense.company_id == current_user.company_id)
    if from_date:
        sq = sq.where(Sale.date >= from_date)
        pq = pq.where(ParcelPurchase.date >= from_date)
        iq = iq.where(IncomeExpense.date >= from_date)
    if to_date:
        sq = sq.where(Sale.date <= to_date)
        pq = pq.where(ParcelPurchase.date <= to_date)
        iq = iq.where(IncomeExpense.date <= to_date)

    sales = (await db.execute(sq)).scalars().all()
    purchases = (await db.execute(pq)).scalars().all()
    ie_rows = (await db.execute(iq)).scalars().all()

    total_sales_usd = sum(float(s.usd_amt or 0) for s in sales)
    total_sales_inr = sum(float(s.inr_amt or 0) for s in sales)
    total_purchases_usd = sum(float(p.usd_amt or 0) for p in purchases)
    total_purchases_inr = sum(float(p.inr_amt or 0) for p in purchases)

    other_income_inr = sum(float(r.inr_amt or r.amount or 0) for r in ie_rows if r.ie_type == "Income")
    other_expense_inr = sum(float(r.inr_amt or r.amount or 0) for r in ie_rows if r.ie_type == "Expense")

    gross_profit_usd = total_sales_usd - total_purchases_usd
    gross_profit_inr = total_sales_inr - total_purchases_inr
    net_profit_inr = gross_profit_inr + other_income_inr - other_expense_inr

    return {
        "income": {
            "sales_usd": round(total_sales_usd, 2),
            "sales_inr": round(total_sales_inr, 2),
            "other_income_inr": round(other_income_inr, 2),
            "total_income_inr": round(total_sales_inr + other_income_inr, 2),
        },
        "expenses": {
            "purchases_usd": round(total_purchases_usd, 2),
            "purchases_inr": round(total_purchases_inr, 2),
            "other_expense_inr": round(other_expense_inr, 2),
            "total_expense_inr": round(total_purchases_inr + other_expense_inr, 2),
        },
        "gross_profit_usd": round(gross_profit_usd, 2),
        "gross_profit_inr": round(gross_profit_inr, 2),
        "net_profit_inr": round(net_profit_inr, 2),
    }


# ── 26: Trial Balance ────────────────────────────────────

@router.get("/trial-balance")
async def trial_balance_report(
    to_date: Optional[date_type] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(
        LedgerEntry.account_name,
        func.sum(LedgerEntry.debit).label("total_debit"),
        func.sum(LedgerEntry.credit).label("total_credit"),
    ).where(
        LedgerEntry.company_id == current_user.company_id,
        LedgerEntry.is_reversed == False,
    ).group_by(LedgerEntry.account_name)
    if to_date:
        q = q.where(LedgerEntry.date <= to_date)
    q = q.order_by(LedgerEntry.account_name)

    rows = (await db.execute(q)).all()
    result = [
        {
            "account_name": r.account_name,
            "total_debit": round(float(r.total_debit or 0), 2),
            "total_credit": round(float(r.total_credit or 0), 2),
            "balance": round(float(r.total_debit or 0) - float(r.total_credit or 0), 2),
        }
        for r in rows
    ]
    return {
        "results": result,
        "grand_total_debit": round(sum(r["total_debit"] for r in result), 2),
        "grand_total_credit": round(sum(r["total_credit"] for r in result), 2),
    }


# ── 27: Balance Sheet ────────────────────────────────────

@router.get("/balance-sheet")
async def balance_sheet_report(
    to_date: Optional[date_type] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Simplified: Assets = Debit balances; Liabilities = Credit balances
    q = select(
        LedgerEntry.account_name,
        func.sum(LedgerEntry.debit).label("total_debit"),
        func.sum(LedgerEntry.credit).label("total_credit"),
    ).where(
        LedgerEntry.company_id == current_user.company_id,
        LedgerEntry.is_reversed == False,
    ).group_by(LedgerEntry.account_name)
    if to_date:
        q = q.where(LedgerEntry.date <= to_date)

    rows = (await db.execute(q)).all()

    assets = []
    liabilities = []
    for r in rows:
        balance = float(r.total_debit or 0) - float(r.total_credit or 0)
        entry = {"account_name": r.account_name, "balance": round(abs(balance), 2)}
        if balance >= 0:
            assets.append(entry)
        else:
            liabilities.append(entry)

    # Add stock value from ParcelMaster
    from app.models.models import ParcelMaster
    parcels = (await db.execute(
        select(ParcelMaster).where(ParcelMaster.company_id == current_user.company_id)
    )).scalars().all()
    stock_value = sum(float(p.asking_usd_amount or 0) for p in parcels)

    total_assets = sum(a["balance"] for a in assets) + stock_value
    total_liabilities = sum(l["balance"] for l in liabilities)

    return {
        "assets": assets,
        "liabilities": liabilities,
        "stock_value_usd": round(stock_value, 2),
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "net_worth": round(total_assets - total_liabilities, 2),
    }


# ── 28: Invoice Ledger Report ────────────────────────────

@router.get("/invoice-ledger")
async def invoice_ledger_report(
    from_date: Optional[date_type] = Query(default=None),
    to_date: Optional[date_type] = Query(default=None),
    party: Optional[str] = Query(default=None),
    trn_type: Optional[str] = Query(default=None),  # Sale | Purchase
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if trn_type == "Sale" or trn_type is None:
        sq = select(Sale).where(Sale.company_id == current_user.company_id)
        if from_date:
            sq = sq.where(Sale.date >= from_date)
        if to_date:
            sq = sq.where(Sale.date <= to_date)
        if party:
            sq = sq.where(Sale.party.ilike(f"%{party}%"))
        sales = (await db.execute(sq.order_by(Sale.date.desc()))).scalars().all()
    else:
        sales = []

    if trn_type == "Purchase" or trn_type is None:
        pq = select(ParcelPurchase).where(ParcelPurchase.company_id == current_user.company_id)
        if from_date:
            pq = pq.where(ParcelPurchase.date >= from_date)
        if to_date:
            pq = pq.where(ParcelPurchase.date <= to_date)
        if party:
            pq = pq.where(ParcelPurchase.party.ilike(f"%{party}%"))
        purchases = (await db.execute(pq.order_by(ParcelPurchase.date.desc()))).scalars().all()
    else:
        purchases = []

    result = []
    for s in sales:
        result.append({
            "date": s.date, "invoice_number": s.invoice_number, "trn_type": "Sale",
            "party": s.party, "total_carats": s.total_carats, "usd_amt": s.usd_amt,
            "inr_amt": s.inr_amt, "payment_status": s.payment_status, "currency": s.currency,
        })
    for p in purchases:
        result.append({
            "date": p.date, "invoice_number": p.invoice_number, "trn_type": "Purchase",
            "party": p.party, "total_carats": p.total_carats, "usd_amt": p.usd_amt,
            "inr_amt": p.inr_amt, "payment_status": p.payment_status, "currency": p.currency,
        })
    result.sort(key=lambda x: x["date"] or date_type.today(), reverse=True)

    return {
        "results": result,
        "totals": {
            "usd_amt": round(sum(r["usd_amt"] or 0 for r in result), 2),
            "inr_amt": round(sum(r["inr_amt"] or 0 for r in result), 2),
        }
    }


# ── Options ──────────────────────────────────────────────

@router.get("/options")
async def financial_report_options(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    parties = (await db.execute(
        select(AccountMaster.account_group_name)
        .where(AccountMaster.company_id == current_user.company_id)
        .order_by(AccountMaster.account_group_name)
    )).scalars().all()
    return {"parties": list(parties), "currencies": CURRENCIES}
