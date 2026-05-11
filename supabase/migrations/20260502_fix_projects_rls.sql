-- Simplified RLS policies for projects
drop policy if exists "Users can view projects they're part of" on public.projects;
drop policy if exists "Staff can create projects" on public.projects;
drop policy if exists "Project creator and staff can update" on public.projects;

-- New simplified policies
create policy "Anyone can view projects"
  on public.projects for select
  to authenticated
  using (true);

create policy "Staff can create projects"
  on public.projects for insert
  to authenticated
  with check (public.is_staff(auth.uid()));

create policy "Creator and staff can update projects"
  on public.projects for update
  to authenticated
  using (created_by = auth.uid() or public.is_staff(auth.uid()));

-- Simplified project_members policies
drop policy if exists "Users can view project members" on public.project_members;
drop policy if exists "Project creator can manage members" on public.project_members;
drop policy if exists "Project creator can update members" on public.project_members;

create policy "Anyone can view project members"
  on public.project_members for select
  to authenticated
  using (true);

create policy "Staff can manage project members"
  on public.project_members for insert
  to authenticated
  with check (public.is_staff(auth.uid()));

create policy "Staff can update project members"
  on public.project_members for update
  to authenticated
  using (public.is_staff(auth.uid()));
