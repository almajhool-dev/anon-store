// صفحات: التواصل والدعم، الأسئلة الشائعة، تسجيل الدخول، تفعيل حساب المالك
import { html, raw, mount, toast, busy, $ } from '../lib/dom.js';
import { api, auth } from '../lib/core.js';
import { icon, LOGO } from '../lib/art.js';
import { socialLinks } from '../main.js';

const nextPath = () => { const n = new URLSearchParams(location.search).get('next') || '/account'; return /^\/(?!\/)[\w\-/?=&#.%]*$/.test(n) ? n : '/account'; };

function contact(view, { state, setTitle }) {
  setTitle('التواصل والدعم');
  const so = state.settings.social || {};
  const handle = { TikTok: '@termax_whot.is', Telegram: '@HIKR7', WhatsApp: '+966 59 805 2773' };
  mount(view, html`<div class="container page"><h1>تواصل مع <span class="gradient-text">المبرمج المجهول</span></h1><p class="muted">اختر الطريقة المناسبة لك — الرد عادةً خلال ساعات.</p>
    <div class="social mt">${socialLinks(so).map(([u, i, t]) => html`<a class="card soc reveal" href="${u}" target="_blank" rel="noopener">${icon(i)}<div><b>${t}</b><span>${handle[t] || u.replace('https://', '')}</span></div></a>`)}</div>
    <div class="card pad mt2 reveal"><h2>${icon('mail')} نموذج الدعم</h2>
      <form id="cform" novalidate><div class="fgrid"><label class="field"><span>الاسم</span><input class="input" name="name" required maxlength="100" value="${state.me?.name || ''}"></label>
        <label class="field"><span>البريد (اختياري للرد)</span><input class="input ltr" type="email" name="email" maxlength="200" value="${state.me?.email || ''}"></label></div>
        <label class="field"><span>الموضوع</span><input class="input" name="subject" required minlength="2" maxlength="200"></label>
        <label class="field"><span>الرسالة</span><textarea class="input" name="body" required minlength="5" maxlength="5000"></textarea></label>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn primary">${icon('send')} إرسال</button></form></div></div>`);
  const t0 = Date.now();
  $('#cform', view).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), b = e.target.querySelector('button');
    if (!f.name.trim() || f.subject.trim().length < 2 || f.body.trim().length < 5) return toast('أكمل الحقول المطلوبة', 'warn');
    busy(b, true);
    try { await api.post('/messages', { ...f, t: Date.now() - t0 }); toast('تم إرسال رسالتك بنجاح ✅', 'ok'); e.target.reset(); } catch (er) { toast(er.message, 'error'); } finally { busy(b, false); }
  });
}

function faq(view, { state, setTitle }) {
  setTitle('الأسئلة الشائعة');
  const items = state.settings.faq || [];
  mount(view, html`<div class="container page"><h1>الأسئلة <span class="gradient-text">الشائعة</span></h1>
    <div class="list mt">${items.map((x, i) => html`<details class="card pad reveal" ${i ? '' : 'open'}><summary><b>${x.q}</b></summary><p class="muted mt">${x.a}</p></details>`)}</div>
    <div class="card pad mt2 center"><p>لم تجد إجابتك؟</p><a class="btn primary" href="/contact">${icon('chat')} تواصل معنا</a></div></div>`);
}

function login(view, { state, go, setTitle }) {
  setTitle('تسجيل الدخول');
  if (auth.signedIn && state.me) { go(nextPath(), true); return; }
  const closed = state.settings.site.registration_enabled === false;
  mount(view, html`<div class="container page"><div class="card pad glow center">
    <div class="hero-logo">${raw(LOGO)}</div><h1>تسجيل الدخول</h1><p class="muted">ادخل بحساب Google بأمان — يُنشأ حسابك تلقائياً عند أول دخول.</p>
    ${closed ? html`<p class="badge warn">التسجيل الجديد مغلق حالياً — الحسابات الحالية فقط</p>` : ''}
    <button class="btn primary lg mt" id="g">${icon('key')} المتابعة باستخدام Google</button>
    <p class="muted small mt">${icon('shield')} لا نخزّن كلمات مرور. الجلسات قصيرة العمر وموقّعة.</p></div></div>`);
  $('#g', view).onclick = async (e) => {
    busy(e.currentTarget, true);
    try { await auth.google(nextPath()); } catch (er) { toast(er.message || 'تعذر بدء تسجيل الدخول', 'error'); busy(e.currentTarget, false); }
  };
}

function claim(view, { state, go, refreshMe, setTitle }) {
  setTitle('تفعيل حساب المالك');
  const fromHash = location.hash.slice(1);
  if (fromHash) { sessionStorage.setItem('owner-claim', fromHash); history.replaceState(null, '', '/claim'); }
  const token = sessionStorage.getItem('owner-claim');
  mount(view, html`<div class="container page"><div class="card pad glow center">${icon('shield')}<h1>تفعيل حساب المالك</h1>
    ${!token ? html`<p class="muted">رابط التفعيل غير مكتمل.</p>` : !auth.signedIn ? html`<p class="muted">سجّل الدخول بحساب Google الذي تريده مالكاً للمتجر، ثم ستعود لهذه الصفحة.</p><button class="btn primary" id="in">${icon('key')} الدخول بـ Google</button>`
    : html`<p class="muted">سيصبح الحساب <b class="ltr">${state.me?.email}</b> مالك المتجر بصلاحيات كاملة. هذا الرابط يُستخدم مرة واحدة فقط.</p><button class="btn primary lg" id="go">${icon('check')} تفعيل الآن</button>`}</div></div>`);
  $('#in', view)?.addEventListener('click', () => auth.google('/claim'));
  $('#go', view)?.addEventListener('click', async (e) => {
    busy(e.currentTarget, true);
    try { await api.post('/admin/claim', { token }); sessionStorage.removeItem('owner-claim'); toast('تم تفعيل حساب المالك ✅', 'ok'); await refreshMe(); go('/admin'); }
    catch (er) { toast(er.message, 'error'); busy(e.currentTarget, false); }
  });
}

export default function (view, m, ctx) {
  return { contact, faq, login, claim }[m[1]](view, ctx);
}
