import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
    requestOCR: (data: { filePath: string, description: string, groupName: string, agentId?: string }) => ipcRenderer.invoke('perform-ocr', data),
    getHistory: () => ipcRenderer.invoke('get-history'),
    getGroups: () => ipcRenderer.invoke('get-groups'),
    getAgents: () => ipcRenderer.invoke('get-agents'),
    saveAgent: (data: { name: string, agentId: string }) => ipcRenderer.invoke('save-agent', data)
});
