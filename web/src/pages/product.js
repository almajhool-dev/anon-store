import { html, mount, actions, toast, modal, busy, confirmBox, safeUrl } from '../lib/dom.js';
import { api, fmtNum, fmtBytes, fmtDate, fmtPrice, fmtDur, KINDS } from '../lib/core.js';
import { icon } from '../lib/art.js';
import { cover, price, stars, avgRating, saleOn, countdown, richText, loader, errorBox, empty } from '../lib/ui.js';

const STATUS = { pending: ['بانتظار الدفع', 'warn'], paid: ['مدفوع', 'ok'], test: ['شراء تجريبي', 'info'] };

export function orderModal(order, title, info) {
  const wa = info.contacts?.whatsapp, tg = info.contacts?.telegram;
  const msg = encodeURIComponent(`مرحباً، أريد إتمام الطلب رقم ${order.reference} — ${title} (${fmtPrice(order.amount, order.currency)})`);
  const m = modal(html`<h3 class="m-title">${icon('cart')} طلبك جاهز</h3>
    <p class="muted">رقم الطلب المرجعي:</p><div class="code-box">${order.reference}</div>
    <dl class="kv"><dt>المنتج</dt><dd>${title}</dd><dt>المبلغ</dt><dd>${fmtPrice(order.amount, order.currency)}</dd><dt>الحالة</dt><dd>${STATUS[order.status]?.[0] || order.status}</dd></dl>
    <p class="mt">${info.instructions || ''}</p>
    <div class="row wrap gap mt">${wa ? html`<a class="btn primary" target="_blank" rel="noopener" href="${safeUrl(wa)}?text=${msg}">${icon('chat')} إكمال الدفع عبر واتساب</a>` : ''}
    ${tg ? html`<a class="btn" target="_blank" rel="noopener" href="${safeUrl(tg)}">${icon('send')} تيليجرام</a>` : ''}<button class="btn ghost" data-copy>نسخ الرقم</button></div>
    <p class="muted small mt">يتفعّل التحميل تلقائياً بعد تأكيد الدفع، وستصلك رسالة في إشعاراتك.</p>`, { wide: true });
  m.el.querySelector('[data-copy]').onclick = () => navigator.clipboard?.writeText(order.reference).then(() => toast('تم النسخ', 'ok'));
}

export function startDownload(url) {
  const a = document.createElement('a');
  a.href = url; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
}

// ملفات APK: خطوات التثبيت وحل رسالة «الحزمة تبدو غير صالحة» (ملفات الموقع سليمة؛ السبب غالباً نسخة مثبّتة مسبقاً بتوقيع مختلف أو أحدث)
const apkHelp = (f) => (/\.apk$/i.test(f.file_name || '') ? html`<details class="card pad mt apk-help"><summary>${icon('shield')} طريقة التثبيت وحل «الحزمة تبدو غير صالحة»</summary>
  <ol class="small">
    <li>انتظر اكتمال التحميل ثم افتح الملف من إشعار التنزيل أو من «الملفات ← التنزيلات».</li>
    <li>إن طلب الهاتف ذلك، اسمح للمتصفح بـ«تثبيت التطبيقات غير المعروفة».</li>
    <li>إن ظهرت «لم يتم تثبيت التطبيق لأن الحزمة تبدو غير صالحة»: التطبيق موجود على هاتفك بنسخة أحدث أو بتوقيع مختلف — احذف النسخة المثبّتة أولاً ثم ثبّت الملف من جديد (يُحذف معها ما حُفظ داخل الهاتف فقط).</li>
    <li>حمّل من متصفح Chrome، لا من المتصفح الداخلي لتيك توك أو إنستغرام.</li>
  </ol></details>` : '');

