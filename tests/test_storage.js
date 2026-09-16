'use strict';
/* 第二轮：storage.js 存储层测试（临时目录，不碰真实 data） */
const os = require('os'), path = require('path'), fs = require('fs');
const storage = require('./modules/storage');
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? (pass++, console.log('  PASS', n)) : (fail++, console.log('  FAIL', n, d || '')); };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'npb-store-'));
console.log('\n[storage.js 临时目录]', tmp);

ok('init 创建 data 目录', (storage.init(tmp), fs.existsSync(path.join(tmp, 'data'))));
ok('首启生成 projects.json+config.json', fs.existsSync(path.join(tmp, 'data', 'projects.json')) && fs.existsSync(path.join(tmp, 'data', 'config.json')));

const pj = storage.readJSON(path.join(tmp, 'data', 'projects.json'));
ok('默认数据可读且非空', pj && typeof pj === 'object');
ok('默认数据已是v3(version/library/projects)', pj.version === 3 && !!pj.library && Array.isArray(pj.projects));
ok('v3角色卡无旧字段', (() => { const c = pj.library.characterCards[0]; return c && !('personalityCore' in c) && !('coreDesire' in c) && c.category === 'character'; })());

const cfg = storage.readJSON(path.join(tmp, 'data', 'config.json'));
ok('默认配置 provider=ollama', cfg.provider === 'ollama' && /11434/.test(cfg.ollamaBaseUrl));

const f = path.join(tmp, 'data', 'projects.json');
storage.writeJSON(f, { hello: '中文😀', n: 1 });
ok('写读往返(unicode)', storage.readJSON(f).hello === '中文😀');
ok('无 .tmp 残留', !fs.existsSync(f + '.tmp'));
storage.writeJSON(f, { v: 2 });
ok('覆写生效', storage.readJSON(f).v === 2);

fs.writeFileSync(f, '{坏掉的 json!!!', 'utf-8');
ok('损坏JSON→readJSON返回null不抛', storage.readJSON(f) === null);
ok('不存在文件→null', storage.readJSON(path.join(tmp, 'nope.json')) === null);

storage.init(tmp); // 幂等重入
ok('init 幂等不崩', fs.existsSync(f));
ok('getDataDir 正确', storage.getDataDir() === path.join(tmp, 'data'));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n== storage 单测: ${pass} PASS / ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
