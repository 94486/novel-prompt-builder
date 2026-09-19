'use strict';

/**
 * app.js —— 渲染进程全部前端逻辑
 *
 * 新设计：
 *   - 左侧类目栏：4 个图标（世界观 / 角色 / 场景 / 文风）+ 底部「情节梗概」按钮
 *   - 主卡牌区：竖直卡片，拖动左侧把手左右切换 selected；点击正文打开编辑弹窗
 *   - 顶部：「＋ 新建卡牌」「全选 / 全不选」
 *   - 底部：复制 / 导出 Prompt
 */

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function uid() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch (_e) { /* 回退 */ }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch (_e) { /* 忽略 */ }
  ta.remove();
}

/* ============================ 元数据 ============================ */

/* ============================ 图标系统 ============================
 * 程序内全部图标统一为内联线性 SVG（feather 风格）：
 * 24×24 viewBox、1.8 描边、圆头圆角、currentColor 着色，
 * 可随主题 / 选中 / 悬停状态自动变色，不依赖任何位图或 emoji。
 * ============================ */

const ICON_PATH = {
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  mask: '<path d="M5 13.5c0-4.6 3.3-7.5 7-7.5s7 2.9 7 7.5c0 2.4-1.4 3.8-3.3 3.8-1.3 0-2-.6-3.7-.6s-2.4.6-3.7.6C6.4 17.3 5 15.9 5 13.5z"/><circle cx="9" cy="12.5" r="1.1"/><circle cx="15" cy="12.5" r="1.1"/>',
  mountain: '<path d="M8 3l4 7 5-5 5 15H2L8 3z"/><path d="M8 3l4 7 5-5 5 15H2L8 3z" opacity="0"/>',
  quill: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  bookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  sparkles: '<path d="M12 3l1.9 5.4L19.3 10l-5.4 1.6L12 17l-1.9-5.4L4.7 10l5.4-1.6L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
  rotate: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  alert: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  grip: '<circle cx="9" cy="5.5" r="1.1"/><circle cx="15" cy="5.5" r="1.1"/><circle cx="9" cy="12" r="1.1"/><circle cx="15" cy="12" r="1.1"/><circle cx="9" cy="18.5" r="1.1"/><circle cx="15" cy="18.5" r="1.1"/>',
  chevronUp: '<polyline points="18 15 12 9 6 15"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  layers: '<path d="M12 2l10 6-10 6L2 8z"/><path d="M2 16l10 6 10-6"/><path d="M2 12l10 6 10-6"/>',
  /* —— 古代男女角色图标（线性半身像，与全局图标风格一致） —— */
  male: '<path d="M9 2.5h6"/><circle cx="12" cy="7" r="3"/><path d="M6.3 11.4c0-2.7 2.6-4.4 5.7-4.4s5.7 1.7 5.7 4.4"/><path d="M6.3 11.4c-.2 2.4-.4 4.9-.7 7.3 0 1.2.9 2.3 2.2 2.3h8.4c1.3 0 2.2-1.1 2.2-2.3-.3-2.4-.5-4.9-.7-7.3"/><path d="M10 11.9l2 9.1"/><path d="M14 11.9l-2 9.1"/>',
  female: '<path d="M9.4 5.8a2.6 2.6 0 0 1 5.2 0"/><circle cx="12" cy="8.2" r="2.7"/><path d="M6.5 12.2c0-2.6 2.5-4.2 5.5-4.2s5.5 1.6 5.5 4.2"/><path d="M6.5 12.2c-.4 2.3-.7 4.8-1 7.2 0 1.3 1 2.4 2.3 2.4h8.4c1.3 0 2.3-1.1 2.3-2.4-.3-2.4-.6-4.9-1-7.2"/><path d="M5.5 19.6c2.2 1.2 10.8 1.2 13 0"/><path d="M12 12.2v9.6"/>'
};

