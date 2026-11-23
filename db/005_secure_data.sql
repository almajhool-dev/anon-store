-- طبقة تشفير إضافية للبيانات الخاصة (AES-256-GCM داخل الخادم) + سجل أجهزة دخول المالك/المدير
create extension if not exists pgcrypto;
create schema if not exists ops;
revoke all on schema ops from public;
-- مفتاح 256-bit عشوائي يُولَّد داخل قاعدة البيانات ولا يظهر لأحد؛ دور store_api لا يملك أي صلاحية على ops
create table if not exists ops.secrets (name text primary key, value bytea not null, created_at timestamptz not null default now());
insert into ops.secrets(name, value) values ('data_key_v1', gen_random_bytes(32)) on conflict (name) do nothing;
create table if not exists ops.admin_devices (
  uid uuid not null, ua_hash text not null, ua text,
  first_seen timestamptz not null default now(), last_seen timestamptz not null default now(),
  primary key (uid, ua_hash)
);
revoke all on all tables in schema ops from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'store_api') then
    execute 'revoke all on schema ops from store_api';
    execute 'revoke all on all tables in schema ops from store_api';
  end if;
end $$;
-- النص المشفّر أطول من الأصلي: توسيع حدود الطول (الخادم يتحقق من طول النص الأصلي قبل التشفير)
alter table messages drop constraint if exists messages_email_check, drop constraint if exists messages_body_check, drop constraint if exists messages_reply_check;
alter table messages drop constraint if exists messages_email_len, drop constraint if exists messages_body_len, drop constraint if exists messages_reply_len;
alter table messages add constraint messages_email_len check (email is null or char_length(email) <= 800),
  add constraint messages_body_len check (char_length(body) between 1 and 24000),
  add constraint messages_reply_len check (reply is null or char_length(reply) <= 24000);
alter table purchases drop constraint if exists purchases_note_check, drop constraint if exists purchases_note_len;
alter table purchases add constraint purchases_note_len check (note is null or char_length(note) <= 6000);
alter table notifications drop constraint if exists notifications_body_check, drop constraint if exists notifications_body_len;
alter table notifications add constraint notifications_body_len check (char_length(body) <= 24000);
