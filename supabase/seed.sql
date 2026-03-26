insert into users (id, email, display_name, timezone)
values (
  '11111111-1111-1111-1111-111111111111',
  'demo@tinyhabit.dev',
  'Demo User',
  'Asia/Seoul'
)
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  timezone = excluded.timezone;

insert into anchors (id, user_id, label, cue, preferred_time)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'After coffee',
  'When the mug is on the desk',
  'morning'
)
on conflict (id) do nothing;

insert into goals (id, user_id, anchor_id, title, why, difficulty, available_minutes, status)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Build a reading habit',
  'I want reading to feel normal again.',
  'gentle',
  5,
  'active'
)
on conflict (id) do nothing;

insert into habit_plans (id, goal_id, version, source, status, notes)
values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  1,
  'seed',
  'active',
  'Local development seed plan.'
)
on conflict (id) do nothing;

insert into micro_actions (
  id,
  plan_id,
  position,
  title,
  details,
  duration_minutes,
  fallback_title,
  fallback_details,
  fallback_duration_minutes
)
values
(
  '55555555-5555-5555-5555-555555555551',
  '44444444-4444-4444-4444-444444444444',
  1,
  'Read one page',
  'Open the book and read exactly one page.',
  2,
  'Read one sentence',
  'If even one page feels big, read a single sentence.',
  1
),
(
  '55555555-5555-5555-5555-555555555552',
  '44444444-4444-4444-4444-444444444444',
  2,
  'Highlight one useful line',
  'Mark one line that stands out while reading.',
  2,
  'Touch the book cover',
  'Just pick up the book and put it back down.',
  1
),
(
  '55555555-5555-5555-5555-555555555553',
  '44444444-4444-4444-4444-444444444444',
  3,
  'Set out tomorrow''s book',
  'Place the book where you will see it tomorrow morning.',
  1,
  'Put the book on the desk',
  'Move it into sight and stop there.',
  1
)
on conflict (id) do nothing;

insert into daily_actions (
  id,
  goal_id,
  plan_id,
  micro_action_id,
  action_date,
  status
)
values (
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555551',
  current_date,
  'pending'
)
on conflict (goal_id, action_date) do nothing;

insert into action_logs (
  id,
  daily_action_id,
  user_id,
  log_type,
  status_to,
  metadata
)
values (
  '77777777-7777-7777-7777-777777777777',
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  'assigned',
  'pending',
  jsonb_build_object('seeded', true)
)
on conflict (id) do nothing;

insert into weekly_reviews (
  id,
  user_id,
  goal_id,
  week_start,
  completed_days,
  skipped_days,
  failed_days,
  best_streak,
  difficult_moments,
  helpful_pattern,
  next_adjustment,
  summary
)
values (
  '88888888-8888-8888-8888-888888888888',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  date_trunc('week', current_date)::date,
  3,
  2,
  1,
  2,
  'Late-night reading was harder than expected.',
  'Leaving the book on the desk reduced friction.',
  'Shrink the first action to one sentence on busy days.',
  'Small visibility cues made the habit easier to restart.'
)
on conflict (user_id, goal_id, week_start) do update set
  completed_days = excluded.completed_days,
  skipped_days = excluded.skipped_days,
  failed_days = excluded.failed_days,
  best_streak = excluded.best_streak,
  difficult_moments = excluded.difficult_moments,
  helpful_pattern = excluded.helpful_pattern,
  next_adjustment = excluded.next_adjustment,
  summary = excluded.summary;

insert into subscriptions (
  id,
  user_id,
  provider,
  plan_name,
  status
)
values (
  '99999999-9999-9999-9999-999999999999',
  '11111111-1111-1111-1111-111111111111',
  'stripe',
  'free',
  'free'
)
on conflict (id) do nothing;

insert into notifications (
  id,
  user_id,
  goal_id,
  channel,
  status,
  scheduled_for,
  title,
  body,
  metadata
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'in_app',
  'queued',
  timezone('utc', now()) + interval '1 day',
  'Tomorrow''s tiny step',
  'Your next action is ready when you are.',
  jsonb_build_object('seeded', true)
)
on conflict (id) do nothing;
