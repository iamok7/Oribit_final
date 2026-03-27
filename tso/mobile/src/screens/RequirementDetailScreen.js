import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Image, Modal, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { updateRequirementStatus, getRequirementComments, postRequirementComment } from '../services/api';

const { width: SW } = require('react-native').Dimensions.get('window');
const GUTTER = 16;
const GAP = 14;

// ─── Liquid Glass High Contrast Palette ──────────────────────────────────────
const G = {
  bgLight:  '#F0F6FF',
  bgMid:    '#E0F2FE',
  bgDark:   '#F8FAFC',
  
  txtMain:  '#020617',
  txtMuted: '#1E293B',
  txtFaint: '#475569',

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

const CATEGORIES = {
  manpower:  { label: 'Manpower',  icon: 'people',    color: G.purple, bg: G.purpleBg },
  machinery: { label: 'Machinery', icon: 'construct', color: G.amber,  bg: G.amberBg  },
  uniforms:  { label: 'Uniforms',  icon: 'shirt',     color: G.pink,   bg: '#FCE7F3'  },
  shoes:     { label: 'Shoes',     icon: 'footsteps', color: G.teal,   bg: '#CCFBF1'  },
  other:     { label: 'Other',     icon: 'apps',      color: G.txtFaint, bg: G.p100   },
};

const STATUSES = {
  open:      { label: 'Open',      color: G.amber, bg: G.amberBg, icon: 'radio-button-on'  },
  in_review: { label: 'In Review', color: G.p700,  bg: G.p100,    icon: 'eye'              },
  resolved:  { label: 'Resolved',  color: G.green, bg: G.greenBg, icon: 'checkmark-circle' },
};

const ROLE_COLORS = {
  manager:    { bg: G.redBg,     text: G.red    },
  supervisor: { bg: G.amberBg,   text: G.amber  },
  employee:   { bg: G.p200,      text: G.p800   },
  finance:    { bg: G.greenBg,   text: G.green  },
};

const fmtDate = (iso) => {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return null; }
};

const relTime = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const isDeadlineSoon = (iso) => {
  if (!iso) return false;
  const diff = (new Date(iso) - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 3;
};
const isDeadlinePast = (iso) => iso && new Date(iso) < Date.now();

// ─── Avatar Circle ─────────────────────────────────────────────────────────
function Avatar({ name, size = 36, color = G.white, bg = G.p700 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOpacity: 0.1 }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '900', color }}>{initials}</Text>
    </View>
  );
}

// ─── Comment Bubble (Glassmorphic) ───────────────────────────────────────────
function CommentBubble({ comment, isOwn }) {
  const roleCfg = ROLE_COLORS[comment.author?.role] || ROLE_COLORS.employee;
  return (
    <View style={[cb.row, isOwn && cb.rowOwn]}>
      {!isOwn && <Avatar name={comment.author?.username} size={36} color={G.white} bg={G.p700} />}
      <View style={[cb.bubble, isOwn ? cb.bubbleOwn : cb.bubbleOther]}>
        {!isOwn && (
          <View style={cb.metaRow}>
            <Text style={cb.authorName}>{comment.author?.username || 'Unknown'}</Text>
            <View style={[cb.rolePill, { backgroundColor: roleCfg.bg }]}>
              <Text style={[cb.roleText, { color: roleCfg.text }]}>{comment.author?.role}</Text>
            </View>
          </View>
        )}
        <Text style={[cb.content, isOwn && cb.contentOwn]}>{comment.content}</Text>
        <Text style={[cb.time, isOwn && cb.timeOwn]}>{relTime(comment.created_at)}</Text>
      </View>
      {isOwn && <Avatar name={comment.author?.username} size={36} color={G.white} bg={G.purple} />}
    </View>
  );
}

