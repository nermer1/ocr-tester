import React, { useState, Component } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

class ErrorBoundary extends Component<any, any> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', background: '#ffcccc', color: '#c0392b', borderRadius: '8px' }}>
                    <h3>그래프 렌더링 중 오류 발생!</h3>
                    <pre>{this.state.error?.toString()}</pre>
                    <button onClick={this.props.onClose}>닫기</button>
                </div>
            );
        }
        return this.props.children;
    }
}

interface GraphDialogProps {
    allHistory: any[];
    groupList: string[];
    onClose: () => void;
}

const COLORS = ['#2ecc71', '#e74c3c', '#9b59b6', '#f1c40f', '#e67e22', '#1abc9c', '#34495e'];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '1.1em', color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>{label}</p>
                {payload.map((p: any, idx: number) => {
                    const data = p.payload[`${p.name}_data`] || p.payload[`comp_${idx}_data`];
                    
                    if (!data) return null;
                    return (
                        <div key={idx} style={{ marginBottom: idx < payload.length - 1 ? '15px' : '0' }}>
                            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: p.color }}>{p.name}</p>
                            <p style={{ margin: '2px 0', color: p.color, fontWeight: 'bold' }}>⏳ 소요 시간: {p.value}초</p>
                            <p style={{ margin: '2px 0', fontSize: '0.9em', color: '#34495e' }}><strong>상태:</strong> {data.status}</p>
                            <p style={{ margin: '2px 0', fontSize: '0.9em', color: '#34495e' }}><strong>요청 시간:</strong> {data.requestTime}</p>
                            <p style={{ margin: '2px 0', fontSize: '0.9em', color: '#34495e' }}><strong>파일명:</strong> {data.fileName} ({data.fileSize})</p>
                            <p style={{ margin: '2px 0', fontSize: '0.9em', color: '#34495e' }}><strong>설명:</strong> {data.description}</p>
                        </div>
                    );
                })}
            </div>
        );
    }
    return null;
};

const GraphDialogInner: React.FC<GraphDialogProps> = ({ allHistory, groupList, onClose }) => {
    const [filterType, setFilterType] = useState<string>('ALL');
    
    // 초기 렌더링 시 그룹 목록 중 첫 번째 그룹을 기본 선택 상태로 만듦
    const [compareGroups, setCompareGroups] = useState<Set<string>>(() => {
        const initial = new Set<string>();
        if (groupList.length > 0) initial.add(groupList[0]);
        return initial;
    });

    // 선택된 그룹들의 데이터 준비 및 최대 반복 횟수 계산
    const compareItemsMap: Record<string, any[]> = {};
    let maxIterations = 0;

    Array.from(compareGroups).forEach(g => {
        const items = allHistory
            .filter(itm => (itm.groupName || '미지정 그룹') === g)
            .filter(itm => itm.status === 'SUCCESS')
            .filter(itm => filterType === 'ALL' || (itm.apiType || 'V2') === filterType)
            .reverse();
        
        compareItemsMap[g] = items;
        if (items.length > maxIterations) {
            maxIterations = items.length;
        }
    });

    // 그래프 병합 데이터 생성
    const data = [];
    for (let i = 0; i < maxIterations; i++) {
        const row: any = { name: `${i + 1}회차` };
        
        Array.from(compareGroups).forEach((g, idx) => {
            const comp = compareItemsMap[g][i];
            const safeKey = `comp_${idx}`;
            row[`${safeKey}_time`] = comp ? parseFloat(String(comp.durationSec || '0').replace('초', '')) : null;
            row[`${safeKey}_data`] = comp || null;
        });

        data.push(row);
    }

    return (
        <div style={{
            backgroundColor: '#fff', padding: '30px', borderRadius: '12px',
            width: '850px', maxWidth: '95%', boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h3 style={{ margin: 0, color: '#2c3e50' }}>📊 전체 그룹 비교 뷰어</h3>
                    <select 
                        value={filterType} 
                        onChange={e => setFilterType(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                        <option value="ALL">전체 API 보기</option>
                        <option value="V1">V1 (순수 OCR)</option>
                        <option value="V2">V2 (에이전트)</option>
                    </select>
                </div>
                <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '1.5em', cursor: 'pointer', color: '#7f8c8d' }}>✖</button>
            </div>

            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '20px', border: '1px solid #eee' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9em', color: '#555', display: 'block', marginBottom: '8px' }}>
                    ✅ 보고 싶은 그룹을 선택하세요 (다중 선택 가능):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                    {groupList.map(g => (
                        <label key={g} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em', color: '#2c3e50' }}>
                            <input 
                                type="checkbox" 
                                checked={compareGroups.has(g)} 
                                onChange={(e) => {
                                    const newSet = new Set(compareGroups);
                                    if (e.target.checked) newSet.add(g);
                                    else newSet.delete(g);
                                    setCompareGroups(newSet);
                                }} 
                                style={{ cursor: 'pointer' }}
                            />
                            {g}
                        </label>
                    ))}
                    {groupList.length === 0 && (
                        <span style={{ color: '#95a5a6', fontSize: '0.9em' }}>생성된 그룹이 존재하지 않습니다.</span>
                    )}
                </div>
            </div>

            <div style={{ height: '400px', width: '100%' }}>
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 20, right: 40, left: 20, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                            <XAxis dataKey="name" tick={{ fill: '#7f8c8d', fontSize: 12 }} interval={0} angle={-45} textAnchor="end" height={60} />
                            <YAxis tick={{ fill: '#7f8c8d' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="top" height={36} />
                            
                            {Array.from(compareGroups).map((g, idx) => {
                                const color = COLORS[idx % COLORS.length];
                                const safeKey = `comp_${idx}`;
                                return (
                                    <Line 
                                        key={safeKey} 
                                        name={g} 
                                        type="monotone" 
                                        dataKey={`${safeKey}_time`} 
                                        stroke={color} 
                                        strokeWidth={2} 
                                        activeDot={{ r: 6, fill: color }} 
                                        connectNulls={true} 
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#95a5a6' }}>
                        선택된 조건에 해당하는 성공 데이터가 없습니다.
                    </div>
                )}
            </div>
        </div>
    );
};

const GraphDialog: React.FC<GraphDialogProps> = (props) => {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <ErrorBoundary onClose={props.onClose}>
                <GraphDialogInner {...props} />
            </ErrorBoundary>
        </div>
    );
};

export default GraphDialog;
