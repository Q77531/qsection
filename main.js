'use strict';

const {
  Plugin,
  Notice,
  Modal,
  Setting,
  PluginSettingTab,
  ItemView,
  MarkdownView,
  Menu,
  TFile,
  TFolder,
  FuzzySuggestModal,
  Platform
} = require('obsidian');

const DEFAULT_SETTINGS = {
  autoRoute: true,
  debounceMs: 1200,
  focusRecords: [],
  focusCheckins: [],
  focusTimer: null,
  focusName: '专注',
  focusPresets: [],
  focusPresetId: null,
  focusMiniPos: null,
  themeMode: 'auto',
  glassTheme: false,
  checkinItems: [],
  checkinRecords: [],
  favoritePaths: [],
  drafts: [],
  writingProjects: [],
  captureConversions: {},
  countdowns: []
};

const LOG_PATH = '06_System/审计/router-log.jsonl';
const RULES_PATH = '06_System/router-rules.json';

const DEFAULT_RULES = {
  version: 1,
  topicFolders: {
    obsidian: 'Obsidian',
    ai: 'AI',
    trade: 'Trade',
    math: 'Math',
    english: 'English',
    culture: 'Culture',
    other: 'Other'
  },
  types: {
    project: {
      field: 'status',
      routes: {
        active: '01_Projects/Active',
        paused: '01_Projects/Paused',
        done: '04_Archive/Projects',
        archived: '04_Archive/Projects'
      }
    },
    area: {
      field: 'status',
      routes: {
        active: '02_Areas',
        paused: '02_Areas',
        done: '04_Archive/Areas',
        archived: '04_Archive/Areas'
      }
    },
    resource: {
      field: 'note_kind',
      template: '03_Resources/{topicFolder}/{noteKindFolder}',
      rootTemplate: '03_Resources/{topicFolder}',
      rootValues: ['', 'Other']
    },
    content: {
      field: 'content_stage',
      routes: {
        idea: '05_Content/00 选题',
        draft: '05_Content/01 脚本',
        asset: '05_Content/02 素材',
        published: '05_Content/03 发布',
        review: '05_Content/04 复盘',
        archived: '05_Content/05 归档'
      }
    },
    task: {
      field: 'status',
      routes: {
        todo: '08_Tasks/Todo',
        doing: '08_Tasks/Doing',
        done: '08_Tasks/Done'
      }
    },
    journal: {
      field: 'period',
      routes: {
        daily: '07_Journal/Daily/{year}',
        weekly: '07_Journal/Weekly/{year}',
        monthly: '07_Journal/Monthly/{year}',
        quarterly: '07_Journal/Quarterly/{year}',
        yearly: '07_Journal/Yearly/{year}'
      }
    },
    note: {
      field: 'note_kind',
      template: '03_Resources/{topicFolder}/Notes/{noteKindFolder}',
      rootTemplate: '03_Resources/{topicFolder}/Notes',
      rootValues: ['', '索引']
    }
  }
};

function firstValue(value) {
  if (Array.isArray(value)) return value.length ? value[0] : '';
  return value == null ? '' : value;
}

function textValue(value) {
  const v = firstValue(value);
  return v == null ? '' : String(v).trim();
}

function yearOf(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return String(value.getFullYear());
  }
  const m = String(value || '').match(/^(\d{4})/);
  return m ? m[1] : String(new Date().getFullYear());
}

function topicFolderFromMap(topic, map) {
  const key = textValue(topic).toLowerCase();
  if (map && Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  return 'Other';
}

function styleQMenu(menu, plugin) {
  if (!menu || !menu.dom || !plugin || !plugin.settings.glassTheme) return;
  menu.dom.addClass('qsection-glass-menu');
  plugin.applyThemeClass(menu.dom);
}

function decorateQModal(modal) {
  if (!modal || !modal.modalEl) return;
  const plugin = modal.app && modal.app.plugins && modal.app.plugins.plugins
    ? modal.app.plugins.plugins.qsection
    : null;
  if (!plugin || !plugin.settings.glassTheme) return;
  modal.modalEl.addClass('qsection-modal');
  plugin.applyThemeClass(modal.modalEl);
  if (modal.contentEl) plugin.applyThemeClass(modal.contentEl);
}

function paintSegmentPills(root, store) {
  if (!root || !store) return;
  const groups = [
    { key: 'report-tabs', group: root.querySelector('.qsection-report-tabs'), item: '.qsection-report-tab', active: '.qsection-report-tab.is-active' },
    { key: 'subtabs', group: root.querySelector('.qsection-subtabs'), item: '.qsection-subtab', active: '.qsection-subtab.is-active' },
    { key: 'focus-modes', group: root.querySelector('.qsection-focus-modes'), item: '.qsection-focus-mode', active: '.qsection-focus-mode.qsection-glass-active' },
    { key: 'focus-duration', group: root.querySelector('.qsection-focus-settings'), item: '.qsection-duration-preset', active: '.qsection-duration-preset.qsection-glass-active' }
  ];
  groups.forEach(({ key, group, item, active }) => {
    if (!group) { store.delete(key); return; }
    Array.from(group.querySelectorAll(item)).forEach((el) => el.classList.add('qsection-segment-item'));
    let pill = group.querySelector(':scope > .qsection-segment-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'qsection-segment-pill';
      group.appendChild(pill);
    }
    const activeEl = group.querySelector(active);
    if (!activeEl || !activeEl.offsetWidth) {
      pill.style.opacity = '0';
      store.delete(key);
      return;
    }
    const rect = {
      left: activeEl.offsetLeft,
      top: activeEl.offsetTop,
      width: activeEl.offsetWidth,
      height: activeEl.offsetHeight
    };
    const prev = store.get(key);
    pill.style.opacity = '1';
    pill.style.width = rect.width + 'px';
    pill.style.height = rect.height + 'px';
    if (prev && (prev.left !== rect.left || prev.top !== rect.top || prev.width !== rect.width || prev.height !== rect.height)) {
      pill.classList.remove('is-moving');
      pill.style.transition = 'none';
      pill.style.left = prev.left + 'px';
      pill.style.top = prev.top + 'px';
      pill.style.width = prev.width + 'px';
      pill.style.height = prev.height + 'px';
      void pill.offsetWidth;
      const direction = rect.left >= prev.left ? 1 : -1;
      pill.style.transformOrigin = direction > 0 ? 'left center' : 'right center';
      pill.style.transition = '';
      pill.classList.add('is-moving');
      requestAnimationFrame(() => {
        pill.style.left = rect.left + 'px';
        pill.style.top = rect.top + 'px';
        pill.style.width = rect.width + 'px';
        pill.style.height = rect.height + 'px';
        window.setTimeout(() => {
          pill.classList.remove('is-moving');
          pill.style.transformOrigin = 'center';
        }, 320);
      });
    } else {
      pill.style.left = rect.left + 'px';
      pill.style.top = rect.top + 'px';
    }
    store.set(key, rect);
  });
}

class PromptModal extends Modal {
  constructor(app, title, placeholder, defaultValue, onSubmit, onCancel) {
    super(app);
    this.titleText = title;
    this.placeholder = placeholder;
    this.defaultValue = defaultValue;
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;
    this.submitted = false;
  }

  onOpen() {
    decorateQModal(this);
    this.contentEl.createEl('h2', { text: this.titleText });
    const input = this.contentEl.createEl('input', { type: 'text', cls: 'qsection-actions-input' });
    input.value = this.defaultValue || '';
    input.placeholder = this.placeholder || '';
    const row = this.contentEl.createDiv({ cls: 'qsection-actions-modal-row' });
    const ok = row.createEl('button', { text: '创建', cls: 'mod-cta' });
    const cancel = row.createEl('button', { text: '取消' });
    const submit = () => {
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      this.submitted = true;
      this.close();
      this.onSubmit(v);
    };
    ok.addEventListener('click', submit);
    cancel.addEventListener('click', () => this.close());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    window.setTimeout(() => { input.focus(); input.select(); }, 50);
  }

  onClose() {
    this.contentEl.empty();
    if (!this.submitted && this.onCancel) this.onCancel();
  }
}

class DueDateModal extends Modal {
  constructor(app, onSubmit, onSkip) {
    super(app);
    this.onSubmit = onSubmit;
    this.onSkip = onSkip;
    this.resolved = false;
  }

  onOpen() {
    decorateQModal(this);
    this.contentEl.createEl('h2', { text: '设置截止日期' });
    this.contentEl.createEl('p', { text: '这篇速记转成任务后，要设截止日期吗？不设置就留空。' });
    const input = this.contentEl.createEl('input', { type: 'date', cls: 'qsection-actions-input' });
    input.value = window.moment().format('YYYY-MM-DD');
    const row = this.contentEl.createDiv({ cls: 'qsection-actions-modal-row' });
    const ok = row.createEl('button', { text: '设置', cls: 'mod-cta' });
    const skip = row.createEl('button', { text: '不设置' });
    const submit = () => {
      const value = String(input.value || '').trim();
      if (!value || !window.moment(value, 'YYYY-MM-DD', true).isValid()) {
        new Notice('Q-Section: 请选择 YYYY-MM-DD 格式的日期。');
        input.focus();
        return;
      }
      this.resolved = true;
      this.close();
      this.onSubmit(value);
    };
    ok.addEventListener('click', submit);
    skip.addEventListener('click', () => {
      this.resolved = true;
      this.close();
      this.onSkip();
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    window.setTimeout(() => { input.focus(); }, 50);
  }

  onClose() {
    this.contentEl.empty();
    if (!this.resolved) {
      this.resolved = true;
      this.onSkip();
    }
  }
}

class HealthModal extends Modal {
  constructor(app, plugin, title, summary, sections) {
    super(app);
    this.plugin = plugin;
    this.titleText = title;
    this.summary = summary;
    this.sections = sections || [];
  }

  onOpen() {
    decorateQModal(this);
    const root = this.contentEl;
    root.empty();
    root.addClass('qsection-health-modal');
    this.plugin.applyThemeClass(root);
    root.createEl('h2', { text: this.titleText });
    if (this.summary) root.createEl('p', { cls: 'qsection-health-summary', text: this.summary });
    for (const section of this.sections) {
      const box = root.createDiv({ cls: 'qsection-health-section' });
      box.createEl('h3', { text: section.title });
      if (!section.items || !section.items.length) {
        box.createDiv({ cls: 'qsection-health-empty', text: section.empty || '没有发现问题。' });
        continue;
      }
      for (const item of section.items) {
        const row = box.createDiv({ cls: 'qsection-health-row' + (section.tone ? ' is-' + section.tone : '') });
        row.createSpan({ cls: 'qsection-health-row-title', text: item.title });
        if (item.meta) row.createSpan({ cls: 'qsection-health-row-meta', text: item.meta });
        if (item.path) {
          row.addClass('is-clickable');
          row.addEventListener('click', () => { void this.app.workspace.openLinkText(item.path, '', true); });
        }
      }
    }
  }

  onClose() { this.contentEl.empty(); }
}

class RelationSuggestModal extends FuzzySuggestModal {
  constructor(app, plugin, kind, sourceFile) {
    super(app);
    this.plugin = plugin;
    this.kind = kind;
    this.sourceFile = sourceFile;
    const labels = { area: '领域', project: '项目', task: '任务', note: '笔记' };
    this.setPlaceholder('选择要关联的' + (labels[kind] || '对象') + '…');
  }

  getItems() {
    return this.plugin.getRelationTargets(this.kind);
  }

  getItemText(file) {
    return file.basename;
  }

  onChooseItem(file) {
    void this.plugin.applyRelation(this.sourceFile, this.kind, file);
  }
}

class ParaActionsView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.focusRefs = null;
    this.refreshTimer = null;
    this.captureBusy = false;
    this.creationBusy = false;
    this.favoriteBusy = false;
    this.captureToken = 0;
    this.writingToken = 0;
    this.captureDraft = '';
    this.draftDraft = '';
    this.quickAssistTab = 'favorites';
  }

  getViewType() { return 'qsection-actions'; }
  getDisplayText() { return 'Q 操作台'; }
  getIcon() { return 'diamond'; }

  async onOpen() {
    this.render();
    this.segmentResizeObserver = new ResizeObserver(() => this.paintSegments());
    this.segmentResizeObserver.observe(this.contentEl);
    this.registerEvent(this.app.workspace.on('qsection:focus-changed', () => this.updateFocusUI()));
    this.registerEvent(this.app.workspace.on('qsection:checkin-changed', () => this.render()));
    this.registerEvent(this.app.workspace.on('qsection:theme-changed', () => {
      this.plugin.applyThemeClass(this.contentEl);
      this.paintSegments();
    }));
    const refresh = () => {
      if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => this.render(), 400);
    };
    this.registerEvent(this.app.vault.on('create', refresh));
    this.registerEvent(this.app.vault.on('delete', refresh));
    this.registerEvent(this.app.vault.on('rename', refresh));
    this.registerEvent(this.app.metadataCache.on('changed', refresh));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.render()));
  }

  async onClose() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    if (this.segmentFrame) cancelAnimationFrame(this.segmentFrame);
    this.segmentFrame = null;
    if (this.segmentResizeObserver) this.segmentResizeObserver.disconnect();
    this.segmentResizeObserver = null;
    this.focusRefs = null;
    this.contentEl.empty();
  }

  section(title) {
    const section = this.contentEl.createDiv({ cls: 'qsection-actions-section' });
    section.createEl('h3', { text: title });
    return section;
  }

  buttonRow(parent, buttons) {
    const row = parent.createDiv({ cls: 'qsection-actions-row' });
    for (const item of buttons) {
      const btn = row.createEl('button', { text: item[0], cls: 'qsection-actions-button' });
      btn.addEventListener('click', (event) => { void item[1](event); });
    }
  }

  renderQuickAssist(container) {
    container.empty();
    const tabs = [
      ['favorites', '收藏'],
      ['writing', '写作'],
      ['drafts', '草稿']
    ];
    const bar = container.createDiv({ cls: 'qsection-quick-assist-tabs' });
    for (const [key, label] of tabs) {
      const btn = bar.createEl('button', {
        cls: 'qsection-quick-assist-tab' + (this.quickAssistTab === key ? ' is-active' : ''),
        text: label
      });
      btn.addEventListener('click', () => {
        this.quickAssistTab = key;
        this.renderQuickAssist(container);
      });
    }
    const body = container.createDiv({ cls: 'qsection-quick-assist-content' });
    if (this.quickAssistTab === 'writing') void this.renderWritingPanel(body);
    else if (this.quickAssistTab === 'drafts') this.renderDraftPanel(body);
    else this.renderFavoritesPanel(body);
  }

  renderCurrentPagePanel(section) {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== 'md') {
      section.createDiv({ cls: 'qsection-report-empty', text: '打开一篇 Q 笔记后，这里会出现当前页操作。' });
      return;
    }
    if (file.path.startsWith('06_System/')) {
      section.createDiv({ cls: 'qsection-report-muted', text: '当前是系统文件，不显示对象操作。' });
      return;
    }

    const fm = this.plugin.getFrontmatter(file) || {};
    const type = textValue(fm.type).toLowerCase();
    const labels = { task: '任务', project: '项目', content: '内容', area: '领域', note: '笔记', resource: '资源', journal: '日志' };
    const typeLabel = labels[type] || (type ? type : '无 type');
    const title = section.createDiv({ cls: 'qsection-current-title' });
    title.createSpan({ cls: 'qsection-current-name', text: file.basename });
    title.createSpan({ cls: 'qsection-current-type', text: typeLabel });

    const meta = section.createDiv({ cls: 'qsection-current-meta' });
    meta.createSpan({ text: file.path });
    const status = textValue(fm.status);
    if (status) meta.createSpan({ text: 'status: ' + status });
    const stage = textValue(fm.content_stage);
    if (stage) meta.createSpan({ text: 'content_stage: ' + stage });
    const project = this.plugin.linkName(textValue(fm.project));
    if (project) meta.createSpan({ text: 'project: ' + project });
    const area = this.plugin.linkName(textValue(fm.area));
    if (area) meta.createSpan({ text: 'area: ' + area });
    const taskArea = this.plugin.linkName(textValue(fm['关联领域']));
    if (taskArea) meta.createSpan({ text: '关联领域: ' + taskArea });

    const open = (name) => { if (name) void this.app.workspace.openLinkText(name, '', true); };
    const relationButtons = () => [
      ['关联项目', () => this.plugin.startRelation('project')],
      ['关联领域', () => this.plugin.startRelation('area')],
      ['关联笔记', () => this.plugin.startRelation('note')]
    ];

    if (type === 'task') {
      const buttons = [
        ['完成当前对象', () => this.plugin.completeCurrentObject()],
        ['设置截止', () => this.promptTaskDueDate(file, fm)],
        ['关联项目', () => this.plugin.startRelation('project')],
        ['关联领域', () => this.plugin.startRelation('area')]
      ];
      if (project) buttons.push(['打开项目', () => open(project)]);
      this.buttonRow(section, buttons);
      return;
    }

    if (type === 'project') {
      const buttons = [
        ['完成当前对象', () => this.plugin.completeCurrentObject()],
        ['关联领域', () => this.plugin.startRelation('area')],
        ['插入任务 Base', () => this.plugin.insertProjectTaskBase()],
        ['插入内容 Base', () => this.plugin.insertProjectContentBase()]
      ];
      if (area) buttons.push(['打开领域', () => open(area)]);
      this.buttonRow(section, buttons);
      return;
    }

    if (type === 'content') {
      const buttons = [
        ['关联项目', () => this.plugin.startRelation('project')],
        ['推进阶段', (event) => this.showContentStageMenu(file, event)]
      ];
      if (project) buttons.push(['打开项目', () => open(project)]);
      buttons.push(['内容日历', () => { void this.app.workspace.openLinkText('05_Content/内容日历.md', '', true); }]);
      this.buttonRow(section, buttons);
      return;
    }

    if (type === 'area') {
      this.buttonRow(section, [
        ['领域体检', () => this.plugin.showAreaHealth()],
        ['打开领域总览', () => this.plugin.openBase('领域总览')],
        ['新建项目', () => this.plugin.createFromTemplate('project')]
      ]);
      return;
    }

    if (type === 'note' || type === 'resource') {
      this.buttonRow(section, [
        ...relationButtons(),
        ['打开资源总览', () => this.plugin.openBase('资源总览')]
      ]);
      return;
    }

    if (type === 'journal') {
      this.buttonRow(section, [
        ['打开 Q 截面', () => this.plugin.activateReportView()],
        ['打开日志总览', () => this.plugin.openBase('日志总览')]
      ]);
      return;
    }

    section.createDiv({
      cls: 'qsection-report-muted',
      text: type ? '这个对象类型暂时没有专属当前页动作。' : '这篇笔记没有 type；Q-Section 不会自动路由它。先补 type 或用模板新建。'
    });
  }

  promptTaskDueDate(file, fm) {
    const current = textValue(fm['截止']);
    new PromptModal(this.app, '设置截止日期', 'YYYY-MM-DD', current || window.moment().format('YYYY-MM-DD'), (value) => {
      const due = String(value || '').trim();
      if (due && !window.moment(due, 'YYYY-MM-DD', true).isValid()) {
        new Notice('Q-Section: 截止日期要写成 YYYY-MM-DD。');
        return;
      }
      void this.plugin.setTaskDueDate(file, due);
    }, () => {}).open();
  }

  showContentStageMenu(file, event) {
    const stages = [
      ['idea', '选题'], ['draft', '脚本'], ['asset', '素材'],
      ['published', '发布'], ['review', '复盘'], ['archived', '归档']
    ];
    const menu = new Menu();
    for (const [value, label] of stages) {
      menu.addItem((item) => item.setTitle(label).onClick(() => { void this.plugin.setContentStage(file, value); }));
    }
    menu.showAtMouseEvent(event);
    styleQMenu(menu, this.plugin);
  }

  renderFocusPanel(section) {
    const presets = this.plugin.getFocusPresets();
    const layout = section.createDiv({ cls: 'qsection-focus-layout' });
    const presetBox = layout.createDiv({ cls: 'qsection-focus-presets' });
    presetBox.createDiv({ cls: 'qsection-focus-presets-title', text: '专注集合' });
    if (!presets.length) {
      presetBox.createDiv({ cls: 'qsection-report-empty', text: '还没有专注项目；先在计时区设好名称/方式/时长，再点「保存到专注集」。' });
    } else {
      const list = presetBox.createDiv({ cls: 'qsection-focus-preset-list' });
      for (const preset of presets) {
        const row = list.createDiv({ cls: 'qsection-focus-preset-row' });
        const active = this.plugin.focusPresetId === preset.id;
        const btn = row.createEl('button', {
          cls: 'qsection-focus-preset-item' + (active ? ' is-active' : ''),
          text: preset.mode === 'stopwatch' ? `${preset.name} · 正计时` : `${preset.name} · ${preset.minutes} 分`
        });
        btn.addEventListener('click', () => {
          this.plugin.applyFocusPreset(preset.id);
          this.render();
        });
        const remove = row.createEl('button', {
          cls: 'qsection-focus-preset-delete',
          text: '×',
          attr: { title: '删除专注项目（不影响历史记录）' }
        });
        remove.addEventListener('click', () => {
          if (!window.confirm(`删除专注项目「${preset.name}」？历史专注和日笔记里的日程不会删除。`)) return;
          void this.plugin.removeFocusPreset(preset.id).then(() => this.render());
        });
      }
    }
    const card = layout.createDiv({ cls: 'qsection-focus-card' });
    const nameInput = card.createEl('input', { cls: 'qsection-focus-name', attr: { type: 'text', placeholder: '专注名称：写稿 / 数学复习 / 剪视频' } });
    nameInput.value = this.plugin.focusName || '专注';
    const commitName = () => this.plugin.setFocusName(nameInput.value);
    nameInput.addEventListener('change', commitName);
    nameInput.addEventListener('blur', commitName);
    nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        nameInput.blur();
      }
    });
    const modeRow = card.createDiv({ cls: 'qsection-focus-modes' });
    const modeCountdown = modeRow.createEl('button', { cls: 'qsection-focus-mode', text: '倒计时' });
    const modeStopwatch = modeRow.createEl('button', { cls: 'qsection-focus-mode', text: '正计时' });
    modeCountdown.classList.toggle('qsection-glass-active', this.plugin.focusMode === 'countdown');
    modeStopwatch.classList.toggle('qsection-glass-active', this.plugin.focusMode === 'stopwatch');
    modeCountdown.addEventListener('click', () => {
      this.plugin.setFocusMode('countdown');
      this.render();
    });
    modeStopwatch.addEventListener('click', () => {
      this.plugin.setFocusMode('stopwatch');
      this.render();
    });

    const timeEl = card.createDiv({ cls: 'qsection-focus-time', text: '25:00' });
    const statusEl = card.createDiv({ cls: 'qsection-focus-status', text: '未开始' });
    const progress = card.createDiv({ cls: 'qsection-focus-progress' });
    const progressFill = progress.createDiv({ cls: 'qsection-focus-progress-fill' });

    const settingsRow = card.createDiv({ cls: 'qsection-focus-settings' });
    let durationInput = null;
    let durationButton = null;
    if (this.plugin.focusMode === 'countdown') {
      const currentMinutes = Math.round(this.plugin.focusDuration / 60);
      [15, 25, 45, 60, 90, 120].forEach((minutes) => {
        const btn = settingsRow.createEl('button', { cls: 'qsection-focus-preset qsection-duration-preset', text: `${minutes} 分` });
        btn.classList.toggle('qsection-glass-active', currentMinutes === minutes);
        btn.addEventListener('click', () => this.plugin.setFocusDuration(minutes));
      });
      durationInput = settingsRow.createEl('input', { cls: 'qsection-focus-input' });
      durationInput.type = 'number';
      durationInput.min = '1';
      durationInput.max = '360';
      durationInput.value = String(Math.round(this.plugin.focusDuration / 60));
      durationButton = settingsRow.createEl('button', { cls: 'qsection-focus-preset', text: '设定' });
      durationButton.addEventListener('click', () => {
        const value = Number(durationInput.value);
        if (!Number.isFinite(value) || value < 1 || value > 360) {
          new Notice('Q-Section: 倒计时范围是 1–360 分钟。');
          return;
        }
        this.plugin.setFocusDuration(Math.round(value));
      });
    } else {
      settingsRow.createSpan({ cls: 'qsection-report-muted', text: '正计时上限 12 小时。' });
    }

    const buttonRow = card.createDiv({ cls: 'qsection-focus-buttons' });
    const startBtn = buttonRow.createEl('button', { cls: 'qsection-focus-primary', text: '开始' });
    const pauseBtn = buttonRow.createEl('button', { cls: 'qsection-report-button', text: '暂停' });
    const finishBtn = buttonRow.createEl('button', { cls: 'qsection-report-button', text: '结束并记录' });
    const resetBtn = buttonRow.createEl('button', { cls: 'qsection-report-button', text: '重置' });
    const savePresetBtn = buttonRow.createEl('button', { cls: 'qsection-report-button', text: '保存到专注集' });
    const miniBtn = buttonRow.createEl('button', { cls: 'qsection-report-button', text: '小窗' });
    miniBtn.addEventListener('click', () => this.plugin.showFocusMini());
    const popoutBtn = buttonRow.createEl('button', { cls: 'qsection-report-button', text: '桌面小窗' });
    popoutBtn.addEventListener('click', () => { void this.plugin.showFocusPopout(); });
    savePresetBtn.addEventListener('click', () => {
      const minutes = this.plugin.focusMode === 'countdown' ? Math.round(this.plugin.focusDuration / 60) : 0;
      void this.plugin.addFocusPreset(this.plugin.focusName, minutes, this.plugin.focusMode).then((preset) => {
        if (preset) {
          new Notice(`Q-Section: 已保存专注项目：${preset.name}`);
          this.render();
        }
      });
    });
    startBtn.addEventListener('click', () => this.plugin.startFocusTimer());
    pauseBtn.addEventListener('click', () => this.plugin.pauseFocusTimer());
    finishBtn.addEventListener('click', () => { void this.plugin.finishFocusTimer(false); });
    resetBtn.addEventListener('click', () => this.plugin.resetFocusTimer());
    card.createDiv({ cls: 'qsection-report-muted qsection-focus-hint', text: '开始后自动打开桌面小窗；暂停后可点「继续」；完整统计在 Q 截面 → 节奏 → 专注' });
    card.createDiv({ cls: 'qsection-report-muted qsection-focus-hint', text: '「小窗」打开 Obsidian 内浮层；桌面小窗可拖到副屏，置顶用窗口内按钮或 PowerToys Win+Ctrl+T。' });

    this.focusRefs = {
      time: timeEl,
      status: statusEl,
      progress: progressFill,
      nameInput,
      start: startBtn,
      pause: pauseBtn,
      finish: finishBtn,
      reset: resetBtn,
      modeCountdown,
      modeStopwatch,
      durationInput,
      durationButton
    };
    this.updateFocusUI();
  }

  updateFocusUI() {
    const refs = this.focusRefs;
    if (!refs || !this.plugin.getFocusSnapshot) return;
    const snap = this.plugin.getFocusSnapshot();
    if (refs.nameInput && document.activeElement !== refs.nameInput) refs.nameInput.value = snap.name || '专注';
    refs.time.setText(this.formatFocusClock(snap.displaySeconds));
    const statusText = { idle: '未开始', running: '进行中', paused: '已暂停', done: '已完成' }[snap.status] || '未开始';
    refs.status.setText(statusText + (snap.status === 'running' ? ' · ' + (snap.mode === 'stopwatch' ? '正计时' : '倒计时') : ''));
    refs.progress.style.width = `${Math.round(snap.progress * 100)}%`;
    refs.start.setText(snap.status === 'paused' ? '继续' : snap.status === 'done' ? '再来一轮' : '开始');
    refs.start.disabled = snap.status === 'running';
    refs.pause.setText(snap.status === 'running' ? '暂停' : snap.status === 'paused' ? '已暂停' : '暂停');
    refs.pause.disabled = snap.status !== 'running';
    const locked = snap.status === 'running' || snap.status === 'paused';
    refs.finish.disabled = !locked;
    refs.reset.disabled = snap.status === 'idle';
    refs.modeCountdown.classList.toggle('is-active', snap.mode === 'countdown');
    refs.modeStopwatch.classList.toggle('is-active', snap.mode === 'stopwatch');
    if (refs.durationInput) refs.durationInput.disabled = locked;
    if (refs.durationButton) refs.durationButton.disabled = locked;
  }

  formatFocusClock(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  renderCheckinPanel(section) {
    const items = this.plugin.getCheckinItems();
    const records = new Set(this.plugin.getCheckinRecords());
    const today = window.moment().format('YYYY-MM-DD');
    const done = items.filter((item) => records.has(this.plugin.checkinKey(item.id, today))).length;
    const layout = section.createDiv({ cls: 'qsection-checkin-layout' });
    const main = layout.createDiv({ cls: 'qsection-checkin-main' });
    const listPanel = layout.createDiv({ cls: 'qsection-checkin-list-panel' });

    main.createDiv({ cls: 'qsection-report-muted', text: `今日 ${done}/${items.length} · 数据在 Q 截面 → 节奏 → 打卡` });

    listPanel.createDiv({ cls: 'qsection-checkin-list-title', text: '今日打卡' });
    if (!items.length) {
      listPanel.createDiv({ cls: 'qsection-report-empty', text: '还没有打卡项目。' });
    } else {
      for (const item of items) {
        const checked = records.has(this.plugin.checkinKey(item.id, today));
        const row = listPanel.createDiv({ cls: 'qsection-checkin-row' });
        const btn = row.createEl('button', {
          cls: 'qsection-checkin-toggle' + (checked ? ' is-checked' : ''),
          text: checked ? '✅' : '⬜',
          attr: { 'aria-pressed': checked ? 'true' : 'false' }
        });
        btn.addEventListener('click', () => { void this.plugin.toggleCheckin(item.id, today); });
        const mainItem = row.createDiv({ cls: 'qsection-checkin-main' });
        mainItem.createSpan({ cls: 'qsection-checkin-name', text: item.name });
        if (item.link) mainItem.createSpan({ cls: 'qsection-report-badge', text: this.plugin.linkName ? this.plugin.linkName(item.link) : item.link });
        const streak = this.plugin.checkinStreak(item.id);
        row.createSpan({ cls: 'qsection-checkin-streak', text: streak ? `连续 ${streak} 天` : '' });
        const archive = row.createEl('button', { cls: 'qsection-checkin-archive', text: '×', attr: { title: '归档（可恢复）' } });
        archive.addEventListener('click', () => { void this.plugin.archiveCheckinItem(item.id); });
      }
    }

    const form = main.createDiv({ cls: 'qsection-checkin-form' });
    const nameInput = form.createEl('input', { cls: 'qsection-checkin-input', attr: { type: 'text', placeholder: '添加打卡项目，例如：早起 / 英语 / 项目推进' } });
    const linkInput = form.createEl('input', { cls: 'qsection-checkin-input', attr: { type: 'text', placeholder: '关联项目/领域（可选）' } });
    const addBtn = form.createEl('button', { cls: 'qsection-focus-primary', text: '添加' });
    const submit = async () => {
      const name = nameInput.value.trim();
      if (!name) {
        new Notice('Q-Section: 打卡项目名称不能为空。');
        return;
      }
      const item = await this.plugin.addCheckinItem(name, linkInput.value);
      if (item) new Notice('Q-Section: 已添加打卡项目：' + item.name);
    };
    addBtn.addEventListener('click', () => { void submit(); });
    [nameInput, linkInput].forEach((input) => input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void submit();
      }
    }));

    const archived = this.plugin.getCheckinItems(true).filter((item) => item.archived);
    if (archived.length) {
      const archivedSection = listPanel.createDiv({ cls: 'qsection-checkin-archived' });
      archivedSection.createDiv({ cls: 'qsection-report-muted', text: '已归档' });
      for (const item of archived) {
        const row = archivedSection.createDiv({ cls: 'qsection-checkin-row' });
        row.createSpan({ cls: 'qsection-checkin-name', text: item.name });
        const restore = row.createEl('button', { cls: 'qsection-actions-button', text: '恢复' });
        restore.addEventListener('click', () => { void this.plugin.restoreCheckinItem(item.id); });
      }
    }
  }

  renderQuickCapturePanel(section) {
    section.createDiv({
      cls: 'qsection-report-muted',
      text: '写一条速记：存到今日日笔记或 Inbox；历史速记可直接转化、复制或删除。数据看 Q 截面 → 输入 → 收集。'
    });
    const layout = section.createDiv({ cls: 'qsection-capture-console-layout' });
    const main = layout.createDiv({ cls: 'qsection-capture-console-main' });
    const input = main.createEl('textarea', { cls: 'qsection-capture-input' });
    input.rows = 4;
    input.value = this.captureDraft;
    input.placeholder = '记一条：想法、待查、临时资料、下一步……';
    input.addEventListener('input', () => { this.captureDraft = input.value; });
    const actions = main.createDiv({ cls: 'qsection-actions-row' });
    const dailyBtn = actions.createEl('button', { cls: 'qsection-focus-primary', text: '存到今日日笔记' });
    const inboxBtn = actions.createEl('button', { cls: 'qsection-actions-button', text: '新建 Inbox 笔记' });
    const clearBtn = actions.createEl('button', { cls: 'qsection-actions-button', text: '清空' });

    const submit = async (mode) => {
      const text = input.value.trim();
      if (!text) {
        new Notice('Q-Section: 先写点内容。');
        return;
      }
      if (this.captureBusy) return;
      this.captureBusy = true;
      try {
        if (mode === 'daily') {
          await this.plugin.appendQuickCaptureToDaily(text);
          new Notice('Q-Section: 已写入今日日笔记的「快速捕捉」。');
        } else {
          await this.plugin.createInboxCapture(text);
          new Notice('Q-Section: 已创建 Inbox 速记。');
        }
        this.captureDraft = '';
        input.value = '';
        this.render();
      } catch (err) {
        new Notice('Q-Section: 速记失败：' + (err && err.message ? err.message : err));
      } finally {
        this.captureBusy = false;
      }
    };
    dailyBtn.addEventListener('click', () => { void submit('daily'); });
    inboxBtn.addEventListener('click', () => { void submit('inbox'); });
    clearBtn.addEventListener('click', () => { this.captureDraft = ''; input.value = ''; input.focus(); });
    input.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        void submit('daily');
      }
    });

    const assist = main.createDiv({ cls: 'qsection-quick-assist-inline' });
    this.renderQuickAssist(assist);

    const recent = layout.createDiv({ cls: 'qsection-capture-recent' });
    recent.createDiv({ cls: 'qsection-report-empty', text: '加载最近速记…' });
    const token = ++this.captureToken;
    void this.plugin.getQuickCaptures().then((captures) => {
      if (token !== this.captureToken) return;
      recent.empty();
      if (!captures.length) {
        recent.createDiv({ cls: 'qsection-report-empty', text: '还没有速记。' });
        return;
      }
      recent.createDiv({ cls: 'qsection-report-muted', text: '最近速记' });
      for (const capture of captures.slice(0, 8)) {
        const card = recent.createDiv({ cls: 'qsection-capture-item' });
        card.createDiv({ cls: 'qsection-capture-text', text: capture.text });
        const meta = card.createDiv({ cls: 'qsection-capture-meta' });
        meta.createSpan({ cls: 'qsection-capture-time', text: `${capture.date} ${capture.time || ''}`.trim() });
        if (capture.converted) {
          const badge = meta.createEl('button', { cls: 'qsection-capture-converted', text: '已转' + this.captureTypeLabel(capture.converted.type) });
          badge.addEventListener('click', () => { void this.app.workspace.openLinkText(capture.converted.path, '', true); });
        }
        meta.createDiv({ cls: 'qsection-capture-spacer' });
        const convert = meta.createEl('button', { cls: 'qsection-capture-link', text: '转化' });
        convert.addEventListener('click', (event) => {
          const menu = new Menu();
          menu.addItem((item) => item.setTitle('转为笔记').onClick(() => { void this.convertCapture(capture, 'note'); }));
          menu.addItem((item) => item.setTitle('转为任务').onClick(() => { void this.convertCapture(capture, 'task'); }));
          menu.addItem((item) => item.setTitle('明日任务').onClick(() => { void this.convertCapture(capture, 'task', { tomorrow: true }); }));
          menu.addItem((item) => item.setTitle('转为项目').onClick(() => { void this.convertCapture(capture, 'project'); }));
          menu.showAtMouseEvent(event);
          styleQMenu(menu, this.plugin);
        });
        const copy = meta.createEl('button', { cls: 'qsection-capture-link', text: '复制' });
        copy.addEventListener('click', () => {
          void navigator.clipboard.writeText(capture.text);
          new Notice('Q-Section: 已复制速记。');
        });
        const remove = meta.createEl('button', { cls: 'qsection-capture-link is-danger', text: '删除' });
        remove.addEventListener('click', () => {
          if (!window.confirm('删除这条速记？')) return;
          void this.deleteCapture(capture);
        });
      }
    }).catch((err) => {
      if (token !== this.captureToken) return;
      recent.empty();
      recent.createDiv({ cls: 'qsection-report-empty', text: '读取速记失败：' + (err && err.message ? err.message : err) });
    });
  }

  captureTypeLabel(type) {
    if (type === 'task') return '任务';
    if (type === 'project') return '项目';
    return '笔记';
  }

  async convertCapture(capture, type, options = {}) {
    if (this.captureBusy) return;
    this.captureBusy = true;
    try {
      const file = await this.plugin.convertQuickCapture(capture, type, options);
      const label = options.tomorrow ? '明日任务' : this.captureTypeLabel(type);
      new Notice(`Q-Section: 已转为${label}：${file.basename}`);
      this.render();
    } catch (err) {
      new Notice('Q-Section: 转化失败：' + (err && err.message ? err.message : err));
    } finally {
      this.captureBusy = false;
    }
  }

  async deleteCapture(capture) {
    if (this.captureBusy) return;
    this.captureBusy = true;
    try {
      await this.plugin.deleteQuickCapture(capture);
      new Notice('Q-Section: 已删除速记。');
      this.render();
    } catch (err) {
      new Notice('Q-Section: 删除失败：' + (err && err.message ? err.message : err));
    } finally {
      this.captureBusy = false;
    }
  }

  renderDraftPanel(section) {
    const active = this.app.workspace.getActiveFile();
    const note = active instanceof TFile && active.extension === 'md' ? active : null;
    section.createDiv({
      cls: 'qsection-report-muted',
      text: note ? '当前关联：' + note.path : '先打开一篇 Markdown 笔记，草稿会自动关联它。'
    });
    const input = section.createEl('textarea', { cls: 'qsection-capture-input qsection-draft-input' });
    input.rows = 4;
    input.value = this.draftDraft;
    input.placeholder = '先写在这里，发送后进入草稿箱；要用时直接复制。';
    input.addEventListener('input', () => { this.draftDraft = input.value; });
    const actions = section.createDiv({ cls: 'qsection-actions-row' });
    const send = actions.createEl('button', { cls: 'qsection-focus-primary', text: '发送到草稿箱' });
    send.disabled = !note;
    const submit = async () => {
      if (!note) {
        new Notice('Q-Section: 先打开一篇 Markdown 笔记。');
        return;
      }
      const text = input.value.trim();
      if (!text) {
        new Notice('Q-Section: 先写点内容。');
        return;
      }
      if (this.creationBusy) return;
      this.creationBusy = true;
      try {
        await this.plugin.addDraft(note.path, text);
        this.draftDraft = '';
        input.value = '';
        new Notice('Q-Section: 已存入草稿箱。');
        this.render();
      } catch (err) {
        new Notice('Q-Section: 保存草稿失败：' + (err && err.message ? err.message : err));
      } finally {
        this.creationBusy = false;
      }
    };
    send.addEventListener('click', () => { void submit(); });

    const drafts = this.plugin.getDrafts().slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const list = section.createDiv({ cls: 'qsection-draft-list' });
    if (!drafts.length) {
      list.createDiv({ cls: 'qsection-report-empty', text: '草稿箱是空的。' });
      return;
    }
    for (const draft of drafts) {
      const card = list.createDiv({ cls: 'qsection-draft-card' });
      const head = card.createDiv({ cls: 'qsection-draft-head' });
      const notePath = String(draft.notePath || '');
      const noteName = notePath ? notePath.split('/').pop().replace(/\.md$/, '') : '未关联笔记';
      const noteBtn = head.createEl('button', { cls: 'qsection-capture-link', text: '关联：' + noteName });
      if (notePath) noteBtn.addEventListener('click', () => { void this.app.workspace.openLinkText(notePath, '', true); });
      head.createSpan({ cls: 'qsection-report-muted', text: window.moment(draft.createdAt).format('MM-DD HH:mm') });
      card.createDiv({ cls: 'qsection-draft-text', text: draft.text });
      const meta = card.createDiv({ cls: 'qsection-capture-meta' });
      meta.createDiv({ cls: 'qsection-capture-spacer' });
      const copy = meta.createEl('button', { cls: 'qsection-capture-link', text: '复制' });
      copy.addEventListener('click', () => {
        void navigator.clipboard.writeText(draft.text);
        new Notice('Q-Section: 已复制草稿。');
      });
      const remove = meta.createEl('button', { cls: 'qsection-capture-link is-danger', text: '删除' });
      remove.addEventListener('click', () => { void this.deleteDraft(draft.id); });
    }
  }

  async deleteDraft(id) {
    await this.plugin.removeDraft(id);
    new Notice('Q-Section: 已删除草稿。');
    this.render();
  }

  async renderWritingPanel(section) {
    const active = this.app.workspace.getActiveFile();
    if (!(active instanceof TFile) || active.extension !== 'md') {
      section.createDiv({ cls: 'qsection-report-empty', text: '先打开一篇 Markdown 笔记，创作目标会自动关联当前笔记。' });
      return;
    }
    const token = ++this.writingToken;
    const project = this.plugin.getWritingProjectFor(active.path);
    const words = await this.plugin.countNoteWords(active.path);
    if (token !== this.writingToken || !section.isConnected) return;

    const target = project ? project.targetWords : 1000;
    const percent = target ? Math.min(100, Math.round((words / target) * 100)) : 0;
    section.createDiv({ cls: 'qsection-report-muted', text: '当前关联：' + active.path });
    const summary = section.createDiv({ cls: 'qsection-writing-summary' });
    summary.createSpan({ text: `当前 ${words} 字` });
    summary.createSpan({ text: `目标 ${target} 字` });
    summary.createSpan({ text: `进度 ${percent}%` });
    summary.createSpan({ text: project && project.deadline ? `截止 ${project.deadline}` : '未设截止' });
    const progress = section.createDiv({ cls: 'qsection-writing-progress' });
    const fill = progress.createDiv({ cls: 'qsection-writing-progress-fill' });
    fill.style.width = `${percent}%`;

    const form = section.createDiv({ cls: 'qsection-writing-form' });
    const targetInput = form.createEl('input', { cls: 'qsection-checkin-input', attr: { type: 'number', min: '1', placeholder: '目标字数' } });
    targetInput.value = String(target);
    const deadlineInput = form.createEl('input', { cls: 'qsection-checkin-input', attr: { type: 'date' } });
    deadlineInput.value = project && project.deadline ? project.deadline : '';
    const save = form.createEl('button', { cls: 'qsection-focus-primary', text: project ? '更新目标' : '开始' });
    save.addEventListener('click', () => { void this.saveWritingProject(active, targetInput.value, deadlineInput.value); });
    if (project) {
      const done = form.createEl('button', { cls: 'qsection-actions-button', text: '标记完成' });
      done.addEventListener('click', () => { void this.completeWritingProject(active); });
    }

    const projects = this.plugin.getWritingProjects();
    if (projects.length) {
      const list = section.createDiv({ cls: 'qsection-writing-projects' });
      list.createDiv({ cls: 'qsection-report-muted', text: '全部创作目标' });
      for (const item of projects) {
        const row = list.createDiv({ cls: 'qsection-report-row' });
        row.createSpan({ cls: 'qsection-report-row-title', text: String(item.notePath || '').split('/').pop().replace(/\.md$/, '') });
        row.createSpan({ cls: 'qsection-report-badge', text: `${item.targetWords || 0} 字` });
        row.createSpan({ cls: 'qsection-report-badge', text: item.deadline || '无截止' });
        row.createSpan({ cls: 'qsection-report-badge', text: item.status === 'done' ? '完成' : '进行中' });
        row.addEventListener('click', () => { void this.app.workspace.openLinkText(item.notePath, '', true); });
      }
    }
  }

  async saveWritingProject(file, target, deadline) {
    const value = Math.round(Number(target) || 0);
    if (value < 1) {
      new Notice('Q-Section: 目标字数要大于 0。');
      return;
    }
    await this.plugin.setWritingProject(file.path, value, deadline);
    new Notice('Q-Section: 创作目标已保存。');
    this.render();
  }

  async completeWritingProject(file) {
    await this.plugin.completeWritingProject(file.path);
    new Notice('Q-Section: 已标记完成。');
    this.render();
  }

  renderFavoritesPanel(section) {
    const favorites = this.plugin.getFavorites();
    const active = this.app.workspace.getActiveFile();
    section.createDiv({
      cls: 'qsection-report-muted',
      text: active ? '当前笔记：' + active.path : '先打开一篇 Markdown 笔记。'
    });
    const actions = section.createDiv({ cls: 'qsection-actions-row' });
    const addBtn = actions.createEl('button', { cls: 'qsection-focus-primary', text: '收藏当前笔记' });
    addBtn.addEventListener('click', () => { void this.addCurrentFavorite(); });
    const list = section.createDiv({ cls: 'qsection-favorites-list' });
    if (!favorites.length) {
      list.createDiv({ cls: 'qsection-report-empty', text: '还没有收藏。' });
      return;
    }
    for (const path of favorites) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;
      const row = list.createDiv({ cls: 'qsection-report-row' });
      row.createSpan({ cls: 'qsection-report-row-title', text: file.basename });
      row.createSpan({ cls: 'qsection-report-badge', text: file.parent?.path || '/' });
      const remove = row.createEl('button', { cls: 'qsection-favorite-remove', text: '×', attr: { title: '取消收藏' } });
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        void this.removeFavorite(path);
      });
      row.addEventListener('click', () => { void this.app.workspace.openLinkText(path, '', true); });
    }
  }

  async addCurrentFavorite() {
    if (this.favoriteBusy) return;
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== 'md') {
      new Notice('Q-Section: 当前没有打开 Markdown 笔记。');
      return;
    }
    this.favoriteBusy = true;
    try {
      const added = await this.plugin.addFavorite(file.path);
      new Notice(added ? 'Q-Section: 已收藏。' : 'Q-Section: 已经收藏过了。');
      if (added) this.render();
    } finally {
      this.favoriteBusy = false;
    }
  }

  async removeFavorite(path) {
    await this.plugin.removeFavorite(path);
    this.render();
  }

  renderRelationPanel(section) {
    section.createDiv({
      cls: 'qsection-report-muted',
      text: '先打开要建立关系的笔记；按当前对象自动写字段或正文关联。已有值不会被覆盖。'
    });
    this.buttonRow(section, [
      ['关联领域', () => this.plugin.startRelation('area')],
      ['关联项目', () => this.plugin.startRelation('project')],
      ['关联任务', () => this.plugin.startRelation('task')],
      ['关联笔记', () => this.plugin.startRelation('note')],
      ['完成当前对象', () => this.plugin.completeCurrentObject()],
      ['领域体检', () => this.plugin.showAreaHealth()]
    ]);
  }

  captureInputFocusState() {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || !this.contentEl.contains(el)) return null;
    const isDraft = el.classList.contains('qsection-draft-input');
    const isCapture = el.classList.contains('qsection-capture-input');
    if (!isDraft && !isCapture) return null;
    return {
      selector: isDraft ? '.qsection-draft-input' : '.qsection-capture-input',
      start: typeof el.selectionStart === 'number' ? el.selectionStart : null,
      end: typeof el.selectionEnd === 'number' ? el.selectionEnd : null
    };
  }

  restoreInputFocus(state) {
    if (!state) return;
    window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body && this.contentEl.contains(active)) return;
      const el = this.contentEl.querySelector(state.selector);
      if (!(el instanceof HTMLTextAreaElement)) return;
      el.focus();
      if (state.start !== null && state.end !== null) {
        try {
          el.setSelectionRange(state.start, state.end);
        } catch (err) {
          // 输入框已不在原位置时忽略。
        }
      }
    });
  }

  render() {
    const root = this.contentEl;
    const scroll = root.scrollTop;
    const focusState = this.captureInputFocusState();
    root.empty();
    root.addClass('qsection-actions');
    this.plugin.applyThemeClass(root);
    root.createEl('h2', { text: 'Q 操作台' });
    root.createEl('p', { text: '唯一操作入口：专注、打卡、速记、创作、关系、新建、路由、系统。', cls: 'qsection-actions-sub' });

    const files = this.app.vault.getMarkdownFiles().filter((f) => !f.path.startsWith('06_System/'));
    const counts = {};
    for (const f of files) {
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      const t = fm && fm.type ? String(fm.type) : '';
      if (t) counts[t] = (counts[t] || 0) + 1;
    }
    root.createEl('p', {
      text: '项目 ' + (counts.project || 0) + ' · 领域 ' + (counts.area || 0) + ' · 内容 ' + (counts.content || 0) + ' · 任务 ' + (counts.task || 0),
      cls: 'qsection-actions-stats'
    });

    this.renderCurrentPagePanel(this.section('当前页'));
    this.renderFocusPanel(this.section('专注（番茄钟）'));
    this.renderCheckinPanel(this.section('打卡（项目）'));

    const quickSection = this.section('速记');
    this.renderQuickCapturePanel(quickSection);

    this.renderRelationPanel(this.section('关系与推进'));

    const newSection = this.section('新建');
    this.buttonRow(newSection, [
      ['项目', () => this.plugin.createFromTemplate('project')],
      ['领域', () => this.plugin.createFromTemplate('area')],
      ['资源', () => this.plugin.createFromTemplate('resource')],
      ['内容', () => this.plugin.createFromTemplate('content')],
      ['任务', () => this.plugin.createFromTemplate('task')],
      ['日志-日', () => this.plugin.createFromTemplate('journal-daily')],
      ['日志-周', () => this.plugin.createFromTemplate('journal-weekly')],
      ['日志-月', () => this.plugin.createFromTemplate('journal-monthly')],
      ['日志-季', () => this.plugin.createFromTemplate('journal-quarterly')],
      ['日志-年', () => this.plugin.createFromTemplate('journal-yearly')],
      ['笔记', () => this.plugin.createFromTemplate('note')]
    ]);

    const baseSection = this.section('打开总览');
    this.buttonRow(baseSection, [
      ['项目', () => this.plugin.openBase('项目总览')],
      ['领域', () => this.plugin.openBase('领域总览')],
      ['学习', () => this.plugin.openBase('学习总览')],
      ['文化', () => this.plugin.openBase('文化总览')],
      ['资源', () => this.plugin.openBase('资源总览')],
      ['内容', () => this.plugin.openBase('内容总览')],
      ['任务', () => this.plugin.openBase('任务总览')],
      ['日志', () => this.plugin.openBase('日志总览')]
    ]);

    const routeSection = this.section('路由');
    this.buttonRow(routeSection, [
      ['预览路由', () => this.plugin.previewRouting()],
      ['路由当前文件', () => this.plugin.routeCurrentFile()],
      ['路由全库', () => this.plugin.routeAllFiles()],
      ['路由健康', () => this.plugin.showRouteHealth()]
    ]);

    const reportSection = this.section('Q 截面');
    this.buttonRow(reportSection, [
      ['打开 Q 截面', () => this.plugin.openQReport()],
      ['专注数据', () => this.plugin.openFocusTab()],
      ['打卡数据', () => this.plugin.openCheckinTab()]
    ]);

    const insertSection = this.section('插入关联 Base');
    this.buttonRow(insertSection, [
      ['当前项目的任务', () => this.plugin.insertProjectTaskBase()],
      ['当前项目的内容', () => this.plugin.insertProjectContentBase()]
    ]);

    const systemSection = this.section('系统');
    this.buttonRow(systemSection, [
      ['重载路由规则', () => this.plugin.reloadRules()],
      ['README', () => { void this.app.workspace.openLinkText('06_System/README.md', '', true); }],
      ['文件地图', () => { void this.app.workspace.openLinkText('06_System/Q 文件地图.md', '', true); }],
      ['路由规则', () => { void this.app.workspace.openLinkText('06_System/router-rules.json', '', true); }]
    ]);
    this.paintSegments();
    root.scrollTop = scroll;
    this.restoreInputFocus(focusState);
  }

  paintSegments() {
    if (!this.plugin.settings.glassTheme) return;
    this.segmentStore = this.segmentStore || new Map();
    if (this.segmentFrame) cancelAnimationFrame(this.segmentFrame);
    this.segmentFrame = requestAnimationFrame(() => {
      this.segmentFrame = null;
      paintSegmentPills(this.contentEl, this.segmentStore);
    });
  }
}

