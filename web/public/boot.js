// حارس الإقلاع: إن فشل تحميل حزمة الموقع (شبكة متقطعة أو خطأ مؤقت) نعيد المحاولة مرة تلقائياً،
// ثم نعرض رسالة وزر إعادة المحاولة بدل صفحة فارغة. main.js يضع window.__boot عند تحميله.
(function () {
  function check() {
    if (window.__boot) return;
    var again = false;
    try {
      if (Date.now() - Number(sessionStorage.getItem('boot_retry') || 0) > 30000) { sessionStorage.setItem('boot_retry', String(Date.now())); again = true; }
    } catch (e) { /* بلا تخزين: لا إعادة تلقائية حتى لا تتكرر بلا نهاية */ }
    if (again) { location.reload(); return; }
    var box = document.createElement('div'), p = document.createElement('p'), b = document.createElement('button');
    p.textContent = 'تعذّر تحميل الموقع. تأكد من الاتصال ثم أعد المحاولة.';
    b.type = 'button'; b.textContent = 'إعادة المحاولة';
    b.addEventListener('click', function () { location.reload(); });
    Object.assign(box.style, { position: 'fixed', inset: '0', display: 'grid', placeContent: 'center', gap: '14px', textAlign: 'center', padding: '24px', background: '#05060b', color: '#e8ebf7', fontFamily: 'system-ui, sans-serif', zIndex: '2147483647' });
    Object.assign(b.style, { justifySelf: 'center', padding: '10px 22px', border: '0', borderRadius: '12px', background: '#18b4ff', color: '#05060b', fontWeight: '700', fontSize: '15px', cursor: 'pointer' });
    box.setAttribute('role', 'alert'); box.append(p, b); document.body.append(box);
  }
  if (document.readyState === 'complete') check(); else addEventListener('load', check);
})();