/** 生成内联 SVG 图标（默认 16px） */
function ico(name, cls) {
  const path = ICON_PATH[name] || ICON_PATH.circle;
  return `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const CATEGORIES = [
  { key: 'worldbuilding', icon: 'globe',   label: '世界观', pool: 'worldbuildingCards' },
  { key: 'character',    icon: 'mask',    label: '角色',   pool: 'characterCards' },
  { key: 'scene',        icon: 'mountain', label: '场景',   pool: 'sceneCards' },
  { key: 'style',        icon: 'quill',   label: '文风',   pool: 'styleCards' }
];

const CARD_META = {
  worldbuilding: {
    typeKey: 'type', typeLabel: '类型',
    typeOptions: ['力量体系', '政治势力', '地理环境', '历史文化', '社会制度', '科技水平', '宗教信仰'],
    certKey: 'certainty', certLabel: '确定性等级', certOptions: ['铁律', '常规', '模糊'],
    groups: [
      {
        title: '核心规则', hint: '定义世界最底层的规则',
        fields: [
          { key: 'coreSetting', label: '核心设定', ml: true, rows: 3, hint: '写作时最优先遵循（建议 30~60 字）', len: '30~60' }
        ]
      },
      {
        title: '张力与联动', hint: '世界矛盾与角色的连接点',
        fields: [
          { key: 'internalConflict', label: '内在矛盾', ml: true, rows: 3, hint: '剧情冲突的源头（建议 20~50 字）', len: '20~50' },
          { key: 'characterHint', label: '与角色的关联提示', ml: false, hint: '设定如何影响角色（建议 20~40 字）', len: '20~40' }
        ]
      }
    ]
  },
  character: {
    typeKey: 'freedomLevel', typeLabel: '演绎自由度',
    typeOptions: ['严格遵循', '可适度发挥', '仅参考方向'],
    groups: [
      {
        title: '人物档案', hint: '先让 AI 认识这个人',
        fields: [
          { key: 'basicInfo', label: '基础信息', ml: true, rows: 3, hint: '年龄、出身、外貌、身份（建议 30~60 字）', len: '30~60' }
        ]
      },
      {
        title: '内在世界', hint: '性格、动机与秘密',
        fields: [
          { key: 'personalityBehavior', label: '性格与行为', ml: true, rows: 2, hint: '性格特质 + 习惯动作、口头禅（建议 40~80 字）', len: '40~80' },
          { key: 'desireFear', label: '欲望与恐惧', ml: false, hint: '行动的原动力与最害怕的事（建议 20~40 字）', len: '20~40' },
          { key: 'secret', label: '秘密', ml: true, rows: 2, hint: '故事反转的种子（建议 10~30 字）', len: '10~30' }
        ]
      },
      {
        title: '关系与成长', hint: '与谁结缘、如何改变',
        fields: [
          { key: 'relationships', label: '人物关系', ml: true, rows: 2, hint: '与关键人物的恩怨、情感与牵绊（建议 20~40 字）', len: '20~40' },
          { key: 'characterArc', label: '角色弧线', ml: true, rows: 2, hint: '从开始到结局的成长轨迹（建议 20~40 字）', len: '20~40' }
        ]
      },
      {
        title: '说话方式', hint: '让 AI 模仿 TA 开口时的语气',
        fields: [
          { key: 'speechSamples', label: '台词样本', ml: true, rows: 3, hint: '2~5 句标志性台词，每句不超过 20 字（建议 40~60 字）', len: '40~60' }
        ]
      }
    ]
  },
  scene: {
    typeKey: 'sceneFunction', typeLabel: '场景功能',
    typeOptions: ['冲突爆发', '情感转折', '信息揭示', '日常过渡', '高潮决战'],
    groups: [
      {
        title: '时空与氛围', hint: '把读者带进这个场景',
        fields: [
          { key: 'timeLocation', label: '时空定位', ml: false, hint: '何时、何地、处于什么状态（建议 10~30 字）', len: '10~30' },
          { key: 'sensoryDetails', label: '感官描写', ml: true, rows: 2, hint: '五感细节，让场景真实可感（建议 20~50 字）', len: '20~50' },
          { key: 'atmosphereKeywords', label: '氛围关键词', ml: false, hint: '几个关键词定下氛围基调（建议 5~15 字）', len: '5~15' }
        ]
      },
      {
        title: '作用与弹性', hint: '场景如何推动角色与剧情',
        fields: [
          { key: 'characterImpact', label: '对角色的影响', ml: true, rows: 2, hint: '只写场景对角色情绪/选择的影响；叙事作用交给「场景功能」下拉（建议 15~40 字）', len: '15~40' },
          { key: 'variableElements', label: '可变要素', ml: true, rows: 2, hint: '允许 AI 发挥的弹性空间（建议 10~30 字）', len: '10~30' }
        ]
      }
    ]
  },
  style: {
    typeKey: 'applicableScene', typeLabel: '适用情境',
    typeOptions: ['通用', '对话', '战斗', '心理', '环境', '叙事过渡'],
    groups: [
      {
        title: '风格定义', hint: '说清这种风格是什么',
        fields: [
          { key: 'styleDescription', label: '风格描述', ml: true, rows: 2, hint: '一句话说清这种风格的核心特征（建议 20~40 字）', len: '20~40' }
        ]
      },
      {
        title: '示例对比', hint: '好的范文与要避免的反例',
        fields: [
          { key: 'referenceText', label: '参考范文', ml: true, rows: 3, hint: 'AI 模仿其节奏与措辞（建议 40~80 字）', len: '40~80' },
          { key: 'antiExample', label: '反面示例', ml: true, rows: 3, hint: '要避免的写法（建议 20~40 字）', len: '20~40' }
        ]
      }
    ]
  }
};

// 展开分组 → 扁平的 fields 列表（供 cardPreview 等通用逻辑使用）
for (const key of Object.keys(CARD_META)) {
  CARD_META[key].fields = (CARD_META[key].groups || []).flatMap((g) => g.fields);
}

/* ============================ 卡牌下拉/列表选项（全局 · 可增删改） ============================
 * 每个带 select 的字段对应一组选项（从小说创作角度给出的默认值）。
 * 用户在编辑弹窗内可随时「管理选项」增删改，结果保存到 config.json（全局生效）。
 * 键 = 「卡片类别.key」：worldbuilding.type / worldbuilding.certainty /
 *                       character.freedomLevel / scene.sceneFunction / style.applicableScene
 */
const DEFAULT_CARD_OPTIONS = {
  'worldbuilding.type': ['力量体系', '修炼境界', '宗门势力', '地理环境', '历史文化', '社会制度', '宝物丹药', '民俗传说'],
  'worldbuilding.certainty': ['铁律', '常规', '模糊'],
  'character.freedomLevel': ['严格遵循', '可适度发挥', '仅参考方向'],
  'scene.sceneFunction': ['日常过渡', '冲突爆发', '剧情转折', '情感高潮', '悬念伏笔', '战斗场面', '对话交流', '环境铺垫'],
  'style.applicableScene': ['通用', '对话描写', '环境描写', '心理描写', '战斗描写', '情感描写', '动作描写'],
  'character.gender': ['男', '女']
};

/** 取某字段的选项（优先用户自定义，回退默认） */
function getOptions(fieldKey) {
  const custom = state && state.config && state.config.cardOptions && state.config.cardOptions[fieldKey];
  if (Array.isArray(custom) && custom.length) return custom;
  return DEFAULT_CARD_OPTIONS[fieldKey] || [];
}

/** 字段键 → 中文名（用于选项管理弹窗标题） */
function optionFieldLabel(fieldKey) {
  const [cat, key] = String(fieldKey).split('.');
  const meta = CARD_META[cat];
  if (!meta) return fieldKey;
  if (key === meta.typeKey) return meta.typeLabel;
  if (key === meta.certKey) return meta.certLabel;
  return fieldKey;
}

/** 渲染自定义智能下拉（替代原生 select）：可滚动、空间不足自动向上展开，杜绝选项显示不全；
 *  附带「管理选项」按钮；当前值不在选项中时兜底补一项，避免丢值 */
function selectHtml(fieldKey, value, dataKey, extraAttrs) {
  const opts = getOptions(fieldKey);
  const hasVal = opts.indexOf(value) >= 0;
  const list = opts.map((o) =>
    `<button type="button" class="dd-opt${o === value ? ' on' : ''}" data-dd-val="${esc(o)}">${esc(o)}</button>`
  ).join('');
  return `<div class="dd select-wrap" data-dd data-key="${dataKey}" data-field-key="${fieldKey}" data-value="${esc(value || '')}" ${extraAttrs || ''}>
    <button type="button" class="dd-btn" title="点击展开选项（可滚动）">
      <span class="dd-val">${esc(value || '')}</span>
      <svg class="ico dd-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <div class="dd-list">
      ${list}
      ${!hasVal && value ? `<button type="button" class="dd-opt on" data-dd-val="${esc(value)}">${esc(value)}</button>` : ''}
    </div>
    ${fieldKey === 'character.gender' ? '' : `<button type="button" class="opt-manage" data-opt-manage="${fieldKey}" title="管理选项（可增删改）">${ico('edit')}</button>`}
  </div>`;
}

/* ===== 自定义下拉交互（全局委托） ===== */

/** 打开某个下拉：空间不足时自动向上展开 */
function openDd(dd) {
  const list = dd.querySelector('.dd-list');
  if (!list) return;
  const rect = dd.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  list.classList.toggle('open-up', spaceBelow < 240 && spaceAbove > spaceBelow);
  dd.classList.add('open');
}

function closeAllDd() {
  document.querySelectorAll('.dd.open').forEach((d) => d.classList.remove('open'));
}

/** 选中某个选项：更新显示与对应字段 */
function selectDdValue(dd, val) {
  dd.dataset.value = val;
  const vEl = dd.querySelector('.dd-val');
  if (vEl) vEl.textContent = val;
  dd.querySelectorAll('.dd-opt').forEach((o) => o.classList.toggle('on', o.dataset.ddVal === val));
  const key = dd.dataset.key;
  // 性别切换：自动修正形象集（与旧 select change 逻辑一致）
  if (dd.hasAttribute('data-gender-switch')) {
    if (!state.editing || !state.editing._draft) return;
    const g = val === '男' ? '男' : '女';
    state.editing._draft.gender = g;
    const av = state.editing._draft.avatar;
    const ok = av && AVATAR_KEYS.has(av) && (g === '男' ? av === 'male' : av !== 'male');
    if (!ok) state.editing._draft.avatar = defaultAvatar(g);
    const pick = $('#avatar-pick');
    if (pick) pick.innerHTML = avatarGridHtml(state.editing._draft);
    return;
  }
  if (state.editing && state.editing._draft) state.editing._draft[key] = val;
}

/** 全局点击：展开/收起/选中 */
function onDdGlobalClick(e) {
  const btn = e.target.closest('.dd-btn');
  if (btn) {
    e.preventDefault();
    const dd = btn.closest('.dd');
    const wasOpen = dd.classList.contains('open');
    closeAllDd();
    if (!wasOpen) openDd(dd);
    return;
  }
  const opt = e.target.closest('.dd-opt');
  if (opt) {
    e.preventDefault();
    const dd = opt.closest('.dd');
    selectDdValue(dd, opt.dataset.ddVal);
    closeAllDd();
    return;
  }
  if (!e.target.closest('.dd')) closeAllDd();
}

/* ============================ 状态 ============================ */

const state = {
  library: null,        // 资产池：{ worldbuildingCards:[], characterCards:[], sceneCards:[], styleCards:[] }
  projects: [],         // 项目列表
  project: null,        // 当前项目对象（含 plot / used / selected / globalConstraints）
  config: null,
  activeCategory: 'worldbuilding',
  view: 'cards', // 'cards' | 'synopsis'
  deckIndex: 0, // 当前层叠中位于「中间焦点」的卡牌索引
  editing: null // { type: 'card'|'new'|'library-new', category, id } 
};

/* ============================ 初始化 ============================ */

async function init() {
  try {
    const project = await window.api.readData('projects.json');
    const config = await window.api.readData('config.json');

    const data = normalizeData(project);
    state.library = data.library;
    state.projects = data.projects;
    state.project = data.projects.find((p) => p.id === data.activeProjectId) || data.projects[0];
    state.config = config || {
      provider: 'ollama',
      ollamaBaseUrl: 'http://localhost:11434',
      ollamaModel: '',
      openaiApiKey: '',
      openaiBaseUrl: '',
      openaiModel: '',
      presets: []
    };

    renderTopBar();
    renderRail();
    renderCardView();
    renderSynopsisView();
    renderBottomBar();
    bindEvents();

    // 显示应用版本号（底部状态栏）
    if (window.api && window.api.getVersion) {
      window.api.getVersion().then((v) => {
        const el = $('#app-version');
        if (el && v) el.textContent = String(v);
      }).catch(() => {});
    }

    if (!project) scheduleSave();
  } catch (err) {
    showFatalError(err);
  }
}

function showFatalError(err) {
  const main = $('#main');
  if (!main) return;
  main.innerHTML = `<div style="padding:40px;text-align:center">
    <h2 style="color:var(--danger);margin-bottom:14px">⚠️ 启动失败</h2>
    <pre style="white-space:pre-wrap;color:var(--text-secondary);font-size:12px">${esc(err && err.message || String(err))}</pre>
    <button class="btn primary" style="margin-top:18px" onclick="location.reload()">重载应用</button>
  </div>`;
}

/**
 * 数据规范化（兼容 v1/v2/v3 三种格式）：
 * - v1 旧格式：顶层 projectName + plotSynopsis + worldbuildingCards/... 
 *   → 迁移为「素材库 library + 项目 projects」（所有卡进库，项目存副本）
 * - v2 引用格式：{ version:2, library, projects:[{ used:[id] }] }
 *   → 迁移为 v3 副本格式：项目内 used 引用改为项目内卡牌副本（sourceId 指向素材库原卡）
 * - v3 副本格式：{ version:3, library, projects:[{ cards:{cat:[副本]}, selected }] }
 *   → 素材库与项目副本完全独立：编辑/删除互不影响
 */
function normalizeData(data) {
  const d = data && typeof data === 'object' ? data : {};
  const CATS = [
    ['worldbuilding', 'worldbuildingCards'],
    ['character', 'characterCards'],
    ['scene', 'sceneCards'],
    ['style', 'styleCards']
  ];

  // —— v2 / v3 ——
  if (d.library && Array.isArray(d.projects) && d.projects.length) {
    const lib = { worldbuildingCards: [], characterCards: [], sceneCards: [], styleCards: [] };
    for (const [cat, poolKey] of CATS) {
      lib[poolKey] = (d.library[poolKey] || []).map((c) => normalizeCard(c)).filter(Boolean);
    }
    const projects = d.projects.map((p) => {
      const proj = normalizeProject(p);
      // v2 → v3：把 used 引用物化为项目内副本（selected 映射同步换 id）
      if (p.used && !p.cards) {
        for (const [cat, poolKey] of CATS) {
          const selMap = (p.selected && p.selected[cat]) || {};
          const idMap = {};
          const copies = [];
          for (const cid of (p.used[cat] || [])) {
            const src = lib[poolKey].find((c) => c.id === cid);
            if (!src) continue;
            const copyId = uid();
            idMap[cid] = copyId;
            copies.push(Object.assign({}, src, { id: copyId, sourceId: src.id, category: cat }));
          }
          proj.cards[cat] = copies;
          proj.selected[cat] = {};
          for (const [oldId, v] of Object.entries(selMap)) {
            if (idMap[oldId]) proj.selected[cat][idMap[oldId]] = !!v;
          }
        }
      }
      return proj;
    });
    const activeId = d.activeProjectId && projects.some((p) => p.id === d.activeProjectId)
      ? d.activeProjectId : projects[0].id;
    return { library: lib, projects, activeProjectId: activeId };
  }

  // —— v1 旧格式 → 迁移 ——
  const lib = { worldbuildingCards: [], characterCards: [], sceneCards: [], styleCards: [] };
  const cards = {}, selected = {};
  for (const [cat, poolKey] of CATS) {
    const src = d[poolKey] || [];
    // 注入 category（v1 卡无该字段），使 normalizeCard 的旧字段舍弃与头像迁移对 v1 生效
    lib[poolKey] = src.map((c) => normalizeCard(c, cat)).filter(Boolean);
    // 副本换新 id（与 v2 分支对齐），保持"库卡/项目副本 id 不同、sourceId 关联"的独立性
    const idMap = {};
    cards[cat] = lib[poolKey].map((c) => {
      const copyId = uid();
      idMap[c.id] = copyId;
      return Object.assign({}, c, { id: copyId, sourceId: c.id, category: cat });
    });
    selected[cat] = {};
    src.forEach((c, i) => {
      if (c && c.id && idMap[c.id]) selected[cat][idMap[c.id]] = !!c.selected;
    });
  }
  const gc = d.globalConstraints || {};
  const project = {
    id: 'p_main',
    name: d.projectName || '我的小说项目',
    plot: { chapter: '', title: '', content: d.plotSynopsis !== undefined ? d.plotSynopsis : '' },
    globalConstraints: {
      taboos: gc.taboos || '',
      wordCountMin: gc.wordCountMin === undefined || gc.wordCountMin === null ? 2000 : gc.wordCountMin,
      wordCountMax: gc.wordCountMax === undefined || gc.wordCountMax === null ? 4000 : gc.wordCountMax,
      formatRequirement: gc.formatRequirement || '',
      opening: gc.opening || '',
      closing: gc.closing || ''
    },
    selected, cards,
    chapters: []
  };
  return { library: lib, projects: [project], activeProjectId: 'p_main' };
}

function normalizeCard(c, fallbackCategory) {
  if (!c || typeof c !== 'object') return null;
  const { selected, ...rest } = c;
  // v1 旧卡无 category：按所在池注入，使头像迁移/旧字段舍弃对 v1 路径同样生效
  if (fallbackCategory && !rest.category) rest.category = fallbackCategory;
  if (rest.category === 'character') migrateAvatar(rest);
  // v1.4.4 结构收敛：多余旧字段直接舍弃，不做兼容拼接
  dropLegacyFields(rest);
  return rest;
}

/** v1.4.4 数据结构收敛：被合并/删除的旧字段一律舍弃（含导入、加载、素材库流转） */
function dropLegacyFields(card) {
  if (!card || typeof card !== 'object') return;
  if (card.category === 'character') {
    // 角色：性格内核+行为模式 →「性格与行为」；核心欲望+核心恐惧 →「欲望与恐惧」
    delete card.personalityCore;
    delete card.behaviorPattern;
    delete card.coreDesire;
    delete card.coreFear;
  }
}

/** 角色卡头像迁移：旧「女·绝美」式取值 → 新 avatar 键；gender 收敛为 男/女；无信息旧卡默认君子 */
function migrateAvatar(card) {
  const OLD = { '男': 'male', '女·绝美': 'grace', '女·性感': 'seductive', '女·风骚': 'allure', '女·清纯': 'innocent', '女·英气': 'heroine' };
  const oldG = card.gender;
  if (card.avatar == null) {
    if (OLD[oldG]) { card.avatar = OLD[oldG]; card.gender = '女'; }
    else if (oldG === '男') { card.avatar = 'male'; }
    else { card.avatar = 'male'; card.gender = '男'; } // 旧数据无性别信息 → 默认君子（男），用户可在编辑中修改
  }
  if (card.gender !== '男' && card.gender !== '女') card.gender = card.avatar === 'male' ? '男' : '女';
}

/** 角色头像集：9 张（男 1 · 女 8），无金环高清 PNG。键名即形象，选项文案中性化（不出现「女·性感」类字眼） */
const AVATAR_DEFS = [
  { key: 'male', label: '君子' },
  { key: 'grace', label: '绝美' },
  { key: 'seductive', label: '性感' },
  { key: 'allure', label: '风骚' },
  { key: 'innocent', label: '清纯' },
  { key: 'heroine', label: '女侠' },
  { key: 'icy', label: '冷艳' },
  { key: 'queen', label: '女王' },
  { key: 'consort', label: '皇妃' }
];

// 头像键集合缓存（避免每次渲染重复 some/find 扫描 AVATAR_DEFS）
const AVATAR_KEYS = new Set(AVATAR_DEFS.map((a) => a.key));
const AVATAR_BY_KEY = new Map(AVATAR_DEFS.map((a) => [a.key, a]));

/** 头像键 → 位图路径（非法键回退男头像） */
function avatarImg(key) {
  return 'icons/avatar-' + (AVATAR_KEYS.has(key) ? key : 'male') + '.png';
}

/** 按性别渲染形象网格：男 → 仅君子 1 枚；女 → 8 枚女性形象；选项不显示文字，仅悬浮提示 */
function avatarGridHtml(card) {
  const gender = card.gender === '男' ? '男' : '女';
  const list = AVATAR_DEFS.filter((a) => (gender === '男' ? a.key === 'male' : a.key !== 'male'));
  const cur = (card.avatar && AVATAR_KEYS.has(card.avatar))
    ? card.avatar : defaultAvatar(gender);
  return list.map((a) => `
    <button type="button" class="avatar-opt ${a.key === cur ? 'on' : ''}" data-avatar="${a.key}" title="${a.label}">
      <img src="${avatarImg(a.key)}" alt="${a.label}">
    </button>`).join('');
}

/** 性别 → 默认头像键 */
function defaultAvatar(gender) {
  return gender === '男' ? 'male' : 'grace';
}

/** 项目对象规范化（补默认字段；v3：项目内卡牌副本存 cards） */
function normalizeProject(p) {
  const plot = p && p.plot || {};
  const selected = p && p.selected || {};
  const gc = (p && p.globalConstraints) || {};
  const cards = {
    worldbuilding: ((p && p.cards && p.cards.worldbuilding) || []).map((c) => normalizeCard(c)).filter(Boolean),
    character: ((p && p.cards && p.cards.character) || []).map((c) => normalizeCard(c)).filter(Boolean),
    scene: ((p && p.cards && p.cards.scene) || []).map((c) => normalizeCard(c)).filter(Boolean),
    style: ((p && p.cards && p.cards.style) || []).map((c) => normalizeCard(c)).filter(Boolean)
  };
  const project = {
    id: (p && p.id) || 'p_' + uid(),
    name: (p && p.name) || '未命名项目',
    plot: {
      chapter: plot.chapter || '',
      title: plot.title || '',
      content: plot.content !== undefined ? plot.content : (p ? p.plotSynopsis : '')
    },
    globalConstraints: {
      taboos: gc.taboos || '',
      wordCountMin: gc.wordCountMin === undefined || gc.wordCountMin === null ? 2000 : gc.wordCountMin,
      wordCountMax: gc.wordCountMax === undefined || gc.wordCountMax === null ? 4000 : gc.wordCountMax,
      formatRequirement: gc.formatRequirement || '',
      opening: gc.opening || '',
      closing: gc.closing || ''
    },
    // v2 兼容字段（迁移用，v3 以 cards 为准）
    used: p && p.used || {},
    selected: {
      worldbuilding: selected.worldbuilding || {},
      character: selected.character || {},
      scene: selected.scene || {},
      style: selected.style || {}
    },
    cards,
    // 章节管理：按保存顺序存放已生成的章节提示词
    chapters: Array.isArray((p && p.chapters)) ? (p && p.chapters) : []
  };
  return project;
}

/* ============================ 数据辅助 ============================ */

const CAT_POOL = {
  worldbuilding: 'worldbuildingCards',
  character: 'characterCards',
  scene: 'sceneCards',
  style: 'styleCards'
};

/** 素材库（资产池）中的原始卡对象 */
function findLibCard(category, id) {
  const poolKey = CAT_POOL[category];
  const arr = (state.library && state.library[poolKey]) || [];
  return arr.find((c) => c.id === id) || null;
}

/** 当前项目内的卡牌副本 */
function findCard(category, id) {
  const proj = state.project || {};
  const arr = (proj.cards && proj.cards[category]) || [];
  return arr.find((c) => c.id === id) || null;
}

/**
 * 当前项目可见卡列表（项目内副本，投影 selected 状态）。
 * 渲染统一用这个；写回用 findCard（项目副本）。
 */
function pool(category) {
  const proj = state.project || {};
  const arr = (proj.cards && proj.cards[category]) || [];
  const selMap = proj.selected && proj.selected[category] || {};
  return arr.map((c) => Object.assign({}, c, { selected: !!selMap[c.id] }));
}

/** 轻量计数：只统计总数与已选数，不创建数组副本（renderRail 等仅需计数的场景使用） */
function poolMeta(category) {
  const proj = state.project || {};
  const arr = (proj.cards && proj.cards[category]) || [];
  const selMap = proj.selected && proj.selected[category] || {};
  let selected = 0;
  for (const c of arr) if (selMap[c.id]) selected++;
  return { total: arr.length, selected };
}

/* —— 项目级选中状态 —— */
function isSelected(category, id) {
  const proj = state.project || {};
  return !!(proj.selected && proj.selected[category] && proj.selected[category][id]);
}
function setSelected(category, id, v) {
  const proj = state.project;
  if (!proj) return;
  if (!proj.selected[category]) proj.selected[category] = {};
  proj.selected[category][id] = !!v;
}
function toggleSelected(category, id) {
  setSelected(category, id, !isSelected(category, id));
}

function defaultsFor(category) {
  const id = uid();
  switch (category) {
    case 'worldbuilding':
      return { id, name: '新世界观', type: '力量体系', coreSetting: '', internalConflict: '', characterHint: '', certainty: '常规' };
    case 'character':
      return { id, name: '新角色', gender: '男', avatar: 'male', basicInfo: '', personalityCore: '', behaviorPattern: '', coreDesire: '', coreFear: '', secret: '', relationships: '', characterArc: '', speechSamples: '', freedomLevel: '可适度发挥' };
    case 'scene':
      return { id, name: '新场景', timeLocation: '', sensoryDetails: '', atmosphereKeywords: '', sceneFunction: '日常过渡', characterImpact: '', variableElements: '' };
    case 'style':
      return { id, name: '新文风', applicableScene: '通用', styleDescription: '', referenceText: '', antiExample: '' };
    default:
      return { id, name: '未命名' };
  }
}

function cardPreview(category, card) {
  const meta = CARD_META[category];
  if (!meta) return '';
  // 找第一个有内容的字段作为预览
  for (const f of meta.fields) {
    const v = card[f.key];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '（尚未填写内容）';
}

/* ============================ 自动保存 ============================ */

let saveTimer = null;

/** 把 素材库 + 全部项目（含各项目卡牌副本）整体落盘 */
function saveAllData() {
  return window.api.saveData('projects.json', {
    version: 3,
    library: state.library,
    projects: state.projects,
    activeProjectId: state.project ? state.project.id : (state.projects[0] || {}).id
  });
}

function scheduleSave() {
  setSaveBadge('pending');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveAllData();
      setSaveBadge('saved');
    } catch (err) {
      setSaveBadge('error');
      showToast('保存失败：' + err.message, 'error');
    }
  }, 500);
}

async function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try {
    await saveAllData();
    setSaveBadge('saved');
  } catch (err) {
    setSaveBadge('error');
    showToast('保存失败：' + err.message, 'error');
  }
}

function setSaveBadge(kind) {
  const el = $('#save-badge');
  if (!el) return;
  el.classList.remove('pending', 'saved', 'error');
  el.classList.add(kind);
  const label = el.querySelector('.save-label');
  if (label) {
    label.textContent = { pending: '保存中…', saved: '已保存', error: '保存失败' }[kind] || '';
  }
}

/* ============================ 顶部栏 ============================ */

function renderTopBar() {
  const sel = $('#project-select');
  if (sel) {
    sel.innerHTML = state.projects.map((p) =>
      `<option value="${esc(p.id)}" ${p.id === state.project.id ? 'selected' : ''}>${esc(p.name)}</option>`
    ).join('');
  }
}

/** 切换当前项目 */
function switchProject(id) {
  const p = state.projects.find((x) => x.id === id);
  if (!p || p === state.project) return;
  if (state.editing) closeCardModal();
  state.project = p;
  state.activeCategory = 'worldbuilding';
  state.deckIndex = 0;
  state.view = 'cards';
  $('#card-view').classList.remove('hidden');
  $('#synopsis-view').classList.add('hidden');
  $('#chapters-view').classList.add('hidden');
  renderTopBar();
  renderRail();
  renderCardView();
  renderSynopsisView();
  renderBottomBar();
  showToast('已切换到「' + p.name + '」', 'success');
}

/** 新建项目（空项目，从资产池导入素材） */
function createProject() {
  const n = state.projects.length + 1;
  const p = normalizeProject({ id: 'p_' + uid(), name: '未命名小说 ' + n });
  state.projects.push(p);
  state.project = p;
  state.activeCategory = 'worldbuilding';
  state.deckIndex = 0;
  state.view = 'cards';
  $('#card-view').classList.remove('hidden');
  $('#synopsis-view').classList.add('hidden');
  $('#chapters-view').classList.add('hidden');
  renderTopBar();
  renderRail();
  renderCardView();
  renderSynopsisView();
  renderBottomBar();
  scheduleSave();
  showToast('已新建项目，可从素材库导入卡牌', 'success');
}

/** 重命名当前项目（小弹窗） */
function renameProjectDialog() {
  const cur = state.project.name || '';
  promptDialog('重命名项目', cur).then((name) => {
    if (name === null) return;
    state.project.name = name.trim() || '未命名项目';
    renderTopBar();
    scheduleSave();
    showToast('项目已重命名', 'success');
  });
}

/* ============================ 左侧类目栏 ============================ */

function renderRail() {
  const box = $('#rail-icons');
  box.innerHTML = CATEGORIES.map((c) => {
    const m = poolMeta(c.key);
    // 仅在卡牌视图下，类目图标才显示激活态；情节视图下类目全部置为非激活
    const active = (state.view === 'cards' && state.activeCategory === c.key) ? 'active' : '';
    const hasSel = m.selected > 0 ? 'has-selected' : '';
    return `<button class="rail-icon ${c.key} ${active} ${hasSel}" data-cat="${c.key}"
      aria-pressed="${active ? 'true' : 'false'}" aria-label="${c.label}，共 ${m.total} 张，已选 ${m.selected} 张">
      <span class="rail-icon-ico">${ico(c.icon)}</span>
      <span class="rail-icon-label">${c.label}</span>
      <span class="rail-icon-count" title="共 ${m.total} 张卡牌">${m.total}</span>
    </button>`;
  }).join('');

  const synopsisBtn = $('#btn-synopsis');
  if (synopsisBtn) {
    const filled = !!String((state.project.plot && state.project.plot.content) || '').trim();
    synopsisBtn.classList.toggle('has-content', filled);
    synopsisBtn.classList.toggle('active', state.view === 'synopsis');
    synopsisBtn.setAttribute('aria-pressed', state.view === 'synopsis' ? 'true' : 'false');
  }

  const chaptersBtn = $('#btn-chapters');
  if (chaptersBtn) {
    const cnt = (state.project.chapters || []).length;
    const counter = chaptersBtn.querySelector('.rail-action-count');
    if (counter) counter.textContent = String(cnt);
    chaptersBtn.classList.toggle('has-content', cnt > 0);
    chaptersBtn.classList.toggle('active', state.view === 'chapters');
    chaptersBtn.setAttribute('aria-pressed', state.view === 'chapters' ? 'true' : 'false');
  }
}

/* ============================ 视图切换 ============================ */

function switchToCards(categoryKey) {
  if (!CATEGORIES.some((c) => c.key === categoryKey)) return;
  state.activeCategory = categoryKey;
  state.deckIndex = 0; // 切换类目时回到第一张
  state.view = 'cards';
  state._fanIn = true; // 触发卡牌扇入
  renderRail();
  renderCardView();
  $('#card-view').classList.remove('hidden');
  $('#synopsis-view').classList.add('hidden');
  $('#chapters-view').classList.add('hidden');
}

function switchToSynopsis() {
  state.view = 'synopsis';
  renderRail();
  renderSynopsisView();
  $('#card-view').classList.add('hidden');
  $('#synopsis-view').classList.remove('hidden');
  $('#chapters-view').classList.add('hidden');
  setTimeout(() => $('#synopsis-text').focus(), 0);
}

function switchToChapters() {
  state.view = 'chapters';
  renderRail();
  renderChaptersView();
  $('#card-view').classList.add('hidden');
  $('#synopsis-view').classList.add('hidden');
  $('#chapters-view').classList.remove('hidden');
}

/* ============================ 章节管理视图 ============================ */

/** 保存当前章节：把当前组装的完整 Prompt 快照存入项目章节列表（按保存顺序） */
async function saveChapter() {
  // 从预览弹窗保存：保存的就是用户当前看到的那份 Prompt
  const plot = state.project.plot || {};
  const text = String(state.previewText || '').trim() || PromptBuilder.buildPrompt(buildPromptView());
  if (!text.trim()) {
    showToast('当前没有可保存的 Prompt（请先勾选卡牌或填写情节）', 'error');
    return;
  }
  const name = String(plot.chapter || '').trim() + (String(plot.title || '').trim() ? ' ' + String(plot.title).trim() : '');
  const chapter = {
    id: uid(),
    chapter: String(plot.chapter || '').trim(),
    title: String(plot.title || '').trim(),
    name: name || ('第 ' + ((state.project.chapters || []).length + 1) + ' 章'),
    prompt: text,
    tokens: PromptBuilder.estimateTokens(text),
    savedAt: new Date().toISOString()
  };
  if (!state.project.chapters) state.project.chapters = [];
  state.project.chapters.push(chapter);
  renderChaptersView();
  renderRail();
  afterDataChanged();
  showToast('已保存章节「' + chapter.name + '」，共 ' + chapter.tokens + ' Token', 'success');
  flashSuccess($('#btn-preview-save-chapter'), '已保存');
}

function renderChaptersView() {
  const list = $('#chapter-list');
  const meta = $('#chapters-meta');
  const chapters = state.project.chapters || [];
  if (meta) meta.textContent = '共 ' + chapters.length + ' 章 · 双击编辑 · 拖拽排序';
  if (!list) return;
  const empty = $('#chapter-empty');
  if (!chapters.length) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  list.innerHTML = chapters.map((ch, i) => {
    const preview = String(ch.prompt || '').replace(/\s+/g, ' ').slice(0, 90);
    const hasGen = !!(ch.generated && String(ch.generated).trim());
    return `<div class="chapter-item ${hasGen ? 'has-gen' : ''}" data-chapter-id="${esc(ch.id)}" draggable="true" title="双击编辑 · 拖拽排序">
      <span class="chapter-item-grip" title="拖拽排序">${ico('grip')}</span>
      <div class="chapter-item-index">${String(i + 1).padStart(2, '0')}</div>
      <div class="chapter-item-main">
        <div class="chapter-item-head">
          <span class="chapter-item-name">${esc(ch.name || '未命名章节')}</span>
          <span class="chapter-item-meta">${ch.tokens ? ch.tokens + ' Token' : ''}${hasGen ? ' · 已生成 ' + (ch.generatedTokens || '') + ' 字' : ''}</span>
        </div>
        <p class="chapter-item-preview">${esc(preview)}</p>
      </div>
      <div class="chapter-item-actions">
        <button class="btn primary small" data-ch-gen title="把本章提示词推送给 AI 生成正文（一次性返回全文并自动保存）">${ico('sparkles')} ${hasGen ? '重新生成' : '推送生成'}</button>
        ${hasGen ? `<button class="btn ghost small" data-ch-viewgen title="查看已生成的内容">${ico('eye')} 查看生成</button>` : ''}
        <button class="btn ghost small" data-ch-view title="查看提示词">${ico('eye')} 查看</button>
        <button class="btn ghost small" data-ch-copy title="复制提示词">${ico('copy')} 复制</button>
        <button class="btn ghost small danger-text" data-ch-del title="删除">${ico('trash')} 删除</button>
      </div>
    </div>`;
  }).join('');
}

/** 章节编辑弹窗：双击章节行打开，可改章节号 / 标题 / 提示词 */
let editingChapterId = null;
function editChapter(id) {
  const ch = (state.project.chapters || []).find((x) => x.id === id);
  if (!ch) return;
  editingChapterId = id;
  $('#ce-chapter').value = ch.chapter || '';
  $('#ce-title').value = ch.title || '';
  $('#ce-prompt').value = ch.prompt || '';
  $('#chapter-edit-modal').classList.remove('hidden');
  $('#ce-chapter').focus();
}
function closeChapterEdit() {
  editingChapterId = null;
  $('#chapter-edit-modal').classList.add('hidden');
}
function saveChapterEdit() {
  if (!editingChapterId) return;
  const ch = (state.project.chapters || []).find((x) => x.id === editingChapterId);
  if (!ch) return;
  ch.chapter = $('#ce-chapter').value.trim();
  ch.title = $('#ce-title').value.trim();
  ch.prompt = $('#ce-prompt').value;
  ch.name = String(ch.chapter || '').trim() + (String(ch.title || '').trim() ? ' ' + String(ch.title).trim() : '') || ch.name;
  ch.tokens = PromptBuilder.estimateTokens(ch.prompt);
  closeChapterEdit();
  renderChaptersView();
  renderRail();
  afterDataChanged();
  showToast('章节已更新', 'success');
}

/** 推送生成：把章节提示词发给 AI 生成正文，一次性接收全文并自动保存 */
/** 全局 AI 生成状态指示器：切换界面后仍可见后台生成进度 */
function setGenIndicator(busy, text) {
  const el = $('#gen-indicator');
  if (!el) return;
  el.classList.toggle('hidden', !busy);
  if (text) $('#gen-indicator-text').textContent = text;
}

async function generateChapterContent(id) {
  const ch = (state.project.chapters || []).find((x) => x.id === id);
  if (!ch) return;
  const config = state.config || {};
  const providerOk = config.provider === 'ollama'
    ? !!(config.ollamaBaseUrl && config.ollamaModel)
    : !!(config.openaiBaseUrl && config.openaiApiKey && config.openaiModel);
  if (!providerOk) {
    showToast('请先在 ⚙️ 设置 中配置大模型', 'error');
    openSettings();
    return;
  }
  const row = document.querySelector(`.chapter-item[data-chapter-id="${id}"]`);
  const btn = row && row.querySelector('[data-ch-gen]');
  const btnOriginalText = btn ? btn.textContent : '';
  if (btn) { btn.classList.add('loading'); btn.disabled = true; btn.textContent = '生成中…'; }
  setGenIndicator(true, '生成中…');
  try {
    const res = await window.api.llmRequest(config, ch.prompt);
    if (res && res.ok) {
      ch.generated = cleanLLMText(res.text);
      ch.generatedTokens = PromptBuilder.estimateTokens(res.text);
      ch.generatedAt = new Date().toISOString();
      renderChaptersView();
      afterDataChanged();
      showToast('✨ 生成完成并已保存到本章节', 'success');
    } else {
      showToast('生成失败：' + ((res && res.error) || '未知错误'), 'error');
    }
  } catch (err) {
    showToast('生成失败：' + err.message, 'error');
  } finally {
    // 成功时 renderChaptersView 已重建 DOM；失败时手动恢复当前按钮
    const liveBtn = document.querySelector(`.chapter-item[data-chapter-id="${id}"] [data-ch-gen]`);
    const target = liveBtn || btn;
    if (target) {
      target.classList.remove('loading');
      target.disabled = false;
      target.textContent = btnOriginalText || '推送生成';
    }
    setGenIndicator(false);
  }
}

/** 查看章节生成内容 */
function viewGeneratedChapter(id) {
  openChapterDetail(id);
}
function copyGenerated() {
  const ch = (state.project.chapters || []).find((x) => x.id === state.generatedViewId);
  if (!ch) return;
  copyText(ch.generated || '');
  showToast('已复制生成内容', 'success');
}

/** 一键导出·提示词：全部章节的提示词按顺序合并为一个排版好的 txt */
async function exportChaptersPrompts() {
  const chapters = state.project.chapters || [];
  if (!chapters.length) {
    showToast('还没有章节可导出', 'error');
    return;
  }
  const parts = [];
  chapters.forEach((ch, i) => {
    parts.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    parts.push(`第 ${i + 1} 章 · ${ch.name || '未命名章节'}`);
    if (ch.chapter || ch.title) {
      parts.push(`（${ch.chapter || ''}${ch.chapter && ch.title ? ' · ' : ''}${ch.title || ''}）`);
    }
    parts.push('【提示词】');
    parts.push(ch.prompt || '');
    parts.push('');
  });
  try {
    const fp = await window.api.exportText(parts.join('\n'), '章节提示词合集.txt');
    if (fp) showToast('已导出：' + fp, 'success');
  } catch (err) {
    showToast('导出失败：' + err.message, 'error');
  }
}

/** 一键导出·文章：全部已生成 AI 文章的章节按顺序合并为一个排版好的 txt */
async function exportChaptersArticles() {
  const chapters = state.project.chapters || [];
  const has = chapters.filter((ch) => ch.generated && String(ch.generated).trim());
  if (!has.length) {
    showToast('还没有已生成的 AI 文章，请先「推送生成」', 'error');
    return;
  }
  const parts = [];
  has.forEach((ch, i) => {
    parts.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    parts.push(`${i + 1} · ${ch.name || '未命名章节'}`);
    if (ch.chapter || ch.title) {
      parts.push(`（${ch.chapter || ''}${ch.chapter && ch.title ? ' · ' : ''}${ch.title || ''}）`);
    }
    parts.push('【AI 生成文章】');
    parts.push(ch.generated);
    parts.push('');
  });
  try {
    const fp = await window.api.exportText(parts.join('\n'), 'AI生成文章合集.txt');
    if (fp) showToast('已导出：' + fp, 'success');
  } catch (err) {
    showToast('导出失败：' + err.message, 'error');
  }
}

function viewChapter(id) {
  openChapterDetail(id);
}

function viewGeneratedChapter(id) {
  openChapterDetail(id);
}

/** 章节详情弹窗：同时展示提示词与 AI 生成文章（未生成则只显示提示词） */
function openChapterDetail(id) {
  const ch = (state.project.chapters || []).find((x) => x.id === id);
  if (!ch) return;
  state.generatedViewId = id;
  $('#cd-title').textContent = '章节详情 · ' + (ch.name || '未命名章节');
  $('#cd-prompt').innerHTML = highlightPrompt(ch.prompt || '');
  const gen = ch.generated && String(ch.generated).trim();
  const genBlock = $('#cd-gen-block');
  if (gen) {
    genBlock.classList.remove('hidden');
    $('#cd-gen').innerHTML = highlightPrompt(gen);
  } else {
    genBlock.classList.add('hidden');
    $('#cd-gen').innerHTML = '';
  }
  $('#chapter-detail-modal').classList.remove('hidden');
}

function copyChapter(id) {
  const ch = (state.project.chapters || []).find((x) => x.id === id);
  if (!ch) return;
  copyText(ch.prompt);
  showToast('已复制章节 Prompt', 'success');
}

async function deleteChapter(id) {
  const ch = (state.project.chapters || []).find((x) => x.id === id);
  if (!ch) return;
  const ok = await confirmDialog('删除章节', `确定删除「${ch.name || '未命名章节'}」？此操作不可恢复。`, true);
  if (!ok) return;
  state.project.chapters = state.project.chapters.filter((x) => x.id !== id);
  renderChaptersView();
  renderRail();
  afterDataChanged();
  showToast('章节已删除', 'success');
}

/* ============================ 主内容区：卡牌视图（扑克牌层叠） ============================
 *
 * 设计：
 *   - 整组牌横向层叠：左边牌 peek，右边牌也 peek；中间是「焦点牌」
 *   - 焦点牌总是 deckIndex；切换类目时归零
 *   - 点击牌 → 翻转 selected
 *   - 顶部 ✏️ → 编辑弹窗；右上 🗑️ → 删除
 *   - 左右按钮 / ←→ / 圆点导航切换焦点牌
 */

// 手牌式层叠布局（可调到 4~5 张同时呈现）
// 卡片 276×390：主卡对中心距 280px（几乎不重叠，内容全可见）；
// 次级卡逐级外移 196px（重叠更小，侧卡再靠模糊/降透明退到背景）
const PAIR_HALF = 140;     // 两张主卡中心距的一半（主卡对居中并排）
const CARD_GAP = 196;      // 次级卡与主卡之间的横向错位距离（px）

/** 每侧可见次级卡数：窗口不够宽时降级为 1 张，避免侧卡溢出/被裁 */
function sideVisible() {
  return window.innerWidth < 1180 ? 1 : 2;
}

/**
 * 计算某张卡在焦点布局下的位置变量（纯函数）：
 * 环向取最短距离 → 双主卡 / 次级卡（透视微旋）/ 范围外（淡出保留位置）
 */
function cardLayout(category, idx, focus, cards) {
  const len = cards ? cards.length : pool(category).length;
  let offset = idx - focus;
  const half = Math.floor(len / 2);
  if (offset > half) offset -= len;
  else if (offset < -half) offset += len;

  // 双主卡布局：offset 0/1 = 并列主卡；其余 = 左右次级卡（正向排列 + 透视微旋）
  const sv = sideVisible();
  let offsetX = 0, rot = 0, scale = 1, offY = 0, zi = 1, opacity = 1, isPrimary = false;
  let transDur = 0.55, shadowY = 18, shadowBlur = 40, shadowAlpha = 0.45;

  if (offset === 0) {
    // 左主卡：居中偏左，抬升放大，阴影最大最深
    offsetX = -PAIR_HALF;
    offY = -12;
    scale = 1.06;
    zi = 30;
    isPrimary = true;
    transDur = 0.58; shadowY = 26; shadowBlur = 56; shadowAlpha = 0.55;
  } else if (offset === 1) {
    // 右主卡：居中偏右（与左主卡并列）
    offsetX = PAIR_HALF;
    offY = -12;
    scale = 1.06;
    zi = 30;
    isPrimary = true;
    transDur = 0.58; shadowY = 26; shadowBlur = 56; shadowAlpha = 0.55;
  } else {
    // 次级卡：相对主卡对的左右错位 + 面向中心的透视微旋（轻 3D 纵深）
    const side = offset < 0 ? -1 : 1;
    const dist = offset < 0 ? -offset : offset - 1; // 1,2,3...
    if (dist <= sv) {
      offsetX = side * (PAIR_HALF + CARD_GAP * dist);
      rot = -side * 10 * (1 - 0.15 * (dist - 1));
      offY = 8 * dist;
      scale = 1 - 0.05 * dist;
      zi = 30 - dist * 4;
      opacity = dist === 1 ? 0.82 : 0.6;   // 侧卡逐级降透明，退到背景不抢文字
      // 视差：近侧卡略慢，远侧卡略快，产生深度层次感
      transDur = 0.55 - 0.05 * dist;
      shadowY = 18 - 4 * dist;
      shadowBlur = 40 - 8 * dist;
      shadowAlpha = 0.45 - 0.08 * dist;
    } else {
      // 范围外：淡出但保留位置（动画会平滑过渡，下一轮切换时真实移入）
      offsetX = side * (PAIR_HALF + CARD_GAP * (sv + 1));
      offY = 24;
      scale = 0.88;
      zi = 0;
      opacity = 0;
      transDur = 0.45; shadowY = 8; shadowBlur = 20; shadowAlpha = 0.2;
    }
  }
  return { offsetX, rot, scale, offY, zi, opacity, isPrimary, transDur, shadowY, shadowBlur, shadowAlpha };
}

/** 把布局变量写入已存在的卡牌元素（触发 CSS transition 真实移位） */
function applyCardLayout(el, category, idx, focus, cards) {
  const lay = cardLayout(category, idx, focus, cards);
  el.style.setProperty('--offsetX', lay.offsetX + 'px');
  el.style.setProperty('--rot', lay.rot + 'deg');
  el.style.setProperty('--scale', String(lay.scale));
  el.style.setProperty('--offY', lay.offY + 'px');
  el.style.setProperty('--zi', String(lay.zi));
  el.style.setProperty('--trans-dur', lay.transDur + 's');
  el.style.setProperty('--shadow-y', lay.shadowY + 'px');
  el.style.setProperty('--shadow-blur', lay.shadowBlur + 'px');
  el.style.setProperty('--shadow-alpha', String(lay.shadowAlpha));
  el.style.opacity = String(lay.opacity);
  el.classList.toggle('is-primary', !!lay.isPrimary);
  el.classList.toggle('is-side', !lay.isPrimary);
}

/** 同步卡牌底部「已选中/未选」徽标（DOM 复用时 class 切换不会自动更新文字） */
function syncCardBadge(el, selected) {
  const badge = el.querySelector('.pcard-badge');
  if (!badge) return;
  if (selected) {
    badge.className = 'pcard-badge on';
    badge.innerHTML = ico('check') + ' 已选中';
  } else {
    badge.className = 'pcard-badge off';
    badge.innerHTML = ico('circle') + ' 未选';
  }
  el.setAttribute('aria-pressed', selected ? 'true' : 'false');
  const label = (el.getAttribute('aria-label') || '').replace(/(已选中|未选)/, selected ? '已选中' : '未选');
  el.setAttribute('aria-label', label);
}

function renderCardView() {
  const cat = CATEGORIES.find((c) => c.key === state.activeCategory);
  const cards = pool(state.activeCategory) || [];
  const sel = cards.filter((x) => x.selected).length;
  $('#cat-title').innerHTML = `${ico(cat.icon)} <span>${cat.label}</span>`;
  $('#cat-meta').textContent = `共 ${cards.length} 张 · 已选 ${sel} 张`;

  const wrap = $('#card-deck-wrap');
  const deck = $('#card-deck');
  const empty = $('#card-empty');
  const prevBtn = $('#btn-deck-prev');
  const nextBtn = $('#btn-deck-next');

  if (!cards.length) {
    deck.innerHTML = '';
    empty.classList.remove('hidden');
    wrap.classList.add('empty');
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  empty.classList.add('hidden');
  wrap.classList.remove('empty');

  // 焦点索引循环保护
  const len = cards.length;
  if (state.deckIndex >= len) state.deckIndex = state.deckIndex % len;
  if (state.deckIndex < 0) state.deckIndex = (state.deckIndex % len + len) % len;

  // 双主卡循环渲染：主卡对 = (deckIndex, deckIndex+1)，左右各可见次级卡 + 缓冲（含范围外缓冲卡）
  // DOM 复用：同一张卡（data-id）保持同一元素，原地更新 CSS 变量 → transition 驱动【真实移位】
  // （卡片从旧位置平滑移动到新位置，而非重建 DOM 跳位；缓冲卡位于范围外 opacity:0，进出无感知）
  const viewRange = sideVisible() + 1;
  const order = [];
  for (let off = -viewRange; off <= viewRange + 1; off++) {
    const idx = ((state.deckIndex + off) % len + len) % len;
    if (!order.includes(idx)) order.push(idx);
  }
  const existing = new Map();
  deck.querySelectorAll('.pcard').forEach((el) => existing.set(el.dataset.id, el));
  const nextIds = new Set(order.map((i) => cards[i].id));

  // 移除已离开渲染范围的卡（位于范围外 opacity:0，直接移除无视觉跳动）
  for (const [id, el] of existing) {
    if (!nextIds.has(id)) el.remove();
  }

  // 更新保留卡（真实移位） / 创建新进入范围的卡（位于范围外，不可见）
  for (const i of order) {
    const card = cards[i];
    const el = existing.get(card.id);
    if (el) {
      applyCardLayout(el, state.activeCategory, i, state.deckIndex, cards);
      el.dataset.idx = String(i);
      el.classList.toggle('selected', !!card.selected);
      el.classList.toggle('excluded', !card.selected);
      syncCardBadge(el, !!card.selected);
    } else {
      deck.insertAdjacentHTML('beforeend', pcardHTML(state.activeCategory, card, i, state.deckIndex, cards));
    }
  }

  // 类目切换：卡牌扇入（一次性，可见卡按序错开入场）
  if (state._fanIn) {
    state._fanIn = false;
    let k = 0;
    deck.querySelectorAll('.pcard').forEach((el) => {
      if (parseFloat(el.style.opacity || '1') < 0.05) return; // 离屏缓冲卡不参与
      el.classList.add('entering');
      el.style.animationDelay = (k * 55) + 'ms';
      k++;
    });
    clearTimeout(state._fanInTimer);
    state._fanInTimer = setTimeout(() => {
      deck.querySelectorAll('.pcard.entering').forEach((el) => {
        el.classList.remove('entering');
        el.style.animationDelay = '';
      });
    }, 900);
  }

  // 循环模式下翻页按钮始终可用
  if (prevBtn) prevBtn.disabled = false;
  if (nextBtn) nextBtn.disabled = false;
}

/** 翻页：循环移动焦点牌索引（左右按钮 / ←→ 快捷键 / 拨动共用） */
function deckShift(delta) {
  const cards = pool(state.activeCategory) || [];
  if (!cards.length) return;
  const len = cards.length;
  state.deckIndex = ((state.deckIndex + delta) % len + len) % len;
  renderCardView();
  // 真实移位由 .pcard 的 CSS transition 驱动（DOM 复用，原地更新变量）
}

/**
 * 渲染单张扑克牌 —— 手牌式层叠版
 * 结构：
 *   - 顶部彩色装饰条（类目色）
 *   - 左上角：分类 emoji + 类型标签
 *   - 右上角：✏️ 编辑 / 🗑️ 删除（hover 显示）
 *   - 中心：大字号类目 emoji 装饰
 *   - 下半部分：类型 chip → 标题 → 描述预览 → 状态徽标
 * @param {string} category 类目
 * @param {object} card 卡牌对象
 * @param {number} idx 全局索引
 * @param {number} focus 焦点牌索引（决定层级与偏移）
 */
function pcardHTML(category, card, idx, focus, cards) {
  const lay = cardLayout(category, idx, focus, cards);
  const { offsetX, rot, scale, offY, zi, opacity, transDur, shadowY, shadowBlur, shadowAlpha } = lay;

  const stateClass = card.selected ? 'selected' : 'excluded';
  const cat = CATEGORIES.find((c) => c.key === category);
  const len = cards ? cards.length : pool(category).length;

  // 类型 chip（顶部左侧小标签）
  let typeTag = '';
  if (category === 'worldbuilding') typeTag = card.type || '';
  else if (category === 'character') typeTag = card.freedomLevel || '';
  else if (category === 'scene') typeTag = card.sceneFunction || '';
  else if (category === 'style') typeTag = card.applicableScene || '';

  const preview = cardPreview(category, card);
  const cornerLabel = cat ? cat.label : '';
  const counterText = `${idx + 1} / ${len}`;

  // 卡牌主体大图标：角色卡用「形象头像」高清位图代替类目图标（无金环 · 无边框）
  const isCharacter = category === 'character';
  const artCls = isCharacter ? ' gender-art' : '';
  const artHtml = isCharacter
    ? `<img class="gender-img" src="${avatarImg(card.avatar || defaultAvatar(card.gender))}" alt="" draggable="false" loading="lazy">`
    : ico(cat.icon);

  const ariaLabel = `${card.name || '未命名'}，${cornerLabel}，${card.selected ? '已选中' : '未选'}。回车编辑，空格切换选中`;

  return `<div class="pcard ${category} ${stateClass} ${lay.isPrimary ? 'is-primary' : 'is-side'}" data-id="${esc(card.id)}" data-idx="${idx}"
    role="button" tabindex="0" aria-pressed="${card.selected ? 'true' : 'false'}" aria-label="${esc(ariaLabel)}"
    style="--offsetX:${offsetX}px;--rot:${rot}deg;--scale:${scale};--offY:${offY}px;--zi:${zi};--trans-dur:${transDur}s;--shadow-y:${shadowY}px;--shadow-blur:${shadowBlur}px;--shadow-alpha:${shadowAlpha};opacity:${opacity}">
    <div class="pcard-corner">
      <span class="pcard-corner-icon">${ico(cat.icon)}</span>
      <span class="pcard-corner-label">${esc(cornerLabel)}</span>
    </div>
    <div class="pcard-corner-actions">
      <button class="pcard-corner-btn" data-edit tabindex="-1" title="编辑卡牌" aria-label="编辑卡牌">${ico('edit')}</button>
      <button class="pcard-corner-btn danger" data-del tabindex="-1" title="删除卡牌" aria-label="删除卡牌">${ico('trash')}</button>
    </div>
    <div class="pcard-art${artCls}">${artHtml}</div>
    <div class="pcard-info">
      <span class="pcard-title">${esc(card.name || '未命名')}</span>
      <span class="pcard-type">${esc(typeTag || '未分类')}</span>
    </div>
    <div class="pcard-foot">
      <div class="pcard-preview">${esc(preview)}</div>
      <div class="pcard-status">
        ${card.selected
          ? `<span class="pcard-badge on">${ico('check')} 已选中</span>`
          : `<span class="pcard-badge off">${ico('circle')} 未选</span>`}
        <span class="pcard-counter">${esc(counterText)}</span>
      </div>
    </div>
    <span class="pcard-glare" aria-hidden="true"></span>
  </div>`;
}

/* ============================ 新卡牌字段派生 ============================
 * 卡牌派生字段（type chip、描述预览、角标）直接在 pcardHTML() 内联处理，
 * 不再需要 extract 多个小函数，保持逻辑内聚且未来字段增删只需改 pcardHTML 一处。
 */

/* 数字滚动微交互：把元素数值文本缓动到目标值 */
const _numTweens = new WeakMap();
const _reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
function tweenNumber(el, to, format) {
  if (!el) return;
  const fmt = format || ((n) => String(n));
  const prev = _numTweens.get(el);
  if (prev && prev.raf) cancelAnimationFrame(prev.raf);
  const from = prev && typeof prev.value === 'number'
    ? prev.value
    : (parseInt(String(el.textContent).replace(/\D/g, ''), 10) || 0);
  if (_reduceMotion && _reduceMotion.matches) {
    el.textContent = fmt(to);
    _numTweens.set(el, { value: to, raf: 0 });
    return;
  }
  if (from === to) {
    el.textContent = fmt(to);
    _numTweens.set(el, { value: to, raf: 0 });
    return;
  }
  const dur = 380, t0 = performance.now();
  const st = { value: from, raf: 0 };
  _numTweens.set(el, st);
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    st.value = Math.round(from + (to - from) * eased);
    el.textContent = fmt(st.value);
    if (p < 1) st.raf = requestAnimationFrame(step);
    else { st.value = to; st.raf = 0; el.textContent = fmt(to); }
  };
  st.raf = requestAnimationFrame(step);
}

function renderBottomBar() {
  const all = CATEGORIES.flatMap((c) => pool(c.key) || []);
  const sel = all.filter((x) => x.selected).length;
  tweenNumber($('#selected-count'), sel, (n) => String(n));
  const text = PromptBuilder.buildPrompt(buildPromptView());
  const tokens = PromptBuilder.estimateTokens(text);
  const tokEl = $('#token-count');
  if (text) tweenNumber(tokEl, tokens, (n) => '预估 Token：' + n);
  else { tokEl.textContent = '预估 Token：—'; _numTweens.set(tokEl, { value: 0, raf: 0 }); }
  state.previewText = text;
}

/** 组装 PromptBuilder 视图（把当前项目的可见卡 + 情节解析成纯对象） */
function buildPromptView() {
  const plot = (state.project && state.project.plot) || {};
  const gc = (state.project && state.project.globalConstraints) || {};
  return {
    chapter: plot.chapter || '',
    title: plot.title || '',
    plotSynopsis: plot.content || '',
    worldbuildingCards: pool('worldbuilding'),
    characterCards: pool('character'),
    sceneCards: pool('scene'),
    styleCards: pool('style'),
    globalConstraints: gc,
    opening: gc.opening || '',
    closing: gc.closing || ''
  };
}

/* ============================ 卡牌点击 / 拖动 ============================ */

function onCardListMouseDown(e) {
  const card = e.target.closest('.pcard');
  if (!card) return;
  const id = card.dataset.id;
  const idx = parseInt(card.dataset.idx, 10);

  // 角标按钮优先（编辑也可点卡牌上三分之一；删除也可）
  if (e.target.closest('[data-edit]')) {
    e.preventDefault();
    e.stopPropagation();
    openCardEdit(id);
    return;
  }
  if (e.target.closest('[data-del]')) {
    e.preventDefault();
    e.stopPropagation();
    deleteCard(id);
    return;
  }

  e.preventDefault();
  startDeckGesture(card, id, idx, e);
}

/** 卡牌键盘激活：回车=编辑，空格=切换选中，Delete/Backspace=删除 */
function onCardDeckKeyDown(e) {
  const card = e.target.closest && e.target.closest('.pcard');
  if (!card) return;
  const id = card.dataset.id;
  if (e.key === 'Enter') {
    e.preventDefault();
    openCardEdit(id);
  } else if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    e.stopPropagation(); // 阻止 window 全局空格处理，避免重复切换
    toggleSelected(state.activeCategory, id);
    afterDataChanged();
    pulseCard(id);
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteCard(id);
  }
}

/**
 * 卡牌手势（点击 + 左右拨动二合一）：
 * - 水平拖动超过阈值 → 拨动翻页（左拖下一张，右拖上一张），跟随手部位移
 * - 未拖动（点击）→ 按上/下半区：
 *     · 上半区：切换该牌的选中状态（并聚焦）
 *     · 下半区：聚焦该牌并查看它的下一张
 */
function startDeckGesture(cardEl, cardId, idx, startEvent) {
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;
  const deck = $('#card-deck');
  let dxTotal = 0, dyTotal = 0, dragging = false;
  let lastX = startX, lastT = startEvent.timeStamp || performance.now(), vx = 0;

  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    dxTotal = dx;
    dyTotal = dy;
    if (!dragging && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
      dragging = true;
      deck.classList.add('gesturing');
    }
    if (dragging) {
      // 速度采样（px/ms，指数平滑）用于松手甩动判定
      const now = ev.timeStamp || performance.now();
      const dt = now - lastT;
      if (dt > 0) {
        const inst = (ev.clientX - lastX) / dt;
        vx = vx * 0.7 + inst * 0.3;
        lastX = ev.clientX; lastT = now;
      }
      // 橡皮筋式跟手：线性跟随、超出后阻尼收敛，最大约 ±120px
      const raw = dx * 0.5;
      const cap = 120;
      const t = raw > cap ? cap + (raw - cap) * 0.25 : raw < -cap ? -cap + (raw + cap) * 0.25 : raw;
      deck.style.transform = `translateX(${t}px)`;
    }
  }

  function onUp(ev) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    deck.classList.remove('gesturing');
    deck.style.transform = '';

    if (dragging) {
      // 惯性甩动：位移阈值 + 速度共同决定翻页张数
      const fast = Math.abs(vx) > 0.5;
      const veryFast = Math.abs(vx) > 1.1;
      const past = dxTotal <= -55 || dxTotal >= 55;
      let shift = 0;
      if (past || fast) shift = (dxTotal < 0 || vx < 0) ? 1 : -1;
      if (shift !== 0 && (veryFast || Math.abs(dxTotal) > 220)) shift *= 2;
      if (shift !== 0) deckShift(shift);
      return;
    }

    // 点击（不拖动）：上 1/3 → 编辑卡牌；下 2/3 → 切换选中/取消
    // 卡牌切换统一走滚轮与左右箭头按钮
    const rect = cardEl.getBoundingClientRect();
    const y = ev.clientY - rect.top;
    if (y < rect.height / 3) {
      openCardEdit(cardId);
    } else {
      toggleSelected(state.activeCategory, cardId);
      afterDataChanged();
      pulseCard(cardId);
    }
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function pulseCard(cardId) {
  setTimeout(() => {
    const el = document.querySelector(`.pcard[data-id="${cardId}"]`);
    if (el) {
      const isSel = el.classList.contains('selected');
      el.classList.add('just-toggled', isSel ? 'sel-in' : 'sel-out');
      setTimeout(() => el.classList.remove('just-toggled', 'sel-in', 'sel-out'), 750);
    }
  }, 0);
}

function toggleSelected(category, id) {
  const card = findCard(category, id);
  if (!card) return;
  setSelected(category, id, !isSelected(category, id));
}

async function deleteCard(id) {
  const card = findCard(state.activeCategory, id);
  if (!card) return;
  const ok = await confirmDialog('移除卡牌', `确定从当前项目移除「${card.name || '未命名'}」？素材库中的原卡不受影响，其他项目也不受影响。`, true);
  if (!ok) return;
  const cat = state.activeCategory;
  state.project.cards[cat] = (state.project.cards[cat] || []).filter((c) => c.id !== id);
  if (state.project.selected[cat]) delete state.project.selected[cat][id];
  state.deckIndex = 0;
  afterDataChanged();
  showToast('已从当前项目移除，素材库保留', 'success');
}

/** 素材库独立删除：只删素材库原卡，已导入各项目的副本不受影响 */
async function deleteLibraryCard(category, id) {
  const card = findLibCard(category, id);
  if (!card) return;
  const ok = await confirmDialog('删除素材', `确定从素材库删除「${card.name || '未命名'}」？已导入各项目中的副本不受影响。`, true);
  if (!ok) return;
  const poolKey = CAT_POOL[category];
  state.library[poolKey] = state.library[poolKey].filter((c) => c.id !== id);
  afterDataChanged();
  if (!document.getElementById('library-modal').classList.contains('hidden')) renderLibraryModal();
  showToast('素材已从素材库删除，项目副本保留', 'success');
}

function afterDataChanged() {
  renderCardView();
  renderRail();
  renderBottomBar();
  scheduleSave();
}

/* ============================ 顶部按钮 ============================ */

function selectAll() {
  const cards = pool(state.activeCategory) || [];
  const sel = state.project.selected[state.activeCategory] || {};
  cards.forEach((c) => { sel[c.id] = true; });
  afterDataChanged();
}

function selectNone() {
  const cards = pool(state.activeCategory) || [];
  const sel = state.project.selected[state.activeCategory] || {};
  cards.forEach((c) => { delete sel[c.id]; });
  afterDataChanged();
}

function openCardEdit(id) {
  const card = findCard(state.activeCategory, id);
  if (!card) return;
  state.editing = { type: 'card', category: state.activeCategory, id };
  state.editing._aiSessionId = ++aiSessionSeq;
  renderCardModal();
  $('#card-modal').classList.remove('hidden');
}

function openCardNew() {
  state.editing = { type: 'new', category: state.activeCategory };
  state.editing._aiSessionId = ++aiSessionSeq;
  renderCardModal();
  $('#card-modal').classList.remove('hidden');
}

function closeCardModal() {
  $('#card-modal').classList.add('hidden');
  state.editing = null;
  // 丢弃未执行的 AI 队列任务；进行中的请求返回后按会话令牌校验丢弃回填
  if (state._aiQueue) state._aiQueue.length = 0;
  setGenIndicator(false);
}

/* ============================ 选项管理弹窗（下拉选项可增删改 · 全局生效） ============================ */

let optionEditingKey = null; // 正在编辑的字段键
let optionDraft = [];        // 编辑中的选项副本（未保存前不改全局）

function openOptionEditor(fieldKey) {
  optionEditingKey = fieldKey;
  optionDraft = getOptions(fieldKey).slice();
  $('#option-modal-title').textContent = '管理选项 · ' + optionFieldLabel(fieldKey);
  renderOptionList();
  $('#option-modal').classList.remove('hidden');
  const inp = $('#option-add-input');
  if (inp) setTimeout(() => inp.focus(), 60);
}

function renderOptionList() {
  const list = $('#option-list');
  if (!list) return;
  if (!optionDraft.length) {
    list.innerHTML = `<div class="option-empty">还没有选项，在下方输入第一个吧。</div>`;
    return;
  }
  list.innerHTML = optionDraft.map((o, i) => `
    <div class="option-row">
      <span class="option-grip">${ico('circle')}</span>
      <input type="text" class="option-input" value="${esc(o)}" data-i="${i}">
      <button type="button" class="option-move" data-move="-1" title="上移">${ico('chevronUp')}</button>
      <button type="button" class="option-move" data-move="1" title="下移">${ico('chevronDown')}</button>
      <button type="button" class="option-del" data-del="${i}" title="删除">${ico('trash')}</button>
    </div>`).join('');
}

function onOptionModalInput(e) {
  const el = e.target;
  if (el.classList && el.classList.contains('option-input') && el.dataset.i != null) {
    optionDraft[Number(el.dataset.i)] = el.value;
  }
}

function onOptionModalClick(e) {
  const el = e.target.closest('[data-del], [data-move], #option-add-btn, #option-save, #option-close');
  if (!el) return;
  if (el.id === 'option-add-btn') {
    addOptionItem();
  } else if (el.id === 'option-save') {
    saveOptions();
  } else if (el.id === 'option-close') {
    closeOptionEditor();
  } else if (el.hasAttribute('data-del')) {
    const i = Number(el.dataset.del);
    if (i >= 0 && i < optionDraft.length) { optionDraft.splice(i, 1); renderOptionList(); }
  } else if (el.hasAttribute('data-move')) {
    const row = el.closest('.option-row');
    const i = row ? Array.prototype.indexOf.call(row.parentNode.children, row) : -1;
    const dir = Number(el.dataset.move);
    const j = i + dir;
    if (i >= 0 && j >= 0 && j < optionDraft.length) {
      const t = optionDraft[i]; optionDraft[i] = optionDraft[j]; optionDraft[j] = t;
      renderOptionList();
    }
  }
}

function addOptionItem() {
  const inp = $('#option-add-input');
  const v = (inp && inp.value || '').trim();
  if (!v) return;
  optionDraft.push(v);
  if (inp) inp.value = '';
  renderOptionList();
  if (inp) inp.focus();
}

async function saveOptions() {
  if (!optionEditingKey) return;
  const cleaned = optionDraft.map((s) => String(s).trim()).filter(Boolean);
  if (!state.config.cardOptions) state.config.cardOptions = {};
  state.config.cardOptions[optionEditingKey] = cleaned;
  try {
    await window.api.saveData('config.json', state.config);
  } catch (err) { /* 落盘失败不阻塞 UI，下次设置保存会重写 */ }
  closeOptionEditor();
  // 卡牌编辑弹窗若打开着，重新渲染以反映新选项（保留用户已填内容）
  if (state.editing && state.editing._draft) renderCardModal();
  showToast('选项已保存，全局生效', 'success');
}

function closeOptionEditor() {
  optionEditingKey = null;
  optionDraft = [];
  $('#option-modal').classList.add('hidden');
}

/* ============================ 卡牌编辑弹窗 ============================ */

function renderCardModal() {
  const editing = state.editing;
  const titleEl = $('#card-modal-title');
  const body = $('#card-modal-body');
  if (!editing) { titleEl.textContent = ''; body.innerHTML = ''; return; }

  const category = editing.category;
  const cat = CATEGORIES.find((c) => c.key === category);
  const meta = CARD_META[category];

  // 工作卡：新建时给默认值；编辑时取已有卡（素材库编辑取素材库原卡，项目编辑取项目副本）
  let card;
  if (editing.type === 'new') {
    card = defaultsFor(category);
  } else {
    const src = editing.type === 'library-edit'
      ? findLibCard(category, editing.id)
      : findCard(category, editing.id);
    card = JSON.parse(JSON.stringify(src || defaultsFor(category)));
  }

  // 暂存正在编辑的副本；保存时写回 state
  state.editing._draft = card;

  // 只更新标题文本，保留 h2 内的 AI 工具条容器
  if (titleEl.firstChild && titleEl.firstChild.nodeType === Node.TEXT_NODE) {
    titleEl.firstChild.textContent = `${editing.type === 'new' ? '新建' : (editing.type === 'library-edit' ? '编辑素材库·' : '编辑')}${cat.label}卡牌`;
  } else {
    titleEl.textContent = `${editing.type === 'new' ? '新建' : (editing.type === 'library-edit' ? '编辑素材库·' : '编辑')}${cat.label}卡牌`;
  }

  const certRow = meta.certKey ? `
    <div class="field inline-field">
      <label>${esc(meta.certLabel)}</label>
      ${selectHtml(category + '.' + meta.certKey, card[meta.certKey], meta.certKey)}
    </div>` : '';

  // 角色卡：性别与「形象（头像）」放在同一区块（性别在形象标题行右侧），顶行只保留名称/自由度，更舒展
  const characterRow = category === 'character' ? `
    <div class="field block-field avatar-field">
      <div class="avatar-head">
        <label title="选择自己喜欢的形象">形象</label>
        ${selectHtml('character.gender', card.gender, 'gender', 'data-gender-switch')}
      </div>
      <div class="avatar-pick" id="avatar-pick">
        ${avatarGridHtml(card)}
      </div>
    </div>` : '';

  // 按语义分组渲染字段：组标题 + 字段（标题与输入框同一行，说明文字移入悬浮提示，不占编辑空间）
  // 布局规则：同组内「多行输入」两两并排一行、短输入（单行）两两并排一行，其余单列——简约紧凑且保持可读性
  // 每个输入框右侧带一个 ✨ 按钮：单字段级 AI 优化（有内容→精简优化；无内容→精炼生成）
  const aiBtn = (key) => `<button type="button" class="field-ai" data-ai-key="${key}" title="AI 优化该输入框：有内容则精简优化，无内容则生成精炼内容">${ico('sparkles')}</button>`;
  const ph = (f) => `placeholder="填写${esc(f.label)}${f.len ? '（建议 ' + esc(f.len) + ' 字）' : ''}…"`;
  const fieldHtml = (f) => {
    const value = card[f.key] || '';
    const tip = f.hint ? ` title="${esc(f.hint)}"` : '';
    if (f.ml) {
      return `<div class="field block-field">
        <div class="field-label-row">
          <label${tip}>${esc(f.label)}</label>
          ${aiBtn(f.key)}
        </div>
        <textarea data-key="${f.key}" rows="${f.rows || 3}" ${ph(f)}>${esc(value)}</textarea>
      </div>`;
    }
    return `<div class="field inline-field">
      <label${tip}>${esc(f.label)}</label>
      <input type="text" data-key="${f.key}" value="${esc(value)}" ${ph(f)}>
      ${aiBtn(f.key)}
    </div>`;
  };
  const pairWrap = (html) => `<div class="fields-2col">${html}</div>`;
  const groupsHtml = (meta.groups || [{ fields: meta.fields }]).map((g) => {
    const ml = g.fields.filter((f) => f.ml);
    const shorts = g.fields.filter((f) => !f.ml);
    const parts = [];
    let i = 0;
    while (i < ml.length) {
      if (i + 1 < ml.length) { parts.push(pairWrap(fieldHtml(ml[i]) + fieldHtml(ml[i + 1]))); i += 2; }
      else { parts.push(fieldHtml(ml[i])); i += 1; }
    }
    let j = 0;
    while (j < shorts.length) {
      if (j + 1 < shorts.length) { parts.push(pairWrap(fieldHtml(shorts[j]) + fieldHtml(shorts[j + 1]))); j += 2; }
      else { parts.push(fieldHtml(shorts[j])); j += 1; }
    }
    return `<div class="field-group">
      <div class="group-head">
        <span class="group-title" ${g.hint ? `title="${esc(g.hint)}"` : ''}>${esc(g.title || '')}</span>
      </div>
      ${parts.join('')}
    </div>`;
  }).join('');

  body.innerHTML = `
    <div class="field-row">
      <div class="field inline-field">
        <label>卡牌名称</label>
        <input type="text" data-key="name" value="${esc(card.name || '')}" placeholder="给这张卡起个名字…">
      </div>
      <div class="field inline-field">
        <label>${esc(meta.typeLabel)}</label>
        ${selectHtml(category + '.' + meta.typeKey, card[meta.typeKey], meta.typeKey)}
      </div>
      ${characterRow}
      ${certRow}
    </div>
    ${groupsHtml}
    <div class="modal-actions">
      ${editing.type === 'card' ? `<button class="btn danger" data-card-delete>${ico('trash')} 删除卡牌</button>` : ''}
      ${editing.type === 'library-edit' ? `<button class="btn danger" data-card-delete>${ico('trash')} 删除素材</button>` : ''}
      <span class="spacer"></span>
      <button class="btn ghost" data-card-cancel>取消</button>
      <button class="btn primary" data-card-save>保存</button>
    </div>`;
  renderCardAIBar();
}

/** AI 工具条（v1.3.6 字段级）：无快照时提示；优化过字段后提供「还原」 */
function renderCardAIBar() {
  const bar = $('#card-ai-bar');
  if (!bar || !state.editing) return;
  const snap = state.editing._fieldSnapshot;
  const hasSnap = snap && Object.keys(snap).length > 0;
  bar.innerHTML = hasSnap ? `
    <span class="card-ai-done" title="已用 AI 优化过字段，可一键还原">${ico('check')} 已优化 ${Object.keys(snap).length} 项</span>
    <button class="btn ghost small" data-ai-revert title="还原所有 AI 优化过的字段">${ico('rotate')} 还原</button>
  ` : `
    <span class="card-ai-hint" title="每个输入框右侧的 ✨ 按钮：有内容则精简优化，无内容则生成精炼内容">${ico('sparkles')} 点输入框旁的 ✨ 让 AI 优化该字段</span>
  `;
}

function onCardModalInput(e) {
  const el = e.target;
  const key = el.dataset.key;
  if (!key || !state.editing || !state.editing._draft) return;
  state.editing._draft[key] = el.value;
}

async function onCardModalClick(e) {
  const el = e.target.closest('[data-ai-key], [data-ai-revert], [data-field-revert], [data-card-save], [data-card-cancel], [data-card-delete], [data-avatar], [data-opt-manage]');
  if (!el) return;
  if (el.hasAttribute('data-field-revert')) {
    revertFieldAI(el.dataset.fieldRevert);
    return;
  }
  if (el.hasAttribute('data-ai-key')) {
    const fieldKey = el.dataset.aiKey;
    if (!state.editing || !state.editing._draft) return;
    runFieldAIOptimize(fieldKey, el);
    return;
  }
  if (el.hasAttribute('data-opt-manage')) {
    openOptionEditor(el.dataset.optManage);
    return;
  }
  if (el.hasAttribute('data-avatar')) {
    const key = el.dataset.avatar;
    if (!state.editing || !state.editing._draft) return;
    state.editing._draft.avatar = key;
    if (key === 'male') {
      // 选择男性形象 → 性别自动切为「男」并同步下拉
      state.editing._draft.gender = '男';
      const gs = document.querySelector('#card-modal-body [data-key="gender"]');
      if (gs && gs.classList.contains('dd')) {
        gs.dataset.value = '男';
        const v = gs.querySelector('.dd-val');
        if (v) v.textContent = '男';
        gs.querySelectorAll('.dd-opt').forEach((o) => o.classList.toggle('on', o.dataset.ddVal === '男'));
      }
    }
    document.querySelectorAll('#card-modal-body .avatar-opt').forEach((b) => b.classList.toggle('on', b.dataset.avatar === key));
    return;
  }
  if (el.hasAttribute('data-ai-revert')) {
    revertCardAIOptimize();
  } else if (el.hasAttribute('data-card-save')) {
    saveCardFromModal();
  } else if (el.hasAttribute('data-card-cancel')) {
    closeCardModal();
  } else if (el.hasAttribute('data-card-delete')) {
    const editing = state.editing;
    if (!editing) return;
    const cat = editing.category;
    const id = editing.id;
    closeCardModal();
    if (editing.type === 'library-edit') {
      await deleteLibraryCard(cat, id);
    } else if (editing.type === 'card') {
      await deleteCard(id);
    }
  }
}

function saveCardFromModal() {
  const editing = state.editing;
  if (!editing) return;
  const card = editing._draft;
  // 角色卡结构归一（v1.4.4）：旧分字段迁移到新字段后清理，保证全库统一新结构
  if (editing.category === 'character') {
    delete card.personalityCore;
    delete card.behaviorPattern;
    delete card.coreDesire;
    delete card.coreFear;
  }
  if (editing.type === 'new') {
    // 新建：素材库存一张源卡 + 当前项目存一份副本（之后各自独立编辑）
    const poolKey = CAT_POOL[editing.category];
    const libCard = Object.assign({}, card, { category: editing.category });
    state.library[poolKey].push(libCard);
    const copyId = uid();
    const cards = state.project.cards[editing.category] || (state.project.cards[editing.category] = []);
    cards.push(Object.assign({}, libCard, { id: copyId, sourceId: libCard.id }));
    setSelected(editing.category, copyId, true);
  } else if (editing.type === 'library-edit') {
    // 素材库编辑：只改素材库原卡
    const libCard = findLibCard(editing.category, editing.id);
    if (libCard) Object.assign(libCard, card);
  } else {
    // 项目卡编辑：只改项目内副本
    const projCard = findCard(editing.category, editing.id);
    if (projCard) Object.assign(projCard, card);
  }
  closeCardModal();
  afterDataChanged();
  if (!document.getElementById('library-modal').classList.contains('hidden')) renderLibraryModal();
  showToast(editing.type === 'new' ? '卡牌已创建：进入素材库并加入当前项目' : '卡牌已保存', 'success');
}

/* —— 字段级 AI 优化（v1.3.6）：针对编辑页的每个输入框，有内容→精简优化，无内容→精炼生成 —— */

/**
 * 收集卡片上下文摘要（卡名/类型/其他已填字段），让单字段优化结果与整卡逻辑一致。
 * 控制总长度避免 token 占用过高。
 */
function buildFieldContext(category, card, skipKey) {
  const meta = CARD_META[category];
  const parts = [];
  if (card.name) parts.push('名称：' + String(card.name).slice(0, 40));
  if (meta.typeKey && card[meta.typeKey]) parts.push(meta.typeLabel + '：' + String(card[meta.typeKey]).slice(0, 40));
  const groups = meta.groups || [];
  const skipGroup = groups.findIndex((g) => (g.fields || []).some((f) => f.key === skipKey));
  const LIMIT = 200;
  let total = parts.join('\n').length;
  const push = (label, v, maxLen) => {
    const s = label + '：' + String(v).slice(0, maxLen);
    if (total + s.length > LIMIT) return false;
    total += s.length;
    parts.push(s);
    return true;
  };
  // 同组字段优先（与目标字段相关性最强），给更多细节
  if (skipGroup >= 0) {
    for (const f of groups[skipGroup].fields) {
      if (f.key === skipKey) continue;
      if (card[f.key]) { if (!push(f.label, card[f.key], 60)) break; }
    }
  }
  // 其他组只取每字段前 20 字作粗略参考
  for (let i = 0; i < groups.length; i++) {
    if (i === skipGroup) continue;
    for (const f of groups[i].fields) {
      if (f.key === skipKey) continue;
      if (card[f.key]) { if (!push(f.label, card[f.key], 20)) break; }
    }
    if (total >= LIMIT) break;
  }
  const s = parts.join('\n');
  return s.length > LIMIT ? s.slice(0, LIMIT) + '…' : s;
}

/** 解析单字段 AI 返回：剥离字段名前缀/寒暄/围栏，只留内容本身 */
function parseFieldResult(text, fieldLabel) {
  let t = cleanLLMText(text);
  const escL = fieldLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^[\\s*_`#\\-\\d\\.\\)>\\[【]*' + escL + '[】\\]：:\\s-]*', 'i');
  t = t.replace(re, '');
  t = t.replace(/^(好的|好的，|好的!|好，|以下是|以上是|如下|我为你|为你|已为你|请查收|优化结果|优化完成|可以的|没问题|开始|嗯)[，,。:：\s]*/i, '');
  return t.trim();
}

