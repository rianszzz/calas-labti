# DocuChat — Sistem Manajemen Dokumen Juri Rekrutmen

Aplikasi web untuk juri rekrutmen: upload PDF, kelompokkan ke folder, lalu tanya-jawab dengan AI berdasarkan isi dokumen.

## Arsitektur

```
Frontend (React + Vite + Tailwind)
    ↕ REST API
Backend (FastAPI)
    ↕
Supabase (PostgreSQL + pgvector)
    ↕
Groq LLM (llama-3.1-8b-instant)
```

### Alur Kerja
1. Juri login ke aplikasi
2. Buat folder untuk mengelompokkan dokumen (opsional)
3. Upload PDF (maks 5 MB)
4. Sistem memproses: ekstraksi teks → chunking → embedding → simpan ke pgvector
5. Setelah status "Ready", buka chat dan ajukan pertanyaan
6. AI menjawab berdasarkan isi dokumen dengan referensi halaman sumber

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Akun [Supabase](https://supabase.com) (free tier cukup)
- API key [Groq](https://console.groq.com)

### 1. Database (Supabase)

1. Buat project baru di Supabase
2. Buka SQL Editor
3. Jalankan `backend/migrations/001_schema.sql`

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Buat file `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
GROQ_API_KEY=your-groq-api-key
FRONTEND_URL=http://localhost:5173
```

> **Catatan**: Gunakan **service_role key** (bukan anon key) karena RLS dinonaktifkan untuk akses backend.

Jalankan:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opsional: buat `.env` untuk override API URL:
```env
VITE_API_URL=http://localhost:8000/api
```

## Kredensial Demo

Untuk review internal, gunakan:
- **Username**: `user`
- **Password**: `123`

## Environment Variables

| Variable | Lokasi | Keterangan |
|----------|--------|------------|
| `SUPABASE_URL` | backend/.env | URL project Supabase |
| `SUPABASE_KEY` | backend/.env | Service role key Supabase |
| `GROQ_API_KEY` | backend/.env | API key Groq |
| `FRONTEND_URL` | backend/.env | URL frontend untuk CORS |
| `VITE_API_URL` | frontend/.env | URL API backend (opsional) |

## Batasan Saat Ini

- **PDF scan/gambar**: Dokumen hasil scan tanpa OCR tidak dapat diekstrak teksnya
- **Autentikasi**: Menggunakan token demo statis untuk keperluan review internal
- **File storage**: PDF disimpan di disk lokal server, bukan cloud storage
- **Single user**: Semua data terikat pada satu user demo
