import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, TextInput, Platform, Animated, Modal, StatusBar, ScrollView,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { getConversations, getGroups, getOrCreateConversation, getUsers } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const { width: SW } = require('react-native').Dimensions.get('window');
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

const relativeTime = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

// ─── Bento Box Wrapper ───────────────────────────────────────────────────────
const BentoBox = ({ children, style, title, subtitle, titleColor = G.txtMain, noPad = false }) => (
  <View style={[styles.shadowWrap, { marginBottom: GAP }, style]}>
    <View style={styles.glassLight}>
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
      <View style={styles.glassHighlight} />
      
      {title && (
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 }}>
          <Text style={{ color: titleColor, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 }}>{title}</Text>
          {subtitle && <Text style={{ color: G.txtFaint, fontSize: 13, fontWeight: '700', marginTop: 2 }}>{subtitle}</Text>}
        </View>
      )}
      <View style={noPad ? undefined : { paddingHorizontal: 20, paddingBottom: 20, paddingTop: title ? 0 : 20 }}>
        {children}
      </View>
    </View>
  </View>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MessagingScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showNewDM, setShowNewDM] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [dmSearchQuery, setDmSearchQuery] = useState(''); 
  
  const modalAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [dms, groups] = await Promise.all([getConversations(), getGroups()]);
      const merged = [
        ...(Array.isArray(dms) ? dms : []),
        ...(Array.isArray(groups) ? groups : []),
      ].sort((a, b) => {
        const ta = a.last_message?.created_at || '';
        const tb = b.last_message?.created_at || '';
        return tb.localeCompare(ta);
      });
      setItems(merged);
    } catch {}
    finally { setIsLoading(false); setIsRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 5s
  useEffect(() => {
    const id = setInterval(() => load(true), 5000);
    return () => clearInterval(id);
  }, [load]);

  const onRefresh = () => { setIsRefreshing(true); load(); };

  const openNewDM = async () => {
    setShowNewDM(true);
    setDmSearchQuery('');
    Animated.spring(modalAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }).start();
    if (!allUsers.length) {
      try { 
        const u = await getUsers(); 
        setAllUsers(Array.isArray(u) ? u.filter(x => x.id !== user?.id && x.is_active !== false) : []); 
      } catch {}
    }
  };

  const closeNewDM = () => {
    Animated.timing(modalAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowNewDM(false);
    });
  };

  const startDM = async (otherUser) => {
    closeNewDM();
    try {
      const res = await getOrCreateConversation(otherUser.id);
      navigation.navigate('Chat', { type: 'dm', conversationId: res.conversation_id, otherUser });
    } catch {}
  };

  const openChat = (item) => {
    if (item.type === 'dm') {
      navigation.navigate('Chat', { type: 'dm', conversationId: item.id, otherUser: item.other_user });
    } else {
      navigation.navigate('Chat', { type: 'group', groupId: item.id, groupName: item.name });
    }
  };

  const filtered = items.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = item.type === 'dm' ? item.other_user?.username : item.name;
    return (name || '').toLowerCase().includes(q);
  });

  const filteredUsers = allUsers.filter(u => {
    if (!dmSearchQuery.trim()) return true;
    return (u.username || '').toLowerCase().includes(dmSearchQuery.toLowerCase().trim()) || (u.role || '').toLowerCase().includes(dmSearchQuery.toLowerCase().trim());
  });

  const totalUnread = items.reduce((s, i) => s + (i.unread_count || 0), 0);
  const activeChats = items.filter(i => i.type === 'dm' && i.other_user?.online);

  const renderItem = ({ item }) => {
    const name = item.type === 'dm' ? item.other_user?.username : item.name;
    const isOnline = item.type === 'dm' ? item.other_user?.online : false;
    const lastMsg = item.last_message;
    const unread = item.unread_count || 0;
    const color = avatarColor(name);
    const isGroup = item.type === 'group';
    const isUnread = unread > 0;

    return (
      <TouchableOpacity 
        style={[styles.shadowWrap, { marginBottom: GAP }]} 
        onPress={() => openChat(item)} 
        activeOpacity={0.8}
      >
        <View style={[styles.glassLight, isUnread && styles.glassLightUnread]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
          {isUnread && <LinearGradient colors={[G.p600, G.p400]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.unreadAccentBar} />}
          <View style={styles.glassHighlight} />
          
          <View style={[styles.rowInner, isUnread && { paddingLeft: 22 }]}>
            <View style={[styles.avatar, { backgroundColor: isGroup ? G.p100 : color, borderWidth: isGroup ? 2 : 0, borderColor: G.p300 }]}>
              {isGroup
                ? <Ionicons name="people" size={24} color={G.p700} />
                : <Text style={styles.avatarText}>{initials(name)}</Text>
              }
              {!isGroup && (
                <View style={[styles.onlineDot, { backgroundColor: isOnline ? G.green : '#CBD5E1' }]} />
              )}
            </View>

            <View style={styles.rowContent}>
              <View style={styles.rowTopLine}>
                <Text style={[styles.rowName, isUnread && { color: G.p900, fontWeight: '900' }]} numberOfLines={1}>{name || 'Unknown'}</Text>
                <Text style={[styles.rowTime, isUnread && { color: G.p700, fontWeight: '900' }]}>{relativeTime(lastMsg?.created_at)}</Text>
              </View>
              <View style={styles.rowBottomLine}>
                <Text style={[styles.rowPreview, isUnread && styles.rowPreviewUnread]} numberOfLines={1}>
                  {lastMsg ? (lastMsg.message_type === 'image' ? '📷 Image' : (lastMsg.content || '')) : 'No messages yet'}
                </Text>
                {isUnread && (
                  <LinearGradient colors={[G.p500, G.p700]} style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{unread > 9 ? '9+' : unread}</Text>
                  </LinearGradient>
                )}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) return <LoadingSpinner fullScreen message="Loading messages..." />;

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
            <Text style={styles.headerTitle}>Inbox</Text>
            <Text style={styles.headerSubtitle}>{items.length} Conversations</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('CreateGroup')} activeOpacity={0.8}>
              <Ionicons name="people" size={20} color={G.p700} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: G.p700, borderColor: G.p700 }]} onPress={openNewDM} activeOpacity={0.8}>
              <Ionicons name="create" size={20} color={G.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Main List with Dashboard Bento Grid at the Top ── */}
      <FlatList
        data={filtered}
        keyExtractor={item => `${item.type}-${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: 90 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={G.p700} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="chatbubbles" size={48} color={G.p400} />
            </View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>Tap the pen icon to start a direct message or create a new group.</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={{ marginBottom: GAP }}>
            
            {/* Bento Row 1: Stats & Active */}
            <View style={styles.bentoRow}>
              <BentoBox title="Unread" style={{ flex: 1 }}>
                <View style={styles.kpiWrap}>
                  <View style={[styles.kpiIcon, { backgroundColor: G.purpleBg }]}>
                    <Ionicons name="mail-unread" size={24} color={G.purple} />
                  </View>
                  <Text style={[styles.kpiValue, { color: G.purple }]}>{totalUnread}</Text>
                </View>
              </BentoBox>

              <BentoBox title="Total Chats" style={{ flex: 1 }}>
                <View style={styles.kpiWrap}>
                  <View style={[styles.kpiIcon, { backgroundColor: G.p100 }]}>
                    <Ionicons name="chatbox-ellipses" size={24} color={G.p700} />
                  </View>
                  <Text style={[styles.kpiValue, { color: G.p700 }]}>{items.length}</Text>
                </View>
              </BentoBox>
            </View>

            {/* Bento Row 2: Active Now (Horizontal Scroll) */}
            {activeChats.length > 0 && (
              <BentoBox title="Active Now" noPad>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 16 }}>
                  {activeChats.map((chat) => (
                    <TouchableOpacity key={chat.id} style={{ alignItems: 'center', gap: 6 }} onPress={() => openChat(chat)}>
                      <View style={[styles.avatarLg, { backgroundColor: avatarColor(chat.other_user?.username) }]}>
                        <Text style={styles.avatarLgText}>{initials(chat.other_user?.username)}</Text>
                        <View style={styles.onlineDotLg} />
                      </View>
                      <Text style={styles.activeName} numberOfLines={1}>
                        {(chat.other_user?.username || '').split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </BentoBox>
            )}

            {/* Bento Row 3: Search Bar */}
            <BentoBox>
              <View style={[styles.searchBox, searchQuery.length > 0 && styles.searchBoxActive]}>
                <Ionicons name="search" size={20} color={searchQuery.length > 0 ? G.p700 : G.txtFaint} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search messages..."
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
            </BentoBox>

            <Text style={styles.sectionLabel}>Recent Conversations</Text>
          </View>
        }
      />

      {/* ── New DM Modal (Liquid Glass High Contrast) ── */}
      <Modal visible={showNewDM} transparent animationType="none" onRequestClose={closeNewDM} statusBarTranslucent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeNewDM}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24), maxHeight: SW * 1.8 }]}>
              <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.8)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              
              <View style={styles.modalHandle} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={styles.modalTitle}>New Message</Text>
                <TouchableOpacity onPress={closeNewDM} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={26} color={G.txtFaint} />
                </TouchableOpacity>
              </View>

              {/* Modal User Search */}
              <View style={[styles.searchBox, dmSearchQuery.length > 0 && styles.searchBoxActive, { marginBottom: 16 }]}>
                <Ionicons name="search" size={20} color={dmSearchQuery.length > 0 ? G.p700 : G.txtFaint} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Find a teammate..."
                  placeholderTextColor={G.txtFaint}
                  value={dmSearchQuery}
                  onChangeText={setDmSearchQuery}
                  autoCorrect={false}
                  selectionColor={G.p600}
                />
                {dmSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setDmSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={G.txtFaint} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SW * 1.1 }} keyboardShouldPersistTaps="handled">
                {filteredUsers.length === 0 ? (
                  <View style={styles.noUsersWrap}>
                    <Ionicons name="search-outline" size={40} color={G.p300} style={{ marginBottom: 10 }} />
                    <Text style={styles.noUsersText}>{dmSearchQuery ? `No users match "${dmSearchQuery}"` : 'No other users found.'}</Text>
                  </View>
                ) : (
                  filteredUsers.map((u) => (
                    <TouchableOpacity key={u.id} style={styles.modalOption} onPress={() => startDM(u)} activeOpacity={0.7}>
                      <View style={[styles.userAvatar, { backgroundColor: avatarColor(u.username) }]}>
                        <Text style={styles.userAvatarText}>{initials(u.username)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalOptionText}>{u.username}</Text>
                        <Text style={styles.userRole}>{u.role}</Text>
                      </View>
                      <View style={styles.chatIconWrap}>
                        <Ionicons name="chatbubbles" size={16} color={G.white} />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
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
  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    ...liquidShadow, shadowOpacity: 0.08, shadowRadius: 8,
  },

  // ── Search
  searchBox: {
    flexDirection: 'row', alignItems: 'center', height: 50,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    borderWidth: 2, borderColor: G.p200,
    paddingHorizontal: 16, gap: 10,
  },
  searchBoxActive: { borderColor: G.p600, backgroundColor: G.white, shadowColor: G.p900, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '800', color: G.txtMain },

  // ── Dashboard Bento Components
  bentoRow: { flexDirection: 'row', gap: GAP },
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassLightUnread: { borderColor: G.p300, shadowColor: G.p600, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  unreadAccentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, zIndex: 6 },

  kpiWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },

  avatarLg: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.2 },
  avatarLgText: { fontSize: 18, fontWeight: '900', color: G.white },
  onlineDotLg: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: G.white, backgroundColor: G.green },
  activeName: { fontSize: 12, fontWeight: '900', color: G.txtMain, maxWidth: 64, textAlign: 'center' },

  sectionLabel: { fontSize: 12, fontWeight: '900', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 1.2, paddingLeft: 4, marginTop: 10 },

  // ── List & Content
  listContent: { paddingHorizontal: GUTTER, paddingTop: 16 },
  
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, marginTop: 40 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: G.p100, borderWidth: 2, borderColor: G.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...liquidShadow, shadowOpacity: 0.1 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, marginBottom: 8, letterSpacing: -0.5 },
  emptySubtitle: { fontSize: 14, color: G.txtFaint, textAlign: 'center', fontWeight: '700', lineHeight: 22 },

  // ── Chat Rows
  rowInner: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.2 },
  avatarText: { fontSize: 18, fontWeight: '900', color: G.white },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: G.white },
  
  rowContent: { flex: 1, justifyContent: 'center' },
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rowName: { fontSize: 16, fontWeight: '800', color: G.txtMain, flex: 1, letterSpacing: -0.2 },
  rowTime: { fontSize: 12, color: G.txtFaint, fontWeight: '800', marginLeft: 10 },
  rowBottomLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowPreview: { fontSize: 14, color: G.txtFaint, fontWeight: '700', flex: 1 },
  rowPreviewUnread: { color: G.txtMain, fontWeight: '800' },
  
  unreadBadge: { borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 10 },
  unreadText: { fontSize: 11, fontWeight: '900', color: G.white },

  // ── Modal (New DM Picker)
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', overflow: 'hidden', shadowColor: G.p900, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20 },
  modalHandle: { width: 48, height: 6, borderRadius: 3, backgroundColor: G.p200, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, marginBottom: 8, gap: 14, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' },
  userAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: G.p900, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  userAvatarText: { fontSize: 16, fontWeight: '900', color: G.white },
  modalOptionText: { fontSize: 16, color: G.txtMain, fontWeight: '900', letterSpacing: -0.2 },
  userRole: { fontSize: 11, color: G.txtFaint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  chatIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: G.p700, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.2 },
  
  noUsersWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  noUsersText: { fontSize: 15, color: G.txtFaint, textAlign: 'center', fontWeight: '800' },
});