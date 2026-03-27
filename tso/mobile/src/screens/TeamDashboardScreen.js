import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Dimensions, Alert, Modal, ActivityIndicator,
  StatusBar, KeyboardAvoidingView, Platform
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { getTasks, getUsers, assignProjectMembers } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

// ─── Layout Constants (Mathematically Perfect for No Clipping) ────────────────
const { width: SW } = Dimensions.get('window');
const GUTTER = 16;
const GAP    = 14;
const CPAD   = 20; // Card internal padding

const FULL_W  = SW - GUTTER * 2;
const HALF_W  = (FULL_W - GAP) / 2;
const HALF_CW = HALF_W - CPAD * 2; // Inner width for SVGs inside a half bento

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
};

// Native fluid shadow
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

const ROLE_CONFIG = {
  manager:    { label: 'Manager',    color: G.purple, bg: G.purpleBg },
  supervisor: { label: 'Supervisor', color: G.amber,  bg: G.amberBg },
  employee:   { label: 'Employee',   color: G.green,  bg: G.greenBg },
  finance:    { label: 'Finance',    color: G.p700,   bg: G.p100 },
};

const PRIORITY_CONFIG = {
  high:   { color: G.red,   bg: G.redBg,   label: 'High' },
  medium: { color: G.amber, bg: G.amberBg, label: 'Med' },
  low:    { color: G.green, bg: G.greenBg, label: 'Low' },
};

const AVATAR_PALETTE = [G.purple, G.amber, G.green, G.p600, G.pink, G.teal, G.red];
const getAvatarColor = (s) => AVATAR_PALETTE[(s || '').charCodeAt(0) % AVATAR_PALETTE.length];
const getInitials    = (s) => (s || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
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
  const dl = t.deadline;
  if (!dl) return false;
  return new Date(dl) < new Date();
};

const STATUS_META = {
  done:    { label: 'Done',        color: G.green,  bg: G.greenBg,  icon: 'checkmark-circle' },
  active:  { label: 'In Progress', color: G.amber,  bg: G.amberBg,  icon: 'time' },
  todo:    { label: 'To Do',       color: G.p700,   bg: G.p100,     icon: 'ellipse-outline' },
  hold:    { label: 'On Hold',     color: G.txtFaint, bg: 'rgba(0,0,0,0.05)', icon: 'pause-circle' },
  overdue: { label: 'Overdue',     color: G.red,    bg: G.redBg,    icon: 'alert-circle' },
};

// ─── BentoBox Component ───────────────────────────────────────────────────────
const BentoBox = ({ children, style, title, subtitle, titleColor = G.txtMain, headerRight }) => (
  <View style={[styles.shadowWrap, { marginBottom: GAP }, style]}>
    <View style={styles.glassLight}>
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
      <View style={styles.glassHighlight} />
      
      {(title || headerRight) && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: CPAD, paddingTop: CPAD, paddingBottom: 10 }}>
          <View style={{ flex: 1 }}>
            {title && <Text style={{ color: titleColor, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 }}>{title}</Text>}
            {subtitle && <Text style={{ color: G.txtFaint, fontSize: 13, fontWeight: '700', marginTop: 2 }}>{subtitle}</Text>}
          </View>
          {headerRight && <View>{headerRight}</View>}
        </View>
      )}
      <View style={{ paddingHorizontal: CPAD, paddingBottom: CPAD, paddingTop: (title || headerRight) ? 0 : CPAD }}>
        {children}
      </View>
    </View>
  </View>
);

