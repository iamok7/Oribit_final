import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Modal,
  Pressable,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { getCalendarEvents, getTasks } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_ITEM_WIDTH = 64;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const formatDate = (d) => {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};

const formatTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
};

const getStatusColor = (status) => {
  const s = (status || '').toLowerCase().replace(/\s+/g, '_');
  const map = {
    in_progress: G.p600,
    completed:   G.green,
    on_hold:     G.amber,
    past_due:    G.red,
    todo:        G.p800,
    to_do:       G.p800,
    pending:     G.amber,
    done:        G.green,
  };
  return map[s] || G.p600;
};

const generateMonthDates = (year, month) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result = [];
  for (let d = 1; d <= daysInMonth; d++) {
    result.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return result;
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CalendarScreen({ navigation }) {
  const { user, isManager, isSupervisor, isEmployee, isFinance } = useAuth();
  const insets = useSafeAreaInsets();
  const today = formatDate(new Date());

  const [selectedDate, setSelectedDate]   = useState(today);
  const [currentMonth, setCurrentMonth]   = useState(new Date());
  const [tasks, setTasks]                 = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [showMore, setShowMore]           = useState(false);

  const moreAnim     = useRef(new Animated.Value(0)).current;
  const dateStripRef = useRef(null);

  const dateRange = useMemo(
    () => generateMonthDates(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (month, year) => {
    try {
      const [tasksRes, eventsRes] = await Promise.allSettled([
        getTasks(),
        getCalendarEvents(month, year),
      ]);
      if (tasksRes.status === 'fulfilled') {
        const d = tasksRes.value;
        setTasks(Array.isArray(d) ? d : d?.tasks || []);
      }
      if (eventsRes.status === 'fulfilled') {
        const d = eventsRes.value;
        setCalendarEvents(Array.isArray(d) ? d : d?.events || []);
      }
    } catch (_) {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentMonth.getMonth() + 1, currentMonth.getFullYear());
  }, [currentMonth, fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData(currentMonth.getMonth() + 1, currentMonth.getFullYear());
    }, [currentMonth, fetchData])
  );

  useEffect(() => {
    if (!dateStripRef.current || dateRange.length === 0) return;
    const idx = dateRange.indexOf(selectedDate);
    const target = idx >= 0 ? idx : 0;
    const offset = target * DAY_ITEM_WIDTH - (SCREEN_WIDTH / 2 - DAY_ITEM_WIDTH / 2);
    dateStripRef.current.scrollToOffset({ offset: Math.max(0, offset), animated: false });
  }, [selectedDate, dateRange]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const toggleMore = () => {
    if (showMore) {
      Animated.timing(moreAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        setShowMore(false)
      );
    } else {
      setShowMore(true);
      Animated.timing(moreAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  };

  const handleDaySelect = (dateStr) => setSelectedDate(dateStr);

  const goToPrevMonth = () => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setCurrentMonth(d);
    setSelectedDate(formatDate(d));
  };

  const goToNextMonth = () => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setCurrentMonth(d);
    setSelectedDate(formatDate(d));
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const selectedDateObj = new Date(selectedDate + 'T00:00:00');

  const dailyTasksForDay = tasks.filter((t) => {
    if (!t.is_daily_task) return false;
    const d = (t.start_time || t.deadline || t.created_on || '').split('T')[0];
    return d === selectedDate;
  });

  const regularTasksForDay = tasks.filter((t) => {
    if (t.is_daily_task) return false;
    const d = (t.deadline || t.due_date || '').split('T')[0];
    return d === selectedDate;
  });

  const eventsForDay = calendarEvents.filter((e) => {
    const d = (e.date || e.start_date || '').split('T')[0];
    return d === selectedDate;
  });

  const totalItemCount = dailyTasksForDay.length + regularTasksForDay.length + eventsForDay.length;

  // ── Role-based quick actions ────────────────────────────────────────────────
  const quickActions = useMemo(() => {
    const actions = [
      { icon: 'add-circle', label: 'Add Task', color: G.p600, onPress: () => { toggleMore(); navigation.navigate('AddTask', { task: null }); } },
      { icon: 'receipt', label: 'Add Expense', color: G.purple, onPress: () => { toggleMore(); navigation.navigate('AddExpense'); } },
    ];

    if (!isFinance()) actions.push({ icon: 'trending-up', label: 'My Progress', color: G.green, onPress: () => { toggleMore(); navigation.navigate('Progress'); } });
    if (isSupervisor() || isManager()) actions.push({ icon: 'business', label: 'Departments', color: G.amber, onPress: () => { toggleMore(); navigation.navigate('DepartmentsStack'); } });
    if (isManager()) actions.push({ icon: 'people', label: 'Manage Users', color: G.red, onPress: () => { toggleMore(); navigation.navigate('Main', { screen: 'Users' }); } });
    if (isFinance() || isManager() || isSupervisor()) actions.push({ icon: 'wallet', label: 'Expenses', color: G.p800, onPress: () => { toggleMore(); navigation.navigate('ExpensesStack'); } });
    if (!isEmployee()) actions.push({ icon: 'calendar', label: 'View Calendar', color: G.p400, onPress: () => { toggleMore(); } });

    return actions;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  // ── Render Helpers ──────────────────────────────────────────────────────────
  const datesWithDailyTasks = useMemo(() => {
    const s = new Set();
    tasks.forEach((t) => {
      if (!t.is_daily_task) return;
      const d = (t.start_time || t.deadline || '').split('T')[0];
      if (d) s.add(d);
    });
    return s;
  }, [tasks]);

  const datesWithRegularTasks = useMemo(() => {
    const s = new Set();
    tasks.forEach((t) => {
      if (t.is_daily_task) return;
      const d = (t.deadline || t.due_date || '').split('T')[0];
      if (d) s.add(d);
    });
    return s;
  }, [tasks]);

  const renderDayItem = ({ item: dateStr }) => {
    const d          = new Date(dateStr + 'T00:00:00');
    const isSelected = dateStr === selectedDate;
    const isToday    = dateStr === today;
    const hasDaily   = datesWithDailyTasks.has(dateStr);
    const hasRegular = datesWithRegularTasks.has(dateStr);

    return (
      <TouchableOpacity
        style={[styles.dateCell, isSelected && styles.dateCellSelected, isToday && !isSelected && styles.dateCellToday]}
        onPress={() => handleDaySelect(dateStr)}
        activeOpacity={0.75}
      >
        <Text style={[styles.dateDow, isSelected && { color: G.white }]}>
          {DAY_NAMES[d.getDay()]}
        </Text>
        <Text style={[styles.dateNum, isSelected && { color: G.white }]}>
          {d.getDate()}
        </Text>
        <View style={styles.dayDotsRow}>
          {hasDaily ? (
            <View style={[styles.dayDot, { backgroundColor: isSelected ? G.white : G.p500 }]} />
          ) : <View style={styles.dayDotPlaceholder} />}
          {hasRegular ? (
            <View style={[styles.dayDot, { backgroundColor: isSelected ? 'rgba(255,255,255,0.6)' : G.purple }]} />
          ) : <View style={styles.dayDotPlaceholder} />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTaskCard = (item, idx) => {
    const isTask   = item._type !== 'event';
    const title    = item.title || item.name || 'Untitled';
    const color    = isTask ? getStatusColor(item.status) : G.p600;
    const sub      = isTask ? (item.status || 'Pending') : (item.time || 'All day');

    return (
      <TouchableOpacity
        key={`task-${item.id ?? idx}`}
        style={[styles.shadowWrap, { marginBottom: GAP }]}
        onPress={() => isTask && navigation.navigate('TaskDetail', { task: item })}
        activeOpacity={0.8}
      >
        <View style={[styles.glassLight, styles.taskCard]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.3)']} style={StyleSheet.absoluteFill} />
          <View style={styles.glassHighlight} />

          <View style={[styles.taskCardBar, { backgroundColor: color }]} />
          <View style={styles.taskCardBody}>
            <Text style={styles.taskCardTitle} numberOfLines={1}>{title}</Text>
            {item.description ? <Text style={styles.taskCardDesc} numberOfLines={1}>{item.description}</Text> : null}
          </View>
          <View style={[styles.taskCardBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.taskCardBadgeText, { color }]}>{sub}</Text>
          </View>
          {isTask && <Ionicons name="chevron-forward" size={16} color={G.p300} style={{ marginLeft: 6 }} />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDayPlanCard = (task, idx) => {
    const color    = getStatusColor(task.status);
    const timeStr  = formatTime(task.start_time);
    const isDone   = (task.status || '').toLowerCase().includes('complet');

    return (
      <TouchableOpacity
        key={`daily-${task.id ?? idx}`}
        style={[styles.shadowWrap, { marginBottom: GAP }]}
        onPress={() => navigation.navigate('TaskDetail', { task })}
        activeOpacity={0.8}
      >
        <View style={[styles.glassLight, styles.dayPlanCard]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.5)']} style={StyleSheet.absoluteFill} />
          <View style={styles.glassHighlight} />

          <View style={styles.dayPlanTimeCol}>
            {timeStr ? (
              <>
                <Text style={styles.dayPlanTime}>{timeStr.split(' ')[0]}</Text>
                <Text style={styles.dayPlanAmPm}>{timeStr.split(' ')[1]}</Text>
              </>
            ) : (
              <Ionicons name="sunny" size={18} color={G.p400} />
            )}
          </View>

          <View style={styles.dayPlanConnector}>
            <View style={[styles.dayPlanDot, { backgroundColor: color }]} />
            <View style={[styles.dayPlanLine, { backgroundColor: color + '40' }]} />
          </View>

          <View style={styles.dayPlanBody}>
            <View style={styles.dayPlanTitleRow}>
              <Text style={[styles.dayPlanTitle, isDone && styles.dayPlanTitleDone]} numberOfLines={1}>{task.title || 'Untitled'}</Text>
              <View style={[styles.dayPlanBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.dayPlanBadgeText, { color }]}>{task.status || 'To Do'}</Text>
              </View>
            </View>
            {task.description ? <Text style={styles.dayPlanDesc} numberOfLines={1}>{task.description}</Text> : null}
            {task.priority && (
              <View style={styles.dayPlanPriorityRow}>
                <Ionicons name={task.priority === 'high' ? 'arrow-up-circle' : task.priority === 'low' ? 'arrow-down-circle' : 'remove-circle'} size={12} color={task.priority === 'high' ? G.red : task.priority === 'low' ? G.green : G.amber} />
                <Text style={[styles.dayPlanPriority, { color: task.priority === 'high' ? G.red : task.priority === 'low' ? G.green : G.amber }]}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                </Text>
              </View>
            )}
          </View>

          <Ionicons name="chevron-forward" size={16} color={G.p300} />
        </View>
      </TouchableOpacity>
    );
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading && tasks.length === 0) {
    return <LoadingSpinner fullScreen message="Loading schedule…" />;
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* Background Gradient & Ambient Orbs */}
      <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
      <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.p300 }]} />
      <View style={[styles.ambientOrb, { bottom: -100, left: -60, backgroundColor: '#A5F3FC', transform: [{ scale: 1.2 }] }]} />

      {/* ── High Contrast Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={G.p700} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule</Text>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{(user?.username || 'U')[0].toUpperCase()}</Text>
        </View>
      </View>

      {/* ── Date + month nav ── */}
      <View style={styles.dateNavRow}>
        <Text style={styles.bigDate}>
          {MONTH_NAMES[selectedDateObj.getMonth()].slice(0, 3)}{' '}
          {String(selectedDateObj.getDate()).padStart(2, '0')}
        </Text>
        <View style={styles.monthNav}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.monthNavBtn} onPress={goToPrevMonth}>
            <Ionicons name="chevron-back" size={16} color={G.p800} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{MONTH_NAMES[currentMonth.getMonth()]}</Text>
          <TouchableOpacity style={styles.monthNavBtn} onPress={goToNextMonth}>
            <Ionicons name="chevron-forward" size={16} color={G.p800} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Horizontal date strip ── */}
      <FlatList
        ref={dateStripRef}
        data={dateRange}
        horizontal
        keyExtractor={(item) => item}
        renderItem={renderDayItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateStripContent}
        getItemLayout={(_, index) => ({ length: DAY_ITEM_WIDTH, offset: DAY_ITEM_WIDTH * index, index })}
        initialScrollIndex={Math.max(0, dateRange.indexOf(selectedDate))}
        style={styles.dateStripList}
      />

      {/* ── Timeline scroll ── */}
      <ScrollView
        style={styles.timelineScroll}
        contentContainerStyle={[styles.timelineContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedDate === today ? "Today's Schedule" : `${DAY_NAMES[selectedDateObj.getDay()]}, ${MONTH_NAMES[selectedDateObj.getMonth()]} ${selectedDateObj.getDate()}`}
          </Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{totalItemCount} item{totalItemCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {totalItemCount === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar" size={36} color={G.p400} />
            </View>
            <Text style={styles.emptyTitle}>Nothing scheduled</Text>
            <Text style={styles.emptySubtitle}>Tap the + button to add tasks or events.</Text>
          </View>
        ) : (
          <>
            {/* ── Day Planner section ── */}
            {dailyTasksForDay.length > 0 && (
              <>
                <View style={styles.catHeader}>
                  <View style={styles.catHeaderLeft}>
                    <View style={[styles.catIconWrap, { backgroundColor: G.p100 }]}>
                      <Ionicons name="sunny" size={16} color={G.p600} />
                    </View>
                    <Text style={[styles.catTitle, { color: G.p800 }]}>Day Planner</Text>
                  </View>
                </View>
                {dailyTasksForDay.map((t, i) => renderDayPlanCard(t, i))}
              </>
            )}

            {/* ── Regular tasks section ── */}
            {regularTasksForDay.length > 0 && (
              <>
                <View style={[styles.catHeader, dailyTasksForDay.length > 0 && { marginTop: GAP }]}>
                  <View style={styles.catHeaderLeft}>
                    <View style={[styles.catIconWrap, { backgroundColor: G.purpleBg }]}>
                      <Ionicons name="checkmark-circle" size={16} color={G.purple} />
                    </View>
                    <Text style={[styles.catTitle, { color: G.purple }]}>Tasks</Text>
                  </View>
                </View>
                {regularTasksForDay.map((t, i) => renderTaskCard({ ...t, _type: 'task' }, i))}
              </>
            )}

            {/* ── Calendar events section ── */}
            {eventsForDay.length > 0 && (
              <>
                <View style={[styles.catHeader, { marginTop: GAP }]}>
                  <View style={styles.catHeaderLeft}>
                    <View style={[styles.catIconWrap, { backgroundColor: G.greenBg }]}>
                      <Ionicons name="calendar" size={16} color={G.green} />
                    </View>
                    <Text style={[styles.catTitle, { color: G.green }]}>Events</Text>
                  </View>
                </View>
                {eventsForDay.map((e, i) => renderTaskCard({ ...e, _type: 'event' }, i))}
              </>
            )}
          </>
        )}

        {/* Legend */}
        <View style={styles.legendRow}>
          {[
            { label: 'Day Plan',    color: G.p500, icon: 'sunny' },
            { label: 'To Do',       color: G.purple, icon: null },
            { label: 'In Progress', color: G.p400, icon: null },
            { label: 'Completed',   color: G.green, icon: null },
            { label: 'On Hold',     color: G.amber, icon: null },
          ].map((l) => (
            <View key={l.label} style={styles.legendItem}>
              {l.icon ? <Ionicons name={l.icon} size={12} color={l.color} /> : <View style={[styles.legendDot, { backgroundColor: l.color }]} />}
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>

        {/* Month overview */}
        <View style={styles.shadowWrap}>
          <View style={[styles.glassLight, { padding: 20 }]}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            
            <Text style={styles.summaryCardTitle}>Month Overview</Text>
            <View style={styles.summaryRow}>
              {[
                { label: 'Day Plans', value: tasks.filter((t) => t.is_daily_task).length, color: G.p600, bg: G.p100 },
                { label: 'Total Tasks',value: tasks.filter((t) => !t.is_daily_task).length, color: G.purple, bg: G.purpleBg },
                { label: 'Done',      value: tasks.filter((t) => /complet|done/i.test(t.status || '')).length, color: G.green, bg: G.greenBg },
                { label: 'Active',    value: tasks.filter((t) => /progress/i.test(t.status || '')).length, color: G.amber, bg: G.amberBg },
              ].map((s) => (
                <View key={s.label} style={[styles.miniStatPill, { backgroundColor: s.bg }]}>
                  <Text style={[styles.miniStatPillNum, { color: s.color }]}>{s.value}</Text>
                  <Text style={[styles.miniStatPillLabel, { color: s.color }]} numberOfLines={1} adjustsFontSizeToFit>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── High Contrast FAB ── */}
      <View style={[styles.fabWrap, { bottom: 24 + insets.bottom }]}>
        <TouchableOpacity style={styles.fabBtn} onPress={toggleMore} activeOpacity={0.85}>
          <LinearGradient colors={[G.p500, G.p700]} style={StyleSheet.absoluteFill} />
          <View style={styles.fabHighlight} />
          <Animated.View style={{ transform: [{ rotate: moreAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
            <Ionicons name="add" size={32} color={G.white} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* ── Quick actions modal (Glassmorphic) ── */}
      <Modal visible={showMore} transparent animationType="none" onRequestClose={toggleMore}>
        <Pressable style={styles.overlay} onPress={toggleMore}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View
            style={[
              styles.actionSheet,
              { bottom: 24 + insets.bottom },
              { opacity: moreAnim, transform: [{ translateY: moreAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] },
            ]}
          >
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.7)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Quick Actions</Text>
            
            <View style={styles.actionGrid}>
              {quickActions.map((action, idx) => (
                <TouchableOpacity key={idx} style={styles.actionItem} onPress={action.onPress} activeOpacity={0.75}>
                  <View style={[styles.actionCircle, { backgroundColor: action.color + '20', borderColor: action.color + '40' }]}>
                    <Ionicons name={action.icon} size={24} color={action.color} />
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4, filter: [{ blur: 50 }] },

  // ── Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingVertical: 15 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.p600, borderWidth: 2, borderColor: G.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
  },
  avatarText: { fontSize: 16, fontWeight: '900', color: G.white },

  // ── Date Nav
  dateNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, marginBottom: 16 },
  bigDate: { fontSize: 36, fontWeight: '900', color: G.txtMain, letterSpacing: -1.5 },
  monthNav: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1, borderColor: G.p200, overflow: 'hidden', ...liquidShadow },
  monthNavBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  monthText: { fontSize: 13, fontWeight: '800', color: G.txtMain, minWidth: 70, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Date Strip
  dateStripList: { flexGrow: 0, marginBottom: 20 },
  dateStripContent: { paddingHorizontal: GUTTER },
  dateCell: { width: 56, height: 74, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: G.p200, marginRight: 8 },
  dateCellSelected: { backgroundColor: G.p700, borderColor: G.p900, shadowColor: G.p900, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  dateCellToday: { borderColor: G.p500, borderWidth: 2 },
  dateDow: { fontSize: 11, fontWeight: '800', color: G.txtFaint, textTransform: 'uppercase', marginBottom: 4 },
  dateNum: { fontSize: 20, fontWeight: '900', color: G.txtMain },
  dayDotsRow: { flexDirection: 'row', gap: 4, marginTop: 6, alignItems: 'center' },
  dayDot: { width: 6, height: 6, borderRadius: 3 },
  dayDotPlaceholder: { width: 6, height: 6 },

  // ── Timeline
  timelineScroll: { flex: 1 },
  timelineContent: { paddingHorizontal: GUTTER },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  countPill: { backgroundColor: G.p100, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: G.p200 },
  countPillText: { fontSize: 12, color: G.p700, fontWeight: '900' },

  // ── Category Headers
  catHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingLeft: 4 },
  catHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },

  // ── Shadow Wrappers & Glass ──
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', padding: 16 },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white },

  // ── Task/Event Cards
  taskCard: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  taskCardBar: { width: 5, borderRadius: 3, alignSelf: 'stretch', minHeight: 40 },
  taskCardBody: { flex: 1 },
  taskCardTitle: { fontSize: 15, fontWeight: '800', color: G.txtMain, marginBottom: 2 },
  taskCardDesc: { fontSize: 12, color: G.txtFaint, fontWeight: '700' },
  taskCardBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  taskCardBadgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Day Plan Card
  dayPlanCard: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  dayPlanTimeCol: { width: 44, alignItems: 'center', justifyContent: 'center' },
  dayPlanTime: { fontSize: 14, fontWeight: '900', color: G.p700, letterSpacing: -0.5 },
  dayPlanAmPm: { fontSize: 10, color: G.txtFaint, fontWeight: '800', textTransform: 'uppercase' },
  dayPlanConnector: { alignItems: 'center', width: 12, alignSelf: 'stretch', justifyContent: 'flex-start', paddingTop: 6 },
  dayPlanDot: { width: 10, height: 10, borderRadius: 5 },
  dayPlanLine: { width: 3, flex: 1, borderRadius: 1.5, marginTop: 4 },
  dayPlanBody: { flex: 1 },
  dayPlanTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 },
  dayPlanTitle: { fontSize: 15, fontWeight: '800', color: G.txtMain, flex: 1 },
  dayPlanTitleDone: { textDecorationLine: 'line-through', color: G.txtFaint },
  dayPlanDesc: { fontSize: 12, color: G.txtFaint, fontWeight: '700', marginBottom: 6 },
  dayPlanBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  dayPlanBadgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayPlanPriorityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayPlanPriority: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  // ── Empty State
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: G.p100, borderWidth: 2, borderColor: G.white, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: G.txtMain, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: G.txtFaint, fontWeight: '700', textAlign: 'center' },

  // ── Legend
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginVertical: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: G.txtFaint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Summary Card
  summaryCardTitle: { fontSize: 16, fontWeight: '900', color: G.txtMain, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  miniStatPill: { flex: 1, minWidth: '45%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12, gap: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  miniStatPillNum: { fontSize: 20, fontWeight: '900' },
  miniStatPillLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1, textAlign: 'right' },

  // ── FAB
  fabWrap: { position: 'absolute', right: GUTTER },
  fabBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowColor: G.p900, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  fabHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(255,255,255,0.25)' },

  // ── Action Sheet Modal
  overlay: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: GUTTER },
  actionSheet: { borderRadius: 32, overflow: 'hidden', padding: 24, shadowColor: G.p900, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  sheetHandle: { width: 48, height: 6, borderRadius: 3, backgroundColor: G.p200, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, textAlign: 'center', marginBottom: 24, letterSpacing: -0.5 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  actionItem: { width: 80, alignItems: 'center', gap: 8, marginBottom: 10 },
  actionCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, color: G.txtMain, fontWeight: '800', textAlign: 'center', lineHeight: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
});