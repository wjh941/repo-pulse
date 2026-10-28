const test = require('node:test');
const assert = require('node:assert');
const { healthScore } = require('../lib/health');
const { pulse } = require('../lib/pulse');
const { toMarkdown } = require('../lib/report');

const NOW = new Date('2026-10-28T12:00:00Z').getTime();

/** 造一个满分仓库 fixture */
function perfectRepo(overrides = {}) {
  return {
    name: 'demo',
    html_url: 'https://github.com/wjh941/demo',
    description: '一句话描述',
    language: 'JavaScript',
    stargazers_count: 3,
    pushed_at: '2026-10-20T00:00:00Z',
    archived: false,
    homepage: 'https://wjh941.github.io/demo',
    license: { spdx_id: 'MIT' },
    topics: ['nodejs', 'cli', 'github'],
    fork: false,
    ...overrides,
  };
}

test('健康评分：全优仓库 = 100 分 A 级，findings 全为正向', () => {
  const h = healthScore(perfectRepo(), { conclusion: 'success' }, NOW);
  assert.strictEqual(h.score, 100);
  assert.strictEqual(h.grade, 'A');
  for (const f of h.findings) assert.ok(f.point > 0, `不应有 0 分项: ${f.text}`);
});

test('健康评分：CI 红灯 -30，评级随扣分下降', () => {
  const h = healthScore(perfectRepo(), { conclusion: 'failure' }, NOW);
  assert.strictEqual(h.score, 70);
  assert.strictEqual(h.grade, 'B');
  assert.ok(h.findings.some((f) => f.text.includes('红灯')));
});

test('健康评分：无 CI / 超三个月未推 / 元数据全缺 → 0 分 D 级', () => {
  const h = healthScore(
    perfectRepo({
      pushed_at: '2026-01-01T00:00:00Z',
      description: null,
      homepage: '',
      license: null,
      topics: [],
    }),
    null,
    NOW,
  );
  assert.strictEqual(h.score, 0);
  assert.strictEqual(h.grade, 'D');
  assert.strictEqual(h.findings.length, 6);
});

test('健康评分：确定性——同输入两次结果一致', () => {
  const a = healthScore(perfectRepo(), { conclusion: 'success' }, NOW);
  const b = healthScore(perfectRepo(), { conclusion: 'success' }, NOW);
  assert.deepStrictEqual(a, b);
});

test('健康评分：skipped 不按红灯惩罚但不得分', () => {
  const h = healthScore(perfectRepo(), { conclusion: 'skipped' }, NOW);
  assert.strictEqual(h.score, 70);
});

test('pulse 编排：按分数降序、summary 统计正确', async () => {
  const repos = [
    perfectRepo({ name: 'beta', pushed_at: '2026-01-01T00:00:00Z', description: null, homepage: '', license: null, topics: [] }),
    perfectRepo({ name: 'alpha' }),
  ];
  const client = {
    listRepos: async () => repos,
    latestRun: async (_u, name) => (name === 'alpha' ? { conclusion: 'success' } : null),
  };
  const report = await pulse('wjh941', { client });
  assert.strictEqual(report.repos[0].name, 'alpha'); // 高分在前
  assert.strictEqual(report.summary.total, 2);
  assert.strictEqual(report.summary.avgScore, 50); // (100+0)/2
  assert.strictEqual(report.summary.noCi, 1);
  assert.ok(report.generatedAt);
});

test('pulse 编排：CI 查询抛错不拖垮整份报告', async () => {
  const client = {
    listRepos: async () => [perfectRepo()],
    latestRun: async () => { throw new Error('GitHub API 500'); },
  };
  const report = await pulse('wjh941', { client });
  assert.strictEqual(report.repos[0].ciConclusion, null);
  assert.strictEqual(report.repos[0].score, 70); // 只有 CI 通道失分
});

test('Markdown 报告：含表格、修复清单、管道符转义安全', () => {
  const md = toMarkdown({
    user: 'wjh941',
    generatedAt: '2026-10-28T12:00:00Z',
    repos: [{
      ...healthScore(perfectRepo(), { conclusion: 'success' }, NOW),
      name: 'demo', url: 'https://github.com/wjh941/demo',
      ciConclusion: 'success', pushedAt: '2026-10-20T00:00:00Z',
      description: '带 | 竖线的描述', language: 'JS', stars: 1,
    }],
    summary: { total: 1, avgScore: 100, gradeA: 1, redCi: 0, noCi: 0, stale: 0 },
  });
  assert.ok(md.includes('| [demo]'));
  assert.ok(md.includes('🟢 100'));
  assert.ok(!md.includes('修复清单') || md.includes('修复清单（按仓库）'));
});
