'use strict';

/**
 * preload.js —— 预加载脚本
 * 通过 contextBridge 向渲染进程暴露安全、精简的 IPC 接口。
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /** 读取 data 目录下的 JSON 文件（文件名白名单：projects.json / config.json） */
  readData: (filename) => ipcRenderer.invoke('read-data', filename),

  /** 保存数据到 data 目录下的 JSON 文件 */
  saveData: (filename, data) => ipcRenderer.invoke('save-data', filename, data),

  /** 弹出保存对话框，将项目数据导出为用户选择的 JSON 文件 */
  exportFile: (data) => ipcRenderer.invoke('export-file', data),

  /** 弹出保存对话框，将文本导出为用户选择的 TXT 文件 */
  exportText: (text, defaultName) => ipcRenderer.invoke('export-text', text, defaultName),

  /** 弹出打开对话框，读取用户选择的 JSON 文件内容 */
  importFile: () => ipcRenderer.invoke('import-file'),

  /** 转发大模型请求（主进程发起，规避 CORS） */
  llmRequest: (config, prompt) => ipcRenderer.invoke('llm-request', config, prompt),

  /** 连接测试（短超时） */
  llmTest: (config) => ipcRenderer.invoke('llm-test', config),

  /** 返回 data 目录的绝对路径 */
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  /** 返回应用版本号（package.json version） */
  getVersion: () => ipcRenderer.invoke('get-version'),

  /** 切换主窗口全屏状态 */
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),

  /** 自定义标题栏窗口控制（无边框窗口） */
  windowControl: {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximizeToggle: () => ipcRenderer.invoke('window-maximize-toggle'),
    close: () => ipcRenderer.invoke('window-close'),
    /** 监听最大化 / 还原状态，用于切换标题栏图标 */
    onMaximized: (callback) => {
      const handler = (_e, val) => callback(Boolean(val));
      ipcRenderer.on('window-maximized', handler);
      return () => ipcRenderer.removeListener('window-maximized', handler);
    }
  }
});
