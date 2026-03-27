import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, RefreshControl,
} from 'react-native';
import Svg, {
  Rect, Circle, Path, Defs,
  LinearGradient as SvgGrad, Stop,
  Line, Text as SvgText,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { getTasks, getExpenses, getRequirements } from '../services/api';

// ─── Palette ──────────────────────────────────────────────────────────────────
const B = {
  bg0: '#EEF6FF', bg1: '#DBEAFE', bg2: '#F0F9FF',
  b100: '#DBEAFE', b200: '#BFDBFE', b300: '#93C5FD',
  b400: '#60A5FA', b500: '#3B82F6', b600: '#2563EB', b700: '#1D4ED8', b900: '#1E3A8A',
  sky: '#0EA5E9', cyan: '#0284C7', violet: '#7C3AED', indigo: '#4338CA',
  green: '#059669', greenBg: '#D1FAE5',
  teal: '#0D9488', tealBg: '#CCFBF1',
  amber: '#D97706', amberBg: '#FEF3C7',
  red: '#DC2626', redBg: '#FEE2E2',
  orange: '#EA580C', orangeBg: '#FFEDD5',
  purple: '#7C3AED', purpleBg: '#EDE9FE',
  txtMain: '#0F172A', txtMuted: '#1E293B', txtFaint: '#64748B', txtLight: '#94A3B8',
  white: '#FFFFFF',
  gridLine: 'rgba(59,130,246,0.09)',
};

const ROLE_COLORS = {
  manager:    { color: '#5B4FAE', bg: '#EDE9F8' },
  supervisor: { color: '#1565C0', bg: '#E3F2FD' },
  employee:   { color: '#2E7D32', bg: '#E8F5E9' },
  finance:    { color: '#E65100', bg: '#FFF3E0' },
};

const AVATAR_PALETTE = ['#7C6FCD', '#F5A67D', '#4CAF50', '#2196F3', '#E91E63', '#FF9800', '#0EA5E9', '#7C3AED'];

// ─── Layout ───────────────────────────────────────────────────────────────────
const SW      = Dimensions.get('window').width;
const GUTTER  = 16;
const GAP     = 10;
const CPAD    = 14;
const FULL_W  = SW - GUTTER * 2;
const HALF_W  = (FULL_W - GAP) / 2;
const FULL_CW = FULL_W - CPAD * 2;
const HALF_CW = HALF_W - CPAD * 2;

// ─── Date helpers ─────────────────────────────────────────────────────────────
const DAYS     = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const fmtShort = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

const getWeekDates = (ref) => {
  const d   = new Date(ref);
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sun);
    day.setDate(sun.getDate() + i);
    return day;
  });
};

const isOverdue = (t) => {
  if ((t.status || '').toLowerCase() === 'completed') return false;
  const dl = t.deadline || t.due_date;
  return dl ? new Date(dl) < new Date() : false;
};

const calcStreak = (tasks) => {
  const doneSet = new Set(
    tasks
      .filter(t => (t.status || '').toLowerCase() === 'completed')
      .map(t => { const d = t.deadline || t.due_date || t.created_at; return d ? d.split('T')[0] : null; })
      .filter(Boolean)
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (doneSet.has(fmtDate(d))) streak++;
    else if (i > 0) break;
  }
  return streak;
};

const getLast28 = (tasks) =>
  Array.from({ length: 28 }, (_, i) => {
    const d  = new Date();
    d.setDate(d.getDate() - (27 - i));
    const ds = fmtDate(d);
    const day = tasks.filter(t => {
      const td = t.deadline || t.due_date || t.created_at;
      return td && td.startsWith(ds);
    });
    return {
      date: d,
      total: day.length,
      done: day.filter(t => (t.status || '').toLowerCase() === 'completed').length,
    };
  });

