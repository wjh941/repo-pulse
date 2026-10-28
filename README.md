# 📊 repo-pulse · 仓库脉搏

**一行命令体检全部公开仓库：CI 状态 / 活跃度 / 元数据，可解释健康评分，零 npm 依赖**

## 🎯 这个项目解决什么问题

你维护着十几个仓库，每个都有 CI、README、License、Topics。问题不是某一个仓库做不好，而是**没有人能一眼回答**：

- 现在哪个仓库的 CI 是红的？（邮件通知沉在收件箱里）
- 哪个仓库超过三个月没动了？招聘方点进去看到的最新推送是多久前？
- 哪些仓库还没写描述、没配主页、没加 topics——搜索流量入口全关着？

repo-pulse 把这些答案变成一份 30 秒能读完的体检报告：每个仓库一个 0~100 的健康分，**每一分都能拆到"为什么扣"**——这和黑盒仪表盘的区别，同 jd-match-radar 的可解释评分一脉相承。

## 🖼️ 界面预览

```
📊 wjh941 · 15 仓 · 平均健康分 71 · A 级 2 个

   90 [A] homevalue              CI✅              2026-10-25
   90 [A] whoyouare              CI✅              2026-10-26
   80 [B] campus-soul            CI✅              2026-10-24
        ⚠️ 未配置主页——有在线演示的仓库应把链接挂上
   ...
```

Web 仪表盘：`npm start` 后打开 `http://localhost:4335`，输入用户名即出可视化报告。

## 🩺 评分怎么算的（可解释，满分 100）

| 通道 | 分值 | 判定 |
| --- | --- | --- |
| **CI** | 30 | 默认分支最近一次运行：绿灯 +30，红灯/无工作流 0 |
| **活跃度** | 25 | 30 天内有推送 +25，90 天内 +10，更久 0 |
| **描述** | 10 | 有仓库描述 +10 |
| **主页** | 10 | 配置了 homepage +10 |
| **License** | 10 | 有明确 License +10 |
| **Topics** | 15 | ≥3 个 +15，有但不足 +5，没有 0 |

评分是**纯函数**（`lib/health.js`）：输入 GitHub API 字段 + 注入的时钟，输出分数与逐条 findings。同输入永远同输出，8 个单元测试在 CI 里确定性复跑。

## 🚀 30 秒跑起来

```bash
git clone https://github.com/wjh941/repo-pulse.git
cd repo-pulse

node cli.js wjh941        # 终端表格
node cli.js wjh941 --md   # Markdown 周报（可直接贴 issue）
node cli.js wjh941 --json # JSON 快照（可归档对比）

npm start                 # Web 仪表盘 http://localhost:4335
npm test                  # 8 个单元测试
```

**可选**：`export GITHUB_TOKEN=ghp_xxx` 把 GitHub API 限额从匿名 60 次/时 提升到 5000 次/时。Token 只读环境变量，不落盘、不进代码。

## 🧱 工程亮点

| 特性 | 做法 | 为什么 |
| --- | --- | --- |
| 零 npm 依赖 | HTTP/CLI/测试全部 Node 标准库 | clone 即跑，无供应链风险 |
| 可解释评分 | 每一分对应一条 findings 文案 | 体检报告的价值在"怎么改"，不在分数本身 |
| 纯函数核心 | 评分与时钟注入分离 | 测试零网络、确定性复跑 |
| 优雅降级 | CI 查询单仓失败不拖垮整份报告；无 Token 匿名可用 | 仪表盘不能因为一个仓库就白屏 |
| 降级不撒谎 | GitHub 限流时报错并提示重置时间，不返回残缺数据装正常 | 掩盖错误的仪表盘比没有更糟 |

## 📁 目录结构

```
repo-pulse/
├── cli.js                  # 命令行入口（表格/MD/JSON 三种输出）
├── lib/
│   ├── health.js           # 健康评分纯函数（核心，可解释 findings）
│   ├── github-client.js    # GitHub API 客户端（翻页/限流提示/Token 可选）
│   ├── pulse.js            # 编排：拉列表+逐仓 CI+聚合 summary
│   └── report.js           # Markdown 周报渲染
├── server/pulse-server.js  # 零依赖 Web 服务（:4335）
├── public/index.html       # 仪表盘单页
└── tests/health.test.js    # 8 个确定性单元测试
```

## 🗺️ Roadmap

- [x] CLI + Web 仪表盘 + Markdown 周报（2026-10）
- [ ] 快照对比：`--json` 归档后 diff，输出"本周新增红灯/停止维护"告警
- [ ] README 质量检查（长度、场景引言、截图存在性）
- [ ] 接入 miniflow「我的画像」：体检报告自动同步到个人博客

## 📄 License

MIT
