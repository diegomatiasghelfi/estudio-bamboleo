-- =====================================================================
--  ESTUDIO BAMBOLEO · Esquema completo para Supabase
--  Pegar entero en el SQL Editor de Supabase y ejecutar (Run).
--  Es re-ejecutable: usa IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.
--  Zona horaria del estudio: America/Argentina/Buenos_Aires
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  role        text not null default 'student' check (role in ('student', 'admin')),
  created_at  timestamptz not null default now()
);

create table if not exists public.packs (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  credits        int  not null check (credits > 0),
  price_ars      int  not null check (price_ars >= 0),
  allowed_level  text not null default 'all' check (allowed_level in ('all', 'inicial')),
  duration_days  int  not null default 30 check (duration_days > 0),
  active         boolean not null default true,
  sort_order     int not null default 0
);

create table if not exists public.user_passes (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  pack_id            uuid references public.packs (id) on delete set null,
  total_credits      int  not null,
  remaining_credits  int  not null check (remaining_credits >= 0),
  allowed_level      text not null default 'all' check (allowed_level in ('all', 'inicial')),
  activated_at       timestamptz not null default now(),
  expires_at         timestamptz not null,
  status             text not null default 'active' check (status in ('active', 'expired', 'exhausted', 'cancelled'))
);
create index if not exists user_passes_user_idx on public.user_passes (user_id, status, expires_at);

create table if not exists public.classes (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  rhythm        text not null,
  level         text not null default 'general' check (level in ('inicial', 'general')),
  instructor    text,
  day_of_week   int  not null check (day_of_week between 0 and 6),  -- 0 = domingo
  start_time    time not null,
  end_time      time not null,
  max_capacity  int  not null default 20 check (max_capacity > 0),
  active        boolean not null default true,
  location      text,             -- sede
  check (end_time > start_time)
);
alter table public.classes add column if not exists location text;

create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  class_id      uuid not null references public.classes (id) on delete cascade,
  user_pass_id  uuid references public.user_passes (id) on delete set null,
  class_date    date not null,
  status        text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'attended')),
  created_at    timestamptz not null default now()
);
create index if not exists bookings_class_date_idx on public.bookings (class_id, class_date);
create index if not exists bookings_user_idx on public.bookings (user_id, class_date);
-- Un alumno no puede tener dos reservas activas para la misma clase/fecha
create unique index if not exists bookings_no_duplicates
  on public.bookings (user_id, class_id, class_date) where status <> 'cancelled';

create table if not exists public.payment_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  pack_id      uuid not null references public.packs (id),
  amount_ars   int  not null,
  receipt_url  text,             -- ruta del archivo dentro del bucket "receipts"
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes  text,
  created_at   timestamptz not null default now()
);
create index if not exists payment_requests_status_idx on public.payment_requests (status, created_at);

-- Configuración editable desde el panel admin (alias de transferencia, avisos)
create table if not exists public.settings (
  key    text primary key,
  value  text not null
);

-- ---------------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES Y TRIGGERS
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Crea el perfil automáticamente al registrarse (toma nombre y teléfono del signUp)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un alumno no puede cambiarse el rol a sí mismo.
-- (Desde el SQL Editor, donde auth.uid() es NULL, sí se puede promover a admin.)
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'No tenés permiso para cambiar el rol';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Las solicitudes de pago toman el monto real del pack (el alumno no puede alterarlo)
create or replace function public.prepare_payment_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price int;
begin
  select price_ars into v_price from public.packs where id = new.pack_id and active;
  if v_price is null then
    raise exception 'El pack seleccionado no está disponible';
  end if;
  if not public.is_admin() then
    new.user_id     := auth.uid();
    new.amount_ars  := v_price;
    new.status      := 'pending';
    new.admin_notes := null;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_requests_prepare on public.payment_requests;
create trigger payment_requests_prepare
  before insert on public.payment_requests
  for each row execute function public.prepare_payment_request();

