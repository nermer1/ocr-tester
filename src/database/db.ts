import mongoose, { Schema, Document } from 'mongoose';

// 1. 모델 인터페이스 정의
export interface IAgent extends Document {
    name: string;
    agentId: string;
}


// 1. 모델 인터페이스 정의
export interface IHistory extends Document {
    groupName: string;
    description: string;
    requestTime: string;
    responseTime: string;
    durationSec: string;
    filePath: string;
    fileName: string;
    fileSize: string;
    status: string;
    apiType: string;
    error?: string;
    rawResponse?: any;
}

// 2. Mongoose 스키마 정의
const HistorySchema: Schema = new Schema({
    groupName: { type: String, default: "미지정 그룹" },
    description: { type: String, required: true },
    requestTime: { type: String, required: true },
    responseTime: { type: String, required: true },
    durationSec: { type: String, required: true },
    filePath: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: String, required: true },
    status: { type: String, required: true }, // SUCCESS or FAILED
    apiType: { type: String, default: 'V2' }, // V1 or V2
    error: { type: String },
    rawResponse: { type: Schema.Types.Mixed } // 전체 원본 응답 저장
}, {
    timestamps: true, // createdAt, updatedAt 자동 생성
    collection: 'ocr_histories'
});

// 3. 모델 생성
export const HistoryModel = mongoose.model<IHistory>('History', HistorySchema);

const AgentSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true },
    agentId: { type: String, required: true }
}, {
    timestamps: true,
    collection: 'ocr_agents'
});

export const AgentModel = mongoose.model<IAgent>('Agent', AgentSchema);

// 4. 데이터베이스 매니저 클래스
export class DatabaseManager {
    private static isConnected: boolean = false;

    /**
     * MongoDB 연결
     */
    public static async connect(): Promise<void> {
        if (this.isConnected) return;

        const uri = process.env.MONGO_URI || "";
        if (!uri) {
            console.warn("[MongoDB] MONGO_URI가 .env 파일에 설정되지 않았습니다. 연결을 건너뜁니다.");
            return;
        }

        try {
            await mongoose.connect(uri);
            this.isConnected = true;
            console.log("[MongoDB] 데이터베이스 연결 성공!");
        } catch (error) {
            console.error("[MongoDB] 데이터베이스 연결 실패:", error);
            // 에러를 던지지 않고 경고만 출력하여 앱이 죽지 않도록 함
        }
    }

    /**
     * 새로운 이력 저장
     */
    public static async saveHistory(data: Partial<IHistory>): Promise<IHistory | null> {
        if (!this.isConnected) {
            console.warn("[MongoDB] DB가 연결되지 않아 이력을 저장할 수 없습니다.");
            return null;
        }

        try {
            const entry = new HistoryModel(data);
            const saved = await entry.save();
            return saved;
        } catch (error) {
            console.error("[MongoDB] 이력 저장 실패:", error);
            return null;
        }
    }

    /**
     * 전체 이력 조회 (최신순이 필요하면 호출부에서 reverse 처리하거나 여기서 sort 가능)
     */
    public static async getHistory(): Promise<IHistory[]> {
        if (!this.isConnected) {
            console.warn("[MongoDB] DB가 연결되지 않아 이력을 불러올 수 없습니다.");
            return [];
        }

        try {
            // DB에 저장된 순서대로 가져옵니다. (필요시 .sort({ createdAt: -1 }) 사용 가능)
            const list = await HistoryModel.find({}).lean();
            return list as any[];
        } catch (error) {
            console.error("[MongoDB] 이력 조회 실패:", error);
            return [];
        }
    }

    /**
     * 고유한 그룹명 목록 조회 (콤보박스용)
     */
    public static async getGroupNames(): Promise<string[]> {
        if (!this.isConnected) {
            return [];
        }

        try {
            const groups = await HistoryModel.distinct('groupName');
            // 빈 문자열이나 "미지정 그룹" 등을 제외하고 싶다면 여기서 필터링 가능
            return groups.filter(g => g && g.trim() !== '');
        } catch (error) {
            console.error("[MongoDB] 그룹명 조회 실패:", error);
            return [];
        }
    }
    /**
     * 에이전트 목록 조회
     */
    public static async getAgents(): Promise<IAgent[]> {
        if (!this.isConnected) return [];
        try {
            const agents = await AgentModel.find({}).sort({ createdAt: 1 }).lean();
            return agents as any[];
        } catch (error) {
            console.error("[MongoDB] 에이전트 조회 실패:", error);
            return [];
        }
    }

    /**
     * 에이전트 저장 또는 업데이트
     */
    public static async saveAgent(name: string, agentId: string): Promise<IAgent | null> {
        if (!this.isConnected) return null;
        try {
            // 이름 기준으로 찾아서 업데이트하거나 새로 생성(upsert)
            const agent = await AgentModel.findOneAndUpdate(
                { name },
                { agentId },
                { new: true, upsert: true }
            );
            return agent;
        } catch (error) {
            console.error("[MongoDB] 에이전트 저장 실패:", error);
            return null;
        }
    }
    
    /**
     * 특정 그룹의 모든 이력을 삭제
     */
    public static async deleteHistoryByGroup(groupName: string): Promise<boolean> {
        if (!this.isConnected) return false;
        try {
            await HistoryModel.deleteMany({ groupName });
            return true;
        } catch (error) {
            console.error("[MongoDB] 이력 삭제 실패:", error);
            return false;
        }
    }
}