// ─── SVG helpers ──────────────────────────────────────────────────────────────
const smoothLine = (pts, w, h, maxY, padY = 12) => {
  if (!pts.length) return '';
  const n  = pts.length;
  const xs = pts.map((_, i) => (i / (n - 1)) * w);
  const ys = pts.map(v => h - padY - ((v / Math.max(maxY, 1)) * (h - padY * 2)));
  if (n === 1) return `M ${xs[0]} ${ys[0]}`;
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < n; i++) {
    const cpx = (xs[i-1] + xs[i]) / 2;
    d += ` C ${cpx} ${ys[i-1]}, ${cpx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  return d;
};

const areaPath = (pts, w, h, maxY, padY = 12) => {
  const line = smoothLine(pts, w, h, maxY, padY);
  return line ? `${line} L ${w} ${h} L 0 ${h} Z` : '';
};

const arcSeg = (cx, cy, R, r, startDeg, endDeg) => {
  const rad   = d => (d * Math.PI) / 180;
  const s     = rad(startDeg), e = rad(endDeg);
  const sweep = endDeg - startDeg;
  const lg    = sweep > 180 ? 1 : 0;
  const x1 = cx + R * Math.cos(s), y1 = cy + R * Math.sin(s);
  const x2 = cx + R * Math.cos(e), y2 = cy + R * Math.sin(e);
  const x3 = cx + r * Math.cos(e), y3 = cy + r * Math.sin(e);
  const x4 = cx + r * Math.cos(s), y4 = cy + r * Math.sin(s);
  if (sweep <= 0) return '';
  return `M ${x1} ${y1} A ${R} ${R} 0 ${lg} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${lg} 0 ${x4} ${y4} Z`;
};

// ─── GlassCard ────────────────────────────────────────────────────────────────
const GlassCard = ({ children, style, accent, noPad }) => (
  <View style={[styles.card, style]}>
    <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
    <LinearGradient
      colors={['rgba(255,255,255,0.86)', 'rgba(240,249,255,0.55)']}
      style={StyleSheet.absoluteFill}
    />
    {accent ? <View style={[styles.cardAccent, { backgroundColor: accent }]} /> : null}
    <View style={noPad ? undefined : { padding: CPAD }}>{children}</View>
  </View>
);

// ─── KpiPill ──────────────────────────────────────────────────────────────────
const KpiPill = ({ value, label, icon, color, bg }) => (
  <GlassCard style={{ flex: 1 }}>
    <View style={{ alignItems: 'center', gap: 5 }}>
      <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  </GlassCard>
);

// ─── CompletionGauge ─────────────────────────────────────────────────────────
const CompletionGauge = ({ pct }) => {
  const W    = HALF_CW;
  const H    = W * 0.62;
  const cx   = W / 2, cy = H + 4;
  const R    = W * 0.42;
  const STW  = 14;
  const circ   = 2 * Math.PI * R;
  const arcLen = Math.PI * R;
  const filled = (pct / 100) * arcLen;

  return (
    <Svg width={W} height={H + 8}>
      <Defs>
        <SvgGrad id="ugBg" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={B.b200} /><Stop offset="1" stopColor={B.b100} />
        </SvgGrad>
        <SvgGrad id="ugFill" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={B.sky} /><Stop offset="0.5" stopColor={B.b500} /><Stop offset="1" stopColor={B.violet} />
        </SvgGrad>
      </Defs>
      <Circle cx={cx} cy={cy} r={R} stroke="url(#ugBg)"   strokeWidth={STW} fill="none" strokeLinecap="round"
        strokeDasharray={`${arcLen} ${circ}`} rotation="-180" origin={`${cx},${cy}`} />
      {filled > 2 && (
        <Circle cx={cx} cy={cy} r={R} stroke="url(#ugFill)" strokeWidth={STW} fill="none" strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`} rotation="-180" origin={`${cx},${cy}`} />
      )}
      <SvgText x={cx} y={cy - R * 0.28} textAnchor="middle" fill={B.txtMain}  fontSize="22" fontWeight="900">{pct}%</SvgText>
      <SvgText x={cx} y={cy - R * 0.28 + 17} textAnchor="middle" fill={B.txtFaint} fontSize="10" fontWeight="700">complete</SvgText>
    </Svg>
  );
};

