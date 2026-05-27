import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
    requestOCR: (data: { filePath: string, description: string, groupName: string }) => ipcRenderer.invoke('perform-ocr', data),
    getHistory: () => ipcRenderer.invoke('get-history'),
    getGroups: () => ipcRenderer.invoke('get-groups')
});
