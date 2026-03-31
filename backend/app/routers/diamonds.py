from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from app.database import get_db
from app.auth import get_current_user
from app.models.models import User, Diamond
from app.schemas import DiamondSearchRequest, DiamondSearchResponse, DiamondOut

router = APIRouter(prefix="/api/diamonds", tags=["diamonds"])


# ── Sorting map ────────────────────────────────────────
SORT_MAP = {
    "LAB-Shape-Size-Color-Clarity-LotNo": [Diamond.lab, Diamond.shape, Diamond.carats.desc(), Diamond.color, Diamond.clarity, Diamond.lot_no],
    "LAB-Shape-Color-Size-Clarity-LotNo": [Diamond.lab, Diamond.shape, Diamond.color, Diamond.carats.desc(), Diamond.clarity, Diamond.lot_no],
    "LAB-Shape-Size-Clarity-Color-LotNo": [Diamond.lab, Diamond.shape, Diamond.carats.desc(), Diamond.clarity, Diamond.color, Diamond.lot_no],
    "Shape-LAB-Size-Color-Clarity-LotNo": [Diamond.shape, Diamond.lab, Diamond.carats.desc(), Diamond.color, Diamond.clarity, Diamond.lot_no],
    "Shape-LAB-Color-Size-Clarity-LotNo": [Diamond.shape, Diamond.lab, Diamond.color, Diamond.carats.desc(), Diamond.clarity, Diamond.lot_no],
    "Shape-LAB-Size-Clarity-Color-LotNo": [Diamond.shape, Diamond.lab, Diamond.carats.desc(), Diamond.clarity, Diamond.color, Diamond.lot_no],
    "Shape-Size-Clarity-Color-LotNo": [Diamond.shape, Diamond.carats.desc(), Diamond.clarity, Diamond.color, Diamond.lot_no],
    "Shape-Size-Color-Clarity-LotNo": [Diamond.shape, Diamond.carats.desc(), Diamond.color, Diamond.clarity, Diamond.lot_no],
    "Shape-Size-Color-Clarity-Cut-Polish-Sym-Fl": [Diamond.shape, Diamond.carats.desc(), Diamond.color, Diamond.clarity, Diamond.cut, Diamond.polish, Diamond.symmetry, Diamond.fluorescence],
    "Kapan-LotNo": [Diamond.kapan_no, Diamond.lot_no],
    "ItemCode": [Diamond.item_code],
    "ItemSerialNo": [Diamond.item_serial_no],
    "StoneStatus-LotNo": [Diamond.status, Diamond.lot_no],
    "SizeWise": [Diamond.carats.desc()],
    "Size-Color-Clarity-Lotno": [Diamond.carats.desc(), Diamond.color, Diamond.clarity, Diamond.lot_no],
    "ItemGroupWise": [Diamond.item_group, Diamond.lot_no],
    "Shape-Size-Clarity-Color": [Diamond.shape, Diamond.carats.desc(), Diamond.clarity, Diamond.color],
}


