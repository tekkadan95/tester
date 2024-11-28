const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  transformXRechnung: (filePath) => ipcRenderer.invoke('transform-xrechnung', filePath)
});