/** 单字段 AI 优化：串行队列执行（v1.3.7）——
 * - 同时点击多个字段 ✨：入队逐个执行（本地 Ollama 并发 1，避免排队堵塞与返回错乱）
 * - 会话令牌：弹窗关闭/切换后，过期请求返回直接丢弃，不回填
 * - 基线校验：请求期间字段被手动修改则不覆盖，保护用户输入
 * - 再次点击同一字段 = 重新生成（换一种写法） */
let aiSessionSeq = 0;

async function runFieldAIOptimize(fieldKey, btn) {
  const editing = state.editing;
  if (!editing || !editing._draft) return;
  if (btn.disabled) return; // 已在队列或执行中，忽略重复点击
  const card = editing._draft;
  const meta = CARD_META[editing.category];
  const field = meta.fields.find((f) => f.key === fieldKey);
  if (!field) return;

  const config = state.config || {};
  const providerOk = config.provider === 'ollama'
    ? !!(config.ollamaBaseUrl && config.ollamaModel)
    : !!(config.openaiBaseUrl && config.openaiApiKey && config.openaiModel);
  if (!providerOk) {
    showToast('请先在 ⚙️ 设置 中配置大模型', 'error');
    openSettings();
    return;
  }

  // 快照（该字段首次优化前记录原值，供「还原」）
  if (!editing._fieldSnapshot) editing._fieldSnapshot = {};
  if (!(fieldKey in editing._fieldSnapshot)) editing._fieldSnapshot[fieldKey] = card[fieldKey] || '';

  const isRegen = !!(editing._fieldRegen && editing._fieldRegen[fieldKey]);
  const built = PromptBuilder.buildFieldOptimizePrompt({
    cardName: card.name || '未命名',
    typeLabel: meta.typeLabel,
    typeValue: card[meta.typeKey] || '',
    fieldLabel: field.label,
    fieldHint: field.hint || '',
    fieldValue: card[fieldKey] || '',
    targetLen: field.len || '',
    contextSummary: buildFieldContext(editing.category, card, fieldKey),
    regen: isRegen
  });

  const task = {
    fieldKey, btn, card, editing, field,
    prompt: built.prompt, mode: built.mode, isRegen,
    baseline: card[fieldKey] || '',      // 点击时基线值（防手动修改被 AI 覆盖）
    sessionId: editing._aiSessionId,      // 会话令牌
    origHTML: btn.innerHTML
  };

  btn.disabled = true;
  btn.classList.add('queued');
  if (!state._aiQueue) state._aiQueue = [];
  state._aiQueue.push(task);
  processAIQueue();
}

