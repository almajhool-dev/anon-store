// لوحة المدير: الهيكل + نظرة عامة، الطلبات، المستخدمون، الرسائل، الإشعارات، التخزين، الأمان، السجل
import { html, mount, actions, toast, confirmBox, promptBox, busy, $ } from '../lib/dom.js';
import { api, fmtNum, fmtBytes, fmtDate, fmtDateTime, fmtPrice, ago } from '../lib/core.js';
import { icon } from '../lib/art.js';
import { loader, errorBox, empty } from '../lib/ui.js';

const TABS = [['overview', 'نظرة عامة', 'chart'], ['products', 'المنتجات والكورسات', 'grid'], ['orders', 'الطلبات والمبيعات', 'cart'], ['users', 'المستخدمون', 'user'],
  ['messages', 'الرسائل', 'mail'], ['notify', 'الإشعارات', 'bell'], ['storage', 'التخزين', 'disk'], ['settings', 'المظهر والإعدادات', 'sliders'], ['studio', 'استوديو التصميم', 'star'], ['content', 'محتوى الموقع', 'edit'], ['pages', 'الصفحات والروابط', 'list'],
  ['security', 'الأمان', 'shield'], ['audit', 'سجل العمليات', 'log']];
export const table = (head, rows) => html`<div class="table-wrap"><table><thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead><tbody>${rows}</tbody></table></div>`;
const ORDER = { pending: ['بانتظار الدفع', 'warn'], paid: ['مدفوع', 'ok'], test: ['تجريبي', 'info'], cancelled: ['ملغي', ''], refunded: ['مسترجع', 'err'] };
const SEV = { low: 'منخفض', medium: 'متوسط', high: 'مرتفع', critical: 'حرج' };

async function overview(main) {
  const s = await api.get('/admin/stats');
  const max = Math.max(1, ...s.series.map((x) => Math.max(x.visitors, x.downloads)));
  const rev = s.revenue.length ? s.revenue.map((r) => fmtPrice(r.total, r.currency)).join(' + ') : '0';
  const cards = [['user', s.users, 'المستخدمون'], ['plus', s.users_7d, 'مستخدمون جدد (7 أيام)'], ['eye', s.visitors_today, 'زوار اليوم'], ['chart', s.visitors_7d, 'زوار 7 أيام'],
    ['bolt', s.active_now, 'نشطون الآن (تقريباً)'], ['chart', s.visitors_30d, 'زيارات 30 يوماً'], ['eye', s.visits_total, 'إجمالي الزيارات منذ الإطلاق'], ['list', s.pageviews_today, 'مشاهدات الصفحات اليوم'], ['list', s.pageviews_total, 'إجمالي مشاهدات الصفحات'], ['download', s.downloads_total, 'إجمالي التحميلات'], ['download', s.downloads_today, 'تحميلات اليوم'],
    ['cart', s.sales, 'المبيعات المؤكدة'], ['gem', rev, 'الإيرادات'], ['clock', s.pending_orders, 'طلبات بانتظار الدفع'], ['mail', s.new_messages, 'رسائل جديدة'],
    ['grid', s.products, 'منتجات منشورة'], ['shield', s.threats_24h, 'تهديدات (24 ساعة)'], ['ban', s.active_blocks, 'عناوين محظورة'], ['disk', fmtBytes(s.storage_used), `التخزين المستخدم (من ${fmtBytes(s.storage_quota)})`]];
  mount(main, html`<h2>نظرة عامة</h2><div class="stats">${cards.map(([i, n, l]) => html`<div class="card stat">${icon(i)}<span class="n ltr">${typeof n === 'number' ? fmtNum(n) : n}</span><span class="l">${l}</span></div>`)}</div>
    <div class="card pad mt"><div class="row between"><b>آخر 14 يوماً</b><span class="small muted"><span class="badge info">الزوار</span> <span class="badge ok">التحميلات</span></span></div>
      <div class="bars">${s.series.map((x) => html`<div class="b" title="${x.day}: ${x.visitors} زائر، ${x.downloads} تحميل"><i data-h="${(x.visitors / max) * 100}"></i><i class="d" data-h="${(x.downloads / max) * 100}"></i><span>${x.day.slice(8, 10)}</span></div>`)}</div></div>
    <h3 class="mt2">الأكثر مشاهدة</h3>${s.top_viewed.length ? table(['المنتج', 'المشاهدات', 'التحميلات'], s.top_viewed.map((p) => html`<tr><td><a href="/p/${p.slug}">${p.title}</a></td><td>${fmtNum(p.views)}</td><td>${fmtNum(p.downloads)}</td></tr>`)) : empty('لا توجد منتجات بعد')}`);
  main.querySelectorAll('[data-h]').forEach((i) => { i.style.height = `${Math.max(1, Number(i.dataset.h))}%`; });
}

