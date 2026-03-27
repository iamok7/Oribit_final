import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { createTask, updateTask, getUsers } from '../services/api';

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
};

// Native fluid shadow
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

const STATUSES = [
  { key: 'todo',        label: 'To Do',       color: G.p800,  bg: G.p100, border: G.p300 },
  { key: 'in_progress', label: 'In Progress', color: G.p600,  bg: G.p100, border: G.p300 },
  { key: 'completed',   label: 'Completed',   color: G.green, bg: G.greenBg, border: '#A7F3D0' },
  { key: 'on_hold',     label: 'On Hold',     color: G.amber, bg: G.amberBg, border: '#FDE68A' },
];

const PRIORITIES = [
  { key: 'low',    label: 'Low',    color: G.green, bg: G.greenBg, border: '#A7F3D0', icon: 'arrow-down-circle' },
  { key: 'medium', label: 'Medium', color: G.amber, bg: G.amberBg, border: '#FDE68A', icon: 'remove-circle' },
  { key: 'high',   label: 'High',   color: G.red,   bg: G.redBg,   border: '#FECACA', icon: 'arrow-up-circle' },
];

const BentoBox = ({ children }) => (
  <View style={[styles.shadowWrap, { marginBottom: GAP }]}>
    <View style={styles.glassLight}>
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
      <View style={styles.glassHighlight} />
      <View style={styles.cardInner}>{children}</View>
    </View>
  </View>
);

