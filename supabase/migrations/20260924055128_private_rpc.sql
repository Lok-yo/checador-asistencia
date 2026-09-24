-- La lógica privilegiada se mantiene fuera de los esquemas expuestos por la API.
create schema attendance_private;
revoke all on schema attendance_private from public, anon, authenticated;
grant usage on schema attendance_private to authenticated;

alter function public.finalize_attendance(text, uuid) set schema attendance_private;

-- Entrada pública sin SECURITY DEFINER. La función privada conserva sus
-- comprobaciones de JWT, propiedad de foto y serialización por usuario.
create function public.finalize_attendance(p_type text, p_request_id uuid)
returns public.attendance
language sql security invoker set search_path = '' as $$
  select attendance_private.finalize_attendance(p_type, p_request_id);
$$;

revoke execute on function public.finalize_attendance(text, uuid) from public, anon;
grant execute on function public.finalize_attendance(text, uuid) to authenticated;
