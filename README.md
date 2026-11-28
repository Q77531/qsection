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

当前版本 **0.17.3**。Current version: **0.17.3**.

它是自建的 Obsidian 插件，包含以下部分：

It is a self-built Obsidian plugin with the following parts:

- **Q 截面（只读）**：右侧栏数据视图，六个一级模块——截面、推进、产出、输入、节奏、系统；只展示数据和只读导航，不写入、不操作。
- **Q 日历**：日程、倒数日和专注入口；日程写入日笔记 `### 今日安排`，倒数日写入 `data.json` 的 `countdowns`，专注仍走插件专注计时器，打卡、速记、任务、项目、内容只读。月 / 周 / 3 天 / 日视图，含 Mini Calendar、专注集、Up Next 和倒数日卡片；支持新建 / 编辑 / 删除日程、打开日程所在日期的日笔记，重叠日程并排显示。顶部专注胶囊显示空闲 / 进行中 / 暂停 / 完成并可开始、暂停或打开专注面板；左侧专注集一键开始，运行中禁用切换；今天的定时日程可直接「开始专注」；结束后的实际行带 `[focusPlan::]`，在时间轴上以半透明块覆盖计划块，不额外占 lane。
- **Q 操作台（唯一通用操作入口）**：当前页自适应动作、专注番茄钟（专注集、倒计时/正计时、暂停分段、浮动小窗 / 桌面小窗、Q 日历；专注记录写入日笔记时按 `startTime` 排序）、项目打卡、速记与转化（含收藏、写作、草稿页签）、关系与推进、完成当前对象、新建对象、打开总览、路由、领域体检、路由健康。
- **自动路由**：按 frontmatter 的 `type` / `status` / `topic` / `note_kind` / `content_stage` / `period` 把笔记移动到对应目录。
- **独立主题**：Q 主题可跟随 Obsidian、强制浅色或深色；ins 风软表面按钮。
- **可选玻璃主题**：默认关闭；开启后 Q 操作台、Q 截面、Q 日历（含专注胶囊与专注面板）使用半透明玻璃胶囊、滑动页签/行选中、玻璃菜单与弹窗；关闭时原主题不变。

Q 日历由插件内置，不再依赖 Full Calendar 插件。

- **Q Section (read-only)**: a sidebar data view with six top-level modules — Section, Push, Output, Input, Rhythm, and System; data and read-only navigation only.
- **Q calendar**: the home for schedules, countdowns and the focus entry point; schedules go into the daily note's `### 今日安排`, countdowns into `countdowns` in `data.json`, and focus still writes through the plugin's focus timer, while check-ins, captures, tasks, projects and content stay read-only. Month / week / 3-day / day views with a mini calendar, focus presets, Up Next and a countdowns card; create, edit and delete schedules, open the daily note of an event's date, and see overlapping events laid out side by side. A header capsule shows idle / running / paused / done and can start or pause focus or open the focus panel; the preset list starts a session in one click and is disabled while one runs; a timed schedule today can start focus directly; a finished session writes an actual line with `[focusPlan::]` that overlays the planned block translucently without taking an extra lane.
- **Q Console (the main place for operations)**: current-page actions, a focus timer with saved presets, countdown or stopwatch mode, pause segments, a floating mini window, a desktop popout window and the Q calendar, project check-ins, quick capture and conversion (with favorites, writing and drafts tabs), relations, completing the current object, new-object shortcuts, dashboard entry points, routing, area health and route health.
- **Auto-routing**: moves notes according to the `type` / `status` / `topic` / `note_kind` / `content_stage` / `period` frontmatter fields.
- **Independent theme**: the Q theme follows Obsidian, or stays light/dark on its own; soft-surface, ins-style buttons.
- **Optional glass theme**: off by default; when enabled, the Q Console, Q Section and Q calendar (including the focus capsule and focus panel) use translucent glass capsules, sliding tab/row selection, and glass menus/modals; the original theme stays unchanged when off.

The Q calendar is built into the plugin and no longer depends on the Full Calendar plugin.

### 专注桌面小窗 / Focus desktop window

Q 操作台 → 专注 →「桌面小窗」会打开独立的 Obsidian popout 窗口；桌面版开始计时也会自动打开。窗口默认 240×240 内容尺寸，打开 / 重开时自动定位到当前屏幕右上角（8px 边距）并自动置顶，可拖到副屏；窗口内「置顶」按钮可取消 / 恢复置顶，如果当前 Obsidian 版本没有该按钮，可用 PowerToys Always On Top（默认 Win+Ctrl+T）钉住。原「小窗」仍留在 Obsidian 内。

The focus desktop window is an Obsidian popout. On desktop it opens automatically when the timer starts, is 240×240 by default, moves to the top-right corner of the current screen (8px margin) and is pinned on open/reopen. Drag it to another monitor; use the in-window "Always on top" button to toggle pinning, or PowerToys Always On Top (Win+Ctrl+T) as a fallback. The original in-app mini window is unchanged.

