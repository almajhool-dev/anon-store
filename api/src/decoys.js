// 🕸️ نظام الخداع الدفاعي: 3000 مؤشر افتراضي معزول (ليست خوادم ولا واجهات حقيقية)
// مسارات فخ، لوحات إدارة وهمية، بصمات خدمات، ردود API محاكاة، ملفات وأدلة وهمية، بيئات اختبار وهمية، بصمات بنية تحتية،
// وعناوين IP اصطناعية من نطاقات التوثيق RFC 5737 (غير قابلة للتوجيه، لا تخص أي خادم حقيقي).
// كل الردود تُولَّد من بذرة المسار فقط: لا قاعدة بيانات، لا إعدادات، لا ملفات، لا مفاتيح حقيقية.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const H = (s) => createHash('sha256').update('decoy:' + s).digest();
const pick = (h, i, a) => a[h[i % 32] % a.length];
const hx = (h, n, off = 0) => (h.toString('hex') + H(h.toString('hex')).toString('hex')).slice(off, off + n);
const x = (pre, names) => pre.flatMap((p) => names.map((n) => p + n));

// [الاسم بالعربية، وزن العقوبة عند معرفة العنوان الحقيقي] — 10 = حظر فوري
export const CATS = {
  endpoint: ['نقاط API خادعة', 3], honeypot: ['لوحات إدارة وهمية', 3], fingerprint: ['بصمات خدمات وهمية', 2], api: ['ردود API محاكاة', 3],
  resource: ['ملفات حساسة وهمية', 6], directory: ['أدلة ونسخ احتياطية وهمية', 2], trap: ['فخاخ استغلال', 10], env: ['بيئات اختبار معزولة وهمية', 2],
  infra: ['بصمات بنية تحتية وهمية', 4], ip: ['عناوين IP اصطناعية (كناري)', 10],
};
// مسارات الموقع الحقيقية — يُمنع أن يبدأ بها أي فخ
export const RESERVED = new Set(['p', 'learn', 'account', 'login', 'signup', 'forgot', 'contact', 'faq', 'claim', 'page', 'admin', 'python', 'apk', 'courses',
  'videos', 'files', 'free', 'paid', 'latest', 'top', 'search', 'assets', 'api/auth', 'api/v1', 'index.html', 'manifest.webmanifest', 'robots.txt',
  'sitemap.xml', 'build-stats.json', 'favicon.ico', 'favicon.svg', 'icons', 'trap']);

