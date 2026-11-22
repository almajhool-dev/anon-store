// الشعار والأيقونات ورسوم الأقسام (SVG أصلية مولّدة بالكود — بلا صور خارجية)
import { raw, esc } from './dom.js';

const P = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  code: 'M8 6l-6 6 6 6M16 6l6 6-6 6',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  cap: 'M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 3 9 3 12 0v-5',
  play: 'M6 4l14 8-14 8z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  gem: 'M6 3h12l4 6-10 12L2 9zM2 9h20M12 21L8 9l4-6 4 6z',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  trend: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload: 'M12 21V9M7 14l5-5 5 5M5 3h14',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  menu: 'M3 6h18M3 12h18M3 18h18',
  x: 'M18 6L6 18M6 6l12 12',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  cart: 'M6 6h15l-1.5 9h-12zM6 6L5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  mail: 'M3 5h18v14H3zM3 7l9 6 9-6',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  check: 'M20 6L9 17l-5-5',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  chart: 'M3 3v18h18M7 15l4-4 3 3 6-6',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  disk: 'M22 12H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6zM6 16h.01M10 16h.01',
  log: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  back: 'M5 12h14M12 5l7 7-7 7',
  next: 'M19 12H5M12 19l-7-7 7-7',
  key: 'M15 7a4 4 0 1 1-4 4M11 11l-8 8v2h3v-2h2v-2h2l2-2',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  chat: 'M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 20l1.3-5.2A8.4 8.4 0 1 1 21 11.5zM9 9.5c.4 2.2 2.3 4.1 4.5 4.5l1.2-1.1 1.8.9-.4 1.4c-3.6 0-7.2-3.6-7.2-7.2l1.4-.4.9 1.8z',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  ban: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM4.9 4.9l14.2 14.2',
  plus: 'M12 5v14M5 12h14',
};
export const icon = (name, cls = '') =>
  raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${P[name] || P.code}"/></svg>`);

export const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18b4ff"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><path d="M32 3C18.5 3 9 14 9 28v8c0 9.5 4.5 17 11 22l2 3h20l2-3c6.5-5 11-12.5 11-22v-8C55 14 45.5 3 32 3z" fill="#0b0f1d" stroke="url(#lg)" stroke-width="2.5"/><path d="M19.5 30c0-8.5 5.5-15 12.5-15s12.5 6.5 12.5 15v6c0 7.5-5.5 13.5-12.5 13.5S19.5 43.5 19.5 36z" fill="#04050a"/><path d="M27 30.5l-4.5 4.5 4.5 4.5M37 30.5l4.5 4.5-4.5 4.5M33.6 28.5l-3.2 13" fill="none" stroke="url(#lg)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const logo = (url) => (url ? raw(`<img class="logo-img" src="${esc(url)}" alt="">`) : raw(LOGO));

const ART = {
  python: ['terminal', '#18b4ff', '#8b5cf6'], apk: ['phone', '#22d3a6', '#18b4ff'], course: ['cap', '#8b5cf6', '#ec4899'],
  video: ['play', '#f43f5e', '#8b5cf6'], file: ['folder', '#f59e0b', '#18b4ff'], free: ['gift', '#22d3a6', '#8b5cf6'],
  paid: ['gem', '#a855f7', '#f59e0b'], latest: ['bolt', '#18b4ff', '#22d3a6'], top: ['trend', '#f97316', '#8b5cf6'],
};
let n = 0;
export function art(kind, label = '') {
  const [ic, a, b] = ART[kind] || ART.file;
  const id = 'a' + (++n);
  return raw(`<svg class="art" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="${id}r" cx=".5" cy=".5" r=".65"><stop offset="0" stop-color="${a}" stop-opacity=".38"/><stop offset="1" stop-color="#05060b" stop-opacity="0"/></radialGradient><pattern id="${id}p" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0v22" fill="none" stroke="${a}" stroke-opacity=".13"/></pattern></defs><rect width="400" height="240" fill="#070912"/><rect width="400" height="240" fill="url(#${id}p)"/><rect width="400" height="240" fill="url(#${id}r)"/><g fill="none" stroke="url(#${id})" stroke-width="1.6" opacity=".6"><path d="M0 58h84l22 22h52M400 182h-92l-22-22h-46M62 240v-38l22-22M338 0v38l-22 22M0 200h40l14-14M400 40h-38l-14 14"/></g><g fill="${a}"><circle cx="158" cy="80" r="3.5"/><circle cx="240" cy="160" r="3.5"/><circle cx="84" cy="180" r="3"/><circle cx="316" cy="60" r="3"/><circle cx="54" cy="186" r="2.5"/><circle cx="348" cy="54" r="2.5"/></g><g transform="translate(150 70) scale(4.15)" fill="none" stroke="url(#${id})" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${P[ic]}"/></g></svg>`);
}