/** 队列执行器：同一时间只发一个请求，全部完成后刷新状态 */
async function processAIQueue() {
  if (state._aiRunning) return;
  state._aiRunning = true;
  try {
    while (state._aiQueue && state._aiQueue.length) {
      await runAIQueueTask(state._aiQueue.shift());
    }
  } finally {
    state._aiRunning = false;
  }
  renderCardAIBar();
  setGenIndicator(false);
}

/** 执行单个队列任务（含会话/基线双重校验） */
async function runAIQueueTask(task) {
  const { editing, fieldKey, btn, field } = task;
  const sessionAlive = () =>
    !!state.editing && state.editing._aiSessionId === task.sessionId && state.editing._draft === task.card;

  if (!sessionAlive()) { resetAIButton(btn, task.origHTML); return; }
  if ((task.card[fieldKey] || '') !== task.baseline) {
    resetAIButton(btn, task.origHTML);
    showToast(`「${field.label}」已被手动修改，AI 结果不覆盖`, 'info');
    return;
  }

  btn.classList.remove('queued');
  btn.classList.add('loading');
  const modeLabel = { generate: '生成', expand: '扩充', polish: '润色', condense: '精简' }[task.mode] || '优化';
  setGenIndicator(true, `${modeLabel}「${field.label}」中…`);
  const inputEl = document.querySelector(`#card-modal-body [data-key="${fieldKey}"]`);
  if (inputEl) inputEl.classList.add('ai-loading');

  try {
    const res = await window.api.llmRequest(state.config, task.prompt);
    if (!sessionAlive()) return; // 弹窗已关/切换：丢弃过期结果
    if (res && res.ok) {
      if ((task.card[fieldKey] || '') !== task.baseline) {
        showToast(`「${field.label}」已被手动修改，AI 结果不覆盖`, 'info');
        return;
      }
      const text = parseFieldResult(res.text, field.label);
      if (!text) {
        showToast('AI 返回内容无法解析，请再点一次重新生成', 'error');
        return;
      }
      task.card[fieldKey] = text;
      const input = document.querySelector(`#card-modal-body [data-key="${fieldKey}"]`);
      if (input) input.value = text;
      if (!editing._fieldRegen) editing._fieldRegen = {};
      editing._fieldRegen[fieldKey] = true;
      flashFieldAI(btn);
      markFieldAIOptimized(fieldKey);
      renderCardAIBar();
      const oldLen = String(task.baseline || '').length;
      const newLen = text.length;
      const diff = oldLen > 0 && newLen !== oldLen ? `（${oldLen} 字 → ${newLen} 字）` : '';
      showToast(`「${field.label}」已${modeLabel}${diff}`, 'success');
    } else {
      showToast('AI 优化失败：' + ((res && res.error) || '未知错误'), 'error');
    }
  } catch (err) {
    showToast('AI 优化失败：' + err.message, 'error');
  } finally {
    if (inputEl) inputEl.classList.remove('ai-loading');
    resetAIButton(btn, task.origHTML);
  }
}

