import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import FormData from 'form-data';
import * as dotenvx from '@dotenvx/dotenvx';
import { DatabaseManager } from './src/database/db';
import { UpstageApiService } from './src/api/upstage';

// .env 파일의 환경변수들을 process.env로 확실하게 불러옵니다. (dotenvx를 사용하여 암호화된 env 지원)
dotenvx.config({ path: path.join(__dirname, '.env') });
console.log("[DEBUG] Loaded API_KEY:", process.env.UPSTAGE_API_KEY ? "EXISTS" : "MISSING");
console.log("[DEBUG] Loaded ENDPOINT:", process.env.OCR_API_ENDPOINT);

// 노드 버전에 따라 import 방식이 다를 수 있는데, node-fetch v3는 ES Module 전용이므로 동적 import를 유지합니다.
// TypeScript가 강제로 require()로 변환하는 것을 막기 위해 우회 코드를 사용합니다.
const fetch = (...args: any[]) => (new Function('return import("node-fetch")')() as Promise<any>).then(({ default: fetch }) => fetch(...(args as [any, any])));

const API_KEY: string = process.env.UPSTAGE_API_KEY || "";
const API_V1_ENDPOINT: string = process.env.OCR_API_V1_ENDPOINT || "https://api.upstage.ai/v1/document-digitization";
const API_V2_ENDPOINT: string = process.env.OCR_API_V2_ENDPOINT || "https://api.upstage.ai/v2";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
    // 배포판이 아닐 때(개발 환경일 때)만 개발자 도구(F12)를 엽니다.
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // 다른 인스턴스가 실행되려고 할 때 기존 창을 포커스합니다.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        await DatabaseManager.connect();
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
}

// IPC 핸들러 등록: 렌더러 프로세스(화면)에서 요청하면 이 함수가 실행됩니다.
ipcMain.handle('perform-ocr', async (event, { filePath, description, groupName, agentId }) => {
    const startTimeMs = Date.now();
    const requestTime = new Date(startTimeMs).toLocaleString();

    try {
        let ocrResult: { rawResponse: any, parsedData: any };
        let apiType = 'V1';

        if (!agentId || agentId.trim() === '') {
            ocrResult = await UpstageApiService.callV1(filePath, API_KEY, API_V1_ENDPOINT);
            apiType = 'V1';
        } else {
            ocrResult = await UpstageApiService.callV2(filePath, agentId.trim(), API_KEY, API_V2_ENDPOINT);
            apiType = 'V2';
        }

        const jobResult = ocrResult.rawResponse;
        const parsed = ocrResult.parsedData;

        // --- 5단계: 이력 저장 ---
        const endTimeMs = Date.now();
        const responseTime = new Date(endTimeMs).toLocaleString();
        const durationSec = ((endTimeMs - startTimeMs) / 1000).toFixed(2);
        
        let fileName = path.basename(filePath);
        let fileSizeBytes = 0;
        try {
            const stats = fs.statSync(filePath);
            fileSizeBytes = stats.size;
        } catch (e) {}
        const fileSizeKb = (fileSizeBytes / 1024).toFixed(1) + " KB";

        const historyEntry = {
            groupName: groupName || "미지정 그룹",
            description,
            requestTime,
            responseTime,
            durationSec: `${durationSec}초`,
            filePath,
            fileName,
            fileSize: fileSizeKb,
            status: "SUCCESS",
            apiType,
            rawResponse: jobResult
        };

        await DatabaseManager.saveHistory(historyEntry);

        // 화면(renderer)으로 파싱된 데이터와 원본 API 응답(raw)을 통째로 전달
        return {
            parsedData: parsed,
            rawResponse: jobResult
        };

    } catch (error: any) {
        // 실패한 이력도 저장
        const endTimeMs = Date.now();
        const responseTime = new Date(endTimeMs).toLocaleString();
        const durationSec = ((endTimeMs - startTimeMs) / 1000).toFixed(2);
        
        let fileName = path.basename(filePath);
        let fileSizeBytes = 0;
        try {
            const stats = fs.statSync(filePath);
            fileSizeBytes = stats.size;
        } catch (e) {}
        const fileSizeKb = (fileSizeBytes / 1024).toFixed(1) + " KB";

        const historyEntry = {
            groupName: groupName || "미지정 그룹",
            description,
            requestTime,
            responseTime,
            durationSec: `${durationSec}초`,
            filePath,
            fileName,
            fileSize: fileSizeKb,
            status: "FAILED",
            apiType: (!agentId || agentId.trim() === '') ? 'V1' : 'V2',
            error: error.message
        };

        await DatabaseManager.saveHistory(historyEntry);

        console.error("OCR 통신 에러:", error);
        throw error;
    }
});

// ★ 이력 불러오기 핸들러 (Mongoose 사용)
ipcMain.handle('get-history', async () => {
    return await DatabaseManager.getHistory();
});

// ★ 고유한 그룹명 목록 불러오기 핸들러
ipcMain.handle('get-groups', async () => {
    return await DatabaseManager.getGroupNames();
});

// ★ 에이전트 불러오기 및 저장 핸들러
ipcMain.handle('get-agents', async () => {
    return await DatabaseManager.getAgents();
});

ipcMain.handle('save-agent', async (event, { name, agentId }) => {
    return await DatabaseManager.saveAgent(name, agentId);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});