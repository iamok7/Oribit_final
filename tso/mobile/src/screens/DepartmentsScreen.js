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
  Keyboard,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import {
  getDepartments, createDepartment, deleteDepartment,
  getProjects, createProject,
  getUsers,
  assignDepartmentMembers, removeDepartmentMember,
} from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const GUTTER = 16;
const GAP = 14;

// ─── Palette ─────────────────────────────────────────────────────────────────
const G = {
  bgLight:  '#F0F6FF',
  bgMid:    '#E0F2FE',
  bgDark:   '#F8FAFC',
  txtMain:  '#020617',
  txtMuted: '#1E293B',
  txtFaint: '#475569',
  p100: '#DBEAFE', p200: '#BFDBFE', p300: '#93C5FD',
  p400: '#60A5FA', p500: '#3B82F6', p600: '#2563EB',
  p700: '#1D4ED8', p800: '#1E40AF', p900: '#1E3A8A',
  white: '#FFFFFF',
  amber: '#D97706', amberBg: '#FEF3C7',
  green: '#059669', greenBg: '#D1FAE5',
  red:   '#DC2626', redBg:   '#FEE2E2',
  purple: '#7C3AED', purpleBg: '#EDE9FE',
  pink: '#DB2777', teal: '#0D9488',
};

const liquidShadow = {
  shadowColor: G.p900, shadowOpacity: 0.12,
  shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
};

const ROLE_CONFIG = {
  manager:    { label: 'Manager',    color: G.purple, bg: G.purpleBg },
  supervisor: { label: 'Supervisor', color: G.amber,  bg: G.amberBg },
  employee:   { label: 'Employee',   color: G.green,  bg: G.greenBg },
  finance:    { label: 'Finance',    color: G.p700,   bg: G.p100 },
};

