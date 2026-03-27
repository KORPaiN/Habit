-- Example follow-up migration file.
-- Use this pattern for future DB updates instead of editing production manually.

alter table notifications
add column if not exists is_read boolean not null default false;

create index if not exists notifications_user_id_is_read_idx
  on notifications (user_id, is_read, scheduled_for desc);
