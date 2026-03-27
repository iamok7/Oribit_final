import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { getNotifications, markNotificationRead, markAllNotificationsRead, getRequirement } from '../services/api';

const G = {
  bgLight: '#F0F6FF', bgMid: '#E0F2FE',
  txtMain: '#020617', txtMuted: '#1E293B', txtFaint: '#475569',
  p100: '#DBEAFE', p500: '#3B82F6', p600: '#2563EB', p700: '#1D4ED8', p900: '#1E3A8A',
  white: '#FFFFFF',
  green: '#059669', greenBg: '#D1FAE5',
  amber: '#D97706', amberBg: '#FEF3C7',
  red: '#DC2626', redBg: '#FEE2E2',
  purple: '#7C3AED', purpleBg: '#EDE9FE',
};

const TYPE_META = {
  task_assigned: { icon: 'person-add',        color: G.p600,   bg: G.p100,     label: 'Assigned'  },
  task_status:   { icon: 'swap-horizontal',   color: G.amber,  bg: G.amberBg,  label: 'Status'    },
  task_comment:  { icon: 'chatbubble',         color: G.purple, bg: G.purpleBg, label: 'Comment'   },
  new_message:   { icon: 'chatbubble-ellipses',color: G.p600,   bg: G.p100,     label: 'Message'   },
  req_comment:   { icon: 'clipboard',          color: G.green,  bg: G.greenBg,  label: 'Req'       },
};

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.notifications || []);
      setUnread(res.unread_count || 0);
    } catch (e) {
      console.error('Failed to load notifications', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRead = async (n) => {
    if (!n.is_read) {
      await markNotificationRead(n.id).catch(() => {});
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setUnread(prev => Math.max(0, prev - 1));
    }
    // Navigate to relevant screen
    if (n.ref_type === 'task' && n.ref_id) {
      navigation.navigate('TaskDetail', { task: { id: n.ref_id } });
    } else if (n.ref_type === 'conversation' && n.ref_id) {
      navigation.navigate('Messaging');
    } else if (n.ref_type === 'group' && n.ref_id) {
      navigation.navigate('Messaging');
    } else if (n.ref_type === 'requirement' && n.ref_id) {
      try {
        const req = await getRequirement(n.ref_id);
        navigation.navigate('RequirementDetail', { requirement: req });
      } catch {
        navigation.navigate('Requirements');
      }
    }
  };

  const handleReadAll = async () => {
    await markAllNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
    setUnread(0);
  };

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={[G.bgLight, G.bgMid]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={G.p600} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={[G.bgLight, G.bgMid, '#F8FAFC']} style={StyleSheet.absoluteFill} />
      <View style={[styles.ambientOrb, { top: -60, right: -40, backgroundColor: G.p100 }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={G.p700} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unread > 0 && (
            <Text style={styles.headerSub}>{unread} unread</Text>
          )}
        </View>
        {unread > 0 && (
          <TouchableOpacity style={styles.readAllBtn} onPress={handleReadAll} activeOpacity={0.8}>
            <Text style={styles.readAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={G.p600} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={48} color={G.p300} />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySub}>No notifications yet. We'll let you know when something happens.</Text>
          </View>
        ) : (
          notifications.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.task_comment;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.notifWrap, !n.is_read && styles.notifUnread]}
                onPress={() => handleRead(n)}
                activeOpacity={0.85}
              >
                <View style={styles.notifCard}>
                  <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
                  <LinearGradient
                    colors={n.is_read
                      ? ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.2)']
                      : ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']}
                    style={StyleSheet.absoluteFill}
                  />
                  {!n.is_read && <View style={[styles.unreadBar, { backgroundColor: meta.color }]} />}

                  <View style={styles.notifRow}>
                    <View style={[styles.iconBadge, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.icon} size={18} color={meta.color} />
                    </View>
                    <View style={styles.notifText}>
                      <Text style={[styles.notifTitle, !n.is_read && { color: G.txtMain, fontWeight: '800' }]}
                        numberOfLines={1}>
                        {n.title}
                      </Text>
                      {n.body ? (
                        <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                      ) : null}
                    </View>
                    <View style={styles.notifMeta}>
                      <Text style={styles.notifTime}>{fmtTime(n.created_at)}</Text>
                      {!n.is_read && <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  ambientOrb: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100, opacity: 0.35,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: G.p600, fontWeight: '700', marginTop: 1 },
  readAllBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: G.p100, borderRadius: 20,
    borderWidth: 1, borderColor: G.p500 + '40',
  },
  readAllText: { fontSize: 12, fontWeight: '800', color: G.p600 },

  // List
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },

  notifWrap: { borderRadius: 18, overflow: 'hidden' },
  notifUnread: {
    shadowColor: G.p900, shadowOpacity: 0.1,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  notifCard: {
    borderRadius: 18, overflow: 'hidden',
    padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
  },
  unreadBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: 4,
  },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBadge: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifText: { flex: 1, gap: 3 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: G.txtMuted, lineHeight: 18 },
  notifBody: { fontSize: 13, color: G.txtFaint, lineHeight: 18 },
  notifMeta: { alignItems: 'flex-end', gap: 6, paddingTop: 2 },
  notifTime: { fontSize: 11, color: G.txtFaint, fontWeight: '600' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: G.p100, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: G.txtMain, marginBottom: 8 },
  emptySub: { fontSize: 14, color: G.txtFaint, textAlign: 'center', lineHeight: 22 },
});
