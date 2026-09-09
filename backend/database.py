import asyncio
from typing import AsyncGenerator, Dict, List, Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import OperationalError

from backend.utils.config import settings
from backend.utils.logger import logger

# ---------------------------------------------------------
# Database Engine & Session setup
# ---------------------------------------------------------

db_url = settings.DATABASE_URL
engine = None

try:
    if db_url.startswith("sqlite"):
        engine = create_engine(
            db_url,
            connect_args={"check_same_thread": False},
        )
    else:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
        # Test connection
        with engine.connect() as conn:
            pass
    logger.info(f"Database engine initialized with URL: {db_url.split('@')[-1]}")
except Exception as e:
    logger.warning(f"Could not connect to configured DB ({e}). Falling back to SQLite.")
    fallback_url = "sqlite:///./quantum_route_ai.db"
    engine = create_engine(fallback_url, connect_args={"check_same_thread": False})
    logger.info("Fallback SQLite database initialized successfully.")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency for obtaining a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------
# Redis Client & In-Memory Fallback Pub/Sub
# ---------------------------------------------------------

class InMemoryPubSub:
    """Zero-dependency in-memory pub/sub message broadcaster for local development."""

    def __init__(self):
        self.subscribers: Dict[str, List[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def publish(self, channel: str, message: str) -> int:
        async with self._lock:
            queues = self.subscribers.get(channel, [])
            count = len(queues)
            for q in queues:
                await q.put(message)
            return count

    async def subscribe(self, channel: str) -> asyncio.Queue:
        async with self._lock:
            if channel not in self.subscribers:
                self.subscribers[channel] = []
            queue = asyncio.Queue()
            self.subscribers[channel].append(queue)
            return queue

    async def unsubscribe(self, channel: str, queue: asyncio.Queue):
        async with self._lock:
            if channel in self.subscribers and queue in self.subscribers[channel]:
                self.subscribers[channel].remove(queue)


class RedisClientWrapper:
    """Unified client that bridges Redis with transparent in-memory fallback."""

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis = None
        self.in_memory = InMemoryPubSub()
        self.using_fallback = True

    async def connect(self):
        try:
            import redis.asyncio as aioredis
            self.redis = aioredis.from_url(self.redis_url, decode_responses=True)
            await self.redis.ping()
            self.using_fallback = False
            logger.info(f"Connected to Redis at {self.redis_url}")
        except Exception as e:
            self.using_fallback = True
            logger.info(f"Redis unavailable ({e}). Using in-memory pub/sub fallback.")

    async def publish(self, channel: str, message: str) -> int:
        if not self.using_fallback and self.redis:
            try:
                return await self.redis.publish(channel, message)
            except Exception as e:
                logger.warning(f"Redis publish failed ({e}), falling back to in-memory.")
        return await self.in_memory.publish(channel, message)

    async def subscribe(self, channel: str):
        if not self.using_fallback and self.redis:
            try:
                pubsub = self.redis.pubsub()
                await pubsub.subscribe(channel)
                return pubsub
            except Exception as e:
                logger.warning(f"Redis subscribe failed ({e}), falling back to in-memory.")
        return await self.in_memory.subscribe(channel)

    async def close(self):
        if self.redis:
            await self.redis.close()


redis_wrapper = RedisClientWrapper(settings.REDIS_URL)
