import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl, Dimensions, StatusBar,
} from 'react-native';
import Svg, {
  Rect, Text as SvgText, Circle, G as SvgG,
  Path, Defs, LinearGradient as SvgGradient, Stop, Line
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { getManagerDashboard, getTeamStats, getTasks } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

// ─── Layout Constants (Mathematically Perfect for No Clipping) ────────────────
const { width: SW } = Dimensions.get('window');
const GUTTER = 16;
const GAP    = 14;
const CPAD   = 20; // Card internal padding

const FULL_W  = SW - GUTTER * 2;
const HALF_W  = (FULL_W - GAP) / 2;
const FULL_CW = FULL_W - CPAD * 2;
const HALF_CW = HALF_W - CPAD * 2;

// ─── Liquid Glass High Contrast Palette ──────────────────────────────────────
const G = {
  bgLight:  '#F0F6FF',
  bgMid:    '#E0F2FE',
  bgDark:   '#F8FAFC',
  
  txtMain:  '#020617', // Slate 950
  txtMuted: '#1E293B', // Slate 800
  txtFaint: '#475569', // Slate 600

  p100:     '#DBEAFE',
  p200:     '#BFDBFE',
  p300:     '#93C5FD',
  p400:     '#60A5FA',
  p500:     '#3B82F6',
  p600:     '#2563EB',
  p700:     '#1D4ED8',
  p800:     '#1E40AF',
  p900:     '#1E3A8A',
  
  white:    '#FFFFFF',
  
  cyan:     '#0284C7',
  purple:   '#7C3AED',
  green:    '#059669',
  pink:     '#DB2777',
  amber:    '#D97706',
  blue:     '#2563EB',
  red:      '#DC2626',
  
  grid:     'rgba(0,0,0,0.05)',
};

const NEON_COLORS = [G.cyan, G.purple, G.green, G.pink, G.amber, G.blue];

// Native fluid shadow
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

// ─── Data Helpers ─────────────────────────────────────────────────────────────
const WEEK_SHORT  = ['M',   'T',   'W',   'T',   'F',   'S',   'S' ];
const WEEK_W      = [0.10,  0.15,  0.20,  0.22,  0.18,  0.10,  0.05];

const makeWeekTrend = (total) => WEEK_W.map(w => Math.max(0, Math.round((total || 0) * w)));
const makeMultiTrend = (completed, active, overdue) => ({
  completed: WEEK_W.map(w => Math.max(0, Math.round((completed || 0) * w))),
  active:    WEEK_W.map(w => Math.max(0, Math.round((active    || 0) * w * 0.8 + (active || 0) * 0.1))),
  overdue:   WEEK_W.map(w => Math.max(0, Math.round((overdue   || 0) * w * 0.6 + (overdue|| 0) * 0.15))),
});
const makeHeatData = (total) => {
  const base = (total || 0) / 35;
  const m = [
    [0.5,0.9,1.2,1.4,1.1,0.4,0.2], [0.7,1.1,1.5,1.6,1.3,0.5,0.3], [0.9,1.3,1.6,1.7,1.4,0.6,0.3],
    [0.8,1.1,1.3,1.4,1.2,0.5,0.2], [0.6,0.9,1.0,1.1,0.9,0.3,0.1],
  ];
  return m.map(row => row.map(v => Math.max(0, Math.round(base * v))));
};
const makeFunnelData = (total, completed, active, todo) => [
  { label: 'All Tasks',   value: total,     color: G.cyan  },
  { label: 'To Do',       value: todo,      color: G.blue  },
  { label: 'In Progress', value: active,    color: G.amber },
  { label: 'Completed',   value: completed, color: G.green },
];

const barColor = (rate) => rate >= 70 ? G.green : rate >= 40 ? G.amber : G.red;

// ─── BentoBox Component ───────────────────────────────────────────────────────
function AreaLineChart({ data, width, color = G.cyan, gradId = 'areaCyan' }) {
  const W = width || FULL_CW, H = 120;
  const PAD = { t: 20, b: 28, l: 28, r: 12 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;

  if (!data || data.length < 2) return <Svg width={W} height={H}><SvgText x={W/2} y={H/2} fill={G.txtFaint} textAnchor="middle" fontSize={12}>No data</SvgText></Svg>;

  const maxV = Math.max(...data, 1);
  const pts = data.map((v, i) => ({ x: PAD.l + (i / (data.length - 1)) * cW, y: PAD.t + cH - (v / maxV) * cH, v }));

  const linePath = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1], cpx = (prev.x + p.x) / 2;
    return `${acc} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  const areaPath = `${linePath} L ${pts[pts.length-1].x} ${PAD.t + cH} L ${pts[0].x} ${PAD.t + cH} Z`;
  const minI = pts.reduce((a, p, i) => p.y > pts[a].y ? i : a, 0);
  const maxI = pts.reduce((a, p, i) => p.y < pts[a].y ? i : a, 0);

  return (
    <Svg width={W} height={H}>
      <Defs>
        <SvgGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.4" />
          <Stop offset="1" stopColor={color} stopOpacity="0.01" />
        </SvgGradient>
      </Defs>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <Line key={f} x1={PAD.l} y1={PAD.t + cH * (1 - f)} x2={PAD.l + cW} y2={PAD.t + cH * (1 - f)} stroke={G.grid} strokeWidth={1.5} />
      ))}
      <Path d={areaPath} fill={`url(#${gradId})`} />
      <Path d={linePath} fill="none" stroke={color} strokeWidth={4} strokeOpacity={1.0} />
      {[maxI, minI].map((idx, k) => (
        <SvgG key={k}>
          <Circle cx={pts[idx].x} cy={pts[idx].y} r={5} fill={G.white} stroke={color} strokeWidth={3} />
          <SvgText x={pts[idx].x} y={pts[idx].y - 10} fill={color} fontSize={10} fontWeight="900" textAnchor="middle">{pts[idx].v}</SvgText>
        </SvgG>
      ))}
      {pts.map((p, i) => <SvgText key={i} x={p.x} y={H - 4} fill={G.txtFaint} fontSize={10} fontWeight="800" textAnchor="middle">{WEEK_SHORT[i]}</SvgText>)}
    </Svg>
  );
}

function MultiLineChart({ data, width }) {
  const W = width || FULL_CW, H = 130;
  const PAD = { t: 20, b: 28, l: 28, r: 12 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;

  const series = [
    { key: 'completed', color: G.cyan,  label: 'Done'    },
    { key: 'active',    color: G.amber, label: 'Active'  },
    { key: 'overdue',   color: G.pink,  label: 'Overdue' },
  ];

  if (!data) return <Svg width={W} height={H}><SvgText x={W/2} y={H/2} fill={G.txtFaint} textAnchor="middle" fontSize={12}>No data</SvgText></Svg>;

  const allVals = series.flatMap(s => data[s.key] || []);
  const maxV = Math.max(...allVals, 1);
  const makePts = (arr) => (arr || []).map((v, i) => ({ x: PAD.l + (i / 6) * cW, y: PAD.t + cH - (v / maxV) * cH }));

  const smoothPath = (pts) => pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1], cpx = (prev.x + p.x) / 2;
    return `${acc} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  return (
    <Svg width={W} height={H}>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <Line key={f} x1={PAD.l} y1={PAD.t + cH * (1 - f)} x2={PAD.l + cW} y2={PAD.t + cH * (1 - f)} stroke={G.grid} strokeWidth={1.5} />
      ))}
      {series.map(s => (
        <SvgG key={s.key}>
          <Path d={smoothPath(makePts(data[s.key]))} fill="none" stroke={s.color} strokeWidth={3} strokeOpacity={1.0} />
        </SvgG>
      ))}
      {WEEK_SHORT.map((lbl, i) => <SvgText key={i} x={PAD.l + (i / 6) * cW} y={H - 4} fill={G.txtFaint} fontSize={10} fontWeight="800" textAnchor="middle">{lbl}</SvgText>)}
      {series.map((s, i) => (
        <SvgG key={s.key}>
          <Rect x={PAD.l + i * 56} y={0} width={12} height={4} fill={s.color} rx={2} />
          <SvgText x={PAD.l + i * 56 + 16} y={6} fill={G.txtMain} fontSize={9} fontWeight="800">{s.label}</SvgText>
        </SvgG>
      ))}
    </Svg>
  );
}

function NeonGauge({ rate = 0, width, color = G.cyan, label = 'Completion' }) {
  const W = width || HALF_CW, H = W, cx = W / 2, cy = H / 2, R = W * 0.38;
  const pct = Math.min(Math.max(rate, 0), 100);
  const startAngle = -220, sweepTotal = 260, sweepFill = (pct / 100) * sweepTotal;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const arcPath = (cx, cy, r, startDeg, sweepDeg) => {
    const s = toRad(startDeg), e = toRad(startDeg + sweepDeg);
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const large = sweepDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const trackPath = arcPath(cx, cy, R, startAngle, sweepTotal);
  const fillPath  = sweepFill > 0 ? arcPath(cx, cy, R, startAngle, sweepFill) : null;

  return (
    <Svg width={W} height={H}>
      <Path d={trackPath} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={16} strokeLinecap="round" />
      {fillPath && <Path d={fillPath} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" />}
      <SvgText x={cx} y={cy - 2} fill={G.txtMain} fontSize={W * 0.18} fontWeight="900" letterSpacing={-1} textAnchor="middle">{Math.round(pct)}%</SvgText>
      <SvgText x={cx} y={cy + 16} fill={G.txtFaint} fontSize={W * 0.08} textAnchor="middle" fontWeight="800" textTransform="uppercase">{label}</SvgText>
    </Svg>
  );
}

function NeonDonut({ segments, total, width }) {
  const W = width || HALF_CW, H = W, cx = W / 2, cy = H / 2, R = W * 0.36, IR = R * 0.6;
  if (!segments || !segments.length || total === 0) return <Svg width={W} height={H}><SvgText x={cx} y={cy} fill={G.txtFaint} textAnchor="middle" fontSize={12}>No data</SvgText></Svg>;

  const toRad = (deg) => (deg * Math.PI) / 180;
  let current = -90;

  const slices = segments.map((seg) => {
    const angle = (seg.value / total) * 360;
    const s = toRad(current), e = toRad(current + angle);
    const x1 = cx + R * Math.cos(s), y1 = cy + R * Math.sin(s);
    const x2 = cx + R * Math.cos(e), y2 = cy + R * Math.sin(e);
    const large = angle > 180 ? 1 : 0;
    const ix1 = cx + IR * Math.cos(e), iy1 = cy + IR * Math.sin(e);
    const ix2 = cx + IR * Math.cos(s), iy2 = cy + IR * Math.sin(s);
    const path = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${IR} ${IR} 0 ${large} 0 ${ix2} ${iy2} Z`;
    current += angle;
    return { ...seg, path };
  });

  return (
    <Svg width={W} height={H}>
      {slices.map((s, i) => <Path key={i} d={s.path} fill={s.color} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />)}
      <Circle cx={cx} cy={cy} r={IR} fill="transparent" />
      <SvgText x={cx} y={cy - 2} fill={G.txtMain} fontSize={W * 0.16} fontWeight="900" textAnchor="middle">{total}</SvgText>
      <SvgText x={cx} y={cy + 14} fill={G.txtFaint} fontSize={W * 0.08} textAnchor="middle" fontWeight="800">TASKS</SvgText>
    </Svg>
  );
}

