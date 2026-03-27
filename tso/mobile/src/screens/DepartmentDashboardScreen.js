import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { getTasks, getProjects } from '../services/api';

// ─── Light Blue Glassmorphic Palette ─────────────────────────────────────────
const G = {
  // Backgrounds — layered blue-white
  bg0: '#EFF6FF',
  bg1: '#DBEAFE',
  bg2: '#F0F9FF',

  // Blue spectrum
  b50:  '#EFF6FF',
  b100: '#DBEAFE',
  b200: '#BFDBFE',
  b300: '#93C5FD',
  b400: '#60A5FA',
  b500: '#3B82F6',
  b600: '#2563EB',
  b700: '#1D4ED8',
  b800: '#1E40AF',
  b900: '#1E3A8A',

  // Glass surfaces — white-blue frosted
  glassBg:       'rgba(255,255,255,0.62)',
  glassBorder:   'rgba(255,255,255,0.90)',
  glassBgLight:  'rgba(219,234,254,0.55)',
  glassBgStrong: 'rgba(191,219,254,0.45)',

  // Text — dark slate on light
  txtMain:  '#0F172A',
  txtMuted: '#1E3A8A',
  txtFaint: '#4B6A9B',

  // Status
  green:    '#059669',
  greenBg:  '#D1FAE5',
  amber:    '#D97706',
  amberBg:  '#FEF3C7',
  red:      '#DC2626',
  redBg:    '#FEE2E2',
  purple:   '#7C3AED',
  purpleBg: '#EDE9FE',
  pink:     '#DB2777',
  teal:     '#0D9488',

  white: '#FFFFFF',
};

const ROLE_CONFIG = {
  manager:    { label: 'Manager',    color: G.purple, bg: G.purpleBg },
  supervisor: { label: 'Supervisor', color: G.amber,  bg: G.amberBg },
  employee:   { label: 'Employee',   color: G.green,  bg: G.greenBg },
  finance:    { label: 'Finance',    color: G.b700,   bg: G.b100 },
};

const PRIORITY_CONFIG = {
  high:   { color: G.red,   bg: G.redBg,   label: 'High' },
  medium: { color: G.amber, bg: G.amberBg, label: 'Med' },
  low:    { color: G.green, bg: G.greenBg, label: 'Low' },
};

