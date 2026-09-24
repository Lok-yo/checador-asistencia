-- Checador móvil: solo esta migración crea recursos de la aplicación.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('entry', 'exit')),
  photo_path text not null unique,
  created_at timestamptz not null default now(),
  request_id uuid not null,
  constraint attendance_user_request_unique unique (user_id, request_id)
);

create index attendance_user_latest_idx
  on public.attendance (user_id, created_at desc, id desc);

alter table public.profiles enable row level security;
alter table public.attendance enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.attendance from anon, authenticated;
grant select on public.profiles, public.attendance to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy attendance_select_own on public.attendance
  for select to authenticated using (user_id = (select auth.uid()));

-- El alta en Auth crea el perfil; el cliente nunca escribe en profiles.
create function public.create_attendance_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, btrim(new.raw_user_meta_data ->> 'full_name'));
  return new;
end;
$$;
revoke execute on function public.create_attendance_profile() from public, anon, authenticated;
create trigger attendance_auth_user_created
  after insert on auth.users for each row
  execute function public.create_attendance_profile();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-photos', 'attendance-photos', false, 2097152, array['image/jpeg']);

-- Solo una foto JPG nueva por solicitud. No se permite reemplazar ni borrar
-- evidencia mediante la clave pública de la aplicación.
create policy attendance_photo_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attendance-photos'
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  );

create policy attendance_photo_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attendance-photos'
    and owner_id = (select auth.uid())::text
    and name like ((select auth.uid())::text || '/%')
  );

-- SECURITY DEFINER es necesario porque attendance no admite INSERT directo.
-- La única entrada remota es esta RPC, limitada a authenticated, con usuario
-- obtenido del JWT, ruta exacta y propiedad real del objeto de Storage.
create function public.finalize_attendance(p_type text, p_request_id uuid)
returns public.attendance
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_path text;
  v_existing public.attendance;
  v_last_type text;
  v_created public.attendance;
begin
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_request_id is null or p_type is null or p_type not in ('entry', 'exit') then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
  end if;

  -- Serializa movimientos del mismo usuario, incluso con request_id distintos.
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

  select type into v_last_type from public.attendance
    where user_id = v_user order by created_at desc, id desc limit 1;
  if (p_type = 'entry' and v_last_type = 'entry') then
    raise exception using errcode = 'P0001', message = 'ENTRY_ALREADY_OPEN';
  end if;
  if (p_type = 'exit' and v_last_type is distinct from 'entry') then
    raise exception using errcode = 'P0001', message = 'NO_OPEN_ENTRY';
  end if;

  insert into public.attendance (user_id, type, photo_path, request_id)
  values (v_user, p_type, v_path, p_request_id)
  returning * into v_created;
  return v_created;
end;
$$;

revoke execute on function public.finalize_attendance(text, uuid) from public, anon;
grant execute on function public.finalize_attendance(text, uuid) to authenticated;
