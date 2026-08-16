from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
import os
import shutil
import uuid
import re
from datetime import datetime
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from auth import router as auth_router, get_current_user

app = FastAPI()
app.include_router(auth_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import time
from collections import defaultdict
from fastapi import Request
from fastapi.responses import JSONResponse

# Simple memory rate limiter (use Redis for cluster/multi-process)
RATE_LIMIT_DURATION = 60
RATE_LIMIT_REQUESTS = 100
ip_requests = defaultdict(list)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.headers.get("X-Forwarded-For", request.client.host)
    now = time.time()
    ip_requests[client_ip] = [t for t in ip_requests[client_ip] if now - t < RATE_LIMIT_DURATION]
    if len(ip_requests[client_ip]) >= RATE_LIMIT_REQUESTS:
        return JSONResponse(status_code=429, content={"detail": "Too Many Requests"})
    ip_requests[client_ip].append(now)
    return await call_next(request)

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 5 * 1024 * 1024 # 5MB

# Supabase init
from supabase import create_client, Client
supa_url: str = os.environ.get("SUPABASE_URL", "")
supa_key: str = os.environ.get("SUPABASE_KEY", "")
supabase: Client = create_client(supa_url, supa_key) if supa_url and supa_key else None

import threading

embedding_model = None
embedding_lock = threading.Lock()

def get_embedding_model():
    global embedding_model
    with embedding_lock:
        if embedding_model is None:
            from fastembed import TextEmbedding
            # This downloads the model on first run, which can take a few seconds
            embedding_model = TextEmbedding("sentence-transformers/all-MiniLM-L6-v2")
    return embedding_model

def clean_markdown(text: str) -> str:
    # Basic cleaning: remove excessive empty lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def process_pdf_background(document_id: str, physical_name: str):
    path = UPLOAD_DIR / physical_name
    try:
        import pymupdf4llm
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        
        # 1. Hybrid Extraction: Markdown + PyMuPDF in one shot!
        # pymupdf4llm natively preserves layout and returns page numbers.
        md_chunks = pymupdf4llm.to_markdown(path, page_chunks=True)
        
        # 2. Clean & Split
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
        final_chunks = []
        chunk_idx = 0
        
        for page in md_chunks:
            page_num = page.get("metadata", {}).get("page_number", 1)
            raw_text = page.get("text", "")
            cleaned = clean_markdown(raw_text)
            
            if not cleaned: continue
            
            splits = text_splitter.split_text(cleaned)
            for split in splits:
                final_chunks.append({
                    "document_id": document_id,
                    "content": split,
                    "page_number": page_num,
                    "chunk_index": chunk_idx
                })
                chunk_idx += 1
                
        # 3. Embedding
        if not supabase:
            raise Exception("Supabase not configured")
        
        if not final_chunks:
            raise Exception("PDF tidak berisi teks yang dapat dibaca (mungkin gambar hasil scan tanpa OCR).")
            
        model = get_embedding_model()
        contents = [c["content"] for c in final_chunks]
        embeddings = [e.tolist() for e in model.embed(contents)]
        
        for i, chunk in enumerate(final_chunks):
            chunk["embedding"] = embeddings[i]
            
        # 4. Save to Supabase (pgvector)
        # Make sure you've run the supabase_setup.sql script!
        supabase.table("document_chunks").insert(final_chunks).execute()
            
        # 5. Update Status
        supabase.table("documents").update({"status": "ready", "page_count": len(md_chunks), "chunk_count": len(final_chunks)}).eq("id", document_id).execute()
            
    except Exception as e:
        error_msg = str(e)
        if 'SUPABASE' in error_msg.upper() or 'KEY' in error_msg.upper():
            error_msg = 'Terjadi kesalahan internal saat memproses dokumen.'
            
        if supabase:
            supabase.table("documents").update({
                "status": "failed",
                "error_message": error_msg
            }).eq("id", document_id).execute()
        print("Background Error:", e)

@app.post("/api/upload")
async def upload_pdf(
    file: UploadFile = File(...), 
    folder_id: str = Form(None),
    bg_tasks: BackgroundTasks = BackgroundTasks(),
    user_id: str = Depends(get_current_user)
):
    if file.content_type != "application/pdf" or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    header = await file.read(4)
    if header != b"%PDF":
        raise HTTPException(status_code=400, detail="Invalid PDF format")
    
    await file.seek(0)
    file.file.seek(0, 2)
    size = file.file.tell()
    await file.seek(0)
    
    if size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
        
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    if folder_id and folder_id.strip():
        check_folder = supabase.table("folders").select("id").eq("id", folder_id.strip()).eq("user_id", user_id).execute()
        if not check_folder.data:
            raise HTTPException(status_code=400, detail="Folder tidak valid.")

    document_id = str(uuid.uuid4())
    physical_name = f"{document_id}.pdf"
    path = UPLOAD_DIR / physical_name
    now = datetime.utcnow().isoformat()

    try:
        with path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        supabase.table("documents").insert({
            "id": document_id,
            "original_name": file.filename,
            "physical_name": physical_name,
            "status": "processing",
            "category": None,
            "folder_id": folder_id.strip() if folder_id and folder_id.strip() else None,
            "uploaded_at": now,
            "user_id": user_id,
            "error_message": None
        }).execute()
    except Exception:
        if path.exists():
            path.unlink()
        raise HTTPException(status_code=500, detail="Gagal menyimpan dokumen.")
        
    # Queue background task for PDF processing
    bg_tasks.add_task(process_pdf_background, document_id, physical_name)
        
    return {
        "message": "File uploaded, processing started", 
        "document_id": document_id,
        "original_name": file.filename,
        "status": "processing",
        "category": "Uncategorized",
        "uploaded_at": now
    }

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "supabase": supabase is not None}

