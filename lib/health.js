/**
 * 仓库健康评分（纯函数、确定性、可解释）。
 *
 * 总分 = CI(30) + 活跃度(25) + 描述(10) + 主页(10) + License(10) + Topics(15)，满分 100。
 * 每一项的加/减都写入 findings——分数永远能拆到"为什么"，这是与"黑盒仪表盘"的区别。
 * 输入只依赖 GitHub repos list API 的字段，一次请求即可评估全部仓库。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {Object} repo GitHub repos list API 的单个仓库对象
 * @param {Object} [ci] 该仓库默认分支最近一次 CI 状态 { conclusion: 'success'|'failure'|..., } 或 null
 * @param {Date|number|string} [now] "当前时间"，默认真实时钟；测试注入固定值保证确定性
 * @returns {{ score: number, grade: string, findings: Array<{point: number, text: string}> }}
 */
function healthScore(repo, ci, now = Date.now()) {
  const findings = [];
  let score = 0;

  // CI 通道（30 分）：默认分支最近一次运行的结论
  if (!ci || !ci.conclusion) {
    findings.push({ point: 0, text: '未检测到 CI 工作流（流水线是简历的可信背书）' });
  } else if (ci.conclusion === 'success') {
    score += 30;
    findings.push({ point: 30, text: '默认分支 CI 绿灯' });
  } else if (ci.conclusion === 'skipped' || ci.conclusion === 'startup_failure') {
    findings.push({ point: 0, text: `CI 存在但最近一次为 ${ci.conclusion}（检查触发条件是否失效）` });
  } else {
    findings.push({ point: 0, text: `默认分支 CI 红灯（${ci.conclusion}）——访客第一眼看到的就是它` });
  }

  // 活跃度通道（25 分）：最近 push 距今
  const pushedAt = repo.pushed_at ? new Date(repo.pushed_at).getTime() : 0;
  const ageDays = pushedAt ? Math.max(0, (new Date(now).getTime() - pushedAt) / DAY_MS) : Infinity;
  if (ageDays <= 30) {
    score += 25;
    findings.push({ point: 25, text: `最近 ${Math.floor(ageDays) || 1} 天内有推送` });
  } else if (ageDays <= 90) {
    score += 10;
    findings.push({ point: 10, text: `最近推送在 ${Math.floor(ageDays / 30)} 个月前（访客会怀疑项目停更）` });
  } else {
    findings.push({ point: 0, text: pushedAt ? `超过 3 个月未推送（建议在 README 顶部注明维护状态）` : '无推送记录' });
  }

  // 元数据通道（45 分）：描述 / 主页 / License / Topics
  if (repo.description && repo.description.trim()) {
    score += 10;
    findings.push({ point: 10, text: '仓库描述完整' });
  } else {
    findings.push({ point: 0, text: '缺仓库描述——搜索列表里唯一的一句话广告位' });
  }

  if (repo.homepage) {
    score += 10;
    findings.push({ point: 10, text: `配置了主页（${repo.homepage}）` });
  } else {
    findings.push({ point: 0, text: '未配置主页——有在线演示的仓库应把链接挂上' });
  }

  if (repo.license && repo.license.spdx_id && repo.license.spdx_id !== 'NOASSERTION') {
    score += 10;
    findings.push({ point: 10, text: `License：${repo.license.spdx_id}` });
  } else {
    findings.push({ point: 0, text: '缺 License——他人不敢直接复用你的代码' });
  }

  const topics = repo.topics || [];
  if (topics.length >= 3) {
    score += 15;
    findings.push({ point: 15, text: `Topics ${topics.length} 个（${topics.slice(0, 5).join(', ')}）` });
  } else if (topics.length > 0) {
    score += 5;
    findings.push({ point: 5, text: `仅 ${topics.length} 个 topic，建议补到 3 个以上提升可检索性` });
  } else {
    findings.push({ point: 0, text: '没有 topics——GitHub 搜索与 Topic 页的流量入口全部错过' });
  }

  const clamped = Math.max(0, Math.min(100, score));
  const grade = clamped >= 85 ? 'A' : clamped >= 70 ? 'B' : clamped >= 50 ? 'C' : 'D';
  return { score: clamped, grade, findings };
}

module.exports = { healthScore };
