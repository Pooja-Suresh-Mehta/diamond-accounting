from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
import re

from app.auth import get_current_user
from app.constants import (
    DEFAULT_SHAPES as SHAPES,
    DEFAULT_COLORS as COLORS,
    DEFAULT_CLARITIES as CLARITIES,
    DEFAULT_SIZES as SIZES,
    DEFAULT_SIEVES as SIEVES,
    DEFAULT_STOCK_GROUPS as STOCK_GROUP_IDS,
)
from app.database import get_db
from app.models.models import DropdownOption, ParcelMaster, User
from app.schemas import ParcelMasterCreate, ParcelMasterOut, ParcelMasterUpdate

router = APIRouter(prefix="/api/parcel-master", tags=["parcel-master"])


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
STOCK_TYPES = ["Natural Diamond", "Lab Grown Diamond", "Gem Stone"]
STOCK_SUBTYPES = ["Polished", "Rough", "Makeable"]
GROWN_PROCESS_TYPES = ["Natural", "HPHT", "CVD"]


def _actor_name(current_user: User) -> str:
    return ((current_user.full_name or "").strip() or (current_user.username or "").strip() or "User")


async def _ensure_unique_lot(db: AsyncSession, company_id: str, lot_no: str, exclude_id: str | None = None):
    q = select(ParcelMaster.id).where(
        ParcelMaster.company_id == company_id,
        func.lower(ParcelMaster.lot_no) == lot_no.strip().lower(),
    )
    if exclude_id:
        q = q.where(ParcelMaster.id != exclude_id)
    exists = (await db.execute(q)).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock ID/LotNo must be unique")


@router.get("/options")
async def get_parcel_options(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch all custom options for this company in one query
    custom_rows = (await db.execute(
        select(DropdownOption.field_name, DropdownOption.value)
        .where(DropdownOption.company_id == current_user.company_id)
        .order_by(DropdownOption.value)
    )).all()
    custom: dict[str, list[str]] = {}
    for field_name, value in custom_rows:
        custom.setdefault(field_name, []).append(value)

    return {
        "shapes": _merge(SHAPES, custom.get("shape", [])),
        "colors": _merge(COLORS, custom.get("color", [])),
        "clarities": _merge(CLARITIES, custom.get("clarity", [])),
        "sizes": _merge(SIZES, custom.get("size", [])),
        "sieves": _merge(SIEVES, custom.get("sieve", [])),
        "group_ids": _merge(STOCK_GROUP_IDS, custom.get("stock_group", [])),
        "stock_types": STOCK_TYPES,
        "stock_subtypes": STOCK_SUBTYPES,
        "grown_process_types": GROWN_PROCESS_TYPES,
    }


@router.get("", response_model=list[ParcelMasterOut])
async def list_parcels(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(ParcelMaster).where(ParcelMaster.company_id == current_user.company_id)
    if search:
        q = q.where(
            ParcelMaster.lot_no.ilike(f"%{search.strip()}%") |
            ParcelMaster.item_name.ilike(f"%{search.strip()}%")
        )
    q = q.order_by(ParcelMaster.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return [ParcelMasterOut.model_validate(r) for r in rows]


@router.get("/next-lot")
async def next_lot_number(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lot_nos = (await db.execute(
        select(ParcelMaster.lot_no).where(ParcelMaster.company_id == current_user.company_id)
    )).scalars().all()
    max_num = 0
    for lot in lot_nos:
        m = re.search(r'(\d+)$', lot.strip())
        if m:
            max_num = max(max_num, int(m.group(1)))
    return {"lot_no": f"{max_num + 1:04d}"}


@router.get("/{parcel_id}", response_model=ParcelMasterOut)
async def get_parcel(
    parcel_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(ParcelMaster).where(
            ParcelMaster.id == parcel_id,
            ParcelMaster.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcel item not found")
    return ParcelMasterOut.model_validate(row)


@router.post("", response_model=ParcelMasterOut, status_code=status.HTTP_201_CREATED)
async def create_parcel(
    payload: ParcelMasterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_unique_lot(db, current_user.company_id, payload.lot_no)
    row = ParcelMaster(company_id=current_user.company_id, **payload.model_dump())
    row.created_by_name = _actor_name(current_user)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ParcelMasterOut.model_validate(row)


@router.put("/{parcel_id}", response_model=ParcelMasterOut)
async def update_parcel(
    parcel_id: str,
    payload: ParcelMasterUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(ParcelMaster).where(
            ParcelMaster.id == parcel_id,
            ParcelMaster.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcel item not found")

    await _ensure_unique_lot(db, current_user.company_id, payload.lot_no, exclude_id=parcel_id)
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return ParcelMasterOut.model_validate(row)


@router.delete("/{parcel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_parcel(
    parcel_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(ParcelMaster).where(
            ParcelMaster.id == parcel_id,
            ParcelMaster.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcel item not found")
    await db.delete(row)
    await db.commit()
