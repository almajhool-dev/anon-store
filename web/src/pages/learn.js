// مشغل الكورسات والفيديوهات: روابط موقعة مؤقتة، حفظ آخر موضع، سرعة التشغيل، الدرس التالي
import { html, mount, actions, toast } from '../lib/dom.js';
import { api, auth, fmtDur } from '../lib/core.js';
import { icon } from '../lib/art.js';
import { loader, errorBox, empty } from '../lib/ui.js';

export default async function (view, m, { setTitle, go }) {
  mount(view, loader());
  let d, prog = new Map();
  try {
    d = await api.get('/products/' + m[1]);
    if (auth.signedIn) (await api.get(`/products/${d.product.id}/progress`).catch(() => ({ items: [] }))).items.forEach((x) => prog.set(x.lesson_id, x));
  } catch (e) { mount(view, html`<div class="container page">${errorBox(e, false)}</div>`); return; }
  const p = d.product, L = d.lessons, me = d.me || {};
  setTitle(p.title);
  if (!L.length) { mount(view, html`<div class="container page">${empty('لا توجد دروس في هذا المحتوى بعد', 'play')}<div class="center mt"><a class="btn" href="/p/${p.slug}">العودة للمنتج</a></div></div>`); return; }
  const canWatch = (l) => l.has_video && (me.access || l.is_preview);
  const wanted = new URLSearchParams(location.search).get('l');
  let cur = L.find((l) => l.id === wanted) || L.find((l) => canWatch(l) && !prog.get(l.id)?.completed) || L.find(canWatch) || L[0];
  let lastSave = 0, retried = false, alive = true;
  const rate = Number(localStorage.getItem('anon-rate') || 1);

  mount(view, html`<div class="container page"><p class="muted small"><a href="/p/${p.slug}">${icon('back')} ${p.title}</a></p>
    <div class="split"><div><div class="card player glow"><video id="v" controls playsinline preload="metadata" controlsList="nodownload"></video>
      <div class="player-bar"><button class="btn sm" data-act="skip" data-s="-10">−10 ث</button><button class="btn sm" data-act="skip" data-s="10">+10 ث</button>
      <select class="select" id="rate" aria-label="سرعة التشغيل">${[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => html`<option value="${r}" ${r === rate ? 'selected' : ''}>${r}×</option>`)}</select>
      <span class="grow"></span><button class="btn sm primary" data-act="next">الدرس التالي ${icon('next')}</button></div></div>
      <div class="card pad mt" id="info"></div></div>
      <aside class="card sticky"><div class="pad"><b>${icon('list')} محتوى الدورة</b><div class="progress mt"><i id="pbar"></i></div><p class="muted small" id="ptext"></p></div><div class="lessons" id="lessons"></div></aside></div></div>`);
  const v = view.querySelector('#v'), info = view.querySelector('#info');
  v.playbackRate = rate;

  function side() {
    const done = L.filter((l) => prog.get(l.id)?.completed).length;
    view.querySelector('#pbar').style.width = `${Math.round((done / L.length) * 100)}%`;
    view.querySelector('#ptext').textContent = `أكملت ${done} من ${L.length} دروس`;
    mount(view.querySelector('#lessons'), L.map((l, i) => html`<div class="lesson${l === cur ? ' on' : ''}${prog.get(l.id)?.completed ? ' done' : ''}${canWatch(l) ? '' : ' locked'}" data-act="pick" data-id="${l.id}">
      <span class="num">${prog.get(l.id)?.completed ? '✓' : i + 1}</span><span class="grow"><b class="small">${l.title}</b><span class="muted small"> ${l.duration_s ? fmtDur(l.duration_s) : ''}${l.is_preview ? ' · مجاني' : ''}</span></span>${canWatch(l) ? '' : icon('lock')}</div>`));
  }

  async function open(l, autoplay = false) {
    cur = l; retried = false;
    history.replaceState(null, '', `/learn/${p.slug}?l=${l.id}`);
    side();
    mount(info, html`<h2>${l.title}</h2>${l.description ? html`<p class="muted">${l.description}</p>` : ''}`);
    v.removeAttribute('src'); v.load();
    if (!l.has_video) return mount(info, html`<h2>${l.title}</h2><p class="muted">لم يُرفع فيديو هذا الدرس بعد.</p>`);
    if (!canWatch(l)) {
      return mount(info, html`<h2>${icon('lock')} ${l.title}</h2><p class="muted">هذا الدرس ضمن المحتوى المدفوع.</p><a class="btn primary" href="/p/${p.slug}">${me.signed_in ? 'اشترِ الآن' : 'سجّل الدخول للشراء'}</a>`);
    }
    try {
      const r = await api.get(`/lessons/${l.id}/media`);
      if (!alive || cur !== l) return;
      v.src = r.url;
      v.playbackRate = Number(view.querySelector('#rate').value);
      const pos = prog.get(l.id)?.position_s || 0;
      v.addEventListener('loadedmetadata', () => { if (pos > 5 && (!v.duration || pos < v.duration - 10)) v.currentTime = pos; if (autoplay) v.play().catch(() => {}); }, { once: true });
    } catch (e) { mount(info, html`<h2>${l.title}</h2>${errorBox(e, false)}`); }
  }

  async function save(completed = false) {
    if (!auth.signedIn || !cur || !v.currentTime) return;
    const position_s = Math.floor(v.currentTime);
    prog.set(cur.id, { ...(prog.get(cur.id) || {}), position_s, completed: completed || prog.get(cur.id)?.completed });
    try { await api.post(`/lessons/${cur.id}/progress`, { position_s, completed }); } catch { /* سيُعاد الحفظ لاحقاً */ }
  }
  const nextLesson = () => L.slice(L.indexOf(cur) + 1).find(canWatch);

  v.addEventListener('timeupdate', () => { if (Date.now() - lastSave > 10000) { lastSave = Date.now(); save(); } });
  v.addEventListener('pause', () => save());
  v.addEventListener('ended', async () => {
    await save(true); side();
    const n = nextLesson();
    if (n) { toast('الدرس التالي خلال 3 ثوانٍ…'); setTimeout(() => alive && cur !== n && open(n, true), 3000); } else toast('أحسنت! أكملت جميع الدروس المتاحة 🎉', 'ok');
  });
  v.addEventListener('error', async () => {
    if (!v.getAttribute('src')) return;
    if (!retried && cur) { retried = true; const t = v.currentTime; const r = await api.get(`/lessons/${cur.id}/media`).catch(() => null); if (r) { v.src = r.url; v.currentTime = t; return; } }
    toast('تعذر تشغيل الفيديو في هذا المتصفح — قد تكون صيغة الملف غير مدعومة (يفضّل MP4)', 'error', 6000);
  });
  view.querySelector('#rate').addEventListener('change', (e) => { v.playbackRate = Number(e.target.value); localStorage.setItem('anon-rate', e.target.value); });
  const onHide = () => { if (document.hidden) save(); };
  document.addEventListener('visibilitychange', onHide);
  actions(view, {
    pick: (el) => open(L.find((l) => l.id === el.dataset.id), true),
    skip: (el) => { v.currentTime = Math.max(0, v.currentTime + Number(el.dataset.s)); },
    next: () => { const n = nextLesson(); n ? open(n, true) : toast('لا يوجد درس تالٍ متاح'); },
  });
  open(cur);
  return () => { alive = false; save(); document.removeEventListener('visibilitychange', onHide); v.pause(); };
}
