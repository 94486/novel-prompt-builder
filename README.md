# 龙猫小说提示词管理器

基于 Electron 的桌面应用：用**卡牌式**方式管理小说世界观 / 角色 / 场景 / 文风设定，实时组装成可直接投喂大模型的创作 Prompt；内置大模型接入（Ollama / OpenAI 兼容），支持**逐字段 AI 优化**（每个输入框独立优化）与章节「推送生成」。

核心数据模型：**素材库（资产池）+ 项目**——所有卡牌进素材库，可重复导入多个项目（项目内为独立副本，编辑/删除互不影响）。

界面为深色玻璃拟态风格，无边框窗口，卡牌手牌式层叠 + 丝滑视差动画。

---

## 一、核心功能

| 功能 | 说明 |
| --- | --- |
| 多项目 | 顶部下拉切换 / 新建 / 重命名小说项目，各项目设定、选中状态、章节互不干扰 |
| 素材库 | 全局卡池（世界观/角色/场景/文风各 6 张预设）；导入项目生成独立副本；素材与项目卡分别管理、独立删除；弹窗内可编辑、导入/导出 JSON |
| 卡牌视图 | 双主卡并列居中 + 左右次级卡透视；滚轮 / 箭头按钮 / 左右拖动切换；点击上 1/3 编辑、下 2/3 选定；选中卡发光放大置顶；**DOM 复用真实移位**动画（同一张卡原地过渡，无重建跳变、无亮度闪烁）；无限循环切换，卡数无上限；卡牌区底部常驻操作提示文字 |
| 角色形象 | 性别仅「男/女」，联动形象集（男 1 枚 / 女 8 枚古风头像，纯图片无文字）；头像透明无底色 |
| 情节视图 | 章节号 + 标题 + 正文三输入，500ms 防抖自动保存，AI 润色 / 清空 |
| 章节管理 | 预览弹窗「保存章节」存 Prompt 快照；双击编辑、拖拽排序；每章「推送生成」AI 正文（后台执行、自动保存）、「查看生成」；右上角分别导出全部提示词 txt / AI 文章 txt |
| 逐字段 AI 优化 | 编辑页每个输入框右侧 ✨ 按钮：**按内容长度自适应**——空→生成、过短(<40字)→扩充、适中→润色、过长(>220字)→精简；**目标字数按字段建议联动**（如"欲望与恐惧"约 20~40 字、"参考范文"约 40~80 字）；携带整卡上下文（同组字段优先、总限 200 字）保证逻辑一致；优化中输入框青色呼吸高亮；完成后显示字数变化（原 N 字 → 新 M 字）；支持**单字段还原**（字段旁 ↩ 仅还原该字段）与一键还原全部；**返回自动剥离 `<think>` 思维链**，不保存推理过程 |
| 字段结构 | 四类卡牌按主流提示词规格精简：世界观 3 字段、**角色 7 字段**（性格与行为、欲望与恐惧为合并字段）、场景 5 字段、文风 3 字段，每字段标注建议字数；**旧版角色分字段（性格内核/行为模式/核心欲望/核心恐惧）在加载/导入时直接舍弃，不做兼容拼接** |
| 选项自定义 | 每个下拉旁「✏️ 管理选项」：增删改 / 排序该字段选项，持久化到 config.json |
| Prompt 组装 | 底部栏实时显示「已选 N 张 · 预估 Token K」+ 版本号 vX.Y.Z；复制 / 预览 / 导出 TXT（预览内） |
| 创作约束预设 | 情节页字数 / 格式 / 禁忌 + **首尾提示词（组装 Prompt 页眉/页脚）** 均纳入预设方案，管理弹窗内可增删改（留空用内置默认），套用后写入当前项目 |
| 大模型设置 | Ollama / OpenAI 兼容双模式；测试连接 90s 超时；生成 600s 超时；「推送生成」后台执行不中断 |
| 数据持久化 | 500ms 防抖自动保存，存 exe 同级 `data/`；临时文件 + 原子重命名写入 |
| 无边框窗口 | 自绘最小化 / 最大化 / 关闭按钮；F11 全屏；退出时强制干净结束子进程 |

