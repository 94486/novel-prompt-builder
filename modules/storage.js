'use strict';

/**
 * storage.js —— 数据读写模块
 * 封装 fs 操作：创建 data 目录、首次运行生成默认数据、JSON 读写。
 * 所有绝对路径由 main.js 解析后传入（exe 同级 data 目录 / 开发环境项目根目录 data）。
 */

const fs = require('fs');
const path = require('path');

let DATA_DIR = null;

/** 初始化数据目录（幂等）。rootDir 为应用根目录，data 目录位于 rootDir/data */
function init(rootDir) {
  DATA_DIR = path.join(rootDir, 'data');
  // 自愈：data 路径被同名"文件"占用（异常状态，如打包工具误写）→ 移除后重建目录
  try {
    const st = fs.statSync(DATA_DIR);
    if (st.isFile()) fs.unlinkSync(DATA_DIR);
  } catch (_e) { /* 不存在则跳过 */ }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    // Electron portable 环境的 mkdir 补丁对"已存在目录"可能仍抛 EEXIST，此处幂等吞掉
    if (err.code !== 'EEXIST') throw err;
  }
  ensureDefaultFiles();
}

function getDataDir() {
  return DATA_DIR;
}

/** 读取 JSON 文件，解析失败或不存在返回 null */
function readJSON(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf-8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[storage] 读取失败:', absPath, err.message);
    }
    return null;
  }
}

/** 原子写：先写 .tmp（sync 刷盘），再 rename 覆盖。避免写入中途崩溃损坏文件。 */
function writeJSON(absPath, data) {
  const tmp = absPath + '.tmp';
  const dir = path.dirname(absPath);
  // 自愈：父目录路径被同名文件占用 → 移除后重建目录（与 init 行为一致）
  try {
    const st = fs.statSync(dir);
    if (st.isFile()) fs.unlinkSync(dir);
  } catch (_e) { /* 不存在则跳过 */ }
  // 确保父目录存在（Electron portable 下 mkdir 与后续 open 可能被杀软/异步延迟打断）
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  const buf = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(tmp, 'w');
      try {
        fs.writeSync(fd, buf, 0, buf.length, 0);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmp, absPath);
      return;
    } catch (err) {
      if (err.code === 'ENOENT' && attempt === 0) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
        continue;
      }
      throw err;
    }
  }
}

/** 首次运行时自动创建默认数据文件 */
function ensureDefaultFiles() {
  const projectsPath = path.join(DATA_DIR, 'projects.json');
  const configPath = path.join(DATA_DIR, 'config.json');
  if (!fs.existsSync(projectsPath)) {
    writeJSON(projectsPath, defaultProject());
  }
  if (!fs.existsSync(configPath)) {
    writeJSON(configPath, defaultConfig());
  }
}