async function orders(main) {
  let status = '';
  const draw = async () => {
    const r = await api.get('/admin/orders' + (status ? '?status=' + status : ''));
    mount(main, html`<h2>الطلبات والمبيعات</h2><div class="chips mb">${[['', 'الكل'], ...Object.entries(ORDER).map(([k, v]) => [k, v[0]])].map(([k, t]) => html`<button class="chip${status === k ? ' active' : ''}" data-act="st" data-v="${k}">${t}</button>`)}</div>
      ${r.items.length ? table(['المرجع', 'المستخدم', 'المنتج', 'المبلغ', 'الحالة', 'التاريخ', 'إجراء'], r.items.map((o) => html`<tr><td class="ltr">${o.reference}</td><td class="ltr small">${o.email || '—'}</td><td>${o.title ? html`<a href="/p/${o.slug}">${o.title}</a>` : '—'}</td>
        <td>${fmtPrice(o.amount, o.currency)}</td><td><span class="badge ${ORDER[o.status]?.[1]}">${ORDER[o.status]?.[0]}</span></td><td class="small">${fmtDateTime(o.created_at)}</td>
        <td><div class="row">${o.status === 'pending' ? html`<button class="btn ok sm" data-act="set" data-id="${o.id}" data-s="paid">تأكيد الدفع</button><button class="btn ghost sm" data-act="set" data-id="${o.id}" data-s="cancelled">إلغاء</button>` : ''}
        ${o.status === 'paid' ? html`<button class="btn danger sm" data-act="set" data-id="${o.id}" data-s="refunded">استرجاع</button>` : ''}</div></td></tr>`)) : empty('لا توجد طلبات', 'cart')}
      <p class="muted small mt">${icon('shield')} بوابات الدفع العراقية (زين كاش، FIB، Qi Card) مهيأة في البنية لكنها غير مفعّلة حتى توفر حساب تاجر رسمي. التأكيد اليدوي هنا يفعّل التحميل فوراً للمشتري.</p>`);
  };
  actions(main, {
    st: (b) => { status = b.dataset.v; draw(); },
    set: async (b) => {
      const label = { paid: 'تأكيد استلام الدفع وتفعيل التحميل؟', cancelled: 'إلغاء الطلب؟', refunded: 'تسجيل استرجاع المبلغ وإلغاء الوصول؟' }[b.dataset.s];
      if (!(await confirmBox(label, { danger: b.dataset.s !== 'paid' }))) return;
      try { await api.post(`/admin/orders/${b.dataset.id}/status`, { status: b.dataset.s }); toast('تم التحديث وإشعار المستخدم', 'ok'); draw(); } catch (e) { toast(e.message, 'error'); }
    },
  });
  await draw();
}