/** 复位 AI 按钮（排队/执行结束） */
function resetAIButton(btn, origHTML) {
  if (!btn) return;
  btn.disabled = false;
  btn.classList.remove('loading', 'queued');
  if (origHTML) btn.innerHTML = origHTML;
}

/** 字段优化成功后的按钮短暂反馈（打勾变绿，随即复原） */
function flashFieldAI(btn) {
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.innerHTML = '<span style="color:var(--success)">✓</span>';
  btn.classList.add('ok');
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.classList.remove('ok');
  }, 1100);
}

/** 还原到 AI 优化前的状态（快照覆盖所有优化过的字段） */
function revertCardAIOptimize() {
  const editing = state.editing;
  if (!editing || !editing._fieldSnapshot) return;
  let n = 0;
  for (const [key, val] of Object.entries(editing._fieldSnapshot)) {
    editing._draft[key] = val;
    const input = document.querySelector(`#card-modal-body [data-key="${key}"]`);
    if (input) input.value = val;
    unmarkFieldAI(key);
    n++;
  }
  delete editing._fieldSnapshot;
  delete editing._fieldRegen;
  renderCardAIBar();
  showToast(n ? `已还原 ${n} 个字段` : '没有可还原的字段', n ? 'success' : 'info');
}

/** 单字段还原：仅把该字段恢复到 AI 优化前 */
function revertFieldAI(fieldKey) {
  const editing = state.editing;
  if (!editing || !editing._fieldSnapshot || !(fieldKey in editing._fieldSnapshot)) return;
  const val = editing._fieldSnapshot[fieldKey];
  editing._draft[fieldKey] = val;
  delete editing._fieldSnapshot[fieldKey];
  if (editing._fieldRegen) delete editing._fieldRegen[fieldKey];
  const input = document.querySelector(`#card-modal-body [data-key="${fieldKey}"]`);
  if (input) input.value = val;
  unmarkFieldAI(fieldKey);
  renderCardAIBar();
  showToast('已还原该字段到优化前', 'info');
}

