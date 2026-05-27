import * as fs from 'fs';
import FormData from 'form-data';

// node-fetch v3 ESM dynamic import workaround for CommonJS
const fetch = (...args: any[]) => (new Function('return import("node-fetch")')() as Promise<any>).then(({ default: fetch }) => fetch(...(args as [any, any])));

export class UpstageApiService {
    /**
     * V1 API (Document Digitization) 호출
     * 에이전트 ID가 없을 때 폼데이터 기반으로 빠르고 단순하게 호출합니다.
     */
    static async callV1(filePath: string, apiKey: string, endpoint: string) {
        const v1Url = endpoint;
        console.log(`[Upstage OCR] V1 API request - url: ${v1Url}, file: ${filePath}`);

        const formData = new FormData();
        formData.append("document", fs.createReadStream(filePath));
        formData.append("model", "ocr");

        const res = await fetch(v1Url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                ...formData.getHeaders()
            },
            body: formData as any
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Upstage V1 OCR 호출 실패: ${errText}`);
        }

        const rawResponse = await res.json();
        console.log(`[Upstage OCR] V1 API 완료`);
        
        return {
            rawResponse,
            parsedData: rawResponse // V1은 보통 그대로 결과로 사용합니다.
        };
    }

    /**
     * V2 API (Agent Responses) 호출
     * 에이전트 ID가 있을 때 파일업로드 -> Job 생성 -> 폴링의 과정을 거칩니다.
     */
    static async callV2(filePath: string, agentId: string, apiKey: string, endpoint: string) {
        // --- 1단계: 파일 업로드 API 호출 ---
        const fileUploadUrl = `${endpoint}/files`;
        console.log(`[Upstage OCR] uploadFile START - url: ${fileUploadUrl}, file: ${filePath}`);

        const uploadFormData = new FormData();
        uploadFormData.append("file", fs.createReadStream(filePath));
        uploadFormData.append("purpose", "user_data");

        const uploadRes = await fetch(fileUploadUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                ...uploadFormData.getHeaders()
            },
            body: uploadFormData as any
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`Upstage 파일 업로드 실패: ${errText}`);
        }

        const uploadData: any = await uploadRes.json();
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

        const agentRes = await fetch(agentUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        if (!agentRes.ok) {
            const errText = await agentRes.text();
            throw new Error(`Upstage Job 생성 실패: ${errText}`);
        }

        const agentData: any = await agentRes.json();
        const jobId = agentData.id;
        console.log(`[Upstage OCR] createJob END - jobId: ${jobId}`);

        // --- 3단계: Job 폴링 ---
        let jobResult: any = null;
        const maxAttempts = 30;

        for (let i = 0; i < maxAttempts; i++) {
            const pollUrl = `${endpoint}/responses/${jobId}?include[]=last`;
            console.log(`[Upstage OCR] pollJob attempt ${i + 1}/${maxAttempts} - GET ${pollUrl}`);

            const pollRes = await fetch(pollUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`
                }
            });

            if (!pollRes.ok) {
                const errText = await pollRes.text();
                throw new Error(`Upstage Job 폴링 통신 실패: ${errText}`);
            }

            const pollData: any = await pollRes.json();
            const status = pollData.status;
            console.log(`[Upstage OCR] pollJob attempt ${i + 1}/${maxAttempts} - status: ${status}`);

            if (status === "completed") {
                jobResult = pollData;
                break;
            } else if (status === "failed") {
                throw new Error(`Upstage Job 처리 실패: ${JSON.stringify(pollData)}`);
            }

            // 2초 대기
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!jobResult) {
            throw new Error("Upstage Job 폴링 타임아웃 (60초 초과)");
        }

        // --- 4단계: 결과 파싱 ---
        let parsedData: any = null;
        const output = jobResult.output;
        if (output && output.length > 0) {
            const lastOutput = output[0];
            const content = lastOutput.content;
            if (content && content.length > 0) {
                const text = content[0].text;
                if (text) {
                    try {
                        parsedData = JSON.parse(text);
                    } catch (e) {
                        parsedData = text; // 파싱 안되면 쌩 텍스트라도 유지
                    }
                }
            }
        }

        return {
            rawResponse: jobResult,
            parsedData
        };
    }
}
