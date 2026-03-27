import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { getUsers, createGroup } from '../services/api';

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
  teal:     '#0D9488',
  pink:     '#DB2777',
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
      <View style={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: title ? 0 : 20 }}>
        {children}
      </View>
    </View>
  </View>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CreateGroupScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [groupName, setGroupName] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const u = await getUsers();
        setUsers(Array.isArray(u) ? u.filter(x => x.id !== user?.id && x.is_active !== false) : []);
      } catch {}
      finally { setIsLoading(false); }
    })();
  }, [user?.id]);

  const toggleUser = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { Alert.alert('Group Name Required', 'Please enter a group name.'); return; }
    if (selected.size === 0) { Alert.alert('Select Members', 'Add at least one member to the group.'); return; }
    setIsCreating(true);
    try {
      const res = await createGroup(groupName.trim(), [...selected]);
      navigation.replace('Chat', { type: 'group', groupId: res.group_id, groupName: groupName.trim() });
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create group');
    } finally { setIsCreating(false); }
  };

  const renderUser = ({ item }) => {
    const isSel = selected.has(item.id);
    return (
      <TouchableOpacity
        style={[
          styles.userRow, 
          isSel && styles.userRowSelected,
          isSel && { shadowColor: G.p900, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4 }
        ]}
        onPress={() => toggleUser(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: avatarColor(item.username) }]}>
          <Text style={styles.avatarText}>{initials(item.username)}</Text>
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, isSel && { color: G.p900 }]}>{item.username}</Text>
          <Text style={styles.userRole}>{item.role}</Text>
        </View>
        
        <View style={[styles.checkbox, isSel && styles.checkboxSelected]}>
          {isSel && <Ionicons name="checkmark" size={16} color={G.white} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
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
            <Ionicons name="people" size={20} color={G.p700} />
            <Text style={styles.headerTitle}>New Group</Text>
          </View>
          
          <TouchableOpacity
            style={[styles.createBtn, (!groupName.trim() || selected.size === 0 || isCreating) && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={!groupName.trim() || selected.size === 0 || isCreating}
            activeOpacity={0.8}
          >
            {isCreating ? <ActivityIndicator size="small" color={G.white} /> : <Text style={styles.createBtnText}>Create</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content ── */}
      <View style={{ flex: 1, paddingHorizontal: GUTTER, paddingTop: 16 }}>
        
        {/* Bento Box: Group Name */}
        <BentoBox title="Group Details">
          <View style={styles.inputRow}>
            <Ionicons name="chatbubbles" size={20} color={groupName.length > 0 ? G.p700 : G.txtFaint} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.nameInput}
              placeholder="Enter group name..."
              placeholderTextColor={G.txtFaint}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={60}
              selectionColor={G.p600}
            />
          </View>
          <Text style={styles.selectedCount}>
            {selected.size} member{selected.size !== 1 ? 's' : ''} selected
          </Text>
        </BentoBox>

        <Text style={styles.sectionLabel}>Select Members</Text>

        {/* User List */}
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={G.p700} />
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={u => String(u.id)}
            renderItem={renderUser}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </KeyboardAvoidingView>
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
  createBtn: {
    backgroundColor: G.p700, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, minWidth: 80, alignItems: 'center',
    ...liquidShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25,
  },
  createBtnText: { fontSize: 14, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  // ── Bento Box Layout
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },

  // ── Form Input
  inputRow: {
    flexDirection: 'row', alignItems: 'center', height: 50,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    borderWidth: 2, borderColor: G.p200,
    paddingHorizontal: 14,
  },
  nameInput: { flex: 1, fontSize: 16, color: G.txtMain, fontWeight: '800' },
  selectedCount: { fontSize: 13, color: G.p600, fontWeight: '800', marginTop: 10, paddingLeft: 4 },

  sectionLabel: { fontSize: 12, fontWeight: '900', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 1.2, paddingLeft: 4, marginBottom: 12, marginTop: 4 },
  
  loadingWrap: { flex: 1, alignItems: 'center', paddingTop: 40 },
  listContent: { paddingBottom: 100 },

  // ── User Rows
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20,
    borderWidth: 2, borderColor: G.p200,
    padding: 14, marginBottom: 10,
  },
  userRowSelected: { backgroundColor: G.p100, borderColor: G.p300 },
  
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.1 },
  avatarText: { fontSize: 16, fontWeight: '900', color: G.white },
  
  userName: { fontSize: 16, fontWeight: '900', color: G.txtMain, letterSpacing: -0.2, marginBottom: 2 },
  userRole: { fontSize: 12, color: G.txtFaint, textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: G.p300, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: G.p700, borderColor: G.p700 },
});