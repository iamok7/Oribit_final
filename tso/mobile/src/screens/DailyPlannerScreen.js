import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  StatusBar,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { getTasks, updateTask } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const { width: SW } = Dimensions.get('window');
const GUTTER = 16;
const GAP = 12;

// ─── Liquid Glass High Contrast Palette ──────────────────────────────────────
const G = {
  bgLight:  '#F0F6FF',
  bgMid:    '#E0F2FE',
  bgDark:   '#F8FAFC',
  
  txtMain:  '#020617', // Slate 950
  txtMuted: '#1E293B', // Slate 800
  txtFaint: '#334155', // Slate 700

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
};

// Native fluid shadow
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

// ─── Section config ───────────────────────────────────────────────────────────
const SECTIONS = [
  { key: 'overdue',     label: 'Overdue',     icon: 'alert-circle',       color: G.red,    bg: G.redBg },
  { key: 'in_progress', label: 'In Progress', icon: 'flash',              color: G.p600,   bg: G.p100 },
  { key: 'todo',        label: 'To Do',       icon: 'ellipse-outline',    color: G.p800,   bg: G.p200 },
  { key: 'completed',   label: 'Completed',   icon: 'checkmark-circle',   color: G.green,  bg: G.greenBg },
];

const PRIORITY_CFG = {
  high:   { color: G.red,   icon: 'arrow-up-circle-outline' },
  medium: { color: G.amber, icon: 'remove-circle-outline'  },
  low:    { color: G.green, icon: 'arrow-down-circle-outline' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const norm = (s) => (s || '').toLowerCase().replace(/[\s-]+/g, '_');

const isSameDay = (d1, d2) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth()    === d2.getMonth()    &&
  d1.getDate()     === d2.getDate();

const fmtTime = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return null; }
};

const fmtDateFull = (date) =>
  date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const fmtDateShort = (date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const getSection = (task, selectedDate) => {
  const s = norm(task.status);
  if (s === 'completed') return 'completed';
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const now = new Date();
  if (deadline && isSameDay(deadline, selectedDate) && deadline < now) return 'overdue';
  if (s === 'in_progress') return 'in_progress';
  return 'todo';
};

// ─── Date Strip ───────────────────────────────────────────────────────────────
const DateStrip = ({ selectedDate, onSelectDate }) => {
  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const dow = selectedDate.getDay();
  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - dow);
  const today = new Date();

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return { day: DAYS[i], num: d.getDate(), date: d, isToday: isSameDay(d, today), isSelected: isSameDay(d, selectedDate) };
  });

  return (
    <FlatList
      data={dates}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingVertical: 4 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onSelectDate(item.date)}
          activeOpacity={0.75}
          style={[
            styles.dateCell,
            item.isSelected && styles.dateCellSelected,
            item.isToday && !item.isSelected && styles.dateCellToday,
          ]}
        >
          <Text style={[styles.dateDow, item.isSelected && { color: G.white }]}>{item.day}</Text>
          <Text style={[styles.dateNum, item.isSelected && { color: G.white }]}>{item.num}</Text>
          {item.isToday && (
            <View style={[styles.todayDot, { backgroundColor: item.isSelected ? G.white : G.p600 }]} />
          )}
        </TouchableOpacity>
      )}
    />
  );
};

