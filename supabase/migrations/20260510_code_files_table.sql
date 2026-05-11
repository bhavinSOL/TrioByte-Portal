-- Code files table (stores file metadata for commits)
create table public.code_files (
  id uuid primary key default gen_random_uuid(),
  commit_id uuid not null references public.code_commits(id) on delete cascade,
  file_path text not null,
  content text,
  content_hash text,
  file_size bigint,
  created_at timestamptz not null default now()
);

-- Enable RLS for code_files
alter table public.code_files enable row level security;

-- Code files policies
create policy "Users can view files"
  on public.code_files for select
  to authenticated
  using (true);

create policy "Users can insert files"
  on public.code_files for insert
  to authenticated
  with check (true);

-- Fix foreign keys to reference profiles instead of auth.users
alter table public.code_repos drop constraint code_repos_owner_id_fkey;
alter table public.code_repos add constraint code_repos_owner_id_fkey 
  foreign key (owner_id) references public.profiles(id) on delete cascade;

alter table public.code_commits drop constraint code_commits_author_id_fkey;
alter table public.code_commits add constraint code_commits_author_id_fkey 
  foreign key (author_id) references public.profiles(id) on delete cascade;

alter table public.merge_requests drop constraint merge_requests_author_id_fkey;
alter table public.merge_requests add constraint merge_requests_author_id_fkey 
  foreign key (author_id) references public.profiles(id) on delete cascade;

alter table public.merge_requests drop constraint merge_requests_reviewer_id_fkey;
alter table public.merge_requests add constraint merge_requests_reviewer_id_fkey 
  foreign key (reviewer_id) references public.profiles(id) on delete cascade;

-- Add files_changed column to merge_requests if it doesn't exist
alter table public.merge_requests add column if not exists files_changed integer default 0;

-- Create index for better query performance
create index if not exists idx_code_files_commit_id on public.code_files(commit_id);
create index if not exists idx_code_commits_repo_id on public.code_commits(repo_id);
create index if not exists idx_code_repos_owner_id on public.code_repos(owner_id);
