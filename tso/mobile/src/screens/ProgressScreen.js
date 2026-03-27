import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, RefreshControl, Platform, StatusBar,
} from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText, Defs, LinearGradient as SvgGrad, Stop, Line, G as SvgG } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { getTasks } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

// ─── Layout Constants (Perfect Bento Math) ───────────────────────────────────
const { width: SW } = Dimensions.get('window');
const GUTTER = 16;
const GAP    = 14;
const CPAD   = 20;
const FULL_W  = SW - GUTTER * 2;
const HALF_W  = (FULL_W - GAP) / 2;
const FULL_CW = FULL_W - CPAD * 2;
const HALF_CW = HALF_W - CPAD * 2;

// ─── Liquid Glass High Contrast Palette ──────────────────────────────────────
const G = {
  bgLight:  '#F0F6FF', bgMid: '#E0F2FE', bgDark: '#F8FAFC',
  txtMain:  '#020617', txtMuted: '#1E293B', txtFaint: '#475569',
  p100: '#DBEAFE', p200: '#BFDBFE', p300: '#93C5FD', p400: '#60A5FA', 
  p500: '#3B82F6', p600: '#2563EB', p700: '#1D4ED8', p800: '#1E40AF', p900: '#1E3A8A',
  white: '#FFFFFF',
  cyan: '#0284C7', sky: '#0EA5E9', teal: '#0D9488',
  amber: '#D97706', amberBg: '#FEF3C7',
  green: '#059669', greenBg: '#D1FAE5',
  red:   '#DC2626', redBg:   '#FEE2E2',
  purple:'#7C3AED', purpleBg:'#EDE9FE',
  pink:  '#DB2777', orange:  '#EA580C',
};

const liquidShadow = { shadowColor: G.p900, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 };

const PRIORITY_CONFIG = {
  high:   { color: G.red,   bg: G.redBg,   label: 'High' },
  medium: { color: G.amber, bg: G.amberBg, label: 'Med' },
  low:    { color: G.green, bg: G.greenBg, label: 'Low' },
};

// ─── Date & Data Helpers ──────────────────────────────────────────────────────
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDisplayDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

const getWeekDates = (ref) => {
  const d = new Date(ref);
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sun);
    day.setDate(sun.getDate() + i);
    return day;
  });
};

const getStatus = (t) => {
  const s = (t.status || '').toLowerCase();
  if (s === 'completed') return 'done';
  if (['in progress', 'in-progress', 'in_progress'].includes(s)) return 'active';
  if (s === 'on hold') return 'hold';
  return 'todo';
};

const isOverdue = (t) => {
  if (getStatus(t) === 'done') return false;
  const dl = t.deadline || t.due_date;
  if (!dl) return false;
  return new Date(dl) < new Date();
};