### 更新记录 / Changelog

- **0.17.3**：Q 日历接入专注：顶部专注胶囊（空闲 / 进行中 / 暂停 / 完成，可开始 / 暂停 / 继续）与专注面板（名称、倒计时 / 正计时、时长、保存专注集、小窗 / 桌面小窗）；Mini Calendar 与 Up Next 之间新增「专注集」，超出高度时内部滚动并显示细滚动条，点预设直接开始、运行中禁用切换；今天的定时日程弹窗新增「开始专注」；结束专注写入的实际行带 `[focusPlan:: 计划起止]`，时间轴用半透明实际块覆盖计划块（计划 / 实际 badge，实际不占 lane），月视图 / Up Next 不重复显示，专注中的计划块有冰蓝描边，编辑实际行保留 `focusPlan`。
- **0.17.2**：Q 日历时间轴支持重叠日程并排：按开始时间划分重叠组，组内按 lane 分栏，2 条各 50%、3 条各 33%，首尾相接不算重叠；窄栏隐藏时间前缀、缩小字号与内边距，列宽 < 28px 时只留色块，完整时间与标题保留在 tooltip；不重叠的日程、月视图和全天区不变。
- **0.17.1**：月 / 周 / 3 天 / 日四个视图共用 `focusDate`：日视图切到 17 号后，再切月（12 月，焦点 17）、周（12/14–20）、3 天（12/17–19）、日（12/17）都围绕焦点日，不再被月视图重置到月初；翻页、今天、Mini Calendar、月视图点日期都会更新焦点日，Mini Calendar / 月视图 / 周表头高亮焦点日；日程编辑弹窗新增「打开日笔记」。
- **0.17.0**：Q 日历新增月视图和日视图，模式顺序改为 `[月] [周] [3 天] [日]`（默认周）；月视图 7 列 + 周数、今天高亮、非本月淡化、每天最多 3 条 + `+N`，点日期进入日视图；Up Next 下面新增「倒数日」卡片，支持每年重复的生日和一次性倒数（数据存 `data.json` 的 `countdowns`），并作为全天事件显示在月 / 周 / 日视图；非玻璃模式补齐 Q 主题按钮，压过 Style Manager 的全局绿色按钮，深色不再浅底白字。
- **0.16.1**：Q 日历支持直接新建 / 编辑 / 删除日程（时间轴空白格、全天格、`+ 日程`），写回日笔记 `### 今日安排` 并按 `startTime` 排序，改日期先写新日期再删旧行；修复 Mini Calendar 点任意日期跳到下一月、日期不对照；重绘保留滚动位置；日历与日程弹窗接入玻璃主题。
- **0.16.0**：新增 Q 日历视图（默认 7 天，可切 3 天）：Mini Calendar + Up Next + 全天区 + 时间轴，聚合日笔记 `### 今日安排`、打卡、速记、任务、项目与内容发布日期；支持玻璃主题作用域；不依赖 Full Calendar 插件。
- **0.15.24**：自动路由忽略 `copilot/`、`09_Sources/`、`00_Inbox/WorkBuddy/`，避免备份任务、私有资料和 WorkBuddy 原料被误当成正式对象移动；修复备份任务被路由进 `08_Tasks` 后在 Todo / Done 留下重复文件的问题。
- **0.15.23**：Q 操作台 / Q 截面统一 4px 间距尺度（4/8/12/16/24）、卡片内边距和按钮规格；侧栏断点改为容器查询，窄栏时速记 / 打卡 / 专注 / 速记 console 自动单列，修复打卡表单被挤成 151px、placeholder 裁字；速记和草稿在重绘 / 切笔记时保留未发送内容并恢复光标；小字改用 muted 对比色，补 2px 键盘焦点环，转化 / 删除 / 日历控件点击目标 ≥24px。
- **0.15.22**：新建领域自动创建 `02_Areas/<领域>/` 文件夹、主领域笔记，以及 `关联笔记 / 关联任务 / 关联项目` 三篇视图子笔记；主笔记 `routing: false`，不会被自动路由移出文件夹。不生成「关联剪藏」。
- **0.15.21**：速记转化新增「明日任务」（任务进 `08_Tasks/每日任务`，创建时间为明天 00:00，写入明天日笔记 `### 今日待办`）；任务新增 `关联领域` 字段和 Q 操作台「关联领域」按钮；Q 操作台重绘保留滚动位置。
- **0.15.20**：修复 0.15.19 模板加引号后，Q-Section 生成的日志 `date` 变成字符串、属性面板不显示日期控件的问题；`renderTemplate()` 渲染 frontmatter 时去掉日期占位符引号，周 / 月 / 季 / 年字段保持文本。
- **0.15.19**：速记转任务不设截止日期时进入 `08_Tasks/每日任务`，并追加到今天日笔记 `### 今日待办`；补截止日期后回 `08_Tasks/Todo`。日笔记模板 / 脚手架新增 `### 今日待办`；五个日志模板日期占位符加引号，修复周 / 季（及日 / 月 / 年）属性不显示。
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