def _build_filters(req: DiamondSearchRequest, company_id):
    """Build SQLAlchemy filter conditions from search request."""
    filters = [Diamond.company_id == company_id]

    # Show filter
    if req.show == "Sold":
        filters.append(Diamond.is_sold == True)
    elif req.show == "Unsold":
        filters.append(Diamond.is_sold == False)

    # Hold status
    if req.hold_status == "Hold":
        filters.append(Diamond.hold_status == "Hold")
    elif req.hold_status == "Unhold":
        filters.append(Diamond.hold_status == "Unhold")

    # Stone type
    if req.stone_type == "Single":
        filters.append(Diamond.stone_type == "Single")
    elif req.stone_type == "Parcel":
        filters.append(Diamond.stone_type == "Parcel")

    # Status
    status_map = {
        "OnHand": ["OnHand"],
        "OnMemo": ["OnMemo"],
        "OnHand&Int.Memo": ["OnHand", "IntMemo"],
        "OnHand + Memo In": ["OnHand", "MemoIn"],
        "OnHand + Party Hold": ["OnHand", "PartyHold"],
        "Memo In": ["MemoIn"],
        "Party Hold": ["PartyHold"],
    }
    if req.status and req.status != "All":
        if req.status == "All - Party Hold":
            filters.append(Diamond.status != "PartyHold")
        elif req.status in status_map:
            filters.append(Diamond.status.in_(status_map[req.status]))

    # Stock till date
    if req.stock_till_date:
        filters.append(Diamond.entry_date <= req.stock_till_date)

    # Identifier search
    if req.search_field_type and req.search_field_value:
        val = req.search_field_value.strip()
        field_map = {
            "LotNo": Diamond.lot_no,
            "LotNo Not": Diamond.lot_no,
            "LotNo Like": Diamond.lot_no,
            "CertNo": Diamond.cert_no,
            "CertNo Not": Diamond.cert_no,
            "SrNo": Diamond.sr_no,
            "SrNo Not": Diamond.sr_no,
            "KapanNo": Diamond.kapan_no,
            "KapanNo Not": Diamond.kapan_no,
            "Packet Number": Diamond.packet_no,
            "PacketNo Not": Diamond.packet_no,
        }
        col = field_map.get(req.search_field_type)
        if col is not None:
            values = [v.strip() for v in val.split(",") if v.strip()]
            if "Not" in req.search_field_type:
                filters.append(col.notin_(values))
            elif "Like" in req.search_field_type:
                like_clauses = [col.ilike(f"%{v}%") for v in values]
                filters.append(or_(*like_clauses))
            else:
                filters.append(col.in_(values))

    # Multi-select specs
    if req.shapes:
        filters.append(Diamond.shape.in_(req.shapes))
    if req.color_groups:
        filters.append(Diamond.color_group.in_(req.color_groups))
    if req.colors:
        filters.append(Diamond.color.in_(req.colors))
    if req.clarities:
        filters.append(Diamond.clarity.in_(req.clarities))
    if req.cuts:
        filters.append(Diamond.cut.in_(req.cuts))
    if req.polishes:
        filters.append(Diamond.polish.in_(req.polishes))
    if req.symmetries:
        filters.append(Diamond.symmetry.in_(req.symmetries))
    if req.labs:
        filters.append(Diamond.lab.in_(req.labs))
    if req.fluorescences:
        filters.append(Diamond.fluorescence.in_(req.fluorescences))
    if req.fl_colors:
        filters.append(Diamond.fl_color.in_(req.fl_colors))
    if req.milky_values:
        filters.append(Diamond.milky.in_(req.milky_values))
    if req.shades:
        filters.append(Diamond.shade.in_(req.shades))

    # Numeric ranges
    range_fields = [
        ("carats_from", "carats_to", Diamond.carats),
        ("back_pct_from", "back_pct_to", Diamond.back_pct),
        ("price_from", "price_to", Diamond.total_price),
        ("length_from", "length_to", Diamond.length),
        ("width_from", "width_to", Diamond.width),
        ("depth_from", "depth_to", Diamond.depth),
        ("depth_pct_from", "depth_pct_to", Diamond.depth_pct),
        ("table_pct_from", "table_pct_to", Diamond.table_pct),
        ("lw_ratio_from", "lw_ratio_to", Diamond.lw_ratio),
        ("crown_angle_from", "crown_angle_to", Diamond.crown_angle),
        ("crown_height_from", "crown_height_to", Diamond.crown_height),
        ("pavilion_angle_from", "pavilion_angle_to", Diamond.pavilion_angle),
        ("pavilion_height_from", "pavilion_height_to", Diamond.pavilion_height),
    ]
    for from_attr, to_attr, col in range_fields:
        from_val = getattr(req, from_attr)
        to_val = getattr(req, to_attr)
        if from_val is not None:
            filters.append(col >= from_val)
        if to_val is not None:
            filters.append(col <= to_val)

    # Lot no range (string comparison)
    if req.lot_no_from:
        filters.append(Diamond.lot_no >= req.lot_no_from)
    if req.lot_no_to:
        filters.append(Diamond.lot_no <= req.lot_no_to)

    # Date search
    if req.date_type and req.date_from:
        date_col_map = {
            "Purchase": Diamond.purchase_date,
            "LabIn": Diamond.lab_in_date,
            "LabOut": Diamond.lab_out_date,
            "Status": Diamond.status_date,
            "Entry": Diamond.entry_date,
        }
        date_col = date_col_map.get(req.date_type)
        if date_col is not None:
            if req.date_from:
                filters.append(date_col >= req.date_from)
            if req.date_to:
                filters.append(date_col <= req.date_to)

    return filters