export default async function (view, m, { state, go, setTitle, isAdmin }) {
  mount(view, loader());
  let d;
  const load = async () => { d = await api.get('/products/' + m[1]); };
  try { await load(); } catch (e) {
    mount(view, html`<div class="container page">${e.status === 404 ? empty('المنتج غير موجود أو غير منشور', 'search') : errorBox(e, false)}</div>`);
    return;
  }

  function render() {
    const p = d.product, me = d.me || {}, k = KINDS[p.kind] || {};
    setTitle(p.title);
    const free = !Number(p.price), media = ['course', 'video'].includes(p.kind);
    const current = d.files.find((f) => f.is_current) || d.files[0];
    const previews = d.lessons.filter((l) => l.is_preview && l.has_video).length;
    const imgs = [p.cover_url, ...(p.gallery || [])].filter(Boolean);
    const storeOff = state.settings.site.store_enabled === false;
    const pend = me.purchase?.status === 'pending';
    let cta;
    if (me.access) {
      cta = html`${media ? html`<a class="btn primary block lg" href="/learn/${p.slug}">${icon('play')} ابدأ المشاهدة</a>` : ''}
        ${current ? html`<button class="btn ${media ? '' : 'primary lg'} block" data-act="dl">${icon('download')} تحميل ${current.version ? 'الإصدار ' + current.version : ''}</button>${apkHelp(current)}` : (media ? '' : html`<p class="muted small mt">لم يُرفع ملف لهذا المنتج بعد.</p>`)}`;
    } else if (pend) {
      cta = html`<div class="card pad mt"><b>${icon('clock')} طلبك بانتظار تأكيد الدفع</b><p class="muted small">الرقم المرجعي: <span class="ltr">${me.purchase.reference}</span></p>
        <button class="btn primary block" data-act="buy">إكمال الدفع</button><button class="btn ghost block" data-act="cancel">إلغاء الطلب</button></div>`;
    } else if (!me.signed_in) {
      cta = html`<a class="btn primary block lg" href="/login?next=${encodeURIComponent(location.pathname)}">${icon('key')} سجّل الدخول للشراء</a>`;
    } else {
      cta = html`<button class="btn primary block lg" data-act="buy" ${storeOff ? 'disabled' : ''}>${icon('cart')} ${storeOff ? 'المتجر متوقف مؤقتاً' : 'شراء الآن'}</button>`;
    }
    if (!me.access && media && previews) cta = html`${cta}<a class="btn block" href="/learn/${p.slug}">${icon('eye')} شاهد الدروس المجانية (${previews})</a>`;
    if (!me.access && !free && isAdmin()) cta = html`${cta}<button class="btn ghost block" data-act="testbuy">${icon('shield')} شراء تجريبي (بيئة اختبار للمدير)</button>`;

    mount(view, html`<div class="container page" data-sec="product">
      <p class="muted small"><a href="/">الرئيسية</a> / <a href="${k.path}">${k.plural}</a> / ${p.title}</p>
      <div class="split">
        <div>
          <div class="card media reveal">${imgs.length ? html`<img class="main" id="mainimg" src="${safeUrl(imgs[0])}" alt="">` : html`<div class="main">${cover(p)}</div>`}
            ${imgs.length > 1 ? html`<div class="thumbs">${imgs.map((u, i) => html`<img src="${safeUrl(u)}" alt="" data-act="img" data-i="${i}" class="${i ? '' : 'on'}" loading="lazy">`)}</div>` : ''}</div>
          <div class="mt2"><div class="row wrap"><span class="badge info">${k.label}</span>${p.featured ? html`<span class="badge warn">${icon('star')} مميز</span>` : ''}${free ? html`<span class="badge ok">مجاني</span>` : ''}</div>
            <h1 class="mt">${p.title}</h1><p class="muted">${p.summary}</p>
            <div class="row wrap gap muted small">${p.rating_count ? html`${stars(avgRating(p))} ${avgRating(p).toFixed(1)} (${p.rating_count})` : ''}<span>${icon('download')} ${fmtNum(p.downloads)} تحميل</span><span>${icon('eye')} ${fmtNum(p.views)} مشاهدة</span></div></div>
          ${p.description ? html`<div class="card pad mt prose reveal">${richText(p.description)}</div>` : ''}
          ${d.lessons.length ? html`<div class="card pad mt reveal"><h2>${icon('list')} الدروس (${d.lessons.length})</h2><div class="list">${d.lessons.map((l, i) => {
            const open = me.access || (l.is_preview && l.has_video);
            return html`<a class="li" href="/learn/${p.slug}?l=${l.id}"><span class="badge">${i + 1}</span><span class="grow"><b>${l.title}</b><span class="muted small">${l.duration_s ? fmtDur(l.duration_s) : ''}</span></span>${l.is_preview ? html`<span class="badge ok">مجاني</span>` : ''}${open ? icon('play') : icon('lock')}</a>`;
          })}</div></div>` : ''}
          ${d.files.length ? html`<div class="card pad mt reveal"><h2>${icon('folder')} الملفات والإصدارات</h2><div class="list">${d.files.map((f) => html`<div class="li">
            <span class="grow"><b class="ltr">${f.file_name}</b><span class="muted small">${f.version ? 'الإصدار ' + f.version + ' · ' : ''}${fmtBytes(f.size_bytes)} · ${fmtDate(f.created_at)}</span>${f.notes ? html`<span class="small">${f.notes}</span>` : ''}</span>
            ${f.is_current ? html`<span class="badge ok">الحالي</span>` : ''}${me.access ? html`<button class="btn sm" data-act="dl" data-f="${f.id}" aria-label="تحميل">${icon('download')}</button>` : icon('lock')}</div>`)}</div></div>` : ''}
          <div class="card pad mt reveal" id="reviews"><h2>${icon('star')} التقييمات</h2>
            ${me.can_review ? html`<form class="card pad mb" id="revform"><div class="rate-input">${[5, 4, 3, 2, 1].map((n) => html`<input type="radio" name="rating" id="r${n}" value="${n}" ${n === 5 ? 'checked' : ''}><label for="r${n}" title="${n}">★</label>`)}</div>
              <textarea class="input mt" name="body" maxlength="1500" placeholder="شاركنا رأيك (اختياري)"></textarea><button class="btn primary mt">نشر التقييم</button></form>`
              : html`<p class="muted small">${me.signed_in ? 'يمكنك التقييم بعد تحميل المنتج أو شرائه.' : 'سجّل الدخول لإضافة تقييم.'}</p>`}
            ${d.reviews.length ? d.reviews.map((r) => html`<div class="review"><div class="row between"><b>${r.author}</b><span class="muted small">${fmtDate(r.created_at)}</span></div>${stars(r.rating)}${r.body ? html`<p class="mt">${r.body}</p>` : ''}${r.mine ? html`<button class="btn ghost sm" data-act="delrev">${icon('trash')} حذف تقييمي</button>` : ''}</div>`) : html`<p class="muted">لا توجد تقييمات بعد.</p>`}
          </div>
        </div>
        <aside class="sticky"><div class="card buybox glow">
          ${price(p, true)}
          ${saleOn(p) ? html`<p class="small mt"><span class="badge err">خصم ${p.discount_percent}%</span>${p.discount_ends_at ? html` ينتهي خلال <span class="countdown" data-ends="${p.discount_ends_at}"></span>` : ''}</p>` : ''}
          ${me.access && !free ? html`<p class="small mt"><span class="badge ok">${icon('check')} ${STATUS[me.purchase?.status]?.[0] || 'متاح لك'}</span></p>` : ''}
          ${cta}
          <button class="btn ghost block" data-act="fav">${icon('heart')} ${me.favorite ? 'إزالة من المفضلة' : 'أضف إلى المفضلة'}</button>
          <dl class="kv mt"><dt>القسم</dt><dd>${k.label}</dd><dt>الإصدار</dt><dd class="ltr">${p.version}</dd>${current ? html`<dt>الحجم</dt><dd>${fmtBytes(current.size_bytes)}</dd>` : ''}
            <dt>آخر تحديث</dt><dd>${fmtDate(p.published_at)}</dd></dl>
          ${isAdmin() ? html`<a class="btn ghost sm block mt" href="/admin/products?edit=${p.id}">${icon('edit')} تعديل في لوحة المدير</a>` : ''}
        </div></aside>
      </div></div>`);
    countdown(view);
    view.querySelector('#revform')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), b = e.target.querySelector('button');
      busy(b, true);
      try { await api.post('/reviews/' + p.id, { rating: Number(f.get('rating')), body: f.get('body') }); toast('شكراً لتقييمك', 'ok'); await load(); render(); } catch (er) { toast(er.message, 'error'); busy(b, false); }
    });
  }

  render();
  const p = () => d.product;
  actions(view, {
    img: (el) => { view.querySelector('#mainimg').src = el.src; view.querySelectorAll('.thumbs img').forEach((x) => x.classList.toggle('on', x === el)); },
    dl: async (el) => {
      busy(el, true);
      try { const r = await api.post('/download/' + p().id, el.dataset.f ? { file_id: el.dataset.f } : {}); startDownload(r.url); toast('بدأ التحميل: ' + r.file_name, 'ok'); }
      catch (e) { toast(e.message, 'error'); } finally { busy(el, false); }
    },
    buy: async (el) => {
      busy(el, true);
      try { const r = await api.post('/orders', { product_id: p().id }); orderModal(r.order, p().title, r); await load(); render(); }
      catch (e) { toast(e.message, 'error'); busy(el, false); }
    },
    cancel: async () => {
      if (!(await confirmBox('إلغاء هذا الطلب؟', { danger: true, ok: 'إلغاء الطلب' }))) return;
      try { await api.post(`/orders/${d.me.purchase.id}/cancel`); toast('تم إلغاء الطلب'); await load(); render(); } catch (e) { toast(e.message, 'error'); }
    },
    testbuy: async (el) => {
      busy(el, true);
      try { await api.post('/checkout/test', { product_id: p().id }); toast('تم شراء تجريبي — التحميل متاح لك للاختبار', 'ok'); await load(); render(); } catch (e) { toast(e.message, 'error'); busy(el, false); }
    },
    fav: async () => {
      if (!d.me.signed_in) return go('/login?next=' + encodeURIComponent(location.pathname));
      try { const r = await api.post('/favorites/' + p().id); d.me.favorite = r.favorite; toast(r.favorite ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'ok'); render(); } catch (e) { toast(e.message, 'error'); }
    },
    delrev: async () => {
      if (!(await confirmBox('حذف تقييمك؟', { danger: true, ok: 'حذف' }))) return;
      try { await api.del('/reviews/' + p().id); await load(); render(); } catch (e) { toast(e.message, 'error'); }
    },
  });
}