/** 优化成功后给该字段加「已优化」标记 + 单字段还原按钮（幂等） */
function markFieldAIOptimized(fieldKey) {
  const input = document.querySelector(`#card-modal-body [data-key="${fieldKey}"]`);
  if (!input) return;
  const row = input.closest('.field');
  if (!row) return;
  const label = row.querySelector('label');
  if (label) label.classList.add('ai-done');
  if (!row.querySelector('.field-ai-mark')) {
    const mark = document.createElement('span');
    mark.className = 'field-ai-mark';
    mark.textContent = '✓';
    mark.title = '已用 AI 优化该字段';
    if (label) label.insertAdjacentElement('afterend', mark);
  }
  if (!row.querySelector('[data-field-revert]')) {
    const aiBtn = row.querySelector('[data-ai-key]');
    if (aiBtn) {
      const rb = document.createElement('button');
      rb.type = 'button';
      rb.className = 'field-ai field-revert';
      rb.dataset.fieldRevert = fieldKey;
      rb.title = '还原该字段到优化前';
      rb.innerHTML = ico('rotate');
      aiBtn.insertAdjacentElement('afterend', rb);
    }
  }
}

/** 移除字段的已优化标记与单字段还原按钮 */
function unmarkFieldAI(fieldKey) {
  const input = document.querySelector(`#card-modal-body [data-key="${fieldKey}"]`);
  if (!input) return;
  const row = input.closest('.field');
  if (!row) return;
  const label = row.querySelector('label');
  if (label) label.classList.remove('ai-done');
  const mark = row.querySelector('.field-ai-mark');
  if (mark) mark.remove();
  const rb = row.querySelector('[data-field-revert]');
  if (rb) rb.remove();
}

