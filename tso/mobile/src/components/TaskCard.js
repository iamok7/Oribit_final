import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';

// Blue glass palette (matches TasksScreen + HomeScreen theme)
const G = {
  txt:     '#1E3A8A',
  txtSub:  '#64748B',
  p300:    '#93C5FD',
  p400:    '#60A5FA',
  p500:    '#3B82F6',
  p600:    '#2563EB',
  p700:    '#1D4ED8',
  white:   '#FFFFFF',
};

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  in_progress: { label: 'In Progress', color: '#2196F3' },
  completed:   { label: 'Completed',   color: '#4CAF50' },
  on_hold:     { label: 'On Hold',     color: '#FF9800' },
  past_due:    { label: 'Past Due',    color: '#F44336' },
  todo:        { label: 'To Do',       color: '#7C6FCD' },
  to_do:       { label: 'To Do',       color: '#7C6FCD' },
};

const PRIORITY_CFG = {
  high:   { label: 'High',   color: '#F44336', icon: 'arrow-up-circle-outline' },
  medium: { label: 'Medium', color: '#FF9800', icon: 'remove-circle-outline' },
  low:    { label: 'Low',    color: '#4CAF50', icon: 'arrow-down-circle-outline' },
};

const AVATAR_COLORS = ['#7C6FCD', '#F5A67D', '#4CAF50', '#2196F3', '#E91E63', '#FF9800'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const norm = (s) => (s || '').toLowerCase().replace(/[\s-]+/g, '_');

const getStatusCfg = (status) =>
  STATUS_CFG[norm(status)] || { label: status || 'Unknown', color: '#7C6FCD' };

const resolveString = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val;
  return val.username || val.name || null;
};

const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0] || '').join('').toUpperCase().slice(0, 2) || '?';
};

const avatarColor = (name) =>
  AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length];