// ─── SVG: Completion Gauge ────────────────────────────────────────────────────
function CompletionGauge({ pct, done, total, color }) {
  const W  = HALF_CW;
  const cx = W / 2, cy = W * 0.6;
  const r  = W * 0.42;
  const strokeW = W * 0.12;

  const theta  = ((180 - pct * 1.8) * Math.PI) / 180;
  const ex     = cx + r * Math.cos(theta);
  const ey     = cy - r * Math.sin(theta);
  const large  = pct > 50 ? 1 : 0;
  const bgL    = cx - r, bgR = cx + r;

  const filledPath = pct > 0 ? `M ${bgL} ${cy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey}` : null;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={W} height={cy + strokeW / 2}>
        <Path d={`M ${bgL} ${cy} A ${r} ${r} 0 0 0 ${bgR} ${cy}`} stroke="rgba(0,0,0,0.05)" strokeWidth={strokeW} fill="none" strokeLinecap="round" />
        {filledPath && <Path d={filledPath} stroke={color} strokeWidth={strokeW} fill="none" strokeLinecap="round" />}
        <SvgText x={cx} y={cy - 4} textAnchor="middle" fontSize={W * 0.22} fontWeight="900" fill={G.txtMain} letterSpacing={-1}>{pct}%</SvgText>
      </Svg>
      <Text style={[styles.gaugeFooter, { color }]}>{done}/{total} tasks done</Text>
    </View>
  );
}

