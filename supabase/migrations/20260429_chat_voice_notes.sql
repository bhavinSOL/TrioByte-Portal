-- Add file_url and file_type columns to chat_messages for voice notes
alter table public.chat_messages add column file_url text;
alter table public.chat_messages add column file_type text; -- 'voice', 'document', etc.
alter table public.chat_messages add column file_size_mb decimal(5, 2);

-- Create storage bucket for chat files if not exists
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', true)
on conflict (id) do nothing;

-- Enable RLS on storage.objects (already enabled by default)

-- Create policy for chat file uploads
create policy "Users can upload chat files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-files');

-- Create policy for users to view chat files
create policy "Users can view chat files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chat-files');

-- Create policy for users to delete their own chat files
create policy "Users can delete their chat files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chat-files' and auth.uid()::text = (storage.foldername(name))[1]);
