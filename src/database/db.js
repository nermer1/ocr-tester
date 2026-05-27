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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = exports.AgentModel = exports.HistoryModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// 2. Mongoose 스키마 정의
const HistorySchema = new mongoose_1.Schema({
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
    rawResponse: { type: mongoose_1.Schema.Types.Mixed } // 전체 원본 응답 저장
}, {
    timestamps: true, // createdAt, updatedAt 자동 생성
    collection: 'ocr_histories'
});
// 3. 모델 생성
exports.HistoryModel = mongoose_1.default.model('History', HistorySchema);
const AgentSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    agentId: { type: String, required: true }
}, {
    timestamps: true,
    collection: 'ocr_agents'
});
exports.AgentModel = mongoose_1.default.model('Agent', AgentSchema);
// 4. 데이터베이스 매니저 클래스
class DatabaseManager {
    /**
     * MongoDB 연결
     */
    static connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isConnected)
                return;
            const uri = process.env.MONGO_URI || "";
            if (!uri) {
                console.warn("[MongoDB] MONGO_URI가 .env 파일에 설정되지 않았습니다. 연결을 건너뜁니다.");
                return;
            }
            try {
                yield mongoose_1.default.connect(uri);
                this.isConnected = true;
                console.log("[MongoDB] 데이터베이스 연결 성공!");
            }
            catch (error) {
                console.error("[MongoDB] 데이터베이스 연결 실패:", error);
                // 에러를 던지지 않고 경고만 출력하여 앱이 죽지 않도록 함
            }
        });
    }
    /**
     * 새로운 이력 저장
     */
    static saveHistory(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected) {
                console.warn("[MongoDB] DB가 연결되지 않아 이력을 저장할 수 없습니다.");
                return null;
            }
            try {
                const entry = new exports.HistoryModel(data);
                const saved = yield entry.save();
                return saved;
            }
            catch (error) {
                console.error("[MongoDB] 이력 저장 실패:", error);
                return null;
            }
        });
    }
    /**
     * 전체 이력 조회 (최신순이 필요하면 호출부에서 reverse 처리하거나 여기서 sort 가능)
     */
    static getHistory() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected) {
                console.warn("[MongoDB] DB가 연결되지 않아 이력을 불러올 수 없습니다.");
                return [];
            }
            try {
                // DB에 저장된 순서대로 가져옵니다. (필요시 .sort({ createdAt: -1 }) 사용 가능)
                const list = yield exports.HistoryModel.find({}).lean();
                return list;
            }
            catch (error) {
                console.error("[MongoDB] 이력 조회 실패:", error);
                return [];
            }
        });
    }
    /**
     * 고유한 그룹명 목록 조회 (콤보박스용)
     */
    static getGroupNames() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected) {
                return [];
            }
            try {
                const groups = yield exports.HistoryModel.distinct('groupName');
                // 빈 문자열이나 "미지정 그룹" 등을 제외하고 싶다면 여기서 필터링 가능
                return groups.filter(g => g && g.trim() !== '');
            }
            catch (error) {
                console.error("[MongoDB] 그룹명 조회 실패:", error);
                return [];
            }
        });
    }
    /**
     * 에이전트 목록 조회
     */
    static getAgents() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected)
                return [];
            try {
                const agents = yield exports.AgentModel.find({}).sort({ createdAt: 1 }).lean();
                return agents;
            }
            catch (error) {
                console.error("[MongoDB] 에이전트 조회 실패:", error);
                return [];
            }
        });
    }
    /**
     * 에이전트 저장 또는 업데이트
     */
    static saveAgent(name, agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected)
                return null;
            try {
                // 이름 기준으로 찾아서 업데이트하거나 새로 생성(upsert)
                const agent = yield exports.AgentModel.findOneAndUpdate({ name }, { agentId }, { new: true, upsert: true });
                return agent;
            }
            catch (error) {
                console.error("[MongoDB] 에이전트 저장 실패:", error);
                return null;
            }
        });
    }
}
exports.DatabaseManager = DatabaseManager;
DatabaseManager.isConnected = false;