async function users(main, { state }) {
  let q = '';
  const owner = state.me.role === 'owner';
  mount(main, html`<h2>المستخدمون</h2><input class="input mb" id="uq" placeholder="بحث بالاسم أو البريد..."><div id="ubox">${loader()}</div>`);
  const box = $('#ubox', main);
  $('#uq', main).addEventListener('input', (e) => { clearTimeout(main._t); main._t = setTimeout(() => { q = e.target.value.trim(); draw(); }, 400); });
  const draw = async () => {
    const r = await api.get('/admin/users?q=' + encodeURIComponent(q));
    mount(box, html`${r.items.length ? table(['المستخدم', 'الدور', 'مشتريات', 'تحميلات', 'التسجيل', 'آخر نشاط', 'إجراء'], r.items.map((u) => html`<tr><td><b>${u.name}</b><div class="small muted ltr">${u.email}</div>${u.banned ? html`<span class="badge err">محظور: ${u.ban_reason || ''}</span>` : ''}</td>
        <td><span class="badge ${u.role === 'user' ? '' : 'info'}">${{ user: 'مستخدم', admin: 'مدير', owner: 'المالك' }[u.role]}</span></td><td>${u.purchases}</td><td>${u.downloads}</td><td class="small">${fmtDate(u.created_at)}</td><td class="small">${ago(u.last_seen)}</td>
        <td><div class="row">${u.role !== 'owner' && u.id !== state.me.id ? (u.banned ? html`<button class="btn ok sm" data-act="unban" data-id="${u.id}">فك الحظر</button>` : html`<button class="btn danger sm" data-act="ban" data-id="${u.id}">حظر</button>`) : ''}
        ${owner && u.role !== 'owner' ? html`<button class="btn ghost sm" data-act="role" data-id="${u.id}" data-r="${u.role === 'admin' ? 'user' : 'admin'}">${u.role === 'admin' ? 'إزالة الإدارة' : 'جعله مديراً'}</button>` : ''}</div></td></tr>`)) : empty('لا يوجد مستخدمون', 'user')}`);
  };
  actions(main, {
    ban: async (b) => { const reason = await promptBox('سبب الحظر (يظهر للمستخدم)', { placeholder: 'مخالفة الشروط' }); if (reason === null) return; try { await api.post(`/admin/users/${b.dataset.id}/ban`, { reason }); toast('تم الحظر', 'ok'); draw(); } catch (e) { toast(e.message, 'error'); } },
    unban: async (b) => { try { await api.post(`/admin/users/${b.dataset.id}/ban`, { banned: false }); toast('تم فك الحظر', 'ok'); draw(); } catch (e) { toast(e.message, 'error'); } },
    role: async (b) => { if (!(await confirmBox(b.dataset.r === 'admin' ? 'منح صلاحيات المدير لهذا المستخدم؟' : 'إزالة صلاحيات المدير؟'))) return; try { await api.post(`/admin/users/${b.dataset.id}/role`, { role: b.dataset.r }); toast('تم التحديث', 'ok'); draw(); } catch (e) { toast(e.message, 'error'); } },
  });
  await draw();
}

async function messages(main) {
  const draw = async () => {
    const r = await api.get('/admin/messages');
    mount(main, html`<h2>رسائل الدعم</h2>${r.items.length ? html`<div class="list">${r.items.map((m) => html`<div class="card pad"><div class="row between wrap"><b>${m.subject}</b><span class="badge ${m.status === 'new' ? 'warn' : m.status === 'replied' ? 'ok' : ''}">${{ new: 'جديدة', read: 'مقروءة', replied: 'تم الرد', closed: 'مغلقة' }[m.status]}</span></div>
      <p class="muted small">${m.name} · <span class="ltr">${m.email || m.account_email || 'بدون بريد'}</span> · ${fmtDateTime(m.created_at)}</p><p>${m.body}</p>
      ${m.reply ? html`<div class="card pad small"><b>ردّك:</b> ${m.reply}</div>` : ''}
      <div class="row wrap mt"><button class="btn sm primary" data-act="reply" data-id="${m.id}">${icon('send')} ${m.account_email ? 'رد (يصل كإشعار)' : 'تسجيل رد'}</button>
      ${m.status === 'new' ? html`<button class="btn sm ghost" data-act="mst" data-id="${m.id}" data-s="read">تمت القراءة</button>` : ''}${m.status !== 'closed' ? html`<button class="btn sm ghost" data-act="mst" data-id="${m.id}" data-s="closed">إغلاق</button>` : ''}
      ${m.email ? html`<a class="btn sm ghost" href="mailto:${m.email}?subject=${encodeURIComponent('رد: ' + m.subject)}">${icon('mail')} بريد</a>` : ''}</div></div>`)}</div>` : empty('لا توجد رسائل', 'mail')}`);
  };
  actions(main, {
    reply: async (b) => { const t = await promptBox('اكتب الرد', { multiline: true, ok: 'إرسال' }); if (!t) return; try { const r = await api.post(`/admin/messages/${b.dataset.id}/reply`, { reply: t }); toast(r.notified ? 'تم الرد وإشعار المستخدم' : 'تم حفظ الرد (المرسل بلا حساب — راسله على بريده)', 'ok'); draw(); } catch (e) { toast(e.message, 'error'); } },
    mst: async (b) => { try { await api.post(`/admin/messages/${b.dataset.id}/status`, { status: b.dataset.s }); draw(); } catch (e) { toast(e.message, 'error'); } },
  });
  await draw();
}