/** 清理 LLM 返回文本：剥离 Markdown 围栏、思维链 think 块、纯文本推理前导与首尾空白 */
function cleanLLMText(text) {
  let t = String(text || '');
  // 剥离 <think>...</think> 思维链（任意位置/多次/未闭合），不保存推理过程
  t = t.replace(/<think[\s\S]*?<\/think>/gi, '');
  if (/<think/i.test(t)) t = t.replace(/<think[\s\S]*$/gi, '');
  t = t.replace(/<\/think>/gi, '');
  t = t.trim();
  // 纯文本推理前导（无标签，如 "Thinking Process: ..."）：开头触发，按正文分界/空行截断
  if (/^\s*(?:thinking process|thought|reasoning|chain[- ]of[- ]thought|思考过程|思考|推理过程|分析|思路|我的思考|我思考)[:：]/i.test(t)) {
    const lines = t.split('\n');
    let cut = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*(?:直接输出|正文[:：]|正文内容|正文如下|以下为(?:正文|内容)|最终答案|答案[:：]|输出[:：]|final (?:answer|output)|result[:：]|answer[:：])/i.test(lines[i])) {
        cut = i; break;
      }
    }
    if (cut >= 0) {
      t = lines.slice(cut).join('\n').replace(/^\s*(?:直接输出|正文[:：]|正文内容|正文如下|以下为(?:正文|内容)|最终答案|答案[:：]|输出[:：]|final (?:answer|output)|result[:：]|answer[:：])/i, '').trim();
    } else {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '' && i < lines.length - 1) {
          const rest = lines.slice(i + 1).join('\n').trim();
          if (rest) { t = rest; }
          break;
        }
      }
    }
  }
  t = t.trim();
  const fence = t.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```\s*$/);
  if (fence) t = fence[1].trim();
  return t;
}

/* ============================ 情节梗概视图（独立内容输入） ============================ */

function renderSynopsisView() {
  renderConstraintPresetSelect();
  const plot = state.project.plot || (state.project.plot = { chapter: '', title: '', content: '' });
  const ta = $('#synopsis-text');
  if (ta && document.activeElement !== ta) {
    ta.value = plot.content || '';
  }
  const ch = $('#synopsis-chapter');
  if (ch && document.activeElement !== ch) ch.value = plot.chapter || '';
  const ti = $('#synopsis-title-input');
  if (ti && document.activeElement !== ti) ti.value = plot.title || '';
  // 创作约束
  const gc = state.project.globalConstraints || (state.project.globalConstraints = {});
  const setVal = (id, v) => {
    const el = $('#' + id);
    if (el && document.activeElement !== el) el.value = v === undefined || v === null ? '' : v;
  };
  setVal('constraint-min', gc.wordCountMin === undefined ? '' : gc.wordCountMin);
  setVal('constraint-max', gc.wordCountMax === undefined ? '' : gc.wordCountMax);
  setVal('constraint-format', gc.formatRequirement);
  setVal('constraint-taboos', gc.taboos);
  updateSynopsisCount();
}

function updateSynopsisCount() {
  const text = String((state.project.plot && state.project.plot.content) || '').trim();
  const count = text.length;
  const el = $('#synopsis-count');
  if (el) el.textContent = String(count);
}

let synopsisSaveTimer = null;
function onSynopsisInput() {
  const plot = state.project.plot;
  plot.content = $('#synopsis-text').value;
  updateSynopsisCount();
  scheduleSynopsisSave();
}
function onSynopsisChapterInput() {
  state.project.plot.chapter = $('#synopsis-chapter').value;
  scheduleSynopsisSave();
}
function onSynopsisTitleInput() {
  state.project.plot.title = $('#synopsis-title-input').value;
  scheduleSynopsisSave();
}
/* 创作约束：字数 / 格式 / 禁忌，随情节一起自动保存 */
function onConstraintInput() {
  const gc = state.project.globalConstraints || (state.project.globalConstraints = {});
  gc.wordCountMin = parseInt($('#constraint-min').value, 10) || null;
  gc.wordCountMax = parseInt($('#constraint-max').value, 10) || null;
  if (gc.wordCountMin && gc.wordCountMax && gc.wordCountMin > gc.wordCountMax) {
    const t = gc.wordCountMin; gc.wordCountMin = gc.wordCountMax; gc.wordCountMax = t;
  }
  gc.formatRequirement = $('#constraint-format').value;
  gc.taboos = $('#constraint-taboos').value;
  scheduleSynopsisSave();
}
function scheduleSynopsisSave() {
  // 节流：停止输入 500ms 后落盘
  clearTimeout(synopsisSaveTimer);
  setSaveBadge('pending');
  synopsisSaveTimer = setTimeout(() => {
    flushSave().then(() => { renderRail(); renderBottomBar(); });
  }, 500);
}

/* ---- 创作约束预设（内置 + 可增删改，全局保存在 config.json） ---- */
const DEFAULT_CONSTRAINT_PRESETS = [
  { name: '玄幻修仙', wordCountMin: 2000, wordCountMax: 4000, formatRequirement: '第三人称有限视角，对话单独成行，打斗与修炼场面节奏分明', taboos: '禁止出现现代词汇与价值观\n禁止开局即无敌、金手指泛滥\n禁止大段设定说教',
    opening: '你是一位专业小说作家，严格遵循以下设定创作，在此之上自由发挥。直接输出小说正文，不要复述或解释设定。', closing: '让角色活起来，让故事自然生长。' },
  { name: '现代都市', wordCountMin: 1500, wordCountMax: 3000, formatRequirement: '第三人称，贴近现实生活场景，对话自然口语化', taboos: '禁止玛丽苏式夸张描写\n禁止巧合堆砌与逻辑硬伤\n禁止说教式议论',
    opening: '你是一位专业小说作家，严格遵循以下设定创作，在此之上自由发挥。直接输出小说正文，不要复述或解释设定。', closing: '让角色活起来，让故事自然生长。' },
  { name: '甜宠言情', wordCountMin: 1500, wordCountMax: 2500, formatRequirement: '第一或第三人称，注重情绪细节、眼神与肢体互动张力', taboos: '禁止虐心虐身与误会拖延\n禁止低俗与物化描写\n禁止配角强行加戏',
    opening: '你是一位专业小说作家，严格遵循以下设定创作，在此之上自由发挥。直接输出小说正文，不要复述或解释设定。', closing: '让角色活起来，让故事自然生长。' },
  { name: '历史权谋', wordCountMin: 2000, wordCountMax: 4000, formatRequirement: '第三人称有限视角，符合时代语感，权谋与势力博弈逻辑严密', taboos: '禁止明显现代词汇与观念\n禁止史实硬伤\n禁止开挂式权术与降智对手',
    opening: '你是一位专业小说作家，严格遵循以下设定创作，在此之上自由发挥。直接输出小说正文，不要复述或解释设定。', closing: '让角色活起来，让故事自然生长。' }
];

function constraintPresets() {
  const c = (state.config && Array.isArray(state.config.constraintPresets) && state.config.constraintPresets) || [];
  return c.length ? c : DEFAULT_CONSTRAINT_PRESETS;
}

function renderConstraintPresetSelect() {
  const sel = $('#constraint-preset-select');
  if (!sel || sel.options.length > 0) return; // 只填充一次，避免重置用户当前选择
  const ps = constraintPresets();
  sel.innerHTML = ps.map((p, i) => `<option value="${i}">${esc(p.name || ('预设 ' + (i + 1)))}</option>`).join('');
}

function applyConstraintPreset() {
  const sel = $('#constraint-preset-select');
  if (!sel) return;
  const ps = constraintPresets();
  const p = ps[Number(sel.value)];
  if (!p) return;
  const gc = state.project.globalConstraints || (state.project.globalConstraints = {});
  if (p.wordCountMin) gc.wordCountMin = p.wordCountMin;
  if (p.wordCountMax) gc.wordCountMax = p.wordCountMax;
  if (!gc.wordCountMin || !gc.wordCountMax || gc.wordCountMin > gc.wordCountMax) {
    const t = gc.wordCountMin; gc.wordCountMin = gc.wordCountMax; gc.wordCountMax = t;
  }
  gc.formatRequirement = p.formatRequirement || '';
  gc.taboos = p.taboos || '';
  gc.opening = p.opening || '';
  gc.closing = p.closing || '';
  renderSynopsisView();
  scheduleSynopsisSave();
  showToast('已套用预设「' + p.name + '」', 'success');
}

/* 预设管理弹窗 */
let presetDraft = [];
function openPresetManager() {
  presetDraft = constraintPresets().map((p) => ({ ...p }));
  renderPresetList();
  $('#preset-modal').classList.remove('hidden');
}
function closePresetManager() {
  presetDraft = [];
  $('#preset-modal').classList.add('hidden');
}
function renderPresetList() {
  const list = $('#preset-list');
  if (!list) return;
  list.innerHTML = presetDraft.map((p, i) => `
    <div class="preset-row" data-i="${i}">
      <div class="preset-row-top">
        <input class="preset-name" value="${esc(p.name || '')}" placeholder="预设名称">
        <div class="preset-row-tools">
          <button class="btn ghost tiny" data-move="-1" title="上移" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn ghost tiny" data-move="1" title="下移" ${i === presetDraft.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn ghost tiny danger" data-del title="删除">删除</button>
        </div>
      </div>
      <div class="preset-range">
        <span class="preset-range-label">字数</span>
        <input class="preset-min" type="number" min="100" max="100000" step="100" value="${p.wordCountMin || ''}" placeholder="2000">
        <span class="constraint-sep">~</span>
        <input class="preset-max" type="number" min="100" max="100000" step="100" value="${p.wordCountMax || ''}" placeholder="4000">
        <span class="constraint-unit">字</span>
      </div>
      <input class="preset-format" value="${esc(p.formatRequirement || '')}" placeholder="格式要求，如：第三人称有限视角、对话单独成行…">
      <textarea class="preset-taboos" rows="2" placeholder="禁忌内容（每行一条）">${esc(p.taboos || '')}</textarea>
      <div class="preset-openclose">
        <span class="preset-range-label">开头引导</span>
        <textarea class="preset-opening" rows="2" placeholder="组装 Prompt 的页眉（留空用内置默认）">${esc(p.opening || '')}</textarea>
      </div>
      <div class="preset-openclose">
        <span class="preset-range-label">结尾引导</span>
        <textarea class="preset-closing" rows="2" placeholder="组装 Prompt 的页脚（留空用内置默认）">${esc(p.closing || '')}</textarea>
      </div>
    </div>`).join('');
}
function onPresetModalClick(e) {
  const el = e.target.closest('[data-del], [data-move], #preset-add-btn, #preset-save, #preset-close');
  if (!el) return;
  if (el.id === 'preset-add-btn') {
    presetDraft.push({ name: '', wordCountMin: null, wordCountMax: null, formatRequirement: '', taboos: '' });
    renderPresetList();
  } else if (el.id === 'preset-save') {
    saveConstraintPresets();
  } else if (el.id === 'preset-close') {
    closePresetManager();
  } else if (el.hasAttribute('data-del')) {
    const row = el.closest('.preset-row');
    const i = row ? Number(row.dataset.i) : -1;
    if (i >= 0 && i < presetDraft.length) { presetDraft.splice(i, 1); renderPresetList(); }
  } else if (el.hasAttribute('data-move')) {
    const row = el.closest('.preset-row');
    const i = row ? Number(row.dataset.i) : -1;
    const j = i + Number(el.dataset.move);
    if (i >= 0 && j >= 0 && j < presetDraft.length) {
      const t = presetDraft[i]; presetDraft[i] = presetDraft[j]; presetDraft[j] = t;
      renderPresetList();
    }
  }
}
function onPresetModalInput(e) {
  const row = e.target.closest('.preset-row');
  if (!row) return;
  const i = Number(row.dataset.i);
  if (i < 0 || i >= presetDraft.length) return;
  const p = presetDraft[i];
  if (e.target.classList.contains('preset-name')) p.name = e.target.value;
  else if (e.target.classList.contains('preset-min')) p.wordCountMin = parseInt(e.target.value, 10) || null;
  else if (e.target.classList.contains('preset-max')) p.wordCountMax = parseInt(e.target.value, 10) || null;
  else if (e.target.classList.contains('preset-format')) p.formatRequirement = e.target.value;
  else if (e.target.classList.contains('preset-taboos')) p.taboos = e.target.value;
  else if (e.target.classList.contains('preset-opening')) p.opening = e.target.value;
  else if (e.target.classList.contains('preset-closing')) p.closing = e.target.value;
}
async function saveConstraintPresets() {
  const cleaned = presetDraft
    .map((p) => ({
      name: String(p.name || '').trim(),
      wordCountMin: p.wordCountMin || null,
      wordCountMax: p.wordCountMax || null,
      formatRequirement: String(p.formatRequirement || '').trim(),
      taboos: String(p.taboos || '').trim(),
      opening: String(p.opening || '').trim(),
      closing: String(p.closing || '').trim()
    }))
    .filter((p) => p.name);
  state.config.constraintPresets = cleaned;
  try {
    await window.api.saveData('config.json', state.config);
  } catch (err) { /* 落盘失败不阻塞 UI */ }
  // 清空并重新填充下拉（含新改的名称）
  const sel = $('#constraint-preset-select');
  if (sel) sel.innerHTML = '';
  renderConstraintPresetSelect();
  closePresetManager();
  showToast('约束预设已保存，全局生效', 'success');
}

async function clearSynopsis() {
  const ok = await confirmDialog('清空情节梗概', '确定清空情节梗概？清空后将从 Prompt 中移除此段。', true);
  if (!ok) return;
  state.project.plot = { chapter: '', title: '', content: '' };
  const ta = $('#synopsis-text');
  if (ta) ta.value = '';
  const ch = $('#synopsis-chapter');
  if (ch) ch.value = '';
  const ti = $('#synopsis-title-input');
  if (ti) ti.value = '';
  updateSynopsisCount();
  renderRail();
  renderBottomBar();
  scheduleSave();
  showToast('情节梗概已清空', 'success');
}

async function aiPolishSynopsis() {
  const config = state.config || {};
  const providerOk = config.provider === 'ollama'
    ? !!(config.ollamaBaseUrl && config.ollamaModel)
    : !!(config.openaiBaseUrl && config.openaiApiKey && config.openaiModel);
  if (!providerOk) {
    showToast('请先在 ⚙️ 设置 中配置大模型', 'error');
    openSettings();
    return;
  }
  const ta = $('#synopsis-text');
  const cur = ta.value || '';
  const prompt = PromptBuilder.buildOptimizePrompt('情节梗概', '剧情梗概', cur);
  const btn = $('#btn-synopsis-ai');
  btn.classList.add('loading');
  btn.disabled = true;
  const btnLabel = btn.querySelector('span');
  if (btnLabel) btnLabel.textContent = '润色中…';
  setGenIndicator(true, '情节润色中…');
  try {
    const res = await window.api.llmRequest(config, prompt);
    if (res && res.ok) {
      const cleaned = cleanLLMText(res.text);
      ta.value = cleaned;
      state.project.plot.content = cleaned;
      updateSynopsisCount();
      renderRail();
      renderBottomBar();
      flushSave();
      showToast('✨ 润色完成', 'success');
    } else {
      showToast('AI 润色失败：' + ((res && res.error) || '未知错误'), 'error');
    }
  } catch (err) {
    showToast('AI 润色失败：' + err.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    if (btnLabel) btnLabel.textContent = 'AI 润色';
    setGenIndicator(false);
  }
}

/* ============================ Prompt 预览 / 导出 ============================ */

function openPreview() {
  const text = state.previewText || PromptBuilder.buildPrompt(state.project);
  if (!text) {
    showToast('请先勾选卡牌或填写情节梗概', 'error');
    return;
  }
  $('#preview-code').innerHTML = highlightPrompt(text);
  $('#preview-modal').classList.remove('hidden');
}

function closePreview() {
  $('#preview-modal').classList.add('hidden');
}

function flashSuccess(btn, label) {
  if (!btn || btn.dataset.flashing) return;
  btn.dataset.flashing = '1';
  const orig = btn.innerHTML;
  btn.classList.add('is-success');
  btn.innerHTML = ico('check') + '<span>' + esc(label || '已复制') + '</span>';
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.classList.remove('is-success');
    delete btn.dataset.flashing;
  }, 1500);
}

function copyPrompt() {
  const text = state.previewText || '';
  if (!text) {
    showToast('暂无可复制的 Prompt', 'error');
    return;
  }
  copyText(text);
  showToast('已复制到剪贴板', 'success');
  flashSuccess($('#btn-copy'), '已复制');
}

function highlightPrompt(text) {
  return String(text).split('\n').map((line) => {
    const t = esc(line);
    const trimmed = line.trim();
    if (/^【.+】$/.test(trimmed)) return `<span class="line pc-title">${t}</span>`;
    if (/[═─]/.test(trimmed)) return `<span class="line pc-sep">${t}</span>`;
    if (/^▸/.test(trimmed)) return `<span class="line pc-head">${t}</span>`;
    if (/^（.*）$/.test(trimmed)) return `<span class="line pc-note">${t}</span>`;
    return `<span class="line">${t}</span>`;
  }).join('');
}

/* ============================ 导入 / 导出 JSON ============================ */

async function exportJSON() {
  try {
    const payload = {
      version: 3,
      library: state.library,
      projects: state.projects,
      activeProjectId: state.project ? state.project.id : ''
    };
    const fp = await window.api.exportFile(payload);
    if (fp) showToast('已导出：' + fp, 'success');
  } catch (err) {
    showToast('导出失败：' + err.message, 'error');
  }
}

async function importJSON() {
  await flushSave();
  let data = null;
  try {
    data = await window.api.importFile();
  } catch (err) {
    showToast('导入失败：' + err.message, 'error');
    return;
  }
  if (!data) return;
  const ok = await confirmDialog('导入数据', '导入将覆盖当前所有数据，是否继续？', false);
  if (!ok) return;
  const nd = normalizeData(data);
  state.library = nd.library;
  state.projects = nd.projects;
  state.project = nd.projects.find((p) => p.id === nd.activeProjectId) || nd.projects[0];
  state.activeCategory = 'worldbuilding';
  state.view = 'cards';
  $('#card-view').classList.remove('hidden');
  $('#synopsis-view').classList.add('hidden');
  $('#chapters-view').classList.add('hidden');
  renderTopBar();
  renderRail();
  renderCardView();
  renderSynopsisView();
  renderBottomBar();
  scheduleSave();
  showToast('导入成功', 'success');
}

/* ============================ 全屏切换 ============================ */

async function toggleFullscreen() {
  // 通过主进程 IPC 切换全屏：避免渲染进程直接调 setFullScreen 的限制
  if (window.api && window.api.toggleFullscreen) {
    await window.api.toggleFullscreen();
  }
}

/** 切换标题栏最大化图标（□ ↔ 还原双框） */
function updateWinMaxIcon(isMax) {
  const svg = $('#win-max-svg');
  if (!svg) return;
  svg.innerHTML = isMax
    ? '<rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.1"/><rect x="2.5" y="0.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.1"/>'
    : '<rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.1"/>';
}

/* ============================ 大模型设置 ============================ */

function openSettings() {
  const cfg = state.config;
  const radio = document.querySelector(`input[name="provider"][value="${cfg.provider || 'ollama'}"]`);
  if (radio) radio.checked = true;
  $('#cfg-ollama-url').value = cfg.ollamaBaseUrl || 'http://localhost:11434';
  $('#cfg-ollama-model').value = cfg.ollamaModel || '';
  $('#cfg-openai-url').value = cfg.openaiBaseUrl || '';
  $('#cfg-openai-key').value = cfg.openaiApiKey || '';
  $('#cfg-openai-model').value = cfg.openaiModel || '';
  renderPresetButtons();
  onProviderChange();
  setTestResult('', '');
  $('#settings-overlay').classList.remove('hidden');
}

function closeSettings() { $('#settings-overlay').classList.add('hidden'); }

function onProviderChange() {
  const provider = document.querySelector('input[name="provider"]:checked').value;
  $('#ollama-section').classList.toggle('hidden', provider !== 'ollama');
  $('#openai-section').classList.toggle('hidden', provider !== 'openai_compatible');
}

function renderPresetButtons() {
  const box = $('#preset-buttons');
  const presets = (state.config && state.config.presets) || [];
  box.innerHTML = presets
    .map((p) => `<button class="preset-btn" data-url="${esc(p.baseUrl)}" data-model="${esc(p.model)}">${esc(p.name)}</button>`)
    .join('');
  box.querySelectorAll('.preset-btn').forEach((b) => {
    b.addEventListener('click', () => {
      $('#cfg-openai-url').value = b.dataset.url;
      $('#cfg-openai-model').value = b.dataset.model;
      $('#cfg-openai-key').focus();
      showToast('已填充预设：' + b.textContent, 'success');
    });
  });
}

function gatherSettingsConfig() {
  const provider = document.querySelector('input[name="provider"]:checked').value;
  return {
    provider,
    ollamaBaseUrl: $('#cfg-ollama-url').value.trim() || 'http://localhost:11434',
    ollamaModel: $('#cfg-ollama-model').value.trim(),
    openaiApiKey: $('#cfg-openai-key').value.trim(),
    openaiBaseUrl: $('#cfg-openai-url').value.trim(),
    openaiModel: $('#cfg-openai-model').value.trim(),
    presets: (state.config && state.config.presets) || []
  };
}

function setTestResult(text, cls) {
  const el = $('#test-result');
  el.textContent = text;
  el.className = 'test-result' + (cls ? ' ' + cls : '');
}

async function testConnection() {
  const cfg = gatherSettingsConfig();
  const btn = $('#btn-test');
  btn.disabled = true;
  const btnLabel = btn.querySelector('span');
  if (btnLabel) btnLabel.textContent = '测试中…';
  setTestResult('正在连接，请稍候…', 'pending');
  try {
    const res = await window.api.llmTest(cfg);
    if (res && res.ok) {
      setTestResult('✅ 连接成功：' + String(res.text).slice(0, 80), 'ok');
    } else {
      setTestResult('❌ 连接失败：' + ((res && res.error) || '未知错误'), 'err');
    }
  } catch (err) {
    setTestResult('❌ 连接失败：' + err.message, 'err');
  } finally {
    btn.disabled = false;
    if (btnLabel) btnLabel.textContent = '测试连接';
  }
}

async function saveSettings() {
  state.config = gatherSettingsConfig();
  try {
    await window.api.saveData('config.json', state.config);
    showToast('配置已保存', 'success');
    closeSettings();
  } catch (err) {
    showToast('保存失败：' + err.message, 'error');
  }
}

/* ============================ Toast / 确认弹窗 ============================ */

let toastTimer = null;

function showToast(msg, type) {
  const el = $('#toast');
  const t = type === 'error' ? 'error' : type === 'info' ? 'info' : 'success';
  const icon = t === 'error' ? 'alert' : t === 'info' ? 'info' : 'check';
  el.className = 'toast ' + t;
  el.innerHTML = ico(icon) + '<span>' + esc(String(msg)) + '</span>';
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

function confirmDialog(title, message, danger) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2></h2>
        <p class="modal-message"></p>
        <div class="modal-actions">
          <button class="btn ghost" data-act="cancel">取消</button>
          <span class="spacer"></span>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-act="ok">${danger ? '确定删除' : '确定'}</button>
        </div>
      </div>`;
    overlay.querySelector('h2').textContent = title;
    overlay.querySelector('.modal-message').textContent = message;
    const close = (val) => {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(val);
    };
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter' && document.activeElement && document.activeElement.tagName !== 'TEXTAREA') close(true);
    };
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    const ok = overlay.querySelector('[data-act="ok"]');
    if (ok) setTimeout(() => ok.focus(), 0);
  });
}