function NeonBarsH({ data, width }) {
  const W = width || FULL_CW;
  const LABEL_W = 85, PCT_W = 40, PAD_H = 12, BAR_W = W - LABEL_W - PCT_W - PAD_H, ROW_H = 46;
  const H = (data?.length || 0) * ROW_H + 16;

  if (!data?.length) return <Svg width={W} height={60}><SvgText x={W/2} y={30} fill={G.txtFaint} textAnchor="middle" fontSize={12}>No data</SvgText></Svg>;

  return (
    <Svg width={W} height={H}>
      {data.map((d, i) => {
        const pct = Math.min(Math.max(d.rate || 0, 0), 100);
        const fillW = Math.max((pct / 100) * BAR_W, 6);
        const y = i * ROW_H + 10;
        const color = NEON_COLORS[i % NEON_COLORS.length];
        return (
          <SvgG key={i}>
            <SvgText x={0} y={y + 16} fill={G.txtMain} fontSize={12} fontWeight="800">{(d.username || '').slice(0, 10)}</SvgText>
            <Rect x={LABEL_W} y={y + 4} width={BAR_W} height={16} rx={8} fill="rgba(0,0,0,0.05)" />
            {fillW > 0 && <Rect x={LABEL_W} y={y + 4} width={fillW} height={16} rx={8} fill={color} />}
            <SvgText x={W - PCT_W + 8} y={y + 16} fill={color} fontSize={12} fontWeight="900">{Math.round(pct)}%</SvgText>
          </SvgG>
        );
      })}
    </Svg>
  );
}

