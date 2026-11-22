// أداة قاعدة البيانات: node scripts/db.mjs migrate | api-password | claim | sql "<query>"
import { readFileSync, readdirSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { createSql } from '../api/src/sql.js';

const sql = createSql(process.env.DATABASE_URL_OWNER);

export function split(src) {
  const out = []; let cur = '', i = 0, tag = null, q = false;
  while (i < src.length) {
    const ch = src[i];
    if (tag) { if (src.startsWith(tag, i)) { cur += tag; i += tag.length; tag = null; } else { cur += ch; i++; } continue; }
    if (q) { cur += ch; i++; if (ch === "'") { if (src[i] === "'") { cur += "'"; i++; } else q = false; } continue; }
    if (ch === '-' && src[i + 1] === '-') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (ch === "'") { q = true; cur += ch; i++; continue; }
    if (ch === '$') { const m = src.slice(i).match(/^\$[A-Za-z_]*\$/); if (m) { tag = m[0]; cur += tag; i += tag.length; continue; } }
    if (ch === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; i++; continue; }
    cur += ch; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'migrate') {
  await sql.batch([['create schema if not exists ops'], ['create table if not exists ops.migrations(name text primary key, applied_at timestamptz default now())']]);
  const done = new Set((await sql.query('select name from ops.migrations')).map((r) => r.name));
  for (const f of readdirSync('db').filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    const stmts = split(readFileSync(`db/${f}`, 'utf8'));
    await sql.batch([...stmts.map((s) => [s]), ['insert into ops.migrations(name) values ($1)', [f]]]);
    console.log('applied', f, stmts.length, 'statements');
  }
} else if (cmd === 'api-password') {
  const pw = process.env.STORE_API_PASSWORD;
  if (!/^[a-f0-9]{32,}$/.test(pw || '')) throw new Error('STORE_API_PASSWORD must be hex');
  await sql.query(`alter role store_api password '${pw}'`);
  console.log('store_api password set');
} else if (cmd === 'claim') {
  const token = randomBytes(24).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  await sql.query(`insert into settings(key, value) values ('owner_claim', $1) on conflict (key) do update set value = excluded.value, updated_at = now()`, [{ hash }]);
  console.log('OWNER_CLAIM_TOKEN=' + token);
} else if (cmd === 'sql') {
  console.log(JSON.stringify(await sql.query(arg), null, 1));
} else {
  console.log('usage: migrate | api-password | claim | sql "<query>"');
}
