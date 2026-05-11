-- Projects table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'planning', -- 'planning', 'in_progress', 'completed', 'on_hold'
  start_date date,
  end_date date,
  budget decimal(12, 2),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Project members table
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null, -- 'lead', 'developer', 'designer', 'qa', 'manager', etc.
  responsibility text,
  allocation_percentage int default 100, -- 0-100% time allocation
  joined_date date not null default now(),
  left_date date,
  status text default 'active', -- 'active', 'inactive', 'removed'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- Project timeline/activity log
create table public.project_timeline (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  activity_type text not null, -- 'member_added', 'member_removed', 'role_changed', 'status_changed', 'comment'
  description text,
  member_id uuid references auth.users(id),
  changed_by uuid not null references auth.users(id),
  metadata jsonb, -- Store old/new values for changes
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_timeline enable row level security;

-- Projects RLS policies
create policy "Users can view projects they're part of"
  on public.projects for select
  to authenticated
  using (
    created_by = auth.uid() or
    public.is_staff(auth.uid()) or
    exists (
      select 1 from public.project_members
      where project_id = id and user_id = auth.uid()
    )
  );

create policy "Staff can create projects"
  on public.projects for insert
  to authenticated
  with check (public.is_staff(auth.uid()));

create policy "Project creator and staff can update"
  on public.projects for update
  to authenticated
  using (created_by = auth.uid() or public.is_staff(auth.uid()));

-- Project members RLS policies
create policy "Users can view project members"
  on public.project_members for select
  to authenticated
  using (
    public.is_staff(auth.uid()) or
    exists (
      select 1 from public.projects p
      where p.id = project_id and (p.created_by = auth.uid())
    ) or
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_id and pm.user_id = auth.uid()
    )
  );

create policy "Project creator can manage members"
  on public.project_members for insert
  to authenticated
  with check (
    public.is_staff(auth.uid()) or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  );

create policy "Project creator can update members"
  on public.project_members for update
  to authenticated
  using (
    public.is_staff(auth.uid()) or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  );

-- Project timeline RLS policies
create policy "Users can view project timeline"
  on public.project_timeline for select
  to authenticated
  using (
    public.is_staff(auth.uid()) or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    ) or
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_id and pm.user_id = auth.uid()
    )
  );

create policy "System can create timeline entries"
  on public.project_timeline for insert
  to authenticated
  with check (true);

-- Updated_at triggers
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at_column();

create trigger project_members_updated_at
  before update on public.project_members
  for each row execute function public.update_updated_at_column();
