const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popupAPI', {
  onPopupData: (callback) => {
    ipcRenderer.on('popup-data', (event, data) => callback(data));
  },
  closePopup: () => {
    ipcRenderer.send('close-popup');
  },
  startDrag: () => {
    ipcRenderer.send('start-drag');
  }
});

