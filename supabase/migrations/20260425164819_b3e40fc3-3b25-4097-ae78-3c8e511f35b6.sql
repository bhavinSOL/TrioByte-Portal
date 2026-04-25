
-- Roles enum
create type public.app_role as enum ('employee', 'hr_admin', 'founder');

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  employee_id text unique,
  company_id text,
  address text,
  mobile text,
  photo_url text,
  level int not null default 1,
  joining_date date,
  end_date date,
  is_permanent boolean not null default false,
  must_change_password boolean not null default true,
  is_blocked boolean not null default false,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- User roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security definer role check
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Helper: is staff (hr_admin or founder)
create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('hr_admin','founder')
  )
$$;

-- Profiles policies
create policy "Authenticated can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Staff can update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create policy "Staff can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.is_staff(auth.uid()) or auth.uid() = id);

-- User roles policies
create policy "Authenticated can view roles"
  on public.user_roles for select
  to authenticated
  using (true);

create policy "Staff can manage roles"
  on public.user_roles for insert
  to authenticated
  with check (public.is_staff(auth.uid()));

create policy "Staff can update roles"
  on public.user_roles for update
  to authenticated
  using (public.is_staff(auth.uid()));

create policy "Staff can delete roles"
  on public.user_roles for delete
  to authenticated
  using (public.is_staff(auth.uid()));

-- Updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Auto-create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, true)
  );

  insert into public.user_roles (user_id, role)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'employee'::public.app_role)
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent blocking the founder
create or replace function public.prevent_founder_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_blocked = true and public.has_role(new.id, 'founder') then
    raise exception 'Founder/CEO cannot be blocked';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_founder_block
  before update on public.profiles
  for each row execute function public.prevent_founder_block();
