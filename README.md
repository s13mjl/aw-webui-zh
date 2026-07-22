# aw-webui（中文二创版本）

ActivityWatch 的 Web UI，基于 Vue.js 构建。

本仓库是 [ActivityWatch/aw-webui](https://github.com/ActivityWatch/aw-webui) 的中文二创版本，由 s13mjl 维护。主要改动包括完整的中文汉化以及针对 GitHub issues 中用户反馈的多个 bug 修复（详见主仓库 [aw-tauri-zh](https://github.com/s13mjl/aw-tauri-zh) 的 README）。除本说明外，本仓库其余信息（CI 徽章、文档链接等）均指向原项目。

感谢原开发者团队 Erik Bjare 及所有贡献者创造了 ActivityWatch 这个优秀的开源项目。

[![Build Status](https://github.com/ActivityWatch/aw-webui/workflows/Build/badge.svg)](https://github.com/ActivityWatch/aw-webui/actions)
[![Coverage Status](https://codecov.io/gh/ActivityWatch/aw-webui/branch/master/graph/badge.svg)](https://codecov.io/gh/ActivityWatch/aw-webui)
[![Known Vulnerabilities](https://snyk.io/test/github/ActivityWatch/aw-webui/badge.svg)](https://snyk.io/test/github/ActivityWatch/aw-webui)

## 快速开始

搭建开发环境非常简单：

```bash
# 以测试模式启动一个 aw-server 实例（端口 5666，使用独立数据库）。
# 开发模式下的 web UI 默认会连接到这个实例。
aw-qt --testing
# 或者，不带 watcher 运行：
aw-server --testing

# 安装依赖
npm install
# 或者，安装锁定版本的依赖：
npm ci

# 以开发模式启动 aw-webui
npm run serve
```

也可以运行 `make dev` 来安装依赖并在本地启动应用。

可能需要配置 CORS 才能正常工作，详见下文 CORS 部分。

你可能还需要生成一些假数据用于测试，参见：https://github.com/ActivityWatch/aw-fakedata/

## 构建

运行以下命令即可构建生产版本：

```bash
# 安装依赖
npm ci

# 构建生产版本
npm run build
```

## 在主安装中使用预发布版本

**注意：** 在旧版 aw-server 上运行开发版的 aw-webui 可能因版本不兼容导致问题。

### 方式一：将 web-assets 复制到主安装

你可以先构建开发版的 aw-webui（或从 CI 获取最新构建产物），然后替换 aw-server（或 aw-server-rust）安装目录下 `static` 目录的内容，从而在你的主版本 ActivityWatch 中使用开发版 web UI。为方便回退，建议先备份原始目录。

资源文件存放在以下目录（相对于安装目录），取决于你使用 aw-server-python（默认）还是 aw-server-rust：

 - aw-server-python: `activitywatch/aw-server/aw_server/static/`
 - aw-server-rust: `activitywatch/aw-server-rust/static/`

你可以手动将 `make build` 或 `npm run build` 的输出复制到上述位置。

文件放置完成后，可能需要在浏览器中执行强制刷新以清除过期缓存。

### 方式二：在 aw-server-rust 中使用 `--webpath`

除了复制文件外，`aw-server-rust` 还支持通过 `--webpath` 参数从自定义路径加载 web UI。这在服务器将静态资源打包进可执行文件的平台（如 Windows）上特别有用：

```bash
# 让 aw-server-rust 指向本地构建输出
aw-server-rust --webpath /path/to/aw-webui/dist
```

这样无需复制文件，也便于在开发版和生产版之间切换。

### 方式三：使用主安装的数据

如果你想基于本地生产数据持续迭代 `aw-webui`（在生产服务器运行时），可以使用开发构建、自动更新并连接到生产数据。在 `aw-webui` 源码目录下，于一个终端窗口运行：

```bash
AW_SERVER_URL="'http://localhost:5600'" npx vue-cli-service build --watch --dest=../aw-server/static
```

如果需要在代码中加入 `debugger` 语句或绕过 lint 规则，请在该命令后追加 `--skip-plugins=no-debugger`。

然后在另一个终端（已激活 venv）运行：

```shell
python3 -m http.server --bind 127.0.0.1 27180 --directory ../aw-server/static
```

## 测试

运行单元测试：

```bash
npm test
```

此外还有 E2E 测试。需要先启动 aw-server 并以开发模式运行 web UI（按上文使用 `npm run serve`）。准备好后，运行：

```bash
make test-e2e
```

## 开发说明

### CORS

开发时还需要在 `aw-server` 配置文件中添加或修改 CORS 配置：在 `/activitywatch/aw-server/aw-server.toml` 对应章节下添加 `cors_origins = http://localhost:27180`（测试模式下对应 `server-testing` 章节）。

### 代码结构

应用启动后首先执行的是 `src/main.js`。它会加载 bootstrap-vue 以及一些全局使用的内容（过滤器、资源等）。

随后 main.js 加载 `src/App.vue`，即应用的根组件。
