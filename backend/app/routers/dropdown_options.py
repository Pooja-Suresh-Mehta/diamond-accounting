from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.constants import FIELD_DEFAULTS, FIELD_TABLE_COLUMNS, ITEMS_PARENT_TABLE
from app.database import get_db
from app.models.models import DropdownOption, User
from app.schemas import DropdownRenameRequest

router = APIRouter(prefix="/api/dropdown-options", tags=["dropdown-options"])

ALLOWED_FIELDS = {"shape", "color", "clarity", "size", "sieve", "stock_group"}


def _merge(defaults: list[str], custom: list[str]) -> list[str]:
    """Merge default + custom values, deduplicate case-insensitively, preserve order."""
    seen = set()
    result = []
    for v in defaults + custom:
        key = v.strip().lower()
        if key and key not in seen:
            seen.add(key)
            result.append(v.strip())
    return result


@router.get("/all")
async def get_all_options(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all dropdown values for every field, merging defaults + custom."""
    custom_rows = (await db.execute(
        select(DropdownOption.field_name, DropdownOption.value)
        .where(DropdownOption.company_id == current_user.company_id)
        .order_by(DropdownOption.value)
    )).all()
    custom: dict[str, list[str]] = {}
    for field_name, value in custom_rows:
        custom.setdefault(field_name, []).append(value)

    return {
        field: _merge(FIELD_DEFAULTS.get(field, []), custom.get(field, []))
        for field in ALLOWED_FIELDS
    }


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


async def _get_usage(db: AsyncSession, company_id: str, field_name: str, value: str) -> dict[str, int]:
    """Count rows using this value across all mapped tables."""
    table_cols = FIELD_TABLE_COLUMNS.get(field_name, [])
    usage = {}
    for table_name, col_name in table_cols:
        parent = ITEMS_PARENT_TABLE.get(table_name)
        if parent:
            parent_table, fk_col, pk_col = parent
            sql = text(
                f"SELECT COUNT(*) FROM {table_name} t "
                f"JOIN {parent_table} p ON t.{fk_col} = p.{pk_col} "
                f"WHERE t.{col_name} = :val AND p.company_id = :cid"
            )
        elif table_name == "diamonds":
            sql = text(f"SELECT COUNT(*) FROM {table_name} WHERE {col_name} = :val AND company_id = :cid")
        else:
            sql = text(f"SELECT COUNT(*) FROM {table_name} WHERE {col_name} = :val AND company_id = :cid")
        count = (await db.execute(sql, {"val": value, "cid": company_id})).scalar() or 0
        if count > 0:
            usage[table_name] = count
    return usage


@router.get("/usage/{field_name}")
async def get_usage(
    field_name: str,
    value: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check how many rows reference this value across all tables."""
    if field_name not in ALLOWED_FIELDS:
        raise HTTPException(status_code=400, detail=f"Unknown field: {field_name}")
    usage = await _get_usage(db, current_user.company_id, field_name, value)
    return {"field_name": field_name, "value": value, "usage": usage, "total": sum(usage.values())}


@router.put("/rename")
async def rename_option(
    body: DropdownRenameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rename a dropdown value and cascade the change across all tables."""
    if body.field_name not in ALLOWED_FIELDS:
        raise HTTPException(status_code=400, detail=f"Unknown field: {body.field_name}")
    old_val = body.old_value.strip()
    new_val = body.new_value.strip()
    if not old_val or not new_val:
        raise HTTPException(status_code=400, detail="old_value and new_value are required")
    if old_val == new_val:
        return {"ok": True, "updated_tables": {}}

    # Cascade update across all mapped tables
    table_cols = FIELD_TABLE_COLUMNS.get(body.field_name, [])
    updated_tables = {}
    for table_name, col_name in table_cols:
        parent = ITEMS_PARENT_TABLE.get(table_name)
        if parent:
            parent_table, fk_col, pk_col = parent
            sql = text(
                f"UPDATE {table_name} SET {col_name} = :new_val "
                f"WHERE {col_name} = :old_val AND {fk_col} IN "
                f"(SELECT {pk_col} FROM {parent_table} WHERE company_id = :cid)"
            )
        else:
            sql = text(
                f"UPDATE {table_name} SET {col_name} = :new_val "
                f"WHERE {col_name} = :old_val AND company_id = :cid"
            )
        result = await db.execute(sql, {"old_val": old_val, "new_val": new_val, "cid": current_user.company_id})
        if result.rowcount > 0:
            updated_tables[table_name] = result.rowcount

    # Update the dropdown_options table entry if it exists
    opt_row = (await db.execute(
        select(DropdownOption).where(
            DropdownOption.company_id == current_user.company_id,
            DropdownOption.field_name == body.field_name,
            DropdownOption.value == old_val,
        )
    )).scalar_one_or_none()
    if opt_row:
        opt_row.value = new_val

    await db.commit()
    return {"ok": True, "updated_tables": updated_tables}


@router.delete("/{field_name}/{value}")
async def delete_option(
    field_name: str,
    value: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if field_name not in ALLOWED_FIELDS:
        raise HTTPException(status_code=400, detail=f"Unknown field: {field_name}")

    # Check usage before deleting
    usage = await _get_usage(db, current_user.company_id, field_name, value)
    if usage:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"Cannot delete '{value}' - it is used in {sum(usage.values())} record(s). Use Rename instead to correct spelling.",
                "usage": usage,
            },
        )

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
