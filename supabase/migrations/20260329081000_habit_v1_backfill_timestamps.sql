alter table goal_anchors
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table goal_anchors
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table behavior_swarm_candidates
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table behavior_swarm_candidates
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists goal_anchors_goal_id_idx on goal_anchors (goal_id, anchor_type, sort_order);
create index if not exists behavior_swarm_candidates_goal_id_idx on behavior_swarm_candidates (goal_id, created_at desc);

drop trigger if exists goal_anchors_set_updated_at on goal_anchors;
create trigger goal_anchors_set_updated_at before update on goal_anchors for each row execute function set_updated_at();

drop trigger if exists behavior_swarm_candidates_set_updated_at on behavior_swarm_candidates;
create trigger behavior_swarm_candidates_set_updated_at before update on behavior_swarm_candidates for each row execute function set_updated_at();