async function notify(main) {
  const draw = async () => {
    const r = await api.get('/admin/notifications');
    mount(main, html`<h2>الإشعارات والرسائل</h2><form class="card pad" id="nform"><label class="field"><span>العنوان</span><input class="input" name="title" required minlength="2" maxlength="200"></label>
      <label class="field"><span>النص</span><textarea class="input" name="body" maxlength="4000"></textarea></label>
      <label class="field"><span>إلى (بريد مستخدم محدد — اتركه فارغاً لإرسال للجميع)</span><input class="input ltr" name="email" type="email" maxlength="200"></label><button class="btn primary">${icon('send')} إرسال</button></form>
      <h3 class="mt2">آخر الإشعارات</h3>${r.items.length ? table(['العنوان', 'إلى', 'النوع', 'التاريخ', ''], r.items.map((n) => html`<tr><td><b>${n.title}</b><div class="small muted">${n.body.slice(0, 120)}</div></td><td class="small ltr">${n.for_admins ? 'المدراء' : n.email || 'الجميع'}</td><td>${n.kind}</td><td class="small">${fmtDateTime(n.created_at)}</td><td><button class="btn ghost sm" data-act="del" data-id="${n.id}" aria-label="حذف">${icon('trash')}</button></td></tr>`)) : empty('لا توجد إشعارات', 'bell')}`);
    $('#nform', main).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target)), b = e.target.querySelector('button');
      busy(b, true);
      try { await api.post('/admin/notifications', { title: f.title, body: f.body, email: f.email || undefined }); toast('تم الإرسال', 'ok'); draw(); } catch (er) { toast(er.message, 'error'); busy(b, false); }
    });
  };
  actions(main, { del: async (b) => { if (!(await confirmBox('حذف الإشعار؟', { danger: true }))) return; try { await api.del('/admin/notifications/' + b.dataset.id); draw(); } catch (e) { toast(e.message, 'error'); } } });
  await draw();
}

