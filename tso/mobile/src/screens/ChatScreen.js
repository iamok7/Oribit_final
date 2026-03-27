import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, Modal, Image,
  ActivityIndicator, Animated, StatusBar, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import {
  getDMMessages, sendDMMessage, sendTypingDM, getTypingDM,
  getGroupMessages, sendGroupMessage, sendTypingGroup, getTypingGroup,
  getGroupInfo, getTasks,
} from '../services/api';

const GUTTER = 16;

// ─── Liquid Glass High Contrast Palette ──────────────────────────────────────
const G = {
  bgLight:  '#F0F6FF', bgMid: '#E0F2FE', bgDark: '#F8FAFC',
  txtMain:  '#020617', txtMuted: '#1E293B', txtFaint: '#475569',
  p100: '#DBEAFE', p200: '#BFDBFE', p300: '#93C5FD', p400: '#60A5FA',
  p500: '#3B82F6', p600: '#2563EB', p700: '#1D4ED8', p800: '#1E40AF', p900: '#1E3A8A',
  white: '#FFFFFF',
  amber: '#D97706', amberBg: '#FEF3C7',
  green: '#059669', greenBg: '#D1FAE5',
  red:   '#DC2626', redBg:   '#FEE2E2',
  purple:'#7C3AED', purpleBg:'#EDE9FE',
  pink:  '#DB2777', teal:    '#0D9488',
};
const { width: SW } = Dimensions.get('window');
const liquidShadow = { shadowColor: G.p900, shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 };

const AVATAR_COLORS = [G.p600, G.green, G.amber, G.purple, G.pink, G.teal, G.red];
const avatarColor = (s) => AVATAR_COLORS[(s || '').charCodeAt(0) % AVATAR_COLORS.length];
const initials = (s) => (s || '?').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';

