"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const recharts_1 = require("recharts");
class ErrorBoundary extends react_1.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    render() {
        var _a;
        if (this.state.hasError) {
            return ((0, jsx_runtime_1.jsxs)("div", { style: { padding: '20px', background: '#ffcccc', color: '#c0392b', borderRadius: '8px' }, children: [(0, jsx_runtime_1.jsx)("h3", { children: "\uADF8\uB798\uD504 \uB80C\uB354\uB9C1 \uC911 \uC624\uB958 \uBC1C\uC0DD!" }), (0, jsx_runtime_1.jsx)("pre", { children: (_a = this.state.error) === null || _a === void 0 ? void 0 : _a.toString() }), (0, jsx_runtime_1.jsx)("button", { onClick: this.props.onClose, children: "\uB2EB\uAE30" })] }));
        }
        return this.props.children;
    }
}
const COLORS = ['#2ecc71', '#e74c3c', '#9b59b6', '#f1c40f', '#e67e22', '#1abc9c', '#34495e'];
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return ((0, jsx_runtime_1.jsxs)("div", { style: { backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }, children: [(0, jsx_runtime_1.jsx)("p", { style: { margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '1.1em', color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '5px' }, children: label }), payload.map((p, idx) => {
                    const data = p.payload[`${p.name}_data`] || p.payload[`comp_${idx}_data`];
                    if (!data)
                        return null;
                    return ((0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: idx < payload.length - 1 ? '15px' : '0' }, children: [(0, jsx_runtime_1.jsx)("p", { style: { margin: '0 0 5px 0', fontWeight: 'bold', color: p.color }, children: p.name }), (0, jsx_runtime_1.jsxs)("p", { style: { margin: '2px 0', color: p.color, fontWeight: 'bold' }, children: ["\u23F3 \uC18C\uC694 \uC2DC\uAC04: ", p.value, "\uCD08"] }), (0, jsx_runtime_1.jsxs)("p", { style: { margin: '2px 0', fontSize: '0.9em', color: '#34495e' }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\uC0C1\uD0DC:" }), " ", data.status] }), (0, jsx_runtime_1.jsxs)("p", { style: { margin: '2px 0', fontSize: '0.9em', color: '#34495e' }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\uC694\uCCAD \uC2DC\uAC04:" }), " ", data.requestTime] }), (0, jsx_runtime_1.jsxs)("p", { style: { margin: '2px 0', fontSize: '0.9em', color: '#34495e' }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\uD30C\uC77C\uBA85:" }), " ", data.fileName, " (", data.fileSize, ")"] }), (0, jsx_runtime_1.jsxs)("p", { style: { margin: '2px 0', fontSize: '0.9em', color: '#34495e' }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\uC124\uBA85:" }), " ", data.description] })] }, idx));
                })] }));
    }
    return null;
};
const GraphDialogInner = ({ allHistory, groupList, onClose }) => {
    const [filterType, setFilterType] = (0, react_1.useState)('ALL');
    // 초기 렌더링 시 그룹 목록 중 첫 번째 그룹을 기본 선택 상태로 만듦
    const [compareGroups, setCompareGroups] = (0, react_1.useState)(() => {
        const initial = new Set();
        if (groupList.length > 0)
            initial.add(groupList[0]);
        return initial;
    });
    // 선택된 그룹들의 데이터 준비 및 최대 반복 횟수 계산
    const compareItemsMap = {};
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
        const row = { name: `${i + 1}회차` };
        Array.from(compareGroups).forEach((g, idx) => {
            const comp = compareItemsMap[g][i];
            const safeKey = `comp_${idx}`;
            row[`${safeKey}_time`] = comp ? parseFloat(String(comp.durationSec || '0').replace('초', '')) : null;
            row[`${safeKey}_data`] = comp || null;
        });
        data.push(row);
    }
    return ((0, jsx_runtime_1.jsxs)("div", { style: {
            backgroundColor: '#fff', padding: '30px', borderRadius: '12px',
            width: '850px', maxWidth: '95%', boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflowY: 'auto'
        }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', alignItems: 'center', gap: '15px' }, children: [(0, jsx_runtime_1.jsx)("h3", { style: { margin: 0, color: '#2c3e50' }, children: "\uD83D\uDCCA \uC804\uCCB4 \uADF8\uB8F9 \uBE44\uAD50 \uBDF0\uC5B4" }), (0, jsx_runtime_1.jsxs)("select", { value: filterType, onChange: e => setFilterType(e.target.value), style: { padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc' }, children: [(0, jsx_runtime_1.jsx)("option", { value: "ALL", children: "\uC804\uCCB4 API \uBCF4\uAE30" }), (0, jsx_runtime_1.jsx)("option", { value: "V1", children: "V1 (\uC21C\uC218 OCR)" }), (0, jsx_runtime_1.jsx)("option", { value: "V2", children: "V2 (\uC5D0\uC774\uC804\uD2B8)" })] })] }), (0, jsx_runtime_1.jsx)("button", { onClick: onClose, style: { border: 'none', background: 'transparent', fontSize: '1.5em', cursor: 'pointer', color: '#7f8c8d' }, children: "\u2716" })] }), (0, jsx_runtime_1.jsxs)("div", { style: { padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '20px', border: '1px solid #eee' }, children: [(0, jsx_runtime_1.jsx)("span", { style: { fontWeight: 'bold', fontSize: '0.9em', color: '#555', display: 'block', marginBottom: '8px' }, children: "\u2705 \uBCF4\uACE0 \uC2F6\uC740 \uADF8\uB8F9\uC744 \uC120\uD0DD\uD558\uC138\uC694 (\uB2E4\uC911 \uC120\uD0DD \uAC00\uB2A5):" }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '15px' }, children: [groupList.map(g => ((0, jsx_runtime_1.jsxs)("label", { style: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em', color: '#2c3e50' }, children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: compareGroups.has(g), onChange: (e) => {
                                            const newSet = new Set(compareGroups);
                                            if (e.target.checked)
                                                newSet.add(g);
                                            else
                                                newSet.delete(g);
                                            setCompareGroups(newSet);
                                        }, style: { cursor: 'pointer' } }), g] }, g))), groupList.length === 0 && ((0, jsx_runtime_1.jsx)("span", { style: { color: '#95a5a6', fontSize: '0.9em' }, children: "\uC0DD\uC131\uB41C \uADF8\uB8F9\uC774 \uC874\uC7AC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }))] })] }), (0, jsx_runtime_1.jsx)("div", { style: { height: '400px', width: '100%' }, children: data.length > 0 ? ((0, jsx_runtime_1.jsx)(recharts_1.ResponsiveContainer, { width: "100%", height: "100%", children: (0, jsx_runtime_1.jsxs)(recharts_1.LineChart, { data: data, margin: { top: 20, right: 40, left: 20, bottom: 30 }, children: [(0, jsx_runtime_1.jsx)(recharts_1.CartesianGrid, { strokeDasharray: "3 3", stroke: "#eee" }), (0, jsx_runtime_1.jsx)(recharts_1.XAxis, { dataKey: "name", tick: { fill: '#7f8c8d', fontSize: 12 }, interval: 0, angle: -45, textAnchor: "end", height: 60 }), (0, jsx_runtime_1.jsx)(recharts_1.YAxis, { tick: { fill: '#7f8c8d' } }), (0, jsx_runtime_1.jsx)(recharts_1.Tooltip, { content: (0, jsx_runtime_1.jsx)(CustomTooltip, {}) }), (0, jsx_runtime_1.jsx)(recharts_1.Legend, { verticalAlign: "top", height: 36 }), Array.from(compareGroups).map((g, idx) => {
                                const color = COLORS[idx % COLORS.length];
                                const safeKey = `comp_${idx}`;
                                return ((0, jsx_runtime_1.jsx)(recharts_1.Line, { name: g, type: "monotone", dataKey: `${safeKey}_time`, stroke: color, strokeWidth: 2, activeDot: { r: 6, fill: color }, connectNulls: true }, safeKey));
                            })] }) })) : ((0, jsx_runtime_1.jsx)("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#95a5a6' }, children: "\uC120\uD0DD\uB41C \uC870\uAC74\uC5D0 \uD574\uB2F9\uD558\uB294 \uC131\uACF5 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." })) })] }));
};
const GraphDialog = (props) => {
    return ((0, jsx_runtime_1.jsx)("div", { style: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }, children: (0, jsx_runtime_1.jsx)(ErrorBoundary, { onClose: props.onClose, children: (0, jsx_runtime_1.jsx)(GraphDialogInner, Object.assign({}, props)) }) }));
};
exports.default = GraphDialog;
