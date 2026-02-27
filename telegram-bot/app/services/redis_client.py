import os
import redis.asyncio as redis
from dotenv import load_dotenv

load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST", "redis-cache")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

async def check_redis_connection():
    try:
        await redis_client.ping()
        print("✅ Успешное подключение к Redis.")
    except Exception as e:
        print(f"❌ Не удалось подключиться к Redis: {e}")