const fmtTimestamp = (iso) => {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return isToday ? `Today ${timePart}` : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${timePart}`;
};

const STATUS_COLORS = { completed: G.green, in_progress: G.amber, pending: G.p500, blocked: G.red, review: G.purple };
const ROLE_COLORS = { manager: { bg: G.redBg, text: G.red }, supervisor: { bg: G.amberBg, text: G.amber }, employee: { bg: G.p200, text: G.p800 }, finance: { bg: G.greenBg, text: G.green } };

// Parse message content into segments: plain text, @mention, [task:id:title]
function parseContent(content) {
  if (!content) return [];
  const TOKEN_RE = /(@\w+|\[task:\d+:[^\]]+\])/g;
  const parts = [];
  let last = 0, m;
  while ((m = TOKEN_RE.exec(content)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: content.slice(last, m.index) });
    const token = m[0];
    if (token.startsWith('@')) {
      parts.push({ type: 'mention', value: token });
    } else {
      const inner = token.slice(1, -1);
      const [, taskId, ...titleParts] = inner.split(':');
      parts.push({ type: 'task', id: taskId, title: titleParts.join(':') });
    }
    last = m.index + token.length;
  }
  if (last < content.length) parts.push({ type: 'text', value: content.slice(last) });
  return parts;
}

// Animated typing dots
function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (dot, delay) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(dot, { toValue: -5, duration: 300, useNativeDriver: true }),
      Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(600),
    ]));
    const a1 = bounce(dot1, 0), a2 = bounce(dot2, 150), a3 = bounce(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingDots}>
      {[dot1, dot2, dot3].map((dot, i) => <Animated.View key={i} style={[styles.typingDot, { transform: [{ translateY: dot }] }]} />)}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function ChatScreen({ navigation, route }) {
  const { type, conversationId, groupId, otherUser, groupName } = route.params || {};
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [messages, setMessages]           = useState([]);
  const [text, setText]                   = useState('');
  const [isSending, setIsSending]         = useState(false);
  const [isTyping, setIsTyping]           = useState(false);
  const [typerName, setTyperName]         = useState('');
  const [previewImage, setPreviewImage]   = useState(null);
  const [isLoadingInit, setIsLoadingInit] = useState(true);

  const [groupMembers, setGroupMembers]   = useState([]);
  const [memberCount, setMemberCount]     = useState(0);

  // Overlays state
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showTaskPicker, setShowTaskPicker]         = useState(false);
  const [taskQuery, setTaskQuery]                   = useState('');
  const [allTasks, setAllTasks]                     = useState([]);
  const [taskSuggestions, setTaskSuggestions]       = useState([]);
  
  const tasksLoadedRef = useRef(false);
  const lastIdRef      = useRef(0);
  const typingTimerRef = useRef(null);
  const flatListRef    = useRef(null);

  const isGroup = type === 'group';
  const chatId  = isGroup ? groupId : conversationId;
  const chatTitle = isGroup ? groupName : otherUser?.username;
  const isOtherOnline = !isGroup && otherUser?.online;

  useEffect(() => {
    if (!isGroup) return;
    getGroupInfo(chatId).then(info => {
      if (info?.members) { setGroupMembers(info.members); setMemberCount(info.members.length); }
    }).catch(() => {});
  }, [chatId, isGroup]);

  const fetchMessages = useCallback(async (silent = false) => {
    try {
      const msgs = isGroup ? await getGroupMessages(chatId, lastIdRef.current) : await getDMMessages(chatId, lastIdRef.current);
      if (Array.isArray(msgs) && msgs.length > 0) {
        setMessages(prev => silent ? [...prev, ...msgs] : msgs);
        lastIdRef.current = msgs[msgs.length - 1].id;
      }
    } catch {} finally { setIsLoadingInit(false); }
  }, [chatId, isGroup]);

  const fetchTyping = useCallback(async () => {
    try {
      const res = isGroup ? await getTypingGroup(chatId) : await getTypingDM(chatId);
      setIsTyping(res?.typing || false);
      setTyperName(res?.username || '');
    } catch {}
  }, [chatId, isGroup]);

  useEffect(() => { fetchMessages(false); }, [fetchMessages]);

  useEffect(() => {
    const msgInterval = setInterval(() => fetchMessages(true), 3000);
    const typingInterval = setInterval(fetchTyping, 2000);
    return () => { clearInterval(msgInterval); clearInterval(typingInterval); };
  }, [fetchMessages, fetchTyping]);

  const loadTasks = useCallback(async () => {
    if (tasksLoadedRef.current) return;
    tasksLoadedRef.current = true;
    try {
      const tasks = await getTasks();
      setAllTasks(Array.isArray(tasks) ? tasks : []);
    } catch {}
  }, []);

  // ─── Input & Overlay Logic ──────────────────────────────────────────────────
  const handleTextChange = (val) => {
    setText(val);
    
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => { if (val.trim()) isGroup ? sendTypingGroup(chatId) : sendTypingDM(chatId); }, 500);

    // Mention Detection: Matches @ followed by letters/spaces up to end of string
    if (isGroup) {
      const atMatch = val.match(/(?:^|\s)@([a-zA-Z0-9_ ]*)$/);
      if (atMatch) {
        const q = atMatch[1].toLowerCase();
        setMentionSuggestions(
          groupMembers.filter(m => m.id !== user?.id && m.username.toLowerCase().includes(q)).slice(0, 5)
        );
      } else { 
        setMentionSuggestions([]); 
      }
    }

    // Task Detection: Matches / followed by letters/spaces up to end of string
    const slashMatch = val.match(/(?:^|\s)\/([a-zA-Z0-9_ ]*)$/);
    if (slashMatch) {
      const q = slashMatch[1].toLowerCase();
      setTaskQuery(q); 
      setShowTaskPicker(true); 
      loadTasks();
      setTaskSuggestions(allTasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 8));
    } else { 
      setShowTaskPicker(false); 
      setTaskQuery(''); 
    }
  };

  useEffect(() => {
    if (!showTaskPicker) return;
    setTaskSuggestions(allTasks.filter(t => t.title.toLowerCase().includes(taskQuery)).slice(0, 8));
  }, [allTasks, taskQuery, showTaskPicker]);

  const insertMention = (username) => { 
    setText(text.replace(/@([a-zA-Z0-9_ ]*)$/, `@${username} `)); 
    setMentionSuggestions([]); 
  };
  
  const insertTaskRef = (task) => { 
    setText(text.replace(/\/([a-zA-Z0-9_ ]*)$/, `[task:${task.id}:${task.title}] `)); 
    setShowTaskPicker(false); 
    setTaskQuery(''); 
  };

  const sendMessage = async (content = null, imageAttachment = null, messageType = 'text') => {
    const finalContent = content ?? text.trim();
    if (!finalContent && !imageAttachment) return;
    setIsSending(true); setText(''); setMentionSuggestions([]); setShowTaskPicker(false);
    try {
      const msg = isGroup ? await sendGroupMessage(chatId, finalContent, imageAttachment, messageType) : await sendDMMessage(chatId, finalContent, imageAttachment, messageType);
      setMessages(prev => [...prev, msg]);
      lastIdRef.current = msg.id;
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {} finally { setIsSending(false); }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) sendMessage(null, `data:image/jpeg;base64,${result.assets[0].base64}`, 'image');
  };

  const findMemberByMention = (mentionValue) => {
    const uname = mentionValue.slice(1).toLowerCase();
    return groupMembers.find(m => m.username.toLowerCase() === uname) || (!isGroup && otherUser?.username?.toLowerCase() === uname ? otherUser : null);
  };

  const renderContent = (content, isMine) => {
    const segments = parseContent(content);
    if (segments.length === 0) return null;
    return (
      <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
        {segments.map((seg, i) => {
          if (seg.type === 'mention') {
            const member = findMemberByMention(seg.value);
            return <Text key={i} style={[styles.mentionText, isMine && styles.mentionTextMine]} onPress={member ? () => navigation.navigate('UserProfile', { userId: member.id, username: member.username }) : undefined}>{seg.value}</Text>;
          }
          if (seg.type === 'task') return <Text key={i} style={[styles.taskRefChip, isMine && styles.taskRefChipMine]} onPress={() => navigation.navigate('TaskDetail', { task: { id: Number(seg.id), title: seg.title } })}>{'📌 '}{seg.title}</Text>;
          return seg.value;
        })}
      </Text>
    );
  };

  const renderMessage = ({ item, index }) => {
    const isMine    = item.sender?.id === user?.id;
    const prevMsg   = messages[index - 1];
    const showTime  = !prevMsg || new Date(item.created_at) - new Date(prevMsg.created_at) > 300000;

    return (
      <View>
        {showTime && <Text style={styles.timeStamp}>{fmtTimestamp(item.created_at)}</Text>}
        <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
          {!isMine && (
            <View style={[styles.msgAvatar, { backgroundColor: avatarColor(item.sender?.username) }]}>
              <Text style={styles.msgAvatarText}>{initials(item.sender?.username)}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, item.message_type === 'image' && styles.bubbleImage]}
            onPress={item.message_type === 'image' ? () => setPreviewImage(item.image_attachment) : undefined}
            activeOpacity={item.message_type === 'image' ? 0.85 : 1}
          >
            {isMine && item.message_type !== 'image' && <LinearGradient colors={[G.p600, G.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
            {isGroup && !isMine && <Text style={styles.senderName}>{item.sender?.username}</Text>}
            {item.message_type === 'image' ? <Image source={{ uri: item.image_attachment }} style={styles.msgImage} resizeMode="cover" /> : renderContent(item.content, isMine)}
            <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>{new Date(item.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const navigateToInfo = () => isGroup ? navigation.navigate('GroupInfo', { groupId: chatId, groupName: chatTitle }) : navigation.navigate('UserProfile', { userId: otherUser?.id, username: chatTitle });

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* ── Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.p300 }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -60, backgroundColor: '#A5F3FC', transform: [{ scale: 1.2 }] }]} />
      </View>

      {/* ── Frosted Header ── */}
      <BlurView intensity={80} tint="light" style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          <View style={[styles.headerAvatar, { backgroundColor: avatarColor(chatTitle) }]}>
            {isGroup ? <Ionicons name="people" size={20} color={G.white} /> : <Text style={styles.headerAvatarText}>{initials(chatTitle)}</Text>}
            {!isGroup && <View style={[styles.onlineDot, { backgroundColor: isOtherOnline ? G.green : '#CBD5E1' }]} />}
          </View>
          <TouchableOpacity style={styles.headerInfo} onPress={navigateToInfo} activeOpacity={0.7}>
            <Text style={styles.headerTitle} numberOfLines={1}>{chatTitle}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {isGroup ? `${memberCount > 0 ? `${memberCount} members` : 'Group'}${isTyping ? ` · ${typerName} typing…` : ''}` : (isTyping ? 'typing…' : (isOtherOnline ? 'Online' : 'Offline'))}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoBtn} onPress={navigateToInfo} activeOpacity={0.7}>
            <Ionicons name="information-circle" size={24} color={G.p700} />
          </TouchableOpacity>
        </View>
        <View style={styles.glassHighlight} />
      </BlurView>

      {/* ── Messages List ── */}
      {isLoadingInit ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={G.p700} /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={[styles.messageList, { paddingTop: 20, paddingBottom: 20 }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <View style={styles.emptyIconWrap}><Ionicons name="chatbubbles" size={48} color={G.p400} /></View>
              <Text style={styles.emptyChatText}>No messages yet.</Text>
              <Text style={styles.emptyChatSub}>Start the conversation!</Text>
            </View>
          }
        />
      )}

      {/* ── Typing Indicator ── */}
      {isTyping && (
        <View style={styles.typingBar}>
          <TypingDots />
          <Text style={styles.typingText}>{typerName} is typing…</Text>
        </View>
      )}

      {/* ── Floating Input & Dynamic Overlays (Anchored in Flex Flow) ── */}
      <View style={[styles.floatingInputWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        
        {/* Dynamic Overlays that push UP from the input bar */}
        <View style={styles.overlaysContainer}>
          
          {/* @ Mention Overlay */}
          {mentionSuggestions.length > 0 && (
            <BlurView intensity={90} tint="light" style={styles.suggestionOverlay}>
              <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.6)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              {mentionSuggestions.map((m, idx) => (
                <TouchableOpacity key={m.id} style={[styles.suggestionRow, idx < mentionSuggestions.length - 1 && styles.suggestionRowBorder]} onPress={() => insertMention(m.username)} activeOpacity={0.7}>
                  <View style={[styles.suggestionAvatar, { backgroundColor: avatarColor(m.username) }]}>
                    <Text style={styles.suggestionAvatarText}>{initials(m.username)}</Text>
                    {m.online && <View style={styles.suggestionOnlineDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName}>{m.username}</Text>
                    <Text style={styles.suggestionRole}>{m.role}</Text>
                  </View>
                  <Ionicons name="at" size={20} color={G.p700} />
                </TouchableOpacity>
              ))}
            </BlurView>
          )}

          {/* / Task Picker Overlay */}
          {showTaskPicker && (
            <BlurView intensity={90} tint="light" style={styles.taskPickerPanel}>
              <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.6)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              <View style={styles.taskPickerHeader}>
                <Ionicons name="bookmark" size={18} color={G.p700} />
                <Text style={styles.taskPickerTitle}>{taskQuery ? `Tasks matching "${taskQuery}"` : 'Reference a Task — keep typing to filter'}</Text>
                <TouchableOpacity onPress={() => { setShowTaskPicker(false); setTaskQuery(''); setText(prev => prev.replace(/\/[^/\n]*$/, '')); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={22} color={G.txtFaint} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={taskSuggestions}
                keyExtractor={item => String(item.id)}
                style={styles.taskList}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<View style={styles.taskEmpty}><Text style={styles.taskEmptyText}>{allTasks.length === 0 ? 'Loading tasks…' : 'No tasks match'}</Text></View>}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.taskRow} onPress={() => insertTaskRef(item)} activeOpacity={0.7}>
                    <View style={[styles.taskStatusDot, { backgroundColor: STATUS_COLORS[item.status] || G.p400 }]} />
                    <View style={styles.taskRowInfo}>
                      <Text style={styles.taskRowTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.taskRowMeta}>#{item.id}{item.status ? `  ·  ${item.status.replace(/_/g, ' ')}` : ''}</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color={G.p700} />
                  </TouchableOpacity>
                )}
              />
            </BlurView>
          )}
        </View>

        {/* Input Bar */}
        <BlurView intensity={90} tint="light" style={styles.floatingInputInner}>
          <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.5)']} style={StyleSheet.absoluteFill} />
          <View style={styles.glassHighlight} />
          
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.attachBtn} onPress={pickImage} activeOpacity={0.7}>
              <Ionicons name="image" size={24} color={G.p700} />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder={isGroup ? 'Message… (@ mention, / task)' : 'Type a message…'}
              placeholderTextColor={G.txtFaint}
              value={text}
              onChangeText={handleTextChange}
              multiline
              maxLength={1000}
              selectionColor={G.p600}
            />
            <TouchableOpacity style={[styles.sendBtn, (!text.trim() || isSending) && { opacity: 0.5 }]} onPress={() => sendMessage()} disabled={!text.trim() || isSending} activeOpacity={0.8}>
              {isSending ? <ActivityIndicator size="small" color={G.white} /> : <Ionicons name="send" size={18} color={G.white} style={{ marginLeft: 2 }} />}
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>

      {/* ── Image Preview Modal ── */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)} statusBarTranslucent>
        <View style={styles.previewBackdrop}>
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewImage(null)} activeOpacity={0.8}>
            <BlurView intensity={40} tint="dark" style={styles.previewCloseBtn}>
              <Ionicons name="close" size={28} color={G.white} />
            </BlurView>
          </TouchableOpacity>
          <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4, filter: [{ blur: 50 }] },

  // ── Header
  header: { borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,255,255,0.9)', ...liquidShadow, zIndex: 10 },
  headerInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER, paddingBottom: 15, gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: G.white, borderWidth: 2, borderColor: G.p200, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.08, shadowRadius: 8 },
  headerAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.1 },
  headerAvatarText: { fontSize: 18, fontWeight: '900', color: G.white },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: G.white },
  headerInfo: { flex: 1, paddingLeft: 4 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: G.txtFaint, fontWeight: '800', marginTop: 2 },
  infoBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: G.white, borderWidth: 2, borderColor: G.p200, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.08, shadowRadius: 8 },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },

  // ── Messages
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { paddingHorizontal: GUTTER },
  timeStamp: { textAlign: 'center', fontSize: 12, color: G.txtFaint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginVertical: 16 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 10 },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...liquidShadow, shadowOpacity: 0.1 },
  msgAvatarText: { fontSize: 13, fontWeight: '900', color: G.white },
  msgAvatarPlaceholder: { width: 36, flexShrink: 0 },

  bubble: { maxWidth: '75%', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, overflow: 'hidden' },
  bubbleOther: { backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', borderBottomLeftRadius: 4, ...liquidShadow, shadowOpacity: 0.06 },
  bubbleMine: { borderBottomRightRadius: 4, ...liquidShadow, shadowColor: G.p600, shadowOpacity: 0.2 },
  bubbleImage: { paddingHorizontal: 4, paddingVertical: 4, backgroundColor: 'transparent', borderWidth: 0 },

  bubbleText: { fontSize: 16, color: G.txtMain, lineHeight: 22, fontWeight: '700' },
  bubbleTextMine: { color: G.white },
  senderName: { fontSize: 11, fontWeight: '900', color: G.p700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  msgImage: { width: 220, height: 160, borderRadius: 16 },
  msgTime: { fontSize: 11, color: G.txtFaint, marginTop: 6, alignSelf: 'flex-end', fontWeight: '800' },
  msgTimeMine: { color: 'rgba(255,255,255,0.75)' },

  mentionText: { color: G.p700, fontWeight: '900', backgroundColor: G.p540, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12 },
  mentionTextMine: { color: G.white, fontWeight: '900', textDecorationLine: 'underline' },
  taskRefChip: { color: G.amber, fontWeight: '900', textDecorationLine: 'underline' },
  taskRefChipMine: { color: G.amberBg, fontWeight: '900', textDecorationLine: 'underline' },

  // ── Typing
  typingBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 8, gap: 10 },
  typingDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: G.p500 },
  typingText: { fontSize: 13, color: G.txtFaint, fontWeight: '800', fontStyle: 'italic' },

  // ── Floating Overlays (Positioned within normal flow, pushed up by input)
  overlaysContainer: { width: '100%', paddingBottom: 12 },
  suggestionOverlay: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', ...liquidShadow },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  suggestionRowBorder: { borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  suggestionAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  suggestionAvatarText: { fontSize: 15, fontWeight: '900', color: G.white },
  suggestionOnlineDot: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: G.green, borderWidth: 2, borderColor: G.white },
  suggestionName: { fontSize: 16, fontWeight: '900', color: G.txtMain },
  suggestionRole: { fontSize: 11, color: G.txtFaint, textTransform: 'uppercase', fontWeight: '800', marginTop: 2 },

  taskPickerPanel: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', maxHeight: 260, ...liquidShadow },
  taskPickerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  taskPickerTitle: { flex: 1, fontSize: 13, fontWeight: '900', color: G.txtMain, textTransform: 'uppercase', letterSpacing: 0.5 },
  taskList: { maxHeight: 200 },
  taskEmpty: { alignItems: 'center', paddingVertical: 20 },
  taskEmptyText: { fontSize: 14, color: G.txtFaint, fontWeight: '800', fontStyle: 'italic' },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.04)' },
  taskStatusDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  taskRowInfo: { flex: 1 },
  taskRowTitle: { fontSize: 15, fontWeight: '800', color: G.txtMain, letterSpacing: -0.2 },
  taskRowMeta: { fontSize: 12, color: G.txtFaint, marginTop: 4, textTransform: 'capitalize', fontWeight: '700' },

  // ── Floating Input Bar
  floatingInputWrap: { paddingHorizontal: GUTTER, paddingTop: 10, backgroundColor: 'transparent' },
  floatingInputInner: { borderRadius: 32, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', padding: 10, ...liquidShadow, shadowOffset: { width: 0, height: -4 } },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: G.p200 },
  textInput: { flex: 1, backgroundColor: G.white, borderRadius: 24, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, fontSize: 15, fontWeight: '800', color: G.txtMain, maxHeight: 120, borderWidth: 2, borderColor: G.p200, minHeight: 52 },
  sendBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: G.p700, alignItems: 'center', justifyContent: 'center', shadowColor: G.p900, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },

  // ── Empty State
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 120 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: G.p100, borderWidth: 2, borderColor: G.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...liquidShadow, shadowOpacity: 0.1 },
  emptyChatText: { fontSize: 20, fontWeight: '900', color: G.txtMain, marginBottom: 8, letterSpacing: -0.5 },
  emptyChatSub: { fontSize: 14, color: G.txtFaint, fontWeight: '700' },

  // ── Image Preview Lightbox
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.95)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: SW, height: SW * 1.5 },
  previewClose: { position: 'absolute', top: 60, right: 20, zIndex: 10 },
  previewCloseBtn: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
});