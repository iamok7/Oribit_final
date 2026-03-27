import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Svg, { Rect, Text as SvgText, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import {
  getDashboardStats, getTasks, getExpenses,
  getManagerDashboard, getTeamStats,
  getConversations, getRequirements, getNotifications,
} from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

// ─── Layout ──────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const GUTTER = 16;
const GAP = 12;
const FULL = SCREEN_W - GUTTER * 2;
const HALF = (FULL - GAP) / 2;
const BIG_W = FULL * 0.55 - GAP / 2;
const MINI_W = FULL * 0.45 - GAP / 2;

// ─── Liquid Glass High Contrast Palette ──────────────────────────────────────
const G = {
  bgLight:  '#F0F6FF',
  bgMid:    '#E0F2FE',
  bgDark:   '#F8FAFC',
  
  // Slate Text Colors (Deep & Bold)
  txtMain:  '#020617', // Slate 950
  txtMuted: '#1E293B', // Slate 800
  txtFaint: '#334155', // Slate 700

  // Core Blues
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
  
  // Status Colors
  green:    '#059669',
  greenBg:  '#D1FAE5',
  amber:    '#D97706',
  amberBg:  '#FEF3C7',
  red:      '#DC2626',
  redBg:    '#FEE2E2',
  purple:   '#7C3AED',
  purpleBg: '#EDE9FE',
};

const PRIORITY = {
  Critical: { color: G.red, bg: G.redBg, label: 'Critical' },
  High:     { color: '#EA580C', bg: '#FFEDD5', label: 'High' },
  Medium:   { color: G.amber, bg: G.amberBg, label: 'Medium' },
  Low:      { color: G.green, bg: G.greenBg, label: 'Low' },
};
const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

// Native fluid shadow
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getInitials = (name) => name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const fmtTime = (dateStr) => {
  if (!dateStr) return 'Today';
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return 'Today'; }
};