@router.post("/search", response_model=DiamondSearchResponse)
async def search_diamonds(
    req: DiamondSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = _build_filters(req, current_user.company_id)

    # Count total
    count_q = select(func.count(Diamond.id)).where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0

    # Build query
    query = select(Diamond).where(and_(*filters))

    # Sorting
    sort_cols = SORT_MAP.get(req.sort_by)
    if sort_cols:
        query = query.order_by(*sort_cols)
    else:
        query = query.order_by(Diamond.lot_no)

    # Pagination
    offset = (req.page - 1) * req.page_size
    query = query.offset(offset).limit(req.page_size)

    result = await db.execute(query)
    diamonds = result.scalars().all()

    return DiamondSearchResponse(
        total=total,
        page=req.page,
        page_size=req.page_size,
        results=[DiamondOut.model_validate(d) for d in diamonds],
    )


@router.get("/filter-options")
async def get_filter_options(
    current_user: User = Depends(get_current_user),
):
    """Return all filter dropdown values for the frontend."""
    return {
        "shapes": ["BR", "PR", "PR1", "RBC", "EM", "EMA", "Square Emerald", "Square EmeraldA", "PRN", "MQ", "AS",
                    "Tapered Baguette", "Tapered Bullet", "Pear", "Calf", "Briolette", "Bullets", "CB",
                    "Cushion Modified", "EuropeanCut", "Epaulette", "Flanders", "Half Moon", "HE", "Hexagonal",
                    "Kite", "Lozenge", "Octagonal", "OV", "Pentagonal", "RA", "Square Radiant", "Rose", "Shield",
                    "Square", "Star", "Testa", "TAPP/BUGG", "dd", "PB"],
        "color_groups": ["D", "DEF", "GH", "IJ", "KLMN", "MIX"],
        "colors": ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "MIX"],
        "size_ranges": ["10.00 UP", "5.00 UP", "4.50 UP", "4.00 UP", "3.50 UP", "3.00 UP", "2.70 UP", "2.50 UP",
                        "2.30 UP", "2.00 UP", "1.90 UP", "1.80 UP", "1.70 UP", "1.60 UP", "1.50 UP", "1.40 UP",
                        "1.30 UP", "1.20 UP", "1.00 UP", "0.90 UP", "0.80 UP", "0.70 UP", "0.60 UP", "0.50 UP",
                        "0.40 UP", "0.30 UP", "0.23 UP", "0.18 UP"],
        "clarities": ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "SI3", "I1", "I2", "I3"],
        "cuts": ["I", "EX", "VG", "G", "F"],
        "polishes": ["I", "EX", "VG-VX", "VG", "G-VG", "G", "F-G", "F", "P"],
        "symmetries": ["I", "EX", "VG-VX", "VG", "G-VG", "G", "F-G", "F", "P", "j"],
        "labs": ["GIA", "AGS", "CGL", "DCLA", "GCAL", "GSI", "HRD", "IGI", "NGTC", "None", "Other", "PGS",
                 "VGR", "RDC", "RDR", "GHI", "DBIOD", "SGL", "GL"],
        "fluorescences": ["VS", "S", "M", "F", "SL", "N"],
        "fl_colors": ["B", "W", "Y", "O", "R", "G"],
        "milky_values": ["None", "M1", "M2", "M3"],
        "shades": ["None", "White", "Yellow", "Brown", "Green", "Grey", "Black", "Pink", "Blue", "Mixed",
                   "Faint Brown", "Faint Green", "Other"],
        "statuses": ["All", "OnHand", "OnMemo", "OnHand&Int.Memo", "OnHand + Memo In", "OnHand + Party Hold",
                     "Memo In", "Party Hold", "All - Party Hold"],
        "sort_options": list(SORT_MAP.keys()),
        "search_field_types": ["LotNo", "LotNo Not", "LotNo Like", "CertNo", "CertNo Not", "SrNo", "SrNo Not",
                               "KapanNo", "KapanNo Not", "Packet Number", "PacketNo Not"],
    }
