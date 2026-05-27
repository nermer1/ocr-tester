"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpstageApiService = void 0;
const fs = __importStar(require("fs"));
const form_data_1 = __importDefault(require("form-data"));
// node-fetch v3 ESM dynamic import workaround for CommonJS
const fetch = (...args) => new Function('return import("node-fetch")')().then(({ default: fetch }) => fetch(...args));
class UpstageApiService {
    /**
     * V1 API (Document Digitization) 호출
     * 에이전트 ID가 없을 때 폼데이터 기반으로 빠르고 단순하게 호출합니다.
     */
    static callV1(filePath, apiKey, endpoint) {
        return __awaiter(this, void 0, void 0, function* () {
            const v1Url = endpoint;
            console.log(`[Upstage OCR] V1 API request - url: ${v1Url}, file: ${filePath}`);
            const formData = new form_data_1.default();
            formData.append("document", fs.createReadStream(filePath));
            formData.append("model", "ocr");
            const res = yield fetch(v1Url, {
                method: "POST",
                headers: Object.assign({ Authorization: `Bearer ${apiKey}` }, formData.getHeaders()),
                body: formData
            });
            if (!res.ok) {
                const errText = yield res.text();
                throw new Error(`Upstage V1 OCR 호출 실패: ${errText}`);
            }
            const rawResponse = yield res.json();
            console.log(`[Upstage OCR] V1 API 완료`);
            return {
                rawResponse,
                parsedData: rawResponse // V1은 보통 그대로 결과로 사용합니다.
            };
        });
    }
    /**
     * V2 API (Agent Responses) 호출
     * 에이전트 ID가 있을 때 파일업로드 -> Job 생성 -> 폴링의 과정을 거칩니다.
     */
    static callV2(filePath, agentId, apiKey, endpoint) {
        return __awaiter(this, void 0, void 0, function* () {
            // --- 1단계: 파일 업로드 API 호출 ---
            const fileUploadUrl = `${endpoint}/files`;
            console.log(`[Upstage OCR] uploadFile START - url: ${fileUploadUrl}, file: ${filePath}`);
            const uploadFormData = new form_data_1.default();
            uploadFormData.append("file", fs.createReadStream(filePath));
            uploadFormData.append("purpose", "user_data");
            const uploadRes = yield fetch(fileUploadUrl, {
                method: "POST",
                headers: Object.assign({ Authorization: `Bearer ${apiKey}` }, uploadFormData.getHeaders()),
                body: uploadFormData
            });
            if (!uploadRes.ok) {
                const errText = yield uploadRes.text();
                throw new Error(`Upstage 파일 업로드 실패: ${errText}`);
            }
            const uploadData = yield uploadRes.json();
            const fileId = uploadData.id;
            console.log(`[Upstage OCR] uploadFile END - fileId: ${fileId}`);
            // --- 2단계: Job 생성 (/responses) ---
            const agentUrl = `${endpoint}/responses`;
            console.log(`[Upstage OCR] createJob request - url: ${agentUrl}, agentId(Dynamic): ${agentId}`);
            const requestBody = {
                model: agentId,
                include: ["last"],
                input: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "input_file",
                                file_id: fileId
                            }
                        ]
                    }
                ]
            };
            const agentRes = yield fetch(agentUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });
            if (!agentRes.ok) {
                const errText = yield agentRes.text();
                throw new Error(`Upstage Job 생성 실패: ${errText}`);
            }
            const agentData = yield agentRes.json();
            const jobId = agentData.id;
            console.log(`[Upstage OCR] createJob END - jobId: ${jobId}`);
            // --- 3단계: Job 폴링 ---
            let jobResult = null;
            const maxAttempts = 30;
            for (let i = 0; i < maxAttempts; i++) {
                const pollUrl = `${endpoint}/responses/${jobId}?include[]=last`;
                console.log(`[Upstage OCR] pollJob attempt ${i + 1}/${maxAttempts} - GET ${pollUrl}`);
                const pollRes = yield fetch(pollUrl, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`
                    }
                });
                if (!pollRes.ok) {
                    const errText = yield pollRes.text();
                    throw new Error(`Upstage Job 폴링 통신 실패: ${errText}`);
                }
                const pollData = yield pollRes.json();
                const status = pollData.status;
                console.log(`[Upstage OCR] pollJob attempt ${i + 1}/${maxAttempts} - status: ${status}`);
                if (status === "completed") {
                    jobResult = pollData;
                    break;
                }
                else if (status === "failed") {
                    throw new Error(`Upstage Job 처리 실패: ${JSON.stringify(pollData)}`);
                }
                // 2초 대기
                yield new Promise(resolve => setTimeout(resolve, 2000));
            }
            if (!jobResult) {
                throw new Error("Upstage Job 폴링 타임아웃 (60초 초과)");
            }
            // --- 4단계: 결과 파싱 ---
            let parsedData = null;
            const output = jobResult.output;
            if (output && output.length > 0) {
                const lastOutput = output[0];
                const content = lastOutput.content;
                if (content && content.length > 0) {
                    const text = content[0].text;
                    if (text) {
                        try {
                            parsedData = JSON.parse(text);
                        }
                        catch (e) {
                            parsedData = text; // 파싱 안되면 쌩 텍스트라도 유지
                        }
                    }
                }
            }
            return {
                rawResponse: jobResult,
                parsedData
            };
        });
    }
}
exports.UpstageApiService = UpstageApiService;
