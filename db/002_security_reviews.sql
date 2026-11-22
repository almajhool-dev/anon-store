-- سجل أمني مع تنبيه المدير، مراجعات عامة، ومنع تحميل الملفات المشبوهة
create or replace function log_security(p_ip text, p_kind text, p_sev text, p_method text, p_path text, p_ua text, p_uid uuid, p_detail jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_sev not in ('low','medium','high','critical') then p_sev := 'medium'; end if;
  insert into security_events(ip, kind, severity, method, path, ua, user_id, detail)
  values (left(p_ip, 64), left(p_kind, 40), p_sev, left(p_method, 10), left(p_path, 500), left(p_ua, 300), p_uid, coalesce(p_detail, '{}'));
  if p_sev in ('high','critical') and not exists (
    select 1 from notifications where for_admins and kind = 'security' and created_at > now() - interval '10 minutes' and body like 'IP: ' || p_ip || ' %') then
    insert into notifications(kind, title, body, for_admins)
    values ('security', 'تنبيه أمني: ' || p_kind, 'IP: ' || p_ip || ' | ' || p_sev || ' | ' || left(coalesce(p_path, ''), 200), true);
  end if;
end $$;

create or replace function public_reviews(pid uuid, lim int default 30)
returns table(id uuid, rating int, body text, created_at timestamptz, author text, avatar text, mine boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.body, r.created_at, coalesce(pr.name, 'مستخدم'), pr.avatar, r.user_id = app_uid()
  from reviews r join products p on p.id = r.product_id left join profiles pr on pr.id = r.user_id
  where r.product_id = pid and (p.status = 'published' or app_is_admin())
  order by r.created_at desc limit least(greatest(lim, 1), 100)
$$;

create or replace function record_download(pid uuid, fid uuid, vis text)
returns table(object_key text, file_name text, size_bytes bigint, mime text)
language plpgsql security definer set search_path = public as $$
declare f files;
begin
  if not has_access(pid) then raise exception 'no_access'; end if;
  select * into f from files x where x.product_id = pid and x.status = 'ready' and x.purpose = 'product'
    and x.scan_status <> 'flagged' and ((fid is null and x.is_current) or x.id = fid) order by x.created_at desc limit 1;
  if not found then raise exception 'file_not_found'; end if;
  if not exists (select 1 from downloads d where d.product_id = pid and d.created_at > now() - interval '1 day'
      and ((app_uid() is not null and d.user_id = app_uid()) or (app_uid() is null and d.visitor = vis))) then
    update products set downloads = downloads + 1 where id = pid;
  end if;
  insert into downloads(user_id, product_id, file_id, visitor) values (app_uid(), pid, f.id, vis);
  return query select f.object_key, f.file_name, f.size_bytes, f.mime;
end $$;

grant execute on all functions in schema public to store_api;
alter default privileges in schema public grant execute on functions to store_api;
alter default privileges in schema public grant select, insert, update, delete on tables to store_api;
alter default privileges in schema public grant usage, select on sequences to store_api;