async function storage(main) {
  const draw = async () => {
    const s = await api.get('/admin/storage');
    const pct = Math.min(100, ((s.used + s.reserved) / s.quota) * 100);
    mount(main, html`<h2>التخزين</h2><div class="card pad"><div class="row between"><b>${fmtBytes(s.used)} مستخدم${s.reserved ? html` + ${fmtBytes(s.reserved)} قيد الرفع` : ''}</b><span class="muted">من ${fmtBytes(s.quota)}</span></div><div class="meter mt"><i id="meter"></i></div>
      <p class="muted small mt">Neon Object Storage (الخطة المجانية): ${fmtBytes(s.quota)} للمشروع، حتى ${fmtBytes(s.max_file)} للملف الواحد عبر الرفع المجزأ. الملفات تُحفظ كما هي دون أي ضغط.</p></div>
      <h3 class="mt2">الملفات (${s.files.length})</h3>${s.files.length ? table(['الملف', 'المنتج', 'الحجم', 'الفحص', 'الحالة', 'التاريخ', ''], s.files.map((f) => html`<tr><td class="ltr small">${f.file_name}${f.version ? ' · v' + f.version : ''}</td><td>${f.title ? html`<a href="/p/${f.slug}">${f.title}</a>` : '—'}</td><td>${fmtBytes(f.size_bytes)}</td>
        <td><span class="badge ${f.scan_status === 'passed' ? 'ok' : f.scan_status === 'flagged' ? 'err' : ''}">${{ passed: 'سليم', flagged: 'مشبوه', pending: '—' }[f.scan_status]}</span></td><td>${f.status === 'uploading' ? html`<span class="badge warn">قيد الرفع</span>` : html`<span class="badge ok">جاهز</span>`}</td><td class="small">${fmtDate(f.created_at)}</td>
        <td><button class="btn danger sm" data-act="${f.status === 'uploading' ? 'abort' : 'del'}" data-id="${f.id}">${f.status === 'uploading' ? 'إلغاء الرفع' : 'حذف'}</button></td></tr>`)) : empty('لا توجد ملفات', 'disk')}`);
    $('#meter', main).style.width = pct + '%';
  };
  actions(main, {
    del: async (b) => { if (!(await confirmBox('حذف الملف نهائياً من التخزين؟', { danger: true, ok: 'حذف' }))) return; try { await api.del('/admin/files/' + b.dataset.id); toast('تم الحذف', 'ok'); draw(); } catch (e) { toast(e.message, 'error'); } },
    abort: async (b) => { if (!(await confirmBox('إلغاء الرفع وحذف الأجزاء المرفوعة؟', { danger: true }))) return; try { await api.del('/admin/uploads/' + b.dataset.id); draw(); } catch (e) { toast(e.message, 'error'); } },
  });
  await draw();
}

async function security(main) {
  let sev = '';
  const draw = async () => {
    const s = await api.get('/admin/security' + (sev ? '?severity=' + sev : ''));
    mount(main, html`<h2>الأمان والمراقبة</h2>
      <div class="card pad"><div class="row wrap between"><span>عنوانك الحالي: <b class="ltr">${s.your_ip}</b></span><span class="small muted">الحظر التلقائي مؤقت ويتصاعد مع التكرار، ولا يشمل المدير الموثّق.</span></div>
        <div class="row wrap mt">${s.summary.length ? s.summary.map((x) => html`<span class="badge"><span class="sev-${x.severity}">${x.kind}</span> × ${x.n}</span>`) : html`<span class="muted small">لا أحداث خلال 24 ساعة</span>`}</div></div>
      <div class="card pad mt"><h3>${icon('ban')} العناوين المحظورة (${s.blocks.length})</h3>
        ${s.blocks.length ? table(['IP', 'السبب', 'النوع', 'حتى', 'مرات', ''], s.blocks.map((b) => html`<tr><td class="ltr">${b.ip}</td><td class="small">${b.reason}</td><td>${b.created_by === 'system' ? 'تلقائي' : 'يدوي'}</td><td class="small">${b.blocked_until ? fmtDateTime(b.blocked_until) : 'دائم'}</td><td>${b.hits}</td><td><button class="btn ok sm" data-act="unblock" data-ip="${b.ip}">فك الحظر</button></td></tr>`)) : html`<p class="muted small">لا يوجد</p>`}
        <form class="row wrap mt" id="bform"><input class="input ltr grow" name="ip" placeholder="IP" required><input class="input" name="minutes" type="number" min="1" placeholder="دقائق (فارغ = دائم)"><input class="input grow" name="reason" placeholder="السبب"><button class="btn danger">حظر</button></form></div>
      <div class="row between mt2"><h3>سجل الأحداث الأمنية</h3><div class="chips">${[['', 'الكل'], ...Object.entries(SEV)].map(([k, t]) => html`<button class="chip${sev === k ? ' active' : ''}" data-act="sev" data-v="${k}">${t}</button>`)}</div></div>
      ${s.events.length ? table(['الوقت', 'IP', 'النوع', 'الخطورة', 'المسار', 'المتصفح'], s.events.map((e) => html`<tr><td class="small nowrap">${fmtDateTime(e.created_at)}</td><td class="ltr small">${e.ip}</td><td>${e.kind}</td><td><span class="sev-${e.severity}">${SEV[e.severity]}</span></td><td class="ltr small">${(e.method || '') + ' ' + (e.path || '').slice(0, 80)}</td><td class="ltr small muted">${(e.ua || '').slice(0, 60)}</td></tr>`)) : empty('لا توجد أحداث', 'shield')}
      <div class="card pad mt small muted">${icon('shield')} الحماية المفعّلة: تحديد المعدل، كشف SQLi/XSS/Traversal/RCE، رصد أدوات الفحص، مصيدة مسارات (wp-admin، .env...)، حظر تلقائي متصاعد، RLS على مستوى قاعدة البيانات، روابط موقعة مؤقتة، CSP وHSTS. طبقة Cloudflare WAF تُفعَّل عند ربط حساب Cloudflare.</div>`);
    $('#bform', main).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try { await api.post('/admin/security/block', { ip: f.ip.trim(), minutes: f.minutes ? Number(f.minutes) : null, reason: f.reason }); toast('تم الحظر', 'ok'); draw(); } catch (er) { toast(er.message, 'error'); }
    });
  };
  actions(main, {
    sev: (b) => { sev = b.dataset.v; draw(); },
    unblock: async (b) => { try { await api.del('/admin/security/block/' + encodeURIComponent(b.dataset.ip)); toast('تم فك الحظر', 'ok'); draw(); } catch (e) { toast(e.message, 'error'); } },
  });
  await draw();
}

