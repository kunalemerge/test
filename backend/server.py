from fastapi import FastAPI, HTTPException, Query, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional
import uvicorn
import os
import logging
from pathlib import Path
import uuid
from datetime import datetime

# /backend 
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models
class NoteBase(BaseModel):
    title: str
    content: str
    tags: Optional[List[str]] = []

class NoteCreate(NoteBase):
    pass

class Note(NoteBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Routes
@app.get("/api")
async def root():
    return {"message": "Notes API is running"}

@app.get("/api/notes", response_model=List[Note])
async def get_notes(
    search: Optional[str] = Query(None, description="Search in title and content"),
    tag: Optional[str] = Query(None, description="Filter by tag")
):
    query = {}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}}
        ]
    if tag:
        query["tags"] = tag
    
    notes = await db.notes.find(query).sort("updated_at", -1).to_list(1000)
    
    # Convert MongoDB _id to string id
    for note in notes:
        note["id"] = str(note.pop("_id"))
    
    return notes

@app.get("/api/notes/{note_id}", response_model=Note)
async def get_note(note_id: str):
    note = await db.notes.find_one({"_id": note_id})
    if note:
        note["id"] = str(note.pop("_id"))
        return note
    raise HTTPException(status_code=404, detail="Note not found")

@app.post("/api/notes", response_model=Note)
async def create_note(note: NoteCreate):
    now = datetime.utcnow()
    new_note = {
        "_id": str(uuid.uuid4()),
        **note.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    
    await db.notes.insert_one(new_note)
    
    # Convert MongoDB _id to string id for response
    result = dict(new_note)
    result["id"] = result.pop("_id")
    
    return result

@app.put("/api/notes/{note_id}", response_model=Note)
async def update_note(note_id: str, note_update: NoteBase):
    existing = await db.notes.find_one({"_id": note_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Note not found")
    
    update_data = {
        **note_update.model_dump(),
        "updated_at": datetime.utcnow()
    }
    
    await db.notes.update_one(
        {"_id": note_id},
        {"$set": update_data}
    )
    
    updated_note = await db.notes.find_one({"_id": note_id})
    updated_note["id"] = str(updated_note.pop("_id"))
    
    return updated_note

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str):
    result = await db.notes.delete_one({"_id": note_id})
    if result.deleted_count:
        return {"message": "Note deleted successfully"}
    raise HTTPException(status_code=404, detail="Note not found")

@app.get("/api/tags")
async def get_tags():
    # Get all unique tags used in the database
    all_tags = await db.notes.distinct("tags")
    return {"tags": all_tags}

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
