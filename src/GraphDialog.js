"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importDefault(require("react"));
const recharts_1 = require("recharts");
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return ((0, jsx_runtime_1.jsxs)("div", { style: { backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }, children: [(0, jsx_runtime_1.jsx)("p", { style: { margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '1.1em', color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '5px' }, children: label }), (0, jsx_runtime_1.jsxs)("p", { style: { margin: '5px 0', color: '#e74c3c', fontWeight: 'bold' }, children: ["\u23F3 \uC18C\uC694 \uC2DC\uAC04: ", data.time, "\uCD08"] }), (0, jsx_runtime_1.jsxs)("p", { style: { margin: '5px 0', fontSize: '0.9em', color: '#34495e' }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\uC0C1\uD0DC:" }), " ", data.status] }), (0, jsx_runtime_1.jsxs)("p", { style: { margin: '5px 0', fontSize: '0.9em', color: '#34495e' }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\uC694\uCCAD \uC2DC\uAC04:" }), " ", data.requestTime] }), (0, jsx_runtime_1.jsxs)("p", { style: { margin: '5px 0', fontSize: '0.9em', color: '#34495e' }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\uD30C\uC77C\uBA85:" }), " ", data.fileName, " (", data.fileSize, ")"] }), (0, jsx_runtime_1.jsxs)("p", { style: { margin: '5px 0', fontSize: '0.9em', color: '#34495e' }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\uC124\uBA85:" }), " ", data.description] })] }));
    }
    return null;
};
const GraphDialog = ({ groupName, items, onClose }) => {
    const [filterType, setFilterType] = react_1.default.useState('ALL');
    // 항목 개수가 0개면 그래프를 그릴 수 없으므로 처리
    if (!items || items.length === 0)
        return null;
    // 부모 컴포넌트(renderer)에서 items가 최신순(내림차순)으로 넘어오므로,
    // 1. 성공한 항목(SUCCESS)만 필터링합니다.
    // 2. 선택된 API 타입에 맞춰 필터링합니다.
    // 3. 그래프(왼쪽->오른쪽)는 과거부터 최신순(오름차순)으로 그려지도록 데이터를 뒤집어 줍니다.
    const data = [...items]
        .filter(itm => itm.status === 'SUCCESS')
        .filter(itm => filterType === 'ALL' || (itm.apiType || 'V2') === filterType)
        .reverse()
        .map((itm, idx) => ({
            name: `${idx + 1}회차`,
            time: parseFloat(itm.durationSec.replace('초', '')),
            fileName: itm.fileName || 'N/A',
            fileSize: itm.fileSize || 'N/A',
            description: itm.description || 'N/A',
            requestTime: itm.requestTime || 'N/A',
            status: itm.status || 'N/A'
        }));
    return ((0, jsx_runtime_1.jsx)("div", {
        style: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }, children: (0, jsx_runtime_1.jsxs)("div", {
            style: {
                backgroundColor: '#fff', padding: '30px', borderRadius: '12px',
                width: '700px', maxWidth: '90%', boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #ecf0f1', paddingBottom: '10px' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', alignItems: 'center', gap: '15px' }, children: [(0, jsx_runtime_1.jsxs)("h3", { style: { margin: 0, color: '#2c3e50' }, children: ["\uD83D\uDCCA ", groupName, " - \uC18C\uC694 \uC2DC\uAC04 \uCD94\uC774"] }), (0, jsx_runtime_1.jsxs)("select", { value: filterType, onChange: e => setFilterType(e.target.value), style: { padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }, children: [(0, jsx_runtime_1.jsx)("option", { value: "ALL", children: "\uC804\uCCB4 \uBCF4\uAE30" }), (0, jsx_runtime_1.jsx)("option", { value: "V1", children: "V1 (\uC21C\uC218 OCR)" }), (0, jsx_runtime_1.jsx)("option", { value: "V2", children: "V2 (\uC5D0\uC774\uC804\uD2B8)" })] })] }), (0, jsx_runtime_1.jsx)("button", { onClick: onClose, style: { border: 'none', background: 'transparent', fontSize: '1.5em', cursor: 'pointer', color: '#7f8c8d' }, children: "\u2716" })] }), (0, jsx_runtime_1.jsx)("div", { style: { height: '350px', width: '100%' }, children: (0, jsx_runtime_1.jsx)(recharts_1.ResponsiveContainer, { width: "100%", height: "100%", children: (0, jsx_runtime_1.jsxs)(recharts_1.LineChart, { data: data, margin: { top: 20, right: 40, left: 20, bottom: 30 }, children: [(0, jsx_runtime_1.jsx)(recharts_1.CartesianGrid, { strokeDasharray: "3 3", stroke: "#eee" }), (0, jsx_runtime_1.jsx)(recharts_1.XAxis, { dataKey: "name", tick: { fill: '#7f8c8d', fontSize: 12 }, interval: 0, angle: -45, textAnchor: "end", height: 60 }), (0, jsx_runtime_1.jsx)(recharts_1.YAxis, { tick: { fill: '#7f8c8d' } }), (0, jsx_runtime_1.jsx)(recharts_1.Tooltip, { content: (0, jsx_runtime_1.jsx)(CustomTooltip, {}) }), (0, jsx_runtime_1.jsx)(recharts_1.Line, { type: "monotone", dataKey: "time", stroke: "#3498db", strokeWidth: 3, activeDot: { r: 8, fill: '#e74c3c' } })] }) }) })]
        })
    }));
};
exports.default = GraphDialog;
