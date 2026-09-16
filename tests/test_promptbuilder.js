'use strict';
/* 验收单测：promptBuilder 纯逻辑（README 第六/七节可测规格） */
const pb = require('./modules/promptBuilder');
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, detail || ''); }
};

// —— estimateTokens：⌈去空白字数÷1.5⌉ ——
console.log('\n[estimateTokens]');
ok('空串=0', pb.estimateTokens('') === 0);
ok('3字=2', pb.estimateTokens('我爱你') === 2, pb.estimateTokens('我爱你'));
ok('空白不计', pb.estimateTokens('a b c\n d') === 3, pb.estimateTokens('a b c\n d'));  // "abcd"=4字→⌈4/1.5⌉=3
ok('100字=67', pb.estimateTokens('字'.repeat(100)) === 67, pb.estimateTokens('字'.repeat(100)));

// —— buildFieldOptimizePrompt 四模式 ——
console.log('\n[字段优化四模式判定]');
const mk = (v, extra) => pb.buildFieldOptimizePrompt(Object.assign({cardName:'C',fieldLabel:'F',fieldValue:v}, extra||{}));
ok('空→generate', mk('').mode === 'generate');
ok('39字→expand', mk('短'.repeat(39)).mode === 'expand');
ok('40字→polish', mk('短'.repeat(40)).mode === 'polish');
ok('220字→polish', mk('中'.repeat(220)).mode === 'polish');
ok('221字→condense', mk('长'.repeat(221)).mode === 'condense');
ok('targetLen 生效', mk('', {targetLen:'20~40'}).prompt.includes('约 20~40 字'));
ok('regen 换角度', mk('x', {regen:true}).prompt.includes('换一种组织角度'));
ok('上下文标注不复述', mk('x', {contextSummary:'同卡内容'}).prompt.includes('不要复述'));
ok('输出契约含禁思考', mk('x').prompt.includes('不要输出字段名'));

// —— buildPrompt 组装规则 ——
console.log('\n[buildPrompt 组装]');
const base = {
  chapter:'第一章', title:'重逢', plotSynopsis:'沈砚入京。',
  worldbuildingCards:[{name:'灵力体系',certainty:'铁律',type:'力量体系',coreSetting:'万物可修。',internalConflict:'',characterHint:'',selected:true}],
  characterCards:[{name:'沈砚',freedomLevel:'严格遵循',basicInfo:'十八岁。',personalityBehavior:'',desireFear:'',secret:'',relationships:'',characterArc:'',speechSamples:'无妨。\n我只信剑。',selected:true}],
  sceneCards:[], styleCards:[],
  globalConstraints:{wordCountMin:2000,wordCountMax:4000,taboos:'禁现代词\n禁降智',formatRequirement:''}
};
const p = pb.buildPrompt(base);
ok('含页眉定位句', p.includes('专业小说作家'));
ok('含章节/标题', p.includes('章节：第一章') && p.includes('标题：重逢'));
ok('含世界观段', p.includes('【世界观参考】') && p.includes('灵力体系'));
ok('含角色段', p.includes('【角色演绎指引】') && p.includes('沈砚'));
ok('台词逐行缩进', p.includes('  无妨。') && p.includes('  我只信剑。'));
ok('含创作约束+禁忌逐行', p.includes('【创作约束】') && p.includes('禁现代词') && p.includes('禁降智'));
ok('含页脚', p.includes('让角色活起来'));
// 顺序：页眉<梗概<世界观<角色<约束<页脚
const idx = s => p.indexOf(s);
ok('段落顺序正确',
   idx('【情节梗概】') < idx('【世界观参考】') &&
   idx('【世界观参考】') < idx('【角色演绎指引】') &&
   idx('【角色演绎指引】') < idx('【创作约束】') &&
   idx('【创作约束】') < idx('让角色活起来'));

// 只组装已选中
const unselected = JSON.parse(JSON.stringify(base));
unselected.worldbuildingCards[0].selected = false;
const p2 = pb.buildPrompt(unselected);
ok('未选中卡不组装', !p2.includes('灵力体系') && !p2.includes('【世界观参考】'));

// 空大类跳过（无场景/文风卡）
ok('空大类整段跳过', !p.includes('【场景氛围】') && !p.includes('【文风要求】'));

// 空梗概不输出该节
const noPlot = JSON.parse(JSON.stringify(base)); noPlot.plotSynopsis=''; noPlot.chapter=''; noPlot.title='';
ok('空情节整段跳过', !pb.buildPrompt(noPlot).includes('【情节梗概】'));

// 自定义页眉页脚
const custom = JSON.parse(JSON.stringify(base));
custom.opening='CUSTOM_HEAD'; custom.closing='CUSTOM_FOOT';
const pc = pb.buildPrompt(custom);
ok('自定义页眉页脚生效', pc.includes('CUSTOM_HEAD') && pc.includes('CUSTOM_FOOT') && !pc.includes('专业小说作家'));

// 全空视图
ok('空视图不崩', typeof pb.buildPrompt({}) === 'string');
ok('null 视图返回空串', pb.buildPrompt(null) === '');

// Token 一致性：底部栏估算 == 对成品文本估算口径
const tokens = pb.estimateTokens(p);
ok('成品 Token 可复算', tokens === pb.estimateTokens(pb.buildPrompt(base)) && tokens > 0, tokens);

console.log(`\n== promptBuilder 单测: ${pass} PASS / ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
