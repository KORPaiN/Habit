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
  on conflict (user_id, label, cue)
  do update set
    preferred_time = excluded.preferred_time
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