---

## 二、技术栈与关键约束

- **Electron**：主进程 + 沙箱渲染进程（`contextIsolation` 开启、`nodeIntegration` 关闭）
- 前端：原生 HTML + CSS + JS，零框架、零 CDN、无构建步骤
- 样式：CSS 变量深色玻璃拟态主题
- 图标：扁平 SVG（Logo / UI）+ 位图 PNG（角色头像 `renderer/icons/avatar-*.png`）
- 大模型：主进程 Node 原生 `fetch` 转发（规避 CORS）
- 打包：`electron-builder --win portable`（单文件免安装 exe）

**开发必须遵守的约束：**
- 保留模型完整推理（**禁用 `think:false`**，避免降智）
- 生成超时 600s、测试连接 90s（Ollama 冷启动慢）
- 下拉列表不得被遮挡（自定义智能下拉，自动向上展开）；长文本输入框足够大
- 卡牌切换用 **DOM 复用 + CSS 变量过渡**（真实移位），禁止整卡重绘滤镜提亮
- AI 并发安全：字段优化走**串行队列**（同一时间一个请求）；会话令牌防弹窗关闭后回填；基线校验防覆盖用户手动修改
- 程序退出必须干净（before-quit 强制结束子进程）

---

## 三、目录结构

```
novel-prompt-builder/
├─ package.json          # 依赖、脚本、electron-builder 配置（win.icon: build/icon.png）
├─ main.js               # 主进程：窗口、IPC 通道、data 目录解析、LLM 转发、F11、干净退出
├─ preload.js            # contextBridge 暴露 window.api（安全 IPC 白名单）
├─ modules/
│   ├─ storage.js        # 数据读写（fs 封装 + 原子写 + 首次运行默认数据）
│   ├─ llm.js            # 大模型统一封装（Ollama / OpenAI；600s/90s 超时；404 提示）
│   └─ promptBuilder.js  # Prompt 组装 + AI 优化指令构造 + Token 估算（UMD，renderer 也可用）
├─ renderer/
│   ├─ index.html        # 主页面 + 全部弹窗视图
│   ├─ styles.css        # 全部样式（玻璃拟态主题）
│   ├─ app.js            # 前端交互逻辑（数据层 + 卡牌 + 素材库 + 项目 + 章节 + AI）
│   └─ icons/            # app-logo.svg + 角色头像位图
├─ data/                 # 运行时自动创建（projects.json / config.json）
├─ build/                # app-icon-dark.svg（源）+ icon.png（打包图标，勿删）
├─ build_icon.ps1 / build_icon.py  # 图标生成脚本（改图标后重跑）
├─ build.ps1 / build.bat / 打包exe.bat  # 一键打包入口
└─ README.md
```

### 主要 IPC 通道（main.js）

`read-data / save-data`（projects.json、config.json 白名单）、`get-app-path / get-version`、`export-file / export-text / import-file`、`llm-request / llm-test`、`window-minimize / window-maximize-toggle / window-close`、`toggle-fullscreen`。

---

## 四、开发与打包

```powershell
npm install          # 安装依赖（首次需下载 Electron，可配 npmmirror 镜像）
npm start            # 开发模式运行（数据在项目根 data/）
npm run smoke        # 冒烟测试（隐藏窗口校验渲染，日志 %TEMP%\smoke.log）
```

