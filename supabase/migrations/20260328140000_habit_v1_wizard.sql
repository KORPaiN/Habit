do $$
begin
  if not exists (select 1 from pg_type where typname = 'anchor_type') then
    create type anchor_type as enum ('primary', 'backup');
  end if;
end
$$;

alter type failure_reason add value if not exists 'forgot_often';
alter type failure_reason add value if not exists 'not_wanted';

alter table goals add column if not exists desired_outcome text;
alter table goals add column if not exists motivation_note text;

create table if not exists goal_anchors (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  anchor_id uuid not null references anchors(id) on delete cascade,
  anchor_type anchor_type not null,
  sort_order integer not null default 0 check (sort_order between 0 and 2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (goal_id, anchor_type, sort_order)
);

create table if not exists behavior_swarm_candidates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  title text not null,
  details text,
  duration_minutes integer not null check (duration_minutes between 1 and 5),
  desire_score integer check (desire_score between 1 and 5),
  ability_score integer check (ability_score between 1 and 5),
  impact_score integer check (impact_score between 1 and 5),
  selected boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table habit_plans add column if not exists recipe_text text;
alter table habit_plans add column if not exists celebration_text text;
alter table habit_plans add column if not exists rehearsal_count integer not null default 0 check (rehearsal_count between 0 and 7);
alter table habit_plans add column if not exists selected_candidate_id uuid references behavior_swarm_candidates(id) on delete set null;

create index if not exists goal_anchors_goal_id_idx on goal_anchors (goal_id, anchor_type, sort_order);
create index if not exists behavior_swarm_candidates_goal_id_idx on behavior_swarm_candidates (goal_id, created_at desc);

drop trigger if exists goal_anchors_set_updated_at on goal_anchors;
create trigger goal_anchors_set_updated_at before update on goal_anchors for each row execute function set_updated_at();
drop trigger if exists behavior_swarm_candidates_set_updated_at on behavior_swarm_candidates;
create trigger behavior_swarm_candidates_set_updated_at before update on behavior_swarm_candidates for each row execute function set_updated_at();

create or replace function create_onboarding_goal(
  p_user_id uuid,
  p_goal_title text,
  p_goal_why text,
  p_desired_outcome text,
  p_motivation_note text,
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
  on conflict (user_id, label, cue)
  do update set
    preferred_time = excluded.preferred_time
  returning id into v_anchor_id;

  insert into goals (
    user_id,
    anchor_id,
    title,
    why,
    desired_outcome,
    motivation_note,
    difficulty,
    available_minutes
  )
  values (
    p_user_id,
    v_anchor_id,
    p_goal_title,
    p_goal_why,
    p_desired_outcome,
    p_motivation_note,
    p_difficulty,
    p_available_minutes
  )
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
  p_notes text default null,
  p_recipe_text text default null,
  p_celebration_text text default null,
  p_rehearsal_count integer default 0,
  p_selected_candidate_id uuid default null
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

  insert into habit_plans (
    goal_id,
    version,
    source,
    status,
    based_on_plan_id,
    notes,
    recipe_text,
    celebration_text,
    rehearsal_count,
    selected_candidate_id
  )
  values (
    p_goal_id,
    v_version,
    p_source,
    'active',
    p_based_on_plan_id,
    p_notes,
    p_recipe_text,
    p_celebration_text,
    coalesce(p_rehearsal_count, 0),
    p_selected_candidate_id
  )
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

alter table goal_anchors enable row level security;
alter table behavior_swarm_candidates enable row level security;

drop policy if exists "users can manage own goal anchors" on goal_anchors;
create policy "users can manage own goal anchors" on goal_anchors for all using (
  exists (
    select 1
    from goals g
    where g.id = goal_anchors.goal_id
      and g.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from goals g
    where g.id = goal_anchors.goal_id
      and g.user_id = auth.uid()
  )
);

drop policy if exists "users can manage own behavior swarm candidates" on behavior_swarm_candidates;
create policy "users can manage own behavior swarm candidates" on behavior_swarm_candidates for all using (
  exists (
    select 1
    from goals g
    where g.id = behavior_swarm_candidates.goal_id
      and g.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from goals g
    where g.id = behavior_swarm_candidates.goal_id
      and g.user_id = auth.uid()
  )
);
