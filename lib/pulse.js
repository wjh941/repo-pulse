/**
 * 仓库组合评估：拉取仓库列表 + 逐仓 CI 状态，产出健康报告。
 * 评分本体在 health.js（纯函数）；这里只负责编排与聚合。
 */

const { GithubClient } = require('./github-client');
const { healthScore } = require('./health');

/**
 * 评估一个用户的全部公开仓库。
 * @param {string} user GitHub 用户名
 * @param {Object} [opts] { client: GithubClient } 注入测试用客户端
 * @returns {Promise<{user: string, generatedAt: string, repos: Array, summary: Object}>}
 */
async function pulse(user, opts = {}) {
  const client = opts.client || new GithubClient();
  const repos = await client.listRepos(user);

  // CI 状态逐仓获取；CI 查询失败不拖垮整份报告（该通道按"未知"计 0 分）
  const evaluated = [];
  for (const repo of repos) {
    let ci = null;
    try {
      ci = await client.latestRun(user, repo.name);
    } catch { /* CI 通道未知，health 按"未检测到"处理 */ }
    const health = healthScore(repo, ci);
    evaluated.push({
      name: repo.name,
      url: repo.html_url,
      description: repo.description || '',
      language: repo.language || '',
      stars: repo.stargazers_count || 0,
      pushedAt: repo.pushed_at || '',
      archived: !!repo.archived,
      ciConclusion: ci?.conclusion || null,
      ciUrl: ci?.html_url || null,
      ...health,
    });
  }

  evaluated.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const avg = evaluated.length
    ? Math.round(evaluated.reduce((s, r) => s + r.score, 0) / evaluated.length)
    : 0;
  return {
    user,
    generatedAt: new Date().toISOString(),
    repos: evaluated,
    summary: {
      total: evaluated.length,
      avgScore: avg,
      gradeA: evaluated.filter((r) => r.grade === 'A').length,
      redCi: evaluated.filter((r) => r.ciConclusion && r.ciConclusion !== 'success' && r.ciConclusion !== 'skipped').length,
      noCi: evaluated.filter((r) => !r.ciConclusion).length,
      stale: evaluated.filter((r) => r.findings.some((f) => f.text.includes('个月未推送'))).length,
    },
  };
}

module.exports = { pulse };
