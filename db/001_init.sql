-- متجر المبرمج المجهول — المخطط الأساسي + صلاحيات على مستوى قاعدة البيانات (RLS)
-- الدور store_api هو الوحيد الذي تستخدمه الواجهة الخلفية، وكل طلب يمرّر هوية المستخدم عبر app.uid
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  email text,
  name text,
  avatar text,
  role text not null default 'user' check (role in ('user','admin','owner')),
  banned boolean not null default false,
  ban_reason text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  kind text not null check (kind in ('python','apk','course','video','file')),
  title text not null check (char_length(title) between 2 and 160),
  summary text not null default '' check (char_length(summary) <= 400),
  description text not null default '' check (char_length(description) <= 20000),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  gallery jsonb not null default '[]',
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'USD' check (currency in ('USD','IQD')),
  discount_percent int not null default 0 check (discount_percent between 0 and 95),
  discount_ends_at timestamptz,
  version text not null default '1.0.0' check (char_length(version) <= 40),
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  featured boolean not null default false,
  tags text[] not null default '{}',
  downloads int not null default 0,
  views int not null default 0,
  rating_sum int not null default 0,
  rating_count int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists products_list on products(status, kind, published_at desc);
create index if not exists products_top on products(status, downloads desc);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  position int not null default 0,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  duration_s int not null default 0,
  is_preview boolean not null default false,
  video_file_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists lessons_product on lessons(product_id, position);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  purpose text not null default 'product' check (purpose in ('product','lesson')),
  object_key text not null unique,
  file_name text not null check (char_length(file_name) <= 255),
  mime text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  version text,
  notes text check (notes is null or char_length(notes) <= 4000),
  is_current boolean not null default false,
  scan_status text not null default 'pending' check (scan_status in ('pending','passed','flagged')),
  scan_detail text,
  status text not null default 'uploading' check (status in ('uploading','ready','aborted','deleted')),
  upload_id text,
  part_size int,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists files_product on files(product_id, status);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lessons_video_fk') then
    alter table lessons add constraint lessons_video_fk foreign key (video_file_id) references files(id) on delete set null;
  end if;
end $$;

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  amount numeric(12,2) not null default 0,
  currency text not null default 'USD',
  provider text not null default 'manual',
  status text not null default 'pending' check (status in ('pending','paid','test','cancelled','refunded')),
  reference text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create unique index if not exists purchases_one_active on purchases(user_id, product_id) where status in ('pending','paid','test');
create index if not exists purchases_status on purchases(status, created_at desc);

create table if not exists downloads (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete set null,
  product_id uuid not null references products(id) on delete cascade,
  file_id uuid references files(id) on delete set null,
  visitor text,
  created_at timestamptz not null default now()
);
create index if not exists downloads_user on downloads(user_id, created_at desc);
create index if not exists downloads_product on downloads(product_id, created_at desc);

create table if not exists favorites (
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1500),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists reviews_product on reviews(product_id, created_at desc);

