import { html, mount, actions, toast, busy, confirmBox, safeUrl } from '../lib/dom.js';
import { api, auth, fmtDate, fmtDateTime, fmtPrice, ago, KINDS } from '../lib/core.js';
import { icon } from '../lib/art.js';
import { grid, empty, loader, errorBox } from '../lib/ui.js';

const ST = { pending: ['بانتظار الدفع', 'warn'], paid: ['مدفوع', 'ok'], test: ['تجريبي', 'info'], cancelled: ['ملغي', ''], refunded: ['مسترجع', 'err'] };
const TABS = [['purchases', 'مشترياتي', 'cart'], ['downloads', 'سجل التحميلات', 'download'], ['favorites', 'المفضلة', 'heart'], ['notifications', 'الإشعارات', 'bell'], ['profile', 'الملف الشخصي', 'user']];

export default async function (view, _m, { state, go, refreshMe, setTitle }) {
  setTitle('حسابي');
  if (!auth.signedIn || !state.me) {
    mount(view, html`<div class="container page"><div class="card pad center glow">${icon('user')}<h2>سجّل الدخول لعرض حسابك</h2><p class="muted">مشترياتك، تحميلاتك، مفضلتك وإشعاراتك في مكان واحد.</p><a class="btn primary" href="/login?next=/account">${icon('key')} تسجيل الدخول</a></div></div>`);
    return;
  }
  const me = state.me;
  let tab = TABS.some(([t]) => t === location.hash.slice(1)) ? location.hash.slice(1) : 'purchases';
  let lib = null;
  mount(view, html`<div class="container page">
    <div class="card profile glow">${me.avatar ? html`<img class="avatar" src="${safeUrl(me.avatar)}" alt="" referrerpolicy="no-referrer">` : html`<span class="avatar">${(me.name || '?')[0]}</span>`}
      <div class="grow"><h2>${me.name}</h2><p class="muted small ltr">${me.email}</p></div>
      <span class="badge ${me.role === 'user' ? '' : 'info'}">${{ user: 'مستخدم', admin: 'مدير', owner: 'المالك' }[me.role]}</span>
      ${me.role !== 'user' ? html`<a class="btn sm" href="/admin">${icon('shield')} لوحة المدير</a>` : ''}
      <button class="btn ghost sm" data-act="logout">${icon('logout')} تسجيل الخروج</button></div>
    <div class="tabs" role="tablist">${TABS.map(([t, l, i]) => html`<button class="tab" data-act="tab" data-t="${t}">${icon(i)} ${l}</button>`)}</div><div id="tabc"></div></div>`);
  const box = view.querySelector('#tabc');

  async function show(t) {
    tab = t;
    history.replaceState(null, '', '/account#' + t);
    view.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
    mount(box, loader());
    try {
      if (['purchases', 'downloads', 'favorites'].includes(t) && !lib) lib = await api.get('/me/library');
      if (t === 'purchases') {
        mount(box, lib.purchases.length ? html`<div class="list">${lib.purchases.map((b) => html`<div class="li"><span class="grow"><b>${b.title ? html`<a href="/p/${b.slug}">${b.title}</a>` : 'منتج غير متاح'}</b>
          <span class="muted small">رقم الطلب <span class="ltr">${b.reference}</span> · ${fmtPrice(b.amount, b.currency)} · ${fmtDate(b.created_at)}</span></span>
          <span class="badge ${ST[b.status]?.[1]}">${ST[b.status]?.[0]}</span>${b.status === 'pending' ? html`<button class="btn ghost sm" data-act="cancel" data-id="${b.id}">إلغاء</button>` : ''}</div>`)}</div>` : empty('لا توجد مشتريات بعد', 'cart'));
      } else if (t === 'downloads') {
        mount(box, lib.downloads.length ? html`<div class="list">${lib.downloads.map((x) => html`<div class="li">${icon('download')}<span class="grow"><b>${x.title ? html`<a href="/p/${x.slug}">${x.title}</a>` : 'منتج غير متاح'}</b><span class="muted small ltr">${x.file_name || ''} ${x.version ? 'v' + x.version : ''}</span></span><span class="muted small">${ago(x.created_at)}</span></div>`)}</div>` : empty('لم تحمّل أي ملف بعد', 'download'));
      } else if (t === 'favorites') {
        mount(box, grid(lib.favorites, 'قائمة المفضلة فارغة'));
      } else if (t === 'notifications') {
        const r = await api.get('/me/notifications');
        mount(box, html`<div class="row end mb"><button class="btn sm" data-act="readall">${icon('check')} تحديد الكل كمقروء</button></div>${r.items.length ? html`<div class="list">${r.items.map((n) => html`<div class="li">${icon(n.kind === 'order' ? 'cart' : n.kind === 'message' ? 'mail' : n.kind === 'security' ? 'shield' : 'bell')}
          <span class="grow"><b>${n.title} ${n.read ? '' : html`<span class="badge info">جديد</span>`}</b><span class="small">${n.body}</span></span><span class="muted small nowrap">${ago(n.created_at)}</span></div>`)}</div>` : empty('لا توجد إشعارات', 'bell')}`);
      } else {
        mount(box, html`<form class="card pad" id="pform"><label class="field"><span>الاسم الظاهر</span><input class="input" name="name" value="${me.name}" minlength="2" maxlength="60" required></label>
          <p class="muted small">البريد: <span class="ltr">${me.email}</span> · عضو منذ ${fmtDate(me.created_at)}</p><button class="btn primary">حفظ</button></form>`);
        box.querySelector('#pform').addEventListener('submit', async (e) => {
          e.preventDefault();
          const b = e.target.querySelector('button');
          busy(b, true);
          try { await api.patch('/me', { name: new FormData(e.target).get('name') }); toast('تم الحفظ', 'ok'); await refreshMe(); } catch (er) { toast(er.message, 'error'); } finally { busy(b, false); }
        });
      }
    } catch (e) { mount(box, errorBox(e)); }
  }

  actions(view, {
    tab: (b) => show(b.dataset.t),
    reload: () => { lib = null; show(tab); },
    logout: async () => { await auth.signOut(); await refreshMe(); toast('تم تسجيل الخروج'); go('/'); },
    cancel: async (b) => {
      if (!(await confirmBox('إلغاء هذا الطلب؟', { danger: true, ok: 'إلغاء الطلب' }))) return;
      try { await api.post(`/orders/${b.dataset.id}/cancel`); lib = null; show('purchases'); } catch (e) { toast(e.message, 'error'); }
    },
    readall: async () => { try { await api.post('/me/notifications/read'); await refreshMe(); show('notifications'); } catch (e) { toast(e.message, 'error'); } },
  });
  show(tab);
}
