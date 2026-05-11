-- Add message status tracking columns
alter table public.chat_messages
add column is_delivered boolean default true,
add column is_read boolean default false,
add column read_at timestamptz;

-- Create index for faster queries
create index idx_chat_messages_recipient_unread
on public.chat_messages(recipient_id)
where is_read = false;
