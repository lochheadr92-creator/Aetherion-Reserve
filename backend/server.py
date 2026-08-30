from fastapi import FastAPI, APIRouter, HTTPException
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
async def list_saves() -> List[Dict[str, Any]]:
    docs = await db.saves.find({}, {"_id": 0, "state": 0}).sort("updated_at", -1).to_list(50)
    return docs


@api_router.get("/saves/{save_id}")
async def get_save(save_id: str) -> Dict[str, Any]:
    doc = await db.saves.find_one({"id": save_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Save not found")
    return doc


@api_router.post("/saves", response_model=SaveMeta)
async def create_save(payload: SaveCreate) -> Dict[str, Any]:
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
    }
    await db.saves.insert_one(dict(doc))
    doc.pop("state")
    doc.pop("_id", None)
    return doc


@api_router.put("/saves/{save_id}", response_model=SaveMeta)
async def update_save(save_id: str, payload: SaveCreate) -> Dict[str, Any]:
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
    result = await db.saves.update_one({"id": save_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Save not found")
    return {"id": save_id, **{k: v for k, v in update.items() if k != "state"}}


@api_router.delete("/saves/{save_id}")
async def delete_save(save_id: str) -> Dict[str, str]:
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
