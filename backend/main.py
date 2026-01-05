from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from lilypond import convert_to_lilypond

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Note(BaseModel):
    id: str
    types: List[str]
    duration: str
    isRest: bool

notes = []

@app.post("/api/notes")
async def create_note(note: Note):
    print(f"Received note: {note}")
    notes.append(note)
    print(f"Total notes: {len(notes)}")
    return {"message": "Note saved", "note": note}

@app.get("/api/notes")
async def get_notes():
    return notes

@app.delete("/api/notes")
async def clear_notes():
    notes.clear()
    return {"message": "All notes cleared"}

@app.get("/api/export")
async def export_pdf():
    
    pdf_bytes, error = await convert_to_lilypond(notes) 
    
    if error:
        return Response(content=error, status_code=500)
        
    return Response(content=pdf_bytes, media_type="application/pdf")