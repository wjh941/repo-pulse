/**
 * 仓库脉搏 · HTTP 服务（零依赖）。
 * 路由：
 *   GET  /                    静态仪表盘
 *   GET  /api/health          健康检查
 *   GET  /api/pulse/:user     全量体检报告（服务端代理 GitHub，避免浏览器限流）
 * 端口：PORT 环境变量，默认 4335。
 * GITHUB_TOKEN 环境变量可选：配置后 GitHub API 限额从 60/时 提升到 5000/时。
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { GithubClient } = require('../lib/github-client');
const { pulse } = require('../lib/pulse');
const { toMarkdown } = require('../lib/report');

const PORT = Number(process.env.PORT) || 4335;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/health') {
    return send(res, 200, JSON.stringify({ ok: true, token: !!process.env.GITHUB_TOKEN }));
  }

  const pulseMatch = url.pathname.match(/^\/api\/pulse\/([\w-]+)$/);
  if (pulseMatch) {
    try {
      const report = await pulse(pulseMatch[1], { client: new GithubClient() });
      if (url.searchParams.get('format') === 'md') {
        return send(res, 200, toMarkdown(report), 'text/markdown; charset=utf-8');
      }
      return send(res, 200, JSON.stringify(report));
    } catch (e) {
      return send(res, 502, JSON.stringify({ error: e.message }));
    }
  }

  // 静态文件（限制在 public 目录内，拒绝路径穿越）
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, JSON.stringify({ error: 'forbidden' }));
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, JSON.stringify({ error: 'not found' }));
    send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

server.listen(PORT, () => {
  console.log(`[仓库脉搏] http://localhost:${PORT}/`);
  console.log(`  GitHub Token: ${process.env.GITHUB_TOKEN ? '已配置(5000次/时)' : '未配置(匿名 60次/时)'}`);
});
