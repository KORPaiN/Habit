alter table users
  alter column locale set default 'ko';

update users
set locale = 'ko'
where locale = 'en';
