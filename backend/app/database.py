from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool
from app.config import get_settings

settings = get_settings()

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

connect_args = {}
engine_kwargs: dict = {}
if _is_sqlite:
    connect_args = {
        "check_same_thread": False,
        "timeout": 30,
    }
    # SQLite doesn't benefit from connection pooling; StaticPool uses a
    # single connection and avoids pool-exhaustion hangs entirely.
    engine_kwargs["poolclass"] = StaticPool

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args=connect_args,
    **engine_kwargs,
)

# Enable WAL mode for SQLite so reads don't block writes and vice versa
if _is_sqlite:
    from sqlalchemy import text

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
