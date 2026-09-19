'use strict';

/**
 * main.js —— Electron 主进程
 * 职责：创建窗口、注册 IPC 通道、转发大模型请求、管理 data 目录。
 */

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// 启动加速：关闭 Windows 原生窗口遮挡检测（避免后台轮询，减少启动与运行开销）
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const storage = require('./modules/storage');
const llm = require('./modules/llm');

const SMOKE_TEST = process.argv.includes('--smoke-test');

// 冒烟测试早期标记：确认 main.js 至少加载了
if (SMOKE_TEST) {
  try { fs.writeFileSync(path.join(require('os').tmpdir(), 'smoke.log'), '[LOAD] main.js loaded at ' + new Date().toISOString() + '\n'); } catch (_) {}
}

/**
 * 解析应用根目录（data 文件夹始终位于根目录/data 下）：
 * 1. electron-builder 的 portable 目标会设置 PORTABLE_EXECUTABLE_DIR
 *    环境变量，指向用户实际双击运行的 exe 所在目录 —— 这是 portable
 *    免安装版“数据放在 exe 同级”的正确做法（portable 运行时
 *    process.execPath 指向临时解压目录，不能直接用）；
 * 2. 普通打包版使用 path.dirname(process.execPath)；
 * 3. 开发模式（npm start）使用项目根目录。
 */
function resolveRootDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (app.isPackaged) return path.dirname(process.execPath);
  return __dirname;
}

storage.init(resolveRootDir());
const DATA_DIR = storage.getDataDir();

let mainWindow = null;

// 单实例锁：避免重复启动产生两份数据
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (SMOKE_TEST) {
      try { fs.writeFileSync(path.join(app.getPath('temp'), 'smoke.log'), '[BOOT] app ready at ' + new Date().toISOString() + '\n'); } catch (_) {}
    }
    // 启动即去掉原生菜单（必须在 app ready 之后调用）
    Menu.setApplicationMenu(null);
    registerIpc();
    createWindow();

    // macOS 兼容：点击 Dock 图标时若无窗口则重建
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // 窗口全部关闭：Windows 下正常退出；macOS 保留应用
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // 干净退出：主进程退出前强制结束所有子进程（renderer/GPU/utility），避免残留
  let forceQuitTimer = null;
  app.on('before-quit', (e) => {
    if (!forceQuitTimer) {
      e.preventDefault();
      forceQuitTimer = setTimeout(() => app.exit(0), 250);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '龙猫小说提示词管理器',
    show: false,
    backgroundColor: '#0F1117',
    frame: false,          // 无边框：由渲染进程自绘标题栏（最小化 / 最大化 / 关闭）
    fullscreen: false,     // 不默认全屏；用户可手动按 F11
    fullscreenable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false // 关闭拼写检查，省去词典加载开销
    }
  });

  // 最大化 / 还原状态变化时通知渲染进程，用于切换标题栏图标
  const pushMaxState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximized', mainWindow.isMaximized());
    }
  };
  mainWindow.on('maximize', pushMaxState);
  mainWindow.on('unmaximize', pushMaxState);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (!SMOKE_TEST) mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 禁止应用内打开任何新窗口（外部链接一律拒绝）
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // F11 切换全屏（Esc 在 Electron 中默认也会退出全屏）
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  // 冒烟测试模式：加载完成后校验渲染进程关键对象，随后自动退出（不显示窗口）
  if (SMOKE_TEST) {
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        const result = await mainWindow.webContents.executeJavaScript(
          `(async () => {
            const deadline = Date.now() + 4000;
            while (Date.now() < deadline) {
              const ok = document.querySelectorAll('.rail-icon').length === 4 &&
                         document.querySelectorAll('#synopsis-text').length === 1 &&
                         document.querySelectorAll('#card-deck').length === 1 &&
                         document.querySelectorAll('.pcard').length > 0;
              if (ok) break;
              await new Promise(r => setTimeout(r, 80));
            }
            const pcards = document.querySelectorAll('.pcard');
            return JSON.stringify({
              title: document.title,
              hasApi: typeof window.api === 'object',
              hasPromptBuilder: typeof window.PromptBuilder === 'object',
              railCategoriesRendered: document.querySelectorAll('.rail-icon').length === 4,
              synopsisEntryRendered: !!document.getElementById('btn-synopsis'),
              cardDeckRendered: !!document.getElementById('card-deck'),
              pcardCount: pcards.length,
              firstPcardHasOffset: pcards.length > 0 &&
                (pcards[0].getAttribute('style') || '').includes('--offsetX'),
              deckNavPresent: !!document.getElementById('btn-deck-prev') &&
                              !!document.getElementById('btn-deck-next'),
              synopsisViewRendered: !!document.getElementById('synopsis-view'),
              catTitleRendered: !!document.getElementById('cat-title') &&
                document.getElementById('cat-title').textContent.length > 0,
              bottomBarRendered: !!document.getElementById('selected-count'),
              titlebarControlsRendered: !!document.getElementById('win-min') &&
                !!document.getElementById('win-max') &&
                !!document.getElementById('win-close')
            });
          })()`
        );
        // 同时写日志和文件（Windows 主进程的 console.log 不一定能进 stdout）
        const log = (m) => { console.log(m); try { fs.appendFileSync(path.join(app.getPath('temp'), 'smoke.log'), m + '\n'); } catch (_) {} };
        log('[SMOKE] renderer = ' + result);
        log('[SMOKE] renderer ready at ' + new Date().toISOString());
        const parsed = JSON.parse(result);
        if (parsed.hasApi && parsed.hasPromptBuilder && parsed.railCategoriesRendered && parsed.synopsisEntryRendered && parsed.cardDeckRendered && parsed.pcardCount > 0 && parsed.firstPcardHasOffset && parsed.deckNavPresent && parsed.synopsisViewRendered && parsed.catTitleRendered && parsed.bottomBarRendered && parsed.titlebarControlsRendered) {
          log('[SMOKE] OK');
        } else {
          log('[SMOKE] FAIL');
          process.exitCode = 2;
        }
      } catch (err) {
        console.error('[SMOKE] ERROR', err);
        process.exitCode = 2;
      } finally {
        setTimeout(() => app.exit(process.exitCode || 0), 500);
      }
    });
  }
}

