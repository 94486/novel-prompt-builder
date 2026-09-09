'use strict';
/* D3 端到端裁决：真实 Ollama 模型 → llm.js(主进程) → parseFieldResult(渲染层清洗)，
   验证"纯文本思维链"最终落到用户字段里的是什么。 */
const fs = require('fs');
const llm = require('./modules/llm');
const pb = require('./modules/promptBuilder');
const src = fs.readFileSync(__dirname + '/renderer/app.js', 'utf8');
function extractFn(name) {
  const i = src.indexOf('function ' + name + '(');
  let depth = 0, started = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { depth++; started = true; }
    else if (src[j] === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
}
const M = new Function(extractFn('cleanLLMText') + '\n;\n' + extractFn('parseFieldResult') + '; return { parseFieldResult };')();
const cfg = require('./data/config.json');

(async () => {
  const built = pb.buildFieldOptimizePrompt({
    cardName: '沈砚', fieldLabel: '欲望与恐惧', fieldHint: '行动的原动力与最害怕的事（建议 20~40 字）',
    fieldValue: '让寒门出头', targetLen: '20~40',
    contextSummary: '名称：沈砚\n基本信息：十八岁寒门书生'
  });
  console.log('mode:', built.mode, '| 请求发送中（模型已热，预计 30~120s）...');
  const t0 = Date.now();
  const r = await llm.requestLLM(cfg, built.prompt);
  if (!r.ok) { console.log('LLM 失败:', r.error); process.exit(1); }
  console.log(`耗时 ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log('\n--- 主进程返回(llm.js 层) 前 300 字 ---\n' + r.text.slice(0, 300));
  const final = M.parseFieldResult(r.text, '欲望与恐惧');
  console.log('\n--- 渲染层清洗后(parseFieldResult) === 用户将看到的字段内容 ---\n' + final);
  const bad = /thinking process|analyze the request|步骤|首先，|我需要/i.test(final);
  console.log('\n判定:', bad ? '❌ 思维链仍泄漏进字段（D3 确认）' : (final && final.length <= 60 ? '✅ 清洗有效，字段干净' : '⚠ 无推理词但内容偏长，人工复核'));
  process.exit(0);
})();