async function audit(main) {
  const r = await api.get('/admin/audit');
  mount(main, html`<h2>سجل العمليات الإدارية</h2><p class="muted small">سجل غير قابل للتعديل أو الحذف من الواجهة.</p>${r.items.length ? table(['الوقت', 'المنفّذ', 'العملية', 'الهدف', 'IP'], r.items.map((a) => html`<tr><td class="small nowrap">${fmtDateTime(a.created_at)}</td><td class="small ltr">${a.actor || '—'}</td><td>${a.action}</td><td class="small ltr">${(a.target || '').slice(0, 40)}</td><td class="small ltr">${a.ip || ''}</td></tr>`)) : empty('لا توجد عمليات', 'log')}`);
}

const SIMPLE = { overview, orders, users, messages, notify, storage, security, audit };

export default async function (view, m, ctx) {
  const { state, setTitle, isAdmin } = ctx;
  setTitle('لوحة المدير');
  if (!state.me) {
    mount(view, html`<div class="container page"><div class="card pad center">${icon('lock')}<h2>سجّل الدخول أولاً</h2><a class="btn primary" href="/login?next=/admin">تسجيل الدخول</a></div></div>`);
    return;
  }
  if (!isAdmin()) {
    mount(view, html`<div class="container page"><div class="card pad center">${icon('shield')}<h2>هذه الصفحة للمدير فقط</h2><p class="muted">الصلاحيات محمية من الخادم وقاعدة البيانات.</p></div></div>`);
    return;
  }
  const tab = TABS.some(([t]) => t === m[1]) ? m[1] : 'overview';
  mount(view, html`<div class="container adm"><nav class="card adm-side" aria-label="أقسام لوحة المدير">${TABS.map(([t, l, i]) => html`<a href="/admin/${t}" class="${t === tab ? 'active' : ''}">${icon(i)} ${l}</a>`)}</nav><section id="adm-main">${loader()}</section></div>`);
  const main = $('#adm-main', view);
  actions(main, { reload: () => ctx.go(location.pathname + location.search, true) });
  try {
    if (tab === 'products') return await (await import('./products.js')).default(main, ctx);
    if (tab === 'settings') return await (await import('./settings.js')).default(main, ctx);
    if (tab === 'studio') return await (await import('./studio.js')).default(main, ctx);
    if (tab === 'content' || tab === 'pages') return (await import('./content.js')).default(main, ctx, tab);
    await SIMPLE[tab](main, ctx);
  } catch (e) { mount(main, errorBox(e)); }
}
