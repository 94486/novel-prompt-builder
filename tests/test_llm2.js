'use strict';
/* 第二轮：llm.js OpenAI 成功路径 + Ollama 异常响应（mock 服务器） */
const http = require('http');
const llm = require('./modules/llm');
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? (pass++, console.log('  PASS', n)) : (fail++, console.log('  FAIL', n, d || '')); };

let mode = 'ok';
const server = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    if (req.url.endsWith('/chat/completions')) {
      if (mode === 'oa_ok') { res.writeHead(200, {'Content-Type':'application/json'}); return res.end(JSON.stringify({choices:[{message:{content:'OpenAI 通道返回'}}]})); }
      if (mode === 'oa_think') { res.writeHead(200); return res.end(JSON.stringify({choices:[{message:{content:'<think>推理</think>干净输出'}}]})); }
      if (mode === 'oa_err400') { res.writeHead(400); return res.end(JSON.stringify({error:{message:'invalid api key'}})); }
      res.writeHead(200); return res.end('not json at all');
    }
    if (req.url.endsWith('/api/generate')) { res.writeHead(200); return res.end('ÿþ broken'); }
    res.writeHead(404); res.end();
  });
});
server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const oa = (m) => ({ provider:'openai_compatible', openaiBaseUrl: base + '/v1', openaiApiKey:'k', openaiModel:'m', _m:m });

  console.log('\n[OpenAI 兼容通道]');
  mode='oa_ok';
  let r = await llm.requestLLM({ provider:'openai_compatible', openaiBaseUrl: base+'/v1', openaiApiKey:'k', openaiModel:'m' }, 'hi');
  ok('成功解析 choices', r.ok && r.text === 'OpenAI 通道返回', JSON.stringify(r));
  mode='oa_think';
  r = await llm.requestLLM({ provider:'openai_compatible', openaiBaseUrl: base+'/v1', openaiApiKey:'k', openaiModel:'m' }, 'hi');
  ok('think 剥离', r.ok && r.text === '干净输出', JSON.stringify(r));
  mode='oa_err400';
  r = await llm.requestLLM({ provider:'openai_compatible', openaiBaseUrl: base+'/v1', openaiApiKey:'k', openaiModel:'m' }, 'hi');
  ok('400 带服务端 message', !r.ok && r.error.includes('invalid api key'), r.error);
  mode='garbage';
  r = await llm.requestLLM({ provider:'openai_compatible', openaiBaseUrl: base+'/v1', openaiApiKey:'k', openaiModel:'m' }, 'hi');
  ok('非 JSON 响应→无法解析', !r.ok && r.error.includes('无法解析'), r.error);

  console.log('\n[Ollama 异常响应]');
  r = await llm.requestLLM({ provider:'ollama', ollamaBaseUrl: base, ollamaModel:'m' }, 'hi');
  ok('Ollama 非 JSON→无法解析', !r.ok && r.error.includes('无法解析'), r.error);

  console.log(`\n== llm2 单测: ${pass} PASS / ${fail} FAIL ==`);
  server.close(); process.exit(fail ? 1 : 0);
});