class QSectionFocusWindowView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.focusWindowRefs = null;
  }

  getViewType() { return 'qsection-focus-window'; }
  getDisplayText() { return 'Q 专注'; }
  getIcon() { return 'timer'; }

  async onOpen() {
    this.contentEl.addClass('qsection-focus-mini', 'qsection-focus-popout');
    this.plugin.applyThemeClass(this.contentEl);

    const head = this.contentEl.createDiv({ cls: 'qsection-focus-mini-head qsection-focus-popout-head' });
    const title = head.createSpan({ cls: 'qsection-focus-mini-title', text: '专注' });
    const pin = head.createEl('button', {
      cls: 'qsection-focus-mini-close qsection-focus-popout-pin',
      text: '置顶',
      attr: { type: 'button', title: '窗口置顶' }
    });
    const time = this.contentEl.createDiv({ cls: 'qsection-focus-mini-time', text: '25:00' });
    const status = this.contentEl.createDiv({ cls: 'qsection-focus-mini-status', text: '未开始' });
    const progress = this.contentEl.createDiv({ cls: 'qsection-focus-mini-progress' });
    const progressFill = progress.createDiv({ cls: 'qsection-focus-mini-progress-fill' });
    const actions = this.contentEl.createDiv({ cls: 'qsection-focus-mini-actions' });
    const toggle = actions.createEl('button', { text: '开始', attr: { type: 'button' } });
    const finish = actions.createEl('button', { text: '结束', attr: { type: 'button' } });
    const consoleBtn = actions.createEl('button', { text: '操作台', attr: { type: 'button' } });

    this.focusWindowRefs = { title, pin, time, status, progressFill, toggle, finish };

    pin.addEventListener('click', () => this.togglePin());
    toggle.addEventListener('click', () => {
      if (this.plugin.focusStatus === 'running') this.plugin.pauseFocusTimer();
      else this.plugin.startFocusTimer();
    });
    finish.addEventListener('click', () => { void this.plugin.finishFocusTimer(false); });
    consoleBtn.addEventListener('click', () => { void this.plugin.activateActionsView(); });

    this.registerEvent(this.app.workspace.on('qsection:focus-changed', () => this.update()));
    this.registerEvent(this.app.workspace.on('qsection:theme-changed', () => {
      this.plugin.applyThemeClass(this.contentEl);
      this.update();
    }));
    this.registerInterval(window.setInterval(() => this.update(), 1000));
    this.update();
    window.setTimeout(() => this.applyWindowLayout(), 0);
  }

  async onClose() {
    this.focusWindowRefs = null;
    this.contentEl.empty();
  }

  focusWindow() {
    return this.contentEl.win || (this.contentEl.ownerDocument && this.contentEl.ownerDocument.defaultView) || null;
  }

  applyWindowLayout() {
    if (!this.focusWindowRefs) return;
    const win = this.focusWindow();
    const electronWindow = win && win.electronWindow;
    if (!electronWindow) return;
    try {
      if (typeof electronWindow.setContentSize === 'function') {
        electronWindow.setContentSize(240, 240);
      } else if (typeof electronWindow.setSize === 'function') {
        electronWindow.setSize(240, 240);
      }
    } catch (err) {}
    this.setPinned(true);
    window.setTimeout(() => this.positionTopRight(), 120);
  }

  positionTopRight() {
    if (!this.focusWindowRefs) return;
    const win = this.focusWindow();
    const electronWindow = win && win.electronWindow;
    if (!electronWindow) return;
    const screenInfo = win.screen || {};
    const availLeft = Number.isFinite(screenInfo.availLeft) ? screenInfo.availLeft : 0;
    const availTop = Number.isFinite(screenInfo.availTop) ? screenInfo.availTop : 0;
    const availWidth = Number.isFinite(screenInfo.availWidth) ? screenInfo.availWidth : (win.innerWidth || 0);
    const margin = 8;
    const width = (Number.isFinite(win.outerWidth) && win.outerWidth > 0 && win.outerWidth < 500) ? win.outerWidth : 254;
    const x = Math.round(availLeft + availWidth - width - margin);
    const y = Math.round(availTop + margin);
    try {
      if (typeof electronWindow.setPosition === 'function') {
        electronWindow.setPosition(x, y);
      } else if (typeof electronWindow.setBounds === 'function') {
        const bounds = electronWindow.getBounds();
        electronWindow.setBounds({ x, y, width: bounds.width, height: bounds.height });
      }
    } catch (err) {}
  }

  setPinned(pinned) {
    const win = this.focusWindow();
    const electronWindow = win && win.electronWindow;
    if (!electronWindow || typeof electronWindow.setAlwaysOnTop !== 'function') return false;
    try {
      if (typeof electronWindow.isMaximized === 'function' && electronWindow.isMaximized()) return false;
      electronWindow.setAlwaysOnTop(!!pinned);
      this.updatePinButton();
      return true;
    } catch (err) {
      return false;
    }
  }

  togglePin() {
    const win = this.focusWindow();
    const electronWindow = win && win.electronWindow;
    if (!electronWindow || typeof electronWindow.setAlwaysOnTop !== 'function') {
      new Notice('Q-Section: 当前环境不支持窗口置顶，可用 PowerToys Always On Top。');
      return;
    }
    if (typeof electronWindow.isMaximized === 'function' && electronWindow.isMaximized()) {
      new Notice('Q-Section: 窗口最大化时不能置顶，请先还原窗口。');
      return;
    }
    const pinned = typeof electronWindow.isAlwaysOnTop === 'function' && electronWindow.isAlwaysOnTop();
    if (!this.setPinned(!pinned)) {
      new Notice('Q-Section: 置顶失败，可用 PowerToys Always On Top。');
    }
  }

  update() {
    if (!this.focusWindowRefs) return;
    const refs = this.focusWindowRefs;
    const snap = this.plugin.getFocusSnapshot();
    refs.title.textContent = snap.name || '专注';
    refs.time.textContent = this.plugin.formatFocusClock(snap.displaySeconds);
    const statusText = { idle: '未开始', running: '进行中', paused: '已暂停', done: '已完成' }[snap.status] || '未开始';
    refs.status.textContent = statusText + ' · ' + (snap.mode === 'stopwatch' ? '正计时' : '倒计时');
    refs.progressFill.style.width = Math.round(snap.progress * 100) + '%';
    refs.toggle.textContent = snap.status === 'running' ? '暂停' : snap.status === 'paused' ? '继续' : snap.status === 'done' ? '再来一轮' : '开始';
    refs.finish.disabled = !(snap.status === 'running' || snap.status === 'paused');
    this.updatePinButton();
  }

  updatePinButton() {
    const refs = this.focusWindowRefs;
    if (!refs || !refs.pin) return;
    const win = this.focusWindow();
    const electronWindow = win && win.electronWindow;
    if (!electronWindow || typeof electronWindow.setAlwaysOnTop !== 'function') {
      refs.pin.style.display = 'none';
      return;
    }
    refs.pin.style.display = '';
    let pinned = false;
    try {
      pinned = typeof electronWindow.isAlwaysOnTop === 'function' && electronWindow.isAlwaysOnTop();
    } catch (err) {
      pinned = false;
    }
    refs.pin.textContent = pinned ? '取消置顶' : '置顶';
  }
}