const cb = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 16, paddingHorizontal: GUTTER },
  rowOwn:     { flexDirection: 'row-reverse' },
  bubble:     { maxWidth: '75%', borderRadius: 20, padding: 14 },
  bubbleOwn:  { backgroundColor: G.purple, borderBottomRightRadius: 4, ...liquidShadow, shadowColor: G.purple, shadowOpacity: 0.2 },
  bubbleOther:{ backgroundColor: 'rgba(255,255,255,0.7)', borderBottomLeftRadius: 4, borderWidth: 2, borderColor: G.p200, ...liquidShadow, shadowOpacity: 0.05 },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  authorName: { fontSize: 13, fontWeight: '900', color: G.txtMain },
  rolePill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 50 },
  roleText:   { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  content:    { fontSize: 15, color: G.txtMain, lineHeight: 22, fontWeight: '700' },
  contentOwn: { color: G.white },
  time:       { fontSize: 11, color: G.txtFaint, marginTop: 6, textAlign: 'right', fontWeight: '800' },
  timeOwn:    { color: 'rgba(255,255,255,0.7)' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function RequirementDetailScreen({ route, navigation }) {
  const { requirement: initial } = route.params;
  const [req,          setReq]          = useState(initial);
  const [isUpdating,   setIsUpdating]   = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [comments,     setComments]     = useState([]);
  const [loadingCmts,  setLoadingCmts]  = useState(true);
  const [commentText,  setCommentText]  = useState('');
  const [isSending,    setIsSending]    = useState(false);
  
  const { user, isManager, isSupervisor } = useAuth();
  const insets     = useSafeAreaInsets();
  const scrollRef  = useRef(null);

  const catCfg   = CATEGORIES[req.category] || CATEGORIES.other;
  const statCfg  = STATUSES[req.status]     || STATUSES.open;
  const canUpdate = (isManager() || isSupervisor()) && req.status !== 'resolved';

  const deadlinePast  = isDeadlinePast(req.deadline);
  const deadlineSoon  = !deadlinePast && isDeadlineSoon(req.deadline);
  const deadlineColor = deadlinePast ? G.red : deadlineSoon ? G.amber : G.p700;
  const deadlineBg    = deadlinePast ? G.redBg : deadlineSoon ? G.amberBg : G.p100;

  const loadComments = useCallback(async () => {
    try {
      const data = await getRequirementComments(req.id);
      setComments(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoadingCmts(false); }
  }, [req.id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setIsSending(true);
    try {
      const newComment = await postRequirementComment(req.id, text);
      setComments(prev => [...prev, newComment]);
      setCommentText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to post comment');
    } finally { setIsSending(false); }
  };

  const handleStatusUpdate = (newStatus) => {
    const label = STATUSES[newStatus]?.label || newStatus;
    Alert.alert('Update Status', `Mark this requirement as "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
            setIsUpdating(true);
            try {
              await updateRequirementStatus(req.id, newStatus);
              setReq(prev => ({ ...prev, status: newStatus }));
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally { setIsUpdating(false); }
          },
      },
    ]);
  };

  const BentoBox = ({ children, style }) => (
    <View style={[styles.shadowWrap, { marginBottom: GAP }, style]}>
      <View style={styles.glassLight}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
        <View style={styles.glassHighlight} />
        {children}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* ── Stable Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.amberBg }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -60, backgroundColor: G.p300, transform: [{ scale: 1.2 }] }]} />
      </View>

      {/* ── KAV wraps Content & Input properly ── */}
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
          
          <View style={styles.headerCenter}>
            <Ionicons name="clipboard" size={20} color={G.amber} />
            <Text style={styles.headerTitle} numberOfLines={1}>Requirement Detail</Text>
          </View>

          <View style={[styles.headerStatusBadge, { backgroundColor: statCfg.bg, borderColor: statCfg.color + '50' }]}>
            <Ionicons name={statCfg.icon} size={14} color={statCfg.color} />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={[styles.content, { paddingBottom: 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero Card ── */}
          <BentoBox style={{ overflow: 'hidden' }}>
            <View style={[styles.heroAccent, { backgroundColor: catCfg.color }]} />
            <View style={styles.cardPadding}>
              <View style={styles.heroTopRow}>
                <View style={[styles.catBadge, { backgroundColor: catCfg.bg, borderColor: catCfg.color + '50' }]}>
                  <Ionicons name={catCfg.icon} size={14} color={catCfg.color} />
                  <Text style={[styles.catBadgeText, { color: catCfg.color }]}>{catCfg.label}</Text>
                </View>
                <Text style={styles.timeAgo}>{relTime(req.created_at)}</Text>
              </View>
              <Text style={styles.heroTitle}>{req.title}</Text>
              {!!req.description && <Text style={styles.heroDesc}>{req.description}</Text>}
            </View>
          </BentoBox>

          {/* ── Stats Row ── */}
          {(req.quantity || req.deadline) && (
            <View style={styles.bentoRow}>
              {!!req.quantity && (
                <BentoBox style={[styles.bentoItem, { borderColor: G.purple + '40', borderWidth: 2, backgroundColor: G.purpleBg }]}>
                  <View style={styles.statCardInner}>
                    <View style={[styles.statIcon, { backgroundColor: G.purple + '20' }]}>
                      <Ionicons name="layers" size={20} color={G.purple} />
                    </View>
                    <Text style={styles.statCardLabel}>Required Count</Text>
                    <Text style={[styles.statCardValue, { color: G.purple }]}>{req.quantity}</Text>
                    <Text style={styles.statCardSub}>units needed</Text>
                  </View>
                </BentoBox>
              )}
              
              {!!req.deadline && (
                <BentoBox style={[styles.bentoItem, { borderColor: deadlineColor + '40', borderWidth: 2, backgroundColor: deadlineBg }]}>
                  <View style={styles.statCardInner}>
                    <View style={[styles.statIcon, { backgroundColor: deadlineColor + '20' }]}>
                      <Ionicons name={deadlinePast ? 'alert-circle' : 'calendar'} size={20} color={deadlineColor} />
                    </View>
                    <Text style={styles.statCardLabel}>{deadlinePast ? 'Deadline Passed' : deadlineSoon ? 'Due Soon' : 'Deadline'}</Text>
                    <Text style={[styles.statCardValue, { color: deadlineColor }]} numberOfLines={1} adjustsFontSizeToFit>
                      {fmtDate(req.deadline)}
                    </Text>
                    <Text style={styles.statCardSub}>{deadlinePast ? 'overdue' : 'to fulfill'}</Text>
                  </View>
                </BentoBox>
              )}
            </View>
          )}

          {/* ── Details ── */}
          <BentoBox>
            <View style={styles.cardPadding}>
              <Text style={styles.sectionLabel}>Details</Text>
              <DetailRow icon="person" iconBg={G.p100} iconColor={G.p700} label="Posted By">
                <Text style={styles.detailRowValue}>{req.poster?.username || 'Unknown'}</Text>
                {req.poster?.role && (
                  <View style={[styles.rolePill, { backgroundColor: G.p200 }]}>
                    <Text style={[styles.rolePillText, { color: G.p800 }]}>{req.poster.role}</Text>
                  </View>
                )}
              </DetailRow>
              <View style={styles.divider} />
              <DetailRow icon="business" iconBg={G.amberBg} iconColor={G.amber} label="Department">
                <Text style={styles.detailRowValue}>{req.dept?.name || '—'}</Text>
              </DetailRow>
              <View style={styles.divider} />
              <DetailRow icon={catCfg.icon} iconBg={catCfg.bg} iconColor={catCfg.color} label="Category">
                <Text style={[styles.detailRowValue, { color: catCfg.color }]}>{catCfg.label}</Text>
              </DetailRow>
              <View style={styles.divider} />
              <DetailRow icon={statCfg.icon} iconBg={statCfg.bg} iconColor={statCfg.color} label="Status">
                <Text style={[styles.detailRowValue, { color: statCfg.color }]}>{statCfg.label}</Text>
              </DetailRow>
            </View>
          </BentoBox>

          {/* ── Attachment ── */}
          {!!req.attachment && (
            <BentoBox>
              <View style={styles.cardPadding}>
                <Text style={styles.sectionLabel}>Attachment</Text>
                <TouchableOpacity onPress={() => setPreviewImage(req.attachment)} activeOpacity={0.85}>
                  <View style={styles.attachWrap}>
                    <Image source={{ uri: req.attachment }} style={styles.attachImage} resizeMode="cover" />
                    <View style={styles.attachOverlay}>
                      <Ionicons name="expand" size={24} color={G.white} />
                      <Text style={styles.attachOverlayText}>Tap to expand</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </BentoBox>
          )}

          {/* ── Status actions ── */}
          {canUpdate && (
            <BentoBox>
              <View style={styles.cardPadding}>
                <Text style={styles.sectionLabel}>Update Status</Text>
                {isUpdating && (
                  <View style={styles.updatingRow}>
                    <ActivityIndicator size="small" color={G.p600} />
                    <Text style={styles.updatingText}>Updating...</Text>
                  </View>
                )}
                <View style={styles.actionBtnRow}>
                  {req.status === 'open' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: G.white, borderColor: G.p300 }]}
                      onPress={() => handleStatusUpdate('in_review')}
                      disabled={isUpdating}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="eye" size={18} color={G.p700} />
                      <Text style={[styles.actionBtnText, { color: G.p700 }]}>Mark In Review</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: G.green, borderColor: G.green }]}
                    onPress={() => handleStatusUpdate('resolved')}
                    disabled={isUpdating}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={G.white} />
                    <Text style={[styles.actionBtnText, { color: G.white }]}>Mark Resolved</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </BentoBox>
          )}

          {/* ── Discussion ── */}
          <View style={styles.discussionHeader}>
            <Text style={styles.sectionLabel}>Discussion</Text>
            {comments.length > 0 && (
              <View style={styles.commentCountBadge}>
                <Text style={styles.commentCountText}>{comments.length}</Text>
              </View>
            )}
          </View>

          {loadingCmts ? (
            <View style={styles.cLoading}>
              <ActivityIndicator size="small" color={G.p600} />
              <Text style={styles.cLoadingText}>Loading comments…</Text>
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.cEmpty}>
              <Ionicons name="chatbubbles" size={42} color={G.p300} />
              <Text style={styles.cEmptyText}>No comments yet</Text>
              <Text style={styles.cEmptySubText}>Be the first to add a comment</Text>
            </View>
          ) : (
            <View style={{ paddingTop: 4 }}>
              {comments.map(comment => (
                <CommentBubble key={comment.id} comment={comment} isOwn={comment.author?.id === user?.id} />
              ))}
            </View>
          )}
        </ScrollView>

        {/* ── Floating Comment Input (In Flex Flow) ── */}
        <View style={[styles.floatingInputWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <BlurView intensity={90} tint="light" style={styles.floatingInputInner}>
            <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.5)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            
            <View style={styles.inputRow}>
              <Avatar name={user?.username} size={44} color={G.white} bg={G.p700} />
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment…"
                placeholderTextColor={G.txtFaint}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                selectionColor={G.p600}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!commentText.trim() || isSending) && { opacity: 0.5 }]}
                onPress={handleSendComment}
                disabled={!commentText.trim() || isSending}
                activeOpacity={0.8}
              >
                {isSending ? <ActivityIndicator size="small" color={G.white} /> : <Ionicons name="send" size={18} color={G.white} style={{ marginLeft: 2 }} />}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>

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

    </View>
  );
}

// ─── Helper Component ────────────────────────────────────────────────────────
function DetailRow({ icon, iconBg, iconColor, label, children }) {
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.detailTextGroup}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {children}
        </View>
      </View>
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
  headerTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  headerStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  headerStatusText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Content
  scroll: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 16 },

  // ── Bento Layout
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  cardPadding: { padding: 22, paddingLeft: 26 }, // Extra left padding for Hero Accent
  
  bentoRow: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  bentoItem: { flex: 1, borderRadius: 24 },

  heroAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, zIndex: 6 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingLeft: 2 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  catBadgeText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  timeAgo: { fontSize: 13, color: G.txtFaint, fontWeight: '800' },
  heroTitle: { fontSize: 26, fontWeight: '900', color: G.txtMain, lineHeight: 32, marginBottom: 10, letterSpacing: -0.5, paddingLeft: 2 },
  heroDesc: { fontSize: 15, color: G.txtFaint, fontWeight: '700', lineHeight: 24, paddingLeft: 2 },

  // ── Stats (Bento Items)
  statCardInner: { padding: 20, flex: 1, justifyContent: 'center' },
  statIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statCardLabel: { fontSize: 12, fontWeight: '900', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statCardValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 2 },
  statCardSub: { fontSize: 12, color: G.txtFaint, fontWeight: '800' },

  // ── Details
  sectionLabel: { fontSize: 14, color: G.txtFaint, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16, paddingLeft: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 16 },
  detailIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailTextGroup: { flex: 1 },
  detailRowLabel: { fontSize: 12, color: G.txtFaint, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailRowValue: { fontSize: 16, fontWeight: '900', color: G.txtMain },
  divider: { height: 1.5, backgroundColor: 'rgba(0,0,0,0.05)' },
  
  rolePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  rolePillText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  urgentPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  urgentText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Attachments
  attachWrap: { borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: G.p200, ...liquidShadow },
  attachImage: { width: '100%', height: 220 },
  attachOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15,23,42,0.6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  attachOverlayText: { fontSize: 15, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  // ── Status Actions
  updatingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  updatingText: { fontSize: 14, color: G.p700, fontWeight: '800' },
  actionBtnRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 2 },
  actionBtnText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.2 },

  // ── Discussion
  discussionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingLeft: 4, marginBottom: 16 },
  commentCountBadge: { backgroundColor: G.p700, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  commentCountText: { fontSize: 12, fontWeight: '900', color: G.white },

  cLoading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 30, paddingHorizontal: 16 },
  cLoadingText: { fontSize: 15, color: G.txtFaint, fontWeight: '800' },
  cEmpty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  cEmptyText: { fontSize: 18, fontWeight: '900', color: G.txtMain },
  cEmptySubText: { fontSize: 14, color: G.txtFaint, fontWeight: '700' },

  // ── Floating Input (In Normal Flex Flow)
  floatingInputWrap: { paddingHorizontal: GUTTER, paddingTop: 10, backgroundColor: 'transparent', zIndex: 10 },
  floatingInputInner: { borderRadius: 32, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', padding: 10, ...liquidShadow, shadowOffset: { width: 0, height: -4 } },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  commentInput: { flex: 1, backgroundColor: G.white, borderRadius: 24, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, fontSize: 15, fontWeight: '800', color: G.txtMain, maxHeight: 120, borderWidth: 2, borderColor: G.p200, minHeight: 52 },
  sendBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: G.p700, alignItems: 'center', justifyContent: 'center', shadowColor: G.p900, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },

  // ── Modal Lightbox
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.95)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: SW, height: SW * 1.5 },
  previewClose: { position: 'absolute', top: 60, right: 20, zIndex: 10 },
  previewCloseBtn: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
});