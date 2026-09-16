'use strict';
/* 第二轮：渲染层纯函数单测（buildFieldContext / parseFieldResult / cleanLLMText / 头像回退） */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../renderer/app.js', 'utf8');

function extractFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('缺函数 ' + name);
  let depth = 0, started = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { depth++; started = true; }
    else if (src[j] === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('括号不匹配 ' + name);
}
function extractConst(name) {
  const i = src.indexOf('const ' + name + ' = ');
  if (i < 0) throw new Error('缺常量 ' + name);
  const open = src[i + 6 + name.length + 3];
  const close = open === '{' ? '}' : ']';
  let depth = 0, started = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === open) { depth++; started = true; }
    else if (src[j] === close) { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('括号不匹配 const ' + name);
}

const harness = [
  extractConst('CARD_META'),
  extractConst('AVATAR_DEFS'),
  "const AVATAR_KEYS = new Set(AVATAR_DEFS.map(a => a.key));",
  extractFn('avatarImg'), extractFn('defaultAvatar'),
  extractFn('buildFieldContext'), extractFn('cleanLLMText'), extractFn('parseFieldResult')
].join('\n;\n');
const M = new Function(harness + '\n; return { CARD_META, buildFieldContext, cleanLLMText, parseFieldResult, avatarImg, defaultAvatar };')();

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? (pass++, console.log('  PASS', n)) : (fail++, console.log('  FAIL', n, JSON.stringify(d ?? '').slice(0, 160))); };

console.log('\n[buildFieldContext 上下文注入]');
const charMeta = M.CARD_META.character;
const groups = charMeta.groups;
const gOf = k => groups.findIndex(g => (g.fields || []).some(f => f.key === k));
const card = { name: '沈砚'.repeat(30), basicInfo: '基'.repeat(100), personalityBehavior: '性'.repeat(100), desireFear: '', secret: '密'.repeat(50), relationships: '关'.repeat(50), characterArc: '弧'.repeat(50), speechSamples: '台'.repeat(50) };
const ctx = M.buildFieldContext('character', card, 'desireFear');
ok('总长≤201(200+省略号)', ctx.length <= 201, ctx.length);
ok('排除目标字段', !ctx.includes('欲望与恐惧：'));
ok('同组字段优先(60截断)', (() => { const gi = gOf('desireFear'); if (gi < 0) return true; const f = groups[gi].fields.find(x => x.key === 'personalityBehavior'); return !f || ctx.includes('性'.repeat(60)) && !ctx.includes('性'.repeat(61)); })(), ctx.slice(0, 120));
ok('空卡返回短', M.buildFieldContext('character', {}, 'secret').length <= 10);

console.log('\n[cleanLLMText]');
ok('成对think剥离', M.cleanLLMText('<think>想</think>正文') === '正文');
ok('未闭合think剥到尾', M.cleanLLMText('正文<think>想不完') === '正文');
ok('纯文本Thinking+正文标记', M.cleanLLMText('Thinking Process:\n1. analyze\n正文：少年按剑。') === '少年按剑。', M.cleanLLMText('Thinking Process:\n1. analyze\n正文：少年按剑。'));
ok('纯文本Thinking+空行分界', M.cleanLLMText('Thinking Process:\n1. step one\n\n最终就写：他笑了。') === '最终就写：他笑了。', JSON.stringify(M.cleanLLMText('Thinking Process:\n1. step one\n\n最终就写：他笑了。')));
ok('围栏剥离', M.cleanLLMText('```markdown\n内容在此\n```') === '内容在此');
ok('正常文本直通', M.cleanLLMText('普通内容') === '普通内容');

console.log('\n[parseFieldResult]');
ok('剥字段名前缀', M.parseFieldResult('欲望与恐惧：出人头地', '欲望与恐惧') === '出人头地', M.parseFieldResult('欲望与恐惧：出人头地', '欲望与恐惧'));
const bold = M.parseFieldResult('**欲望与恐惧**：出人头地', '欲望与恐惧');
ok('剥Markdown加粗前缀(README承诺)', bold === '出人头地', '实际得到: ' + bold);
ok('剥单个寒暄', M.parseFieldResult('好的，这是优化结果。', 'X') === '这是优化结果。');
const num = M.parseFieldResult('1. 欲望与恐惧：出人头地', '欲望与恐惧');
ok('编号+字段名前缀剥离', num === '出人头地', '实际得到: ' + num);
const dbl = M.parseFieldResult('好的，以下是优化后的内容：真内容', 'X');
ok('双寒暄仅剥一层(记录行为)', dbl.startsWith('以下是'), dbl);

console.log('\n[头像回退]');
ok('非法键回退male', M.avatarImg('nonexistent') === 'icons/avatar-male.png');
ok('合法键通过', M.avatarImg('queen') === 'icons/avatar-queen.png');
ok('默认头像 男=君子/女=grace', M.defaultAvatar('男') === 'male' && M.defaultAvatar('女') === 'grace');
const fsx = require('fs'), path = require('path');
const missing = M.CARD_META && require('path'); // 校验 9 个头像文件真实存在
const keys = M.AVATAR_DEFS ? [] : [];
console.log('\n[头像资源完整性]');
const defs = new Function(extractConst('AVATAR_DEFS') + '; return AVATAR_DEFS;')();
for (const a of defs) ok('文件存在 ' + a.key, fsx.existsSync(path.join(__dirname, '..', 'renderer', 'icons', 'avatar-' + a.key + '.png')));

console.log(`\n== 渲染层纯函数: ${pass} PASS / ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
