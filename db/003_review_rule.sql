-- التقييم يتطلب صلاحية فعلية على المنتج (مشاهدة درس تجريبي مجاني لا تكفي لتقييم كورس مدفوع)
create or replace function can_review(pid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select app_uid() is not null and not app_is_banned() and has_access(pid) and (
    exists(select 1 from downloads where product_id = pid and user_id = app_uid())
    or exists(select 1 from purchases where product_id = pid and user_id = app_uid() and status in ('paid','test'))
    or exists(select 1 from lesson_progress lp join lessons l on l.id = lp.lesson_id where l.product_id = pid and lp.user_id = app_uid()))
$$;
