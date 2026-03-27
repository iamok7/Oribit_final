import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { getUserProfile, getOnlineStatus } from '../services/api';

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

const AVATAR_COLORS = [G.p600, G.green, G.amber, G.purple, G.pink, G.teal, G.red];
const avatarColor = (s) => AVATAR_COLORS[(s || '').charCodeAt(0) % AVATAR_COLORS.length];
const initials = (s) => (s || '?').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';

const ROLE_COLORS   = { manager: G.purple, supervisor: G.amber, employee: G.green, finance: G.p700 };
const ROLE_ICONS    = { manager: 'shield-checkmark', supervisor: 'star', employee: 'person', finance: 'wallet' };

// ─── Bento Box Wrapper ───────────────────────────────────────────────────────
const BentoBox = ({ children, style, title, subtitle }) => (
  <View style={[styles.shadowWrap, { marginBottom: GAP }, style]}>
    <View style={styles.glassLight}>
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
      <View style={styles.glassHighlight} />
      
      {title && (
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 }}>
          <Text style={{ color: G.txtMain, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 }}>{title}</Text>
          {subtitle && <Text style={{ color: G.txtFaint, fontSize: 12, fontWeight: '700', marginTop: 2 }}>{subtitle}</Text>}
        </View>
      )}
      <View style={{ paddingBottom: 20, paddingTop: title ? 0 : 20 }}>
        {children}
      </View>
    </View>
  </View>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export default function UserProfileScreen({ navigation, route }) {
  const { userId, username } = route.params || {};
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getUserProfile(userId),
      getOnlineStatus([userId]),
    ]).then(([profRes, onlineRes]) => {
      if (profRes.status === 'fulfilled') setProfile(profRes.value);
      if (onlineRes.status === 'fulfilled') setIsOnline(onlineRes.value?.[String(userId)] || false);
    }).finally(() => setIsLoading(false));
  }, [userId]);

  const roleColor  = ROLE_COLORS[profile?.role] || G.p600;
  const roleIcon   = ROLE_ICONS[profile?.role]  || 'person';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* ── Stable Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: roleColor }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -60, backgroundColor: G.p300, transform: [{ scale: 1.2 }] }]} />
      </View>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="person" size={20} color={G.p700} />
            <Text style={styles.headerTitle} numberOfLines={1}>Profile</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={G.p700} />
        </View>
      ) : !profile ? (
        <View style={styles.loadingWrap}>
          <Ionicons name="alert-circle" size={48} color={G.red} style={{ marginBottom: 16 }} />
          <Text style={styles.errorText}>Could not load profile.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          
          {/* ── Hero Section ── */}
          <View style={styles.heroSection}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: avatarColor(profile.username) }]}>
                <Text style={styles.avatarText}>{initials(profile.username)}</Text>
              </View>
              <View style={[styles.onlineDot, { backgroundColor: isOnline ? G.green : '#CBD5E1' }]} />
            </View>
            <Text style={styles.username}>{profile.username}</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <View style={[styles.roleBadge, { backgroundColor: roleColor + '20', borderColor: roleColor + '40' }]}>
                <Ionicons name={roleIcon} size={14} color={roleColor} />
                <Text style={[styles.roleText, { color: roleColor }]}>{profile.role}</Text>
              </View>
              <View style={[styles.onlinePill, { backgroundColor: isOnline ? G.greenBg : G.bgMid, borderColor: isOnline ? G.green + '40' : G.p200 }]}>
                <Text style={[styles.onlinePillText, { color: isOnline ? G.green : G.txtFaint }]}>
                  {isOnline ? 'Online now' : 'Offline'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Stats Bento ── */}
          <View style={styles.bentoRow}>
            <BentoBox style={{ flex: 1 }}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{profile.allocated_projects_count ?? 0}</Text>
                <Text style={styles.statLabel}>Projects</Text>
              </View>
            </BentoBox>
            
            <BentoBox style={{ flex: 1 }}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{profile.allocated_tasks_count ?? 0}</Text>
                <Text style={styles.statLabel}>Tasks</Text>
              </View>
            </BentoBox>
          </View>

          {/* ── Details Bento ── */}
          <BentoBox title="User Details">
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: G.p100 }]}>
                <Ionicons name="id-card" size={18} color={G.p700} />
              </View>
              <View style={styles.detailTextGroup}>
                <Text style={styles.detailLabel}>User ID</Text>
                <Text style={styles.detailValue}>#{profile.id}</Text>
              </View>
            </View>
            
            {profile.department_id != null && (
              <>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <View style={[styles.detailIcon, { backgroundColor: G.amberBg }]}>
                    <Ionicons name="business" size={18} color={G.amber} />
                  </View>
                  <View style={styles.detailTextGroup}>
                    <Text style={styles.detailLabel}>Department</Text>
                    <Text style={styles.detailValue}>Dept #{profile.department_id}</Text>
                  </View>
                </View>
              </>
            )}
          </BentoBox>

          {/* ── Message Button ── */}
          <TouchableOpacity style={styles.messageBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <LinearGradient colors={[G.p600, G.p800]} style={StyleSheet.absoluteFill} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <Ionicons name="chatbubble-ellipses" size={22} color={G.white} />
            <Text style={styles.messageBtnText}>Send Message</Text>
          </TouchableOpacity>

        </ScrollView>
      )}
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
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: G.txtFaint, fontWeight: '800' },

  scroll: { paddingHorizontal: GUTTER },

  // ── Hero Section
  heroSection: { alignItems: 'center', paddingVertical: 40 },
  avatarWrap: { position: 'relative', marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.25 },
  avatarText: { fontSize: 36, fontWeight: '900', color: G.white },
  onlineDot: { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, borderWidth: 4, borderColor: G.white },
  
  username: { fontSize: 28, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  roleText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  onlinePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  onlinePillText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Bento Layout
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  
  bentoRow: { flexDirection: 'row', gap: GAP },

  // ── Stats (Bento)
  statCard: { alignItems: 'center', justifyContent: 'center' },
  statNumber: { fontSize: 36, fontWeight: '900', color: G.p700, letterSpacing: -1 },
  statLabel: { fontSize: 12, fontWeight: '900', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },

  // ── Details (Bento)
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 14 },
  detailIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailTextGroup: { flex: 1 },
  detailLabel: { fontSize: 12, color: G.txtFaint, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailValue: { fontSize: 16, color: G.txtMain, fontWeight: '900' },
  detailDivider: { height: 1.5, backgroundColor: 'rgba(0,0,0,0.05)', marginHorizontal: 20, marginVertical: 6 },

  // ── Buttons
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 24, paddingVertical: 18, marginTop: 24,
    ...liquidShadow, overflow: 'hidden'
  },
  messageBtnText: { fontSize: 16, fontWeight: '900', color: G.white, letterSpacing: 0.5 },
});