打包（国内镜像）：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm run dist
```

产物说明：
- 输出 `release\novel-prompt-builder-{version}-x64.exe`（portable 免安装，双击即用；产物名用 ASCII 规避中文乱码，打包后自行改名为中文即可）
- **用户数据在 exe 同级 `data/`**；换机请连同 data/ 拷贝，或用素材库「导出 JSON」备份
- 若旧 exe 被杀毒软件锁定导致无法覆盖，用 `--config.directories.output=release-vXXX` 输出到新目录
- 打包后同步数据：`Copy-Item data\projects.json,data\config.json release-vXXX\data\ -Force`

---

## 五、数据模型（v3）

`data/projects.json`：

```json
{
  "version": 3,
  "library": {
    "worldbuildingCards": [ { "id": "源卡id", "category": "worldbuilding", "name": "", "type": "", "certainty": "", "coreSetting": "", "internalConflict": "", "characterHint": "" } ],
    "characterCards": [ { "id": "源卡id", "category": "character", "name": "", "gender": "男|女", "avatar": "male|grace|seductive|allure|innocent|heroine|icy|queen|consort", "freedomLevel": "", "basicInfo": "", "personalityBehavior": "", "desireFear": "", "secret": "", "relationships": "", "characterArc": "", "speechSamples": "" } ],
    "sceneCards": [ { "id": "源卡id", "category": "scene", "name": "", "sceneFunction": "", "timeLocation": "", "sensoryDetails": "", "atmosphereKeywords": "", "characterImpact": "", "variableElements": "" } ],
    "styleCards": [ { "id": "源卡id", "category": "style", "name": "", "applicableScene": "", "styleDescription": "", "referenceText": "", "antiExample": "" } ]
  },
  "projects": [
    {
      "id": "p_main", "name": "小说名",
      "plot": { "chapter": "", "title": "", "content": "" },
      "globalConstraints": { "taboos": "", "wordCountMin": 2000, "wordCountMax": 4000, "formatRequirement": "", "opening": "", "closing": "" },
      "cards": { "worldbuilding": [ { "id": "副本id", "sourceId": "源卡id", "category": "worldbuilding", "...字段同源卡" } ], "character": [], "scene": [], "style": [] },
      "selected": { "worldbuilding": { "副本id": true } },
      "chapters": [ { "id": "ch_1", "chapter": "第一章", "title": "", "name": "", "prompt": "", "tokens": 0, "generated": "", "generatedTokens": 0, "generatedAt": 0, "savedAt": 0 } ]
    }
  ],
  "activeProjectId": "p_main"
}
```

- **素材库与项目**：`library` 为全局源卡池；`projects[].cards` 为项目内副本（新建卡时素材库与项目各存一份，id 不同、`sourceId` 关联，之后互不影响编辑/删除）；`selected` 为项目级选中状态（组装只取已选中卡）
- **`opening` / `closing`**：组装 Prompt 的页眉 / 页脚（为空时用内置默认）；来源：套用创作约束预设写入
- **`chapters`**：保存的章节 Prompt 快照 + AI 生成正文（`generated`）
- **旧字段舍弃**：角色旧字段 `personalityCore / behaviorPattern / coreDesire / coreFear` 在**所有路径**（v1 迁移 / v2/v3 加载 / 导入）直接删除（v1.4.4 起），不做兼容拼接；v1 旧格式由 `normalizeData` 按池注入 `category` 后同样执行头像迁移（`女·绝美`→`grace` 等）与旧字段丢弃
- **首次运行**：默认数据即 v3（`library`+`projects` 双结构、角色卡已合并字段），不再产生 v1 格式数据

`data/config.json`：

```json
{
  "provider": "ollama | openai_compatible",
  "ollamaBaseUrl": "http://localhost:11434",
  "ollamaModel": "模型名:tag",
  "openaiBaseUrl": "https://.../v1",
  "openaiApiKey": "",
  "openaiModel": "",
  "cardOptions": { "字段key": ["选项1", "选项2"] },
  "constraintPresets": [ { "name": "玄幻修仙", "wordCountMin": 2000, "wordCountMax": 4000, "formatRequirement": "", "taboos": "每行一条", "opening": "页眉（空=内置默认）", "closing": "页脚（空=内置默认）" } ]
}
```

- `cardOptions`：下拉选项自定义（界面「✏️ 管理选项」增删改排序，持久化于此）
- `constraintPresets`：创作约束预设（「管理预设」弹窗可增删改，含首尾提示词）；套用写入项目 `globalConstraints`
- v1/v2 旧数据启动时自动迁移为 v3（迁移仅保留新结构字段）

### 卡牌字段与建议字数（编辑区标注，AI 优化同口径）

| 类目 | 字段（key · 控件 · 建议字数） |
| --- | --- |
| 世界观 | 类型 `type`（下拉：力量体系/政治势力/地理环境/历史文化/社会制度/科技水平/宗教信仰）· 确定性等级 `certainty`（下拉：铁律/常规/模糊）· 核心设定 `coreSetting` 多行 **30~60** · 内在矛盾 `internalConflict` 多行 **20~50** · 与角色的关联提示 `characterHint` 单行 **20~40** |
| 角色 | 性别 `gender`（下拉 男/女）· 形象 `avatar`（头像选择，纯图无文字；选男=君子 1 枚、选女=绝美/性感/风骚/清纯/女侠/冷艳/女王/皇妃 8 枚；选头像联动性别）· 演绎自由度 `freedomLevel`（下拉：严格遵循/可适度发挥/仅参考方向）· 基础信息 `basicInfo` 多行 **30~60** · 性格与行为 `personalityBehavior` 多行 **40~80** · 欲望与恐惧 `desireFear` 单行 **20~40** · 秘密 `secret` 多行 **10~30** · 人物关系 `relationships` 多行 **20~40** · 角色弧线 `characterArc` 多行 **20~40** · 台词样本 `speechSamples` 多行 **40~60**（2~5 句，每句≤20 字） |
| 场景 | 场景功能 `sceneFunction`（下拉：冲突爆发/情感转折/信息揭示/日常过渡/高潮决战）· 时空定位 `timeLocation` 单行 **10~30** · 感官描写 `sensoryDetails` 多行 **20~50** · 氛围关键词 `atmosphereKeywords` 单行 **5~15** · 对角色的影响 `characterImpact` 多行 **15~40**（只写情绪/选择影响，叙事作用归场景功能）· 可变要素 `variableElements` 多行 **10~30** |
| 文风 | 适用情境 `applicableScene`（下拉：通用/对话/战斗/心理/环境/叙事过渡）· 风格描述 `styleDescription` 多行 **20~40** · 参考范文 `referenceText` 多行 **40~80** · 反面示例 `antiExample` 多行 **20~40** |

---

## 六、大模型接入

**Ollama**：默认 `http://localhost:11434`，模型名须与 `ollama list` 完全一致（含命名空间与 `:tag`）。请求 `POST /api/generate`，`stream: false`，**不关闭思考**（避免降智）。