// ---------------------------------------------------------------------------
// 默认大模型配置
// ---------------------------------------------------------------------------
function defaultConfig() {
  return {
    provider: 'ollama',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5',
    openaiApiKey: '',
    openaiBaseUrl: 'https://api.deepseek.com/v1',
    openaiModel: 'deepseek-chat',
    presets: [
      {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat'
      },
      {
        name: '通义千问',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-plus'
      },
      {
        name: 'Moonshot',
        baseUrl: 'https://api.moonshot.cn/v1',
        model: 'moonshot-v1-8k'
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// 默认示例项目（首次运行自动创建）
// v3 schema：素材库（library）+ 项目（projects）双结构；角色卡已收敛为
// 7 内容字段（性格与行为 / 欲望与恐惧为合并字段），卡带 category 供迁移/渲染识别。
// ---------------------------------------------------------------------------
function defaultProject() {
  return {
    version: 3,
    library: {
      worldbuildingCards: [
        {
          id: 'wb_lingli',
          category: 'worldbuilding',
          name: '灵力体系',
          type: '力量体系',
          certainty: '铁律',
          coreSetting:
            '天地灵气自万年前复苏，万物可修行。灵力以丹田为炉、经脉为渠，修为分九境：聚气、凝液、结丹、元婴、化神、炼虚、合体、大乘、渡劫。每一境皆有天堑，破境需机缘与心境契合，强冲必遭反噬。\n灵力属性与血脉、地域风水相关，南方多火灵，北方多冰灵，沿海地带灵气混杂、修行者稀少。',
          internalConflict:
            '灵气总量有限，高阶修士吸纳灵气会挤压低阶修士的生存空间，造成修行资源的内卷与世族垄断；同时"灵力即权力"的法则使修行宗门与世俗皇权长期角力，每隔百年便有宗门与朝廷的大规模冲突。',
          characterHint: '角色若出身寒微，其修行之路必然伴随资源匮乏与阶级阻力；若出身世家，则背负资源诅咒与家族期望。角色每次破境都是对心性与机缘的双重考验。'
        },
        {
          id: 'wb_politics',
          category: 'worldbuilding',
          name: '大衍朝政治',
          type: '政治势力',
          certainty: '常规',
          coreSetting:
            '大衍朝立国三百年，皇权、内阁、六部、地方州府与三大修行宗门形成微妙的权力制衡。皇帝不修真，依赖国师府借灵力维系统治合法性；宗门则通过输送弟子入仕、垄断灵矿与丹药，间接把持朝政。',
          internalConflict:
            '太子一党与二皇子一党明争暗斗，内阁首辅暗中与宗门勾结，地方州府阳奉阴违，中央政令难出京城；边军与宗门私兵摩擦不断，国库空虚而宗门富可敌国。',
          characterHint:
            '角色的政治立场决定其可利用的资源与面临的暗杀风险；寒门官员、世家子弟、宗门弟子在朝堂上的行事逻辑截然不同，一个决定可能牵动千里之外的家族存亡。'
        }
      ],
      characterCards: [
        {
          id: 'ch_shenyan',
          category: 'character',
          name: '沈砚',
          gender: '男',
          avatar: 'male',
          freedomLevel: '严格遵循',
          basicInfo:
            '十八岁，寒门出身，青州落第书生，面容清瘦，眉目沉静，左眉尾有一道旧疤。表面温和守礼，实则心思极重，惯于隐藏真实情绪。',
          personalityBehavior:
            '性格特质：压力下会强迫自己冷静，越危险越沉默；最恐惧失去对局势的掌控；最大的自欺是认为自己一切选择皆出于理性，实则常被少年意气裹挟。\n行为习惯：习惯用指尖轻叩桌面思考；紧张时反复摩挲袖口；口头禅是"无妨，容我想想"；说话慢而稳，极少表露真实情绪。',
          desireFear: '让天下寒门再不受宗门与世族倾轧｜重蹈父亲覆辙，在权力斗争中身败名裂、连累至亲',
          secret:
            '身怀一枚来历不明的上古灵戒，其中封存着一位渡劫期残魂，此秘密一旦暴露，天下宗门都会追杀他。',
          relationships:
            '与师妹顾青梧青梅竹马，是彼此唯一毫无保留信任的人；与皇子萧彻亦敌亦友，既欣赏其志向又忌惮其手腕；对师父白鹤真人又敬又愧。',
          characterArc:
            '青州落第时家道中落、心如死灰 → 灵戒觉醒后被迫卷入夺嫡与宗门之争 → 从逃避到直面，最终在朝堂与修行两条路上同时立身，代价是与旧日自我告别。',
          speechSamples:
            '无妨，容我想想。\n这世道的规矩，从来不是为寒门写的。\n我可以输，但我选的路，不会回头。\n你若信我，便不必问缘由。\n因果轮回？我只信手中的剑与心里的秤。'
        },
        {
          id: 'ch_guqingwu',
          category: 'character',
          name: '顾青梧',
          gender: '女',
          avatar: 'innocent',
          freedomLevel: '可适度发挥',
          basicInfo:
            '十七岁，凌霜宗外门弟子，沈砚师妹，圆脸杏眼，笑起来眉眼弯弯，佩一柄青霜短剑，剑穗是她自己编的。',
          personalityBehavior:
            '性格特质：压力下会先笑再动手，用轻快语气掩盖紧张；最恐惧被重要的人独自抛下；最大的自欺是假装自己不在乎，其实把每句承诺都记在心里。\n行为习惯：爱啃糖葫芦，高兴时哼小调；生气时叫沈砚"呆子"；剑术灵动，喜欢以巧破力；对陌生人自来熟，但对敌时格外果决。',
          desireFear: '和沈砚一起走出大山，看看书里写的天下｜沈砚为了保护她而独自涉险',
          secret: '她的剑法是偷学来的——她父亲曾是凌霜宗弃徒，此事一旦败露，她将被逐出宗门。',
          relationships:
            '沈砚的师妹与挚友；与宗门大师兄苏长青有婚约在身，但她从未应允；与师姐叶清音情同姐妹。',
          characterArc:
            '天真烂漫的外门弟子 → 在宗门变故中被迫成长 → 从被保护者变为能独当一面的剑修，最终与沈砚并肩。',
          speechSamples:
            '呆子，又在想什么？\n剑不是用来砍人的，是用来护人的。\n你若要走，记得说一声。\n我才不怕，我师兄可厉害了。\n糖葫芦分你一半，别哭丧着脸啦。'
        }
      ],
      sceneCards: [
        {
          id: 'sc_dongmen',
          category: 'scene',
          name: '皇城东门·深秋黄昏',
          sceneFunction: '信息揭示',
          timeLocation: '深秋黄昏·皇城东门',
          sensoryDetails:
            '视觉：残阳如血，把青灰色的城墙染成暗金，护城河水面碎金般跳动；\n听觉：马蹄踏过石板路的脆响、远处坊市收摊的吆喝、风卷枯叶的沙沙声；\n嗅觉：烤栗子与尘土混合的气味；\n触觉：暮风带着凉意，拂过脸侧。',
          atmosphereKeywords: '肃杀,萧瑟,余晖,压抑',
          characterImpact:
            '城门守军盘查让身份敏感的沈砚神经绷紧；昏黄的暮色放大了他内心的不安与戒备，也让重逢的喜悦蒙上一层阴影。',
          variableElements: '守门校尉的态度、进出城门的百姓群像、是否偶遇追捕的宗门探子，均可即兴发挥。'
        }
      ],
      styleCards: [
        {
          id: 'st_duihua',
          category: 'style',
          name: '对话风格',
          applicableScene: '对话',
          styleDescription:
            '对话简洁有留白，不直说情绪，用动作和停顿代替心理描写；每句对话长度不超过两行，语气词克制；人物说话符合各自身份与习惯。',
          referenceText:
            '"你受伤了。"\n顾青梧盯着他袖口的暗色，语气平淡。\n沈砚沉默片刻，把左手背到身后："无妨。"\n"血都渗出来了。"她上前一步，声音忽然轻了半分，"我看看。"',
          antiExample:
            '避免长篇大论的台词；避免人物连续三句以上"说"；避免用"他内心想道"式的直白心理旁白；避免所有角色说话风格雷同。'
        }
      ]
    },
    projects: [
      {
        id: 'p_main',
        name: '我的小说项目',
        plot: {
          chapter: '',
          title: '',
          content: '沈砚携上古灵戒入京赶考，于皇城东门被守军盘查；恰逢顾青梧自凌霜宗下山寻他，两人重逢；同一时刻，凌霜宗追捕令已悄然送达城门。'
        },
        globalConstraints: {
          taboos:
            '禁止出现现代词汇与现代价值观\n禁止主角轻易获得无代价的力量\n禁止无逻辑降智的反派\n禁止强行圆满的结局\n禁止角色脱离设定（OOC）',
          wordCountMin: 2000,
          wordCountMax: 4000,
          formatRequirement:
            '使用第三人称有限视角\n每章以场景切换分段，段落间空一行\n对话单独成行，使用引号\n章节末尾留一个钩子',
          opening: '',
          closing: ''
        },
        cards: {
          worldbuilding: [
            { id: 'wb_lingli_c', sourceId: 'wb_lingli', category: 'worldbuilding', name: '灵力体系', type: '力量体系', certainty: '铁律', coreSetting: '天地灵气自万年前复苏，万物可修行。灵力以丹田为炉、经脉为渠，修为分九境：聚气、凝液、结丹、元婴、化神、炼虚、合体、大乘、渡劫。每一境皆有天堑，破境需机缘与心境契合，强冲必遭反噬。\n灵力属性与血脉、地域风水相关，南方多火灵，北方多冰灵，沿海地带灵气混杂、修行者稀少。', internalConflict: '灵气总量有限，高阶修士吸纳灵气会挤压低阶修士的生存空间，造成修行资源的内卷与世族垄断；同时"灵力即权力"的法则使修行宗门与世俗皇权长期角力，每隔百年便有宗门与朝廷的大规模冲突。', characterHint: '角色若出身寒微，其修行之路必然伴随资源匮乏与阶级阻力；若出身世家，则背负资源诅咒与家族期望。角色每次破境都是对心性与机缘的双重考验。' },
            { id: 'wb_politics_c', sourceId: 'wb_politics', category: 'worldbuilding', name: '大衍朝政治', type: '政治势力', certainty: '常规', coreSetting: '大衍朝立国三百年，皇权、内阁、六部、地方州府与三大修行宗门形成微妙的权力制衡。皇帝不修真，依赖国师府借灵力维系统治合法性；宗门则通过输送弟子入仕、垄断灵矿与丹药，间接把持朝政。', internalConflict: '太子一党与二皇子一党明争暗斗，内阁首辅暗中与宗门勾结，地方州府阳奉阴违，中央政令难出京城；边军与宗门私兵摩擦不断，国库空虚而宗门富可敌国。', characterHint: '角色的政治立场决定其可利用的资源与面临的暗杀风险；寒门官员、世家子弟、宗门弟子在朝堂上的行事逻辑截然不同，一个决定可能牵动千里之外的家族存亡。' }
          ],
          character: [
            { id: 'ch_shenyan_c', sourceId: 'ch_shenyan', category: 'character', name: '沈砚', gender: '男', avatar: 'male', freedomLevel: '严格遵循', basicInfo: '十八岁，寒门出身，青州落第书生，面容清瘦，眉目沉静，左眉尾有一道旧疤。表面温和守礼，实则心思极重，惯于隐藏真实情绪。', personalityBehavior: '性格特质：压力下会强迫自己冷静，越危险越沉默；最恐惧失去对局势的掌控；最大的自欺是认为自己一切选择皆出于理性，实则常被少年意气裹挟。\n行为习惯：习惯用指尖轻叩桌面思考；紧张时反复摩挲袖口；口头禅是"无妨，容我想想"；说话慢而稳，极少表露真实情绪。', desireFear: '让天下寒门再不受宗门与世族倾轧｜重蹈父亲覆辙，在权力斗争中身败名裂、连累至亲', secret: '身怀一枚来历不明的上古灵戒，其中封存着一位渡劫期残魂，此秘密一旦暴露，天下宗门都会追杀他。', relationships: '与师妹顾青梧青梅竹马，是彼此唯一毫无保留信任的人；与皇子萧彻亦敌亦友，既欣赏其志向又忌惮其手腕；对师父白鹤真人又敬又愧。', characterArc: '青州落第时家道中落、心如死灰 → 灵戒觉醒后被迫卷入夺嫡与宗门之争 → 从逃避到直面，最终在朝堂与修行两条路上同时立身，代价是与旧日自我告别。', speechSamples: '无妨，容我想想。\n这世道的规矩，从来不是为寒门写的。\n我可以输，但我选的路，不会回头。\n你若信我，便不必问缘由。\n因果轮回？我只信手中的剑与心里的秤。' },
            { id: 'ch_guqingwu_c', sourceId: 'ch_guqingwu', category: 'character', name: '顾青梧', gender: '女', avatar: 'innocent', freedomLevel: '可适度发挥', basicInfo: '十七岁，凌霜宗外门弟子，沈砚师妹，圆脸杏眼，笑起来眉眼弯弯，佩一柄青霜短剑，剑穗是她自己编的。', personalityBehavior: '性格特质：压力下会先笑再动手，用轻快语气掩盖紧张；最恐惧被重要的人独自抛下；最大的自欺是假装自己不在乎，其实把每句承诺都记在心里。\n行为习惯：爱啃糖葫芦，高兴时哼小调；生气时叫沈砚"呆子"；剑术灵动，喜欢以巧破力；对陌生人自来熟，但对敌时格外果决。', desireFear: '和沈砚一起走出大山，看看书里写的天下｜沈砚为了保护她而独自涉险', secret: '她的剑法是偷学来的——她父亲曾是凌霜宗弃徒，此事一旦败露，她将被逐出宗门。', relationships: '沈砚的师妹与挚友；与宗门大师兄苏长青有婚约在身，但她从未应允；与师姐叶清音情同姐妹。', characterArc: '天真烂漫的外门弟子 → 在宗门变故中被迫成长 → 从被保护者变为能独当一面的剑修，最终与沈砚并肩。', speechSamples: '呆子，又在想什么？\n剑不是用来砍人的，是用来护人的。\n你若要走，记得说一声。\n我才不怕，我师兄可厉害了。\n糖葫芦分你一半，别哭丧着脸啦。' }
          ],
          scene: [
            { id: 'sc_dongmen_c', sourceId: 'sc_dongmen', category: 'scene', name: '皇城东门·深秋黄昏', sceneFunction: '信息揭示', timeLocation: '深秋黄昏·皇城东门', sensoryDetails: '视觉：残阳如血，把青灰色的城墙染成暗金，护城河水面碎金般跳动；\n听觉：马蹄踏过石板路的脆响、远处坊市收摊的吆喝、风卷枯叶的沙沙声；\n嗅觉：烤栗子与尘土混合的气味；\n触觉：暮风带着凉意，拂过脸侧。', atmosphereKeywords: '肃杀,萧瑟,余晖,压抑', characterImpact: '城门守军盘查让身份敏感的沈砚神经绷紧；昏黄的暮色放大了他内心的不安与戒备，也让重逢的喜悦蒙上一层阴影。', variableElements: '守门校尉的态度、进出城门的百姓群像、是否偶遇追捕的宗门探子，均可即兴发挥。' }
          ],
          style: [
            { id: 'st_duihua_c', sourceId: 'st_duihua', category: 'style', name: '对话风格', applicableScene: '对话', styleDescription: '对话简洁有留白，不直说情绪，用动作和停顿代替心理描写；每句对话长度不超过两行，语气词克制；人物说话符合各自身份与习惯。', referenceText: '"你受伤了。"\n顾青梧盯着他袖口的暗色，语气平淡。\n沈砚沉默片刻，把左手背到身后："无妨。"\n"血都渗出来了。"她上前一步，声音忽然轻了半分，"我看看。"', antiExample: '避免长篇大论的台词；避免人物连续三句以上"说"；避免用"他内心想道"式的直白心理旁白；避免所有角色说话风格雷同。' }
          ]
        },
        selected: {
          worldbuilding: { wb_lingli_c: true, wb_politics_c: true },
          character: { ch_shenyan_c: true, ch_guqingwu_c: true },
          scene: { sc_dongmen_c: true },
          style: { st_duihua_c: true }
        },
        chapters: []
      }
    ],
    activeProjectId: 'p_main'
  };
}

module.exports = {
  init,
  getDataDir,
  readJSON,
  writeJSON,
  ensureDefaultFiles,
  defaultProject,
  defaultConfig
};