const AVATAR_PALETTE = [G.b600, G.green, G.amber, G.purple, G.pink, G.teal, G.red];
const getAvatarColor = (s) => AVATAR_PALETTE[(s || '').charCodeAt(0) % AVATAR_PALETTE.length];
const getInitials    = (s) => (s || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const SW     = Dimensions.get('window').width;
const GUTTER = 12;
const FULL_W = SW - GUTTER * 2;
const HALF_W = (FULL_W - 8) / 2;
const THIRD_W = (FULL_W - 16) / 3;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

const getStatus = (t) => {
  const s = (t?.status || '').toLowerCase();
  if (s === 'completed') return 'done';
  if (['in progress', 'in-progress', 'in_progress'].includes(s)) return 'active';
  if (s === 'on hold') return 'hold';
  return 'todo';
};

const isOverdue = (t) => {
  if (getStatus(t) === 'done') return false;
  const dl = t?.deadline;
  if (!dl) return false;
  return new Date(dl) < new Date();
};

const STATUS_META = {
  done:    { label: 'Done',     color: G.green,   bg: G.greenBg, icon: 'checkmark-circle' },
  active:  { label: 'Active',   color: G.amber,   bg: G.amberBg, icon: 'time' },
  todo:    { label: 'To Do',    color: G.b600,    bg: G.b100,    icon: 'ellipse-outline' },
  hold:    { label: 'On Hold',  color: '#6B7280', bg: '#F3F4F6', icon: 'pause-circle' },
  overdue: { label: 'Overdue',  color: G.red,     bg: G.redBg,   icon: 'alert-circle' },
};

// ─── Glass Card primitive ─────────────────────────────────────────────────────
const Glass = ({ style, children, intensity = 75, accent }) => (
  <View style={[styles.glass, style]}>
    <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
    <LinearGradient
      colors={accent
        ? [`${accent}18`, `${accent}06`]
        : ['rgba(255,255,255,0.82)', 'rgba(219,234,254,0.50)']}
      style={StyleSheet.absoluteFill}
    />
    <View style={styles.glassHL} />
    {children}
  </View>
);

// ─── SVG Completion Gauge ─────────────────────────────────────────────────────
const CompletionGauge = React.memo(({ pct, done, total, color }) => {
  const W  = HALF_W - 2;
  const cx = W / 2, cy = W * 0.52, r = W * 0.34, sw = W * 0.085;
  const theta = ((180 - pct * 1.8) * Math.PI) / 180;
  const ex = cx + r * Math.cos(theta);
  const ey = cy - r * Math.sin(theta);
  const large = pct > 50 ? 1 : 0;
  const filled = pct > 0 ? `M ${cx - r} ${cy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey}` : null;
  const svgH   = cy + sw / 2 + 6;

  return (
    <Glass style={{ width: HALF_W, padding: 12 }}>
      <Text style={styles.sectionLabel}>Completion</Text>
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <Svg width={W} height={svgH}>
          <Defs>
            <SvgLinearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={color} stopOpacity="0.5" />
              <Stop offset="1" stopColor={color} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 0 ${cx+r} ${cy}`}
            stroke={G.b100} strokeWidth={sw} fill="none" strokeLinecap="round" />
          {filled && <Path d={filled} stroke="url(#gaugeGrad)" strokeWidth={sw} fill="none" strokeLinecap="round" />}
          <SvgText x={cx} y={cy - 3} textAnchor="middle"
            fontSize={W * 0.15} fontWeight="900" fill={G.txtMain}>{pct}%</SvgText>
        </Svg>
        <Text style={[styles.gaugeFooter, { color }]}>{done}/{total} tasks done</Text>
      </View>
    </Glass>
  );
});

// ─── SVG Status Donut ─────────────────────────────────────────────────────────
const StatusDonut = React.memo(({ done, active, todo, overdue, total }) => {
  const W  = HALF_W - 2;
  const cx = W / 2, cy = W / 2, r = W * 0.28, sw = W * 0.115;
  const C  = 2 * Math.PI * r;
  const GAP = 3;
  const segs = [
    { count: done,    color: G.green, label: 'Done' },
    { count: active,  color: G.amber, label: 'Active' },
    { count: todo,    color: G.b400,  label: 'Todo' },
    { count: overdue, color: G.red,   label: 'Late' },
  ].filter(s => s.count > 0);

  let offset = 0;
  const arcs = segs.map(seg => {
    const len = (seg.count / Math.max(total, 1)) * (C - GAP * segs.length);
    const dash = `${len} ${C}`;
    const off  = -offset;
    offset += len + GAP;
    return { ...seg, dash, off };
  });

  return (
    <Glass style={{ width: HALF_W, padding: 12 }}>
      <Text style={styles.sectionLabel}>Status Split</Text>
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <Svg width={W} height={W}>
          <Circle cx={cx} cy={cy} r={r} stroke={G.b100} strokeWidth={sw} fill="none" />
          {arcs.map((arc, i) => (
            <Circle key={i} cx={cx} cy={cy} r={r} stroke={arc.color}
              strokeWidth={sw} fill="none" strokeDasharray={arc.dash}
              strokeDashoffset={arc.off} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
          ))}
          <SvgText x={cx} y={cy - 5} textAnchor="middle" fontSize={W * 0.13} fontWeight="900" fill={G.txtMain}>{total}</SvgText>
          <SvgText x={cx} y={cy + W * 0.1} textAnchor="middle" fontSize={W * 0.07} fontWeight="700" fill={G.txtFaint}>tasks</SvgText>
        </Svg>
        <View style={styles.donutLegend}>
          {segs.map((s, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </Glass>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DepartmentDashboardScreen({ navigation, route }) {
  const { dept, deptColor } = route.params || {};
  const { user }   = useAuth();
  const insets     = useSafeAreaInsets();
  const canManage  = user?.role === 'manager';
  const accent     = deptColor || G.b500;

  const [tasks,        setTasks]       = useState([]);
  const [projects,     setProjects]    = useState([]);
  const [isLoading,    setIsLoading]   = useState(true);
  const [isRefreshing, setIsRefreshing]= useState(false);
  const [taskFilter,   setTaskFilter]  = useState('all');
  const [projFilter,   setProjFilter]  = useState(null);

  const fetchAll = useCallback(async () => {
    if (!dept?.id) return;
    try {
      const [taskData, projData] = await Promise.allSettled([
        getTasks({ dept_id: dept.id, scope: 'department' }),
        getProjects(dept.id),
      ]);
      setTasks(taskData.status === 'fulfilled' && Array.isArray(taskData.value) ? taskData.value : []);
      setProjects(projData.status === 'fulfilled' && Array.isArray(projData.value) ? projData.value : []);
    } catch (err) {
      console.error('Dept dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dept?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = useCallback(() => { setIsRefreshing(true); fetchAll(); }, [fetchAll]);

  const scopedTasks = useMemo(
    () => projFilter ? tasks.filter(t => t.project_id === projFilter) : tasks,
    [tasks, projFilter]
  );

  const stats = useMemo(() => {
    let done = 0, active = 0, todo = 0, overdue = 0, onHold = 0;
    scopedTasks.forEach(t => {
      const s = getStatus(t);
      const late = isOverdue(t);
      if (late) overdue++;
      if (s === 'done')   done++;
      else if (s === 'active') active++;
      else if (s === 'hold')   onHold++;
      else if (s === 'todo' && !late) todo++;
    });
    const total = scopedTasks.length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, active, todo, overdue, onHold, pct };
  }, [scopedTasks]);

  const allMembers = useMemo(() => {
    if (!dept) return [];
    const seen = new Set();
    const list = [];
    if (dept.supervisor) { seen.add(dept.supervisor.id); list.push({ ...dept.supervisor, role: 'supervisor' }); }
    (dept.employees || []).forEach(e => { if (!seen.has(e.id)) { seen.add(e.id); list.push({ ...e, role: 'employee' }); } });
    return list;
  }, [dept]);

  const memberStats = useMemo(() => allMembers.map(m => {
    const mt = scopedTasks.filter(t => t.assigned_to?.id === m.id);
    const md = mt.filter(t => getStatus(t) === 'done').length;
    return { ...m, assigned: mt.length, done: md, active: mt.filter(t => getStatus(t) === 'active').length,
      overdue: mt.filter(t => isOverdue(t)).length, compPct: mt.length > 0 ? Math.round((md / mt.length) * 100) : 0 };
  }).sort((a, b) => b.assigned - a.assigned), [allMembers, scopedTasks]);

  const projectStats = useMemo(() => projects.map(proj => {
    const pt = tasks.filter(t => t.project_id === proj.id);
    const pd = pt.filter(t => getStatus(t) === 'done').length;
    return { ...proj, taskCount: pt.length, done: pd, active: pt.filter(t => getStatus(t) === 'active').length,
      overdue: pt.filter(t => isOverdue(t)).length, compPct: pt.length > 0 ? Math.round((pd / pt.length) * 100) : 0 };
  }).sort((a, b) => b.taskCount - a.taskCount), [projects, tasks]);

  const filteredTasks = useMemo(() => scopedTasks.filter(t => {
    if (taskFilter === 'all')     return true;
    if (taskFilter === 'done')    return getStatus(t) === 'done';
    if (taskFilter === 'active')  return getStatus(t) === 'active';
    if (taskFilter === 'todo')    return getStatus(t) === 'todo' && !isOverdue(t);
    if (taskFilter === 'overdue') return isOverdue(t);
    return true;
  }).sort((a, b) => {
    const order = { overdue: 0, active: 1, todo: 2, hold: 3, done: 4 };
    const oa = isOverdue(a) ? 0 : (order[getStatus(a)] ?? 5);
    const ob = isOverdue(b) ? 0 : (order[getStatus(b)] ?? 5);
    return oa - ob;
  }), [scopedTasks, taskFilter]);

  if (!dept) return null;

  if (isLoading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <LinearGradient colors={[G.bg0, G.bg1, G.bg2]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={G.b600} />
        <Text style={{ marginTop: 12, color: G.b600, fontWeight: '800', fontSize: 13 }}>Loading…</Text>
      </View>
    );
  }

  const totalMembers = (dept.supervisor ? 1 : 0) + (dept.employees?.length || 0);
  const FILTERS = [
    { key: 'all',     label: 'All',     count: stats.total   },
    { key: 'active',  label: 'Active',  count: stats.active  },
    { key: 'todo',    label: 'To Do',   count: stats.todo    },
    { key: 'overdue', label: 'Late',    count: stats.overdue },
    { key: 'done',    label: 'Done',    count: stats.done    },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bg0} />
      <LinearGradient colors={[G.bg0, G.bg1, G.bg2]} style={StyleSheet.absoluteFill} />

      {/* Ambient orbs */}
      <View style={[styles.orb, { top: -60, right: -50, backgroundColor: accent, opacity: 0.22 }]} />
      <View style={[styles.orb, { bottom: 200, left: -80, backgroundColor: G.b300, opacity: 0.30 }]} />

      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={[`${accent}28`, G.b50]} style={StyleSheet.absoluteFill} />
        <View style={[styles.glassHL, { backgroundColor: G.white }]} />

        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={G.txtMain} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={[styles.deptDot, { backgroundColor: accent }]} />
            <Text style={styles.headerTitle} numberOfLines={1}>{dept.name}</Text>
          </View>

          {canManage ? (
            <TouchableOpacity
              style={[styles.manageBtn, { borderColor: `${accent}50`, backgroundColor: `${accent}18` }]}
              onPress={() => navigation.navigate('DepartmentsStack')}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={13} color={accent} />
              <Text style={[styles.manageBtnText, { color: accent }]}>Manage</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 72 }} />}
        </View>

        {/* Stats strip */}
        <View style={styles.headerStats}>
          {[
            { icon: 'people', value: totalMembers, label: 'Members' },
            { icon: 'folder', value: projects.length, label: 'Projects' },
            { icon: 'layers', value: stats.total, label: 'Tasks' },
            { icon: 'trophy', value: `${stats.pct}%`, label: 'Done', color: accent },
          ].map((s, i) => (
            <View key={i} style={styles.headerStat}>
              <Text style={[styles.headerStatVal, s.color && { color: s.color }]}>{s.value}</Text>
              <Text style={styles.headerStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Project filter pills */}
        {projects.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.projPillRow}>
            <TouchableOpacity
              style={[styles.projPill, !projFilter && { backgroundColor: `${accent}30`, borderColor: `${accent}60` }]}
              onPress={() => { setProjFilter(null); setTaskFilter('all'); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.projPillText, !projFilter && { color: accent }]}>All</Text>
            </TouchableOpacity>
            {projects.map(p => {
              const sel = projFilter === p.id;
              return (
                <TouchableOpacity key={p.id}
                  style={[styles.projPill, sel && { backgroundColor: `${accent}30`, borderColor: `${accent}60` }]}
                  onPress={() => { setProjFilter(sel ? null : p.id); setTaskFilter('all'); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.projPillText, sel && { color: accent }]} numberOfLines={1}>{p.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 80 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={G.b400} />}
      >

        {/* ── Bento Row 1: Gauge + Donut ── */}
        <View style={styles.bentoRow}>
          <CompletionGauge pct={stats.pct} done={stats.done} total={stats.total} color={accent} />
          <StatusDonut done={stats.done} active={stats.active} todo={stats.todo} overdue={stats.overdue} total={stats.total} />
        </View>

        {/* ── Bento Row 2: KPI chips 4-grid ── */}
        <Glass style={styles.fullCard}>
          <View style={styles.kpiGrid}>
            {[
              { label: 'Done',    value: stats.done,    color: G.green, icon: 'checkmark-circle' },
              { label: 'Active',  value: stats.active,  color: G.amber, icon: 'time' },
              { label: 'Overdue', value: stats.overdue, color: G.red,   icon: 'alert-circle' },
              { label: 'On Hold', value: stats.onHold,  color: G.txtFaint, icon: 'pause-circle' },
            ].map((k, i) => (
              <View key={i} style={[styles.kpiCell, i % 2 === 0 && { borderRightWidth: 1, borderRightColor: G.glassBorder }]}>
                <View style={[styles.kpiIconWrap, { backgroundColor: `${k.color}20` }]}>
                  <Ionicons name={k.icon} size={16} color={k.color} />
                </View>
                <Text style={[styles.kpiVal, { color: k.color }]}>{k.value}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </View>
        </Glass>

        {/* ── Bento Row 3: Status Bars ── */}
        <Glass style={styles.fullCard}>
          <Text style={styles.cardTitle}>Breakdown</Text>
          <View style={styles.barsWrap}>
            {[
              { label: 'Done',     count: stats.done,    color: G.green, icon: 'checkmark-circle' },
              { label: 'Active',   count: stats.active,  color: G.amber, icon: 'time' },
              { label: 'To Do',    count: stats.todo,    color: G.b400,  icon: 'ellipse-outline' },
              { label: 'Overdue',  count: stats.overdue, color: G.red,   icon: 'alert-circle' },
              ...(stats.onHold > 0 ? [{ label: 'On Hold', count: stats.onHold, color: '#6B7280', icon: 'pause-circle' }] : []),
            ].map(({ label, count, color, icon }) => (
              <View key={label} style={styles.barRow}>
                <View style={[styles.barIcon, { backgroundColor: `${color}18` }]}>
                  <Ionicons name={icon} size={13} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.barHeaderRow}>
                    <Text style={[styles.barLabel, { color }]}>{label}</Text>
                    <Text style={[styles.barCount, { color }]}>{count}</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, {
                      width: stats.total > 0 ? `${Math.round(count / stats.total * 100)}%` : '0%',
                      backgroundColor: color,
                    }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Glass>

        {/* ── Team Members ── */}
        {!projFilter && allMembers.length > 0 && (
          <Glass style={styles.fullCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Team</Text>
              <Text style={styles.cardMeta}>{totalMembers} members</Text>
            </View>

            {/* Avatar strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}
              contentContainerStyle={{ gap: 8, paddingTop: 4 }}>
              {dept.supervisor && (
                <TouchableOpacity
                  style={[styles.avatarChip, { backgroundColor: getAvatarColor(dept.supervisor.username) }]}
                  onPress={() => navigation.navigate('UserPerformance', { targetUser: { ...dept.supervisor, role: 'supervisor' } })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.avatarInitials}>{getInitials(dept.supervisor.username)}</Text>
                  <View style={styles.supBadge}>
                    <Ionicons name="shield-checkmark" size={7} color={G.amber} />
                  </View>
                </TouchableOpacity>
              )}
              {(dept.employees || []).map(e => (
                <TouchableOpacity key={e.id}
                  style={[styles.avatarChip, { backgroundColor: getAvatarColor(e.username) }]}
                  onPress={() => navigation.navigate('UserPerformance', { targetUser: { ...e, role: 'employee' } })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.avatarInitials}>{getInitials(e.username)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Member performance rows */}
            {memberStats.map(m => {
              const rc   = ROLE_CONFIG[m.role] || ROLE_CONFIG.employee;
              const barW = FULL_W - 32 - 12 - 44 - 10;
              const fill = m.assigned > 0 ? Math.round((m.compPct / 100) * barW) : 0;
              return (
                <TouchableOpacity key={m.id} style={styles.memberRow}
                  onPress={() => navigation.navigate('UserPerformance', { targetUser: m })}
                  activeOpacity={0.75}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(m.username) }]}>
                    <Text style={styles.memberInit}>{getInitials(m.username)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName} numberOfLines={1}>{m.username}</Text>
                      <View style={[styles.roleTag, { backgroundColor: rc.bg, borderColor: `${rc.color}40` }]}>
                        <Text style={[styles.roleTagText, { color: rc.color }]}>{rc.label}</Text>
                      </View>
                    </View>
                    <View style={styles.memberBarBg}>
                      <View style={[styles.memberBarFill, { width: fill, backgroundColor: m.compPct >= 70 ? G.green : m.compPct >= 40 ? G.amber : G.b500 }]} />
                    </View>
                    <View style={styles.memberTags}>
                      <Text style={styles.memberTagText}>{m.assigned} tasks</Text>
                      {m.active  > 0 && <Text style={[styles.memberTagText, { color: G.amber }]}>{m.active} active</Text>}
                      {m.overdue > 0 && <Text style={[styles.memberTagText, { color: G.red }]}>{m.overdue} late</Text>}
                      <Text style={[styles.memberTagText, { color: G.b400, marginLeft: 'auto' }]}>{m.compPct}%</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Glass>
        )}

        {/* ── Projects Bento Grid ── */}
        {!projFilter && projectStats.length > 0 && (
          <Glass style={styles.fullCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Projects</Text>
              <Text style={styles.cardMeta}>tap to filter</Text>
            </View>
            <View style={styles.projGrid}>
              {projectStats.map(proj => {
                const sel = projFilter === proj.id;
                const pct = proj.compPct;
                const pctColor = pct >= 80 ? G.green : pct >= 40 ? G.amber : G.red;
                return (
                  <TouchableOpacity key={proj.id}
                    style={[styles.projTile, sel && { borderColor: `${accent}60`, backgroundColor: `${accent}12` }]}
                    onPress={() => { setProjFilter(sel ? null : proj.id); setTaskFilter('all'); }}
                    activeOpacity={0.8}
                  >
                    <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
                    <LinearGradient colors={['rgba(255,255,255,0.80)','rgba(219,234,254,0.45)']} style={StyleSheet.absoluteFill} />
                    <View style={[styles.projTileAccent, { backgroundColor: accent }]} />

                    <View style={styles.projTileTop}>
                      <Text style={styles.projTileName} numberOfLines={2}>{proj.name}</Text>
                      <Text style={[styles.projTilePct, { color: pctColor }]}>{pct}%</Text>
                    </View>

                    {/* Mini progress bar */}
                    <View style={styles.projTileBar}>
                      <View style={[styles.projTileBarFill, { width: `${pct}%`, backgroundColor: pctColor }]} />
                    </View>

                    <View style={styles.projTileMeta}>
                      <Text style={styles.projTileMetaText}>{proj.taskCount} tasks</Text>
                      {proj.overdue > 0 && (
                        <View style={styles.projLateBadge}>
                          <Ionicons name="alert-circle" size={10} color={G.red} />
                          <Text style={[styles.projTileMetaText, { color: G.red }]}>{proj.overdue}</Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.projTeamBtn, { borderColor: `${accent}40`, backgroundColor: `${accent}15` }]}
                      onPress={() => navigation.navigate('TeamDashboard', { proj, deptColor: accent, deptName: dept.name })}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="people" size={11} color={accent} />
                      <Text style={[styles.projTeamBtnText, { color: accent }]}>Team</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Glass>
        )}

        {/* ── Task List ── */}
        <Glass style={styles.fullCard}>
          <Text style={styles.cardTitle}>Tasks{projFilter ? ` · ${projects.find(p => p.id === projFilter)?.name ?? ''}` : ''}</Text>
          {projFilter && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => { setProjFilter(null); setTaskFilter('all'); }}>
              <Ionicons name="close-circle" size={14} color={G.txtFaint} />
              <Text style={styles.clearBtnText}>Clear filter</Text>
            </TouchableOpacity>
          )}

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}>
            {FILTERS.map(f => {
              const isActive = taskFilter === f.key;
              return (
                <TouchableOpacity key={f.key}
                  style={[styles.filterChip, isActive && { backgroundColor: `${accent}30`, borderColor: `${accent}60` }]}
                  onPress={() => setTaskFilter(f.key)} activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, isActive && { color: accent }]}>{f.label}</Text>
                  <View style={[styles.filterCount, { backgroundColor: isActive ? `${accent}40` : 'rgba(255,255,255,0.08)' }]}>
                    <Text style={[styles.filterCountText, isActive && { color: accent }]}>{f.count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Task cards */}
          <View style={styles.taskList}>
            {filteredTasks.length === 0 ? (
              <Text style={styles.emptyNote}>No tasks in this category</Text>
            ) : filteredTasks.map(t => {
              const late    = isOverdue(t);
              const st      = late ? 'overdue' : getStatus(t);
              const stMeta  = STATUS_META[st] || STATUS_META.todo;
              const pr      = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
              const dl      = fmtDate(t.deadline);
              const assignee = t.assigned_to;
              const projName  = projects.find(p => p.id === t.project_id)?.name;

              return (
                <TouchableOpacity key={t.id} style={styles.taskCard}
                  onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })}
                  activeOpacity={0.8}
                >
                  <BlurView intensity={65} tint="light" style={StyleSheet.absoluteFill} />
                  <LinearGradient colors={['rgba(255,255,255,0.85)','rgba(219,234,254,0.42)']} style={StyleSheet.absoluteFill} />
                  <View style={[styles.taskAccent, { backgroundColor: stMeta.color }]} />

                  <View style={styles.taskInner}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskTitle} numberOfLines={2}>{t.title}</Text>
                      <View style={styles.taskMeta}>
                        {assignee && (
                          <>
                            <View style={[styles.taskAvatar, { backgroundColor: getAvatarColor(assignee.username) }]}>
                              <Text style={styles.taskAvatarText}>{getInitials(assignee.username)}</Text>
                            </View>
                            <Text style={styles.taskAssigneeName} numberOfLines={1}>{assignee.username}</Text>
                          </>
                        )}
                        {projName && <Text style={styles.taskProjChip} numberOfLines={1}>{projName}</Text>}
                        {dl && (
                          <View style={styles.taskDeadlineWrap}>
                            <Ionicons name="calendar-outline" size={10} color={late ? G.red : G.txtFaint} />
                            <Text style={[styles.taskDeadline, late && { color: G.red }]}>{dl}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.taskBadges}>
                      <View style={[styles.badge, { backgroundColor: stMeta.bg, borderColor: `${stMeta.color}40` }]}>
                        <Text style={[styles.badgeText, { color: stMeta.color }]}>{stMeta.label}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: pr.bg, borderColor: `${pr.color}40` }]}>
                        <Text style={[styles.badgeText, { color: pr.color }]}>{pr.label}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Glass>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg0 },

  orb: {
    position: 'absolute', width: 300, height: 300,
    borderRadius: 150,
  },

  // ── Glass primitive
  glass: {
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 2, borderColor: G.glassBorder,
    backgroundColor: G.glassBg,
    shadowColor: G.b900, shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  glassHL: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 2, backgroundColor: G.white, zIndex: 5,
  },

  // ── Header
  header: {
    overflow: 'hidden', borderBottomWidth: 2, borderBottomColor: G.glassBorder,
    shadowColor: G.b900, shadowOpacity: 0.12, shadowRadius: 12, elevation: 10,
    zIndex: 20,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 10, gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.b200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.b900, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  deptDot: { width: 10, height: 10, borderRadius: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: G.txtMain, letterSpacing: -0.4, flex: 1 },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6,
  },
  manageBtnText: { fontSize: 11, fontWeight: '900' },
  headerStats: {
    flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 10, gap: 0,
  },
  headerStat: { flex: 1, alignItems: 'center' },
  headerStatVal: { fontSize: 18, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  headerStatLabel: { fontSize: 10, fontWeight: '800', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 0.4 },
  projPillRow: {
    gap: 6, paddingHorizontal: 14, paddingBottom: 10,
  },
  projPill: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1.5, borderColor: G.b200,
  },
  projPillText: { fontSize: 11, fontWeight: '800', color: G.txtFaint },

  // ── Content layout
  scroll: { paddingHorizontal: GUTTER, paddingTop: 12 },
  bentoRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  fullCard: { padding: 14, marginBottom: 8 },

  // ── Gauge
  sectionLabel: { fontSize: 10, fontWeight: '900', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  gaugeFooter:  { fontSize: 11, fontWeight: '900', marginTop: 4 },

  // ── Donut
  donutLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:   { width: 7, height: 7, borderRadius: 4 },
  legendText:  { fontSize: 10, fontWeight: '800', color: G.txtFaint },

  // ── KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  kpiCell: {
    width: '50%', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: G.b100,
  },
  kpiIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  kpiVal:   { fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  kpiLabel: { fontSize: 10, fontWeight: '900', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },

  // ── Status bars
  cardTitle:  { fontSize: 14, fontWeight: '900', color: G.txtMain, letterSpacing: -0.3, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardMeta:   { fontSize: 11, fontWeight: '800', color: G.txtFaint },
  barsWrap:   { gap: 10 },
  barRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barIcon:    { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  barHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel:   { fontSize: 11, fontWeight: '900' },
  barCount:   { fontSize: 11, fontWeight: '900' },
  barBg:      { height: 5, backgroundColor: G.b100, borderRadius: 3, overflow: 'hidden' },
  barFill:    { height: 5, borderRadius: 3 },

  // ── Members
  avatarChip: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarInitials: { fontSize: 12, fontWeight: '900', color: G.white },
  supBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: G.white, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: G.b200,
  },
  memberRow:   { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 6, borderTopWidth: 1, borderTopColor: G.b100 },
  memberAvatar:{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  memberInit:  { fontSize: 13, fontWeight: '900', color: G.white },
  memberNameRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  memberName:  { fontSize: 13, fontWeight: '900', color: G.txtMain, flex: 1 },
  roleTag:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  roleTagText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  memberBarBg: { height: 5, backgroundColor: G.b100, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  memberBarFill:{ height: 5, borderRadius: 3 },
  memberTags:  { flexDirection: 'row', gap: 8 },
  memberTagText:{ fontSize: 10, fontWeight: '800', color: G.txtFaint },

  // ── Projects grid (2-col)
  projGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  projTile: {
    width: HALF_W - 4, borderRadius: 14, overflow: 'hidden',
    borderWidth: 2, borderColor: G.glassBorder,
    padding: 12,
    shadowColor: G.b900, shadowOpacity: 0.10, shadowRadius: 8, elevation: 4,
  },
  projTileAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  projTileTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, marginTop: 6 },
  projTileName: { fontSize: 12, fontWeight: '900', color: G.txtMain, flex: 1, marginRight: 6 },
  projTilePct:  { fontSize: 14, fontWeight: '900' },
  projTileBar:  { height: 4, backgroundColor: G.b100, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  projTileBarFill: { height: 4, borderRadius: 2 },
  projTileMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  projTileMetaText: { fontSize: 10, fontWeight: '800', color: G.txtFaint },
  projLateBadge:{ flexDirection: 'row', alignItems: 'center', gap: 3 },
  projTeamBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  projTeamBtnText: { fontSize: 10, fontWeight: '900' },

  // ── Tasks
  clearBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -6, marginBottom: 6 },
  clearBtnText: { fontSize: 11, fontWeight: '800', color: G.txtFaint },
  filterRow:    { gap: 6, marginBottom: 10 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.65)', borderWidth: 1.5, borderColor: G.b200,
  },
  filterChipText:  { fontSize: 11, fontWeight: '900', color: G.txtFaint },
  filterCount:     { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  filterCountText: { fontSize: 9, fontWeight: '900', color: G.txtFaint },
  taskList:     { gap: 6 },
  taskCard: {
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 2, borderColor: G.glassBorder,
    shadowColor: G.b900, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  taskAccent:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  taskInner:   { flexDirection: 'row', padding: 11, paddingLeft: 14, gap: 8, alignItems: 'flex-start' },
  taskTitle:   { fontSize: 13, fontWeight: '900', color: G.txtMain, letterSpacing: -0.2, marginBottom: 5 },
  taskMeta:    { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  taskAvatar:  { width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  taskAvatarText: { fontSize: 8, fontWeight: '900', color: G.white },
  taskAssigneeName: { fontSize: 10, fontWeight: '800', color: G.txtFaint },
  taskProjChip: { fontSize: 10, fontWeight: '800', color: G.b400, maxWidth: 90 },
  taskDeadlineWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  taskDeadline: { fontSize: 10, fontWeight: '800', color: G.txtFaint },
  taskBadges:  { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  badge:       { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  badgeText:   { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  emptyNote:   { fontSize: 12, color: G.txtFaint, fontStyle: 'italic', fontWeight: '700', paddingVertical: 8 },
});