const calcStreak = (tasks) => {
  const doneSet = new Set(
    tasks.filter(t => getStatus(t) === 'done')
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

const getLast28 = (tasks) => Array.from({ length: 28 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (27 - i));
  const ds = fmtDate(d);
  const dayTasks = tasks.filter(t => {
    const td = t.deadline || t.due_date || t.created_at;
    return td && td.startsWith(ds);
  });
  return { date: d, total: dayTasks.length, done: dayTasks.filter(t => getStatus(t) === 'done').length };
});

// ─── SVG Math Helpers ─────────────────────────────────────────────────────────
const smoothLine = (pts, w, h, maxY, padY = 12) => {
  if (!pts.length) return '';
  const n = pts.length;
  const xs = pts.map((_, i) => (i / (n - 1)) * w);
  const ys = pts.map(v => h - padY - ((v / Math.max(maxY, 1)) * (h - padY * 2)));
  if (n === 1) return `M ${xs[0]} ${ys[0]}`;
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < n; i++) {
    const cpx = (xs[i - 1] + xs[i]) / 2;
    d += ` C ${cpx} ${ys[i - 1]}, ${cpx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  return d;
};

const areaPath = (pts, w, h, maxY, padY = 12) => {
  const line = smoothLine(pts, w, h, maxY, padY);
  return line ? `${line} L ${w} ${h} L 0 ${h} Z` : '';
};

const arcSeg = (cx, cy, R, r, startDeg, endDeg) => {
  const rad = d => (d * Math.PI) / 180;
  const s = rad(startDeg), e = rad(endDeg), sweep = endDeg - startDeg;
  if (sweep <= 0) return '';
  const lg = sweep > 180 ? 1 : 0;
  const x1 = cx + R * Math.cos(s), y1 = cy + R * Math.sin(s);
  const x2 = cx + R * Math.cos(e), y2 = cy + R * Math.sin(e);
  const x3 = cx + r * Math.cos(e), y3 = cy + r * Math.sin(e);
  const x4 = cx + r * Math.cos(s), y4 = cy + r * Math.sin(s);
  return `M ${x1} ${y1} A ${R} ${R} 0 ${lg} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${lg} 0 ${x4} ${y4} Z`;
};

// ─── Glass Bento Wrapper ──────────────────────────────────────────────────────
const BentoBox = ({ children, style, title, subtitle }) => (
  <View style={[styles.shadowWrap, { marginBottom: GAP }, style]}>
    <View style={styles.glassLight}>
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
      <View style={styles.glassHighlight} />
      
      {title && (
        <View style={{ paddingHorizontal: CPAD, paddingTop: CPAD, paddingBottom: 8 }}>
          <Text style={{ color: G.txtMain, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 }}>{title}</Text>
          {subtitle && <Text style={{ color: G.txtFaint, fontSize: 12, fontWeight: '700', marginTop: 2 }}>{subtitle}</Text>}
        </View>
      )}
      <View style={{ paddingHorizontal: CPAD, paddingBottom: CPAD, paddingTop: title ? 0 : CPAD }}>
        {children}
      </View>
    </View>
  </View>
);

// ─── KPI Pill ─────────────────────────────────────────────────────────────────
const KpiPill = ({ value, label, icon, color, bg }) => (
  <View style={[styles.kpiPill, { backgroundColor: bg, borderColor: color + '40' }]}>
    <View style={[styles.kpiIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.kpiValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  </View>
);

// ─── SVG Charts ───────────────────────────────────────────────────────────────
const CompletionGauge = ({ pct, done, total, color = G.p600 }) => {
  const W  = HALF_CW, H = W * 0.65, cx = W / 2, cy = H, R = W * 0.42, SW = 14;
  const circ = 2 * Math.PI * R, arcLen = Math.PI * R, filled = (pct / 100) * arcLen;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={W} height={H + 10}>
        <Defs>
          <SvgGrad id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={G.sky} />
            <Stop offset="1" stopColor={color} />
          </SvgGrad>
        </Defs>
        <Circle cx={cx} cy={cy} r={R} stroke="rgba(0,0,0,0.05)" strokeWidth={SW} fill="none" strokeLinecap="round" strokeDasharray={`${arcLen} ${circ}`} rotation="-180" origin={`${cx}, ${cy}`} />
        {filled > 0 && <Circle cx={cx} cy={cy} r={R} stroke="url(#gaugeGrad)" strokeWidth={SW} fill="none" strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} rotation="-180" origin={`${cx}, ${cy}`} />}
        <SvgText x={cx} y={cy - R * 0.25} textAnchor="middle" fill={G.txtMain} fontSize="28" fontWeight="900" letterSpacing={-1}>{pct}%</SvgText>
        <SvgText x={cx} y={cy - R * 0.25 + 16} textAnchor="middle" fill={G.txtFaint} fontSize="10" fontWeight="900" textTransform="uppercase" letterSpacing={0.5}>Complete</SvgText>
      </Svg>
    </View>
  );
};

const WeekAreaChart = ({ data }) => {
  const W = FULL_CW, H = 140, maxY = Math.max(...data.map(d => d.total), 1);
  const barW = W / data.length, donePts = data.map(d => d.completed), totalPts = data.map(d => d.total);

  return (
    <Svg width={W} height={H + 24}>
      <Defs>
        <SvgGrad id="doneArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={G.p600} stopOpacity="0.5" />
          <Stop offset="1" stopColor={G.p600} stopOpacity="0.0" />
        </SvgGrad>
        <SvgGrad id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={G.p500} />
          <Stop offset="1" stopColor={G.sky} />
        </SvgGrad>
      </Defs>
      {[0.33, 0.66, 1].map((f, i) => <Line key={i} x1={0} y1={H - f * H * 0.85} x2={W} y2={H - f * H * 0.85} stroke={G.grid} strokeWidth={1.5} strokeDasharray="4 6" />)}
      
      <Path d={areaPath(totalPts, W, H, maxY)} fill="rgba(0,0,0,0.03)" />
      <Path d={smoothLine(totalPts, W, H, maxY)} fill="none" stroke={G.txtFaint} strokeWidth={1.5} strokeOpacity={0.3} />
      
      <Path d={areaPath(donePts, W, H, maxY)} fill="url(#doneArea)" />
      <Path d={smoothLine(donePts, W, H, maxY)} fill="none" stroke={G.p600} strokeWidth={3} />

      {data.map((d, i) => {
        const x = i * barW + barW * 0.28, bw = barW * 0.44;
        const totalH = d.total > 0 ? Math.max((d.total / maxY) * H * 0.85, 5) : 3;
        const doneH  = d.completed > 0 ? Math.max((d.completed / maxY) * H * 0.85, 5) : 0;
        return (
          <SvgG key={i}>
            <Rect x={x} y={H - totalH} width={bw} height={totalH} rx={4} fill="rgba(0,0,0,0.05)" />
            {doneH > 0 && <Rect x={x} y={H - doneH} width={bw} height={doneH} rx={4} fill="url(#barGrad)" />}
            <SvgText x={x + bw / 2} y={H + 18} textAnchor="middle" fill={G.txtFaint} fontSize="11" fontWeight="800">{DAYS[i]}</SvgText>
          </SvgG>
        );
      })}
    </Svg>
  );
};

const DonutChart = ({ total, done, active, overdue, todo }) => {
  const W = HALF_CW, cx = W / 2, cy = W / 2, R = W * 0.40, r = R * 0.55;
  const segs = [
    { val: done,    color: G.green },
    { val: active,  color: G.amber },
    { val: todo,    color: G.p600 },
    { val: overdue, color: G.red },
  ].filter(s => s.val > 0);

  const sum = segs.reduce((s, x) => s + x.val, 0) || 1;
  let cursor = -90;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={W} height={W}>
        <Circle cx={cx} cy={cy} r={R} stroke="rgba(0,0,0,0.04)" strokeWidth={R-r} fill="none" />
        {segs.map((seg, i) => {
          const sweep = (seg.val / sum) * 356;
          const path = arcSeg(cx, cy, R, r, cursor, cursor + sweep);
          cursor += sweep + (360 / sum) * (4 / sum);
          return path ? <Path key={i} d={path} fill={seg.color} /> : null;
        })}
        <Circle cx={cx} cy={cy} r={r - 1} fill="rgba(255,255,255,0.7)" />
        <SvgText x={cx} y={cy - 2} textAnchor="middle" fill={G.txtMain} fontSize="26" fontWeight="900">{total}</SvgText>
        <SvgText x={cx} y={cy + 14} textAnchor="middle" fill={G.txtFaint} fontSize="10" fontWeight="900" letterSpacing={0.5}>TASKS</SvgText>
      </Svg>
    </View>
  );
};

const MonthSparkLine = ({ data }) => {
  const W = FULL_CW, H = 60, vals = data.map(d => d.done), maxY = Math.max(...vals, 1);
  return (
    <Svg width={W} height={H + 10}>
      <Defs>
        <SvgGrad id="sparkArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={G.cyan} stopOpacity="0.4" />
          <Stop offset="1" stopColor={G.cyan} stopOpacity="0.01" />
        </SvgGrad>
      </Defs>
      <Path d={areaPath(vals, W, H, maxY, 6)} fill="url(#sparkArea)" />
      <Path d={smoothLine(vals, W, H, maxY, 6)} fill="none" stroke={G.cyan} strokeWidth={2.5} />
      {vals[vals.length - 1] > 0 && (
        <Circle cx={W} cy={H - 6 - ((vals[vals.length - 1] / maxY) * (H - 12))} r={4} fill={G.white} stroke={G.cyan} strokeWidth={2.5} />
      )}
    </Svg>
  );
};

const RadialRing = ({ pct, color, size, stroke, label, sub }) => {
  const R = size / 2 - stroke / 2 - 2, circ = 2 * Math.PI * R, filled = (pct / 100) * circ;
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGrad id={`ring_${label}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.5" />
            <Stop offset="1" stopColor={color} />
          </SvgGrad>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={R} stroke="rgba(0,0,0,0.06)" strokeWidth={stroke} fill="none" />
        {filled > 0 && <Circle cx={size / 2} cy={size / 2} r={R} stroke={`url(#ring_${label})`} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} rotation="-90" origin={`${size / 2}, ${size / 2}`} />}
        <SvgText x={size / 2} y={size / 2 + 5} textAnchor="middle" fill={G.txtMain} fontSize="16" fontWeight="900">{pct}%</SvgText>
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: G.txtMain }}>{label}</Text>
        <Text style={{ fontSize: 11, color: G.txtFaint, fontWeight: '700' }}>{sub}</Text>
      </View>
    </View>
  );
};

