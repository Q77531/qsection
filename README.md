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
main.js       Q-Section 插件主代码
styles.css    Q-Section 插件样式
manifest.json Q-Section 插件清单
LICENSE       MIT
```

插件源码在本仓库根目录：`main.js`、`styles.css`、`manifest.json`。
The plugin source is now in this repository's root: `main.js`, `styles.css`, `manifest.json`.

安装：把这三个文件复制到 `<你的库>/.obsidian/plugins/qsection/`，重启 Obsidian，在社区插件里启用 Q-Section。
Install: copy the three files into `<your vault>/.obsidian/plugins/qsection/`, restart Obsidian, and enable Q-Section in Community plugins.

## 7 图模板 / 7-slide template

- `assets/cover-01.png` 是 1080×1440 的封面成品，可直接用于小红书 / B站图文。
- `templates/第一条内容-7图模板.html` 是完整的 7 图模板：在浏览器中直接打开即可看到 7 张 1080×1440 的 slide，改文字后按下面的方式导出。模板内引用的头像已放在同目录。
- 批量导出图文时建议：视口 1080×1440、`deviceScaleFactor=1`，等字体与图片加载完成后再截图，单张区域截取（不要整页截图后裁切）。

- `assets/cover-01.png` is a finished 1080×1440 cover, ready for social posts.
- `templates/第一条内容-7图模板.html` is a complete 7-slide template: open it in a browser to see seven 1080×1440 slides, edit the text, and export as described below. The avatar it references sits in the same folder.
- For batch export: use a 1080×1440 viewport with `deviceScaleFactor=1`, wait for fonts and images, and screenshot each slide element rather than cropping a full-page capture.

## Q-Section 插件 / The Q-Section plugin

当前版本 **0.15.18**。Current version: **0.15.18**.

它是自建的 Obsidian 插件，包含四部分：

It is a self-built Obsidian plugin with four parts:

- **Q 截面（只读）**：右侧栏数据视图，六个一级模块——截面、推进、产出、输入、节奏、系统；只展示数据和只读导航，不写入、不操作。
- **Q 操作台（唯一操作入口）**：当前页自适应动作、专注番茄钟（专注集、倒计时/正计时、暂停分段、浮动小窗 / 桌面小窗、Full Calendar；专注记录写入日笔记时按 `startTime` 排序）、项目打卡、速记与转化（含收藏、写作、草稿页签）、关系与推进、完成当前对象、新建对象、打开总览、路由、领域体检、路由健康。
- **自动路由**：按 frontmatter 的 `type` / `status` / `topic` / `note_kind` / `content_stage` / `period` 把笔记移动到对应目录。
- **独立主题**：Q 主题可跟随 Obsidian、强制浅色或深色；ins 风软表面按钮。
- **可选玻璃主题**：默认关闭；开启后 Q 操作台和 Q 截面使用半透明玻璃胶囊、滑动页签/行选中、玻璃菜单与弹窗；关闭时原主题不变。

- **Q Section (read-only)**: a sidebar data view with six top-level modules — Section, Push, Output, Input, Rhythm, and System; data and read-only navigation only.
- **Q Console (the only place that writes)**: current-page actions, a focus timer with saved presets, countdown or stopwatch mode, pause segments, a floating mini window, a desktop popout window and Full Calendar, project check-ins, quick capture and conversion (with favorites, writing and drafts tabs), relations, completing the current object, new-object shortcuts, dashboard entry points, routing, area health and route health.
- **Auto-routing**: moves notes according to the `type` / `status` / `topic` / `note_kind` / `content_stage` / `period` frontmatter fields.
- **Independent theme**: the Q theme follows Obsidian, or stays light/dark on its own; soft-surface, ins-style buttons.
- **Optional glass theme**: off by default; when enabled, the Q Console and Q Section use translucent glass capsules, sliding tab/row selection, and glass menus/modals; the original theme stays unchanged when off.

### 专注桌面小窗 / Focus desktop window

Q 操作台 → 专注 →「桌面小窗」会打开独立的 Obsidian popout 窗口；桌面版开始计时也会自动打开。窗口默认 240×240 内容尺寸，打开 / 重开时自动定位到当前屏幕右上角（8px 边距）并自动置顶，可拖到副屏；窗口内「置顶」按钮可取消 / 恢复置顶，如果当前 Obsidian 版本没有该按钮，可用 PowerToys Always On Top（默认 Win+Ctrl+T）钉住。原「小窗」仍留在 Obsidian 内。

The focus desktop window is an Obsidian popout. On desktop it opens automatically when the timer starts, is 240×240 by default, moves to the top-right corner of the current screen (8px margin) and is pinned on open/reopen. Drag it to another monitor; use the in-window "Always on top" button to toggle pinning, or PowerToys Always On Top (Win+Ctrl+T) as a fallback. The original in-app mini window is unchanged.

### 更新记录 / Changelog

- **0.15.18**：Q 截面 → 输入 → 收集：移除「近 12 周」速记热力图，改为「随机速记」卡片；只抽未转化为笔记 / 任务 / 项目的速记，可换一条或打开来源日笔记。
- **0.15.17**：桌面小窗打开 / 重开时自动定位到当前屏幕右上角（8px 边距），仍自动置顶；尺寸保持 240×240。
- **0.15.16**：专注记录写入日笔记「今日安排」时按 `startTime` 重排有时间戳的条目，新增记录不再总排最后；桌面小窗缩到 240×240，打开即自动置顶。
- **0.15.15**：专注新增「桌面小窗」popout 独立窗口，桌面版开始计时自动打开；可拖到副屏，窗口内「置顶」按钮切换系统置顶，PowerToys Always On Top 可作兜底；原「小窗」保留。
- **0.15.14**：修复 `linkName()` 的 `.md` 口径：链接和裸路径都先取 basename 再剥 `.md`；领域体检与 Q 截面「推进 · 领域」不再把带 `.md` 的领域链接误判为断链。
- **0.15.13**：新增可选玻璃主题（默认关闭，原主题不变）：玻璃胶囊按钮/输入/卡片/KPI/列表/日历/热力/空状态、页签与任务行滑动胶囊、Q 菜单与四类弹窗玻璃；深色可读性与 reduced-motion / focus 修复。
- **0.15.11**：Q 操作台收敛为 11 个分区，收藏 / 写作 / 草稿并入「速记」左栏页签；专注、打卡、速记改为左右分栏，右栏内部滚动；按钮组按整行自动换行。
- **0.15.5**：新增季 / 年日志（`07_Journal/Quarterly|Yearly/{year}`，`period: quarterly/yearly`）与对应命令。
- **0.15.4**：Q 操作台新增「当前页」，按当前笔记的 `type` 显示完成、截止、阶段、关联、打开等动作；切换笔记自动刷新。
- **0.15.3**：速记转任务时弹窗设置截止日期；逾期仍按 `截止` 计算，不建独立文件夹。
- **0.15.2**：专注改为活跃片段模型；暂停不计时、不写日历，恢复后按段写入。
- **0.15.1**：修复速记 / 月历 / 打卡按钮沿用外部主题绿色 inset、深色不可读的问题；专注加暂停；手写 Full Calendar 事件验证。
- **0.15.0**：Q 截面改为只读数据视图，Q 操作台成为唯一操作入口；新增关系（area / project / task / note）、完成当前对象、领域体检、路由健康。
- **0.14.3**：修复专注小窗按钮在深色 / 浅色下的对比度；关闭按钮保持透明。
- **0.14.2**：修复 Q 操作台按钮与打卡按钮沿用外部主题绿色 inset、深色不可读的问题。
- **0.14.1**：修复 Q 截面模块 tab / 子 tab 的绿色 inset 与深色对比；按钮回到 Q 品牌样式。
- **0.14.0**：新增独立 Q 主题（跟随 / 浅色 / 深色，可独立于 Obsidian 主题）与 ins 风按钮。
- **0.13.1**：面板背景改用 Q 品牌底（骨白 / 炭黑 + 冰蓝、橙点）；manifest 简介改中英双语。
- **0.13.0**：专注开始后显示可拖动的浮动小窗（暂停 / 继续 / 结束 / 操作台 / 收起）。
- **0.12.1**：专注集改为在原计时区设名称、方式与时长后保存；支持正计时。
- **0.12.0**：新增专注集（预设名称 + 时长），删除预设不影响打卡与日历。
- **0.11.1**：修复 Q 操作台「新建」对象的路径生成错误；修复 resource 在没有 `note_kind` 时被放入 `<Topic>/Other`、而不是主题根目录的问题。
- **0.11.0**：Q 截面六模块、Q 操作台、自动路由。

- **0.15.18**: the Q view's Input → Capture page replaces the 12-week capture heatmap with a random capture card; it draws only captures not yet converted to a note, task or project, and can draw again or open the source daily note.
- **0.15.17**: the focus desktop window now moves to the top-right corner of the current screen (8px margin) on open/reopen, while staying pinned; the 240×240 size is unchanged.
- **0.15.16**: focus records now sort the `### 今日安排` entries with a `startTime` when written, so a new record no longer stays at the bottom; the desktop focus window is 240×240 and is pinned on open.
- **0.15.15**: added a "focus desktop window" popout for the focus timer; starting the timer opens it automatically on desktop. It can be moved to another monitor; the in-window "Always on top" button toggles system pinning, with PowerToys Always On Top as a fallback. The original in-app mini window is unchanged.
- **0.15.14**: fixed `.md` handling in `linkName()`: links and raw paths now both take the basename and strip `.md`, so area health and the Q view's area grouping no longer treat `.md` area links as broken.
- **0.15.13**: added an optional glass theme (off by default; the original theme is unchanged): glass capsules for buttons/inputs/cards/KPIs/lists/calendar/heatmap/empty states, sliding capsules for tabs and task rows, glass Q menus and four modal types; improved dark-mode readability plus reduced-motion and focus fixes.
- **0.15.11**: the Q Console is now 11 sections; favorites, writing and drafts moved into tabs on the left of Quick capture; focus, check-in and capture use two columns with inner scrolling; button rows wrap as a whole.
- **0.15.5**: added quarterly and yearly journals (`07_Journal/Quarterly|Yearly/{year}`, `period: quarterly/yearly`) and matching commands.
- **0.15.4**: added a "current page" block to the Q Console that shows complete, due date, stage, relation and open actions based on the active note's `type`; it refreshes when you switch notes.
- **0.15.3**: converting a quick capture to a task now asks for a due date; overdue is still computed from `截止`, with no separate folder.
- **0.15.2**: focus uses an active-segment model; paused time is neither counted nor written to the calendar, and resumed work is written as a new segment.
- **0.15.1**: fixed quick capture, calendar and check-in buttons inheriting the external theme's green inset and becoming unreadable in dark mode; added pause; verified hand-written Full Calendar events.
- **0.15.0**: Q Section became a read-only data view and the Q Console became the only place that writes; added relations (area / project / task / note), completing the current object, area health and route health.
- **0.14.3**: improved contrast of the focus mini-window buttons in light and dark themes; the close button stays transparent.
- **0.14.2**: fixed Q Console and check-in buttons inheriting the external theme's green inset and becoming unreadable in dark mode.
- **0.14.1**: fixed the green inset and dark-mode contrast on Q Section module and sub tabs; buttons restored to the Q brand style.
- **0.14.0**: added an independent Q theme (follow / light / dark, independent of the Obsidian theme) and ins-style buttons.
- **0.13.1**: panels use the Q brand background (bone white / charcoal with ice-blue and orange accents); manifest description is now bilingual.
- **0.13.0**: a draggable floating mini window appears while a focus session runs (pause / resume / finish / console / collapse).
- **0.12.1**: focus presets are now set in the original timer area (name, mode, duration) before saving; stopwatch mode supported.
- **0.12.0**: added focus presets (name + duration); deleting a preset does not affect check-ins or the calendar.
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
