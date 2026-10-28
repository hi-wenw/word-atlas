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

## Codex Sites（准备版本，尚未发布）

本仓库继续使用 Vite 纯静态构建，不需要 Worker 代码、账号、数据库或后端。
`.openai/hosting.json` 指定 `static.directory = dist` 和
`not_found_handling = single-page-application`；该配置依据当前 Sites 插件的
静态构建准备器支持的字段。已注册私有、未发布 Site，真实 `project_id` 已写入配置；
后续复用该 ID，不重新注册，也不要把 GitHub 仓库名当作 Site ID。

### 构建与资源路径

```bash
npm ci
npm test
npm run check:atlas
npm run build
```

Sites 使用独立域名根路径，构建时应取消之前设置的 `ATLAS_BASE`，使用默认 `/`。
PowerShell 可以在构建前执行 `Remove-Item Env:ATLAS_BASE -ErrorAction SilentlyContinue`。
原有 `ATLAS_BASE=/words/` 子路径能力保留，部署 Sites 时不要沿用 GitHub Pages 的仓库子路径。

- 应用、字体、词库、图片、音频和分享图均使用本次构建的本地资源；没有新增媒体外链。
  `og:image` / `twitter:image` 使用 Sites 注册返回的 `expected_url` 下的本地分享图，
  不复用原作者站点 URL。该预期域名不代表已发布；其他部署环境应改为其实际域名。
- 页面使用 `#/atlas`、`#/me`、`#/w/abandon` 等 hash 路由，刷新时请求根页面。
  托管声明另外明确开启 SPA 回退。
- PWA manifest 的 `start_url` 和图标为相对路径；Service Worker 通过
  `BASE_URL + sw.js` 注册，适用于新的 HTTPS 域名。
- 本地进度仍保存在浏览器 localStorage；新域名与旧域名的存储相互隔离。
  换域名前从旧站导出 JSON，再在新站“我的”页导入；没有自动迁移或服务器同步。
- MIT 与 CC BY 4.0 原文保持不变，并由构建插件原样输出到
  `dist/LICENSE`、`dist/CONTENT_LICENSE.md`。“关于”页保留原作链接，补充
  `Word Atlas contributors — CC BY 4.0`、授权链接和内容未修改声明。

### 完整媒体体积与可获得的限制

2026-10-28 在 Windows / Node.js 24.13.1 / npm 11.8.0 上构建。
以下数字为未压缩的完整 `dist/`，不含打包器另加的托管元数据：

| 指标 | 结果 |
| --- | --- |
| 文件数 | 37,642 |
| 总大小 | 665,489,235 bytes（634.66 MiB） |
| 最大文件 | `sfx/amb-stars.mp3`，1,857,035 bytes（1.77 MiB） |

词库完整保留 7,298 词、14,596 例句、7,298 张插画、7,298 张缩略图、
22,905 段词条录音，另有 24 个界面声音文件。

当前 [Sites 官方说明](https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites)
没有公布每站固定文件存储上限，但仍有共享用量和存储限制。
当前工具没有查询部署文件配额的接口；已获准创建私有站点并保存完整版本，
实际上传保存结果见本仓库 PR。保存归档成功与静态资源部署成功是不同证据，不能据此宣称已部署。
完整源码已通过分批传输同步成功：37,729 个源码文件分为 22 批，每批新增 blob 原始体积
不超过 32 MiB；通过临时传输分支累计对象后，主分支指向原 PR 提交，远端提交 SHA 和
完整源码树均已核对。临时传输分支 `sites-upload/word-atlas-full-20261028` 保留用于恢复，
未写入 GitHub PR 历史，没有修改、删除媒体或改变应用代码。
此前整包同步出现 HTTP 502 / 连接重置，提高当前传输进程的 `http.postBuffer` 后返回
HTTP 413（请求体过大）；服务未返回数值上限。分批传输解决了源码请求体限制，
不代表已验证静态部署的文件数配额。

**当前保存阻塞是连接器的单归档上传限制**：`save_site_version` 在上传前明确拒绝
644,600,399 bytes（614.74 MiB）的完整 `tar.gz`，其数值上限为
536,870,912 bytes（512 MiB），超出 107,729,487 bytes（102.74 MiB）。
该错误不是 Cloudflare 文件数配额，也不是词库校验失败。当前工具仅有一个 `archive`
参数，没有分卷上传接口，因此没有删减媒体或尝试把多个归档冒充一个版本。
最小且不改变资源的恢复条件是平台支持至少 644,600,399 bytes 的单归档上传，
或提供正式支持的分片上传入口；当前接口无法完成保存。