class QSectionReportView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.refreshTimer = null;
    this.activeTab = 'section';
    this.subTabs = { section: 'overview', push: 'actions', output: 'content', input: 'reading', rhythm: 'focus' };
    this.rangeDays = 30;
    this.scanToken = 0;
    this.checkinMonth = window.moment().startOf('month');
    this.checkinBusy = false;
    this.captureBusy = false;
    this.favoriteBusy = false;
    this.captureMonth = window.moment().startOf('month');
    this.captureFilterDate = '';
    this.randomCaptureId = '';
    this.captureToken = 0;
    this.creationMode = 'drafts';
    this.writingToken = 0;
    this.creationBusy = false;
  }

  getViewType() { return 'qsection-report'; }
  getDisplayText() { return 'Q 截面'; }
  getIcon() { return 'bar-chart-3'; }

  async onOpen() {
    this.render();
    this.segmentResizeObserver = new ResizeObserver(() => {
      this.paintSegments();
      this.repaintSelectedRow();
    });
    this.segmentResizeObserver.observe(this.contentEl);
    this.registerDomEvent(this.contentEl, 'click', (evt) => this.selectReportRow(evt));
    this.registerDomEvent(this.contentEl, 'mouseover', (evt) => this.hoverReportRow(evt));
    const refresh = () => this.scheduleRender();
    this.registerEvent(this.app.metadataCache.on('changed', refresh));
    this.registerEvent(this.app.vault.on('create', refresh));
    this.registerEvent(this.app.vault.on('delete', refresh));
    this.registerEvent(this.app.vault.on('rename', refresh));
    this.registerEvent(this.app.workspace.on('qsection:checkin-changed', () => {
      if (this.activeTab === 'rhythm' && this.subTabs.rhythm === 'checkin') this.scheduleRender();
    }));
    this.registerEvent(this.app.workspace.on('qsection:theme-changed', () => {
      this.plugin.applyThemeClass(this.contentEl);
      this.paintSegments();
    }));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
      if (this.activeTab === 'output' || this.activeTab === 'section') this.scheduleRender();
    }));
  }

  async onClose() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    if (this.segmentFrame) cancelAnimationFrame(this.segmentFrame);
    this.segmentFrame = null;
    if (this.segmentResizeObserver) this.segmentResizeObserver.disconnect();
    this.segmentResizeObserver = null;
    this.contentEl.empty();
  }

  scheduleRender() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.render(), 500);
  }

  isActive(module, sub) {
    return this.activeTab === module && this.subTabs[module] === sub;
  }

  typeOf(item) {
    const v = item.fm.type;
    return Array.isArray(v) ? String(v[0] || '').toLowerCase() : String(v || '').toLowerCase();
  }

  val(item, key) {
    const v = item.fm[key];
    return Array.isArray(v) ? String(v[0] || '') : String(v || '');
  }

  linkName(raw) {
    const text = String(raw || '');
    const m = text.match(/\[\[([^\]|]+)/);
    const name = m ? m[1] : text;
    return name.split('/').pop().replace(/\.md$/i, '');
  }

  label(value) {
    const map = {
      todo: '待办', doing: '进行中', done: '完成',
      active: '进行中', paused: '暂停',
      idea: '选题', draft: '脚本', asset: '素材',
      published: '已发布', review: '复盘', archived: '归档',
      xiaohongshu: '小红书', bilibili: 'B站', wechat: '公众号',
      github: 'GitHub', obsidian: 'Obsidian',
      math: '数学', english: '英语', culture: '文化',
      ai: 'AI', trade: '交易', other: '其他'
    };
    return map[value] || value;
  }

  toDay(value) {
    if (!value) return '';
    if (value instanceof Date) return window.moment(value).format('YYYY-MM-DD');
    const raw = String(value).trim();
    const m = raw.match(/\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
    const d = window.moment(raw, ['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY年M月D日'], true);
    return d.isValid() ? d.format('YYYY-MM-DD') : '';
  }

  journalDay(item) {
    const fromField = this.toDay(this.val(item, 'date'));
    if (fromField) return fromField;
    const m = item.file.basename.match(/\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : '';
  }

  collect() {
    const all = this.app.vault.getMarkdownFiles()
      .map((file) => ({ file, fm: this.app.metadataCache.getFileCache(file)?.frontmatter || {} }))
      .filter((item) => !item.file.path.startsWith('06_System/'));

    const tasks = all.filter((x) => this.typeOf(x) === 'task');
    const todo = tasks.filter((x) => this.val(x, 'status') === 'todo');
    const doing = tasks.filter((x) => this.val(x, 'status') === 'doing');
    const done = tasks.filter((x) => this.val(x, 'status') === 'done');

    const projects = all.filter((x) => this.typeOf(x) === 'project');
    const activeProjects = projects.filter((x) => this.val(x, 'status') === 'active');
    const areas = all.filter((x) => this.typeOf(x) === 'area');

    const contents = all.filter((x) => this.typeOf(x) === 'content');
    const published = contents.filter((x) => this.val(x, 'content_stage') === 'published');
    const review = contents.filter((x) => this.val(x, 'content_stage') === 'review');

    const learning = all.filter((x) => this.typeOf(x) === 'note' && ['math', 'english'].includes(this.val(x, 'topic')));
    const pendingReview = learning.filter((x) => this.val(x, 'review_status') !== '已复习');

    const culture = all.filter((x) => this.val(x, 'topic') === 'culture');
    const podcasts = culture.filter((x) => this.typeOf(x) === 'resource' && this.val(x, 'note_kind') === '播客');
    const books = culture.filter((x) => this.typeOf(x) === 'resource' && this.val(x, 'note_kind') === '书籍');

    const journals = all.filter((x) => this.typeOf(x) === 'journal' && x.file.path.startsWith('07_Journal/'));
    const daily = journals.filter((x) => this.val(x, 'period') === 'daily');

    const allFiles = this.app.vault.getFiles();
    const epubs = allFiles.filter((f) => f.path.startsWith('09_Sources/书籍/') && f.extension === 'epub').length;
    const srt = allFiles.filter((f) => f.extension === 'srt').length;

    return {
      all, tasks, todo, doing, done, projects, activeProjects, areas,
      contents, published, review, learning, pendingReview,
      culture, podcasts, books, journals, daily, allFiles, epubs, srt
    };
  }

  render() {
    const root = this.contentEl;
    const scroll = root.scrollTop;
    root.empty();
    root.addClass('qsection-report');
    this.plugin.applyThemeClass(root);

    const data = this.collect();
    this.renderHeader(root, data);
    const body = root.createDiv({ cls: 'qsection-report-body' });
    const module = this.activeTab;
    const sub = this.subTabs[module] || '';

    if (module === 'section') {
      if (sub === 'favorites') this.renderFavorites(body, data);
      else this.renderOverview(body, data);
    } else if (module === 'push') {
      if (sub === 'areas') this.renderAreas(body, data);
      else this.renderActions(body, data);
    } else if (module === 'output') {
      if (sub === 'drafts') this.renderDrafts(body, data);
      else if (sub === 'writing') this.renderWriting(body, data);
      else this.renderContent(body, data);
    } else if (module === 'input') {
      if (sub === 'capture') this.renderCapture(body, data);
      else this.renderReading(body, data);
    } else if (module === 'rhythm') {
      if (sub === 'checkin') this.renderCheckin(body, data);
      else this.renderFocus(body, data);
    } else {
      this.renderSystem(body, data);
    }

    root.scrollTop = scroll;
    this.paintSegments();
    this.restoreSelectedRow();
  }

  paintSegments() {
    if (!this.plugin.settings.glassTheme) return;
    this.segmentStore = this.segmentStore || new Map();
    if (this.segmentFrame) cancelAnimationFrame(this.segmentFrame);
    this.segmentFrame = requestAnimationFrame(() => {
      this.segmentFrame = null;
      paintSegmentPills(this.contentEl, this.segmentStore);
    });
  }

  selectReportRow(evt) {
    if (!this.plugin.settings.glassTheme) return;
    if (!evt || !evt.target) return;
    if (evt.target.closest('button, a, input, textarea')) return;
    const row = evt.target.closest('.qsection-report-row');
    if (!row || !this.contentEl.contains(row)) return;
    const parent = row.parentElement;
    if (!parent) return;
    this.selectedRowPath = row.getAttribute('title') || '';
    const rows = Array.from(parent.querySelectorAll(':scope > .qsection-report-row'));
    rows.forEach((item) => item.classList.toggle('is-selected', item === row));
    this.paintRowPill(parent, row);
  }

  hoverReportRow(evt) {
    if (!this.plugin.settings.glassTheme) return;
    if (!evt || !evt.target) return;
    if (evt.target.closest('button, a, input, textarea')) return;
    const row = evt.target.closest('.qsection-report-row');
    if (!row || !this.contentEl.contains(row)) return;
    if (row.classList.contains('is-selected')) return;
    this.selectReportRow(evt);
  }

  restoreSelectedRow() {
    if (!this.plugin.settings.glassTheme) return;
    if (!this.selectedRowPath) return;
    const rows = Array.from(this.contentEl.querySelectorAll('.qsection-report-row'));
    const row = rows.find((item) => (item.getAttribute('title') || '') === this.selectedRowPath);
    if (!row) { this.selectedRowPath = ''; return; }
    row.classList.add('is-selected');
    if (row.parentElement) this.paintRowPill(row.parentElement, row);
  }

  repaintSelectedRow() {
    if (!this.plugin.settings.glassTheme) return;
    if (!this.contentEl) return;
    this.contentEl.querySelectorAll('.qsection-report-row.is-selected').forEach((row) => {
      if (row.parentElement) this.paintRowPill(row.parentElement, row);
    });
  }

  paintRowPill(parent, row) {
    this.rowPillStore = this.rowPillStore || new WeakMap();
    parent.classList.add('qsection-row-group');
    let pill = parent.querySelector(':scope > .qsection-row-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'qsection-row-pill';
      parent.appendChild(pill);
    }
    const rect = {
      left: row.offsetLeft,
      top: row.offsetTop,
      width: row.offsetWidth,
      height: row.offsetHeight
    };
    const prev = this.rowPillStore.get(parent);
    pill.style.width = rect.width + 'px';
    pill.style.height = rect.height + 'px';
    if (prev) {
      pill.classList.remove('is-moving');
      pill.style.transition = 'none';
      pill.style.left = prev.left + 'px';
      pill.style.top = prev.top + 'px';
      pill.style.width = prev.width + 'px';
      pill.style.height = prev.height + 'px';
      void pill.offsetWidth;
      const direction = rect.top >= prev.top ? 1 : -1;
      pill.style.transformOrigin = direction > 0 ? 'center top' : 'center bottom';
      pill.style.transition = '';
      pill.classList.add('is-moving');
      requestAnimationFrame(() => {
        pill.style.left = rect.left + 'px';
        pill.style.top = rect.top + 'px';
        pill.style.width = rect.width + 'px';
        pill.style.height = rect.height + 'px';
        window.setTimeout(() => {
          pill.classList.remove('is-moving');
          pill.style.transformOrigin = 'center';
        }, 320);
      });
    } else {
      pill.style.left = rect.left + 'px';
      pill.style.top = rect.top + 'px';
    }
    this.rowPillStore.set(parent, rect);
  }

  renderHeader(root, data) {
    const modules = [
      ['section', '截面'], ['push', '推进'], ['output', '产出'],
      ['input', '输入'], ['rhythm', '节奏'], ['system', '系统']
    ];
    const subTabsMap = {
      section: [['overview', '总览'], ['favorites', '锚点']],
      push: [['actions', '行动'], ['areas', '领域']],
      output: [['content', '内容'], ['drafts', '草稿'], ['writing', '写作']],
      input: [['reading', '阅读'], ['capture', '收集']],
      rhythm: [['focus', '专注'], ['checkin', '打卡']]
    };
    const moduleLabels = { section: '截面', push: '推进', output: '产出', input: '输入', rhythm: '节奏', system: '系统' };

    const header = root.createDiv({ cls: 'qsection-report-header' });
    const heading = header.createDiv({ cls: 'qsection-report-heading' });
    heading.createEl('h2', { cls: 'qsection-report-title', text: 'Q 截面' });
    heading.createDiv({ cls: 'qsection-report-sub', text: 'Q-Section · 只读数据 · ' + (moduleLabels[this.activeTab] || '截面') });

    const meta = header.createDiv({ cls: 'qsection-report-meta' });
    meta.createSpan({ text: '更新 ' + window.moment().format('HH:mm') });
    const refreshBtn = meta.createEl('button', { cls: 'qsection-report-button', text: '刷新' });
    refreshBtn.addEventListener('click', () => this.render());

    const tabs = root.createDiv({ cls: 'qsection-report-tabs' });
    const counts = {
      push: data.todo.length + data.doing.length,
      output: data.contents.length,
      input: data.culture.length,
      rhythm: this.plugin.getCheckinItems().length
    };
    modules.forEach(([key, label]) => {
      const btn = tabs.createEl('button', { cls: 'qsection-report-tab' + (this.activeTab === key ? ' is-active' : ''), text: label });
      if (counts[key]) btn.createSpan({ cls: 'qsection-report-tab-count', text: String(counts[key]) });
      btn.addEventListener('click', () => {
        this.activeTab = key;
        this.contentEl.scrollTop = 0;
        this.render();
      });
    });

    const subs = subTabsMap[this.activeTab];
    if (subs && subs.length > 1) {
      const subRow = root.createDiv({ cls: 'qsection-subtabs' });
      const current = this.subTabs[this.activeTab] || subs[0][0];
      subs.forEach(([key, label]) => {
        const btn = subRow.createEl('button', {
          cls: 'qsection-subtab' + (current === key ? ' is-active' : ''),
          text: label
        });
        btn.addEventListener('click', () => {
          this.subTabs[this.activeTab] = key;
          this.contentEl.scrollTop = 0;
          this.render();
        });
      });
    }
  }

  rangeStats(data) {
    const today = window.moment().startOf('day');
    const start = today.clone().subtract(this.rangeDays - 1, 'days');
    const inRange = (raw) => {
      const day = this.toDay(raw);
      if (!day) return false;
      const m = window.moment(day, 'YYYY-MM-DD', true);
      return m.isValid() && m.isSameOrAfter(start) && m.isSameOrBefore(today);
    };
    const daily = data.daily.filter((x) => inRange(this.journalDay(x)));
    const published = data.contents.filter((x) => inRange(this.val(x, '发布日期') || this.val(x, 'date')));
    const started = data.projects.filter((x) => inRange(this.val(x, '开始')));
    return { daily: daily.length, published: published.length, started: started.length };
  }

  renderOverview(body, data) {
    const { todo, doing, done, activeProjects, contents, published, review, learning, pendingReview, culture, podcasts, books, daily } = data;
    const inRange = this.rangeStats(data);

    const kpis = body.createDiv({ cls: 'qsection-report-kpis' });
    this.kpi(kpis, '任务', String(todo.length + doing.length), `${todo.length} 待办 · ${doing.length} 进行中 · ${done.length} 完成`);
    this.kpi(kpis, '项目', String(activeProjects.length), '进行中');
    this.kpi(kpis, '内容', String(contents.length), `${published.length} 已发布 · ${review.length} 待复盘`);
    this.kpi(kpis, '学习', String(learning.length), `${pendingReview.length} 待复习`);
    this.kpi(kpis, '文化', String(culture.length), `${podcasts.length} 播客 · ${books.length} 书籍`);
    this.kpi(kpis, '日笔记', String(daily.length), `近 ${this.rangeDays} 天 ${inRange.daily} 篇`);
    this.kpi(kpis, '源文件', String(data.epubs), `${data.srt} 字幕 · ${data.epubs} EPUB`);

    body.createDiv({
      cls: 'qsection-report-note',
      text: `近 ${this.rangeDays} 天：日笔记 ${inRange.daily} 篇 · 内容发布 ${inRange.published} 条 · 项目启动 ${inRange.started} 个`
    });

    const taskSection = this.section(body, '任务');
    const openTasks = this.sortTasks(doing).concat(this.sortTasks(todo));
    this.rows(taskSection, openTasks.slice(0, 8), (x) => [
      this.label(this.val(x, 'status')),
      this.shortProject(x)
    ]);

    const projectSection = this.section(body, '项目');
    this.rows(projectSection, activeProjects.slice(0, 8), (x) => [this.linkName(this.val(x, 'area'))]);

    const contentSection = this.section(body, '内容');
    this.rows(contentSection, contents.slice(0, 8), (x) => [this.label(this.val(x, 'content_stage')), this.label(this.val(x, 'platform'))]);

    const learningSection = this.section(body, '学习');
    this.rows(learningSection, pendingReview.slice(0, 8), (x) => [this.label(this.val(x, 'topic')), this.val(x, 'review_status')]);

    const cultureSection = this.section(body, '文化');
    this.rows(cultureSection, culture.slice(0, 8), (x) => [this.val(x, 'note_kind')]);

    const today = window.moment().startOf('day');
    const recentDaily = daily
      .filter((x) => {
        const m = window.moment(this.journalDay(x), 'YYYY-MM-DD', true);
        return m.isValid() && m.isSameOrBefore(today);
      })
      .sort((a, b) => this.journalDay(b).localeCompare(this.journalDay(a)))
      .slice(0, 5);
    this.rows(this.section(body, '日笔记'), recentDaily, () => []);

    body.createDiv({
      cls: 'qsection-report-note',
      text: '这里是只读数据视图；新建、速记、创作、关系、路由等操作都在 Q 操作台。'
    });
  }

  async renderActions(body, data) {
    const { todo, doing, done, tasks } = data;
    const overdue = tasks.filter((x) => ['todo', 'doing'].includes(this.val(x, 'status')) && this.isOverdue(x));

    const kpis = body.createDiv({ cls: 'qsection-report-kpis' });
    this.kpi(kpis, '进行中', String(doing.length), '当前推进');
    this.kpi(kpis, '待办', String(todo.length), '未开始');
    this.kpi(kpis, '逾期', String(overdue.length), '按「截止」判断');
    const checkboxCard = this.kpi(kpis, '复选框', '…', '扫描中');

    this.rows(this.section(body, '进行中'), this.sortTasks(doing).slice(0, 10), (x) => this.taskMeta(x));
    this.rows(this.section(body, '待办'), this.sortTasks(todo).slice(0, 15), (x) => this.taskMeta(x));
    const recentDone = done.slice().sort((a, b) => b.file.stat.mtime - a.file.stat.mtime).slice(0, 5);
    this.rows(this.section(body, '最近完成'), recentDone, (x) => this.taskMeta(x));

    const section = this.section(body, 'Checkbox 汇总');
    section.createDiv({ cls: 'qsection-report-muted', text: '全库未完成复选框' });
    const box = section.createDiv({ cls: 'qsection-report-checkboxes' });
    box.createDiv({ cls: 'qsection-report-empty', text: '扫描中…' });

    const token = ++this.scanToken;
    let result;
    try {
      result = await this.scanCheckboxes();
    } catch (err) {
      if (token === this.scanToken && this.isActive('push', 'actions')) {
        box.empty();
        box.createDiv({ cls: 'qsection-report-empty', text: '扫描失败：' + String(err && err.message ? err.message : err) });
      }
      return;
    }
    if (token !== this.scanToken || !this.isActive('push', 'actions')) return;

    const valueEl = checkboxCard.querySelector('.qsection-report-kpi-value');
    if (valueEl) valueEl.setText(String(result.unchecked));
    const subEl = checkboxCard.querySelector('.qsection-report-kpi-sub');
    if (subEl) subEl.setText(`${result.checked} 已完成 · ${result.files.length} 个文件`);

    box.empty();
    if (!result.files.length) {
      box.createDiv({ cls: 'qsection-report-empty', text: '没有未完成复选框' });
      return;
    }
    box.createDiv({ cls: 'qsection-report-note', text: `全库 ${result.unchecked} 个未完成 · ${result.checked} 个已完成` });
    const list = box.createDiv({ cls: 'qsection-report-checkbox-list' });
    for (const item of result.files.slice(0, 12)) {
      const row = list.createDiv({ cls: 'qsection-report-row' });
      row.createSpan({ cls: 'qsection-report-row-title', text: item.file.basename });
      row.createSpan({ cls: 'qsection-report-badge is-warning', text: `${item.unchecked} 未完成` });
      if (item.checked) row.createSpan({ cls: 'qsection-report-badge', text: `${item.checked} 完成` });
      row.addEventListener('click', () => { void this.app.workspace.openLinkText(item.file.path, '', true); });
      if (item.items.length) {
        const sub = list.createDiv({ cls: 'qsection-report-checkbox-items' });
        item.items.forEach((text) => sub.createDiv({ cls: 'qsection-report-checkbox-item', text: '• ' + text }));
      }
    }
    if (result.files.length > 12) {
      box.createDiv({ cls: 'qsection-report-empty', text: `还有 ${result.files.length - 12} 个文件有未完成复选框` });
    }
  }

  isOverdue(item) {
    if (this.val(item, 'status') === 'done') return false;
    const due = this.toDay(this.val(item, '截止'));
    if (!due) return false;
    return window.moment(due, 'YYYY-MM-DD', true).isBefore(window.moment().startOf('day'));
  }

  sortTasks(items) {
    return items.slice().sort((a, b) => {
      const da = this.toDay(this.val(a, '截止')) || '9999-12-31';
      const db = this.toDay(this.val(b, '截止')) || '9999-12-31';
      return da.localeCompare(db) || a.file.basename.localeCompare(b.file.basename);
    });
  }

  taskMeta(item) {
    const meta = [this.label(this.val(item, 'status'))];
    const due = this.toDay(this.val(item, '截止'));
    if (due) meta.push({ text: due, tone: this.isOverdue(item) ? 'warning' : '' });
    if (this.isOverdue(item)) meta.push({ text: '逾期', tone: 'warning' });
    const project = this.shortProject(item);
    if (project) meta.push(project);
    return meta;
  }

  async scanCheckboxes() {
    const files = this.app.vault.getMarkdownFiles().filter((f) => !this.isScanExcluded(f.path));
    let unchecked = 0;
    let checked = 0;
    const out = [];
    for (const file of files) {
      let text = '';
      try {
        text = await this.app.vault.cachedRead(file);
      } catch (err) {
        continue;
      }
      let u = 0;
      let c = 0;
      const items = [];
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/);
        if (!m) continue;
        if (m[1] === ' ') {
          u++;
          if (items.length < 3) items.push(m[2].trim());
        } else {
          c++;
        }
      }
      if (u || c) {
        unchecked += u;
        checked += c;
        if (u) out.push({ file, unchecked: u, checked: c, items });
      }
    }
    out.sort((a, b) => b.unchecked - a.unchecked || a.file.path.localeCompare(b.file.path));
    return { files: out, unchecked, checked };
  }

  isScanExcluded(path) {
    return ['06_System/', 'copilot/', '.trash/', '09_Sources/', '07_Journal/', '00_Inbox/WorkBuddy/', 'UNreader/', 'UNagent/', '.obsidian/']
      .some((prefix) => path.startsWith(prefix));
  }

  renderCalendar(body, data) {
    const today = window.moment().startOf('day');
    const start = today.clone().subtract(this.rangeDays - 1, 'days');
    const gridStart = start.clone().startOf('isoWeek');

    const counts = new Map();
    for (const item of data.daily) {
      const day = this.journalDay(item);
      if (day) counts.set(day, (counts.get(day) || 0) + 1);
    }

    const cells = [];
    const cursor = gridStart.clone();
    while (cursor.isSameOrBefore(today, 'day')) {
      const date = cursor.format('YYYY-MM-DD');
      const inWindow = cursor.isSameOrAfter(start, 'day');
      cells.push({ date, count: inWindow ? (counts.get(date) || 0) : null });
      cursor.add(1, 'day');
    }

    const inRange = data.daily.filter((x) => {
      const m = window.moment(this.journalDay(x), 'YYYY-MM-DD', true);
      return m.isValid() && m.isSameOrAfter(start, 'day') && m.isSameOrBefore(today, 'day');
    });
    const future = data.daily.filter((x) => {
      const m = window.moment(this.journalDay(x), 'YYYY-MM-DD', true);
      return m.isValid() && m.isAfter(today, 'day');
    });
    const daySet = new Set(inRange.map((x) => this.journalDay(x)));
    const coverage = Math.min(100, Math.round((daySet.size / this.rangeDays) * 100));
    const latest = data.daily
      .filter((x) => {
        const m = window.moment(this.journalDay(x), 'YYYY-MM-DD', true);
        return m.isValid() && m.isSameOrBefore(today, 'day');
      })
      .sort((a, b) => this.journalDay(b).localeCompare(this.journalDay(a)))[0];

    const kpis = body.createDiv({ cls: 'qsection-report-kpis' });
    this.kpi(kpis, '有记录', String(daySet.size), `近 ${this.rangeDays} 天 · 共 ${inRange.length} 篇`);
    this.kpi(kpis, '覆盖率', `${coverage}%`, `${this.rangeDays} 天中有记录`);
    this.kpi(kpis, '最近记录', latest ? this.journalDay(latest) : '—', latest ? latest.file.basename : '暂无');

    if (future.length) {
      body.createDiv({
        cls: 'qsection-report-note is-warning',
        text: `另有 ${future.length} 篇日笔记日期在未来，未计入热力图`
      });
    }

    const section = this.section(body, '日笔记热力图');
    section.createDiv({ cls: 'qsection-report-note', text: '每格 = 一天；颜色越深 = 当天日笔记越多；没有日笔记的格子为空；未来日期不画。' });
    const wrap = section.createDiv({ cls: 'qsection-report-heatmap-wrap' });
    const heatmap = wrap.createDiv({ cls: 'qsection-report-heatmap' });
    heatmap.style.gridTemplateRows = 'repeat(7, 12px)';
    for (const cell of cells) {
      const el = heatmap.createDiv({ cls: 'qsection-report-heatcell' });
      if (cell.count === null) {
        el.addClass('is-out');
      } else {
        const level = Math.min(4, cell.count);
        if (level > 0) el.addClass(`is-level-${level}`);
        el.setAttribute('title', `${cell.date} · ${cell.count} 篇`);
      }
    }
    const legend = wrap.createDiv({ cls: 'qsection-report-heatmap-legend' });
    legend.createSpan({ text: '少' });
    [0, 1, 2, 3, 4].forEach((level) => {
      legend.createDiv({ cls: 'qsection-report-heatcell' + (level ? ` is-level-${level}` : '') });
    });
    legend.createSpan({ text: '多' });

    const recent = inRange.slice().sort((a, b) => this.journalDay(b).localeCompare(this.journalDay(a))).slice(0, 8);
    this.rows(this.section(body, '范围内日笔记'), recent, () => []);
  }

  renderAreas(body, data) {
    const areas = data.areas;
    const activeAreas = areas.filter((area) => this.val(area, 'status') === 'active');
    const projectsOf = (area) => data.projects.filter((project) => this.linkName(this.val(project, 'area')) === area.file.basename);
    const withProjects = areas.filter((area) => projectsOf(area).length > 0);

    const kpis = body.createDiv({ cls: 'qsection-report-kpis' });
    this.kpi(kpis, '领域', String(areas.length), '全部');
    this.kpi(kpis, '活跃', String(activeAreas.length), 'status active');
    this.kpi(kpis, '项目', String(data.projects.length), '全部');
    this.kpi(kpis, '有项目领域', String(withProjects.length), '已挂项目');

    this.rows(this.section(body, '领域列表'), areas, (area) => [
      this.label(this.val(area, 'status')),
      `${projectsOf(area).length} 个项目`
    ]);

    const groups = this.section(body, '领域 → 项目');
    if (!withProjects.length) {
      groups.createDiv({ cls: 'qsection-report-empty', text: '还没有领域挂项目' });
    } else {
      for (const area of withProjects) {
        const projects = projectsOf(area);
        const group = groups.createDiv({ cls: 'qsection-areas-group' });
        group.createDiv({ cls: 'qsection-areas-group-title', text: `${area.file.basename} · ${projects.length} 个项目` });
        this.rows(group, projects, (project) => [this.label(this.val(project, 'status'))]);
      }
    }

    body.createDiv({ cls: 'qsection-report-note', text: '领域操作、项目关联和领域体检在 Q 操作台。' });
  }

  async renderCapture(body, data) {
    const token = ++this.captureToken;
    body.createDiv({
      cls: 'qsection-report-note',
      text: '速记数据：按日笔记的「快速捕捉」自动汇总；写入、转化和删除在 Q 操作台 → 速记。'
    });

    const layout = body.createDiv({ cls: 'qsection-capture-layout' });
    const side = layout.createDiv({ cls: 'qsection-capture-side' });
    const timeline = layout.createDiv({ cls: 'qsection-capture-timeline' });
    timeline.createDiv({ cls: 'qsection-report-empty', text: '加载速记…' });

    let captures = [];
    try {
      captures = await this.plugin.getQuickCaptures();
    } catch (err) {
      if (token !== this.captureToken) return;
      timeline.empty();
      timeline.createDiv({ cls: 'qsection-report-empty', text: '读取速记失败：' + (err && err.message ? err.message : err) });
      return;
    }
    if (token !== this.captureToken || !this.isActive('input', 'capture')) return;
    timeline.empty();
    this.renderCaptureCalendar(side, captures);
    this.renderRandomCapture(side, captures);
    this.renderCaptureStats(side, captures);
    this.renderCaptureTimeline(timeline, captures);
  }

  renderCaptureCalendar(parent, captures) {
    const card = parent.createDiv({ cls: 'qsection-capture-card' });
    const head = card.createDiv({ cls: 'qsection-capture-card-head' });
    head.createSpan({ cls: 'qsection-capture-card-title', text: this.captureMonth.format('YYYY 年 M 月') });
    const nav = head.createDiv({ cls: 'qsection-capture-nav' });
    const prev = nav.createEl('button', { cls: 'qsection-capture-nav-button', text: '‹' });
    const todayBtn = nav.createEl('button', { cls: 'qsection-capture-nav-button', text: '今天' });
    const next = nav.createEl('button', { cls: 'qsection-capture-nav-button', text: '›' });
    prev.addEventListener('click', () => { this.captureMonth = this.captureMonth.clone().subtract(1, 'month'); this.render(); });
    next.addEventListener('click', () => { this.captureMonth = this.captureMonth.clone().add(1, 'month'); this.render(); });
    todayBtn.addEventListener('click', () => {
      this.captureMonth = window.moment().startOf('month');
      this.captureFilterDate = '';
      this.render();
    });

    const counts = new Map();
    for (const capture of captures) counts.set(capture.date, (counts.get(capture.date) || 0) + 1);
    const weekdays = card.createDiv({ cls: 'qsection-capture-weekdays' });
    ['一', '二', '三', '四', '五', '六', '日'].forEach((day) => weekdays.createSpan({ text: day }));
    const grid = card.createDiv({ cls: 'qsection-capture-calendar' });
    const month = this.captureMonth.clone().startOf('month');
    const start = month.clone().startOf('isoWeek');
    const end = month.clone().endOf('month').endOf('isoWeek');
    const cursor = start.clone();
    while (cursor.isSameOrBefore(end, 'day')) {
      const key = cursor.format('YYYY-MM-DD');
      const inMonth = cursor.month() === month.month();
      const has = counts.has(key);
      const cls = 'qsection-capture-day' + (inMonth ? '' : ' is-out') + (has ? ' has-captures' : '') + (this.captureFilterDate === key ? ' is-selected' : '');
      const cell = grid.createEl('button', { cls, text: inMonth ? String(cursor.date()) : '', attr: { type: 'button', title: key + (has ? ` · ${counts.get(key)} 条` : '') } });
      cell.disabled = !inMonth;
      if (inMonth) {
        cell.addEventListener('click', () => {
          this.captureFilterDate = this.captureFilterDate === key ? '' : key;
          this.render();
        });
      }
      cursor.add(1, 'day');
    }
  }

  renderRandomCapture(parent, captures) {
    const card = parent.createDiv({ cls: 'qsection-capture-card qsection-random-capture' });
    const head = card.createDiv({ cls: 'qsection-capture-card-head' });
    const title = head.createDiv({ cls: 'qsection-capture-card-title' });
    title.createSpan({ text: '随机速记' });
    title.createSpan({ cls: 'qsection-random-capture-dot' });

    const pool = captures.filter((capture) => !capture.converted);
    if (!pool.length) {
      card.createDiv({ cls: 'qsection-report-empty', text: '还没有未转化的速记。' });
      card.createDiv({ cls: 'qsection-random-capture-hint', text: '已转笔记 / 任务 / 项目的不进入抽签。' });
      return;
    }

    let current = pool.find((capture) => capture.id === this.randomCaptureId);
    if (!current) {
      current = pool[Math.floor(Math.random() * pool.length)];
      this.randomCaptureId = current.id;
    }

    const draw = head.createEl('button', { cls: 'qsection-capture-link qsection-random-capture-draw', text: '换一条' });
    draw.addEventListener('click', () => {
      const nextPool = pool.filter((capture) => capture.id !== current.id);
      const next = nextPool.length ? nextPool[Math.floor(Math.random() * nextPool.length)] : current;
      this.randomCaptureId = next.id;
      this.render();
    });
    if (pool.length < 2) {
      draw.disabled = true;
      draw.setAttribute('title', '只有一条未转化速记');
    }

    card.createDiv({ cls: 'qsection-random-capture-text', text: current.text });
    const meta = card.createDiv({ cls: 'qsection-random-capture-meta' });
    meta.createSpan({ text: `${current.date} ${current.time || ''}`.trim() });
    const open = meta.createEl('button', { cls: 'qsection-capture-link', text: '打开日笔记' });
    open.addEventListener('click', () => { void this.app.workspace.openLinkText(current.path, '', true); });
    card.createDiv({ cls: 'qsection-random-capture-hint', text: '只抽未转化的速记。' });
  }

  renderCaptureStats(parent, captures) {
    const today = window.moment().startOf('day');
    const start = today.clone().subtract(83, 'days');
    const near = captures.filter((capture) => {
      const m = window.moment(capture.date, 'YYYY-MM-DD', true);
      return m.isValid() && m.isSameOrAfter(start) && m.isSameOrBefore(today);
    });
    const days = new Set(near.map((capture) => capture.date));
    let cursor = today.clone();
    if (!days.has(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'day');
    let streak = 0;
    while (days.has(cursor.format('YYYY-MM-DD'))) {
      streak++;
      cursor = cursor.subtract(1, 'day');
    }
    const monthKey = window.moment().format('YYYY-MM');
    const monthCount = captures.filter((capture) => capture.date.startsWith(monthKey)).length;
    const stats = parent.createDiv({ cls: 'qsection-capture-stats' });
    [
      [String(near.length), '近 12 周'],
      [String(streak), '连续天数'],
      [String(monthCount), '本月']
    ].forEach(([value, label]) => {
      const tile = stats.createDiv({ cls: 'qsection-capture-stat' });
      tile.createDiv({ cls: 'qsection-capture-stat-value', text: value });
      tile.createDiv({ cls: 'qsection-capture-stat-label', text: label });
    });
  }

  renderCaptureTimeline(parent, captures) {
    const filtered = this.captureFilterDate
      ? captures.filter((capture) => capture.date === this.captureFilterDate)
      : captures;
    if (this.captureFilterDate) {
      const chip = parent.createDiv({ cls: 'qsection-capture-filter' });
      chip.createSpan({ text: '筛选：' + this.captureFilterDate });
      const clear = chip.createEl('button', { cls: 'qsection-capture-link', text: '清除' });
      clear.addEventListener('click', () => { this.captureFilterDate = ''; this.render(); });
    }
    if (!filtered.length) {
      parent.createDiv({ cls: 'qsection-report-empty', text: this.captureFilterDate ? '这一天没有速记。' : '还没有速记。' });
      return;
    }
    const groups = new Map();
    for (const capture of filtered) {
      if (!groups.has(capture.date)) groups.set(capture.date, []);
      groups.get(capture.date).push(capture);
    }
    for (const [date, items] of groups) {
      const group = parent.createDiv({ cls: 'qsection-capture-group' });
      const head = group.createDiv({ cls: 'qsection-capture-group-head' });
      const parsed = window.moment(date, 'YYYY-MM-DD', true);
      const weekday = parsed.isValid() ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parsed.day()] : '';
      head.createSpan({ cls: 'qsection-capture-group-date', text: `${date} ${weekday}` });
      head.createSpan({ cls: 'qsection-capture-group-count', text: `${items.length} 条` });
      for (const capture of items) {
        const card = group.createDiv({ cls: 'qsection-capture-item' });
        card.createDiv({ cls: 'qsection-capture-text', text: capture.text });
        const meta = card.createDiv({ cls: 'qsection-capture-meta' });
        meta.createSpan({ cls: 'qsection-capture-time', text: capture.time || '' });
        if (capture.converted) {
          const badge = meta.createEl('button', { cls: 'qsection-capture-converted', text: '已转' + this.captureTypeLabel(capture.converted.type) });
          badge.addEventListener('click', () => { void this.app.workspace.openLinkText(capture.converted.path, '', true); });
        }
      }
    }
  }

  captureTypeLabel(type) {
    if (type === 'task') return '任务';
    if (type === 'project') return '项目';
    return '笔记';
  }

  async convertCapture(capture, type, options = {}) {
    if (this.captureBusy) return;
    this.captureBusy = true;
    try {
      const file = await this.plugin.convertQuickCapture(capture, type, options);
      const label = options.tomorrow ? '明日任务' : this.captureTypeLabel(type);
      new Notice(`Q-Section: 已转为${label}：${file.basename}`);
      this.render();
    } catch (err) {
      new Notice('Q-Section: 转化失败：' + (err && err.message ? err.message : err));
    } finally {
      this.captureBusy = false;
    }
  }

  async deleteCapture(capture) {
    if (this.captureBusy) return;
    this.captureBusy = true;
    try {
      await this.plugin.deleteQuickCapture(capture);
      new Notice('Q-Section: 已删除速记。');
      this.render();
    } catch (err) {
      new Notice('Q-Section: 删除失败：' + (err && err.message ? err.message : err));
    } finally {
      this.captureBusy = false;
    }
  }

  renderFavorites(body, data) {
    const favorites = this.plugin.getFavorites();
    const active = this.app.workspace.getActiveFile();
    const kpis = body.createDiv({ cls: 'qsection-report-kpis' });
    this.kpi(kpis, '收藏', String(favorites.length), '笔记');
    this.kpi(kpis, '当前笔记', active ? active.basename : '—', active ? active.parent?.path || '/' : '没有打开文件');

    body.createDiv({ cls: 'qsection-report-note', text: '收藏和取消收藏在 Q 操作台 → 收藏。' });

    const section = this.section(body, '收藏列表');
    if (!favorites.length) {
      section.createDiv({ cls: 'qsection-report-empty', text: '还没有收藏。' });
      return;
    }
    for (const path of favorites) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;
      const row = section.createDiv({ cls: 'qsection-report-row' });
      row.createSpan({ cls: 'qsection-report-row-title', text: file.basename });
      row.createSpan({ cls: 'qsection-report-badge', text: file.parent?.path || '/' });
      row.addEventListener('click', () => { void this.app.workspace.openLinkText(path, '', true); });
    }
  }

  async addCurrentFavorite() {
    if (this.favoriteBusy) return;
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== 'md') {
      new Notice('Q-Section: 当前没有打开 Markdown 笔记。');
      return;
    }
    this.favoriteBusy = true;
    try {
      const added = await this.plugin.addFavorite(file.path);
      new Notice(added ? 'Q-Section: 已收藏。' : 'Q-Section: 已经收藏过了。');
      if (added) this.render();
    } finally {
      this.favoriteBusy = false;
    }
  }

  async removeFavorite(path) {
    await this.plugin.removeFavorite(path);
    this.render();
  }

  renderCreation(body, data) {
    const tabs = body.createDiv({ cls: 'qsection-report-tabs qsection-creation-tabs' });
    [['drafts', '草稿'], ['writing', '创作']].forEach(([key, label]) => {
      const btn = tabs.createEl('button', { cls: 'qsection-report-tab' + (this.creationMode === key ? ' is-active' : ''), text: label });
      btn.addEventListener('click', () => { this.creationMode = key; this.render(); });
    });
    if (this.creationMode === 'writing') this.renderWriting(body, data);
    else this.renderDrafts(body, data);
  }

  renderDrafts(body, data) {
    body.createDiv({ cls: 'qsection-report-note', text: '草稿数据：写入、复制和删除在 Q 操作台 → 创作 → 草稿箱。' });

    const drafts = this.plugin.getDrafts().slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const section = this.section(body, '草稿箱');
    if (!drafts.length) {
      section.createDiv({ cls: 'qsection-report-empty', text: '草稿箱是空的。' });
      return;
    }
    for (const draft of drafts) {
      const card = section.createDiv({ cls: 'qsection-draft-card' });
      const head = card.createDiv({ cls: 'qsection-draft-head' });
      const notePath = String(draft.notePath || '');
      const noteName = notePath ? notePath.split('/').pop().replace(/\.md$/, '') : '未关联笔记';
      const noteBtn = head.createEl('button', { cls: 'qsection-capture-link', text: '关联：' + noteName });
      if (notePath) noteBtn.addEventListener('click', () => { void this.app.workspace.openLinkText(notePath, '', true); });
      head.createSpan({ cls: 'qsection-report-muted', text: window.moment(draft.createdAt).format('MM-DD HH:mm') });
      card.createDiv({ cls: 'qsection-draft-text', text: draft.text });
    }
  }

  async deleteDraft(id) {
    await this.plugin.removeDraft(id);
    new Notice('Q-Section: 已删除草稿。');
    this.render();
  }

  async renderWriting(body, data) {
    const active = this.app.workspace.getActiveFile();
    if (!(active instanceof TFile) || active.extension !== 'md') {
      body.createDiv({ cls: 'qsection-report-empty', text: '先打开一篇 Markdown 笔记，创作目标会自动关联当前笔记。' });
      return;
    }
    const token = ++this.writingToken;
    const project = this.plugin.getWritingProjectFor(active.path);
    const words = await this.plugin.countNoteWords(active.path);
    if (token !== this.writingToken) return;

    const target = project ? project.targetWords : 1000;
    const percent = target ? Math.min(100, Math.round((words / target) * 100)) : 0;
    const kpis = body.createDiv({ cls: 'qsection-report-kpis' });
    this.kpi(kpis, '当前字数', String(words), '去空白计数');
    this.kpi(kpis, '目标', String(target), '字');
    this.kpi(kpis, '进度', `${percent}%`, project ? '进行中' : '未开始');
    this.kpi(kpis, '截止', project && project.deadline ? project.deadline : '—', project ? '目标日期' : '未设置');

    body.createDiv({ cls: 'qsection-report-note', text: '当前关联：' + active.path });
    body.createDiv({ cls: 'qsection-report-note', text: '设置目标、更新进度和标记完成在 Q 操作台 → 创作 → 写作目标。' });
    const progress = body.createDiv({ cls: 'qsection-writing-progress' });
    const fill = progress.createDiv({ cls: 'qsection-writing-progress-fill' });
    fill.style.width = `${percent}%`;

    const projects = this.plugin.getWritingProjects();
    if (projects.length) {
      const section = this.section(body, '全部创作目标');
      for (const item of projects) {
        const row = section.createDiv({ cls: 'qsection-report-row' });
        row.createSpan({ cls: 'qsection-report-row-title', text: String(item.notePath || '').split('/').pop().replace(/\.md$/, '') });
        row.createSpan({ cls: 'qsection-report-badge', text: `${item.targetWords || 0} 字` });
        row.createSpan({ cls: 'qsection-report-badge', text: item.deadline || '无截止' });
        row.createSpan({ cls: 'qsection-report-badge', text: item.status === 'done' ? '完成' : '进行中' });
        row.addEventListener('click', () => { void this.app.workspace.openLinkText(item.notePath, '', true); });
      }
    }
  }

  async saveWritingProject(file, target, deadline) {
    const value = Math.round(Number(target) || 0);
    if (value < 1) {
      new Notice('Q-Section: 目标字数要大于 0。');
      return;
    }
    await this.plugin.setWritingProject(file.path, value, deadline);
    new Notice('Q-Section: 创作目标已保存。');
    this.render();
  }

  async completeWritingProject(file) {
    await this.plugin.completeWritingProject(file.path);
    new Notice('Q-Section: 已标记完成。');
    this.render();
  }

  renderContent(body, data) {
    const stages = [
      ['idea', '选题'], ['draft', '脚本'], ['asset', '素材'],
      ['published', '发布'], ['review', '复盘'], ['archived', '归档']
    ];
    const kpis = body.createDiv({ cls: 'qsection-report-kpis' });
    this.kpi(kpis, '全部内容', String(data.contents.length), '05_Content');
    this.kpi(kpis, '已发布', String(data.published.length), 'published');
    this.kpi(kpis, '待复盘', String(data.review.length), 'review');

    const section = this.section(body, '内容管线');
    const max = Math.max(1, ...stages.map(([key]) => data.contents.filter((x) => this.val(x, 'content_stage') === key).length));
    for (const [key, label] of stages) {
      const items = data.contents.filter((x) => this.val(x, 'content_stage') === key);
      const row = section.createDiv({ cls: 'qsection-report-bar-row' });
      row.createSpan({ cls: 'qsection-report-bar-label', text: label });
      const track = row.createDiv({ cls: 'qsection-report-bar-track' });
      const fill = track.createDiv({ cls: 'qsection-report-bar-fill' });
      fill.style.width = `${Math.round((items.length / max) * 100)}%`;
      row.createSpan({ cls: 'qsection-report-bar-value', text: String(items.length) });
    }

    const platforms = [...new Set(data.contents.map((x) => this.val(x, 'platform')).filter(Boolean))];
    if (platforms.length) {
      const chips = section.createDiv({ cls: 'qsection-report-actions' });
      platforms.forEach((p) => chips.createSpan({ cls: 'qsection-report-badge', text: this.label(p) }));
    }

    this.rows(this.section(body, '内容列表'), data.contents, (x) => [
      this.label(this.val(x, 'content_stage')),
      this.label(this.val(x, 'platform'))
    ]);
    body.createDiv({ cls: 'qsection-report-note', text: '内容创建、阶段推进和 Base 入口在 Q 操作台。' });
  }

  renderReading(body, data) {
    const kpis = body.createDiv({ cls: 'qsection-report-kpis' });
    this.kpi(kpis, '书籍', String(data.books.length), 'note_kind 书籍');
    this.kpi(kpis, '播客', String(data.podcasts.length), 'note_kind 播客');
    this.kpi(kpis, '待复习', String(data.pendingReview.length), '学习笔记');
    this.kpi(kpis, 'EPUB', String(data.epubs), '源文件');
    this.kpi(kpis, '字幕', String(data.srt), 'SRT');

    this.rows(this.section(body, '待复习'), data.pendingReview.slice(0, 12), (x) => [
      this.label(this.val(x, 'topic')),
      this.val(x, 'review_status')
    ]);
    this.rows(this.section(body, '书籍'), data.books, (x) => [this.val(x, 'author')]);
    this.rows(this.section(body, '播客'), data.podcasts, (x) => [this.val(x, 'author')]);
    body.createDiv({ cls: 'qsection-report-note', text: '学习/文化 Base 和资料操作在 Q 操作台。' });
  }

  renderCheckin(body, data) {
    const items = this.plugin.getCheckinItems();
    const records = new Set(this.plugin.getCheckinRecords());
    const today = window.moment().format('YYYY-MM-DD');
    const doneToday = items.filter((item) => records.has(this.plugin.checkinKey(item.id, today))).length;
    const pct = items.length ? Math.round((doneToday / items.length) * 100) : 0;
    const perfectStreak = this.checkinPerfectStreak(items, records);
    const maxStreak = items.reduce((max, item) => Math.max(max, this.plugin.checkinStreak(item.id)), 0);

    const kpis = body.createDiv({ cls: 'qsection-report-kpis' });
    this.kpi(kpis, '今日完成', `${doneToday}/${items.length}`, '打卡项目');
    this.kpi(kpis, '完成率', `${pct}%`, '今天');
    this.kpi(kpis, '连续全勤', String(perfectStreak), '天');
    this.kpi(kpis, '最长连续', String(maxStreak), '单项目');

    body.createDiv({
      cls: 'qsection-report-note',
      text: '打卡数据只读；勾选、添加、归档在 Q 操作台 → 打卡。'
    });

    const monthSection = this.section(body, '打卡月历');
    const nav = monthSection.createDiv({ cls: 'qsection-checkin-month-nav' });
    const prev = nav.createEl('button', { cls: 'qsection-report-button', text: '‹ 上月' });
    nav.createEl('span', { cls: 'qsection-checkin-month-label', text: this.checkinMonth.format('YYYY 年 M 月') });
    const next = nav.createEl('button', { cls: 'qsection-report-button', text: '下月 ›' });
    prev.addEventListener('click', () => { this.checkinMonth = this.checkinMonth.clone().subtract(1, 'month'); this.render(); });
    next.addEventListener('click', () => { this.checkinMonth = this.checkinMonth.clone().add(1, 'month'); this.render(); });

    if (!items.length) {
      monthSection.createDiv({ cls: 'qsection-report-empty', text: '还没有打卡项目，先在 Q 操作台添加。' });
    } else {
      for (const item of items) {
        this.renderCheckinMonthCard(monthSection, item, records);
      }
    }
  }

  renderCheckinMonthCard(parent, item, records) {
    const month = this.checkinMonth.clone().startOf('month');
    const start = month.clone().startOf('isoWeek');
    const end = month.clone().endOf('month').endOf('isoWeek');
    const today = window.moment().startOf('day');
    const checkedDays = this.checkinDaysInMonth(item.id, month, records);
    const streak = this.plugin.checkinStreak(item.id);
    const card = parent.createDiv({ cls: 'qsection-checkin-month-card' });
    const head = card.createDiv({ cls: 'qsection-checkin-month-head' });
    const title = head.createDiv({ cls: 'qsection-checkin-month-title' });
    title.createSpan({ cls: 'qsection-checkin-name', text: item.name });
    if (item.link) title.createSpan({ cls: 'qsection-report-badge', text: this.linkName(item.link) });
    head.createSpan({ cls: 'qsection-report-muted', text: `本月 ${checkedDays} 天 · 连续 ${streak} 天` });

    const weekdays = card.createDiv({ cls: 'qsection-checkin-weekdays' });
    ['一', '二', '三', '四', '五', '六', '日'].forEach((d) => weekdays.createSpan({ text: d }));
    const grid = card.createDiv({ cls: 'qsection-checkin-grid' });
    const cursor = start.clone();
    while (cursor.isSameOrBefore(end, 'day')) {
      const key = cursor.format('YYYY-MM-DD');
      const inMonth = cursor.month() === month.month();
      const future = cursor.isAfter(today, 'day');
      const checked = records.has(this.plugin.checkinKey(item.id, key));
      const cell = grid.createEl('button', {
        cls: 'qsection-checkin-day' + (inMonth ? '' : ' is-out') + (checked ? ' is-checked' : '') + (cursor.isSame(today, 'day') ? ' is-today' : '') + ' is-readonly',
        text: inMonth ? String(cursor.date()) : '',
        attr: { type: 'button', title: key + (checked ? ' · 已打卡' : '') }
      });
      cell.disabled = !inMonth || future;
      cursor.add(1, 'day');
    }
  }

  checkinDaysInMonth(itemId, month, records) {
    let count = 0;
    const start = month.clone().startOf('month');
    const end = month.clone().endOf('month');
    for (let d = start.clone(); d.isSameOrBefore(end, 'day'); d.add(1, 'day')) {
      if (records.has(this.plugin.checkinKey(itemId, d.format('YYYY-MM-DD')))) count++;
    }
    return count;
  }

  checkinPerfectStreak(items, records) {
    if (!items.length) return 0;
    const allDone = (day) => items.every((item) => records.has(this.plugin.checkinKey(item.id, day)));
    let cursor = window.moment().startOf('day');
    if (!allDone(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'day');
    let streak = 0;
    while (allDone(cursor.format('YYYY-MM-DD'))) {
      streak++;
      cursor = cursor.subtract(1, 'day');
    }
    return streak;
  }

  renderFocus(body, data) {
    const today = window.moment().format('YYYY-MM-DD');
    const records = this.plugin.getFocusRecords();
    const todayRecords = records.filter((r) => r && r.date === today);
    const todayMinutes = todayRecords.reduce((sum, r) => sum + (Number(r.minutes) || 0), 0);
    const weekStart = window.moment().subtract(6, 'days').format('YYYY-MM-DD');
    const weekMinutes = records
      .filter((r) => r && r.date >= weekStart && r.date <= today)
      .reduce((sum, r) => sum + (Number(r.minutes) || 0), 0);
    const totalMinutes = records.reduce((sum, r) => sum + (Number(r.minutes) || 0), 0);

    const kpis = body.createDiv({ cls: 'qsection-report-kpis' });
    this.kpi(kpis, '今日专注', String(todayMinutes), '分钟');
    this.kpi(kpis, '今日场次', String(todayRecords.length), '次记录');
    this.kpi(kpis, '近 7 天', String(weekMinutes), '分钟');
    this.kpi(kpis, '累计专注', String(totalMinutes), '分钟');

    body.createDiv({
      cls: 'qsection-report-note',
      text: '专注数据只读；计时、专注集和小窗在 Q 操作台 → 专注。'
    });

    const history = this.section(body, '最近专注');
    const recent = records.slice().sort((a, b) => String(b.end || '').localeCompare(String(a.end || ''))).slice(0, 12);
    if (!recent.length) {
      history.createDiv({ cls: 'qsection-report-empty', text: '还没有专注记录' });
    } else {
      for (const record of recent) {
        const row = history.createDiv({ cls: 'qsection-focus-history-row' });
        row.createSpan({ cls: 'qsection-focus-history-name', text: record.name || '专注' });
        row.createSpan({ cls: 'qsection-focus-history-date', text: String(record.date || '') });
        row.createSpan({ cls: 'qsection-focus-history-mode', text: record.mode === 'stopwatch' ? '正计时' : '倒计时' });
        row.createSpan({ cls: 'qsection-focus-history-minutes', text: this.plugin.focusMinutesLabel(record.minutes) });
        row.addEventListener('click', () => {
          const path = `07_Journal/Daily/${String(record.date || '').slice(0, 4)}/${record.date}.md`;
          void this.app.workspace.openLinkText(path, '', true);
        });
      }
    }
  }

  renderSystem(body, data) {
    const mdTotal = this.app.vault.getMarkdownFiles().length;
    const kpis = body.createDiv({ cls: 'qsection-report-kpis' });
    this.kpi(kpis, '插件', 'v' + this.plugin.manifest.version, 'Q-Section');
    this.kpi(kpis, 'Markdown', String(mdTotal), '全库');
    this.kpi(kpis, '附件', String(data.allFiles.length - mdTotal), '图片 / 音频 / 书籍');
    this.kpi(kpis, '视图', this.rangeDays + ' 天', '当前范围');

    body.createDiv({
      cls: 'qsection-report-note',
      text: '这里是系统数据与文档入口；Base、路由、重载规则和健康检查都在 Q 操作台。'
    });

    const fileSection = this.section(body, '文件');
    const files = [
      ['README', '06_System/README.md'],
      ['路由规则', '06_System/router-rules.json'],
      ['CC 测试交接', '06_System/审计/CC 测试交接 - qsection.md'],
      ['新旧流程对比', '06_System/新旧流程对比.md']
    ];
    for (const [label, path] of files) {
      const row = fileSection.createDiv({ cls: 'qsection-report-row' });
      row.createSpan({ cls: 'qsection-report-row-title', text: label });
      row.createSpan({ cls: 'qsection-report-badge', text: path.split('/').pop() });
      row.addEventListener('click', () => { void this.app.workspace.openLinkText(path, '', true); });
    }
  }

  kpi(parent, label, value, sub) {
    const card = parent.createDiv({ cls: 'qsection-report-kpi' });
    card.createDiv({ cls: 'qsection-report-kpi-label', text: label });
    card.createDiv({ cls: 'qsection-report-kpi-value', text: value });
    card.createDiv({ cls: 'qsection-report-kpi-sub', text: sub });
    return card;
  }

  section(parent, title) {
    const section = parent.createDiv({ cls: 'qsection-report-section' });
    section.createEl('h3', { text: title });
    return section;
  }

  shortProject(item) {
    return this.linkName(this.val(item, 'project'));
  }

  rows(parent, items, metaFn) {
    if (!items.length) {
      parent.createDiv({ cls: 'qsection-report-empty', text: '暂无' });
      return;
    }
    for (const item of items) {
      const row = parent.createDiv({ cls: 'qsection-report-row' });
      row.createSpan({ cls: 'qsection-report-row-title', text: item.file.basename });
      row.setAttribute('title', item.file.path);
      const meta = metaFn ? metaFn(item) : [];
      for (const value of meta) {
        if (!value) continue;
        if (typeof value === 'string') {
          row.createSpan({ cls: 'qsection-report-badge', text: value });
        } else if (value.text) {
          row.createSpan({ cls: 'qsection-report-badge' + (value.tone ? ` is-${value.tone}` : ''), text: value.text });
        }
      }
      row.addEventListener('click', () => { void this.app.workspace.openLinkText(item.file.path, '', true); });
    }
  }
}
class QCalendarEventModal extends Modal {
  constructor(app, plugin, options, callbacks) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.callbacks = callbacks || {};
    this.saving = false;
  }

  onOpen() {
    decorateQModal(this);
    const root = this.contentEl;
    root.empty();
    root.addClass('qsection-calendar-form-modal');
    this.plugin.applyThemeClass(root);

    const event = this.options.event || null;
    const editing = !!event;
    root.createEl('h2', { text: editing ? '编辑日程' : '新建日程' });
    if (editing && event.focusRecord) {
      root.createEl('p', {
        cls: 'qsection-calendar-form-hint',
        text: '这是 Q 专注写入的日笔记记录；修改或删除只改日笔记，不影响专注统计。'
      });
    }

    const form = root.createDiv({ cls: 'qsection-calendar-form' });
    const titleField = form.createEl('label', { cls: 'qsection-calendar-field' });
    titleField.createSpan({ text: '标题' });
    const titleInput = titleField.createEl('input', { type: 'text', cls: 'qsection-actions-input' });
    titleInput.value = event ? event.title : '';
    titleInput.placeholder = '日程标题';

    const dateField = form.createEl('label', { cls: 'qsection-calendar-field' });
    dateField.createSpan({ text: '日期' });
    const dateInput = dateField.createEl('input', { type: 'date', cls: 'qsection-actions-input' });
    dateInput.value = event ? event.date : (this.options.date || window.moment().format('YYYY-MM-DD'));

    const allDayField = form.createEl('label', { cls: 'qsection-calendar-field qsection-calendar-field-inline' });
    const allDayInput = allDayField.createEl('input', { type: 'checkbox' });
    allDayField.createSpan({ text: '全天' });
    allDayInput.checked = event ? !!event.allDay : !!this.options.allDay;

    const timeRow = form.createDiv({ cls: 'qsection-calendar-time-row' });
    const startField = timeRow.createEl('label', { cls: 'qsection-calendar-field' });
    startField.createSpan({ text: '开始' });
    const startInput = startField.createEl('input', { type: 'time', cls: 'qsection-actions-input' });
    const endField = timeRow.createEl('label', { cls: 'qsection-calendar-field' });
    endField.createSpan({ text: '结束' });
    const endInput = endField.createEl('input', { type: 'time', cls: 'qsection-actions-input' });

    const rawStart = event && !event.allDay ? event.startMinute : this.options.startMinute;
    const rawEnd = event && !event.allDay ? event.endMinute : this.options.endMinute;
    const initialStart = Number.isFinite(Number(rawStart)) ? Number(rawStart) : 9 * 60;
    const initialEnd = Number.isFinite(Number(rawEnd)) ? Number(rawEnd) : initialStart + 60;
    startInput.value = this.minutesLabel(initialStart);
    endInput.value = this.minutesLabel(initialEnd);

    const locationField = form.createEl('label', { cls: 'qsection-calendar-field' });
    locationField.createSpan({ text: '地点' });
    const locationInput = locationField.createEl('input', { type: 'text', cls: 'qsection-actions-input' });
    locationInput.value = event ? (event.location || '') : '';
    locationInput.placeholder = '可选';

    const syncAllDay = () => {
      const disabled = allDayInput.checked;
      startInput.disabled = disabled;
      endInput.disabled = disabled;
      timeRow.classList.toggle('is-disabled', disabled);
    };
    allDayInput.addEventListener('change', syncAllDay);
    syncAllDay();

    const actions = root.createDiv({ cls: 'qsection-actions-modal-row qsection-calendar-form-actions' });
    if (editing) {
      const focusBusy = this.plugin.focusStatus === 'running' || this.plugin.focusStatus === 'paused';
      const canStartFocus = event.source === 'daily'
        && !event.allDay
        && !event.focusRecord
        && !event.planLinked
        && !event.actualFocus
        && event.date === window.moment().format('YYYY-MM-DD');
      if (canStartFocus) {
        const startFocus = actions.createEl('button', {
          text: focusBusy ? '专注进行中' : '开始专注',
          attr: { type: 'button', title: focusBusy ? '先结束当前专注' : '用这条日程的名称和时长开始专注' }
        });
        startFocus.disabled = focusBusy;
        startFocus.addEventListener('click', () => {
          if (startFocus.disabled) return;
          const started = this.plugin.startFocusFromPlan({
            date: event.date,
            rawLine: event.rawLine,
            occurrence: event.occurrence || 0,
            title: event.title,
            startMinute: event.startMinute,
            endMinute: event.endMinute
          });
          if (started) this.close();
        });
      }
      const openDaily = actions.createEl('button', {
        cls: 'qsection-calendar-open-daily',
        text: '打开日笔记',
        attr: { type: 'button', title: '打开这条日程所在日期的日笔记' }
      });
      openDaily.addEventListener('click', async () => {
        const path = `07_Journal/Daily/${event.date.slice(0, 4)}/${event.date}.md`;
        if (!this.app.vault.getAbstractFileByPath(path)) {
          new Notice('Q-Section: 这一天还没有日笔记。');
          return;
        }
        await this.app.workspace.openLinkText(path, '', true);
        this.close();
      });
      const remove = actions.createEl('button', { cls: 'qsection-calendar-delete', text: '删除' });
      remove.addEventListener('click', async () => {
        if (this.saving || !this.callbacks.onDelete) return;
        if (!window.confirm('删除这条日程？')) return;
        this.saving = true;
        remove.disabled = true;
        try {
          await this.callbacks.onDelete();
          this.close();
        } catch (err) {
          this.saving = false;
          remove.disabled = false;
          new Notice('Q-Section: 删除失败：' + (err && err.message ? err.message : err));
        }
      });
    }
    const cancel = actions.createEl('button', { text: '取消' });
    cancel.addEventListener('click', () => this.close());
    const save = actions.createEl('button', { text: '保存', cls: 'mod-cta' });

    const submit = async () => {
      if (this.saving || !this.callbacks.onSave) return;
      const title = titleInput.value.replace(/\s+/g, ' ').trim();
      if (!title) {
        new Notice('Q-Section: 日程标题不能为空。');
        titleInput.focus();
        return;
      }
      const date = String(dateInput.value || '').trim();
      if (!window.moment(date, 'YYYY-MM-DD', true).isValid()) {
        new Notice('Q-Section: 请选择有效日期。');
        dateInput.focus();
        return;
      }
      const allDay = allDayInput.checked;
      const start = String(startInput.value || '').trim();
      const end = String(endInput.value || '').trim();
      if (!allDay) {
        if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
          new Notice('Q-Section: 请填写开始和结束时间。');
          return;
        }
        if (end <= start) {
          new Notice('Q-Section: 结束时间要晚于开始时间。');
          endInput.focus();
          return;
        }
      }
      this.saving = true;
      save.disabled = true;
      try {
        await this.callbacks.onSave({
          title,
          date,
          allDay,
          start: allDay ? '' : start,
          end: allDay ? '' : end,
          location: locationInput.value.replace(/\s+/g, ' ').trim(),
          event
        });
        this.close();
      } catch (err) {
        this.saving = false;
        save.disabled = false;
        new Notice('Q-Section: 保存失败：' + (err && err.message ? err.message : err));
      }
    };
    save.addEventListener('click', submit);
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const target = e.target;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.type === 'checkbox')) return;
      e.preventDefault();
      void submit();
    });
    window.setTimeout(() => { titleInput.focus(); titleInput.select(); }, 50);
  }

  minutesLabel(minutes) {
    const value = Math.max(0, Math.min(1439, Number(minutes) || 0));
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }

  onClose() {
    this.contentEl.empty();
  }
}

