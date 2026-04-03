from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.auth import get_current_user
from app.models.models import User, Diamond, Office
from app.schemas import DashboardStats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cid = current_user.company_id

    # Total stones & carats & value
    result = await db.execute(
        select(
            func.count(Diamond.id),
            func.coalesce(func.sum(Diamond.carats), 0),
            func.coalesce(func.sum(Diamond.total_price), 0),
        ).where(Diamond.company_id == cid)
    )
    total_stones, total_carats, total_value = result.one()

    # Status counts
    on_hand = (await db.execute(
        select(func.count(Diamond.id)).where(Diamond.company_id == cid, Diamond.status == "OnHand")
    )).scalar() or 0

    on_memo = (await db.execute(
        select(func.count(Diamond.id)).where(Diamond.company_id == cid, Diamond.status == "OnMemo")
    )).scalar() or 0

    sold = (await db.execute(
        select(func.count(Diamond.id)).where(Diamond.company_id == cid, Diamond.is_sold == True)
    )).scalar() or 0

    offices = (await db.execute(
        select(func.count(Office.id)).where(Office.company_id == cid, Office.is_active == True)
    )).scalar() or 0

    return DashboardStats(
        total_stones=total_stones,
        total_carats=float(total_carats),
        total_value=float(total_value),
        on_hand=on_hand,
        on_memo=on_memo,
        sold=sold,
        offices=offices,
    )
