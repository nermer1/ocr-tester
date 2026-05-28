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
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [dialogGroup, setDialogGroup] = useState<string | null>(null);
    const [rawDialogData, setRawDialogData] = useState<any | null>(null);
    const [groupList, setGroupList] = useState<string[]>([]);
    const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState<boolean>(false);

    // Agent 관련 상태
    const [agentsList, setAgentsList] = useState<any[]>([]);
    const [isAddingNewAgent, setIsAddingNewAgent] = useState<boolean>(false);
    const [newAgentName, setNewAgentName] = useState<string>('');

    // Drag & Drop 관련 상태
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [selectedFileName, setSelectedFileName] = useState<string>('');

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
        const file = fileInputRef.current?.files?.[0];

        if (!file) {
            setResult("❌ 파일을 놓고 오셨네요. 이미지를 선택해주세요.");
            return;
        }

        const filePath = (file as any).path;

        if (!description.trim()) {
            setResult("❌ 요청 항목에 대한 설명을 입력해주세요!");
            return;
        }

        setResult("분석 중... 서버 다녀오는 중");
        setIsProcessing(true);

        try {
            const response = await window.api.requestOCR({ filePath, description, groupName, agentId });
            setResult(JSON.stringify(response, null, 2));
        } catch (error: any) {
            setResult("에러 났어 ㅠㅠ\n" + error.message);
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
                                        if (fileInputRef.current) {
                                            fileInputRef.current.files = e.dataTransfer.files;
                                            setSelectedFileName(e.dataTransfer.files[0].name);
                                        }
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
                                    ref={fileInputRef} 
                                    accept="image/*" 
                                    style={{ display: 'none' }} 
                                    disabled={isProcessing} 
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            setSelectedFileName(e.target.files[0].name);
                                        } else {
                                            setSelectedFileName('');
                                        }
                                    }}
                                />
                                <div style={{ color: '#7f8c8d', fontSize: '14px' }}>
                                    {selectedFileName ? (
                                        <span style={{ color: '#2c3e50', fontWeight: 'bold' }}>📄 선택된 파일: {selectedFileName}</span>
                                    ) : (
                                        <span>📁 여기로 이미지를 드래그하거나 클릭해서 선택하세요.</span>
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
                                                {isProcessing ? `${elapsedTime.toFixed(1)}초 경과` : `총 ${elapsedTime.toFixed(1)}초 소요됨`}
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
                        <h2>이전 호출 리스트</h2>
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
                                                    title="그래프 보기"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDialogGroup(g);
                                                    }}
                                                    style={{ fontSize: '1.2em', cursor: 'pointer', transition: 'transform 0.2s' }}
                                                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                >
                                                    📊
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
            {dialogGroup && (
                <GraphDialog
                    groupName={dialogGroup}
                    allHistory={history}
                    groupList={Array.from(new Set(history.map(item => item.groupName || '미지정 그룹')))}
                    onClose={() => setDialogGroup(null)}
                />
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
