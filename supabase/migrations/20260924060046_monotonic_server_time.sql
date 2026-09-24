-- El tiempo de la checada se toma al insertar, después del bloqueo por usuario.
-- Se mantiene estrictamente creciente aunque dos llamadas compartan la misma
-- precisión temporal o una transacción haya esperado a otra.
alter table public.attendance alter column created_at set default clock_timestamp();

create or replace function attendance_private.finalize_attendance(p_type text, p_request_id uuid)
returns public.attendance
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_path text;
  v_existing public.attendance;
  v_last_type text;
  v_last_created_at timestamptz;
  v_created public.attendance;
begin
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_request_id is null or p_type is null or p_type not in ('entry', 'exit') then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  select * into v_existing from public.attendance
    where user_id = v_user and request_id = p_request_id;
  if found then
    if v_existing.type <> p_type then
      raise exception using errcode = 'P0001', message = 'REQUEST_CONFLICT';
    end if;
    return v_existing;
  end if;

  v_path := v_user::text || '/' || p_request_id::text || '.jpg';
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'attendance-photos'
      and name = v_path
      and owner_id = v_user::text
  ) then
    raise exception using errcode = 'P0001', message = 'PHOTO_MISSING';
  end if;

  select type, created_at into v_last_type, v_last_created_at
    from public.attendance where user_id = v_user
    order by created_at desc, id desc limit 1;
  if p_type = 'entry' and v_last_type = 'entry' then
    raise exception using errcode = 'P0001', message = 'ENTRY_ALREADY_OPEN';
  end if;
  if p_type = 'exit' and v_last_type is distinct from 'entry' then
    raise exception using errcode = 'P0001', message = 'NO_OPEN_ENTRY';
  end if;

  insert into public.attendance (user_id, type, photo_path, request_id, created_at)
  values (
    v_user, p_type, v_path, p_request_id,
    greatest(pg_catalog.clock_timestamp(), v_last_created_at + interval '1 microsecond')
  ) returning * into v_created;
  return v_created;
end;
$$;