function VerticalBars({ data, width }) {
  const W = width || HALF_CW, H = 150;
  const PAD = { t: 20, b: 32, l: 10, r: 10 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;

  const items = (data || []).slice(0, 6);
  if (!items.length) return <Svg width={W} height={H}><SvgText x={W/2} y={H/2} fill={G.txtFaint} textAnchor="middle" fontSize={11}>No data</SvgText></Svg>;

  const maxV = Math.max(...items.map(d => d.total || 0), 1);
  const barW = (cW / items.length) * 0.6;
  const gap  = cW / items.length;

  return (
    <Svg width={W} height={H}>
      {items.map((d, i) => {
        const barH = ((d.total || 0) / maxV) * cH;
        const x = PAD.l + i * gap + (gap - barW) / 2;
        const y = PAD.t + cH - barH;
        const color = NEON_COLORS[i % NEON_COLORS.length];
        return (
          <SvgG key={i}>
            <Rect x={x} y={y} width={barW} height={barH} rx={4} fill={color} />
            <SvgText x={x + barW/2} y={y - 6} fill={color} fontSize={11} fontWeight="900" textAnchor="middle">{d.total || 0}</SvgText>
            <SvgText x={x + barW/2} y={H - 6} fill={G.txtFaint} fontSize={10} fontWeight="800" textAnchor="middle">{(d.username || '').slice(0, 4)}</SvgText>
          </SvgG>
        );
      })}
    </Svg>
  );
}

function BubbleChart({ data, width }) {
  const W = width || HALF_CW, H = 150;
  const PAD = { t: 10, b: 28, l: 26, r: 10 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;

  if (!data?.length) return <Svg width={W} height={H}><SvgText x={W/2} y={H/2} fill={G.txtFaint} textAnchor="middle" fontSize={11}>No data</SvgText></Svg>;

  const maxOverdue = Math.max(...data.map(d => d.overdue || 0), 1);
  const maxTotal   = Math.max(...data.map(d => d.total   || 0), 1);

  return (
    <Svg width={W} height={H}>
      {[0, 0.5, 1].map(f => <Line key={`h${f}`} x1={PAD.l} y1={PAD.t + cH * (1-f)} x2={PAD.l + cW} y2={PAD.t + cH * (1-f)} stroke={G.grid} strokeWidth={1.5} />)}
      {[0, 0.5, 1].map(f => <Line key={`v${f}`} x1={PAD.l + cW * f} y1={PAD.t} x2={PAD.l + cW * f} y2={PAD.t + cH} stroke={G.grid} strokeWidth={1.5} />)}
      {data.map((d, i) => {
        const rate = d.rate || 0;
        const x = PAD.l + (rate / 100) * cW;
        const y = PAD.t + cH - ((d.overdue || 0) / maxOverdue) * cH;
        const r = 4 + ((d.total || 0) / maxTotal) * 10;
        const color = barColor(rate);
        return <Circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.85} stroke={G.white} strokeWidth={1.5} />;
      })}
      <SvgText x={PAD.l + cW/2} y={H - 4} fill={G.txtFaint} fontSize={9} fontWeight="800" textAnchor="middle">Rate %</SvgText>
      <SvgText x={6} y={PAD.t + cH/2} fill={G.txtFaint} fontSize={9} fontWeight="800" textAnchor="middle" rotation="-90" originX="6" originY={PAD.t + cH/2}>OD</SvgText>
    </Svg>
  );
}

function StackedBars({ data, width }) {
  const W = width || FULL_CW, LABEL_W = 80, ROW_H = 36;
  const H = (data?.length || 0) * ROW_H + 16, BAR_W = W - LABEL_W - 8;
  if (!data?.length) return <Svg width={W} height={60}><SvgText x={W/2} y={30} fill={G.txtFaint} textAnchor="middle" fontSize={12}>No data</SvgText></Svg>;

  const SEGS = [{ key: 'todo', color: G.blue }, { key: 'in_progress', color: G.amber }, { key: 'completed', color: G.green }, { key: 'overdue', color: G.pink }];

  return (
    <Svg width={W} height={H}>
      {data.map((d, i) => {
        const total = (d.todo || 0) + (d.in_progress || 0) + (d.completed || 0) + (d.overdue || 0);
        const y = i * ROW_H + 10;
        let offsetX = LABEL_W;
        return (
          <SvgG key={i}>
            <SvgText x={0} y={y + 14} fill={G.txtMain} fontSize={11} fontWeight="800">{(d.username || '').slice(0, 10)}</SvgText>
            <Rect x={LABEL_W} y={y + 2} width={BAR_W} height={16} rx={5} fill="rgba(0,0,0,0.05)" />
            {total > 0 && SEGS.map((seg) => {
              const val = d[seg.key] || 0;
              const segW = (val / total) * BAR_W;
              if (segW < 1) return null;
              const sx = offsetX;
              offsetX += segW;
              return <Rect key={seg.key} x={sx} y={y + 2} width={segW} height={16} fill={seg.color} opacity={0.9} />;
            })}
          </SvgG>
        );
      })}
      {SEGS.map((s, i) => (
        <SvgG key={s.key}>
          <Rect x={LABEL_W + i * 54} y={H - 10} width={8} height={8} fill={s.color} rx={4} />
          <SvgText x={LABEL_W + i * 54 + 12} y={H - 2} fill={G.txtFaint} fontSize={9} fontWeight="800">{s.key.replace('_',' ')}</SvgText>
        </SvgG>
      ))}
    </Svg>
  );
}

function HeatGrid({ data, width }) {
  const W = width || HALF_CW, ROWS = 5, COLS = 7, PAD = 6, HPAD = 12;
  const cellW = (W - HPAD * 2 - PAD * (COLS - 1)) / COLS;
  const cellH = cellW * 0.8, H = ROWS * (cellH + PAD) + 28;
  const maxV = Math.max(...(data || []).flat(), 1);

  return (
    <Svg width={W} height={H}>
      {WEEK_SHORT.map((lbl, c) => <SvgText key={c} x={HPAD + c * (cellW + PAD) + cellW / 2} y={12} fill={G.txtFaint} fontSize={10} textAnchor="middle" fontWeight="800">{lbl}</SvgText>)}
      {(data || []).map((row, r) => row.map((val, c) => {
        const opacity = 0.1 + (maxV > 0 ? val / maxV : 0) * 0.9;
        return <Rect key={`${r}-${c}`} x={HPAD + c * (cellW + PAD)} y={20 + r * (cellH + PAD)} width={cellW} height={cellH} rx={4} fill={G.cyan} opacity={opacity} />;
      }))}
    </Svg>
  );
}

function FunnelChart({ data, width }) {
  const W = width || HALF_CW, PAD_V = 10, STAGES = data?.length || 4, stageH = 32;
  const H = STAGES * (stageH + 6) + PAD_V * 2;
  if (!data?.length) return <Svg width={W} height={80}><SvgText x={W/2} y={40} fill={G.txtFaint} textAnchor="middle" fontSize={11}>No data</SvgText></Svg>;

  const maxV = Math.max(...data.map(d => d.value || 0), 1);
  const maxWidth = W - 16, minWidth = maxWidth * 0.35;

  return (
    <Svg width={W} height={H}>
      {data.map((stage, i) => {
        const frac = (stage.value || 0) / maxV, bw = minWidth + frac * (maxWidth - minWidth);
        const x = (W - bw) / 2, y = PAD_V + i * (stageH + 6);
        const color = stage.color || NEON_COLORS[i % NEON_COLORS.length];
        const nextFrac = i < data.length - 1 ? (data[i+1].value || 0) / maxV : frac * 0.7;
        const nbw = minWidth + nextFrac * (maxWidth - minWidth), nx = (W - nbw) / 2;
        const path = `M ${x} ${y} L ${x+bw} ${y} L ${nx+nbw} ${y+stageH} L ${nx} ${y+stageH} Z`;

        return (
          <SvgG key={i}>
            <Path d={path} fill={color} opacity={0.8} />
            <SvgText x={W / 2} y={y + stageH/2 + 5} fill={G.white} fontSize={12} fontWeight="900" textAnchor="middle">{stage.label}: {stage.value}</SvgText>
          </SvgG>
        );
      })}
    </Svg>
  );
}

function ConcentricRings({ total, completed, active, overdue, width }) {
  const W = width || FULL_CW, H = 100, cx = W / 2, cy = H / 2;
  const rings = [
    { label: 'Total',   value: total,     color: G.blue,  r: H * 0.42 },
    { label: 'Done',    value: completed, color: G.green, r: H * 0.31 },
    { label: 'Active',  value: active,    color: G.amber, r: H * 0.20 },
    { label: 'Overdue', value: overdue,   color: G.pink,  r: H * 0.09 },
  ];

  const toRad = (deg) => (deg * Math.PI) / 180;
  const arcPath = (cx, cy, r, pct) => {
    if (pct <= 0) return '';
    if (pct >= 1) pct = 0.9999;
    const start = toRad(-90), end = toRad(-90 + pct * 360);
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const large = pct > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const safeTotal = total || 1;

  return (
    <Svg width={W} height={H}>
      {rings.map((ring, i) => {
        const pct = Math.min((ring.value || 0) / safeTotal, 1);
        const path = arcPath(cx, cy, ring.r, pct);
        return (
          <SvgG key={i}>
            <Circle cx={cx} cy={cy} r={ring.r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={7} />
            {path && <Path d={path} fill="none" stroke={ring.color} strokeWidth={7} strokeLinecap="round" />}
          </SvgG>
        );
      })}
      {rings.map((ring, i) => (
        <SvgG key={`lbl${i}`}>
          <Rect x={W * 0.75 + Math.floor(i / 2) * 70} y={20 + (i % 2) * 26} width={10} height={10} fill={ring.color} rx={5} />
          <SvgText x={W * 0.75 + Math.floor(i / 2) * 70 + 16} y={29 + (i % 2) * 26} fill={G.txtMain} fontSize={11} fontWeight="800">{ring.label}: {ring.value || 0}</SvgText>
        </SvgG>
      ))}
    </Svg>
  );
}

function SparkLine({ data, width = 80, height = 30 }) {
  if (!data || data.length < 2) return <Svg width={width} height={height}><Line x1={0} y1={height/2} x2={width} y2={height/2} stroke={G.p300} strokeWidth={2} /></Svg>;
  const maxV = Math.max(...data, 1);
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * width, y: height - 2 - ((v / maxV) * (height - 4)) }));
  const path = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1], cpx = (prev.x + p.x) / 2;
    return `${acc} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
  }, '');
  return <Svg width={width} height={height}><Path d={path} fill="none" stroke={G.p600} strokeWidth={2.5} /></Svg>;
}

// ─── KPI Stat Card ────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, color, style }) {
  return (
    <View style={[{ flex: 1, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 24, padding: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', ...liquidShadow }, style]}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={{ color: G.txtMain, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>{value ?? 0}</Text>
      <Text style={{ color: G.txtFaint, fontSize: 11, fontWeight: '900', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PerformanceChartScreen({ navigation }) {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  const [performance, setPerformance] = useState([]);
  const [myStats,     setMyStats]     = useState(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isRefreshing,setIsRefreshing]= useState(false);
  const [error,       setError]       = useState(null);

  const isManager = user?.role === 'manager' || user?.role === 'supervisor';

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      if (isManager) {
        const [dash, stats] = await Promise.all([
          getManagerDashboard().catch(() => null),
          getTeamStats().catch(() => null),
        ]);
        const raw = dash?.performance || stats?.performance || [];
        setPerformance(raw);
      } else {
        const tasks = await getTasks().catch(() => []);
        const arr   = Array.isArray(tasks) ? tasks : (tasks?.tasks || []);
        const completed  = arr.filter(t => t.status === 'completed').length;
        const in_progress= arr.filter(t => t.status === 'in_progress').length;
        const todo       = arr.filter(t => t.status === 'todo').length;
        const overdue    = arr.filter(t => t.is_overdue || t.overdue).length;
        setMyStats({ completed, active: in_progress, overdue, todo, total: arr.length });
      }
    } catch (e) {
      setError(e?.message || 'Failed to load data');
    }
  }, [isManager]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await fetchData();
      setIsLoading(false);
    })();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  if (isLoading) return <LoadingSpinner fullScreen message="Crunching data..." />;

  // ── Derived data (team) ────────────────────────────────────────────────────
  const teamTotal     = performance.reduce((s, d) => s + (d.total     || 0), 0);
  const teamCompleted = performance.reduce((s, d) => s + (d.completed || 0), 0);
  const teamActive    = performance.reduce((s, d) => s + (d.in_progress || 0), 0);
  const teamOverdue   = performance.reduce((s, d) => s + (d.overdue   || 0), 0);
  const teamTodo      = performance.reduce((s, d) => s + (d.todo      || 0), 0);
  const teamRate      = teamTotal > 0 ? Math.round((teamCompleted / teamTotal) * 100) : 0;

  const weekTrendData  = makeWeekTrend(teamCompleted);
  const multiTrendData = makeMultiTrend(teamCompleted, teamActive, teamOverdue);
  const heatData       = makeHeatData(teamTotal);
  const funnelData     = makeFunnelData(teamTotal, teamCompleted, teamActive, teamTodo);

  const donutSegments = [
    { label: 'Done',     value: teamCompleted,    color: G.green  },
    { label: 'Active',   value: teamActive,       color: G.amber  },
    { label: 'Overdue',  value: teamOverdue,      color: G.red   },
    { label: 'Todo',     value: teamTodo,         color: G.blue   },
  ].filter(s => s.value > 0);

  const sorted       = [...performance].sort((a, b) => (b.rate || 0) - (a.rate || 0));
  const topPerformers= sorted.slice(0, 3);
  const needsHelp    = sorted.slice(-3).reverse().filter(d => (d.rate || 0) < 70);

  // ── Employee derived data ──────────────────────────────────────────────────
  const myTotal     = myStats?.total     || 0;
  const myCompleted = myStats?.completed || 0;
  const myActive    = myStats?.active    || 0;
  const myOverdue   = myStats?.overdue   || 0;
  const myTodo      = myStats?.todo      || 0;
  const myRate      = myTotal > 0 ? Math.round((myCompleted / myTotal) * 100) : 0;

  const myWeekTrend = makeWeekTrend(myCompleted);
  const myFunnel    = makeFunnelData(myTotal, myCompleted, myActive, myTodo);
  const myDonut     = [
    { label: 'Done',    value: myCompleted, color: G.green },
    { label: 'Active',  value: myActive,    color: G.amber },
    { label: 'Overdue', value: myOverdue,   color: G.red  },
    { label: 'Todo',    value: myTodo,      color: G.blue  },
  ].filter(s => s.value > 0);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* ── Stable Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.amberBg }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -60, backgroundColor: G.p300, transform: [{ scale: 1.2 }] }]} />
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Analytics</Text>
            {isManager && <Text style={styles.headerSubtitle}>{performance.length} members</Text>}
          </View>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={G.p700} />}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ─── TEAM VIEW ──────────────────────────────────────────────────── */}
        {isManager ? (
          <>
            {/* 1. KPI Stats */}
            <Text style={styles.sectionLabel}>TEAM OVERVIEW</Text>
            <View style={styles.bentoRow}>
              <KpiCard label="Done"    value={teamCompleted} icon="checkmark-circle" color={G.green} />
              <KpiCard label="Active"  value={teamActive}    icon="time"             color={G.amber} />
            </View>
            <View style={styles.bentoRow}>
              <KpiCard label="Overdue" value={teamOverdue}   icon="alert-circle"     color={G.red} />
              <KpiCard label="Total"   value={teamTotal}     icon="layers"           color={G.blue} />
            </View>

            {/* 2. AreaLineChart */}
            <BentoBox title="7-Day Completion Trend" subtitle="Tasks completed per day" color={G.cyan}>
              <AreaLineChart data={weekTrendData} width={FULL_CW} color={G.cyan} gradId="areaCyan" />
            </BentoBox>

            {/* 3. MultiLineChart */}
            <BentoBox title="Weekly Metrics" subtitle="Completed / Active / Overdue" color={G.purple}>
              <MultiLineChart data={multiTrendData} width={FULL_CW} />
            </BentoBox>

            {/* 4. Gauge + Donut */}
            <View style={styles.bentoRow}>
              <BentoBox title="Completion" color={G.cyan} style={styles.bentoItem}>
                <View style={{ alignItems: 'center' }}><NeonGauge rate={teamRate} width={HALF_CW} color={G.cyan} label="Team Rate" /></View>
              </BentoBox>
              <BentoBox title="Distribution" color={G.purple} style={styles.bentoItem}>
                <View style={{ alignItems: 'center' }}><NeonDonut segments={donutSegments} total={teamTotal} width={HALF_CW} /></View>
              </BentoBox>
            </View>

            {/* 5. NeonBarsH - Ranking */}
            <BentoBox title="Completion Rate Ranking" subtitle="Team member performance" color={G.green}>
              <NeonBarsH data={sorted} width={FULL_CW} />
            </BentoBox>

            {/* 6. VerticalBars + BubbleChart */}
            <View style={styles.bentoRow}>
              <BentoBox title="Task Volume" color={G.amber} style={styles.bentoItem}>
                <VerticalBars data={performance} width={HALF_CW} />
              </BentoBox>
              <BentoBox title="Rate vs OD" color={G.pink} style={styles.bentoItem}>
                <BubbleChart data={performance} width={HALF_CW} />
              </BentoBox>
            </View>

            {/* 7. StackedBars */}
            <BentoBox title="Task Status Breakdown" subtitle="Per-member stacked view" color={G.blue}>
              <StackedBars data={performance} width={FULL_CW} />
            </BentoBox>

            {/* 8. FunnelChart + HeatGrid */}
            <View style={styles.bentoRow}>
              <BentoBox title="Pipeline" color={G.amber} style={styles.bentoItem}>
                <FunnelChart data={funnelData} width={HALF_CW} />
              </BentoBox>
              <BentoBox title="Activity" color={G.cyan} style={styles.bentoItem}>
                <HeatGrid data={heatData} width={HALF_CW} />
              </BentoBox>
            </View>

            {/* 9. Spotlight cards */}
            {topPerformers.length > 0 && (
              <BentoBox title="Top Performers" subtitle="Highest completion rates" color={G.green}>
                {topPerformers.map((d, i) => (
                  <View key={d.user_id || i} style={styles.spotRow}>
                    <View style={[styles.rankBadge, { backgroundColor: G.green + '20', borderColor: G.green + '50' }]}>
                      <Text style={{ color: G.green, fontWeight: '900', fontSize: 13 }}>#{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: G.txtMain, fontWeight: '900', fontSize: 15 }}>{d.username || 'Unknown'}</Text>
                      <Text style={{ color: G.txtFaint, fontSize: 11, marginTop: 2, fontWeight: '800', textTransform: 'uppercase' }}>{d.role || ''}</Text>
                    </View>
                    <SparkLine data={makeWeekTrend(d.completed || 0)} width={72} height={28} />
                    <Text style={{ color: G.green, fontWeight: '900', fontSize: 18, marginLeft: 12 }}>{Math.round(d.rate || 0)}%</Text>
                  </View>
                ))}
              </BentoBox>
            )}

            {needsHelp.length > 0 && (
              <BentoBox title="Needs Attention" subtitle="Below 70% completion" color={G.red}>
                {needsHelp.map((d, i) => (
                  <View key={d.user_id || i} style={styles.spotRow}>
                    <View style={[styles.rankBadge, { backgroundColor: G.red + '20', borderColor: G.red + '50' }]}>
                      <Ionicons name="warning" size={16} color={G.red} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: G.txtMain, fontWeight: '900', fontSize: 15 }}>{d.username || 'Unknown'}</Text>
                      <Text style={{ color: G.txtFaint, fontSize: 11, marginTop: 2, fontWeight: '800', textTransform: 'uppercase' }}>{d.completed || 0} done / {d.overdue || 0} overdue</Text>
                    </View>
                    <SparkLine data={makeWeekTrend(d.completed || 0)} width={72} height={28} />
                    <Text style={{ color: G.red, fontWeight: '900', fontSize: 18, marginLeft: 12 }}>{Math.round(d.rate || 0)}%</Text>
                  </View>
                ))}
              </BentoBox>
            )}

            {/* 10. Member detail cards */}
            {performance.length > 0 && (
              <BentoBox title="Member Details" subtitle="Full metrics per member" color={G.purple}>
                {performance.map((d, i) => (
                  <View key={d.user_id || i} style={styles.memberRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={[styles.rankBadge, { backgroundColor: NEON_COLORS[i % NEON_COLORS.length] + '20', borderColor: NEON_COLORS[i % NEON_COLORS.length] + '50' }]}>
                        <Text style={{ color: NEON_COLORS[i % NEON_COLORS.length], fontWeight: '900', fontSize: 14 }}>{(d.username || '?').charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: G.txtMain, fontWeight: '900', fontSize: 16 }}>{d.username || 'Unknown'}</Text>
                        <Text style={{ color: G.txtFaint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{d.role || 'Employee'}</Text>
                      </View>
                      <SparkLine data={makeWeekTrend(d.completed || 0)} width={80} height={30} />
                      <Text style={{ color: NEON_COLORS[i % NEON_COLORS.length], fontWeight: '900', fontSize: 18, marginLeft: 12 }}>{Math.round(d.rate || 0)}%</Text>
                    </View>
                    <ConcentricRings total={d.total || 0} completed={d.completed || 0} active={d.in_progress || 0} overdue={d.overdue || 0} width={FULL_CW} />
                  </View>
                ))}
              </BentoBox>
            )}
          </>
        ) : (
          /* ─── EMPLOYEE VIEW ──────────────────────────────────────────────── */
          <>
            <Text style={styles.sectionLabel}>MY PERFORMANCE</Text>

            {/* 1. KPI Strip */}
            <View style={styles.bentoRow}>
              <KpiCard label="Done"    value={myCompleted} icon="checkmark-circle" color={G.green} />
              <KpiCard label="Active"  value={myActive}    icon="time"             color={G.amber} />
            </View>
            <View style={styles.bentoRow}>
              <KpiCard label="Overdue" value={myOverdue}   icon="alert-circle"     color={G.red} />
              <KpiCard label="Total"   value={myTotal}     icon="layers"           color={G.blue} />
            </View>

            {/* 2. Gauge + Donut */}
            <View style={styles.bentoRow}>
              <BentoBox title="My Rate" color={G.cyan} style={styles.bentoItem}>
                <View style={{ alignItems: 'center' }}><NeonGauge rate={myRate} width={HALF_CW} color={G.cyan} label="Completion" /></View>
              </BentoBox>
              <BentoBox title="Breakdown" color={G.purple} style={styles.bentoItem}>
                <View style={{ alignItems: 'center' }}><NeonDonut segments={myDonut} total={myTotal} width={HALF_CW} /></View>
              </BentoBox>
            </View>

            {/* 3. AreaLineChart */}
            <BentoBox title="My Weekly Trend" subtitle="Estimated completion per day" color={G.cyan}>
              <AreaLineChart data={myWeekTrend} width={FULL_CW} color={G.cyan} gradId="myAreaCyan" />
            </BentoBox>

            {/* 4. ConcentricRings */}
            <BentoBox title="My Task Rings" subtitle="Visual breakdown of metrics" color={G.blue}>
              <ConcentricRings total={myTotal} completed={myCompleted} active={myActive} overdue={myOverdue} width={FULL_CW} />
            </BentoBox>

            {/* 5. FunnelChart */}
            <BentoBox title="My Task Pipeline" subtitle="From total → completed" color={G.amber}>
              <FunnelChart data={myFunnel} width={FULL_CW} />
            </BentoBox>

            {/* 6. Tip card */}
            <BentoBox title="Pro Tip" color={G.green}>
              <View style={{ alignItems: 'center', paddingTop: 10 }}>
                <Ionicons name="bulb" size={32} color={G.amber} style={{ marginBottom: 12 }} />
                <Text style={{ color: G.txtMain, fontSize: 18, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' }}>
                  {myRate >= 80 ? 'Excellent Work!' : myRate >= 50 ? 'Good Progress' : 'Time to Build Momentum'}
                </Text>
                <Text style={{ color: G.txtFaint, fontSize: 14, lineHeight: 22, fontWeight: '700', textAlign: 'center' }}>
                  {myRate >= 80
                    ? 'You are ahead of the curve. Keep completing tasks before deadlines.'
                    : myRate >= 50
                    ? 'Solid progress! Focus on clearing overdue tasks first to boost your rate.'
                    : 'Start with the smallest tasks to build momentum. Review overdue items daily.'}
                </Text>
              </View>
            </BentoBox>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── BentoBox Wrapper Component ───────────────────────────────────────────────
const BentoBox = ({ children, style, title, subtitle, color = G.p700 }) => (
  <View style={[styles.shadowWrap, { marginBottom: GAP }, style]}>
    <View style={styles.glassLight}>
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
      <View style={styles.glassHighlight} />
      
      {title && (
        <View style={{ paddingHorizontal: CPAD, paddingTop: CPAD, paddingBottom: 10 }}>
          <Text style={{ color: color, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 }}>{title}</Text>
          {subtitle && <Text style={{ color: G.txtFaint, fontSize: 13, fontWeight: '700', marginTop: 2 }}>{subtitle}</Text>}
        </View>
      )}
      <View style={{ paddingHorizontal: CPAD, paddingBottom: CPAD, paddingTop: title ? 0 : CPAD }}>
        {children}
      </View>
    </View>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4, filter: [{ blur: 50 }] },

  // ── Header
  header: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,255,255,0.9)',
    ...liquidShadow, zIndex: 10,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingBottom: 15 },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: G.txtFaint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },

  scroll: { flex: 1 },
  
  // ── Glass & Shadows
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  
  bentoRow: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  bentoItem: { flex: 1, marginBottom: 0 },

  sectionLabel: { color: G.txtFaint, fontSize: 12, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: GAP, paddingLeft: 4 },
  errorBanner: { padding: 16, marginBottom: GAP, borderRadius: 16, backgroundColor: G.redBg, borderWidth: 1.5, borderColor: '#FCA5A5' },
  errorText: { color: G.red, fontSize: 14, fontWeight: '800', textAlign: 'center' },

  // ── Spotlights & Rows
  spotRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.04)' },
  rankBadge: { width: 38, height: 38, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  overduePill: { backgroundColor: G.white, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1.5, borderColor: '#FECACA' },
  overdueText: { fontSize: 11, fontWeight: '900', color: G.red },
  memberRow: { paddingVertical: 14, borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.04)' },
  
  noData: { color: G.txtFaint, fontSize: 14, textAlign: 'center', paddingVertical: 20, fontStyle: 'italic', fontWeight: '700' },
  allClearWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  allClearText: { fontSize: 15, color: G.green, fontWeight: '900' },
});