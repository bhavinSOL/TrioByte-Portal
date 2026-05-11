-- Attendance auto-logout management
-- This migration enables automatic logout at end of working day

-- Add a column to track if auto-logout was applied
alter table public.attendance
add column if not exists auto_logged_out boolean default false;

-- Create a function to automatically log out users at end of working hours
create or replace function auto_logout_end_of_day()
returns void as $$
declare
  v_record record;
  v_end_time timestamptz;
  v_work_end text;
begin
  -- Find all active sessions (no logout_time) for today
  for v_record in 
    select 
      a.id,
      a.user_id,
      a.date,
      a.login_time,
      up.work_end_time
    from public.attendance a
    left join public.user_preferences up on a.user_id = up.user_id
    where a.date = current_date::date
    and a.logout_time is null
  loop
    -- Get work end time (default to 18:00)
    v_work_end := coalesce(v_record.work_end_time, '18:00');
    
    -- Create end of day timestamp
    v_end_time := (v_record.date || ' ' || v_work_end)::timestamptz at time zone 'UTC';
    
    -- If current time is past end time, log them out
    if now() >= v_end_time then
      update public.attendance
      set 
        logout_time = v_end_time,
        auto_logged_out = true,
        updated_at = now()
      where id = v_record.id;
    end if;
  end loop;
end;
$$ language plpgsql;

-- Create a scheduled job to run auto-logout (should be scheduled via pg_cron or external scheduler)
-- For now, this is called from the application every minute

-- Enable RLS for the new column (no changes needed, inherits from attendance table)
