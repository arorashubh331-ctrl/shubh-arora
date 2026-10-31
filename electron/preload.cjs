const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  executeDesktopAction: (action, args) => ipcRenderer.invoke('execute-desktop-action', { action, args }),
  onWakeShortcut: (callback) => {
    ipcRenderer.on('wake-shortcut-triggered', () => callback());
  },
});