- **0.17.3**: the Q calendar now hosts focus: a header capsule (idle / running / paused / done, start / pause / resume) and a focus panel (name, countdown / stopwatch, duration, saving presets, mini window, desktop popout); a presets card between the mini calendar and Up Next scrolls internally with a thin scrollbar when tall, starts a preset on click and is disabled while a session runs; a timed schedule today can start focus from its modal; a finished session writes an actual line with `[focusPlan:: plan start-end]` that overlays the planned block translucently (planned / actual badges, no extra lane), is not repeated in the month view or Up Next, and gives the planned block an ice-blue outline while focus runs; editing the actual line keeps `focusPlan`.
- **0.17.2**: the Q calendar timeline lays overlapping events side by side: each overlap group splits into lanes (2 events at 50% each, 3 at 33% each; back-to-back events do not count as overlapping); narrow lanes hide the time prefix and shrink font and padding, and columns under 28px collapse to a colour block with the full time and title kept in the tooltip; non-overlapping events, the month view and the all-day row are unchanged.
- **0.17.1**: month / week / 3-day / day share one `focusDate`: after switching the day view to the 17th, month (focused on the 17th), week (12/14–20), 3-day (12/17–19) and day (12/17) all stay around that date instead of the month view resetting to the start of the month; paging, Today, the mini calendar and month-cell clicks update the focused date, and the mini calendar, month cells and week header highlight it; the event modal gained "Open daily note".
- **0.17.0**: the Q calendar gained month and day views, with the mode order `[Month] [Week] [3 days] [Day]` (week by default); the month grid has week numbers, today highlighting, dimmed out-of-month days and up to 3 events per day plus `+N`, and clicking a date opens the day view; a Countdowns card sits under Up Next, supporting yearly birthdays and one-off countdowns (stored in `countdowns` in `data.json`) and shown as all-day events in the month / week / day views; non-glass mode now gives calendar buttons the Q theme so the global green Style Manager buttons no longer win, and dark mode no longer shows white text on a light background.
- **0.16.1**: the Q calendar can now create, edit and delete schedules directly (timeline cells, all-day cells, `+ Event`), writing back to the daily note's `### 今日安排` sorted by `startTime` and writing the new date before removing the old line; fixed the mini calendar jumping to the next month and showing wrong dates for any click; re-renders keep scroll position; the calendar and event modal joined the glass theme.
- **0.16.0**: added the Q calendar view (7 days by default, switchable to 3): mini calendar, Up Next, an all-day row and a timeline, aggregating `### 今日安排`, check-ins, captures, task dates, project dates and content publish dates; scoped glass theme support; no Full Calendar dependency.
- **0.15.24**: auto-routing now ignores `copilot/`, `09_Sources/` and `00_Inbox/WorkBuddy/`, so backup tasks, private sources and WorkBuddy material are no longer treated as real objects and moved; this fixes the duplicate tasks left in Todo/Done when backed-up tasks were routed into `08_Tasks`.
- **0.15.23**: unified 4px spacing tokens (4/8/12/16/24), card padding and button sizing across the Q console and Q view; sidebar breakpoints now use container queries, stacking capture / check-in / focus / capture-console columns on narrow rails and fixing the 151px check-in field clipping; unsent capture and draft text now survive re-render and note switches, with cursor restored; small text uses the muted contrast color, adds a 2px keyboard focus ring, and brings convert / delete / calendar targets to at least 24px.
- **0.15.22**: creating an area now builds `02_Areas/<area>/` with the main area note plus three view notes (related notes / tasks / projects); the main note has `routing: false` and stays in its folder. No "related clips" note is created.
- **0.15.21**: quick capture gained a "Tomorrow task" conversion (the task goes to `08_Tasks/每日任务`, created time tomorrow 00:00, and is appended to tomorrow's `### 今日待办`); tasks gained a `关联领域` field and a Q console "Link area" button; the Q console now preserves scroll position on re-render.
- **0.15.20**: fixed the 0.15.19 regression where quoted journal templates made the generated journal's `date` a string and hid the date control; `renderTemplate()` now strips the quotes from date placeholders in frontmatter, while week/month/quarter/year stay text.
- **0.15.19**: undated capture-to-task conversions now go to `08_Tasks/每日任务` and are appended to the `### 今日待办` section of today's daily note; adding a due date later moves the task back to `08_Tasks/Todo`. The daily note template/scaffold gained `### 今日待办`; the five journal templates quote their date placeholders to fix missing properties on weekly/quarterly (and daily/monthly/yearly) journals.
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
