#!/usr/bin/env node
/**
 * repo-pulse CLI：一行命令体检全部公开仓库。
 *
 *   node cli.js wjh941            # 表格输出
 *   node cli.js wjh941 --md       # Markdown 周报
 *   node cli.js wjh941 --json     # JSON 快照（可归档对比）
 */
const { GithubClient } = require('./lib/github-client');
const { pulse } = require('./lib/pulse');
const { toMarkdown } = require('./lib/report');

async function main() {
  const [user, ...flags] = process.argv.slice(2);
  if (!user) {
    console.error('用法: node cli.js <github用户名> [--md|--json]');
    process.exit(2);
  }
  const report = await pulse(user, { client: new GithubClient() });

  if (flags.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else if (flags.includes('--md')) {
    console.log(toMarkdown(report));
  } else {
    const { summary, repos } = report;
    console.log(`\n📊 ${user} · ${summary.total} 仓 · 平均健康分 ${summary.avgScore} · A 级 ${summary.gradeA} 个\n`);
    for (const r of repos) {
      const ci = r.ciConclusion === 'success' ? 'CI✅' : r.ciConclusion ? `CI❌(${r.ciConclusion})` : 'CI—';
      console.log(`  ${r.score.toString().padStart(3)} [${r.grade}] ${r.name.padEnd(22)} ${ci.padEnd(16)} ${r.pushedAt.slice(0, 10) || '—'}`);
      for (const f of r.findings.filter((x) => x.point === 0)) {
        console.log(`      ⚠️  ${f.text}`);
      }
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error(`✖ ${e.message}`);
  process.exit(1);
});
