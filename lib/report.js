/**
 * 报告输出：JSON 快照 / Markdown 周报。
 * Markdown 版本面向"复制进周报或 issue"的场景，表格 + 待办清单直接可用。
 */

const GRADE_ICON = { A: '🟢', B: '🟡', C: '🟠', D: '🔴' };

function toMarkdown(report) {
  const { user, generatedAt, repos, summary } = report;
  const lines = [];
  lines.push(`# 📊 ${user} 的仓库脉搏`);
  lines.push('');
  lines.push(`> 生成于 ${generatedAt} · ${summary.total} 个公开仓库 · 平均健康分 **${summary.avgScore}** · A 级 ${summary.gradeA} 个`);
  lines.push('');
  lines.push('| 仓库 | 评分 | CI | 最近推送 | 一句话诊断 |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const r of repos) {
    const ciCell = r.ciConclusion === 'success' ? '✅' : r.ciConclusion ? `❌ ${r.ciConclusion}` : '—';
    const pushDay = r.pushedAt ? r.pushedAt.slice(0, 10) : '—';
    const worst = [...r.findings].filter((f) => f.point === 0)[0];
    lines.push(`| [${r.name}](${r.url}) | ${GRADE_ICON[r.grade]} ${r.score} | ${ciCell} | ${pushDay} | ${worst ? worst.text : '状态良好'} |`);
  }
  lines.push('');
  const todos = repos.flatMap((r) => r.findings.filter((f) => f.point === 0).map((f) => ({ r, f })));
  if (todos.length) {
    lines.push('## 🔧 修复清单（按仓库）');
    lines.push('');
    for (const { r, f } of todos) lines.push(`- **${r.name}**：${f.text}`);
  }
  return lines.join('\n');
}

module.exports = { toMarkdown, GRADE_ICON };