const DEPT_PALETTE = [G.purple, G.amber, G.green, G.p600, G.pink, G.teal, G.red];
const getDeptColor  = (name) => DEPT_PALETTE[(name || '').charCodeAt(0) % DEPT_PALETTE.length];
const getInitials   = (name) => (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
const getAvatarColor = (name) => DEPT_PALETTE[(name || '').charCodeAt(0) % DEPT_PALETTE.length];

// ─── Simple Input Modal (shared for Create Dept / Create Project) ─────────────
function SimpleInputModal({ visible, title, placeholder, value, onChange, isLoading, onCancel, onConfirm, confirmLabel, insets }) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <TouchableOpacity
        style={[StyleSheet.absoluteFill, styles.modalBackdrop]}
        activeOpacity={1}
        onPress={() => { Keyboard.dismiss(); onCancel(); }}
      />
      <BlurView intensity={18} tint="dark" style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} />
      <KeyboardAvoidingView
        style={styles.modalKAV}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <BlurView intensity={95} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.97)', 'rgba(240,249,255,0.88)']} style={StyleSheet.absoluteFill} />
          <View style={styles.glassHighlight} />
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            style={styles.modalInput}
            placeholder={placeholder}
            placeholderTextColor={G.txtFaint}
            value={value}
            onChangeText={onChange}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => { Keyboard.dismiss(); onConfirm(); }}
            selectionColor={G.p600}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { Keyboard.dismiss(); onCancel(); }} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, isLoading && { opacity: 0.6 }]}
              onPress={() => { Keyboard.dismiss(); onConfirm(); }}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading
                ? <ActivityIndicator size="small" color={G.white} />
                : <Text style={styles.confirmBtnText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DepartmentsScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const viewerRole = user?.role || 'employee';
  const canManage    = viewerRole === 'manager';
  const canAddProject = viewerRole === 'manager' || viewerRole === 'supervisor';

  // ── Core data
  const [departments,    setDepartments]    = useState([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isRefreshing,   setIsRefreshing]   = useState(false);
  const [error,          setError]          = useState(null);
  const [expandedDept,   setExpandedDept]   = useState(null);
  const [projectsByDept, setProjectsByDept] = useState({});
  const [loadingProjects,setLoadingProjects]= useState({});

  // ── Users (lazy-loaded when a picker modal opens)
  const [allUsers,     setAllUsers]     = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // ── Create Department modal
  const [showCreateDept,  setShowCreateDept]  = useState(false);
  const [newDeptName,     setNewDeptName]     = useState('');
  const [isCreatingDept,  setIsCreatingDept]  = useState(false);

  // ── Create Project modal (stores dept id)
  const [showCreateProject, setShowCreateProject] = useState(null);
  const [newProjName,       setNewProjName]        = useState('');
  const [isCreatingProj,    setIsCreatingProj]     = useState(false);

  // ── Add Members to Department modal
  const [showAddMembers,  setShowAddMembers]  = useState(null); // dept object
  const [selSupervisor,   setSelSupervisor]   = useState(null); // user id
  const [selEmployees,    setSelEmployees]    = useState(new Set());
  const [isSavingMembers, setIsSavingMembers] = useState(false);


  // ── Fetch departments
  const fetchDepartments = useCallback(async () => {
    try {
      setError(null);
      const data = await getDepartments();
      const list = Array.isArray(data) ? data : data?.departments || [];
      setDepartments(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const onRefresh = () => { setIsRefreshing(true); fetchDepartments(); };

  // ── Fetch projects for a department
  const fetchProjects = async (deptId) => {
    setLoadingProjects(prev => ({ ...prev, [deptId]: true }));
    try {
      const data = await getProjects(deptId);
      const list = Array.isArray(data) ? data : data?.projects || [];
      setProjectsByDept(prev => ({ ...prev, [deptId]: list }));
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoadingProjects(prev => ({ ...prev, [deptId]: false }));
    }
  };

  const toggleDept = (deptId) => {
    if (expandedDept === deptId) {
      setExpandedDept(null);
    } else {
      setExpandedDept(deptId);
      if (!projectsByDept[deptId]) fetchProjects(deptId);
    }
  };

  // ── Lazy-load all users
  const ensureUsers = async () => {
    if (allUsers.length > 0) return;
    setUsersLoading(true);
    try {
      const data = await getUsers();
      const list = Array.isArray(data) ? data : data?.users || [];
      setAllUsers(list.filter(u => u.is_active !== false));
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  // ── Create Department
  const handleCreateDept = async () => {
    if (!newDeptName.trim()) { Alert.alert('Error', 'Department name is required'); return; }
    setIsCreatingDept(true);
    try {
      const res  = await createDepartment(newDeptName.trim());
      const dept = res?.department || res;
      setDepartments(prev => [...prev, { ...dept, supervisor: null, employees: [] }]);
      setShowCreateDept(false);
      setNewDeptName('');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create department');
    } finally {
      setIsCreatingDept(false);
    }
  };

  // ── Delete Department
  const handleDeleteDept = (dept) => {
    Alert.alert(
      'Delete Department',
      `Delete "${dept.name}"? All its projects and tasks will also be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteDepartment(dept.id);
              setDepartments(prev => prev.filter(d => d.id !== dept.id));
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete department');
            }
          },
        },
      ]
    );
  };

  // ── Create Project
  const handleCreateProject = async () => {
    if (!newProjName.trim() || !showCreateProject) return;
    setIsCreatingProj(true);
    try {
      const res  = await createProject(showCreateProject, newProjName.trim());
      const proj = res?.project || res;
      setProjectsByDept(prev => ({
        ...prev,
        [showCreateProject]: [...(prev[showCreateProject] || []), { ...proj, lead: null, members: [] }],
      }));
      setShowCreateProject(null);
      setNewProjName('');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create project');
    } finally {
      setIsCreatingProj(false);
    }
  };

  // ── Open Add Members modal
  const openAddMembers = async (dept) => {
    setShowAddMembers(dept);
    setSelSupervisor(dept.supervisor?.id ?? null);
    setSelEmployees(new Set((dept.employees || []).map(e => e.id)));
    await ensureUsers();
  };

  // ── Save Department Members
  const handleSaveMembers = async () => {
    if (!showAddMembers) return;
    setIsSavingMembers(true);
    try {
      await assignDepartmentMembers(showAddMembers.id, {
        supervisor_id: selSupervisor,
        employee_ids: [...selEmployees],
      });
      await fetchDepartments();
      setShowAddMembers(null);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update members');
    } finally {
      setIsSavingMembers(false);
    }
  };

  // ── Remove a member from department
  const handleRemoveDeptMember = (dept, memberId) => {
    Alert.alert('Remove Member', 'Remove this member from the department?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await removeDepartmentMember(dept.id, memberId);
            setDepartments(prev => prev.map(d => {
              if (d.id !== dept.id) return d;
              return {
                ...d,
                supervisor: d.supervisor?.id === memberId ? null : d.supervisor,
                employees:  (d.employees || []).filter(e => e.id !== memberId),
              };
            }));
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to remove member');
          }
        },
      },
    ]);
  };


  // ── Render a single project row inside expanded dept
  const renderProject = (proj, dept, color) => (
    <TouchableOpacity
      key={proj.id}
      style={styles.projCard}
      onPress={() => navigation.navigate('TeamDashboard', { proj, deptColor: color, deptName: dept.name })}
      activeOpacity={0.82}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.75)', 'rgba(255,255,255,0.3)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.projAccent, { backgroundColor: color }]} />
      <View style={styles.projContent}>
        <View style={{ flex: 1 }}>
          <Text style={styles.projName} numberOfLines={1}>{proj.name}</Text>
          <Text style={styles.projMeta} numberOfLines={1}>
            {proj.lead ? `Lead: ${proj.lead.username}` : 'No lead'}
            {'  •  '}
            {proj.members?.length || 0} member{proj.members?.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.projChevron}>
          <Ionicons name="chevron-forward" size={16} color={G.p700} />
        </View>
      </View>
    </TouchableOpacity>
  );

  // ── Render a member row inside expanded dept
  const renderMemberRow = (member, role, dept) => (
    <View key={member.id} style={styles.memberRow}>
      <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.username) }]}>
        <Text style={styles.memberAvatarText}>{getInitials(member.username)}</Text>
      </View>
      <Text style={styles.memberName} numberOfLines={1}>{member.username}</Text>
      <View style={[
        styles.rolePill,
        { backgroundColor: ROLE_CONFIG[role]?.bg, borderColor: (ROLE_CONFIG[role]?.color || G.green) + '40' }
      ]}>
        <Text style={[styles.rolePillText, { color: ROLE_CONFIG[role]?.color || G.green }]}>
          {ROLE_CONFIG[role]?.label || 'Member'}
        </Text>
      </View>
      {canManage && (
        <TouchableOpacity
          onPress={() => handleRemoveDeptMember(dept, member.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={20} color={G.txtFaint} />
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Render department card
  const renderDepartment = ({ item: dept }) => {
    const color        = getDeptColor(dept.name);
    const isExpanded   = expandedDept === dept.id;
    const deptProjects = projectsByDept[dept.id] || [];
    const isLoadingProj = loadingProjects[dept.id];
    const totalMembers  = (dept.supervisor ? 1 : 0) + (dept.employees?.length || 0);

    return (
      <View style={[styles.deptWrap, { marginBottom: GAP }]}>
        <View style={styles.deptGlass}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.5)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.glassHighlight} />

          {/* Header row */}
          <TouchableOpacity style={styles.deptHeader} onPress={() => toggleDept(dept.id)} activeOpacity={0.8}>
            <View style={[styles.deptIcon, { backgroundColor: color + '22' }]}>
              <Text style={[styles.deptInitials, { color }]}>{getInitials(dept.name)}</Text>
            </View>
            <View style={styles.deptInfo}>
              <Text style={styles.deptName}>{dept.name}</Text>
              <Text style={styles.deptMeta}>
                {totalMembers} member{totalMembers !== 1 ? 's' : ''}
                {isExpanded && deptProjects.length > 0 ? `  •  ${deptProjects.length} project${deptProjects.length !== 1 ? 's' : ''}` : ''}
              </Text>
            </View>
            <View style={styles.deptActions}>
              <TouchableOpacity
                style={styles.dashIconBtn}
                onPress={() => navigation.navigate('DepartmentDashboard', { dept, deptColor: color })}
                activeOpacity={0.7}
              >
                <Ionicons name="bar-chart-outline" size={14} color={G.p700} />
              </TouchableOpacity>
              {canManage && (
                <TouchableOpacity
                  style={styles.deleteIconBtn}
                  onPress={() => handleDeleteDept(dept)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={14} color={G.red} />
                </TouchableOpacity>
              )}
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={G.txtFaint} />
            </View>
          </TouchableOpacity>

          {/* Color accent bar */}
          <View style={[styles.colorBar, { backgroundColor: color }]} />

          {/* Expanded body */}
          {isExpanded && (
            <View style={styles.expandedBody}>
              {/* ─── Members Section ─── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Members</Text>
                {canManage && (
                  <TouchableOpacity style={styles.actionChip} onPress={() => openAddMembers(dept)} activeOpacity={0.8}>
                    <Ionicons name="person-add" size={12} color={G.p700} />
                    <Text style={styles.actionChipText}>Manage</Text>
                  </TouchableOpacity>
                )}
              </View>

              {totalMembers === 0 ? (
                <Text style={styles.emptyInlineText}>No members assigned yet</Text>
              ) : (
                <>
                  {dept.supervisor && renderMemberRow(dept.supervisor, 'supervisor', dept)}
                  {(dept.employees || []).map(emp => renderMemberRow(emp, 'employee', dept))}
                </>
              )}

              {/* ─── Projects Section ─── */}
              <View style={[styles.sectionHeader, { marginTop: 18 }]}>
                <Text style={styles.sectionLabel}>Projects</Text>
                {canAddProject && (
                  <TouchableOpacity
                    style={styles.actionChip}
                    onPress={() => { setShowCreateProject(dept.id); setNewProjName(''); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={13} color={G.p700} />
                    <Text style={styles.actionChipText}>New Project</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isLoadingProj ? (
                <ActivityIndicator size="small" color={G.p700} style={{ marginVertical: 14 }} />
              ) : deptProjects.length === 0 ? (
                <Text style={styles.emptyInlineText}>No projects yet</Text>
              ) : (
                deptProjects.map(proj => renderProject(proj, dept, color))
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) return <LoadingSpinner fullScreen message="Loading departments..." />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />

      {/* Background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.p300 }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -60, backgroundColor: '#A5F3FC', transform: [{ scale: 1.2 }] }]} />
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Departments</Text>
            <Text style={styles.headerSubtitle}>{departments.length} departments</Text>
          </View>
          {canManage ? (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setShowCreateDept(true); setNewDeptName(''); }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={22} color={G.white} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={G.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchDepartments}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      <FlatList
        data={departments}
        keyExtractor={item => String(item.id)}
        renderItem={renderDepartment}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={G.p700} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="business" size={42} color={G.p400} />
            </View>
            <Text style={styles.emptyTitle}>No departments yet</Text>
            <Text style={styles.emptySubtitle}>Create your first department to get started.</Text>
            {canManage && (
              <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowCreateDept(true)} activeOpacity={0.85}>
                <Ionicons name="add" size={16} color={G.white} />
                <Text style={styles.emptyAddBtnText}>Add Department</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* ── Modal: Create Department ── */}
      <SimpleInputModal
        visible={showCreateDept}
        title="New Department"
        placeholder="Department name"
        value={newDeptName}
        onChange={setNewDeptName}
        isLoading={isCreatingDept}
        onCancel={() => { setShowCreateDept(false); setNewDeptName(''); }}
        onConfirm={handleCreateDept}
        confirmLabel="Create"
        insets={insets}
      />

      {/* ── Modal: Create Project ── */}
      <SimpleInputModal
        visible={!!showCreateProject}
        title="New Project"
        placeholder="Project name"
        value={newProjName}
        onChange={setNewProjName}
        isLoading={isCreatingProj}
        onCancel={() => { setShowCreateProject(null); setNewProjName(''); }}
        onConfirm={handleCreateProject}
        confirmLabel="Create"
        insets={insets}
      />

      {/* ── Modal: Add / Manage Department Members ── */}
      <Modal
        visible={!!showAddMembers}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowAddMembers(null)}
      >
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, styles.modalBackdrop]}
          activeOpacity={1}
          onPress={() => setShowAddMembers(null)}
        />
        <BlurView intensity={18} tint="dark" style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} />
        <KeyboardAvoidingView style={styles.modalKAV} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalSheet, styles.modalSheetTall, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <BlurView intensity={95} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.97)', 'rgba(240,249,255,0.88)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle} numberOfLines={1}>
              {showAddMembers ? `Members — ${showAddMembers.name}` : 'Manage Members'}
            </Text>

            {usersLoading ? (
              <ActivityIndicator size="large" color={G.p700} style={{ marginVertical: 50 }} />
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.pickerScroll}
              >
                {/* ── Supervisor picker (radio, one) */}
                <Text style={styles.pickerGroupLabel}>
                  Supervisor{'  '}
                  <Text style={styles.pickerHint}>pick one</Text>
                </Text>
                {allUsers.filter(u => u.role === 'supervisor').length === 0 && (
                  <Text style={styles.emptyInlineText}>No supervisors found</Text>
                )}
                {allUsers.filter(u => u.role === 'supervisor').map(u => {
                  const active = selSupervisor === u.id;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.userPickRow, active && styles.userPickRowActive]}
                      onPress={() => setSelSupervisor(active ? null : u.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.pickAvatar, { backgroundColor: getAvatarColor(u.username) }]}>
                        <Text style={styles.pickAvatarText}>{getInitials(u.username)}</Text>
                      </View>
                      <Text style={[styles.userPickName, active && styles.userPickNameActive]} numberOfLines={1}>
                        {u.username}
                      </Text>
                      {u.department_id && u.department_id !== showAddMembers?.id && (
                        <Text style={styles.inDeptBadge}>Other dept</Text>
                      )}
                      <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                        {active && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* ── Employee picker (checkbox, multi) */}
                <Text style={[styles.pickerGroupLabel, { marginTop: 20 }]}>
                  Employees{'  '}
                  <Text style={styles.pickerHint}>pick multiple</Text>
                </Text>
                {allUsers.filter(u => u.role === 'employee').length === 0 && (
                  <Text style={styles.emptyInlineText}>No employees found</Text>
                )}
                {allUsers.filter(u => u.role === 'employee').map(u => {
                  const active = selEmployees.has(u.id);
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.userPickRow, active && styles.userPickRowActive]}
                      onPress={() => setSelEmployees(prev => {
                        const next = new Set(prev);
                        if (next.has(u.id)) next.delete(u.id); else next.add(u.id);
                        return next;
                      })}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.pickAvatar, { backgroundColor: getAvatarColor(u.username) }]}>
                        <Text style={styles.pickAvatarText}>{getInitials(u.username)}</Text>
                      </View>
                      <Text style={[styles.userPickName, active && styles.userPickNameActive]} numberOfLines={1}>
                        {u.username}
                      </Text>
                      {u.department_id && u.department_id !== showAddMembers?.id && (
                        <Text style={styles.inDeptBadge}>Other dept</Text>
                      )}
                      <View style={[styles.checkBox, active && styles.checkBoxActive]}>
                        {active && <Ionicons name="checkmark" size={14} color={G.white} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddMembers(null)} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, isSavingMembers && { opacity: 0.6 }]}
                onPress={handleSaveMembers}
                disabled={isSavingMembers}
                activeOpacity={0.8}
              >
                {isSavingMembers
                  ? <ActivityIndicator size="small" color={G.white} />
                  : <Text style={styles.confirmBtnText}>Save Members</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },

  ambientOrb: {
    position: 'absolute', width: 350, height: 350, borderRadius: 175,
    opacity: 0.4, filter: [{ blur: 50 }],
  },

  // ── Header
  header: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,255,255,0.9)',
    ...liquidShadow, zIndex: 10,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GUTTER, paddingBottom: 15,
  },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  headerTitle:  { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
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

  // ── List
  listContent: { paddingHorizontal: GUTTER, paddingTop: 16 },

  // ── Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: G.redBg, borderRadius: 16, padding: 14,
    margin: 16, borderWidth: 2, borderColor: '#FCA5A5',
  },
  errorText:  { flex: 1, fontSize: 14, color: G.red, fontWeight: '800' },
  retryText:  { fontSize: 14, color: G.red, fontWeight: '900' },

  // ── Empty
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, marginTop: 60 },
  emptyIconWrap:  { width: 96, height: 96, borderRadius: 48, backgroundColor: G.p100, borderWidth: 2, borderColor: G.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...liquidShadow, shadowOpacity: 0.1 },
  emptyTitle:     { fontSize: 20, fontWeight: '900', color: G.txtMain, marginBottom: 8, letterSpacing: -0.5 },
  emptySubtitle:  { fontSize: 14, color: G.txtFaint, textAlign: 'center', fontWeight: '700', lineHeight: 22 },
  emptyAddBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: G.p700, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 12, marginTop: 20, ...liquidShadow },
  emptyAddBtnText:{ fontSize: 14, fontWeight: '900', color: G.white },

  // ── Department card
  deptWrap: { ...liquidShadow },
  deptGlass: {
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
  },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },

  deptHeader:  { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  deptIcon:    { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  deptInitials:{ fontSize: 18, fontWeight: '900' },
  deptInfo:    { flex: 1 },
  deptName:    { fontSize: 17, fontWeight: '900', color: G.txtMain, letterSpacing: -0.3 },
  deptMeta:    { fontSize: 12, color: G.txtFaint, fontWeight: '700', marginTop: 2 },
  deptActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dashIconBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: G.p100, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: G.p300,
  },
  deleteIconBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: G.redBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FCA5A5',
  },
  colorBar: { height: 3, marginHorizontal: 16, borderRadius: 2, marginBottom: 4 },

  // ── Expanded body
  expandedBody: { paddingHorizontal: 16, paddingBottom: 18, paddingTop: 8 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel:  { fontSize: 11, fontWeight: '900', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 0.8 },

  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: G.p100, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1.5, borderColor: G.p200,
  },
  actionChipText: { fontSize: 11, fontWeight: '900', color: G.p700 },

  emptyInlineText: { fontSize: 13, color: G.txtFaint, fontStyle: 'italic', fontWeight: '700', paddingBottom: 6 },

  // ── Member row
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  memberAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 12, fontWeight: '900', color: G.white },
  memberName: { flex: 1, fontSize: 14, fontWeight: '800', color: G.txtMain },

  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1.5 },
  rolePillText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },

  // ── Project card
  projCard: {
    borderRadius: 14, overflow: 'hidden', marginBottom: 8,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: G.p900, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  projAccent:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  projContent: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingLeft: 16, gap: 10 },
  projName:    { fontSize: 14, fontWeight: '900', color: G.txtMain, letterSpacing: -0.2 },
  projMeta:    { fontSize: 11, color: G.txtFaint, fontWeight: '700', marginTop: 2 },
  projChevron: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: G.p100, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: G.p200,
  },

  // ── Modals (shared)
  modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  modalKAV:      { position: 'absolute', bottom: 0, left: 0, right: 0 },
  modalSheet: {
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: G.p900, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20,
  },
  modalSheetTall: { maxHeight: '85%' },
  modalHandle: { width: 48, height: 6, borderRadius: 3, backgroundColor: G.p200, alignSelf: 'center', marginBottom: 20 },
  modalTitle:  { fontSize: 22, fontWeight: '900', color: G.txtMain, marginBottom: 20, letterSpacing: -0.5 },

  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontWeight: '800', color: G.txtMain,
    borderWidth: 2, borderColor: G.p200, marginBottom: 20,
  },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  cancelBtn: {
    flex: 1, backgroundColor: G.white, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderColor: G.p200,
  },
  cancelBtnText:  { fontSize: 15, fontWeight: '900', color: G.txtFaint },
  confirmBtn: { flex: 1, backgroundColor: G.p700, borderRadius: 16, paddingVertical: 16, alignItems: 'center', ...liquidShadow },
  confirmBtnText: { fontSize: 15, fontWeight: '900', color: G.white },

  // ── User pickers inside modals
  pickerScroll: { maxHeight: 400 },
  pickerGroupLabel: { fontSize: 11, fontWeight: '900', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  pickerHint: { fontSize: 10, fontWeight: '700', color: G.p500, textTransform: 'lowercase', letterSpacing: 0 },

  userPickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)',
  },
  userPickRowActive: { backgroundColor: G.p100, borderColor: G.p300 },

  pickAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pickAvatarText: { fontSize: 13, fontWeight: '900', color: G.white },

  userPickName:       { flex: 1, fontSize: 14, fontWeight: '800', color: G.txtMuted },
  userPickNameActive: { color: G.p800 },

  inDeptBadge: {
    fontSize: 10, fontWeight: '900', color: G.amber,
    backgroundColor: G.amberBg, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1, borderColor: G.amber + '40',
  },

  radioCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: G.p300,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioCircleActive: { borderColor: G.p700, backgroundColor: G.p700 },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: G.white },

  checkBox: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 2, borderColor: G.p300,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkBoxActive: { borderColor: G.p700, backgroundColor: G.p700 },
});
