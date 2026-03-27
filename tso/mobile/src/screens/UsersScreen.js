import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import { getUsers, createUserAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const GUTTER = 16;
const GAP = 14;

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
  
  amber:    '#D97706',
  amberBg:  '#FEF3C7',
  green:    '#059669',
  greenBg:  '#D1FAE5',
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

const AVATAR_PALETTE = [G.purple, G.amber, G.green, G.p600, G.pink, G.teal, G.red];

const getAvatarColor = (name) => AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length];
const getInitials = (name) => (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// Which roles each viewer can see performance for
const VISIBLE_ROLES = {
  manager:    ['manager', 'supervisor', 'employee', 'finance'],
  supervisor: ['supervisor', 'employee'],
  employee:   ['employee'],
  finance:    ['employee', 'finance'],
};

// Role filter tabs per viewer role
const FILTER_TABS = {
  manager:    [
    { key: 'all',        label: 'All' },
    { key: 'manager',    label: 'Managers' },
    { key: 'supervisor', label: 'Supervisors'},
    { key: 'employee',   label: 'Employees' },
    { key: 'finance',    label: 'Finance' },
  ],
  supervisor: [
    { key: 'all',        label: 'All' },
    { key: 'supervisor', label: 'Supervisors'},
    { key: 'employee',   label: 'Employees' },
  ],
  employee:   [
    { key: 'all',        label: 'All' },
    { key: 'employee',   label: 'Employees' },
  ],
  finance:    [
    { key: 'all',        label: 'All' },
    { key: 'employee',   label: 'Employees' },
    { key: 'finance',    label: 'Finance' },
  ],
};

const ASSIGNABLE_ROLES = ['employee', 'supervisor', 'manager', 'finance'];

// ─── Main Component ──────────────────────────────────────────────────────────
export default function UsersScreen({ navigation }) {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const viewerRole = user?.role || 'employee';

  const [users,          setUsers]        = useState([]);
  const [activeRole,     setActiveRole]   = useState('all');
  const [isLoading,      setIsLoading]    = useState(true);
  const [isRefreshing,   setIsRefreshing] = useState(false);
  const [error,          setError]        = useState(null);
  const [searchQuery,    setSearchQuery]  = useState('');
  
  const [showAddModal,   setShowAddModal] = useState(false);
  const [isCreating,     setIsCreating]   = useState(false);
  const [newUser,        setNewUser]      = useState({ username: '', password: '', role: 'employee', email: '' });
  const [showRolePicker, setShowRolePicker] = useState(false);

  const tabs         = FILTER_TABS[viewerRole] || FILTER_TABS.employee;
  const visibleRoles = VISIBLE_ROLES[viewerRole] || ['employee'];
  const canAddUser   = viewerRole === 'manager';

  const fetchUsers = useCallback(async () => {
    try {
      setError(null);
      const data = await getUsers(activeRole !== 'all' ? activeRole : null);
      const list = Array.isArray(data) ? data : data?.users || [];
      const filtered = list.filter(u => visibleRoles.includes(u.role));
      setUsers(filtered);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeRole, viewerRole]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const onRefresh = () => { setIsRefreshing(true); fetchUsers(); };

  const handleCreateUser = async () => {
    if (!newUser.username.trim()) { Alert.alert('Error', 'Username is required'); return; }
    if (!newUser.password.trim()) { Alert.alert('Error', 'Password is required'); return; }
    setIsCreating(true);
    try {
      const created = await createUserAPI(newUser);
      const u = created?.user || created;
      setUsers(prev => [...prev, u]);
      setShowAddModal(false);
      setNewUser({ username: '', password: '', role: 'employee', email: '' });
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  const renderUser = ({ item: u }) => {
    const roleConfig  = ROLE_CONFIG[u.role] || ROLE_CONFIG.employee;
    const avatarColor = getAvatarColor(u.username);

    return (
      <TouchableOpacity
        style={[styles.shadowWrap, { marginBottom: GAP }]}
        onPress={() => navigation.navigate('UserPerformance', { targetUser: u })}
        activeOpacity={0.8}
      >
        <View style={styles.glassLight}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
          <View style={styles.glassHighlight} />
          
          <View style={styles.cardPadding}>
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{getInitials(u.username)}</Text>
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{u.username}</Text>
              {u.email ? <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text> : null}
              {u.department ? (
                <View style={styles.deptRow}>
                  <Ionicons name="business" size={12} color={G.txtFaint} />
                  <Text style={styles.userDept} numberOfLines={1}>{u.department}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.userRight}>
              <View style={[styles.roleBadge, { backgroundColor: roleConfig.bg, borderColor: roleConfig.color + '40' }]}>
                <Text style={[styles.roleBadgeText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
              </View>
              <View style={styles.viewPerfBtn}>
                <Ionicons name="bar-chart" size={14} color={G.p700} />
                <Text style={styles.viewPerfText}>Stats</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) return <LoadingSpinner fullScreen message="Loading team..." />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* ── Stable Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.p300 }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -60, backgroundColor: '#A5F3FC', transform: [{ scale: 1.2 }] }]} />
      </View>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Team Directory</Text>
            <Text style={styles.headerSubtitle}>{users.length} members</Text>
          </View>
          {canAddUser ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
              <Ionicons name="person-add" size={18} color={G.white} />
            </TouchableOpacity>
          ) : <View style={{ width: 44 }} />}
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={item => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={G.p700} />}
        ListHeaderComponent={
          <>
            {/* ── Search Bar ── */}
            <View style={styles.searchSection}>
              <View style={[styles.searchBox, searchQuery.length > 0 && styles.searchBoxActive]}>
                <Ionicons name="search" size={20} color={searchQuery.length > 0 ? G.p700 : G.txtFaint} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search team..."
                  placeholderTextColor={G.txtFaint}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={G.p600}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={20} color={G.txtFaint} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Role Filter Tabs ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
              {tabs.map(r => {
                const isActive = activeRole === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[
                      styles.filterChip,
                      isActive && styles.filterChipActive,
                      isActive && { shadowColor: G.p900, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 }
                    ]}
                    onPress={() => setActiveRole(r.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{r.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Error Banner ── */}
            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color={G.red} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={fetchUsers}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
              </View>
            )}

            {/* ── Stats Summary ── */}
            <View style={styles.statsSummary}>
              {Object.entries(ROLE_CONFIG)
                .filter(([key]) => visibleRoles.includes(key))
                .map(([key, cfg]) => {
                  const count = users.filter(u => u.role === key).length;
                  if (count === 0) return null;
                  return (
                    <View key={key} style={[styles.statChip, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}>
                      <Text style={[styles.statChipCount, { color: cfg.color }]}>{count}</Text>
                      <Text style={[styles.statChipLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  );
                })}
            </View>

            {/* ── Empty State ── */}
            {filteredUsers.length === 0 && !error && (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="people" size={42} color={G.p400} />
                </View>
                <Text style={styles.emptyTitle}>{searchQuery ? 'No matching members' : 'No team members found'}</Text>
                <Text style={styles.emptySubtitle}>{searchQuery ? `No members match "${searchQuery}"` : 'Add your first team member to get started.'}</Text>
              </View>
            )}
          </>
        }
        renderItem={renderUser}
      />

      {/* ── Add User Modal (Liquid Glass) ── */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setShowAddModal(false); setShowRolePicker(false); }}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
              <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.8)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add New User</Text>

              <Text style={styles.modalLabel}>Username <Text style={{ color: G.red }}>*</Text></Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter username"
                placeholderTextColor={G.txtFaint}
                value={newUser.username}
                onChangeText={v => setNewUser(u => ({ ...u, username: v }))}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={G.p600}
              />

              <Text style={styles.modalLabel}>Password <Text style={{ color: G.red }}>*</Text></Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter password"
                placeholderTextColor={G.txtFaint}
                value={newUser.password}
                onChangeText={v => setNewUser(u => ({ ...u, password: v }))}
                secureTextEntry
                selectionColor={G.p600}
              />

              <Text style={styles.modalLabel}>Email <Text style={{ color: G.txtFaint, fontWeight: '700' }}>(opt)</Text></Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter email address"
                placeholderTextColor={G.txtFaint}
                value={newUser.email}
                onChangeText={v => setNewUser(u => ({ ...u, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
                selectionColor={G.p600}
              />

              <Text style={styles.modalLabel}>Role</Text>
              <TouchableOpacity
                style={[styles.rolePickerBtn, showRolePicker && { borderColor: G.p600, backgroundColor: G.white }]}
                onPress={() => setShowRolePicker(p => !p)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.roleDot, { backgroundColor: ROLE_CONFIG[newUser.role]?.color || G.p600 }]} />
                  <Text style={styles.rolePickerText}>{ROLE_CONFIG[newUser.role]?.label || 'Employee'}</Text>
                </View>
                <Ionicons name={showRolePicker ? 'chevron-up' : 'chevron-down'} size={20} color={G.txtFaint} />
              </TouchableOpacity>

              {showRolePicker && (
                <View style={styles.inlineRolePicker}>
                  {ASSIGNABLE_ROLES.map(r => {
                    const cfg = ROLE_CONFIG[r];
                    const active = newUser.role === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[styles.roleOption, active && styles.roleOptionActive]}
                        onPress={() => { setNewUser(u => ({ ...u, role: r })); setShowRolePicker(false); }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.roleDot, { backgroundColor: cfg.color }]} />
                        <Text style={[styles.roleOptionText, active && { color: G.p800 }]}>{cfg.label}</Text>
                        {active && <Ionicons name="checkmark-circle" size={22} color={G.p700} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddModal(false); setNewUser({ username: '', password: '', role: 'employee', email: '' }); setShowRolePicker(false); }} activeOpacity={0.8}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmBtn, isCreating && { opacity: 0.6 }]} onPress={handleCreateUser} disabled={isCreating} activeOpacity={0.8}>
                  {isCreating ? <ActivityIndicator size="small" color={G.white} /> : <Text style={styles.confirmBtnText}>Create User</Text>}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
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
  addBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.p700, alignItems: 'center', justifyContent: 'center',
    ...liquidShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25,
  },

  // ── List & Content
  listContent: { paddingHorizontal: GUTTER, paddingTop: 16 },

  // ── Search & Filters
  searchSection: { paddingBottom: 14 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', height: 48,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    borderWidth: 2, borderColor: G.p200,
    paddingHorizontal: 14, gap: 10,
  },
  searchBoxActive: { borderColor: G.p600, backgroundColor: G.white, shadowColor: G.p900, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '800', color: G.txtMain },

  filterScroll: { flexGrow: 0, marginBottom: 12 },
  filterContent: { gap: 10, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 2, borderColor: G.p200,
  },
  filterChipActive: { backgroundColor: G.p700, borderColor: G.p900 },
  filterText: { fontSize: 13, fontWeight: '900', color: G.txtFaint, letterSpacing: 0.2 },
  filterTextActive: { color: G.white },

  statsSummary: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  statChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5, gap: 6 },
  statChipCount: { fontSize: 14, fontWeight: '900' },
  statChipLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Errors & Empty
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: G.redBg, borderRadius: 16, padding: 14, gap: 10, borderWidth: 2, borderColor: '#FCA5A5', marginBottom: 16 },
  errorText: { flex: 1, fontSize: 14, color: G.red, fontWeight: '800' },
  retryText: { fontSize: 14, color: G.red, fontWeight: '900' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, marginTop: 40 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: G.p100, borderWidth: 2, borderColor: G.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...liquidShadow, shadowOpacity: 0.1 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, marginBottom: 8, letterSpacing: -0.5 },
  emptySubtitle: { fontSize: 14, color: G.txtFaint, textAlign: 'center', fontWeight: '700', lineHeight: 22 },

  // ── User Cards (Bento Box)
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  cardPadding: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },

  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.2 },
  avatarText: { fontSize: 18, fontWeight: '900', color: G.white },
  
  userInfo: { flex: 1, justifyContent: 'center' },
  userName: { fontSize: 16, fontWeight: '900', color: G.txtMain, letterSpacing: -0.2, marginBottom: 2 },
  userEmail: { fontSize: 12, color: G.txtFaint, fontWeight: '700', marginBottom: 4 },
  deptRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userDept: { fontSize: 11, color: G.txtFaint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  userRight: { alignItems: 'flex-end', gap: 8 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5 },
  roleBadgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  viewPerfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: G.p100, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: G.p200 },
  viewPerfText: { fontSize: 11, fontWeight: '900', color: G.p700 },

  // ── Add User Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', overflow: 'hidden', shadowColor: G.p900, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20 },
  modalHandle: { width: 48, height: 6, borderRadius: 3, backgroundColor: G.p200, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: G.txtMain, marginBottom: 24, letterSpacing: -0.5 },
  
  modalLabel: { fontSize: 12, fontWeight: '900', color: G.txtMain, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontWeight: '800', color: G.txtMain,
    borderWidth: 2, borderColor: G.p200, marginBottom: 20,
  },

  rolePickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    borderWidth: 2, borderColor: G.p200, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 6,
  },
  rolePickerText: { fontSize: 15, color: G.txtMain, fontWeight: '900' },
  inlineRolePicker: {
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 16,
    borderWidth: 2, borderColor: G.p200, overflow: 'hidden', marginBottom: 20,
  },
  roleOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.04)' },
  roleOptionActive: { backgroundColor: G.p100 },
  roleOptionText: { flex: 1, fontSize: 15, color: G.txtMain, fontWeight: '800' },
  roleDot: { width: 14, height: 14, borderRadius: 7 },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: { flex: 1, backgroundColor: G.white, borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderColor: G.p200 },
  cancelBtnText: { fontSize: 15, fontWeight: '900', color: G.txtFaint },
  confirmBtn: { flex: 1, backgroundColor: G.p700, borderRadius: 16, paddingVertical: 16, alignItems: 'center', ...liquidShadow },
  confirmBtnText: { fontSize: 15, fontWeight: '900', color: G.white, letterSpacing: 0.5 },
});