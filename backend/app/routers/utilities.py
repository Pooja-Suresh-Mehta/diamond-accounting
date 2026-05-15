"""
Utilities (29-35) — File import/export, stock transfer, tally.
"""
import io
import csv
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import ParcelMaster, User

router = APIRouter(prefix="/api/utilities", tags=["utilities"])


# ── 29: Download MRP ──────────────────────────────────────

@router.get("/download-mrp")
async def download_mrp(
    format: str = Query(default="csv"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download current parcel stock as MRP price list."""
    rows = (await db.execute(
        select(ParcelMaster).where(ParcelMaster.company_id == current_user.company_id)
    )).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Lot #', 'Item', 'Shape', 'Color', 'Clarity', 'Size', 'Opening Weight', 'Rate/Ct USD', 'Asking USD'])
    for r in rows:
        writer.writerow([
            r.lot_no, r.item_name, r.shape, r.color, r.clarity, r.size,
            r.opening_weight_carats, r.asking_price_usd_carats, r.asking_usd_amount,
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.read().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mrp_pricelist.csv"},
    )


# ── 30: Import Grading ────────────────────────────────────

@router.post("/import-grading")
async def import_grading(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import grading data from CSV/Excel. Updates ParcelMaster records by lot_no."""
    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    skipped = 0
    for row in reader:
        lot_no = row.get("lot_no") or row.get("Lot #") or row.get("LOT_NO")
        if not lot_no:
            skipped += 1
            continue
        result = await db.execute(
            select(ParcelMaster).where(
                ParcelMaster.company_id == current_user.company_id,
                ParcelMaster.lot_no == lot_no,
            )
        )
        parcel = result.scalar_one_or_none()
        if not parcel:
            skipped += 1
            continue
        # Update grading fields if present in CSV
        for field, keys in [
            ("shape", ["shape", "Shape"]),
            ("color", ["color", "Color"]),
            ("clarity", ["clarity", "Clarity"]),
            ("size", ["size", "Size"]),
        ]:
            for key in keys:
                if key in row and row[key]:
                    setattr(parcel, field, row[key])
                    break
        imported += 1
    await db.commit()
    return {"imported": imported, "skipped": skipped}


# ── 31: Import Solitaire Price ────────────────────────────

@router.post("/import-solitaire-price")
async def import_solitaire_price(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import solitaire price list. Updates asking_price_usd_carats by lot_no."""
    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    updated = 0
    skipped = 0
    for row in reader:
        lot_no = row.get("lot_no") or row.get("Lot #") or row.get("LOT_NO")
        rate = row.get("rate") or row.get("Rate/Ct") or row.get("rate_usd")
        if not lot_no or not rate:
            skipped += 1
            continue
        result = await db.execute(
            select(ParcelMaster).where(
                ParcelMaster.company_id == current_user.company_id,
                ParcelMaster.lot_no == lot_no,
            )
        )
        parcel = result.scalar_one_or_none()
        if not parcel:
            skipped += 1
            continue
        parcel.asking_price_usd_carats = float(rate)
        # Note: asking_usd_amount is a manual field — update only if explicitly needed
        updated += 1
    await db.commit()
    return {"updated": updated, "skipped": skipped}


# ── 32: Get LAB Data ──────────────────────────────────────

@router.get("/lab-data")
async def get_lab_data(
    cert_no: str = Query(..., description="Certificate number"),
    current_user: User = Depends(get_current_user),
):
    """
    Stub for fetching grading lab data by certificate number.
    In production, integrate with GIA/IGI API.
    """
    # Stub response — replace with real API call (GIA, IGI, HRD)
    return {
        "cert_no": cert_no,
        "lab": "GIA",
        "shape": "Round",
        "carat": "1.00",
        "color": "F",
        "clarity": "VS1",
        "cut": "Excellent",
        "polish": "Excellent",
        "symmetry": "Excellent",
        "fluorescence": "None",
        "note": "Stub response — integrate with real LAB API",
    }


# ── 33: Stock Transfer ────────────────────────────────────

@router.post("/stock-transfer")
async def stock_transfer(
    from_lot: str = Form(...),
    to_lot: str = Form(...),
    weight: float = Form(...),
    pcs: Optional[int] = Form(default=0),
    narration: Optional[str] = Form(default=""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Stock transfer: validates both lots exist.
    Note: actual weight movement should be recorded via Sale (from source lot)
    and Purchase (into destination lot) entries so the stock report reflects it correctly.
    This endpoint is a dry-run/validation only.
    """
    from fastapi import HTTPException
    from_result = await db.execute(
        select(ParcelMaster).where(
            ParcelMaster.company_id == current_user.company_id,
            ParcelMaster.lot_no == from_lot,
        )
    )
    from_parcel = from_result.scalar_one_or_none()
    if not from_parcel:
        raise HTTPException(status_code=404, detail=f"Source lot '{from_lot}' not found")

    to_result = await db.execute(
        select(ParcelMaster).where(
            ParcelMaster.company_id == current_user.company_id,
            ParcelMaster.lot_no == to_lot,
        )
    )
    to_parcel = to_result.scalar_one_or_none()
    if not to_parcel:
        raise HTTPException(status_code=404, detail=f"Destination lot '{to_lot}' not found")

    return {
        "status": "validated",
        "message": f"To complete transfer of {weight}ct from Lot#{from_lot} to Lot#{to_lot}, create a Sale entry for the source lot and a Purchase entry for the destination lot.",
        "from_lot": from_lot,
        "to_lot": to_lot,
        "weight": weight,
    }


# ── 34: Convert Excel ─────────────────────────────────────

@router.post("/convert-excel")
async def convert_excel(
    file: UploadFile = File(...),
    conv_type: str = Form(default="parcel-import"),
    current_user: User = Depends(get_current_user),
):
    """
    Convert/validate an uploaded file and return row count.
    In production, use openpyxl to parse .xlsx and reformat.
    """
    content = await file.read()
    # Simple CSV passthrough for now
    try:
        text = content.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
        return {
            "status": "ok",
            "conv_type": conv_type,
            "rows_detected": len(rows),
            "columns": list(rows[0].keys()) if rows else [],
            "note": "File validated. Upload via the relevant import endpoint to import data.",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── 35: Stock Telly ───────────────────────────────────────

@router.get("/stock-telly")
async def stock_telly(
    as_of_date: Optional[date_type] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Stock reconciliation — see /api/parcel-reports/stock for full on-the-fly stock report
    including purchased/sold/memo/on-hand weights computed from transaction tables.
    """
    return {
        "note": "Use /api/parcel-reports/stock for the full stock report. Stock counters are now computed on-the-fly from transaction tables.",
        "as_of_date": str(as_of_date) if as_of_date else None,
    }
