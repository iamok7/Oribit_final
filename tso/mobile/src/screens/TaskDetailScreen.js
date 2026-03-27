import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
  Modal,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { updateTask, deleteTask, addComment, getTaskDetails, createSubtask, updateSubtask } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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
  
  green:    '#059669',
  greenBg:  '#D1FAE5',
  amber:    '#D97706',
  amberBg:  '#FEF3C7',
  red:      '#DC2626',
  redBg:    '#FEE2E2',
  purple:   '#7C3AED',
  purpleBg: '#EDE9FE',
};

// Deep, fluid shadow for glass cards
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.15,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
};

// ─── Configurations ──────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  in_progress: { label: 'In Progress', color: G.p600,  bg: G.p100,    border: G.p300,    icon: 'play-circle' },
  completed:   { label: 'Completed',   color: G.green, bg: G.greenBg, border: '#A7F3D0', icon: 'checkmark-circle' },
  on_hold:     { label: 'On Hold',     color: G.amber, bg: G.amberBg, border: '#FDE68A', icon: 'pause-circle' },
  past_due:    { label: 'Past Due',    color: G.red,   bg: G.redBg,   border: '#FECACA', icon: 'alert-circle' },
  todo:        { label: 'To Do',       color: G.p800,  bg: G.p200,    border: G.p400,    icon: 'ellipse-outline' },
  to_do:       { label: 'To Do',       color: G.p800,  bg: G.p200,    border: G.p400,    icon: 'ellipse-outline' },
};

const getStatusCfg = (status) => {
  const key = (status || '').toLowerCase().replace(/\s+/g, '_');
  return STATUS_CONFIG[key] || { label: status || 'Unknown', color: G.txtFaint, bg: G.p100, border: G.p200, icon: 'help-circle' };
};

const STATUS_TO_BACKEND = {
  todo:        'To Do',
  in_progress: 'In Progress',
  completed:   'Completed',
  on_hold:     'On Hold',
};

const PRIORITY_CONFIG = {
  high:   { label: 'High',   color: G.red,   bg: G.redBg,   border: '#FECACA', icon: 'arrow-up-circle' },
  medium: { label: 'Medium', color: G.amber, bg: G.amberBg, border: '#FDE68A', icon: 'remove-circle' },
  low:    { label: 'Low',    color: G.green, bg: G.greenBg, border: '#A7F3D0', icon: 'arrow-down-circle' },
};

