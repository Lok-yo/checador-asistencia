-- Prueba transaccional. No deja cuentas, filas ni objetos de Storage.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'prueba1@asistencia.invalid', '{"full_name":"Prueba Uno"}'),
  ('22222222-2222-4222-8222-222222222222', 'prueba2@asistencia.invalid', '{"full_name":"Prueba Dos"}');

-- Solo metadatos temporales de Storage para probar la RPC; no son archivos reales.
insert into storage.objects (bucket_id, name, owner_id) values
  ('attendance-photos', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', '11111111-1111-4111-8111-111111111111'),
  ('attendance-photos', '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg', '11111111-1111-4111-8111-111111111111'),
  ('attendance-photos', '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg', '11111111-1111-4111-8111-111111111111'),
  ('attendance-photos', '11111111-1111-4111-8111-111111111111/ffffffff-ffff-4fff-8fff-ffffffffffff.jpg', '11111111-1111-4111-8111-111111111111'),
  ('attendance-photos', '22222222-2222-4222-8222-222222222222/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg', '11111111-1111-4111-8111-111111111111'),
  ('attendance-photos', '22222222-2222-4222-8222-222222222222/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.jpg', '22222222-2222-4222-8222-222222222222');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

do $$
declare
  first_entry public.attendance;
  duplicate public.attendance;
  first_exit public.attendance;
  next_entry public.attendance;
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'RLS de profiles falló';
  end if;

  begin
    insert into public.attendance (user_id, type, photo_path, request_id)
    values ('11111111-1111-4111-8111-111111111111', 'entry', 'direct.jpg', gen_random_uuid());
    raise exception 'INSERT directo quedó permitido';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.finalize_attendance('exit', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    raise exception 'Salida sin entrada quedó permitida';
  exception when raise_exception then
    if sqlerrm <> 'NO_OPEN_ENTRY' then raise; end if;
  end;

  first_entry := public.finalize_attendance('entry', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  duplicate := public.finalize_attendance('entry', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if first_entry.id <> duplicate.id then
    raise exception 'Reintento duplicó la checada';
  end if;

  begin
    perform public.finalize_attendance('entry', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'Dos entradas consecutivas quedaron permitidas';
  exception when raise_exception then
    if sqlerrm <> 'ENTRY_ALREADY_OPEN' then raise; end if;
  end;

  first_exit := public.finalize_attendance('exit', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  if first_exit.type <> 'exit' or (select count(*) from public.attendance) <> 2 then
    raise exception 'Secuencia entrada/salida falló';
  end if;
  next_entry := public.finalize_attendance('entry', 'ffffffff-ffff-4fff-8fff-ffffffffffff');
  if next_entry.created_at <= first_exit.created_at
    or first_exit.created_at <= first_entry.created_at
    or (select type from public.attendance order by created_at desc limit 1) <> 'entry' then
    raise exception 'El orden temporal del servidor falló';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

do $$
begin
  if (select count(*) from public.profiles) <> 1
    or (select count(*) from public.attendance) <> 0
    or (select count(*) from storage.objects where bucket_id = 'attendance-photos') <> 1 then
    raise exception 'Aislamiento entre usuarios falló';
  end if;

  begin
    perform public.finalize_attendance('entry', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    raise exception 'Se aceptó foto de otro propietario';
  exception when raise_exception then
    if sqlerrm <> 'PHOTO_MISSING' then raise; end if;
  end;

  begin
    perform public.finalize_attendance('exit', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    raise exception 'Se aceptó salida sin entrada del segundo usuario';
  exception when raise_exception then
    if sqlerrm <> 'NO_OPEN_ENTRY' then raise; end if;
  end;
end;
$$;

rollback;
