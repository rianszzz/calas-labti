-- Run this in your Supabase SQL Editor
alter table documents add column if not exists is_favorite boolean default false;
