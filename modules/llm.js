'use strict';

/**
 * llm.js —— 大模型调用统一封装
 *
 * Ollama 模式：
 *   POST {baseUrl}/api/generate
 *   body: { model, prompt, stream: false }
 *   返回: data.response
 *
 * OpenAI 兼容模式：
 *   POST {baseUrl}/chat/completions
 *   headers: Authorization: Bearer {apiKey}
 *   body: { model, messages: [{ role: "user", content: prompt }] }
 *   返回: data.choices[0].message.content
 *
 * 统一返回 { ok: true, text } 或 { ok: false, error }
 * 请求超时 600 秒（10 分钟）：保留模型完整推理能力（不关闭思考），长文生成与思考型模型
 * 在本地大模型上可能耗时较长；主进程只负责等待，渲染进程切换界面不影响请求继续执行。
 */

const TIMEOUT_MS = 600 * 1000;

/**
 * 剥离模型返回中的思维链（think）内容：
 * - 完整 <think>...</think> 块（任意位置、可多次）→ 移除
 * - 未闭合的开头 <think>（无 </think>）→ 剥到结尾
 * - 孤立的 </think> 标签 → 移除
 * - 纯文本推理前导（无标签，如 "Thinking Process: ..."）→ 按正文分界/空行截断（保守，剥不动则保留）
 * 思考型模型（如 Qwen 系）常把推理过程输出在 <think> 块或纯文本前导中，这些内容不应保存/回填到设定。
 */

/** 纯文本推理前导：出现在文本开头的常见推理标题（英文+中文） */
const PLAIN_THINK_LEAD = /^\s*(?:thinking process|thought|reasoning|chain[- ]of[- ]thought|思考过程|思考|推理过程|分析|思路|我的思考|我思考)[:：]/i;
/** 正文分界标记：推理段结束后模型常以这些词引出正式输出 */
const CONTENT_BOUNDARY = /^\s*(?:直接输出|正文[:：]|正文内容|正文如下|以下为(?:正文|内容)|最终答案|答案[:：]|输出[:：]|final (?:answer|output)|result[:：]|answer[:：])/i;

function stripPlainThink(t) {
  if (!PLAIN_THINK_LEAD.test(t)) return t;
  const lines = t.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (CONTENT_BOUNDARY.test(lines[i])) {
      return lines.slice(i).join('\n').replace(CONTENT_BOUNDARY, '').trim();
    }
  }
  // 无分界标记：取第一个空行之后的内容（推理段通常独立成段）
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '' && i < lines.length - 1) {
      const rest = lines.slice(i + 1).join('\n').trim();
      if (rest) return rest;
      return t;
    }
  }
  return t; // 无空行无分界：可能本身就是正文，保留
}

function stripThink(text) {
  let t = String(text || '');
  t = t.replace(/<think[\s\S]*?<\/think>/gi, '');
  if (/<think/i.test(t)) {
    t = t.replace(/<think[\s\S]*$/gi, '');
  }
  t = t.replace(/<\/think>/gi, '');
  t = t.trim();
  // 纯文本推理前导（开头才触发）
  t = stripPlainThink(t);
  return t.trim();
}

/** 统一调用入口（timeoutMs 可选，默认 600 秒；测试连接等轻量请求可传短超时） */
async function requestLLM(config, prompt, timeoutMs) {
  if (!config || typeof config !== 'object') {
    return { ok: false, error: '未配置大模型，请先在设置中完成配置' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || TIMEOUT_MS);

  try {
    if (config.provider === 'ollama') {
      return await requestOllama(config, prompt, controller.signal);
    }
    if (config.provider === 'openai_compatible') {
      return await requestOpenAICompatible(config, prompt, controller.signal);
    }
    return { ok: false, error: '未知的接入方式: ' + String(config.provider) };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { ok: false, error: '请求超时（' + Math.round((timeoutMs || TIMEOUT_MS) / 1000) + ' 秒未响应），请检查服务地址与网络' };
    }
    const msg = String(err && err.message ? err.message : err);
    if (/ECONNREFUSED|fetch failed|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
      return { ok: false, error: '无法连接到服务地址，请检查地址是否正确、服务是否已启动' };
    }
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function requestOllama(config, prompt, signal) {
  const base = String(config.ollamaBaseUrl || 'http://localhost:11434').replace(/\/+$/, '');
  const model = String(config.ollamaModel || '').trim();
  if (!model) return { ok: false, error: '未填写 Ollama 模型名称' };

  const res = await fetch(base + '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal
  });

  const raw = await res.text();
  if (!res.ok) {
    if (res.status === 404 && /not found|does not exist/i.test(raw)) {
      return { ok: false, error: 'Ollama 中找不到模型「' + model + '」。请先在 Ollama 中执行 ollama pull ' + model + ' 拉取该模型，或到设置里换一个已安装的模型。' };
    }
    return { ok: false, error: 'Ollama HTTP ' + res.status + ': ' + truncate(raw, 300) };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (_e) {
    return { ok: false, error: 'Ollama 返回了无法解析的内容' };
  }

  const text = stripThink(data && data.response || '');
  return text
    ? { ok: true, text }
    : { ok: false, error: 'Ollama 返回内容为空（请确认模型名称是否正确）' };
}

async function requestOpenAICompatible(config, prompt, signal) {
  const base = String(config.openaiBaseUrl || '').replace(/\/+$/, '');
  const apiKey = String(config.openaiApiKey || '').trim();
  const model = String(config.openaiModel || '').trim();
  if (!base) return { ok: false, error: '未填写 Base URL' };
  if (!apiKey) return { ok: false, error: '未填写 API Key' };
  if (!model) return { ok: false, error: '未填写模型名称' };

  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }]
    }),
    signal
  });

  const raw = await res.text();
  if (!res.ok) {
    let detail = '';
    try {
      const j = JSON.parse(raw);
      if (j && j.error && j.error.message) detail = ' ' + String(j.error.message);
    } catch (_e) { /* 忽略解析失败 */ }
    return { ok: false, error: '接口 HTTP ' + res.status + (detail ? '：' + detail : '') };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (_e) {
    return { ok: false, error: '接口返回了无法解析的内容' };
  }

  const text = stripThink(
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content ||
    ''
  );

  return text
    ? { ok: true, text }
    : { ok: false, error: '接口返回内容为空（请检查模型名称是否正确）' };
}

/** 测试连接：发送一个极简请求验证配置（90 秒短超时，覆盖 Ollama 冷启动，避免等待过久） */
function testConnection(config) {
  return requestLLM(config, '你好，请用一句话回复，以证明连接正常。', 90 * 1000);
}

function truncate(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

module.exports = { requestLLM, testConnection, stripThink };