// ─── ProgressScreen ───────────────────────────────────────────────────────────
export default function ProgressScreen({ navigation }) {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  const [tasks,       setTasks]       = useState([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isRefreshing,setIsRefreshing]= useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekDates = getWeekDates(currentWeek);

  const load = useCallback(async () => {
    try {
      const data = await getTasks({ user_id: user?.id, role: user?.role, scope: 'self' });
      setTasks(Array.isArray(data) ? data : data?.tasks || []);
    } catch (e) {
      console.error('ProgressScreen:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const totalAll   = tasks.length;
  const doneAll    = tasks.filter(t => getStatus(t) === 'done').length;
  const activeAll  = tasks.filter(t => getStatus(t) === 'active').length;
  const overdueAll = tasks.filter(isOverdue).length;
  const todoAll    = tasks.filter(t => getStatus(t) === 'todo').length;
  const pct        = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;
  const streak     = calcStreak(tasks);
  const heatData   = getLast28(tasks);

  const priorities = { low: 0, medium: 0, high: 0, critical: 0 };
  tasks.forEach(t => {
    const p = (t.priority || '').toLowerCase();
    if (p in priorities) priorities[p]++;
  });

  const weeklyData = weekDates.map(date => {
    const ds = fmtDate(date);
    const day = tasks.filter(t => {
      const td = t.deadline || t.due_date || t.created_at;
      return td && td.startsWith(ds);
    });
    return {
      date,
      completed: day.filter(t => getStatus(t) === 'done').length,
      total: day.length,
    };
  });

  const weekTotal = weeklyData.reduce((s, d) => s + d.total, 0);
  const weekDone  = weeklyData.reduce((s, d) => s + d.completed, 0);
  const weekPct   = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

  const weekTasksAll     = tasks.filter(t => {
    const td = t.deadline || t.due_date || t.created_at;
    return td && weekDates.some(d => td.startsWith(fmtDate(d)));
  });
  const weekActiveCount  = weekTasksAll.filter(t => getStatus(t) === 'active').length;
  const weekOverdueCount = weekTasksAll.filter(isOverdue).length;
  const weekActivePct    = weekTasksAll.length > 0 ? Math.round((weekActiveCount  / weekTasksAll.length) * 100) : 0;
  const weekOverduePct   = weekTasksAll.length > 0 ? Math.round((weekOverdueCount / weekTasksAll.length) * 100) : 0;

  const weekLabel = `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const selDayData = weeklyData[selectedDay];
  const selDayTasks = tasks.filter(t => {
    const td = t.deadline || t.due_date || t.created_at;
    return td && td.startsWith(fmtDate(weekDates[selectedDay]));
  });

  if (isLoading) return <LoadingSpinner fullScreen message="Loading your progress…" />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* ── Stable Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -50, right: -30, backgroundColor: G.p200 }]} />
        <View style={[styles.ambientOrb, { bottom: 80, left: -50, backgroundColor: G.purpleBg }]} />
      </View>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={G.p800} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.headerTitle}>My Progress</Text>
          <Text style={styles.headerSub}>{user?.username || 'You'} · {totalAll} tasks</Text>
        </View>
        <View style={[styles.streakBadge, streak > 0 && styles.streakBadgeActive]}>
          <Text style={{ fontSize: 18 }}>🔥</Text>
          <Text style={[styles.streakBadgeNum, streak > 0 && { color: G.white }]}>{streak}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); load(); }} tintColor={G.p600} />}
      >
        {/* ── KPI Row ── */}
        <View style={styles.row}>
          <KpiPill value={totalAll}   label="Total"   icon="layers"           color={G.p700}  bg={G.p100} />
          <KpiPill value={doneAll}    label="Done"    icon="checkmark-circle" color={G.green} bg={G.greenBg} />
        </View>
        <View style={styles.row}>
          <KpiPill value={activeAll}  label="Active"  icon="time"             color={G.sky}   bg="#E0F2FE" />
          <KpiPill value={overdueAll} label="Overdue" icon="alert-circle"     color={G.red}   bg={G.redBg} />
        </View>

        {/* ── Gauge + Sparkline ── */}
        <View style={styles.row}>
          <BentoBox title="All-time" subtitle="Completion rate" style={{ flex: 1 }}>
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <CompletionGauge pct={pct} done={doneAll} total={totalAll} color={G.p600} />
            </View>
          </BentoBox>

          <BentoBox title="30-Day Trend" subtitle="Completions" style={{ flex: 1 }}>
            <View style={{ marginTop: 10 }}>
              <MonthSparkLine data={heatData} />
            </View>
          </BentoBox>
        </View>

        {/* ── 3 Radial rings ── */}
        <BentoBox title="This Week" subtitle={weekLabel}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 }}>
            <RadialRing pct={weekPct} color={G.p600} size={84} stroke={10} label="Done" sub={`${weekDone}/${weekTotal}`} />
            <RadialRing pct={weekActivePct} color={G.sky} size={84} stroke={10} label="Active" sub={`${weekActiveCount} tasks`} />
            <RadialRing pct={weekOverduePct} color={G.red} size={84} stroke={10} label="Overdue" sub={`${weekOverdueCount} tasks`} />
          </View>
        </BentoBox>

        {/* ── Week Calendar ── */}
        <BentoBox>
          <View style={styles.weekNav}>
            <TouchableOpacity style={styles.weekNavBtn} onPress={() => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); }} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color={G.p700} />
            </TouchableOpacity>
            <Text style={styles.weekLabel}>{weekLabel}</Text>
            <TouchableOpacity style={styles.weekNavBtn} onPress={() => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); }} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={18} color={G.p700} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {weekDates.map((date, idx) => {
              const isSel   = idx === selectedDay;
              const isToday = fmtDate(date) === fmtDate(new Date());
              const hasTasks = weeklyData[idx]?.total > 0;
              return (
                <TouchableOpacity key={idx} onPress={() => setSelectedDay(idx)} activeOpacity={0.8} style={[styles.dayCell, isSel && styles.dayCellActive, isToday && !isSel && styles.dayCellToday]}>
                  <Text style={[styles.dayCellDayName, isSel && { color: 'rgba(255,255,255,0.85)' }]}>{DAYS[idx]}</Text>
                  <View style={[styles.dayCellNum, isSel && { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.dayCellNumTxt, isSel && { color: G.white, fontWeight: '900' }]}>{date.getDate()}</Text>
                  </View>
                  <View style={[styles.dayCellDot, { backgroundColor: hasTasks ? (isSel ? 'rgba(255,255,255,0.75)' : G.p400) : 'transparent' }]} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </BentoBox>

        {/* ── Weekly Area Chart ── */}
        <BentoBox title="Weekly Activity" subtitle="Tasks completed vs assigned per day">
          <View style={{ marginTop: 10 }}>
            <WeekAreaChart data={weeklyData} />
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: G.p600 }]} />
              <Text style={styles.legendTxt}>Completed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: G.p300 }]} />
              <Text style={styles.legendTxt}>Total</Text>
            </View>
          </View>
        </BentoBox>

        {/* ── Donut + Priority ── */}
        <View style={styles.row}>
          <BentoBox title="Status" subtitle="All tasks" style={{ flex: 1 }}>
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <DonutChart total={totalAll} done={doneAll} active={activeAll} overdue={overdueAll} todo={todoAll} />
            </View>
            <View style={{ gap: 8, marginTop: 16 }}>
              {[
                { label: 'Done',    color: G.green, val: doneAll   },
                { label: 'Active',  color: G.amber,   val: activeAll },
                { label: 'Todo',    color: G.p600,  val: todoAll   },
                { label: 'Overdue', color: G.red,   val: overdueAll },
              ].map(l => (
                <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: l.color }} />
                  <Text style={{ flex: 1, fontSize: 12, color: G.txtFaint, fontWeight: '800' }}>{l.label}</Text>
                  <Text style={{ fontSize: 13, color: l.color, fontWeight: '900' }}>{l.val}</Text>
                </View>
              ))}
            </View>
          </BentoBox>

          <BentoBox title="Priority" subtitle="Task breakdown" style={{ flex: 1 }}>
            <View style={{ gap: 14, marginTop: 10 }}>
              {[
                { key: 'critical', label: 'Critical', color: G.red,    bg: G.redBg    },
                { key: 'high',     label: 'High',     color: G.orange, bg: '#FFEDD5' },
                { key: 'medium',   label: 'Medium',   color: G.amber,  bg: G.amberBg  },
                { key: 'low',      label: 'Low',      color: G.green,  bg: G.greenBg  },
              ].map(item => {
                const count = priorities[item.key] || 0;
                const maxC = Math.max(...['critical','high','medium','low'].map(k => priorities[k] || 0), 1);
                const barMax = HALF_CW - 10;
                const w = count > 0 ? Math.max((count / maxC) * barMax, 10) : 0;
                return (
                  <View key={item.key}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: G.txtFaint, fontWeight: '800' }}>{item.label}</Text>
                      <Text style={{ fontSize: 13, color: item.color, fontWeight: '900' }}>{count}</Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: item.bg, borderRadius: 4 }}>
                      {w > 0 && <View style={{ height: 8, width: w, backgroundColor: item.color, borderRadius: 4 }} />}
                    </View>
                  </View>
                );
              })}
            </View>
          </BentoBox>
        </View>

        {/* ── Activity Heat Grid ── */}
        <BentoBox title="Activity (28 Days)" subtitle="Daily task density">
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <View>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                {DAYS.map((d, i) => (
                  <View key={i} style={{ width: (FULL_CW - 30) / 7, marginRight: i < 6 ? 5 : 0, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: G.txtFaint, fontWeight: '800' }}>{d[0]}</Text>
                  </View>
                ))}
              </View>
              {Array.from({ length: 4 }, (_, row) => (
                <View key={row} style={{ flexDirection: 'row', marginBottom: 5 }}>
                  {Array.from({ length: 7 }, (_, col) => {
                    const idx = row * 7 + col;
                    const d   = heatData[idx] || { total: 0, done: 0 };
                    const maxVal = Math.max(...heatData.map(h => h.total), 1);
                    const dark = d.total / maxVal > 0.5;
                    
                    const heatColor = (v) => {
                      if (v === 0) return G.p100;
                      const t = v / maxVal;
                      if (t < 0.25) return G.p200;
                      if (t < 0.5)  return G.p400;
                      if (t < 0.75) return G.p600;
                      return G.p800;
                    };

                    return (
                      <View key={col} style={[{ width: (FULL_CW - 30) / 7, height: (FULL_CW - 30) / 7, backgroundColor: heatColor(d.total), borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, col < 6 && { marginRight: 5 }]}>
                        {d.total > 0 && <Text style={{ fontSize: 10, fontWeight: '900', color: dark ? G.white : G.p800 }}>{d.done}</Text>}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, width: '100%', justifyContent: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: G.txtFaint, fontWeight: '800' }}>Less</Text>
              {[G.p100, G.p200, G.p400, G.p600, G.p800].map((c, i) => <View key={i} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c }} />)}
              <Text style={{ fontSize: 11, color: G.txtFaint, fontWeight: '800' }}>More</Text>
            </View>
          </View>
        </BentoBox>

        {/* ── Selected Day Detail ── */}
        {selDayData && (
          <BentoBox title={`${DAYS[selectedDay]}, ${fmtDisplayDate(weekDates[selectedDay])}`} subtitle="Selected day breakdown" titleColor={G.p700}>
            <View style={styles.dayStatsRow}>
              {[
                { val: selDayData.completed,                    label: 'Done',    color: G.green },
                { val: selDayData.total - selDayData.completed, label: 'Pending', color: G.amber },
                { val: selDayData.total,                        label: 'Total',   color: G.p700  },
              ].map((s, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.dayStatVal, { color: s.color }]}>{s.val}</Text>
                  <Text style={styles.dayStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {selDayTasks.length > 0 ? (
              <View style={{ marginTop: 20, gap: 10 }}>
                {selDayTasks.slice(0, 4).map(t => {
                  const st = (t.status || '').toLowerCase();
                  const color = st === 'completed' ? G.green : ['in progress', 'in-progress', 'in_progress'].includes(st) ? G.sky : isOverdue(t) ? G.red : ['on hold'].includes(st) ? G.amber : G.p400;
                  return (
                    <View key={t.id} style={styles.taskRow}>
                      <View style={[styles.taskDot, { backgroundColor: color }]} />
                      <Text style={styles.taskTitle} numberOfLines={1}>{t.title}</Text>
                      <View style={[styles.taskBadge, { backgroundColor: color + '15', borderColor: color + '40' }]}>
                        <Text style={[styles.taskBadgeTxt, { color }]}>
                          {['in progress', 'in-progress', 'in_progress'].includes(st) ? 'Active' : (t.status || 'Todo')}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {selDayTasks.length > 4 && (
                  <Text style={{ fontSize: 13, color: G.txtFaint, fontWeight: '800', textAlign: 'center', marginTop: 10 }}>
                    +{selDayTasks.length - 4} more tasks
                  </Text>
                )}
              </View>
            ) : (
              <Text style={{ textAlign: 'center', color: G.txtFaint, fontSize: 14, fontStyle: 'italic', fontWeight: '700', marginTop: 20 }}>
                No tasks for this day
              </Text>
            )}
          </BentoBox>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4, filter: [{ blur: 50 }] },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GUTTER, paddingBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,255,255,0.9)',
    ...liquidShadow, zIndex: 10,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: G.txtFaint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20, borderWidth: 2, borderColor: G.p200,
  },
  streakBadgeActive: { backgroundColor: G.p700, borderColor: G.p900, shadowColor: G.p900, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  streakBadgeNum: { fontSize: 16, fontWeight: '900', color: G.p800 },

  content: { paddingHorizontal: GUTTER, paddingTop: 16, gap: GAP },
  row: { flexDirection: 'row', gap: GAP },

  // ── Bento Layout
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },

  // ── KPI Pill
  kpiPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 20, borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  kpiIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  kpiLabel: { fontSize: 11, color: G.txtFaint, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Week Strip
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  weekNavBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 2, borderColor: G.p200, alignItems: 'center', justifyContent: 'center' },
  weekLabel: { fontSize: 14, fontWeight: '900', color: G.txtMain, letterSpacing: -0.2 },
  dayCell: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, minWidth: 50 },
  dayCellActive: { backgroundColor: G.p700, shadowColor: G.p900, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  dayCellDayName: { fontSize: 12, color: G.txtFaint, fontWeight: '900', marginBottom: 6, textTransform: 'uppercase' },
  dayCellNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayCellNumToday: { borderWidth: 2, borderColor: G.p500 },
  dayCellNumTxt: { fontSize: 16, fontWeight: '900', color: G.txtMain },
  dayCellDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },

  // ── Legend
  legend: { flexDirection: 'row', gap: 20, marginTop: 16, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { fontSize: 12, color: G.txtFaint, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Day Detail
  dayStatsRow: { flexDirection: 'row', marginTop: 16 },
  dayStatVal: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  dayStatLabel: { fontSize: 12, color: G.txtFaint, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },

  // ── Task rows
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, padding: 14, borderWidth: 2, borderColor: G.p200 },
  taskDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  taskTitle: { flex: 1, fontSize: 15, color: G.txtMain, fontWeight: '800' },
  taskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1.5 },
  taskBadgeTxt: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
});