/** 通用文本输入弹窗（返回输入值；取消返回 null） */
function promptDialog(title, initial) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2></h2>
        <input type="text" class="prompt-input" placeholder="请输入…">
        <div class="modal-actions">
          <button class="btn ghost" data-act="cancel">取消</button>
          <span class="spacer"></span>
          <button class="btn primary" data-act="ok">确定</button>
        </div>
      </div>`;
    overlay.querySelector('h2').textContent = title;
    const input = overlay.querySelector('.prompt-input');
    input.value = initial || '';
    const close = (val) => {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(val);
    };
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => close(input.value));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    const onKey = (e) => {
      if (e.key === 'Escape') close(null);
      else if (e.key === 'Enter') close(input.value);
    };
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    setTimeout(() => { input.focus(); input.select(); }, 0);
  });
}

/* ============================ 素材库（资产池） ============================ */

function openLibrary() {
  state.libraryTab = 'worldbuilding';
  renderLibraryModal();
  $('#library-modal').classList.remove('hidden');
}

function closeLibrary() {
  $('#library-modal').classList.add('hidden');
}

function renderLibraryModal() {
  const cat = state.libraryTab || 'worldbuilding';
  const tabs = $('#library-tabs');
  const list = $('#library-list');
  const count = $('#library-count');
  const hint = $('#library-hint');
  if (!tabs || !list) return;
  if (hint) hint.textContent = `素材库独立管理：可导入到任意小说（副本），删除素材不影响任何项目`;

  // 类目切换 tab
  tabs.innerHTML = CATEGORIES.map((c) => {
    const lib = state.library[CAT_POOL[c.key]] || [];
    const imported = countImported(c.key, lib);
    return `<button class="lib-tab ${c.key === cat ? 'active' : ''}" data-lib-tab="${c.key}">
      ${ico(c.icon)} ${c.label}<span class="lib-tab-count">${imported}/${lib.length}</span>
    </button>`;
  }).join('');

  // 素材列表
  const lib = state.library[CAT_POOL[cat]] || [];
  const meta = CARD_META[cat];
  if (!lib.length) {
    list.innerHTML = `<div class="lib-empty">素材库中还没有${CATEGORIES.find((c) => c.key === cat).label}素材</div>`;
  } else {
    list.innerHTML = lib.map((card) => {
      const preview = cardPreview(cat, card);
      const typeTag = card[meta.typeKey] || '';
      const imported = hasImportedCopy(cat, card.id);
      const btn = imported
        ? `<span class="lib-imported">${ico('check')} 已导入</span>`
        : `<button class="btn primary small" data-lib-import="${esc(card.id)}">导入</button>`;
      return `<div class="lib-item">
        <div class="lib-item-main">
          <div class="lib-item-head">
            <span class="lib-item-name">${esc(card.name || '未命名')}</span>
            ${typeTag ? `<span class="lib-item-type">${esc(typeTag)}</span>` : ''}
          </div>
          <p class="lib-item-preview">${esc(preview)}</p>
        </div>
        <div class="lib-item-actions">
          ${btn}
          <button class="btn ghost small" data-lib-edit="${esc(card.id)}">${ico('edit')} 编辑</button>
          <button class="btn ghost small danger-text" data-lib-del="${esc(card.id)}">${ico('trash')} 删除</button>
        </div>
      </div>`;
    }).join('');
  }
  const total = CATEGORIES.reduce((n, c) => n + (state.library[CAT_POOL[c.key]] || []).length, 0);
  if (count) count.textContent = `素材库共 ${total} 张素材 · 可重复导入多部小说（项目内为独立副本）`;
}

/** 当前项目已导入多少张来自该素材库类目的卡 */
function countImported(category, lib) {
  const projCards = (state.project && state.project.cards && state.project.cards[category]) || [];
  return lib.filter((x) => projCards.some((c) => c.sourceId === x.id)).length;
}

/** 当前项目是否已导入该素材卡（按 sourceId 判断） */
function hasImportedCopy(category, libCardId) {
  const projCards = (state.project && state.project.cards && state.project.cards[category]) || [];
  return projCards.some((c) => c.sourceId === libCardId);
}

function importToProject(id) {
  const cat = state.libraryTab || 'worldbuilding';
  const src = findLibCard(cat, id);
  if (!src) return;
  const cards = state.project.cards[cat] || (state.project.cards[cat] = []);
  if (!cards.some((c) => c.sourceId === src.id)) {
    const copy = Object.assign({}, src, { id: uid(), sourceId: src.id, category: cat });
    cards.push(copy);
    setSelected(cat, copy.id, true);
  }
  afterDataChanged();
  renderLibraryModal();
  showToast('已导入当前项目（独立副本）', 'success');
}

/** 素材库编辑：打开卡牌编辑弹窗（只改素材库原卡） */
function openLibraryEdit(id) {
  const cat = state.libraryTab || 'worldbuilding';
  state.editing = { type: 'library-edit', category: cat, id };
  renderCardModal();
  $('#card-modal').classList.remove('hidden');
}

/* ============================ 事件绑定 ============================ */

function bindEvents() {
  // 顶部栏：项目切换 / 新建 / 重命名 / 素材库
  $('#project-select').addEventListener('change', (e) => switchProject(e.target.value));
  $('#btn-project-new').addEventListener('click', createProject);
  $('#btn-project-rename').addEventListener('click', renameProjectDialog);
  $('#btn-library').addEventListener('click', openLibrary);
  $('#btn-settings').addEventListener('click', openSettings);
  // 开源地址：用系统默认浏览器打开 GitHub 仓库
  const REPO_URL = 'https://github.com/94486/novel-prompt-builder';
  const ghBtn = $('#btn-github');
  if (ghBtn) ghBtn.addEventListener('click', () => {
    if (window.api && window.api.openExternal) window.api.openExternal(REPO_URL);
  });
  // 导入 / 导出已移入素材库弹窗（btn-lib-export / btn-lib-import）
  $('#btn-lib-export').addEventListener('click', exportJSON);
  $('#btn-lib-import').addEventListener('click', importJSON);
  // 全屏：保留 F11 快捷键（main.js），不再提供顶部按钮

  // 自定义标题栏：最小化 / 最大化（还原）/ 关闭；双击标题栏最大化
  const winCtl = window.api && window.api.windowControl;
  const winBtn = (id, fn) => { const el = $(id); if (el && winCtl) el.addEventListener('click', fn); };
  winBtn('#win-min', () => winCtl.minimize());
  winBtn('#win-max', () => winCtl.maximizeToggle());
  winBtn('#win-close', () => winCtl.close());
  if (winCtl && winCtl.onMaximized) {
    winCtl.onMaximized((isMax) => updateWinMaxIcon(isMax));
  }
  const topbarEl = $('#topbar');
  if (topbarEl && winCtl) {
    topbarEl.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, select, .no-drag')) return;
      winCtl.maximizeToggle();
    });
  }

  // 卡牌滚轮驱动轮换（仅卡牌视图可见时；节流保证丝滑连续）
  const deckWrap = $('#card-deck-wrap');
  if (deckWrap) {
    let wheelLock = false;
    deckWrap.addEventListener('wheel', (e) => {
      const cardView = $('#card-view');
      if (cardView && cardView.classList.contains('hidden')) return;
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      deckShift(e.deltaY > 0 ? 1 : -1);
      setTimeout(() => { wheelLock = false; }, 320);
    }, { passive: false });
  }

  // 左侧类目栏：点击类目图标 → 切换到卡牌视图
  $('#rail-icons').addEventListener('click', (e) => {
    const icon = e.target.closest('.rail-icon');
    if (icon) switchToCards(icon.dataset.cat);
  });
  // 点击情节按钮 → 切换到情节输入视图
  $('#btn-synopsis').addEventListener('click', switchToSynopsis);
  // 点击章节按钮 → 切换到章节管理视图
  $('#btn-chapters').addEventListener('click', switchToChapters);

  // 情节梗概视图（章节 / 标题 / 正文）
  const synTa = $('#synopsis-text');
  if (synTa) synTa.addEventListener('input', onSynopsisInput);
  const synCh = $('#synopsis-chapter');
  if (synCh) synCh.addEventListener('input', onSynopsisChapterInput);
  const synTi = $('#synopsis-title-input');
  if (synTi) synTi.addEventListener('input', onSynopsisTitleInput);
  // 创作约束（字数 / 格式 / 禁忌）
  ['constraint-min', 'constraint-max', 'constraint-format', 'constraint-taboos'].forEach((id) => {
    const el = $('#' + id);
    if (el) el.addEventListener('input', onConstraintInput);
  });
  // 创作约束预设：套用 / 管理
  const presetApply = $('#btn-preset-apply');
  if (presetApply) presetApply.addEventListener('click', applyConstraintPreset);
  const presetManage = $('#btn-preset-manage');
  if (presetManage) presetManage.addEventListener('click', openPresetManager);
  const presetModal = $('#preset-modal');
  if (presetModal) {
    presetModal.addEventListener('click', onPresetModalClick);
    presetModal.addEventListener('input', onPresetModalInput);
  }
  const synAI = $('#btn-synopsis-ai');
  if (synAI) synAI.addEventListener('click', aiPolishSynopsis);
  const synClear = $('#btn-synopsis-clear');
  if (synClear) synClear.addEventListener('click', clearSynopsis);

  // 章节管理视图：查看 / 复制 / 删除
  const chList = $('#chapter-list');
  if (chList) {
    chList.addEventListener('click', (e) => {
      const item = e.target.closest('.chapter-item');
      if (!item) return;
      const id = item.dataset.chapterId;
      if (e.target.closest('[data-ch-gen]')) { generateChapterContent(id); return; }
      if (e.target.closest('[data-ch-viewgen]')) { viewGeneratedChapter(id); return; }
      if (e.target.closest('[data-ch-view]')) viewChapter(id);
      else if (e.target.closest('[data-ch-copy]')) copyChapter(id);
      else if (e.target.closest('[data-ch-del]')) deleteChapter(id);
    });
    // 双击章节行 → 编辑章节（章节号 / 标题 / 提示词）
    chList.addEventListener('dblclick', (e) => {
      const item = e.target.closest('.chapter-item');
      if (!item) return;
      if (e.target.closest('button')) return;
      editChapter(item.dataset.chapterId);
    });
    // 拖拽排序
    let dragId = null;
    chList.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.chapter-item');
      if (!item) return;
      dragId = item.dataset.chapterId;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch (_e) { /* 忽略 */ }
    });
    chList.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const over = e.target.closest('.chapter-item');
      if (!over || !dragId || over.dataset.chapterId === dragId) return;
      const rect = over.getBoundingClientRect();
      const after = (e.clientY - rect.top) > rect.height / 2;
      if (after) over.after(document.querySelector(`.chapter-item[data-chapter-id="${dragId}"]`));
      else over.before(document.querySelector(`.chapter-item[data-chapter-id="${dragId}"]`));
    });
    chList.addEventListener('dragend', (e) => {
      const item = e.target.closest('.chapter-item');
      if (item) item.classList.remove('dragging');
      const ordered = [...chList.querySelectorAll('.chapter-item')].map((el) => el.dataset.chapterId);
      const chapters = state.project.chapters || [];
      const map = new Map(chapters.map((c) => [c.id, c]));
      state.project.chapters = ordered.map((id) => map.get(id)).filter(Boolean);
      renderChaptersView();
      renderRail();
      afterDataChanged();
    });
    // 章节管理右上角一键导出（提示词 / AI 文章分开）
    const chExportP = $('#btn-chapters-export-prompts');
    if (chExportP) chExportP.addEventListener('click', exportChaptersPrompts);
    const chExportA = $('#btn-chapters-export-articles');
    if (chExportA) chExportA.addEventListener('click', exportChaptersArticles);
  }

  // 主区（卡牌视图）
  $('#btn-new-card').addEventListener('click', openCardNew);
  $('#btn-select-all').addEventListener('click', selectAll);
  $('#btn-select-none').addEventListener('click', selectNone);

  // 卡牌堆：mousedown 同时处理点击（上/下半区）与左右拨动
  $('#card-deck').addEventListener('mousedown', onCardListMouseDown);
  // 卡牌键盘激活（回车编辑 / 空格选中 / Delete 删除）
  $('#card-deck').addEventListener('keydown', onCardDeckKeyDown);

  // 卡牌 3D 倾斜 + 高光跟随光标（尊重系统「减少动效」偏好）
  (function initCardTilt() {
    const deckEl = $('#card-deck');
    if (!deckEl) return;
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    const MAX_TILT = 9;
    let raf = null, target = null, lastEv = null;
    const reset = (el) => {
      if (!el) return;
      el.style.setProperty('--tiltX', '0deg');
      el.style.setProperty('--tiltY', '0deg');
      el.style.setProperty('--gx', '50%');
      el.style.setProperty('--gy', '50%');
    };
    const apply = () => {
      raf = null;
      const el = target, ev = lastEv;
      if (!el || !ev) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (ev.clientX - r.left) / r.width;   // 0..1
      const py = (ev.clientY - r.top) / r.height;   // 0..1
      el.style.setProperty('--tiltY', ((px - 0.5) * 2 * MAX_TILT).toFixed(2) + 'deg');
      el.style.setProperty('--tiltX', (-(py - 0.5) * 2 * MAX_TILT).toFixed(2) + 'deg');
      el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    };
    deckEl.addEventListener('mousemove', (e) => {
      if (mq && mq.matches) return;
      const card = e.target.closest('.pcard');
      if (!card) { if (target) { reset(target); target = null; } return; }
      if (target && target !== card) reset(target);
      target = card; lastEv = e;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    deckEl.addEventListener('mouseleave', () => { reset(target); target = null; });
  })();

  // 背景氛围随指针视差（远层星云位移小、近层秋叶位移大，形成纵深）
  (function initBgParallax() {
    const main = document.getElementById('main');
    const far = document.querySelector('.bg-far');
    const near = document.querySelector('.bg-near');
    if (!main || !far || !near) return;
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = null, ev = null;
    const apply = () => {
      raf = null;
      if (!ev) return;
      const r = main.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = (ev.clientX - r.left) / r.width - 0.5;   // -0.5..0.5
      const ny = (ev.clientY - r.top) / r.height - 0.5;
      far.style.transform  = `translate3d(${(nx * -16).toFixed(1)}px, ${(ny * -12).toFixed(1)}px, 0)`;
      near.style.transform = `translate3d(${(nx * -34).toFixed(1)}px, ${(ny * -26).toFixed(1)}px, 0)`;
    };
    main.addEventListener('mousemove', (e) => {
      if (mq && mq.matches) return;
      ev = e;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    main.addEventListener('mouseleave', () => {
      far.style.transform = '';
      near.style.transform = '';
    });
  })();

  // 按钮点击涟漪（微交互反馈）
  (function initRipple() {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest && e.target.closest('.btn, .ai-btn, .icon-btn');
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height);
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = (e.clientX - r.left - size / 2) + 'px';
      span.style.top = (e.clientY - r.top - size / 2) + 'px';
      btn.appendChild(span);
      span.addEventListener('animationend', () => span.remove());
    });
  })();

  // 卡牌翻页
  $('#btn-deck-prev').addEventListener('click', () => deckShift(-1));
  $('#btn-deck-next').addEventListener('click', () => deckShift(1));

  // 键盘快捷：← / → 翻页；空格 切换焦点牌 selected
  window.addEventListener('keydown', (e) => {
    if (state.view !== 'cards') return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.target && e.target.closest && e.target.closest('.modal-overlay:not(.hidden)')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); deckShift(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); deckShift(1); }
    else if (e.key === ' ') {
      e.preventDefault();
      const arr = pool(state.activeCategory) || [];
      const card = arr[state.deckIndex];
      if (card) {
        toggleSelected(state.activeCategory, card.id);
        afterDataChanged();
      }
    }
  });

  // 卡牌编辑弹窗（click 委托挂整个弹窗：标题栏 AI 优化按钮在 body 之外，必须能冒泡到）
  $('#card-modal').addEventListener('click', (e) => {
    if (e.target === $('#card-modal')) closeCardModal();
    onCardModalClick(e);
  });
  $('#card-modal-body').addEventListener('input', onCardModalInput);
  document.addEventListener('click', onDdGlobalClick);
  // 性别切换已由自定义下拉 selectDdValue 处理

  // 选项管理弹窗
  $('#option-modal').addEventListener('click', (e) => {
    if (e.target === $('#option-modal')) closeOptionEditor();
  });
  $('#option-modal').addEventListener('input', onOptionModalInput);
  $('#option-modal').addEventListener('click', onOptionModalClick);
  const optAddInp = $('#option-add-input');
  if (optAddInp) optAddInp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addOptionItem(); }
  });

  // 素材库（资产池）弹窗：点击遮罩关闭 + 标签页切换 / 导入 / 编辑 / 删除
  $('#library-modal').addEventListener('click', (e) => {
    if (e.target === $('#library-modal')) { closeLibrary(); return; }
    const tab = e.target.closest('[data-lib-tab]');
    if (tab) { state.libraryTab = tab.dataset.libTab; renderLibraryModal(); return; }
    const imp = e.target.closest('[data-lib-import]');
    if (imp) { importToProject(imp.dataset.libImport); return; }
    const ed = e.target.closest('[data-lib-edit]');
    if (ed) { openLibraryEdit(ed.dataset.libEdit); return; }
    const del = e.target.closest('[data-lib-del]');
    if (del) { deleteLibraryCard(state.libraryTab || 'worldbuilding', del.dataset.libDel); return; }
  });
  $('#btn-library-close').addEventListener('click', closeLibrary);

  // 底部栏
  $('#btn-copy').addEventListener('click', copyPrompt);

  // 预览弹窗
  $('#btn-preview-close').addEventListener('click', closePreview);
  $('#btn-preview-copy').addEventListener('click', () => {
    const text = state.previewText || '';
    if (!text) { showToast('暂无可复制的 Prompt', 'error'); return; }
    copyText(text); showToast('已复制到剪贴板', 'success');
    flashSuccess($('#btn-preview-copy'), '已复制');
  });
  const previewSaveCh = $('#btn-preview-save-chapter');
  if (previewSaveCh) previewSaveCh.addEventListener('click', saveChapter);
  $('#preview-modal').addEventListener('click', (e) => {
    if (e.target === $('#preview-modal')) closePreview();
  });

  // 章节编辑弹窗
  $('#ce-cancel').addEventListener('click', closeChapterEdit);
  $('#ce-save').addEventListener('click', saveChapterEdit);
  $('#chapter-edit-modal').addEventListener('click', (e) => {
    if (e.target === $('#chapter-edit-modal')) closeChapterEdit();
  });

  // 章节详情弹窗（提示词 + AI 生成文章）
  $('#cd-close').addEventListener('click', () => $('#chapter-detail-modal').classList.add('hidden'));
  $('#cd-copy-prompt').addEventListener('click', () => {
    const ch = (state.project.chapters || []).find((x) => x.id === state.generatedViewId);
    if (!ch) return;
    copyText(ch.prompt || '');
    showToast('已复制提示词', 'success');
  });
  $('#cd-copy-gen').addEventListener('click', copyGenerated);
  $('#chapter-detail-modal').addEventListener('click', (e) => {
    if (e.target === $('#chapter-detail-modal')) $('#chapter-detail-modal').classList.add('hidden');
  });

  // 设置弹窗
  document.querySelectorAll('input[name="provider"]').forEach((r) => {
    r.addEventListener('change', onProviderChange);
  });
  $('#btn-test').addEventListener('click', testConnection);
  $('#btn-settings-save').addEventListener('click', saveSettings);
  $('#btn-settings-close').addEventListener('click', closeSettings);
  $('#settings-overlay').addEventListener('click', (e) => {
    if (e.target === $('#settings-overlay')) closeSettings();
  });

  // 顶部 + 底部 预览按钮（如有）
  const previewBtn = $('#btn-preview');
  if (previewBtn) previewBtn.addEventListener('click', openPreview);
}

/* ============================ 启动 ============================ */

// 窗口缩放：窄窗时侧卡降级（每侧 1 张），防抖重排避免溢出
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderCardView(), 160);
});

init();
