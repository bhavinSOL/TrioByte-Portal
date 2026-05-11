-- Code repositories table
create table public.code_repos (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  name text not null,
  description text,
  url text,
  language text,
  branch text default 'main',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Merge requests table
create table public.merge_requests (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references public.code_repos(id) on delete cascade,
  title text not null,
  description text,
  source_branch text not null,
  target_branch text not null,
  status text default 'open', -- 'open', 'merged', 'rejected', 'draft'
  author_id uuid not null references auth.users(id),
  reviewer_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Code commits table
create table public.code_commits (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references public.code_repos(id) on delete cascade,
  message text not null,
  author_id uuid not null references auth.users(id),
  branch text default 'main',
  hash text unique,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.code_repos enable row level security;
alter table public.merge_requests enable row level security;
alter table public.code_commits enable row level security;

-- Code repos policies
create policy "Users can view repos"
  on public.code_repos for select
  to authenticated
  using (true);

create policy "Users can create repos"
  on public.code_repos for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Repo owner can update"
  on public.code_repos for update
  to authenticated
  using (auth.uid() = owner_id or public.is_staff(auth.uid()));

-- Merge requests policies
create policy "Users can view merge requests"
  on public.merge_requests for select
  to authenticated
  using (true);

create policy "Users can create merge requests"
  on public.merge_requests for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Reviewers can update merge requests"
  on public.merge_requests for update
  to authenticated
  using (auth.uid() = reviewer_id or auth.uid() = author_id or public.is_staff(auth.uid()));

-- Code commits policies
create policy "Users can view commits"
  on public.code_commits for select
  to authenticated
  using (true);

create policy "Users can create commits"
  on public.code_commits for insert
  to authenticated
  with check (auth.uid() = author_id);

-- Updated_at triggers
create trigger code_repos_updated_at
  before update on public.code_repos
  for each row execute function public.update_updated_at_column();

create trigger merge_requests_updated_at
  before update on public.merge_requests
  for each row execute function public.update_updated_at_column();

-- Chat read receipts for message monitoring
alter table public.chat_messages add column if not exists is_read_by_admin boolean default false;

create policy "Staff can view all messages for monitoring"
  on public.chat_messages for select
  to authenticated
  using (public.is_staff(auth.uid()) or auth.uid() = sender_id or auth.uid() = recipient_id);

-- Update profiles to ensure block functionality exists
-- (is_blocked already exists from the initial migration)
