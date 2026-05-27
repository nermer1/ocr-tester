import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface GraphDialogProps {
    groupName: string;
    items: any[];
    onClose: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '1.1em', color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>{label}</p>
                <p style={{ margin: '5px 0', color: '#e74c3c', fontWeight: 'bold' }}>⏳ 소요 시간: {data.time}초</p>
                <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#34495e' }}><strong>상태:</strong> {data.status}</p>
                <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#34495e' }}><strong>요청 시간:</strong> {data.requestTime}</p>
                <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#34495e' }}><strong>파일명:</strong> {data.fileName} ({data.fileSize})</p>
                <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#34495e' }}><strong>설명:</strong> {data.description}</p>
            </div>
        );
    }
    return null;
};

const GraphDialog: React.FC<GraphDialogProps> = ({ groupName, items, onClose }) => {
    // 항목 개수가 0개면 그래프를 그릴 수 없으므로 처리
    if (!items || items.length === 0) return null;

    // 부모 컴포넌트(renderer)에서 items가 최신순(내림차순)으로 넘어오므로,
    // 1. 성공한 항목(SUCCESS)만 필터링합니다.
    // 2. 그래프(왼쪽->오른쪽)는 과거부터 최신순(오름차순)으로 그려지도록 데이터를 뒤집어 줍니다.
    const data = [...items].filter(itm => itm.status === 'SUCCESS').reverse().map((itm, idx) => ({
        name: `${idx + 1}회차`,
        time: parseFloat(itm.durationSec.replace('초', '')),
        fileName: itm.fileName || 'N/A',
        fileSize: itm.fileSize || 'N/A',
        description: itm.description || 'N/A',
        requestTime: itm.requestTime || 'N/A',
        status: itm.status || 'N/A'
    }));

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff', padding: '30px', borderRadius: '12px',
                width: '700px', maxWidth: '90%', boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #ecf0f1', paddingBottom: '10px' }}>
                    <h3 style={{ margin: 0, color: '#2c3e50' }}>📊 {groupName} - 소요 시간 추이</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '1.5em', cursor: 'pointer', color: '#7f8c8d' }}>✖</button>
                </div>
                <div style={{ height: '350px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                            <XAxis dataKey="name" tick={{ fill: '#7f8c8d' }} />
                            <YAxis tick={{ fill: '#7f8c8d' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="time" stroke="#3498db" strokeWidth={3} activeDot={{ r: 8, fill: '#e74c3c' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default GraphDialog;
