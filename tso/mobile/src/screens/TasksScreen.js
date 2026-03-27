import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Alert,
  Modal,
  Animated,
  ScrollView,
  TextInput,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { getTasks, deleteTask, getDepartments, getUserProjects } from '../services/api';
import TaskCard from '../components/TaskCard';
import LoadingSpinner from '../components/LoadingSpinner';

const { width, height } = Dimensions.get('window');
const GUTTER = 16;

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
  err:      '#DC2626',
  errBg:    '#FEE2E2',
  success:  '#059669',
  warn:     '#D97706',
};

// Native fluid shadow
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

// ─── Filter & Scope Configuration ────────────────────────────────────────────
const FILTERS = [
  { key: 'all',         label: 'All',         color: G.p700 },
  { key: 'in_progress', label: 'In Progress', color: G.warn },
  { key: 'todo',        label: 'To Do',       color: G.p800 },
  { key: 'completed',   label: 'Completed',   color: G.success },
  { key: 'on_hold',     label: 'On Hold',     color: '#7C3AED' },
  { key: 'backlog',     label: 'Backlog',     color: G.err },
];

const DATE_FILTERS = [
  { key: 'today',  label: 'Today',      icon: 'today-outline' },
  { key: 'week',   label: 'This Week',  icon: 'calendar-outline' },
  { key: 'month',  label: 'This Month', icon: 'calendar' },
  { key: 'year',   label: 'This Year',  icon: 'calendar-clear-outline' },
];

const getDateRange = (key) => {
  const now = new Date();
  const start = new Date(now);
  switch (key) {
    case 'today': {
      start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case 'week': {
      const day = now.getDay();
      start.setDate(now.getDate() - day); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      return { start, end };
    }
    case 'month': {
      start.setDate(1); start.setHours(0, 0, 0, 0);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return { start, end };
    }
    case 'year': {
      start.setMonth(0, 1); start.setHours(0, 0, 0, 0);
      const end = new Date(start.getFullYear() + 1, 0, 1);
      return { start, end };
    }
    default: return null;
  }
};

const isInDateRange = (task, range) => {
  if (!range) return true;
  const dateStr = task.deadline || task.due_date || task.created_at;
  if (!dateStr) return true; // tasks without dates always show
  const d = new Date(dateStr);
  return d >= range.start && d < range.end;
};

const SCOPE_DEPT_COLORS  = [G.p600, '#6366F1', G.p700, '#4F46E5', '#0EA5E9'];
const SCOPE_TEAM_COLORS  = ['#0891B2', '#0D9488', '#059669', '#0284C7', '#0F766E'];
const deptColor = (i) => SCOPE_DEPT_COLORS[i % SCOPE_DEPT_COLORS.length];
const teamColor = (i) => SCOPE_TEAM_COLORS[i % SCOPE_TEAM_COLORS.length];

const isTaskOverdue = (task) => {
  const deadline = task.deadline || task.due_date;
  if (!deadline) return false;
  return new Date(deadline) < new Date() && (task.status || '').toLowerCase() !== 'completed';
};

// ─── FilterChip (High Contrast Glass) ────────────────────────────────────────
const FilterChip = ({ filter, isActive, count, onPress }) => (
  <TouchableOpacity
    style={[
      styles.filterChip,
      isActive 
        ? { backgroundColor: filter.color, borderColor: filter.color, shadowColor: filter.color, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }
        : { backgroundColor: 'rgba(255,255,255,0.7)', borderColor: G.p200 }
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.filterChipText, { color: isActive ? G.white : G.txtMuted }]}>
      {filter.label}
    </Text>
    <View style={[styles.filterBadge, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : G.white }]}>
      <Text style={[styles.filterBadgeText, { color: isActive ? G.white : filter.color }]}>
        {count}
      </Text>
    </View>
  </TouchableOpacity>
);

