'use strict';

/**
 * promptBuilder.js —— Prompt 组装模块
 *
 * 浏览器与 Node 通用（UMD）：
 *   - 浏览器：<script src="../modules/promptBuilder.js"> 后挂载到 window.PromptBuilder
 *   - Node：require('./modules/promptBuilder')
 *
 * 组装规则：
 *   - 只输出 selected=true 的卡牌；
 *   - 空字段自动跳过整个字段块，不输出空行；
 *   - 某个大类下没有勾选卡牌（或全部为空）时，跳过整个大类段落；
 *   - 分隔线只出现在实际存在的段落之间。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PromptBuilder = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // 精简分隔：信息完整的同时把装饰性开销压到最低（token 友好）
  const BORDER = '━━━━━━━━━━━━━━━━';
  const SEP = '──────────';

  // ----------------------------- 工具函数 -----------------------------

  function nonEmpty(v) {
    return v !== undefined && v !== null && String(v).trim() !== '';
  }

  function add(arr, s) {
    if (nonEmpty(s)) arr.push(String(s).trim());
  }

  function splitLines(v) {
    return String(v || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /** 向 L 追加一个带分隔线的大段；section 为空字符串时整个跳过（不输出分隔线） */
  function addSection(L, section) {
    if (!section) return;
    L.push(SEP);
    L.push('');
    section.split('\n').forEach(function (line) { L.push(line); });
    L.push('');
  }

  function selectedCards(arr) {
    return (arr || []).filter(function (c) { return c && c.selected; });
  }

  // ----------------------------- 组装主入口 -----------------------------

  /**
   * 组装完整 Prompt。
   * @param {object} view 组装视图（renderer / selftest 解析好数据后传入）：
   *   {
   *     chapter: string,           // 章节（可空）
   *     title: string,             // 标题（可空）
   *     plotSynopsis: string,      // 情节梗概正文（可空）
   *     worldbuildingCards: [],    // 已投影 selected 的卡数组
   *     characterCards: [], sceneCards: [], styleCards: [],
   *     globalConstraints: {}
   *   }
   */
  function buildPrompt(view) {
    if (!view) return '';
    const gc = view.globalConstraints || {};
    const L = [];

    // 页眉（可经创作约束预设自定义；为空用内置默认：一行定位 + 输出契约，防止模型复述设定或输出元说明）
    const opening = String(view.opening || '').trim() || '你是一位专业小说作家，严格遵循以下设定创作，在此之上自由发挥。直接输出小说正文，不要复述或解释设定。';
    const closing = String(view.closing || '').trim() || '让角色活起来，让故事自然生长。';

    add(L, BORDER);
    add(L, opening);
    add(L, BORDER);
    L.push('');

    // 【情节梗概】
    const plotLines = buildPlotSection(view);
    if (plotLines.length) {
      L.push('【情节梗概】');
      plotLines.forEach(function (line) { L.push(line); });
      L.push('');
    }

    // 四大卡牌大类 + 创作约束
    addSection(L, buildWorldSection(view));
    addSection(L, buildCharacterSection(view));
    addSection(L, buildSceneSection(view));
    addSection(L, buildStyleSection(view));
    addSection(L, buildConstraintsSection(gc));

    // 页脚
    L.push(BORDER);
    L.push(closing);
    L.push(BORDER);

    return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // ----------------------------- 情节梗概 -----------------------------

  function buildPlotSection(view) {
    const lines = [];
    const content = String(view.plotSynopsis || '').trim();
    const chapter = String(view.chapter || '').trim();
    const title = String(view.title || '').trim();
    if (nonEmpty(chapter)) lines.push('章节：' + chapter);
    if (nonEmpty(title)) lines.push('标题：' + title);
    if (content) {
      if (lines.length) lines.push('');
      lines.push(content);
    }
    return lines;
  }

  // ----------------------------- 世界观参考 -----------------------------

  function buildWorldSection(project) {
    const cards = selectedCards(project.worldbuildingCards);
    const blocks = [];

    cards.forEach(function (c) {
      const lines = [];
      const hasContent = ['coreSetting', 'internalConflict', 'characterHint'].some(function (k) {
        return nonEmpty(c[k]);
      });
      if (!hasContent) return;

      lines.push('▸ ' + (c.name || '未命名卡牌') + '（' + (c.certainty || '常规') + '）');
      add(lines, '类型：' + c.type);
      add(lines, c.coreSetting);
      add(lines, '矛盾：' + c.internalConflict);
      add(lines, '角色关联：' + c.characterHint);
      blocks.push(lines.join('\n'));
    });

    if (!blocks.length) return '';

    return [
      '【世界观参考】',
      '（铁律=必须遵守/常规=可例外/模糊=自由）',
      '',
      blocks.join('\n\n')
    ].join('\n');
  }

  // ----------------------------- 角色演绎指引 -----------------------------

  function buildCharacterSection(project) {
    const cards = selectedCards(project.characterCards);
    const blocks = [];

    cards.forEach(function (c) {
      const lines = [];
      const hasContent = [
        'basicInfo', 'personalityBehavior', 'desireFear',
        'secret', 'relationships', 'characterArc', 'speechSamples'
      ].some(function (k) { return nonEmpty(c[k]); });
      if (!hasContent) return;

      lines.push('▸ ' + (c.name || '未命名角色') + '（' + (c.freedomLevel || '可适度发挥') + '）');
      add(lines, c.basicInfo);
      add(lines, '性格：' + c.personalityBehavior);
      if (nonEmpty(c.desireFear)) lines.push('欲望|恐惧：' + String(c.desireFear).trim());
      add(lines, '秘密：' + c.secret);
      add(lines, '关系：' + c.relationships);
      add(lines, '弧线：' + c.characterArc);

      const samples = splitLines(c.speechSamples);
      if (samples.length) {
        lines.push('台词：');
        samples.forEach(function (s) { lines.push('  ' + s); });
      }
      blocks.push(lines.join('\n'));
    });

    if (!blocks.length) return '';

    return [
      '【角色演绎指引】',
      '（严格=不可偏离/适度=可补细节/参考=灵感起点）',
      '',
      blocks.join('\n\n')
    ].join('\n');
  }

  // ----------------------------- 场景氛围 -----------------------------

  function buildSceneSection(project) {
    const cards = selectedCards(project.sceneCards);
    const blocks = [];

    cards.forEach(function (c) {
      const lines = [];
      const hasContent = [
        'timeLocation', 'sensoryDetails', 'atmosphereKeywords',
        'sceneFunction', 'characterImpact', 'variableElements'
      ].some(function (k) { return nonEmpty(c[k]); });
      if (!hasContent) return;

      lines.push('▸ ' + (c.name || '未命名场景'));
      add(lines, '时空：' + c.timeLocation);
      add(lines, '感官：' + c.sensoryDetails);
      add(lines, '氛围：' + c.atmosphereKeywords);
      add(lines, '功能：' + c.sceneFunction);
      add(lines, '对角色影响：' + c.characterImpact);
      add(lines, '可即兴：' + c.variableElements);
      blocks.push(lines.join('\n'));
    });

    if (!blocks.length) return '';
    return ['【场景氛围】', '', blocks.join('\n\n')].join('\n');
  }

  // ----------------------------- 文风要求 -----------------------------

  function buildStyleSection(project) {
    const cards = selectedCards(project.styleCards);
    const blocks = [];

    cards.forEach(function (c) {
      const lines = [];
      const hasContent = ['styleDescription', 'referenceText', 'antiExample'].some(function (k) {
        return nonEmpty(c[k]);
      });
      if (!hasContent) return;

      lines.push('▸ ' + (c.name || '未命名文风') + '（情境：' + (c.applicableScene || '通用') + '）');
      add(lines, c.styleDescription);
      add(lines, '范文：');
      add(lines, c.referenceText);
      add(lines, '避免：');
      add(lines, c.antiExample);
      blocks.push(lines.join('\n'));
    });

    if (!blocks.length) return '';
    return ['【文风要求】', '', blocks.join('\n\n')].join('\n');
  }

  // ----------------------------- 创作约束 -----------------------------

  function buildConstraintsSection(gc) {
    const lines = [];

    const min = gc.wordCountMin;
    const max = gc.wordCountMax;
    const hasMin = min !== undefined && min !== null && min !== '';
    const hasMax = max !== undefined && max !== null && max !== '';
    if (hasMin || hasMax) {
      lines.push('字数要求：' + (hasMin ? min : '不限') + '~' + (hasMax ? max : '不限') + '字');
    }

    const taboos = splitLines(gc.taboos);
    if (taboos.length) {
      lines.push('禁忌内容：');
      taboos.forEach(function (t) { lines.push(t); });
    }

    if (nonEmpty(gc.formatRequirement)) {
      lines.push('格式要求：' + String(gc.formatRequirement).trim());
    }

    if (!lines.length) return '';
    return ['【创作约束】'].concat(lines).join('\n');
  }

  // ----------------------------- AI 优化 Prompt -----------------------------

  /**
   * 构造"AI 优化"字段的请求文本。
   * @param {string} cardName 卡牌名称
   * @param {string} fieldLabel 字段类型（如"性格内核""核心设定"）
   * @param {string} currentContent 当前内容（可为空，为空则要求生成初始内容）
   */
  function buildOptimizePrompt(cardName, fieldLabel, currentContent) {
    const lines = [
      '你是一位资深小说创作顾问。请帮我优化以下小说设定内容，使其更专业、更细腻、更有画面感，更适合用作AI小说创作的参考设定。保持原有核心意思不变，补充合理的细节和层次。',
      '',
      '卡牌名称：' + (cardName || '未命名'),
      '字段类型：' + (fieldLabel || ''),
      '当前内容：'
    ];

    if (nonEmpty(currentContent)) {
      lines.push(String(currentContent).trim());
    } else {
      lines.push('（当前为空，请根据卡牌名称与字段类型，生成一段专业、细腻的初始内容）');
    }

    lines.push('');
    lines.push('请直接输出优化后的内容，不要加任何解释。');
    return lines.join('\n');
  }

  /**
   * 构造"单个输入框"的 AI 优化请求（主流提示词规格：角色 → 任务 → 上下文 → 输出契约 → 模式指令）：
   * - 角色定位一句带过，任务边界明确（只处理单字段）
   * - 上下文只作逻辑参考，明确"不要复述"
   * - 输出契约前置：只输出内容、无字段名/编号/Markdown/解释/思考过程
   * - 按内容长度分四模式：空→generate、<40 字→expand、40~220→polish、>220→condense
   * @param {object} opts { cardName, typeLabel, typeValue, fieldLabel, fieldHint, fieldValue, targetLen, contextSummary, regen }
   *        targetLen: 该字段建议字数范围（如 '10~20'），传入时目标长度以字段建议为准
   * @returns {{prompt: string, mode: 'generate'|'expand'|'polish'|'condense'}}
   */
  function buildFieldOptimizePrompt(opts) {
    const raw = String(opts.fieldValue || '').trim();
    const len = raw.length;
    let mode = 'generate';
    if (len > 0) {
      mode = len < 40 ? 'expand' : (len > 220 ? 'condense' : 'polish');
    }

    // 目标长度：优先字段建议（如"10~20"），否则用各模式默认句数/字数
    const contract = opts.targetLen
      ? '约 ' + opts.targetLen + ' 字'
      : {
          generate: '2~3 句（约 30~80 字）',
          expand: '3~5 句（约 80~160 字）',
          polish: '3~5 句（约 60~180 字）',
          condense: '4~6 句（约 120~220 字）'
        }[mode];

    const lines = [];
    // —— 角色与任务边界（等效系统提示）——
    lines.push('你是资深小说设定顾问，擅长把设定写得具体、凝练、有画面感。');
    lines.push('任务：只处理下面设定卡牌的一个字段，输出可直接粘贴回卡牌的内容。');
    lines.push('');
    // —— 卡牌上下文 ——
    lines.push('卡牌：' + (opts.cardName || '未命名') + (opts.typeLabel && opts.typeValue ? '（' + opts.typeValue + '）' : ''));
    lines.push('字段：' + opts.fieldLabel + '（' + (opts.fieldHint || '设定细节') + '）');
    if (opts.contextSummary) {
      lines.push('同卡其他内容（仅作逻辑参考，不要复述）：');
      lines.push(opts.contextSummary);
    }
    lines.push('');
    // —— 输出契约（前置，避免模型输出解释/包装）——
    lines.push('输出要求：只输出字段内容本身，' + contract + '；不要输出字段名、编号、Markdown、解释、寒暄或思考过程。');
    lines.push('');
    // —— 输入与模式指令 ——
    if (mode === 'generate') {
      lines.push('该字段尚未填写。请基于卡牌与上文生成：先给核心事实，再补一处具体细节，最后点明它对故事的作用。');
    } else {
      const verb = mode === 'expand' ? '扩充' : (mode === 'condense' ? '精简' : '润色');
      const guide =
        mode === 'expand' ? '保留全部核心事实，补足细节、层次与画面感。'
        : mode === 'condense' ? '保留全部核心事实，删除重复、空话与冗余修饰。'
        : '表达更凝练准确，去除空话，保留全部事实。';
      lines.push('当前内容：');
      lines.push(raw);
      lines.push('');
      lines.push('请' + verb + '。' + guide);
    }
    if (opts.regen) {
      lines.push('请换一种组织角度重新处理，避免与上一版雷同。');
    }

    return { prompt: lines.join('\n'), mode };
  }

  // ----------------------------- Token 估算 -----------------------------

  /** 中文内容按约 1.5 字/token 粗略估算 */
  function estimateTokens(text) {
    const t = String(text || '').replace(/\s+/g, '');
    return Math.ceil(t.length / 1.5);
  }

  return {
    buildPrompt,
    buildOptimizePrompt,
    buildFieldOptimizePrompt,
    estimateTokens
  };
});