**OpenAI 兼容**：内置 DeepSeek / 通义千问 / Moonshot 预设。请求 `POST /chat/completions`，`Authorization: Bearer {apiKey}`。

- 测试连接：极简请求验证，90s 超时（覆盖 Ollama 冷启动）
- 生成：600s 超时；「推送生成」后台执行，期间可切换界面，完成自动保存
- 404：给出「请先 `ollama pull 模型名`」明确指引

### 逐字段 AI 优化规则（可测试规格）

**入口**：编辑页每个输入框右侧 ✨ 按钮 → `runFieldAIOptimize(fieldKey)`；再次点击同一字段 = 重新生成（prompt 要求换一种写法）。

**① 模式判定（按当前内容长度）**

| 条件 | 模式 | 行为 |
| --- | --- | --- |
| 内容为空 | generate | 按字段建议字数生成精炼内容 |
| 长度 < 40 字 | expand | 扩充：保留全部核心事实，补细节与层次 |
| 40 ~ 220 字 | polish | 润色：凝练、专业、有画面感 |
| 长度 > 220 字 | condense | 精简：只保留核心事实 |

**② 目标字数联动**：输出要求为字段建议字数（`CARD_META.fields[].len`，如 `欲望与恐惧` → 约 20~40 字）；未命中字段用各模式默认（generate 30~80 / expand 80~160 / polish 60~180 / condense 120~220）。

