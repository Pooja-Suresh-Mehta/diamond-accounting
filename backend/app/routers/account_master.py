from io import BytesIO
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import AccountMaster, User, ActivityLog
from app.schemas import AccountMasterCreate, AccountMasterOut, AccountMasterUpdate

router = APIRouter(prefix="/api/account-master", tags=["account-master"])

ACCOUNT_TYPE_OPTIONS = [
    "Assets", "Liabilities", "Income", "Income Trading", "Expense", "Expense Trading",
    "Cash", "Bank", "Customer", "Supplier", "Overseas Customer", "Overseas Supplier",
    "Broker", "Angadiya", "Loan Given", "Loan Taken", "Partner", "Individual",
    "Opening Stock", "Closing Stock", "Seller",
]

SYSTEM_ACCOUNT_SEEDS = [
    ("Brokerage", "Trading Expenses", "Expense Trading", "INR", "Credit", 0.00),
    ("IGST", "Trading Expenses", "Expense Trading", "INR", "Credit", 0.00),
    ("SGST", "Trading Expenses", "Expense Trading", "INR", "Credit", 0.00),
    ("CGST", "Trading Expenses", "Expense Trading", "INR", "Credit", 0.00),
    ("VAT", "Trading Expenses", "Expense Trading", "INR", "Credit", 0.00),
    ("Commission", "Propritors Capital", "Liabilities", "INR", "Debit", 0.00),
    ("SURAT", "CASH", "Supplier", "INR", "Credit", 0.00),
    ("Opening Stock", "Trading Expenses", "Expense Trading", "INR", "Debit", 0.00),
    ("Ex. Difference", "Office Expense", "Expense", "INR", "Debit", 0.00),
    ("Sale", "Sundry Creditors", "Income Trading", "INR", "Credit", 0.00),
    ("Purchase", "Sales And Comission", "Expense Trading", "INR", "Debit", 0.00),
    ("Misc Expenses", "Interest Earning", "Expense", "INR", "Debit", 0.00),
    ("Partner Capital", "Cash Balance", "Liabilities", "INR", "Credit", 0.00),
    ("Indusind Bank", "Local Customer", "Bank", "INR", "Debit", 0.00),
    ("CASH", "Outside Customer", "Cash", "INR", "Debit", 0.00),
    ("Unsequred Taken Loan", "Bank Balance", "Loan Taken", "INR", "Debit", 0.00),
    ("Sequred Taken Loan", "Bank Balance", "Loan Taken", "INR", "Debit", 0.00),
    ("Outside Supplier", "Propritors Capital", "Overseas Supplier", "INR", "Debit", 0.00),
    ("Local Supplier", "Propritors Capital", "Supplier", "INR", "Debit", 0.00),
    ("Outside Customer", "Sundry Debtors", "Overseas Customer", "INR", "Debit", 0.00),
    ("Local Customer", "Sundry Debtors", "Customer", "INR", "Debit", 0.00),
    ("Cash Balance", "Cash And Bank Balance", "Cash", "INR", "Debit", 0.00),
    ("Bank Balance", "Cash And Bank Balance", "Bank", "INR", "Debit", 0.00),
    ("Propritors Capital", "Reserves And Surplus", "Liabilities", "INR", "Debit", 0.00),
    ("Loan Taken", "Provision And Loan", "Loan Taken", "INR", "Debit", 0.00),
    ("Sundry Creditors", "Current Liabilities", "Liabilities", "INR", "Debit", 0.00),
    ("Brokers", "Sundry Debtors", "Broker", "INR", "Debit", 0.00),
    ("Sales And Comission", "Trading Income", "Income Trading", "INR", "Debit", 0.00),
    ("Interest Earning", "Non Trading Income", "Income", "INR", "Debit", 0.00),
    ("Purchase Overheads", "Trading Expenses", "Expense Trading", "INR", "Debit", 0.00),
    ("Office Expense", "Non Trading Expenses", "Expense", "INR", "Debit", 0.00),
    ("Marketing Expense", "Non Trading Expenses", "Expense", "INR", "Debit", 0.00),
    ("Financial Expense", "Non Trading Expenses", "Expense", "INR", "Debit", 0.00),
    ("Bad Debt And Depriciation", "Non Trading Expenses", "Expense", "INR", "Debit", 0.00),
    ("OFFICE STAFF", "Fixed Assets", "Customer", "INR", "Debit", 0.00),
    ("Loan Given", "Loan And Advances", "Loan Given", "INR", "Debit", 0.00),
    ("Sundry Debtors", "Current Assets", "Assets", "INR", "Debit", 0.00),
    ("Cash And Bank Balance", "Current Assets", "Assets", "INR", "Debit", 0.00),
    ("Reserves And Surplus", "Liabilities", "Liabilities", "INR", "Debit", 0.00),
    ("Provision And Loan", "Liabilities", "Liabilities", "INR", "Debit", 0.00),
    ("Current Liabilities", "Liabilities", "Liabilities", "INR", "Debit", 0.00),
    ("Trading Income", "Income", "Income Trading", "INR", "Debit", 0.00),
    ("Non Trading Income", "Income", "Income", "INR", "Debit", 0.00),
    ("Stock", "Expense", "Expense", "INR", "Debit", 0.00),
    ("Trading Expenses", "Expense", "Expense Trading", "INR", "Debit", 0.00),
    ("Non Trading Expenses", "Expense", "Expense", "INR", "Debit", 0.00),
    ("Loan And Advances", "Assets", "Assets", "INR", "Debit", 0.00),
    ("Current Assets", "Assets", "Assets", "INR", "Debit", 0.00),
    ("Fixed Assets", "Assets", "Assets", "INR", "Debit", 0.00),
    ("Expense", "[NONE]", "Expense", "INR", "Debit", 0.00),
    ("Income", "[NONE]", "Income", "INR", "Debit", 0.00),
    ("Liabilities", "[NONE]", "Liabilities", "INR", "Debit", 0.00),
    ("Assets", "Assets", "Assets", "INR", "Debit", 0.00),
]

