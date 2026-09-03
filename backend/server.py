from fastapi import FastAPI, APIRouter, HTTPException, Header, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Aetherion Reserve - Save Service")
api_router = APIRouter(prefix="/api")

# ---------- Save scoping (per-player token) ----------
# The browser generates a random UUID once (localStorage) and sends it as
# X-Player-Token. Saves are stored with that token as `owner`; list/get/update/
# delete are limited to the caller's own saves. Saves written before this scheme
# have no owner and stay visible to everyone (backward compatible).
PLAYER_HEADER = "X-Player-Token"
LIST_DEFAULT = 200
LIST_MAX = 200


def _owner_filter(token: Optional[str]) -> Dict[str, Any]:
    legacy = {"$or": [{"owner": None}, {"owner": {"$exists": False}}]}
    if not token:
        return legacy
    return {"$or": [{"owner": token}, {"owner": None}, {"owner": {"$exists": False}}]}


def _can_touch(doc: Dict[str, Any], token: Optional[str]) -> bool:
    owner = doc.get("owner")
    return owner is None or owner == token


@app.on_event("startup")
async def ensure_indexes() -> None:
    try:
        await db.saves.create_index("id", unique=True)
        await db.saves.create_index([("updated_at", -1)])
        await db.saves.create_index([("owner", 1), ("updated_at", -1)])
    except Exception as exc:  # index creation must never block the service
        logging.getLogger(__name__).warning("index creation skipped: %s", exc)


# ---------- Models ----------

class SaveMeta(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    park_name: str = "Unnamed Facility"
    mode: str = "management"
    day: int = 1
    cash: float = 0
    rating: float = 0
    creatures: int = 0
    updated_at: str


class SaveCreate(BaseModel):
    name: str
    park_name: str = "Unnamed Facility"
    mode: str = "management"
    day: int = 1
    cash: float = 0
    rating: float = 0
    creatures: int = 0
    state: Dict[str, Any]


class SaveFull(SaveMeta):
    state: Dict[str, Any]


# ---------- Routes ----------

@api_router.get("/")
async def root() -> Dict[str, str]:
    return {"message": "Aetherion Reserve save service online", "status": "ok"}


@api_router.get("/saves", response_model=List[SaveMeta])
async def list_saves(
    limit: int = Query(LIST_DEFAULT, ge=1, le=LIST_MAX),
    skip: int = Query(0, ge=0),
    x_player_token: Optional[str] = Header(None, alias=PLAYER_HEADER),
) -> List[Dict[str, Any]]:
    cursor = db.saves.find(_owner_filter(x_player_token), {"_id": 0, "state": 0}).sort("updated_at", -1).skip(skip)
    return await cursor.to_list(limit)


@api_router.get("/saves/{save_id}")
async def get_save(save_id: str, x_player_token: Optional[str] = Header(None, alias=PLAYER_HEADER)) -> Dict[str, Any]:
    doc = await db.saves.find_one({"id": save_id}, {"_id": 0})
    if not doc or not _can_touch(doc, x_player_token):
        raise HTTPException(status_code=404, detail="Save not found")
    return doc


@api_router.post("/saves", response_model=SaveMeta)
async def create_save(payload: SaveCreate, x_player_token: Optional[str] = Header(None, alias=PLAYER_HEADER)) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "park_name": payload.park_name,
        "mode": payload.mode,
        "day": payload.day,
        "cash": payload.cash,
        "rating": payload.rating,
        "creatures": payload.creatures,
        "state": payload.state,
        "updated_at": now,
        "owner": x_player_token or None,
    }
    await db.saves.insert_one(dict(doc))
    doc.pop("state")
    doc.pop("_id", None)
    return doc


@api_router.put("/saves/{save_id}", response_model=SaveMeta)
async def update_save(save_id: str, payload: SaveCreate, x_player_token: Optional[str] = Header(None, alias=PLAYER_HEADER)) -> Dict[str, Any]:
    existing = await db.saves.find_one({"id": save_id}, {"_id": 0, "owner": 1})
    if not existing or not _can_touch(existing, x_player_token):
        raise HTTPException(status_code=404, detail="Save not found")
    now = datetime.now(timezone.utc).isoformat()
    update = {
        "name": payload.name,
        "park_name": payload.park_name,
        "mode": payload.mode,
        "day": payload.day,
        "cash": payload.cash,
        "rating": payload.rating,
        "creatures": payload.creatures,
        "state": payload.state,
        "updated_at": now,
    }
    # a legacy (ownerless) save is adopted by the first player who writes to it
    if existing.get("owner") is None and x_player_token:
        update["owner"] = x_player_token
    result = await db.saves.update_one({"id": save_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Save not found")
    return {"id": save_id, **{k: v for k, v in update.items() if k not in ("state", "owner")}}


@api_router.delete("/saves/{save_id}")
async def delete_save(save_id: str, x_player_token: Optional[str] = Header(None, alias=PLAYER_HEADER)) -> Dict[str, str]:
    existing = await db.saves.find_one({"id": save_id}, {"_id": 0, "owner": 1})
    if not existing or not _can_touch(existing, x_player_token):
        raise HTTPException(status_code=404, detail="Save not found")
    result = await db.saves.delete_one({"id": save_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Save not found")
    return {"deleted": save_id}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    client.close()