// ─── Task Row ─────────────────────────────────────────────────────────────────
const TaskRow = ({ task, sectionKey, onPress, onToggleComplete }) => {
  const time    = fmtTime(task.deadline || task.start_time);
  const priCfg  = PRIORITY_CFG[(task.priority || 'medium').toLowerCase()] || PRIORITY_CFG.medium;
  const isDone  = sectionKey === 'completed';
  const isOver  = sectionKey === 'overdue';

  return (
    <TouchableOpacity
      style={[styles.shadowWrap, { marginBottom: GAP }]}
      onPress={() => onPress(task)}
      activeOpacity={0.8}
    >
      <View style={[styles.glassLight, styles.taskRowCard, isOver && styles.taskRowOverdue]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={isOver ? ['rgba(254,226,226,0.8)', 'rgba(254,226,226,0.4)'] : ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
        <View style={styles.glassHighlight} />

        {/* Time badge */}
        <View style={styles.timeBadge}>
          {time ? (
            <>
              <Text style={[styles.timeText, isOver && { color: G.red }]}>{time.split(' ')[0]}</Text>
              <Text style={[styles.timeAmPm, isOver && { color: G.red }]}>{time.split(' ')[1]}</Text>
            </>
          ) : (
            <Ionicons name="time" size={16} color={G.p300} />
          )}
        </View>

        {/* Priority dot line */}
        <View style={[styles.dotLine, { backgroundColor: priCfg.color + '30' }]}>
          <View style={[styles.dotBall, { backgroundColor: priCfg.color }]} />
        </View>

        {/* Content */}
        <View style={styles.taskContent}>
          <Text
            style={[styles.taskTitle, isDone && styles.taskTitleDone, isOver && styles.taskTitleOver]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
          {!!task.description && (
            <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
          )}
          {/* Tags */}
          {task.tags?.length > 0 && (
            <View style={styles.tagRow}>
              {task.tags.slice(0, 2).map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Action: complete toggle */}
        <TouchableOpacity
          style={styles.checkBtn}
          onPress={() => onToggleComplete(task)}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
            size={26}
            color={isDone ? G.green : G.p300}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ cfg, count, collapsed, onToggle }) => (
  <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.75}>
    <View style={[styles.iconBadge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={16} color={cfg.color} />
    </View>
    <Text style={[styles.sectionLabel, { color: G.txtMain }]}>{cfg.label}</Text>
    <View style={[styles.sectionBadge, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}>
      <Text style={[styles.sectionCount, { color: cfg.color }]}>{count}</Text>
    </View>
    <View style={{ flex: 1 }} />
    <Ionicons
      name={collapsed ? 'chevron-down' : 'chevron-up'}
      size={18}
      color={G.txtMuted}
    />
  </TouchableOpacity>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DailyPlannerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);
  const [collapsed, setCollapsed]       = useState({});

  // ── Week navigation ──────────────────────────────────────────────────────────
  const shiftWeek = (dir) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir * 7);
    setSelectedDate(d);
  };

  // ── Data loading ─────────────────────────────────────────────────────────────
  const load = useCallback(async (showRefresh = false) => {
    try {
      setError(null);
      if (showRefresh) setRefreshing(true); else setLoading(true);
      const data = await getTasks();
      const raw = Array.isArray(data) ? data : data?.tasks || [];
      setTasks(raw);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Filter: only is_daily_task for selected date ──────────────────────────────
  const dailyTasks = tasks.filter((t) => {
    if (!t.is_daily_task) return false;
    if (!t.deadline) return false;
    return isSameDay(new Date(t.deadline), selectedDate);
  });

  // ── Bucket into sections ──────────────────────────────────────────────────────
  const bucketed = { overdue: [], in_progress: [], todo: [], completed: [] };
  dailyTasks.forEach((t) => {
    const key = getSection(t, selectedDate);
    bucketed[key].push(t);
  });
  // Sort each bucket by deadline time
  Object.values(bucketed).forEach((arr) =>
    arr.sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    })
  );

  const totalCount = dailyTasks.length;
  const doneCount  = bucketed.completed.length;
  const pct        = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleTaskPress = (task) => navigation.navigate('TaskDetail', { task });

  const handleToggleComplete = async (task) => {
    try {
      const newStatus = norm(task.status) === 'completed' ? 'in_progress' : 'Completed';
      await updateTask(task.id, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t)
      );
    } catch (e) {
      // silent fail — will refresh on next focus
    }
  };

  const handleAddTask = () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    navigation.navigate('AddTask', {
      task: null,
      prefillDaily: true,
      prefillDate: dateStr,
    });
  };

  const toggleSection = (key) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner fullScreen message="Loading planner..." />;

  const isToday = isSameDay(selectedDate, new Date());

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* Background Gradient & Ambient Orbs */}
      <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
      <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.p300 }]} />
      <View style={[styles.ambientOrb, { bottom: -100, left: -60, backgroundColor: '#A5F3FC', transform: [{ scale: 1.2 }] }]} />

      {/* ── High Contrast Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={G.p700} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Daily Planner</Text>
            <Text style={styles.headerSub}>
              {isToday ? 'Today · ' : ''}{fmtDateFull(selectedDate)}
            </Text>
          </View>

          <TouchableOpacity style={styles.iconBtn} onPress={handleAddTask} activeOpacity={0.7}>
            <Ionicons name="add" size={22} color={G.p700} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={G.p600} />}
      >
        {/* ── Week Navigator ───────────────────────────────────────────────── */}
        <View style={[styles.shadowWrap, { marginBottom: GAP }]}>
          <View style={[styles.glassLight, styles.weekNavCard]}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.3)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            
            <TouchableOpacity style={styles.weekArrow} onPress={() => shiftWeek(-1)} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={16} color={G.p700} />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <DateStrip selectedDate={selectedDate} onSelectDate={(d) => setSelectedDate(d)} />
            </View>

            <TouchableOpacity style={styles.weekArrow} onPress={() => shiftWeek(1)} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={16} color={G.p700} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Progress Summary ─────────────────────────────────────────────── */}
        <View style={[styles.shadowWrap, { marginBottom: GAP }]}>
          <View style={styles.glassLight}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />

            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryTitle}>
                  {totalCount === 0
                    ? isToday ? 'Free day ahead!' : 'Nothing planned'
                    : `${doneCount} of ${totalCount} done`}
                </Text>
                <Text style={styles.summarySub}>
                  {isToday ? "Today's daily tasks" : fmtDateShort(selectedDate) + ' tasks'}
                </Text>
              </View>
              
              <View style={styles.completionRing}>
                <Text style={styles.completionPct}>{pct}%</Text>
                <Text style={styles.completionLabel}>DONE</Text>
              </View>
            </View>

            {/* Progress bar */}
            {totalCount > 0 && (
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                </View>
              </View>
            )}

            {/* Stats row */}
            {totalCount > 0 && (
              <View style={styles.statsRow}>
                {[
                  { label: 'To Do',      val: bucketed.todo.length,        color: G.p700, bg: G.p100 },
                  { label: 'In Progress',val: bucketed.in_progress.length, color: G.amber, bg: G.amberBg },
                  { label: 'Done',       val: bucketed.completed.length,   color: G.green, bg: G.greenBg },
                  { label: 'Overdue',    val: bucketed.overdue.length,     color: G.red, bg: G.redBg },
                ].map((s) => (
                  <View key={s.label} style={[styles.miniStatPill, { backgroundColor: s.bg }]}>
                    <Text style={[styles.miniStatPillNum, { color: s.color }]}>{s.val}</Text>
                    <Text style={[styles.miniStatPillLabel, { color: s.color }]} numberOfLines={1} adjustsFontSizeToFit>{s.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── Error Banner ─────────────────────────────────────────────────── */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={G.red} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => load(true)}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
          </View>
        )}

        {/* ── Empty State ───────────────────────────────────────────────────── */}
        {totalCount === 0 && !error && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar" size={44} color={G.p400} />
            </View>
            <Text style={styles.emptyTitle}>
              {isToday ? 'Nothing planned for today' : `Nothing for ${fmtDateShort(selectedDate)}`}
            </Text>
            <Text style={styles.emptyDesc}>
              Add daily tasks with the + button to plan your day with time-based organization.
            </Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={handleAddTask} activeOpacity={0.85}>
              <Ionicons name="add-circle" size={18} color={G.white} />
              <Text style={styles.emptyAddText}>Add Daily Task</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Sections ─────────────────────────────────────────────────────── */}
        {SECTIONS.map((cfg) => {
          const items = bucketed[cfg.key];
          if (items.length === 0) return null;
          const isCollapsed = collapsed[cfg.key];

          return (
            <View key={cfg.key} style={styles.sectionWrap}>
              <SectionHeader
                cfg={cfg}
                count={items.length}
                collapsed={isCollapsed}
                onToggle={() => toggleSection(cfg.key)}
              />

              {!isCollapsed && (
                <View style={styles.sectionBody}>
                  {items.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      sectionKey={cfg.key}
                      onPress={handleTaskPress}
                      onToggleComplete={handleToggleComplete}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}

      </ScrollView>

      {/* ── High Contrast FAB ────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={handleAddTask}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[G.p500, G.p700]} style={StyleSheet.absoluteFill} />
        <View style={styles.fabHighlight} />
        <Ionicons name="add" size={28} color={G.white} />
      </TouchableOpacity>
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
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: G.txtFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },

  // ── Scroll Content
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: GUTTER, paddingTop: 16 },

  // ── Shadow Wrappers & Glass ──
  shadowWrap: { ...liquidShadow },
  glassLight: {
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    padding: 16,
  },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white },

  // ── Week Nav
  weekNavCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  weekArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: G.p100 },
  dateCell: { width: 40, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: G.p200 },
  dateCellSelected: { backgroundColor: G.p700, borderColor: G.p900, shadowColor: G.p900, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  dateCellToday: { borderColor: G.p500, borderWidth: 2 },
  dateDow: { fontSize: 10, fontWeight: '800', color: G.txtFaint, textTransform: 'uppercase' },
  dateNum: { fontSize: 16, fontWeight: '900', color: G.txtMain },
  todayDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },

  // ── Summary Card
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  summaryTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  summarySub: { fontSize: 13, color: G.txtFaint, fontWeight: '700' },
  
  completionRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 5, borderColor: G.p600, backgroundColor: G.p100, alignItems: 'center', justifyContent: 'center' },
  completionPct: { fontSize: 16, fontWeight: '900', color: G.p900 },
  completionLabel: { fontSize: 8, color: G.p600, fontWeight: '900', marginTop: -2, letterSpacing: 1 },

  progressBarContainer: { gap: 6, marginBottom: 16 },
  progressBarBg: { height: 8, backgroundColor: G.p200, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: G.p600, borderRadius: 4 },

  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  miniStatPill: { flex: 1, minWidth: '45%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, gap: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  miniStatPillNum: { fontSize: 18, fontWeight: '900' },
  miniStatPillLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1, textAlign: 'right' },

  // ── Error
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: G.redBg, borderRadius: 16, padding: 14, gap: 10, borderWidth: 2, borderColor: '#FCA5A5', marginBottom: GAP },
  errorText: { flex: 1, fontSize: 14, color: G.red, fontWeight: '700' },
  retryText: { fontSize: 14, color: G.red, fontWeight: '900' },

  // ── Empty State
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: G.p100, borderWidth: 2, borderColor: G.p200, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: G.txtMain, textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  emptyDesc: { fontSize: 14, color: G.txtFaint, fontWeight: '700', textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: G.p700, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 14, ...liquidShadow },
  emptyAddText: { fontSize: 15, color: G.white, fontWeight: '900', letterSpacing: 0.5 },

  // ── Sections
  sectionWrap: { marginBottom: GAP },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingHorizontal: 4 },
  iconBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  sectionBadge: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, minWidth: 26, alignItems: 'center' },
  sectionCount: { fontSize: 12, fontWeight: '900' },
  sectionBody: { gap: 0 },

  // ── Task Row (Bento Style)
  taskRowCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20 },
  taskRowOverdue: { borderColor: '#FCA5A5' },

  timeBadge: { width: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  timeText: { fontSize: 13, fontWeight: '900', color: G.p700 },
  timeAmPm: { fontSize: 10, fontWeight: '800', color: G.txtFaint, textTransform: 'uppercase' },

  dotLine: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: 12, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  dotBall: { width: 10, height: 10, borderRadius: 5, marginTop: -3 },

  taskContent: { flex: 1, justifyContent: 'center' },
  taskTitle: { fontSize: 15, fontWeight: '800', color: G.txtMain, marginBottom: 2 },
  taskTitleDone: { textDecorationLine: 'line-through', color: G.txtFaint },
  taskTitleOver: { color: G.red },
  taskDesc: { fontSize: 12, color: G.txtFaint, fontWeight: '700' },
  
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tagChip: { backgroundColor: G.p100, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 10, color: G.p700, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  checkBtn: { marginLeft: 10, padding: 4 },

  // ── FAB
  fab: {
    position: 'absolute', right: GUTTER, width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
    overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  fabHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(255,255,255,0.25)' },
});