# 部署 / Deployment

`npm run build` 生成纯静态站点 `dist/`，可以放到任何静态托管（Nginx、Cloudflare Pages、Vercel、GitHub Pages）。

## 子路径

```bash
ATLAS_BASE=/words/ npm run build
```

## Nginx 示例

```nginx
location ^~ /words/ {
    alias /var/www/word-atlas/;
    try_files $uri $uri/ /words/index.html;
    expires 7d;
}
```

## GitHub Pages

仓库带有 `.github/workflows/pages.yml`。在仓库 Settings → Pages 选择 “GitHub Actions”，然后手动运行 “Deploy to GitHub Pages”。

## 体积

插画与音频合计约数百 MB。建议在 CDN 后部署，或按需只发布 `thumb/` 和部分音频。

## Codex Sites 部署准备

本版本保留完整本地词库、图片、音频、FSRS 和浏览器进度，不依赖原作者网站的媒体，不增加账号或后端。
使用 Node.js 20+ 和 npm，构建命令与普通静态部署一致：

```bash
npm ci
npm test
npm run check:atlas
npm run build
node scripts/report-build.mjs
```

上传目录为 `dist/`，不是仓库根目录或 Vite 开发服务器。此处只描述已经验证的静态产物，不假定 Sites 的专用配置格式。
生产构建同时包含原文 `LICENSE`、`CONTENT_LICENSE.md` 和字体授权 `FRAUNCES_LICENSE.txt`；关于页保留原作链接、Word Atlas contributors 署名与 CC BY 4.0 链接。词库与媒体内容未修改。

### 容量与可用性

2026-10-28 在本次云环境中实测，未压缩的根路径构建：

| 项目 | 数值 |
| --- | --- |
| 文件数量 | 37,643 |
| 总字节数 | 665,493,935（634.664 MiB） |
| 最大文件 | `sfx/amb-stars.mp3`，1,857,035 字节（约 1.771 MiB） |
| 词条 / 例句 | 7,298 / 14,596 |
| 词条插画 / 缩略图 | 各 7,298 |
| 词条录音 | 22,905 |

代码、工具版本或基础路径变化后，重新运行统计命令，以实际产物为准。
当前云会话没有 Sites 工具或技能；访问官方文档域名 `developers.openai.com` 被网络策略拒绝，因此未能核实当前 Sites 总大小、文件数、单文件大小、Service Worker 或响应头限制。
**静态构建和本地交互通过不代表已符合 Sites 限制，也不代表已发布。** 尚未创建任何 Sites 站点 ID 或访问域名。

后续在可调用 Sites 的 Codex 桌面端会话中，先读取其实际提供的技能/工具说明，核对上述容量、静态目录格式、HTTPS、Service Worker 与媒体响应支持。
确认根路径托管时使用默认构建；如果工具明确要求子路径，则用实际路径设置 `ATLAS_BASE` 后重建。
如出现明确超限，先报告具体限额和超出量，再讨论压缩、打包方式或托管调整；不要擅自删减媒体、换成原作者域名的资源或添加收费服务。
只有工具返回实际部署结果且完成线上验证后，才能提供真实访问域名。

### 路径、刷新与本地数据

- 默认基础路径为 `/`；子路径构建示例为 `ATLAS_BASE=/words/ npm run build`。路径必须以 `/` 开头和结尾。
- 页面采用 `#/atlas`、`#/me` 等哈希路由，刷新仍请求站点入口，不要求服务器把 `/atlas` 重写到 `index.html`。子路径入口应保留末尾 `/`。
- 词库、插画、音频、图标、manifest 和 Service Worker 均由部署站点自身提供。分享图片元数据使用基础路径下的 `brand/og-card.jpg`；部分社交平台要求绝对图片 URL，待真实域名确定后再核实分享预览。
- Service Worker 只在生产版和安全上下文（HTTPS，或本机 loopback 验证）注册，作用域跟随部署路径；缓存按站点作用域隔离，不清理同域其他应用的缓存。
- 离线缓存按需写入，并非首次打开就下载全部媒体；词库和页面需先在线访问，图片/音频缓存仍受浏览器配额及 1,500 个词条媒体请求的上限影响。原有 Range 音频请求直接联网的行为保留，不能保证所有音频在离线时播放。
- 进度仍使用原有 localStorage 格式。**新域名有独立的浏览器存储**：先在原站点「我的 → 导出备份」，再在新域名「我的 → 导入备份」。不会自动跨域迁移或同步。

### 可复现的生产版浏览器检查

现有环境提供 Playwright 和 `/usr/bin/chromium`；没有下载或安装额外浏览器。
构建后，先在一个终端运行生产预览（仅用于本机验证）：

```bash
npm run preview -- --port 5190
```

在另一个终端执行：

```bash
CHROME_PATH=/usr/bin/chromium node scripts/smoke-static.mjs http://127.0.0.1:5190/
```

该脚本使用独立浏览器上下文验证词条弹窗、图片解码、实际录音开始播放、收藏、刷新、包含 FSRS 卡片的备份导入导出、manifest、授权文件、已缓存词条的离线刷新；并检查页面脚本错误和跨域网络资源请求。
它不会部署，也不使用个人浏览器的进度。其他环境可设置实际 `CHROME_PATH`，或使用已有的 Playwright 浏览器。
本次还用 `ATLAS_BASE=/words/` 构建了独立产物，并在 `/words/` 下执行同一检查。真实 Sites 域名的 TLS、响应头和线上行为仍需部署后验证。
