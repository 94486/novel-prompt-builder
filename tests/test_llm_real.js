'use strict';
/* 真实 Ollama 集成测试：testConnection（90s）+ 一次字段优化风格短请求 */
const llm = require('./modules/llm');
const cfg = require('./data/config.json');
(async () => {
  const t0 = Date.now();
  const r = await llm.testConnection(cfg);
  console.log('testConnection:', r.ok ? 'OK' : 'FAIL', `(${((Date.now()-t0)/1000).toFixed(1)}s)`);
  if (!r.ok) { console.log('  error:', r.error); process.exit(1); }
  console.log('  模型回复:', String(r.text).slice(0, 80).replace(/\n/g, ' '));
  // 二次请求（模型已热）验证生成通道
  const t1 = Date.now();
  const r2 = await llm.requestLLM(cfg, '把下面这句润色到20字左右，只输出结果：少年握紧了手里的剑。');
  console.log('润色请求:', r2.ok ? 'OK' : 'FAIL', `(${((Date.now()-t1)/1000).toFixed(1)}s)`);
  if (r2.ok) console.log('  输出:', String(r2.text).slice(0, 100).replace(/\n/g, ' '));
  else console.log('  error:', r2.error);
  process.exit(r.ok && r2.ok ? 0 : 1);
})();
