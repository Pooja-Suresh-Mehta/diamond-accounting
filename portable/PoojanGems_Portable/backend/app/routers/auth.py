from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import User, Company
from app.auth import verify_password, create_access_token
from app.schemas import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Find company
    result = await db.execute(
        select(Company).where(Company.name == req.company_name, Company.is_active == True)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid company name")

    # Find user
    result = await db.execute(
        select(User).where(
            User.company_id == company.id,
            User.username == req.username,
            User.is_active == True,
        )
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = create_access_token({
        "sub": str(user.id),
        "company_id": str(user.company_id),
        "role": user.role,
    })

    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            company_id=user.company_id,
            company_name=company.name,
        ),
    )
