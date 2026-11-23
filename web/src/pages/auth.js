// الدخول وإنشاء الحساب واستعادة كلمة السر: بطاقة زجاجية، خلفية ضوئية متحركة، وانتقال "تحوّل" بين الأوضاع
import { html, mount, toast, busy, $, raw, safeUrl } from '../lib/dom.js';
import { auth } from '../lib/core.js';
import { icon, LOGO } from '../lib/art.js';
import { play } from '../lib/transitions.js';

const GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const ERR = {
  INVALID_EMAIL_OR_PASSWORD: 'البريد أو كلمة السر غير صحيحة', USER_ALREADY_EXISTS: 'هذا البريد مسجّل مسبقاً — سجّل الدخول أو استعد كلمة السر',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'هذا البريد مسجّل مسبقاً — سجّل الدخول أو استعد كلمة السر', EMAIL_NOT_VERIFIED: 'أكّد بريدك أولاً — أرسلنا لك رمزاً جديداً',
  INVALID_OTP: 'الرمز غير صحيح', OTP_EXPIRED: 'انتهت صلاحية الرمز — اطلب رمزاً جديداً', TOO_MANY_ATTEMPTS: 'محاولات كثيرة — اطلب رمزاً جديداً',
  PASSWORD_TOO_SHORT: 'كلمة السر قصيرة (8 أحرف على الأقل)', PASSWORD_TOO_LONG: 'كلمة السر طويلة جداً', INVALID_EMAIL: 'البريد الإلكتروني غير صالح',
  RATE_LIMIT: 'محاولات كثيرة، انتظر دقيقة ثم حاول مجدداً',
};
const say = (e) => ERR[e.code] || (e.status === 429 ? ERR.RATE_LIMIT : 'تعذر إكمال العملية، حاول مجدداً');
const PATHS = { signin: '/login', signup: '/signup', forgot: '/forgot' };
const TITLES = { signin: 'تسجيل الدخول', signup: 'إنشاء حساب', verify: 'تأكيد البريد', forgot: 'استعادة الحساب', reset: 'كلمة سر جديدة' };
const RECT = 'polygon(0% 0%, 100% 0%, 100% 0%, 100% 100%, 100% 100%, 0% 100%, 0% 100%, 0% 0%)';
const OCT = 'polygon(13% 0%, 87% 0%, 100% 9%, 100% 91%, 87% 100%, 13% 100%, 0% 91%, 0% 9%)';
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const okEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

const field = (name, label, ic, type = 'text', ac = '', extra = '') => html`<div class="a-in">${icon(ic)}
  <input id="a-${name}" name="${name}" type="${type}" placeholder=" " autocomplete="${ac}" ${raw(extra)} required><label for="a-${name}">${label}</label>
  ${type === 'password' ? html`<button type="button" class="a-eye" data-eye aria-label="إظهار كلمة السر">${icon('eye')}</button>` : ''}</div>`;
const otpBoxes = () => html`<div class="a-otp" dir="ltr">${[0, 1, 2, 3, 4, 5].map((i) => html`<input inputmode="numeric" maxlength="1" aria-label="رقم ${i + 1}" ${raw(i ? '' : 'autocomplete="one-time-code"')}>`)}</div>`;

