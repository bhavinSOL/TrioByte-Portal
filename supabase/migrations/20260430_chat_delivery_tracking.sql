-- Add missing columns to chat_messages for voice notes and delivery tracking
alter table public.chat_messages
add column if not exists file_url text,
add column if not exists file_type text,
add column if not exists file_size_mb decimal(5, 2),
add column if not exists is_delivered boolean default true,
add column if not exists read_at timestamptz;

-- Create index for faster queries
create index if not exists idx_chat_messages_recipient_unread
on public.chat_messages(recipient_id)
where is_read = false;
