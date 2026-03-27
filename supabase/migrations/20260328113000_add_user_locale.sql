alter table users
  add column if not exists locale text not null default 'en'
  check (locale in ('en', 'ko'));

update users
set locale = 'en'
where locale is null;