export default async function (view, m, { state, go, setTitle }) {
  const next = new URLSearchParams(location.search).get('next') || '';
  const dest = /^\/(?![/\\])/.test(next) ? next : '/account';
  if (auth.signedIn && state.me) { go(dest, true); return; }
  const site = state.settings.site, closed = site.registration_enabled === false;
  let mode = m[1] === 'signup' ? 'signup' : m[1] === 'forgot' ? 'forgot' : 'signin', email = '', cooldown = 0, busyMorph = false;

  const social = () => html`<div class="a-or">أو</div><div class="a-soc"><button type="button" data-google>${raw(GOOGLE)} المتابعة بحساب Google</button></div>`;
  const MODES = {
    signin: () => html`<h1 class="a-title">مرحباً <span>بعودتك</span></h1><p class="a-sub">سجّل دخولك لمتابعة مشترياتك وتحميلاتك</p>
      <form class="a-form" data-f="signin" novalidate>${field('email', 'البريد الإلكتروني', 'mail', 'email', 'username', `value="${email.replace(/"/g, '')}"`)}${field('password', 'كلمة السر', 'lock', 'password', 'current-password')}
        <div class="a-row"><label class="a-check"><input type="checkbox" name="remember" checked><i></i> تذكّرني</label><button type="button" class="a-link" data-go="forgot">نسيت كلمة السر؟</button></div>
        <button class="a-btn">تسجيل الدخول ${icon('send')}</button></form>${social()}
      <p class="a-foot">ليس لديك حساب؟ <button type="button" class="a-link" data-go="signup">أنشئ حساباً</button></p>`,
    signup: () => html`<h1 class="a-title">إنشاء <span>حساب</span></h1><p class="a-sub">حساب مجاني بخطوة واحدة — سيصلك رمز تأكيد على بريدك</p>
      ${closed ? html`<p class="a-note">${icon('lock')} التسجيل الجديد مغلق حالياً</p>` : ''}
      <form class="a-form" data-f="signup" novalidate>${field('name', 'الاسم', 'user', 'text', 'name', 'maxlength="60"')}${field('email', 'البريد الإلكتروني', 'mail', 'email', 'email', `value="${email.replace(/"/g, '')}"`)}
        <div class="a-two">${field('password', 'كلمة السر', 'lock', 'password', 'new-password', 'minlength="8"')}${field('confirm', 'تأكيد كلمة السر', 'lock', 'password', 'new-password')}</div>
        <div class="a-meter" aria-hidden="true"><i></i></div>
        <label class="a-check"><input type="checkbox" name="terms"><i></i> أوافق على شروط الاستخدام وسياسة الخصوصية</label>
        <button class="a-btn" ${closed ? 'disabled' : ''}>إنشاء الحساب ${icon('send')}</button></form>${social()}
      <p class="a-foot">لديك حساب؟ <button type="button" class="a-link" data-go="signin">سجّل الدخول</button></p>`,
    verify: () => html`<h1 class="a-title">تأكيد <span>البريد</span></h1><p class="a-sub">أدخل الرمز المكوّن من 6 أرقام المرسل إلى<br><b class="ltr">${email}</b></p>
      <form class="a-form" data-f="verify" novalidate>${otpBoxes()}<button class="a-btn">تأكيد ومتابعة ${icon('check')}</button></form>
      <p class="a-foot">لم يصلك؟ تحقق من البريد المزعج أو <button type="button" class="a-link" data-resend="email-verification">أعد الإرسال</button></p>
      <p class="a-foot"><button type="button" class="a-link" data-go="signin">رجوع لتسجيل الدخول</button></p>`,
    forgot: () => html`<h1 class="a-title">استعادة <span>الحساب</span></h1><p class="a-sub">اكتب بريدك وسنرسل لك رمزاً لتغيير كلمة السر</p>
      <form class="a-form" data-f="forgot" novalidate>${field('email', 'البريد الإلكتروني', 'mail', 'email', 'email', `value="${email.replace(/"/g, '')}"`)}<button class="a-btn">إرسال الرمز ${icon('send')}</button></form>
      <p class="a-foot">تذكّرت كلمة السر؟ <button type="button" class="a-link" data-go="signin">سجّل الدخول</button></p>`,
    reset: () => html`<h1 class="a-title">كلمة سر <span>جديدة</span></h1><p class="a-sub">أدخل الرمز المرسل إلى <b class="ltr">${email}</b> ثم كلمة السر الجديدة</p>
      <form class="a-form" data-f="reset" novalidate>${otpBoxes()}<div class="a-two">${field('password', 'كلمة السر الجديدة', 'lock', 'password', 'new-password', 'minlength="8"')}${field('confirm', 'تأكيدها', 'lock', 'password', 'new-password')}</div>
        <div class="a-meter" aria-hidden="true"><i></i></div><button class="a-btn">تغيير كلمة السر ${icon('check')}</button></form>
      <p class="a-foot">لم يصلك؟ <button type="button" class="a-link" data-resend="forget-password">أعد الإرسال</button></p>`,
  };

  mount(view, html`<section class="auth"><div class="a-bg" aria-hidden="true"><b></b><b></b><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="a-stage"><span class="a-orb" aria-hidden="true"></span><div class="a-card">
      <a class="a-logo" href="/" aria-label="الرئيسية">${site.logo_url ? html`<img src="${safeUrl(site.logo_url)}" alt="">` : raw(LOGO)}</a>
      <div class="a-body"></div><p class="a-safe">${icon('shield')} اتصال مشفّر — كلمات السر لا تُحفظ إلا مُجزّأة</p></div></div></section>`);
  const card = $('.a-card', view), body = $('.a-body', view), orb = $('.a-orb', view);

  const draw = () => {
    setTitle(TITLES[mode]);
    if (PATHS[mode]) history.replaceState(history.state, '', PATHS[mode] + location.search);
    mount(body, MODES[mode]());
    body.querySelector('input:not([type=checkbox])')?.focus({ preventScroll: true });
  };
  const enter = () => {
    const key = site.anim?.auth || 'morph';
    [...body.children].forEach((el, i) => {
      if (key === 'morph' || !play(el, key, { delay: i * 50 })) el.animate?.([{ opacity: 0, transform: 'translateY(14px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: reduce() ? 0 : 460, delay: 60 + i * 55, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    });
  };
  // الانتقال بين الأوضاع: خروج المحتوى → تحوّل شكل البطاقة مع نقطة ضوء تدور على الحافة → دخول المحتوى الجديد
  async function to(next) {
    if (busyMorph || next === mode) return;
    busyMorph = true;
    const fast = reduce();
    if (!fast) await Promise.all([...body.children].map((el, i) => el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)', filter: 'blur(6px)' }], { duration: 200, delay: i * 22, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {})));
    const h0 = card.offsetHeight;
    if (!fast && (site.anim?.auth || 'morph') === 'morph') {
      const shape = card.animate([{ clipPath: RECT }, { clipPath: OCT, offset: 0.45 }, { clipPath: OCT, offset: 0.6 }, { clipPath: RECT }], { duration: 950, easing: 'cubic-bezier(.65,0,.35,1)' });
      orb.animate([{ left: '50%', top: '0%', opacity: 0 }, { left: '100%', top: '0%', opacity: 1, offset: 0.15 }, { left: '100%', top: '100%', offset: 0.45 }, { left: '0%', top: '100%', offset: 0.7 }, { left: '0%', top: '0%', offset: 0.9 }, { left: '50%', top: '0%', opacity: 0 }], { duration: 950, easing: 'linear' });
      await wait(430);
      mode = next; draw();
      const h1 = card.offsetHeight;
      card.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
      enter();
      await shape.finished.catch(() => {});
    } else {
      mode = next; draw();
      if (!fast) card.animate([{ height: h0 + 'px' }, { height: card.offsetHeight + 'px' }], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' });
      enter();
    }
    busyMorph = false;
  }
  const success = async (msg) => {
    toast(msg, 'ok');
    if (!reduce()) await card.animate([{ transform: 'none', filter: 'none' }, { transform: 'scale(1.03)', filter: 'brightness(1.3)', offset: 0.4 }, { transform: 'scale(.96)', opacity: 0, filter: 'blur(8px)' }], { duration: 650, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    location.assign(dest); // تحميل كامل حتى تبدأ الجلسة الجديدة نظيفة
  };
  const otpValue = (f) => [...f.querySelectorAll('.a-otp input')].map((i) => i.value).join('');
  const strong = (f) => {
    const p = f.password?.value || '', bar = f.querySelector('.a-meter i');
    const s = [p.length >= 8, /[A-Z]/.test(p) && /[a-z]/.test(p), /\d/.test(p), /[^\w\s]/.test(p), p.length >= 12].filter(Boolean).length;
    if (bar) { bar.style.setProperty('--w', `${(s / 5) * 100}%`); bar.dataset.s = String(s); }
  };
  const sendCode = async (type) => {
    if (cooldown > Date.now()) return toast(`انتظر ${Math.ceil((cooldown - Date.now()) / 1000)} ثانية قبل إعادة الإرسال`);
    try { await auth.email.sendOtp(email, type); cooldown = Date.now() + 60000; toast('أرسلنا رمزاً جديداً إلى بريدك ✉️', 'ok'); } catch (e) { toast(say(e), 'error'); }
  };

  view.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.go) return to(b.dataset.go);
    if ('eye' in b.dataset) { const i = b.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; return; }
    if ('resend' in b.dataset) return sendCode(b.dataset.resend);
    if ('google' in b.dataset) {
      busy(b, true);
      try { await auth.google(dest); } catch { toast('تعذر بدء الدخول بحساب Google', 'error'); busy(b, false); }
    }
  });
  view.addEventListener('input', (e) => {
    const t = e.target, f = t.form;
    if (t.closest('.a-otp')) {
      const boxes = [...t.parentElement.children], i = boxes.indexOf(t), d = t.value.replace(/\D/g, '');
      if (d.length > 1) { d.slice(0, 6).split('').forEach((c, j) => { if (boxes[j]) boxes[j].value = c; }); boxes[Math.min(5, d.length - 1)].focus(); }
      else { t.value = d; if (d && boxes[i + 1]) boxes[i + 1].focus(); }
      if (otpValue(f).length === 6 && f.dataset.f === 'verify') f.requestSubmit();
    }
    if (f && t.name === 'password') strong(f);
  });
  view.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key === 'Backspace' && t.closest('.a-otp') && !t.value) t.previousElementSibling?.focus();
  });
  view.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('.a-btn'), v = (n) => (f[n]?.value || '').trim();
    const fail = (msg) => { toast(msg, 'error'); f.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }], { duration: 360 }); };
    busy(btn, true);
    try {
      if (f.dataset.f === 'signin') {
        email = v('email');
        if (!okEmail(email) || !f.password.value) return fail('اكتب بريداً صحيحاً وكلمة السر');
        try { await auth.email.signIn(email, f.password.value, f.remember.checked); }
        catch (er) { if (er.code === 'EMAIL_NOT_VERIFIED') { toast(say(er)); return to('verify'); } throw er; }
        return await success('أهلاً بعودتك 👋');
      }
      if (f.dataset.f === 'signup') {
        email = v('email');
        if (v('name').length < 2) return fail('اكتب اسمك (حرفين على الأقل)');
        if (!okEmail(email)) return fail(ERR.INVALID_EMAIL);
        if (f.password.value.length < 8) return fail(ERR.PASSWORD_TOO_SHORT);
        if (f.password.value !== f.confirm.value) return fail('كلمتا السر غير متطابقتين');
        if (!f.terms.checked) return fail('يجب الموافقة على الشروط');
        await auth.email.signUp(v('name'), email, f.password.value);
        cooldown = Date.now() + 60000;
        toast('أرسلنا رمز التأكيد إلى بريدك ✉️', 'ok');
        return to('verify');
      }
      if (f.dataset.f === 'verify') {
        const code = otpValue(f);
        if (code.length !== 6) return fail('أدخل الرمز كاملاً (6 أرقام)');
        await auth.email.verify(email, code);
        return await success('تم تأكيد بريدك وإنشاء حسابك 🎉');
      }
      if (f.dataset.f === 'forgot') {
        email = v('email');
        if (!okEmail(email)) return fail(ERR.INVALID_EMAIL);
        await auth.email.sendOtp(email, 'forget-password');
        cooldown = Date.now() + 60000;
        toast('إذا كان البريد مسجّلاً سيصلك رمز خلال لحظات ✉️', 'ok');
        return to('reset');
      }
      if (f.dataset.f === 'reset') {
        const code = otpValue(f);
        if (code.length !== 6) return fail('أدخل الرمز كاملاً (6 أرقام)');
        if (f.password.value.length < 8) return fail(ERR.PASSWORD_TOO_SHORT);
        if (f.password.value !== f.confirm.value) return fail('كلمتا السر غير متطابقتين');
        await auth.email.reset(email, code, f.password.value);
        toast('تم تغيير كلمة السر ✅ — سجّل الدخول بها الآن', 'ok');
        return to('signin');
      }
    } catch (er) { fail(say(er)); } finally { if (btn.isConnected) busy(btn, false); }
  });

  draw();
  if (!reduce()) card.animate([{ opacity: 0, transform: 'translateY(26px) scale(.97)', filter: 'blur(10px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)' });
  enter();
}
