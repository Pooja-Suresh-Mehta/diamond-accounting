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
from app.models.models import DropdownOption, ParcelMaster, ParcelMergeLog, User
from app.schemas import (
    ParcelMasterCreate, ParcelMasterOut, ParcelMasterSimilarResponse,
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
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=500, ge=1, le=5000),
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
        purchased_weight=existing.purchased_weight or 0,
        purchased_pcs=existing.purchased_pcs or 0,
        sold_weight=existing.sold_weight or 0,
        sold_pcs=existing.sold_pcs or 0,
        on_memo_weight=existing.on_memo_weight or 0,
        on_memo_pcs=existing.on_memo_pcs or 0,
        consignment_weight=existing.consignment_weight or 0,
        consignment_pcs=existing.consignment_pcs or 0,
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
    q = select(ParcelMaster).where(ParcelMaster.company_id == current_user.company_id)
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
    q = select(ParcelMaster).where(
        ParcelMaster.company_id == current_user.company_id,
        ParcelMaster.id != parcel_id,
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
    """Merge payload into existing parcel. If source_parcel_id provided (edit-merge), delete it after."""
    row = (await db.execute(
        select(ParcelMaster).where(
            ParcelMaster.id == parcel_id,
            ParcelMaster.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcel item not found")

    source_row = None
    if source_parcel_id:
        source_row = (await db.execute(
            select(ParcelMaster).where(
                ParcelMaster.id == source_parcel_id,
                ParcelMaster.company_id == current_user.company_id,
            )
        )).scalar_one_or_none()
        if not source_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source parcel not found")

    preview = _compute_merged_preview(row, payload)

    # Append description line
    desc_line = _build_merge_description_line(row, payload)
    existing_desc = (row.description or "").strip()
    row.description = (existing_desc + "\n" + desc_line).strip() if existing_desc else desc_line

    # Create merge log
    log = ParcelMergeLog(
        company_id=current_user.company_id,
        surviving_parcel_id=row.id,
        surviving_lot_no=row.lot_no,
        merged_lot_no=payload.lot_no,
        merged_weight=payload.opening_weight_carats or 0,
        merged_purchase_cost_inr=payload.purchase_cost_inr_amount or 0,
        merged_purchase_cost_usd=payload.purchase_cost_usd_amount or 0,
        merged_asking_inr=payload.asking_inr_amount or 0,
        merged_asking_usd=payload.asking_usd_amount or 0,
        merged_purchase_price=payload.purchase_price or 0,
        merged_purchase_price_currency=payload.purchase_price_currency or "USD",
        merged_by_name=_actor_name(current_user),
    )
    db.add(log)

    # Apply merged values
    row.opening_weight_carats = preview.opening_weight_carats
    row.purchase_price = preview.purchase_price
    row.purchase_cost_inr_amount = preview.purchase_cost_inr_amount
    row.purchase_cost_usd_amount = preview.purchase_cost_usd_amount
    row.purchase_cost_inr_carat = preview.purchase_cost_inr_carat
    row.purchase_cost_usd_carat = preview.purchase_cost_usd_carat
    row.asking_inr_amount = preview.asking_inr_amount
    row.asking_usd_amount = preview.asking_usd_amount
    row.asking_price_inr_carats = preview.asking_price_inr_carats
    row.asking_price_usd_carats = preview.asking_price_usd_carats

    if source_row:
        await db.delete(source_row)

    await db.commit()
    await db.refresh(row)
    return ParcelMasterOut.model_validate(row)


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
    """Undo a merge: restore the absorbed parcel and subtract its values from the surviving one."""
    log = (await db.execute(
        select(ParcelMergeLog).where(
            ParcelMergeLog.id == log_id,
            ParcelMergeLog.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merge log entry not found")

    surviving = (await db.execute(
        select(ParcelMaster).where(
            ParcelMaster.id == log.surviving_parcel_id,
            ParcelMaster.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not surviving:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Surviving parcel no longer exists")

    # Check lot uniqueness before restoring
    existing_lot = (await db.execute(
        select(ParcelMaster.id).where(
            ParcelMaster.company_id == current_user.company_id,
            func.lower(ParcelMaster.lot_no) == log.merged_lot_no.strip().lower(),
        )
    )).scalar_one_or_none()
    if existing_lot:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot restore merged lot '{log.merged_lot_no}' — a parcel with that lot number already exists.",
        )

    # Subtract merged values from surviving
    old_total_w = surviving.opening_weight_carats or 0
    merged_w = log.merged_weight or 0
    new_w = max(0.0, old_total_w - merged_w)

    surviving.opening_weight_carats = round(new_w, 4)
    surviving.purchase_cost_inr_amount = round(max(0.0, (surviving.purchase_cost_inr_amount or 0) - (log.merged_purchase_cost_inr or 0)), 2)
    surviving.purchase_cost_usd_amount = round(max(0.0, (surviving.purchase_cost_usd_amount or 0) - (log.merged_purchase_cost_usd or 0)), 2)
    surviving.asking_inr_amount = round(max(0.0, (surviving.asking_inr_amount or 0) - (log.merged_asking_inr or 0)), 2)
    surviving.asking_usd_amount = round(max(0.0, (surviving.asking_usd_amount or 0) - (log.merged_asking_usd or 0)), 2)

    if new_w > 0:
        surviving.purchase_cost_inr_carat = round(surviving.purchase_cost_inr_amount / new_w, 2)
        surviving.purchase_cost_usd_carat = round(surviving.purchase_cost_usd_amount / new_w, 2)
        surviving.asking_price_inr_carats = round(surviving.asking_inr_amount / new_w, 2)
        surviving.asking_price_usd_carats = round(surviving.asking_usd_amount / new_w, 2)
        old_price = surviving.purchase_price or 0
        merged_price = log.merged_purchase_price or 0
        surviving.purchase_price = round(
            ((old_price * old_total_w) - (merged_price * merged_w)) / new_w, 2
        )
    else:
        surviving.purchase_cost_inr_carat = 0
        surviving.purchase_cost_usd_carat = 0
        surviving.asking_price_inr_carats = 0
        surviving.asking_price_usd_carats = 0

    # Remove the merge description line
    merge_line_prefix = f"[Merged from Lot#{log.merged_lot_no}:"
    if surviving.description:
        lines = [ln for ln in surviving.description.split("\n") if not ln.strip().startswith(merge_line_prefix)]
        surviving.description = "\n".join(lines).strip() or None

    # Restore the absorbed parcel
    restored = ParcelMaster(
        company_id=current_user.company_id,
        lot_no=log.merged_lot_no,
        item_name=surviving.item_name,
        shape=surviving.shape,
        color=surviving.color,
        clarity=surviving.clarity,
        size=surviving.size,
        sieve_mm=surviving.sieve_mm,
        stock_group_id=surviving.stock_group_id,
        stock_type=surviving.stock_type,
        stock_subtype=surviving.stock_subtype,
        grown_process_type=surviving.grown_process_type,
        opening_weight_carats=round(merged_w, 4),
        purchase_price=round(log.merged_purchase_price or 0, 2),
        purchase_price_currency=log.merged_purchase_price_currency or "USD",
        purchase_cost_inr_amount=round(log.merged_purchase_cost_inr or 0, 2),
        purchase_cost_usd_amount=round(log.merged_purchase_cost_usd or 0, 2),
        purchase_cost_inr_carat=round((log.merged_purchase_cost_inr or 0) / merged_w, 2) if merged_w > 0 else 0,
        purchase_cost_usd_carat=round((log.merged_purchase_cost_usd or 0) / merged_w, 2) if merged_w > 0 else 0,
        asking_inr_amount=round(log.merged_asking_inr or 0, 2),
        asking_usd_amount=round(log.merged_asking_usd or 0, 2),
        asking_price_inr_carats=round((log.merged_asking_inr or 0) / merged_w, 2) if merged_w > 0 else 0,
        asking_price_usd_carats=round((log.merged_asking_usd or 0) / merged_w, 2) if merged_w > 0 else 0,
        description=f"[Restored via unmerge from Lot#{log.surviving_lot_no}]",
        created_by_name=_actor_name(current_user),
    )
    db.add(restored)
    await db.delete(log)

    await db.commit()
    await db.refresh(surviving)
    return ParcelMasterOut.model_validate(surviving)


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
