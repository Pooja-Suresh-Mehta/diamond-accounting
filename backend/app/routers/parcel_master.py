from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import ParcelMaster, User
from app.schemas import ParcelMasterCreate, ParcelMasterOut, ParcelMasterUpdate

router = APIRouter(prefix="/api/parcel-master", tags=["parcel-master"])

SHAPES = [
    "RBC", "PR", "PR1", "EM", "EMA", "Square EmeraldA", "Square Emerald", "PRN", "MQ", "AS",
    "Tapered Baguette", "Tapered Bullet", "Pear", "Calf", "Briolette", "Bullets", "CB",
    "Cushion Modified", "EuropeanCut", "Epaulette", "Flanders", "Half Moon", "HE", "Hexagonal",
    "Kite", "Lozenge", "Octagonal", "OV", "Pentagonal", "RA", "Square Radiant", "Rose", "Shield",
    "Square", "Star", "BR", "Testa", "TAPP/BUGG", "dd", "PB",
]
COLORS = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "MIX"]
CLARITIES = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "SI3", "I1", "I2", "I3"]
SIZES = [
    "10.00 CRT UP", "5.00 CRT UP", "4.50 CRT UP", "4.00 CRT UP", "3.50 CRT UP", "3.00 CRT UP",
    "2.70 CRT UP", "2.50 CRT UP", "2.30 CRT UP", "2.00 CRT UP", "1.90 CRT UP", "1.80 CRT UP",
    "1.70 CRT UP", "1.60 CRT UP", "1.50 CRT UP", "1.40 CRT UP", "1.30 CRT UP", "1.20 CRT UP",
    "1.00 CRT UP", "0.90 UP", "0.80 UP", "0.70 UP", "0.60 UP", "0.50 UP", "0.40 UP", "0.30 UP",
    "0.23 UP", "0.18 UP",
]
SIEVES = ["-000", "+000", "000-2", "2-6", "6-9", "9-11", "11 UP"]
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
    groups = (await db.execute(
        select(ParcelMaster.stock_group_id)
        .where(ParcelMaster.company_id == current_user.company_id, ParcelMaster.stock_group_id.isnot(None))
        .distinct()
        .order_by(ParcelMaster.stock_group_id)
    )).scalars().all()

    if not groups:
        groups = ["GRP-1", "GRP-2", "GRP-3"]

    return {
        "shapes": SHAPES,
        "colors": COLORS,
        "clarities": CLARITIES,
        "sizes": SIZES,
        "sieves": SIEVES,
        "group_ids": groups,
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