const dueDateInfo = (deadline) => {
  if (!deadline) return null;
  const diff = (new Date(deadline) - new Date()) / 86400000;
  const label = new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diff < 0)  return { label, color: '#F44336', icon: 'alert-circle',    overdue: true };
  if (diff <= 3) return { label, color: '#FF9800', icon: 'time',            overdue: false };
  return           { label, color: '#64748B', icon: 'calendar-outline', overdue: false };
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const TaskCard = ({ task, onPress, showAssignee = true, compact = false }) => {
  const { getTaskNotification } = useNotifications();

  if (!task) return null;

  const statusCfg   = getStatusCfg(task.status);
  const deadline    = task.deadline || task.due_date;
  const dateInfo    = dueDateInfo(deadline);
  const isOverdue   = dateInfo?.overdue && norm(task.status) !== 'completed';
  const accentColor = isOverdue ? '#F44336' : statusCfg.color;

  const priority    = (task.priority || 'medium').toLowerCase();
  const priCfg      = PRIORITY_CFG[priority] || PRIORITY_CFG.medium;

  const assignees     = task.assignees || (task.assigned_to ? [task.assigned_to] : []);
  const assigneeName  = resolveString(task.assigned_to);
  const assignedBy    = resolveString(task.created_by);

  const subtasks    = Array.isArray(task.subtasks) ? task.subtasks : [];
  const doneCount   = subtasks.filter((s) => norm(s.status) === 'completed').length;

  // Safe — returns null if no unseen notification
  const notif = getTaskNotification(task.id);

  const cardShadow = {
    shadowColor: accentColor,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
    shadowOffset: { width: 0, height: 4 },
  };

  return (
    <TouchableOpacity style={[styles.card, cardShadow]} onPress={() => onPress?.(task)} activeOpacity={0.82}>

      {/* colour tint at top */}
      <View style={[styles.tintWash, { backgroundColor: accentColor + '09' }]} />

      {/* left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* notification badge */}
      {!!notif && (
        <View style={styles.notifBadge}>
          <Ionicons name="chatbubble-ellipses" size={9} color="#fff" />
          <Text style={styles.notifText} numberOfLines={1}>{notif.authorName}</Text>
        </View>
      )}

      <View style={styles.body}>

        {/* ── Row 1: status pill + due-date chip ── */}
        <View style={styles.row}>
          <View style={[styles.statusPill, { borderColor: statusCfg.color + '55' }]}>
            <View style={[styles.dot, { backgroundColor: statusCfg.color }]} />
            <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>

          {dateInfo && (
            <View style={[styles.datePill, { borderColor: dateInfo.color + '45', backgroundColor: dateInfo.color + '12' }]}>
              <Ionicons name={dateInfo.icon} size={10} color={dateInfo.color} />
              <Text style={[styles.dateLabel, { color: dateInfo.color }]}>{dateInfo.label}</Text>
            </View>
          )}
        </View>

        {/* ── Row 2: priority + backlog pills ── */}
        <View style={styles.pillsRow}>
          <View style={[styles.pill, { backgroundColor: priCfg.color + '18', borderColor: priCfg.color + '45' }]}>
            <Ionicons name={priCfg.icon} size={10} color={priCfg.color} />
            <Text style={[styles.pillLabel, { color: priCfg.color }]}>{priCfg.label} Priority</Text>
          </View>
          {isOverdue && (
            <View style={[styles.pill, { backgroundColor: '#F4433615', borderColor: '#F4433645' }]}>
              <Ionicons name="warning-outline" size={10} color="#F44336" />
              <Text style={[styles.pillLabel, { color: '#F44336' }]}>Backlog</Text>
            </View>
          )}
        </View>

        {/* ── Row 3: title ── */}
        <Text style={styles.title} numberOfLines={compact ? 1 : 2}>{task.title || 'Untitled Task'}</Text>

        {/* ── Row 4: description ── */}
        {!!task.description && !compact && (
          <Text style={styles.desc} numberOfLines={2}>{task.description}</Text>
        )}

        {/* ── Row 5: subtask progress ── */}
        {subtasks.length > 0 && !compact && (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { backgroundColor: statusCfg.color, width: `${(doneCount / subtasks.length) * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{doneCount}/{subtasks.length} subtasks</Text>
          </View>
        )}

        {/* ── Row 6: assigned by / to ── */}
        {(assignedBy || assigneeName) && (
          <View style={styles.assignRow}>
            {!!assignedBy && (
              <View style={styles.assignChip}>
                <Ionicons name="person-add-outline" size={10} color={G.txtSub} />
                <Text style={styles.assignMeta}>BY</Text>
                <Text style={styles.assignName} numberOfLines={1}>{assignedBy}</Text>
              </View>
            )}
            {!!assigneeName && (
              <View style={styles.assignChip}>
                <Ionicons name="person-outline" size={10} color={G.p500} />
                <Text style={[styles.assignMeta, { color: G.p500 }]}>TO</Text>
                <Text style={[styles.assignName, { color: G.p600 }]} numberOfLines={1}>{assigneeName}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Row 7: avatars + arrow ── */}
        <View style={styles.bottomRow}>
          {showAssignee && assignees.length > 0 ? (
            <View style={styles.avatarStack}>
              {assignees.slice(0, 3).map((a, i) => {
                const n = resolveString(a) || '?';
                return (
                  <View key={i} style={[styles.avatar, { backgroundColor: avatarColor(n), marginLeft: i > 0 ? -8 : 0, zIndex: 10 - i }]}>
                    <Text style={styles.avatarText}>{initials(n)}</Text>
                  </View>
                );
              })}
              {assignees.length > 3 && (
                <View style={[styles.avatar, { backgroundColor: 'rgba(147,197,253,0.35)', marginLeft: -8, zIndex: 1 }]}>
                  <Text style={[styles.avatarText, { color: G.p700 }]}>+{assignees.length - 3}</Text>
                </View>
              )}
            </View>
          ) : (
            <View />
          )}

          <TouchableOpacity
            style={[styles.arrowBtn, { backgroundColor: accentColor + '18', borderColor: accentColor + '35' }]}
            onPress={() => onPress?.(task)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-forward" size={14} color={accentColor} />
          </TouchableOpacity>
        </View>

      </View>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(147,197,253,0.45)',
    overflow: 'hidden',
  },
  tintWash: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 48,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  accentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
    borderTopRightRadius: 3, borderBottomRightRadius: 3,
  },
  notifBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#E53935',
    borderRadius: 50,
    paddingHorizontal: 7, paddingVertical: 3,
    maxWidth: 120, zIndex: 20,
  },
  notifText: {
    fontSize: 9, color: '#fff', fontWeight: '700',
  },
  body: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 20,
    paddingRight: 14,
  },

  // Row helpers
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },

  // Status pill
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 50, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.80)',
  },
  dot:         { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Date pill
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 50, borderWidth: 1,
  },
  dateLabel: { fontSize: 10, fontWeight: '500' },

  // Pills row (priority + backlog)
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 50, borderWidth: 1,
  },
  pillLabel: { fontSize: 10, fontWeight: '700' },

  // Title & desc
  title: {
    fontSize: 15, fontWeight: '700',
    color: G.txt, lineHeight: 22, letterSpacing: -0.1,
    marginBottom: 4,
  },
  desc: {
    fontSize: 12, color: G.txtSub,
    lineHeight: 18, marginBottom: 8,
  },

  // Progress
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  progressTrack: { flex: 1, height: 4, backgroundColor: 'rgba(147,197,253,0.22)', borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 10, color: G.txtSub, fontWeight: '500', minWidth: 70, textAlign: 'right' },

  // Assign row
  assignRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingTop: 6, marginBottom: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(147,197,253,0.18)',
  },
  assignChip: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  assignMeta: { fontSize: 9, color: G.txtSub, fontWeight: '700', letterSpacing: 0.5 },
  assignName: { fontSize: 12, color: G.txt, fontWeight: '500', flexShrink: 1 },

  // Bottom
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: G.white },
  avatarText: { fontSize: 9, fontWeight: '700', color: G.white },
  arrowBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});

export default TaskCard;
