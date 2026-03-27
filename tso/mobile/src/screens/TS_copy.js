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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getTasks, deleteTask, getDepartments, getUserProjects } from '../services/api';
import TaskCard from '../components/TaskCard';
import LoadingSpinner from '../components/LoadingSpinner';

// ---------------------------------------------------------------------------
// Liquid Glass Blue Palette — matches HomeScreen theme
// ---------------------------------------------------------------------------
const G = {
  bg:       '#EFF6FF',
  card:     'rgba(255,255,255,0.82)',
  cardBrd:  'rgba(147,197,253,0.55)',
  p50:      '#EFF6FF',
  p100:     '#DBEAFE',
  p200:     '#BFDBFE',
  p300:     '#93C5FD',
  p400:     '#60A5FA',
  p500:     '#3B82F6',
  p600:     '#2563EB',
  p700:     '#1D4ED8',
  p800:     '#1E40AF',
  p900:     '#1E3A8A',
  txt:      '#1E3A8A',
  txtSub:   '#64748B',
  white:    '#FFFFFF',
  err:      '#EF4444',
};

const cardShadow = {
  shadowColor: G.p700,
  shadowOpacity: 0.10,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
};

// ---------------------------------------------------------------------------
// Filter configuration
// ---------------------------------------------------------------------------
const FILTERS = [
  { key: 'all',         label: 'All',         color: G.p600 },
  { key: 'in_progress', label: 'In Progress',  color: '#2196F3' },
  { key: 'completed',   label: 'Completed',    color: '#4CAF50' },
  { key: 'todo',        label: 'To Do',        color: G.p500 },
  { key: 'on_hold',     label: 'On Hold',      color: '#FF9800' },
  { key: 'backlog',     label: 'Backlog',      color: '#F44336' },
];

const SCOPE_DEPT_COLORS  = [G.p500, '#5C6BC0', G.p600, G.p700, '#0097A7'];
const SCOPE_TEAM_COLORS  = ['#00BCD4', '#009688', '#26A69A', '#00ACC1', '#0097A7'];
const deptColor = (i) => SCOPE_DEPT_COLORS[i % SCOPE_DEPT_COLORS.length];
const teamColor = (i) => SCOPE_TEAM_COLORS[i % SCOPE_TEAM_COLORS.length];

const isTaskOverdue = (task) => {
  const deadline = task.deadline || task.due_date;
  if (!deadline) return false;
  return new Date(deadline) < new Date() &&
    (task.status || '').toLowerCase() !== 'completed';
};