class QCountdownModal extends Modal {
  constructor(app, plugin, options, callbacks) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.callbacks = callbacks || {};
    this.saving = false;
  }

  onOpen() {
    decorateQModal(this);
    const root = this.contentEl;
    root.empty();
    root.addClass('qsection-calendar-form-modal');
    this.plugin.applyThemeClass(root);

    const item = this.options.item || null;
    root.createEl('h2', { text: item ? '编辑倒数日' : '新建倒数日' });

    const form = root.createDiv({ cls: 'qsection-calendar-form' });
    const titleField = form.createEl('label', { cls: 'qsection-calendar-field' });
    titleField.createSpan({ text: '标题' });
    const titleInput = titleField.createEl('input', { type: 'text', cls: 'qsection-actions-input' });
    titleInput.value = item ? item.title : '';
    titleInput.placeholder = '生日 / 考试 / 纪念日';

    const dateField = form.createEl('label', { cls: 'qsection-calendar-field' });
    dateField.createSpan({ text: '日期' });
    const dateInput = dateField.createEl('input', { type: 'date', cls: 'qsection-actions-input' });
    dateInput.value = item ? item.date : window.moment().format('YYYY-MM-DD');

    const annualField = form.createEl('label', { cls: 'qsection-calendar-field qsection-calendar-field-inline' });
    const annualInput = annualField.createEl('input', { type: 'checkbox' });
    annualField.createSpan({ text: '每年重复（生日 / 纪念日）' });
    annualInput.checked = item ? !!item.annual : false;

    root.createEl('p', {
      cls: 'qsection-calendar-form-hint',
      text: '勾选「每年重复」后，卡片显示下一次日期；生日建议勾选。'
    });

    const actions = root.createDiv({ cls: 'qsection-actions-modal-row qsection-calendar-form-actions' });
    if (item) {
      const remove = actions.createEl('button', { cls: 'qsection-calendar-delete', text: '删除' });
      remove.addEventListener('click', async () => {
        if (this.saving || !this.callbacks.onDelete) return;
        if (!window.confirm(`删除倒数日「${item.title}」？`)) return;
        this.saving = true;
        remove.disabled = true;
        try {
          await this.callbacks.onDelete();
          this.close();
        } catch (err) {
          this.saving = false;
          remove.disabled = false;
          new Notice('Q-Section: 删除失败：' + (err && err.message ? err.message : err));
        }
      });
    }
    const cancel = actions.createEl('button', { text: '取消' });
    cancel.addEventListener('click', () => this.close());
    const save = actions.createEl('button', { text: '保存', cls: 'mod-cta' });

    const submit = async () => {
      if (this.saving || !this.callbacks.onSave) return;
      const title = titleInput.value.replace(/\s+/g, ' ').trim();
      if (!title) {
        new Notice('Q-Section: 倒数日标题不能为空。');
        titleInput.focus();
        return;
      }
      const date = String(dateInput.value || '').trim();
      if (!window.moment(date, 'YYYY-MM-DD', true).isValid()) {
        new Notice('Q-Section: 请选择有效日期。');
        dateInput.focus();
        return;
      }
      this.saving = true;
      save.disabled = true;
      try {
        await this.callbacks.onSave({
          title,
          date,
          annual: annualInput.checked,
          item
        });
        this.close();
      } catch (err) {
        this.saving = false;
        save.disabled = false;
        new Notice('Q-Section: 保存失败：' + (err && err.message ? err.message : err));
      }
    };
    save.addEventListener('click', submit);
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const target = e.target;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.type === 'checkbox')) return;
      e.preventDefault();
      void submit();
    });
    window.setTimeout(() => { titleInput.focus(); titleInput.select(); }, 50);
  }

  onClose() {
    this.contentEl.empty();
  }
}

class QCalendarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.viewMode = 'week';
    this.focusDate = window.moment().startOf('day');
    this.todayKey = this.focusDate.format('YYYY-MM-DD');
    this.rangeStart = this.focusDate.clone().startOf('isoWeek');
    this.miniMonth = window.moment().startOf('month');
    this.events = [];
    this.loadToken = 0;
    this.refreshTimer = null;
    this.nowTimer = null;
    this.initialScrollDone = false;
    this.focusRenderKey = '';
    this.focusPanelOpen = false;
    this.calendarFocusRefs = null;
  }

  getViewType() { return 'qsection-calendar'; }
  getDisplayText() { return 'Q 日历'; }
  getIcon() { return 'calendar-range'; }

  async onOpen() {
    this.render();
    this.nowTimer = window.setInterval(() => {
      this.checkDayRollover();
      this.updateNowLine();
    }, 60000);
    this.registerEvent(this.app.vault.on('create', () => this.scheduleRender()));
    this.registerEvent(this.app.vault.on('delete', () => this.scheduleRender()));
    this.registerEvent(this.app.vault.on('rename', () => this.scheduleRender()));
    this.registerEvent(this.app.vault.on('modify', () => this.scheduleRender()));
    this.registerEvent(this.app.metadataCache.on('changed', () => this.scheduleRender()));
    this.registerEvent(this.app.workspace.on('qsection:theme-changed', () => {
      this.plugin.applyThemeClass(this.contentEl);
    }));
    this.registerEvent(this.app.workspace.on('qsection:countdown-changed', () => this.scheduleRender()));
    this.registerEvent(this.app.workspace.on('qsection:focus-changed', () => {
      this.updateFocusWidgets();
      const ref = this.plugin.focusPlanRef;
      const key = `${this.plugin.focusStatus}|${ref ? `${ref.date}|${ref.occurrence || 0}|${ref.rawLine}` : ''}`;
      if (key === this.focusRenderKey) return;
      this.focusRenderKey = key;
      this.scheduleRender();
    }));
    this.registerDomEvent(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') this.checkDayRollover();
    });
    this.registerDomEvent(window, 'focus', () => this.checkDayRollover());
  }

  async onClose() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    if (this.nowTimer) window.clearInterval(this.nowTimer);
    this.refreshTimer = null;
    this.nowTimer = null;
    this.contentEl.empty();
  }

  scheduleRender() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => { this.refreshTimer = null; void this.render(); }, 400);
  }

  toggleFocusPanel() {
    this.focusPanelOpen = !this.focusPanelOpen;
    void this.render();
  }

  checkDayRollover() {
    const today = window.moment().startOf('day');
    const key = today.format('YYYY-MM-DD');
    if (key === this.todayKey) return false;
    const previousKey = this.todayKey;
    this.todayKey = key;
    if (this.focusDate.format('YYYY-MM-DD') === previousKey) {
      this.focusDate = today.clone();
      if (this.viewMode === 'month') this.rangeStart = this.focusDate.clone().startOf('month');
      else if (this.viewMode === 'week') this.rangeStart = this.focusDate.clone().startOf('isoWeek');
      else this.rangeStart = this.focusDate.clone().startOf('day');
      this.miniMonth = this.rangeStart.clone().startOf('month');
    }
    void this.render();
    return true;
  }

  viewDayCount() {
    if (this.viewMode === 'week') return 7;
    if (this.viewMode === '3day') return 3;
    if (this.viewMode === 'day') return 1;
    return 0;
  }

  rangeDates() {
    if (this.viewMode === 'month') {
      const start = this.rangeStart.clone().startOf('month').startOf('isoWeek');
      const end = this.rangeStart.clone().endOf('month').endOf('isoWeek');
      const days = [];
      for (let cursor = start.clone(); cursor.isSameOrBefore(end, 'day'); cursor.add(1, 'day')) {
        days.push(cursor.clone());
      }
      return days;
    }
    return Array.from({ length: this.viewDayCount() }, (_, i) => this.rangeStart.clone().add(i, 'day'));
  }

  rangeLabel() {
    if (this.viewMode === 'month') return this.rangeStart.format('YYYY年M月');
    const days = this.rangeDates();
    const start = days[0];
    const end = days[days.length - 1];
    if (days.length === 1) return `${start.format('YYYY年M月D日')} ${start.format('ddd')}`;
    if (start.isSame(end, 'month')) return `${start.format('YYYY年M月D日')} – ${end.format('D日')}`;
    if (start.isSame(end, 'year')) return `${start.format('YYYY年M月D日')} – ${end.format('M月D日')}`;
    return `${start.format('YYYY年M月D日')} – ${end.format('YYYY年M月D日')}`;
  }

  setViewMode(mode) {
    if (!['month', 'week', '3day', 'day'].includes(mode)) return;
    const wasMonth = this.viewMode === 'month';
    const anchor = this.focusDate.clone();
    this.viewMode = mode;
    if (wasMonth && mode !== 'month') this.initialScrollDone = false;
    if (mode === 'month') this.rangeStart = anchor.clone().startOf('month');
    else if (mode === 'week') this.rangeStart = anchor.clone().startOf('isoWeek');
    else this.rangeStart = anchor.clone().startOf('day');
    this.miniMonth = this.rangeStart.clone().startOf('month');
    void this.render();
  }

  stepRange(delta) {
    if (this.viewMode === 'month') {
      this.focusDate = this.focusDate.clone().add(delta, 'month').startOf('day');
      this.rangeStart = this.focusDate.clone().startOf('month');
    } else {
      this.focusDate = this.focusDate.clone().add(delta * this.viewDayCount(), 'day').startOf('day');
      this.rangeStart = this.viewMode === 'week'
        ? this.focusDate.clone().startOf('isoWeek')
        : this.focusDate.clone().startOf('day');
    }
    this.miniMonth = this.rangeStart.clone().startOf('month');
    void this.render();
  }

  goToday() {
    const now = window.moment();
    this.focusDate = now.clone().startOf('day');
    if (this.viewMode === 'month') this.rangeStart = this.focusDate.clone().startOf('month');
    else if (this.viewMode === 'week') this.rangeStart = this.focusDate.clone().startOf('isoWeek');
    else this.rangeStart = this.focusDate.clone().startOf('day');
    this.miniMonth = this.rangeStart.clone().startOf('month');
    void this.render();
  }

  async render() {
    const token = ++this.loadToken;
    const root = this.contentEl;
    const previousScroll = root.querySelector('.qsection-calendar-scroll')?.scrollTop ?? null;
    root.empty();
    root.addClass('qsection-calendar-view');
    this.plugin.applyThemeClass(root);

    const header = root.createDiv({ cls: 'qsection-calendar-header' });
    const nav = header.createDiv({ cls: 'qsection-calendar-nav' });
    const prev = nav.createEl('button', { cls: 'qsection-calendar-nav-button', text: '‹', attr: { title: '上一段' } });
    const today = nav.createEl('button', { cls: 'qsection-calendar-nav-button qsection-calendar-today-button', text: '今天' });
    const next = nav.createEl('button', { cls: 'qsection-calendar-nav-button', text: '›', attr: { title: '下一段' } });
    const title = header.createDiv({ cls: 'qsection-calendar-title' });
    title.createSpan({ cls: 'qsection-calendar-kicker', text: 'Q 日历' });
    title.createSpan({ cls: 'qsection-calendar-range', text: this.rangeLabel() });
    const actions = header.createDiv({ cls: 'qsection-calendar-actions' });
    const focusDock = actions.createDiv({ cls: 'qsection-calendar-focus-dock' });
    const capsule = focusDock.createDiv({ cls: 'qsection-calendar-focus-capsule' });
    const focusToggle = capsule.createEl('button', {
      cls: 'qsection-calendar-focus-toggle',
      text: '▶',
      attr: { type: 'button', title: '开始 / 暂停专注' }
    });
    const focusLabel = capsule.createEl('button', {
      cls: 'qsection-calendar-focus-label',
      text: '专注 25:00',
      attr: { type: 'button', title: '打开专注面板' }
    });
    this.calendarFocusRefs = { capsule, toggle: focusToggle, label: focusLabel };
    focusLabel.addEventListener('click', () => this.toggleFocusPanel());
    focusToggle.addEventListener('click', () => {
      if (this.plugin.focusStatus === 'running') this.plugin.pauseFocusTimer();
      else this.plugin.startFocusTimer();
      this.updateFocusWidgets();
    });
    const modes = actions.createDiv({ cls: 'qsection-calendar-modes' });
    const modeButton = (mode, label) => modes.createEl('button', {
      cls: 'qsection-calendar-mode' + (this.viewMode === mode ? ' is-active' : ''),
      text: label
    });
    const month = modeButton('month', '月');
    const week = modeButton('week', '周');
    const three = modeButton('3day', '3 天');
    const day = modeButton('day', '日');
    const add = actions.createEl('button', { cls: 'qsection-calendar-add-button', text: '+ 日程', attr: { type: 'button', title: '新建日程' } });

    prev.addEventListener('click', () => this.stepRange(-1));
    next.addEventListener('click', () => this.stepRange(1));
    today.addEventListener('click', () => this.goToday());
    month.addEventListener('click', () => this.setViewMode('month'));
    week.addEventListener('click', () => this.setViewMode('week'));
    three.addEventListener('click', () => this.setViewMode('3day'));
    day.addEventListener('click', () => this.setViewMode('day'));
    add.addEventListener('click', () => {
      const now = window.moment();
      const focus = this.focusDate.clone().startOf('day');
      const focusInMonth = focus.isSame(this.rangeStart, 'month');
      const focusInRange = this.rangeDates().some((item) => item.isSame(focus, 'day'));
      let date;
      if (this.viewMode === 'month') {
        date = focusInMonth ? focus.format('YYYY-MM-DD') : this.rangeStart.format('YYYY-MM-DD');
      } else if (focusInRange) {
        date = focus.format('YYYY-MM-DD');
      } else if (this.rangeDates().some((item) => item.isSame(now, 'day'))) {
        date = now.format('YYYY-MM-DD');
      } else {
        date = this.rangeStart.format('YYYY-MM-DD');
      }
      let startMinute = 9 * 60;
      if (date === now.format('YYYY-MM-DD')) {
        const rounded = Math.ceil((now.hours() * 60 + now.minutes()) / 30) * 30;
        startMinute = Math.min(23 * 60 + 30, Math.max(9 * 60, rounded));
      }
      this.openScheduleModal({ date, startMinute, endMinute: Math.min(23 * 60 + 59, startMinute + 60), allDay: false });
    });

    const body = root.createDiv({ cls: 'qsection-calendar-body' });
    const sidebar = body.createDiv({ cls: 'qsection-calendar-sidebar' });
    const main = body.createDiv({ cls: 'qsection-calendar-main' });
    main.createDiv({ cls: 'qsection-calendar-loading', text: '加载日历…' });

    const events = await this.loadEvents();
    if (token !== this.loadToken) return;
    this.events = events;
    this.renderSidebar(sidebar);
    this.renderMain(main);
    if (previousScroll !== null) {
      const scroll = root.querySelector('.qsection-calendar-scroll');
      if (scroll) scroll.scrollTop = previousScroll;
    }
    if (this.focusPanelOpen) this.renderFocusPanel(root);
    this.updateFocusWidgets();
  }

  async loadEvents() {
    const days = this.rangeDates();
    const dayKeys = new Set(days.map((d) => d.format('YYYY-MM-DD')));
    const events = [];
    const push = (event) => {
      if (!event.date || !dayKeys.has(event.date)) return;
      events.push(event);
    };

    // Daily schedule blocks.
    const focusLinePattern = /\s·\s(?:\d+\s*小时(?:\s*\d+\s*分钟)?|\d+\s*分钟)\s*\[startTime::\s*\d{1,2}:\d{2}\]\s*\[endTime::\s*\d{1,2}:\d{2}\]\s*$/;
    for (const day of days) {
      const date = day.format('YYYY-MM-DD');
      const path = `07_Journal/Daily/${date.slice(0, 4)}/${date}.md`;
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;
      let text = '';
      try { text = await this.app.vault.cachedRead(file); } catch (err) { continue; }
      const lines = text.split(/\r?\n/);
      const occurrences = new Map();
      let inSchedule = false;
      for (const line of lines) {
        if (/^###\s+今日安排/.test(line)) { inSchedule = true; continue; }
        if (inSchedule && /^###\s+/.test(line)) break;
        if (!inSchedule || !/^-\s+/.test(line)) continue;
        const startMatch = line.match(/\[startTime::\s*(\d{1,2}):(\d{2})\]/i);
        const endMatch = line.match(/\[endTime::\s*(\d{1,2}):(\d{2})\]/i);
        const locationMatch = line.match(/\[location::\s*([^\]]+)\]/i);
        const focusPlanMatch = line.match(/\[focusPlan::\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\]/i);
        const title = line
          .replace(/^-\s+/, '')
          .replace(/\[[^\]]+::\s*[^\]]*\]/g, '')
          .trim();
        if (!title) continue;
        const rawLine = line.replace(/\r$/, '');
        const occurrence = occurrences.get(rawLine) || 0;
        occurrences.set(rawLine, occurrence + 1);
        const meta = {
          date,
          title,
          path,
          source: 'daily',
          rawLine,
          occurrence,
          focusRecord: focusLinePattern.test(rawLine.trim()),
          focusPlan: !!focusPlanMatch,
          planStartMinute: focusPlanMatch ? Number(focusPlanMatch[1]) * 60 + Number(focusPlanMatch[2]) : null,
          planEndMinute: focusPlanMatch ? Number(focusPlanMatch[3]) * 60 + Number(focusPlanMatch[4]) : null,
          planTitle: title.replace(/\s·\s(?:\d+\s*小时(?:\s*\d+\s*分钟)?|\d+\s*分钟)\s*$/, '').trim(),
          location: locationMatch ? locationMatch[1].trim() : ''
        };
        if (!startMatch) {
          push({ ...meta, type: 'daily', allDay: true, startMinute: 0, endMinute: 0 });
          continue;
        }
        const startMinute = Number(startMatch[1]) * 60 + Number(startMatch[2]);
        let endMinute = endMatch ? Number(endMatch[1]) * 60 + Number(endMatch[2]) : startMinute + 30;
        if (endMinute <= startMinute) endMinute = startMinute + 30;
        push({ ...meta, type: 'focus', allDay: false, startMinute, endMinute });
      }
    }

    // Check-ins as all-day chips.
    const checkinRecords = new Set(this.plugin.getCheckinRecords());
    const checkinItems = this.plugin.getCheckinItems(false);
    for (const date of dayKeys) {
      for (const item of checkinItems) {
        if (!checkinRecords.has(`${item.id}|${date}`)) continue;
        const path = `07_Journal/Daily/${date.slice(0, 4)}/${date}.md`;
        push({ date, title: `打卡 · ${item.name}`, type: 'checkin', allDay: true, path, startMinute: 0, endMinute: 0 });
      }
    }

    // Quick captures.
    let captures = [];
    try { captures = await this.plugin.getQuickCaptures(); } catch (err) { captures = []; }
    for (const capture of captures) {
      if (!dayKeys.has(capture.date)) continue;
      const timeMatch = String(capture.time || '').match(/^(\d{1,2}):(\d{2})$/);
      const title = String(capture.text || '').split('\n')[0].slice(0, 80);
      if (!title) continue;
      if (timeMatch) {
        const startMinute = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
        push({ date: capture.date, title: `速记 · ${title}`, type: 'capture', allDay: false, path: capture.path, startMinute, endMinute: startMinute + 20 });
      } else {
        push({ date: capture.date, title: `速记 · ${title}`, type: 'capture', allDay: true, path: capture.path, startMinute: 0, endMinute: 0 });
      }
    }

    // Tasks, projects, content.
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!fm) continue;
      const type = String(fm.type || '').toLowerCase();
      if (type === 'task') {
        const due = this.dateKey(fm['截止']);
        const created = this.dateKey(fm['创建时间']);
        const target = due || created;
        if (!target || !dayKeys.has(target)) continue;
        push({
          date: target,
          title: `任务 · ${file.basename}`,
          type: 'task',
          allDay: true,
          path: file.path,
          startMinute: 0,
          endMinute: 0,
          done: String(fm.status || '').toLowerCase() === 'done',
          due: !!due,
        });
      } else if (type === 'project') {
        const start = this.dateKey(fm['开始']);
        const end = this.dateKey(fm['结束']);
        if (start && dayKeys.has(start)) push({ date: start, title: `项目开始 · ${file.basename}`, type: 'project', allDay: true, path: file.path, startMinute: 0, endMinute: 0 });
        if (end && dayKeys.has(end)) push({ date: end, title: `项目截止 · ${file.basename}`, type: 'project', allDay: true, path: file.path, startMinute: 0, endMinute: 0 });
      } else if (type === 'content') {
        const published = this.dateKey(fm['发布日期']);
        if (published && dayKeys.has(published)) push({ date: published, title: `发布 · ${file.basename}`, type: 'content', allDay: true, path: file.path, startMinute: 0, endMinute: 0 });
      }
    }

    // Link actual focus lines to their planned schedule line.
    const planMap = new Map();
    for (const event of events) {
      if (event.source !== 'daily' || event.allDay || event.focusRecord) continue;
      const key = `${event.date}|${event.title}|${event.startMinute}-${event.endMinute}`;
      if (!planMap.has(key)) planMap.set(key, event);
    }
    for (const event of events) {
      if (event.source !== 'daily' || !event.focusPlan) continue;
      if (event.planStartMinute === null || event.planEndMinute === null) continue;
      const key = `${event.date}|${event.planTitle}|${event.planStartMinute}-${event.planEndMinute}`;
      const plan = planMap.get(key);
      if (!plan) continue;
      event.plan = plan;
      event.planLinked = true;
      plan.actualFocus = true;
    }

    // Countdowns and birthdays as all-day chips.
    for (const item of this.plugin.getCountdowns()) {
      for (const day of days) {
        if (!this.plugin.countdownMatchesDate(item, day)) continue;
        push({
          date: day.format('YYYY-MM-DD'),
          title: item.title,
          type: item.kind === 'birthday' ? 'birthday' : 'countdown',
          allDay: true,
          path: '',
          source: 'countdown',
          countdownId: item.id,
          startMinute: 0,
          endMinute: 0
        });
      }
    }

    return events.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startMinute - b.startMinute;
    });
  }

  dateKey(value) {
    const match = String(value || '').match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }

  eventsForDate(date) {
    return this.events.filter((event) => event.date === date);
  }

  renderSidebar(parent) {
    parent.empty();
    this.renderMiniMonth(parent);
    this.renderFocusPresets(parent);
    this.renderUpNext(parent);
    this.renderCountdowns(parent);
  }

  renderFocusPresets(parent) {
    const card = parent.createDiv({ cls: 'qsection-calendar-card qsection-calendar-focus-presets-card' });
    const head = card.createDiv({ cls: 'qsection-calendar-card-head' });
    head.createSpan({ cls: 'qsection-calendar-card-title', text: '专注集' });
    const manage = head.createEl('button', {
      cls: 'qsection-calendar-focus-manage',
      text: '管理',
      attr: { type: 'button', title: '打开 Q 操作台专注面板' }
    });
    manage.addEventListener('click', () => { void this.plugin.activateActionsView(); });

    const presets = this.plugin.getFocusPresets();
    const busy = this.plugin.focusStatus === 'running' || this.plugin.focusStatus === 'paused';
    if (!presets.length) {
      card.createDiv({ cls: 'qsection-calendar-empty', text: '还没有专注集；在 Q 操作台保存。' });
      return;
    }
    const list = card.createDiv({ cls: 'qsection-calendar-focus-preset-list' });
    for (const preset of presets) {
      const active = this.plugin.focusPresetId === preset.id;
      const row = list.createEl('button', {
        cls: 'qsection-calendar-focus-preset' + (active ? ' is-active' : ''),
        text: preset.mode === 'stopwatch' ? `${preset.name} · 正计时` : `${preset.name} · ${preset.minutes} 分`,
        attr: { type: 'button' }
      });
      row.disabled = busy;
      row.addEventListener('click', () => {
        if (busy) return;
        this.plugin.applyFocusPreset(preset.id);
        this.plugin.startFocusTimer();
        this.updateFocusWidgets();
        this.scheduleRender();
      });
    }
  }

  shiftMiniMonth(delta) {
    this.miniMonth = this.miniMonth.clone().add(delta, 'month').startOf('month');
    if (this.viewMode === 'month') {
      const day = Math.min(this.focusDate.date(), this.miniMonth.daysInMonth());
      this.focusDate = this.miniMonth.clone().date(day).startOf('day');
      this.rangeStart = this.miniMonth.clone().startOf('month');
      void this.render();
      return;
    }
    const sidebar = this.contentEl.querySelector('.qsection-calendar-sidebar');
    if (sidebar) this.renderSidebar(sidebar);
  }

  renderFocusPanel(root) {
    const plugin = this.plugin;
    const panel = root.createDiv({ cls: 'qsection-calendar-focus-panel' });
    const head = panel.createDiv({ cls: 'qsection-calendar-focus-panel-head' });
    head.createSpan({ cls: 'qsection-calendar-focus-panel-title', text: '专注' });
    const close = head.createEl('button', {
      cls: 'qsection-calendar-focus-close',
      text: '×',
      attr: { type: 'button', title: '关闭专注面板' }
    });
    close.addEventListener('click', () => {
      this.focusPanelOpen = false;
      void this.render();
    });

    const planHint = panel.createDiv({ cls: 'qsection-calendar-focus-plan' });
    const nameInput = panel.createEl('input', { cls: 'qsection-focus-name', attr: { type: 'text', placeholder: '专注名称' } });
    nameInput.value = plugin.focusName || '专注';
    const commitName = () => plugin.setFocusName(nameInput.value);
    nameInput.addEventListener('change', commitName);
    nameInput.addEventListener('blur', commitName);
    nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        nameInput.blur();
      }
    });

    const modeRow = panel.createDiv({ cls: 'qsection-focus-modes' });
    const modeCountdown = modeRow.createEl('button', { cls: 'qsection-focus-mode', text: '倒计时', attr: { type: 'button' } });
    const modeStopwatch = modeRow.createEl('button', { cls: 'qsection-focus-mode', text: '正计时', attr: { type: 'button' } });
    modeCountdown.addEventListener('click', () => {
      plugin.setFocusMode('countdown');
      this.updateFocusWidgets();
      void this.render();
    });
    modeStopwatch.addEventListener('click', () => {
      plugin.setFocusMode('stopwatch');
      this.updateFocusWidgets();
      void this.render();
    });

    const timeEl = panel.createDiv({ cls: 'qsection-focus-time', text: '25:00' });
    const statusEl = panel.createDiv({ cls: 'qsection-focus-status', text: '未开始' });
    const progress = panel.createDiv({ cls: 'qsection-focus-progress' });
    const progressFill = progress.createDiv({ cls: 'qsection-focus-progress-fill' });

    const settings = panel.createDiv({ cls: 'qsection-focus-settings' });
    const durationPresets = [];
    let durationInput = null;
    let durationButton = null;
    if (plugin.focusMode === 'countdown') {
      const current = Math.round(plugin.focusDuration / 60);
      [15, 25, 45, 60, 90].forEach((minutes) => {
        const btn = settings.createEl('button', {
          cls: 'qsection-focus-preset qsection-duration-preset' + (current === minutes ? ' is-active' : ''),
          text: `${minutes} 分`,
          attr: { type: 'button' }
        });
        btn.dataset.minutes = String(minutes);
        durationPresets.push(btn);
        btn.addEventListener('click', () => {
          plugin.setFocusDuration(minutes);
          this.updateFocusWidgets();
        });
      });
      durationInput = settings.createEl('input', { cls: 'qsection-focus-input', attr: { type: 'number', min: '1', max: '360' } });
      durationInput.value = String(current);
      durationButton = settings.createEl('button', { cls: 'qsection-focus-preset', text: '设定', attr: { type: 'button' } });
      durationButton.addEventListener('click', () => {
        const value = Number(durationInput.value);
        if (!Number.isFinite(value) || value < 1 || value > 360) {
          new Notice('Q-Section: 倒计时范围是 1–360 分钟。');
          return;
        }
        plugin.setFocusDuration(Math.round(value));
        this.updateFocusWidgets();
      });
    } else {
      settings.createSpan({ cls: 'qsection-calendar-focus-muted', text: '正计时上限 12 小时。' });
    }

    const buttons = panel.createDiv({ cls: 'qsection-focus-buttons' });
    const start = buttons.createEl('button', { cls: 'qsection-focus-primary', text: '开始', attr: { type: 'button' } });
    const pause = buttons.createEl('button', { cls: 'qsection-focus-preset', text: '暂停', attr: { type: 'button' } });
    const finish = buttons.createEl('button', { cls: 'qsection-focus-preset', text: '结束并记录', attr: { type: 'button' } });
    const reset = buttons.createEl('button', { cls: 'qsection-focus-preset', text: '重置', attr: { type: 'button' } });
    start.addEventListener('click', () => {
      plugin.startFocusTimer();
      this.updateFocusWidgets();
    });
    pause.addEventListener('click', () => {
      plugin.pauseFocusTimer();
      this.updateFocusWidgets();
    });
    finish.addEventListener('click', () => { void plugin.finishFocusTimer(false); });
    reset.addEventListener('click', () => {
      plugin.resetFocusTimer();
      this.updateFocusWidgets();
    });

    const secondary = panel.createDiv({ cls: 'qsection-calendar-focus-secondary' });
    const savePreset = secondary.createEl('button', { cls: 'qsection-focus-preset', text: '保存到专注集', attr: { type: 'button' } });
    savePreset.addEventListener('click', () => {
      const minutes = plugin.focusMode === 'countdown' ? Math.round(plugin.focusDuration / 60) : 0;
      void plugin.addFocusPreset(plugin.focusName, minutes, plugin.focusMode).then((preset) => {
        if (preset) {
          new Notice(`Q-Section: 已保存专注项目：${preset.name}`);
          this.scheduleRender();
        }
      });
    });
    const mini = secondary.createEl('button', { cls: 'qsection-focus-preset', text: '小窗', attr: { type: 'button' } });
    mini.addEventListener('click', () => plugin.showFocusMini());
    const popout = secondary.createEl('button', { cls: 'qsection-focus-preset', text: '桌面小窗', attr: { type: 'button' } });
    popout.addEventListener('click', () => { void plugin.showFocusPopout(); });

    panel.createDiv({ cls: 'qsection-calendar-focus-hint', text: '完整统计在 Q 截面 → 节奏 → 专注；专注结束会写入今日安排。' });

    this.calendarFocusRefs = {
      ...(this.calendarFocusRefs || {}),
      panel,
      time: timeEl,
      status: statusEl,
      progress: progressFill,
      name: nameInput,
      start,
      pause,
      finish,
      reset,
      modeCountdown,
      modeStopwatch,
      durationPresets,
      durationInput,
      durationButton,
      planHint
    };
    this.updateFocusWidgets();
  }

  updateFocusWidgets() {
    const refs = this.calendarFocusRefs;
    if (!refs || !this.plugin.getFocusSnapshot) return;
    const snap = this.plugin.getFocusSnapshot();
    const status = snap.status;
    const clock = this.plugin.formatFocusClock(snap.displaySeconds);
    const statusText = { idle: '未开始', running: '进行中', paused: '已暂停', done: '已完成' }[status] || '未开始';
    let label = `专注 ${clock}`;
    if (status === 'running') label = `${clock} ${snap.name}`;
    else if (status === 'paused') label = `已暂停 ${clock}`;
    else if (status === 'done') label = `完成 ${clock}`;
    if (refs.label) {
      refs.label.setText(label);
      refs.label.setAttribute('title', label);
    }
    if (refs.toggle) {
      refs.toggle.setText(status === 'running' ? '⏸' : '▶');
      refs.toggle.setAttribute('title', status === 'running' ? '暂停专注' : status === 'paused' ? '继续专注' : '开始专注');
    }
    if (refs.capsule) {
      refs.capsule.classList.toggle('is-running', status === 'running');
      refs.capsule.classList.toggle('is-paused', status === 'paused');
      refs.capsule.classList.toggle('is-done', status === 'done');
      refs.capsule.classList.toggle('is-open', !!this.focusPanelOpen);
    }
    if (!refs.panel) return;
    if (refs.name && document.activeElement !== refs.name) refs.name.value = snap.name || '专注';
    if (refs.time) refs.time.setText(clock);
    if (refs.status) refs.status.setText(statusText + (status === 'running' ? ' · ' + (snap.mode === 'stopwatch' ? '正计时' : '倒计时') : ''));
    if (refs.progress) refs.progress.style.width = `${Math.round(snap.progress * 100)}%`;
    if (refs.start) {
      refs.start.setText(status === 'paused' ? '继续' : status === 'done' ? '再来一轮' : status === 'running' ? '进行中' : '开始');
      refs.start.disabled = status === 'running';
    }
    if (refs.pause) refs.pause.disabled = status !== 'running';
    if (refs.finish) refs.finish.disabled = !(status === 'running' || status === 'paused');
    if (refs.reset) refs.reset.disabled = status === 'idle';
    if (refs.modeCountdown) refs.modeCountdown.classList.toggle('is-active', snap.mode === 'countdown');
    if (refs.modeStopwatch) refs.modeStopwatch.classList.toggle('is-active', snap.mode === 'stopwatch');
    const locked = status === 'running' || status === 'paused';
    if (refs.durationPresets) {
      const currentMinutes = Math.round(this.plugin.focusDuration / 60);
      refs.durationPresets.forEach((btn) => btn.classList.toggle('is-active', Number(btn.dataset.minutes) === currentMinutes));
    }
    if (refs.durationInput) {
      refs.durationInput.disabled = locked;
      if (document.activeElement !== refs.durationInput) refs.durationInput.value = String(Math.round(this.plugin.focusDuration / 60));
    }
    if (refs.durationButton) refs.durationButton.disabled = locked;
    if (refs.planHint) {
      const plan = this.plugin.focusPlanRef;
      if (plan) {
        refs.planHint.setText(`来自日程 · ${plan.title} ${plan.planStart}–${plan.planEnd}`);
        refs.planHint.classList.remove('is-hidden');
      } else {
        refs.planHint.setText('');
        refs.planHint.classList.add('is-hidden');
      }
    }
  }

  renderMiniMonth(parent) {
    const card = parent.createDiv({ cls: 'qsection-calendar-card qsection-calendar-mini' });
    const head = card.createDiv({ cls: 'qsection-calendar-card-head' });
    head.createSpan({ cls: 'qsection-calendar-card-title', text: this.miniMonth.format('YYYY年M月') });
    const nav = head.createDiv({ cls: 'qsection-calendar-mini-nav' });
    const prev = nav.createEl('button', { cls: 'qsection-calendar-nav-button', text: '‹' });
    const next = nav.createEl('button', { cls: 'qsection-calendar-nav-button', text: '›' });
    prev.addEventListener('click', () => this.shiftMiniMonth(-1));
    next.addEventListener('click', () => this.shiftMiniMonth(1));
    const weekdays = card.createDiv({ cls: 'qsection-calendar-weekdays' });
    ['一', '二', '三', '四', '五', '六', '日'].forEach((day) => weekdays.createSpan({ text: day }));
    const grid = card.createDiv({ cls: 'qsection-calendar-mini-grid' });
    const month = this.miniMonth.clone().startOf('month');
    const start = month.clone().startOf('isoWeek');
    const end = month.clone().endOf('month').endOf('isoWeek');
    const eventDates = new Set(this.events.map((event) => event.date));
    const rangeKeys = this.viewMode === 'month'
      ? new Set()
      : new Set(this.rangeDates().map((day) => day.format('YYYY-MM-DD')));
    const cursor = start.clone();
    while (cursor.isSameOrBefore(end, 'day')) {
      const date = cursor.clone();
      const key = date.format('YYYY-MM-DD');
      const inMonth = date.month() === month.month();
      const isToday = date.isSame(window.moment(), 'day');
      const isFocus = date.isSame(this.focusDate, 'day');
      const inRange = inMonth && rangeKeys.has(key);
      const btn = grid.createEl('button', {
        cls: 'qsection-calendar-mini-day' + (inMonth ? '' : ' is-out') + (isToday ? ' is-today' : '') + (isFocus ? ' is-focus' : '') + (eventDates.has(key) ? ' has-events' : '') + (inRange ? ' is-in-range' : ''),
        text: inMonth ? String(date.date()) : '',
        attr: { type: 'button', title: key },
      });
      if (inMonth) btn.addEventListener('click', () => {
        this.focusDate = date.clone().startOf('day');
        if (this.viewMode === 'month') this.rangeStart = date.clone().startOf('month');
        else if (this.viewMode === 'week') this.rangeStart = date.clone().startOf('isoWeek');
        else this.rangeStart = date.clone().startOf('day');
        this.miniMonth = date.clone().startOf('month');
        void this.render();
      });
      cursor.add(1, 'day');
    }
  }

  renderUpNext(parent) {
    const card = parent.createDiv({ cls: 'qsection-calendar-card qsection-calendar-upnext' });
    const head = card.createDiv({ cls: 'qsection-calendar-card-head' });
    head.createSpan({ cls: 'qsection-calendar-card-title', text: 'Up Next' });
    const now = window.moment();
    const upcoming = this.events
      .filter((event) => !event.planLinked && event.date >= now.format('YYYY-MM-DD'))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.startMinute - b.startMinute;
      })
      .slice(0, 5);
    if (!upcoming.length) {
      card.createDiv({ cls: 'qsection-calendar-empty', text: '接下来没有排程。' });
      return;
    }
    for (const event of upcoming) {
      const row = card.createDiv({ cls: 'qsection-calendar-upnext-row' });
      const time = row.createSpan({ cls: 'qsection-calendar-upnext-time' });
      time.setText(event.allDay ? '全天' : `${this.minutesLabel(event.startMinute)} – ${this.minutesLabel(event.endMinute)}`);
      const text = row.createSpan({ cls: 'qsection-calendar-upnext-title', text: event.title });
      text.setAttribute('title', event.title);
      row.addEventListener('click', () => { void this.openEvent(event); });
    }
  }

  renderCountdowns(parent) {
    const card = parent.createDiv({ cls: 'qsection-calendar-card qsection-calendar-countdowns' });
    const head = card.createDiv({ cls: 'qsection-calendar-card-head' });
    head.createSpan({ cls: 'qsection-calendar-card-title', text: '倒数日' });
    const add = head.createEl('button', { cls: 'qsection-calendar-countdown-add', text: '+', attr: { type: 'button', title: '添加倒数日' } });
    add.addEventListener('click', () => this.openCountdownModal());

    const items = this.plugin.getCountdowns()
      .map((item) => ({ item, info: this.plugin.countdownInfo(item) }))
      .sort((a, b) => {
        const aPast = a.info.days < 0 ? 1 : 0;
        const bPast = b.info.days < 0 ? 1 : 0;
        if (aPast !== bPast) return aPast - bPast;
        return a.info.days - b.info.days;
      });
    if (!items.length) {
      card.createDiv({ cls: 'qsection-calendar-empty', text: '还没有倒数日。' });
      return;
    }
    for (const { item, info } of items) {
      const row = card.createDiv({
        cls: 'qsection-calendar-countdown-row'
          + (info.today ? ' is-today' : '')
          + (info.days < 0 ? ' is-past' : '')
          + (item.kind === 'birthday' ? ' is-birthday' : '')
      });
      row.setAttribute('title', `${item.title} · ${info.dateLabel}`);
      const main = row.createDiv({ cls: 'qsection-calendar-countdown-main' });
      main.createSpan({ cls: 'qsection-calendar-countdown-title', text: item.title });
      main.createSpan({ cls: 'qsection-calendar-countdown-date', text: info.dateLabel });
      row.createSpan({ cls: 'qsection-calendar-countdown-days', text: info.label });
      row.addEventListener('click', () => this.openCountdownModal(item));
    }
  }

  renderMain(parent) {
    parent.empty();
    if (this.viewMode === 'month') {
      this.renderMonthMain(parent);
      return;
    }
    this.renderTimelineMain(parent);
  }

  renderMonthMain(parent) {
    const days = this.rangeDates();
    const board = parent.createDiv({ cls: 'qsection-calendar-month-board' });
    const head = board.createDiv({ cls: 'qsection-calendar-month-head' });
    head.createDiv({ cls: 'qsection-calendar-month-weeknum-head' });
    ['一', '二', '三', '四', '五', '六', '日'].forEach((label) => {
      head.createDiv({ cls: 'qsection-calendar-month-weekday', text: label });
    });

    const scroll = board.createDiv({ cls: 'qsection-calendar-month-scroll' });
    const grid = scroll.createDiv({ cls: 'qsection-calendar-month-grid' });
    const monthStart = this.rangeStart.clone().startOf('month');
    for (let index = 0; index < days.length; index += 7) {
      const week = days.slice(index, index + 7);
      grid.createDiv({ cls: 'qsection-calendar-month-weeknum', text: 'W' + week[0].isoWeek() });
      for (const day of week) {
        const key = day.format('YYYY-MM-DD');
        const inMonth = day.year() === monthStart.year() && day.month() === monthStart.month();
        const cell = grid.createDiv({
          cls: 'qsection-calendar-month-day'
            + (inMonth ? '' : ' is-out')
            + (day.isSame(window.moment(), 'day') ? ' is-today' : '')
            + (day.isSame(this.focusDate, 'day') ? ' is-focus' : '')
        });
        cell.setAttribute('data-date', key);
        cell.addEventListener('click', (evt) => {
          if (evt.target.closest('.qsection-calendar-month-event')) return;
          this.openDayView(day);
        });

        const dayHead = cell.createDiv({ cls: 'qsection-calendar-month-day-head' });
        const dateButton = dayHead.createEl('button', {
          cls: 'qsection-calendar-month-date',
          text: String(day.date()),
          attr: { type: 'button', title: key }
        });
        dateButton.addEventListener('click', (evt) => {
          evt.stopPropagation();
          this.openDayView(day);
        });

        const list = this.eventsForDate(key).filter((event) => !event.planLinked);
        const eventsBox = cell.createDiv({ cls: 'qsection-calendar-month-events' });
        for (const event of list.slice(0, 3)) {
          const text = event.allDay ? event.title : `${this.minutesLabel(event.startMinute)} ${event.title}`;
          const chip = eventsBox.createEl('button', {
            cls: 'qsection-calendar-month-event',
            text
          });
          chip.setAttribute('title', text);
          chip.addEventListener('click', (evt) => {
            evt.stopPropagation();
            void this.openEvent(event);
          });
        }
        if (list.length > 3) {
          eventsBox.createSpan({ cls: 'qsection-calendar-month-more', text: `+${list.length - 3}` });
        }
      }
    }
  }

  layoutTimedEvents(events) {
    const sorted = events.slice().sort((a, b) => {
      if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
      return b.endMinute - a.endMinute;
    });
    const layout = new Map();
    let cluster = [];
    let clusterEnd = -1;
    const flush = () => {
      if (!cluster.length) return;
      const laneEnds = [];
      const assignments = new Map();
      for (const event of cluster) {
        let lane = laneEnds.findIndex((end) => end <= event.startMinute);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(event.endMinute);
        } else {
          laneEnds[lane] = event.endMinute;
        }
        assignments.set(event, lane);
      }
      const lanes = Math.max(1, laneEnds.length);
      for (const event of cluster) {
        layout.set(event, { lane: assignments.get(event), lanes });
      }
      cluster = [];
    };
    for (const event of sorted) {
      if (!cluster.length || event.startMinute < clusterEnd) {
        cluster.push(event);
        clusterEnd = Math.max(clusterEnd, event.endMinute);
      } else {
        flush();
        cluster = [event];
        clusterEnd = event.endMinute;
      }
    }
    flush();
    return layout;
  }

  renderTimelineMain(parent) {
    const days = this.rangeDates();
    const board = parent.createDiv({ cls: 'qsection-calendar-board' });
    const template = `56px repeat(${days.length}, minmax(0, 1fr))`;
    board.style.setProperty('--q-cal-days', String(days.length));
    const head = board.createDiv({ cls: 'qsection-calendar-head' });
    head.style.gridTemplateColumns = template;
    head.createDiv({ cls: 'qsection-calendar-head-gutter' });
    for (const day of days) {
      const cell = head.createDiv({
        cls: 'qsection-calendar-head-day'
          + (day.isSame(window.moment(), 'day') ? ' is-today' : '')
          + (day.isSame(this.focusDate, 'day') ? ' is-focus' : '')
      });
      cell.createSpan({ cls: 'qsection-calendar-head-weekday', text: day.format('ddd') });
      cell.createSpan({ cls: 'qsection-calendar-head-date', text: day.format('M/D') });
      cell.addEventListener('click', () => { void this.openDaily(day.format('YYYY-MM-DD')); });
    }

    const allDay = board.createDiv({ cls: 'qsection-calendar-allday' });
    allDay.style.gridTemplateColumns = template;
    allDay.createDiv({ cls: 'qsection-calendar-allday-label', text: '全天' });
    const allDayEvents = new Map();
    for (const day of days) {
      const key = day.format('YYYY-MM-DD');
      const list = this.eventsForDate(key).filter((event) => event.allDay);
      allDayEvents.set(key, list);
      const cell = allDay.createDiv({ cls: 'qsection-calendar-allday-cell' });
      cell.addEventListener('click', (evt) => {
        if (evt.target !== cell) return;
        this.openScheduleModal({ date: key, allDay: true });
      });
      for (const event of list.slice(0, 4)) {
        const chip = cell.createEl('button', { cls: this.eventClass(event), text: event.title });
        chip.setAttribute('title', event.title);
        chip.addEventListener('click', (evt) => { evt.stopPropagation(); void this.openEvent(event); });
      }
      if (list.length > 4) cell.createSpan({ cls: 'qsection-calendar-more', text: `+${list.length - 4}` });
    }

    const scroll = board.createDiv({ cls: 'qsection-calendar-scroll' });
    const grid = scroll.createDiv({ cls: 'qsection-calendar-grid' });
    grid.style.gridTemplateColumns = template;
    const timeCol = grid.createDiv({ cls: 'qsection-calendar-time-col' });
    for (let hour = 0; hour < 24; hour++) {
      const label = timeCol.createDiv({ cls: 'qsection-calendar-time-label', text: `${String(hour).padStart(2, '0')}:00` });
      label.style.top = `${hour * 48}px`;
    }
    for (const day of days) {
      const key = day.format('YYYY-MM-DD');
      const isToday = day.isSame(window.moment(), 'day');
      const col = grid.createDiv({
        cls: 'qsection-calendar-day-col'
          + (isToday ? ' is-today' : '')
          + (day.isSame(this.focusDate, 'day') ? ' is-focus' : '')
      });
      col.setAttribute('data-date', key);
      col.addEventListener('click', (evt) => {
        if (evt.target !== col) return;
        const rect = col.getBoundingClientRect();
        const y = Math.max(0, evt.clientY - rect.top);
        let startMinute = Math.round((y / 48) * 60 / 30) * 30;
        startMinute = Math.max(0, Math.min(23 * 60 + 30, startMinute));
        const endMinute = Math.min(23 * 60 + 59, startMinute + 60);
        this.openScheduleModal({ date: key, startMinute, endMinute, allDay: false });
      });
      const timed = this.eventsForDate(key).filter((event) => !event.allDay);
      const planTimed = timed.filter((event) => !event.planLinked);
      const actualTimed = timed.filter((event) => event.planLinked && event.plan);
      const layout = this.layoutTimedEvents(planTimed);
      const colWidth = col.getBoundingClientRect().width;
      const planMetrics = new Map();
      const applyGeometry = (block, event, metrics) => {
        const top = (event.startMinute / 60) * 48;
        const height = Math.max(24, ((event.endMinute - event.startMinute) / 60) * 48 - 2);
        block.style.top = `${top}px`;
        block.style.height = `${height}px`;
        block.style.right = 'auto';
        if (metrics.lanes > 1) {
          const laneWidth = 100 / metrics.lanes;
          block.style.left = `calc(${metrics.lane * laneWidth}% + 4px)`;
          block.style.width = `calc(${laneWidth}% - 6px)`;
          const fallbackWidth = this.viewMode === 'week' ? 70 : this.viewMode === '3day' ? 180 : 480;
          const lanePx = (colWidth > 0 ? colWidth : fallbackWidth) / metrics.lanes;
          block.classList.add(lanePx < 28 ? 'is-micro' : 'is-narrow');
        } else {
          block.style.left = '4px';
          block.style.width = 'calc(100% - 8px)';
        }
      };

      for (const event of planTimed) {
        const metrics = layout.get(event) || { lane: 0, lanes: 1 };
        planMetrics.set(event, metrics);
        const block = col.createEl('button', {
          cls: this.eventClass(event) + (event.actualFocus ? ' is-plan' : '')
        });
        applyGeometry(block, event, metrics);
        const runningRef = this.plugin.focusPlanRef;
        const isRunningPlan = this.plugin.focusStatus === 'running'
          && runningRef
          && runningRef.date === event.date
          && runningRef.rawLine === event.rawLine
          && Number(runningRef.occurrence || 0) === Number(event.occurrence || 0);
        block.classList.toggle('is-focus-running', !!isRunningPlan);
        block.setText(metrics.lanes > 1 ? event.title : `${this.minutesLabel(event.startMinute)} ${event.title}`);
        block.setAttribute('title', `${this.minutesLabel(event.startMinute)}–${this.minutesLabel(event.endMinute)} ${event.title}`);
        block.addEventListener('click', (evt) => { evt.stopPropagation(); void this.openEvent(event); });
      }

      for (const event of actualTimed) {
        const metrics = planMetrics.get(event.plan);
        if (!metrics) continue;
        const block = col.createEl('button', { cls: this.eventClass(event) + ' is-actual-focus' });
        applyGeometry(block, event, metrics);
        block.setText('');
        block.setAttribute('title', `实际 ${this.minutesLabel(event.startMinute)}–${this.minutesLabel(event.endMinute)} · ${event.title}`);
        block.addEventListener('click', (evt) => { evt.stopPropagation(); void this.openEvent(event); });
      }
      if (isToday) {
        const line = col.createDiv({ cls: 'qsection-calendar-now-line' });
        line.style.top = `${(window.moment().hours() * 60 + window.moment().minutes()) / 60 * 48}px`;
      }
    }
    if (!this.initialScrollDone) {
      this.initialScrollDone = true;
      window.requestAnimationFrame(() => { scroll.scrollTop = 7 * 48; });
    }
  }

  eventClass(event) {
    return `qsection-calendar-event qsection-calendar-event--${event.type}` + (event.done ? ' is-done' : '');
  }

  minutesLabel(minutes) {
    const value = Math.max(0, Math.min(1439, Number(minutes) || 0));
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }

  dailyNoteFile(date) {
    const path = `07_Journal/Daily/${date.slice(0, 4)}/${date}.md`;
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  openScheduleModal(options = {}) {
    new QCalendarEventModal(this.app, this.plugin, options, {
      onSave: (payload) => this.saveSchedule(payload),
      onDelete: () => this.deleteSchedule(options.event)
    }).open();
  }

  async saveSchedule(payload) {
    const original = payload.event || null;
    const line = this.plugin.buildDailyScheduleLine(payload);
    let noticeText = '日程已保存。';

    if (!original) {
      const file = await this.plugin.ensureDailyNoteFile(payload.date);
      await this.app.vault.process(file, (text) => this.plugin.insertDailyScheduleLine(text, line));
    } else if (original.date === payload.date) {
      const file = this.dailyNoteFile(original.date);
      if (!file) throw new Error('日笔记不存在。');
      let updated = false;
      await this.app.vault.process(file, (text) => {
        const next = this.plugin.updateDailyScheduleLine(text, original.rawLine, line, original.occurrence || 0);
        if (next === null) return text;
        updated = true;
        return next;
      });
      if (!updated) throw new Error('原日程已变化，请刷新后再试。');
    } else {
      const targetFile = await this.plugin.ensureDailyNoteFile(payload.date);
      await this.app.vault.process(targetFile, (text) => this.plugin.insertDailyScheduleLine(text, line));
      const oldFile = this.dailyNoteFile(original.date);
      if (!oldFile) {
        noticeText = '新日程已写入，但原日笔记不存在，旧日程未删除。';
      } else {
        let removed = false;
        await this.app.vault.process(oldFile, (text) => {
          const next = this.plugin.updateDailyScheduleLine(text, original.rawLine, null, original.occurrence || 0);
          if (next === null) return text;
          removed = true;
          return next;
        });
        if (!removed) noticeText = '新日程已写入，但旧日程没找到，请检查是否重复。';
      }
    }

    this.focusScheduleDate(payload.date);
    new Notice('Q-Section: ' + noticeText);
    this.scheduleRender();
  }

  async deleteSchedule(event) {
    if (!event) return;
    const file = this.dailyNoteFile(event.date);
    if (!file) throw new Error('日笔记不存在。');
    let removed = false;
    await this.app.vault.process(file, (text) => {
      const next = this.plugin.updateDailyScheduleLine(text, event.rawLine, null, event.occurrence || 0);
      if (next === null) return text;
      removed = true;
      return next;
    });
    if (!removed) throw new Error('原日程已变化，请刷新后再试。');
    new Notice('Q-Section: 日程已删除。');
    this.scheduleRender();
  }

  openCountdownModal(item = null) {
    new QCountdownModal(this.app, this.plugin, { item }, {
      onSave: (payload) => this.saveCountdown(payload),
      onDelete: () => this.deleteCountdown(item)
    }).open();
  }

  async saveCountdown(payload) {
    if (payload.item) await this.plugin.updateCountdown(payload.item.id, payload);
    else await this.plugin.addCountdown(payload);
    new Notice('Q-Section: 倒数日已保存。');
    this.scheduleRender();
  }

  async deleteCountdown(item) {
    if (!item) return;
    await this.plugin.removeCountdown(item.id);
    new Notice('Q-Section: 倒数日已删除。');
    this.scheduleRender();
  }

  focusScheduleDate(date) {
    const target = window.moment(date, 'YYYY-MM-DD', true);
    if (!target.isValid()) return;
    this.focusDate = target.clone().startOf('day');
    if (this.viewMode === 'month') {
      if (!target.isSame(this.rangeStart, 'month')) {
        this.rangeStart = target.clone().startOf('month');
        this.miniMonth = target.clone().startOf('month');
      }
      return;
    }
    const inRange = this.rangeDates().some((day) => day.isSame(target, 'day'));
    if (inRange) {
      this.miniMonth = target.clone().startOf('month');
      return;
    }
    this.rangeStart = this.viewMode === 'week' ? target.clone().startOf('isoWeek') : target.clone().startOf('day');
    this.miniMonth = target.clone().startOf('month');
  }

  async openEvent(event) {
    if (event.source === 'daily') {
      this.openScheduleModal({ event });
      return;
    }
    if (event.source === 'countdown') {
      const item = this.plugin.getCountdowns().find((entry) => entry.id === event.countdownId);
      if (item) this.openCountdownModal(item);
      return;
    }
    if (event.path) await this.app.workspace.openLinkText(event.path, '', true);
  }

  openDayView(day) {
    this.viewMode = 'day';
    this.initialScrollDone = false;
    this.focusDate = day.clone().startOf('day');
    this.rangeStart = this.focusDate.clone();
    this.miniMonth = day.clone().startOf('month');
    void this.render();
  }

  async openDaily(date) {
    const path = `07_Journal/Daily/${date.slice(0, 4)}/${date}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) {
      await this.app.workspace.openLinkText(path, '', true);
    } else {
      new Notice('Q-Section: 这一天还没有日笔记。');
    }
  }

  updateNowLine() {
    const line = this.contentEl.querySelector('.qsection-calendar-now-line');
    if (!line) return;
    const minutes = window.moment().hours() * 60 + window.moment().minutes();
    line.style.top = `${(minutes / 60) * 48}px`;
  }
}

class PreviewModal extends Modal {
  constructor(app, lines) {
    super(app);
    this.lines = lines;
  }
  onOpen() {
    decorateQModal(this);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Q-Section: preview' });
    if (!this.lines.length) {
      contentEl.createEl('p', { text: 'No files need routing.' });
      return;
    }
    const pre = contentEl.createEl('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.maxHeight = '60vh';
    pre.style.overflow = 'auto';
    pre.setText(this.lines.join('\n'));
  }
  onClose() { this.contentEl.empty(); }
}

class ParaRouterSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Q-Section' });
    new Setting(containerEl)
      .setName('Q theme / Q 主题')
      .setDesc('Auto follows Obsidian; Light / Dark are independent of the Obsidian theme.')
      .addDropdown((dropdown) => dropdown
        .addOptions({ auto: 'Auto / 跟随', light: 'Light / 浅色', dark: 'Dark / 深色' })
        .setValue(this.plugin.settings.themeMode || 'auto')
        .onChange(async (value) => { await this.plugin.setThemeMode(value); }));
    new Setting(containerEl)
      .setName('Glass theme / 玻璃主题')
      .setDesc('Optional glass-capsule theme. Off keeps the original Q theme.')
      .addToggle((toggle) => toggle
        .setValue(!!this.plugin.settings.glassTheme)
        .onChange(async (value) => { await this.plugin.setGlassTheme(value); }));
    new Setting(containerEl)
      .setName('Auto route')
      .setDesc('Move notes automatically when frontmatter changes. Turn off to use commands only.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoRoute)
        .onChange(async (value) => {
          this.plugin.settings.autoRoute = value;
          await this.plugin.saveSettings();
        }));
    new Setting(containerEl)
      .setName('Debounce (ms)')
      .setDesc('Wait this long after a metadata change before moving the file.')
      .addText((text) => text
        .setPlaceholder('1200')
        .setValue(String(this.plugin.settings.debounceMs))
        .onChange(async (value) => {
          const n = parseInt(value, 10);
          if (!isNaN(n) && n >= 200) {
            this.plugin.settings.debounceMs = n;
            await this.plugin.saveSettings();
          }
        }));
  }
}

class ParaRouterPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    await this.loadRules();
    this.timers = new Map();
    this.focusWindowOpening = false;
    this.initFocusTimer();
    this.themeObserver = new MutationObserver(() => {
      if (this.settings.themeMode === 'auto') this.app.workspace.trigger('qsection:theme-changed');
    });
    this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    this.register(() => this.themeObserver.disconnect());

    this.registerView('qsection-actions', (leaf) => new ParaActionsView(leaf, this));
    this.registerView('qsection-report', (leaf) => new QSectionReportView(leaf, this));
    this.registerView('qsection-focus-window', (leaf) => new QSectionFocusWindowView(leaf, this));
    this.registerView('qsection-calendar', (leaf) => new QCalendarView(leaf, this));

    this.registerEvent(this.app.vault.on('create', (file) => this.schedule(file)));
    this.registerEvent(this.app.metadataCache.on('changed', (file) => this.schedule(file)));
    this.registerEvent(this.app.vault.on('modify', (file) => {
      if (file.path === RULES_PATH) void this.loadRules();
    }));

    this.addRibbonIcon('diamond', 'Q 操作台', () => { void this.activateActionsView(); });
    this.addRibbonIcon('bar-chart-3', 'Q 截面', () => { void this.activateReportView(); });
    this.addRibbonIcon('calendar-range', 'Q 日历', () => { void this.activateCalendarView(); });

    this.addCommand({
      id: 'open-actions-panel',
      name: 'Open Q console',
      callback: () => { void this.activateActionsView(); }
    });
    this.addCommand({
      id: 'open-q-report',
      name: 'Open Q view',
      callback: () => { void this.openQReport(); }
    });
    this.addCommand({
      id: 'open-q-calendar',
      name: 'Open Q calendar',
      callback: () => { void this.activateCalendarView(); }
    });
    this.addCommand({
      id: 'toggle-q-theme',
      name: 'Toggle Q theme',
      callback: () => { void this.toggleThemeMode(); }
    });
    this.addCommand({
      id: 'toggle-glass-theme',
      name: 'Toggle glass theme',
      callback: () => { void this.setGlassTheme(!this.settings.glassTheme); }
    });
    this.addCommand({
      id: 'open-focus-timer',
      name: 'Open focus timer',
      callback: () => { void this.activateActionsView(); }
    });
    this.addCommand({
      id: 'open-focus-window',
      name: 'Open focus desktop window',
      callback: () => { void this.showFocusPopout(); }
    });
    this.addCommand({
      id: 'open-checkin',
      name: 'Open check-in',
      callback: () => { void this.activateActionsView(); }
    });
    this.addCommand({
      id: 'reload-router-rules',
      name: 'Reload router rules',
      callback: () => { void this.reloadRules(); }
    });
    const newCommands = [
      ['new-project', 'New project', 'project'],
      ['new-area', 'New area', 'area'],
      ['new-resource', 'New resource', 'resource'],
      ['new-content', 'New content', 'content'],
      ['new-task', 'New task', 'task'],
      ['new-note', 'New note', 'note'],
      ['new-journal-daily', 'New daily journal', 'journal-daily'],
      ['new-journal-weekly', 'New weekly journal', 'journal-weekly'],
      ['new-journal-monthly', 'New monthly journal', 'journal-monthly'],
      ['new-journal-quarterly', 'New quarterly journal', 'journal-quarterly'],
      ['new-journal-yearly', 'New yearly journal', 'journal-yearly']
    ];
    for (const item of newCommands) {
      this.addCommand({
        id: item[0],
        name: item[1],
        callback: () => { void this.createFromTemplate(item[2]); }
      });
    }
    const baseCommands = [
      ['open-project-base', 'Open project overview', '项目总览'],
      ['open-area-base', 'Open area overview', '领域总览'],
      ['open-study-base', 'Open study overview', '学习总览'],
      ['open-culture-base', 'Open culture overview', '文化总览'],
      ['open-resource-base', 'Open resource overview', '资源总览'],
      ['open-content-base', 'Open content overview', '内容总览'],
      ['open-task-base', 'Open task overview', '任务总览'],
      ['open-journal-base', 'Open journal overview', '日志总览']
    ];
    for (const item of baseCommands) {
      this.addCommand({
        id: item[0],
        name: item[1],
        callback: () => { this.openBase(item[2]); }
      });
    }
    this.addCommand({
      id: 'insert-project-task-base',
      name: 'Insert project tasks base',
      callback: () => this.insertProjectTaskBase()
    });
    this.addCommand({
      id: 'insert-project-content-base',
      name: 'Insert project content base',
      callback: () => this.insertProjectContentBase()
    });
    this.addCommand({
      id: 'preview-routing',
      name: 'Preview routing',
      callback: () => { void this.previewRouting(); }
    });
    this.addCommand({
      id: 'route-current-file',
      name: 'Route current file',
      callback: () => { void this.routeCurrentFile(); }
    });
    this.addCommand({
      id: 'route-all-files',
      name: 'Route all files',
      callback: () => { void this.routeAllFiles(); }
    });
    this.addCommand({
      id: 'undo-last-route',
      name: 'Undo last route',
      callback: () => { void this.undoLastRoute(); }
    });
    const relationCommands = [
      ['add-relation-area', 'Add relation: area', 'area'],
      ['add-relation-project', 'Add relation: project', 'project'],
      ['add-relation-task', 'Add relation: task', 'task'],
      ['add-relation-note', 'Add relation: note', 'note']
    ];
    for (const item of relationCommands) {
      this.addCommand({
        id: item[0],
        name: item[1],
        callback: () => this.startRelation(item[2])
      });
    }
    this.addCommand({
      id: 'complete-current-object',
      name: 'Complete current object',
      callback: () => { void this.completeCurrentObject(); }
    });
    this.addCommand({
      id: 'check-area-health',
      name: 'Check area health',
      callback: () => { void this.showAreaHealth(); }
    });
    this.addCommand({
      id: 'check-route-health',
      name: 'Check route health',
      callback: () => { void this.showRouteHealth(); }
    });

    this.addSettingTab(new ParaRouterSettingTab(this.app, this));
  }

  onunload() {
    for (const timer of this.timers.values()) window.clearTimeout(timer);
    this.timers.clear();
    this.stopFocusClock();
    this.persistFocusTimer();
    this.destroyFocusMini();
    this.app.workspace.detachLeavesOfType('qsection-actions');
    this.app.workspace.detachLeavesOfType('qsection-report');
    this.app.workspace.detachLeavesOfType('qsection-focus-window');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!Array.isArray(this.settings.focusRecords)) this.settings.focusRecords = [];
    if (!Array.isArray(this.settings.focusCheckins)) this.settings.focusCheckins = [];
    if (!this.settings.focusTimer || typeof this.settings.focusTimer !== 'object') this.settings.focusTimer = null;
    if (typeof this.settings.focusName !== 'string' || !this.settings.focusName.trim()) this.settings.focusName = '专注';
    if (!['auto', 'light', 'dark'].includes(this.settings.themeMode)) this.settings.themeMode = 'auto';
    if (typeof this.settings.glassTheme !== 'boolean') this.settings.glassTheme = false;
    if (!Array.isArray(this.settings.focusPresets)) this.settings.focusPresets = [];
    if (typeof this.settings.focusPresetId !== 'string' || !this.settings.focusPresetId) this.settings.focusPresetId = null;
    if (!Array.isArray(this.settings.checkinItems)) this.settings.checkinItems = [];
    if (!Array.isArray(this.settings.checkinRecords)) this.settings.checkinRecords = [];
    if (!Array.isArray(this.settings.favoritePaths)) this.settings.favoritePaths = [];
    if (!Array.isArray(this.settings.drafts)) this.settings.drafts = [];
    if (!Array.isArray(this.settings.writingProjects)) this.settings.writingProjects = [];
    if (!this.settings.captureConversions || typeof this.settings.captureConversions !== 'object') this.settings.captureConversions = {};
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  resolvedThemeMode(el) {
    if (this.settings.themeMode === 'light' || this.settings.themeMode === 'dark') return this.settings.themeMode;
    const doc = el && (el.doc || el.ownerDocument) || document;
    return doc.body && doc.body.classList.contains('theme-dark') ? 'dark' : 'light';
  }

  applyThemeClass(el) {
    const theme = this.resolvedThemeMode(el);
    el.classList.remove('qsection-theme-light', 'qsection-theme-dark');
    el.classList.add('qsection-theme-' + theme);
    el.classList.toggle('qsection-glass', !!this.settings.glassTheme);
    return theme;
  }

  async setGlassTheme(value) {
    this.settings.glassTheme = !!value;
    await this.saveSettings();
    if (this.focusMiniEl) this.applyThemeClass(this.focusMiniEl);
    this.app.workspace.trigger('qsection:theme-changed');
    new Notice(`Q-Section: 玻璃主题 ${this.settings.glassTheme ? '开' : '关'}`);
  }

  async setThemeMode(mode) {
    const next = ['auto', 'light', 'dark'].includes(mode) ? mode : 'auto';
    this.settings.themeMode = next;
    await this.saveSettings();
    if (this.focusMiniEl) this.applyThemeClass(this.focusMiniEl);
    this.app.workspace.trigger('qsection:theme-changed');
    new Notice(`Q-Section: 主题 = ${next}`);
  }

  async toggleThemeMode() {
    const order = ['auto', 'light', 'dark'];
    const current = order.indexOf(this.settings.themeMode);
    await this.setThemeMode(order[(current + 1) % order.length]);
  }

  async activateActionsView() {
    const existing = this.app.workspace.getLeavesOfType('qsection-actions');
    if (existing.length) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice('Q-Section: no right sidebar leaf.');
      return;
    }
    await leaf.setViewState({ type: 'qsection-actions', active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async activateReportView() {
    const existing = this.app.workspace.getLeavesOfType('qsection-report');
    if (existing.length) {
      await existing[0].loadIfDeferred?.();
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice('Q-Section: no right sidebar leaf.');
      return;
    }
    await leaf.setViewState({ type: 'qsection-report', active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async activateCalendarView() {
    const existing = this.app.workspace.getLeavesOfType('qsection-calendar');
    if (existing.length) {
      const current = existing[0];
      const root = current.getRoot?.();
      if (!root || root === this.app.workspace.rootSplit) {
        await current.loadIfDeferred?.();
        this.app.workspace.revealLeaf(current);
        return;
      }
      current.detach();
    }
    const right = this.app.workspace.rightSplit;
    if (right && !right.collapsed) right.collapse();
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({ type: 'qsection-calendar', active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  isIgnored(path) {
    return path.startsWith('06_System/')
      || path.startsWith('.obsidian/')
      || path.startsWith('.git/')
      || path.startsWith('.trash/')
      || path.startsWith('copilot/')
      || path.startsWith('09_Sources/')
      || path.startsWith('00_Inbox/WorkBuddy/');
  }

  schedule(file) {
    if (!this.settings.autoRoute) return;
    if (!(file instanceof TFile)) return;
    if (file.extension !== 'md') return;
    if (this.isIgnored(file.path)) return;

    const existing = this.timers.get(file.path);
    if (existing) window.clearTimeout(existing);

    const timer = window.setTimeout(async () => {
      this.timers.delete(file.path);
      const current = this.app.vault.getAbstractFileByPath(file.path);
      if (current instanceof TFile) await this.routeFile(current, { silent: true });
    }, this.settings.debounceMs);

    this.timers.set(file.path, timer);
  }

  getFrontmatter(file) {
    const cache = this.app.metadataCache.getFileCache(file);
    return cache && cache.frontmatter ? cache.frontmatter : null;
  }

  topicFolder(topic) {
    const map = this.rules && this.rules.topicFolders ? this.rules.topicFolders : DEFAULT_RULES.topicFolders;
    return topicFolderFromMap(topic, map);
  }

  applyTemplate(template, fm, value) {
    if (!template) return null;
    let out = String(template);
    out = out.replace(/\{year\}/g, yearOf(fm.date));
    out = out.replace(/\{topicFolder\}/g, this.topicFolder(fm.topic));
    out = out.replace(/\{noteKindFolder\}/g, this.safeFolderName(value));
    out = out.replace(/\{value\}/g, this.safeFolderName(value));
    return out;
  }

  targetFor(fm) {
    const type = textValue(fm.type).toLowerCase();
    if (!type) return null;
    const types = this.rules && this.rules.types ? this.rules.types : DEFAULT_RULES.types;
    const rule = types[type];
    if (!rule) return null;
    const field = rule.field || 'status';
    const rawValue = textValue(fm[field]);
    const value = rawValue.toLowerCase();
    const dueField = rule.dueField || '截止';
    if (rule.undatedRoutes && !textValue(fm[dueField]) && Object.prototype.hasOwnProperty.call(rule.undatedRoutes, value)) {
      return this.applyTemplate(rule.undatedRoutes[value], fm, rawValue);
    }
    if (rule.routes && Object.prototype.hasOwnProperty.call(rule.routes, value)) {
      return this.applyTemplate(rule.routes[value], fm, rawValue);
    }
    const rootValues = Array.isArray(rule.rootValues)
      ? rule.rootValues.map((item) => String(item).toLowerCase())
      : [];
    if (rootValues.includes(value)) {
      return this.applyTemplate(rule.rootTemplate, fm, rawValue);
    }
    if (rule.template) {
      return this.applyTemplate(rule.template, fm, rawValue);
    }
    if (rule.default) {
      return this.applyTemplate(rule.default, fm, rawValue);
    }
    return null;
  }

  async loadRules() {
    try {
      const file = this.app.vault.getAbstractFileByPath(RULES_PATH);
      if (!(file instanceof TFile)) {
        this.rules = DEFAULT_RULES;
        return;
      }
      const text = await this.app.vault.read(file);
      const parsed = JSON.parse(text);
      if (!parsed || !parsed.types) throw new Error('Invalid router rules');
      this.rules = parsed;
    } catch (e) {
      console.error('Q-Section: could not load rules, using previous/default rules', e);
      if (!this.rules) this.rules = DEFAULT_RULES;
      new Notice('Q-Section: rules load failed; using previous/default rules.');
    }
  }

  async reloadRules() {
    await this.loadRules();
    new Notice('Q-Section: rules reloaded.');
  }

  async ensureFolder(folderPath) {
    const parts = folderPath.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current = current ? current + '/' + part : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing instanceof TFolder) continue;
      if (existing) throw new Error('Path is a file: ' + current);
      await this.app.vault.createFolder(current);
    }
  }

  async appendLog(entry) {
    try {
      await this.ensureFolder('06_System/审计');
      await this.app.vault.adapter.append(LOG_PATH, JSON.stringify(entry) + '\n');
    } catch (e) {
      console.error('Q-Section: could not write log', e);
    }
  }

  async routeFile(file, opts) {
    if (!(file instanceof TFile)) return false;
    if (file.extension !== 'md') return false;
    if (this.isIgnored(file.path)) return false;

    const fm = this.getFrontmatter(file);
    if (!fm) return false;
    if (fm.routing === false) return false;

    const folder = this.targetFor(fm);
    if (!folder) return false;

    const targetPath = folder + '/' + file.basename + '.md';
    if (targetPath === file.path) return false;

    const existing = this.app.vault.getAbstractFileByPath(targetPath);
    if (existing) {
      if (!opts || !opts.silent) new Notice('Q-Section: target exists, skipped: ' + targetPath);
      await this.appendLog({
        time: new Date().toISOString(),
        action: 'skip',
        reason: 'target_exists',
        from: file.path,
        to: targetPath,
        type: textValue(fm.type)
      });
      return false;
    }

    const from = file.path;
    try {
      await this.ensureFolder(folder);
      await this.app.fileManager.renameFile(file, targetPath);
      await this.appendLog({
        time: new Date().toISOString(),
        action: 'move',
        from,
        to: targetPath,
        type: textValue(fm.type)
      });
      if (!opts || !opts.silent) new Notice('Q-Section: ' + from + ' -> ' + targetPath);
      return true;
    } catch (e) {
      console.error('Q-Section: move failed', e);
      if (!opts || !opts.silent) new Notice('Q-Section: move failed: ' + String(e));
      await this.appendLog({
        time: new Date().toISOString(),
        action: 'error',
        from,
        to: targetPath,
        message: String(e)
      });
      return false;
    }
  }

  async routeCurrentFile() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view && view.file ? view.file : this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('Q-Section: no active file.');
      return;
    }
    const moved = await this.routeFile(file);
    if (!moved) new Notice('Q-Section: nothing to move.');
  }

  async routeAllFiles() {
    const files = this.app.vault.getMarkdownFiles();
    let moved = 0;
    for (const file of files) {
      const ok = await this.routeFile(file, { silent: true });
      if (ok) moved++;
    }
    new Notice('Q-Section: moved ' + moved + ' file(s).');
  }

  async previewRouting() {
    const files = this.app.vault.getMarkdownFiles();
    const lines = [];
    for (const file of files) {
      if (file.extension !== 'md') continue;
      if (this.isIgnored(file.path)) continue;
      const fm = this.getFrontmatter(file);
      if (!fm) continue;
      if (fm.routing === false) continue;
      const folder = this.targetFor(fm);
      if (!folder) continue;
      const targetPath = folder + '/' + file.basename + '.md';
      if (targetPath !== file.path) lines.push(file.path + ' -> ' + targetPath);
    }
    new PreviewModal(this.app, lines).open();
  }

  getRelationTargets(kind) {
    const type = { area: 'area', project: 'project', task: 'task', note: 'note' }[kind];
    if (!type) return [];
    return this.app.vault.getMarkdownFiles()
      .filter((file) => !this.isIgnored(file.path))
      .filter((file) => file.path !== this.relationSourcePath)
      .filter((file) => textValue((this.getFrontmatter(file) || {}).type).toLowerCase() === type)
      .sort((a, b) => a.basename.localeCompare(b.basename));
  }

  startRelation(kind) {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== 'md') {
      new Notice('Q-Section: 先打开一篇 Markdown 笔记。');
      return;
    }
    this.relationSourcePath = file.path;
    new RelationSuggestModal(this.app, this, kind, file).open();
  }

  async applyRelation(sourceFile, kind, targetFile) {
    if (!(sourceFile instanceof TFile) || !(targetFile instanceof TFile)) return;
    const fm = this.getFrontmatter(sourceFile) || {};
    const sourceType = textValue(fm.type).toLowerCase();
    const labels = { area: '领域', project: '项目', task: '任务', note: '笔记' };
    const link = `[[${targetFile.path}|${targetFile.basename}]]`;
    let field = null;
    if (kind === 'area' && sourceType === 'project') field = 'area';
    if (kind === 'area' && sourceType === 'task') field = '关联领域';
    if (kind === 'project' && (sourceType === 'task' || sourceType === 'content')) field = 'project';

    if (field) {
      const current = textValue(fm[field]);
      if (current && this.linkName(current) !== targetFile.basename) {
        new Notice(`Q-Section: ${field} 已有值（${current}），未覆盖。`);
        return;
      }
      if (current && this.linkName(current) === targetFile.basename) {
        new Notice('Q-Section: 已经关联过了。');
        return;
      }
      await this.app.fileManager.processFrontMatter(sourceFile, (data) => {
        data[field] = link;
      });
      new Notice(`Q-Section: 已关联${labels[kind]}：${targetFile.basename}`);
      this.schedule(sourceFile);
      return;
    }

    let added = false;
    await this.app.vault.process(sourceFile, (text) => {
      const next = this.appendRelationLink(text, targetFile, link);
      added = next !== text;
      return next;
    });
    new Notice(added ? `Q-Section: 已添加${labels[kind]}关联：${targetFile.basename}` : 'Q-Section: 已经关联过了。');
  }

  appendRelationLink(text, targetFile, link) {
    const pathLink = `[[${targetFile.path}`;
    const nameLink = `[[${targetFile.basename}`;
    if (text.includes(pathLink) || text.includes(nameLink)) return text;
    const line = `- ${link}`;
    const heading = /^##\s*关联\s*$/m.exec(text);
    if (heading) {
      const index = heading.index + heading[0].length;
      return text.slice(0, index) + '\n' + line + text.slice(index);
    }
    return text.replace(/\s*$/, '') + '\n\n## 关联\n\n' + line + '\n';
  }

  async completeCurrentObject() {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== 'md') {
      new Notice('Q-Section: 先打开一篇 Markdown 笔记。');
      return;
    }
    const fm = this.getFrontmatter(file) || {};
    const type = textValue(fm.type).toLowerCase();
    let next = '';
    let label = '';
    if (type === 'task') { next = 'done'; label = '任务'; }
    else if (type === 'project') { next = 'done'; label = '项目'; }
    else if (type === 'area') { next = 'archived'; label = '领域'; }
    else {
      new Notice('Q-Section: 只支持任务、项目、领域；内容请改 content_stage。');
      return;
    }
    const current = textValue(fm.status);
    if (current === next) {
      new Notice('Q-Section: 已经是完成/归档状态。');
      return;
    }
    if ((type === 'project' || type === 'area') && !window.confirm(`把${label}「${file.basename}」标记为 ${next}？`)) return;
    await this.app.fileManager.processFrontMatter(file, (data) => {
      data.status = next;
    });
    new Notice(`Q-Section: ${label}已标记 ${next}。`);
    this.schedule(file);
  }

  async setTaskDueDate(file, due) {
    if (!(file instanceof TFile)) return;
    const value = String(due || '').trim();
    if (value && !window.moment(value, 'YYYY-MM-DD', true).isValid()) {
      new Notice('Q-Section: 截止日期要写成 YYYY-MM-DD。');
      return;
    }
    await this.app.fileManager.processFrontMatter(file, (data) => {
      data['截止'] = value;
    });
    new Notice(value ? `Q-Section: 截止日期 = ${value}` : 'Q-Section: 已清空截止日期。');
  }

  async setContentStage(file, stage) {
    if (!(file instanceof TFile)) return;
    const stages = ['idea', 'draft', 'asset', 'published', 'review', 'archived'];
    if (!stages.includes(stage)) return;
    await this.app.fileManager.processFrontMatter(file, (data) => {
      data.content_stage = stage;
    });
    new Notice(`Q-Section: 内容阶段 = ${stage}`);
    this.schedule(file);
  }

  async collectHealthObjects() {
    const files = this.app.vault.getMarkdownFiles().filter((file) => !this.isIgnored(file.path));
    const objects = [];
    for (const file of files) {
      const fm = this.getFrontmatter(file);
      if (!fm) continue;
      const type = textValue(fm.type).toLowerCase();
      if (type) objects.push({ file, fm, type });
    }
    return objects;
  }

  async showAreaHealth() {
    const objects = await this.collectHealthObjects();
    const areas = objects.filter((item) => item.type === 'area');
    const projects = objects.filter((item) => item.type === 'project');
    const areaNames = new Set(areas.map((item) => item.file.basename));
    const projectsOf = (area) => projects.filter((project) => this.linkName(textValue(project.fm.area)) === area.file.basename);
    const activeAreas = areas.filter((area) => textValue(area.fm.status) === 'active');
    const noProjects = areas.filter((area) => projectsOf(area).length === 0);
    const idleAreas = activeAreas.filter((area) => projectsOf(area).filter((project) => textValue(project.fm.status) === 'active').length === 0);
    const missingArea = projects.filter((project) => !textValue(project.fm.area));
    const unknownArea = projects.filter((project) => {
      const name = this.linkName(textValue(project.fm.area));
      return name && !areaNames.has(name);
    });
    const weakAreas = areas.filter((area) => !textValue(area.fm['目标']) || !textValue(area.fm['核心方向']));
    const toItems = (items, meta) => items.map((item) => ({ title: item.file.basename, meta: typeof meta === 'function' ? meta(item) : meta, path: item.file.path }));
    const sections = [
      { title: '活跃领域无进行中项目', tone: 'warning', items: toItems(idleAreas, 'active 但没有 active 项目'), empty: '没有这种领域。' },
      { title: '领域没有项目', tone: 'warning', items: toItems(noProjects, '0 个项目'), empty: '所有领域都挂了项目。' },
      { title: '项目缺领域', tone: 'warning', items: toItems(missingArea, '缺 area 字段'), empty: '所有项目都有领域。' },
      { title: '项目指向不存在的领域', tone: 'warning', items: toItems(unknownArea, (item) => this.linkName(textValue(item.fm.area))), empty: '没有断链领域。' },
      { title: '领域缺目标/核心方向', tone: 'warning', items: toItems(weakAreas, '目标或核心方向为空'), empty: '领域字段完整。' }
    ];
    const total = sections.reduce((sum, section) => sum + section.items.length, 0);
    new HealthModal(
      this.app,
      this,
      '领域体检',
      `领域 ${areas.length} 个 · 项目 ${projects.length} 个 · 发现 ${total} 个需要关注的点。`,
      sections
    ).open();
  }

  async showRouteHealth() {
    const objects = await this.collectHealthObjects();
    const types = this.rules && this.rules.types ? this.rules.types : DEFAULT_RULES.types;
    const unknown = [];
    const missingField = [];
    const unmapped = [];
    const conflict = [];
    const misplaced = [];
    for (const item of objects) {
      const { file, fm, type } = item;
      if (fm.routing === false) continue;
      const rule = types[type];
      if (!rule) {
        unknown.push({ title: file.basename, meta: `未知 type: ${type}`, path: file.path });
        continue;
      }
      const field = rule.field || 'status';
      const rootValues = Array.isArray(rule.rootValues)
        ? rule.rootValues.map((value) => String(value).toLowerCase())
        : [];
      if (!textValue(fm[field]) && !rootValues.includes('')) {
        missingField.push({ title: file.basename, meta: `缺 ${field}`, path: file.path });
        continue;
      }
      const folder = this.targetFor(fm);
      if (!folder) {
        unmapped.push({ title: file.basename, meta: `${field} = ${textValue(fm[field])} 无匹配路由`, path: file.path });
        continue;
      }
      const targetPath = folder + '/' + file.basename + '.md';
      if (targetPath === file.path) continue;
      if (this.app.vault.getAbstractFileByPath(targetPath)) {
        conflict.push({ title: file.basename, meta: '目标已存在：' + targetPath, path: file.path });
      } else {
        misplaced.push({ title: file.basename, meta: '应在：' + targetPath, path: file.path });
      }
    }
    const sections = [
      { title: '未知 type', tone: 'warning', items: unknown.slice(0, 50), empty: '没有未知类型。' },
      { title: '缺路由字段', tone: 'warning', items: missingField.slice(0, 50), empty: '路由字段都完整。' },
      { title: '无匹配路由', tone: 'warning', items: unmapped.slice(0, 50), empty: '所有字段值都有匹配路由。' },
      { title: '目标文件冲突', tone: 'warning', items: conflict.slice(0, 50), empty: '没有目标冲突。' },
      { title: '未在目标目录', tone: 'warning', items: misplaced.slice(0, 50), empty: '所有文件都在目标目录。' }
    ];
    const total = unknown.length + missingField.length + unmapped.length + conflict.length + misplaced.length;
    new HealthModal(
      this.app,
      this,
      '路由健康',
      `检查 ${objects.length} 个对象 · 发现 ${total} 个问题。这里只报告，不移动文件。`,
      sections
    ).open();
  }

  async undoLastRoute() {
    try {
      const raw = await this.app.vault.adapter.read(LOG_PATH);
      const lines = raw.split('\n').filter((line) => line.trim() !== '');
      for (let i = lines.length - 1; i >= 0; i--) {
        const entry = JSON.parse(lines[i]);
        if (entry.action !== 'move') continue;
        const target = this.app.vault.getAbstractFileByPath(entry.to);
        if (!(target instanceof TFile)) {
          new Notice('Q-Section: last move target no longer exists.');
          return;
        }
        const original = this.app.vault.getAbstractFileByPath(entry.from);
        if (original) {
          new Notice('Q-Section: original path already exists, skipped.');
          return;
        }
        const parent = entry.from.split('/').slice(0, -1).join('/');
        if (parent) await this.ensureFolder(parent);
        await this.app.fileManager.renameFile(target, entry.from);
        await this.appendLog({
          time: new Date().toISOString(),
          action: 'undo',
          from: entry.to,
          to: entry.from
        });
        new Notice('Q-Section: restored ' + entry.from);
        return;
      }
      new Notice('Q-Section: no move to undo.');
    } catch (e) {
      console.error('Q-Section: undo failed', e);
      new Notice('Q-Section: undo failed: ' + String(e));
    }
  }

  templateFor(kind) {
    const map = {
      project: '06_System/模板/项目.md',
      area: '06_System/模板/领域.md',
      resource: '06_System/模板/资源.md',
      content: '06_System/模板/内容.md',
      task: '06_System/模板/任务.md',
      note: '06_System/模板/笔记.md',
      'journal-daily': '06_System/模板/日志-日.md',
      'journal-weekly': '06_System/模板/日志-周.md',
      'journal-monthly': '06_System/模板/日志-月.md',
      'journal-quarterly': '06_System/模板/日志-季.md',
      'journal-yearly': '06_System/模板/日志-年.md'
    };
    return map[kind] || '';
  }

  initialFolder(kind) {
    const year = window.moment().format('YYYY');
    if (kind === 'project') return '01_Projects/Active';
    if (kind === 'area') return '02_Areas';
    if (kind === 'resource') return '03_Resources/Other';
    if (kind === 'content') return '05_Content/00 选题';
    if (kind === 'task') return '08_Tasks/Todo';
    if (kind === 'note') return '03_Resources/Other/Notes';
    if (kind === 'journal-daily') return '07_Journal/Daily/' + year;
    if (kind === 'journal-weekly') return '07_Journal/Weekly/' + year;
    if (kind === 'journal-monthly') return '07_Journal/Monthly/' + year;
    if (kind === 'journal-quarterly') return '07_Journal/Quarterly/' + year;
    if (kind === 'journal-yearly') return '07_Journal/Yearly/' + year;
    return '00_Inbox';
  }

  defaultTitle(kind) {
    if (kind === 'project') return '未命名项目';
    if (kind === 'area') return '未命名领域';
    if (kind === 'resource') return '未命名资源';
    if (kind === 'content') return '未命名内容';
    if (kind === 'task') return '未命名任务';
    if (kind === 'note') return '未命名笔记';
    if (kind === 'journal-daily') return window.moment().format('YYYY-MM-DD');
    if (kind === 'journal-weekly') return window.moment().format('gggg-[W]ww');
    if (kind === 'journal-monthly') return window.moment().format('YYYY-MM');
    if (kind === 'journal-quarterly') return window.moment().format('YYYY-[Q]Q');
    if (kind === 'journal-yearly') return window.moment().format('YYYY');
    return '未命名';
  }

  promptTitle(defaultValue) {
    return new Promise((resolve) => {
      new PromptModal(
        this.app,
        '新建',
        '输入标题',
        defaultValue,
        (value) => resolve(value),
        () => resolve(null)
      ).open();
    });
  }

  renderTemplate(content, title) {
    const now = window.moment();
    let out = String(content || '');
    out = out.replace(/^(---\r?\n)([\s\S]*?)(\r?\n---)/, (match, open, frontmatter, close) => {
      const rendered = frontmatter.replace(/"\{\{date(?::([^}]+))?\}\}"/g, (token, format) => (
        format ? now.format(format) : now.format('YYYY-MM-DD')
      ));
      return open + rendered + close;
    });
    out = out.split('{{title}}').join(title);
    out = out.split('{{date:YYYY-MM-DD}}').join(now.format('YYYY-MM-DD'));
    out = out.split('{{date:YYYY-MM}}').join(now.format('YYYY-MM'));
    out = out.split('{{date:gggg-[W]ww}}').join(now.format('gggg-[W]ww'));
    out = out.split('{{date:YYYY-[Q]Q}}').join(now.format('YYYY-[Q]Q'));
    out = out.split('{{date:YYYY}}').join(now.format('YYYY'));
    out = out.split('{{date:Q}}').join(now.format('Q'));
    out = out.split('{{date}}').join(now.format('YYYY-MM-DD'));
    out = out.split('{{time}}').join(now.format('HH:mm'));
    return out;
  }

  safeName(title) {
    const cleaned = String(title).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    return (cleaned || '未命名').slice(0, 80);
  }

  safeFolderName(name) {
    const cleaned = String(name).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    return (cleaned || 'Other').slice(0, 40);
  }

  async uniquePath(path) {
    if (!this.app.vault.getAbstractFileByPath(path)) return path;
    const ext = path.endsWith('.md') ? '.md' : '';
    const base = path.slice(0, path.length - ext.length);
    let i = 2;
    while (this.app.vault.getAbstractFileByPath(base + '-' + i + ext)) i++;
    return base + '-' + i + ext;
  }

  async createFromTemplate(kind) {
    const title = await this.promptTitle(this.defaultTitle(kind));
    if (!title) return null;
    return this.createFromTemplateWithTitle(kind, title);
  }

  async createFromTemplateWithTitle(kind, title) {
    if (!title) return null;
    const templatePath = this.templateFor(kind);
    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
    if (!(templateFile instanceof TFile)) {
      new Notice('Q-Section: template not found: ' + templatePath);
      return;
    }
    let content = await this.app.vault.read(templateFile);
    content = this.renderTemplate(content, title);
    if (kind === 'area') {
      return this.createAreaWithViews(title, content);
    }
    const folder = this.initialFolder(kind);
    await this.ensureFolder(folder);
    const path = await this.uniquePath(folder + '/' + this.safeName(title) + '.md');
    const file = await this.app.vault.create(path, content);
    await this.app.workspace.getLeaf(true).openFile(file);
    new Notice('Q-Section: created ' + path);
    return file;
  }

  async createAreaWithViews(title, content) {
    const base = this.safeName(title);
    const folder = '02_Areas/' + base;
    await this.ensureFolder(folder);
    const path = await this.uniquePath(folder + '/' + base + '.md');
    const file = await this.app.vault.create(path, content);
    await this.createAreaViewNotes(folder, file);
    await this.app.workspace.getLeaf(true).openFile(file);
    new Notice('Q-Section: created ' + path);
    return file;
  }

  async createAreaViewNotes(folder, areaFile) {
    const areaPath = areaFile.path.replace(/\.md$/i, '');
    const areaName = areaFile.basename;
    const link = 'link(' + JSON.stringify(areaPath) + ')';
    const views = [
      {
        suffix: '关联笔记',
        intro: '笔记的 `area` 指向本领域，或正文链接到本领域时，会自动出现在下表。',
        filters: [
          '    - file.hasLink(' + link + ')',
          '    - or:',
          '        - note["type"] == "note"',
          '        - note["type"] == "resource"',
          '        - note["type"] == "content"',
          '    - or:',
          '        - file.inFolder("03_Resources")',
          '        - file.inFolder("05_Content")',
          '        - file.path == "06_System/账号资料.md"'
        ],
        columns: ['file.name', 'note_kind', 'topic'],
        sort: 'file.name'
      },
      {
        suffix: '关联任务',
        intro: '把任务的 `关联领域` 指向本领域，或正文链接本领域，就会出现在下表。',
        filters: [
          '    - file.hasLink(' + link + ')',
          '    - note["type"] == "task"'
        ],
        columns: ['file.name', 'status', '截止', 'project'],
        sort: 'status'
      },
      {
        suffix: '关联项目',
        intro: '项目的 `area` 指向本领域，或正文链接到本领域时，会自动出现在下表。',
        filters: [
          '    - file.hasLink(' + link + ')',
          '    - note["type"] == "project"'
        ],
        columns: ['file.name', 'status', '目标', '完成定义'],
        sort: 'status'
      }
    ];
    for (const view of views) {
      const name = areaName + ' - ' + view.suffix;
      const path = await this.uniquePath(folder + '/' + name + '.md');
      const body = [
        '---',
        'type: note',
        'note_kind: 领域视图',
        'routing: false',
        'tags: []',
        '---',
        '',
        '# ' + name,
        '',
        '> ' + view.intro,
        '',
        '```base',
        'filters:',
        '  and:',
        '    - file.ext == "md"',
        ...view.filters,
        'views:',
        '  - type: table',
        '    name: ' + view.suffix,
        '    limit: 50',
        '    order:',
        ...view.columns.map((column) => '      - ' + column),
        '    sort:',
        '      - property: ' + view.sort,
        '        direction: ASC',
        '```',
        ''
      ].join('\n');
      await this.app.vault.create(path, body);
    }
  }

  openBase(name) {
    const path = '06_System/Bases/' + name + '.base';
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      void this.app.workspace.getLeaf(true).openFile(file);
    } else {
      new Notice('Q-Section: base not found: ' + path);
    }
  }

  async openQReport() {
    await this.activateReportView();
  }

  async openFocusTab() {
    await this.activateReportView();
    const leaf = this.app.workspace.getLeavesOfType('qsection-report')[0];
    if (!leaf) return;
    await leaf.loadIfDeferred?.();
    if (leaf.view && leaf.view.contentEl) {
      leaf.view.activeTab = 'rhythm';
      leaf.view.subTabs.rhythm = 'focus';
      leaf.view.render();
      this.app.workspace.revealLeaf(leaf);
    }
  }

  async openCheckinTab() {
    await this.activateReportView();
    const leaf = this.app.workspace.getLeavesOfType('qsection-report')[0];
    if (!leaf) return;
    await leaf.loadIfDeferred?.();
    if (leaf.view && leaf.view.contentEl) {
      leaf.view.activeTab = 'rhythm';
      leaf.view.subTabs.rhythm = 'checkin';
      leaf.view.render();
      this.app.workspace.revealLeaf(leaf);
    }
  }

  insertBaseBlock(kind) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = view && view.editor ? view.editor : null;
    if (!editor) {
      new Notice('Q-Section: 请先打开一篇笔记。');
      return;
    }
    const block = kind === 'tasks' ? this.projectTaskBase() : this.projectContentBase();
    editor.replaceSelection('\n' + block + '\n');
  }

  projectTaskBase() {
    return [
      '```base',
      'filters:',
      '  and:',
      '    - file.inFolder("08_Tasks")',
      '    - note["type"] == "task"',
      '    - or:',
      '        - note["project"].contains(this.file.asLink())',
      '        - note["project"] == this.file.asLink()',
      'views:',
      '  - type: table',
      '    name: 关联任务',
      '    order:',
      '      - file.name',
      '      - status',
      '      - 截止',
      '```'
    ].join('\n');
  }

  projectContentBase() {
    return [
      '```base',
      'filters:',
      '  and:',
      '    - file.inFolder("05_Content")',
      '    - note["type"] == "content"',
      '    - or:',
      '        - note["project"].contains(this.file.asLink())',
      '        - note["project"] == this.file.asLink()',
      'views:',
      '  - type: table',
      '    name: 关联内容',
      '    order:',
      '      - file.name',
      '      - content_stage',
      '      - platform',
      '      - 发布日期',
      '```'
    ].join('\n');
  }

  getFocusPresets() {
    return (Array.isArray(this.settings.focusPresets) ? this.settings.focusPresets : [])
      .filter((preset) => preset && preset.id && preset.name);
  }

  async addFocusPreset(name, minutes, mode) {
    const title = String(name || '').trim().slice(0, 40);
    const presetMode = mode === 'stopwatch' ? 'stopwatch' : 'countdown';
    const value = presetMode === 'stopwatch' ? 0 : Math.min(360, Math.max(1, Math.round(Number(minutes) || 0)));
    if (!title) {
      new Notice('Q-Section: 专注项目名称不能为空。');
      return null;
    }
    if (presetMode === 'countdown' && !value) {
      new Notice('Q-Section: 倒计时时长要在 1–360 分钟之间。');
      return null;
    }
    const presets = this.getFocusPresets();
    const existing = presets.find((item) => item.name.toLowerCase() === title.toLowerCase());
    const preset = {
      id: existing ? existing.id : `fp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: title,
      minutes: value,
      mode: presetMode,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.settings.focusPresets = existing
      ? presets.map((item) => item.id === existing.id ? preset : item)
      : presets.concat(preset);
    await this.saveSettings();
    this.emitFocusChanged();
    return preset;
  }

  async removeFocusPreset(id) {
    const preset = this.getFocusPresets().find((item) => item.id === id);
    if (!preset) return false;
    this.settings.focusPresets = this.getFocusPresets().filter((item) => item.id !== id);
    if (this.settings.focusPresetId === id) this.settings.focusPresetId = null;
    if (this.focusPresetId === id) this.focusPresetId = null;
    if (this.settings.focusTimer && typeof this.settings.focusTimer === 'object' && this.settings.focusTimer.presetId === id) {
      this.settings.focusTimer.presetId = null;
    }
    await this.saveSettings();
    this.emitFocusChanged();
    return true;
  }

  applyFocusPreset(id) {
    const preset = this.getFocusPresets().find((item) => item.id === id);
    if (!preset) return;
    if (this.focusStatus === 'running' || this.focusStatus === 'paused') {
      new Notice('Q-Section: 先结束当前计时再切换专注项目。');
      return;
    }
    this.focusPresetId = preset.id;
    this.focusName = preset.name;
    this.focusMode = preset.mode === 'stopwatch' ? 'stopwatch' : 'countdown';
    if (this.focusMode === 'countdown') {
      this.focusDuration = Math.min(360 * 60, Math.max(60, (Number(preset.minutes) || 25) * 60));
    }
    this.focusBaseElapsed = 0;
    this.focusStartedAt = null;
    this.focusStatus = 'idle';
    this.focusSessionStart = null;
    this.focusPlanRef = null;
    this.stopFocusClock();
    this.settings.focusName = this.focusName;
    this.settings.focusPresetId = this.focusPresetId;
    this.persistFocusTimer();
    this.emitFocusChanged();
  }

  clearFocusPreset() {
    this.focusPresetId = null;
    this.settings.focusPresetId = null;
    this.persistFocusTimer();
    this.emitFocusChanged();
  }

  formatFocusClock(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  async showFocusPopout() {
    if (!Platform.isDesktopApp) {
      new Notice('Q-Section: 桌面小窗只在桌面版 Obsidian 可用。');
      return;
    }
    if (typeof this.app.workspace.openPopoutLeaf !== 'function') {
      new Notice('Q-Section: 当前 Obsidian 版本不支持独立窗口。');
      this.showFocusMini();
      return;
    }
    const existing = this.app.workspace.getLeavesOfType('qsection-focus-window');
    if (existing.length) {
      await existing[0].loadIfDeferred?.();
      const view = existing[0].view;
      if (view && typeof view.applyWindowLayout === 'function') view.applyWindowLayout();
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    if (this.focusWindowOpening) return;
    this.focusWindowOpening = true;
    let leaf = null;
    try {
      const screenInfo = (typeof window !== 'undefined' && window.screen) ? window.screen : {};
      const margin = 8;
      const init = { size: { width: 240, height: 240 } };
      if (Number.isFinite(screenInfo.availWidth) && screenInfo.availWidth > 0) {
        const availLeft = Number.isFinite(screenInfo.availLeft) ? screenInfo.availLeft : 0;
        const availTop = Number.isFinite(screenInfo.availTop) ? screenInfo.availTop : 0;
        init.x = Math.round(availLeft + screenInfo.availWidth - 254 - margin);
        init.y = Math.round(availTop + margin);
      }
      leaf = this.app.workspace.openPopoutLeaf(init);
      await leaf.setViewState({ type: 'qsection-focus-window', active: true });
    } catch (err) {
      if (leaf) leaf.detach();
      new Notice('Q-Section: 打开桌面小窗失败：' + (err && err.message ? err.message : err));
      this.showFocusMini();
    } finally {
      this.focusWindowOpening = false;
    }
  }

  showFocusMini() {
    if (this.focusMiniEl) {
      this.focusMiniEl.style.display = 'flex';
      this.updateFocusMini();
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'qsection-focus-mini';
    this.applyThemeClass(wrap);
    const pos = this.settings.focusMiniPos;
    wrap.style.left = (pos && Number.isFinite(pos.left) ? pos.left : Math.max(10, window.innerWidth - 280)) + 'px';
    wrap.style.top = (pos && Number.isFinite(pos.top) ? pos.top : Math.max(10, window.innerHeight - 210)) + 'px';
    wrap.innerHTML = [
      '<div class="qsection-focus-mini-head" data-drag>',
      '  <span class="qsection-focus-mini-title">专注</span>',
      '  <button class="qsection-focus-mini-close" type="button" title="收起小窗">×</button>',
      '</div>',
      '<div class="qsection-focus-mini-time">25:00</div>',
      '<div class="qsection-focus-mini-status">未开始</div>',
      '<div class="qsection-focus-mini-progress"><div class="qsection-focus-mini-progress-fill"></div></div>',
      '<div class="qsection-focus-mini-actions">',
      '  <button type="button" data-action="toggle">开始</button>',
      '  <button type="button" data-action="finish">结束</button>',
      '  <button type="button" data-action="console">操作台</button>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    this.focusMiniEl = wrap;
    this.focusMiniRefs = {
      title: wrap.querySelector('.qsection-focus-mini-title'),
      time: wrap.querySelector('.qsection-focus-mini-time'),
      status: wrap.querySelector('.qsection-focus-mini-status'),
      progress: wrap.querySelector('.qsection-focus-mini-progress-fill'),
      toggle: wrap.querySelector('[data-action="toggle"]'),
      finish: wrap.querySelector('[data-action="finish"]'),
      close: wrap.querySelector('.qsection-focus-mini-close'),
      head: wrap.querySelector('[data-drag]')
    };

    this.focusMiniRefs.close.addEventListener('click', () => this.hideFocusMini());
    this.focusMiniRefs.toggle.addEventListener('click', () => {
      if (this.focusStatus === 'running') this.pauseFocusTimer();
      else this.startFocusTimer();
    });
    this.focusMiniRefs.finish.addEventListener('click', () => { void this.finishFocusTimer(false); });
    wrap.querySelector('[data-action="console"]').addEventListener('click', () => { void this.activateActionsView(); });

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    this.focusMiniRefs.head.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = parseInt(wrap.style.left, 10) || 0;
      startTop = parseInt(wrap.style.top, 10) || 0;
      this.focusMiniRefs.head.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    this.focusMiniRefs.head.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const width = wrap.offsetWidth || 240;
      const height = wrap.offsetHeight || 150;
      const left = Math.max(0, Math.min(window.innerWidth - width, startLeft + event.clientX - startX));
      const top = Math.max(0, Math.min(window.innerHeight - height, startTop + event.clientY - startY));
      wrap.style.left = left + 'px';
      wrap.style.top = top + 'px';
    });
    this.focusMiniRefs.head.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      this.settings.focusMiniPos = {
        left: parseInt(wrap.style.left, 10) || 0,
        top: parseInt(wrap.style.top, 10) || 0
      };
      void this.saveSettings();
    });

    this.updateFocusMini();
  }

  hideFocusMini() {
    if (this.focusMiniEl) this.focusMiniEl.style.display = 'none';
  }

  updateFocusMini() {
    if (!this.focusMiniEl || !this.focusMiniRefs) return;
    const snap = this.getFocusSnapshot();
    const refs = this.focusMiniRefs;
    refs.title.textContent = snap.name || '专注';
    refs.time.textContent = this.formatFocusClock(snap.displaySeconds);
    const statusText = { idle: '未开始', running: '进行中', paused: '已暂停', done: '已完成' }[snap.status] || '未开始';
    refs.status.textContent = statusText + ' · ' + (snap.mode === 'stopwatch' ? '正计时' : '倒计时');
    refs.progress.style.width = Math.round(snap.progress * 100) + '%';
    refs.toggle.textContent = snap.status === 'running' ? '暂停' : snap.status === 'paused' ? '继续' : snap.status === 'done' ? '再来一轮' : '开始';
    refs.finish.disabled = !(snap.status === 'running' || snap.status === 'paused');
  }

  destroyFocusMini() {
    if (this.focusMiniEl) this.focusMiniEl.remove();
    this.focusMiniEl = null;
    this.focusMiniRefs = null;
  }

  initFocusTimer() {
    const timer = this.settings.focusTimer;
    this.focusMode = timer && timer.mode === 'stopwatch' ? 'stopwatch' : 'countdown';
    this.focusName = timer && typeof timer.name === 'string' && timer.name.trim()
      ? timer.name.trim().slice(0, 40)
      : (this.settings.focusName || '专注');
    const storedPresetId = timer && typeof timer.presetId === 'string'
      ? timer.presetId
      : (this.settings.focusPresetId || null);
    this.focusPresetId = storedPresetId && this.getFocusPresets().some((preset) => preset.id === storedPresetId)
      ? storedPresetId
      : null;
    const duration = timer ? Number(timer.duration) : NaN;
    this.focusDuration = Number.isFinite(duration) ? Math.min(360 * 60, Math.max(60, duration)) : 25 * 60;
    const base = timer ? Number(timer.baseElapsed) : 0;
    this.focusBaseElapsed = Number.isFinite(base) ? Math.max(0, base) : 0;
    this.focusStartedAt = timer && typeof timer.startedAt === 'number' ? timer.startedAt : null;
    this.focusStatus = timer && ['idle', 'running', 'paused', 'done'].includes(timer.status) ? timer.status : 'idle';
    this.focusSessionStart = timer && typeof timer.sessionStart === 'number' ? timer.sessionStart : null;
    this.focusSegments = timer && Array.isArray(timer.segments)
      ? timer.segments.filter((segment) => segment && Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end >= segment.start)
      : [];
    this.focusPlanRef = timer && timer.planRef && typeof timer.planRef === 'object' ? timer.planRef : null;
    this.focusCompleting = false;
    this.focusClock = null;
    this.focusMiniEl = null;
    this.focusMiniRefs = null;
    if (this.focusStatus === 'running' && !this.focusStartedAt) this.focusStartedAt = Date.now();
    if (this.focusStatus === 'running') {
      this.startFocusClock();
      window.setTimeout(() => this.tickFocusClock(), 1000);
      this.app.workspace.onLayoutReady(() => {
        window.setTimeout(() => {
          if (this.focusStatus !== 'running') return;
          if (Platform.isDesktopApp) void this.showFocusPopout();
          else this.showFocusMini();
        }, 300);
      });
    }
  }

  emitFocusChanged() {
    this.app.workspace.trigger('qsection:focus-changed');
    this.updateFocusMini();
  }

  getFocusSnapshot() {
    const elapsed = this.currentFocusElapsed();
    const remaining = this.focusMode === 'countdown' ? Math.max(0, this.focusDuration - elapsed) : Math.min(12 * 3600, elapsed);
    const progress = this.focusMode === 'countdown'
      ? (this.focusDuration ? Math.min(1, elapsed / this.focusDuration) : 0)
      : Math.min(1, elapsed / (12 * 3600));
    return {
      mode: this.focusMode,
      name: this.focusName,
      presetId: this.focusPresetId,
      status: this.focusStatus,
      duration: this.focusDuration,
      elapsed,
      remaining,
      progress,
      displaySeconds: this.focusMode === 'countdown'
        ? (this.focusStatus === 'done' && this.focusBaseElapsed < this.focusDuration ? this.focusBaseElapsed : remaining)
        : Math.min(12 * 3600, elapsed)
    };
  }

  currentFocusElapsed() {
    const running = this.focusStatus === 'running' && this.focusStartedAt;
    return this.focusBaseElapsed + (running ? Math.max(0, (Date.now() - this.focusStartedAt) / 1000) : 0);
  }

  startFocusClock() {
    this.stopFocusClock();
    this.focusClock = window.setInterval(() => this.tickFocusClock(), 1000);
  }

  stopFocusClock() {
    if (this.focusClock) window.clearInterval(this.focusClock);
    this.focusClock = null;
  }

  tickFocusClock() {
    if (this.focusStatus !== 'running') return;
    const elapsed = this.currentFocusElapsed();
    if (this.focusMode === 'countdown' && elapsed >= this.focusDuration) {
      void this.finishFocusTimer(true);
      return;
    }
    if (this.focusMode === 'stopwatch' && elapsed >= 12 * 3600) {
      void this.finishFocusTimer(true);
      return;
    }
    this.emitFocusChanged();
  }

  persistFocusTimer() {
    this.settings.focusName = this.focusName || '专注';
    this.settings.focusPresetId = this.focusPresetId || null;
    if (this.focusStatus === 'idle' && !this.focusBaseElapsed) {
      this.settings.focusTimer = null;
    } else {
      this.settings.focusTimer = {
        mode: this.focusMode,
        name: this.focusName,
        presetId: this.focusPresetId,
        duration: this.focusDuration,
        baseElapsed: this.focusBaseElapsed,
        startedAt: this.focusStartedAt,
        status: this.focusStatus,
        sessionStart: this.focusSessionStart,
        segments: this.focusSegments || [],
        planRef: this.focusPlanRef || null
      };
    }
    void this.saveSettings();
  }

  setFocusName(name) {
    const value = String(name || '').trim().slice(0, 40) || '专注';
    if (value === this.focusName) return;
    this.focusPlanRef = null;
    this.focusPresetId = null;
    this.settings.focusPresetId = null;
    this.focusName = value;
    this.settings.focusName = value;
    if (this.focusStatus !== 'idle' || this.focusBaseElapsed) this.persistFocusTimer();
    else void this.saveSettings();
    this.emitFocusChanged();
  }

  setFocusMode(mode) {
    if (this.focusStatus === 'running' || this.focusStatus === 'paused') {
      new Notice('Q-Section: 先结束当前计时再切换模式。');
      return;
    }
    const nextMode = mode === 'stopwatch' ? 'stopwatch' : 'countdown';
    if (this.focusMode === nextMode) return;
    this.focusPresetId = null;
    this.settings.focusPresetId = null;
    this.focusMode = nextMode;
    this.resetFocusTimer(false);
    this.emitFocusChanged();
  }

  setFocusDuration(minutes) {
    if (this.focusStatus === 'running' || this.focusStatus === 'paused') {
      new Notice('Q-Section: 先结束当前计时再改时长。');
      return;
    }
    const value = Math.min(360, Math.max(1, Math.round(Number(minutes) || 0)));
    this.focusPresetId = null;
    this.settings.focusPresetId = null;
    this.focusDuration = value * 60;
    this.resetFocusTimer(false);
    this.emitFocusChanged();
  }

  resetFocusTimer(emit = true) {
    this.focusBaseElapsed = 0;
    this.focusStartedAt = null;
    this.focusStatus = 'idle';
    this.focusSessionStart = null;
    this.focusSegments = [];
    this.focusPlanRef = null;
    this.stopFocusClock();
    this.persistFocusTimer();
    this.hideFocusMini();
    if (emit) this.emitFocusChanged();
  }

  startFocusTimer(options = {}) {
    if (this.focusStatus === 'running') return;
    const keepPlanRef = !!(options && options.keepPlanRef);
    if (this.focusStatus === 'done') {
      this.focusBaseElapsed = 0;
      this.focusStatus = 'idle';
      this.focusSessionStart = null;
      this.focusSegments = [];
      if (!keepPlanRef) this.focusPlanRef = null;
    }
    if (this.focusStatus === 'idle') {
      this.focusBaseElapsed = 0;
      this.focusSessionStart = Date.now();
      this.focusSegments = [];
      if (!keepPlanRef) this.focusPlanRef = null;
    }
    this.focusStartedAt = Date.now();
    this.focusStatus = 'running';
    this.startFocusClock();
    this.persistFocusTimer();
    this.emitFocusChanged();
    if (Platform.isDesktopApp) void this.showFocusPopout();
    else this.showFocusMini();
  }

  startFocusFromPlan(plan) {
    if (!plan) return false;
    if (this.focusStatus === 'running' || this.focusStatus === 'paused') {
      new Notice('Q-Section: 先结束当前专注，再开始新的专注。');
      return false;
    }
    if (this.focusStatus === 'done') this.resetFocusTimer(false);
    const startMinute = Number.isFinite(Number(plan.startMinute)) ? Number(plan.startMinute) : 9 * 60;
    const endMinute = Number.isFinite(Number(plan.endMinute)) ? Number(plan.endMinute) : startMinute + 25;
    const minutes = Math.min(360, Math.max(1, Math.round((endMinute - startMinute) || 25)));
    const startLabel = window.moment().startOf('day').add(startMinute, 'minute').format('HH:mm');
    const endLabel = window.moment().startOf('day').add(endMinute, 'minute').format('HH:mm');
    this.focusPresetId = null;
    this.settings.focusPresetId = null;
    this.focusName = String(plan.title || '专注').trim().slice(0, 40) || '专注';
    this.focusMode = 'countdown';
    this.focusDuration = minutes * 60;
    this.focusPlanRef = {
      date: plan.date,
      rawLine: plan.rawLine,
      occurrence: Number(plan.occurrence) || 0,
      title: plan.title,
      planStart: startLabel,
      planEnd: endLabel
    };
    this.focusBaseElapsed = 0;
    this.focusStartedAt = null;
    this.focusStatus = 'idle';
    this.focusSessionStart = null;
    this.focusSegments = [];
    this.stopFocusClock();
    this.startFocusTimer({ keepPlanRef: true });
    return true;
  }

  pauseFocusTimer() {
    if (this.focusStatus !== 'running') return;
    const end = Date.now();
    if (this.focusStartedAt && end > this.focusStartedAt) {
      this.focusSegments.push({ start: this.focusStartedAt, end });
    }
    this.focusBaseElapsed = this.currentFocusElapsed();
    this.focusStartedAt = null;
    this.focusStatus = 'paused';
    this.stopFocusClock();
    this.persistFocusTimer();
    this.emitFocusChanged();
  }

  async finishFocusTimer(auto) {
    if (this.focusCompleting) return;
    if (this.focusStatus !== 'running' && this.focusStatus !== 'paused') return;
    const rawElapsed = this.currentFocusElapsed();
    const elapsed = this.focusMode === 'countdown'
      ? Math.min(this.focusDuration, auto ? this.focusDuration : rawElapsed)
      : Math.min(12 * 3600, auto ? 12 * 3600 : rawElapsed);
    const minutes = Math.round(elapsed / 60);
    if (!auto && minutes < 1) {
      new Notice('Q-Section: 不足 1 分钟，未记录。');
      return;
    }
    this.focusCompleting = true;
    const end = Date.now();
    if (this.focusStatus === 'running' && this.focusStartedAt && end > this.focusStartedAt) {
      this.focusSegments.push({ start: this.focusStartedAt, end });
    }
    const segments = this.focusSegments.slice();
    if (!segments.length) {
      segments.push({ start: this.focusSessionStart || end - elapsed * 1000, end });
    }
    this.focusBaseElapsed = elapsed;
    this.focusStartedAt = null;
    this.focusStatus = 'done';
    this.stopFocusClock();
    this.persistFocusTimer();
    this.emitFocusChanged();
    const start = this.focusSessionStart || Date.now() - elapsed * 1000;
    try {
      const record = await this.recordFocusSession({
        mode: this.focusMode,
        name: this.focusName,
        minutes: Math.max(1, minutes),
        start,
        end,
        segments,
        planRef: this.focusPlanRef,
        completed: !!auto
      });
      this.focusPlanRef = null;
      this.persistFocusTimer();
      new Notice(`Q-Section: 专注 ${this.focusMinutesLabel(record.minutes)} 已记录，并写入今日安排。`);
      this.emitFocusChanged();
      window.setTimeout(() => {
        if (this.focusStatus === 'done') this.hideFocusMini();
      }, 8000);
    } catch (err) {
      new Notice('Q-Section: 专注记录失败：' + (err && err.message ? err.message : err));
    } finally {
      this.focusCompleting = false;
    }
  }

  insertDailyCapture(text, block) {
    const heading = '### 快速捕捉';
    const body = String(block || '').trim();
    if (!body) return text;
    const index = text.indexOf(heading);
    if (index === -1) {
      return text.replace(/\s*$/, '') + '\n\n' + heading + '\n\n' + body + '\n';
    }
    const after = index + heading.length;
    const rest = text.slice(after);
    const next = rest.search(/\n#{2,3}\s/);
    const insertAt = next === -1 ? text.length : after + next;
    const before = text.slice(0, insertAt).replace(/\s*$/, '');
    const afterText = text.slice(insertAt).replace(/^\s*/, '');
    const separator = before.endsWith(heading) ? '\n\n' : '\n\n';
    return before + separator + body + '\n' + (afterText ? '\n' + afterText : '\n');
  }

  async appendQuickCaptureToDaily(text) {
    const today = window.moment().format('YYYY-MM-DD');
    const file = await this.ensureDailyNoteFile(today);
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const time = window.moment().format('HH:mm');
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => `> ${line}`)
      .join('\n');
    const block = `> [!flow-capture-${id}] ${time}\n${lines}`;
    await this.app.vault.process(file, (content) => this.insertDailyCapture(content, block));
    return file;
  }

  async createInboxCapture(text) {
    const stamp = window.moment().format('YYYY-MM-DD HHmmss');
    const path = `00_Inbox/速记 ${stamp}.md`;
    const body = [
      '---',
      'type: note',
      'note_kind: 速记',
      'topic: other',
      'routing: false',
      `创建时间: ${window.moment().format('YYYY-MM-DD HH:mm')}`,
      'tags: []',
      '---',
      '',
      `# 速记 ${stamp}`,
      '',
      String(text || '').trim(),
      ''
    ].join('\n');
    const file = await this.app.vault.create(path, body);
    await this.app.workspace.getLeaf(true).openFile(file);
    return file;
  }

  getFavorites() {
    return (Array.isArray(this.settings.favoritePaths) ? this.settings.favoritePaths : [])
      .filter((path) => this.app.vault.getAbstractFileByPath(path) instanceof TFile);
  }

  async addFavorite(path) {
    if (!path) return false;
    const favorites = this.getFavorites();
    if (favorites.includes(path)) return false;
    this.settings.favoritePaths = favorites.concat(path);
    await this.saveSettings();
    return true;
  }

  async removeFavorite(path) {
    this.settings.favoritePaths = this.getFavorites().filter((item) => item !== path);
    await this.saveSettings();
  }

  getDrafts() {
    return Array.isArray(this.settings.drafts) ? this.settings.drafts : [];
  }

  async addDraft(notePath, text) {
    const body = String(text || '').trim();
    if (!body) return null;
    const draft = {
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      notePath: String(notePath || ''),
      text: body,
      createdAt: new Date().toISOString()
    };
    this.settings.drafts = this.getDrafts().concat(draft).slice(-500);
    await this.saveSettings();
    return draft;
  }

  async removeDraft(id) {
    this.settings.drafts = this.getDrafts().filter((draft) => draft.id !== id);
    await this.saveSettings();
  }

  getWritingProjects() {
    return Array.isArray(this.settings.writingProjects) ? this.settings.writingProjects : [];
  }

  getWritingProjectFor(notePath) {
    return this.getWritingProjects().find((project) => project.notePath === notePath && project.status !== 'archived') || null;
  }

  async setWritingProject(notePath, targetWords, deadline) {
    if (!notePath) return null;
    const target = Math.max(1, Math.round(Number(targetWords) || 0));
    if (!target) return null;
    const projects = this.getWritingProjects();
    const existing = projects.find((project) => project.notePath === notePath);
    const project = {
      id: existing ? existing.id : `write-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      notePath,
      targetWords: target,
      deadline: String(deadline || ''),
      status: 'active',
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.settings.writingProjects = existing
      ? projects.map((item) => item.notePath === notePath ? project : item)
      : projects.concat(project);
    await this.saveSettings();
    return project;
  }

  async completeWritingProject(notePath) {
    this.settings.writingProjects = this.getWritingProjects().map((project) => (
      project.notePath === notePath ? { ...project, status: 'done', updatedAt: new Date().toISOString() } : project
    ));
    await this.saveSettings();
  }

  async countNoteWords(notePath) {
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (!(file instanceof TFile)) return 0;
    const text = await this.app.vault.cachedRead(file);
    const body = text
      .replace(/^---[\s\S]*?---/, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]*`/g, '');
    const cjk = (body.match(/[一-鿿]/g) || []).length;
    const latin = (body.match(/[A-Za-z0-9]+/g) || []).length;
    return cjk + latin;
  }

  async getQuickCaptures() {
    const files = this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith('07_Journal/Daily/'));
    const captures = [];
    for (const file of files) {
      let text = '';
      try {
        text = await this.app.vault.cachedRead(file);
      } catch (err) {
        continue;
      }
      const lines = text.split(/\r?\n/);
      let start = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '### 快速捕捉') {
          start = i;
          break;
        }
      }
      if (start === -1) continue;
      let end = lines.length;
      for (let i = start + 1; i < lines.length; i++) {
        if (/^#{2,3}\s/.test(lines[i])) {
          end = i;
          break;
        }
      }
      const dateMatch = file.basename.match(/\d{4}-\d{2}-\d{2}/);
      const date = dateMatch ? dateMatch[0] : '';
      for (let i = start + 1; i < end; i++) {
        const match = lines[i].match(/^>\s*\[!flow-capture-([^\]]+)\]\s*(.*)$/);
        if (!match) continue;
        const id = match[1];
        const time = (match[2] || '').trim();
        const block = [];
        let j = i + 1;
        while (j < end && /^>/.test(lines[j])) {
          block.push(lines[j].replace(/^>\s?/, ''));
          j++;
        }
        while (block.length && !block[block.length - 1].trim()) block.pop();
        const body = block.join('\n').trim();
        if (body) {
          captures.push({
            id,
            text: body,
            time,
            date,
            path: file.path,
            startLine: i,
            endLine: j - 1,
            converted: this.settings.captureConversions[id] || null
          });
        }
        i = j - 1;
      }
    }
    captures.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
    return captures;
  }

  removeQuickCaptureBlock(text, id) {
    const lines = text.split(/\r?\n/);
    const marker = `[!flow-capture-${id}]`;
    const start = lines.findIndex((line) => line.indexOf(marker) !== -1);
    if (start === -1) return text;
    let end = start + 1;
    while (end < lines.length && /^>/.test(lines[end])) end++;
    lines.splice(start, end - start);
    while (start < lines.length && lines[start].trim() === '' && lines[start - 1] && lines[start - 1].trim() === '') {
      lines.splice(start, 1);
    }
    return lines.join('\n');
  }

  async deleteQuickCapture(capture) {
    const file = this.app.vault.getAbstractFileByPath(capture.path);
    if (!(file instanceof TFile)) return false;
    await this.app.vault.process(file, (text) => this.removeQuickCaptureBlock(text, capture.id));
    return true;
  }

  safeFileName(text) {
    const cleaned = String(text || '速记转化')
      .replace(/[*_`>#\[\]|]/g, '')
      .replace(/[\\/:*?"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 48);
    return cleaned || '速记转化';
  }

  async ensureFolder(folder) {
    if (!folder) return;
    if (this.app.vault.getAbstractFileByPath(folder) instanceof TFolder) return;
    try {
      await this.app.vault.createFolder(folder);
    } catch (err) {
      if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) throw err;
    }
  }

  async uniquePathFor(folder, title) {
    let path = `${folder}/${title}.md`;
    let n = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = `${folder}/${title} ${n}.md`;
      n++;
    }
    return path;
  }

  promptTaskDueDate() {
    return new Promise((resolve) => {
      new DueDateModal(this.app, (value) => resolve(value), () => resolve('')).open();
    });
  }

  async convertQuickCapture(capture, type, options = {}) {
    const title = this.safeFileName(capture.text.split('\n')[0]);
    const source = `\n\n> 来源：[[${capture.path}]]`;
    const now = window.moment();
    const tomorrow = !!(options && options.tomorrow);
    const targetDate = tomorrow ? now.clone().add(1, 'day') : now;
    const created = tomorrow ? `${targetDate.format('YYYY-MM-DD')} 00:00` : now.format('YYYY-MM-DD HH:mm');
    let folder = '03_Resources/Other/Notes/速记';
    let frontmatter = ['---', 'type: note', 'note_kind: 速记', 'topic: other', `创建时间: ${created}`, 'tags: []', '---'];
    let taskDue = '';
    if (type === 'task') {
      taskDue = tomorrow ? '' : await this.promptTaskDueDate();
      folder = taskDue ? '08_Tasks/Todo' : '08_Tasks/每日任务';
      const dueLine = taskDue ? `截止: ${taskDue}` : '截止:';
      frontmatter = ['---', 'type: task', 'status: todo', 'project:', dueLine, `创建时间: ${created}`, 'tags: []', '---'];
    } else if (type === 'project') {
      folder = '01_Projects/Active';
      frontmatter = ['---', 'type: project', 'status: active', `开始: ${window.moment().format('YYYY-MM-DD')}`, `创建时间: ${created}`, 'tags: []', '---'];
    }
    await this.ensureFolder(folder);
    const path = await this.uniquePathFor(folder, title);
    const body = frontmatter.join('\n') + '\n\n# ' + title + '\n\n' + capture.text + source + '\n';
    const file = await this.app.vault.create(path, body);
    this.settings.captureConversions[capture.id] = {
      type,
      path: file.path,
      title,
      at: new Date().toISOString()
    };
    await this.saveSettings();
    if (type === 'task' && !taskDue) {
      try {
        await this.appendTodoToDailyNote(targetDate.format('YYYY-MM-DD'), `- [ ] [[${file.path.replace(/\.md$/i, '')}|${file.basename}]]`);
      } catch (err) {
        new Notice('Q-Section: 任务已建，但待办写入失败：' + (err && err.message ? err.message : err));
      }
    }
    await this.app.workspace.getLeaf(true).openFile(file);
    return file;
  }

  getFocusRecords() {
    return Array.isArray(this.settings.focusRecords) ? this.settings.focusRecords : [];
  }

  linkName(raw) {
    const text = String(raw || '');
    const m = text.match(/\[\[([^\]|]+)/);
    const name = m ? m[1] : text;
    return name.split('/').pop().replace(/\.md$/i, '');
  }

  focusMinutesLabel(minutes) {
    const total = Math.max(1, Math.round(Number(minutes) || 0));
    if (total >= 60) {
      const hours = Math.floor(total / 60);
      const rest = total % 60;
      return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
    }
    return `${total} 分钟`;
  }

  async recordFocusSession({ mode, name, minutes, start, end, segments, planRef, completed }) {
    const startMoment = window.moment(start || Date.now());
    const endMoment = window.moment(end || Date.now());
    const date = startMoment.format('YYYY-MM-DD');
    const cleanSegments = Array.isArray(segments)
      ? segments
        .filter((segment) => segment && Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start)
        .map((segment) => ({ start: segment.start, end: segment.end }))
      : [];
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      mode: mode === 'stopwatch' ? 'stopwatch' : 'countdown',
      name: String(name || '').trim().slice(0, 40) || '专注',
      minutes: Math.max(1, Math.round(Number(minutes) || 0)),
      start: startMoment.toISOString(),
      end: endMoment.toISOString(),
      segments: cleanSegments,
      planRef: planRef && planRef.planStart && planRef.planEnd ? { ...planRef } : null,
      completed: !!completed
    };

    this.settings.focusRecords = this.getFocusRecords().concat(record).slice(-500);
    await this.saveSettings();

    try {
      await this.appendFocusToDailyNote(date, startMoment, endMoment, record);
    } catch (err) {
      new Notice('Q-Section: 专注已记录，但写入日笔记失败：' + (err && err.message ? err.message : err));
    }
    return record;
  }

  dailyNoteScaffold(date) {
    return [
      '---',
      'type: journal',
      'period: daily',
      `date: ${date}`,
      'tags: []',
      '---',
      '',
      '> 索引：[[日笔记索引]]',
      '',
      '### 今日总结',
      '',
      '- ',
      '',
      '### 快速捕捉',
      '',
      '### 今日打卡',
      '',
      '### 今日待办',
      '',
      '### 今日安排',
      ''
    ].join('\n');
  }

  scheduleStartMinutes(block) {
    const match = String(block || '').match(/\[startTime::\s*(\d{1,2}):(\d{2})\]/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  splitScheduleBlocks(content) {
    const prefix = [];
    const blocks = [];
    let current = null;
    for (const line of String(content || '').split('\n')) {
      if (/^- /.test(line)) {
        if (current) blocks.push(current);
        current = [line];
      } else if (current) {
        current.push(line);
      } else {
        prefix.push(line);
      }
    }
    if (current) blocks.push(current);
    return { prefix, blocks };
  }

  sortScheduleBlocks(blocks) {
    const timed = [];
    blocks.forEach((block, index) => {
      const minutes = this.scheduleStartMinutes(block.join('\n'));
      if (minutes !== null) timed.push({ block, index, minutes });
    });
    if (timed.length < 2) return blocks;
    const sorted = timed.slice().sort((a, b) => (a.minutes - b.minutes) || (a.index - b.index));
    const result = blocks.slice();
    timed.forEach((item, index) => {
      result[item.index] = sorted[index].block;
    });
    return result;
  }

  insertDailyFocusEvent(text, line) {
    const heading = '### 今日安排';
    const index = text.indexOf(heading);
    if (index === -1) {
      const extra = String(line || '').trim();
      return text.replace(/\s*$/, '') + '\n\n' + heading + '\n\n' + (extra ? extra + '\n' : '');
    }
    const after = index + heading.length;
    const rest = text.slice(after);
    const next = rest.search(/\n#{2,3}\s/);
    const body = next === -1 ? rest : rest.slice(0, next);
    const tail = next === -1 ? '' : rest.slice(next);
    const parsed = this.splitScheduleBlocks(String(body || '').trim());
    const blocks = parsed.blocks.slice();
    const extra = String(line || '').trim();
    if (extra) {
      const extraParsed = this.splitScheduleBlocks(extra);
      blocks.push(...extraParsed.blocks);
    }
    const sorted = this.sortScheduleBlocks(blocks);
    const rebuilt = parsed.prefix.concat(sorted.map((block) => block.join('\n'))).join('\n');
    const before = text.slice(0, after).replace(/\s*$/, '');
    const tailText = tail.replace(/^\s*/, '');
    const section = rebuilt ? '\n\n' + rebuilt + '\n' : '\n';
    return before + section + (tailText ? '\n' + tailText : '\n');
  }

  buildDailyScheduleLine({ title, allDay, start, end, location, event }) {
    const cleanText = (value) => String(value || '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const cleanField = (value) => cleanText(value)
      .replace(/\[/g, '［')
      .replace(/\]/g, '］');
    const cleanTitle = cleanText(title)
      .replace(/\[[^\]]+::\s*[^\]]*\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const parts = [`- ${cleanTitle}`];
    if (!allDay) parts.push(`[startTime:: ${start}]`, `[endTime:: ${end}]`);
    if (!allDay && event && event.focusPlan
      && Number.isFinite(event.planStartMinute) && Number.isFinite(event.planEndMinute)) {
      const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      parts.push(`[focusPlan:: ${clock(event.planStartMinute)}-${clock(event.planEndMinute)}]`);
    }
    const place = cleanField(location);
    if (place) parts.push(`[location:: ${place}]`);
    return parts.join(' ');
  }

  insertDailyScheduleLine(text, line) {
    return this.insertDailyFocusEvent(text, line);
  }

  updateDailyScheduleLine(text, oldLine, newLine, occurrence = 0) {
    const heading = '### 今日安排';
    const index = text.indexOf(heading);
    if (index === -1) return null;
    const after = index + heading.length;
    const rest = text.slice(after);
    const next = rest.search(/\n#{2,3}\s/);
    const body = next === -1 ? rest : rest.slice(0, next);
    const tail = next === -1 ? '' : rest.slice(next);
    const normalized = String(body || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const parsed = this.splitScheduleBlocks(normalized);
    const matches = [];
    parsed.blocks.forEach((block, blockIndex) => {
      const first = String(block[0] || '');
      if (first === oldLine) matches.push(blockIndex);
    });
    if (!matches.length) return null;
    const occurrenceIndex = Math.max(0, Number(occurrence) || 0);
    const target = matches[occurrenceIndex];
    if (target === undefined) return null;
    if (newLine) {
      const nextBlock = String(newLine).split('\n');
      parsed.blocks[target] = nextBlock.concat(parsed.blocks[target].slice(1));
    } else {
      parsed.blocks.splice(target, 1);
    }
    const sorted = this.sortScheduleBlocks(parsed.blocks);
    const rebuilt = parsed.prefix.concat(sorted.map((block) => block.join('\n'))).join('\n');
    const before = text.slice(0, after).replace(/\s*$/, '');
    const tailText = tail.replace(/^\s*/, '');
    const section = rebuilt ? '\n\n' + rebuilt + '\n' : '\n';
    return before + section + (tailText ? '\n' + tailText : '\n');
  }

  insertDailyTodoLine(text, line) {
    const heading = '### 今日待办';
    const entry = String(line || '').trim();
    if (!entry) return text;
    const index = text.indexOf(heading);
    if (index !== -1) {
      const after = index + heading.length;
      const rest = text.slice(after);
      const next = rest.search(/\n#{2,3}\s/);
      const body = next === -1 ? rest : rest.slice(0, next);
      const tail = next === -1 ? '' : rest.slice(next);
      const existing = String(body || '').trim();
      const rebuilt = existing ? existing + '\n' + entry : entry;
      const before = text.slice(0, after).replace(/\s*$/, '');
      const tailText = tail.replace(/^\s*/, '');
      return before + '\n\n' + rebuilt + '\n' + (tailText ? '\n' + tailText : '\n');
    }
    const beforeSchedule = text.indexOf('### 今日安排');
    if (beforeSchedule !== -1) {
      return text.slice(0, beforeSchedule).replace(/\s*$/, '') + '\n\n' + heading + '\n\n' + entry + '\n\n' + text.slice(beforeSchedule);
    }
    return text.replace(/\s*$/, '') + '\n\n' + heading + '\n\n' + entry + '\n';
  }

  async appendTodoToDailyNote(date, line) {
    const file = await this.ensureDailyNoteFile(date);
    await this.app.vault.process(file, (text) => this.insertDailyTodoLine(text, line));
  }

  async ensureDailyNoteFile(date) {
    const folder = '07_Journal/Daily/' + date.slice(0, 4);
    if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) {
      try {
        await this.app.vault.createFolder(folder);
      } catch (err) {
        if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) throw err;
      }
    }
    const path = `${folder}/${date}.md`;
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      file = await this.app.vault.create(path, this.dailyNoteScaffold(date));
    }
    return file;
  }

  async appendFocusToDailyNote(date, startMoment, endMoment, record) {
    const file = await this.ensureDailyNoteFile(date);
    const rawSegments = Array.isArray(record.segments) && record.segments.length
      ? record.segments
      : [{ start: startMoment.valueOf(), end: endMoment.valueOf() }];
    const planField = record.planRef && record.planRef.planStart && record.planRef.planEnd
      ? ` [focusPlan:: ${record.planRef.planStart}-${record.planRef.planEnd}]`
      : '';
    const lines = rawSegments
      .filter((segment) => segment && segment.end > segment.start)
      .map((segment) => {
        const segStart = window.moment(segment.start);
        const segEnd = window.moment(segment.end);
        const minutes = Math.max(1, Math.round((segment.end - segment.start) / 60000));
        return `- ${record.name || '专注'} · ${this.focusMinutesLabel(minutes)} [startTime:: ${segStart.format('HH:mm')}] [endTime:: ${segEnd.format('HH:mm')}]${planField}`;
      });
    if (!lines.length) return;
    await this.app.vault.process(file, (text) => this.insertDailyFocusEvent(text, lines.join('\n')));
  }

  getCountdowns() {
    const items = Array.isArray(this.settings.countdowns) ? this.settings.countdowns : [];
    return items
      .filter((item) => item && item.id && item.title && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')))
      .map((item) => ({
        ...item,
        id: String(item.id),
        title: String(item.title).trim(),
        date: String(item.date).slice(0, 10),
        annual: !!item.annual,
        kind: item.kind === 'birthday' ? 'birthday' : 'countdown'
      }));
  }

  countdownMatchesDate(item, day) {
    const base = window.moment(item && item.date, 'YYYY-MM-DD', true);
    if (!base.isValid()) return false;
    if (item.annual) return day.month() === base.month() && day.date() === base.date();
    return day.format('YYYY-MM-DD') === base.format('YYYY-MM-DD');
  }

  countdownInfo(item, from = window.moment()) {
    const base = window.moment(item && item.date, 'YYYY-MM-DD', true);
    const today = window.moment(from).startOf('day');
    if (!base.isValid()) return { days: 0, label: '日期无效', dateLabel: '', today: false };
    let target = base.clone().startOf('day');
    if (item.annual) {
      target = base.clone().year(today.year()).startOf('day');
      if (target.isBefore(today, 'day')) target = base.clone().year(today.year() + 1).startOf('day');
    }
    const days = target.diff(today, 'days');
    const dateLabel = item.annual ? `每年 ${base.format('M月D日')}` : base.format('YYYY-MM-DD');
    let label;
    if (days > 0) label = `还有 ${days} 天`;
    else if (days === 0) label = '今天';
    else label = `已过 ${Math.abs(days)} 天`;
    return { days, label, dateLabel, today: days === 0, target };
  }

  async addCountdown(payload) {
    const title = String(payload.title || '').replace(/\s+/g, ' ').trim();
    const date = String(payload.date || '').slice(0, 10);
    if (!title || !window.moment(date, 'YYYY-MM-DD', true).isValid()) {
      throw new Error('标题或日期无效。');
    }
    const item = {
      id: `cd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      date,
      annual: !!payload.annual,
      kind: payload.annual && /生日/.test(title) ? 'birthday' : 'countdown',
      createdAt: new Date().toISOString()
    };
    this.settings.countdowns = this.getCountdowns().concat(item);
    await this.saveSettings();
    this.app.workspace.trigger('qsection:countdown-changed');
    return item;
  }

  async updateCountdown(id, payload) {
    const title = String(payload.title || '').replace(/\s+/g, ' ').trim();
    const date = String(payload.date || '').slice(0, 10);
    if (!title || !window.moment(date, 'YYYY-MM-DD', true).isValid()) {
      throw new Error('标题或日期无效。');
    }
    this.settings.countdowns = this.getCountdowns().map((item) => (
      item.id === id
        ? { ...item, title, date, annual: !!payload.annual, kind: payload.annual && /生日/.test(title) ? 'birthday' : 'countdown' }
        : item
    ));
    await this.saveSettings();
    this.app.workspace.trigger('qsection:countdown-changed');
  }

  async removeCountdown(id) {
    this.settings.countdowns = this.getCountdowns().filter((item) => item.id !== id);
    await this.saveSettings();
    this.app.workspace.trigger('qsection:countdown-changed');
  }

  getCheckinItems(includeArchived = false) {
    const items = Array.isArray(this.settings.checkinItems) ? this.settings.checkinItems : [];
    return items.filter((item) => item && (includeArchived || !item.archived));
  }

  getCheckinRecords() {
    return Array.isArray(this.settings.checkinRecords) ? this.settings.checkinRecords : [];
  }

  checkinKey(itemId, dateKey) {
    return `${itemId}|${dateKey}`;
  }

  isCheckedIn(itemId, dateKey) {
    return this.getCheckinRecords().includes(this.checkinKey(itemId, dateKey));
  }

  checkinStreak(itemId, dateKey) {
    const set = new Set(this.getCheckinRecords());
    let cursor = dateKey ? window.moment(dateKey, 'YYYY-MM-DD', true) : window.moment().startOf('day');
    if (!cursor.isValid()) cursor = window.moment().startOf('day');
    if (!set.has(this.checkinKey(itemId, cursor.format('YYYY-MM-DD')))) cursor = cursor.subtract(1, 'day');
    let streak = 0;
    while (set.has(this.checkinKey(itemId, cursor.format('YYYY-MM-DD')))) {
      streak++;
      cursor = cursor.subtract(1, 'day');
    }
    return streak;
  }

  emitCheckinChanged() {
    this.app.workspace.trigger('qsection:checkin-changed');
  }

  async archiveCheckinItem(itemId) {
    this.settings.checkinItems = (this.settings.checkinItems || []).map((item) => (
      item && item.id === itemId ? { ...item, archived: true } : item
    ));
    await this.saveSettings();
    await this.syncCheckinDailyNote(window.moment().format('YYYY-MM-DD'));
    this.emitCheckinChanged();
  }

  async restoreCheckinItem(itemId) {
    this.settings.checkinItems = (this.settings.checkinItems || []).map((item) => (
      item && item.id === itemId ? { ...item, archived: false } : item
    ));
    await this.saveSettings();
    await this.syncCheckinDailyNote(window.moment().format('YYYY-MM-DD'));
    this.emitCheckinChanged();
  }

  async addCheckinItem(name, link) {
    const title = String(name || '').trim();
    if (!title) return null;
    const items = Array.isArray(this.settings.checkinItems) ? this.settings.checkinItems : [];
    if (items.some((item) => item && !item.archived && item.name === title)) {
      new Notice('Q-Section: 已有同名打卡项目。');
      return null;
    }
    const item = {
      id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: title,
      link: String(link || '').trim(),
      archived: false,
      createdAt: new Date().toISOString()
    };
    this.settings.checkinItems = items.concat(item);
    await this.saveSettings();
    await this.syncCheckinDailyNote(window.moment().format('YYYY-MM-DD'));
    this.emitCheckinChanged();
    return item;
  }

  async toggleCheckin(itemId, dateKey) {
    const key = this.checkinKey(itemId, dateKey);
    const set = new Set(this.getCheckinRecords());
    let checked;
    if (set.has(key)) {
      set.delete(key);
      checked = false;
    } else {
      set.add(key);
      checked = true;
    }
    this.settings.checkinRecords = Array.from(set).sort();
    await this.saveSettings();
    if (dateKey === window.moment().format('YYYY-MM-DD')) {
      await this.syncCheckinDailyNote(dateKey);
    }
    this.emitCheckinChanged();
    return checked;
  }

  insertOrReplaceCheckinSection(text, lines) {
    const heading = '### 今日打卡';
    const block = lines.join('\n');
    const index = text.indexOf(heading);
    if (index !== -1) {
      const after = index + heading.length;
      const rest = text.slice(after);
      const next = rest.search(/\n#{2,3}\s/);
      const tail = next === -1 ? '' : rest.slice(next).replace(/^\s*/, '');
      return text.slice(0, index).replace(/\s*$/, '') + '\n\n' + heading + '\n\n' + block + '\n' + (tail ? '\n' + tail : '\n');
    }
    const beforeTodo = text.indexOf('### 今日待办');
    const beforeSchedule = text.indexOf('### 今日安排');
    const insertAt = beforeTodo !== -1 ? beforeTodo : beforeSchedule;
    if (insertAt !== -1) {
      return text.slice(0, insertAt).replace(/\s*$/, '') + '\n\n' + heading + '\n\n' + block + '\n\n' + text.slice(insertAt);
    }
    return text.replace(/\s*$/, '') + '\n\n' + heading + '\n\n' + block + '\n';
  }

  removeCheckinSection(text) {
    const heading = '### 今日打卡';
    const index = text.indexOf(heading);
    if (index === -1) return text;
    const after = index + heading.length;
    const rest = text.slice(after);
    const next = rest.search(/\n#{2,3}\s/);
    if (next === -1) return text.slice(0, index).replace(/\s*$/, '') + '\n';
    const tail = rest.slice(next).replace(/^\s*/, '');
    return text.slice(0, index).replace(/\s*$/, '') + '\n\n' + tail;
  }

  async syncCheckinDailyNote(date) {
    const items = this.getCheckinItems();
    const folder = '07_Journal/Daily/' + date.slice(0, 4);
    const path = `${folder}/${date}.md`;
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      if (!items.length) return;
      file = await this.ensureDailyNoteFile(date);
    }
    if (!items.length) {
      await this.app.vault.process(file, (text) => this.removeCheckinSection(text));
      return;
    }
    const lines = items.map((item) => `- ${this.isCheckedIn(item.id, date) ? '✅' : '⬜'} ${item.name}`);
    await this.app.vault.process(file, (text) => this.insertOrReplaceCheckinSection(text, lines));
  }

  insertProjectTaskBase() { this.insertBaseBlock('tasks'); }
  insertProjectContentBase() { this.insertBaseBlock('content'); }
}

module.exports = ParaRouterPlugin;