function build() {
  const paths = new Map();
  const put = (cat, kind, list) => { for (const p of list) if (!paths.has(p)) paths.set(p, [cat, kind, paths.size + 1]); };
  const API = ['users', 'accounts', 'keys', 'tokens', 'config', 'settings', 'backup', 'export', 'import', 'logs', 'metrics', 'billing', 'payments', 'orders', 'customers',
    'sessions', 'secrets', 'webhooks', 'jobs', 'cache', 'debug', 'health', 'status', 'version', 'graphql', 'reports', 'audit', 'roles', 'permissions', 'invoices'];
  put('endpoint', 'json', x(['/api/v2/', '/api/internal/', '/api/private/', '/api/admin/', '/api/debug/', '/rest/v1/', '/v2/api/'], API));
  put('honeypot', 'login', x(['', '/old', '/new', '/dev', '/test', '/backup'], ['/wp-login.php', '/wp-admin/', '/wp-admin/admin-ajax.php', '/wp-admin/install.php',
    '/wp-admin/setup-config.php', '/wp-json/wp/v2/users', '/xmlrpc.php', '/administrator/', '/administrator/index.php', '/user/login', '/admin.php', '/login.php',
    '/phpmyadmin/', '/phpmyadmin/index.php', '/pma/', '/myadmin/', '/mysql/', '/sqladmin/', '/adminer.php', '/adminer/', '/cpanel', '/whm', '/webmail/', '/plesk/',
    '/manager/html', '/host-manager/html', '/jenkins/login', '/hudson/', '/solr/admin/', '/grafana/login', '/kibana/', '/portainer/', '/rabbitmq/', '/pgadmin/',
    '/owa/auth/logon.aspx', '/ecp/', '/remote/login', '/vpn/index.html', '/global-protect/login.esp', '/dana-na/auth/url_default/welcome.cgi', '/boaform/admin/formLogin',
    '/HNAP1/', '/login.action', '/console/login/LoginForm.jsp', '/zabbix/', '/nagios/', '/webadmin/', '/siteadmin/', '/backend/', '/panel/', '/controlpanel/',
    '/admincp/', '/moderator/', '/joomla/administrator/', '/drupal/user/login', '/magento/admin', '/typo3/', '/umbraco/', '/ghost/signin', '/strapi/admin']));
  put('fingerprint', 'banner', x(['', '/old', '/app', '/srv', '/www'], ['/server-status', '/server-info', '/nginx_status', '/status.php', '/phpinfo.php', '/info.php',
    '/php.php', '/test.php', '/i.php', '/version.txt', '/VERSION', '/CHANGELOG.txt', '/readme.html', '/license.txt', '/elmah.axd', '/trace.axd', '/iisstart.htm',
    '/web.config', '/crossdomain.xml', '/clientaccesspolicy.xml', '/server.xml', '/jmx-console/', '/web-console/', '/invoker/JMXInvokerServlet', '/health.php',
    '/metrics', '/prometheus/metrics', '/debug/vars', '/debug/pprof/', '/_profiler/']));
  put('api', 'record', [...Array(150)].map((_, i) => `/api/v2/users/${1001 + i}`).concat([...Array(100)].map((_, i) => `/api/internal/orders/${50001 + i}`),
    [...Array(100)].map((_, i) => `/rest/v1/customers/${7001 + i}`)));
  put('resource', 'file', x(['/', '/app/', '/backend/', '/config/', '/src/', '/www/', '/public/', '/laravel/', '/site/', '/old/'], ['.env', '.env.local', '.env.production',
    '.env.prod', '.env.dev', '.env.development', '.env.staging', '.env.backup', '.env.bak', '.env.old', '.env.save', '.env.example', 'config.php', 'config.json',
    'config.yml', 'config.yaml', 'config.ini', 'config.inc.php', 'configuration.php', 'settings.py', 'local_settings.py', 'database.yml', 'secrets.yml',
    'credentials.json', 'credentials.yml', 'wp-config.php', 'wp-config.php.bak', 'wp-config.old', '.htpasswd', '.npmrc', '.pypirc', '.netrc', '.dockercfg', 'id_rsa',
    'id_rsa.pub', 'id_dsa', '.ssh/id_rsa', '.aws/credentials', '.aws/config', '.docker/config.json', '.kube/config', 'service-account.json', 'firebase.json',
    'google-services.json', 'appsettings.json', 'appsettings.Development.json', 'parameters.yml', 'env.js', 'keys.json', 'secret.key']));
  put('trap', 'exploit', x(['', '/wordpress', '/wp', '/blog', '/site', '/old'], ['/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php', '/_ignition/execute-solution',
    '/cgi-bin/luci', '/cgi-bin/test.cgi', '/cgi-bin/php', '/cgi-bin/bash', '/shell.php', '/cmd.php', '/c99.php', '/r57.php', '/wso.php', '/up.php', '/upload.php',
    '/uploader.php', '/x.php', '/1.php', '/bypass.php', '/alfa.php', '/.git/config', '/.git/HEAD', '/.git/index', '/.git/logs/HEAD', '/.git/refs/heads/main',
    '/.svn/entries', '/.svn/wc.db', '/.hg/hgrc', '/.bzr/branch-format', '/.DS_Store', '/WEB-INF/web.xml', '/META-INF/MANIFEST.MF', '/actuator/env',
    '/actuator/heapdump', '/actuator/gateway/routes', '/actuator/mappings', '/actuator/configprops', '/api/jsonws/invoke', '/solr/admin/cores', '/index.action',
    '/wls-wsat/CoordinatorPortType', '/_async/AsyncResponseService', '/telescope/requests', '/horizon/api/stats', '/storage/logs/laravel.log', '/debug/default/view',
    '/elfinder/connector.php', '/filemanager/dialog.php', '/ckfinder/ckfinder.html', '/kcfinder/browse.php', '/Telerik.Web.UI.WebResource.axd', '/ReportServer/',
    '/scripts/setup.php', '/setup.php', '/install.php', '/installer.php', '/upgrade.php', '/update.php', '/eval.php', '/phpunit.xml', '/composer.lock', '/yarn.lock']));
  put('env', 'stage', x(['/staging', '/stage', '/dev', '/develop', '/test', '/testing', '/qa', '/uat', '/sandbox', '/beta', '/preview', '/demo', '/internal', '/intranet',
    '/legacy', '/v1-old', '/new-site', '/old-site', '/preprod', '/backup-site'], ['/', '/login', '/admin', '/api', '/dashboard', '/config', '/debug', '/status', '/graphql', '/console']));
  put('infra', 'infra', x(['', '/app', '/deploy', '/infra', '/ops'], ['/.kube/config', '/metadata/v1/', '/169.254.169.254/latest/meta-data/', '/169.254.169.254/latest/meta-data/iam/security-credentials/',
    '/computeMetadata/v1/', '/openstack/latest/meta_data.json', '/docker-compose.yml', '/docker-compose.yaml', '/Dockerfile', '/.dockerenv', '/terraform.tfstate',
    '/terraform.tfvars', '/.terraform/terraform.tfstate', '/ansible.cfg', '/inventory.ini', '/k8s/secrets.yaml', '/helm/values.yaml', '/.gitlab-ci.yml',
    '/.github/workflows/deploy.yml', '/Jenkinsfile', '/.circleci/config.yml', '/.travis.yml', '/bitbucket-pipelines.yml', '/Vagrantfile', '/Procfile', '/serverless.yml',
    '/cloudbuild.yaml', '/appspec.yml', '/buildspec.yml', '/upstreams.json']));
  put('directory', 'listing', ['/backup/', '/backups/', '/bak/', '/db/', '/database/', '/dump/', '/dumps/', '/sql/', '/data/', '/private/', '/storage/', '/logs/', '/log/',
    '/tmp/', '/temp/', '/cache/', '/archive/', '/exports/', '/uploads/private/', '/old/files/']);
  // بقية الـ3000: عناوين IP اصطناعية من نطاقات التوثيق تظهر داخل الردود الوهمية فقط (كناري: ظهورها في طلب لاحق يعني أن المهاجم قرأ الفخ)
  const ips = ['192.0.2.', '198.51.100.', '203.0.113.'].flatMap((n) => [...Array(254)].map((_, i) => n + (i + 1))).slice(0, 3000 - paths.size);
  return { paths, ips };
}
const { paths: PATHS, ips: IPS } = build();
export const DECOY_COUNT = PATHS.size + IPS.length;
export const DECOY_PATHS = [...PATHS.keys()];
const IPSET = new Set(IPS);
export const synthIp = (s) => IPS[H('ip:' + s).readUInt16BE(0) % IPS.length];
// كناري: هل يحتوي الطلب عنواناً اصطناعياً سبق أن ظهر في ردودنا الوهمية؟
export const canaryIn = (text) => { for (const m of String(text || '').matchAll(/\b(?:192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}\b/g)) if (IPSET.has(m[0])) return m[0]; return null; };

