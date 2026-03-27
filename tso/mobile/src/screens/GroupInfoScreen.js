import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, StatusBar, Alert, TextInput, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { getGroupInfo, getUsers, addGroupMember, removeGroupMember } from '../services/api';

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

const ROLE_COLORS = {
  manager:    { label: 'Manager',    color: G.purple, bg: G.purpleBg },
  supervisor: { label: 'Supervisor', color: G.amber,  bg: G.amberBg },
  employee:   { label: 'Employee',   color: G.green,  bg: G.greenBg },
  finance:    { label: 'Finance',    color: G.p700,   bg: G.p100 },
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// ─── Bento Box Wrapper ───────────────────────────────────────────────────────
const BentoBox = ({ children, style, title, subtitle }) => (
  <View style={[styles.shadowWrap, { marginBottom: GAP }, style]}>
    <View style={styles.glassLight}>
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
      <View style={styles.glassHighlight} />
      
      {title && (
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: G.txtMain, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 }}>{title}</Text>
          {subtitle && <View style={styles.subtitlePill}><Text style={styles.subtitlePillText}>{subtitle}</Text></View>}
        </View>
      )}
      <View style={{ paddingBottom: 10, paddingTop: title ? 0 : 20 }}>
        {children}
      </View>
    </View>
  </View>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export default function GroupInfoScreen({ navigation, route }) {
  const { groupId } = route.params || {};
  const { user, isManager } = useAuth();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  const loadGroupInfo = useCallback(async () => {
    try {
      const data = await getGroupInfo(groupId);
      setInfo(data);
    } catch {
      setInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadGroupInfo();
  }, [loadGroupInfo]);

  const openAddMemberModal = async () => {
    if (!isManager()) return;
    setShowAddMemberModal(true);
    try {
      const users = await getUsers();
      setAllUsers(Array.isArray(users) ? users : []);
    } catch {
      setAllUsers([]);
    }
  };

  const handleAddMember = async (member) => {
    if (!member?.id) return;
    setIsSubmitting(true);
    try {
      await addGroupMember(groupId, member.id);
      await loadGroupInfo();
      Alert.alert('Success', `${member.username} added to group`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to add member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = (member) => {
    if (!member?.id) return;
    Alert.alert(
      'Remove Member',
      `Remove ${member.username} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await removeGroupMember(groupId, member.id);
              await loadGroupInfo();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to remove member');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const candidateUsers = (allUsers || []).filter((u) => {
    if (!u?.id) return false;
    if (u.id === user?.id) return false;
    const alreadyInGroup = (info?.members || []).some((m) => m.id === u.id);
    if (alreadyInGroup) return false;
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (u.username || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
  });

  const renderMember = (item, idx, arrLength) => {
    const roleCfg = ROLE_COLORS[item.role] || ROLE_COLORS.employee;
    return (
      <View key={item.id} style={[styles.memberRow, idx < arrLength - 1 && styles.memberRowBorder]}>
        <View style={[styles.memberAvatar, { backgroundColor: avatarColor(item.username) }]}>
          <Text style={styles.memberAvatarText}>{initials(item.username)}</Text>
          <View style={[styles.onlineDot, { backgroundColor: item.online ? G.green : '#CBD5E1' }]} />
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName} numberOfLines={1}>{item.username}</Text>
          <View style={[styles.rolePill, { backgroundColor: roleCfg.bg }]}>
            <Text style={[styles.memberRole, { color: roleCfg.color }]}>{roleCfg.label}</Text>
          </View>
        </View>
        <View style={styles.memberActions}>
          {item.online && (
            <View style={styles.onlinePill}>
              <Text style={styles.onlinePillText}>Online</Text>
            </View>
          )}
          {isManager() && item.id !== user?.id && (
            <TouchableOpacity
              style={styles.removeMemberBtn}
              onPress={() => handleRemoveMember(item)}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              <Ionicons name="person-remove" size={16} color={G.red} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

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
            <Ionicons name="information-circle" size={20} color={G.p700} />
            <Text style={styles.headerTitle} numberOfLines={1}>Group Info</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={G.p700} />
        </View>
      ) : !info ? (
        <View style={styles.loadingWrap}>
          <Ionicons name="alert-circle" size={48} color={G.red} style={{ marginBottom: 16 }} />
          <Text style={styles.errorText}>Could not load group info.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          
          {/* ── Hero Section (Avatar + Name) ── */}
          <View style={styles.heroSection}>
            <View style={[styles.groupAvatar, { backgroundColor: avatarColor(info.name) }]}>
              <Ionicons name="people" size={48} color={G.white} />
            </View>
            <Text style={styles.groupName}>{info.name}</Text>
          </View>

          {/* ── Details Bento ── */}
          <BentoBox title="Details">
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: G.p100 }]}><Ionicons name="calendar" size={18} color={G.p700} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Created On</Text>
                <Text style={styles.infoValue}>{fmtDate(info.created_at)}</Text>
              </View>
            </View>
            
            <View style={styles.infoDivider} />
            
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: G.amberBg }]}><Ionicons name="person" size={18} color={G.amber} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Created By</Text>
                <View style={styles.infoCreatorRow}>
                  <View style={[styles.miniAvatar, { backgroundColor: avatarColor(info.creator.username) }]}>
                    <Text style={styles.miniAvatarText}>{initials(info.creator.username)}</Text>
                  </View>
                  <Text style={styles.infoValue}>{info.creator.username}</Text>
                </View>
              </View>
            </View>
          </BentoBox>

          {/* ── Members Bento ── */}
          <BentoBox title="Members" subtitle={info.members.length.toString()}>
            {isManager() && (
              <View style={styles.memberAdminRow}>
                <Text style={styles.memberAdminHint}>Manager Controls</Text>
                <TouchableOpacity style={styles.addMemberBtn} onPress={openAddMemberModal} activeOpacity={0.8}>
                  <Ionicons name="person-add" size={16} color={G.white} />
                  <Text style={styles.addMemberBtnText}>Add Member</Text>
                </TouchableOpacity>
              </View>
            )}
            {info.members.map((item, idx) => renderMember(item, idx, info.members.length))}
          </BentoBox>

        </ScrollView>
      )}

      <Modal
        visible={showAddMemberModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddMemberModal(false)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.7)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />

            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Group Members</Text>

            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={G.txtFaint} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users..."
                placeholderTextColor={G.txtFaint}
                value={userSearch}
                onChangeText={setUserSearch}
                autoCapitalize="none"
              />
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {candidateUsers.length === 0 ? (
                <Text style={styles.noCandidatesText}>No users available to add.</Text>
              ) : (
                candidateUsers.map((member) => (
                  <View key={member.id} style={styles.candidateRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: avatarColor(member.username) }]}>
                      <Text style={styles.memberAvatarText}>{initials(member.username)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.username}</Text>
                      <Text style={styles.memberRole}>{(member.role || 'employee').toUpperCase()}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.addInlineBtn, isSubmitting && { opacity: 0.6 }]}
                      onPress={() => handleAddMember(member)}
                      disabled={isSubmitting}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add" size={18} color={G.white} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
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
  heroSection: { alignItems: 'center', paddingVertical: 40, gap: 16 },
  groupAvatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.25 },
  groupName: { fontSize: 28, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5, textAlign: 'center' },

  // ── Bento Layout
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  subtitlePill: { backgroundColor: G.p100, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5, borderColor: G.p200 },
  subtitlePillText: { fontSize: 11, fontWeight: '900', color: G.p700 },

  // ── Info Rows
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 6 },
  infoIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, color: G.txtFaint, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 16, color: G.txtMain, fontWeight: '800' },
  infoCreatorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoDivider: { height: 1.5, backgroundColor: 'rgba(0,0,0,0.04)', marginHorizontal: 20, marginVertical: 10 },

  miniAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 10, fontWeight: '900', color: G.white },

  // ── Members List
  memberAdminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  memberAdminHint: {
    fontSize: 11,
    color: G.txtFaint,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: G.p700,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addMemberBtnText: { fontSize: 12, color: G.white, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  memberRowBorder: { borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.04)' },
  memberAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.1 },
  memberAvatarText: { fontSize: 16, fontWeight: '900', color: G.white },
  onlineDot: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: G.white },

  memberInfo: { flex: 1, justifyContent: 'center' },
  memberName: { fontSize: 16, fontWeight: '900', color: G.txtMain, letterSpacing: -0.2, marginBottom: 2 },
  rolePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  memberRole: { fontSize: 11, textTransform: 'uppercase', fontWeight: '900', letterSpacing: 0.5 },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  onlinePill: { backgroundColor: G.greenBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5, borderColor: G.green + '40' },
  onlinePillText: { fontSize: 11, fontWeight: '900', color: G.green, textTransform: 'uppercase', letterSpacing: 0.5 },
  removeMemberBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: G.redBg,
    borderWidth: 1.5,
    borderColor: G.red + '40',
  },

  // ── Add Member Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
    shadowColor: G.p900,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHandle: { width: 48, height: 6, borderRadius: 3, backgroundColor: G.p200, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, marginBottom: 14, letterSpacing: -0.4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: G.p200,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, fontWeight: '800', color: G.txtMain },
  noCandidatesText: { fontSize: 14, color: G.txtFaint, textAlign: 'center', paddingVertical: 18, fontWeight: '700' },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  addInlineBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: G.p700,
  },
});
