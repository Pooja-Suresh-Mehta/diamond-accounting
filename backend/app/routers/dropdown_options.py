from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.constants import FIELD_DEFAULTS, FIELD_TABLE_COLUMNS, ITEMS_PARENT_TABLE, ITEM_NAME_FIELDS, ITEM_NAME_TABLES
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
    all_rows = (await db.execute(
        select(DropdownOption.field_name, DropdownOption.value, DropdownOption.is_suppressed)
        .where(DropdownOption.company_id == current_user.company_id)
        .order_by(DropdownOption.value)
    )).all()
    custom: dict[str, list[str]] = {}
    suppressed: dict[str, set[str]] = {}
    for field_name, value, is_suppressed in all_rows:
        if is_suppressed:
            suppressed.setdefault(field_name, set()).add(value)
        else:
            custom.setdefault(field_name, []).append(value)

    result = {}
    for field in ALLOWED_FIELDS:
        field_suppressed = suppressed.get(field, set())
        active_defaults = [v for v in FIELD_DEFAULTS.get(field, []) if v not in field_suppressed]
        result[field] = _merge(active_defaults, custom.get(field, []))
    return result


@router.get("/{field_name}")
async def get_options(
    field_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if field_name not in ALLOWED_FIELDS:
        raise HTTPException(status_code=400, detail=f"Unknown field: {field_name}")
    all_rows = (await db.execute(
        select(DropdownOption.value, DropdownOption.is_suppressed)
        .where(DropdownOption.company_id == current_user.company_id, DropdownOption.field_name == field_name)
        .order_by(DropdownOption.value)
    )).all()
    suppressed = {v for v, s in all_rows if s}
    custom = [v for v, s in all_rows if not s]
    active_defaults = [v for v in FIELD_DEFAULTS.get(field_name, []) if v not in suppressed]
    return _merge(active_defaults, custom)


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
        if existing.is_suppressed:
            # Un-suppress (restore) a previously suppressed default
            existing.is_suppressed = False
            await db.commit()
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

    # Recompute item_name for tables where it's derived from shape/color/size/clarity
    # item_name = TRIM(shape [+ ' ' + color] [+ ' ' + size] [+ ' ' + clarity])
    _ITEM_NAME_SQL = (
        "TRIM("
        "COALESCE(NULLIF(TRIM(COALESCE(shape,'')), ''), '') || "
        "CASE WHEN TRIM(COALESCE(color,''))   != '' THEN ' ' || TRIM(color)   ELSE '' END || "
        "CASE WHEN TRIM(COALESCE(size,''))    != '' THEN ' ' || TRIM(size)    ELSE '' END || "
        "CASE WHEN TRIM(COALESCE(clarity,'')) != '' THEN ' ' || TRIM(clarity) ELSE '' END"
        ")"
    )
    if body.field_name in ITEM_NAME_FIELDS:
        # Build a lookup: table_name -> col_name for the renamed field
        field_col_map = {t: c for t, c in FIELD_TABLE_COLUMNS.get(body.field_name, [])}
        for table_name in ITEM_NAME_TABLES:
            col_name = field_col_map.get(table_name)
            if not col_name:
                continue  # this field doesn't exist in this table
            parent = ITEMS_PARENT_TABLE.get(table_name)
            if parent:
                parent_table, fk_col, pk_col = parent
                item_sql = text(
                    f"UPDATE {table_name} SET item_name = {_ITEM_NAME_SQL} "
                    f"WHERE {col_name} = :new_val AND {fk_col} IN "
                    f"(SELECT {pk_col} FROM {parent_table} WHERE company_id = :cid)"
                )
            else:
                item_sql = text(
                    f"UPDATE {table_name} SET item_name = {_ITEM_NAME_SQL} "
                    f"WHERE {col_name} = :new_val AND company_id = :cid"
                )
            await db.execute(item_sql, {"new_val": new_val, "cid": current_user.company_id})

        # memo_out_items and memo_out_return_items store item_name only (no individual columns)
        # Use word-boundary-safe REPLACE: pad with spaces so every token is surrounded by spaces
        _MEMO_ITEM_NAME_SQL = (
            "TRIM(REPLACE(' ' || COALESCE(item_name, '') || ' ', ' ' || :old_val || ' ', ' ' || :new_val || ' '))"
        )
        await db.execute(
            text(
                f"UPDATE memo_out_items SET item_name = {_MEMO_ITEM_NAME_SQL} "
                f"WHERE (' ' || COALESCE(item_name,'') || ' ') LIKE '% ' || :old_val || ' %' "
                f"AND memo_out_id IN (SELECT id FROM memo_outs WHERE company_id = :cid)"
            ),
            {"old_val": old_val, "new_val": new_val, "cid": current_user.company_id},
        )
        await db.execute(
            text(
                f"UPDATE memo_out_return_items SET item_name = {_MEMO_ITEM_NAME_SQL} "
                f"WHERE (' ' || COALESCE(item_name,'') || ' ') LIKE '% ' || :old_val || ' %' "
                f"AND memo_out_return_id IN (SELECT id FROM memo_out_returns WHERE company_id = :cid)"
            ),
            {"old_val": old_val, "new_val": new_val, "cid": current_user.company_id},
        )

    # Fetch both old and new rows up front (before any modifications to avoid autoflush conflicts)
    opt_old, opt_new = (await db.execute(
        select(DropdownOption).where(
            DropdownOption.company_id == current_user.company_id,
            DropdownOption.field_name == body.field_name,
            DropdownOption.value.in_([old_val, new_val]),
        )
    )).scalars().all(), None
    opt_old_map = {r.value: r for r in opt_old}
    old_row = opt_old_map.get(old_val)
    new_row = opt_old_map.get(new_val)

    if old_row:
        if new_row:
            # new_val already exists — delete the old row (or un-suppress new_row if needed)
            if new_row.is_suppressed:
                new_row.is_suppressed = False
            await db.delete(old_row)
        else:
            # new_val doesn't exist yet — rename old row in place
            old_row.value = new_val
            old_row.is_suppressed = False
    else:
        # old_val was a hardcoded default (not in DB)
        # Suppress the old default name
        if not new_row:
            # Insert suppression for old + active row for new in one shot
            db.add(DropdownOption(
                company_id=current_user.company_id,
                field_name=body.field_name,
                value=old_val,
                is_suppressed=True,
            ))
            db.add(DropdownOption(
                company_id=current_user.company_id,
                field_name=body.field_name,
                value=new_val,
                is_suppressed=False,
            ))
        else:
            # new_val already has a row — just suppress old default
            db.add(DropdownOption(
                company_id=current_user.company_id,
                field_name=body.field_name,
                value=old_val,
                is_suppressed=True,
            ))
            if new_row.is_suppressed:
                new_row.is_suppressed = False

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
