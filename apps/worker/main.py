import asyncio
import logging
from apps.worker.tasks.asset import inspect_asset, generate_thumbnail
from apps.worker.tasks.cleanup import cleanup_expired_invites, cleanup_expired_sessions

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mosaic.worker")


async def run_worker() -> None:
    logger.info("Mosaic Background Worker starting...")
    logger.info("Registered tasks: asset.inspect, asset.thumbnail, invite.cleanup, session.cleanup")
    try:
        while True:
            await asyncio.sleep(60)
            await cleanup_expired_sessions()
    except asyncio.CancelledError:
        logger.info("Worker shutdown requested.")


if __name__ == "__main__":
    asyncio.run(run_worker())