// 只允许读写固定的数据文件名，防止路径穿越
const ALLOWED_FILES = new Set(['projects.json', 'config.json']);

function dataFilePath(filename) {
  if (!ALLOWED_FILES.has(filename)) {
    throw new Error('非法的数据文件名: ' + filename);
  }
  return path.join(DATA_DIR, filename);
}

function registerIpc() {
  ipcMain.handle('read-data', (_event, filename) => storage.readJSON(dataFilePath(filename)));

  ipcMain.handle('save-data', (_event, filename, data) => {
    storage.writeJSON(dataFilePath(filename), data);
    return true;
  });

  ipcMain.handle('get-app-path', () => DATA_DIR);
  ipcMain.handle('get-version', () => app.getVersion());

  ipcMain.handle('export-file', async (_event, data) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出 JSON',
      defaultPath: path.join(app.getPath('documents'), 'projects.json'),
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  });

  ipcMain.handle('export-text', async (_event, text, defaultName) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出 TXT',
      defaultPath: path.join(app.getPath('documents'), defaultName || 'prompt.txt'),
      filters: [{ name: '文本文件', extensions: ['txt'] }]
    });
    if (canceled || !filePath) return null;
    // UTF-8 BOM：确保旧版记事本 / Excel 打开导出的 TXT 不乱码
    fs.writeFileSync(filePath, '\ufeff' + String(text), 'utf-8');
    return filePath;
  });

  ipcMain.handle('import-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '导入 JSON',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths.length) return null;
    try {
      return JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));
    } catch (err) {
      throw new Error('JSON 解析失败: ' + err.message);
    }
  });

  // 大模型请求统一由主进程转发，避免渲染进程跨域（CORS）问题
  ipcMain.handle('llm-request', (_event, config, prompt) => llm.requestLLM(config, prompt));

  // 连接测试：90 秒短超时（覆盖 Ollama 冷启动）
  ipcMain.handle('llm-test', (_event, config) => llm.testConnection(config));

  // 全屏切换
  ipcMain.handle('toggle-fullscreen', () => {
    if (!mainWindow) return false;
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return mainWindow.isFullScreen();
  });

  // 自定义标题栏：窗口控制（无边框窗口）
  ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
    return true;
  });
  ipcMain.handle('window-maximize-toggle', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
    return true;
  });

  // 用系统默认浏览器打开外部链接（仅允许 http/https）
  ipcMain.handle('open-external', async (_event, url) => {
    try {
      const u = new URL(String(url));
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      await shell.openExternal(u.href);
      return true;
    } catch (_e) {
      return false;
    }
  });
}
