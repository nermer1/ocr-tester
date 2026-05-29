import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import GraphDialog from './GraphDialog';

declare global {
    interface Window {
        api: {
            requestOCR: (data: { filePath: string, description: string, groupName: string, agentId?: string }) => Promise<any>;
            getHistory: () => Promise<any[]>;
            getGroups: () => Promise<string[]>;
            getAgents: () => Promise<any[]>;
            saveAgent: (data: { name: string, agentId: string }) => Promise<any>;
            deleteGroupHistory: (groupName: string) => Promise<boolean>;
        };
    }
}

type MenuType = 'NEW_TEST' | 'HISTORY';

const App: React.FC = () => {
    const [currentMenu, setCurrentMenu] = useState<MenuType>('NEW_TEST');
    const [result, setResult] = useState<string>('');
    const [groupName, setGroupName] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [agentId, setAgentId] = useState<string>('');
    const [history, setHistory] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [elapsedTime, setElapsedTime] = useState<number>(0);
    const [totalDelay, setTotalDelay] = useState<number>(0);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [isGraphDialogOpen, setIsGraphDialogOpen] = useState<boolean>(false);
    const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<string | null>(null);
    const [rawDialogData, setRawDialogData] = useState<any | null>(null);
    const [groupList, setGroupList] = useState<string[]>([]);
    const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState<boolean>(false);

    // Agent 관련 상태
    const [agentsList, setAgentsList] = useState<any[]>([]);
    const [isAddingNewAgent, setIsAddingNewAgent] = useState<boolean>(false);
    const [newAgentName, setNewAgentName] = useState<string>('');

    // Drag & Drop 관련 상태
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadHistory = async () => {
        try {
            const data = await window.api.getHistory();
            setHistory(data.reverse());
        } catch (err) {
            console.error("이력 불러오기 실패", err);
        }
    };

    // 메뉴가 HISTORY로 변경될 때마다 이력을 새로고침
    useEffect(() => {
        if (currentMenu === 'HISTORY') {
            loadHistory();
        } else if (currentMenu === 'NEW_TEST') {
            // NEW_TEST 메뉴일 때 그룹명 리스트 및 에이전트 목록 로드
            window.api.getGroups().then(groups => setGroupList(groups)).catch(console.error);
            window.api.getAgents().then(agents => setAgentsList(agents)).catch(console.error);
        }
    }, [currentMenu]);

    // 실시간 타이머
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isProcessing) {
            setElapsedTime(0);
            timer = setInterval(() => {
                setElapsedTime(prev => prev + 0.1);
            }, 100);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isProcessing]);

    const handleOcrClick = async () => {
        const files = selectedFiles;

        if (files.length === 0) {
            setResult("❌ 파일을 놓고 오셨네요. 이미지를 선택해주세요.");
            return;
        }

        if (!description.trim()) {
            setResult("❌ 요청 항목에 대한 설명을 입력해주세요!");
            return;
        }

        setResult(`🚀 총 ${files.length}개의 파일 분석을 시작합니다...\n\n`);
        setIsProcessing(true);
        setElapsedTime(0);
        setTotalDelay(0);

        let logs = `🚀 총 ${files.length}개의 파일 분석을 시작합니다...\n\n`;
        const isUpstageV1 = agentId === '' || agentId === 'UPSTAGE_V1';
        // Upstage V1 API의 경우 Rate Limit (too_many_requests)을 피하기 위해 1개씩 순차 처리
        const chunkSize = isUpstageV1 ? 1 : 5;
        // V1의 경우 요청 간격이 너무 짧아도 제한에 걸리므로 대기 (현재 테스트를 위해 1000ms로 설정)
        const delayBetweenChunks = isUpstageV1 ? 1000 : 0; 
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        let successCount = 0;
        let failCount = 0;

        try {
            for (let i = 0; i < files.length; i += chunkSize) {
                const chunk = files.slice(i, i + chunkSize);

                // 현재 청크 진행 상황 로깅
                const chunkLogs = chunk.map(f => `⏳ [대기 중] ${f.name}`).join('\n');
                setResult(logs + `\n▶️ ${i + 1} ~ ${Math.min(i + chunkSize, files.length)}번째 파일 처리 중...\n` + chunkLogs);

                // Promise.allSettled를 이용해 청크 단위 병렬 처리
                const chunkPromises = chunk.map(async (file) => {
                    const filePath = (file as any).path;
                    const startTime = Date.now();
                    try {
                        const response = await window.api.requestOCR({ filePath, description, groupName, agentId });
                        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                        successCount++;
                        return `✅ [성공] ${file.name} - ${duration}초 소요`;
                    } catch (error: any) {
                        failCount++;
                        return `❌ [실패] ${file.name} - 에러: ${error.message}`;
                    }
                });

                const chunkResults = await Promise.all(chunkPromises);

                logs += chunkResults.join('\n') + '\n';
                setResult(logs);

                // 다음 청크가 남아있고 딜레이가 설정되어 있다면 대기
                if (delayBetweenChunks > 0 && i + chunkSize < files.length) {
                    setResult(logs + `\n⏳ API 과부하 방지를 위해 ${delayBetweenChunks / 1000}초 대기 중...\n`);
                    setTotalDelay(prev => prev + (delayBetweenChunks / 1000));
                    await delay(delayBetweenChunks);
                }
            }

            logs += `\n🎉 모든 분석이 완료되었습니다!\n✅ 성공: ${successCount}건, ❌ 실패: ${failCount}건`;
            setResult(logs);
        } catch (error: any) {
            setResult(logs + "\n\n치명적인 에러 발생 ㅠㅠ\n" + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
            <style>
                {`
                body, html {
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
                @keyframes progress-stripes {
                    0% { background-position: 0 0; }
                    100% { background-position: 40px 0; }
                }
                `}
            </style>
            {/* 왼쪽: 메뉴 트리 (사이드바) */}
            <div style={{ width: '250px', backgroundColor: '#2c3e50', color: '#ecf0f1', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', fontSize: '1.2em', fontWeight: 'bold', borderBottom: '1px solid #34495e' }}>
                    OCR Tester
                </div>
                <div
                    onClick={() => setCurrentMenu('NEW_TEST')}
                    style={{
                        padding: '15px 20px',
                        cursor: 'pointer',
                        backgroundColor: currentMenu === 'NEW_TEST' ? '#34495e' : 'transparent',
                        borderLeft: currentMenu === 'NEW_TEST' ? '4px solid #3498db' : '4px solid transparent'
                    }}
                >
                    호출 테스트
                </div>
                <div
                    onClick={() => setCurrentMenu('HISTORY')}
                    style={{
                        padding: '15px 20px',
                        cursor: 'pointer',
                        backgroundColor: currentMenu === 'HISTORY' ? '#34495e' : 'transparent',
                        borderLeft: currentMenu === 'HISTORY' ? '4px solid #3498db' : '4px solid transparent'
                    }}
                >
                    이전 호출 리스트
                </div>
            </div>

            {/* 오른쪽: 메인 콘텐츠 영역 */}
            <div style={{ flex: 1, padding: '30px', backgroundColor: '#fdfdfd', overflowY: 'auto' }}>
                {currentMenu === 'NEW_TEST' && (
                    <div>
                        <h2>호출 테스트 (새 분석)</h2>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>테스트 그룹명:</label>
                            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    onFocus={() => setIsGroupDropdownOpen(true)}
                                    onBlur={() => setTimeout(() => setIsGroupDropdownOpen(false), 200)}
                                    placeholder="선택하거나 직접 입력하세요 (예: 영수증 1차)"
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                                    disabled={isProcessing}
                                />
                                {/* 화살표 아이콘 (시각적 효과) */}
                                <div
                                    style={{ position: 'absolute', right: '10px', top: '10px', cursor: 'pointer', color: '#7f8c8d' }}
                                    onClick={() => { if (!isProcessing) setIsGroupDropdownOpen(!isGroupDropdownOpen); }}
                                >
                                    ▼
                                </div>

                                {/* 커스텀 드롭다운 */}
                                {isGroupDropdownOpen && groupList.length > 0 && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0,
                                        backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px',
                                        marginTop: '4px', maxHeight: '150px', overflowY: 'auto',
                                        zIndex: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                    }}>
                                        {groupList.map((g, idx) => (
                                            <div
                                                key={idx}
                                                onMouseDown={(e) => {
                                                    e.preventDefault(); // onBlur 방지
                                                    setGroupName(g);
                                                    setIsGroupDropdownOpen(false);
                                                }}
                                                style={{
                                                    padding: '8px 12px', cursor: 'pointer',
                                                    backgroundColor: g === groupName ? '#ecf0f1' : 'transparent',
                                                    borderBottom: idx < groupList.length - 1 ? '1px solid #eee' : 'none'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f6fa'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = g === groupName ? '#ecf0f1' : 'transparent'}
                                            >
                                                {g}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>요청 항목 설명 (Description):</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="예: 영수증, 신분증 등"
                                style={{ width: '100%', maxWidth: '300px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                                disabled={isProcessing}
                            />
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>에이전트 선택:</label>
                            <select
                                value={isAddingNewAgent ? 'NEW' : agentId}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'NEW') {
                                        setIsAddingNewAgent(true);
                                        setAgentId('');
                                    } else {
                                        setIsAddingNewAgent(false);
                                        setAgentId(val);
                                    }
                                }}
                                style={{ width: '100%', maxWidth: '300px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px' }}
                                disabled={isProcessing}
                            >
                                <option value="">[선택 안 함 (V1 순수 OCR 호출)]</option>
                                {agentsList.map(a => (
                                    <option key={a.agentId} value={a.agentId}>{a.name} ({a.agentId})</option>
                                ))}
                                <option value="NEW">[직접 입력 / 새로 추가]</option>
                            </select>

                            {isAddingNewAgent && (
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                                    <input
                                        type="text"
                                        placeholder="에이전트 이름 (예: 영수증)"
                                        value={newAgentName}
                                        onChange={(e) => setNewAgentName(e.target.value)}
                                        style={{ width: '150px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="에이전트 ID (agt_...)"
                                        value={agentId}
                                        onChange={(e) => setAgentId(e.target.value)}
                                        style={{ width: '200px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                                    />
                                    <button
                                        onClick={async () => {
                                            if (!newAgentName.trim() || !agentId.trim()) {
                                                console.warn("이름과 ID를 모두 입력해주세요.");
                                                return;
                                            }
                                            try {
                                                await window.api.saveAgent({ name: newAgentName.trim(), agentId: agentId.trim() });
                                                const updated = await window.api.getAgents();
                                                setAgentsList(updated);
                                                setIsAddingNewAgent(false);
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }}
                                        style={{ padding: '8px 12px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        저장
                                    </button>
                                </div>
                            )}
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>이미지 파일 선택:</label>

                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        const newFiles = Array.from(e.dataTransfer.files);
                                        setSelectedFiles(newFiles);
                                    }
                                }}
                                onClick={() => {
                                    if (!isProcessing && fileInputRef.current) {
                                        fileInputRef.current.click();
                                    }
                                }}
                                style={{
                                    border: isDragging ? '2px dashed #3498db' : '2px dashed #ccc',
                                    borderRadius: '8px',
                                    padding: '30px',
                                    textAlign: 'center',
                                    backgroundColor: isDragging ? '#eaf4fd' : '#f9f9f9',
                                    transition: 'all 0.2s',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    marginBottom: '10px'
                                }}
                            >
                                <input
                                    type="file"
                                    multiple
                                    ref={fileInputRef}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    disabled={isProcessing}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            setSelectedFiles(Array.from(e.target.files));
                                        } else {
                                            setSelectedFiles([]);
                                        }
                                    }}
                                />
                                <div style={{ color: '#7f8c8d', fontSize: '14px' }}>
                                    {selectedFiles.length > 0 ? (
                                        <div style={{ color: '#2c3e50', fontWeight: 'bold' }}>
                                            📄 선택된 파일: {selectedFiles.length}개
                                            <div style={{ fontSize: '0.9em', color: '#7f8c8d', marginTop: '5px' }}>
                                                ({selectedFiles[0].name} {selectedFiles.length > 1 ? `외 ${selectedFiles.length - 1}건` : ''})
                                            </div>
                                        </div>
                                    ) : (
                                        <span>📁 여러 장의 이미지를 드래그하거나 클릭해서 선택하세요.</span>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '10px' }}>
                                <button
                                    onClick={handleOcrClick}
                                    disabled={isProcessing}
                                    style={{
                                        padding: '10px 24px',
                                        background: isProcessing ? '#95a5a6' : '#3498db',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                                        transition: 'background 0.3s',
                                        whiteSpace: 'nowrap',
                                        fontWeight: 'bold'
                                    }}>
                                    {isProcessing ? '분석 진행 중...' : '분석 시작!'}
                                </button>

                                {/* 진행률 바 (실시간 타이머 포함) */}
                                {(isProcessing || elapsedTime > 0) && (
                                    <div style={{ flex: 1, maxWidth: '400px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.95em', color: '#555', fontWeight: 'bold' }}>
                                            <span>{isProcessing ? '서버 응답 대기 중...' : '✅ 분석 완료!'}</span>
                                            <span style={{ color: isProcessing ? '#e74c3c' : '#27ae60' }}>
                                                {isProcessing 
                                                    ? `${elapsedTime.toFixed(2)}초 경과${totalDelay > 0 ? ` (순수: ${Math.max(0, elapsedTime - totalDelay).toFixed(2)}초)` : ''}` 
                                                    : `총 ${elapsedTime.toFixed(2)}초 소요됨${totalDelay > 0 ? ` (순수: ${Math.max(0, elapsedTime - totalDelay).toFixed(2)}초)` : ''}`}
                                            </span>
                                        </div>
                                        {isProcessing && (
                                            <div style={{ width: '100%', height: '12px', backgroundColor: '#ecf0f1', borderRadius: '6px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                                                <div style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    backgroundColor: '#3498db',
                                                    backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
                                                    backgroundSize: '40px 40px',
                                                    animation: 'progress-stripes 1s linear infinite'
                                                }} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <hr style={{ margin: '30px 0', borderColor: '#eee' }} />

                        <h3>분석 결과:</h3>
                        <pre style={{ background: '#f8f9fa', padding: '15px', minHeight: '300px', whiteSpace: 'pre-wrap', border: '1px solid #ddd', borderRadius: '4px' }}>
                            {result}
                        </pre>
                    </div>
                )}

                {currentMenu === 'HISTORY' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2>이전 호출 리스트</h2>
                            <button
                                onClick={() => setIsGraphDialogOpen(true)}
                                style={{
                                    padding: '10px 20px',
                                    color: 'black',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '1em',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                            >
                                📊
                            </button>
                        </div>
                        {history.length === 0 ? (
                            <p style={{ color: '#666' }}>아직 저장된 이력이 없습니다.</p>
                        ) : (
                            <div>
                                {Object.entries(history.reduce((acc, item) => {
                                    const g = item.groupName || '미지정 그룹';
                                    if (!acc[g]) acc[g] = [];
                                    acc[g].push(item);
                                    return acc;
                                }, {} as Record<string, any[]>)).map(([g, items]) => (
                                    <div key={g} style={{ marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                        <div
                                            onClick={() => {
                                                const newSet = new Set(expandedGroups);
                                                if (newSet.has(g)) newSet.delete(g);
                                                else newSet.add(g);
                                                setExpandedGroups(newSet);
                                            }}
                                            style={{ padding: '15px', backgroundColor: '#f1f1f1', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', borderBottom: expandedGroups.has(g) ? '1px solid #ccc' : 'none' }}
                                        >
                                            <span>📁 {g} <span style={{ color: '#777', fontSize: '0.9em' }}>({(items as any[]).length}건)</span></span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <span
                                                    title="그룹 이력 전체 삭제"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirmGroup(g);
                                                    }}
                                                    style={{ fontSize: '1.2em', cursor: 'pointer', transition: 'transform 0.2s' }}
                                                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                >
                                                    🗑️
                                                </span>
                                                <span style={{ color: '#555' }}>{expandedGroups.has(g) ? '▲' : '▼'}</span>
                                            </div>
                                        </div>
                                        {expandedGroups.has(g) && (
                                            <div style={{ padding: '20px', backgroundColor: '#fff' }}>
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95em' }}>
                                                        <thead>
                                                            <tr style={{ background: '#fafafa', borderBottom: '2px solid #ddd' }}>
                                                                <th style={{ padding: '12px', textAlign: 'left' }}>상태</th>
                                                                <th style={{ padding: '12px', textAlign: 'left' }}>API</th>
                                                                <th style={{ padding: '12px', textAlign: 'left' }}>설명</th>
                                                                <th style={{ padding: '12px', textAlign: 'left' }}>파일명</th>
                                                                <th style={{ padding: '12px', textAlign: 'left' }}>크기</th>
                                                                <th style={{ padding: '12px', textAlign: 'left' }}>요청 시간</th>
                                                                <th style={{ padding: '12px', textAlign: 'left' }}>소요 시간</th>
                                                                <th style={{ padding: '12px', textAlign: 'center' }}>Raw 데이터</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(items as any[]).map((item, index) => (
                                                                <tr key={index} style={{ borderBottom: '1px solid #eee', backgroundColor: '#fff' }}>
                                                                    <td style={{ padding: '12px', color: item.status === 'SUCCESS' ? '#27ae60' : '#e74c3c', fontWeight: 'bold' }}>
                                                                        {item.status}
                                                                    </td>
                                                                    <td style={{ padding: '12px', fontWeight: 'bold', color: item.apiType === 'V1' ? '#8e44ad' : '#2980b9' }}>
                                                                        {item.apiType || 'V2'}
                                                                    </td>
                                                                    <td style={{ padding: '12px' }}>{item.description}</td>
                                                                    <td style={{ padding: '12px', color: '#3498db' }}>{item.fileName || 'N/A'}</td>
                                                                    <td style={{ padding: '12px', color: '#7f8c8d' }}>{item.fileSize || 'N/A'}</td>
                                                                    <td style={{ padding: '12px', color: '#555' }}>{item.requestTime}</td>
                                                                    <td style={{ padding: '12px', color: '#555' }}>{item.durationSec}</td>
                                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setRawDialogData(item.rawResponse || { error: 'Raw 데이터가 없습니다.' }); }}
                                                                            style={{ padding: '4px 8px', background: '#34495e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85em' }}>
                                                                            보기
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 다이얼로그 랜더링 */}
            {isGraphDialogOpen && (
                <GraphDialog
                    allHistory={history}
                    groupList={Object.keys(history.reduce((acc, item) => {
                        acc[item.groupName || '미지정 그룹'] = true;
                        return acc;
                    }, {} as Record<string, boolean>))}
                    onClose={() => setIsGraphDialogOpen(false)}
                />
            )}

            {/* 자체 제작 Confirm 모달창 (Electron focus bug 방지) */}
            {deleteConfirmGroup && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1100
                }}>
                    <div style={{
                        backgroundColor: '#fff', padding: '30px', borderRadius: '12px',
                        width: '400px', maxWidth: '90%', boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                        textAlign: 'center'
                    }}>
                        <h3 style={{ marginTop: 0, color: '#e74c3c' }}>⚠️ 삭제 확인</h3>
                        <p style={{ color: '#2c3e50', marginBottom: '30px' }}>
                            <strong>'{deleteConfirmGroup}'</strong> 그룹의 모든 이력을<br />영구적으로 삭제하시겠습니까?
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                            <button
                                onClick={() => setDeleteConfirmGroup(null)}
                                style={{
                                    padding: '10px 20px', borderRadius: '6px', border: '1px solid #ccc',
                                    background: '#f9f9f9', cursor: 'pointer', fontWeight: 'bold'
                                }}
                            >
                                취소
                            </button>
                            <button
                                onClick={async () => {
                                    const g = deleteConfirmGroup;
                                    setDeleteConfirmGroup(null);
                                    await window.api.deleteGroupHistory(g);
                                    loadHistory();
                                }}
                                style={{
                                    padding: '10px 20px', borderRadius: '6px', border: 'none',
                                    background: '#e74c3c', color: '#fff', cursor: 'pointer', fontWeight: 'bold'
                                }}
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Raw 데이터 다이얼로그 */}
            {rawDialogData && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 2000
                }}>
                    <div style={{
                        backgroundColor: '#fff', padding: '20px', borderRadius: '8px',
                        width: '800px', maxWidth: '90%', height: '80vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>Raw Response Data</h3>
                            <button onClick={() => setRawDialogData(null)} style={{ border: 'none', background: 'transparent', fontSize: '1.5em', cursor: 'pointer' }}>✖</button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '4px', border: '1px solid #ddd' }}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontSize: '0.9em' }}>
                                {JSON.stringify(rawDialogData, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
}