create table if not exists lesson_progress (
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  position_s int not null default 0 check (position_s >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists notifications (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  kind text not null default 'info' check (kind in ('info','message','security','order')),
  title text not null check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 4000),
  for_admins boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on notifications(user_id, created_at desc);

create table if not exists notification_reads (
  user_id uuid not null references profiles(id) on delete cascade,
  notification_id bigint not null references notifications(id) on delete cascade,
  primary key (user_id, notification_id)
);

create table if not exists messages (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  email text check (email is null or char_length(email) <= 200),
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'new' check (status in ('new','read','replied','closed')),
  reply text check (reply is null or char_length(reply) <= 5000),
  replied_at timestamptz,
  ip text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  target text,
  meta jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists audit_time on audit_log(created_at desc);

create table if not exists security_events (
  id bigserial primary key,
  ip text,
  kind text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  method text,
  path text,
  ua text,
  user_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists sec_time on security_events(created_at desc);
create index if not exists sec_ip on security_events(ip, created_at desc);

create table if not exists ip_blocks (
  ip text primary key,
  reason text not null,
  severity text,
  blocked_until timestamptz,
  hits int not null default 1,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists visits (
  day date not null default current_date,
  visitor text not null,
  hits int not null default 1,
  last_seen timestamptz not null default now(),
  primary key (day, visitor)
);
create index if not exists visits_seen on visits(last_seen desc);

create table if not exists product_views (
  day date not null default current_date,
  product_id uuid not null references products(id) on delete cascade,
  visitor text not null,
  primary key (day, product_id, visitor)
);

-- ===== دوال الهوية والصلاحيات =====
create or replace function app_uid() returns uuid language sql stable as
$$ select nullif(current_setting('app.uid', true), '')::uuid $$;

create or replace function app_is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = app_uid() and role in ('admin','owner') and not banned) $$;

create or replace function app_is_owner() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = app_uid() and role = 'owner' and not banned) $$;

create or replace function app_is_banned() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = app_uid() and banned) $$;

create or replace function effective_price(p products) returns numeric language sql stable as
$$ select case when p.discount_percent > 0 and (p.discount_ends_at is null or p.discount_ends_at > now())
   then round(p.price * (100 - p.discount_percent) / 100.0, 2) else p.price end $$;

create or replace function has_access(pid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select not app_is_banned() and (app_is_admin() or exists(
    select 1 from products p where p.id = pid and p.status = 'published' and (
      p.price = 0 or exists(select 1 from purchases b where b.product_id = pid and b.user_id = app_uid() and b.status in ('paid','test')))))
$$;

create or replace function can_review(pid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select app_uid() is not null and not app_is_banned() and (
    exists(select 1 from downloads where product_id = pid and user_id = app_uid())
    or exists(select 1 from purchases where product_id = pid and user_id = app_uid() and status in ('paid','test'))
    or exists(select 1 from lesson_progress lp join lessons l on l.id = lp.lesson_id where l.product_id = pid and lp.user_id = app_uid()))
$$;

create or replace function ensure_profile() returns profiles language plpgsql security definer set search_path = public as $$
declare r profiles; u record; reg boolean;
begin
  if app_uid() is null then raise exception 'auth_required'; end if;
  select * into r from profiles where id = app_uid();
  if found then
    if r.last_seen < now() - interval '2 minutes' then update profiles set last_seen = now() where id = r.id; end if;
    return r;
  end if;
  select coalesce((value->>'registration_enabled')::boolean, true) into reg from settings where key = 'site';
  if reg is false then raise exception 'registration_closed'; end if;
  select * into u from neon_auth."user" where id = app_uid();
  if not found then raise exception 'auth_user_missing'; end if;
  insert into profiles(id, email, name, avatar)
  values (u.id, u.email, left(coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)), 100), u.image)
  returning * into r;
  return r;
end $$;

create or replace function claim_owner(token text) returns boolean language plpgsql security definer set search_path = public as $$
declare h text;
begin
  if app_uid() is null then raise exception 'auth_required'; end if;
  select value->>'hash' into h from settings where key = 'owner_claim';
  if h is null or h <> encode(digest(token, 'sha256'), 'hex') then raise exception 'invalid_claim'; end if;
  if exists(select 1 from profiles where role = 'owner') then raise exception 'owner_exists'; end if;
  update profiles set role = 'owner', banned = false, ban_reason = null where id = app_uid();
  if not found then raise exception 'profile_missing'; end if;
  delete from settings where key = 'owner_claim';
  insert into audit_log(actor_id, action, target) values (app_uid(), 'owner.claim', app_uid()::text);
  return true;
end $$;

create or replace function record_download(pid uuid, fid uuid, vis text)
returns table(object_key text, file_name text, size_bytes bigint, mime text)
language plpgsql security definer set search_path = public as $$
declare f files;
begin
  if not has_access(pid) then raise exception 'no_access'; end if;
  select * into f from files x where x.product_id = pid and x.status = 'ready' and x.purpose = 'product'
    and ((fid is null and x.is_current) or x.id = fid) order by x.created_at desc limit 1;
  if not found then raise exception 'file_not_found'; end if;
  if not exists (select 1 from downloads d where d.product_id = pid and d.created_at > now() - interval '1 day'
      and ((app_uid() is not null and d.user_id = app_uid()) or (app_uid() is null and d.visitor = vis))) then
    update products set downloads = downloads + 1 where id = pid;
  end if;
  insert into downloads(user_id, product_id, file_id, visitor) values (app_uid(), pid, f.id, vis);
  return query select f.object_key, f.file_name, f.size_bytes, f.mime;
end $$;

create or replace function lesson_media(lid uuid) returns table(object_key text, mime text, product_id uuid)
language sql stable security definer set search_path = public as $$
  select f.object_key, f.mime, l.product_id from lessons l
  join products p on p.id = l.product_id
  join files f on f.id = l.video_file_id and f.status = 'ready'
  where l.id = lid and not app_is_banned()
    and ((l.is_preview and p.status = 'published') or has_access(l.product_id))
$$;

create or replace function record_view(pid uuid, vis text) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into product_views(product_id, visitor) values (pid, vis) on conflict do nothing;
  if found then update products set views = views + 1 where id = pid and status = 'published'; end if;
end $$;

create or replace function track_visit(vis text) returns void language sql security definer set search_path = public as $$
  insert into visits(visitor) values (vis)
  on conflict (day, visitor) do update set hits = visits.hits + 1, last_seen = now()
$$;

create or replace function auto_block(bip text, why text, sev text, minutes int) returns void
language sql security definer set search_path = public as $$
  insert into ip_blocks(ip, reason, severity, blocked_until, hits, created_by)
  values (bip, left(why, 300), sev, now() + make_interval(mins => minutes), 1, 'system')
  on conflict (ip) do update set reason = excluded.reason, severity = excluded.severity, hits = ip_blocks.hits + 1,
    blocked_until = case when ip_blocks.blocked_until is null and ip_blocks.created_by <> 'system' then null
      else greatest(coalesce(ip_blocks.blocked_until, now()), now() + make_interval(mins => minutes * least(ip_blocks.hits + 1, 48))) end
$$;

-- ===== المشغّلات =====
create or replace function products_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists products_touch on products;
create trigger products_touch before insert or update on products for each row execute function products_touch();

create or replace function reviews_sync() returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update products set rating_sum = coalesce((select sum(rating) from reviews where product_id = pid), 0),
    rating_count = (select count(*) from reviews where product_id = pid) where id = pid;
  return null;
end $$;
drop trigger if exists reviews_sync on reviews;
create trigger reviews_sync after insert or update or delete on reviews for each row execute function reviews_sync();

create or replace function purchases_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare p products;
begin
  select * into p from products where id = new.product_id and status = 'published';
  if not found then raise exception 'product_unavailable'; end if;
  if p.price = 0 then raise exception 'product_is_free'; end if;
  new.amount := effective_price(p);
  new.currency := p.currency;
  if new.status = 'test' then
    if not app_is_admin() then raise exception 'forbidden'; end if;
    new.provider := 'test'; new.paid_at := now();
  elsif new.status <> 'pending' then
    raise exception 'invalid_status';
  end if;
  return new;
end $$;
drop trigger if exists purchases_before_insert on purchases;
create trigger purchases_before_insert before insert on purchases for each row execute function purchases_before_insert();

create or replace function profiles_guard() returns trigger language plpgsql as $$
begin
  if current_user <> 'store_api' then return new; end if;
  if new.id <> old.id then raise exception 'forbidden'; end if;
  if new.role is distinct from old.role then
    if not app_is_owner() then raise exception 'forbidden_role_change'; end if;
    if old.role = 'owner' or new.role = 'owner' then raise exception 'owner_immutable'; end if;
  end if;
  if new.banned is distinct from old.banned then
    if not app_is_admin() then raise exception 'forbidden_ban'; end if;
    if old.role = 'owner' then raise exception 'owner_immutable'; end if;
    if old.role = 'admin' and not app_is_owner() then raise exception 'forbidden_ban_admin'; end if;
    if old.id = app_uid() then raise exception 'cannot_ban_self'; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard before update on profiles for each row execute function profiles_guard();

-- ===== الدور المقيّد للواجهة الخلفية =====
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'store_api') then
    create role store_api login nosuperuser nocreatedb nocreaterole nobypassrls noinherit;
  end if;
end $$;
grant usage on schema public to store_api;
grant select, insert, update, delete on all tables in schema public to store_api;
revoke update on profiles, purchases from store_api;
grant update (name, last_seen, role, banned, ban_reason) on profiles to store_api;
grant update (status, paid_at, note) on purchases to store_api;
grant usage, select on all sequences in schema public to store_api;
grant execute on all functions in schema public to store_api;

-- ===== سياسات RLS (الرفض افتراضي لأي عملية بلا سياسة) =====
do $$ declare t text; begin
  foreach t in array array['profiles','products','lessons','files','purchases','downloads','favorites','reviews','lesson_progress',
    'notifications','notification_reads','messages','settings','audit_log','security_events','ip_blocks','visits','product_views'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

drop policy if exists p_sel on profiles; create policy p_sel on profiles for select using (id = app_uid() or app_is_admin());
drop policy if exists p_upd on profiles; create policy p_upd on profiles for update using (id = app_uid() or app_is_admin()) with check (id = app_uid() or app_is_admin());

drop policy if exists pr_sel on products; create policy pr_sel on products for select using (status = 'published' or app_is_admin());
drop policy if exists pr_ins on products; create policy pr_ins on products for insert with check (app_is_admin());
drop policy if exists pr_upd on products; create policy pr_upd on products for update using (app_is_admin()) with check (app_is_admin());
drop policy if exists pr_del on products; create policy pr_del on products for delete using (app_is_admin());

drop policy if exists l_sel on lessons; create policy l_sel on lessons for select using (app_is_admin() or exists(select 1 from products p where p.id = product_id and p.status = 'published'));
drop policy if exists l_all on lessons; create policy l_all on lessons for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists f_sel on files; create policy f_sel on files for select using (app_is_admin() or (status = 'ready' and exists(select 1 from products p where p.id = product_id and p.status = 'published')));
drop policy if exists f_all on files; create policy f_all on files for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists b_sel on purchases; create policy b_sel on purchases for select using (user_id = app_uid() or app_is_admin());
drop policy if exists b_ins on purchases; create policy b_ins on purchases for insert with check (user_id = app_uid() and not app_is_banned() and status in ('pending','test'));
drop policy if exists b_upd on purchases; create policy b_upd on purchases for update
  using (app_is_admin() or (user_id = app_uid() and status = 'pending'))
  with check (app_is_admin() or (user_id = app_uid() and status = 'cancelled'));

drop policy if exists d_sel on downloads; create policy d_sel on downloads for select using (user_id = app_uid() or app_is_admin());

drop policy if exists fv_all on favorites; create policy fv_all on favorites for all using (user_id = app_uid()) with check (user_id = app_uid() and not app_is_banned());

drop policy if exists r_sel on reviews; create policy r_sel on reviews for select using (true);
drop policy if exists r_ins on reviews; create policy r_ins on reviews for insert with check (user_id = app_uid() and can_review(product_id));
drop policy if exists r_upd on reviews; create policy r_upd on reviews for update using (user_id = app_uid()) with check (user_id = app_uid() and can_review(product_id));
drop policy if exists r_del on reviews; create policy r_del on reviews for delete using (user_id = app_uid() or app_is_admin());

drop policy if exists lp_all on lesson_progress; create policy lp_all on lesson_progress for all using (user_id = app_uid()) with check (user_id = app_uid());

drop policy if exists n_sel on notifications; create policy n_sel on notifications for select
  using (user_id = app_uid() or (user_id is null and app_uid() is not null and (not for_admins or app_is_admin())));
drop policy if exists n_ins on notifications; create policy n_ins on notifications for insert with check (app_is_admin());
drop policy if exists n_del on notifications; create policy n_del on notifications for delete using (app_is_admin());

drop policy if exists nr_all on notification_reads; create policy nr_all on notification_reads for all using (user_id = app_uid()) with check (user_id = app_uid());

drop policy if exists m_ins on messages; create policy m_ins on messages for insert with check ((user_id is null or user_id = app_uid()) and status = 'new' and reply is null);
drop policy if exists m_sel on messages; create policy m_sel on messages for select using (user_id = app_uid() or app_is_admin());
drop policy if exists m_upd on messages; create policy m_upd on messages for update using (app_is_admin()) with check (app_is_admin());

drop policy if exists s_sel on settings; create policy s_sel on settings for select using (key <> 'owner_claim' and (key not like 'private:%' or app_is_admin()));
drop policy if exists s_write on settings; create policy s_write on settings for all using (app_is_admin() and key <> 'owner_claim') with check (app_is_admin() and key <> 'owner_claim');

drop policy if exists a_sel on audit_log; create policy a_sel on audit_log for select using (app_is_admin());
drop policy if exists a_ins on audit_log; create policy a_ins on audit_log for insert with check (app_is_admin() and actor_id = app_uid());

drop policy if exists se_ins on security_events; create policy se_ins on security_events for insert with check (true);
drop policy if exists se_sel on security_events; create policy se_sel on security_events for select using (app_is_admin());

drop policy if exists ib_sel on ip_blocks; create policy ib_sel on ip_blocks for select using (true);
drop policy if exists ib_write on ip_blocks; create policy ib_write on ip_blocks for all using (app_is_admin()) with check (app_is_admin());

drop policy if exists v_sel on visits; create policy v_sel on visits for select using (app_is_admin());
drop policy if exists pv_sel on product_views; create policy pv_sel on product_views for select using (app_is_admin());

-- ===== الإعدادات الافتراضية =====
insert into settings(key, value) values
('site', '{"name":"متجر المبرمج المجهول","name_en":"Anonymous Programmer Store","tagline":"أدوات Python، تطبيقات Android، كورسات وملفات احترافية في البرمجة والأمن السيبراني","colors":{"primary":"#18b4ff","accent":"#8b5cf6","bg":"#05060b"},"font":"Cairo","background":"network","background_url":null,"logo_url":null,"favicon_url":null,"announcement":"","registration_enabled":true,"store_enabled":true,"sections":{"python":true,"apk":true,"course":true,"video":true,"file":true},"currency":"USD"}'),
('social', '{"tiktok":"https://www.tiktok.com/@termax_whot.is","telegram":"https://t.me/HIKR7","whatsapp":"https://wa.me/966598052773"}'),
('payments', '{"manual":{"enabled":true,"instructions":"بعد إنشاء الطلب تواصل معنا عبر واتساب أو تيليجرام مع رقم الطلب لإتمام الدفع (زين كاش / آسيا حوالة / تحويل). يتم تفعيل التحميل فور تأكيد الدفع من الإدارة."},"gateways":{"zaincash":{"enabled":false,"label":"زين كاش"},"fib":{"enabled":false,"label":"First Iraqi Bank"},"qicard":{"enabled":false,"label":"Qi Card"}}}'),
('faq', '[{"q":"هل المنتجات المجانية مجانية فعلاً؟","a":"نعم، يمكنك تحميلها مباشرة دون دفع. تسجيل الدخول اختياري لكنه يحفظ سجل تحميلاتك ومفضلتك."},{"q":"كيف أشتري منتجاً مدفوعاً؟","a":"سجّل الدخول بحساب Google، اضغط شراء لإنشاء طلب برقم مرجعي، ثم تواصل معنا عبر واتساب أو تيليجرام لإتمام الدفع. يُفعَّل التحميل فور تأكيد الدفع."},{"q":"ما طرق الدفع المتاحة في العراق؟","a":"حالياً الدفع يدوي عبر زين كاش أو آسيا حوالة أو التحويل، مع التأكيد من الإدارة. بوابات الدفع الإلكترونية ستُضاف عند توفرها رسمياً."},{"q":"هل الروابط آمنة؟","a":"كل رابط تحميل مؤقت وموقّع ويُصدر من الخادم بعد التحقق من صلاحيتك، ولا يمكن مشاركته للأبد."},{"q":"هل جودة الفيديوهات مضغوطة؟","a":"لا، تُحفظ الفيديوهات والملفات بجودتها الأصلية دون أي ضغط."},{"q":"وصلني تحديث لمنتج اشتريته، هل أدفع مجدداً؟","a":"لا، التحديثات الجديدة لنفس المنتج متاحة لك مجاناً من صفحة المنتج أو حسابك."},{"q":"كيف أتواصل مع الدعم؟","a":"من صفحة التواصل والدعم عبر النموذج، أو مباشرة عبر تيك توك وتيليجرام وواتساب."}]')
on conflict (key) do nothing;
