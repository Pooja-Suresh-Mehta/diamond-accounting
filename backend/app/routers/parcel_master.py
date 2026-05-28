from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime as dt

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
from app.models.models import DropdownOption, ParcelMaster, ParcelMergeLog, User
from app.schemas import (
    ParcelMasterCreate, ParcelMasterFinalOut, ParcelMasterOut, ParcelMasterSimilarResponse,
    ParcelMasterUpdate, ParcelMergeLogOut,
)

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


async def _ensure_unique_lot(db: AsyncSession, company_id: str, lot_no: int, exclude_id: str | None = None):
    q = select(ParcelMaster.id).where(
        ParcelMaster.company_id == company_id,
        ParcelMaster.lot_no == lot_no,
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
    all_rows = (await db.execute(
        select(DropdownOption.field_name, DropdownOption.value, DropdownOption.is_suppressed)
        .where(DropdownOption.company_id == current_user.company_id)
        .order_by(DropdownOption.value)
    )).all()
    custom: dict[str, list[str]] = {}
    suppressed: dict[str, set[str]] = {}
    for field_name, value, is_sup in all_rows:
        if is_sup:
            suppressed.setdefault(field_name, set()).add(value)
        else:
            custom.setdefault(field_name, []).append(value)

    def _active(defaults, field):
        sup = suppressed.get(field, set())
        return _merge([v for v in defaults if v not in sup], custom.get(field, []))

    return {
        "shapes": _active(SHAPES, "shape"),
        "colors": _active(COLORS, "color"),
        "clarities": _active(CLARITIES, "clarity"),
        "sizes": _active(SIZES, "size"),
        "sieves": _active(SIEVES, "sieve"),
        "group_ids": _active(STOCK_GROUP_IDS, "stock_group"),
        "stock_types": STOCK_TYPES,
        "stock_subtypes": STOCK_SUBTYPES,
        "grown_process_types": GROWN_PROCESS_TYPES,
    }


@router.get("", response_model=list[ParcelMasterOut])
async def list_parcels(
    search: str | None = Query(default=None),
    include_merged: bool = Query(default=False, description="Include parcels absorbed into another lot"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=500, ge=1, le=5000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(ParcelMaster).where(ParcelMaster.company_id == current_user.company_id)
    if not include_merged:
        q = q.where(ParcelMaster.merged_into_lot_no == None)  # noqa: E711
    if search:
        s = search.strip()
        try:
            lot_int = int(s)
            q = q.where((ParcelMaster.lot_no == lot_int) | ParcelMaster.item_name.ilike(f"%{s}%"))
        except ValueError:
            q = q.where(ParcelMaster.item_name.ilike(f"%{s}%"))
    q = q.order_by(ParcelMaster.lot_no.desc()).offset((page - 1) * page_size).limit(page_size)
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
    max_num = max((int(lot) for lot in lot_nos if lot), default=0)
    return {"lot_no": max_num + 1}


_SIMILARITY_FIELDS = [
    "shape", "color", "clarity", "size", "sieve_mm",
    "stock_group_id", "stock_type", "stock_subtype", "grown_process_type",
]


def _build_merge_description_line(existing: ParcelMaster, payload: ParcelMasterCreate) -> str:
    currency = payload.purchase_price_currency or "USD"
    weight = payload.opening_weight_carats or 0
    price = payload.purchase_price or 0
    lot = payload.lot_no or ""
    return f"[Merged from Lot#{lot}: {weight}ct @ {price} {currency}/ct]"


def _compute_merged_preview(existing: ParcelMaster, payload: ParcelMasterCreate) -> ParcelMasterOut:
    old_w = existing.opening_weight_carats or 0.0
    new_w = payload.opening_weight_carats or 0.0
    total_w = old_w + new_w

    new_cost_inr = (existing.purchase_cost_inr_amount or 0) + (payload.purchase_cost_inr_amount or 0)
    new_cost_usd = (existing.purchase_cost_usd_amount or 0) + (payload.purchase_cost_usd_amount or 0)
    new_asking_inr = (existing.asking_inr_amount or 0) + (payload.asking_inr_amount or 0)
    new_asking_usd = (existing.asking_usd_amount or 0) + (payload.asking_usd_amount or 0)

    avg_price = (
        ((existing.purchase_price or 0) * old_w + (payload.purchase_price or 0) * new_w) / total_w
        if total_w > 0 else (existing.purchase_price or 0)
    )

    return ParcelMasterOut(
        id=existing.id,
        company_id=existing.company_id,
        lot_no=existing.lot_no,
        item_name=existing.item_name,
        shape=existing.shape,
        color=existing.color,
        clarity=existing.clarity,
        size=existing.size,
        sieve_mm=existing.sieve_mm,
        stock_group_id=existing.stock_group_id,
        description=existing.description,
        stock_type=existing.stock_type,
        stock_subtype=existing.stock_subtype,
        grown_process_type=existing.grown_process_type,
        opening_weight_carats=round(total_w, 4),
        purchase_price=round(avg_price, 2),
        purchase_price_currency=existing.purchase_price_currency,
        usd_to_inr_rate=existing.usd_to_inr_rate or 0,
        purchase_cost_inr_amount=round(new_cost_inr, 2),
        purchase_cost_usd_amount=round(new_cost_usd, 2),
        purchase_cost_inr_carat=round(new_cost_inr / total_w, 2) if total_w > 0 else 0,
        purchase_cost_usd_carat=round(new_cost_usd / total_w, 2) if total_w > 0 else 0,
        asking_inr_amount=round(new_asking_inr, 2),
        asking_usd_amount=round(new_asking_usd, 2),
        asking_price_inr_carats=round(new_asking_inr / total_w, 2) if total_w > 0 else 0,
        asking_price_usd_carats=round(new_asking_usd / total_w, 2) if total_w > 0 else 0,
        created_by_name=existing.created_by_name,
        created_at=existing.created_at,
        updated_at=existing.updated_at,
    )


@router.post("/check-similar", response_model=ParcelMasterSimilarResponse)
async def check_similar_parcel(
    payload: ParcelMasterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if a similar parcel entry already exists (matching on all classification fields)."""
    # Only match against non-absorbed (active) parcels
    q = select(ParcelMaster).where(
        ParcelMaster.company_id == current_user.company_id,
        ParcelMaster.merged_into_lot_no == None,  # noqa: E711
    )
    for field in _SIMILARITY_FIELDS:
        val = (getattr(payload, field, None) or "").strip().lower()
        col = getattr(ParcelMaster, field)
        if val:
            q = q.where(func.lower(col) == val)
        else:
            q = q.where((col == None) | (col == ""))  # noqa: E711
    existing = (await db.execute(q)).scalars().first()
    if not existing:
        return ParcelMasterSimilarResponse(existing=None, merged_preview=None)
    return ParcelMasterSimilarResponse(
        existing=ParcelMasterOut.model_validate(existing),
        merged_preview=_compute_merged_preview(existing, payload),
    )


@router.post("/check-similar-edit/{parcel_id}", response_model=ParcelMasterSimilarResponse)
async def check_similar_for_edit(
    parcel_id: str,
    payload: ParcelMasterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """After editing, check if the updated parcel now matches another existing parcel (exclude self)."""
    # Only match against non-absorbed (active) parcels; exclude self
    q = select(ParcelMaster).where(
        ParcelMaster.company_id == current_user.company_id,
        ParcelMaster.id != parcel_id,
        ParcelMaster.merged_into_lot_no == None,  # noqa: E711
    )
    for field in _SIMILARITY_FIELDS:
        val = (getattr(payload, field, None) or "").strip().lower()
        col = getattr(ParcelMaster, field)
        if val:
            q = q.where(func.lower(col) == val)
        else:
            q = q.where((col == None) | (col == ""))  # noqa: E711
    existing = (await db.execute(q)).scalars().first()
    if not existing:
        return ParcelMasterSimilarResponse(existing=None, merged_preview=None)
    return ParcelMasterSimilarResponse(
        existing=ParcelMasterOut.model_validate(existing),
        merged_preview=_compute_merged_preview(existing, payload),
    )


@router.post("/merge/{parcel_id}", response_model=ParcelMasterOut)
async def merge_parcel(
    parcel_id: str,
    payload: ParcelMasterCreate,
    source_parcel_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Non-destructive merge: flag the absorbed parcel and log the event. Neither parcel's manual values are changed."""
    surviving = (await db.execute(
        select(ParcelMaster).where(
            ParcelMaster.id == parcel_id,
            ParcelMaster.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not surviving:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcel item not found")

    # source_parcel_id: the parcel being absorbed (must already exist in parcel_masters)
    absorbed = None
    if source_parcel_id:
        absorbed = (await db.execute(
            select(ParcelMaster).where(
                ParcelMaster.id == source_parcel_id,
                ParcelMaster.company_id == current_user.company_id,
            )
        )).scalar_one_or_none()
        if not absorbed:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source parcel not found")
        if absorbed.merged_into_lot_no:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lot '{absorbed.lot_no}' is already merged into '{absorbed.merged_into_lot_no}'",
            )

    # Snapshot the values being contributed by the absorbed lot
    merged_lot_no = absorbed.lot_no if absorbed else (payload.lot_no or 0)
    merged_weight = float(absorbed.opening_weight_carats if absorbed else payload.opening_weight_carats or 0)
    merged_cost_inr = float(absorbed.purchase_cost_inr_amount if absorbed else payload.purchase_cost_inr_amount or 0)
    merged_cost_usd = float(absorbed.purchase_cost_usd_amount if absorbed else payload.purchase_cost_usd_amount or 0)
    merged_asking_inr = float(absorbed.asking_inr_amount if absorbed else payload.asking_inr_amount or 0)
    merged_asking_usd = float(absorbed.asking_usd_amount if absorbed else payload.asking_usd_amount or 0)
    merged_price = float(absorbed.purchase_price if absorbed else payload.purchase_price or 0)
    merged_price_currency = (absorbed.purchase_price_currency if absorbed else payload.purchase_price_currency) or "USD"

    log = ParcelMergeLog(
        company_id=current_user.company_id,
        surviving_parcel_id=surviving.id,
        surviving_lot_no=surviving.lot_no,
        merged_parcel_id=absorbed.id if absorbed else None,
        merged_lot_no=merged_lot_no,
        merged_weight=merged_weight,
        merged_purchase_cost_inr=merged_cost_inr,
        merged_purchase_cost_usd=merged_cost_usd,
        merged_asking_inr=merged_asking_inr,
        merged_asking_usd=merged_asking_usd,
        merged_purchase_price=merged_price,
        merged_purchase_price_currency=merged_price_currency,
        merged_by_name=_actor_name(current_user),
    )
    db.add(log)

    # Flag the absorbed parcel — it stays in parcel_masters untouched, just hidden from final view
    if absorbed:
        absorbed.merged_into_lot_no = surviving.lot_no

    await db.commit()
    await db.refresh(surviving)
    return ParcelMasterOut.model_validate(surviving)


@router.get("/merge-log", response_model=list[ParcelMergeLogOut])
async def list_merge_logs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(ParcelMergeLog)
        .where(ParcelMergeLog.company_id == current_user.company_id)
        .order_by(ParcelMergeLog.merged_at.desc())
    )).scalars().all()
    return [ParcelMergeLogOut.model_validate(r) for r in rows]


@router.post("/unmerge/{log_id}", response_model=ParcelMasterOut)
async def unmerge_parcel(
    log_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Undo a merge: clear the absorbed parcel's flag. Neither parcel's values are changed."""
    log = (await db.execute(
        select(ParcelMergeLog).where(
            ParcelMergeLog.id == log_id,
            ParcelMergeLog.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merge log entry not found")
    if log.reversed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This merge has already been reversed")

    surviving = (await db.execute(
        select(ParcelMaster).where(
            ParcelMaster.id == log.surviving_parcel_id,
            ParcelMaster.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not surviving:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Surviving parcel no longer exists")

    # Clear the absorbed parcel's flag so it reappears in normal views
    if log.merged_parcel_id:
        absorbed = (await db.execute(
            select(ParcelMaster).where(
                ParcelMaster.id == log.merged_parcel_id,
                ParcelMaster.company_id == current_user.company_id,
            )
        )).scalar_one_or_none()
        if absorbed:
            absorbed.merged_into_lot_no = None

    # Mark log as reversed — kept for audit trail, excluded from final view computations
    log.reversed = True
    log.reversed_at = dt.utcnow()

    await db.commit()
    await db.refresh(surviving)
    return ParcelMasterOut.model_validate(surviving)


@router.get("/final", response_model=list[ParcelMasterFinalOut])
async def list_parcels_final(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=500, ge=1, le=5000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Computed final view: each parcel's values include all active (non-reversed) merge logs.
    Parcels absorbed into another lot are excluded.
    """
    q = (
        select(ParcelMaster)
        .where(
            ParcelMaster.company_id == current_user.company_id,
            ParcelMaster.merged_into_lot_no == None,  # noqa: E711
        )
    )
    if search:
        s = search.strip()
        try:
            lot_int = int(s)
            q = q.where((ParcelMaster.lot_no == lot_int) | ParcelMaster.item_name.ilike(f"%{s}%"))
        except ValueError:
            q = q.where(ParcelMaster.item_name.ilike(f"%{s}%"))
    q = q.order_by(ParcelMaster.lot_no.desc()).offset((page - 1) * page_size).limit(page_size)
    parcels = (await db.execute(q)).scalars().all()

    # Fetch all active merge logs for these parcels in one query
    parcel_ids = [p.id for p in parcels]
    logs_result = (await db.execute(
        select(ParcelMergeLog).where(
            ParcelMergeLog.company_id == current_user.company_id,
            ParcelMergeLog.surviving_parcel_id.in_(parcel_ids),
            ParcelMergeLog.reversed == False,  # noqa: E712
        )
    )).scalars().all()

    logs_by_parcel: dict[str, list[ParcelMergeLog]] = {}
    for log in logs_result:
        logs_by_parcel.setdefault(log.surviving_parcel_id, []).append(log)

    result = []
    for parcel in parcels:
        active_logs = logs_by_parcel.get(parcel.id, [])
        base_w = float(parcel.opening_weight_carats or 0)
        merged_w_total = sum(float(lg.merged_weight or 0) for lg in active_logs)
        total_w = base_w + merged_w_total

        total_cost_inr = float(parcel.purchase_cost_inr_amount or 0) + sum(float(lg.merged_purchase_cost_inr or 0) for lg in active_logs)
        total_cost_usd = float(parcel.purchase_cost_usd_amount or 0) + sum(float(lg.merged_purchase_cost_usd or 0) for lg in active_logs)
        total_asking_inr = float(parcel.asking_inr_amount or 0) + sum(float(lg.merged_asking_inr or 0) for lg in active_logs)
        total_asking_usd = float(parcel.asking_usd_amount or 0) + sum(float(lg.merged_asking_usd or 0) for lg in active_logs)

        # Weighted average purchase price across base + all merged lots
        base_price_component = float(parcel.purchase_price or 0) * base_w
        merged_price_component = sum(float(lg.merged_purchase_price or 0) * float(lg.merged_weight or 0) for lg in active_logs)
        avg_purchase_price = round((base_price_component + merged_price_component) / total_w, 4) if total_w > 0 else float(parcel.purchase_price or 0)

        out = ParcelMasterFinalOut(
            id=parcel.id,
            company_id=parcel.company_id,
            lot_no=parcel.lot_no,
            item_name=parcel.item_name,
            shape=parcel.shape,
            color=parcel.color,
            clarity=parcel.clarity,
            size=parcel.size,
            sieve_mm=parcel.sieve_mm,
            stock_group_id=parcel.stock_group_id,
            description=parcel.description,
            stock_type=parcel.stock_type,
            stock_subtype=parcel.stock_subtype,
            grown_process_type=parcel.grown_process_type,
            usd_to_inr_rate=parcel.usd_to_inr_rate or 0,
            purchase_price_currency=parcel.purchase_price_currency or "USD",
            # Computed merged values
            opening_weight_carats=round(total_w, 4),
            purchase_price=avg_purchase_price,
            purchase_cost_inr_amount=round(total_cost_inr, 2),
            purchase_cost_usd_amount=round(total_cost_usd, 2),
            purchase_cost_inr_carat=round(total_cost_inr / total_w, 4) if total_w > 0 else 0,
            purchase_cost_usd_carat=round(total_cost_usd / total_w, 4) if total_w > 0 else 0,
            asking_inr_amount=round(total_asking_inr, 2),
            asking_usd_amount=round(total_asking_usd, 2),
            asking_price_inr_carats=round(total_asking_inr / total_w, 4) if total_w > 0 else 0,
            asking_price_usd_carats=round(total_asking_usd / total_w, 4) if total_w > 0 else 0,
            merged_into_lot_no=parcel.merged_into_lot_no,
            created_by_name=parcel.created_by_name,
            created_at=parcel.created_at,
            updated_at=parcel.updated_at,
            merged_lots=[lg.merged_lot_no for lg in active_logs],
        )
        result.append(out)
    return result


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
    # Normalize lot number
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

    # Normalize lot number
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
    
    # Delete all merge logs associated with this parcel (either as merged or surviving)
    merge_logs = (await db.execute(
        select(ParcelMergeLog).where(
            (ParcelMergeLog.merged_parcel_id == parcel_id) | (ParcelMergeLog.surviving_parcel_id == parcel_id),
            ParcelMergeLog.company_id == current_user.company_id,
        )
    )).scalars().all()
    for log in merge_logs:
        await db.delete(log)
    
    await db.delete(row)
    await db.commit()
