-- Create storage bucket for profile photos
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload/update their own photo
create policy "Users can upload their own profile photo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-photos');

create policy "Users can update their own profile photo"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-photos');

-- Allow public to view profile photos
create policy "Profile photos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-photos');