匹配归档的 Sites 源提交为 `0d8d1221f570f0c928afa8ec92e17584a5832c9c`，
本地完整归档为 `D:/Document/word-atlas-sites-artifacts/word-atlas-full.tar.gz`。
失败发生在连接器上传阶段，尚未保存版本，也没有部署。后续仅补充此文档的提交
不影响应用构建；恢复时先核对同一站点的源分支与归档对应关系，不重新创建站点。
Sites 技能说明其托管运行于 Cloudflare Workers；
[Cloudflare 官方静态资源限制](https://developers.cloudflare.com/workers/platform/limits/#static-assets)
为每文件 25 MiB，每版本免费档 20,000 文件、付费档 100,000 文件；
[平台档说明](https://developers.cloudflare.com/changelog/2025-09-02-increased-static-asset-limits/)
同样支持 100,000 文件。不能把 Cloudflare 免费档直接认定为 Sites 的账号配额。

完整产物超过 20,000 文件、低于 100,000 文件；所有单文件低于 25 MiB。
若后续 Sites 返回 20,000 文件限制，先停止上传并记录实际限制：最小的无资源修改方案是
确认当前 Sites 是否可使用平台档的 100,000 文件配额。若确实不可用，再提交保留全部媒体的
资源打包与本地读取方案供决定；该方案需改资源加载和缓存，尚未实施。
本次不删资源、不改用原作者媒体外链、不引入收费服务。

### 验证结果与已知阻塞

- `npm ci` 成功，审计 0 vulnerabilities；21 个现有单元测试通过，包含 FSRS 调度与进度校验。
- `npm run check:atlas`：0 errors；已有的 24 个 `headwordNotInExample` 提示保留，
  没有修改词库来消除提示。`npm run build` 成功。
- 使用环境已有 Chromium 和仓库 Playwright，对生产 `dist/` 的本地 Vite preview 验证：
  词卡直接链接及在线刷新、插画加载、点击英音按钮获得成功的音频 Range 响应，
  收藏后的备份下载、从 `127.0.0.1` 导出并在 `localhost` 导入后持久化收藏通过。
  音频验证为浏览器请求成功，不代表人工听音验收。
- “关于”页在 1280px / 375px、深色 / 浅色下无横向溢出。
- **断网刷新未通过**：未修改的 `public/sw.js` 在本地 Chromium 中缓存了词条、图片、JS/CSS，
  但导航 HTML 和词库索引未留下缓存，断网刷新返回 `net::ERR_FAILED`。
  现有网络优先分支在异步打开缓存后才 `res.clone()`，存在响应已被消费的时序风险；
  本次没有修改该缓存逻辑，原因仍需后续修复验证。
  此外，现有缓存只按需保存看过的资源，媒体最多保留 1,500 项，Range 音频请求绕过缓存，
  不应宣称全部词库音频可完全离线。
- 上述均为本地验证；没有验证 Sites 的实际域名、鉴权层、配额、缓存头或实际部署交互。

### 后续在 Codex 桌面端继续

1. 检出本 PR 分支，保留完整 `public/`，读取当前 Sites 技能并重新确认账号配额。
   先决定是否修复上述离线刷新问题；当前授权没有扩展为修复现有问题。
2. 获得发布授权后，先检查 `.openai/hosting.json`。没有 ID 才调用一次原生 `create_site`，
   将返回的真实 ID 用 Sites 的 `set-project-id.mjs` 持久化，同时保留现有 `static` 字段。
   已有 ID 则复用，不能重新注册替代站点。
3. 用 Sites 返回的源仓库凭据和 `site-workflow.mjs` 同步已验证源码，按技能执行
   `build-site.mjs` 和打包，保留准确的提交 SHA 与归档路径；凭据仅通过 stdin 传递。
   上传元数据会增加少量文件，仍需以实际归档重新核算。不要提交 `node_modules/`、`dist/` 或凭据。
4. 配额及离线问题解决并获准发布后，按当前 Sites 技能保存版本和部署，再验证真实域名。
   当前 Site 仅用于私有版本保存验证，没有执行部署，也没有可报告的已部署 URL。
