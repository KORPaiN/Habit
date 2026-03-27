create extension if not exists pgcrypto;

create type difficulty_level as enum ('gentle', 'steady', 'hard');
create type preferred_time as enum ('morning', 'afternoon', 'evening');
create type goal_status as enum ('active', 'paused', 'completed', 'archived');
create type plan_source as enum ('ai', 'manual', 'recovery', 'seed');
create type plan_status as enum ('draft', 'active', 'archived');
create type daily_action_status as enum ('pending', 'completed', 'skipped', 'failed');
create type action_log_type as enum ('assigned', 'completed', 'failed', 'skipped', 'rescheduled');
create type failure_reason as enum ('too_big', 'too_tired', 'forgot', 'schedule_conflict', 'low_motivation', 'other');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'free');
create type notification_channel as enum ('email', 'push', 'in_app');
create type notification_status as enum ('queued', 'sent', 'failed', 'canceled');

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists users (
  id uuid primary key,
  email text not null unique,
  display_name text,
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists anchors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  label text not null,
  cue text not null,
  preferred_time preferred_time not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, label, cue)
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  anchor_id uuid references anchors(id) on delete set null,
  title text not null,
  why text,
  difficulty difficulty_level not null,
  available_minutes integer not null check (available_minutes between 1 and 30),
  status goal_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists habit_plans (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  version integer not null check (version > 0),
  source plan_source not null,
  status plan_status not null default 'active',
  based_on_plan_id uuid references habit_plans(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (goal_id, version)
);

create unique index if not exists habit_plans_one_active_per_goal_idx
  on habit_plans (goal_id)
  where status = 'active';

create table if not exists micro_actions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references habit_plans(id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  title text not null,
  details text,
  duration_minutes integer not null check (duration_minutes between 1 and 5),
  fallback_title text not null,
  fallback_details text,
  fallback_duration_minutes integer not null check (fallback_duration_minutes between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (plan_id, position)
);

create or replace function enforce_micro_action_limit()
returns trigger
language plpgsql
as $$
declare
  action_count integer;
begin
  select count(*)
  into action_count
  from micro_actions
  where plan_id = new.plan_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if action_count >= 3 then
    raise exception 'A plan can contain at most 3 micro-actions';
  end if;

  return new;
end;
$$;

create table if not exists daily_actions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  plan_id uuid not null references habit_plans(id) on delete cascade,
  micro_action_id uuid not null references micro_actions(id) on delete restrict,
  action_date date not null,
  status daily_action_status not null default 'pending',
  used_fallback boolean not null default false,
  notes text,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (goal_id, action_date)
);

create table if not exists action_logs (
  id uuid primary key default gen_random_uuid(),
  daily_action_id uuid not null references daily_actions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  log_type action_log_type not null,
  status_from daily_action_status,
  status_to daily_action_status,
  failure_reason failure_reason,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  week_start date not null,
  completed_days integer not null default 0 check (completed_days between 0 and 7),
  skipped_days integer not null default 0 check (skipped_days between 0 and 7),
  failed_days integer not null default 0 check (failed_days between 0 and 7),
  best_streak integer not null default 0 check (best_streak >= 0),
  difficult_moments text not null,
  helpful_pattern text not null,
  next_adjustment text not null,
  summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, goal_id, week_start)
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text unique,
  plan_name text not null default 'free',
  status subscription_status not null default 'free',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  channel notification_channel not null,
  status notification_status not null default 'queued',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  title text,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists goals_user_id_idx on goals (user_id);
create index if not exists habit_plans_goal_id_idx on habit_plans (goal_id, created_at desc);
create index if not exists micro_actions_plan_id_idx on micro_actions (plan_id, position);
create index if not exists daily_actions_goal_date_idx on daily_actions (goal_id, action_date desc);
create index if not exists action_logs_daily_action_id_idx on action_logs (daily_action_id, created_at desc);
create index if not exists weekly_reviews_user_goal_week_idx on weekly_reviews (user_id, goal_id, week_start desc);
create index if not exists notifications_user_id_status_idx on notifications (user_id, status, scheduled_for);

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at before update on users for each row execute function set_updated_at();
drop trigger if exists anchors_set_updated_at on anchors;
create trigger anchors_set_updated_at before update on anchors for each row execute function set_updated_at();
drop trigger if exists goals_set_updated_at on goals;
create trigger goals_set_updated_at before update on goals for each row execute function set_updated_at();
drop trigger if exists habit_plans_set_updated_at on habit_plans;
create trigger habit_plans_set_updated_at before update on habit_plans for each row execute function set_updated_at();
drop trigger if exists micro_actions_set_updated_at on micro_actions;
create trigger micro_actions_set_updated_at before update on micro_actions for each row execute function set_updated_at();
drop trigger if exists daily_actions_set_updated_at on daily_actions;
create trigger daily_actions_set_updated_at before update on daily_actions for each row execute function set_updated_at();
drop trigger if exists weekly_reviews_set_updated_at on weekly_reviews;
create trigger weekly_reviews_set_updated_at before update on weekly_reviews for each row execute function set_updated_at();
drop trigger if exists subscriptions_set_updated_at on subscriptions;
create trigger subscriptions_set_updated_at before update on subscriptions for each row execute function set_updated_at();
drop trigger if exists notifications_set_updated_at on notifications;
create trigger notifications_set_updated_at before update on notifications for each row execute function set_updated_at();
drop trigger if exists micro_actions_limit_trigger on micro_actions;
create trigger micro_actions_limit_trigger before insert or update on micro_actions for each row execute function enforce_micro_action_limit();

create or replace function create_onboarding_goal(
  p_user_id uuid,
  p_goal_title text,
  p_goal_why text,
  p_difficulty difficulty_level,
  p_available_minutes integer,
  p_anchor_label text,
  p_anchor_cue text,
  p_preferred_time preferred_time
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_anchor_id uuid;
  v_goal goals%rowtype;
begin
  if not exists (select 1 from users where id = p_user_id) then
    raise exception 'User % does not exist', p_user_id;
  end if;

  insert into anchors (user_id, label, cue, preferred_time)
  values (p_user_id, p_anchor_label, p_anchor_cue, p_preferred_time)
  returning id into v_anchor_id;

  insert into goals (user_id, anchor_id, title, why, difficulty, available_minutes)
  values (p_user_id, v_anchor_id, p_goal_title, p_goal_why, p_difficulty, p_available_minutes)
  returning * into v_goal;

  return jsonb_build_object(
    'goal', to_jsonb(v_goal),
    'anchor', (
      select to_jsonb(a)
      from anchors a
      where a.id = v_anchor_id
    )
  );
end;
$$;

create or replace function create_habit_plan(
  p_user_id uuid,
  p_goal_id uuid,
  p_source plan_source,
  p_micro_actions jsonb,
  p_based_on_plan_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_plan habit_plans%rowtype;
  v_version integer;
  v_item jsonb;
  v_count integer;
begin
  if not exists (
    select 1
    from goals
    where id = p_goal_id
      and user_id = p_user_id
  ) then
    raise exception 'Goal % does not belong to user %', p_goal_id, p_user_id;
  end if;

  if jsonb_typeof(p_micro_actions) <> 'array' then
    raise exception 'micro_actions must be a JSON array';
  end if;

  v_count := jsonb_array_length(p_micro_actions);

  if v_count < 1 or v_count > 3 then
    raise exception 'A plan must contain between 1 and 3 micro-actions';
  end if;

  update habit_plans
  set status = 'archived'
  where goal_id = p_goal_id
    and status = 'active';

  select coalesce(max(version), 0) + 1
  into v_version
  from habit_plans
  where goal_id = p_goal_id;

  insert into habit_plans (goal_id, version, source, status, based_on_plan_id, notes)
  values (p_goal_id, v_version, p_source, 'active', p_based_on_plan_id, p_notes)
  returning * into v_plan;

  for v_item in
    select value
    from jsonb_array_elements(p_micro_actions)
  loop
    if coalesce(nullif(trim(v_item->>'fallback_title'), ''), '') = '' then
      raise exception 'fallback_title is required for every micro-action';
    end if;

    insert into micro_actions (
      plan_id,
      position,
      title,
      details,
      duration_minutes,
      fallback_title,
      fallback_details,
      fallback_duration_minutes
    )
    values (
      v_plan.id,
      (v_item->>'position')::smallint,
      v_item->>'title',
      nullif(v_item->>'details', ''),
      (v_item->>'duration_minutes')::integer,
      v_item->>'fallback_title',
      nullif(v_item->>'fallback_details', ''),
      (v_item->>'fallback_duration_minutes')::integer
    );
  end loop;

  return jsonb_build_object(
    'plan', to_jsonb(v_plan),
    'micro_actions', (
      select jsonb_agg(to_jsonb(ma) order by ma.position)
      from micro_actions ma
      where ma.plan_id = v_plan.id
    )
  );
end;
$$;

create or replace function assign_daily_action(
  p_user_id uuid,
  p_goal_id uuid,
  p_plan_id uuid,
  p_micro_action_id uuid,
  p_action_date date default current_date
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_daily_action daily_actions%rowtype;
begin
  if not exists (
    select 1
    from goals g
    join habit_plans hp on hp.goal_id = g.id
    join micro_actions ma on ma.plan_id = hp.id
    where g.id = p_goal_id
      and g.user_id = p_user_id
      and hp.id = p_plan_id
      and ma.id = p_micro_action_id
  ) then
    raise exception 'Goal, plan, and micro-action combination is invalid';
  end if;

  insert into daily_actions (goal_id, plan_id, micro_action_id, action_date)
  values (p_goal_id, p_plan_id, p_micro_action_id, p_action_date)
  on conflict (goal_id, action_date)
  do update set
    plan_id = excluded.plan_id,
    micro_action_id = excluded.micro_action_id,
    status = 'pending',
    used_fallback = false,
    notes = null,
    completed_at = null,
    failed_at = null
  returning * into v_daily_action;

  insert into action_logs (
    daily_action_id,
    user_id,
    log_type,
    status_from,
    status_to,
    metadata
  )
  values (
    v_daily_action.id,
    p_user_id,
    'assigned',
    null,
    v_daily_action.status,
    jsonb_build_object('action_date', p_action_date)
  );

  return to_jsonb(v_daily_action);
end;
$$;

create or replace function complete_daily_action(
  p_user_id uuid,
  p_daily_action_id uuid,
  p_used_fallback boolean default false,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_daily_action daily_actions%rowtype;
  v_previous_status daily_action_status;
begin
  select da.*
  into v_daily_action
  from daily_actions da
  join goals g on g.id = da.goal_id
  where da.id = p_daily_action_id
    and g.user_id = p_user_id;

  if not found then
    raise exception 'Daily action % not found for user %', p_daily_action_id, p_user_id;
  end if;

  v_previous_status := v_daily_action.status;

  update daily_actions
  set status = 'completed',
      used_fallback = p_used_fallback,
      notes = coalesce(p_notes, notes),
      completed_at = timezone('utc', now())
  where id = p_daily_action_id
  returning * into v_daily_action;

  insert into action_logs (
    daily_action_id,
    user_id,
    log_type,
    status_from,
    status_to,
    notes,
    metadata
  )
  values (
    p_daily_action_id,
    p_user_id,
    'completed',
    v_previous_status,
    'completed',
    p_notes,
    jsonb_build_object('used_fallback', p_used_fallback)
  );

  return to_jsonb(v_daily_action);
end;
$$;

create or replace function report_daily_action_failure(
  p_user_id uuid,
  p_daily_action_id uuid,
  p_failure_reason failure_reason,
  p_notes text default null,
  p_create_recovery_plan boolean default true
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_daily_action daily_actions%rowtype;
  v_goal goals%rowtype;
  v_old_plan habit_plans%rowtype;
  v_new_plan habit_plans%rowtype;
  v_previous_status daily_action_status;
  v_version integer;
  v_selected_micro_action_id uuid;
  v_new_micro_action_id uuid;
  v_recovery_micro_actions jsonb := '[]'::jsonb;
  v_action record;
begin
  select da.*
  into v_daily_action
  from daily_actions da
  join goals g on g.id = da.goal_id
  where da.id = p_daily_action_id
    and g.user_id = p_user_id;

  if not found then
    raise exception 'Daily action % not found for user %', p_daily_action_id, p_user_id;
  end if;

  select *
  into v_goal
  from goals
  where id = v_daily_action.goal_id;

  select *
  into v_old_plan
  from habit_plans
  where id = v_daily_action.plan_id;

  v_previous_status := v_daily_action.status;
  v_selected_micro_action_id := v_daily_action.micro_action_id;

  update daily_actions
  set status = 'failed',
      notes = coalesce(p_notes, notes),
      failed_at = timezone('utc', now())
  where id = p_daily_action_id
  returning * into v_daily_action;

  insert into action_logs (
    daily_action_id,
    user_id,
    log_type,
    status_from,
    status_to,
    failure_reason,
    notes
  )
  values (
    p_daily_action_id,
    p_user_id,
    'failed',
    v_previous_status,
    'failed',
    p_failure_reason,
    p_notes
  );

  if p_create_recovery_plan then
    update habit_plans
    set status = 'archived'
    where goal_id = v_goal.id
      and status = 'active';

    select coalesce(max(version), 0) + 1
    into v_version
    from habit_plans
    where goal_id = v_goal.id;

    insert into habit_plans (goal_id, version, source, status, based_on_plan_id, notes)
    values (
      v_goal.id,
      v_version,
      'recovery',
      'active',
      v_old_plan.id,
      coalesce(p_notes, 'Created from failure recovery.')
    )
    returning * into v_new_plan;

    for v_action in
      select *
      from micro_actions
      where plan_id = v_old_plan.id
      order by position
    loop
      insert into micro_actions (
        plan_id,
        position,
        title,
        details,
        duration_minutes,
        fallback_title,
        fallback_details,
        fallback_duration_minutes
      )
      values (
        v_new_plan.id,
        v_action.position,
        case
          when v_action.id = v_selected_micro_action_id then 'Smaller step: ' || v_action.title
          else v_action.title
        end,
        case
          when v_action.id = v_selected_micro_action_id then coalesce(v_action.details, 'We lowered the bar so this step feels safer to restart.')
          else v_action.details
        end,
        case
          when v_action.id = v_selected_micro_action_id then greatest(1, v_action.duration_minutes - 1)
          else v_action.duration_minutes
        end,
        v_action.fallback_title,
        v_action.fallback_details,
        v_action.fallback_duration_minutes
      )
      returning id into v_new_micro_action_id;

      v_recovery_micro_actions := v_recovery_micro_actions || jsonb_build_object(
        'id', v_new_micro_action_id,
        'position', v_action.position
      );
    end loop;
  end if;

  return jsonb_build_object(
    'daily_action', to_jsonb(v_daily_action),
    'recovery_plan', case when p_create_recovery_plan then to_jsonb(v_new_plan) else null end,
    'recovery_micro_actions', v_recovery_micro_actions
  );
end;
$$;

create or replace function upsert_weekly_review(
  p_user_id uuid,
  p_goal_id uuid,
  p_week_start date,
  p_completed_days integer,
  p_skipped_days integer,
  p_failed_days integer,
  p_best_streak integer,
  p_difficult_moments text,
  p_helpful_pattern text,
  p_next_adjustment text,
  p_summary text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_weekly_review weekly_reviews%rowtype;
begin
  insert into weekly_reviews (
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
    p_user_id,
    p_goal_id,
    p_week_start,
    p_completed_days,
    p_skipped_days,
    p_failed_days,
    p_best_streak,
    p_difficult_moments,
    p_helpful_pattern,
    p_next_adjustment,
    p_summary
  )
  on conflict (user_id, goal_id, week_start)
  do update set
    completed_days = excluded.completed_days,
    skipped_days = excluded.skipped_days,
    failed_days = excluded.failed_days,
    best_streak = excluded.best_streak,
    difficult_moments = excluded.difficult_moments,
    helpful_pattern = excluded.helpful_pattern,
    next_adjustment = excluded.next_adjustment,
    summary = excluded.summary
  returning * into v_weekly_review;

  return to_jsonb(v_weekly_review);
end;
$$;

alter table users enable row level security;
alter table anchors enable row level security;
alter table goals enable row level security;
alter table habit_plans enable row level security;
alter table micro_actions enable row level security;
alter table daily_actions enable row level security;
alter table action_logs enable row level security;
alter table weekly_reviews enable row level security;
alter table subscriptions enable row level security;
alter table notifications enable row level security;

drop policy if exists "users can read own row" on users;
create policy "users can read own row" on users for select using (auth.uid() = id);
drop policy if exists "users can manage own anchors" on anchors;
create policy "users can manage own anchors" on anchors for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users can manage own goals" on goals;
create policy "users can manage own goals" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users can manage own plans" on habit_plans;
create policy "users can manage own plans" on habit_plans for all using (
  exists (
    select 1 from goals g
    where g.id = habit_plans.goal_id
      and g.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from goals g
    where g.id = habit_plans.goal_id
      and g.user_id = auth.uid()
  )
);
drop policy if exists "users can manage own micro actions" on micro_actions;
create policy "users can manage own micro actions" on micro_actions for all using (
  exists (
    select 1
    from habit_plans hp
    join goals g on g.id = hp.goal_id
    where hp.id = micro_actions.plan_id
      and g.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from habit_plans hp
    join goals g on g.id = hp.goal_id
    where hp.id = micro_actions.plan_id
      and g.user_id = auth.uid()
  )
);
drop policy if exists "users can manage own daily actions" on daily_actions;
create policy "users can manage own daily actions" on daily_actions for all using (
  exists (
    select 1 from goals g
    where g.id = daily_actions.goal_id
      and g.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from goals g
    where g.id = daily_actions.goal_id
      and g.user_id = auth.uid()
  )
);
drop policy if exists "users can manage own action logs" on action_logs;
create policy "users can manage own action logs" on action_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users can manage own weekly reviews" on weekly_reviews;
create policy "users can manage own weekly reviews" on weekly_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users can manage own subscriptions" on subscriptions;
create policy "users can manage own subscriptions" on subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users can manage own notifications" on notifications;
create policy "users can manage own notifications" on notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
