-- 006: قياسات الأداء الحقيقية (RUM) + أخطاء الواجهة + مفتاح توقيع وكيل Netlify (للثقة بعنوان العميل في الفخاخ)
create table if not exists perf_samples (
  id bigserial primary key,
  at timestamptz not null default now(),
  page text not null check (length(page) <= 40),
  mobile boolean not null default true,
  device text not null check (device in ('low', 'mid', 'high')),
  q smallint check (q between 1 and 8),
  lcp int check (lcp between 0 and 60000), fcp int check (fcp between 0 and 60000), ttfb int check (ttfb between 0 and 60000),
  inp int check (inp between 0 and 10000), cls real check (cls between 0 and 10),
  api_ms int check (api_ms between 0 and 60000), db_ms int check (db_ms between 0 and 60000), heap_mb int check (heap_mb between 0 and 8192)
);
create index if not exists perf_samples_at on perf_samples(at);
create table if not exists client_errors (
  id bigserial primary key,
  at timestamptz not null default now(),
  page text not null default 'other' check (length(page) <= 40),
  msg text not null check (length(msg) between 1 and 200),
  src text not null default '' check (length(src) <= 80),
  line int not null default 0
);
create index if not exists client_errors_at on client_errors(at);
alter table perf_samples enable row level security;
alter table client_errors enable row level security;
grant insert, select, delete on perf_samples, client_errors to store_api;
grant usage on sequence perf_samples_id_seq, client_errors_id_seq to store_api;
drop policy if exists perf_ins on perf_samples; create policy perf_ins on perf_samples for insert to store_api with check (true);
drop policy if exists perf_sel on perf_samples; create policy perf_sel on perf_samples for select to store_api using (app_is_admin());
drop policy if exists perf_del on perf_samples; create policy perf_del on perf_samples for delete to store_api using (app_is_admin());
drop policy if exists cerr_ins on client_errors; create policy cerr_ins on client_errors for insert to store_api with check (true);
drop policy if exists cerr_sel on client_errors; create policy cerr_sel on client_errors for select to store_api using (app_is_admin());
drop policy if exists cerr_del on client_errors; create policy cerr_del on client_errors for delete to store_api using (app_is_admin());
insert into ops.secrets(name, value) values ('edge_sign_v1', convert_to(encode(gen_random_bytes(32), 'hex'), 'UTF8')) on conflict (name) do nothing;
