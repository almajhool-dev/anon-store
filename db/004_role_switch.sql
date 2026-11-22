-- تسمح للدالة باستخدام اتصال Neon المحقون ثم النزول لصلاحيات store_api في كل معاملة (SET LOCAL ROLE)
-- فلا تحتاج الواجهة الخلفية لأي كلمة مرور مخزنة يدوياً
grant store_api to neondb_owner;