// ─────────────────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { user, isManager, isSupervisor, isEmployee, canApproveExpenses } = useAuth();
  const insets = useSafeAreaInsets();
  const role = user?.role;

  const [stats, setStats] = useState({ today_tasks: 0, in_progress: 0, on_hold: 0, past_due: 0, total_tasks: 0, total_users: 0 });
  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [error, setError] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [openRequirements, setOpenRequirements] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [sRes, tRes, eRes] = await Promise.allSettled([
        getDashboardStats(),
        getTasks(),
        getExpenses(),
      ]);

      if (sRes.status === 'fulfilled') setStats(sRes.value || {});

      if (tRes.status === 'fulfilled') {
        const raw = Array.isArray(tRes.value) ? tRes.value : tRes.value?.tasks || [];
        const today = new Date().toDateString();
        const todayTasks = raw.filter((t) => {
          if (!t.deadline) return t.status === 'In Progress' || t.status === 'in_progress';
          return new Date(t.deadline).toDateString() === today;
        });
        todayTasks.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4));
        setTasks(todayTasks);
      }

      if (eRes.status === 'fulfilled') {
        const raw = Array.isArray(eRes.value) ? eRes.value : eRes.value?.expenses || [];
        setExpenses(raw);
      }

      // Feature: Performance data
      if (isManager()) {
        getManagerDashboard().then(d => setPerformanceData(d?.performance || [])).catch(() => {});
      } else if (isSupervisor() && user?.department_id) {
        getTeamStats(user.department_id).then(d => setPerformanceData(d?.performance || [])).catch(() => {});
      }

      // Feature: Messaging unread count
      getConversations().then(list => {
        const total = (Array.isArray(list) ? list : []).reduce((s, c) => s + (c.unread_count || 0), 0);
        setUnreadMessages(total);
      }).catch(() => {});

      // Feature: Open requirements count
      getRequirements({ status: 'open' }).then(list => {
        setOpenRequirements(Array.isArray(list) ? list.length : 0);
      }).catch(() => {});

      // Feature: Unread notifications count
      getNotifications().then(res => {
        setUnreadNotifications(res?.unread_count || 0);
      }).catch(() => {});

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [user, isManager, isSupervisor]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner fullScreen message="Loading workspace..." />;

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Calendar week strip
  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const todayDow = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - todayDow);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return { day: DAYS[i], date: d.getDate(), isToday: i === todayDow };
  });

  // Expense derived data
  const pendingApprovals = expenses.filter((e) => e.approval_status === 'pending' && e.user_id !== user?.id);
  const myExpenses = expenses.filter((e) => e.user_id === user?.id);
  const myPending = myExpenses.filter((e) => e.approval_status === 'pending').length;
  const myApproved = myExpenses.filter((e) => e.approval_status === 'approved').length;

  // Completion rate
  const totalTasks = stats.total_tasks || tasks.length || 1;
  const completedTasks = tasks.filter((t) => ['Completed', 'completed'].includes(t.status)).length;
  const completionPct = Math.round((completedTasks / Math.max(totalTasks, 1)) * 100);

  // ── Performance Section ────────────────────────────────────────────────────
  const renderPerformanceSection = () => {
    const showTeam = isManager() || isSupervisor();
    const CHART_W = FULL - 32;
    const BAR_LABEL = 108;
    const BAR_PCT = 40;
    const BAR_W = CHART_W - BAR_LABEL - BAR_PCT - 8;
    const ROW_H = 38;
    const visible = performanceData.slice(0, 5);

    if (showTeam) {
      return (
        <TouchableOpacity style={[styles.shadowWrap, { width: FULL }]} onPress={() => navigation.navigate('PerformanceChart')} activeOpacity={0.88}>
          <View style={styles.glassLight}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBadge, { backgroundColor: G.p100 }]}>
                <Ionicons name="bar-chart" size={15} color={G.p600} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Performance Overview</Text>
                <Text style={styles.cardSubtitle}>{isManager() ? 'All employees' : 'Your team'}</Text>
              </View>
              <View style={styles.viewAllRow}>
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons name="arrow-forward" size={14} color={G.p600} />
              </View>
            </View>
            {visible.length === 0 ? (
              <View style={styles.emptyMini}>
                <Ionicons name="analytics-outline" size={34} color={G.p300} />
                <Text style={styles.emptyMiniSub}>No performance data yet</Text>
              </View>
            ) : (
              <Svg width={CHART_W} height={visible.length * ROW_H + 6}>
                {visible.map((d, i) => {
                  const y = i * ROW_H + 4;
                  const fillW = Math.max((d.rate / 100) * BAR_W, 2);
                  const barColor = d.rate >= 70 ? G.green : d.rate >= 40 ? G.amber : G.red;
                  return (
                    <React.Fragment key={d.user_id}>
                      <SvgText x={0} y={y + 20} fontSize={10} fontWeight="600" fill={G.txtFaint}>
                        {(d.username || '').slice(0, 13)}
                      </SvgText>
                      <Rect x={BAR_LABEL} y={y + 8} width={BAR_W} height={16} rx={8} fill={G.p100} />
                      <Rect x={BAR_LABEL} y={y + 8} width={fillW} height={16} rx={8} fill={barColor} opacity={0.85} />
                      <SvgText x={BAR_LABEL + BAR_W + 5} y={y + 20} fontSize={10} fontWeight="700" fill={barColor}>
                        {d.rate}%
                      </SvgText>
                    </React.Fragment>
                  );
                })}
              </Svg>
            )}
            {performanceData.length > 5 && (
              <Text style={[styles.moreTasksText, { marginTop: 4 }]}>+{performanceData.length - 5} more</Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    // Employee — radial ring
    const myAll = tasks;
    const myCompleted = myAll.filter(t => t.status === 'Completed').length;
    const myActive = myAll.filter(t => t.status === 'In Progress').length;
    const myOverdue = myAll.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'Completed').length;
    const myPct = myAll.length > 0 ? Math.round((myCompleted / myAll.length) * 100) : 0;
    const RING_SIZE = 120;
    const R = 46;
    const cx = RING_SIZE / 2;
    const circ = 2 * Math.PI * R;
    const offset = circ * (1 - myPct / 100);
    const ringColor = myPct >= 70 ? G.green : myPct >= 40 ? G.amber : G.red;

    return (
      <View style={[styles.bentoRow, { marginBottom: 0 }]}>
       

        {/* <View style={{ width: MINI_W, flex: 1, justifyContent: 'space-between', gap: GAP }}>
          {[
            { icon: 'layers',        color: G.p600,  bg: G.p100,     val: myAll.length,  label: 'Total'   },
            { icon: 'checkmark-done',color: G.green, bg: G.greenBg,  val: myCompleted,   label: 'Done'    },
            { icon: 'alert-circle',  color: G.red,   bg: G.redBg,    val: myOverdue,     label: 'Overdue' },
          ].map((s, i) => (
            <TouchableOpacity key={i} style={[styles.shadowWrap, { flex: 1 }]} onPress={() => navigation.navigate('Tasks')} activeOpacity={0.8}>
              <View style={[styles.glassLight, styles.miniStatCard]}>
                <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
                <View style={styles.glassHighlight} />
                <View style={[styles.miniStatIconBg, { backgroundColor: s.bg }]}>
                  <Ionicons name={s.icon} size={16} color={s.color} />
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.miniStatNum, { color: s.color }]}>{s.val}</Text>
                  <Text style={styles.miniStatLabel}>{s.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View> */}
      </View>
    );
  };

  // ── Messaging card ─────────────────────────────────────────────────────────
  const renderMessagingCard = () => (
    <TouchableOpacity style={[styles.shadowWrap, { width: FULL }]} onPress={() => navigation.navigate('Messaging')} activeOpacity={0.85}>
      <View style={styles.glassLight}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
        <View style={styles.glassHighlight} />
        <View style={styles.cardTitleRow}>
          <View style={[styles.iconBadge, { backgroundColor: G.p100 }]}>
            <Ionicons name="chatbubble-ellipses" size={16} color={G.p600} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Messages</Text>
            <Text style={styles.cardSubtitle}>
              {unreadMessages > 0 ? `${unreadMessages} unread message${unreadMessages !== 1 ? 's' : ''}` : 'All caught up'}
            </Text>
          </View>
          {unreadMessages > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={G.p600} style={{ marginLeft: 8 }} />
        </View>
      </View>
    </TouchableOpacity>
  );

  // ── Requirements card ──────────────────────────────────────────────────────
  // const renderRequirementsCard = () => {
  //   const canPost = !isManager();
  //   return (
  //     <View style={[styles.shadowWrap, { width: FULL }]}>
  //       <View style={styles.glassLight}>
  //         <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
  //         <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
  //         <View style={styles.glassHighlight} />
  //         <View style={styles.cardTitleRow}>
  //           <View style={[styles.iconBadge, { backgroundColor: G.amberBg }]}>
  //             <Ionicons name="clipboard" size={16} color={G.amber} />
  //           </View>
  //           <View style={{ flex: 1 }}>
  //             <Text style={styles.cardTitle}>Requirements Board</Text>
  //             <Text style={styles.cardSubtitle}>
  //               {isManager() ? 'Review team requests' : 'Post your team\'s needs'}
  //             </Text>
  //           </View>
  //           {openRequirements > 0 && (
  //             <View style={[styles.unreadBadge, { backgroundColor: G.amber }]}>
  //               <Text style={styles.unreadBadgeText}>{openRequirements} open</Text>
  //             </View>
  //           )}
  //         </View>
  //         <View style={styles.reqActionRow}>
  //           <TouchableOpacity style={styles.reqBtn} onPress={() => navigation.navigate('Requirements')} activeOpacity={0.8}>
  //             <Ionicons name="list-outline" size={14} color={G.p600} />
  //             <Text style={styles.reqBtnText}>View All</Text>
  //           </TouchableOpacity>
  //           {canPost && (
  //             <TouchableOpacity style={[styles.reqBtn, styles.reqBtnPrimary]} onPress={() => navigation.navigate('PostRequirement')} activeOpacity={0.85}>
  //               <Ionicons name="add" size={14} color={G.white} />
  //               <Text style={[styles.reqBtnText, { color: G.white }]}>Post New</Text>
  //             </TouchableOpacity>
  //           )}
  //         </View>
  //       </View>
  //     </View>
  //   );
  // };

  // ── Role-specific report card ──────────────────────────────────────────────
  const renderReportCard = () => {
    if (isManager()) {
      return (
        <TouchableOpacity style={[styles.shadowWrap, { width: FULL }]} onPress={() => navigation.navigate('Progress')} activeOpacity={0.8}>
          <View style={styles.glassDark}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(30,58,138,0.8)', 'rgba(2,6,23,0.9)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlightDark} />
            
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Ionicons name="bar-chart" size={16} color={G.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: G.white }]}>My Dashboard</Text>
                <Text style={[styles.cardSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>Your performance overview</Text>
              </View>
              <Ionicons name="chevron-forward-circle" size={24} color="rgba(255,255,255,0.8)" />
            </View>

            <View style={styles.reportGrid}>
              {[
                { label: 'Total Tasks',  val: stats.total_tasks || stats.today_tasks || 0, icon: 'layers', color: G.p300 },
                { label: 'In Progress',  val: stats.in_progress || stats.task_inprogress || 0, icon: 'flash', color: '#6EE7B7' },
                { label: 'Team Members', val: stats.total_users || stats.employees || 0, icon: 'people', color: '#FCD34D' },
                { label: 'On Hold',      val: stats.on_hold || stats.task_todo || 0, icon: 'pause', color: '#FCA5A5' },
              ].map((item, i) => (
                <View key={i} style={styles.reportItem}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={item.icon} size={16} color={item.color} />
                    <Text style={styles.reportVal}>{item.val}</Text>
                  </View>
                  <Text style={styles.reportLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.reportActions}>
              {[
                // { label: 'Team Reports', nav: 'Progress', icon: 'people' },
                // { label: 'Departments', nav: 'DepartmentsStack', icon: 'business' },
                // { label: 'All Users', nav: 'UsersStack', icon: 'person' },
              ].map((btn, i) => (
                <TouchableOpacity key={i} style={styles.reportBtn} onPress={() => navigation.navigate(btn.nav)} activeOpacity={0.7}>
                  <Ionicons name={btn.icon} size={14} color={G.p800} />
                  <Text style={styles.reportBtnText}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (isSupervisor()) {
      return (
        <TouchableOpacity style={[styles.shadowWrap, { width: FULL }]} onPress={() => navigation.navigate('Progress')} activeOpacity={0.8}>
          <View style={styles.glassLight}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />

            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBadge, { backgroundColor: G.purpleBg }]}>
                <Ionicons name="analytics" size={16} color={G.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>My Dashboard</Text>
                <Text style={styles.cardSubtitle}>Your performance overview</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={G.p600} />
            </View>

            {/* Redesigned horizontal pills to prevent text clipping */}
            <View style={[styles.reportGrid, { gap: 10 }]}>
              {[
                { label: 'Active',  val: stats.in_progress || 0, color: G.p700, bg: G.p100 },
                { label: 'On Hold', val: stats.on_hold || 0, color: G.amber, bg: G.amberBg },
                { label: 'Overdue', val: stats.past_due || 0, color: G.red, bg: G.redBg },
                { label: 'Done',    val: completedTasks, color: G.green, bg: G.greenBg },
              ].map((item, i) => (
                <View key={i} style={[styles.miniStatPill, { backgroundColor: item.bg }]}>
                  <Text style={[styles.miniStatPillLabel, { color: item.color }]} numberOfLines={1} adjustsFontSizeToFit>{item.label}</Text>
                  <Text style={[styles.miniStatPillNum, { color: item.color }]}>{item.val}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.progressBarContainer, { marginTop: 15 }]}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(completionPct, 100)}%` }]} />
              </View>
              <Text style={styles.progressBarLabel}>{completionPct}% completed today</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Employee
    return (
      <TouchableOpacity style={[styles.shadowWrap, { width: FULL }]} onPress={() => navigation.navigate('Progress')} activeOpacity={0.8}>
        <View style={styles.glassLight}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
          <View style={styles.glassHighlight} />

          <View style={styles.cardTitleRow}>
            <View style={[styles.iconBadge, { backgroundColor: G.greenBg }]}>
              <Ionicons name="trending-up" size={16} color={G.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>My Dashboard</Text>
              <Text style={styles.cardSubtitle}>Your performance overview</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={G.p600} />
          </View>

          <View style={styles.myReportRow}>
            <View style={styles.completionRing}>
              <Text style={styles.completionPct}>{completionPct}%</Text>
              <Text style={styles.completionLabel}>DONE</Text>
            </View>

            <View style={styles.myReportStats}>
              {[
                { icon: 'checkmark-circle', color: G.green, label: 'Completed', val: completedTasks },
                { icon: 'time', color: G.p600, label: 'Active Tasks', val: stats.in_progress || 0 },
                { icon: 'alert-circle', color: G.red, label: 'Overdue', val: stats.past_due || 0 },
              ].map((s, i) => (
                <View key={i} style={styles.myReportStatRow}>
                  <Ionicons name={s.icon} size={18} color={s.color} />
                  <Text style={styles.myReportStatLabel}>{s.label}</Text>
                  <Text style={[styles.myReportStatVal, { color: s.color }]}>{s.val}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Expense Tracker card ───────────────────────────────────────────────────
  const renderExpenseCard = () => {
    const isApprover = canApproveExpenses();

    return (
      <TouchableOpacity style={[styles.shadowWrap, { width: FULL }]} onPress={() => navigation.navigate('ExpensesStack')} activeOpacity={0.8}>
        <View style={styles.glassLight}>
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
          <View style={styles.glassHighlight} />

          <View style={styles.cardTitleRow}>
            <View style={[styles.iconBadge, { backgroundColor: G.p100 }]}>
              <Ionicons name="wallet" size={16} color={G.p700} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Expense Tracker</Text>
              <Text style={styles.cardSubtitle}>{isApprover ? 'Approve & manage expenses' : 'Track your expenses'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={G.p600} />
          </View>

          <View style={styles.expenseGrid}>
            {isApprover ? (
              <>
                <View style={[styles.expenseStat, { backgroundColor: G.amberBg, borderColor: G.amber + '40' }]}>
                  <Text style={[styles.expenseStatNum, { color: pendingApprovals.length > 0 ? G.amber : G.green }]}>{pendingApprovals.length}</Text>
                  <Text style={[styles.expenseStatLabel, { color: G.amber }]}>Pending</Text>
                </View>
                <View style={[styles.expenseStat, { backgroundColor: G.greenBg, borderColor: G.green + '40' }]}>
                  <Text style={[styles.expenseStatNum, { color: G.green }]}>{expenses.filter(e => e.approval_status === 'approved').length}</Text>
                  <Text style={[styles.expenseStatLabel, { color: G.green }]}>Approved</Text>
                </View>
                <View style={[styles.expenseStat, { backgroundColor: G.redBg, borderColor: G.red + '40' }]}>
                  <Text style={[styles.expenseStatNum, { color: G.red }]}>{expenses.filter(e => e.approval_status === 'rejected').length}</Text>
                  <Text style={[styles.expenseStatLabel, { color: G.red }]}>Rejected</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.expenseStat, { backgroundColor: G.amberBg, borderColor: G.amber + '40' }]}>
                  <Text style={[styles.expenseStatNum, { color: G.amber }]}>{myPending}</Text>
                  <Text style={[styles.expenseStatLabel, { color: G.amber }]}>Pending</Text>
                </View>
                <View style={[styles.expenseStat, { backgroundColor: G.greenBg, borderColor: G.green + '40' }]}>
                  <Text style={[styles.expenseStatNum, { color: G.green }]}>{myApproved}</Text>
                  <Text style={[styles.expenseStatLabel, { color: G.green }]}>Approved</Text>
                </View>
                <View style={[styles.expenseStat, { backgroundColor: G.p100, borderColor: G.p300 }]}>
                  <Text style={[styles.expenseStatNum, { color: G.p700 }]}>{myExpenses.length}</Text>
                  <Text style={[styles.expenseStatLabel, { color: G.p700 }]}>Total</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.expenseActions}>
            <TouchableOpacity style={styles.expenseBtn} onPress={() => navigation.navigate('AddExpense')} activeOpacity={0.7}>
              <Ionicons name="add-circle" size={16} color={G.p700} />
              <Text style={styles.expenseBtnText}>Raise Expense</Text>
            </TouchableOpacity>
            {isApprover && pendingApprovals.length > 0 && (
              <TouchableOpacity style={[styles.expenseBtn, { backgroundColor: G.amberBg, borderColor: G.amber }]} onPress={() => navigation.navigate('ExpensesStack')} activeOpacity={0.7}>
                <Ionicons name="checkmark-done-circle" size={16} color={G.amber} />
                <Text style={[styles.expenseBtnText, { color: G.amber }]}>Approve ({pendingApprovals.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Background Gradient & Ambient Orbs */}
      <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
      <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.p300 }]} />
      <View style={[styles.ambientOrb, { bottom: -100, left: -60, backgroundColor: '#A5F3FC', transform: [{ scale: 1.2 }] }]} />

      {/* ── High Contrast Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{getInitials(user?.username)}</Text>
            </View>
            <View>
              <Text style={styles.greetingSmall}>{getGreeting()},</Text>
              <Text style={styles.greetingName} numberOfLines={1}>{user?.username || 'User'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
              <Ionicons name="notifications" size={22} color={G.p700} />
              {unreadNotifications > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={G.p600} />}
      >
        {/* Date + Hero */}
        <Text style={styles.dateText}>{todayStr.toUpperCase()}</Text>
        <Text style={styles.heroText}>
          Your workspace,{'\n'}<Text style={styles.heroBold}>at a glance.</Text>
        </Text>

        {/* ── Error banner ── */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={G.red} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
          </View>
        )}

        {/* ── ROW 1: Performance Section ── */}
        {renderPerformanceSection()}

        {/* ── ROW 1b: (original) Today's Tasks & Mini Stats ── */}
        <View style={styles.bentoRow}>
          {/* Big: Today's Tasks */}
          <TouchableOpacity style={[styles.shadowWrap, { width: BIG_W }]} onPress={() => navigation.navigate('Tasks')} activeOpacity={0.9}>
            <View style={styles.glassLight}>
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />

              <View style={styles.cardTitleRow}>
                <View style={[styles.iconBadge, { backgroundColor: G.p100 }]}>
                  <Ionicons name="today" size={16} color={G.p600} />
                </View>
                <Text style={styles.cardTitle}>Today's Tasks</Text>
              </View>

              <View style={styles.priorityChip}>
                <Ionicons name="flag" size={12} color={G.p600} />
                <Text style={styles.priorityChipText}>Priority Sorted</Text>
              </View>

              {tasks.length === 0 ? (
                <View style={styles.emptyMini}>
                  <Ionicons name="checkmark-done-circle" size={40} color={G.p300} />
                  <Text style={styles.emptyMiniTitle}>All clear!</Text>
                  <Text style={styles.emptyMiniSub}>No tasks due today</Text>
                </View>
              ) : (
                tasks.slice(0, 3).map((task) => {
                  const p = PRIORITY[task.priority] || PRIORITY.Low;
                  return (
                    <View key={task.id} style={styles.taskItem}>
                      <View style={[styles.taskDot, { backgroundColor: p.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                        {task.priority && (
                          <Text style={[styles.taskPriorityLabel, { color: p.color }]}>{p.label}</Text>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
              
              {tasks.length > 3 && <Text style={styles.moreTasksText}>+{tasks.length - 3} more</Text>}
              <View style={styles.viewAllRow}>
                <Text style={styles.viewAllText}>View All Tasks</Text>
                <Ionicons name="arrow-forward" size={14} color={G.p600} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Mini Stats Column (Horizontal Redesign to prevent cutoff) */}
          {/* ── Mini Stats Column (Liquid Glass High Contrast) ── */}
<View style={{ width: MINI_W, flex: 1, justifyContent: 'space-between', gap: GAP }}>
  {[
    { icon: 'chatbubbles', color: G.p600, bg: G.p100, val: unreadMessages, label: 'Chat', screen: 'Messaging' },
    { icon: 'clipboard', color: G.amber, bg: G.amberBg, val: openRequirements, label: 'Reqs', screen: 'Requirements' },
    { icon: 'notifications', color: G.red, bg: G.redBg, val: unreadNotifications, label: 'Alerts', screen: 'Notifications' },
  ].map((s, i) => (
    <TouchableOpacity 
      key={i} 
      style={[styles.shadowWrap, { flex: 1 }]} 
      onPress={() => navigation.navigate(s.screen)} 
      activeOpacity={0.75}
    >
      <View style={[styles.glassLight, styles.miniStatCard]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
        <View style={styles.glassHighlight} />
        
        <View style={[styles.miniStatIconBg, { backgroundColor: s.bg, borderColor: s.color + '30', borderWidth: 1 }]}>
          <Ionicons name={s.icon} size={16} color={s.color} />
        </View>
        
        <View style={styles.miniStatTextWrap}>
          <Text style={[styles.miniStatNum, { color: s.color }]} numberOfLines={1} adjustsFontSizeToFit>
            {s.val ?? 0}
          </Text>
          <Text style={styles.miniStatLabel}>{s.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  ))}
</View>
        </View>

        {/* ── ROW 2: Calendar & Planner ── */}
        <View style={styles.bentoRow}>
          <TouchableOpacity style={[styles.shadowWrap, { width: HALF }]} onPress={() => navigation.navigate(role === 'employee' ? 'Calendar' : 'CalendarStack')} activeOpacity={0.8}>
            <View style={styles.glassDark}>
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(30,58,138,0.8)', 'rgba(2,6,23,0.9)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlightDark} />
              
              <View style={styles.cardTitleRow}>
                <View style={[styles.iconBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Ionicons name="calendar" size={14} color={G.white} />
                </View>
                <Text style={[styles.cardTitle, { color: G.white, fontSize: 14 }]}>Calendar</Text>
              </View>

              <Text style={styles.calMonthLabel}>{now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</Text>

              <View style={styles.weekStrip}>
                {weekDates.slice(1, 6).map((d, i) => (
                  <View key={i} style={[styles.weekDayCell, d.isToday && styles.weekDayActive]}>
                    <Text style={[styles.weekDayName, d.isToday && styles.weekDayNameActive]}>{d.day}</Text>
                    <Text style={[styles.weekDayDate, d.isToday && styles.weekDayDateActive]}>{d.date}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.calFooter}>
                <View style={styles.calDot} />
                <Text style={styles.calFooterText}>{tasks.length} task{tasks.length !== 1 ? 's' : ''} today</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.shadowWrap, { width: HALF }]} onPress={() => navigation.navigate('DailyPlanner')} activeOpacity={0.8}>
            <View style={styles.glassLight}>
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              
              <View style={styles.cardTitleRow}>
                <View style={[styles.iconBadge, { backgroundColor: G.purpleBg }]}>
                  <Ionicons name="list" size={16} color={G.purple} />
                </View>
                <Text style={[styles.cardTitle, { fontSize: 14 }]}>Planner</Text>
              </View>
              <Text style={styles.cardSubtitle}>Daily Schedule</Text>

              {tasks.length === 0 ? (
                <View style={styles.emptyMini}>
                  <Ionicons name="cafe" size={32} color={G.p300} />
                  <Text style={styles.emptyMiniTitle}>Free day!</Text>
                </View>
              ) : (
                tasks.slice(0, 3).map((task) => {
                  const p = PRIORITY[task.priority] || PRIORITY.Low;
                  return (
                    <View key={task.id} style={styles.plannerItem}>
                      <Text style={styles.plannerTime}>{fmtTime(task.deadline)}</Text>
                      <View style={[styles.plannerBar, { backgroundColor: p.color }]} />
                      <Text style={styles.plannerTitle} numberOfLines={1}>{task.title}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Messaging card ── */}
        {renderMessagingCard()}

        {/* ── ROW 3 & 4 ── */}
        {renderReportCard()}
        {renderExpenseCard()}

        {/* ── Requirements card ── */}
        {/* {renderRequirementsCard()} */}

      </ScrollView>
    </View>
  );
}

// ─── Styles (High Contrast, Bold, Liquid Glass) ──────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4, filter: [{ blur: 50 }] },

  // Header badge for unread messages
  headerBadge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff' },
  headerBadgeText: { fontSize: 8, fontWeight: '800', color: '#fff' },

  // Unread / open badge used in messaging and requirements cards
  unreadBadge: { backgroundColor: '#EF4444', borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Requirements action row
  reqActionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  reqBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(147,197,253,0.55)', backgroundColor: 'rgba(219,234,254,0.6)' },
  reqBtnPrimary: { backgroundColor: G.p600, borderColor: G.p600 },
  reqBtnText: { fontSize: 13, fontWeight: '700', color: G.p600 },

  // ── Header (No BlurView to prevent Android clipping bugs on root headers, simulated via rgba)
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: GUTTER, paddingBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,255,255,0.9)',
    ...liquidShadow, zIndex: 10,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: G.p600, borderWidth: 2, borderColor: G.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
  },
  avatarText: { fontSize: 16, fontWeight: '900', color: G.white, letterSpacing: 1 },
  
  greetingSmall: { fontSize: 12, color: G.p600, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  greetingName: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  
  headerRight: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },

  // ── Scroll Content
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: GUTTER, paddingTop: 10, gap: GAP },

  // ── Hero
  dateText: { fontSize: 13, color: G.p600, fontWeight: '900', letterSpacing: 1.2, marginTop: 5 },
  heroText: { fontSize: 32, color: G.txtMain, fontWeight: '500', lineHeight: 38, marginBottom: 12, letterSpacing: -0.5 },
  heroBold: { fontWeight: '900', color: G.p800 },

  // ── Error
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: G.redBg, borderRadius: 16, padding: 14, gap: 10, borderWidth: 2, borderColor: '#FCA5A5', marginBottom: 10 },
  errorText: { flex: 1, fontSize: 14, color: G.red, fontWeight: '700' },
  retryText: { fontSize: 14, color: G.red, fontWeight: '900' },

  // ── Bento Layout
  bentoRow: { flexDirection: 'row', gap: GAP, alignItems: 'stretch' },

  // ── Shadow Wrappers for Glass Cards ──
  shadowWrap: { ...liquidShadow },
  
  glassLight: {
    flex: 1, borderRadius: 24, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    padding: 16,
  },
  glassDark: {
    flex: 1, borderRadius: 24, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    padding: 16,
  },
  
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white },
  glassHighlightDark: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.4)' },

  // ── Card Header
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  iconBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '900', color: G.txtMain, flex: 1, letterSpacing: -0.2 },
  cardSubtitle: { fontSize: 13, color: G.txtFaint, fontWeight: '700', marginBottom: 10 },

  // ── Priority Chip
  priorityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: G.p100, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 12 },
  priorityChipText: { fontSize: 11, color: G.p700, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Task Items
  taskItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  taskDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  taskTitle: { fontSize: 15, color: G.txtMain, fontWeight: '800', flex: 1 },
  taskPriorityLabel: { fontSize: 11, fontWeight: '900', marginTop: 2, letterSpacing: 0.5 },
  moreTasksText: { fontSize: 13, color: G.p600, fontWeight: '800', marginBottom: 5, marginLeft: 20 },

  viewAllRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, borderTopWidth: 2, borderTopColor: G.p100, paddingTop: 10 },
  viewAllText: { fontSize: 14, color: G.p600, fontWeight: '900' },

  // ── Mini Stats (Redesigned horizontally to prevent clipping) ──
  miniStatCard: { flexDirection: 'row', alignItems: 'center', padding: 12, justifyContent: 'space-between' },
  miniStatIconBg: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  miniStatNum: { fontSize: 24, fontWeight: '900', lineHeight: 28, letterSpacing: -1 },
  miniStatLabel: { fontSize: 11, color: G.txtFaint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Empty States
  emptyMini: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyMiniTitle: { fontSize: 18, fontWeight: '900', color: G.txtMain },
  emptyMiniSub: { fontSize: 13, color: G.txtFaint, fontWeight: '700' },

  // ── Calendar Card
  calMonthLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  weekDayCell: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12 },
  weekDayActive: { backgroundColor: G.white, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
  weekDayName: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '800', textTransform: 'uppercase' },
  weekDayNameActive: { color: G.p700, fontWeight: '900' },
  weekDayDate: { fontSize: 15, color: G.white, fontWeight: '900', marginTop: 4 },
  weekDayDateActive: { color: G.p900 },
  calFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  calDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.8)' },
  calFooterText: { fontSize: 13, color: G.white, fontWeight: '800' },

  // ── Planner
  plannerItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  plannerTime: { fontSize: 11, color: G.p600, fontWeight: '900', width: 50 },
  plannerBar: { width: 4, height: 32, borderRadius: 2 },
  plannerTitle: { flex: 1, fontSize: 14, color: G.txtMain, fontWeight: '800' },

  // ── Manager/Supervisor Reports
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 },
  reportItem: { flex: 1, minWidth: '45%', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  reportVal: { fontSize: 24, fontWeight: '900', color: G.white },
  reportLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '800', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  reportActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  reportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: G.white, borderRadius: 20, paddingVertical: 10 },
  reportBtnText: { fontSize: 12, fontWeight: '900', color: G.p800 },

  // Redesigned horizontal pill to prevent text clipping
  miniStatPill: { flex: 1, minWidth: '46%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12, gap: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  miniStatPillNum: { fontSize: 22, fontWeight: '900' },
  miniStatPillLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },

  progressBarContainer: { gap: 6 },
  progressBarBg: { height: 10, backgroundColor: G.p200, borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: G.p600, borderRadius: 5 },
  progressBarLabel: { fontSize: 13, color: G.txtFaint, fontWeight: '800' },

  // ── Employee Report
  myReportRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
  completionRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 6, borderColor: G.p600, backgroundColor: G.p100, alignItems: 'center', justifyContent: 'center' },
  completionPct: { fontSize: 20, fontWeight: '900', color: G.p900 },
  completionLabel: { fontSize: 10, color: G.p600, fontWeight: '900', marginTop: -2, letterSpacing: 1 },
  myReportStats: { flex: 1, gap: 10 },
  myReportStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  myReportStatLabel: { flex: 1, fontSize: 14, color: G.txtMuted, fontWeight: '700' },
  myReportStatVal: { fontSize: 18, fontWeight: '900' },

  // ── Expense Grid
  expenseGrid: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  expenseStat: { flex: 1, alignItems: 'center', borderRadius: 16, paddingVertical: 12, borderWidth: 2, borderColor: G.white, gap: 4 },
  expenseStatNum: { fontSize: 24, fontWeight: '900' },
  expenseStatLabel: { fontSize: 11, color: G.txtFaint, fontWeight: '900', textTransform: 'uppercase' },
  expenseActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  expenseBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: G.p100, borderRadius: 20, paddingVertical: 12, borderWidth: 2, borderColor: G.p200 },
  expenseBtnText: { fontSize: 13, fontWeight: '900', color: G.p700 },
});