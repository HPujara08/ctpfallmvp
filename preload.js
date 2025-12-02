const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getClipboard: () => ipcRenderer.invoke('get-clipboard'),
  analyzeTicker: (ticker) => ipcRenderer.invoke('analyze-ticker', ticker),
  toggleWatchMode: () => ipcRenderer.invoke('toggle-watch-mode'),
  getWatchMode: () => ipcRenderer.invoke('get-watch-mode'),
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
  startDrag: () => ipcRenderer.send('start-drag'),
  captureSelectedText: () => ipcRenderer.invoke('capture-selected-text'),
  onTickerCaptured: (callback) => {
    ipcRenderer.on('ticker-captured', (event, ticker) => callback(ticker));
  },
  onWatchModeChanged: (callback) => {
    ipcRenderer.on('watch-mode-changed', (event, enabled) => callback(enabled));
  }
});

