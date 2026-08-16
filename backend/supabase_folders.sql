-- Run this in your Supabase SQL Editor to support dynamic folders

create table if not exists folders (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    user_id text not null,
    created_at timestamp with time zone default now()
);

alter table folders disable row level security;
alter table folders enable row level security; -- Or matching your current RLS strategy

alter table documents add column if not exists folder_id uuid references folders(id) on delete set null;
