'use strict';
/* 验收单测：llm.js —— 思维链剥离 / 404 指引 / 超时 / 错误文案（本地 mock 服务器，不碰外网） */
const http = require('http');
const llm = require('./modules/llm');
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? (pass++, console.log('  PASS', n)) : (fail++, console.log('  FAIL', n, d || '')); };

// 可控 mock：按路径返回预设响应
let mode = 'ok';
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    if (req.url === '/slow/api/generate') { setTimeout(() => {}, 0); return; } // 永不响应→测超时
    if (req.url === '/api/generate') {
      if (mode === '404') { res.writeHead(404, {'Content-Type':'application/json'}); return res.end('{"error":"model \\"x\\" not found"}'); }
      if (mode === 'think') { res.writeHead(200); return res.end(JSON.stringify({response:'<think>先构思三段……</think>正文内容在这里。'})); }
      if (mode === 'think_open') { res.writeHead(200); return res.end(JSON.stringify({response:'<think>没闭合的思考一直到结尾'})); }
      if (mode === 'think_orphan') { res.writeHead(200); return res.end(JSON.stringify({response:'</think>只有孤立闭合标签的正文'})); }
      if (mode === 'empty') { res.writeHead(200); return res.end(JSON.stringify({response:''})); }
      res.writeHead(200); return res.end(JSON.stringify({response:'正常返回'}));
    }
    res.writeHead(404); res.end('{}');
  });
});

const cfg = (port, model) => ({ provider:'ollama', ollamaBaseUrl:`http://127.0.0.1:${port}`, ollamaModel: model||'m1' });

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  console.log('\n[llm.js Ollama 通道]');
  let r = await llm.requestLLM(cfg(port), 'hi');
  ok('正常返回 ok', r.ok === true && r.text === '正常返回', JSON.stringify(r));

  mode = '404';
  r = await llm.requestLLM(cfg(port, 'foo:bar'), 'hi');
  ok('404→明确 pull 指引', !r.ok && r.error.includes('ollama pull foo:bar'), r.error);

  mode = 'think';
  r = await llm.requestLLM(cfg(port), 'hi');
  ok('剥离成对<think>', r.ok && r.text === '正文内容在这里。', JSON.stringify(r));

  mode = 'think_open';
  r = await llm.requestLLM(cfg(port), 'hi');
  ok('未闭合<think>剥到结尾', r.ok === false && r.error.includes('为空'), JSON.stringify(r));

  mode = 'think_orphan';
  r = await llm.requestLLM(cfg(port), 'hi');
  ok('孤立</think>移除', r.ok && r.text === '只有孤立闭合标签的正文', JSON.stringify(r));

  mode = 'ok';
  r = await llm.requestLLM({ provider:'ollama', ollamaBaseUrl: base, ollamaModel:'  ' }, 'hi');
  ok('空模型名→明确报错', !r.ok && r.error.includes('未填写'), r.error);

  r = await llm.requestLLM(cfg(1), 'hi'); // 端口没人听
  ok('连不上→友好文案', !r.ok && r.error.includes('无法连接'), r.error);

  r = await llm.requestLLM(null, 'hi');
  ok('null 配置→不崩', !r.ok && r.error.includes('未配置'), r.error);

  r = await llm.requestLLM({ provider:'weird' }, 'hi');
  ok('未知 provider', !r.ok && r.error.includes('未知'), r.error);

  // 超时：指向永不响应的服务器
  const hang = http.createServer(() => {}); hang.listen(0, '127.0.0.1', async () => {
    const hp = hang.address().port;
    const t0 = Date.now();
    const rt = await llm.requestLLM({ provider:'ollama', ollamaBaseUrl:`http://127.0.0.1:${hp}`, ollamaModel:'m' }, 'hi', 1200);
    ok('超时→AbortError 文案', !rt.ok && rt.error.includes('超时') && rt.error.includes('1 秒'), rt.error);
    ok('超时耗时≈设定值', Date.now() - t0 < 4000, Date.now() - t0);
    hang.close();

    // OpenAI 通道参数校验（不发真实网络请求即可触发校验分支）
    console.log('\n[llm.js OpenAI 通道校验]');
    let o = await llm.requestLLM({ provider:'openai_compatible', openaiBaseUrl:'', openaiApiKey:'k', openaiModel:'m' }, 'hi');
    ok('缺 BaseURL', !o.ok && o.error.includes('Base URL'), o.error);
    o = await llm.requestLLM({ provider:'openai_compatible', openaiBaseUrl:'http://127.0.0.1:1/v1', openaiApiKey:'', openaiModel:'m' }, 'hi');
    ok('缺 Key', !o.ok && o.error.includes('API Key'), o.error);
    o = await llm.requestLLM({ provider:'openai_compatible', openaiBaseUrl:'http://127.0.0.1:1/v1', openaiApiKey:'k', openaiModel:'' }, 'hi');
    ok('缺模型名', !o.ok && o.error.includes('模型名称'), o.error);

    console.log(`\n== llm.js 单测: ${pass} PASS / ${fail} FAIL ==`);
    server.close(); process.exit(fail ? 1 : 0);
  });
});
