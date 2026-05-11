-- Temporarily disable RLS to debug the issue
alter table public.projects disable row level security;
alter table public.project_members disable row level security;
alter table public.project_timeline disable row level security;