**③ 上下文注入**：`buildFieldContext` 取同卡已填字段——同分组字段全量（单字段 ≤60 字）、其他分组截断（≤20 字）、全卡总限 200 字；prompt 要求"同卡内容仅作逻辑参考，不要复述"。

**④ 并发与安全**
- 多字段同时点击 → **串行队列**（同一时间仅一个请求，其余排队，按钮显示排队态）
- 弹窗关闭/切换 → 进行中请求返回后按**会话令牌**校验，过期结果直接丢弃
- **基线校验**：请求前记录字段原值，返回时若字段已被手动修改 → 不覆盖并提示

**⑤ 返回处理**
- `llm.js` + `cleanLLMText` 双层剥离：`<think>...</think>` 思维链（含未闭合、孤立标签）+ **纯文本推理前导**（开头为 `Thinking Process:` / `思考过程：` / `分析：` 等 → 按正文分界标记或空行截断；剥不动则保留原文），推理过程一律不保存
- `parseFieldResult` 剥离字段名前缀（`字段名：` / `**字段名**：`）、寒暄引导、Markdown 围栏，只保留内容本体
- 空返回 → 提示"AI 返回内容无法解析，请再点一次重新生成"

**⑥ 结果反馈与还原**
- 成功：toast 显示模式与字数变化（`原 N 字 → 新 M 字`）；输入框青色呼吸高亮（进行中）；label 变绿 + ✓ 标记 + 字段旁 `↩` 单字段还原
- 还原：字段旁 ↩ 仅还原该字段；标题栏「还原」一键恢复全部优化过的字段（字段级快照，均恢复到优化前）

---

## 七、Prompt 组装（modules/promptBuilder.js）

输出结构（`buildPrompt(view)`）：

```
━━━━━━━━━━━━━━━━━━━━━━
{opening 页眉：内置默认 或 创作约束预设自定义}
━━━━━━━━━━━━━━━━━━━━━━

【情节梗概】
章节：{chapter} / 标题：{title}（有则输出）
{plotSynopsis 正文}

【世界观参考】
（铁律=必须遵守/常规=可例外/模糊=自由）
▸ {卡名}（{确定性}）
类型：{type}
{coreSetting}
矛盾：{internalConflict}
角色关联：{characterHint}

【角色演绎指引】
（严格=不可偏离/适度=可补细节/参考=灵感起点）
▸ {角色名}（{freedomLevel}）
{basicInfo}
性格：{personalityBehavior}
欲望|恐惧：{desireFear}
秘密：{secret}
关系：{relationships}
弧线：{characterArc}
台词：
  {speechSamples 每行一条}

【场景氛围】
▸ {场景名}
时空：{timeLocation}
感官：{sensoryDetails}
氛围：{atmosphereKeywords}
功能：{sceneFunction}
对角色影响：{characterImpact}
可即兴：{variableElements}

【文风要求】
▸ {文风名}（情境：{applicableScene}）
{styleDescription}
范文：
{referenceText}
避免：
{antiExample}

【创作约束】（有内容才输出）
字数要求：{min}~{max}字
禁忌内容：
{taboos 每行一条}
格式要求：{formatRequirement}

━━━━━━━━━━━━━━━━━━━━━━
{closing 页脚：内置默认 或 自定义}
━━━━━━━━━━━━━━━━━━━━━━
```

**组装规则**
- 只组装**已选中**卡牌；空大类 / 空字段跳过；无内容的【章节】整体不输出
- 页眉/页脚取 `view.opening / view.closing`（来自项目 `globalConstraints`，为空回退内置默认）；「创作约束」无任何输入则不输出该节
- **Token 估算**：`estimateTokens = ⌈去空白字符数 ÷ 1.5⌉`（界面底栏"预估 Token"同口径）
- 四类卡牌按以上固定顺序组装，章节快照即组装结果原文