const ALLOWED_TRANSITIONS = {
  manager:    ['todo', 'in_progress', 'completed', 'on_hold'],
  supervisor: ['todo', 'in_progress', 'completed', 'on_hold'],
  employee:   ['in_progress', 'completed', 'on_hold', 'todo'],
  finance:    [],
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function TaskDetailScreen({ route, navigation }) {
  const { task: initialTask } = route.params || {};
  const { user, isManager, isSupervisor, isEmployee, isFinance } = useAuth();
  const insets = useSafeAreaInsets();
  const { addNotification, markTaskSeen } = useNotifications();

  const [task, setTask]                   = useState(initialTask);
  const [isUpdating, setIsUpdating]       = useState(false);
  const [subtasks, setSubtasks]           = useState(initialTask?.subtasks || []);
  const [newComment, setNewComment]       = useState('');
  const [comments, setComments]           = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [commentImage, setCommentImage]   = useState(null);
  const [lightboxUri, setLightboxUri]     = useState(null);

  const taskIdRef = useRef(initialTask?.id);
  const scrollRef = useRef(null);

  const loadDetails = useCallback(async () => {
    const tid = taskIdRef.current;
    if (!tid) return;
    try {
      setCommentsLoading(true);
      const data = await getTaskDetails(tid);
      if (data?.task) setTask(prev => ({ ...prev, ...data.task }));
      if (Array.isArray(data?.subtasks)) setSubtasks(data.subtasks);
      if (Array.isArray(data?.comments)) setComments(data.comments);
    } catch {
      // fallback
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialTask?.id) {
      markTaskSeen(initialTask.id);
      loadDetails();
    }
  }, []);

  useFocusEffect(useCallback(() => { loadDetails(); }, [loadDetails]));

  if (!task) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Detail</Text>
        </View>
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle" size={56} color={G.red} />
          <Text style={styles.errorText}>Task not found</Text>
        </View>
      </View>
    );
  }

  const statusCfg = getStatusCfg(task.status);
  const assignedId = task.assigned_to?.id ?? task.assigned_to;
  const isAssignedToMe = String(assignedId) === String(user?.id);

  const canEdit = isManager() || isSupervisor() || isAssignedToMe;
  const canAddSubtask = isManager() || isSupervisor() || isAssignedToMe;
  const canDelete = isManager() || isSupervisor();
  const canChangeStatus = !isFinance() && (isManager() || isSupervisor() || isAssignedToMe);

  const allowedTransitions = ALLOWED_TRANSITIONS[user?.role] ?? [];
  const deadline  = task.deadline || task.due_date;
  const deadlineStr = deadline
    ? new Date(deadline).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    : 'No deadline set';

  const isOverdue = deadline && new Date(deadline) < new Date() && !/complet|done/i.test(task.status || '');
  const completedSubtasks = subtasks.filter((s) => s.completed || s.is_completed).length;
  const progress = subtasks.length > 0 ? completedSubtasks / subtasks.length : 0;

  // ── Handlers ──
  const handleStatusChange = async (statusKey) => {
    const backendStatus = STATUS_TO_BACKEND[statusKey];
    if (!backendStatus) return;
    if ((task.status || '').toLowerCase().replace(/\s+/g, '_') === statusKey) return;
    try {
      setIsUpdating(true);
      await updateTask(task.id, { status: backendStatus });
      setTask((prev) => ({ ...prev, status: backendStatus }));
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Could not update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await deleteTask(task.id);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Delete Failed', err.message || 'Could not delete this task');
            }
          },
      },
    ]);
  };

  const toggleSubtask = async (idx) => {
    const st = subtasks[idx];
    const newVal = !(st.completed || st.is_completed);
    setSubtasks(subtasks.map((s, i) => i === idx ? { ...s, completed: newVal, is_completed: newVal } : s));
    try {
      if (st.id) await updateSubtask(st.id, { is_completed: newVal });
    } catch {
      setSubtasks(subtasks.map((s, i) => i === idx ? { ...s, completed: !newVal, is_completed: !newVal } : s));
    }
  };

  const handleAddSubtask = async () => {
    const title = newSubtaskText.trim();
    if (!title) return;
    setIsAddingSubtask(true);
    try {
      await createSubtask(task.id, title);
      setNewSubtaskText('');
      await loadDetails();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to add subtask');
    } finally {
      setIsAddingSubtask(false);
    }
  };

  const pickCommentImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to attach images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        base64: true,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setCommentImage({ uri: asset.uri, base64: `data:image/jpeg;base64,${asset.base64}` });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open image picker');
    }
  };

  const handleAddComment = async () => {
    const text = newComment.trim();
    if (!text && !commentImage) return;
    setIsSendingComment(true);
    try {
      await addComment(task.id, text || null, commentImage?.base64 || null);
      const newEntry = {
        id: Date.now(),
        content: text,
        image_attachment: commentImage?.base64 || null,
        user: { id: user?.id, username: user?.username || 'You', role: user?.role },
        created_at: new Date().toISOString(),
      };
      setComments((prev) => [...prev, newEntry]);
      setNewComment('');
      setCommentImage(null);
      addNotification(task.id, task.title, text || '📷 Image', user?.username || 'Unknown', user?.role || '');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to post comment');
    } finally {
      setIsSendingComment(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* ── Stable Background (Outside KeyboardAvoidingView) ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -80, backgroundColor: G.p300 }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -80, backgroundColor: '#A5F3FC', transform: [{ scale: 1.2 }] }]} />
      </View>

      <KeyboardAvoidingView
        style={[styles.flex1, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Solid Header ── */}
        <View style={[styles.header, { paddingTop: insets.top > 0 ? 10 : 20 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>Task Detail</Text>
            <View style={[styles.headerStatusDot, { backgroundColor: statusCfg.color }]} />
          </View>

          {(canEdit || canDelete) ? (
            <View style={styles.headerRight}>
              {canEdit && (
                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AddTask', { task })} activeOpacity={0.7}>
                  <Ionicons name="pencil" size={20} color={G.p800} />
                </TouchableOpacity>
              )}
              {canDelete && (
                <TouchableOpacity style={[styles.iconBtn, styles.deleteIconBtn]} onPress={handleDelete} activeOpacity={0.7}>
                  <Ionicons name="trash" size={20} color={G.red} />
                </TouchableOpacity>
              )}
            </View>
          ) : <View style={{ width: 48 }} />}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero Card ── */}
          <View style={[styles.cardWrap, styles.shadow]}>
            <BlurView intensity={70} tint="light" style={styles.glassLayer}>
              <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
              <View style={[styles.heroAccentBar, { backgroundColor: statusCfg.color }]} />
              <View style={styles.glassHighlight} />
              
              <View style={styles.cardPadding}>
                <View style={styles.badgeRow}>
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
                    <Ionicons name={statusCfg.icon} size={14} color={statusCfg.color} />
                    <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                  </View>
                  {task.is_daily && (
                    <View style={styles.dailyBadge}>
                      <Ionicons name="sunny" size={14} color={G.amber} />
                      <Text style={styles.dailyBadgeText}>Daily</Text>
                    </View>
                  )}
                  {task.priority && (() => {
                    const pcfg = PRIORITY_CONFIG[(task.priority || '').toLowerCase()];
                    if (!pcfg) return null;
                    return (
                      <View style={[styles.priorityBadge, { backgroundColor: pcfg.bg, borderColor: pcfg.border }]}>
                        <Ionicons name={pcfg.icon} size={14} color={pcfg.color} />
                        <Text style={[styles.priorityBadgeText, { color: pcfg.color }]}>{pcfg.label}</Text>
                      </View>
                    );
                  })()}
                  {isOverdue && (
                    <View style={styles.overdueBadge}>
                      <Ionicons name="time" size={14} color={G.red} />
                      <Text style={styles.overdueBadgeText}>Overdue</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
              </View>
            </BlurView>
          </View>

          {/* ── Info Row ── */}
          <View style={styles.infoRow}>
            <View style={[styles.cardWrap, styles.shadow, styles.flex1]}>
              <BlurView intensity={70} tint="light" style={styles.glassLayer}>
                <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
                <View style={styles.glassHighlight} />
                <View style={styles.infoCardInner}>
                  <View style={[styles.infoIconWrap, { backgroundColor: G.purpleBg }]}>
                    <Ionicons name="calendar" size={20} color={G.purple} />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.infoLabel}>Deadline</Text>
                    <Text style={[styles.infoValue, isOverdue && { color: G.red }]} numberOfLines={1} adjustsFontSizeToFit>{deadlineStr}</Text>
                  </View>
                </View>
              </BlurView>
            </View>

            {task.assigned_to && (
              <View style={[styles.cardWrap, styles.shadow, styles.flex1]}>
                <BlurView intensity={70} tint="light" style={styles.glassLayer}>
                  <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
                  <View style={styles.glassHighlight} />
                  <View style={styles.infoCardInner}>
                    <View style={[styles.infoIconWrap, { backgroundColor: G.p100 }]}>
                      <Ionicons name="person" size={20} color={G.p700} />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.infoLabel}>Assignee</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>
                        {typeof task.assigned_to === 'string' ? task.assigned_to : task.assigned_to?.username || task.assigned_to?.name || 'N/A'}
                      </Text>
                    </View>
                  </View>
                </BlurView>
              </View>
            )}
          </View>

          {/* ── Status Changer ── */}
          {canChangeStatus ? (
            <View style={[styles.cardWrap, styles.shadow]}>
              <BlurView intensity={70} tint="light" style={styles.glassLayer}>
                <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
                <View style={styles.glassHighlight} />
                <View style={styles.cardPadding}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>Update Status</Text>
                    {isUpdating && <View style={styles.updatingPill}><Text style={styles.updatingText}>Saving…</Text></View>}
                  </View>
                  <View style={styles.chipGrid}>
                    {['todo', 'in_progress', 'completed', 'on_hold'].map((s) => {
                      const cfg = getStatusCfg(s);
                      const isActive = (task.status || '').toLowerCase().replace(/\s+/g, '_') === s;
                      const isAllowed = allowedTransitions.includes(s);
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.chip,
                            { backgroundColor: cfg.bg, borderColor: isActive ? cfg.color : cfg.border },
                            isActive && styles.chipActive,
                            !isAllowed && styles.chipDisabled,
                            isActive && { shadowColor: cfg.color, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }
                          ]}
                          onPress={() => isAllowed && handleStatusChange(s)}
                          disabled={isUpdating || !isAllowed}
                          activeOpacity={isAllowed ? 0.7 : 1}
                        >
                          <Ionicons name={cfg.icon} size={16} color={isAllowed ? cfg.color : G.txtFaint} />
                          <Text style={[styles.chipText, { color: isAllowed ? cfg.color : G.txtFaint }]}>{cfg.label}</Text>
                          {isActive && <Ionicons name="checkmark-circle" size={16} color={cfg.color} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {isEmployee() && !isAssignedToMe && (
                    <Text style={styles.permNote}>Only the assigned person can change this task's status.</Text>
                  )}
                </View>
              </BlurView>
            </View>
          ) : (
            <View style={[styles.cardWrap, styles.shadow]}>
              <BlurView intensity={70} tint="light" style={styles.glassLayer}>
                <LinearGradient colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.1)']} style={StyleSheet.absoluteFill} />
                <View style={styles.glassHighlight} />
                <View style={[styles.cardPadding, styles.readonlyCard]}>
                  <Ionicons name="lock-closed" size={20} color={G.txtFaint} />
                  <Text style={styles.readonlyText}>
                    {isFinance() ? 'Finance role does not manage task statuses.' : 'You are not assigned to this task.'}
                  </Text>
                </View>
              </BlurView>
            </View>
          )}

          {/* ── Priority (read-only, edit via pencil button) ── */}
          {task.priority && (() => {
            const pcfg = PRIORITY_CONFIG[(task.priority || '').toLowerCase()];
            if (!pcfg) return null;
            return (
              <View style={[styles.cardWrap, styles.shadow]}>
                <BlurView intensity={70} tint="light" style={styles.glassLayer}>
                  <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
                  <View style={styles.glassHighlight} />
                  <View style={[styles.cardPadding, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.sectionIconWrap, { backgroundColor: pcfg.bg }]}>
                        <Ionicons name={pcfg.icon} size={18} color={pcfg.color} />
                      </View>
                      <View>
                        <Text style={styles.infoLabel}>Priority</Text>
                        <Text style={[styles.cardTitle, { color: pcfg.color, fontSize: 18 }]}>{pcfg.label}</Text>
                      </View>
                    </View>
                    <View style={styles.lockedPill}>
                      <Ionicons name="lock-closed" size={12} color={G.txtFaint} />
                      <Text style={styles.lockedPillText}>Edit task to change</Text>
                    </View>
                  </View>
                </BlurView>
              </View>
            );
          })()}

          {/* ── Subtasks ── */}
          <View style={[styles.cardWrap, styles.shadow]}>
            <BlurView intensity={70} tint="light" style={styles.glassLayer}>
              <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              <View style={styles.cardPadding}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.sectionHeaderWrap}>
                    <View style={[styles.sectionIconWrap, { backgroundColor: G.greenBg }]}><Ionicons name="list" size={16} color={G.green} /></View>
                    <Text style={styles.sectionTitle}>Subtasks</Text>
                  </View>
                  <View style={styles.progressPill}>
                    <Text style={styles.progressPillText}>{completedSubtasks}/{subtasks.length}</Text>
                  </View>
                </View>
                {subtasks.length > 0 && (
                  <View style={styles.progressBarWrap}>
                    <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: progress === 1 ? G.green : G.p600 }]} />
                  </View>
                )}
                {subtasks.length === 0 ? (
                  <Text style={styles.emptyText}>No subtasks added.</Text>
                ) : (
                  subtasks.map((st, idx) => (
                    <TouchableOpacity
                      key={st.id || idx}
                      style={[styles.subtaskRow, idx < subtasks.length - 1 && styles.borderBottom]}
                      onPress={() => toggleSubtask(idx)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, (st.completed || st.is_completed) && styles.checkboxDone]}>
                        {(st.completed || st.is_completed) && <Ionicons name="checkmark" size={14} color={G.white} />}
                      </View>
                      <Text style={[styles.subtaskText, (st.completed || st.is_completed) && styles.subtaskDoneText]}>
                        {st.title || st.text || `Subtask ${idx + 1}`}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
                {canAddSubtask && (
                  <View style={styles.addSubtaskRow}>
                    <TextInput
                      style={styles.addSubtaskInput}
                      placeholder="New subtask…"
                      placeholderTextColor={G.txtFaint}
                      value={newSubtaskText}
                      onChangeText={setNewSubtaskText}
                      onSubmitEditing={handleAddSubtask}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={[styles.actionBtn, (!newSubtaskText.trim() || isAddingSubtask) && { opacity: 0.5 }]}
                      onPress={handleAddSubtask}
                      disabled={!newSubtaskText.trim() || isAddingSubtask}
                      activeOpacity={0.8}
                    >
                      {isAddingSubtask ? <ActivityIndicator size="small" color={G.white} /> : <Ionicons name="add" size={24} color={G.white} />}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </BlurView>
          </View>

          {/* ── Tags ── */}
          {task.tags && task.tags.length > 0 && (
            <View style={[styles.cardWrap, styles.shadow]}>
              <BlurView intensity={70} tint="light" style={styles.glassLayer}>
                <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
                <View style={styles.glassHighlight} />
                <View style={styles.cardPadding}>
                  <Text style={styles.cardTitle}>Tags</Text>
                  <View style={styles.tagsRow}>
                    {task.tags.map((tag, idx) => (
                      <View key={idx} style={styles.tag}>
                        <Ionicons name="pricetag" size={12} color={G.p700} />
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </BlurView>
            </View>
          )}

          {/* ── Comments ── */}
          <View style={[styles.cardWrap, styles.shadow]}>
            <BlurView intensity={70} tint="light" style={styles.glassLayer}>
              <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              <View style={styles.cardPadding}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.sectionHeaderWrap}>
                    <View style={[styles.sectionIconWrap, { backgroundColor: G.purpleBg }]}><Ionicons name="chatbubbles" size={16} color={G.purple} /></View>
                    <Text style={styles.sectionTitle}>Comments</Text>
                  </View>
                  {comments.length > 0 && (
                    <View style={[styles.progressPill, { backgroundColor: G.purpleBg, borderColor: G.purple }]}>
                      <Text style={[styles.progressPillText, { color: G.purple }]}>{comments.length}</Text>
                    </View>
                  )}
                </View>

                {commentsLoading ? (
                  <ActivityIndicator size="small" color={G.p600} style={{ marginVertical: 16 }} />
                ) : comments.length === 0 ? (
                  <Text style={styles.emptyText}>No comments yet.</Text>
                ) : (
                  comments.map((c, idx) => {
                    const authorName = c.user?.username || c.author || 'Unknown';
                    const authorRole = c.user?.role || '';
                    const isAuthority = ['manager', 'supervisor'].includes(authorRole);
                    const timestamp = c.created_at || c.timestamp;
                    return (
                      <View key={c.id || idx} style={styles.commentRow}>
                        <View style={[styles.commentAvatar, isAuthority && { backgroundColor: G.purple }]}>
                          <Text style={styles.commentAvatarText}>{getInitials(authorName)}</Text>
                        </View>
                        <View style={[styles.commentBubble, isAuthority && styles.commentBubbleAuthority]}>
                          <View style={styles.commentMeta}>
                            <View style={styles.commentAuthorRow}>
                              <Text style={styles.commentAuthor}>{authorName}</Text>
                              {isAuthority && (
                                <View style={styles.authorityBadge}>
                                  <Text style={styles.authorityBadgeText}>{authorRole}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.commentTime}>{timestamp ? new Date(timestamp).toLocaleDateString() : ''}</Text>
                          </View>
                          {(c.content || c.text) ? <Text style={styles.commentText}>{c.content || c.text}</Text> : null}
                          {c.image_attachment ? (
                            <TouchableOpacity activeOpacity={0.85} onPress={() => setLightboxUri(c.image_attachment)}>
                              <Image source={{ uri: c.image_attachment }} style={styles.commentImage} resizeMode="cover" />
                              <View style={styles.commentImageTapHint}>
                                <Ionicons name="expand" size={14} color={G.white} />
                                <Text style={styles.commentImageTapText}>Tap to expand</Text>
                              </View>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </BlurView>
          </View>
        </ScrollView>

        {/* ── Floating Action Input (Comments) ── */}
        <View style={[styles.floatingInputWrap, { paddingBottom: insets.bottom + 10 }]}>
          <BlurView intensity={90} tint="light" style={styles.floatingInputInner}>
            <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.5)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            
            {commentImage && (
              <View style={styles.commentImagePreviewWrap}>
                <Image source={{ uri: commentImage.uri }} style={styles.commentImagePreview} resizeMode="cover" />
                <TouchableOpacity style={styles.commentImageRemove} onPress={() => setCommentImage(null)}>
                  <Ionicons name="close-circle" size={24} color={G.red} />
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.commentInputRow}>
              <TouchableOpacity style={styles.imagePickBtn} onPress={pickCommentImage} activeOpacity={0.7}>
                <Ionicons name="image" size={24} color={commentImage ? G.p700 : G.txtFaint} />
              </TouchableOpacity>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment…"
                placeholderTextColor={G.txtFaint}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
              />
              <TouchableOpacity
                style={[styles.sendBtn, ((!newComment.trim() && !commentImage) || isSendingComment) && { opacity: 0.5 }]}
                onPress={handleAddComment}
                disabled={(!newComment.trim() && !commentImage) || isSendingComment}
                activeOpacity={0.8}
              >
                {isSendingComment ? <ActivityIndicator size="small" color={G.white} /> : <Ionicons name="send" size={18} color={G.white} style={{ marginLeft: 2 }} />}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>

      {/* ── Lightbox Modal ── */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)} statusBarTranslucent>
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUri(null)} activeOpacity={0.8}>
            <BlurView intensity={40} tint="dark" style={styles.lightboxCloseBtn}>
              <Ionicons name="close" size={28} color={G.white} />
            </BlurView>
          </TouchableOpacity>
          {lightboxUri && <Image source={{ uri: lightboxUri }} style={styles.lightboxImage} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  flex1: { flex: 1 },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4, filter: [{ blur: 50 }] },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GUTTER, paddingBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,255,255,0.9)',
    ...liquidShadow, zIndex: 10,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, flexShrink: 1, letterSpacing: -0.5 },
  headerStatusDot: { width: 10, height: 10, borderRadius: 5 },
  iconBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  deleteIconBtn: { borderColor: '#FECACA' },
  headerRight: { flexDirection: 'row', gap: 8 },

  // ── Scroll Content & Base Cards
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: GUTTER, paddingTop: 16 },
  
  cardWrap: { marginBottom: GAP, borderRadius: 24 },
  shadow: { ...liquidShadow },
  glassLayer: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  cardPadding: { padding: 20 },
  borderBottom: { borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.05)' },

  // ── Hero
  heroAccentBar: { height: 6, width: '100%', zIndex: 6 },
  heroInner: { padding: 20 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, gap: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, gap: 6 },
  priorityBadgeText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  dailyBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: G.amberBg, borderWidth: 1.5, borderColor: G.amber, gap: 6 },
  dailyBadgeText: { fontSize: 12, fontWeight: '900', color: G.amber, letterSpacing: 0.5, textTransform: 'uppercase' },
  overdueBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: G.redBg, borderWidth: 1.5, borderColor: G.red, gap: 6 },
  overdueBadgeText: { fontSize: 12, fontWeight: '900', color: G.red, letterSpacing: 0.5, textTransform: 'uppercase' },
  taskTitle: { fontSize: 28, fontWeight: '900', color: G.txtMain, marginBottom: 10, lineHeight: 34, letterSpacing: -0.5 },
  taskDesc: { fontSize: 15, color: G.txtFaint, fontWeight: '700', lineHeight: 24 },

  // ── Info Cards
  infoRow: { flexDirection: 'row', gap: GAP },
  infoCardInner: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, color: G.txtFaint, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 15, color: G.txtMain, fontWeight: '900' },

  // ── Status/Priority Checkers
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  sectionHeaderWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chipGridRow: { flexDirection: 'row', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, borderWidth: 2, gap: 8 },
  chipRowFill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 2, gap: 6 },
  chipActive: { backgroundColor: G.white },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },

  lockedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  lockedPillText: { fontSize: 11, color: G.txtFaint, fontWeight: '700' },
  updatingPill: { backgroundColor: G.p100, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: G.p200 },
  updatingText: { fontSize: 11, color: G.p700, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  permNote: { fontSize: 13, color: G.txtFaint, fontWeight: '700', fontStyle: 'italic', marginTop: 14 },
  readonlyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.03)' },
  readonlyText: { fontSize: 14, color: G.txtFaint, fontWeight: '700', fontStyle: 'italic', flex: 1 },

  // ── Subtasks
  progressPill: { backgroundColor: G.p100, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: G.p200 },
  progressPillText: { fontSize: 13, color: G.p700, fontWeight: '900' },
  progressBarWrap: { height: 8, borderRadius: 4, backgroundColor: G.p100, marginBottom: 16, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: G.p300, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.8)' },
  checkboxDone: { backgroundColor: G.green, borderColor: G.green },
  subtaskText: { flex: 1, fontSize: 16, fontWeight: '800', color: G.txtMain },
  subtaskDoneText: { textDecorationLine: 'line-through', color: G.txtFaint },
  
  addSubtaskRow: { flexDirection: 'row', gap: 12, marginTop: 16, alignItems: 'center' },
  addSubtaskInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: '800', color: G.txtMain, borderWidth: 2, borderColor: G.p200 },
  actionBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: G.p700, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOffset: { width: 0, height: 4 } },

  // ── Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: G.p100, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: G.p200 },
  tagText: { fontSize: 12, color: G.p800, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Comments
  commentRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  commentAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: G.p600, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.2 },
  commentAvatarText: { fontSize: 15, fontWeight: '900', color: G.white },
  commentBubble: { flex: 1, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, borderTopLeftRadius: 4, borderWidth: 2, borderColor: G.p200, padding: 16 },
  commentBubbleAuthority: { backgroundColor: G.purpleBg, borderColor: '#DDD6FE' },
  commentMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start' },
  commentAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  commentAuthor: { fontSize: 15, fontWeight: '900', color: G.txtMain },
  authorityBadge: { backgroundColor: G.purple, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  authorityBadgeText: { fontSize: 9, color: G.white, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  commentTime: { fontSize: 12, color: G.txtFaint, fontWeight: '800' },
  commentText: { fontSize: 15, color: G.txtMain, fontWeight: '700', lineHeight: 22 },
  
  // ── Floating Comment Input
  floatingInputWrap: { paddingHorizontal: GUTTER, paddingTop: 10 },
  floatingInputInner: { borderRadius: 32, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', padding: 10, ...liquidShadow, shadowOffset: { width: 0, height: -4 } },
  commentInputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', zIndex: 10 },
  commentInput: { flex: 1, backgroundColor: G.white, borderRadius: 24, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, fontSize: 15, fontWeight: '800', color: G.txtMain, maxHeight: 120, borderWidth: 2, borderColor: G.p200, minHeight: 52 },
  sendBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: G.p700, alignItems: 'center', justifyContent: 'center', shadowColor: G.p900, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  imagePickBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: G.white, borderWidth: 2, borderColor: G.p200, alignItems: 'center', justifyContent: 'center' },
  commentImagePreviewWrap: { marginBottom: 10, position: 'relative', alignSelf: 'flex-start', zIndex: 10, marginLeft: 10, marginTop: 4 },
  commentImagePreview: { width: 120, height: 120, borderRadius: 16, borderWidth: 2, borderColor: G.p200 },
  commentImageRemove: { position: 'absolute', top: -10, right: -10, backgroundColor: G.white, borderRadius: 16 },
  
  commentImage: { width: '100%', height: 200, borderRadius: 16, marginTop: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  commentImageTapHint: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  commentImageTapText: { fontSize: 12, color: G.white, fontWeight: '900' },

  // ── Lightbox
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.95)', alignItems: 'center', justifyContent: 'center' },
  lightboxClose: { position: 'absolute', top: 60, right: 20, zIndex: 10 },
  lightboxCloseBtn: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.5 },

  // ── Error / Misc
  emptyText: { fontSize: 15, color: G.txtFaint, fontStyle: 'italic', fontWeight: '700', marginTop: 4 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: 22, color: G.red, fontWeight: '900' },
});