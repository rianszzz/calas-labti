-- Run this in your Supabase SQL Editor

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Create the document_chunks table
create table if not exists document_chunks (
    id bigserial primary key,
    document_id uuid not null,
    content text not null,
    page_number integer,
    chunk_index integer,
    embedding vector(384) -- 384 dimensions for all-MiniLM-L6-v2
);

-- 3. Create index for fast vector search (optional but recommended)
create index on document_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- 4. Create RPC function for similarity search
create or replace function match_document_chunks (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter_document_id uuid default null
)
returns table (
  id bigint,
  document_id uuid,
  content text,
  page_number integer,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    document_chunks.page_number,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
    and (filter_document_id is null or document_chunks.document_id = filter_document_id)
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- 5. Disable RLS (if you are using anon key in backend)
alter table document_chunks disable row level security;

-- 6. Create documents table (migrating from SQLite)
create table if not exists documents (
    id uuid primary key,
    original_name text not null,
    physical_name text not null,
    status text not null,
    category text,
    uploaded_at timestamp with time zone default now()
);

-- Turn off RLS for documents just like chunks (for server-side access)
alter table documents disable row level security;

-- 7. Add user_id for multi-tenancy
alter table documents add column user_id text;
alter table document_chunks add column user_id text;

-- Enable RLS (Optional, since backend service_role bypasses it anyway)
alter table documents enable row level security;
alter table document_chunks enable row level security;

-- 8. Add error_message for processing failure visibility
alter table documents add column error_message text;