@app.post("/api/documents/{document_id}/retry")
async def retry_processing(
    document_id: str, 
    bg_tasks: BackgroundTasks, 
    user_id: str = Depends(get_current_user)
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    doc = supabase.table("documents").select("*").eq("id", document_id).eq("user_id", user_id).execute()
    if not doc.data:
        raise HTTPException(status_code=403, detail="Not authorized or document not found")
        
    doc_data = doc.data[0]
    if doc_data.get("status") != "failed":
        raise HTTPException(status_code=400, detail="Only failed documents can be retried")
        
    physical_name = doc_data.get("physical_name")
    path = UPLOAD_DIR / physical_name
    if not path.exists():
        raise HTTPException(status_code=400, detail="File asli sudah dihapus setelah pemrosesan pertama. Silakan upload ulang dokumen.")
        
    try:
        supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
        supabase.table("documents").update({
            "status": "processing",
            "error_message": None
        }).eq("id", document_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    bg_tasks.add_task(process_pdf_background, document_id, physical_name)
    return {"message": "Retry processing started", "document_id": document_id, "status": "processing"}

@app.get("/api/documents")
async def get_documents(user_id: str = Depends(get_current_user)):
    if not supabase: return {"documents": [], "stats": {"total":0,"processing":0,"ready":0,"failed":0}}
    res = supabase.table("documents").select("*").eq("user_id", user_id).order("uploaded_at", desc=True).execute()
    docs = res.data
    
    total = len(docs)
    processing = sum(1 for d in docs if d.get("status") == "processing")
    ready = sum(1 for d in docs if d.get("status") == "ready")
    failed = sum(1 for d in docs if d.get("status") == "failed")
    
    return {
        "documents": docs,
        "stats": {"total": total, "processing": processing, "ready": ready, "failed": failed}
    }

class FavoriteRequest(BaseModel):
    is_favorite: bool

@app.patch("/api/documents/{document_id}/favorite")
async def toggle_favorite(document_id: str, req: FavoriteRequest, user_id: str = Depends(get_current_user)):
    if not supabase: raise HTTPException(status_code=500, detail="Supabase not configured")
    check = supabase.table("documents").select("id").eq("id", document_id).eq("user_id", user_id).execute()
    if not check.data: raise HTTPException(status_code=403, detail="Not authorized")
    try:
        res = supabase.table("documents").update({"is_favorite": req.is_favorite}).eq("id", document_id).execute()
        return {"message": "Success", "is_favorite": req.is_favorite}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

class FolderCreate(BaseModel):
    name: str

@app.get("/api/folders")
async def get_folders(user_id: str = Depends(get_current_user)):
    if not supabase: return []
    res = supabase.table("folders").select("*").eq("user_id", user_id).order("created_at").execute()
    return res.data

@app.post("/api/folders")
async def create_folder(req: FolderCreate, user_id: str = Depends(get_current_user)):
    if not supabase: raise HTTPException(status_code=500, detail="Supabase not configured")
    if not req.name.strip(): raise HTTPException(status_code=400, detail="Name cannot be empty")
    if len(req.name) > 80: raise HTTPException(status_code=400, detail="Name too long")
    
    check_dup = supabase.table("folders").select("id").eq("user_id", user_id).ilike("name", req.name.strip()).execute()
    if check_dup.data:
        raise HTTPException(status_code=400, detail="Folder dengan nama tersebut sudah ada.")
        
    res = supabase.table("folders").insert({
        "name": req.name.strip(),
        "user_id": user_id
    }).execute()
    return res.data[0]

@app.put("/api/folders/{folder_id}")
async def rename_folder(folder_id: str, req: FolderCreate, user_id: str = Depends(get_current_user)):
    if not supabase: raise HTTPException(status_code=500, detail="Supabase not configured")
    if not req.name.strip(): raise HTTPException(status_code=400, detail="Name cannot be empty")
    if len(req.name) > 80: raise HTTPException(status_code=400, detail="Name too long")
    
    check = supabase.table("folders").select("id").eq("id", folder_id).eq("user_id", user_id).execute()
    if not check.data: raise HTTPException(status_code=403, detail="Not authorized")
    
    check_dup = supabase.table("folders").select("id").eq("user_id", user_id).ilike("name", req.name.strip()).execute()
    if check_dup.data and check_dup.data[0]["id"] != folder_id:
        raise HTTPException(status_code=400, detail="Folder dengan nama tersebut sudah ada.")
        
    res = supabase.table("folders").update({"name": req.name.strip()}).eq("id", folder_id).execute()
    return res.data[0]

@app.delete("/api/folders/{folder_id}")
async def delete_folder(folder_id: str, user_id: str = Depends(get_current_user)):
    if not supabase: raise HTTPException(status_code=500, detail="Supabase not configured")
    
    check = supabase.table("folders").select("id").eq("id", folder_id).eq("user_id", user_id).execute()
    if not check.data: raise HTTPException(status_code=403, detail="Not authorized")
    
    supabase.table("documents").update({"folder_id": None}).eq("folder_id", folder_id).eq("user_id", user_id).execute()
    supabase.table("folders").delete().eq("id", folder_id).eq("user_id", user_id).execute()
    return {"message": "Deleted"}

class MoveDocumentRequest(BaseModel):
    folder_id: str = None

@app.patch("/api/documents/{document_id}/folder")
async def move_document(document_id: str, req: MoveDocumentRequest, user_id: str = Depends(get_current_user)):
    if not supabase: raise HTTPException(status_code=500, detail="Supabase not configured")
    check = supabase.table("documents").select("id").eq("id", document_id).eq("user_id", user_id).execute()
    if not check.data: raise HTTPException(status_code=403, detail="Not authorized")
    
    folder_val = req.folder_id if req.folder_id and req.folder_id.strip() else None
    if folder_val:
        check_folder = supabase.table("folders").select("id").eq("id", folder_val).eq("user_id", user_id).execute()
        if not check_folder.data:
            raise HTTPException(status_code=400, detail="Folder tidak valid.")
            
    res = supabase.table("documents").update({"folder_id": folder_val}).eq("id", document_id).execute()
    return res.data[0]

@app.get("/api/documents/{document_id}")
async def get_document(document_id: str, user_id: str = Depends(get_current_user)):
    if not supabase: raise HTTPException(status_code=500, detail="Supabase not configured")
    res = supabase.table("documents").select("*").eq("id", document_id).eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return res.data[0]

@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: str, user_id: str = Depends(get_current_user)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    # Verify ownership
    doc = supabase.table("documents").select("id, physical_name").eq("id", document_id).eq("user_id", user_id).execute()
    if not doc.data:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    try:
        supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
        supabase.table("documents").delete().eq("id", document_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    path = UPLOAD_DIR / doc.data[0]["physical_name"]
    if path.exists():
        path.unlink()

    return {"message": "Deleted successfully"}

class ChatRequest(BaseModel):
    query: str
    document_id: str # Added document_id to filter chat by document

@app.post("/api/chat")
async def chat_with_docs(req: ChatRequest, user_id: str = Depends(get_current_user)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    # Verify ownership & readiness
    doc = supabase.table("documents").select("id, status").eq("id", req.document_id).eq("user_id", user_id).execute()
    if not doc.data:
        raise HTTPException(status_code=403, detail="Dokumen tidak ditemukan atau tidak ada akses.")
    if doc.data[0].get("status") != "ready":
        raise HTTPException(status_code=400, detail="Dokumen belum siap (status: {}).".format(doc.data[0].get("status")))
        
    if len(req.query.strip()) > 1000:
        raise HTTPException(status_code=400, detail="Pertanyaan terlalu panjang (maksimal 1000 karakter).")
        
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="Groq API key not configured")
        
    from groq import Groq
    client = Groq(api_key=groq_api_key)
    
    # 1. Embed query
    try:
        model = get_embedding_model()
        query_emb = list(model.embed([req.query]))[0].tolist()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses pertanyaan (Embedding error): {str(e)}")
    
    # 2. Search relevant chunks via Supabase RPC
    try:
        response = supabase.rpc("match_document_chunks", {
            "query_embedding": query_emb,
            "match_threshold": 0.3,
            "match_count": 5,
            "filter_document_id": req.document_id
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mencari dokumen di database: {str(e)}")
    
    chunks = response.data
    if not chunks:
        return {"answer": "Maaf, saya tidak menemukan informasi terkait di dokumen Anda.", "sources": []}
        
    # 3. Context Builder (Limit characters to avoid token bloat)
    context_text = "\n\n".join([f"[Page {c['page_number']}] {c['content']}" for c in chunks])
    context_text = context_text[:12000] # Safe limit for Llama-3 (approx 3000 tokens)
    sources = [{"page": c['page_number'], "snippet": c['content'][:300]} for c in chunks]
    
    system_prompt = f"Anda adalah asisten virtual yang HANYA menjawab berdasarkan konteks dokumen berikut. JANGAN gunakan pengetahuan di luar konteks. Jika jawabannya tidak ada di dalam konteks, katakan dengan jujur bahwa informasinya tidak tersedia di dokumen.\n\nKonteks Dokumen:\n{context_text}"
    
    # 4. LLM Generation
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.query}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.1,
            max_tokens=1000
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal menghubungi server AI (Groq error): {str(e)}")
    
    return {
        "answer": chat_completion.choices[0].message.content,
        "sources": sources
    }
