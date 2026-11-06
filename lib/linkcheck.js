/**
 * README 外链存活检查。
 *
 * 2026-11-06 巡检的教训:作品集导航页里两个链接指向已下架仓库,分数再高,
 * 点进去是 404,所有工程信号一起作废——仓库健康检查必须包含「链接还活着吗」。
 *
 * 判定口径(降级不撒谎,也不误杀):
 *   2xx / 3xx              → ok
 *   401/403/405/429/503    → warn,反爬或限流(如爱发电的 Cloudflare),不判死
 *   404 / 410              → dead,唯一判死口径
 *   超时 / DNS / 网络异常  → warn,可能是对方反爬,不能让 CI 因网络抖动变红
 *   localhost / 占位符     → skip,文档里的本机地址和「<你的域名>」不探测
 */

const WARN_CODES = new Set([401, 403, 405, 429, 503]);

/** 提取单个 URL 后清理:剥掉 markdown 加粗/斜体尾巴与中英文句尾标点 */
function cleanUrl(raw) {
  return raw.replace(/[.,;:!?)\]】、。，；：！？）]+$/, '');
}

/** README 里的 URL 是否是文档占位符(本机地址/示例域名/尖括号模板),跳过不探测 */
function isPlaceholder(url) {
  return (
    /^https?:\/\/(127\.|localhost)/.test(url) ||
    /^https?:\/\/(www\.)?example\.(com|org|net)(\/|$)/.test(url) ||
    /[<{]/.test(url) ||
    /你的|域名|示例/.test(url)
  );
}

/** 从 markdown 提取全部 http(s) 链接(含图片与裸链接),去重保序。
 *  先剥掉行内代码段(配置示例值不是链接),字符类排除逗号(两链逗号连写不粘连)、
 *  反引号/括号/加粗号(markdown 语法) */
function extractLinks(markdown) {
  const out = [];
  const seen = new Set();
  const text = markdown.replace(/`[^`]*`/g, ' ');
  for (const match of text.matchAll(/https?:\/\/[^\s)"'`,>\\*{}<]+/g)) {
    const url = cleanUrl(match[0]);
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

/** 逐条并发探测。fetchImpl 可注入(测试零网络);返回 [{url, verdict, code}] */
async function checkLinks(urls, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const probe = async (url) => {
    if (isPlaceholder(url)) return { url, verdict: 'skip', code: '' };
    try {
      const res = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
        headers: { 'user-agent': 'repo-pulse-linkcheck/1.0' },
      });
      if (res.ok) return { url, verdict: 'ok', code: res.status };
      if (WARN_CODES.has(res.status)) return { url, verdict: 'warn', code: res.status };
      return { url, verdict: 'dead', code: res.status };
    } catch (err) {
      return { url, verdict: 'warn', code: err?.cause?.code || err?.name || 'ERR' };
    }
  };
  return Promise.all(urls.map(probe));
}

module.exports = { extractLinks, checkLinks, isPlaceholder, cleanUrl };
