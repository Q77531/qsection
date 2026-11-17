# Q的截面 / Q's Section

「Q的截面」是一个 Obsidian 内容系列：把一个笔记流程切开，看看里面怎么运作。这个仓库既是该系列可公开的素材与模板，也是自建 Obsidian 插件 **Q-Section** 的说明页。

*Q's Section* is an Obsidian content series: slice a note-taking workflow open and see how it actually works. This repository holds the series' shareable assets and templates, and documents the self-built Obsidian plugin **Q-Section**.

## 截图 / Screenshots

![封面 Cover](assets/cover-01.png)

![头像 Avatar](assets/avatar.svg)

## 目录结构 / Structure

```text
assets/       头像（SVG）与封面（PNG）
templates/    7 图 HTML 模板（附模板内引用的头像）
LICENSE       MIT（仅覆盖本仓库自有代码与模板）
```

插件源码暂未发布到本仓库，这里先提供说明；是否开源由作者决定。
The plugin source is not published in this repository yet; this page documents it. Whether to open-source it is up to the author.

## 7 图模板 / 7-slide template

- `assets/cover-01.png` 是 1080×1440 的封面成品，可直接用于小红书 / B站图文。
- `templates/第一条内容-7图模板.html` 是完整的 7 图模板：在浏览器中直接打开即可看到 7 张 1080×1440 的 slide，改文字后按下面的方式导出。模板内引用的头像已放在同目录。
- 批量导出图文时建议：视口 1080×1440、`deviceScaleFactor=1`，等字体与图片加载完成后再截图，单张区域截取（不要整页截图后裁切）。

- `assets/cover-01.png` is a finished 1080×1440 cover, ready for social posts.
- `templates/第一条内容-7图模板.html` is a complete 7-slide template: open it in a browser to see seven 1080×1440 slides, edit the text, and export as described below. The avatar it references sits in the same folder.
- For batch export: use a 1080×1440 viewport with `deviceScaleFactor=1`, wait for fonts and images, and screenshot each slide element rather than cropping a full-page capture.

## Q-Section 插件 / The Q-Section plugin

当前版本 **0.11.1**。Current version: **0.11.1**.

它是自建的 Obsidian 插件，包含三部分：

It is a self-built Obsidian plugin with three parts:

- **Q 截面**：右侧栏数据视图，六个一级模块——截面、推进、产出、输入、节奏、系统。
- **Q 操作台**：专注番茄钟、项目打卡、新建对象、打开总览、路由入口。
- **自动路由**：按 frontmatter 的 `type` / `status` / `topic` / `note_kind` / `content_stage` / `period` 把笔记移动到对应目录。

- **Q Section**: a sidebar data view with six top-level modules — Section, Push, Output, Input, Rhythm, and System.
- **Q Console**: a focus timer, project check-ins, new-object shortcuts, dashboard entry points, and routing.
- **Auto-routing**: moves notes according to the `type` / `status` / `topic` / `note_kind` / `content_stage` / `period` frontmatter fields.

### 更新记录 / Changelog

- **0.11.1**：修复 Q 操作台「新建」对象的路径生成错误；修复 resource 在没有 `note_kind` 时被放入 `<Topic>/Other`、而不是主题根目录的问题。
- **0.11.0**：Q 截面六模块、Q 操作台、自动路由。

- **0.11.1**: fixed path generation when creating new objects from Q Console; fixed resources without `note_kind` being placed in `<Topic>/Other` instead of the topic root.
- **0.11.0**: six-module Q Section, Q Console, and auto-routing.

### 安装 / Installation

如果源码公开，把 `main.js`、`styles.css`、`manifest.json` 放进 `<vault>/.obsidian/plugins/qsection/`，重启 Obsidian 并在社区插件中启用。

If the source is published, copy `main.js`, `styles.css`, and `manifest.json` into `<vault>/.obsidian/plugins/qsection/`, restart Obsidian, and enable the plugin under Community plugins.

仓库不包含 `data.json`。它保存草稿、写作目标、打卡、专注等个人数据，只在本地使用，不随仓库分发。

This repository does not include `data.json`. It stores personal data such as drafts, writing goals, check-ins, and focus sessions; it stays local and is never distributed with the repository.

## 来源与边界 / Scope

- 头像与封面均为自制素材；模板来自作者自己的 Obsidian 使用流程。
- 插件部分只描述公开功能，不含个人数据、账号信息或密钥。
- 仓库不包含个人笔记正文、账号信息、学校或位置信息，也不包含任何密钥。

- All visuals are original; templates are drawn from the author's own Obsidian workflow.
- The plugin section describes public features only and includes no personal data, account details, or secrets.
- No personal notes, account details, school or location information, or secrets are included.

## 许可 / License

MIT，仅覆盖本仓库中的自有代码与模板。
MIT, covering only the original code and templates in this repository. See [LICENSE](LICENSE).