// ─── RadialRing ───────────────────────────────────────────────────────────────
const RadialRing = ({ value, max, label, color, size = 68 }) => {
  const R   = size * 0.38;
  const STW = 7;
  const cx  = size / 2, cy = size / 2;
  const circ   = 2 * Math.PI * R;
  const filled = max > 0 ? (value / max) * circ * 0.78 : 0;
  const uid    = label.replace(/\s/g, '_');

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGrad id={`rr_${uid}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.25" />
            <Stop offset="1" stopColor={color} stopOpacity="0.1"  />
          </SvgGrad>
        </Defs>
        <Circle cx={cx} cy={cy} r={R} stroke={`url(#rr_${uid})`} strokeWidth={STW} fill="none" strokeLinecap="round"
          strokeDasharray={`${circ * 0.78} ${circ}`} rotation="-101" origin={`${cx},${cy}`} />
        {filled > 1 && (
          <Circle cx={cx} cy={cy} r={R} stroke={color} strokeWidth={STW} fill="none" strokeLinecap="round"
            strokeDasharray={`${filled} ${circ}`} rotation="-101" origin={`${cx},${cy}`} />
        )}
        <SvgText x={cx} y={cy + 5} textAnchor="middle" fill={B.txtMain} fontSize="15" fontWeight="900">{value}</SvgText>
      </Svg>
      <Text style={{ fontSize: 10, color: B.txtFaint, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </View>
  );
};

// ─── WeekAreaChart ────────────────────────────────────────────────────────────
const WeekAreaChart = ({ data }) => {
  const W    = FULL_CW;
  const H    = 130;
  const maxY = Math.max(...data.map(d => d.total), 1);
  const barW = W / data.length;
  const donePts  = data.map(d => d.completed);
  const totalPts = data.map(d => d.total);

  return (
    <Svg width={W} height={H + 24}>
      <Defs>
        <SvgGrad id="wtArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={B.b300} stopOpacity="0.25" /><Stop offset="1" stopColor={B.b300} stopOpacity="0.02" />
        </SvgGrad>
        <SvgGrad id="wdArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={B.b600} stopOpacity="0.45" /><Stop offset="1" stopColor={B.b600} stopOpacity="0.03" />
        </SvgGrad>
        <SvgGrad id="wbGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={B.b500} /><Stop offset="1" stopColor={B.sky} />
        </SvgGrad>
      </Defs>
      {[0.33, 0.66, 1].map((f, i) => (
        <Line key={i} x1={0} y1={H - f * H * 0.85} x2={W} y2={H - f * H * 0.85}
          stroke={B.gridLine} strokeWidth={1} strokeDasharray="4 6" />
      ))}
      <Path d={areaPath(totalPts, W, H, maxY)} fill="url(#wtArea)" />
      <Path d={smoothLine(totalPts, W, H, maxY)} fill="none" stroke={B.b300} strokeWidth={1.5} />
      <Path d={areaPath(donePts, W, H, maxY)} fill="url(#wdArea)" />
      <Path d={smoothLine(donePts, W, H, maxY)} fill="none" stroke={B.b600} strokeWidth={2.5} />
      {data.map((d, i) => {
        const x      = i * barW + barW * 0.28;
        const bw     = barW * 0.44;
        const totalH = d.total > 0     ? Math.max((d.total     / maxY) * H * 0.85, 5) : 3;
        const doneH  = d.completed > 0 ? Math.max((d.completed / maxY) * H * 0.85, 5) : 0;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={H - totalH} width={bw} height={totalH} rx={4} fill={B.b200} opacity={0.5} />
            {doneH > 0 && <Rect x={x} y={H - doneH} width={bw} height={doneH} rx={4} fill="url(#wbGrad)" />}
            <SvgText x={x + bw / 2} y={H + 16} textAnchor="middle" fill={B.txtFaint} fontSize="11" fontWeight="700">
              {DAYS[i]}
            </SvgText>
          </React.Fragment>
        );
      })}
      {donePts.map((v, i) => {
        if (v === 0) return null;
        const x = (i / (donePts.length - 1)) * W;
        const y = H - 12 - ((v / maxY) * (H - 24));
        return <Circle key={i} cx={x} cy={y} r={4} fill={B.white} stroke={B.b600} strokeWidth={2} />;
      })}
    </Svg>
  );
};

// ─── DonutChart ───────────────────────────────────────────────────────────────
const DonutChart = ({ total, done, active, overdue, todo }) => {
  const W  = HALF_CW;
  const cx = W / 2, cy = W / 2;
  const R  = W * 0.42, r = R * 0.6;
  const segs = [
    { val: done,    color: B.b600 },
    { val: active,  color: B.sky  },
    { val: todo,    color: B.b300 },
    { val: overdue, color: B.red  },
  ].filter(s => s.val > 0);
  const sum = segs.reduce((s, x) => s + x.val, 0) || 1;
  let cursor = -90;
  return (
    <Svg width={W} height={W}>
      {segs.map((seg, i) => {
        const sweep = (seg.val / sum) * 356;
        const path  = arcSeg(cx, cy, R, r, cursor, cursor + sweep);
        cursor += sweep + (360 / sum) * (4 / sum);
        return path ? <Path key={i} d={path} fill={seg.color} /> : null;
      })}
      <Circle cx={cx} cy={cy} r={r - 2} fill="rgba(255,255,255,0.88)" />
      <SvgText x={cx} y={cy - 5}  textAnchor="middle" fill={B.txtMain}  fontSize="20" fontWeight="900">{total}</SvgText>
      <SvgText x={cx} y={cy + 12} textAnchor="middle" fill={B.txtFaint} fontSize="10" fontWeight="700">tasks</SvgText>
    </Svg>
  );
};

// ─── PriorityBars ─────────────────────────────────────────────────────────────
const PriorityBars = ({ priorities }) => {
  const ITEMS = [
    { key: 'critical', label: 'Critical', color: B.red,    bg: B.redBg    },
    { key: 'high',     label: 'High',     color: B.orange, bg: B.orangeBg },
    { key: 'medium',   label: 'Medium',   color: B.amber,  bg: B.amberBg  },
    { key: 'low',      label: 'Low',      color: B.green,  bg: B.greenBg  },
  ];
  const maxC   = Math.max(...ITEMS.map(i => priorities[i.key] || 0), 1);
  const barMax = HALF_CW - 48;
  return (
    <View style={{ gap: 10 }}>
      {ITEMS.map(item => {
        const count = priorities[item.key] || 0;
        const w     = count > 0 ? Math.max((count / maxC) * barMax, 10) : 0;
        return (
          <View key={item.key}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: B.txtFaint, fontWeight: '700' }}>{item.label}</Text>
              <Text style={{ fontSize: 11, color: item.color, fontWeight: '800' }}>{count}</Text>
            </View>
            <View style={{ height: 7, backgroundColor: item.bg, borderRadius: 6 }}>
              {w > 0 && <View style={{ height: 7, width: w, backgroundColor: item.color, borderRadius: 6 }} />}
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ─── MonthSparkLine ───────────────────────────────────────────────────────────
const MonthSparkLine = ({ data }) => {
  const W    = FULL_CW;
  const H    = 56;
  const vals = data.map(d => d.done);
  const maxY = Math.max(...vals, 1);
  return (
    <Svg width={W} height={H + 4}>
      <Defs>
        <SvgGrad id="uspk" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={B.cyan} stopOpacity="0.4" />
          <Stop offset="1" stopColor={B.cyan} stopOpacity="0.02" />
        </SvgGrad>
      </Defs>
      <Path d={areaPath(vals, W, H, maxY, 6)} fill="url(#uspk)" />
      <Path d={smoothLine(vals, W, H, maxY, 6)} fill="none" stroke={B.cyan} strokeWidth={2} />
      {(() => {
        const n = vals.length;
        const y = H - 6 - ((vals[n-1] / maxY) * (H - 12));
        return vals[n-1] > 0
          ? <Circle cx={W} cy={y} r={4} fill={B.white} stroke={B.cyan} strokeWidth={2} />
          : null;
      })()}
    </Svg>
  );
};

// ─── HeatGrid ────────────────────────────────────────────────────────────────
const HeatGrid = ({ data }) => {
  const CELL = (FULL_CW - 6 * 3) / 28;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      {data.map((d, i) => {
        const ratio = d.total > 0 ? d.done / d.total : 0;
        const bg = ratio === 0 ? B.b100 : ratio < 0.5 ? B.b300 : ratio < 1 ? B.b500 : B.b700;
        return <View key={i} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: bg }} />;
      })}
    </View>
  );
};

// ─── ExpenseBar (horizontal bar for amounts) ─────────────────────────────────
const ExpenseBar = ({ label, value, total, color, bg }) => {
  const pct  = total > 0 ? value / total : 0;
  const maxW = FULL_CW - 100;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <Text style={{ width: 70, fontSize: 11, color: B.txtFaint, fontWeight: '700' }}>{label}</Text>
      <View style={{ flex: 1, height: 8, backgroundColor: bg, borderRadius: 6 }}>
        {pct > 0 && <View style={{ height: 8, width: `${pct * 100}%`, backgroundColor: color, borderRadius: 6 }} />}
      </View>
      <Text style={{ width: 46, fontSize: 11, color, fontWeight: '800', textAlign: 'right' }}>
        {value > 999 ? `${(value/1000).toFixed(1)}k` : value}
      </Text>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function UserPerformanceScreen({ route, navigation }) {
  const { targetUser }  = route.params;
  const { user: viewer } = useAuth();
  const insets           = useSafeAreaInsets();

  const [tasks,      setTasks]      = useState([]);
  const [expenses,   setExpenses]   = useState([]);
  const [reqs,       setReqs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay,setSelectedDay]= useState(null);

  const avatarColor = AVATAR_PALETTE[(targetUser.username || '').charCodeAt(0) % AVATAR_PALETTE.length];
  const initials    = (targetUser.username || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const roleConfig  = ROLE_COLORS[targetUser.role] || ROLE_COLORS.employee;

  const load = useCallback(async () => {
    try {
      // All three fetches run in parallel
      const [taskData, expData, reqData] = await Promise.allSettled([
        getTasks({ user_id: targetUser.id, role: targetUser.role, scope: 'self' }),
        getExpenses(),
        getRequirements(),
      ]);

      if (taskData.status === 'fulfilled') {
        setTasks(Array.isArray(taskData.value) ? taskData.value : []);
      }

      if (expData.status === 'fulfilled') {
        // getExpenses returns all expenses the viewer can see; filter to this user
        const all = Array.isArray(expData.value) ? expData.value : [];
        setExpenses(all.filter(e => e.creator === targetUser.username));
      }

      if (reqData.status === 'fulfilled') {
        // getRequirements returns all the viewer can see; filter to this user
        const all = Array.isArray(reqData.value) ? reqData.value : [];
        setReqs(all.filter(r => r.poster?.id === targetUser.id || r.poster?.username === targetUser.username));
      }
    } catch {
      // silent — individual promise rejections already handled above
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetUser.id, targetUser.username]);

  useEffect(() => { load(); }, [load]);

  // ── Task derived stats ──────────────────────────────────────────────────────
  const doneAll    = tasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
  const activeAll  = tasks.filter(t => ['in progress', 'in-progress', 'in_progress'].includes((t.status || '').toLowerCase())).length;
  const overdueAll = tasks.filter(isOverdue).length;
  const todoAll    = tasks.filter(t => ['to do', 'todo'].includes((t.status || '').toLowerCase())).length;
  const totalAll   = tasks.length;
  const completePct= totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;
  const streak     = calcStreak(tasks);

  const priorities = { critical: 0, high: 0, medium: 0, low: 0 };
  tasks.forEach(t => {
    const p = (t.priority || '').toLowerCase();
    if (priorities[p] !== undefined) priorities[p]++;
  });

  const last28     = getLast28(tasks);
  const today      = new Date();
  const weekDates  = getWeekDates(today);
  const weekData   = weekDates.map(d => {
    const ds  = fmtDate(d);
    const day = tasks.filter(t => {
      const td = t.deadline || t.due_date || t.created_at;
      return td && td.startsWith(ds);
    });
    return {
      date:      d,
      total:     day.length,
      completed: day.filter(t => (t.status || '').toLowerCase() === 'completed').length,
    };
  });

  const selectedKey = selectedDay ? fmtDate(selectedDay) : fmtDate(today);
  const dayTasks    = tasks.filter(t => {
    const td = t.deadline || t.due_date || t.created_at;
    return td && td.startsWith(selectedKey);
  });

  // ── Expense derived stats ───────────────────────────────────────────────────
  const expTotal    = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const expApproved = expenses.filter(e => e.status === 'Approved');
  const expPending  = expenses.filter(e => e.status === 'Pending');
  const expRejected = expenses.filter(e => e.is_rejected || e.status === 'Rejected');
  const expPaid     = expenses.filter(e => e.payment_status === 'Paid');
  const expApprovedAmt = expApproved.reduce((s, e) => s + (e.amount || 0), 0);
  const expPendingAmt  = expPending.reduce((s, e) => s + (e.amount || 0), 0);

  // ── Requirement derived stats ───────────────────────────────────────────────
  const reqOpen      = reqs.filter(r => r.status === 'open').length;
  const reqInReview  = reqs.filter(r => r.status === 'in_review').length;
  const reqResolved  = reqs.filter(r => r.status === 'resolved').length;

  // ── Task status color ───────────────────────────────────────────────────────
  const taskStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed')               return { color: B.green,  bg: B.greenBg };
    if (['in progress', 'in-progress', 'in_progress'].includes(s)) return { color: B.b600, bg: B.b100 };
    if (s === 'on hold')                 return { color: B.amber,  bg: B.amberBg };
    if (s === 'cancelled')               return { color: B.red,    bg: B.redBg };
    return { color: B.txtFaint, bg: '#F1F5F9' };
  };

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={[B.bg0, B.bg1]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={B.b600} />
        <Text style={{ marginTop: 12, color: B.txtFaint, fontWeight: '700', fontSize: 13 }}>
          Loading performance…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={[B.bg0, B.bg1, B.bg2]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={B.b700} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Performance</Text>
          <Text style={styles.headerSub}>{targetUser.username}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={B.b600} />
        }
      >
        {/* ── Profile Card ─────────────────────────────────────────────────── */}
        <GlassCard style={styles.fullCard} accent={B.b500}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={[styles.bigAvatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.bigAvatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{targetUser.username}</Text>
              {targetUser.email ? <Text style={styles.profileSub}>{targetUser.email}</Text> : null}
              {targetUser.department ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <Ionicons name="business-outline" size={12} color={B.txtFaint} />
                  <Text style={styles.profileSub}>{targetUser.department}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View style={[styles.roleBadge, { backgroundColor: roleConfig.bg }]}>
                <Text style={[styles.roleBadgeText, { color: roleConfig.color }]}>
                  {(targetUser.role || '').charAt(0).toUpperCase() + (targetUser.role || '').slice(1)}
                </Text>
              </View>
              <Text style={styles.idLabel}>ID #{targetUser.id}</Text>
            </View>
          </View>

          {/* 5-stat overview */}
          <View style={styles.profileStats}>
            {[
              { val: totalAll,        label: 'Tasks',    color: B.b600   },
              { val: doneAll,         label: 'Done',     color: B.green  },
              { val: streak,          label: 'Streak🔥', color: B.amber  },
              { val: expenses.length, label: 'Expenses', color: B.teal   },
              { val: reqs.length,     label: 'Requests', color: B.purple },
            ].map((s, i) => (
              <View key={i} style={styles.profileStatItem}>
                <Text style={[styles.profileStatVal, { color: s.color }]}>{s.val}</Text>
                <Text style={styles.profileStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* ── Task KPI Row ─────────────────────────────────────────────────── */}
        <View style={styles.row}>
          <KpiPill value={totalAll}   label="Total"   icon="layers-outline"      color={B.b600}  bg={B.b100}     />
          <KpiPill value={doneAll}    label="Done"    icon="checkmark-circle"     color={B.green} bg={B.greenBg}  />
          <KpiPill value={activeAll}  label="Active"  icon="play-circle-outline"  color={B.sky}   bg="#E0F2FE"    />
          <KpiPill value={overdueAll} label="Overdue" icon="alert-circle-outline" color={B.red}   bg={B.redBg}    />
        </View>

        {/* ── Completion Gauge + Week Rings ─────────────────────────────────── */}
        <View style={styles.row}>
          <GlassCard style={{ width: HALF_W }} accent={B.sky}>
            <Text style={styles.cardTitle}>Completion Rate</Text>
            <View style={{ alignItems: 'center', paddingTop: 8 }}>
              <CompletionGauge pct={completePct} />
            </View>
          </GlassCard>
          <GlassCard style={{ width: HALF_W }}>
            <Text style={styles.cardTitle}>This Week</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10 }}>
              <RadialRing
                value={weekData.reduce((s, d) => s + d.completed, 0)}
                max={Math.max(weekData.reduce((s, d) => s + d.total, 0), 1)}
                label="Done" color={B.b600} />
              <RadialRing
                value={weekData.reduce((s, d) => s + d.total, 0)}
                max={Math.max(totalAll, 1)}
                label="Week" color={B.sky} />
              <RadialRing value={streak} max={Math.max(streak, 7)} label="Streak" color={B.amber} />
            </View>
          </GlassCard>
        </View>

        {/* ── Weekly Area Chart ────────────────────────────────────────────── */}
        <GlassCard style={styles.fullCard} accent={B.b600}>
          <Text style={styles.cardTitle}>Weekly Activity</Text>
          <Text style={styles.cardSub}>Tasks assigned vs completed this week</Text>
          <View style={{ paddingTop: 10 }}>
            <WeekAreaChart data={weekData} />
          </View>
          <View style={[styles.legend, { marginTop: 8 }]}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: B.b300 }]} /><Text style={styles.legendText}>Assigned</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: B.b600 }]} /><Text style={styles.legendText}>Completed</Text></View>
          </View>
        </GlassCard>

        {/* ── Week Calendar + Task Detail ───────────────────────────────────── */}
        <GlassCard style={styles.fullCard}>
          <Text style={styles.cardTitle}>Task Calendar</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {weekDates.map((d, i) => {
                const ds    = fmtDate(d);
                const sel   = ds === selectedKey;
                const wDay  = weekData[i];
                const hasTasks = wDay.total > 0;
                const allDone  = hasTasks && wDay.completed === wDay.total;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayPill, sel && styles.dayPillActive]}
                    onPress={() => setSelectedDay(d)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dayPillDay, sel && { color: B.white }]}>{DAYS[d.getDay()]}</Text>
                    <Text style={[styles.dayPillNum, sel && { color: B.white }]}>{d.getDate()}</Text>
                    {hasTasks && (
                      <View style={[styles.dayDot, { backgroundColor: sel ? B.white : (allDone ? B.green : B.b500) }]} />
                    )}
                    {wDay.total > 0 && (
                      <Text style={{ fontSize: 9, fontWeight: '800', color: sel ? 'rgba(255,255,255,0.8)' : B.txtLight }}>
                        {wDay.completed}/{wDay.total}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={{ marginTop: 14 }}>
            <Text style={[styles.cardSub, { marginBottom: 10 }]}>
              {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''} · {selectedKey}
            </Text>
            {dayTasks.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Ionicons name="checkmark-circle-outline" size={28} color={B.b300} />
                <Text style={{ fontSize: 13, color: B.txtLight, marginTop: 6, fontWeight: '600' }}>No tasks on this day</Text>
              </View>
            ) : (
              dayTasks.map(t => {
                const sc      = taskStatusColor(t.status);
                const isDone  = (t.status || '').toLowerCase() === 'completed';
                const overdue = isOverdue(t);
                return (
                  <View key={t.id} style={styles.taskRow}>
                    <View style={[styles.taskDot, { backgroundColor: overdue ? B.red : sc.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]} numberOfLines={1}>
                        {t.title || t.name}
                      </Text>
                      {t.deadline || t.due_date ? (
                        <Text style={{ fontSize: 10, color: overdue ? B.red : B.txtLight, fontWeight: '600', marginTop: 1 }}>
                          {overdue ? '⚠ Overdue · ' : ''}{fmtShort(t.deadline || t.due_date)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ gap: 4, alignItems: 'flex-end' }}>
                      <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: sc.color }}>{t.status || 'Todo'}</Text>
                      </View>
                      {t.priority ? (
                        <View style={[styles.priorityPill, {
                          backgroundColor: t.priority.toLowerCase() === 'critical' ? B.redBg
                            : t.priority.toLowerCase() === 'high' ? B.orangeBg
                            : t.priority.toLowerCase() === 'medium' ? B.amberBg : B.greenBg
                        }]}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color:
                            t.priority.toLowerCase() === 'critical' ? B.red
                            : t.priority.toLowerCase() === 'high' ? B.orange
                            : t.priority.toLowerCase() === 'medium' ? B.amber : B.green
                          }}>{t.priority}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </GlassCard>

        {/* ── Donut + Priority ────────────────────────────────────────────── */}
        <View style={styles.row}>
          <GlassCard style={{ width: HALF_W }}>
            <Text style={styles.cardTitle}>By Status</Text>
            <View style={{ alignItems: 'center', paddingTop: 8 }}>
              <DonutChart total={totalAll} done={doneAll} active={activeAll} overdue={overdueAll} todo={todoAll} />
            </View>
            <View style={{ gap: 4, marginTop: 8 }}>
              {[
                { color: B.b600, label: 'Done' },
                { color: B.sky,  label: 'Active' },
                { color: B.b300, label: 'Todo' },
                { color: B.red,  label: 'Overdue' },
              ].map(l => (
                <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
                  <Text style={{ fontSize: 10, color: B.txtFaint, fontWeight: '700' }}>{l.label}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
          <GlassCard style={{ width: HALF_W }}>
            <Text style={styles.cardTitle}>By Priority</Text>
            <View style={{ paddingTop: 10 }}>
              <PriorityBars priorities={priorities} />
            </View>
          </GlassCard>
        </View>

        {/* ── 30-Day Trend ────────────────────────────────────────────────── */}
        <GlassCard style={styles.fullCard}>
          <Text style={styles.cardTitle}>30-Day Completion Trend</Text>
          <Text style={styles.cardSub}>Daily tasks completed over last 28 days</Text>
          <View style={{ paddingTop: 10 }}>
            <MonthSparkLine data={last28} />
          </View>
        </GlassCard>

        {/* ── Activity Heat Grid ───────────────────────────────────────────── */}
        <GlassCard style={styles.fullCard} accent={B.indigo}>
          <Text style={styles.cardTitle}>Activity Heatmap</Text>
          <Text style={styles.cardSub}>Last 28 days — darker = higher completion</Text>
          <View style={{ paddingTop: 10 }}>
            <HeatGrid data={last28} />
          </View>
          <View style={[styles.legend, { marginTop: 10 }]}>
            {[B.b100, B.b300, B.b500, B.b700].map((c, i) => (
              <View key={i} style={[styles.legendDot, { backgroundColor: c, borderRadius: 2, width: 12, height: 12 }]} />
            ))}
            <Text style={{ fontSize: 10, color: B.txtFaint, fontWeight: '600', marginLeft: 4 }}>Low → High</Text>
          </View>
        </GlassCard>

        {/* ── Expenses Section ─────────────────────────────────────────────── */}
        <GlassCard style={styles.fullCard} accent={B.teal}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <View>
              <Text style={styles.cardTitle}>Expenses</Text>
              <Text style={styles.cardSub}>{expenses.length} total · ₹{expTotal.toLocaleString()}</Text>
            </View>
            <View style={[styles.sectionBadge, { backgroundColor: B.tealBg }]}>
              <Ionicons name="wallet-outline" size={16} color={B.teal} />
            </View>
          </View>

          {/* KPI row */}
          <View style={[styles.miniKpiRow, { marginTop: 12 }]}>
            {[
              { val: expApproved.length, label: 'Approved', color: B.green,  bg: B.greenBg },
              { val: expPending.length,  label: 'Pending',  color: B.amber,  bg: B.amberBg },
              { val: expRejected.length, label: 'Rejected', color: B.red,    bg: B.redBg   },
              { val: expPaid.length,     label: 'Paid',     color: B.teal,   bg: B.tealBg  },
            ].map((k, i) => (
              <View key={i} style={[styles.miniKpi, { backgroundColor: k.bg }]}>
                <Text style={[styles.miniKpiVal, { color: k.color }]}>{k.val}</Text>
                <Text style={[styles.miniKpiLabel, { color: k.color }]}>{k.label}</Text>
              </View>
            ))}
          </View>

          {/* Amount bars */}
          <View style={{ marginTop: 14 }}>
            <ExpenseBar label="Approved" value={expApprovedAmt} total={expTotal} color={B.green} bg={B.greenBg} />
            <ExpenseBar label="Pending"  value={expPendingAmt}  total={expTotal} color={B.amber} bg={B.amberBg} />
          </View>

          {/* Recent expenses list */}
          {expenses.slice(0, 5).map(e => (
            <View key={e.id} style={styles.expenseRow}>
              <View style={[styles.expenseDot, {
                backgroundColor: e.is_rejected ? B.red : e.status === 'Approved' ? B.green : B.amber
              }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.expenseTitle} numberOfLines={1}>{e.title}</Text>
                <Text style={{ fontSize: 10, color: B.txtLight, fontWeight: '600', marginTop: 1 }}>
                  {e.category || 'General'} · {fmtShort(e.created_at)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text style={[styles.expenseAmt, { color: e.is_rejected ? B.red : B.txtMain }]}>
                  ₹{(e.amount || 0).toLocaleString()}
                </Text>
                <View style={[styles.statusPill, {
                  backgroundColor: e.is_rejected ? B.redBg : e.status === 'Approved' ? B.greenBg : B.amberBg
                }]}>
                  <Text style={{ fontSize: 9, fontWeight: '800',
                    color: e.is_rejected ? B.red : e.status === 'Approved' ? B.green : B.amber
                  }}>{e.is_rejected ? 'Rejected' : e.status}</Text>
                </View>
              </View>
            </View>
          ))}
          {expenses.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Ionicons name="wallet-outline" size={28} color={B.b300} />
              <Text style={{ fontSize: 13, color: B.txtLight, marginTop: 6, fontWeight: '600' }}>No expenses found</Text>
            </View>
          )}
        </GlassCard>

        {/* ── Requirements Section ─────────────────────────────────────────── */}
        <GlassCard style={styles.fullCard} accent={B.purple}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <View>
              <Text style={styles.cardTitle}>Requirements</Text>
              <Text style={styles.cardSub}>{reqs.length} posted by this user</Text>
            </View>
            <View style={[styles.sectionBadge, { backgroundColor: B.purpleBg }]}>
              <Ionicons name="clipboard-outline" size={16} color={B.purple} />
            </View>
          </View>

          {/* Status pills */}
          <View style={[styles.miniKpiRow, { marginTop: 12 }]}>
            {[
              { val: reqOpen,     label: 'Open',      color: B.b600,   bg: B.b100    },
              { val: reqInReview, label: 'In Review', color: B.amber,  bg: B.amberBg },
              { val: reqResolved, label: 'Resolved',  color: B.green,  bg: B.greenBg },
            ].map((k, i) => (
              <View key={i} style={[styles.miniKpi, { backgroundColor: k.bg, flex: 1 }]}>
                <Text style={[styles.miniKpiVal, { color: k.color }]}>{k.val}</Text>
                <Text style={[styles.miniKpiLabel, { color: k.color }]}>{k.label}</Text>
              </View>
            ))}
          </View>

          {/* Recent requirements */}
          {reqs.slice(0, 5).map(r => {
            const statusColor = r.status === 'resolved'  ? B.green
              : r.status === 'in_review' ? B.amber : B.b600;
            const statusBg = r.status === 'resolved'  ? B.greenBg
              : r.status === 'in_review' ? B.amberBg : B.b100;
            return (
              <View key={r.id} style={styles.reqRow}>
                <View style={[styles.reqCatBadge, { backgroundColor: B.purpleBg }]}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: B.purple, textTransform: 'uppercase' }}>
                    {r.category}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqTitle} numberOfLines={1}>{r.title}</Text>
                  <Text style={{ fontSize: 10, color: B.txtLight, fontWeight: '600', marginTop: 1 }}>
                    {fmtShort(r.created_at)}{r.quantity ? ` · Qty: ${r.quantity}` : ''}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: statusColor }}>
                    {r.status === 'in_review' ? 'Review' : (r.status || '').charAt(0).toUpperCase() + (r.status || '').slice(1)}
                  </Text>
                </View>
              </View>
            );
          })}
          {reqs.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Ionicons name="clipboard-outline" size={28} color={B.b300} />
              <Text style={{ fontSize: 13, color: B.txtLight, marginTop: 6, fontWeight: '600' }}>No requirements found</Text>
            </View>
          )}
        </GlassCard>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: GUTTER, paddingBottom: 12, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: B.txtMain, letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, color: B.b600,    fontWeight: '700', marginTop: 1 },

  scroll: { paddingTop: 4 },

  card: {
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: B.b900, shadowOpacity: 0.1, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: 4 },
  cardTitle:  { fontSize: 14, fontWeight: '900', color: B.txtMain, letterSpacing: -0.3 },
  cardSub:    { fontSize: 11, color: B.txtFaint, fontWeight: '600', marginTop: 2 },

  fullCard: { marginHorizontal: GUTTER, marginBottom: GAP },
  row:      { flexDirection: 'row', gap: GAP, marginHorizontal: GUTTER, marginBottom: GAP },

  kpiIcon:  { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  kpiLabel: { fontSize: 10, color: B.txtFaint, fontWeight: '700' },

  bigAvatar:     { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { fontSize: 22, fontWeight: '900', color: B.white },
  profileName:   { fontSize: 17, fontWeight: '900', color: B.txtMain },
  profileSub:    { fontSize: 12, color: B.txtFaint, fontWeight: '600', marginTop: 2 },
  roleBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText: { fontSize: 11, fontWeight: '800' },
  idLabel:       { fontSize: 11, color: B.txtLight, fontWeight: '700' },

  profileStats: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(59,130,246,0.12)',
  },
  profileStatItem:  { alignItems: 'center', gap: 2 },
  profileStatVal:   { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  profileStatLabel: { fontSize: 10, color: B.txtFaint, fontWeight: '700' },

  legend:     { flexDirection: 'row', gap: 12, alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: B.txtFaint, fontWeight: '700' },

  sectionBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  miniKpiRow: { flexDirection: 'row', gap: 8 },
  miniKpi:    { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, gap: 2 },
  miniKpiVal: { fontSize: 18, fontWeight: '900' },
  miniKpiLabel:{ fontSize: 10, fontWeight: '700' },

  dayPill:       { alignItems: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 14, backgroundColor: B.b100, minWidth: 44 },
  dayPillActive: { backgroundColor: B.b600 },
  dayPillDay:    { fontSize: 10, fontWeight: '800', color: B.txtFaint },
  dayPillNum:    { fontSize: 16, fontWeight: '900', color: B.txtMain },
  dayDot:        { width: 5, height: 5, borderRadius: 3 },

  taskRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(59,130,246,0.07)',
  },
  taskDot:      { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 3 },
  taskTitle:    { fontSize: 13, fontWeight: '700', color: B.txtMuted },
  taskTitleDone:{ textDecorationLine: 'line-through', color: B.txtFaint },
  statusPill:   { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  priorityPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

  expenseRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(59,130,246,0.07)',
  },
  expenseDot:   { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 3 },
  expenseTitle: { fontSize: 13, fontWeight: '700', color: B.txtMuted },
  expenseAmt:   { fontSize: 13, fontWeight: '900' },

  reqRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(59,130,246,0.07)',
  },
  reqCatBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  reqTitle:    { fontSize: 13, fontWeight: '700', color: B.txtMuted },
});