GROUP_NAMES = {
    "Expense", "Income", "Liabilities", "Assets", "Current Assets", "Fixed Assets",
    "Loan And Advances", "Trading Expenses", "Non Trading Expenses", "Trading Income",
    "Non Trading Income", "Current Liabilities", "Provision And Loan", "Reserves And Surplus",
    "Cash And Bank Balance", "Sundry Debtors",
}

CITY_OPTIONS = ["Dubai", "Mumbai", "NewYork", "Surat"]
STATE_OPTIONS = ["Gujarat", "Maharastra"]
COUNTRY_OPTIONS = ["BELGIUM", "CHINA", "HONG KONG", "INDIA", "JAPAN", "TAIWAN", "THAILAND", "TURKEY", "UAE", "UK", "USA"]
EMPTY_COUNTRY_NAMES = {"IGST", "SGST", "CGST", "VAT"}


def _actor_name(current_user: User) -> str:
    return ((current_user.full_name or "").strip() or (current_user.username or "").strip() or "User")


async def _ensure_unique_name(db: AsyncSession, company_id: str, name: str, exclude_id: str | None = None):
    q = select(AccountMaster.id).where(
        AccountMaster.company_id == company_id,
        func.lower(AccountMaster.account_group_name) == name.strip().lower(),
    )
    if exclude_id:
        q = q.where(AccountMaster.id != exclude_id)
    exists = (await db.execute(q)).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account/Group Name must be unique")


async def _log_activity(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    action: str,
    status_value: str,
    entity_id: str | None = None,
    message: str | None = None,
    payload: dict | None = None,
):
    db.add(ActivityLog(
        company_id=company_id,
        user_id=user_id,
        module="account-master",
        action=action,
        entity_id=entity_id,
        status=status_value,
        message=message,
        payload=json.dumps(payload or {}, default=str),
    ))


async def _ensure_system_accounts(db: AsyncSession, company_id: str):
    existing_rows = (await db.execute(select(AccountMaster).where(AccountMaster.company_id == company_id))).scalars().all()
    existing_lookup = {row.account_group_name.strip().lower(): row for row in existing_rows}
    changed = False

    for name, under_group, account_type, curr, balance_type, opening in SYSTEM_ACCOUNT_SEEDS:
        existing = existing_lookup.get(name.strip().lower())
        if existing:
            if existing.is_system:
                existing.entry_type = "Group" if name in GROUP_NAMES else "Account"
                existing.account_name = existing.account_name or name
                existing.under_group_name = under_group
                existing.account_type = account_type
                existing.currency = curr
                existing.balance_type = balance_type
                existing.country = "" if name in EMPTY_COUNTRY_NAMES else (existing.country or "INDIA")
                existing.allow_zero_opening_balance = True
                existing.created_by_name = existing.created_by_name or "System"
                changed = True
            continue

        db.add(AccountMaster(
            company_id=company_id,
            entry_type="Group" if name in GROUP_NAMES else "Account",
            account_group_name=name,
            account_name=name,
            under_group_name=under_group,
            account_type=account_type,
            currency=curr,
            opening_balance=opening,
            balance_type=balance_type,
            country="" if name in EMPTY_COUNTRY_NAMES else "INDIA",
            is_system=True,
            allow_zero_opening_balance=True,
            created_by_name="System",
        ))
        changed = True

    if changed:
        await db.commit()


