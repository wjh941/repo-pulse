/**
 * GitHub API 客户端（零依赖）。
 *
 * 未配置 token 时以匿名身份访问公共数据（60 次/小时，够评估十几个仓库）；
 * 配置 GITHUB_TOKEN 后提升到 5000 次/小时。Token 只读环境变量，不落盘。
 * 任何网络/限流失败都向上抛错，由调用方决定降级方式——掩盖错误只会让仪表盘撒谎。
 */

const DEFAULT_BASE = 'https://api.github.com';

class GithubClient {
  constructor({ token, baseUrl, fetchImpl } = {}) {
    this.token = token || process.env.GITHUB_TOKEN || '';
    this.baseUrl = (baseUrl || process.env.GITHUB_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
    this.fetchImpl = fetchImpl || fetch;
  }

  headers() {
    const h = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'repo-pulse',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  async getJson(path) {
    const res = await this.fetchImpl(this.baseUrl + path, { headers: this.headers() });
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      const resetAt = res.headers.get('x-ratelimit-reset');
      const mins = resetAt ? Math.ceil((Number(resetAt) * 1000 - Date.now()) / 60000) : '?';
      throw new Error(`GitHub API 限流：约 ${mins} 分钟后重置（配置 GITHUB_TOKEN 可提升到 5000 次/时）`);
    }
    if (res.status === 404) throw new Error('用户或接口不存在（检查用户名拼写）');
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return res.json();
  }

  /** 用户的全部公开仓库（按 push 时间倒序），自动翻页 */
  async listRepos(user) {
    const out = [];
    for (let page = 1; page <= 10; page++) {
      const batch = await this.getJson(
        `/users/${encodeURIComponent(user)}/repos?per_page=100&page=${page}&sort=pushed`,
      );
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out.filter((r) => !r.fork);
  }

  /** 仓库默认分支最近一次 CI 运行结论；无工作流时返回 null */
  async latestRun(owner, repo) {
    try {
      const data = await this.getJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=1`,
      );
      return data.workflow_runs?.[0] || null;
    } catch (e) {
      if (/404|不存在/.test(e.message)) return null; // 没有 Actions 权限/无工作流
      throw e;
    }
  }
}

module.exports = { GithubClient };
