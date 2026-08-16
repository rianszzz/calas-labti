-- DocuChat Schema Migration (idempotent - safe to re-run)
-- Run this in Supabase SQL Editor

-- Extensions
create extension if not exists vector;

-- Folders must exist before documents because documents.folder_id references it.
create table if not exists folders (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    user_id text not null,
    created_at timestamp with time zone default now()
);

-- Documents table
create table if not exists documents (
    id uuid primary key,
    original_name text not null,
    physical_name text not null,
    status text not null default 'processing',
    category text,
    folder_id uuid references folders(id) on delete set null,
    uploaded_at timestamp with time zone default now(),
    user_id text,
    error_message text,
    is_favorite boolean default false,
    page_count integer,
    chunk_count integer
);

-- Document chunks with vector embeddings
create table if not exists document_chunks (
    id bigserial primary key,
    document_id uuid not null references documents(id) on delete cascade,
    content text not null,
    page_number integer,
    chunk_index integer,
    embedding vector(384),
    user_id text
);

-- Add columns if they don't exist (for existing installations)
do $$ begin
  alter table documents add column if not exists folder_id uuid references folders(id) on delete set null;
  alter table documents add column if not exists is_favorite boolean default false;
  alter table documents add column if not exists error_message text;
  alter table documents add column if not exists page_count integer;
  alter table documents add column if not exists chunk_count integer;
  alter table documents add column if not exists user_id text;
  alter table document_chunks add column if not exists user_id text;
exception when others then null;
end $$;

-- Indexes
create index if not exists idx_documents_user_uploaded on documents(user_id, uploaded_at desc);
create index if not exists idx_documents_user_folder on documents(user_id, folder_id);
create index if not exists idx_folders_user_name on folders(user_id, name);
create index if not exists idx_chunks_document on document_chunks(document_id);
create index if not exists idx_chunks_vector on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RPC function for similarity search
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

-- RLS: disabled for backend service_role key access
-- If using anon key, enable RLS and create policies
alter table documents disable row level security;
alter table document_chunks disable row level security;
alter table folders disable row level security;