// ─── SVG: Status Donut ────────────────────────────────────────────────────────
function StatusDonut({ done, active, todo, overdue, total }) {
  const W    = HALF_CW;
  const cx   = W / 2, cy = W / 2;
  const r    = W * 0.38;
  const C    = 2 * Math.PI * r;
  const strokeW = W * 0.16;
  const GAP  = 4;

  const segs = [
    { count: done,    color: G.green, label: 'Done' },
    { count: active,  color: G.amber, label: 'Active' },
    { count: todo,    color: G.p500,  label: 'Todo' },
    { count: overdue, color: G.red,   label: 'Late' },
  ].filter(s => s.count > 0);

  let offset = 0;
  const arcs = segs.map(seg => {
    const len  = (seg.count / Math.max(total, 1)) * (C - GAP * segs.length);
    const dash = `${len} ${C}`;
    const off  = -(offset);
    offset    += len + GAP;
    return { ...seg, dash, off };
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={W} height={W} viewBox={`0 0 ${W} ${W}`}>
        <Circle cx={cx} cy={cy} r={r} stroke="rgba(0,0,0,0.05)" strokeWidth={strokeW} fill="none" />
        {arcs.map((arc, i) => (
          <Circle key={i} cx={cx} cy={cy} r={r} stroke={arc.color} strokeWidth={strokeW} fill="none" strokeDasharray={arc.dash} strokeDashoffset={arc.off} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round" />
        ))}
        <SvgText x={cx} y={cy - 2} textAnchor="middle" fontSize={W * 0.18} fontWeight="900" fill={G.txtMain}>{total}</SvgText>
        <SvgText x={cx} y={cy + W * 0.12} textAnchor="middle" fontSize={W * 0.09} fontWeight="800" fill={G.txtFaint}>TASKS</SvgText>
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
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TeamDashboardScreen({ navigation, route }) {
  const { proj: initialProj, deptColor, deptName } = route.params;
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const canEdit  = user?.role === 'manager' || user?.role === 'supervisor';

  const [proj,          setProj]        = useState(initialProj);
  const [tasks,         setTasks]       = useState([]);
  const [isLoading,     setIsLoading]   = useState(true);
  const [isRefreshing,  setIsRefreshing] = useState(false);
  const [taskFilter,    setTaskFilter]  = useState('all');

  // Edit modal
  const [showEdit,      setShowEdit]    = useState(false);
  const [allUsers,      setAllUsers]    = useState([]);
  const [usersLoading,  setUsersLoading]= useState(false);
  const [selLead,       setSelLead]     = useState(initialProj.lead?.id ?? null);
  const [selMembers,    setSelMembers]  = useState(new Set((initialProj.members || []).map(m => m.id)));
  const [isSaving,      setIsSaving]    = useState(false);

  const accentColor = deptColor || G.p600;

  const fetchTasks = useCallback(async () => {
    try {
      const data = await getTasks({ project_id: proj.id, scope: 'team' });
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load team tasks:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [proj.id]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const onRefresh = () => { setIsRefreshing(true); fetchTasks(); };

  const total   = tasks.length;
  const done    = tasks.filter(t => getStatus(t) === 'done').length;
  const active  = tasks.filter(t => getStatus(t) === 'active').length;
  const todo    = tasks.filter(t => getStatus(t) === 'todo' && !isOverdue(t)).length;
  const overdue = tasks.filter(t => isOverdue(t)).length;
  const onHold  = tasks.filter(t => getStatus(t) === 'hold').length;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

  const allMembers = (() => {
    const seen = new Set();
    const list = [];
    if (proj.lead) { seen.add(proj.lead.id); list.push({ ...proj.lead, isLead: true }); }
    (proj.members || []).forEach(m => {
      if (!seen.has(m.id)) { seen.add(m.id); list.push({ ...m, isLead: false }); }
    });
    return list;
  })();

  const memberStats = allMembers.map(m => {
    const assigned  = tasks.filter(t => t.assigned_to?.id === m.id).length;
    const completed = tasks.filter(t => t.assigned_to?.id === m.id && getStatus(t) === 'done').length;
    const inProg    = tasks.filter(t => t.assigned_to?.id === m.id && getStatus(t) === 'active').length;
    const late      = tasks.filter(t => t.assigned_to?.id === m.id && isOverdue(t)).length;
    return { ...m, assigned, completed, inProg, late, compPct: assigned > 0 ? Math.round(completed / assigned * 100) : 0 };
  });

  const filteredTasks = tasks.filter(t => {
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
  });

  const openEdit = async () => {
    setShowEdit(true);
    setSelLead(proj.lead?.id ?? null);
    setSelMembers(new Set((proj.members || []).map(m => m.id)));
    if (allUsers.length === 0) {
      setUsersLoading(true);
      try {
        const data = await getUsers();
        setAllUsers(Array.isArray(data) ? data.filter(u => u.is_active !== false) : []);
      } catch (e) { console.error(e); }
      setUsersLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await assignProjectMembers(proj.id, { lead_id: selLead, member_ids: [...selMembers] });
      const lead    = selLead ? allUsers.find(u => u.id === selLead) : null;
      const members = [...selMembers].map(id => allUsers.find(u => u.id === id)).filter(Boolean);
      setProj(p => ({
        ...p,
        lead:    lead ? { id: lead.id, username: lead.username, role: lead.role } : null,
        members: members.map(m => ({ id: m.id, username: m.username, role: m.role })),
      }));
      setShowEdit(false);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update team');
    } finally {
      setIsSaving(false);
    }
  };

  const renderKPI = (label, value, color, icon) => (
    <View style={[styles.kpiPill, { borderColor: color + '40', backgroundColor: 'rgba(255,255,255,0.6)' }]}>
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ marginLeft: 6 }}>
        <Text style={[styles.kpiValue, { color: G.txtMain }]}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
    </View>
  );

  const renderStatusBar = (label, count, color, icon) => {
    const barPct = total > 0 ? count / total : 0;
    return (
      <View key={label} style={styles.statusBarRow}>
        <View style={[styles.statusIconBox, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.statusBarHeader}>
            <Text style={styles.statusBarLabel}>{label}</Text>
            <Text style={styles.statusBarCount}>{count}</Text>
          </View>
          <View style={styles.statusBarBg}>
            <View style={[styles.statusBarFill, { width: `${Math.round(barPct * 100)}%`, backgroundColor: color }]} />
          </View>
        </View>
      </View>
    );
  };

  const renderMemberStat = (m) => {
    const barW = FULL_W - (CPAD * 2) - 52 - 12; 
    const fillW = m.assigned > 0 ? Math.round((m.compPct / 100) * barW) : 0;
    return (
      <View key={m.id} style={styles.memberStatRow}>
        <TouchableOpacity
          style={[styles.memberStatAvatar, { backgroundColor: getAvatarColor(m.username) }]}
          onPress={() => navigation.navigate('UserPerformance', { targetUser: m })}
          activeOpacity={0.8}
        >
          <Text style={styles.memberStatAvatarText}>{getInitials(m.username)}</Text>
          {m.isLead && (
            <View style={styles.leadBadgeMini}>
              <Ionicons name="star" size={10} color={G.amber} />
            </View>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.memberStatHeader}>
            <Text style={styles.memberStatName} numberOfLines={1}>{m.username}</Text>
            <Text style={styles.memberStatPct}>{m.compPct}%</Text>
          </View>
          <View style={styles.memberBarBg}>
            <View style={[styles.memberBarFill, { width: fillW, backgroundColor: accentColor }]} />
          </View>
          <View style={styles.memberStatTags}>
            <Text style={styles.memberTagText}>{m.assigned} task{m.assigned !== 1 ? 's' : ''}</Text>
            {m.inProg > 0 && <Text style={[styles.memberTagText, { color: G.amber }]}>{m.inProg} active</Text>}
            {m.late  > 0 && <Text style={[styles.memberTagText, { color: G.red }]}>{m.late} overdue</Text>}
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) return <LoadingSpinner fullScreen message="Loading team data…" />;

  const FILTERS = [
    { key: 'all',     label: `All (${total})` },
    { key: 'active',  label: `Active (${active})` },
    { key: 'todo',    label: `To Do (${todo})` },
    { key: 'overdue', label: `Late (${overdue})` },
    { key: 'done',    label: `Done (${done})` },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />

      {/* ── Stable Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: accentColor }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -60, backgroundColor: G.p300, transform: [{ scale: 1.2 }] }]} />
      </View>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{proj.name}</Text>
            {deptName && <Text style={styles.headerSubtitle} numberOfLines={1}>{deptName}</Text>}
          </View>
          {canEdit ? (
            <TouchableOpacity style={[styles.editBtn, { backgroundColor: accentColor }]} onPress={openEdit} activeOpacity={0.8}>
              <Ionicons name="people" size={16} color={G.white} />
            </TouchableOpacity>
          ) : <View style={{ width: 44 }} />}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={G.p700} />}
      >
        {/* ── KPI Row ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiScroll} contentContainerStyle={styles.kpiContent}>
          {renderKPI('Total',    total,   G.p700,  'layers')}
          {renderKPI('Done',     done,    G.green, 'checkmark-circle')}
          {renderKPI('Active',   active,  G.amber, 'time')}
          {renderKPI('Overdue',  overdue, G.red,   'alert-circle')}
          {renderKPI('Complete', `${pct}%`, accentColor, 'trophy')}
        </ScrollView>

        {/* ── Team Members Card ── */}
        <BentoBox title="Team Roster" subtitle={`${allMembers.length} member${allMembers.length !== 1 ? 's' : ''}`}>
          {proj.lead && (
            <View style={[styles.leadRow, { borderColor: G.amber + '40', backgroundColor: G.amberBg + '80' }]}>
              <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(proj.lead.username), width: 48, height: 48, borderRadius: 24 }]}>
                <Text style={[styles.memberAvatarText, { fontSize: 18 }]}>{getInitials(proj.lead.username)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.leadName}>{proj.lead.username}</Text>
                <Text style={styles.leadRole}>Team Lead</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('UserPerformance', { targetUser: proj.lead })}
                style={[styles.viewStatsBtn, { borderColor: G.amber + '50', backgroundColor: G.white }]}
                activeOpacity={0.8}
              >
                <Ionicons name="bar-chart" size={14} color={G.amber} />
                <Text style={[styles.viewStatsBtnText, { color: G.amber }]}>Stats</Text>
              </TouchableOpacity>
            </View>
          )}

          {(proj.members || []).filter(m => m.id !== proj.lead?.id).length > 0 && (
            <View style={styles.membersGrid}>
              {(proj.members || []).filter(m => m.id !== proj.lead?.id).map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.memberChip}
                  onPress={() => navigation.navigate('UserPerformance', { targetUser: m })}
                  activeOpacity={0.8}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(m.username), width: 36, height: 36, borderRadius: 18 }]}>
                    <Text style={[styles.memberAvatarText, { fontSize: 13 }]}>{getInitials(m.username)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberChipName} numberOfLines={1}>{m.username}</Text>
                    <View style={[styles.roleTagMini, { backgroundColor: (ROLE_CONFIG[m.role]?.bg || G.p100) }]}>
                      <Text style={[styles.roleTagMiniText, { color: ROLE_CONFIG[m.role]?.color || G.p700 }]}>
                        {ROLE_CONFIG[m.role]?.label || 'Member'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {allMembers.length === 0 && <Text style={styles.emptyNote}>No members assigned. Tap the edit button to add members.</Text>}
        </BentoBox>

        {/* ── Gauge + Donut ── */}
        <View style={styles.bentoRow}>
          <BentoBox title="Completion" style={styles.bentoItem}>
            <CompletionGauge pct={pct} done={done} total={total} color={accentColor} />
          </BentoBox>
          <BentoBox title="Distribution" style={styles.bentoItem}>
            <StatusDonut done={done} active={active} todo={todo} overdue={overdue} total={total} />
          </BentoBox>
        </View>

        {/* ── Status Breakdown bars ── */}
        <BentoBox title="Task Breakdown">
          <View style={{ gap: 14 }}>
            {renderStatusBar('Done',        done,    G.green, 'checkmark-circle')}
            {renderStatusBar('In Progress', active,  G.amber, 'time')}
            {renderStatusBar('To Do',       todo,    G.p700,  'ellipse-outline')}
            {renderStatusBar('Overdue',     overdue, G.red,   'alert-circle')}
            {onHold > 0 && renderStatusBar('On Hold', onHold, G.txtFaint, 'pause-circle')}
          </View>
        </BentoBox>

        {/* ── Member Contribution ── */}
        {memberStats.length > 0 && (
          <BentoBox title="Member Contribution" subtitle="Tap a member for detailed performance">
            <View style={{ gap: 16 }}>
              {memberStats.map(m => renderMemberStat(m))}
            </View>
          </BentoBox>
        )}

        {/* ── Task List ── */}
        <BentoBox title="Tasks">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {FILTERS.map(f => {
              const active = taskFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, active && { backgroundColor: accentColor, borderColor: accentColor }]}
                  onPress={() => setTaskFilter(f.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, active && { color: G.white }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: 10, gap: 12 }}>
            {filteredTasks.length === 0 ? (
              <Text style={styles.emptyNote}>No tasks in this category</Text>
            ) : (
              filteredTasks.map(t => {
                const late   = isOverdue(t);
                const st     = late ? 'overdue' : getStatus(t);
                const stMeta = STATUS_META[st] || STATUS_META.todo;
                const pr     = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
                const dl     = fmtDate(t.deadline);
                const assignee = t.assigned_to;

                return (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.taskCard}
                    onPress={() => navigation.navigate('TaskDetail', { task: t })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.taskAccent, { backgroundColor: stMeta.color }]} />
                    <View style={styles.taskCardInner}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.taskTitle} numberOfLines={2}>{t.title}</Text>
                        {assignee ? (
                          <View style={styles.taskAssigneeRow}>
                            <View style={[styles.taskAssigneeAvatar, { backgroundColor: getAvatarColor(assignee.username) }]}>
                              <Text style={styles.taskAssigneeInit}>{getInitials(assignee.username)}</Text>
                            </View>
                            <Text style={styles.taskAssigneeName}>{assignee.username}</Text>
                            {dl && (
                              <>
                                <Ionicons name="calendar" size={12} color={late ? G.red : G.txtFaint} style={{ marginLeft: 8 }} />
                                <Text style={[styles.taskDeadline, late && { color: G.red }]}>{dl}</Text>
                              </>
                            )}
                          </View>
                        ) : dl ? (
                          <View style={styles.taskAssigneeRow}>
                            <Ionicons name="calendar" size={12} color={late ? G.red : G.txtFaint} />
                            <Text style={[styles.taskDeadline, late && { color: G.red }]}>{dl}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.taskBadges}>
                        <View style={[styles.statusBadge, { backgroundColor: stMeta.bg, borderColor: stMeta.color + '40' }]}>
                          <Text style={[styles.statusBadgeText, { color: stMeta.color }]}>{stMeta.label}</Text>
                        </View>
                        <View style={[styles.priBadge, { backgroundColor: pr.bg, borderColor: pr.color + '40' }]}>
                          <Text style={[styles.priBadgeText, { color: pr.color }]}>{pr.label}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </BentoBox>
      </ScrollView>

      {/* ── Edit Team Modal (Liquid Glass) ── */}
      <Modal visible={showEdit} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowEdit(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEdit(false)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
              <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.8)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />

              <View style={styles.modalHandle} />
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>Edit Team — {proj.name}</Text>
                <TouchableOpacity onPress={() => setShowEdit(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={26} color={G.txtFaint} />
                </TouchableOpacity>
              </View>

              {usersLoading ? (
                <ActivityIndicator size="large" color={G.p700} style={{ marginVertical: 40 }} />
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: SW * 1.2 }}>
                  {/* Lead picker */}
                  <Text style={styles.pickerGroupLabel}>Team Lead{'  '}<Text style={styles.pickerHint}>pick one</Text></Text>
                  {allUsers.map(u => {
                    const active = selLead === u.id;
                    const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.employee;
                    return (
                      <TouchableOpacity key={`lead-${u.id}`} style={[styles.userPickRow, active && styles.userPickRowActive]} onPress={() => setSelLead(active ? null : u.id)} activeOpacity={0.7}>
                        <View style={[styles.pickAvatar, { backgroundColor: getAvatarColor(u.username) }]}><Text style={styles.pickAvatarText}>{getInitials(u.username)}</Text></View>
                        <Text style={[styles.userPickName, active && { color: G.p800, fontWeight: '900' }]} numberOfLines={1}>{u.username}</Text>
                        <View style={[styles.rolePill, { backgroundColor: rc.bg, borderColor: rc.color + '40' }]}><Text style={[styles.rolePillText, { color: rc.color }]}>{rc.label}</Text></View>
                        <View style={[styles.radioCircle, active && { borderColor: G.p700, backgroundColor: G.p700 }]}>{active && <View style={styles.radioDot} />}</View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Members picker */}
                  <Text style={[styles.pickerGroupLabel, { marginTop: 20 }]}>Members{'  '}<Text style={styles.pickerHint}>pick multiple</Text></Text>
                  {allUsers.map(u => {
                    const active = selMembers.has(u.id);
                    const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.employee;
                    return (
                      <TouchableOpacity
                        key={`mem-${u.id}`}
                        style={[styles.userPickRow, active && styles.userPickRowActive]}
                        onPress={() => setSelMembers(prev => {
                          const next = new Set(prev);
                          if (next.has(u.id)) next.delete(u.id); else next.add(u.id);
                          return next;
                        })}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.pickAvatar, { backgroundColor: getAvatarColor(u.username) }]}><Text style={styles.pickAvatarText}>{getInitials(u.username)}</Text></View>
                        <Text style={[styles.userPickName, active && { color: G.p800, fontWeight: '900' }]} numberOfLines={1}>{u.username}</Text>
                        <View style={[styles.rolePill, { backgroundColor: rc.bg, borderColor: rc.color + '40' }]}><Text style={[styles.rolePillText, { color: rc.color }]}>{rc.label}</Text></View>
                        <View style={[styles.checkBox, active && { borderColor: G.p700, backgroundColor: G.p700 }]}>{active && <Ionicons name="checkmark" size={16} color={G.white} />}</View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEdit(false)} activeOpacity={0.8}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: accentColor }, isSaving && { opacity: 0.6 }]} onPress={handleSave} disabled={isSaving} activeOpacity={0.8}>
                  {isSaving ? <ActivityIndicator size="small" color={G.white} /> : <Text style={styles.confirmBtnText}>Save Team</Text>}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
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
  headerInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: G.txtFaint, fontWeight: '800', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  editBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },

  scroll: { paddingHorizontal: GUTTER, paddingTop: 16 },

  // ── Bento Layout
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  bentoRow: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  bentoItem: { flex: 1, marginBottom: 0 },

  // ── KPI Row
  kpiScroll:  { flexGrow: 0, marginBottom: GAP },
  kpiContent: { gap: 10, paddingBottom: 4 },
  kpiPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, borderWidth: 2,
  },
  kpiValue: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  kpiLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Team Card
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 2, padding: 14, marginBottom: 16 },
  leadName: { fontSize: 16, fontWeight: '900', color: G.txtMain },
  leadRole: { fontSize: 11, color: G.amber, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  
  viewStatsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5 },
  viewStatsBtnText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  membersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  memberChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    width: (FULL_W - (CPAD * 2) - 10) / 2, // Exactly half of available width
  },
  memberChipName: { fontSize: 13, fontWeight: '900', color: G.txtMain, flex: 1 },
  roleTagMini: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 2 },
  roleTagMiniText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },

  memberAvatar:     { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  memberAvatarText: { fontWeight: '900', color: G.white },
  emptyNote: { fontSize: 13, color: G.txtFaint, fontStyle: 'italic', fontWeight: '700', paddingVertical: 10 },

  // ── Charts
  gaugeFooter: { fontSize: 12, fontWeight: '900', marginTop: 6 },
  donutLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 12 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendText:  { fontSize: 11, fontWeight: '900', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Status breakdown bars
  statusBarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statusBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  statusBarLabel: { fontSize: 12, fontWeight: '900', color: G.txtMain },
  statusBarCount: { fontSize: 13, fontWeight: '900', color: G.txtMain },
  statusBarBg:   { height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' },
  statusBarFill: { height: 8, borderRadius: 4 },

  // ── Member stats
  memberStatRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  memberStatAvatar:     { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...liquidShadow, shadowOpacity: 0.2 },
  memberStatAvatarText: { fontSize: 16, fontWeight: '900', color: G.white },
  leadBadgeMini: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: G.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: G.amberBg },
  memberStatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  memberStatName:   { fontSize: 15, fontWeight: '900', color: G.txtMain, flex: 1 },
  memberStatPct:    { fontSize: 15, fontWeight: '900', color: G.txtMain },
  memberBarBg:      { height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  memberBarFill:    { height: 8, borderRadius: 4 },
  memberStatTags:   { flexDirection: 'row', gap: 12 },
  memberTagText:    { fontSize: 11, fontWeight: '900', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Task filter
  filterScroll:  { flexGrow: 0, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 2, borderColor: G.p200 },
  filterChipText: { fontSize: 12, fontWeight: '900', color: G.txtFaint, letterSpacing: 0.5 },

  // ── Task card
  taskCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.4)', marginBottom: 12 },
  taskAccent:      { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  taskCardInner:   { padding: 14, paddingLeft: 18, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  taskTitle:       { fontSize: 15, fontWeight: '900', color: G.txtMain, letterSpacing: -0.2, marginBottom: 6, lineHeight: 20 },
  taskAssigneeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskAssigneeAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  taskAssigneeInit:   { fontSize: 10, fontWeight: '900', color: G.white },
  taskAssigneeName:   { fontSize: 12, fontWeight: '800', color: G.txtFaint },
  taskDeadline:       { fontSize: 12, fontWeight: '800', color: G.txtFaint },
  taskBadges:         { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1.5 },
  statusBadgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  priBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1.5 },
  priBadgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Edit modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', shadowColor: G.p900, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20 },
  modalHandle:      { width: 48, height: 6, borderRadius: 3, backgroundColor: G.p200, alignSelf: 'center', marginBottom: 20 },
  editModalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  editModalTitle:   { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5, flex: 1 },

  editActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, backgroundColor: G.white, borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderColor: G.p200 },
  cancelBtnText:  { fontSize: 15, fontWeight: '900', color: G.txtFaint },
  confirmBtn:     { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', ...liquidShadow },
  confirmBtnText: { fontSize: 15, fontWeight: '900', color: G.white },

  // ── User pickers
  pickerGroupLabel: { fontSize: 12, fontWeight: '900', color: G.txtMain, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, paddingLeft: 4 },
  pickerHint:       { fontSize: 11, fontWeight: '800', color: G.txtFaint, textTransform: 'lowercase', letterSpacing: 0 },
  userPickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 2, borderColor: G.p200 },
  userPickRowActive: { backgroundColor: G.white, borderColor: G.p600 },
  pickAvatar:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pickAvatarText: { fontSize: 15, fontWeight: '900', color: G.white },
  userPickName:   { flex: 1, fontSize: 15, fontWeight: '800', color: G.txtMain },
  rolePill:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5 },
  rolePillText:   { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  radioCircle:    { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: G.p300, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: G.white },
  checkBox:       { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: G.p300, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});