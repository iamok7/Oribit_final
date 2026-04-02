import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { getTasks } from '../services/api';

// ─── Liquid Glass High Contrast Palette ──────────────────────────────────────
const G = {
  bgLight:  '#F0F6FF',
  bgMid:    '#E0F2FE',
  bgDark:   '#F8FAFC',
  
  txtMain:  '#020617', // Slate 950
  txtMuted: '#1E293B', // Slate 800
  txtFaint: '#334155', // Slate 700

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

const GAP = 16;

// Native fluid shadow
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

// ─── Themed Configurations ───────────────────────────────────────────────────
const ROLE_CONFIG = {
  manager:    { label: 'Manager',    color: G.purple, bg: G.purpleBg, icon: 'star' },
  supervisor: { label: 'Supervisor', color: G.p700,   bg: G.p100,     icon: 'ribbon' },
  employee:   { label: 'Employee',   color: G.green,  bg: G.greenBg,  icon: 'person' },
  finance:    { label: 'Finance',    color: G.amber,  bg: G.amberBg,  icon: 'wallet' },
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

const AVATAR_COLORS = [G.purple, G.amber, G.green, G.p600, G.red];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
};

// ─── Components ──────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({ completed: 0, pending: 0, total: 0 });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await getTasks({ user_id: user?.id });
      const list = Array.isArray(data) ? data : data?.tasks || [];
      const completed = list.filter((t) => (t.status || '').toLowerCase() === 'completed').length;
      setStats({ completed, pending: list.length - completed, total: list.length });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const roleConfig = ROLE_CONFIG[user?.role] || ROLE_CONFIG.employee;
  const avatarColor = getAvatarColor(user?.username);

  const SettingsRow = ({ icon, iconColor = G.p600, label, value, onPress, rightElement, showArrow = true, isLast = false }) => (
    <TouchableOpacity
      style={[styles.settingsRow, !isLast && styles.settingsRowBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.settingsIconWrap, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.settingsLabel}>{label}</Text>
      
      {rightElement || (
        value !== undefined ? (
          <Text style={styles.settingsValue}>{value}</Text>
        ) : showArrow ? (
          <Ionicons name="chevron-forward" size={16} color={G.txtFaint} />
        ) : null
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />

      {/* ── Background Gradient & Ambient Orbs ── */}
      <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
      <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.p300 }]} />
      <View style={[styles.ambientOrb, { bottom: -100, left: -60, backgroundColor: '#A5F3FC', transform: [{ scale: 1.2 }] }]} />

      {/* ── Header (Solid RGBA to prevent BlurView clipping) ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="create" size={20} color={G.p700} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar & User Info ── */}
        <View style={[styles.shadowWrap, { marginBottom: GAP }]}>
          <View style={[styles.glassLight, styles.profileCard]}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />

            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{getInitials(user?.username)}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.username || 'User'}</Text>
              {user?.email && <Text style={styles.userEmail}>{user.email}</Text>}
              <View style={[styles.roleBadge, { backgroundColor: roleConfig.bg }]}>
                <Ionicons name={roleConfig.icon} size={12} color={roleConfig.color} />
                <Text style={[styles.roleBadgeText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          {[
            { label: 'Completed', val: stats.completed, color: G.green, bg: G.greenBg },
            { label: 'Pending',   val: stats.pending,   color: G.amber, bg: G.amberBg },
            { label: 'Total',     val: stats.total,     color: G.p700,  bg: G.p100 },
          ].map((s, i) => (
            <View key={i} style={[styles.miniStatPill, { backgroundColor: s.bg }]}>
              <Text style={[styles.miniStatPillNum, { color: s.color }]}>{s.val}</Text>
              <Text style={[styles.miniStatPillLabel, { color: s.color }]} numberOfLines={1} adjustsFontSizeToFit>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.shadowWrap}>
            <View style={styles.glassLight}>
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.3)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />

              {/* <SettingsRow icon="checkmark-done" label="My Tasks" onPress={() => navigation.navigate('Tasks')} /> */}
              {(user?.role === 'manager' || user?.role === 'supervisor') && (
                <SettingsRow icon="bar-chart" iconColor={G.amber} label= "My Progress Report" onPress={() => navigation.navigate('Progress')} />
              )}
              <SettingsRow icon="receipt" iconColor={G.purple} label="My Expenses" onPress={() => navigation.navigate('ExpensesStack')} isLast />
            </View>
          </View>
        </View>

        {/* ── Preferences ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.shadowWrap}>
            <View style={styles.glassLight}>
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.3)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />

              <SettingsRow
                icon="notifications"
                iconColor={G.amber}
                label="Notifications"
                rightElement={
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    trackColor={{ false: G.p200, true: G.p400 }}
                    thumbColor={notificationsEnabled ? G.p600 : G.white}
                  />
                }
              />
              {/* <SettingsRow
                icon="moon"
                iconColor={G.p800}
                label="Dark Mode"
                isLast
                rightElement={
                  <Switch
                    value={darkMode}
                    onValueChange={setDarkMode}
                    trackColor={{ false: G.p200, true: G.p400 }}
                    thumbColor={darkMode ? G.p600 : G.white}
                  />
                }
              /> */}
            </View>
          </View>
        </View>

        {/* ── Account Settings ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.shadowWrap}>
            <View style={styles.glassLight}>
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.3)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />

              <SettingsRow icon="shield-checkmark" iconColor={G.p600} label="Security" onPress={() => Alert.alert('Security', 'Restricted Access')} />
              <SettingsRow icon="help-circle" iconColor={G.green} label="Help & Support" onPress={() => Alert.alert('Help', 'Help & Support coming soon')} />
              <SettingsRow icon="information-circle" iconColor={G.txtFaint} label="About Workspace" value="v 0.76.6.52" showArrow={false} isLast />
            </View>
          </View>
        </View>

        {/* ── Account Info ── */}
        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Info</Text>
            <View style={styles.shadowWrap}>
              <View style={styles.glassLight}>
                <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.3)']} style={StyleSheet.absoluteFill} />
                <View style={styles.glassHighlight} />

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>User ID</Text>
                  <Text style={styles.infoValue}>#{user.id}</Text>
                </View>
                <View style={[styles.infoRow, !user.department_id && !user.company_name && { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>
                    {user.user_type === 'individual' ? 'Account Type' : 'Role'}
                  </Text>
                  <Text style={styles.infoValue}>
                    {user.user_type === 'individual' ? 'Individual' : roleConfig.label}
                  </Text>
                </View>
                {user.company_name && user.user_type !== 'individual' && (
                  <View style={[styles.infoRow, !user.department_id && { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoLabel}>Company</Text>
                    <Text style={styles.infoValue}>{user.company_name}</Text>
                  </View>
                )}
                {user.department_id && (
                  <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoLabel}>Department</Text>
                    <Text style={styles.infoValue}>#{user.department_id}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── Logout Button ── */}
        <TouchableOpacity style={[styles.shadowWrap, { marginTop: 10 }]} onPress={handleLogout} activeOpacity={0.8}>
          <View style={[styles.glassLight, styles.logoutBtn]}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(254,226,226,0.9)', 'rgba(254,226,226,0.5)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            
            <Ionicons name="log-out" size={20} color={G.red} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
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
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },

  // ── Scroll Content
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // ── Shadow Wrappers & Glass ──
  shadowWrap: { ...liquidShadow },
  glassLight: {
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
  },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white },

  // ── Profile Card
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: G.white, shadowColor: G.p900, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  avatarText: { fontSize: 24, fontWeight: '900', color: G.white, letterSpacing: 1 },
  profileInfo: { flex: 1, justifyContent: 'center' },
  userName: { fontSize: 22, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5, marginBottom: 2 },
  userEmail: { fontSize: 13, color: G.txtFaint, fontWeight: '700', marginBottom: 8 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  roleBadgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Stats Row
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  miniStatPill: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14, gap: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', ...liquidShadow, shadowOpacity: 0.05 },
  miniStatPillNum: { fontSize: 22, fontWeight: '900' },
  miniStatPillLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1, textAlign: 'right' },

  // ── Sections
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, color: G.txtFaint, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, paddingLeft: 8 },

  // ── Settings Rows
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  settingsRowBorder: { borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.04)' },
  settingsIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingsLabel: { flex: 1, fontSize: 15, fontWeight: '800', color: G.txtMain },
  settingsValue: { fontSize: 13, fontWeight: '800', color: G.txtFaint },

  // ── Info Rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.04)' },
  infoLabel: { fontSize: 14, color: G.txtFaint, fontWeight: '800' },
  infoValue: { fontSize: 14, color: G.txtMain, fontWeight: '900' },

  // ── Logout Button
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8, borderColor: '#FCA5A5' },
  logoutText: { fontSize: 16, fontWeight: '900', color: G.red, letterSpacing: 0.5 },
});