// مسار التوجيه لكل فخ (بادئة أو مسار كامل) — يُستخدم لتوليد قواعد Netlify وللمطابقة
const rootOf = (p) => { const s = p.split('/').filter(Boolean); return p.startsWith('/api/') ? `/api/${s[1]}` : `/${s[0]}`; };
export function decoyRoutes() {
  const pre = new Map(), exact = new Set();
  for (const [p, v] of PATHS) {
    const r = rootOf(p), depth = p.split('/').filter(Boolean).length;
    if (depth > (p.startsWith('/api/') ? 2 : 1) || p.endsWith('/')) { if (!pre.has(r)) pre.set(r, v); } else exact.add(r);
  }
  for (const r of pre.keys()) exact.delete(r);
  for (const r of [...pre.keys(), ...exact]) if (RESERVED.has(r.slice(1))) throw new Error('decoy collides with real route: ' + r);
  return { prefixes: [...pre.keys()].sort(), exact: [...exact].sort(), prefixCat: pre };
}
const ROUTES = decoyRoutes();

export function matchDecoy(path) {
  const p = String(path || '/').slice(0, 300);
  const v = PATHS.get(p) || PATHS.get(p + '/') || (p.endsWith('/') && PATHS.get(p.slice(0, -1)));
  if (v) return { path: p, cat: v[0], kind: v[1], id: 'D' + String(v[2]).padStart(4, '0') };
  const r = rootOf(p), pv = ROUTES.prefixCat.get(r);
  if (pv && (p === r || p.startsWith(r + '/'))) return { path: p, cat: pv[0], kind: pv[1] === 'record' ? 'json' : pv[1], id: 'P' + r };
  return null;
}

