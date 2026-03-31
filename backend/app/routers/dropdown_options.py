from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import DropdownOption, User

router = APIRouter(prefix="/api/dropdown-options", tags=["dropdown-options"])

ALLOWED_FIELDS = {"shape", "color", "clarity", "size", "sieve"}


@router.get("/{field_name}")
async def get_options(
    field_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if field_name not in ALLOWED_FIELDS:
        raise HTTPException(status_code=400, detail=f"Unknown field: {field_name}")
    rows = (await db.execute(
        select(DropdownOption.value)
        .where(DropdownOption.company_id == current_user.company_id, DropdownOption.field_name == field_name)
        .order_by(DropdownOption.value)
    )).scalars().all()
    return list(rows)


@router.post("/{field_name}")
async def add_option(
    field_name: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if field_name not in ALLOWED_FIELDS:
        raise HTTPException(status_code=400, detail=f"Unknown field: {field_name}")
    value = (body.get("value") or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="value is required")

    existing = (await db.execute(
        select(DropdownOption).where(
            DropdownOption.company_id == current_user.company_id,
            DropdownOption.field_name == field_name,
            DropdownOption.value == value,
        )
    )).scalar_one_or_none()
    if existing:
        return {"value": existing.value}

    opt = DropdownOption(company_id=current_user.company_id, field_name=field_name, value=value)
    db.add(opt)
    await db.commit()
    return {"value": value}


@router.delete("/{field_name}/{value}")
async def delete_option(
    field_name: str,
    value: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if field_name not in ALLOWED_FIELDS:
        raise HTTPException(status_code=400, detail=f"Unknown field: {field_name}")
    row = (await db.execute(
        select(DropdownOption).where(
            DropdownOption.company_id == current_user.company_id,
            DropdownOption.field_name == field_name,
            DropdownOption.value == value,
        )
    )).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()
    return {"ok": True}
