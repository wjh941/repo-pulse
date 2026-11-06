#!/usr/bin/env node
/**
 * repo-pulse CLI：一行命令体检全部公开仓库。
 *
 *   node cli.js wjh941            # 表格输出
 *   node cli.js wjh941 --md       # Markdown 周报
 *   node cli.js wjh941 --json     # JSON 快照（可归档对比）
 *   node cli.js wjh941 --links    # README 外链存活检查（有 404 时退出码 1）
 */
const { GithubClient } = require('./lib/github-client');
const { pulse } = require('./lib/pulse');
const { toMarkdown } = require('./lib/report');
const { extractLinks, checkLinks } = require('./lib/linkcheck');

async function main() {
  const [user, ...flags] = process.argv.slice(2);
  if (!user) {
    console.error('用法: node cli.js <github用户名> [--md|--json|--links]');
    process.exit(2);
  }
  const client = new GithubClient();
  const report = await pulse(user, { client });

  if (flags.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else if (flags.includes('--md')) {
    console.log(toMarkdown(report));
  } else if (flags.includes('--links')) {
    await checkAllLinks(user, report, client);
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

/** 逐仓 README 外链存活检查;单仓 README 拉取失败不拖垮整轮,有失效链接时退出码 1 */
async function checkAllLinks(user, report, client) {
  console.log(`\n🔗 ${user} · README 外链存活检查\n`);
  let deadTotal = 0;
  for (const r of report.repos) {
    let md = null;
    try {
      md = await client.readme(user, r.name);
    } catch { /* 该仓跳过,不影响其他仓 */ }
    if (!md) {
      console.log(`  ${r.name.padEnd(22)} 无 README,跳过`);
      continue;
    }
    const links = extractLinks(md);
    if (links.length === 0) {
      console.log(`  ${r.name.padEnd(22)} 无外链`);
      continue;
    }
    const results = await checkLinks(links);
    const dead = results.filter((x) => x.verdict === 'dead');
    const warn = results.filter((x) => x.verdict === 'warn');
    deadTotal += dead.length;
    console.log(`  ${r.name.padEnd(22)} ${links.length} 链接 · ${dead.length} 失效 · ${warn.length} 疑似反爬`);
    for (const d of dead) console.log(`      ❌ [${d.code}] ${d.url}`);
    for (const w of warn) console.log(`      ⚠️  [${w.code}] ${w.url}`);
  }
  console.log('');
  if (deadTotal > 0) {
    console.error(`✖ 共 ${deadTotal} 条失效链接(404/410)`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`✖ ${e.message}`);
  process.exit(1);
});