// التحقق من توقيع وكيل Netlify (JWS HS256 في رأس x-nf-sign) قبل الثقة بعنوان العميل الذي يمرره
export function verifyEdge(jws, key) {
  if (!jws || !key) return false;
  const [h, p, s] = String(jws).split('.');
  if (!h || !p || !s) return false;
  try {
    if (JSON.parse(Buffer.from(h, 'base64url').toString()).alg !== 'HS256') return false;
    const mac = createHmac('sha256', key).update(`${h}.${p}`).digest();
    const sig = Buffer.from(s, 'base64url');
    if (sig.length !== mac.length || !timingSafeEqual(sig, mac)) return false;
    const c = JSON.parse(Buffer.from(p, 'base64url').toString());
    return c.iss === 'netlify' && (!c.exp || c.exp * 1000 > Date.now() - 60000);
  } catch { return false; }
}

// ---------- الردود الاصطناعية ----------
const SRV = ['Apache/2.4.41 (Ubuntu)', 'nginx/1.18.0 (Ubuntu)', 'Microsoft-IIS/10.0', 'Apache/2.4.38 (Debian)', 'nginx/1.14.2', 'LiteSpeed', 'Apache-Coyote/1.1', 'Jetty(9.4.43.v20210629)'];
const PHP = ['PHP/7.4.3', 'PHP/7.2.24', 'PHP/8.0.30', 'PHP/5.6.40'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fakeKey = (h, n, a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567') => [...Array(n)].map((_, i) => a[(h[i % 32] ^ (i * 7)) & 31]).join('');

function file(leaf, h, ip, p) {
  const db = `app_${hx(h, 4)}`;
  if (/^\.env|env\.js$|\.ini$|secret\.key$|\.htpasswd$|\.netrc$|\.npmrc$|\.pypirc$/.test(leaf)) {
    if (leaf === '.htpasswd') return ['text/plain', `admin:$apr1$${hx(h, 8)}$${hx(h, 22, 8)}\n`];
    return ['text/plain', `APP_ENV=production\nAPP_DEBUG=false\nAPP_KEY=base64:${Buffer.from(hx(h, 32)).toString('base64')}\nDB_CONNECTION=mysql\nDB_HOST=${ip}\nDB_PORT=3306\nDB_DATABASE=${db}\nDB_USERNAME=${db}\nDB_PASSWORD=${hx(h, 20, 12)}\nREDIS_HOST=${synthIp(p + 'r')}\nMAIL_HOST=smtp.example.invalid\nAWS_ACCESS_KEY_ID=AKIA${fakeKey(h, 16)}\nAWS_SECRET_ACCESS_KEY=${Buffer.from(hx(h, 30, 20)).toString('base64').slice(0, 40)}\nAWS_DEFAULT_REGION=eu-west-1\n`];
  }
  if (/id_[rd]sa(\.pub)?$/.test(leaf)) return ['text/plain', leaf.endsWith('.pub') ? `ssh-rsa AAAAB3NzaC1yc2E${Buffer.from(hx(h, 60)).toString('base64')} deploy@${ip}\n` : `-----BEGIN OPENSSH PRIVATE KEY-----\n${Buffer.from(hx(h, 64) + hx(h, 64, 3)).toString('base64').match(/.{1,70}/g).join('\n')}\n-----END OPENSSH PRIVATE KEY-----\n`];
  if (/\.json$/.test(leaf)) return ['application/json', JSON.stringify({ type: 'service_account', project_id: `prj-${hx(h, 6)}`, private_key_id: hx(h, 40), client_email: `svc-${hx(h, 5)}@example.invalid`, host: ip, token_uri: 'https://auth.example.invalid/token' }, null, 2)];
  if (/\.ya?ml$/.test(leaf)) return ['text/yaml', `production:\n  adapter: mysql2\n  host: ${ip}\n  database: ${db}\n  username: ${db}\n  password: "${hx(h, 18)}"\n`];
  if (/\.php|\.old|\.bak/.test(leaf)) return ['text/plain', `<?php\ndefine('DB_NAME', '${db}');\ndefine('DB_USER', '${db}');\ndefine('DB_PASSWORD', '${hx(h, 16, 4)}');\ndefine('DB_HOST', '${ip}');\n$table_prefix = 'wp_';\n`];
  if (/^(credentials|config)$/.test(leaf)) return ['text/plain', `[default]\naws_access_key_id = AKIA${fakeKey(h, 16)}\naws_secret_access_key = ${Buffer.from(hx(h, 30)).toString('base64').slice(0, 40)}\nregion = eu-west-1\n`];
  return ['text/plain', `# ${leaf}\nhost=${ip}\nkey=${hx(h, 32)}\n`];
}

export function decoyResponse(d) {
  const h = H(d.path), ip = synthIp(d.path), srv = pick(h, 1, SRV), php = pick(h, 2, PHP);
  const day = new Date(Date.UTC(2024, h[3] % 12, 1 + (h[4] % 27), h[5] % 24, h[6] % 60));
  const leaf = d.path.split('/').filter(Boolean).pop() || '';
  const R = (ct, body, status = 200) => ({ status, ct, body });
  switch (d.kind) {
    case 'json':
      if (/secrets|tokens|keys|billing|payments|permissions/.test(d.path)) return R('application/json', JSON.stringify({ error: 'unauthorized', message: 'Missing or invalid API key', request_id: hx(h, 24) }), 401);
      return R('application/json', JSON.stringify({ status: 'ok', version: `2.${h[7] % 9}.${h[8] % 20}`, node: ip, request_id: hx(h, 24),
        data: [...Array(3 + (h[9] % 4))].map((_, i) => ({ id: 1000 + ((h[10 + i] * 37) % 9000), name: `${leaf}_${hx(h, 6, i * 6)}`, created_at: day.toISOString(), region: pick(h, 14 + i, ['eu-west', 'us-east', 'ap-south']) })) }));
    case 'record': {
      const n = Number(leaf) || 1;
      return R('application/json', JSON.stringify({ id: n, username: `user_${hx(h, 6)}`, email: `user${n}@example.invalid`, role: pick(h, 2, ['member', 'viewer', 'editor']), status: 'active', last_login_ip: ip, created_at: day.toISOString() }));
    }
    case 'login':
      return R('text/html; charset=utf-8', `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Sign in</title></head><body><form method="post"><h1>Administration</h1><p><label>Username <input name="log" autocomplete="off"></label></p><p><label>Password <input name="pwd" type="password" autocomplete="off"></label></p><button>Log In</button></form><!-- ${srv} ${php} ${ip} --></body></html>`);
    case 'banner':
      if (/phpinfo|info\.php|php\.php|i\.php|test\.php/.test(leaf)) return R('text/html; charset=utf-8', `<!doctype html><html><head><meta name="robots" content="noindex"><title>phpinfo()</title></head><body><h1>PHP Version ${php.slice(4)}</h1><table><tr><td>System</td><td>Linux web-${hx(h, 4)} 5.4.0-${h[11] % 150}-generic x86_64</td></tr><tr><td>Server API</td><td>Apache 2.0 Handler</td></tr><tr><td>SERVER_ADDR</td><td>${ip}</td></tr><tr><td>DOCUMENT_ROOT</td><td>/var/www/html</td></tr></table></body></html>`);
      if (/metrics|vars|pprof|profiler/.test(d.path)) return R('text/plain', `# HELP process_cpu_seconds_total Total user and system CPU time\nprocess_cpu_seconds_total ${(h[12] * 13.7).toFixed(2)}\nprocess_resident_memory_bytes ${h[13] * 1048576}\nhttp_requests_total{code="200",host="${ip}"} ${h[14] * 977}\n`);
      if (/\.xml$|\.config$/.test(leaf)) return R('application/xml', `<?xml version="1.0"?>\n<configuration><appSettings><add key="Environment" value="Production"/><add key="Node" value="${ip}"/></appSettings></configuration>`);
      return R('text/plain', `${srv} Server Status for ${ip}\n\nServer Version: ${srv} ${php}\nServer Built: ${day.toUTCString()}\nCurrent Time: ${new Date().toUTCString()}\nServer uptime: ${h[15] % 90} days ${h[16] % 24} hours\nTotal accesses: ${h[17] * 7919} - Total Traffic: ${h[18] % 900} MB\n${(h[19] % 40) + 3} requests currently being processed, ${(h[20] % 20) + 5} idle workers\n`);
    case 'file': { const [ct, body] = file(leaf, h, ip, d.path); return R(ct, body); }
    case 'exploit':
      if (/\.git\/config$/.test(d.path)) return R('text/plain', `[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n[remote "origin"]\n\turl = https://git.example.invalid/corp/${hx(h, 8)}.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n\tremote = origin\n\tmerge = refs/heads/main\n`);
      if (/\.git\/HEAD$/.test(d.path)) return R('text/plain', 'ref: refs/heads/main\n');
      if (/\.log$/.test(leaf)) return R('text/plain', `[${day.toISOString()}] production.ERROR: SQLSTATE[HY000] [2002] Connection refused (host ${ip}) {"exception":"[object] (PDOException(code: 2002))"}\n`);
      if (/\.lock$|\.xml$|MANIFEST|entries|hgrc|branch-format/.test(leaf)) return R('text/plain', `# ${leaf}\n${hx(h, 40)}\n`);
      return R('text/html; charset=utf-8', `<!-- ${srv} -->`);
    case 'stage':
      return R('text/html; charset=utf-8', `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Staging ${hx(h, 4)}</title></head><body><h1>Staging environment</h1><p>Build ${h[21] % 9}.${h[22] % 40}.${h[23] % 300} — node ${ip}</p><p>Access restricted to internal network.</p><!-- ${srv} --></body></html>`, 403);
    case 'infra':
      if (/meta-?data|computeMetadata/.test(d.path)) return R('application/json', JSON.stringify({ instanceId: `i-${hx(h, 17)}`, localIpv4: ip, region: 'eu-west-1', availabilityZone: 'eu-west-1b', instanceType: pick(h, 3, ['t3.medium', 'm5.large', 'c5.xlarge']) }));
      if (/tfstate|upstreams/.test(leaf)) return R('application/json', JSON.stringify({ version: 4, serial: h[24], resources: [...Array(3)].map((_, i) => ({ type: pick(h, 25 + i, ['aws_instance', 'aws_db_instance', 'aws_lb']), name: `node_${i}`, private_ip: synthIp(d.path + i) })) }));
      if (/kube/.test(d.path)) return R('text/yaml', `apiVersion: v1\nclusters:\n- cluster:\n    server: https://${ip}:6443\n  name: prod\ncontexts:\n- context: {cluster: prod, user: deploy}\n  name: prod\nusers:\n- name: deploy\n  user:\n    token: ${hx(h, 48)}\n`);
      return R('text/yaml', `# ${leaf}\nservices:\n  app:\n    image: registry.example.invalid/app:${h[26] % 20}.${h[27] % 10}\n    environment:\n      DB_HOST: ${ip}\n      DB_PASSWORD: ${hx(h, 16)}\n`);
    case 'listing': {
      const files = [...Array(5 + (h[28] % 6))].map((_, i) => { const t = new Date(day.getTime() + i * 86400000 * (1 + (h[i] % 9))); return [`${pick(h, i, ['db', 'backup', 'site', 'dump', 'export'])}-${t.toISOString().slice(0, 10)}.${pick(h, i + 3, ['sql.gz', 'tar.gz', 'zip', 'sql'])}`, t, ((h[i + 4] + 1) * 1.7).toFixed(1) + 'M']; });
      return R('text/html; charset=utf-8', `<!doctype html><html><head><meta name="robots" content="noindex"><title>Index of ${esc(d.path)}</title></head><body><h1>Index of ${esc(d.path)}</h1><table><tr><th>Name</th><th>Last modified</th><th>Size</th></tr><tr><td><a href="../">Parent Directory</a></td><td></td><td>-</td></tr>${files.map(([n, t, s]) => `<tr><td><a href="${n}">${n}</a></td><td>${t.toISOString().slice(0, 16).replace('T', ' ')}</td><td>${s}</td></tr>`).join('')}</table><address>${srv} Server at ${ip} Port 80</address></body></html>`);
    }
    default:
      return R('text/html; charset=utf-8', `<!-- ${srv} -->`, 404);
  }
}
