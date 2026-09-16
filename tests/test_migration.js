'use strict';
/* 验收单测：数据迁移 normalizeData（从 renderer/app.js 源码提取纯函数，浏览器无关） */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/renderer/app.js', 'utf8');

function extract(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('未找到函数 ' + name);
  let depth = 0, started = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { depth++; started = true; }
    else if (src[j] === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('括号不匹配 ' + name);
}

const harness = ['uid', 'normalizeData', 'normalizeCard', 'dropLegacyFields', 'migrateAvatar', 'normalizeProject']
  .map(n => {
    if (n === 'uid') return "let _idc=0; const uid = () => 'id_' + (++_idc);";
    return extract(n);
  }).join('\n;\n');
const mod = new Function(harness + '\n; return { normalizeData };')();
const normalizeData = mod.normalizeData;

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? (pass++, console.log('  PASS', n)) : (fail++, console.log('  FAIL', n, d || '')); };

console.log('\n[v1 → v3 迁移]');
const v1 = {
  projectName: '旧项目', plotSynopsis: '梗概文本',
  worldbuildingCards: [{ id: 'wb1', name: '灵力', type: '力量体系', coreSetting: 'x', certainty: '铁律', selected: true }],
  characterCards: [{ id: 'ch1', name: '沈砚', basicInfo: 'b',
    personalityCore: '旧性格', behaviorPattern: '旧行为', coreDesire: '旧欲', coreFear: '旧恐',
    gender: '女·绝美', secret: 's', selected: false }],
  sceneCards: [], styleCards: [],
  globalConstraints: { taboos: 't', wordCountMin: null, wordCountMax: undefined }
};
const r1 = normalizeData(JSON.parse(JSON.stringify(v1)));
ok('结构为 v3(library+projects+active)', !!r1.library && Array.isArray(r1.projects) && r1.activeProjectId === 'p_main');
ok('旧角色字段被舍弃', (() => { const c = r1.library.characterCards[0]; return !('personalityCore' in c) && !('behaviorPattern' in c) && !('coreDesire' in c) && !('coreFear' in c); })());
ok('旧头像取值迁移', r1.library.characterCards[0].avatar === 'grace' && r1.library.characterCards[0].gender === '女', JSON.stringify(r1.library.characterCards[0].avatar));
ok('卡进素材库+项目副本', r1.projects[0].cards.worldbuilding.length === 1 && r1.projects[0].cards.worldbuilding[0].sourceId === 'wb1');
ok('副本与库卡 id 不同', r1.projects[0].cards.worldbuilding[0].id !== r1.library.worldbuildingCards[0].id);
ok('selected 状态迁移', r1.projects[0].selected.worldbuilding['wb1'] === true && r1.projects[0].selected.character['ch1'] === false);
ok('plot.content 承接梗概', r1.projects[0].plot.content === '梗概文本');
ok('字数默认值兜底', r1.projects[0].globalConstraints.wordCountMin === 2000 && r1.projects[0].globalConstraints.wordCountMax === 4000);
ok('chapters 初始化', Array.isArray(r1.projects[0].chapters) && r1.projects[0].chapters.length === 0);

console.log('\n[v2 → v3 引用物化]');
const v2 = {
  version: 2,
  library: { worldbuildingCards: [{ id: 'L1', name: '库卡', coreSetting: 'c' }] },
  projects: [{ id: 'pA', name: '项目A', used: { worldbuilding: ['L1', 'missing'] }, selected: { worldbuilding: { L1: true } } }],
  activeProjectId: 'ghost'
};
const r2 = normalizeData(v2);
ok('used 物化为副本', r2.projects[0].cards.worldbuilding.length === 1);
ok('失效引用静默跳过', r2.projects[0].cards.worldbuilding[0].sourceId === 'L1');
ok('selected 换绑副本 id', (() => { const cid = r2.projects[0].cards.worldbuilding[0].id; return r2.projects[0].selected.worldbuilding[cid] === true && !('L1' in r2.projects[0].selected.worldbuilding); })());
ok('activeProjectId 失效→回退首个', r2.activeProjectId === 'pA');

console.log('\n[v3 直通与健壮性]');
const r3 = normalizeData(JSON.parse(JSON.stringify(r1)));
ok('v3 幂等：副本数量不变', r3.projects[0].cards.worldbuilding.length === 1);
ok('v3 幂等：sourceId 保留', r3.projects[0].cards.worldbuilding[0].sourceId === 'wb1');
let crashed = false;
try { normalizeData(null); normalizeData({}); normalizeData('garbage'); normalizeData([]); } catch (e) { crashed = true; }
ok('垃圾输入不崩溃', !crashed);

console.log('\n[真实用户数据加载]');
const real = normalizeData(JSON.parse(fs.readFileSync(__dirname + '/data/projects.json', 'utf8')));
ok('真实 projects.json 可迁移', !!real.library && real.projects.length >= 1);
ok('真实数据角色卡无旧字段', real.projects.every(p => p.cards.character.every(c => !('personalityCore' in c) && !('coreDesire' in c))));

console.log(`\n== 迁移单测: ${pass} PASS / ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