-- ---------------------------------------------------------------------
-- 3. FUNCIONES RPC ATÓMICAS
-- ---------------------------------------------------------------------

-- Reservar una clase: valida pase, vencimiento, nivel, cupo y duplicados; descuenta 1 pase.
create or replace function public.book_class(p_class_id uuid, p_class_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_class      public.classes%rowtype;
  v_pass       public.user_passes%rowtype;
  v_taken      int;
  v_booking_id uuid;
  v_start      timestamptz;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  -- Bloquea la fila de la clase para serializar reservas concurrentes (cupo)
  select * into v_class from public.classes where id = p_class_id and active for update;
  if not found then
    raise exception 'La clase no existe o no está activa';
  end if;

  if extract(dow from p_class_date)::int <> v_class.day_of_week then
    raise exception 'La fecha no corresponde al día de esta clase';
  end if;

  v_start := (p_class_date + v_class.start_time) at time zone 'America/Argentina/Buenos_Aires';
  if v_start <= now() then
    raise exception 'Esta clase ya comenzó';
  end if;

  if exists (
    select 1 from public.bookings
    where user_id = v_uid and class_id = p_class_id and class_date = p_class_date and status <> 'cancelled'
  ) then
    raise exception 'Ya tenés una reserva para esta clase';
  end if;

  select count(*) into v_taken from public.bookings
  where class_id = p_class_id and class_date = p_class_date and status <> 'cancelled';
  if v_taken >= v_class.max_capacity then
    raise exception 'No hay cupos disponibles para esta clase';
  end if;

  -- Usa primero el pase compatible que vence antes
  select * into v_pass from public.user_passes
  where user_id = v_uid
    and status = 'active'
    and remaining_credits > 0
    and (expires_at at time zone 'America/Argentina/Buenos_Aires')::date >= p_class_date
    and (allowed_level = 'all' or allowed_level = v_class.level)
  order by expires_at asc
  limit 1
  for update;

  if not found then
    raise exception 'No tenés pases vigentes y compatibles con esta clase';
  end if;

  update public.user_passes
     set remaining_credits = remaining_credits - 1,
         status = case when remaining_credits - 1 = 0 then 'exhausted' else status end
   where id = v_pass.id;

  insert into public.bookings (user_id, class_id, user_pass_id, class_date, status)
  values (v_uid, p_class_id, v_pass.id, p_class_date, 'confirmed')
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

-- Cancelar: con más de 2 h de anticipación devuelve el pase; con 2 h o menos, se pierde.
create or replace function public.cancel_booking(p_booking_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking  public.bookings%rowtype;
  v_class    public.classes%rowtype;
  v_start    timestamptz;
  v_refund   boolean := false;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Reserva inexistente';
  end if;
  if v_booking.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'No podés cancelar esta reserva';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'La reserva ya no está activa';
  end if;

  select * into v_class from public.classes where id = v_booking.class_id;
  v_start := (v_booking.class_date + v_class.start_time) at time zone 'America/Argentina/Buenos_Aires';

  if v_start - now() > interval '2 hours' then
    v_refund := true;
    update public.user_passes
       set remaining_credits = least(remaining_credits + 1, total_credits),
           status = case when status = 'exhausted' then 'active' else status end
     where id = v_booking.user_pass_id;
  end if;

  update public.bookings set status = 'cancelled' where id = p_booking_id;

  return json_build_object('cancelled', true, 'refunded', v_refund);
end;
$$;

-- Aprobar pago (solo admin): acredita el pack al alumno con vencimiento a 30 días.
create or replace function public.approve_payment_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req     public.payment_requests%rowtype;
  v_pack    public.packs%rowtype;
  v_pass_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede aprobar pagos';
  end if;

  select * into v_req from public.payment_requests where id = p_request_id for update;
  if not found then
    raise exception 'Solicitud inexistente';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'La solicitud ya fue procesada';
  end if;

  select * into v_pack from public.packs where id = v_req.pack_id;

  update public.payment_requests set status = 'approved' where id = p_request_id;

  insert into public.user_passes (user_id, pack_id, total_credits, remaining_credits, allowed_level, activated_at, expires_at, status)
  values (v_req.user_id, v_pack.id, v_pack.credits, v_pack.credits, v_pack.allowed_level, now(), now() + interval '30 days', 'active')
  returning id into v_pass_id;

  return v_pass_id;
end;
$$;

-- Acreditación manual (pagos en efectivo en recepción). Solo admin.
create or replace function public.admin_grant_pass(p_user_id uuid, p_pack_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack    public.packs%rowtype;
  v_pass_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede acreditar pases';
  end if;
  select * into v_pack from public.packs where id = p_pack_id;
  if not found then
    raise exception 'Pack inexistente';
  end if;

  insert into public.user_passes (user_id, pack_id, total_credits, remaining_credits, allowed_level, activated_at, expires_at, status)
  values (p_user_id, v_pack.id, v_pack.credits, v_pack.credits, v_pack.allowed_level, now(), now() + interval '30 days', 'active')
  returning id into v_pass_id;

  return v_pass_id;
end;
$$;

-- Ocupación de clases en un rango de fechas (los alumnos solo ven sus reservas por RLS,
-- así que el cupo se expone agregado, sin datos personales).
create or replace function public.get_class_occupancy(p_from date, p_to date)
returns table (class_id uuid, class_date date, booked int)
language sql
stable
security definer
set search_path = public
as $$
  select b.class_id, b.class_date, count(*)::int
  from public.bookings b
  where b.class_date between p_from and p_to and b.status <> 'cancelled'
  group by b.class_id, b.class_date;
$$;

-- Marca como vencidos los pases cuya fecha pasó (se llama al cargar la app)
create or replace function public.expire_old_passes()
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_passes set status = 'expired'
  where status = 'active' and expires_at < now();
$$;

revoke all on function public.book_class(uuid, date) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
revoke all on function public.approve_payment_request(uuid) from public, anon;
revoke all on function public.admin_grant_pass(uuid, uuid) from public, anon;
revoke all on function public.get_class_occupancy(date, date) from public, anon;
revoke all on function public.expire_old_passes() from public, anon;
grant execute on function public.book_class(uuid, date) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.approve_payment_request(uuid) to authenticated;
grant execute on function public.admin_grant_pass(uuid, uuid) to authenticated;
grant execute on function public.get_class_occupancy(date, date) to authenticated;
grant execute on function public.expire_old_passes() to authenticated;

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.packs            enable row level security;
alter table public.user_passes      enable row level security;
alter table public.classes          enable row level security;
alter table public.bookings         enable row level security;
alter table public.payment_requests enable row level security;
alter table public.settings         enable row level security;

-- profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- packs: todos los usuarios logueados ven los activos; admin gestiona
drop policy if exists "packs_select" on public.packs;
create policy "packs_select" on public.packs
  for select to authenticated using (active or public.is_admin());
drop policy if exists "packs_admin_all" on public.packs;
create policy "packs_admin_all" on public.packs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- classes
drop policy if exists "classes_select" on public.classes;
create policy "classes_select" on public.classes
  for select to authenticated using (active or public.is_admin());
drop policy if exists "classes_admin_all" on public.classes;
create policy "classes_admin_all" on public.classes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- user_passes: el alumno solo lee los suyos; se crean/modifican vía RPC o admin
drop policy if exists "user_passes_select_own_or_admin" on public.user_passes;
create policy "user_passes_select_own_or_admin" on public.user_passes
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "user_passes_admin_all" on public.user_passes;
create policy "user_passes_admin_all" on public.user_passes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- bookings: el alumno lee las suyas; se crean/cancelan vía RPC; admin control total
drop policy if exists "bookings_select_own_or_admin" on public.bookings;
create policy "bookings_select_own_or_admin" on public.bookings
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "bookings_admin_all" on public.bookings;
create policy "bookings_admin_all" on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- payment_requests: el alumno crea y lee las suyas; admin control total
drop policy if exists "payment_requests_select_own_or_admin" on public.payment_requests;
create policy "payment_requests_select_own_or_admin" on public.payment_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "payment_requests_insert_own" on public.payment_requests;
create policy "payment_requests_insert_own" on public.payment_requests
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "payment_requests_admin_all" on public.payment_requests;
create policy "payment_requests_admin_all" on public.payment_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- settings: lectura para logueados, escritura admin
drop policy if exists "settings_select" on public.settings;
create policy "settings_select" on public.settings
  for select to authenticated using (true);
drop policy if exists "settings_admin_all" on public.settings;
create policy "settings_admin_all" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 5. STORAGE: bucket privado "receipts" para comprobantes
--    Estructura de rutas: receipts/<user_id>/<archivo>
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists "receipts_insert_own" on storage.objects;
create policy "receipts_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_select_own_or_admin" on storage.objects;
create policy "receipts_select_own_or_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists "receipts_admin_all" on storage.objects;
create policy "receipts_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'receipts' and public.is_admin())
  with check (bucket_id = 'receipts' and public.is_admin());

-- ---------------------------------------------------------------------
-- 6. SEED DATA · Lista de precios vigente "Abonos a partir de Octubre"
-- ---------------------------------------------------------------------

insert into public.settings (key, value) values
  ('transfer_alias', 'ESTUDIO.BAMBOLEO'),
  ('payment_notice', 'Las cuotas se abonan del 1 al 15 de cada mes.')
on conflict (key) do nothing;

insert into public.packs (name, description, credits, price_ars, allowed_level, duration_days, sort_order)
select v.* from (values
  ('Clase suelta',                     'Por clase. 1 pase para cualquier clase.',                                            1,  15000, 'all',     30, 1),
  ('Pack 4 pases',                     'Clases de una vez por semana: Cha Cha Cha, Vueltas en pareja, Afro o Mambo.',        4,  40000, 'all',     30, 2),
  ('Pack 8 pases · Nivel Inicial / Desde Cero', 'Nivel inicial y desde cero. Válido solo para clases de nivel inicial.',     8,  50000, 'inicial', 30, 3),
  ('Pack 8 pases · General',           'Clases de dos veces por semana: Avanzado, Intermedio o Estilo Mujer.',               8,  60000, 'all',     30, 4),
  ('Pack 12 pases',                    'Abono de dos veces por semana + clase extra de una vez por semana ($60.000 + $25.000).', 12, 85000, 'all', 30, 5),
  ('Pack 16 pases',                    'Abono de dos veces por semana + clases extra de dos veces por semana ($60.000 + $30.000).', 16, 90000, 'all', 30, 6),
  ('Pase Libre · Full clases',         '48 clases por mes.',                                                                48, 160000, 'all',     30, 7)
) as v(name, description, credits, price_ars, allowed_level, duration_days, sort_order)
where not exists (select 1 from public.packs);

-- Grilla "Horarios 26'": Lu/Mié/Vie en Pasco 144 - 1er piso; Mar/Jue en Catamarca 1515
insert into public.classes (title, rhythm, level, instructor, day_of_week, start_time, end_time, max_capacity, location)
select v.* from (values
  ('Cha Cha Cha Pachanga · Intermedio',                  'Cha Cha Cha',   'general', null::text, 1, time '18:00', time '19:00', 20, 'Pasco 144 - 1er piso'),
  ('Afro Cubano · Pre intermedio',                       'Afro Cubano',   'general', null, 1, time '19:00', time '20:00', 20, 'Pasco 144 - 1er piso'),
  ('Salsa · Avanzados',                                  'Salsa',         'general', null, 1, time '20:00', time '21:00', 20, 'Pasco 144 - 1er piso'),
  ('Salsa · Iniciación / Pre intermedio',                'Salsa',         'inicial', null, 2, time '19:00', time '20:00', 20, 'Catamarca 1515'),
  ('Salsa · Intermedio',                                 'Salsa',         'general', null, 2, time '20:00', time '21:00', 20, 'Catamarca 1515'),
  ('Vueltas en Pareja · Intermedio',                     'Salsa',         'general', null, 2, time '21:00', time '22:00', 20, 'Catamarca 1515'),
  ('Mambo en 2 · Intermedio',                            'Mambo',         'general', null, 3, time '18:00', time '19:00', 20, 'Pasco 144 - 1er piso'),
  ('Estilo Mujer · Intermedio / Avanzado',               'Estilo Mujer',  'general', null, 3, time '19:00', time '20:00', 20, 'Pasco 144 - 1er piso'),
  ('Salsa · Avanzados',                                  'Salsa',         'general', null, 3, time '20:00', time '21:00', 20, 'Pasco 144 - 1er piso'),
  ('Estilo Hombre Coreográfico · Intermedio / Avanzado', 'Estilo Hombre', 'general', null, 3, time '21:00', time '22:00', 20, 'Pasco 144 - 1er piso'),
  ('Salsa · Iniciación / Pre intermedio',                'Salsa',         'inicial', null, 4, time '19:00', time '20:00', 20, 'Catamarca 1515'),
  ('Salsa · Intermedio',                                 'Salsa',         'general', null, 4, time '20:00', time '21:00', 20, 'Catamarca 1515'),
  ('Estilo Mujer Coreográfico · Avanzado',               'Estilo Mujer',  'general', null, 5, time '19:00', time '20:00', 20, 'Pasco 144 - 1er piso')
) as v(title, rhythm, level, instructor, day_of_week, start_time, end_time, max_capacity, location)
where not exists (select 1 from public.classes);

-- ---------------------------------------------------------------------
-- NOVEDADES (flyers del carrusel de Inicio) + bucket público "flyers"
-- ---------------------------------------------------------------------
create table if not exists public.news (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  image_url   text not null,
  link        text,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.news enable row level security;
drop policy if exists "news_select" on public.news;
create policy "news_select" on public.news for select to authenticated using (active or public.is_admin());
drop policy if exists "news_admin_all" on public.news;
create policy "news_admin_all" on public.news for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('flyers', 'flyers', true)
on conflict (id) do nothing;
drop policy if exists "flyers_public_read" on storage.objects;
create policy "flyers_public_read" on storage.objects for select using (bucket_id = 'flyers');
drop policy if exists "flyers_admin_insert" on storage.objects;
create policy "flyers_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'flyers' and public.is_admin());
drop policy if exists "flyers_admin_update" on storage.objects;
create policy "flyers_admin_update" on storage.objects for update to authenticated using (bucket_id = 'flyers' and public.is_admin());
drop policy if exists "flyers_admin_delete" on storage.objects;
create policy "flyers_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'flyers' and public.is_admin());

insert into public.news (title, image_url, sort_order)
select v.* from (values
  ('Vueltas en pareja estilo lineal y cubano · Miércoles 21 y 28 de enero 20hs', '/flyers/vueltas-en-pareja.jpg', 1),
  ('Muestra anual + social · Viernes 4 de diciembre', '/flyers/muestra-anual.jpg', 2),
  ('Bachata dominicana y merengue desde cero', '/flyers/bachata-merengue.jpg', 3)
) as v(title, image_url, sort_order)
where not exists (select 1 from public.news);

-- ---------------------------------------------------------------------
-- 7. CREAR TU USUARIO ADMIN
--    1) Registrate en la app con tu email.
--    2) Ejecutá esta línea reemplazando el email:
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'TU-EMAIL@ejemplo.com');
-- ---------------------------------------------------------------------