// ---------------------------------------------------------------------------
// FilterChip
// ---------------------------------------------------------------------------
const FilterChip = ({ filter, isActive, count, onPress }) => (
  <TouchableOpacity
    style={[
      styles.filterChip,
      isActive
        ? { backgroundColor: filter.color, borderColor: filter.color }
        : { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(147,197,253,0.45)' },
    ]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={[styles.filterChipText, { color: isActive ? G.white : G.txtSub }]}>
      {filter.label}
    </Text>
    <View
      style={[
        styles.filterBadge,
        { backgroundColor: isActive ? 'rgba(255,255,255,0.28)' : filter.color + '22' },
      ]}
    >
      <Text style={[styles.filterBadgeText, { color: isActive ? G.white : filter.color }]}>
        {count}
      </Text>
    </View>
  </TouchableOpacity>
);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function TasksScreen({ navigation }) {
  const { user, isManager, isSupervisor } = useAuth();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks]                   = useState([]);
  const [activeFilter, setActiveFilter]     = useState('all');
  const [activeScope, setActiveScope]       = useState({ key: 'all', label: 'All Tasks', icon: 'layers-outline', color: G.p600, scope: 'all' });
  const [isLoading, setIsLoading]           = useState(true);
  const [isRefreshing, setIsRefreshing]     = useState(false);
  const [error, setError]                   = useState(null);
  const [showScopeDropdown, setShowScopeDropdown] = useState(false);
  const [departments, setDepartments]       = useState([]);
  const [userProjects, setUserProjects]     = useState([]);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchMode, setSearchMode]         = useState('task');
  const dropdownAnim = useRef(new Animated.Value(0)).current;

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
      if (!isManager() && !isSupervisor()) {
        params.user_id = user?.id;
      }
      if (scopeObj.scope && scopeObj.scope !== 'all') params.scope = scopeObj.scope;
      if (scopeObj.dept_id)    params.dept_id    = scopeObj.dept_id;
      if (scopeObj.project_id) params.project_id = scopeObj.project_id;
      const data = await getTasks(params);
      const taskList = Array.isArray(data) ? data : data?.tasks || [];
      setTasks(taskList);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, isManager, isSupervisor]);

  useFocusEffect(
    useCallback(() => {
      fetchTasks(activeScope);
    }, [fetchTasks, activeScope])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchTasks(activeScope);
  };

  const openDropdown = () => {
    setShowScopeDropdown(true);
    Animated.spring(dropdownAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };

  const closeDropdown = () => {
    Animated.timing(dropdownAnim, { toValue: 0, duration: 150, useNativeDriver: true })
      .start(() => setShowScopeDropdown(false));
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
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
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

  const getFilterCount = (key) => {
    if (key === 'all') return tasks.length;
    if (key === 'backlog') return tasks.filter(isTaskOverdue).length;
    return tasks.filter(
      (t) => (t.status || '').toLowerCase().replace(/\s+/g, '_') === key
    ).length;
  };

  const filteredTasks = tasks.filter((task) => {
    if (activeFilter === 'backlog' && !isTaskOverdue(task)) return false;
    if (activeFilter !== 'all' && activeFilter !== 'backlog') {
      if ((task.status || '').toLowerCase().replace(/\s+/g, '_') !== activeFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (searchMode === 'task') {
        return (task.title || '').toLowerCase().includes(q) ||
               (task.description || '').toLowerCase().includes(q);
      } else {
        const name = typeof task.assigned_to === 'string'
          ? task.assigned_to
          : task.assigned_to?.username || '';
        return name.toLowerCase().includes(q);
      }
    }
    return true;
  });

  const activeFilterCfg = FILTERS.find((f) => f.key === activeFilter);

  if (isLoading) return <LoadingSpinner fullScreen message="Loading tasks..." />;

  const renderFilterChip = ({ item }) => (
    <FilterChip
      filter={item}
      isActive={activeFilter === item.key}
      count={getFilterCount(item.key)}
      onPress={() => setActiveFilter(item.key)}
    />
  );

  const renderTaskItem = ({ item }) => (
    <TaskCard
      task={item}
      onPress={(t) => navigation.navigate('TaskDetail', { task: t })}
    />
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Glass Header ── */}
      <View style={styles.header}>
        {/* Glare strip — simulates light hitting glass edge */}
        <View style={styles.headerGlareStrip} />

        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color={G.p600} />
            </TouchableOpacity>
            <View>
              {/* Pill-badge title */}
              <View style={styles.titlePill}>
                <View style={styles.titlePillDot} />
                <Text style={styles.headerTitle}>My Tasks</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                {tasks.length} tasks · {activeScope.label}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.scopeTrigger, { borderColor: activeScope.color + '60' }]}
              onPress={openDropdown}
              activeOpacity={0.8}
            >
              <Ionicons name={activeScope.icon} size={13} color={activeScope.color} />
              <Text style={[styles.scopeTriggerText, { color: activeScope.color }]} numberOfLines={1}>
                {activeScope.label}
              </Text>
              <Ionicons name="chevron-down" size={11} color={activeScope.color} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('AddTask', { task: null })}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={22} color={G.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Scope dropdown modal ── */}
      <Modal visible={showScopeDropdown} transparent animationType="none" onRequestClose={closeDropdown}>
        <TouchableOpacity style={styles.dropdownBackdrop} onPress={closeDropdown} activeOpacity={1}>
          <Animated.View
            style={[
              styles.dropdownCard,
              { top: insets.top + 76, right: 20 },
              {
                opacity: dropdownAnim,
                transform: [
                  { scale: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
                  { translateY: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
                ],
              },
            ]}
          >
            <View style={styles.dropdownGlassStrip} />
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>View Scope</Text>
              <Ionicons name="funnel-outline" size={14} color={G.txtSub} />
            </View>
            <View style={styles.dropdownDivider} />

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>

              {(() => {
                const s = { key: 'all', label: 'All Tasks', icon: 'layers-outline', color: G.p600, scope: 'all' };
                const isActive = activeScope.key === s.key;
                return (
                  <TouchableOpacity
                    style={[styles.dropdownItem, isActive && { backgroundColor: s.color + '12' }]}
                    onPress={() => handleScopeChange(s)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.dropdownIconWrap, { backgroundColor: s.color + '18' }]}>
                      <Ionicons name={s.icon} size={16} color={s.color} />
                    </View>
                    <View style={styles.dropdownItemText}>
                      <Text style={[styles.dropdownItemLabel, isActive && { color: s.color }]}>{s.label}</Text>
                      <Text style={styles.dropdownItemDesc}>All tasks visible to you</Text>
                    </View>
                    {isActive && <View style={[styles.dropdownCheck, { backgroundColor: s.color }]}><Ionicons name="checkmark" size={10} color="#fff" /></View>}
                  </TouchableOpacity>
                );
              })()}

              {departments.length > 0 && (
                <>
                  <View style={styles.dropdownSection}>
                    <Ionicons name="business-outline" size={11} color={G.txtSub} />
                    <Text style={styles.dropdownSectionLabel}>DEPARTMENTS</Text>
                  </View>
                  {departments.map((dept, idx) => {
                    const s = { key: `dept_${dept.id}`, label: dept.name, icon: 'business-outline', color: deptColor(idx), scope: 'department', dept_id: dept.id };
                    const isActive = activeScope.key === s.key;
                    return (
                      <TouchableOpacity
                        key={s.key}
                        style={[styles.dropdownItem, isActive && { backgroundColor: s.color + '12' }]}
                        onPress={() => handleScopeChange(s)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.dropdownIconWrap, { backgroundColor: s.color + '18' }]}>
                          <Ionicons name={s.icon} size={16} color={s.color} />
                        </View>
                        <View style={styles.dropdownItemText}>
                          <Text style={[styles.dropdownItemLabel, isActive && { color: s.color }]}>{dept.name}</Text>
                          <Text style={styles.dropdownItemDesc}>Department tasks</Text>
                        </View>
                        {isActive && <View style={[styles.dropdownCheck, { backgroundColor: s.color }]}><Ionicons name="checkmark" size={10} color="#fff" /></View>}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {userProjects.length > 0 && (
                <>
                  <View style={styles.dropdownSection}>
                    <Ionicons name="people-outline" size={11} color={G.txtSub} />
                    <Text style={styles.dropdownSectionLabel}>MY TEAMS</Text>
                  </View>
                  {userProjects.map((proj, idx) => {
                    const s = { key: `team_${proj.id}`, label: proj.name, icon: 'people-outline', color: teamColor(idx), scope: 'team', project_id: proj.id };
                    const isActive = activeScope.key === s.key;
                    return (
                      <TouchableOpacity
                        key={s.key}
                        style={[styles.dropdownItem, isActive && { backgroundColor: s.color + '12' }]}
                        onPress={() => handleScopeChange(s)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.dropdownIconWrap, { backgroundColor: s.color + '18' }]}>
                          <Ionicons name={s.icon} size={16} color={s.color} />
                        </View>
                        <View style={styles.dropdownItemText}>
                          <Text style={[styles.dropdownItemLabel, isActive && { color: s.color }]}>{proj.name}</Text>
                          <Text style={styles.dropdownItemDesc}>Team project tasks</Text>
                        </View>
                        {isActive && <View style={[styles.dropdownCheck, { backgroundColor: s.color }]}><Ionicons name="checkmark" size={10} color="#fff" /></View>}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {(() => {
                const s = { key: 'self', label: 'Assigned to Me', icon: 'person-circle-outline', color: '#4CAF50', scope: 'self' };
                const isActive = activeScope.key === s.key;
                return (
                  <>
                    <View style={styles.dropdownSection}>
                      <Ionicons name="person-outline" size={11} color={G.txtSub} />
                      <Text style={styles.dropdownSectionLabel}>PERSONAL</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.dropdownItem, { marginBottom: 4 }, isActive && { backgroundColor: s.color + '12' }]}
                      onPress={() => handleScopeChange(s)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.dropdownIconWrap, { backgroundColor: s.color + '18' }]}>
                        <Ionicons name={s.icon} size={16} color={s.color} />
                      </View>
                      <View style={styles.dropdownItemText}>
                        <Text style={[styles.dropdownItemLabel, isActive && { color: s.color }]}>{s.label}</Text>
                        <Text style={styles.dropdownItemDesc}>Tasks directly assigned to you</Text>
                      </View>
                      {isActive && <View style={[styles.dropdownCheck, { backgroundColor: s.color }]}><Ionicons name="checkmark" size={10} color="#fff" /></View>}
                    </TouchableOpacity>
                  </>
                );
              })()}

            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* ── Search bar ── */}
      <View style={styles.searchRow}>
        {/* Search input glass box */}
        <View style={[styles.searchBox, searchQuery.length > 0 && styles.searchBoxActive]}>
          <Ionicons
            name={searchMode === 'task' ? 'search-outline' : 'person-search-outline'}
            size={16}
            color={searchQuery.length > 0 ? G.p600 : G.txtSub}
            style={{ marginRight: 6 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={searchMode === 'task' ? 'Search tasks…' : 'Search by user…'}
            placeholderTextColor={G.txtSub}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={G.txtSub} />
            </TouchableOpacity>
          )}
        </View>

        {/* Mode toggle — two separate pill buttons, no overflow:hidden clip */}
        <View style={styles.searchToggle}>
          <TouchableOpacity
            style={[
              styles.searchToggleBtn,
              searchMode === 'task' && { backgroundColor: G.p600 },
            ]}
            onPress={() => { setSearchMode('task'); setSearchQuery(''); }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="document-text-outline"
              size={14}
              color={searchMode === 'task' ? G.white : G.txtSub}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.searchToggleBtn,
              searchMode === 'user' && { backgroundColor: G.p500 },
            ]}
            onPress={() => { setSearchMode('user'); setSearchQuery(''); }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-outline"
              size={14}
              color={searchMode === 'user' ? G.white : G.txtSub}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Status Filter Chips — below search ── */}
      <FlatList
        data={FILTERS}
        keyExtractor={(item) => item.key}
        renderItem={renderFilterChip}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={styles.filterContent}
      />

      {/* ── Error banner ── */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={G.err} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchTasks}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Section label ── */}
      <View style={styles.sectionLabelRow}>
        <View style={[styles.sectionAccentLine, { backgroundColor: activeFilterCfg?.color || G.p500 }]} />
        <Text style={styles.sectionLabel}>
          {searchQuery.trim()
            ? `${filteredTasks.length} result${filteredTasks.length !== 1 ? 's' : ''} for "${searchQuery}"`
            : activeFilterCfg?.key === 'all'
              ? `${(activeScope.label || 'ALL TASKS').toUpperCase()} · ${filteredTasks.length}`
              : `${filteredTasks.length} ${activeFilterCfg?.label?.toUpperCase() || ''} TASKS`}
        </Text>
      </View>

      {/* ── Task list or empty state ── */}
      {filteredTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="clipboard-outline"
              size={42}
              color={activeFilterCfg?.color || G.p400}
            />
          </View>
          <Text style={styles.emptyTitle}>No tasks found</Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter !== 'all'
              ? `No ${activeFilter.replace(/_/g, ' ')} tasks yet`
              : 'Create your first task to get started'}
          </Text>
          {activeFilter === 'all' && (
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => navigation.navigate('AddTask', { task: null })}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color={G.white} />
              <Text style={styles.createBtnText}>New Task</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTaskItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 110 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={G.p500}
              colors={[G.p500]}
            />
          }
        />
      )}

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 90 + insets.bottom }]}
        onPress={() => navigation.navigate('AddTask', { task: null })}
        activeOpacity={0.85}
      >
        <View style={styles.fabHighlight} />
        <Ionicons name="add" size={28} color={G.white} />
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: G.bg,
  },

  // ── Glass Header ──
  header: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(147,197,253,0.35)',
    zIndex: 10,
    ...cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    elevation: 6,
  },
  // Glare: a bright highlight at the top that simulates glass refraction
  headerGlareStrip: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(191,219,254,0.45)',
  },
  // Rounded pill wrapper for the "My Tasks" title
  // titlePill: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   alignSelf: 'flex-start',
  //   backgroundColor: 'rgba(219,234,254,0.72)',
  //   borderRadius: 50,
  //   borderWidth: 1.5,
  //   borderColor: 'rgba(147,197,253,0.55)',
  //   paddingHorizontal: 14,
  //   paddingVertical: 5,
  //   marginBottom: 3,
  //   gap: 7,
  //   shadowColor: G.p600,
  //   shadowOpacity: 0.10,
  //   shadowRadius: 8,
  //   shadowOffset: { width: 0, height: 2 },
  //   elevation: 2,
  // },
  // titlePillDot: {
  //   width: 8,
  //   height: 8,
  //   borderRadius: 4,
  //   backgroundColor: G.p500,
  // },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.90)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(147,197,253,0.55)',
    shadowColor: G.p700,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: G.txt,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: G.txtSub,
    fontWeight: '500',
    marginTop: 1,
    letterSpacing: 0.1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: G.p600,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: G.p700,
    shadowOpacity: 0.30,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  // ── Scope trigger pill ──
  scopeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 50,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.90)',
    maxWidth: 120,
    shadowColor: G.p700,
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  scopeTriggerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    flexShrink: 1,
  },

  // ── Dropdown ──
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30,58,138,0.18)',
  },
  dropdownCard: {
    position: 'absolute',
    width: 268,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.40)',
    shadowColor: G.p700,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  dropdownGlassStrip: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: G.txt,
    letterSpacing: 0.2,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(147,197,253,0.25)',
  },
  dropdownSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  dropdownSectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: G.txtSub,
    letterSpacing: 1.2,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
  },
  dropdownIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemText: { flex: 1 },
  dropdownItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: G.txt,
  },
  dropdownItemDesc: {
    fontSize: 10,
    color: G.txtSub,
    marginTop: 1,
  },
  dropdownCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Filter chips ──
  filterList: { flexGrow: 0, zIndex: 1 },
  filterContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1.5,
    marginRight: 8,
    shadowColor: G.p700,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  filterBadge: {
    marginLeft: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Search bar — distortion-free layout ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 8,
    zIndex: 1,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(147,197,253,0.45)',
    paddingHorizontal: 14,
    shadowColor: G.p700,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchBoxActive: {
    borderColor: G.p400,
    backgroundColor: 'rgba(219,234,254,0.55)',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: G.txt,
    paddingVertical: 0,
    height: 44,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  // Toggle: two separate rounded buttons side by side inside a glass pill
  searchToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(147,197,253,0.45)',
    height: 44,
    paddingHorizontal: 3,
    gap: 2,
    shadowColor: G.p700,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Section label ──
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 6,
    marginTop: 2,
    zIndex: 1,
  },
  sectionAccentLine: {
    width: 4,
    height: 15,
    borderRadius: 2.5,
    marginRight: 8,
  },
  sectionLabel: {
    fontSize: 11,
    color: G.txtSub,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },

  // ── Error banner ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 8,
    zIndex: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: G.err,
  },
  retryText: {
    fontSize: 12,
    color: G.p600,
    fontWeight: '600',
  },

  // ── Task list ──
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    zIndex: 1,
  },

  // ── Empty state ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 1,
  },
  emptyIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(147,197,253,0.40)',
    marginBottom: 20,
    shadowColor: G.p700,
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: G.txt,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 14,
    color: G.txtSub,
    textAlign: 'center',
    lineHeight: 22,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: G.p600,
    borderRadius: 50,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
    gap: 6,
    shadowColor: G.p700,
    shadowOpacity: 0.30,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: G.white,
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: G.p600,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: G.p700,
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    zIndex: 10,
  },
  fabHighlight: {
    position: 'absolute',
    top: 2,
    left: 8,
    right: 8,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
});
