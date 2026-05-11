-- Attendance records table
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  login_time timestamptz,
  logout_time timestamptz,
  status text default 'absent', -- 'present', 'absent', 'half_day', 'leave'
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- Leave requests table
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  leave_type text not null, -- 'sick', 'casual', 'urgent', 'other'
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending', -- 'pending', 'approved', 'rejected'
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tasks table
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  assigned_to uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium', -- 'low', 'medium', 'high', 'urgent'
  status text not null default 'open', -- 'open', 'in_progress', 'completed', 'cancelled'
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User preferences table
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  theme text default 'system', -- 'light', 'dark', 'system'
  notifications_enabled boolean default true,
  email_notifications boolean default true,
  timezone text default 'UTC',
  work_start_time time default '09:00',
  work_end_time time default '18:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;
alter table public.tasks enable row level security;
alter table public.user_preferences enable row level security;

-- Attendance policies
create policy "Users can view their own attendance"
  on public.attendance for select
  to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

create policy "Users can insert their own attendance"
  on public.attendance for insert
  to authenticated
  with check (auth.uid() = user_id or public.is_staff(auth.uid()));

create policy "Staff can update attendance"
  on public.attendance for update
  to authenticated
  using (public.is_staff(auth.uid()));

-- Leave request policies
create policy "Users can view leave requests"
  on public.leave_requests for select
  to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

create policy "Users can create leave requests"
  on public.leave_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Staff can update leave requests"
  on public.leave_requests for update
  to authenticated
  using (public.is_staff(auth.uid()));

-- Task policies
create policy "Users can view assigned tasks and created tasks"
  on public.tasks for select
  to authenticated
  using (auth.uid() = assigned_to or auth.uid() = created_by or public.is_staff(auth.uid()));

create policy "Staff can create tasks"
  on public.tasks for insert
  to authenticated
  with check (public.is_staff(auth.uid()));

create policy "Task creator and assignee can update"
  on public.tasks for update
  to authenticated
  using (auth.uid() = assigned_to or auth.uid() = created_by or public.is_staff(auth.uid()));

-- User preferences policies
create policy "Users can manage their own preferences"
  on public.user_preferences for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.user_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences for update
  to authenticated
  using (auth.uid() = user_id);

-- Updated_at triggers
create trigger attendance_updated_at
  before update on public.attendance
  for each row execute function public.update_updated_at_column();

create trigger leave_requests_updated_at
  before update on public.leave_requests
  for each row execute function public.update_updated_at_column();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.update_updated_at_column();

create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.update_updated_at_column();