export default function AddTaskScreen({ route, navigation }) {
  const { task: editTask, prefillDaily, prefillDate } = route.params || {};
  const isEditing = !!editTask;
  const { user, isManager, isSupervisor } = useAuth();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState(editTask?.title || '');
  const [description, setDescription] = useState(editTask?.description || '');
  const [status, setStatus] = useState(editTask?.status || 'todo');
  const [priority, setPriority] = useState((editTask?.priority || 'medium').toLowerCase());
  const [deadline, setDeadline] = useState(editTask?.deadline ? new Date(editTask.deadline).toISOString().split('T')[0] : (prefillDate || ''));
  const [isDaily, setIsDaily] = useState(editTask?.is_daily_task || prefillDaily || false);
  const [tags, setTags] = useState(editTask?.tags?.join(', ') || '');
  
  const [assignedTo, setAssignedTo] = useState(editTask?.assigned_to?.id || editTask?.assigned_to || null);
  const [assignedName, setAssignedName] = useState('');
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => editTask?.deadline ? new Date(editTask.deadline) : new Date());
  
  const [deadlineTime, setDeadlineTime] = useState(() => {
    if (editTask?.deadline) {
      const d = new Date(editTask.deadline);
      let h = d.getHours();
      const period = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return { hour: h, minute: d.getMinutes(), period };
    }
    return { hour: 9, minute: 0, period: 'AM' };
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isManager() || isSupervisor()) fetchUsers();
    if (editTask?.assigned_to) {
      const name = typeof editTask.assigned_to === 'string' ? editTask.assigned_to : editTask.assigned_to?.username || '';
      setAssignedName(name);
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : data?.users || []);
    } catch (err) {}
  };

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Calendar picker helpers ──
  const MONTH_NAMES_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_INITIALS = ['S','M','T','W','T','F','S'];

  const buildCalendarGrid = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  };

  const handleDaySelect = (day) => {
    if (!day) return;
    const y = pickerMonth.getFullYear();
    const m = pickerMonth.getMonth();
    const str = `${y}-${String(m + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    setDeadline(str);
    setShowDatePicker(false);
  };

  const formatDeadlineDisplay = (str) => {
    if (!str) return null;
    const [y, m, d] = str.split('-');
    return `${MONTH_NAMES_FULL[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const tagsArray = tags.split(',').map((t) => t.trim()).filter(Boolean);

      let deadlineValue = deadline || null;
      if (isDaily && deadline && deadlineTime) {
        let h = deadlineTime.hour;
        if (deadlineTime.period === 'PM' && h !== 12) h += 12;
        if (deadlineTime.period === 'AM' && h === 12) h = 0;
        deadlineValue = `${deadline}T${String(h).padStart(2,'0')}:${String(deadlineTime.minute).padStart(2,'0')}:00`;
      }

      const taskData = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        is_daily_task: isDaily,
        tags: tagsArray,
        ...(deadlineValue ? { deadline: deadlineValue } : {}),
        ...(assignedTo ? { assigned_to: assignedTo } : {}),
      };

      if (isEditing) {
        await updateTask(editTask.id, taskData);
        Alert.alert('Success', 'Task updated successfully');
      } else {
        await createTask(taskData);
        Alert.alert('Success', 'Task created successfully');
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStatus = STATUSES.find((s) => s.key === status);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* ── Stable Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.p300 }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -60, backgroundColor: '#A5F3FC', transform: [{ scale: 1.2 }] }]} />
      </View>

      <KeyboardAvoidingView
        style={[styles.flex1, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top > 0 ? 10 : 20 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Task' : 'New Task'}</Text>
          <TouchableOpacity
            style={[styles.saveBtn, isSubmitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? <ActivityIndicator size="small" color={G.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Details ── */}
          <BentoBox>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Title <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, errors.title && styles.inputError]}
                placeholder="Enter task title"
                placeholderTextColor={G.txtFaint}
                value={title}
                onChangeText={(v) => { setTitle(v); setErrors((e) => ({ ...e, title: null })); }}
                selectionColor={G.p600}
              />
              {errors.title && <Text style={styles.errorMsg}>{errors.title}</Text>}
            </View>

            <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the task..."
                placeholderTextColor={G.txtFaint}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                selectionColor={G.p600}
              />
            </View>
          </BentoBox>

          {/* ── Status & Priority ── */}
          <BentoBox>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Status</Text>
              <TouchableOpacity style={styles.picker} onPress={() => setShowStatusPicker(true)} activeOpacity={0.8}>
                <View style={styles.pickerLeft}>
                  <View style={[styles.statusDot, { backgroundColor: selectedStatus?.color || G.p700 }]} />
                  <Text style={styles.pickerText}>{selectedStatus?.label || 'Select Status'}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={G.txtFaint} />
              </TouchableOpacity>
            </View>

            <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map((p) => {
                  const isActive = priority === p.key;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      style={[
                        styles.priorityChip,
                        { backgroundColor: isActive ? p.color : p.bg, borderColor: isActive ? p.color : p.border },
                        isActive && { shadowColor: p.color, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }
                      ]}
                      onPress={() => setPriority(p.key)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={p.icon} size={16} color={isActive ? G.white : p.color} />
                      <Text style={[styles.priorityChipText, { color: isActive ? G.white : p.color }]}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </BentoBox>

          {/* ── Scheduling ── */}
          <BentoBox>
            <View style={[styles.fieldGroup, !isDaily && { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>Deadline</Text>
              <TouchableOpacity style={[styles.picker, deadline && styles.pickerActive]} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                <View style={styles.pickerLeft}>
                  <Ionicons name="calendar" size={18} color={deadline ? G.p700 : G.txtFaint} />
                  <Text style={[styles.pickerText, !deadline && styles.pickerPlaceholder]}>
                    {deadline ? formatDeadlineDisplay(deadline) : 'Pick a deadline date'}
                  </Text>
                </View>
                {deadline ? (
                  <TouchableOpacity onPress={() => setDeadline('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={20} color={G.txtFaint} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={G.txtFaint} />
                )}
              </TouchableOpacity>
            </View>

            {isDaily && (
              <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
                <Text style={styles.fieldLabel}>Deadline Time <Text style={{ color: G.p600, fontWeight: '800' }}>(Daily Planner)</Text></Text>
                <TouchableOpacity style={[styles.picker, styles.pickerActive]} onPress={() => setShowTimePicker(true)} activeOpacity={0.8}>
                  <View style={styles.pickerLeft}>
                    <Ionicons name="time" size={18} color={G.p700} />
                    <Text style={styles.pickerText}>
                      {`${deadlineTime.hour}:${String(deadlineTime.minute).padStart(2,'0')} ${deadlineTime.period}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={G.txtFaint} />
                </TouchableOpacity>
              </View>
            )}
          </BentoBox>

          {/* ── Assignment & Settings ── */}
          <BentoBox>
            {(isManager() || isSupervisor()) && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Assign To</Text>
                <TouchableOpacity style={styles.picker} onPress={() => { setUserSearch(''); setShowUserPicker(true); }} activeOpacity={0.8}>
                  <View style={styles.pickerLeft}>
                    <Ionicons name="person" size={18} color={assignedName ? G.p700 : G.txtFaint} />
                    <Text style={[styles.pickerText, !assignedName && styles.pickerPlaceholder]}>
                      {assignedName || 'Select user'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={G.txtFaint} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <View style={styles.toggleIconWrap}><Ionicons name="sunny" size={20} color={G.amber} /></View>
                  <View>
                    <Text style={styles.toggleLabel}>Daily Task</Text>
                    <Text style={styles.toggleHint}>Show in daily planner</Text>
                  </View>
                </View>
                <Switch
                  value={isDaily}
                  onValueChange={setIsDaily}
                  trackColor={{ false: G.p200, true: G.p400 }}
                  thumbColor={isDaily ? G.p700 : G.white}
                />
              </View>
            </View>

            <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>Tags</Text>
              <View style={styles.inputRow}>
                <Ionicons name="pricetag" size={18} color={G.p700} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputFlex}
                  placeholder="e.g. design, frontend, urgent"
                  placeholderTextColor={G.txtFaint}
                  value={tags}
                  onChangeText={setTags}
                  selectionColor={G.p600}
                />
              </View>
              <Text style={styles.fieldHint}>Separate tags with commas</Text>
            </View>
          </BentoBox>

          {/* ── Submit Button ── */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={G.white} />
            ) : (
              <>
                <Ionicons name={isEditing ? 'checkmark-circle' : 'add-circle'} size={24} color={G.white} />
                <Text style={styles.submitButtonText}>{isEditing ? 'Update Task' : 'Create Task'}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Status Picker Modal (Liquid Glass) ── */}
      <Modal visible={showStatusPicker} transparent animationType="slide" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.7)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Status</Text>
            
            {STATUSES.map((s) => {
              const isActive = status === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.modalOption, isActive && styles.modalOptionActive]}
                  onPress={() => { setStatus(s.key); setShowStatusPicker(false); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusDotLg, { backgroundColor: s.color }]} />
                  <Text style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}>{s.label}</Text>
                  {isActive && <Ionicons name="checkmark-circle" size={24} color={G.p700} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Date Picker Modal (Liquid Glass) ── */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.8)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />

            <View style={styles.modalHandle} />
            
            <View style={styles.calMonthRow}>
              <TouchableOpacity style={styles.calNavBtn} onPress={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))}>
                <Ionicons name="chevron-back" size={20} color={G.p800} />
              </TouchableOpacity>
              <Text style={styles.calMonthTitle}>{MONTH_NAMES_FULL[pickerMonth.getMonth()]} {pickerMonth.getFullYear()}</Text>
              <TouchableOpacity style={styles.calNavBtn} onPress={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))}>
                <Ionicons name="chevron-forward" size={20} color={G.p800} />
              </TouchableOpacity>
            </View>

            <View style={styles.calDayNamesRow}>
              {DAY_INITIALS.map((d, i) => <Text key={i} style={[styles.calDayName, (i === 0 || i === 6) && styles.calDayNameWeekend]}>{d}</Text>)}
            </View>

            {buildCalendarGrid(pickerMonth.getFullYear(), pickerMonth.getMonth()).map((week, wi) => {
              const todayStr = new Date().toISOString().split('T')[0];
              return (
                <View key={wi} style={styles.calWeekRow}>
                  {week.map((day, di) => {
                    if (!day) return <View key={di} style={styles.calDayCell} />;
                    const y = pickerMonth.getFullYear();
                    const m = pickerMonth.getMonth();
                    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const isSelected = dateStr === deadline;
                    const isToday = dateStr === todayStr;
                    const isPast = dateStr < todayStr;
                    
                    return (
                      <TouchableOpacity
                        key={di}
                        style={[
                          styles.calDayCell,
                          isSelected && styles.calDayCellSelected,
                          isToday && !isSelected && styles.calDayCellToday,
                          isPast && styles.calDayCellPast,
                        ]}
                        onPress={() => handleDaySelect(day)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.calDayText,
                          isSelected && styles.calDayTextSelected,
                          isToday && !isSelected && styles.calDayTextToday,
                          isPast && styles.calDayTextPast,
                        ]}>{day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}

            <View style={styles.calFooter}>
              {deadline ? (
                <View style={styles.calSelectedRow}>
                  <Ionicons name="calendar" size={18} color={G.p700} />
                  <Text style={styles.calSelectedText}>{formatDeadlineDisplay(deadline)}</Text>
                  <TouchableOpacity onPress={() => { setDeadline(''); setShowDatePicker(false); }} style={styles.calClearBtn}>
                    <Text style={styles.calClearText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.calHint}>Tap a date to set the deadline</Text>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Time Picker Modal (Liquid Glass) ── */}
      <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTimePicker(false)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.8)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />

            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Set Deadline Time</Text>

            <View style={styles.timePickerRow}>
              {/* Hour */}
              <View style={styles.timeDrumWrap}>
                <Text style={styles.timeDrumLabel}>Hour</Text>
                <ScrollView style={styles.timeDrum} showsVerticalScrollIndicator={false} snapToInterval={48} decelerationRate="fast" contentContainerStyle={{ paddingVertical: 48 }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <TouchableOpacity key={h} style={[styles.timeDrumItem, deadlineTime.hour === h && styles.timeDrumItemActive]} onPress={() => setDeadlineTime((p) => ({ ...p, hour: h }))} activeOpacity={0.7}>
                      <Text style={[styles.timeDrumText, deadlineTime.hour === h && styles.timeDrumTextActive]}>{String(h).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.timeColon}>:</Text>

              {/* Minute */}
              <View style={styles.timeDrumWrap}>
                <Text style={styles.timeDrumLabel}>Min</Text>
                <ScrollView style={styles.timeDrum} showsVerticalScrollIndicator={false} snapToInterval={48} decelerationRate="fast" contentContainerStyle={{ paddingVertical: 48 }}>
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                    <TouchableOpacity key={m} style={[styles.timeDrumItem, deadlineTime.minute === m && styles.timeDrumItemActive]} onPress={() => setDeadlineTime((p) => ({ ...p, minute: m }))} activeOpacity={0.7}>
                      <Text style={[styles.timeDrumText, deadlineTime.minute === m && styles.timeDrumTextActive]}>{String(m).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* AM/PM */}
              <View style={styles.timeDrumWrap}>
                <Text style={styles.timeDrumLabel}>Period</Text>
                <View style={styles.ampmStack}>
                  {['AM', 'PM'].map((p) => (
                    <TouchableOpacity key={p} style={[styles.ampmBtn, deadlineTime.period === p && styles.ampmBtnActive]} onPress={() => setDeadlineTime((prev) => ({ ...prev, period: p }))} activeOpacity={0.7}>
                      <Text style={[styles.ampmText, deadlineTime.period === p && styles.ampmTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.timePreviewRow}>
              <Ionicons name="time" size={18} color={G.p700} />
              <Text style={styles.timePreviewText}>
                {`${deadlineTime.hour}:${String(deadlineTime.minute).padStart(2,'0')} ${deadlineTime.period}`}
                {deadline ? `  ·  ${formatDeadlineDisplay(deadline)}` : ''}
              </Text>
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={() => setShowTimePicker(false)} activeOpacity={0.85}>
              <Text style={styles.submitButtonText}>Confirm Time</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── User Picker Modal (Liquid Glass) ── */}
      <Modal visible={showUserPicker} transparent animationType="slide" onRequestClose={() => setShowUserPicker(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowUserPicker(false)} />
          
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24), maxHeight: '80%' }]}>
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.8)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />

            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Assign To</Text>

            <View style={styles.userSearchRow}>
              <Ionicons name="search" size={20} color={G.txtFaint} />
              <TextInput
                style={styles.userSearchInput}
                placeholder="Search by name or role…"
                placeholderTextColor={G.txtFaint}
                value={userSearch}
                onChangeText={setUserSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {userSearch.length > 0 && (
                <TouchableOpacity onPress={() => setUserSearch('')}>
                  <Ionicons name="close-circle" size={20} color={G.txtFaint} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 350 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {!userSearch.trim() && (
                <TouchableOpacity
                  style={[styles.modalOption, !assignedTo && styles.modalOptionActive]}
                  onPress={() => { setAssignedTo(null); setAssignedName(''); setShowUserPicker(false); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.userAvatar, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
                    <Ionicons name="person" size={16} color={G.txtFaint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalOptionText, !assignedTo && styles.modalOptionTextActive]}>Unassigned</Text>
                  </View>
                  {!assignedTo && <Ionicons name="checkmark-circle" size={24} color={G.p700} />}
                </TouchableOpacity>
              )}

              {users
                .filter((u) => {
                  if (!userSearch.trim()) return true;
                  const q = userSearch.toLowerCase();
                  return (u.username || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
                })
                .map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.modalOption, assignedTo === u.id && styles.modalOptionActive]}
                    onPress={() => { setAssignedTo(u.id); setAssignedName(u.username || u.name || ''); setShowUserPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.userAvatar, { backgroundColor: G.p100 }]}>
                      <Text style={styles.userAvatarText}>{(u.username || u.name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalOptionText, assignedTo === u.id && styles.modalOptionTextActive]}>{u.username || u.name}</Text>
                      <Text style={styles.userRole}>{u.role}</Text>
                    </View>
                    {assignedTo === u.id && <Ionicons name="checkmark-circle" size={24} color={G.p700} />}
                  </TouchableOpacity>
                ))}
              
              {userSearch.trim() && users.filter((u) => {
                const q = userSearch.toLowerCase();
                return (u.username || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
              }).length === 0 && (
                <View style={styles.noResultsRow}>
                  <Ionicons name="search" size={24} color={G.txtFaint} />
                  <Text style={styles.noResultsText}>No users found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '900', color: G.txtMain, textAlign: 'center', letterSpacing: -0.5 },
  saveBtn: { backgroundColor: G.p700, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, minWidth: 80, alignItems: 'center', ...liquidShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2 },
  saveBtnText: { fontSize: 14, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  scrollContent: { paddingHorizontal: GUTTER, paddingTop: 16 },

  // ── Bento Box Layout
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  cardInner: { padding: 20 },

  // ── Form Fields
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '900', color: G.txtMain, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4 },
  fieldHint: { fontSize: 12, color: G.txtFaint, fontWeight: '700', marginTop: 6, paddingLeft: 4 },
  required: { color: G.red },
  
  input: {
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontWeight: '800', color: G.txtMain,
    borderWidth: 2, borderColor: G.p200,
  },
  inputError: { borderColor: '#FCA5A5', backgroundColor: G.redBg },
  textArea: { minHeight: 100, paddingTop: 14 },
  errorMsg: { fontSize: 12, color: G.red, fontWeight: '800', marginTop: 6, paddingLeft: 4 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    borderWidth: 2, borderColor: G.p200, paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 10 },
  inputFlex: { flex: 1, paddingVertical: 14, fontSize: 15, fontWeight: '800', color: G.txtMain },

  // ── Pickers
  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    borderWidth: 2, borderColor: G.p200,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  pickerActive: { borderColor: G.p500, backgroundColor: G.white, shadowColor: G.p900, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  pickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerText: { fontSize: 15, color: G.txtMain, fontWeight: '800' },
  pickerPlaceholder: { color: G.txtFaint, fontWeight: '700' },
  statusDot: { width: 14, height: 14, borderRadius: 7 },

  // ── Priority Chips
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 16, borderWidth: 2, gap: 6,
  },
  priorityChipActive: { backgroundColor: G.white },
  priorityChipText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },

  // ── Toggles
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    padding: 16, borderWidth: 2, borderColor: G.p200,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: G.amberBg, alignItems: 'center', justifyContent: 'center' },
  toggleLabel: { fontSize: 15, fontWeight: '900', color: G.txtMain, marginBottom: 2 },
  toggleHint: { fontSize: 12, color: G.txtFaint, fontWeight: '700' },

  // ── Submit Button
  submitButton: {
    backgroundColor: G.p700, borderRadius: 24, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: 10, ...liquidShadow, shadowOffset: { width: 0, height: 6 },
  },
  submitButtonText: { fontSize: 16, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  // ── Modals (Liquid Glass)
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', overflow: 'hidden', shadowColor: G.p900, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20 },
  modalHandle: { width: 48, height: 6, borderRadius: 3, backgroundColor: G.p200, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, marginBottom: 16, letterSpacing: -0.5 },

  // ── Modal Options
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, marginBottom: 8, gap: 14 },
  modalOptionActive: { backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 2, borderColor: G.white },
  modalOptionText: { flex: 1, fontSize: 16, color: G.txtMain, fontWeight: '800' },
  modalOptionTextActive: { color: G.p800, fontWeight: '900' },
  statusDotLg: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(0,0,0,0.1)' },

  // ── User Picker Modal
  userSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, borderWidth: 2, borderColor: G.p200, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, gap: 10 },
  userSearchInput: { flex: 1, fontSize: 15, fontWeight: '800', color: G.txtMain },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 16, fontWeight: '900', color: G.p700 },
  userRole: { fontSize: 11, color: G.txtFaint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  noResultsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40 },
  noResultsText: { fontSize: 15, color: G.txtFaint, fontWeight: '800' },

  // ── Calendar Picker
  calMonthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  calNavBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 2, borderColor: G.p200, alignItems: 'center', justifyContent: 'center' },
  calMonthTitle: { fontSize: 18, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  calDayNamesRow: { flexDirection: 'row', marginBottom: 10 },
  calDayName: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '900', color: G.txtFaint, letterSpacing: 0.5 },
  calDayNameWeekend: { color: G.p400 },
  calWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calDayCell: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  calDayCellSelected: { backgroundColor: G.p700, shadowColor: G.p900, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  calDayCellToday: { borderWidth: 2, borderColor: G.p500 },
  calDayCellPast: { opacity: 0.4 },
  calDayText: { fontSize: 15, fontWeight: '800', color: G.txtMain },
  calDayTextSelected: { color: G.white, fontWeight: '900' },
  calDayTextToday: { color: G.p700, fontWeight: '900' },
  calDayTextPast: { color: G.txtFaint },
  calFooter: { marginTop: 20, alignItems: 'center' },
  calSelectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: G.p100, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 2, borderColor: G.p200 },
  calSelectedText: { flex: 1, fontSize: 15, fontWeight: '900', color: G.p800 },
  calClearBtn: { backgroundColor: G.white, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  calClearText: { fontSize: 12, color: G.red, fontWeight: '900' },
  calHint: { fontSize: 14, color: G.txtFaint, fontWeight: '700', fontStyle: 'italic' },

  // ── Time Picker
  timePickerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 12, marginBottom: 24, marginTop: 10 },
  timeDrumWrap: { alignItems: 'center' },
  timeDrumLabel: { fontSize: 12, color: G.txtFaint, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  timeDrum: { height: 180, width: 72, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20, borderWidth: 2, borderColor: G.p200 },
  timeDrumItem: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, marginHorizontal: 6 },
  timeDrumItemActive: { backgroundColor: G.p700, shadowColor: G.p900, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  timeDrumText: { fontSize: 22, fontWeight: '800', color: G.txtFaint, letterSpacing: -0.5 },
  timeDrumTextActive: { color: G.white, fontWeight: '900' },
  timeColon: { fontSize: 32, fontWeight: '900', color: G.p700, marginTop: 52 },
  ampmStack: { gap: 12, height: 180, justifyContent: 'center' },
  ampmBtn: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: G.p200, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center' },
  ampmBtnActive: { backgroundColor: G.p700, borderColor: G.p900 },
  ampmText: { fontSize: 15, fontWeight: '900', color: G.txtFaint },
  ampmTextActive: { color: G.white },
  timePreviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, backgroundColor: G.p100, borderRadius: 20, borderWidth: 2, borderColor: G.p200, marginBottom: 24 },
  timePreviewText: { fontSize: 16, color: G.p800, fontWeight: '900', letterSpacing: -0.2 },
});
