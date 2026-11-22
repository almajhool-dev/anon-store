// عميل Neon SQL-over-HTTP مصغّر بدون مكتبات (نفس بروتوكول @neondatabase/serverless) لتصغير حزمة الدالة
const TYPE = { 16: 'b', 20: 'n', 21: 'n', 23: 'n', 26: 'n', 700: 'n', 701: 'n', 1700: 'n', 114: 'j', 3802: 'j', 1114: 't', 1184: 't', 1009: 'a', 1015: 'a', 2951: 'a' };

function parseArr(s) {
  if (s === '{}') return [];
  const out = [];
  let cur = '', q = false, quoted = false;
  for (let i = 1; i < s.length - 1; i++) {
    const ch = s[i];
    if (q) { if (ch === '\\') cur += s[++i]; else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') { q = true; quoted = true; }
    else if (ch === ',') { out.push(!quoted && cur === 'NULL' ? null : cur); cur = ''; quoted = false; }
    else cur += ch;
  }
  out.push(!quoted && cur === 'NULL' ? null : cur);
  return out;
}

function conv(v, t) {
  if (v === null || v === undefined) return null;
  switch (TYPE[t]) {
    case 'b': return v === 't';
    case 'n': return Number(v);
    case 'j': return JSON.parse(v);
    case 't': return v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00');
    case 'a': return parseArr(v);
    default: return v;
  }
}

const enc = (v) => v == null ? null
  : v instanceof Date ? v.toISOString()
  : Array.isArray(v) ? '{' + v.map((x) => '"' + String(x).replace(/["\\]/g, '\\$&') + '"').join(',') + '}'
  : typeof v === 'object' ? JSON.stringify(v)
  : String(v);

export function createSql(url) {
  const endpoint = `https://${new URL(url).hostname}/sql`;
  const base = { 'Neon-Connection-String': url, 'Neon-Raw-Text-Output': 'true', 'Neon-Array-Mode': 'true', 'Content-Type': 'application/json' };
  const shape = (r) => {
    const f = r.fields || [];
    return (r.rows || []).map((row) => { const o = {}; f.forEach((fd, i) => { o[fd.name] = conv(row[i], fd.dataTypeID); }); return o; });
  };
  async function post(body, extra) {
    const res = await fetch(endpoint, { method: 'POST', headers: { ...base, ...extra }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(j.message || `db_http_${res.status}`);
      e.code = j.code; e.detail = j.detail; e.status = res.status;
      throw e;
    }
    return j;
  }
  const query = async (text, params = []) => shape(await post({ query: text, params: params.map(enc) }));
  const batch = async (list, readOnly = false) => {
    const j = await post({ queries: list.map(([text, params = []]) => ({ query: text, params: params.map(enc) })) },
      { 'Neon-Batch-Isolation-Level': 'ReadCommitted', 'Neon-Batch-Read-Only': String(readOnly) });
    return j.results.map(shape);
  };
  return { query, batch };
}
