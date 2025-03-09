# backend/app/api/documents.py
from fastapi import APIRouter, UploadFile, File, Depends
from app.db.vector_store import VectorStoreManager
from app.services.document_service import DocumentProcessor

router = APIRouter(prefix="/documents", tags=["documents"])
document_processor = DocumentProcessor()
vector_store = VectorStoreManager()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload a document to the knowledge base"""
    # Save uploaded file temporarily
    file_path = f"temp/{file.filename}"
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # Process document
    documents = document_processor.load_and_split(file_path)
    
    # Add to vector store
    vector_store.add_documents(documents)
    
    return {"status": "success", "message": f"Added {len(documents)} chunks to knowledge base"}
