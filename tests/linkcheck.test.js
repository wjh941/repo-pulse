const test = require('node:test');
const assert = require('node:assert');
const { extractLinks, checkLinks } = require('../lib/linkcheck');

/** 造一个按 URL 前缀返回固定响应/异常的 fetchImpl */
function stubFetch(routes) {
  return async (url) => {
    for (const [prefix, outcome] of Object.entries(routes)) {
      if (url.startsWith(prefix)) {
        if (outcome.throw) throw new Error(outcome.throw);
        return { ok: outcome.status >= 200 && outcome.status < 400, status: outcome.status };
      }
    }
    throw new Error(`stub 未配置: ${url}`);
  };
}

test('提取：去重、保序、剥离句尾标点', () => {
  const md = [
    '看 [ai-resume](https://github.com/wjh941/ai-resume) 和',
    '![图](https://raw.githubusercontent.com/wjh941/ai-resume/main/docs/images/dashboard.png)。',
    '重复的 [again](https://github.com/wjh941/ai-resume),还有裸链 https://example.com/a。',
  ].join('\n');
  assert.deepStrictEqual(extractLinks(md), [
    'https://github.com/wjh941/ai-resume',
    'https://raw.githubusercontent.com/wjh941/ai-resume/main/docs/images/dashboard.png',
    'https://example.com/a',
  ]);
});

test('提取：相对链接与锚点不收', () => {
  const md = '[本地](./docs/x.md) [锚点](#section) [外链](https://ok.example)';
  assert.deepStrictEqual(extractLinks(md), ['https://ok.example']);
});

test('提取：markdown 加粗号与逗号连写不混入 URL(2026-11-06 首跑发现的伪影)', () => {
  const md = [
    '在线地址:**https://demo.example/site/**',
    '本地面板 http://127.0.0.1:4310/** 有审批门',
    '双链连写:https://a.example/x,https://b.example/y 都是真链接',
  ].join('\n');
  assert.deepStrictEqual(extractLinks(md), [
    'https://demo.example/site/',
    'http://127.0.0.1:4310/',
    'https://a.example/x',
    'https://b.example/y',
  ]);
});

test('判定：localhost / 示例域名 / 尖括号占位符直接 skip,不探测', async () => {
  const results = await checkLinks(
    [
      'http://127.0.0.1:8000/health',
      'https://your-name.example.com/x',
      'https://<你的域名>/callback',
      'https://real.example/ok',
    ],
    {
      fetchImpl: stubFetch({
        'https://your-name.example.com/': { status: 200 },
        'https://real.example/': { status: 200 },
      }),
    },
  );
  const byUrl = Object.fromEntries(results.map((r) => [r.url, r.verdict]));
  assert.strictEqual(byUrl['http://127.0.0.1:8000/health'], 'skip');
  assert.strictEqual(byUrl['https://your-name.example.com/x'], 'ok'); // *.example.com 是合法子域,只有裸 example.com 才跳过
  assert.strictEqual(byUrl['https://<你的域名>/callback'], 'skip');
  assert.strictEqual(byUrl['https://real.example/ok'], 'ok');
});

test('提取：行内代码段里的 URL 是配置示例,不是链接', () => {
  const md = 'CORS 配置 `https://a.example,https://wjh941.github.io` 写错会全线拦截;真实入口见 https://real.example/in';
  assert.deepStrictEqual(extractLinks(md), ['https://real.example/in']);
});

test('判定：2xx=ok / 404,410=dead / 401,403,429=warn', async () => {
  const results = await checkLinks(
    [
      'https://a.example/good',
      'https://b.example/gone',
      'https://c.example/private',
      'https://d.example/ratelimited',
    ],
    {
      fetchImpl: stubFetch({
        'https://a.example/': { status: 200 },
        'https://b.example/': { status: 404 },
        'https://c.example/': { status: 403 },
        'https://d.example/': { status: 429 },
      }),
    },
  );
  const byUrl = Object.fromEntries(results.map((r) => [r.url, r.verdict]));
  assert.strictEqual(byUrl['https://a.example/good'], 'ok');
  assert.strictEqual(byUrl['https://b.example/gone'], 'dead');
  assert.strictEqual(byUrl['https://c.example/private'], 'warn');
  assert.strictEqual(byUrl['https://d.example/ratelimited'], 'warn');
});

test('判定：网络异常按 warn 不误杀(反爬/超时可能是对方站点行为)', async () => {
  const results = await checkLinks(['https://x.example/blocked'], {
    fetchImpl: async () => {
      throw new Error('ECONNREFUSED');
    },
  });
  assert.strictEqual(results[0].verdict, 'warn');
});

test('判定：重定向跟随由 fetch 负责,checker 只看最终状态', async () => {
  const results = await checkLinks(['https://s.example/short'], {
    fetchImpl: stubFetch({ 'https://s.example/': { status: 200 } }),
  });
  assert.strictEqual(results[0].verdict, 'ok');
});
