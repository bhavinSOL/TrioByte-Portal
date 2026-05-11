-- Payroll and Overtime records table
create table public.payroll (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  base_salary decimal(12, 2),
  overtime_hours decimal(5, 2) default 0,
  overtime_rate decimal(6, 2) default 1.5,
  bonus decimal(12, 2) default 0,
  deductions decimal(12, 2) default 0,
  total_salary decimal(12, 2),
  status text default 'draft', -- 'draft', 'finalized', 'paid'
  paid_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

-- Interns table
create table public.interns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  institution text,
  field_of_study text,
  start_date date not null,
  end_date date not null,
  mentor_id uuid references auth.users(id),
  status text default 'active', -- 'active', 'completed', 'on_leave'
  performance_rating int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chat messages table
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  room_id text, -- For group chats
  message text not null,
  is_read boolean default false,
  created_at timestamptz not null default now()
);

-- Chat rooms table
create table public.chat_rooms (
  id text primary key,
  name text not null,
  description text,
  is_direct boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Chat room members table
create table public.chat_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

-- Enable RLS
alter table public.payroll enable row level security;
alter table public.interns enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;

-- Payroll policies
create policy "Users can view their own payroll"
  on public.payroll for select
  to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

create policy "Staff can manage payroll"
  on public.payroll for insert
  to authenticated
  with check (public.is_staff(auth.uid()));

create policy "Staff can update payroll"
  on public.payroll for update
  to authenticated
  using (public.is_staff(auth.uid()));

-- Interns policies
create policy "Users can view intern info"
  on public.interns for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = mentor_id or public.is_staff(auth.uid()));

create policy "Staff can manage interns"
  on public.interns for insert
  to authenticated
  with check (public.is_staff(auth.uid()));

create policy "Staff can update interns"
  on public.interns for update
  to authenticated
  using (public.is_staff(auth.uid()));

-- Chat messages policies
create policy "Users can view their messages"
  on public.chat_messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send messages"
  on public.chat_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- Chat rooms policies
create policy "Users can create chat rooms"
  on public.chat_rooms for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Chat room members policies
create policy "Users can manage room members"
  on public.chat_room_members for insert
  to authenticated
  with check (true);

-- Updated_at triggers
create trigger payroll_updated_at
  before update on public.payroll
  for each row execute function public.update_updated_at_column();

create trigger interns_updated_at
  before update on public.interns
  for each row execute function public.update_updated_at_column();