@router.get("/options")
async def get_account_master_options(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_system_accounts(db, current_user.company_id)

    under_values = (await db.execute(
        select(AccountMaster.under_group_name)
        .where(AccountMaster.company_id == current_user.company_id, AccountMaster.under_group_name.isnot(None))
        .distinct()
        .order_by(AccountMaster.under_group_name)
    )).scalars().all()

    brokers = (await db.execute(
        select(AccountMaster.account_group_name)
        .where(
            AccountMaster.company_id == current_user.company_id,
            func.lower(AccountMaster.account_type) == "broker",
        )
        .order_by(AccountMaster.account_group_name)
    )).scalars().all()

    groups = [{"name": g, "account_type": ""} for g in under_values if g]
    return {
        "entry_types": ["Account", "Group"],
        "balance_types": ["Debit", "Credit"],
        "currencies": ["INR", "USD", "AED"],
        "currency_rates": {
            "INR": {"inr_base_rate": 85, "usd_base_rate": 1},
            "USD": {"inr_base_rate": 1, "usd_base_rate": 85},
            "AED": {"inr_base_rate": 25, "usd_base_rate": 3.67},
        },
        "groups": groups,
        "account_types": ACCOUNT_TYPE_OPTIONS,
        "cities": CITY_OPTIONS,
        "states": STATE_OPTIONS,
        "countries": COUNTRY_OPTIONS,
        "brokers": brokers,
    }


@router.get("", response_model=list[AccountMasterOut])
async def list_accounts(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_system_accounts(db, current_user.company_id)
    q = select(AccountMaster).where(AccountMaster.company_id == current_user.company_id)
    if search:
        q = q.where(AccountMaster.account_group_name.ilike(f"%{search.strip()}%"))
    q = q.order_by(AccountMaster.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return [AccountMasterOut.model_validate(r) for r in rows]


@router.get("/activity")
async def list_activity(
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(ActivityLog)
        .where(ActivityLog.company_id == current_user.company_id, ActivityLog.module == "account-master")
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    )).scalars().all()
    return [{
        "id": r.id,
        "action": r.action,
        "status": r.status,
        "entity_id": r.entity_id,
        "message": r.message,
        "payload": r.payload,
        "created_at": r.created_at,
    } for r in rows]


@router.get("/export")
async def export_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_system_accounts(db, current_user.company_id)
    rows = (await db.execute(
        select(AccountMaster).where(AccountMaster.company_id == current_user.company_id).order_by(AccountMaster.account_group_name)
    )).scalars().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Account Master"
    ws.append(["NAME", "UNDER GROUP", "TYPE", "CURR", "DR/CR", "OBAL", "COUNTRY"])
    for r in rows:
        ws.append([
            r.account_group_name,
            r.under_group_name,
            r.account_type,
            r.currency,
            "C" if r.balance_type == "Credit" else "D",
            float(r.opening_balance or 0),
            r.country or "",
        ])

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=account_master.xlsx"},
    )


@router.get("/{account_id}", response_model=AccountMasterOut)
async def get_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(AccountMaster).where(
            AccountMaster.id == account_id,
            AccountMaster.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return AccountMasterOut.model_validate(row)


@router.post("", response_model=AccountMasterOut, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountMasterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await _ensure_unique_name(db, current_user.company_id, payload.account_group_name)

        data = payload.model_dump()
        data["account_name"] = data.get("account_name") or data["account_group_name"]
        data["allow_zero_opening_balance"] = False

        row = AccountMaster(company_id=current_user.company_id, **data)
        row.created_by_name = _actor_name(current_user)
        db.add(row)
        await db.flush()
        await _log_activity(
            db,
            company_id=current_user.company_id,
            user_id=current_user.id,
            action="create",
            status_value="success",
            entity_id=row.id,
            message=f"Created account {row.account_group_name}",
            payload={"name": row.account_group_name, "under_group": row.under_group_name},
        )
        await db.commit()
        await db.refresh(row)
        return AccountMasterOut.model_validate(row)
    except HTTPException as e:
        await _log_activity(
            db,
            company_id=current_user.company_id,
            user_id=current_user.id,
            action="create",
            status_value="failure",
            message=e.detail if isinstance(e.detail, str) else "Validation failure",
            payload={"name": payload.account_group_name},
        )
        await db.commit()
        raise


@router.put("/{account_id}", response_model=AccountMasterOut)
async def update_account(
    account_id: str,
    payload: AccountMasterUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(AccountMaster).where(
            AccountMaster.id == account_id,
            AccountMaster.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    try:
        await _ensure_unique_name(db, current_user.company_id, payload.account_group_name, exclude_id=account_id)

        for key, val in payload.model_dump().items():
            setattr(row, key, val)

        row.account_name = row.account_name or row.account_group_name
        await _log_activity(
            db,
            company_id=current_user.company_id,
            user_id=current_user.id,
            action="update",
            status_value="success",
            entity_id=row.id,
            message=f"Updated account {row.account_group_name}",
            payload={"name": row.account_group_name},
        )
        await db.commit()
        await db.refresh(row)
        return AccountMasterOut.model_validate(row)
    except HTTPException as e:
        await _log_activity(
            db,
            company_id=current_user.company_id,
            user_id=current_user.id,
            action="update",
            status_value="failure",
            entity_id=account_id,
            message=e.detail if isinstance(e.detail, str) else "Validation failure",
            payload={"name": payload.account_group_name},
        )
        await db.commit()
        raise


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(AccountMaster).where(
            AccountMaster.id == account_id,
            AccountMaster.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    await db.delete(row)
    await _log_activity(
        db,
        company_id=current_user.company_id,
        user_id=current_user.id,
        action="delete",
        status_value="success",
        entity_id=account_id,
        message=f"Deleted account {row.account_group_name}",
        payload={"name": row.account_group_name},
    )
    await db.commit()