// ─── Screen Component ────────────────────────────────────────────────────────
export default function TasksScreen({ navigation }) {
  const { user, isManager, isSupervisor } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [tasks, setTasks] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeScope, setActiveScope] = useState({ key: 'all', label: 'All Tasks', icon: 'layers', color: G.p700, scope: 'all' });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  const [showScopeDropdown, setShowScopeDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [userProjects, setUserProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('week');

  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const dateDropdownAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const [depts, projs] = await Promise.all([getDepartments(), getUserProjects()]);
        setDepartments(Array.isArray(depts) ? depts : []);
        setUserProjects(Array.isArray(projs) ? projs : []);
      } catch {}
    })();
  }, []);

  const fetchTasks = useCallback(async (scopeObj = { scope: 'all' }) => {
    try {
      setError(null);
      const params = {};
      if (!isManager() && !isSupervisor()) params.user_id = user?.id;
      if (scopeObj.scope && scopeObj.scope !== 'all') params.scope = scopeObj.scope;
      if (scopeObj.dept_id)    params.dept_id    = scopeObj.dept_id;
      if (scopeObj.project_id) params.project_id = scopeObj.project_id;
      
      const data = await getTasks(params);
      setTasks(Array.isArray(data) ? data : data?.tasks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, isManager, isSupervisor]);

  useFocusEffect(useCallback(() => { fetchTasks(activeScope); }, [fetchTasks, activeScope]));

  const onRefresh = () => { setIsRefreshing(true); fetchTasks(activeScope); };

  const openDropdown = () => {
    setShowScopeDropdown(true);
    Animated.spring(dropdownAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 9 }).start();
  };

  const closeDropdown = () => {
    Animated.timing(dropdownAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setShowScopeDropdown(false));
  };

  const openDateDropdown = () => {
    setShowDateDropdown(true);
    Animated.spring(dateDropdownAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 9 }).start();
  };

  const closeDateDropdown = () => {
    Animated.timing(dateDropdownAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setShowDateDropdown(false));
  };

  const handleDateFilterChange = (key) => {
    closeDateDropdown();
    setDateFilter(key);
    setActiveFilter('all');
  };

  const handleScopeChange = (scopeObj) => {
    closeDropdown();
    setActiveScope(scopeObj);
    setActiveFilter('all');
    setIsLoading(true);
    fetchTasks(scopeObj);
  };

  const handleDeleteTask = (task) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteTask(task.id);
            setTasks((prev) => prev.filter((t) => t.id !== task.id));
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to delete task');
          }
        },
      },
    ]);
  };

  const dateRange = getDateRange(dateFilter);

  const getFilterCount = (key) => {
    const dated = tasks.filter(t => isInDateRange(t, dateRange));
    if (key === 'all') return dated.length;
    if (key === 'backlog') return dated.filter(isTaskOverdue).length;
    return dated.filter((t) => (t.status || '').toLowerCase().replace(/\s+/g, '_') === key).length;
  };

  const filteredTasks = tasks.filter((task) => {
    // Date range filter
    if (!isInDateRange(task, dateRange)) return false;

    // Status filter
    if (activeFilter === 'backlog' && !isTaskOverdue(task)) return false;
    if (activeFilter !== 'all' && activeFilter !== 'backlog') {
      if ((task.status || '').toLowerCase().replace(/\s+/g, '_') !== activeFilter) return false;
    }

    // Universal search: task title, description, or assigned user
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = (task.title || '').toLowerCase().includes(q);
      const descMatch  = (task.description || '').toLowerCase().includes(q);
      const userMatch  = typeof task.assigned_to === 'string'
        ? task.assigned_to.toLowerCase().includes(q)
        : (task.assigned_to?.username || '').toLowerCase().includes(q);
      return titleMatch || descMatch || userMatch;
    }
    return true;
  });

  const activeFilterCfg = FILTERS.find((f) => f.key === activeFilter);

  if (isLoading) return <LoadingSpinner fullScreen message="Loading tasks..." />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* ── Background Gradient & Ambient Orbs ── */}
      <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
      <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.p300 }]} />
      <View style={[styles.ambientOrb, { bottom: -100, left: -60, backgroundColor: '#A5F3FC', transform: [{ scale: 1.2 }] }]} />

      {/* ── High Contrast Control Center Header ── */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
        
        {/* Top Row: Navigation, Title & Scope */}
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Home')} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>My Tasks</Text>
            <Text style={styles.headerSubtitle}>{tasks.length} active items</Text>
          </View>

          <TouchableOpacity style={[styles.scopeTrigger, { borderColor: activeScope.color }]} onPress={openDropdown} activeOpacity={0.8}>
            <Ionicons name={activeScope.icon} size={14} color={activeScope.color} />
            <Text style={[styles.scopeTriggerText, { color: activeScope.color }]} numberOfLines={1} ellipsizeMode="tail">
              {activeScope.label}
            </Text>
            <Ionicons name="chevron-down" size={14} color={activeScope.color} />
          </TouchableOpacity>
        </View>

        {/* Middle Row: Search Bar & Date Filter */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, searchQuery.length > 0 && styles.searchBoxActive]}>
            <Ionicons name="search" size={20} color={searchQuery.length > 0 ? G.p700 : G.txtFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tasks or users..."
              placeholderTextColor={G.txtFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              selectionColor={G.p600}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color={G.txtFaint} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.dateFilterBtn} onPress={openDateDropdown} activeOpacity={0.8}>
            <Ionicons name={DATE_FILTERS.find(f => f.key === dateFilter)?.icon || 'calendar-outline'} size={14} color={G.p700} />
            <Text style={styles.dateFilterText} numberOfLines={1}>
              {DATE_FILTERS.find(f => f.key === dateFilter)?.label}
            </Text>
            <Ionicons name="chevron-down" size={12} color={G.p700} />
          </TouchableOpacity>
        </View>

        {/* Bottom Row: Filters */}
        <View style={styles.filterRow}>
          <FlatList
            data={FILTERS}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <FilterChip filter={item} isActive={activeFilter === item.key} count={getFilterCount(item.key)} onPress={() => setActiveFilter(item.key)} />
            )}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          />
        </View>
      </View>

      {/* ── Task List ── */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={G.p600} />}
        ListHeaderComponent={
          <>
            {/* Error banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color={G.err} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => fetchTasks(activeScope)}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
              </View>
            )}

            {/* Section label */}
            <View style={styles.sectionLabelRow}>
              <View style={[styles.sectionAccentLine, { backgroundColor: activeFilterCfg?.color || G.p500 }]} />
              <Text style={styles.sectionLabel}>
                {searchQuery.trim()
                  ? `${filteredTasks.length} result${filteredTasks.length !== 1 ? 's' : ''} for "${searchQuery}"`
                  : activeFilterCfg?.key === 'all'
                    ? `${(activeScope.label || 'ALL TASKS').toUpperCase()} · ${DATE_FILTERS.find(f => f.key === dateFilter)?.label?.toUpperCase()}`
                    : `${activeFilterCfg?.label?.toUpperCase() || ''} · ${DATE_FILTERS.find(f => f.key === dateFilter)?.label?.toUpperCase()}`}
              </Text>
            </View>

            {/* Empty State */}
            {filteredTasks.length === 0 && !error && (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="folder-open" size={42} color={activeFilterCfg?.color || G.p500} />
                </View>
                <Text style={styles.emptyTitle}>No Tasks Found</Text>
                <Text style={styles.emptySubtitle}>There are no tasks matching your current filters.</Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => <TaskCard task={item} onPress={(t) => navigation.navigate('TaskDetail', { task: t })} />}
      />

      {/* ── Date Filter Dropdown Modal ── */}
      <Modal visible={showDateDropdown} transparent animationType="fade" onRequestClose={closeDateDropdown}>
        <TouchableOpacity style={styles.dropdownBackdrop} onPress={closeDateDropdown} activeOpacity={1}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View style={[styles.dropdownCard, { top: insets.top + 75, right: GUTTER, width: 200, opacity: dateDropdownAnim, transform: [{ scale: dateDropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }, { translateY: dateDropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.65)']} style={StyleSheet.absoluteFill} />
            <View style={styles.dropdownGlassEdge} />
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Date Range</Text>
              <Ionicons name="calendar" size={16} color={G.txtMuted} />
            </View>
            {DATE_FILTERS.map((df) => {
              const isActive = dateFilter === df.key;
              return (
                <TouchableOpacity
                  key={df.key}
                  style={[styles.dropdownItem, isActive && { backgroundColor: G.p700 + '10' }]}
                  onPress={() => handleDateFilterChange(df.key)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.dropdownIconWrap, { backgroundColor: (isActive ? G.p700 : G.txtFaint) + '15', borderColor: (isActive ? G.p700 : G.txtFaint) + '40', borderWidth: 1 }]}>
                    <Ionicons name={df.icon} size={16} color={isActive ? G.p700 : G.txtFaint} />
                  </View>
                  <Text style={[styles.dropdownItemLabel, { fontSize: 14 }, isActive && { color: G.p700 }]}>{df.label}</Text>
                  {isActive && <Ionicons name="checkmark-circle" size={20} color={G.p700} />}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* ── Scope Dropdown Modal (Liquid Glass High Contrast) ── */}
      <Modal visible={showScopeDropdown} transparent animationType="fade" onRequestClose={closeDropdown}>
        <TouchableOpacity style={styles.dropdownBackdrop} onPress={closeDropdown} activeOpacity={1}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View style={[styles.dropdownCard, { top: insets.top + 75, opacity: dropdownAnim, transform: [{ scale: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }, { translateY: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.65)']} style={StyleSheet.absoluteFill} />
            <View style={styles.dropdownGlassEdge} />
            
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>View Scope</Text>
              <Ionicons name="funnel" size={18} color={G.txtMuted} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: height * 0.65 }}>
              
              {/* All Tasks */}
              {(() => {
                const s = { key: 'all', label: 'All Tasks', icon: 'layers', color: G.p700, scope: 'all' };
                const isActive = activeScope.key === s.key;
                return (
                  <TouchableOpacity style={[styles.dropdownItem, isActive && { backgroundColor: s.color + '10' }]} onPress={() => handleScopeChange(s)} activeOpacity={0.75}>
                    <View style={[styles.dropdownIconWrap, { backgroundColor: s.color + '15', borderColor: s.color + '40', borderWidth: 1 }]}><Ionicons name={s.icon} size={18} color={s.color} /></View>
                    <View style={styles.dropdownItemText}>
                      <Text style={[styles.dropdownItemLabel, isActive && { color: s.color }]}>{s.label}</Text>
                      <Text style={styles.dropdownItemDesc}>All tasks visible to you</Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={24} color={s.color} />}
                  </TouchableOpacity>
                );
              })()}

              {/* Departments */}
              {departments.length > 0 && (
                <>
                  <View style={styles.dropdownSection}>
                    <Ionicons name="business" size={14} color={G.txtFaint} />
                    <Text style={styles.dropdownSectionLabel}>DEPARTMENTS</Text>
                  </View>
                  {departments.map((dept, idx) => {
                    const s = { key: `dept_${dept.id}`, label: dept.name, icon: 'business', color: deptColor(idx), scope: 'department', dept_id: dept.id };
                    const isActive = activeScope.key === s.key;
                    return (
                      <TouchableOpacity key={s.key} style={[styles.dropdownItem, isActive && { backgroundColor: s.color + '10' }]} onPress={() => handleScopeChange(s)} activeOpacity={0.75}>
                        <View style={[styles.dropdownIconWrap, { backgroundColor: s.color + '15', borderColor: s.color + '40', borderWidth: 1 }]}><Ionicons name={s.icon} size={18} color={s.color} /></View>
                        <View style={styles.dropdownItemText}>
                          <Text style={[styles.dropdownItemLabel, isActive && { color: s.color }]}>{dept.name}</Text>
                          <Text style={styles.dropdownItemDesc}>Department tasks</Text>
                        </View>
                        {isActive && <Ionicons name="checkmark-circle" size={24} color={s.color} />}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* Teams / Projects */}
              {userProjects.length > 0 && (
                <>
                  <View style={styles.dropdownSection}>
                    <Ionicons name="people" size={14} color={G.txtFaint} />
                    <Text style={styles.dropdownSectionLabel}>MY TEAMS</Text>
                  </View>
                  {userProjects.map((proj, idx) => {
                    const s = { key: `team_${proj.id}`, label: proj.name, icon: 'people', color: teamColor(idx), scope: 'team', project_id: proj.id };
                    const isActive = activeScope.key === s.key;
                    return (
                      <TouchableOpacity key={s.key} style={[styles.dropdownItem, isActive && { backgroundColor: s.color + '10' }]} onPress={() => handleScopeChange(s)} activeOpacity={0.75}>
                        <View style={[styles.dropdownIconWrap, { backgroundColor: s.color + '15', borderColor: s.color + '40', borderWidth: 1 }]}><Ionicons name={s.icon} size={18} color={s.color} /></View>
                        <View style={styles.dropdownItemText}>
                          <Text style={[styles.dropdownItemLabel, isActive && { color: s.color }]}>{proj.name}</Text>
                          <Text style={styles.dropdownItemDesc}>Team project tasks</Text>
                        </View>
                        {isActive && <Ionicons name="checkmark-circle" size={24} color={s.color} />}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* Assigned to Me */}
              {(() => {
                const s = { key: 'self', label: 'Assigned to Me', icon: 'person-circle', color: G.success, scope: 'self' };
                const isActive = activeScope.key === s.key;
                return (
                  <>
                    <View style={styles.dropdownSection}>
                      <Ionicons name="person" size={14} color={G.txtFaint} />
                      <Text style={styles.dropdownSectionLabel}>PERSONAL</Text>
                    </View>
                    <TouchableOpacity style={[styles.dropdownItem, { marginBottom: 10, borderBottomWidth: 0 }, isActive && { backgroundColor: s.color + '10' }]} onPress={() => handleScopeChange(s)} activeOpacity={0.75}>
                      <View style={[styles.dropdownIconWrap, { backgroundColor: s.color + '15', borderColor: s.color + '40', borderWidth: 1 }]}><Ionicons name={s.icon} size={18} color={s.color} /></View>
                      <View style={styles.dropdownItemText}>
                        <Text style={[styles.dropdownItemLabel, isActive && { color: s.color }]}>{s.label}</Text>
                        <Text style={styles.dropdownItemDesc}>Tasks directly assigned to you</Text>
                      </View>
                      {isActive && <Ionicons name="checkmark-circle" size={24} color={s.color} />}
                    </TouchableOpacity>
                  </>
                );
              })()}

            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4, filter: [{ blur: 50 }] },

  // ── Header Container (Correctly Stacked)
  headerContainer: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.95)',
    ...liquidShadow,
    zIndex: 10,
  },
  
  // ── Header Top Row (Back, Title, Scope)
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingBottom: 16 },
  headerTitleContainer: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: G.txtFaint, fontWeight: '800', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },

  scopeTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, borderWidth: 2,
    backgroundColor: G.white, maxWidth: 140,
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  scopeTriggerText: { fontSize: 13, fontWeight: '900', flexShrink: 1, letterSpacing: -0.2 },

  // ── Header Middle Row (Search & Toggles)
  searchRow: { flexDirection: 'row', paddingHorizontal: GUTTER, paddingBottom: 14, gap: 10 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', height: 48,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    borderWidth: 2, borderColor: G.p200,
    paddingHorizontal: 14, gap: 8,
  },
  searchBoxActive: { borderColor: G.p600, backgroundColor: G.white, shadowColor: G.p900, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '800', color: G.txtMain },
  
  dateFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: G.white, borderRadius: 16,
    borderWidth: 2, borderColor: G.p200,
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  dateFilterText: { fontSize: 12, fontWeight: '900', color: G.p700, letterSpacing: -0.1 },

  // ── Header Bottom Row (Filter Chips)
  filterRow: { paddingBottom: 16 },
  filterContent: { paddingHorizontal: GUTTER, gap: 10 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, borderWidth: 2,
  },
  filterChipText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.2 },
  filterBadge: { marginLeft: 8, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  filterBadgeText: { fontSize: 11, fontWeight: '900' },

  // ── List & Content
  listContent: { paddingHorizontal: GUTTER, paddingTop: 4 },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 12 },
  sectionAccentLine: { width: 4, height: 16, borderRadius: 2, marginRight: 8 },
  sectionLabel: { fontSize: 12, color: G.txtFaint, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },

  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: G.errBg, borderRadius: 16, padding: 14, gap: 10, borderWidth: 2, borderColor: '#FCA5A5', marginTop: 16 },
  errorText: { flex: 1, fontSize: 13, color: G.err, fontWeight: '800' },
  retryText: { fontSize: 14, color: G.err, fontWeight: '900' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: G.p100, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: G.white, marginBottom: 20,
    shadowColor: G.p900, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, marginBottom: 8, letterSpacing: -0.5 },
  emptySubtitle: { fontSize: 14, color: G.txtFaint, textAlign: 'center', fontWeight: '700', lineHeight: 20 },

  // ── Dropdown Modal
  dropdownBackdrop: { flex: 1, justifyContent: 'flex-start' },
  dropdownCard: {
    position: 'absolute', right: GUTTER, width: width * 0.75, maxWidth: 320,
    borderRadius: 28, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: G.p900, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 30, elevation: 15
  },
  dropdownGlassEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white },
  dropdownHeader: { padding: 20, borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.06)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownTitle: { fontSize: 16, fontWeight: '900', color: G.txtMain, letterSpacing: -0.2 },
  
  dropdownSection: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  dropdownSectionLabel: { fontSize: 12, fontWeight: '900', color: G.txtFaint, letterSpacing: 1.2, textTransform: 'uppercase' },
  
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  dropdownIconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  dropdownItemText: { flex: 1 },
  dropdownItemLabel: { fontSize: 16, fontWeight: '800', color: G.txtMain, marginBottom: 2 },
  dropdownItemDesc: { fontSize: 12, color: G.txtFaint, fontWeight: '700' }
});