import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Set, Optional
import redis.asyncio as aioredis
from apps.api.src.config import get_settings

logger = logging.getLogger("mosaic.presence")
settings = get_settings()

# In-memory presence cache fallback for test/dev without Redis
_memory_presence: Dict[str, Dict[str, dict]] = {}  # space_id -> {session_id: {user_id, display_name, expires_at}}


class PresenceService:
    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None

    async def get_redis(self) -> Optional[aioredis.Redis]:
        if not settings.ENABLE_REDIS_PRESENCE:
            return None
        if self._redis is None:
            try:
                self._redis = aioredis.from_url(settings.REDIS_URL, socket_timeout=1.0)
                await self._redis.ping()
            except (Exception, asyncio.CancelledError):
                self._redis = None
            except BaseException:
                self._redis = None
        return self._redis

    async def register_session(
        self,
        space_id: str,
        session_id: str,
        user_id: str,
        display_name: str,
        ttl_seconds: int = 120,
    ) -> None:
        """Register presence lease on initial Space subscription."""
        now = datetime.now(timezone.utc)
        payload = json.dumps({
            "session_id": session_id,
            "user_id": user_id,
            "display_name": display_name,
            "last_seen": now.isoformat(),
        })

        # 1. Update in-memory presence
        if space_id not in _memory_presence:
            _memory_presence[space_id] = {}
        _memory_presence[space_id][session_id] = {
            "session_id": session_id,
            "user_id": user_id,
            "display_name": display_name,
            "expires_at": now.timestamp() + ttl_seconds,
        }

        # 2. Update Redis only if explicitly enabled
        redis_client = await self.get_redis()
        if redis_client:
            try:
                key = f"space:{space_id}:presence:{session_id}"
                await redis_client.set(key, payload, ex=ttl_seconds)
                await redis_client.sadd(f"space:{space_id}:sessions", session_id)
            except (Exception, asyncio.CancelledError):
                pass
            except BaseException:
                pass

    async def heartbeat(
        self,
        space_id: str,
        session_id: str,
        user_id: Optional[str] = None,
        display_name: Optional[str] = None,
        ttl_seconds: int = 120,
    ) -> None:
        """
        Refresh presence lease.
        Does NOT execute SADD on periodic heartbeats and does NOT read Redis.
        """
        now = datetime.now(timezone.utc)

        # 1. Refresh in-memory lease
        if space_id in _memory_presence and session_id in _memory_presence[space_id]:
            _memory_presence[space_id][session_id]["expires_at"] = now.timestamp() + ttl_seconds
        elif user_id and display_name:
            if space_id not in _memory_presence:
                _memory_presence[space_id] = {}
            _memory_presence[space_id][session_id] = {
                "session_id": session_id,
                "user_id": user_id,
                "display_name": display_name,
                "expires_at": now.timestamp() + ttl_seconds,
            }

        # 2. In Redis, only refresh key expiration TTL; do NOT call SADD
        redis_client = await self.get_redis()
        if redis_client:
            try:
                key = f"space:{space_id}:presence:{session_id}"
                await redis_client.expire(key, ttl_seconds)
            except (Exception, asyncio.CancelledError):
                pass
            except BaseException:
                pass

    async def remove_session(self, space_id: str, session_id: str) -> None:
        """Remove session presence lease on WebSocket disconnect."""
        if space_id in _memory_presence:
            _memory_presence[space_id].pop(session_id, None)

        redis_client = await self.get_redis()
        if redis_client:
            try:
                await redis_client.delete(f"space:{space_id}:presence:{session_id}")
                await redis_client.srem(f"space:{space_id}:sessions", session_id)
            except (Exception, asyncio.CancelledError):
                pass
            except BaseException:
                pass

    async def get_active_users(self, space_id: str) -> Set[str]:
        """Returns set of user_ids currently present in Space."""
        # 1. Primary: Check in-memory connection manager
        from apps.api.src.services.activity import connection_manager
        active_from_cm = connection_manager.get_active_user_ids(space_id)
        if active_from_cm:
            return set(active_from_cm)

        # 2. Check in-memory fallback
        now = datetime.now(timezone.utc).timestamp()
        active_user_ids: Set[str] = set()
        if space_id in _memory_presence:
            for s_id, record in list(_memory_presence[space_id].items()):
                if record["expires_at"] > now:
                    active_user_ids.add(record["user_id"])
                else:
                    _memory_presence[space_id].pop(s_id, None)
        if active_user_ids:
            return active_user_ids

        # 3. Check Redis if enabled
        redis_client = await self.get_redis()
        if redis_client:
            try:
                sessions = await redis_client.smembers(f"space:{space_id}:sessions")
                for s in sessions:
                    s_id = s.decode("utf-8") if isinstance(s, bytes) else s
                    val = await redis_client.get(f"space:{space_id}:presence:{s_id}")
                    if val:
                        data = json.loads(val)
                        active_user_ids.add(data["user_id"])
                    else:
                        await redis_client.srem(f"space:{space_id}:sessions", s)
                return active_user_ids
            except Exception as exc:
                logger.debug(f"Redis presence read error: {exc}")

        return active_user_ids


presence_service = PresenceService()