---

## 八、验收测试要点（供自动化 / 第二 AI 执行）

**卡牌交互**
1. 点击卡牌**上 1/3** → 打开编辑弹窗；**下 2/3** → 选中/取消（发光放大置顶）；两种点击互不误触
2. 滚轮、左右箭头、左右拖动均可循环切换卡牌；切换为**真实移位动画**（同 DOM 过渡），未选中卡不得出现"滚动瞬间提亮再恢复"的闪烁
3. 双主卡并列，左右次级卡透视排布；卡牌区底部操作提示文字完整可见、不被底栏遮挡

**编辑弹窗**
4. 角色编辑显示 7 个内容字段（基础信息/性格与行为/欲望与恐惧/秘密/人物关系/角色弧线/台词样本），**不出现**旧字段（性格内核/行为模式/核心欲望/核心恐惧）
5. 每个输入框 placeholder 与悬浮提示带"建议 X~Y 字"；文字不顶边、长文本输入框足够大；下拉展开不被遮挡
6. 编辑后点保存：素材库源卡 + 项目副本各存一份（新建时）；再次打开可编辑；删除互不影响

**AI 优化**
7. 空字段点击 ✨ → 生成；<40 字 → 扩充；40~220 字 → 润色；>220 字 → 精简（判定见第六节①）
8. 优化中：按钮旋转、输入框青色呼吸高亮；优化后 toast 显示"原 N 字 → 新 M 字"，label 变绿 + ✓ + ↩
9. 输出内容**不含** `<think>`、字段名前缀、Markdown 围栏、寒暄
10. 同时点击多个 ✨ → 按序执行（串行队列）；优化中手动改字段 → 结果不覆盖并提示；字段旁 ↩ 只还原该字段，标题栏「还原」还原全部
11. 配置不合法 / 模型未拉取 → 有明确错误提示（超时 600s、测试连接 90s）

**Prompt 组装**
12. 只组装已选中卡；空字段跳过；输出顺序 = 页眉 → 情节梗概 → 世界观 → 角色 → 场景 → 文风 → 创作约束 → 页脚
13. 创作约束预设中修改「开头引导/结尾引导」→ 保存 → 套用 → 预览中页眉/页脚随之变化；留空用内置默认
14. 底栏"预估 Token"= ⌈去空白字符数÷1.5⌉，与预览文本一致；版本号 vX.Y.Z 显示于底栏

**章节**
15. 「保存章节」在预览弹窗（复制/导出 TXT 之间）；章节列表可双击编辑、拖拽排序
16. 每章「推送生成」后台执行（可切换界面），完成后「查看生成」可见；导出分别输出"提示词 txt"与"AI 文章 txt"

**数据**
17. 数据存 exe 同级 `data/`；导入 JSON 后旧角色字段被直接舍弃；程序退出后无残留进程

---

## 九、FAQ

**Q1：AI 超时或连不上？**
- Ollama：确认 `ollama serve` 运行、端口正确、模型名与 `ollama list` 一致；找不到模型先 `ollama pull 模型名`
- 首次请求需把模型载入显存，几十秒属正常；生成超时已放宽到 600s，测试连接 90s
- OpenAI 兼容：Base URL 以 `/v1` 结尾、Key 正确、模型名受支持

**Q2：数据在哪？换机丢吗？**
exe 同级 `data/`；换机连同 data/ 拷贝，或用导出 JSON 备份。

**Q3：素材库删卡，项目会怎样？**
项目内副本不受影响，可继续编辑、选中、组装 Prompt。

**Q4：版本号在哪看？**
底部状态栏左侧 `vX.Y.Z`（随打包自动更新）。

---

## 九、许可证

MIT License。本工具为创作辅助软件，生成内容的使用责任由使用者自行承担。
